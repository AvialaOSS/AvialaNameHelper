/**
 * The three end states, made load-bearing.
 *
 * NAMING.md contains three different totals for the same file — 226, 167 and 155
 * — and before Stage 0 it never said which was the target. They are three
 * *moments*, and the only durable defence against mixing them up is to derive
 * each one from the plan and assert it against the layout table. If a rule table
 * changes, one of these numbers moves and a test names which.
 */

import { RULES, type Rule } from "./rules";
import type { PlanRow } from "./plan";
import { TARGET_COLLECTIONS, UPSTREAM_COLLECTION } from "./target";

/**
 * - `shimmed` — the split is half done: 59 moved variables have been rebuilt in
 *   their new collections and the originals are still alive as alias shells
 *   pointing at them, so downstream consumers of the published library keep
 *   resolving. 167 + 59 = 226. A process state, not somewhere to stay.
 * - `repartitioned` — shells cleared, nothing deleted or merged yet. This is the
 *   moment NAMING.md's layout table describes, and the one that makes "not
 *   adding anything, only rearranging" true.
 * - `converged` — the 8 deletions and 4 merges are done. The end state.
 */
export type LayoutMoment = "shimmed" | "repartitioned" | "converged";

export const LAYOUT_TOTALS: Readonly<Record<LayoutMoment, number>> = {
  shimmed: 226,
  repartitioned: 167,
  converged: 155,
};

/**
 * How many local variables the plan derives for each moment.
 *
 * `unplaced` counts rows no rule claimed. It must be zero: a variable the
 * paradigm cannot place has no target collection, so it is in none of the three
 * totals, and letting it vanish would quietly break all three sums at once.
 */
export type DerivedLayout = Record<LayoutMoment, number> & { unplaced: number };

const RULE_BY_ID: Readonly<Record<string, Rule>> = Object.fromEntries(
  RULES.map((rule) => [rule.id, rule])
);

export function deriveLayout(rows: readonly PlanRow[]): DerivedLayout {
  let repartitioned = 0;
  let converged = 0;
  let moved = 0;
  let unplaced = 0;

  for (const row of rows) {
    if (row.applicability !== "local") continue;
    if (row.ruleId === "" || !RULE_BY_ID[row.ruleId]) {
      unplaced += 1;
      continue;
    }
    // At the repartitioned moment every local variable still exists, including
    // the ones later deleted or merged away — the split has already happened and
    // the sweep has not.
    repartitioned += 1;
    if (row.action === "rename" || row.action === "unchanged") converged += 1;
    // A shim exists only for a move that keeps the variable: the rebuilt copy and
    // the alias shell are two rows' worth of one identity. Deletions and merges
    // get no shell, because there is nothing left to point at.
    if (row.viaMove && row.action === "rename") moved += 1;
  }

  return {
    shimmed: repartitioned + moved,
    repartitioned,
    converged,
    unplaced,
  };
}

// ---------------------------------------------------------------------------
// Per-collection distribution
// ---------------------------------------------------------------------------

export type CollectionCount = {
  collection: string;
  /** Declared by NAMING.md's layout table. */
  declaredLayout: number;
  /** Declared by the converged total. */
  declaredConverged: number;
  /** Derived from the plan at the repartitioned moment. */
  derivedLayout: number;
  /** Derived from the plan at the converged moment. */
  derivedConverged: number;
};

/**
 * Per-collection counts, declared against derived. Sums to 167 and 155 across
 * the seven local collections; the upstream one is reported separately because
 * its 42 is a *reference* count, not a local count, and adding it to either sum
 * would be the same category error as adding a known quantity to an unknown one.
 */
export function collectionCounts(rows: readonly PlanRow[]): CollectionCount[] {
  const derivedLayout: Record<string, number> = {};
  const derivedConverged: Record<string, number> = {};

  for (const row of rows) {
    if (row.applicability !== "local") continue;
    const rule = RULE_BY_ID[row.ruleId];
    if (!rule) continue;
    derivedLayout[rule.targetCollection] =
      (derivedLayout[rule.targetCollection] ?? 0) + 1;
    if (row.action === "rename" || row.action === "unchanged") {
      derivedConverged[rule.targetCollection] =
        (derivedConverged[rule.targetCollection] ?? 0) + 1;
    }
  }

  return TARGET_COLLECTIONS.map((collection) => ({
    collection: collection.name,
    declaredLayout: collection.layoutCount,
    declaredConverged: collection.convergedCount,
    derivedLayout: derivedLayout[collection.name] ?? 0,
    derivedConverged: derivedConverged[collection.name] ?? 0,
  }));
}

/** How many upstream variables this file references. Not a local count. */
export function upstreamReferenceCount(rows: readonly PlanRow[]): number {
  return rows.filter((row) => row.applicability === "upstream").length;
}

export const DECLARED_UPSTREAM_REFERENCES = UPSTREAM_COLLECTION.referencedCount;

// ---------------------------------------------------------------------------
// Target-name uniqueness
// ---------------------------------------------------------------------------

/**
 * Two rules claiming the same `(collection, group, leaf)` would make convergence
 * ambiguous: a half-migrated variable could match either, and which one wins
 * would depend on array order. Uniqueness of the *full target name* is the
 * invariant that matters — `effect/effect/lightEffort-top` and
 * `effectSwitch/effect/lightEffort-top` share a group and a leaf and are still
 * unambiguous, because Figma separates them by collection.
 */
export function targetNameViolations(): string[] {
  const seen = new Map<string, string>();
  const violations: string[] = [];

  for (const rule of RULES) {
    const group = rule.targetGroup;
    for (const outcome of Object.values(rule.leaves)) {
      if (outcome.kind === "delete") continue;
      const targetLeaf = outcome.kind === "keep" ? outcome.leaf : outcome.into;
      const name = `${group === null ? "" : `${group}/`}${targetLeaf}`;
      const key = `${rule.targetCollection}\u0000${name}`;
      const previous = seen.get(key);
      if (previous && previous !== rule.id) {
        violations.push(
          `${key.replace("\u0000", " ")} claimed by ${previous} and ${rule.id}`
        );
      } else {
        seen.set(key, rule.id);
      }
    }
  }

  return violations;
}
