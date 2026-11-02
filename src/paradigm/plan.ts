/**
 * Turns a snapshot into one row per variable. Every variable produces a row —
 * including the ones no rule claims, which become `flag` rows rather than
 * disappearing. That is the whole point of the exhaustive tables: a silent pass
 * is the one outcome this module is not allowed to produce.
 *
 * Runs in the iframe. Rows never cross `postMessage`; only the actions the user
 * selects do (see `ops.ts`).
 */

import type { ActionKind, FlagCode, LockReason, Tier } from "./flags";
import { isSelectable } from "./flags";
import { hasCollisionSuffix, joinVariableName } from "./names";
import { matchRule, RULES, type Rule } from "./rules";
import {
  computeEpoch,
  hasUnreadableValue,
  modesDiffer,
  toSnapshotGroup,
  type MigrationSnapshot,
  type SnapshotVariable,
  type UsageCensus,
} from "./snapshot";
import {
  isMove,
  lockReasonsFor,
  NEW_COLLECTIONS,
  RENAMED_COLLECTIONS,
  requiredScopes,
  type Namespace,
  type ScopeKey,
} from "./target";

export type PlanEndpoint = {
  collection: string;
  group: string | null;
  leaf: string;
  name: string;
};

export type PlanRow = {
  variableId: string;
  variableKey: string;
  /** `null` when no rule claimed the variable, so there is no namespace to attribute. */
  namespace: Namespace | null;
  ruleId: string;
  applicability: "local" | "upstream";
  action: ActionKind;
  /**
   * True when reaching the target destroys the variable: Figma has no move, so
   * this is a rebuild plus a remove. Kept separate from `action` because the
   * *what* is still a rename — the census says 197 renames while the cost model
   * says 59 of them lose identity.
   */
  viaMove: boolean;
  tier: Tier;
  source: PlanEndpoint;
  /** `null` for a deletion: there is nowhere for it to land. */
  target: PlanEndpoint | null;
  /** The surviving variable's id, for a merge. */
  mergeIntoId: string | null;
  scopes: {
    current: readonly string[];
    required: readonly string[] | null;
    changeNeeded: boolean;
  };
  flags: FlagCode[];
  locks: LockReason[];
  /**
   * False for upstream rows, for rows with nothing to do, and for anything
   * carrying a hard-refusal flag. A locked row is still selectable — locking
   * only decides the *default*, and unlocking is per row.
   */
  selectable: boolean;
  /** Already at target in name, group, collection and scopes. */
  converged: boolean;
  /** Why, in one sentence. Deletions and merges carry their evidence here. */
  detail: string;
  census: UsageCensus | null;
};

export type MigrationPlan = {
  epoch: string;
  fileName: string;
  capturedAt: string;
  rows: PlanRow[];
};

function endpoint(
  collection: string,
  group: string | null,
  leaf: string
): PlanEndpoint {
  return { collection, group, leaf, name: joinVariableName(group, leaf) };
}

/** Which flag to raise when nothing claims a variable. */
function noMatchFlag(collectionName: string, group: string | null): FlagCode {
  const asSource = RULES.some(
    (rule) => rule.sourceCollection === collectionName
  );
  const asTarget = RULES.some(
    (rule) => rule.targetCollection === collectionName
  );
  if (!asSource && !asTarget) return "unexpected-collection";
  const groupClaimed = RULES.some(
    (rule) =>
      rule.sourceCollection === collectionName && rule.sourceGroup === group
  );
  return groupClaimed ? "unmapped-leaf" : "unmapped-group";
}

function flagRow(
  variable: SnapshotVariable,
  group: string | null,
  code: FlagCode,
  census: UsageCensus | null
): PlanRow {
  return {
    variableId: variable.id,
    variableKey: variable.key,
    namespace: null,
    ruleId: "",
    applicability: variable.isRemote ? "upstream" : "local",
    action: "flag",
    viaMove: false,
    tier: "unpriced",
    source: endpoint(variable.collectionName, group, variable.leaf),
    target: null,
    mergeIntoId: null,
    scopes: { current: variable.scopes, required: null, changeNeeded: false },
    flags: [code],
    locks: [],
    selectable: false,
    converged: false,
    detail: `没有规则认领这个变量（${code}）。`,
    census,
  };
}

/**
 * Resolve a merge winner's id inside the same snapshot. `null` when the winner
 * is not present, which would mean the table names a survivor the file does not
 * have — a defect in the rules, surfaced rather than guessed at.
 */
function findMergeWinnerId(
  snapshot: MigrationSnapshot,
  rule: Rule,
  winnerLeaf: string
): string | null {
  for (const candidate of snapshot.variables) {
    if (candidate.collectionName !== rule.sourceCollection) continue;
    if (toSnapshotGroup(candidate.group) !== rule.sourceGroup) continue;
    if (candidate.leaf !== winnerLeaf) continue;
    return candidate.id;
  }
  return null;
}

/**
 * The collections a rule may target without the row being refused.
 *
 * Three ways to exist by apply time: already in the file, created empty by the
 * restructure step, or produced by renaming one that is in the file today. The
 * third is the one that is easy to miss — `semantic` is nowhere in a
 * pre-migration snapshot, and flagging all 66 of its rows as "target collection
 * does not exist" would warn about the very thing the same batch does first.
 */
function reachableCollections(snapshot: MigrationSnapshot): Set<string> {
  const present = new Set(
    snapshot.collections.map((collection) => collection.name)
  );
  const reachable = new Set(present);
  for (const name of NEW_COLLECTIONS) reachable.add(name);
  for (const [from, to] of Object.entries(RENAMED_COLLECTIONS)) {
    if (present.has(from)) reachable.add(to);
  }
  return reachable;
}

export function buildPlan(
  snapshot: MigrationSnapshot,
  census: Readonly<Record<string, UsageCensus>> | null = null
): MigrationPlan {
  const reachable = reachableCollections(snapshot);
  const rows: PlanRow[] = [];

  const all: SnapshotVariable[] = [
    ...snapshot.variables,
    ...snapshot.externalVariables,
  ];

  for (const variable of all) {
    const group = toSnapshotGroup(variable.group);
    const rowCensus = census?.[variable.id] ?? null;
    const match = matchRule(variable.collectionName, group, variable.leaf);

    if (!match) {
      rows.push(
        flagRow(
          variable,
          group,
          noMatchFlag(variable.collectionName, group),
          rowCensus
        )
      );
      continue;
    }

    const { rule, outcome } = match;
    const targetGroup = rule.targetGroup;
    const viaMove = isMove(variable.collectionName, rule.targetCollection);
    const applicability = rule.applicability;

    const flags: FlagCode[] = [...(outcome.flags ?? [])];
    if (applicability === "upstream") flags.push("remote-readonly");
    if (hasCollisionSuffix(variable.leaf)) flags.push("collision-suffix");
    // Only a rebuild touches values, so an unreadable value is only a hard
    // refusal when this row would rebuild. A free rename leaves it alone.
    if (viaMove && hasUnreadableValue(variable)) flags.push("unreadable-value");
    // Reachability is a local question. An upstream row targets a collection in
    // the published library, which no consuming file can enumerate, so its
    // absence from this snapshot says nothing.
    if (applicability === "local" && !reachable.has(rule.targetCollection)) {
      flags.push("missing-collection");
    }
    if (rowCensus && !rowCensus.known) flags.push("census-incomplete");

    const scopeKey: ScopeKey = {
      namespace: rule.namespace,
      collection: rule.targetCollection,
      group: targetGroup,
      // Scope depends on slots of the *target* leaf, not the source one.
      leaf:
        outcome.kind === "keep"
          ? outcome.leaf
          : outcome.kind === "merge"
            ? outcome.into
            : variable.leaf,
    };
    const required = requiredScopes(scopeKey);
    const scopesChanged =
      required !== null &&
      (required.length !== variable.scopes.length ||
        [...required].some((scope) => !variable.scopes.includes(scope)));

    let action: ActionKind;
    let target: PlanEndpoint | null;
    let mergeIntoId: string | null = null;
    let detail: string;

    if (outcome.kind === "delete") {
      action = "delete";
      target = null;
      detail = outcome.reason;
      if (modesDiffer(variable)) {
        flags.push("dropped-mode-differs");
        detail += " 它的非默认 mode 存着不同的值，删除会把它们一并丢掉。";
      }
    } else if (outcome.kind === "merge") {
      action = "merge";
      target = endpoint(rule.targetCollection, targetGroup, outcome.into);
      mergeIntoId = findMergeWinnerId(snapshot, rule, outcome.into);
      detail = `${outcome.into} 的重复项：别名目标相同，所以后缀不能直接剥掉——剥掉会有三个撞在一起。`;
      if (mergeIntoId === null) flags.push("target-collision");
    } else {
      target = endpoint(rule.targetCollection, targetGroup, outcome.leaf);
      const nameUnchanged = target.name === variable.name;
      const collectionUnchanged = target.collection === variable.collectionName;
      action =
        nameUnchanged && collectionUnchanged && !scopesChanged
          ? "unchanged"
          : "rename";
      detail = describeRename(variable, target, viaMove, scopesChanged);
    }

    const tier: Tier =
      action === "delete" || action === "merge"
        ? "unpriced"
        : viaMove
          ? "priced"
          : "free";

    const locks = lockReasonsFor({
      namespace: rule.namespace,
      sourceCollection: variable.collectionName,
      sourceGroup: group,
      sourceLeaf: variable.leaf,
      targetCollection: rule.targetCollection,
      targetGroup,
      action,
      hasUnreadableExpression: hasUnreadableValue(variable),
    });

    rows.push({
      variableId: variable.id,
      variableKey: variable.key,
      namespace: rule.namespace,
      ruleId: rule.id,
      applicability,
      action,
      viaMove,
      tier,
      source: endpoint(variable.collectionName, group, variable.leaf),
      target,
      mergeIntoId,
      scopes: {
        current: variable.scopes,
        required,
        changeNeeded: scopesChanged,
      },
      flags: dedupe(flags),
      locks,
      selectable: isSelectable(action, applicability, flags),
      converged: action === "unchanged",
      detail,
      census: rowCensus,
    });
  }

  markTargetCollisions(rows);

  return {
    epoch: computeEpoch(snapshot),
    fileName: snapshot.fileName,
    capturedAt: snapshot.capturedAt,
    rows,
  };
}

function describeRename(
  variable: SnapshotVariable,
  target: PlanEndpoint,
  viaMove: boolean,
  scopesChanged: boolean
): string {
  const parts: string[] = [];
  if (target.name !== variable.name) parts.push(`重命名为 ${target.name}`);
  if (viaMove) {
    parts.push(`在 ${target.collection} 中重建（身份丢失）`);
  } else if (target.collection !== variable.collectionName) {
    parts.push(`collection 更名为 ${target.collection}`);
  }
  if (scopesChanged) parts.push("收窄 scopes");
  return parts.length > 0 ? parts.join("；") : "已处于目标状态";
}

function dedupe(flags: FlagCode[]): FlagCode[] {
  return [...new Set(flags)];
}

/**
 * Two rows landing on the same name inside the same target collection would make
 * Figma silently append `" 2"` — no error, just a suffixed variable, which is how
 * the five suffixed names in the file got there. Merges are excluded because
 * collapsing onto the winner is the whole point of a merge.
 */
function markTargetCollisions(rows: PlanRow[]): void {
  const seen = new Map<string, PlanRow[]>();
  for (const row of rows) {
    if (row.action === "merge" || row.action === "delete" || !row.target)
      continue;
    const key = `${row.target.collection}\u0000${row.target.name}`;
    const bucket = seen.get(key);
    if (bucket) bucket.push(row);
    else seen.set(key, [row]);
  }
  for (const bucket of seen.values()) {
    if (bucket.length < 2) continue;
    for (const row of bucket) {
      if (!row.flags.includes("target-collision"))
        row.flags.push("target-collision");
      row.selectable = false;
    }
  }
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

export type PlanSummary = {
  total: number;
  local: number;
  upstream: number;
  byAction: Record<ActionKind, number>;
  renamesByNamespace: Record<Namespace, number>;
  /** Local rows only. Upstream rows have a tier but it is not actionable here. */
  localByTier: Record<Tier, number>;
  lockedLocalRenames: number;
  /** Free, unlocked, selectable, local — what Stage 3 is allowed to write. */
  stageThreeAppliable: number;
};

export function summarizePlan(rows: readonly PlanRow[]): PlanSummary {
  const byAction: Record<ActionKind, number> = {
    rename: 0,
    delete: 0,
    merge: 0,
    unchanged: 0,
    flag: 0,
  };
  const renamesByNamespace: Record<Namespace, number> = {
    palette: 0,
    semantic: 0,
    scale: 0,
    component: 0,
    effect: 0,
  };
  const localByTier: Record<Tier, number> = { free: 0, priced: 0, unpriced: 0 };

  let local = 0;
  let upstream = 0;
  let lockedLocalRenames = 0;
  let stageThreeAppliable = 0;

  for (const row of rows) {
    byAction[row.action] += 1;
    if (row.applicability === "upstream") upstream += 1;
    else local += 1;

    if (row.action === "rename" && row.namespace !== null) {
      renamesByNamespace[row.namespace] += 1;
    }
    // A `flag` row carries `unpriced` only because `Tier` is not nullable; it
    // has no action to price, so it stays out of the tier totals.
    if (row.applicability === "local" && row.action !== "flag") {
      localByTier[row.tier] += 1;
      if (row.action === "rename" && row.locks.length > 0)
        lockedLocalRenames += 1;
      if (
        row.selectable &&
        row.tier === "free" &&
        row.action === "rename" &&
        row.locks.length === 0
      ) {
        stageThreeAppliable += 1;
      }
    }
  }

  return {
    total: rows.length,
    local,
    upstream,
    byAction,
    renamesByNamespace,
    localByTier,
    lockedLocalRenames,
    stageThreeAppliable,
  };
}
