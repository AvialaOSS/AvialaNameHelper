/**
 * Migration wire types: the snapshot the sandbox reads out of a live Figma
 * file, and the census of everything bound to those variables.
 *
 * Same contract as `messages.ts` — no `figma` types, no DOM types, and every
 * value must survive `postMessage` structured clone. That means plain data
 * only: no `Map`, no `Set`, no class instances, no `undefined` (absent is
 * `null`, because `undefined` would be silently dropped and leave the reader
 * guessing), no functions.
 */

import type { VariableResolvedType } from "./messages";

/**
 * One variable value in one mode.
 *
 * `UNREADABLE` is not a failure to be papered over: `valuesByMode` can hold a
 * `VARIABLE_EXPRESSION`, whose function and arguments the API does not expose.
 * Guessing a literal for it would destroy data on rebuild, so it is carried
 * verbatim and hard-gates any move.
 */
export type SnapshotValue =
  | { kind: "ALIAS"; targetId: string }
  | { kind: "FLOAT"; value: number }
  | { kind: "STRING"; value: string }
  | { kind: "BOOLEAN"; value: boolean }
  | { kind: "COLOR"; r: number; g: number; b: number; a: number }
  | { kind: "EASING"; easingType: string }
  | { kind: "UNSET" }
  | { kind: "UNREADABLE"; text: string };

export type SnapshotModeValue = {
  modeId: string;
  modeName: string;
  isDefault: boolean;
  value: SnapshotValue;
};

export type SnapshotVariable = {
  id: string;
  /** Stable across renames; the only durable identity a published variable has. */
  key: string;
  name: string;
  /**
   * Everything before the last `/`; `null` when the name has no group.
   *
   * Both the Figma API and the Inspector dump report `""` for an ungrouped
   * variable, and 12 of the 167 here are ungrouped. Readers must normalize `""`
   * to `null`, otherwise `joinVariableName` grows a leading slash on the way
   * back out and every rename in those three buckets targets the wrong name.
   */
  group: string | null;
  /** Everything after the last `/`. */
  leaf: string;
  description: string;
  resolvedType: VariableResolvedType;
  scopes: string[];
  collectionId: string;
  collectionName: string;
  /**
   * Empty for external variables, deliberately: a remote collection *does*
   * resolve by id — the golden dump carries its name and modes — but nothing a
   * consuming file can do depends on its identity, and leaving the key empty
   * keeps a live snapshot structurally equal to the golden projection.
   */
  collectionKey: string;
  isRemote: boolean;
  hiddenFromPublishing: boolean;
  values: SnapshotModeValue[];
};

export type SnapshotMode = {
  modeId: string;
  name: string;
  isDefault: boolean;
};

export type SnapshotCollection = {
  id: string;
  /**
   * Stable across renames. Rule dispatch does *not* use it — it matches
   * collection names against both the source and the target side of each rule,
   * which is what lets a half-migrated file converge. The key is carried for the
   * epoch fingerprint and so the UI can hold identity across a rename.
   */
  key: string;
  name: string;
  isRemote: boolean;
  defaultModeId: string;
  modes: SnapshotMode[];
};

export type MigrationSnapshot = {
  /**
   * Fingerprint of the exact file state the plan was built from. The executor
   * recomputes it before applying and refuses on mismatch, because this
   * protocol has no request ids and a stale plan is indistinguishable from a
   * fresh one.
   */
  epoch: string;
  capturedAt: string;
  fileName: string;
  collections: SnapshotCollection[];
  /** Local variables only — the ones this file is allowed to change. */
  variables: SnapshotVariable[];
  /**
   * Alias targets reached outside the local set. Read-only here, but they must
   * be in the plan: the `palette` namespace is part of the paradigm and its
   * deduplication has to happen in the upstream library.
   */
  externalVariables: SnapshotVariable[];
  unreadableVariableIds: string[];
  /**
   * Alias targets that no longer resolve to a variable.
   *
   * Possible in a live file: a library variable deleted while a consumer still
   * aliases it leaves the alias pointing at an id nothing answers to. Without
   * this field the snapshot would omit a target that `aliasEdges` still counts,
   * so the row set would be short by one and nothing would say so. Empty in the
   * golden file, whose dump carries the same field.
   */
  unresolvedAliasTargetIds: string[];
};

/** One place in the document where a variable is bound. */
export type BindingSite = {
  /** What kind of holder: a node, or one of the four local style kinds. */
  holder: "node" | "paintStyle" | "textStyle" | "effectStyle" | "gridStyle";
  holderId: string;
  holderName: string;
  pageName: string | null;
  /** The bound field, e.g. `fills[0]`, `cornerRadius`, `lineHeight`. */
  field: string;
};

/**
 * Everything the document binds to one variable, plus the mode pins that a
 * binding census is structurally blind to.
 *
 * The three counters must never be summed into one number. `aliasInbound` and
 * the two binding counts are exact *for this file*; `remoteConsumers` is
 * permanently unknown, because no API enumerates the files consuming a
 * published library. Adding a known quantity to an unknown one and presenting
 * the total as "the cost" is exactly the error the cost model used to make.
 */
export type UsageCensus = {
  /** False when any holder could not be read; a partial census closes gates. */
  known: boolean;
  aliasInbound: number;
  layerBindings: number;
  styleBindings: number;
  /**
   * Nodes/pages with an explicit mode assignment on a collection this variable
   * belongs to. Not a binding — losing it leaves the binding intact and
   * pointing at a live variable, silently resolving to a different value.
   */
  explicitModeAssignments: number;
  /** Always `"unknown"`: consumers of a published library cannot be listed. */
  remoteConsumers: "unknown";
  /** Truncated sample for the drill-down; the full index stays in the sandbox. */
  sites: BindingSite[];
  sitesTruncated: boolean;
};

/** Ids that threw while being read, so a gap is visible rather than silent. */
export type CensusGap = {
  holder: BindingSite["holder"] | "page";
  holderId: string;
  holderName: string;
  error: string;
};

/**
 * One update per page during the walk.
 *
 * A document-wide census has no upper bound on runtime — `findAll()` over a large
 * file is documented as "could be very slow" — so silence is indistinguishable
 * from a hang. Pages are the natural unit.
 *
 * The update fires *before* the page it names is walked. Reporting after would
 * leave a file whose first page takes a minute with nothing on screen for that
 * minute, which is the exact silence this exists to prevent.
 */
export type CensusProgress = {
  pageId: string;
  /** The page about to be walked. */
  pageName: string;
  /** Pages already finished, so `0` on the first update. */
  pagesDone: number;
  pagesTotal: number;
  nodesScanned: number;
  /** Milliseconds since the walk started. */
  elapsedMs: number;
};

/**
 * Mirror of Figma's `PublishStatus` — the protocol cannot import figma types.
 *
 * Read via `variable.getPublishStatusAsync()`, whose entire documented contract
 * is "Returns the publishing status of this variable in the current file." The
 * reading the transfer stage wants to rely on — `UNPUBLISHED` means no consumer
 * can have imported it, so its identity is safe to destroy, while `CURRENT` and
 * `CHANGED` mean it is published and must be shimmed — is an inference from the
 * three literals, **not verified behaviour**. This field exists so the real
 * distribution over the 167 locals can be observed before anything depends on it.
 */
export type PublishStatus = "UNPUBLISHED" | "CURRENT" | "CHANGED";

export type UsageCensusResult = {
  epoch: string;
  /** Keyed by variable id. */
  byVariable: Record<string, UsageCensus>;
  /**
   * Publishing status per local variable id; `null` where the read threw.
   *
   * Carried here rather than in the snapshot because it is a fact about what
   * consumers see — the same axis as the census — and not an input to a row's
   * identity, target or tier as the plan computes them today. Reading it costs
   * one async call per local variable, which belongs in the explicit, slow,
   * progress-reporting walk and not in the snapshot the panel opens with.
   */
  publishStatus: Record<string, PublishStatus | null>;
  gaps: CensusGap[];
  /**
   * Gaps beyond the ones listed. A mutating document can fail on every node it
   * has, and posting all of that costs more than the walk did — but a truncated
   * list that does not say so reads as the true total.
   */
  gapsOmitted: number;
  pagesScanned: number;
  nodesScanned: number;
  durationMs: number;
};

// ---------------------------------------------------------------------------
// Apply
// ---------------------------------------------------------------------------

/**
 * What the sandbox is allowed to do. Deliberately small: the iframe decides
 * *which* rows to attempt, and every safety invariant lives in the executor, so
 * a row that reaches the sandbox still cannot bypass a guard.
 *
 * `removeCollection` is the most destructive call in the design —
 * `VariableCollection.remove()` takes every variable inside it — and nothing
 * emits it until the sweep stage. The executor must read `variableIds.length` at
 * runtime and refuse unless it is zero; the plan's count is not evidence.
 */
export type MigrationAction =
  | { kind: "createCollection"; name: string; modes: readonly string[] }
  | { kind: "renameCollection"; collectionId: string; name: string }
  | {
      kind: "renameVariable";
      variableId: string;
      /** Full name including the group path — assigning it sets both at once. */
      name: string;
      /** `null` leaves scopes alone, so an already-correct row writes nothing. */
      scopes: readonly string[] | null;
    }
  | { kind: "removeCollection"; collectionId: string };

/**
 * What the executor read back after writing.
 *
 * Separate from `ok` because two of these writes can succeed and still be wrong.
 * Assigning `scopes` is documented as affecting only which variables appear in
 * Figma's pickers, so a silent no-op is possible and must be detected rather than
 * assumed. Assigning a `name` that collides inside the collection gets `" 2"`
 * appended with no error at all — which is how the five suffixed names now in the
 * file came to exist.
 */
export type ActionVerification = {
  name: string | null;
  scopes: string[] | null;
};

export type MigrationActionResult = {
  index: number;
  kind: MigrationAction["kind"];
  ok: boolean;
  /** `null` on success. */
  error: string | null;
  /** Set when the write reported success but the read-back disagreed. */
  verificationFailed: string | null;
  verification: ActionVerification;
};

/**
 * A row the iframe declined to turn into an action. Recorded rather than
 * dropped, because "you selected 96 rows and 70 ran" with no explanation is how
 * a batch apply becomes untrustworthy.
 */
export type MigrationRefusal = {
  variableId: string;
  reason: string;
};

export type MigrationApplyRequest = {
  /** Recomputed by the executor and compared; a mismatch refuses the whole batch. */
  epoch: string;
  actions: MigrationAction[];
};

export type MigrationApplyResult = {
  epoch: string;
  durationMs: number;
  results: MigrationActionResult[];
  refusals: MigrationRefusal[];
};
