/**
 * The postMessage contract shared by the sandbox (`src/main`) and the UI
 * (`src/ui`). This module must stay free of `figma` types and DOM types so it
 * can be imported from both sides and type-checked under either tsconfig.
 */

/** Figma variable resolved types (mirrors VariableResolvedDataType). */
export type VariableResolvedType =
  "FLOAT" | "STRING" | "BOOLEAN" | "COLOR" | "EASING" | "TIMING";

/** A serializable snapshot of a Figma variable, safe to postMessage. */
export type VariableInfo = {
  id: string;
  name: string;
  resolvedType: VariableResolvedType;
  collectionId: string;
  collectionName: string;
  modeNames: string[];
  isRemote: boolean;
  hiddenFromPublishing: boolean;
};

/** Which variables a scan should cover. */
export type ScanScope = "bound" | "local";

export type RenameRequest = { variableId: string; newName: string };
export type RenameSuccess = {
  variableId: string;
  oldName: string;
  newName: string;
};
export type RenameFailure = {
  variableId: string;
  oldName: string;
  newName: string;
  error: string;
};

/** Messages sent from the UI iframe to the sandbox. */
export type UiToMainMessage =
  | { type: "UI_READY" }
  | { type: "SCAN_REQUEST"; scope: ScanScope }
  | { type: "APPLY_RENAMES"; renames: RenameRequest[] }
  | { type: "RENAME_ONE"; variableId: string; newName: string }
  | { type: "SELECT_NODES"; nodeIds: string[] }
  | { type: "RESIZE"; width: number; height: number }
  | { type: "CLOSE" };

/** Messages sent from the sandbox to the UI iframe. */
export type MainToUiMessage =
  | {
      type: "INIT";
      pluginVersion: string;
      localVariableCount: number;
      localCollectionCount: number;
      hasSelection: boolean;
    }
  | {
      type: "SELECTION_CHANGED";
      hasSelection: boolean;
      nodeCount: number;
      nodeIds: string[];
      boundVariableCount: number;
    }
  | { type: "SCAN_RESULT"; scope: ScanScope; variables: VariableInfo[] }
  | {
      type: "RENAMES_APPLIED";
      renamed: RenameSuccess[];
      failed: RenameFailure[];
    }
  | { type: "ERROR"; message: string };
