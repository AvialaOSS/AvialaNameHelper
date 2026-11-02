/**
 * The document-wide usage census: what binds each variable, and what pins its
 * mode.
 *
 * Three counters come out and they are never summed. `aliasInbound` is computed
 * from the snapshot alone, so the walk cannot affect it. `layerBindings` and
 * `styleBindings` come from the walk, and are kept apart because they answer
 * different questions — a layer binding is something a designer placed, a style
 * binding is something every consumer of that style inherits.
 *
 * `explicitVariableModes` is counted alongside them but is not a binding. A
 * frame pinned to a non-default mode loses that pin when its collection is
 * recreated, while every binding on it survives and keeps pointing at a live
 * variable — so the artwork does not break, it silently resolves to a different
 * value. Nothing a binding walk reads reveals this, which is why the census
 * reads pages and nodes for it explicitly.
 *
 * Two traps this walk has to respect:
 *
 * **Never set `figma.skipInvisibleInstanceChildren`.** It defaults to false and
 * setting it true would make the walk faster by skipping invisible instance
 * children — which are still bound, still resolve, and still break. A census
 * that under-counts is worse than a slow one.
 *
 * **Styles are invisible to any node walk.** A text style's line height can be
 * bound and no node in the document reports it, because the binding lives on the
 * style. All four local-style getters are read here, and all four are the async
 * forms: the sync ones throw under `documentAccess: "dynamic-page"`.
 *
 * ## What a failed read closes
 *
 * Any read can throw, and a throw means the counters are a floor rather than a
 * count. The gate closes — `known` goes false, `plan.ts` adds `census-incomplete`,
 * and the row stops being selectable — but only for the variables the failure
 * could actually have hidden. A failed `fills` read cannot have hidden a STRING
 * binding, so STRING and BOOLEAN rows stay writable while COLOR rows close. A
 * page that would not load, or a `componentProperties` read that threw, could
 * have hidden anything, and closes every local row.
 *
 * In a stable document there are no gaps at all: `boundVariables` is plain data
 * and does not throw. A gap means the document moved while the walk was running,
 * in which case the epoch has probably changed too and the honest answer really
 * is "run this again".
 */

import { aliasEdges } from "../paradigm/snapshot";
import { collectNodeBindingHits, collectStyleBindingHits } from "./bound";
import { readPublishStatus } from "./readSnapshot";
import type {
  BindingSite,
  CensusGap,
  CensusProgress,
  MigrationSnapshot,
  SnapshotVariable,
  UsageCensus,
  UsageCensusResult,
} from "../protocol/migration";
import type { VariableResolvedType } from "../protocol/messages";

/**
 * How many sites travel with one variable.
 *
 * The counts are exact regardless; this only bounds the drill-down sample, so a
 * variable bound in four thousand places does not put four thousand objects
 * through postMessage.
 */
const SITES_PER_VARIABLE = 20;

/** How many gaps travel back. The exact total is `gaps.length + gapsOmitted`. */
const MAX_GAPS = 50;

type LooseRecord = Record<string, unknown>;

/**
 * Which resolved types a failed read could have hidden. `null` means
 * unrestricted: the group can hold an alias to a variable of any type.
 *
 * A group name missing from the table resolves to `null` too, so a future
 * bindable field fails closed rather than being treated as harmless.
 */
const GROUP_TYPES: Readonly<
  Record<string, ReadonlySet<VariableResolvedType> | null>
> = {
  boundVariables: null,
  fills: new Set(["COLOR"]),
  strokes: new Set(["COLOR"]),
  effects: new Set(["COLOR", "FLOAT"]),
  layoutGrids: new Set(["COLOR", "FLOAT"]),
  paints: new Set(["COLOR"]),
  componentProperties: null,
  componentPropertyDefinitions: null,
};

/** The same narrowing for a whole style kind, keyed by holder. */
const STYLE_TYPES: Readonly<
  Record<BindingSite["holder"], ReadonlySet<VariableResolvedType> | null>
> = {
  node: null,
  paintStyle: new Set(["COLOR"]),
  textStyle: new Set(["FLOAT"]),
  effectStyle: new Set(["COLOR", "FLOAT"]),
  gridStyle: new Set(["COLOR", "FLOAT"]),
};

type Accumulator = {
  aliasInbound: number;
  /** Keyed by holder and canonical site, so the two views of one binding dedupe. */
  sites: Map<string, BindingSite>;
  explicitModeAssignments: number;
};

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Walk the whole document and count what it uses.
 *
 * `onProgress` fires once per page, before that page is walked, so a file whose
 * first page takes a minute still tells the user which page it is on. `pagesDone`
 * is the number of pages already finished.
 */
export async function runUsageCensus(
  snapshot: MigrationSnapshot,
  onProgress: (progress: CensusProgress) => void
): Promise<UsageCensusResult> {
  const startedAt = Date.now();
  const gaps: CensusGap[] = [];
  /** One entry per failure; `null` closes every local row. */
  const restrictions: (ReadonlySet<VariableResolvedType> | null)[] = [];

  const all: readonly SnapshotVariable[] = [
    ...snapshot.variables,
    ...snapshot.externalVariables,
  ];
  const variableById = new Map(all.map((variable) => [variable.id, variable]));
  const variableIdsByCollection = new Map<string, string[]>();
  for (const variable of all) {
    const ids = variableIdsByCollection.get(variable.collectionId);
    if (ids) ids.push(variable.id);
    else variableIdsByCollection.set(variable.collectionId, [variable.id]);
  }

  const accumulators = new Map<string, Accumulator>();
  for (const variable of all) {
    accumulators.set(variable.id, {
      aliasInbound: 0,
      sites: new Map(),
      explicitModeAssignments: 0,
    });
  }
  /**
   * Created on demand: a layer can bind a library variable that no local aliases,
   * which the snapshot's alias-following never discovered. There is no row for it,
   * so the entry is inert — but dropping the hit would hide a real binding.
   */
  const accumulatorFor = (id: string): Accumulator => {
    const existing = accumulators.get(id);
    if (existing) return existing;
    const created: Accumulator = {
      aliasInbound: 0,
      sites: new Map(),
      explicitModeAssignments: 0,
    };
    accumulators.set(id, created);
    return created;
  };

  // Aliases first: pure snapshot arithmetic, exact, and the one counter a
  // failed walk cannot degrade.
  for (const edge of aliasEdges(snapshot)) {
    accumulatorFor(edge.targetId).aliasInbound += 1;
  }

  const addHits = (
    hits: readonly { site: string; field: string; variableId: string }[],
    holder: BindingSite["holder"],
    holderId: string,
    holderName: string,
    pageName: string | null
  ): void => {
    for (const hit of hits) {
      const sites = accumulatorFor(hit.variableId).sites;
      const key = `${holder}:${holderId}\u0000${hit.site}`;
      if (sites.has(key)) continue;
      sites.set(key, {
        holder,
        holderId,
        holderName,
        pageName,
        field: hit.field,
      });
    }
  };

  /**
   * Mode pins are attributed to every variable in the pinned collection, because
   * that is what recreating the collection costs: a frame pinned to Mobile
   * Friendly loses the pin for all of them at once.
   */
  const addModePins = (holder: LooseRecord, where: string): void => {
    let modes: unknown;
    try {
      modes = holder.explicitVariableModes;
    } catch (error) {
      gaps.push({
        holder: "node",
        holderId: String(holder.id ?? ""),
        holderName: where,
        error: `explicitVariableModes unreadable: ${message(error)}`,
      });
      restrictions.push(null);
      return;
    }
    if (!modes || typeof modes !== "object") return;
    for (const collectionId of Object.keys(modes as LooseRecord)) {
      for (const variableId of variableIdsByCollection.get(collectionId) ??
        []) {
        accumulatorFor(variableId).explicitModeAssignments += 1;
      }
    }
  };

  const pages = figma.root.children;
  let nodesScanned = 0;
  let pagesScanned = 0;

  for (let index = 0; index < pages.length; index += 1) {
    const page = pages[index];
    onProgress({
      pageId: page.id,
      pageName: page.name,
      pagesDone: index,
      pagesTotal: pages.length,
      nodesScanned,
      elapsedMs: Date.now() - startedAt,
    });

    let nodes: readonly SceneNode[];
    try {
      await page.loadAsync();
      nodes = page.findAll();
    } catch (error) {
      gaps.push({
        holder: "page",
        holderId: page.id,
        holderName: page.name,
        error: message(error),
      });
      // Every node on the page is unseen, so every variable is affected.
      restrictions.push(null);
      continue;
    }
    pagesScanned += 1;

    addModePins(page as unknown as LooseRecord, page.name);

    for (const node of nodes) {
      nodesScanned += 1;
      addModePins(node as unknown as LooseRecord, node.name);
      const read = collectNodeBindingHits(node);
      addHits(read.hits, "node", node.id, node.name, page.name);
      for (const group of read.failedGroups) {
        gaps.push({
          holder: "node",
          holderId: node.id,
          holderName: node.name,
          error: `${group} unreadable`,
        });
        restrictions.push(GROUP_TYPES[group] ?? null);
      }
    }
  }

  const styleReads: [
    BindingSite["holder"],
    () => Promise<readonly BaseStyle[]>,
  ][] = [
    ["paintStyle", () => figma.getLocalPaintStylesAsync()],
    ["textStyle", () => figma.getLocalTextStylesAsync()],
    ["effectStyle", () => figma.getLocalEffectStylesAsync()],
    ["gridStyle", () => figma.getLocalGridStylesAsync()],
  ];

  await Promise.all(
    styleReads.map(async ([holder, read]) => {
      let styles: readonly BaseStyle[];
      try {
        styles = await read();
      } catch (error) {
        gaps.push({
          holder,
          holderId: "",
          holderName: `local ${holder}s`,
          error: message(error),
        });
        restrictions.push(STYLE_TYPES[holder]);
        return;
      }
      for (const style of styles) {
        const result = collectStyleBindingHits(style);
        addHits(result.hits, holder, style.id, style.name, null);
        for (const group of result.failedGroups) {
          gaps.push({
            holder,
            holderId: style.id,
            holderName: style.name,
            error: `${group} unreadable`,
          });
          restrictions.push(STYLE_TYPES[holder]);
        }
      }
    })
  );

  const locals = await figma.variables.getLocalVariablesAsync();
  const publishStatus = await readPublishStatus(locals);

  const byVariable: Record<string, UsageCensus> = {};
  for (const [id, accumulator] of accumulators) {
    const variable = variableById.get(id);
    const known =
      variable === undefined
        ? true
        : !restrictions.some(
            (restriction) =>
              restriction === null || restriction.has(variable.resolvedType)
          );
    const sites = [...accumulator.sites.values()];
    byVariable[id] = {
      known,
      aliasInbound: accumulator.aliasInbound,
      layerBindings: sites.filter((site) => site.holder === "node").length,
      styleBindings: sites.filter((site) => site.holder !== "node").length,
      explicitModeAssignments: accumulator.explicitModeAssignments,
      remoteConsumers: "unknown",
      sites: sites.slice(0, SITES_PER_VARIABLE),
      sitesTruncated: sites.length > SITES_PER_VARIABLE,
    };
  }

  return {
    epoch: snapshot.epoch,
    byVariable,
    publishStatus,
    gaps: gaps.slice(0, MAX_GAPS),
    gapsOmitted: Math.max(0, gaps.length - MAX_GAPS),
    pagesScanned,
    nodesScanned,
    durationMs: Date.now() - startedAt,
  };
}
