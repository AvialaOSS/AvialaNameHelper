/**
 * Plan behaviour on hand-built snapshots.
 *
 * `golden.test.ts` proves the engine reproduces the real file's totals; it
 * cannot prove *why*, because the real file never exercises the awkward paths —
 * it has no collision, no incomplete census, no half-migrated collection. These
 * do, one synthetic variable at a time.
 */

import { describe, expect, it } from "vitest";
import { buildPlan, type PlanRow } from "./plan";
import {
  computeEpoch,
  type MigrationSnapshot,
  type SnapshotCollection,
  type SnapshotModeValue,
  type SnapshotValue,
  type SnapshotVariable,
  type UsageCensus,
} from "./snapshot";
import { splitVariableName } from "./names";

const COLLECTIONS: SnapshotCollection[] = [
  {
    id: "c:colorSystem",
    key: "k:colorSystem",
    name: "colorSystem",
    isRemote: false,
    defaultModeId: "cs:0",
    modes: [
      { modeId: "cs:0", name: "Light", isDefault: true },
      { modeId: "cs:1", name: "Dark", isDefault: false },
    ],
  },
  {
    id: "c:semantic",
    key: "k:colorSystem",
    name: "semantic",
    isRemote: false,
    defaultModeId: "cs:0",
    modes: [
      { modeId: "cs:0", name: "Light", isDefault: true },
      { modeId: "cs:1", name: "Dark", isDefault: false },
    ],
  },
  {
    id: "c:componentVariables",
    key: "k:componentVariables",
    name: "componentVariables",
    isRemote: false,
    defaultModeId: "cv:0",
    modes: [{ modeId: "cv:0", name: "Mode 1", isDefault: true }],
  },
  {
    id: "c:fontWeight",
    key: "k:fontWeight",
    name: "fontWeight",
    isRemote: false,
    defaultModeId: "fw:0",
    modes: [{ modeId: "fw:0", name: "Mode 1", isDefault: true }],
  },
  {
    id: "c:numbers",
    key: "k:numbers",
    name: "numbers",
    isRemote: false,
    defaultModeId: "n:0",
    modes: [
      { modeId: "n:0", name: "Default", isDefault: true },
      { modeId: "n:1", name: "Mobile Friendly", isDefault: false },
    ],
  },
  {
    id: "c:scaleDensity",
    key: "k:scaleDensity",
    name: "scaleDensity",
    isRemote: false,
    defaultModeId: "sd:0",
    modes: [
      { modeId: "sd:0", name: "Default", isDefault: true },
      { modeId: "sd:1", name: "Mobile Friendly", isDefault: false },
    ],
  },
  {
    id: "c:palette",
    key: "k:palette",
    name: "Aviala Design Colors",
    isRemote: true,
    defaultModeId: "p:0",
    modes: [
      { modeId: "p:0", name: "Light", isDefault: true },
      { modeId: "p:1", name: "Dark", isDefault: false },
    ],
  },
];

const float = (value: number): SnapshotValue => ({ kind: "FLOAT", value });
const unreadable = (text = "VARIABLE_EXPRESSION"): SnapshotValue => ({
  kind: "UNREADABLE",
  text,
});

function cells(
  collectionName: string,
  values: SnapshotValue[]
): SnapshotModeValue[] {
  const collection = COLLECTIONS.find(
    (candidate) => candidate.name === collectionName
  );
  if (!collection)
    throw new Error(`test fixture has no collection ${collectionName}`);
  return collection.modes.map((mode, index) => ({
    modeId: mode.modeId,
    modeName: mode.name,
    isDefault: mode.isDefault,
    value: values[index] ?? values[values.length - 1],
  }));
}

type VariableInit = {
  id: string;
  collectionName: string;
  /** Full name, group included; `group` is derived by the same split the engine uses. */
  name: string;
  values?: SnapshotValue[];
  scopes?: string[];
  isRemote?: boolean;
};

function variable(init: VariableInit): SnapshotVariable {
  const { group, leaf } = splitVariableName(init.name);
  const collection = COLLECTIONS.find(
    (candidate) => candidate.name === init.collectionName
  );
  return {
    id: init.id,
    key: `key:${init.id}`,
    name: init.name,
    group,
    leaf,
    description: "",
    resolvedType: "FLOAT",
    scopes: init.scopes ?? ["ALL_SCOPES"],
    collectionId: collection?.id ?? `c:${init.collectionName}`,
    collectionName: init.collectionName,
    collectionKey: collection?.key ?? "",
    isRemote: init.isRemote ?? false,
    hiddenFromPublishing: false,
    values: cells(init.collectionName, init.values ?? [float(1)]),
  };
}

function snapshotWith(
  variables: SnapshotVariable[],
  externalVariables: SnapshotVariable[] = []
): MigrationSnapshot {
  const names = new Set([
    ...variables.map((entry) => entry.collectionName),
    ...externalVariables.map((entry) => entry.collectionName),
  ]);
  return {
    epoch: "",
    capturedAt: "2026-09-08T04:19:00.755Z",
    fileName: "Test",
    collections: COLLECTIONS.filter((collection) => names.has(collection.name)),
    variables,
    externalVariables,
    unreadableVariableIds: [],
    unresolvedAliasTargetIds: [],
  };
}

function planFor(
  variables: SnapshotVariable[],
  externalVariables: SnapshotVariable[] = [],
  census: Readonly<Record<string, UsageCensus>> | null = null
): PlanRow[] {
  return buildPlan(snapshotWith(variables, externalVariables), census).rows;
}

const byId = (rows: readonly PlanRow[], id: string): PlanRow => {
  const row = rows.find((candidate) => candidate.variableId === id);
  if (!row) throw new Error(`no row for ${id}`);
  return row;
};

describe("flag rows", () => {
  it("flags a leaf no table holds, inside a group a rule does claim", () => {
    const row = byId(
      planFor([
        variable({
          id: "v1",
          collectionName: "colorSystem",
          name: "border/border-nope",
        }),
      ]),
      "v1"
    );
    expect(row.action).toBe("flag");
    expect(row.flags).toEqual(["unmapped-leaf"]);
    expect(row.namespace).toBeNull();
    expect(row.ruleId).toBe("");
    expect(row.target).toBeNull();
    expect(row.selectable).toBe(false);
  });

  it("flags a group no rule claims, inside a collection one does", () => {
    const row = byId(
      planFor([
        variable({
          id: "v1",
          collectionName: "colorSystem",
          name: "shadow/shadow-1",
        }),
      ]),
      "v1"
    );
    expect(row.flags).toEqual(["unmapped-group"]);
  });

  it("flags a collection the paradigm does not mention at all", () => {
    const stranger: SnapshotVariable = {
      ...variable({
        id: "v1",
        collectionName: "numbers",
        name: "size/size-big",
      }),
      collectionName: "mystery",
      collectionId: "c:mystery",
    };
    const row = byId(planFor([stranger]), "v1");
    expect(row.action).toBe("flag");
    expect(row.flags).toEqual(["unexpected-collection"]);
  });

  it("does not let a grouped variable be claimed by an ungrouped rule", () => {
    // `fontWeight` claims ungrouped variables only. The same leaf under a group
    // is a different bucket, and picking it up would be a guess.
    const rows = planFor([
      variable({
        id: "plain",
        collectionName: "fontWeight",
        name: "font-weight-bold",
      }),
      variable({
        id: "grouped",
        collectionName: "fontWeight",
        name: "weight/font-weight-bold",
      }),
    ]);
    expect(byId(rows, "plain").action).toBe("rename");
    expect(byId(rows, "plain").source.group).toBeNull();
    expect(byId(rows, "grouped").action).toBe("flag");
    expect(byId(rows, "grouped").flags).toEqual(["unmapped-group"]);
  });
});

describe("group normalization", () => {
  it("treats an empty-string group as ungrouped, not as a root folder", () => {
    // Both the API and the dump report `""`. Unnormalized it would come back out
    // of `joinVariableName` as `/bold` and rename to the wrong name.
    const ungrouped: SnapshotVariable = {
      ...variable({
        id: "fw",
        collectionName: "fontWeight",
        name: "font-weight-bold",
      }),
      group: "",
    };
    const row = byId(planFor([ungrouped]), "fw");
    expect(row.action).toBe("rename");
    expect(row.source.group).toBeNull();
    expect(row.source.name).toBe("font-weight-bold");
    expect(row.target?.name).toBe("fontWeight/bold");
  });
});

describe("actions", () => {
  it("reports unchanged only when name, collection and scopes all already match", () => {
    const rows = planFor([
      variable({
        id: "done",
        collectionName: "semantic",
        name: "control/error-background",
        scopes: ["FRAME_FILL", "SHAPE_FILL", "TEXT_FILL"],
      }),
      variable({
        id: "wrongScopes",
        collectionName: "semantic",
        name: "text/error-primary-black",
        scopes: ["ALL_SCOPES"],
      }),
    ]);

    expect(byId(rows, "done").action).toBe("unchanged");
    expect(byId(rows, "done").converged).toBe(true);

    // `text` must be narrowed to TEXT_FILL, so the name being right is not
    // enough — this row still has work to do.
    const narrow = byId(rows, "wrongScopes");
    expect(narrow.action).toBe("rename");
    expect(narrow.converged).toBe(false);
    expect(narrow.scopes.changeNeeded).toBe(true);
    expect(narrow.scopes.required).toEqual(["TEXT_FILL"]);
  });

  it("leaves scopes alone when the row already carries the required ones", () => {
    const row = byId(
      planFor([
        variable({
          id: "ok",
          collectionName: "semantic",
          name: "text/error-primary-black",
          scopes: ["TEXT_FILL"],
        }),
      ]),
      "ok"
    );
    expect(row.action).toBe("unchanged");
    expect(row.scopes.changeNeeded).toBe(false);
  });

  it("separates a rename from the move that carries it", () => {
    // `numbers` → `scaleDensity` is a rebuild plus a remove; the action is still
    // `rename`, because that is what happens to the name. The cost lives on
    // `viaMove` and `tier` so the two counts cannot be conflated.
    const row = byId(
      planFor([
        variable({ id: "v", collectionName: "numbers", name: "size/size-big" }),
      ]),
      "v"
    );
    expect(row.action).toBe("rename");
    expect(row.viaMove).toBe(true);
    expect(row.tier).toBe("priced");
    expect(row.target?.collection).toBe("scaleDensity");
  });

  it("prices a rename inside a renamed collection as free", () => {
    const row = byId(
      planFor([
        variable({
          id: "v",
          collectionName: "colorSystem",
          name: "border/border-fail-primary",
        }),
      ]),
      "v"
    );
    expect(row.action).toBe("rename");
    expect(row.viaMove).toBe(false);
    expect(row.tier).toBe("free");
    expect(row.target?.collection).toBe("semantic");
    expect(row.detail).toContain("collection 更名为 semantic");
  });

  it("resolves a merge onto the winner's id, and refuses when there is no winner", () => {
    const withWinner = planFor([
      variable({
        id: "keep",
        collectionName: "componentVariables",
        name: "Button/color-button-secondary-background-default",
      }),
      variable({
        id: "lose",
        collectionName: "componentVariables",
        name: "Button/color-button-secondary-background-default 2",
      }),
    ]);
    expect(byId(withWinner, "lose").action).toBe("merge");
    expect(byId(withWinner, "lose").mergeIntoId).toBe("keep");
    expect(byId(withWinner, "lose").flags).toContain("collision-suffix");

    const orphan = planFor([
      variable({
        id: "lose",
        collectionName: "componentVariables",
        name: "Button/color-button-secondary-background-default 2",
      }),
    ]);
    // The table names a survivor the file does not have. Guessing an id would
    // delete the only copy, so the row closes instead.
    expect(byId(orphan, "lose").mergeIntoId).toBeNull();
    expect(byId(orphan, "lose").flags).toContain("target-collision");
    expect(byId(orphan, "lose").selectable).toBe(false);
  });

  it("warns when a deletion would discard a mode that differs", () => {
    const rows = planFor([
      variable({
        id: "same",
        collectionName: "numbers",
        name: "size/size-huger",
        values: [float(34), float(34)],
      }),
      variable({
        id: "differs",
        collectionName: "numbers",
        name: "size/size-semilarge",
        values: [float(22), float(24)],
      }),
    ]);
    expect(byId(rows, "same").action).toBe("delete");
    expect(byId(rows, "same").flags).not.toContain("dropped-mode-differs");
    expect(byId(rows, "differs").flags).toContain("dropped-mode-differs");
    expect(byId(rows, "differs").detail).toContain("非默认 mode 存着不同的值");
  });
});

describe("hard refusals", () => {
  it("refuses an unreadable value only when the row would rebuild it", () => {
    const rows = planFor([
      // A move copies values, so an expression it cannot read is destroyed.
      variable({
        id: "moved",
        collectionName: "numbers",
        name: "size/size-big",
        values: [unreadable()],
      }),
      // A rename in place never touches them.
      variable({
        id: "renamed",
        collectionName: "componentVariables",
        name: "Button/color-button-primary-background-default",
        values: [unreadable()],
      }),
    ]);

    const moved = byId(rows, "moved");
    expect(moved.flags).toContain("unreadable-value");
    expect(moved.selectable).toBe(false);

    const renamed = byId(rows, "renamed");
    expect(renamed.viaMove).toBe(false);
    expect(renamed.flags).not.toContain("unreadable-value");
    // Still locked, so Stage 4 cannot pick it up later.
    expect(renamed.locks).toContain("expression-values");
  });

  it("refuses both rows when two would land on the same name", () => {
    // A half-finished manual move: the original and its copy both alive. Figma
    // would silently append `" 2"` to whichever was written second.
    const rows = planFor([
      variable({
        id: "old",
        collectionName: "numbers",
        name: "size/size-big",
        scopes: ["FONT_SIZE", "WIDTH_HEIGHT"],
      }),
      variable({
        id: "new",
        collectionName: "scaleDensity",
        name: "size/big",
        scopes: ["FONT_SIZE", "WIDTH_HEIGHT"],
      }),
    ]);
    expect(byId(rows, "old").target?.name).toBe("size/big");
    expect(byId(rows, "new").target?.name).toBe("size/big");
    for (const id of ["old", "new"]) {
      expect(byId(rows, id).flags, id).toContain("target-collision");
      expect(byId(rows, id).selectable, id).toBe(false);
    }
  });

  it("closes a row whose census could not read everything", () => {
    const census: Record<string, UsageCensus> = {
      v: {
        known: false,
        aliasInbound: 3,
        layerBindings: 0,
        styleBindings: 0,
        explicitModeAssignments: 0,
        remoteConsumers: "unknown",
        sites: [],
        sitesTruncated: false,
      },
    };
    const row = byId(
      planFor(
        [
          variable({
            id: "v",
            collectionName: "colorSystem",
            name: "border/border-fail-primary",
          }),
        ],
        [],
        census
      ),
      "v"
    );
    expect(row.flags).toContain("census-incomplete");
    expect(row.selectable).toBe(false);
    expect(row.census?.known).toBe(false);
  });

  it("never offers an upstream row, whatever else is true of it", () => {
    const row = byId(
      planFor(
        [],
        [
          variable({
            id: "p",
            collectionName: "Aviala Design Colors",
            name: "primary/primary-2",
            isRemote: true,
          }),
        ]
      ),
      "p"
    );
    expect(row.applicability).toBe("upstream");
    expect(row.action).toBe("rename");
    expect(row.flags).toContain("remote-readonly");
    expect(row.selectable).toBe(false);
    expect(row.target?.name).toBe("primary/2");
  });
});

describe("the plan envelope", () => {
  it("carries the snapshot's provenance and a fingerprint of its state", () => {
    const snapshot = snapshotWith([
      variable({
        id: "v",
        collectionName: "colorSystem",
        name: "border/border-fail-primary",
      }),
    ]);
    const plan = buildPlan(snapshot);
    expect(plan.fileName).toBe("Test");
    expect(plan.capturedAt).toBe(snapshot.capturedAt);
    expect(plan.epoch).toBe(computeEpoch(snapshot));
  });

  it("changes the fingerprint when a name changes, so a stale plan is refused", () => {
    const before = snapshotWith([
      variable({
        id: "v",
        collectionName: "colorSystem",
        name: "border/border-fail-primary",
      }),
    ]);
    const after = snapshotWith([
      variable({
        id: "v",
        collectionName: "colorSystem",
        name: "border/border-fail-secondary",
      }),
    ]);
    expect(buildPlan(before).epoch).not.toBe(buildPlan(after).epoch);
  });

  it("changes the fingerprint when a collection is renamed, even with no variable touched", () => {
    // Rule dispatch matches collection *names*, so a rename between scan and
    // apply would send every row down the wrong rule.
    const before = snapshotWith([
      variable({
        id: "v",
        collectionName: "colorSystem",
        name: "border/border-fail-primary",
      }),
    ]);
    const after: MigrationSnapshot = {
      ...before,
      collections: before.collections.map((collection) =>
        collection.name === "colorSystem"
          ? { ...collection, name: "semantic" }
          : collection
      ),
    };
    expect(computeEpoch(after)).not.toBe(computeEpoch(before));
  });
});
