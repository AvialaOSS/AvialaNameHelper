/**
 * The golden test: a real AvialaVariableInspector export of the Components file,
 * run through the engine, reproducing the counts NAMING.md was written against.
 *
 * Two halves, in this order. The first proves the *fixture* — that the
 * projection lost nothing, checked by recomputing the dump's own statistics from
 * the projected data rather than trusting the numbers the generator copied in.
 * The second proves the *engine* against that fixture. A rule-table typo then
 * fails as a rule-table typo, not as a mysterious count mismatch.
 */

import { describe, expect, it } from "vitest";
import {
  GOLDEN_DIAGNOSTICS,
  GOLDEN_SNAPSHOT,
  GOLDEN_SOURCE,
  GOLDEN_STATS,
} from "./__fixtures__/goldenDump";
import { buildPlan, summarizePlan, type PlanRow } from "./plan";
import { buildFreeTierActions, type RowSelection } from "./ops";
import type { MigrationAction } from "../protocol/migration";
import type { LockReason } from "./flags";
import {
  aliasEdges,
  summarizeAliasEdges,
  toSnapshotGroup,
  type MigrationSnapshot,
} from "./snapshot";
import {
  deriveLayout,
  upstreamReferenceCount,
  DECLARED_UPSTREAM_REFERENCES,
} from "./layout";
import { NEW_COLLECTIONS, RENAMED_COLLECTIONS } from "./target";

const plan = buildPlan(GOLDEN_SNAPSHOT);
const rows = plan.rows;
const localRows = rows.filter((row) => row.applicability === "local");

// ---------------------------------------------------------------------------
// The fixture, before the engine
// ---------------------------------------------------------------------------

describe("golden fixture", () => {
  it("carries the provenance of the dump it was projected from", () => {
    expect(GOLDEN_SNAPSHOT.fileName).toBe(GOLDEN_SOURCE.fileName);
    expect(GOLDEN_SNAPSHOT.capturedAt).toBe(GOLDEN_SOURCE.capturedAt);
    expect(GOLDEN_SNAPSHOT.epoch).not.toBe("");
  });

  it("projects every collection and variable the dump counted", () => {
    expect(GOLDEN_SNAPSHOT.collections).toHaveLength(GOLDEN_STATS.collections);
    expect(GOLDEN_SNAPSHOT.variables).toHaveLength(GOLDEN_STATS.variables);
    expect(GOLDEN_SNAPSHOT.externalVariables).toHaveLength(
      GOLDEN_STATS.externalVariables
    );
    const modes = GOLDEN_SNAPSHOT.collections.reduce(
      (total, collection) => total + collection.modes.length,
      0
    );
    expect(modes).toBe(GOLDEN_STATS.modes);
  });

  it("normalizes every ungrouped variable to a null group", () => {
    // The dump reports `""`; the engine's contract is `null`. Twelve locals are
    // ungrouped (6 fontWeight + 5 specialEffort + 1 colorSystem), and a missed
    // normalization would grow a leading slash on the way back out.
    const all = [
      ...GOLDEN_SNAPSHOT.variables,
      ...GOLDEN_SNAPSHOT.externalVariables,
    ];
    expect(all.filter((variable) => variable.group === "")).toHaveLength(0);
    expect(all.filter((variable) => variable.group === null)).toHaveLength(12);
    expect(toSnapshotGroup("")).toBeNull();
    expect(toSnapshotGroup(undefined)).toBeNull();
  });

  it("recomputes the dump's alias statistics from the projected cells", () => {
    const edges = aliasEdges(GOLDEN_SNAPSHOT);
    const summary = summarizeAliasEdges(edges);

    expect(summary.total).toBe(GOLDEN_STATS.aliasValues);
    expect(summary.toExternal).toBe(134);
    expect(summary.toLocal).toBe(22);
    expect(summary.bySourceCollection).toEqual({
      colorSystem: 134,
      componentVariables: 17,
      specialEffort: 5,
    });
  });

  it("recomputes the dump's value-cell counts", () => {
    // Locals only. The dump's statistics describe the five collections it owns;
    // the 42 externals contribute 84 more cells that appear in none of them.
    const cells = GOLDEN_SNAPSHOT.variables.flatMap(
      (variable) => variable.values
    );
    const alias = cells.filter((cell) => cell.value.kind === "ALIAS").length;
    const unset = cells.filter((cell) => cell.value.kind === "UNSET").length;

    expect(cells).toHaveLength(299);
    expect(alias).toBe(GOLDEN_STATS.aliasValues);
    expect(unset).toBe(GOLDEN_STATS.unsetValues);
    expect(cells.length - alias - unset).toBe(GOLDEN_STATS.concreteValues);
  });

  it("resolves every alias to a variable the projection actually carries", () => {
    const known = new Set([
      ...GOLDEN_SNAPSHOT.variables.map((variable) => variable.id),
      ...GOLDEN_SNAPSHOT.externalVariables.map((variable) => variable.id),
    ]);
    const dangling = aliasEdges(GOLDEN_SNAPSHOT).filter(
      (edge) => !known.has(edge.targetId)
    );
    expect(dangling).toHaveLength(GOLDEN_STATS.unresolvedAliasTargets);
    // The snapshot's own list is what `readSnapshot.ts` fills in from a live
    // file; recomputing it here ties the projection to that production path.
    expect(GOLDEN_SNAPSHOT.unresolvedAliasTargetIds).toEqual(
      [...new Set(dangling.map((edge) => edge.targetId))].sort()
    );
  });

  it("recomputes the alias graph's depth and acyclicity", () => {
    const outgoing = new Map<string, string[]>();
    for (const edge of aliasEdges(GOLDEN_SNAPSHOT)) {
      const list = outgoing.get(edge.fromVariableId);
      if (list) list.push(edge.targetId);
      else outgoing.set(edge.fromVariableId, [edge.targetId]);
    }

    const depth = new Map<string, number>();
    const onStack = new Set<string>();
    let cycles = 0;

    const walk = (id: string): number => {
      const cached = depth.get(id);
      if (cached !== undefined) return cached;
      if (onStack.has(id)) {
        cycles += 1;
        return 0;
      }
      onStack.add(id);
      const targets = outgoing.get(id) ?? [];
      const walked =
        targets.length === 0 ? 0 : 1 + Math.max(...targets.map(walk));
      onStack.delete(id);
      depth.set(id, walked);
      return walked;
    };

    let max = 0;
    for (const id of outgoing.keys()) max = Math.max(max, walk(id));
    expect(max).toBe(GOLDEN_STATS.maxChainDepth);
    expect(cycles).toBe(GOLDEN_STATS.cycles);
  });

  it("counts the groups and publishing flags the dump reported", () => {
    const groups = new Set(
      GOLDEN_SNAPSHOT.variables
        .map((variable) => variable.group)
        .filter((group): group is string => group !== null)
    );
    expect(groups.size).toBe(GOLDEN_STATS.distinctGroups);
    // Locals only: all 42 externals are `hiddenFromPublishing`, and counting them
    // here would report 42 against a dump statistic of 0.
    expect(
      GOLDEN_SNAPSHOT.variables.filter(
        (variable) => variable.hiddenFromPublishing
      )
    ).toHaveLength(GOLDEN_STATS.hiddenFromPublishing);
  });

  it("records the unreadable expressions the generator found", () => {
    // Recomputed from the projected values, not copied from the dump's
    // diagnostics — that field lists variables the API could not *fetch*, and it
    // is empty. The twelve here are fetchable but hold a `VARIABLE_EXPRESSION`.
    expect(GOLDEN_SNAPSHOT.unreadableVariableIds).toHaveLength(12);
    expect(GOLDEN_DIAGNOSTICS.unreadableVariableIds).toHaveLength(0);
    for (const id of GOLDEN_SNAPSHOT.unreadableVariableIds) {
      const variable = GOLDEN_SNAPSHOT.variables.find(
        (candidate) => candidate.id === id
      );
      expect(variable?.collectionName, id).toBe("componentVariables");
      expect(
        variable?.values.some((cell) => cell.value.kind === "UNREADABLE"),
        id
      ).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// The engine, against the fixture
// ---------------------------------------------------------------------------

describe("plan over the golden fixture", () => {
  it("produces one row per variable, local and upstream", () => {
    expect(rows).toHaveLength(209);
    expect(localRows).toHaveLength(167);
  });

  it("flags nothing — a silent pass is the one outcome this is not allowed", () => {
    const flagged = rows.filter((row) => row.action === "flag");
    expect(
      flagged,
      flagged.map((row) => row.source.name).join(", ")
    ).toHaveLength(0);
  });

  it("reproduces the census: 197 renames, 8 deletions, 4 merges, 0 unchanged", () => {
    const summary = summarizePlan(rows);
    expect(summary.byAction).toEqual({
      rename: 197,
      delete: 8,
      merge: 4,
      unchanged: 0,
      flag: 0,
    });
  });

  it("splits the renames across the five namespaces", () => {
    expect(summarizePlan(rows).renamesByNamespace).toEqual({
      semantic: 66,
      scale: 54,
      palette: 42,
      component: 25,
      effect: 10,
    });
  });

  it("reports all 42 upstream rows as read-only palette", () => {
    const summary = summarizePlan(rows);
    expect(summary.upstream).toBe(42);
    expect(summary.local).toBe(167);
    expect(upstreamReferenceCount(rows)).toBe(DECLARED_UPSTREAM_REFERENCES);

    const upstream = rows.filter((row) => row.applicability === "upstream");
    expect(upstream.every((row) => row.namespace === "palette")).toBe(true);
    expect(upstream.every((row) => row.flags.includes("remote-readonly"))).toBe(
      true
    );
    expect(upstream.every((row) => !row.selectable)).toBe(true);
  });

  it("prices the 167 local rows into three tiers", () => {
    expect(summarizePlan(rows).localByTier).toEqual({
      free: 96,
      priced: 59,
      unpriced: 12,
    });
  });

  it("marks exactly the 59 identity-losing renames as moves", () => {
    // `priced` is defined as "identity lost, target known", so the two counts are
    // the same fact seen from two sides and must agree.
    const moves = localRows.filter(
      (row) => row.viaMove && row.action === "rename"
    );
    expect(moves).toHaveLength(59);
    expect(moves.every((row) => row.tier === "priced")).toBe(true);
    expect(localRows.filter((row) => row.tier === "priced")).toHaveLength(59);
  });

  it("unprices only the 8 deletions and 4 merges", () => {
    const unpriced = localRows.filter((row) => row.tier === "unpriced");
    expect(unpriced).toHaveLength(12);
    expect(unpriced.filter((row) => row.action === "delete")).toHaveLength(8);
    expect(unpriced.filter((row) => row.action === "merge")).toHaveLength(4);
  });

  it("deletes the eight steps the word pool has no room for", () => {
    const deleted = rows
      .filter((row) => row.action === "delete")
      .map((row) => row.source.name)
      .sort();
    expect(deleted).toEqual([
      "line-height/line-height-max",
      "line-height/line-height-semilarge",
      "padding/padding-littleSmall",
      "padding/padding-smaller",
      "padding/padding-tinyer",
      "size/size-huger",
      "size/size-semilarge",
      "size/size-semilarger",
    ]);
  });

  it("merges the four collision-suffixed duplicates onto their winner", () => {
    const merges = rows.filter((row) => row.action === "merge");
    expect(merges.map((row) => row.source.name).sort()).toEqual([
      "Button/color-button-secondary-background-default 2",
      "Button/color-button-secondary-background-default 3",
      "Button/color-button-tertiary-background-default 2",
      "Button/color-button-tertiary-background-default 3",
    ]);
    expect(merges.every((row) => row.flags.includes("collision-suffix"))).toBe(
      true
    );
    for (const row of merges) {
      expect(row.mergeIntoId, row.source.name).not.toBeNull();
      expect(row.mergeIntoId).not.toBe(row.variableId);
    }
  });

  it("flags the five collision suffixes and no others", () => {
    const suffixed = rows.filter((row) =>
      row.flags.includes("collision-suffix")
    );
    expect(suffixed).toHaveLength(5);
    // The four merges plus `border-radius-extra-small 2`, whose suffix is
    // stripped by a rename rather than resolved by a merge.
    expect(suffixed.filter((row) => row.action === "rename")).toHaveLength(1);
  });

  it("hard-refuses nothing on the fixture, because no row rebuilds an unreadable value", () => {
    // The 12 expressions all sit in `component`, which is renamed in place, so
    // `viaMove` is false and the value is never touched. They carry the
    // `expression-values` *lock* instead — Stage 4 must not pick them up.
    const unreadable = rows.filter((row) =>
      row.flags.includes("unreadable-value")
    );
    expect(unreadable).toHaveLength(0);

    const expressions = rows.filter((row) =>
      row.locks.includes("expression-values")
    );
    expect(expressions).toHaveLength(12);
    expect(expressions.every((row) => row.namespace === "component")).toBe(
      true
    );
    expect(expressions.every((row) => !row.viaMove)).toBe(true);
  });

  it("warns about no missing collection, because every target is reachable by apply time", () => {
    // `semantic`, `effectSwitch` and `component` are nowhere in a pre-migration
    // snapshot — they are what `colorSystem`, `specialEffort` and
    // `componentVariables` get renamed to, in the same batch. Flagging those 96
    // rows would warn about the thing the restructure step does first.
    expect(
      rows.filter((row) => row.flags.includes("missing-collection"))
    ).toHaveLength(0);
  });

  it("locks by reason, and counts the union rather than the sum", () => {
    const renames = localRows.filter((row) => row.action === "rename");
    const count = (reason: LockReason): number =>
      renames.filter((row) => row.locks.includes(reason)).length;

    // A row can carry several reasons; these overlap heavily (lineHeight is both
    // `scale-word-pool` and `group-camelCase`), so the union is not the sum.
    // `group-camelCase` covers 20 source rows across the three inferred groups,
    // but two of lineHeight's are deletions and this counts renames.
    expect(count("scale-word-pool")).toBe(35);
    expect(count("group-camelCase")).toBe(18);
    expect(count("borderRadius-collection")).toBe(7);
    expect(count("high-contrast-values")).toBe(5);
    expect(count("component-deferred")).toBe(25);
    expect(count("expression-values")).toBe(12);
    expect(count("normal-background-theme")).toBe(1);

    expect(summarizePlan(rows).lockedLocalRenames).toBe(66);
  });

  it("leaves 70 rows Stage 3 is allowed to write", () => {
    const summary = summarizePlan(rows);
    expect(summary.stageThreeAppliable).toBe(70);

    const appliable = localRows.filter(
      (row) =>
        row.selectable &&
        row.tier === "free" &&
        row.action === "rename" &&
        row.locks.length === 0
    );
    expect(appliable).toHaveLength(70);
    // semantic 66 minus the one undecided row, plus the five effectSwitch rows.
    expect(
      appliable.filter((row) => row.namespace === "semantic")
    ).toHaveLength(65);
    expect(appliable.filter((row) => row.namespace === "effect")).toHaveLength(
      5
    );
  });

  it("derives the three end states from the rows", () => {
    const derived = deriveLayout(rows);
    expect(derived.unplaced).toBe(0);
    expect(derived.repartitioned).toBe(167);
    expect(derived.converged).toBe(155);
    expect(derived.shimmed).toBe(226);
  });
});

/**
 * Apply every free-tier outcome to a copy of the snapshot: rename the three
 * collections, create the four new ones, and move each free row to its target
 * name, group and scopes. Priced rows are left alone on purpose — they are
 * Stage 4, and a half-migrated file is exactly what the second scan has to cope
 * with.
 *
 * Only `collectionName` is rewritten, never `collectionId`, because every free
 * row targets a collection produced by *renaming* one that already exists — and
 * a rename keeps the same collection object, so the same id. The four new
 * collections exist for Stage 4 to rebuild into and hold no free row.
 */
function simulateFreeTier(
  snapshot: MigrationSnapshot,
  simulated: readonly PlanRow[]
): MigrationSnapshot {
  const byId = new Map(simulated.map((row) => [row.variableId, row]));

  const collections = snapshot.collections.map((collection) => {
    const renamed = RENAMED_COLLECTIONS[collection.name];
    return renamed ? { ...collection, name: renamed } : collection;
  });
  for (const name of NEW_COLLECTIONS) {
    if (collections.some((collection) => collection.name === name)) continue;
    collections.push({
      id: `simulated:${name}`,
      key: `simulated:${name}`,
      name,
      isRemote: false,
      defaultModeId: `${name}:0`,
      modes: [{ modeId: `${name}:0`, name: "Default", isDefault: true }],
    });
  }

  const variables = snapshot.variables.map((variable) => {
    const row = byId.get(variable.id);
    if (!row || row.tier !== "free" || !row.target) return variable;
    return {
      ...variable,
      name: row.target.name,
      group: row.target.group,
      leaf: row.target.leaf,
      collectionName: row.target.collection,
      scopes:
        row.scopes.required === null
          ? variable.scopes
          : [...row.scopes.required],
    };
  });

  return { ...snapshot, collections, variables };
}

// ---------------------------------------------------------------------------
// The free-tier gate
// ---------------------------------------------------------------------------

describe("free-tier actions", () => {
  const allLocal = new Set(localRows.map((row) => row.variableId));
  const nothing: RowSelection = { selected: new Set(), unlocked: new Set() };

  it("restructures collections first, with the mode axes the split exists for", () => {
    const { actions, refusals } = buildFreeTierActions(
      GOLDEN_SNAPSHOT,
      rows,
      nothing
    );
    expect(refusals).toHaveLength(0);

    const creates = actions.filter(
      (action) => action.kind === "createCollection"
    );
    expect(creates).toEqual([
      {
        kind: "createCollection",
        name: "scaleDensity",
        modes: ["Default", "Mobile Friendly"],
      },
      {
        kind: "createCollection",
        name: "scaleContrast",
        modes: ["Default", "High Contrast"],
      },
      { kind: "createCollection", name: "scaleStatic", modes: ["Default"] },
      { kind: "createCollection", name: "effect", modes: ["Default"] },
    ]);

    // A rename keeps the same collection object and therefore the same id, so
    // every explicit mode pin on it survives — the cheapest possible outcome.
    const renames = actions.filter(
      (action) => action.kind === "renameCollection"
    );
    expect(renames).toHaveLength(3);
    expect(
      renames.map((action) =>
        action.kind === "renameCollection" ? action.name : ""
      )
    ).toEqual(["semantic", "effectSwitch", "component"]);
  });

  it("writes 70 renames and refuses the other 97 individually", () => {
    const { actions, refusals } = buildFreeTierActions(GOLDEN_SNAPSHOT, rows, {
      selected: allLocal,
      unlocked: new Set(),
    });
    const renames = actions.filter(
      (action) => action.kind === "renameVariable"
    );
    expect(renames).toHaveLength(70);
    expect(refusals).toHaveLength(97);
    expect(actions).toHaveLength(7 + 70);

    // Nothing selected is dropped on the floor, and each refusal says why in the
    // words the panel will show. The gate checks in order — selectable, action,
    // tier, lock — so a priced row that is also locked is refused for its tier.
    const byReason = new Map<string, number>();
    for (const refusal of refusals) {
      byReason.set(refusal.reason, (byReason.get(refusal.reason) ?? 0) + 1);
    }
    expect(Object.fromEntries(byReason)).toEqual({
      "已锁定（component-deferred）；要纳入就得逐行单独解锁。": 13,
      "已锁定（component-deferred, expression-values）；要纳入就得逐行单独解锁。": 12,
      "已锁定（normal-background-theme）；要纳入就得逐行单独解锁。": 1,
      "有代价档：达成目标会销毁这个变量，得由转移阶段来做。": 59,
      "这一阶段只做重命名；算出来的动作是「delete」。": 8,
      "这一阶段只做重命名；算出来的动作是「merge」。": 4,
    });
  });

  it("lets a row through once it is unlocked individually", () => {
    const locked = localRows
      .filter(
        (row) =>
          row.tier === "free" && row.action === "rename" && row.locks.length > 0
      )
      .map((row) => row.variableId);
    expect(locked).toHaveLength(26);

    const { actions, refusals } = buildFreeTierActions(GOLDEN_SNAPSHOT, rows, {
      selected: allLocal,
      unlocked: new Set(locked),
    });
    expect(
      actions.filter((action) => action.kind === "renameVariable")
    ).toHaveLength(96);
    expect(refusals).toHaveLength(71);
  });

  it("never emits an action for an upstream row, however it is selected", () => {
    const upstream = rows
      .filter((row) => row.applicability === "upstream")
      .map((row) => row.variableId);
    const { actions, refusals } = buildFreeTierActions(GOLDEN_SNAPSHOT, rows, {
      selected: new Set(upstream),
      unlocked: new Set(upstream),
    });
    expect(
      actions.filter((action) => action.kind === "renameVariable")
    ).toHaveLength(0);
    expect(refusals).toHaveLength(42);
    expect(
      refusals.every((refusal) => refusal.reason.startsWith("远端变量"))
    ).toBe(true);
  });

  it("writes scopes only where they differ", () => {
    const { actions } = buildFreeTierActions(GOLDEN_SNAPSHOT, rows, {
      selected: allLocal,
      unlocked: new Set(localRows.map((row) => row.variableId)),
    });
    const renames = actions.filter(
      (
        action
      ): action is Extract<MigrationAction, { kind: "renameVariable" }> =>
        action.kind === "renameVariable"
    );
    for (const action of renames) {
      const row = localRows.find(
        (candidate) => candidate.variableId === action.variableId
      );
      expect(action.scopes, action.name).toEqual(
        row?.scopes.changeNeeded && row.scopes.required !== null
          ? [...row.scopes.required]
          : null
      );
    }
    expect(
      renames.filter((action) => action.scopes !== null).length
    ).toBeGreaterThan(0);
  });

  it("emits nothing at all on a second run over a restructured file", () => {
    const applied = simulateFreeTier(GOLDEN_SNAPSHOT, rows);
    const rescanned = buildPlan(applied).rows;
    const { actions, refusals } = buildFreeTierActions(applied, rescanned, {
      selected: new Set(
        rescanned
          .filter((row) => row.applicability === "local")
          .map((row) => row.variableId)
      ),
      unlocked: new Set(),
    });
    // The four collections exist, the three renames are done, and every applied
    // row is now `unchanged` — which the gate refuses rather than re-writing.
    expect(actions).toHaveLength(0);
    expect(refusals.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Convergence: Stage 3 runs, then the file is scanned again
// ---------------------------------------------------------------------------

describe("convergence", () => {
  it("reports every applied free row as unchanged on the next scan", () => {
    const applied = simulateFreeTier(GOLDEN_SNAPSHOT, rows);
    const rescanned = buildPlan(applied).rows;

    expect(rescanned.filter((row) => row.action === "flag")).toHaveLength(0);

    const wasApplied = rows.filter(
      (row) =>
        row.applicability === "local" &&
        row.tier === "free" &&
        row.action === "rename"
    );
    expect(wasApplied).toHaveLength(96);
    for (const row of wasApplied) {
      const after = rescanned.find(
        (candidate) => candidate.variableId === row.variableId
      );
      expect(after?.action, row.source.name).toBe("unchanged");
      expect(after?.converged, row.source.name).toBe(true);
      expect(after?.target?.name, row.source.name).toBe(row.target?.name);
    }
  });

  it("leaves the untouched priced rows exactly as they were", () => {
    const rescanned = buildPlan(simulateFreeTier(GOLDEN_SNAPSHOT, rows)).rows;
    const summary = summarizePlan(rescanned);

    // 96 free rows became `unchanged`; the moves, deletions and merges did not.
    expect(summary.byAction).toEqual({
      rename: 101,
      delete: 8,
      merge: 4,
      unchanged: 96,
      flag: 0,
    });
    expect(summary.localByTier).toEqual({ free: 96, priced: 59, unpriced: 12 });
  });

  it("is a fixed point: scanning a third time changes nothing", () => {
    const twice = simulateFreeTier(GOLDEN_SNAPSHOT, rows);
    const second = buildPlan(twice).rows;
    const thrice = simulateFreeTier(twice, second);
    const third = buildPlan(thrice).rows;

    expect(summarizePlan(third).byAction).toEqual(
      summarizePlan(second).byAction
    );
    expect(third.map((row) => row.action)).toEqual(
      second.map((row) => row.action)
    );
  });

  it("changes the epoch, so a stale plan cannot be applied to the new file", () => {
    const applied = simulateFreeTier(GOLDEN_SNAPSHOT, rows);
    expect(buildPlan(applied).epoch).not.toBe(plan.epoch);
  });
});
