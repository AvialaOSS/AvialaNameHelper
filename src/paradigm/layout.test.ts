/**
 * The three end states, checked against each other and against the plan.
 *
 * NAMING.md carried three different totals for one file and never said which was
 * the target. Every number here is load-bearing: if a rule table changes, one of
 * them moves and the failure names which moment and which collection.
 */

import { describe, expect, it } from "vitest";
import { GOLDEN_SNAPSHOT } from "./__fixtures__/goldenDump";
import { buildPlan } from "./plan";
import {
  collectionCounts,
  DECLARED_UPSTREAM_REFERENCES,
  deriveLayout,
  LAYOUT_TOTALS,
  targetNameViolations,
  upstreamReferenceCount,
} from "./layout";
import { TARGET_COLLECTIONS, UPSTREAM_COLLECTION } from "./target";

const rows = buildPlan(GOLDEN_SNAPSHOT).rows;
const local = rows.filter((row) => row.applicability === "local");

describe("the three moments", () => {
  it("declares 226, 167 and 155", () => {
    expect(LAYOUT_TOTALS).toEqual({
      shimmed: 226,
      repartitioned: 167,
      converged: 155,
    });
  });

  it("accounts for the gap between them", () => {
    // 226 − 167 is the shim: one alias shell per moved variable, and a shell
    // exists only where something survived to point at.
    expect(LAYOUT_TOTALS.shimmed - LAYOUT_TOTALS.repartitioned).toBe(59);
    expect(
      local.filter((row) => row.viaMove && row.action === "rename")
    ).toHaveLength(59);

    // 167 − 155 is the sweep: the 8 deletions and 4 merges.
    expect(LAYOUT_TOTALS.repartitioned - LAYOUT_TOTALS.converged).toBe(12);
    expect(local.filter((row) => row.action === "delete")).toHaveLength(8);
    expect(local.filter((row) => row.action === "merge")).toHaveLength(4);
  });

  it("derives all three from the plan, with nothing left unplaced", () => {
    const derived = deriveLayout(rows);
    expect(derived.unplaced).toBe(0);
    expect(derived.repartitioned).toBe(LAYOUT_TOTALS.repartitioned);
    expect(derived.converged).toBe(LAYOUT_TOTALS.converged);
    expect(derived.shimmed).toBe(LAYOUT_TOTALS.shimmed);
  });

  it("counts a row no rule claimed as unplaced, not as placed somewhere", () => {
    // A variable the paradigm cannot place is in none of the three totals, so
    // letting it vanish would break all three sums at once and say nothing.
    const derived = deriveLayout([...rows, { ...rows[0], ruleId: "" }]);
    expect(derived.unplaced).toBe(1);
    expect(derived.repartitioned).toBe(LAYOUT_TOTALS.repartitioned);
  });

  it("ignores upstream rows, which are references rather than local variables", () => {
    const derived = deriveLayout([
      ...rows,
      { ...rows[0], applicability: "upstream" },
    ]);
    expect(derived.repartitioned).toBe(LAYOUT_TOTALS.repartitioned);
    expect(derived.unplaced).toBe(0);
  });
});

describe("the layout table", () => {
  it("sums to 167 and 155 across the seven local collections", () => {
    expect(TARGET_COLLECTIONS).toHaveLength(7);
    expect(
      TARGET_COLLECTIONS.reduce((total, entry) => total + entry.layoutCount, 0)
    ).toBe(LAYOUT_TOTALS.repartitioned);
    expect(
      TARGET_COLLECTIONS.reduce(
        (total, entry) => total + entry.convergedCount,
        0
      )
    ).toBe(LAYOUT_TOTALS.converged);
  });

  it("agrees with the plan collection by collection", () => {
    expect(collectionCounts(rows)).toEqual([
      {
        collection: "semantic",
        declaredLayout: 66,
        declaredConverged: 66,
        derivedLayout: 66,
        derivedConverged: 66,
      },
      {
        collection: "effect",
        declaredLayout: 5,
        declaredConverged: 5,
        derivedLayout: 5,
        derivedConverged: 5,
      },
      {
        collection: "effectSwitch",
        declaredLayout: 5,
        declaredConverged: 5,
        derivedLayout: 5,
        derivedConverged: 5,
      },
      {
        collection: "scaleDensity",
        declaredLayout: 27,
        declaredConverged: 22,
        derivedLayout: 27,
        derivedConverged: 22,
      },
      {
        collection: "scaleContrast",
        declaredLayout: 5,
        declaredConverged: 5,
        derivedLayout: 5,
        derivedConverged: 5,
      },
      {
        collection: "scaleStatic",
        declaredLayout: 30,
        declaredConverged: 27,
        derivedLayout: 30,
        derivedConverged: 27,
      },
      {
        collection: "component",
        declaredLayout: 29,
        declaredConverged: 25,
        derivedLayout: 29,
        derivedConverged: 25,
      },
    ]);
  });

  it("reports the upstream 42 separately, because it is not a local count", () => {
    // Adding a reference count to either local sum is the same category error as
    // adding a known quantity to an unknown one.
    expect(DECLARED_UPSTREAM_REFERENCES).toBe(42);
    expect(UPSTREAM_COLLECTION.referencedCount).toBe(42);
    expect(upstreamReferenceCount(rows)).toBe(DECLARED_UPSTREAM_REFERENCES);
    expect(
      TARGET_COLLECTIONS.some(
        (entry) => entry.name === UPSTREAM_COLLECTION.name
      )
    ).toBe(false);
  });

  it("gives every collection one mode axis, or none", () => {
    for (const entry of TARGET_COLLECTIONS) {
      if (entry.axis === null) {
        expect(entry.modes, entry.name).toHaveLength(1);
      } else {
        expect(entry.modes.length, entry.name).toBeGreaterThan(1);
      }
    }
  });
});

describe("target-name uniqueness", () => {
  it("finds no two rules landing on the same full name", () => {
    expect(targetNameViolations()).toEqual([]);
  });

  it("allows the same group and leaf in two collections", () => {
    // `effect/effect/lightEffort-top` and `effectSwitch/effect/lightEffort-top`
    // are the same five effects seen from either side of the switch. Figma
    // separates them by collection, so this is not a violation.
    const effectRows = rows.filter(
      (row) => row.target?.leaf === "lightEffort-top"
    );
    expect(effectRows.map((row) => row.target?.collection).sort()).toEqual([
      "effect",
      "effectSwitch",
    ]);
  });
});
