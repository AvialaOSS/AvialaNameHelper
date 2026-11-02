/**
 * Snapshot helpers: the epoch fingerprint that makes a stale plan detectable,
 * and the alias graph the cost model is actually priced on.
 *
 * Re-exports the wire types so engine code has one import site and cannot reach
 * past this module into `protocol/` for a shape the engine has not vetted.
 */

import type {
  MigrationSnapshot,
  SnapshotValue,
  SnapshotVariable,
} from "../protocol/migration";

export type {
  BindingSite,
  CensusGap,
  MigrationSnapshot,
  SnapshotCollection,
  SnapshotMode,
  SnapshotModeValue,
  SnapshotValue,
  SnapshotVariable,
  UsageCensus,
  UsageCensusResult,
} from "../protocol/migration";

/**
 * The dump and the live API both report `""` for an ungrouped variable; the
 * engine's contract is `null`. Normalizing at the boundary is what stops
 * `joinVariableName` from growing a leading slash on the way back out, which
 * would silently target the wrong name in all three ungrouped buckets.
 */
export function toSnapshotGroup(raw: string | null | undefined): string | null {
  return raw === null || raw === undefined || raw.length === 0 ? null : raw;
}

// ---------------------------------------------------------------------------
// Epoch
// ---------------------------------------------------------------------------

function fnv1a(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/**
 * Fingerprint of the exact file state a plan was built from. The executor
 * recomputes it before applying and refuses on mismatch, because this protocol
 * has no request ids and one global error channel — a stale plan is otherwise
 * indistinguishable from a fresh one.
 *
 * Collection names are in the fingerprint as well as variable identities, since
 * rule dispatch matches on them: a collection renamed between scan and apply
 * would send every row down the wrong rule without changing a single variable.
 *
 * This is a 32-bit non-cryptographic hash. It detects accidental drift, not an
 * adversary; the real failure mode it guards against is "someone edited the file
 * while the panel was open", which perturbs many entries at once.
 */
export function computeEpoch(snapshot: MigrationSnapshot): string {
  const collections = snapshot.collections
    .map((collection) => [collection.id, collection.name].join("\u0000"))
    .sort();
  const variables = snapshot.variables
    .map((variable) =>
      [variable.id, variable.name, variable.collectionId].join("\u0000")
    )
    .sort();
  return fnv1a(
    [
      `c${collections.length}`,
      `v${variables.length}`,
      ...collections,
      ...variables,
    ].join("\u0001")
  );
}

// ---------------------------------------------------------------------------
// Alias graph
// ---------------------------------------------------------------------------

export type AliasEdge = {
  fromVariableId: string;
  fromVariableKey: string;
  fromCollectionName: string;
  modeId: string;
  targetId: string;
  /** False when the target lives in the upstream library. */
  targetIsLocal: boolean;
};

function isAlias(
  value: SnapshotValue
): value is { kind: "ALIAS"; targetId: string } {
  return value.kind === "ALIAS";
}

/**
 * One edge per alias **value cell**, not per variable: a two-mode variable that
 * aliases in both modes contributes two edges, which is the unit the cost model
 * counts in. The file holds 156 cells and every one of them points at exactly
 * two places — 134 out to the upstream palette, 22 into local `colorSystem`.
 */
export function aliasEdges(snapshot: MigrationSnapshot): AliasEdge[] {
  const localIds = new Set(snapshot.variables.map((variable) => variable.id));
  const edges: AliasEdge[] = [];
  for (const variable of snapshot.variables) {
    for (const modeValue of variable.values) {
      if (!isAlias(modeValue.value)) continue;
      edges.push({
        fromVariableId: variable.id,
        fromVariableKey: variable.key,
        fromCollectionName: variable.collectionName,
        modeId: modeValue.modeId,
        targetId: modeValue.value.targetId,
        targetIsLocal: localIds.has(modeValue.value.targetId),
      });
    }
  }
  return edges;
}

export type AliasSummary = {
  total: number;
  toLocal: number;
  toExternal: number;
  /** Edges grouped by the collection they leave. */
  bySourceCollection: Record<string, number>;
  /** Distinct local variables that at least one alias points at. */
  inboundByTargetId: Record<string, number>;
};

export function summarizeAliasEdges(edges: readonly AliasEdge[]): AliasSummary {
  const bySourceCollection: Record<string, number> = {};
  const inboundByTargetId: Record<string, number> = {};
  let toLocal = 0;
  for (const edge of edges) {
    bySourceCollection[edge.fromCollectionName] =
      (bySourceCollection[edge.fromCollectionName] ?? 0) + 1;
    if (edge.targetIsLocal) {
      toLocal += 1;
      inboundByTargetId[edge.targetId] =
        (inboundByTargetId[edge.targetId] ?? 0) + 1;
    }
  }
  return {
    total: edges.length,
    toLocal,
    toExternal: edges.length - toLocal,
    bySourceCollection,
    inboundByTargetId,
  };
}

// ---------------------------------------------------------------------------
// Value inspection
// ---------------------------------------------------------------------------

/**
 * Whether any mode's value could not be read. In the current dump this is the
 * 12 `componentVariables` entries Figma reports as
 * `{ type: "VARIABLE_EXPRESSION", expressionFunction, expressionArguments }`;
 * the function and its arguments are not exposed through the API, so a rebuild
 * would destroy them permanently and leave no trace. Any move carrying one of
 * these is hard-refused rather than attempted.
 */
export function hasUnreadableValue(variable: SnapshotVariable): boolean {
  return variable.values.some(
    (modeValue) => modeValue.value.kind === "UNREADABLE"
  );
}

function fingerprintValue(value: SnapshotValue): string {
  return JSON.stringify(value);
}

/** Whether the non-default modes hold a different value from the default. */
export function modesDiffer(variable: SnapshotVariable): boolean {
  const fingerprints = new Set(
    variable.values.map((mv) => fingerprintValue(mv.value))
  );
  return fingerprints.size > 1;
}

/**
 * For an alias-holding variable, how many *distinct* targets it points at across
 * its modes. More than one is what "re-points across the theme axis" means, and
 * the measurement that matters: in `semantic` exactly 9 variables do this and
 * all 9 are `normal` tone, while `text` has none — so the theme axis is carried
 * by the upstream palette, not by this collection.
 */
export function distinctAliasTargets(variable: SnapshotVariable): string[] {
  const targets = new Set<string>();
  for (const modeValue of variable.values) {
    if (isAlias(modeValue.value)) targets.add(modeValue.value.targetId);
  }
  return [...targets];
}

/** Mode values of a variable, keyed by mode name. */
export function valuesByModeName(
  variable: SnapshotVariable
): Record<string, SnapshotValue> {
  const out: Record<string, SnapshotValue> = {};
  for (const modeValue of variable.values)
    out[modeValue.modeName] = modeValue.value;
  return out;
}
