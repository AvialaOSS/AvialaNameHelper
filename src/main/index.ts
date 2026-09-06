/**
 * Sandbox entry point. Shows the UI, routes messages, and pushes selection
 * changes. All variable logic lives in `./variables` and `./bound`; naming
 * logic lives entirely in the UI (see `src/grammar`), so this bundle stays tiny.
 */

import type {
  MainToUiMessage,
  ScanScope,
  UiToMainMessage,
} from "../protocol/messages";
import { collectBoundVariableIds } from "./bound";
import {
  applyRenames,
  describeVariablesByIds,
  snapshotLocalVariables,
} from "./variables";

const PLUGIN_VERSION = "0.1.0";
const SELECTION_DEBOUNCE_MS = 150;

figma.showUI(__html__, { width: 400, height: 560 });

function post(message: MainToUiMessage): void {
  figma.ui.postMessage(message);
}

async function sendInit(): Promise<void> {
  const [collections, variables] = await Promise.all([
    figma.variables.getLocalVariableCollectionsAsync(),
    figma.variables.getLocalVariablesAsync(),
  ]);
  post({
    type: "INIT",
    pluginVersion: PLUGIN_VERSION,
    localVariableCount: variables.length,
    localCollectionCount: collections.length,
    hasSelection: figma.currentPage.selection.length > 0,
  });
}

async function scan(scope: ScanScope): Promise<void> {
  const variables =
    scope === "bound"
      ? await describeVariablesByIds(
          collectBoundVariableIds(figma.currentPage.selection)
        )
      : await snapshotLocalVariables();
  post({ type: "SCAN_RESULT", scope, variables });
}

function sendSelection(): void {
  const selection = figma.currentPage.selection;
  post({
    type: "SELECTION_CHANGED",
    hasSelection: selection.length > 0,
    nodeCount: selection.length,
    nodeIds: selection.map((node) => node.id),
    boundVariableCount: collectBoundVariableIds(selection).length,
  });
}

async function handleMessage(message: UiToMainMessage): Promise<void> {
  switch (message.type) {
    case "UI_READY":
      await sendInit();
      break;
    case "SCAN_REQUEST":
      await scan(message.scope);
      break;
    case "APPLY_RENAMES": {
      const result = await applyRenames(message.renames);
      post({
        type: "RENAMES_APPLIED",
        renamed: result.renamed,
        failed: result.failed,
      });
      break;
    }
    case "RENAME_ONE": {
      const result = await applyRenames([
        { variableId: message.variableId, newName: message.newName },
      ]);
      post({
        type: "RENAMES_APPLIED",
        renamed: result.renamed,
        failed: result.failed,
      });
      break;
    }
    case "SELECT_NODES": {
      const nodes: SceneNode[] = [];
      for (const id of message.nodeIds) {
        const node = await figma.getNodeByIdAsync(id);
        if (node && node.type !== "DOCUMENT" && node.type !== "PAGE") {
          nodes.push(node as SceneNode);
        }
      }
      figma.currentPage.selection = nodes;
      if (nodes.length > 0) figma.viewport.scrollAndZoomIntoView(nodes);
      break;
    }
    case "RESIZE":
      figma.ui.resize(
        Math.max(200, Math.round(message.width)),
        Math.max(200, Math.round(message.height))
      );
      break;
    case "CLOSE":
      figma.closePlugin();
      break;
  }
}

figma.ui.onmessage = (message: UiToMainMessage) => {
  handleMessage(message).catch((error: unknown) => {
    post({
      type: "ERROR",
      message: error instanceof Error ? error.message : String(error),
    });
  });
};

let selectionTimer = 0;
figma.on("selectionchange", () => {
  clearTimeout(selectionTimer);
  selectionTimer = setTimeout(sendSelection, SELECTION_DEBOUNCE_MS);
});
