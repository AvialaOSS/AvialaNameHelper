/**
 * Invariants of the rule tables themselves, checked without running a plan.
 *
 * These are the properties that make the tables safe to iterate over at all:
 * every bucket is claimed exactly once, every merge names a survivor that
 * actually survives, and every leaf can be found again from both directions —
 * which is what lets a half-migrated file be re-scanned instead of re-guessed.
 */

import { describe, expect, it } from "vitest";
import { GOLDEN_SNAPSHOT } from "./__fixtures__/goldenDump";
import {
  allSourceLeaves,
  matchRule,
  RULES,
  targetIndex,
  type Rule,
} from "./rules";
import { targetNameViolations } from "./layout";
import { toSnapshotGroup } from "./snapshot";
import {
  findTargetCollection,
  NEW_COLLECTIONS,
  PALETTE_FAMILIES,
  RENAMED_COLLECTIONS,
  UPSTREAM_COLLECTION,
} from "./target";

const localRules = RULES.filter((rule) => rule.applicability === "local");
const upstreamRules = RULES.filter((rule) => rule.applicability === "upstream");

const outcomesOf = (rule: Rule) => Object.entries(rule.leaves);
const targetLeafOf = (outcome: {
  kind: string;
  leaf?: string;
  into?: string;
}): string | null =>
  outcome.kind === "keep"
    ? (outcome.leaf ?? null)
    : outcome.kind === "merge"
      ? (outcome.into ?? null)
      : null;

describe("the rule table", () => {
  it("is sixteen local buckets plus one upstream rule per palette family", () => {
    expect(RULES).toHaveLength(22);
    expect(localRules).toHaveLength(16);
    expect(upstreamRules).toHaveLength(PALETTE_FAMILIES.length);
  });

  it("gives every rule a unique id", () => {
    expect(new Set(RULES.map((rule) => rule.id)).size).toBe(RULES.length);
  });

  it("has no empty table and no empty target leaf", () => {
    for (const rule of RULES) {
      expect(Object.keys(rule.leaves).length, rule.id).toBeGreaterThan(0);
      for (const [sourceLeaf, outcome] of outcomesOf(rule)) {
        const target = targetLeafOf(outcome);
        expect(target, `${rule.id} ${sourceLeaf}`).not.toBe("");
        if (outcome.kind === "delete")
          expect(outcome.reason, rule.id).not.toBe("");
      }
    }
  });

  it("claims each (collection, group) bucket exactly once", () => {
    // Two rules on one bucket would make dispatch depend on array order, and
    // order is not a decision anyone wrote down.
    const seen = new Map<string, string>();
    for (const rule of RULES) {
      const key = `${rule.sourceCollection}\u0000${rule.sourceGroup ?? ""}`;
      expect(seen.get(key), `${key} claimed twice`).toBeUndefined();
      seen.set(key, rule.id);
    }
  });

  it("points every rule at a collection the paradigm declares", () => {
    for (const rule of RULES) {
      const target = findTargetCollection(rule.targetCollection);
      if (rule.applicability === "upstream") {
        expect(rule.targetCollection, rule.id).toBe(UPSTREAM_COLLECTION.name);
        continue;
      }
      expect(
        target,
        `${rule.id} targets an undeclared collection`
      ).toBeDefined();
      expect(target?.namespace, rule.id).toBe(rule.namespace);
    }
  });

  it("targets only collections reachable by apply time", () => {
    const present = new Set(
      GOLDEN_SNAPSHOT.collections.map((collection) => collection.name)
    );
    const reachable = new Set([
      ...present,
      ...NEW_COLLECTIONS,
      ...Object.values(RENAMED_COLLECTIONS),
    ]);
    for (const rule of localRules) {
      expect(
        reachable.has(rule.targetCollection),
        `${rule.id} → ${rule.targetCollection}`
      ).toBe(true);
    }
  });

  it("names a survivor for every merge, inside the same rule", () => {
    // A merge whose winner is a deletion, or lives in another rule, would remove
    // both copies and lose the value outright.
    let merges = 0;
    for (const rule of RULES) {
      for (const [, outcome] of outcomesOf(rule)) {
        if (outcome.kind !== "merge") continue;
        merges += 1;
        const winner = rule.leaves[outcome.into];
        expect(winner?.kind, `${rule.id} merges into ${outcome.into}`).toBe(
          "keep"
        );
      }
    }
    expect(merges).toBe(4);
  });

  it("gives every ambiguous target exactly one surviving source", () => {
    // Several sources may share a target — that is what a merge is — but only
    // one of them may survive, or a converged variable could not be attributed.
    let ambiguous = 0;
    let absorbed = 0;
    for (const rule of RULES) {
      for (const [targetLeaf, sources] of Object.entries(targetIndex(rule))) {
        if (sources.length < 2) continue;
        ambiguous += 1;
        absorbed += sources.length - 1;
        const keepers = sources.filter(
          (source) => rule.leaves[source]?.kind === "keep"
        );
        expect(keepers, `${rule.id} → ${targetLeaf}`).toHaveLength(1);
      }
    }
    // Two shared target names — secondary's and tertiary's `background-default` —
    // each absorbing two losers. That is the four merges.
    expect(ambiguous).toBe(2);
    expect(absorbed).toBe(4);
  });

  it("never lets two rules land on the same full target name", () => {
    expect(targetNameViolations()).toEqual([]);
  });

  it("carries no wildcard group", () => {
    for (const rule of RULES) {
      expect(rule.sourceGroup, rule.id).not.toBe("*");
      expect(rule.targetGroup, rule.id).not.toBe("*");
    }
  });
});

describe("dispatch", () => {
  it("finds every source leaf from the source shape", () => {
    for (const { rule, leaf } of allSourceLeaves()) {
      const match = matchRule(rule.sourceCollection, rule.sourceGroup, leaf);
      expect(
        match?.rule.id,
        `${rule.sourceCollection}/${rule.sourceGroup ?? ""}/${leaf}`
      ).toBe(rule.id);
      expect(match?.via).toBe("source");
      expect(match?.sourceLeaf).toBe(leaf);
    }
    expect(allSourceLeaves()).toHaveLength(209);
  });

  it("finds every surviving leaf again from the target shape", () => {
    for (const rule of RULES) {
      for (const [sourceLeaf, outcome] of outcomesOf(rule)) {
        const targetLeaf = targetLeafOf(outcome);
        if (targetLeaf === null) continue;
        const match = matchRule(
          rule.targetCollection,
          rule.targetGroup,
          targetLeaf
        );
        expect(match?.rule.id, `${rule.id} → ${targetLeaf}`).toBe(rule.id);
        expect(match?.via, `${rule.id} → ${targetLeaf}`).toBe("target");
        // A merge resolves to the winner, because the losers are gone by the
        // time anything is standing at the target name.
        const winner = outcome.kind === "merge" ? outcome.into : sourceLeaf;
        expect(match?.sourceLeaf, `${rule.id} → ${targetLeaf}`).toBe(winner);
      }
    }
  });

  it("returns null, never a guess, for a leaf nothing claims", () => {
    expect(
      matchRule("colorSystem", "border", "border-nope-primary")
    ).toBeNull();
    expect(matchRule("colorSystem", "nope", "border-normal-1")).toBeNull();
    expect(matchRule("nope", "border", "border-normal-1")).toBeNull();
    // `null` and a real group are different buckets: an ungrouped variable must
    // not be picked up by a grouped rule.
    expect(matchRule("colorSystem", null, "border-normal-1")).toBeNull();
    expect(
      matchRule("colorSystem", "border", "normal-background-theme")
    ).toBeNull();
  });
});

describe("coverage against the live file", () => {
  it("claims exactly the variables in each bucket — no gaps, no stale entries", () => {
    const counts = new Map<string, number>();
    for (const variable of GOLDEN_SNAPSHOT.variables) {
      const key = `${variable.collectionName}\u0000${toSnapshotGroup(variable.group) ?? ""}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    let total = 0;
    for (const rule of localRules) {
      const key = `${rule.sourceCollection}\u0000${rule.sourceGroup ?? ""}`;
      expect(
        counts.get(key) ?? 0,
        `${rule.id} claims a bucket the file does not have`
      ).toBe(Object.keys(rule.leaves).length);
      total += Object.keys(rule.leaves).length;
    }
    expect(total).toBe(GOLDEN_SNAPSHOT.variables.length);
    // Every bucket in the file is claimed by some rule.
    expect(counts.size).toBe(localRules.length);
  });

  it("claims exactly the 42 upstream variables, six families", () => {
    const counts = new Map<string, number>();
    for (const variable of GOLDEN_SNAPSHOT.externalVariables) {
      const key = `${variable.collectionName}\u0000${toSnapshotGroup(variable.group) ?? ""}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    let total = 0;
    for (const rule of upstreamRules) {
      const key = `${rule.sourceCollection}\u0000${rule.sourceGroup ?? ""}`;
      expect(counts.get(key) ?? 0, rule.id).toBe(
        Object.keys(rule.leaves).length
      );
      total += Object.keys(rule.leaves).length;
    }
    expect(total).toBe(UPSTREAM_COLLECTION.referencedCount);
  });
});
