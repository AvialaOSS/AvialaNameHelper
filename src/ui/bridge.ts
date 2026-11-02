import { useCallback, useEffect, useReducer, useRef } from "react";
import type {
  CensusProgress,
  CollectionInfo,
  MainToUiMessage,
  MigrationSnapshot,
  RenameFailure,
  RenameRequest,
  RenameSuccess,
  ScanScope,
  UiToMainMessage,
  UsageCensusResult,
  VariableInfo,
  VariableResolvedType,
} from "../protocol/messages";
import { MOCK_SNAPSHOT, mockCensusResult } from "./mockMigration";

export type InitInfo = {
  pluginVersion: string;
  localVariableCount: number;
  localCollectionCount: number;
};

export type SelectionInfo = {
  hasSelection: boolean;
  nodeCount: number;
  nodeIds: string[];
  boundVariableCount: number;
};

export type ScanResult = { scope: ScanScope; variables: VariableInfo[] };
export type ApplyResult = { renamed: RenameSuccess[]; failed: RenameFailure[] };

/**
 * The migrator's own slice.
 *
 * Kept apart from the Validator's `scan` / `scanning` rather than sharing them:
 * the two scans read different things at very different costs, and a migrator
 * census that cleared the Validator's `scanning` flag would stop its spinner
 * mid-flight.
 */
export type MigrationState = {
  snapshot: MigrationSnapshot | null;
  /** `null` until a census completes; keyed to `snapshot.epoch`. */
  census: UsageCensusResult | null;
  /** Set while the walk runs, one update per page. */
  progress: CensusProgress | null;
  scanning: boolean;
  censusing: boolean;
  /** The file moved under the plan. Cleared by the next successful scan. */
  epochMismatch: { planEpoch: string; fileEpoch: string } | null;
};

export type BridgeState = {
  isMock: boolean;
  init: InitInfo | null;
  selection: SelectionInfo;
  collections: CollectionInfo[];
  scan: ScanResult | null;
  scanning: boolean;
  applying: boolean;
  creating: boolean;
  lastApply: ApplyResult | null;
  lastCreated: VariableInfo | null;
  error: string | null;
  migration: MigrationState;
};

type Action =
  | { type: "receive"; message: MainToUiMessage }
  | { type: "scanning"; value: boolean }
  | { type: "applying"; value: boolean }
  | { type: "creating"; value: boolean }
  | { type: "clearApply" }
  | { type: "clearCreated" }
  | { type: "clearError" }
  | { type: "migrationScanning" }
  | { type: "migrationCensusing" }
  | { type: "clearEpochMismatch" };

const EMPTY_SELECTION: SelectionInfo = {
  hasSelection: false,
  nodeCount: 0,
  nodeIds: [],
  boundVariableCount: 0,
};

const EMPTY_MIGRATION: MigrationState = {
  snapshot: null,
  census: null,
  progress: null,
  scanning: false,
  censusing: false,
  epochMismatch: null,
};

function reducer(state: BridgeState, action: Action): BridgeState {
  switch (action.type) {
    case "receive": {
      const message = action.message;
      switch (message.type) {
        case "INIT":
          return {
            ...state,
            init: {
              pluginVersion: message.pluginVersion,
              localVariableCount: message.localVariableCount,
              localCollectionCount: message.localCollectionCount,
            },
            selection: {
              ...state.selection,
              hasSelection: message.hasSelection,
            },
          };
        case "SELECTION_CHANGED":
          return {
            ...state,
            selection: {
              hasSelection: message.hasSelection,
              nodeCount: message.nodeCount,
              nodeIds: message.nodeIds,
              boundVariableCount: message.boundVariableCount,
            },
          };
        case "COLLECTIONS":
          return { ...state, collections: message.collections };
        case "SCAN_RESULT":
          return {
            ...state,
            scanning: false,
            scan: { scope: message.scope, variables: message.variables },
          };
        case "VARIABLE_CREATED":
          return {
            ...state,
            creating: false,
            lastCreated: message.variable,
            error: null,
          };
        case "RENAMES_APPLIED":
          return {
            ...state,
            applying: false,
            lastApply: { renamed: message.renamed, failed: message.failed },
          };
        case "MIGRATION_SNAPSHOT":
          return {
            ...state,
            migration: {
              ...state.migration,
              snapshot: message.snapshot,
              // Counted against the previous epoch, so it no longer describes
              // these rows.
              census: null,
              progress: null,
              scanning: false,
              censusing: false,
              epochMismatch: null,
            },
          };
        case "USAGE_CENSUS_PROGRESS":
          return {
            ...state,
            migration: { ...state.migration, progress: message.progress },
          };
        case "USAGE_CENSUS":
          return {
            ...state,
            migration: {
              ...state.migration,
              census: message.census,
              progress: null,
              censusing: false,
            },
          };
        case "MIGRATION_EPOCH_MISMATCH":
          return {
            ...state,
            migration: {
              ...state.migration,
              snapshot: message.snapshot,
              census: null,
              progress: null,
              scanning: false,
              censusing: false,
              epochMismatch: {
                planEpoch: message.planEpoch,
                fileEpoch: message.fileEpoch,
              },
            },
          };
        case "ERROR":
          return {
            ...state,
            scanning: false,
            applying: false,
            creating: false,
            error: message.message,
            migration: {
              ...state.migration,
              scanning: false,
              censusing: false,
              progress: null,
            },
          };
      }
      return state;
    }
    case "scanning":
      return {
        ...state,
        scanning: action.value,
        error: action.value ? null : state.error,
      };
    case "applying":
      return { ...state, applying: action.value };
    case "creating":
      return {
        ...state,
        creating: action.value,
        error: action.value ? null : state.error,
      };
    case "clearApply":
      return { ...state, lastApply: null };
    case "clearCreated":
      return { ...state, lastCreated: null };
    case "clearError":
      return { ...state, error: null };
    case "migrationScanning":
      return {
        ...state,
        error: null,
        migration: { ...state.migration, scanning: true },
      };
    case "migrationCensusing":
      return {
        ...state,
        error: null,
        migration: {
          ...state.migration,
          censusing: true,
          progress: null,
          epochMismatch: null,
        },
      };
    case "clearEpochMismatch":
      return {
        ...state,
        migration: { ...state.migration, epochMismatch: null },
      };
  }
}

/* -------------------------------------------------------------------------- */
/* Browser mock (used when the UI is opened outside Figma, e.g. `vite` dev)    */
/* -------------------------------------------------------------------------- */

function mockVar(
  id: string,
  name: string,
  resolvedType: VariableResolvedType,
  collectionName: string,
  isRemote = false
): VariableInfo {
  return {
    id,
    name,
    resolvedType,
    collectionId: `col:${collectionName}`,
    collectionName,
    modeNames: ["Value"],
    isRemote,
    hiddenFromPublishing: false,
  };
}

const MOCK_BOUND: VariableInfo[] = [
  mockVar("VariableID:1:1", "aviala_size_middle", "FLOAT", "Sizes"),
  mockVar("VariableID:1:2", "--aviala-color-primary-8", "COLOR", "Colors"),
];

const MOCK_LOCAL: VariableInfo[] = [
  ...MOCK_BOUND,
  mockVar(
    "VariableID:1:3",
    "--aviala-box-theme-primaryBackground",
    "COLOR",
    "Colors"
  ),
  mockVar("VariableID:1:4", "Primary/8", "COLOR", "Colors"),
  mockVar(
    "VariableID:1:5",
    "--aviala-border-radius-allround",
    "FLOAT",
    "Sizes"
  ),
  mockVar("VariableID:1:6", "Brand/Primary", "COLOR", "Library Colors", true),
];

/** Local collections a mock create can target (ids match `mockVar`'s scheme). */
const MOCK_COLLECTIONS: CollectionInfo[] = [
  {
    id: "col:Colors",
    name: "Colors",
    modeNames: ["Value"],
    defaultModeId: "mode:colors",
  },
  {
    id: "col:Sizes",
    name: "Sizes",
    modeNames: ["Value"],
    defaultModeId: "mode:sizes",
  },
];

function detectMock(): boolean {
  return typeof window === "undefined" || window.parent === window;
}

/* -------------------------------------------------------------------------- */
/* Hook                                                                       */
/* -------------------------------------------------------------------------- */

export type FigmaBridge = {
  state: BridgeState;
  requestScan: (scope: ScanScope) => void;
  requestCollections: () => void;
  /** Read the variable layer the migrator plans over. */
  requestMigrationScan: () => void;
  /**
   * Walk the document. The epoch comes from the caller, which already holds the
   * snapshot, so this callback does not have to be rebuilt when state changes.
   */
  requestUsageCensus: (epoch: string) => void;
  applyRenames: (renames: RenameRequest[]) => void;
  renameOne: (variableId: string, newName: string) => void;
  createVariable: (
    name: string,
    collectionId: string,
    resolvedType: VariableResolvedType
  ) => void;
  selectNodes: (nodeIds: string[]) => void;
  resize: (width: number, height: number) => void;
  close: () => void;
  clearApply: () => void;
  clearCreated: () => void;
  clearError: () => void;
  clearEpochMismatch: () => void;
};

export function useFigmaBridge(): FigmaBridge {
  const [state, dispatch] = useReducer(reducer, undefined, () => ({
    isMock: detectMock(),
    init: null,
    selection: EMPTY_SELECTION,
    collections: [] as CollectionInfo[],
    scan: null,
    scanning: false,
    applying: false,
    creating: false,
    lastApply: null,
    lastCreated: null,
    error: null,
    migration: EMPTY_MIGRATION,
  }));

  const isMockRef = useRef(state.isMock);
  isMockRef.current = state.isMock;

  const handleMock = useCallback((message: UiToMainMessage) => {
    const respond = (reply: MainToUiMessage, delayMs = 60) =>
      setTimeout(() => dispatch({ type: "receive", message: reply }), delayMs);

    switch (message.type) {
      case "UI_READY":
        respond({
          type: "INIT",
          pluginVersion: "0.1.0-mock",
          localVariableCount: MOCK_LOCAL.length,
          localCollectionCount: 3,
          hasSelection: true,
        });
        respond({
          type: "SELECTION_CHANGED",
          hasSelection: true,
          nodeCount: 2,
          nodeIds: ["1:10", "1:11"],
          boundVariableCount: MOCK_BOUND.length,
        });
        respond({ type: "COLLECTIONS", collections: MOCK_COLLECTIONS });
        break;
      case "REQUEST_COLLECTIONS":
        respond({ type: "COLLECTIONS", collections: MOCK_COLLECTIONS });
        break;
      case "CREATE_VARIABLE": {
        const collection = MOCK_COLLECTIONS.find(
          (candidate) => candidate.id === message.collectionId
        );
        respond({
          type: "VARIABLE_CREATED",
          variable: mockVar(
            `VariableID:new:${Math.random().toString(36).slice(2, 7)}`,
            message.name,
            message.resolvedType,
            collection?.name ?? "Colors"
          ),
        });
        break;
      }
      case "SCAN_REQUEST":
        respond({
          type: "SCAN_RESULT",
          scope: message.scope,
          variables: message.scope === "bound" ? MOCK_BOUND : MOCK_LOCAL,
        });
        break;
      case "MIGRATION_SCAN_REQUEST":
        respond({ type: "MIGRATION_SNAPSHOT", snapshot: MOCK_SNAPSHOT });
        break;
      case "USAGE_CENSUS_REQUEST": {
        if (message.epoch !== MOCK_SNAPSHOT.epoch) {
          respond({
            type: "MIGRATION_EPOCH_MISMATCH",
            planEpoch: message.epoch,
            fileEpoch: MOCK_SNAPSHOT.epoch,
            snapshot: MOCK_SNAPSHOT,
          });
          break;
        }
        const pages = ["Foundations", "Components", "Archive"];
        pages.forEach((pageName, index) =>
          respond(
            {
              type: "USAGE_CENSUS_PROGRESS",
              progress: {
                pageId: `0:${index + 1}`,
                pageName,
                pagesDone: index,
                pagesTotal: pages.length,
                nodesScanned: index * 428,
                elapsedMs: index * 300,
              },
            },
            index * 300
          )
        );
        respond(
          { type: "USAGE_CENSUS", census: mockCensusResult(message.epoch) },
          pages.length * 300
        );
        break;
      }
      case "APPLY_RENAMES":
      case "RENAME_ONE": {
        const requests: RenameRequest[] =
          message.type === "APPLY_RENAMES"
            ? message.renames
            : [{ variableId: message.variableId, newName: message.newName }];
        const pool = new Map(MOCK_LOCAL.map((v) => [v.id, v]));
        const renamed: RenameSuccess[] = [];
        const failed: RenameFailure[] = [];
        for (const request of requests) {
          const target = pool.get(request.variableId);
          const oldName = target?.name ?? "";
          if (target?.isRemote) {
            failed.push({
              ...request,
              oldName,
              error: "Remote variable (mock).",
            });
          } else {
            renamed.push({ ...request, oldName });
          }
        }
        respond({ type: "RENAMES_APPLIED", renamed, failed });
        break;
      }
      default:
        break;
    }
  }, []);

  const post = useCallback(
    (message: UiToMainMessage) => {
      if (isMockRef.current) {
        handleMock(message);
        return;
      }
      window.parent.postMessage({ pluginMessage: message }, "*");
    },
    [handleMock]
  );

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const message = event.data?.pluginMessage as MainToUiMessage | undefined;
      if (!message || typeof message !== "object" || !("type" in message))
        return;
      dispatch({ type: "receive", message });
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    post({ type: "UI_READY" });
  }, [post]);

  const requestScan = useCallback(
    (scope: ScanScope) => {
      dispatch({ type: "scanning", value: true });
      post({ type: "SCAN_REQUEST", scope });
    },
    [post]
  );

  const requestCollections = useCallback(
    () => post({ type: "REQUEST_COLLECTIONS" }),
    [post]
  );

  const requestMigrationScan = useCallback(() => {
    dispatch({ type: "migrationScanning" });
    post({ type: "MIGRATION_SCAN_REQUEST" });
  }, [post]);

  const requestUsageCensus = useCallback(
    (epoch: string) => {
      dispatch({ type: "migrationCensusing" });
      post({ type: "USAGE_CENSUS_REQUEST", epoch });
    },
    [post]
  );

  const applyRenames = useCallback(
    (renames: RenameRequest[]) => {
      dispatch({ type: "clearApply" });
      dispatch({ type: "applying", value: true });
      post({ type: "APPLY_RENAMES", renames });
    },
    [post]
  );

  const renameOne = useCallback(
    (variableId: string, newName: string) => {
      dispatch({ type: "clearApply" });
      dispatch({ type: "applying", value: true });
      post({ type: "RENAME_ONE", variableId, newName });
    },
    [post]
  );

  const createVariable = useCallback(
    (
      name: string,
      collectionId: string,
      resolvedType: VariableResolvedType
    ) => {
      dispatch({ type: "clearCreated" });
      dispatch({ type: "creating", value: true });
      post({ type: "CREATE_VARIABLE", name, collectionId, resolvedType });
    },
    [post]
  );

  const selectNodes = useCallback(
    (nodeIds: string[]) => post({ type: "SELECT_NODES", nodeIds }),
    [post]
  );
  const resize = useCallback(
    (width: number, height: number) => post({ type: "RESIZE", width, height }),
    [post]
  );
  const close = useCallback(() => post({ type: "CLOSE" }), [post]);
  const clearApply = useCallback(() => dispatch({ type: "clearApply" }), []);
  const clearCreated = useCallback(
    () => dispatch({ type: "clearCreated" }),
    []
  );
  const clearError = useCallback(() => dispatch({ type: "clearError" }), []);
  const clearEpochMismatch = useCallback(
    () => dispatch({ type: "clearEpochMismatch" }),
    []
  );

  return {
    state,
    requestScan,
    requestCollections,
    requestMigrationScan,
    requestUsageCensus,
    applyRenames,
    renameOne,
    createVariable,
    selectNodes,
    resize,
    close,
    clearApply,
    clearCreated,
    clearError,
    clearEpochMismatch,
  };
}
