/**
 * The postMessage contract shared by the sandbox (`src/main`) and the UI
 * (`src/ui`). This module must stay free of `figma` types and DOM types so it
 * can be imported from both sides and type-checked under either tsconfig.
 *
 * The migration wire types live in `./migration` and are re-exported here so the
 * whole contract has one import site. That module declares types only — no
 * values — so the re-export adds nothing to either bundle.
 */

import type {
  CensusProgress,
  MigrationSnapshot,
  UsageCensusResult,
} from "./migration";

export * from "./migration";

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

/**
 * A local variable collection the Builder can create variables in. Only local
 * collections are listed: a variable cannot be added to a remote (library)
 * collection from this file.
 */
export type CollectionInfo = {
  id: string;
  name: string;
  modeNames: string[];
  defaultModeId: string;
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
  | { type: "REQUEST_COLLECTIONS" }
  | { type: "SCAN_REQUEST"; scope: ScanScope }
  | { type: "APPLY_RENAMES"; renames: RenameRequest[] }
  | { type: "RENAME_ONE"; variableId: string; newName: string }
  | {
      type: "CREATE_VARIABLE";
      name: string;
      collectionId: string;
      resolvedType: VariableResolvedType;
    }
  /**
   * Read the whole file into a `MigrationSnapshot`. Read-only: the plan is built
   * in the iframe, so nothing here decides what would change.
   *
   * There is deliberately **no** migration write message in this union yet. The
   * migrator is display-only until the free-tier executor lands, and a write
   * message that no handler implements would be a hole the UI could fall into.
   */
  | { type: "MIGRATION_SCAN_REQUEST" }
  /**
   * Walk the document and count everything bound to the local variables.
   *
   * Carries the epoch of the snapshot the UI is displaying so the sandbox can
   * recompute and compare *before* starting: the walk is the slowest thing this
   * plugin does, and a census of a file that has moved on would be reported
   * against a plan it does not describe.
   */
  | { type: "USAGE_CENSUS_REQUEST"; epoch: string }
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
  | { type: "COLLECTIONS"; collections: CollectionInfo[] }
  | {
      type: "SELECTION_CHANGED";
      hasSelection: boolean;
      nodeCount: number;
      nodeIds: string[];
      boundVariableCount: number;
    }
  | { type: "SCAN_RESULT"; scope: ScanScope; variables: VariableInfo[] }
  | { type: "VARIABLE_CREATED"; variable: VariableInfo }
  | { type: "MIGRATION_SNAPSHOT"; snapshot: MigrationSnapshot }
  | { type: "USAGE_CENSUS_PROGRESS"; progress: CensusProgress }
  | { type: "USAGE_CENSUS"; census: UsageCensusResult }
  /**
   * The file is not the one the UI is looking at. Sent instead of a census or an
   * apply, never alongside one: a result computed from a different file state
   * than the plan on screen would be reported against rows that no longer exist.
   *
   * Carries the snapshot the sandbox read in order to notice, so the UI can
   * rebuild from current data instead of blanking the panel and asking for a
   * re-scan it has already paid for.
   */
  | {
      type: "MIGRATION_EPOCH_MISMATCH";
      /** The epoch the UI asked about. */
      planEpoch: string;
      /** The epoch the file recomputed to. */
      fileEpoch: string;
      snapshot: MigrationSnapshot;
    }
  | {
      type: "RENAMES_APPLIED";
      renamed: RenameSuccess[];
      failed: RenameFailure[];
    }
  | { type: "ERROR"; message: string };
