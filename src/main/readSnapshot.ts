/**
 * Figma → `MigrationSnapshot`. Read-only: nothing here writes, and nothing here
 * decides what should change — the plan is built in the iframe from what this
 * returns.
 *
 * Two constraints shape the code:
 *
 * **Every read is async.** The manifest declares `documentAccess:
 * "dynamic-page"`, under which the synchronous variable and collection getters
 * throw.
 *
 * **Value normalization is a whitelist, not a switch on `resolvedType`.** The
 * typings declare `valuesByMode` as `Record<string, VariableValue>` where
 * `VariableValue = boolean | string | number | RGB | RGBA | MotionEasing |
 * VariableAlias` — and that union is a lie. A variable can hold an `Expression`
 * (`{ expressionFunction, expressionArguments }`), which the API does not expose
 * and which has **no `type` discriminant at all**. Twelve variables in the
 * Components file are exactly that. The Inspector's first reader classified by
 * `typeof type === "string"` and silently filed those expressions under EASING,
 * discarding the function and its arguments; a rebuild from that reading would
 * have destroyed them with nothing left to show it had happened. So: known
 * shapes are recognized positively, an unknown `type` string becomes
 * `UNREADABLE` rather than falling through to EASING, and anything else becomes
 * `UNREADABLE` too. Failing closed costs a refused row; failing open costs data.
 */

import { splitVariableName } from "../paradigm/names";
import { computeEpoch, toSnapshotGroup } from "../paradigm/snapshot";
import type {
  MigrationSnapshot,
  PublishStatus,
  SnapshotCollection,
  SnapshotMode,
  SnapshotModeValue,
  SnapshotValue,
  SnapshotVariable,
} from "../protocol/migration";
import type { VariableResolvedType } from "../protocol/messages";

/** `MotionEasing.type`'s closed vocabulary, from the typings. */
const EASING_TYPES: ReadonlySet<string> = new Set([
  "EASE_IN",
  "EASE_OUT",
  "EASE_IN_AND_OUT",
  "LINEAR",
  "EASE_IN_BACK",
  "EASE_OUT_BACK",
  "EASE_IN_AND_OUT_BACK",
  "CUSTOM_CUBIC_BEZIER",
  "GENTLE",
  "QUICK",
]);

/** What the tag says when a value could not be read; matches the golden fixture. */
const EXPRESSION_TAG = "VARIABLE_EXPRESSION";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** A short, safe description of an unrecognized shape — never the whole value. */
function describeShape(value: unknown): string {
  if (!isRecord(value)) return `typeof:${typeof value}`;
  const keys = Object.keys(value).slice(0, 4).join(",");
  return `shape:{${keys}}`;
}

function normalizeValue(raw: unknown): SnapshotValue {
  if (raw === undefined || raw === null) return { kind: "UNSET" };

  if (typeof raw === "number") {
    return Number.isFinite(raw)
      ? { kind: "FLOAT", value: raw }
      : { kind: "UNREADABLE", text: "non-finite number" };
  }
  if (typeof raw === "string") return { kind: "STRING", value: raw };
  if (typeof raw === "boolean") return { kind: "BOOLEAN", value: raw };
  if (!isRecord(raw)) return { kind: "UNREADABLE", text: describeShape(raw) };

  if (raw.type === "VARIABLE_ALIAS" && typeof raw.id === "string") {
    return { kind: "ALIAS", targetId: raw.id };
  }

  // An expression carries no `type`, so it is recognized by what it does have.
  if (typeof raw.expressionFunction === "string") {
    return { kind: "UNREADABLE", text: EXPRESSION_TAG };
  }

  if (
    typeof raw.r === "number" &&
    typeof raw.g === "number" &&
    typeof raw.b === "number"
  ) {
    // `RGB` has no alpha; `RGBA` does. Absent means opaque.
    return {
      kind: "COLOR",
      r: raw.r,
      g: raw.g,
      b: raw.b,
      a: typeof raw.a === "number" ? raw.a : 1,
    };
  }

  if (typeof raw.type === "string") {
    return EASING_TYPES.has(raw.type)
      ? { kind: "EASING", easingType: raw.type }
      : { kind: "UNREADABLE", text: `type:${raw.type}` };
  }

  return { kind: "UNREADABLE", text: describeShape(raw) };
}

function projectCollection(
  collection: VariableCollection,
  isRemote: boolean
): SnapshotCollection {
  return {
    id: collection.id,
    key: collection.key,
    name: collection.name,
    isRemote,
    defaultModeId: collection.defaultModeId,
    modes: collection.modes.map((mode) => ({
      modeId: mode.modeId,
      name: mode.name,
      isDefault: mode.modeId === collection.defaultModeId,
    })),
  };
}

/**
 * One variable, with a value cell per mode of its collection.
 *
 * Modes come from the collection rather than from `Object.keys(valuesByMode)`,
 * because the collection is authoritative: a mode with no entry is an unset
 * value, which is a fact worth carrying, and a key with no mode would have no
 * name to report.
 */
function projectVariable(
  variable: Variable,
  collection: SnapshotCollection | null,
  isRemote: boolean
): SnapshotVariable {
  const { group, leaf } = splitVariableName(variable.name);
  const valuesByMode = variable.valuesByMode as Record<string, unknown>;

  // A collection that will not resolve leaves no mode names to report. Falling
  // back to the raw mode id keeps the cells distinct and visibly wrong;
  // inventing "" would collapse them in `valuesByModeName`, which is keyed by
  // name, and two indistinguishable modes are worse than one odd-looking name.
  const modes: SnapshotMode[] =
    collection?.modes ??
    Object.keys(valuesByMode).map((modeId, index) => ({
      modeId,
      name: modeId,
      isDefault: index === 0,
    }));

  const values: SnapshotModeValue[] = modes.map((mode) => ({
    modeId: mode.modeId,
    modeName: mode.name,
    isDefault: mode.isDefault,
    value: normalizeValue(valuesByMode[mode.modeId]),
  }));

  return {
    id: variable.id,
    key: variable.key,
    name: variable.name,
    group: toSnapshotGroup(group),
    leaf,
    description: variable.description,
    resolvedType: variable.resolvedType as VariableResolvedType,
    scopes: [...variable.scopes],
    collectionId: variable.variableCollectionId,
    collectionName: collection?.name ?? "",
    // See `SnapshotVariable.collectionKey`: deliberately empty for externals.
    collectionKey: isRemote ? "" : (collection?.key ?? ""),
    isRemote,
    hiddenFromPublishing: variable.hiddenFromPublishing,
    values,
  };
}

/** Alias targets of a projected variable, in mode order. */
function aliasTargetsOf(variable: SnapshotVariable): string[] {
  const targets: string[] = [];
  for (const modeValue of variable.values) {
    if (modeValue.value.kind === "ALIAS")
      targets.push(modeValue.value.targetId);
  }
  return targets;
}

/**
 * Read the whole variable layer of the current file.
 *
 * Local collections and local variables come from the two async getters. The
 * externals are discovered by following alias targets out of the local set and
 * then out of what those point at, so a chain of any depth is carried — the
 * golden file's deepest is two. Targets nothing answers to are reported rather
 * than dropped.
 */
export async function readSnapshot(): Promise<MigrationSnapshot> {
  const [localCollections, localVariables] = await Promise.all([
    figma.variables.getLocalVariableCollectionsAsync(),
    figma.variables.getLocalVariablesAsync(),
  ]);

  const collections = localCollections.map((collection) =>
    projectCollection(collection, false)
  );
  const localById = new Map(
    collections.map((collection) => [collection.id, collection])
  );

  /** Remote collections, resolved on demand and cached: many variables share one. */
  const remoteById = new Map<string, SnapshotCollection | null>();
  async function resolveCollection(
    collectionId: string
  ): Promise<SnapshotCollection | null> {
    const local = localById.get(collectionId);
    if (local) return local;
    if (remoteById.has(collectionId))
      return remoteById.get(collectionId) ?? null;
    const resolved =
      await figma.variables.getVariableCollectionByIdAsync(collectionId);
    const projected = resolved ? projectCollection(resolved, true) : null;
    remoteById.set(collectionId, projected);
    return projected;
  }

  const variables: SnapshotVariable[] = [];
  for (const variable of localVariables) {
    variables.push(
      projectVariable(
        variable,
        await resolveCollection(variable.variableCollectionId),
        false
      )
    );
  }

  const known = new Set(variables.map((variable) => variable.id));
  const queue: string[] = [];
  const enqueue = (id: string): void => {
    if (known.has(id)) return;
    known.add(id);
    queue.push(id);
  };
  for (const variable of variables) {
    for (const targetId of aliasTargetsOf(variable)) enqueue(targetId);
  }

  const externalVariables: SnapshotVariable[] = [];
  const unresolvedAliasTargetIds: string[] = [];
  while (queue.length > 0) {
    const id = queue.shift() as string;
    const variable = await figma.variables.getVariableByIdAsync(id);
    if (!variable) {
      unresolvedAliasTargetIds.push(id);
      continue;
    }
    const projected = projectVariable(
      variable,
      await resolveCollection(variable.variableCollectionId),
      variable.remote
    );
    externalVariables.push(projected);
    for (const targetId of aliasTargetsOf(projected)) enqueue(targetId);
  }

  const unreadableVariableIds = [...variables, ...externalVariables]
    .filter((variable) =>
      variable.values.some((modeValue) => modeValue.value.kind === "UNREADABLE")
    )
    .map((variable) => variable.id)
    .sort();

  const withoutEpoch: MigrationSnapshot = {
    epoch: "",
    capturedAt: new Date().toISOString(),
    fileName: figma.root.name,
    collections,
    variables,
    externalVariables,
    unreadableVariableIds,
    unresolvedAliasTargetIds,
  };

  return { ...withoutEpoch, epoch: computeEpoch(withoutEpoch) };
}

/**
 * The publishing status of every local variable, keyed by id.
 *
 * One async call per variable, all in flight at once: nothing here reads the
 * document, so there is no ordering to preserve and no reason to serialize 167
 * round-trips.
 *
 * A read that throws becomes `null` rather than a census gap. Publishing status
 * is display information about what consumers see; no write decision in any
 * stage depends on it, so an unknown status costs one blank cell in the panel
 * where an unknown binding count would cost the gate.
 */
export async function readPublishStatus(
  locals: readonly Variable[]
): Promise<Record<string, PublishStatus | null>> {
  const entries = await Promise.all(
    locals.map(async (variable): Promise<[string, PublishStatus | null]> => [
      variable.id,
      await variable.getPublishStatusAsync().catch(() => null),
    ])
  );
  return Object.fromEntries(entries);
}
