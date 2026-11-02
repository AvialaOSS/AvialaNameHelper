/**
 * Rows plus a selection, turned into the actions the sandbox may perform.
 *
 * The gate here is a **whitelist**: only `tier === "free"` rename rows become
 * actions, and everything else selected is refused with a reason rather than
 * dropped. A blacklist would let a Stage 4 action type arrive early and run; a
 * whitelist makes that fail closed.
 *
 * Refusals are part of the return value, not a log line. "You selected 96 rows
 * and 70 ran" is only trustworthy if the other 26 are individually accounted for.
 */

import type { MigrationAction, MigrationRefusal } from "../protocol/migration";
import type { PlanRow } from "./plan";
import type { MigrationSnapshot } from "./snapshot";
import {
  findTargetCollection,
  NEW_COLLECTIONS,
  RENAMED_COLLECTIONS,
} from "./target";

export type RowSelection = {
  selected: ReadonlySet<string>;
  /**
   * Rows the user has individually unlocked. Locking decides the *default*, not
   * eligibility — a locked row is still selectable once unlocked, and unlocking
   * is per row so that a bulk "select all" can never carry one through.
   */
  unlocked: ReadonlySet<string>;
};

export type OpsResult = {
  actions: MigrationAction[];
  refusals: MigrationRefusal[];
};

/**
 * Collection restructure: create the four new collections empty, then rename the
 * three that are being relabelled in place.
 *
 * Creating them in the free stage costs nothing and is harmless — an empty
 * collection binds no layer and pins no mode — and the transfer stage needs them
 * to exist before it can rebuild into them. Both steps are idempotent against a
 * half-migrated file: a collection that already has its target name produces no
 * action, so running this twice converges instead of failing.
 */
function collectionActions(snapshot: MigrationSnapshot): MigrationAction[] {
  const present = new Map(
    snapshot.collections.map((collection) => [collection.name, collection.id])
  );
  const actions: MigrationAction[] = [];

  for (const name of NEW_COLLECTIONS) {
    if (present.has(name)) continue;
    const target = findTargetCollection(name);
    if (!target) continue;
    actions.push({ kind: "createCollection", name, modes: [...target.modes] });
  }

  for (const [from, to] of Object.entries(RENAMED_COLLECTIONS)) {
    const id = present.get(from);
    if (id === undefined) continue; // already renamed, or never there
    actions.push({ kind: "renameCollection", collectionId: id, name: to });
  }

  return actions;
}

export function buildFreeTierActions(
  snapshot: MigrationSnapshot,
  rows: readonly PlanRow[],
  selection: RowSelection
): OpsResult {
  const refusals: MigrationRefusal[] = [];
  const actions: MigrationAction[] = collectionActions(snapshot);

  for (const row of rows) {
    if (!selection.selected.has(row.variableId)) continue;

    const refuse = (reason: string): void => {
      refusals.push({ variableId: row.variableId, reason });
    };

    if (!row.selectable) {
      refuse(
        row.applicability === "upstream"
          ? "远端变量——在本文件只读，请到源 library 里修。"
          : `不适用（${row.flags.join(", ") || row.action}）。`
      );
      continue;
    }
    if (row.action !== "rename") {
      refuse(`这一阶段只做重命名；算出来的动作是「${row.action}」。`);
      continue;
    }
    if (row.tier !== "free") {
      refuse(
        row.tier === "priced"
          ? "有代价档：达成目标会销毁这个变量，得由转移阶段来做。"
          : "无法计价档：目标无法从手上的证据推出来。"
      );
      continue;
    }
    if (row.locks.length > 0 && !selection.unlocked.has(row.variableId)) {
      refuse(`已锁定（${row.locks.join(", ")}）；要纳入就得逐行单独解锁。`);
      continue;
    }
    if (!row.target) {
      refuse("这一行没有目标名字。");
      continue;
    }

    actions.push({
      kind: "renameVariable",
      variableId: row.variableId,
      name: row.target.name,
      // Only write scopes when they actually differ. Narrowing is free but it is
      // not free of consequence: it changes what the picker offers, so doing it
      // to a row that is already correct is a write with no purpose.
      scopes:
        row.scopes.changeNeeded && row.scopes.required !== null
          ? [...row.scopes.required]
          : null,
    });
  }

  return { actions, refusals };
}
