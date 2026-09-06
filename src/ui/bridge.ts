import { useCallback, useEffect, useReducer, useRef } from "react";
import type {
  MainToUiMessage,
  RenameFailure,
  RenameRequest,
  RenameSuccess,
  ScanScope,
  UiToMainMessage,
  VariableInfo,
  VariableResolvedType,
} from "../protocol/messages";

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

export type BridgeState = {
  isMock: boolean;
  init: InitInfo | null;
  selection: SelectionInfo;
  scan: ScanResult | null;
  scanning: boolean;
  applying: boolean;
  lastApply: ApplyResult | null;
  error: string | null;
};

type Action =
  | { type: "receive"; message: MainToUiMessage }
  | { type: "scanning"; value: boolean }
  | { type: "applying"; value: boolean }
  | { type: "clearApply" }
  | { type: "clearError" };

const EMPTY_SELECTION: SelectionInfo = {
  hasSelection: false,
  nodeCount: 0,
  nodeIds: [],
  boundVariableCount: 0,
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
        case "SCAN_RESULT":
          return {
            ...state,
            scanning: false,
            scan: { scope: message.scope, variables: message.variables },
          };
        case "RENAMES_APPLIED":
          return {
            ...state,
            applying: false,
            lastApply: { renamed: message.renamed, failed: message.failed },
          };
        case "ERROR":
          return {
            ...state,
            scanning: false,
            applying: false,
            error: message.message,
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
    case "clearApply":
      return { ...state, lastApply: null };
    case "clearError":
      return { ...state, error: null };
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

function detectMock(): boolean {
  return typeof window === "undefined" || window.parent === window;
}

/* -------------------------------------------------------------------------- */
/* Hook                                                                       */
/* -------------------------------------------------------------------------- */

export type FigmaBridge = {
  state: BridgeState;
  requestScan: (scope: ScanScope) => void;
  applyRenames: (renames: RenameRequest[]) => void;
  renameOne: (variableId: string, newName: string) => void;
  selectNodes: (nodeIds: string[]) => void;
  resize: (width: number, height: number) => void;
  close: () => void;
  clearApply: () => void;
  clearError: () => void;
};

export function useFigmaBridge(): FigmaBridge {
  const [state, dispatch] = useReducer(reducer, undefined, () => ({
    isMock: detectMock(),
    init: null,
    selection: EMPTY_SELECTION,
    scan: null,
    scanning: false,
    applying: false,
    lastApply: null,
    error: null,
  }));

  const isMockRef = useRef(state.isMock);
  isMockRef.current = state.isMock;

  const handleMock = useCallback((message: UiToMainMessage) => {
    const respond = (reply: MainToUiMessage) =>
      setTimeout(() => dispatch({ type: "receive", message: reply }), 60);

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
        break;
      case "SCAN_REQUEST":
        respond({
          type: "SCAN_RESULT",
          scope: message.scope,
          variables: message.scope === "bound" ? MOCK_BOUND : MOCK_LOCAL,
        });
        break;
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
  const clearError = useCallback(() => dispatch({ type: "clearError" }), []);

  return {
    state,
    requestScan,
    applyRenames,
    renameOne,
    selectNodes,
    resize,
    close,
    clearApply,
    clearError,
  };
}
