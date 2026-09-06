/**
 * Thin Variables-API IO layer for the sandbox. Everything here is async because
 * the manifest declares `documentAccess: "dynamic-page"`, under which the
 * synchronous variable getters throw.
 */

import type {
  RenameFailure,
  RenameRequest,
  RenameSuccess,
  VariableInfo,
  VariableResolvedType,
} from "../protocol/messages";

function toInfo(
  variable: Variable,
  collectionName: string,
  modeNames: string[]
): VariableInfo {
  return {
    id: variable.id,
    name: variable.name,
    resolvedType: variable.resolvedType as VariableResolvedType,
    collectionId: variable.variableCollectionId,
    collectionName,
    modeNames,
    isRemote: variable.remote,
    hiddenFromPublishing: variable.hiddenFromPublishing,
  };
}

/** Snapshot every local variable with its collection name and mode names. */
export async function snapshotLocalVariables(): Promise<VariableInfo[]> {
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const meta = new Map<string, { name: string; modeNames: string[] }>();
  for (const collection of collections) {
    meta.set(collection.id, {
      name: collection.name,
      modeNames: collection.modes.map((mode) => mode.name),
    });
  }

  const variables = await figma.variables.getLocalVariablesAsync();
  return variables.map((variable) => {
    const info = meta.get(variable.variableCollectionId);
    return toInfo(variable, info?.name ?? "", info?.modeNames ?? []);
  });
}

/** Describe a single variable (local or remote) by resolving its collection. */
export async function describeVariable(
  variable: Variable
): Promise<VariableInfo> {
  const collection = await figma.variables.getVariableCollectionByIdAsync(
    variable.variableCollectionId
  );
  return toInfo(
    variable,
    collection?.name ?? "",
    collection?.modes.map((mode) => mode.name) ?? []
  );
}

/** Describe many variables by id, skipping ids that no longer resolve. */
export async function describeVariablesByIds(
  ids: readonly string[]
): Promise<VariableInfo[]> {
  const out: VariableInfo[] = [];
  for (const id of ids) {
    const variable = await figma.variables.getVariableByIdAsync(id);
    if (variable) out.push(await describeVariable(variable));
  }
  return out;
}

export type ApplyRenamesResult = {
  renamed: RenameSuccess[];
  failed: RenameFailure[];
};

/**
 * Apply renames defensively: skip remote variables (their `name` setter throws)
 * and capture per-item errors so one bad rename never aborts the batch.
 */
export async function applyRenames(
  renames: readonly RenameRequest[]
): Promise<ApplyRenamesResult> {
  const renamed: RenameSuccess[] = [];
  const failed: RenameFailure[] = [];

  const variables = await figma.variables.getLocalVariablesAsync();
  const byId = new Map(variables.map((variable) => [variable.id, variable]));

  for (const { variableId, newName } of renames) {
    const variable = byId.get(variableId);
    if (!variable) {
      failed.push({
        variableId,
        oldName: "",
        newName,
        error: "Variable no longer exists.",
      });
      continue;
    }
    const oldName = variable.name;
    if (variable.remote) {
      failed.push({
        variableId,
        oldName,
        newName,
        error: "Remote (library) variables cannot be renamed from this file.",
      });
      continue;
    }
    try {
      variable.name = newName;
      renamed.push({ variableId, oldName, newName });
    } catch (error) {
      failed.push({
        variableId,
        oldName,
        newName,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { renamed, failed };
}
