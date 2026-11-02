/**
 * Where a variable binding can live, and how to enumerate all of it.
 *
 * This module is the single definition of "a binding site". The census in
 * `./usage` counts sites and the Validator's bound-scope scan collects ids, and
 * both go through here, so the two can never disagree about where to look. The
 * failure mode this replaces is a scan that finds fills and misses shadows —
 * which is what scanning only `boundVariables` and the paint lists does, and
 * which leaves the whole `effect` namespace invisible.
 *
 * Seven places on a node, none of them declared by a single node type:
 *
 *  1. `boundVariables` scalar fields — width, cornerRadius, opacity, …
 *  2. `boundVariables` text fields and `textRangeFills` — arrays, one alias per
 *     text range, which a scalar-only walk reads as nothing at all
 *  3. `fills[i]` / `strokes[i]` — each paint carries its own `boundVariables`
 *  4. `effects[i]` — shadow colour, radius, spread, offsets
 *  5. `layoutGrids[i]` — grid colour and spacing
 *  6. `componentProperties[name].boundVariables.value` — instance overrides
 *  7. `componentPropertyDefinitions[name].boundVariables.defaultValue` — the
 *     component's own default. Readable, but no supported *write* path was
 *     found, so the census reports it and the migrator refuses to rebuild
 *     through it.
 *
 * The four local style kinds carry bindings too, and no node walk can see them:
 * `paints[i]` / `effects[i]` / `layoutGrids[i]` on the style's own content list,
 * plus the style's `boundVariables`. A text style's line height is the case
 * NAMING.md names explicitly.
 *
 * **Sites 3–6 and every style content list have two views of the same binding.**
 * A fill bound to a colour variable appears both as `boundVariables.fills[i]` —
 * a read-only aggregate the holder exposes — and as `fills[i].boundVariables.color`,
 * the writable one. They are one binding, not two, so every hit carries a
 * canonical `site` key that collapses both views: `fills[2]` either way, and
 * `paints[0]` for a paint style. Counting raw hits would double every paint,
 * effect, grid and component-property binding in the file; counting only the
 * aggregate would miss any the API does not mirror. Deduplicating on the
 * canonical key is correct whichever view Figma populates.
 */

type LooseAlias = { id?: unknown };
type LooseRecord = Record<string, unknown>;
type LooseHolder = Record<string, unknown>;

export type BindingHit = {
  /**
   * Canonical key for one logical binding on one holder. Two views of the same
   * binding produce the same key, so callers can deduplicate without knowing
   * which view Figma happened to populate.
   */
  site: string;
  /** The most precise field path seen, for display: `fills[2].color`. */
  field: string;
  variableId: string;
};

function aliasId(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const id = (value as LooseAlias).id;
  return typeof id === "string" && id.length > 0 ? id : null;
}

function push(
  hits: BindingHit[],
  site: string,
  field: string,
  value: unknown
): void {
  const id = aliasId(value);
  if (id !== null) hits.push({ site, field, variableId: id });
}

/**
 * Walk one `boundVariables` record.
 *
 * The three value shapes are told apart structurally rather than by field name,
 * because the name lists in the typings are per-mixin and a new bindable field
 * would otherwise be silently skipped: an array is indexed (`fontSize[1]`, one
 * per text range), a bare alias is the field itself, and any other object is a
 * name-keyed map of aliases (`componentProperties`).
 */
function addBoundRecord(
  record: unknown,
  hits: BindingHit[],
  siteOf: (field: string) => string,
  fieldOf: (field: string) => string
): void {
  if (!record || typeof record !== "object") return;

  for (const [field, value] of Object.entries(record as LooseRecord)) {
    if (Array.isArray(value)) {
      value.forEach((item, index) =>
        push(
          hits,
          `${siteOf(field)}[${index}]`,
          `${fieldOf(field)}[${index}]`,
          item
        )
      );
      continue;
    }
    const direct = aliasId(value);
    if (direct !== null) {
      push(hits, siteOf(field), fieldOf(field), value);
      continue;
    }
    if (value && typeof value === "object") {
      for (const [name, alias] of Object.entries(value as LooseRecord)) {
        push(
          hits,
          `${siteOf(field)}[${name}]`,
          `${fieldOf(field)}[${name}]`,
          alias
        );
      }
    }
  }
}

/**
 * Each item of a content list — `fills`, `strokes`, `effects`, `layoutGrids`,
 * `paints` — via the item's own `boundVariables`. The site key is the item's
 * position, which is what the holder's aggregate view uses too.
 */
function addContentList(
  holder: LooseHolder,
  listName: string,
  hits: BindingHit[]
): void {
  const list = holder[listName];
  if (!Array.isArray(list)) return; // `figma.mixed` or absent
  list.forEach((item, index) => {
    const site = `${listName}[${index}]`;
    addBoundRecord(
      (item as LooseHolder | null)?.boundVariables,
      hits,
      () => site,
      (field) => `${site}.${field}`
    );
  });
}

/**
 * Instance overrides and component definitions: keyed by property name, with the
 * alias nested one level deeper than a content list's.
 */
function addKeyedMap(
  holder: LooseHolder,
  mapName: string,
  hits: BindingHit[]
): void {
  const map = holder[mapName];
  if (!map || typeof map !== "object") return;
  for (const [name, entry] of Object.entries(map as LooseRecord)) {
    const site = `${mapName}[${name}]`;
    addBoundRecord(
      (entry as LooseHolder | null)?.boundVariables,
      hits,
      () => site,
      (field) => `${site}.${field}`
    );
  }
}

type HolderShape = {
  /** Content lists whose items carry their own `boundVariables`. */
  lists: readonly string[];
  /** Name-keyed maps whose entries carry their own `boundVariables`. */
  maps: readonly string[];
};

export type BindingRead = {
  hits: BindingHit[];
  /**
   * Names of the field groups that threw, e.g. `["effects"]`.
   *
   * Empty in a stable document. A non-empty list means `hits` is a floor rather
   * than a count, and the caller owes the user a gap instead of a number that
   * looks exact.
   */
  failedGroups: string[];
};

/**
 * Every binding on one holder, with both views of each site present.
 *
 * Reading a field on a partially loaded node can throw, and one unreadable
 * holder must not cost the whole walk. Each group is guarded separately so a
 * node whose `effects` throws still contributes its `fills` — but the throw is
 * reported, never dropped, because a silent undercount is indistinguishable
 * from a variable nobody uses.
 */
function collectHits(holder: unknown, shape: HolderShape): BindingRead {
  const loose = holder as LooseHolder;
  const hits: BindingHit[] = [];
  const failedGroups: string[] = [];

  const attempt = (group: string, walk: () => void): void => {
    try {
      walk();
    } catch {
      failedGroups.push(group);
    }
  };

  attempt("boundVariables", () =>
    addBoundRecord(
      loose.boundVariables,
      hits,
      (field) => field,
      (field) => field
    )
  );
  for (const listName of shape.lists) {
    attempt(listName, () => addContentList(loose, listName, hits));
  }
  for (const mapName of shape.maps) {
    attempt(mapName, () => addKeyedMap(loose, mapName, hits));
  }

  return { hits, failedGroups };
}

const NODE_SHAPE: HolderShape = {
  lists: ["fills", "strokes", "effects", "layoutGrids"],
  maps: ["componentProperties", "componentPropertyDefinitions"],
};

/**
 * The same walk over a local style. The content list is named `paints` here
 * rather than `fills`, and a text style has no content list at all — only its
 * own `boundVariables`, which the structural walk handles without being told.
 */
const STYLE_SHAPE: HolderShape = {
  lists: ["paints", "effects", "layoutGrids"],
  maps: [],
};

export function collectNodeBindingHits(node: SceneNode): BindingRead {
  return collectHits(node, NODE_SHAPE);
}

export function collectStyleBindingHits(style: BaseStyle): BindingRead {
  return collectHits(style, STYLE_SHAPE);
}

/**
 * The distinct variables bound anywhere in `nodes`.
 *
 * Discards `failedGroups`: the Validator's bound scope uses this to list and
 * count what the current selection touches, where an unreadable field costs one
 * row of a display list. The census uses `collectNodeBindingHits` directly,
 * because there a missing group changes what the tool is willing to write.
 */
export function collectBoundVariableIds(nodes: readonly SceneNode[]): string[] {
  const ids = new Set<string>();
  for (const node of nodes) {
    for (const hit of collectNodeBindingHits(node).hits)
      ids.add(hit.variableId);
  }
  return [...ids];
}
