/**
 * Synthetic migration data for the browser mock.
 *
 * Only reached when the UI runs outside Figma (`vite` dev), so the panel can be
 * laid out and clicked through without a Figma file open.
 *
 * The names are real taxonomy shapes and the values are invented. The golden
 * fixture would give better data — it is the actual Components file — but it
 * carries 167 real token values into a bundle that ships to a public repo, and a
 * mock is not worth that trade. What is lost is coverage: a handful of variables
 * cannot exercise every rule, so some rows land on `flag`. That is a state the
 * panel has to render anyway.
 */

import { computeEpoch } from "../paradigm/snapshot";
import type {
  MigrationSnapshot,
  PublishStatus,
  SnapshotCollection,
  SnapshotModeValue,
  SnapshotValue,
  SnapshotVariable,
  UsageCensus,
  UsageCensusResult,
} from "../protocol/messages";
import type { VariableResolvedType } from "../protocol/messages";

const COLLECTIONS: SnapshotCollection[] = [
  {
    id: "col:colorSystem",
    key: "key:colorSystem",
    name: "colorSystem",
    isRemote: false,
    defaultModeId: "mode:colorSystem:value",
    modes: [
      { modeId: "mode:colorSystem:value", name: "Value", isDefault: true },
    ],
  },
  {
    id: "col:numbers",
    key: "key:numbers",
    name: "numbers",
    isRemote: false,
    defaultModeId: "mode:numbers:default",
    modes: [
      { modeId: "mode:numbers:default", name: "Default", isDefault: true },
      {
        modeId: "mode:numbers:mobile",
        name: "Mobile Friendly",
        isDefault: false,
      },
    ],
  },
  {
    id: "col:specialEffort",
    key: "key:specialEffort",
    name: "specialEffort",
    isRemote: false,
    defaultModeId: "mode:specialEffort:value",
    modes: [
      { modeId: "mode:specialEffort:value", name: "Value", isDefault: true },
    ],
  },
  {
    id: "col:componentVariables",
    key: "key:componentVariables",
    name: "componentVariables",
    isRemote: false,
    defaultModeId: "mode:componentVariables:value",
    modes: [
      {
        modeId: "mode:componentVariables:value",
        name: "Value",
        isDefault: true,
      },
    ],
  },
  {
    id: "col:palette",
    key: "key:palette",
    name: "Aviala Design Colors",
    isRemote: true,
    defaultModeId: "mode:palette:value",
    modes: [{ modeId: "mode:palette:value", name: "Value", isDefault: true }],
  },
];

const collectionById = new Map(COLLECTIONS.map((c) => [c.id, c]));

function cells(
  collectionId: string,
  value: SnapshotValue,
  rest?: SnapshotValue
): SnapshotModeValue[] {
  const collection = collectionById.get(collectionId);
  if (!collection) throw new Error(`mock: unknown collection ${collectionId}`);
  return collection.modes.map((mode, index) => ({
    modeId: mode.modeId,
    modeName: mode.name,
    isDefault: mode.isDefault,
    value: index === 0 ? value : (rest ?? value),
  }));
}

type MockVariable = {
  id: string;
  name: string;
  resolvedType: VariableResolvedType;
  collectionId: string;
  value: SnapshotValue;
  /** Second mode's value, when it differs. */
  rest?: SnapshotValue;
  scopes?: string[];
  isRemote?: boolean;
};

function variable(init: MockVariable): SnapshotVariable {
  const collection = collectionById.get(init.collectionId);
  if (!collection)
    throw new Error(`mock: unknown collection ${init.collectionId}`);
  const index = init.name.lastIndexOf("/");
  const group = index < 0 ? null : init.name.slice(0, index);
  const leaf = index < 0 ? init.name : init.name.slice(index + 1);
  return {
    id: init.id,
    key: `key:${init.id}`,
    name: init.name,
    group,
    leaf,
    description: "",
    resolvedType: init.resolvedType,
    scopes: init.scopes ?? ["ALL_SCOPES"],
    collectionId: init.collectionId,
    collectionName: collection.name,
    // Empty for remotes, matching what `readSnapshot` produces from a live file.
    collectionKey: init.isRemote ? "" : collection.key,
    isRemote: init.isRemote ?? false,
    hiddenFromPublishing: false,
    values: cells(init.collectionId, init.value, init.rest),
  };
}

const color = (r: number, g: number, b: number): SnapshotValue => ({
  kind: "COLOR",
  r,
  g,
  b,
  a: 1,
});
const float = (value: number): SnapshotValue => ({ kind: "FLOAT", value });

const PALETTE_PRIMARY_8 = "VariableID:mock:palette:primary-8";

const LOCALS: SnapshotVariable[] = [
  variable({
    id: "VariableID:mock:1",
    name: "border/border-fail-primary",
    resolvedType: "COLOR",
    collectionId: "col:colorSystem",
    value: { kind: "ALIAS", targetId: PALETTE_PRIMARY_8 },
    scopes: ["STROKE_COLOR"],
  }),
  variable({
    id: "VariableID:mock:2",
    name: "border/border-normal-1",
    resolvedType: "COLOR",
    collectionId: "col:colorSystem",
    value: color(0.85, 0.86, 0.88),
    scopes: ["STROKE_COLOR"],
  }),
  variable({
    id: "VariableID:mock:3",
    name: "special-effort/se-light-effort-bottom",
    resolvedType: "COLOR",
    collectionId: "col:colorSystem",
    value: color(0.05, 0.05, 0.08),
    scopes: ["EFFECT_COLOR"],
  }),
  variable({
    id: "VariableID:mock:4",
    name: "size/size-big",
    resolvedType: "FLOAT",
    collectionId: "col:numbers",
    value: float(24),
    rest: float(28),
    scopes: ["WIDTH_HEIGHT"],
  }),
  variable({
    id: "VariableID:mock:5",
    name: "size/size-max",
    resolvedType: "FLOAT",
    collectionId: "col:numbers",
    value: float(48),
    rest: float(52),
    scopes: ["WIDTH_HEIGHT"],
  }),
  variable({
    id: "VariableID:mock:6",
    name: "size/size-huger",
    resolvedType: "FLOAT",
    collectionId: "col:numbers",
    value: float(34),
    rest: float(38),
    scopes: ["WIDTH_HEIGHT"],
  }),
  variable({
    id: "VariableID:mock:7",
    name: "padding/padding-smaller",
    resolvedType: "FLOAT",
    collectionId: "col:numbers",
    value: float(6),
    scopes: ["GAP"],
  }),
  variable({
    id: "VariableID:mock:8",
    name: "Button/color-button-noBackground-background-active",
    resolvedType: "COLOR",
    collectionId: "col:componentVariables",
    value: { kind: "ALIAS", targetId: PALETTE_PRIMARY_8 },
    scopes: ["ALL_FILLS"],
  }),
  variable({
    id: "VariableID:mock:9",
    name: "Button/color-button-noBackground-background-default",
    resolvedType: "COLOR",
    collectionId: "col:componentVariables",
    value: color(0, 0, 0),
    scopes: ["ALL_FILLS"],
  }),
  variable({
    id: "VariableID:mock:10",
    name: "se-lineShadow-all",
    resolvedType: "COLOR",
    collectionId: "col:specialEffort",
    value: color(0.1, 0.1, 0.14),
    scopes: ["EFFECT_COLOR"],
  }),
];

const EXTERNALS: SnapshotVariable[] = [
  variable({
    id: PALETTE_PRIMARY_8,
    name: "primary/primary-8",
    resolvedType: "COLOR",
    collectionId: "col:palette",
    value: color(0.16, 0.45, 0.98),
    isRemote: true,
  }),
  variable({
    id: "VariableID:mock:palette:neutral-1",
    name: "neutral/neutral-1",
    resolvedType: "COLOR",
    collectionId: "col:palette",
    value: color(1, 1, 1),
    isRemote: true,
  }),
];

const withoutEpoch: MigrationSnapshot = {
  epoch: "",
  capturedAt: new Date().toISOString(),
  fileName: "Mock Components",
  collections: COLLECTIONS,
  variables: LOCALS,
  externalVariables: EXTERNALS,
  unreadableVariableIds: [],
  unresolvedAliasTargetIds: [],
};

export const MOCK_SNAPSHOT: MigrationSnapshot = {
  ...withoutEpoch,
  epoch: computeEpoch(withoutEpoch),
};

/**
 * A census that says something about every mock variable.
 *
 * The numbers are invented but not arbitrary: the two deletion candidates carry
 * real layer bindings, because "nothing uses this" and "eleven frames use this"
 * are the two readings a deletion has to survive, and a mock that only shows the
 * easy one is not worth running.
 */
function census(
  layerBindings: number,
  styleBindings: number,
  explicitModeAssignments = 0
): UsageCensus {
  return {
    known: true,
    aliasInbound: 0,
    layerBindings,
    styleBindings,
    explicitModeAssignments,
    remoteConsumers: "unknown",
    sites: [],
    sitesTruncated: false,
  };
}

const MOCK_CENSUS: Record<string, UsageCensus> = {
  "VariableID:mock:1": census(4, 1),
  "VariableID:mock:2": census(31, 0),
  "VariableID:mock:3": census(0, 6),
  "VariableID:mock:4": census(18, 0, 3),
  "VariableID:mock:5": census(2, 0, 3),
  "VariableID:mock:6": census(11, 0, 3),
  "VariableID:mock:7": census(7, 0, 3),
  "VariableID:mock:8": census(3, 0),
  "VariableID:mock:9": census(3, 0),
  "VariableID:mock:10": census(0, 2),
  [PALETTE_PRIMARY_8]: { ...census(0, 0), aliasInbound: 2 },
  "VariableID:mock:palette:neutral-1": census(0, 0),
};

const MOCK_PUBLISH_STATUS: Record<string, PublishStatus | null> = {
  "VariableID:mock:1": "CURRENT",
  "VariableID:mock:2": "CURRENT",
  "VariableID:mock:3": "CHANGED",
  "VariableID:mock:4": "CURRENT",
  "VariableID:mock:5": "UNPUBLISHED",
  "VariableID:mock:6": "CURRENT",
  "VariableID:mock:7": "CURRENT",
  "VariableID:mock:8": "CHANGED",
  "VariableID:mock:9": "CURRENT",
  "VariableID:mock:10": "CURRENT",
};

export function mockCensusResult(epoch: string): UsageCensusResult {
  return {
    epoch,
    byVariable: MOCK_CENSUS,
    publishStatus: MOCK_PUBLISH_STATUS,
    gaps: [],
    gapsOmitted: 0,
    pagesScanned: 3,
    nodesScanned: 1284,
    durationMs: 4200,
  };
}
