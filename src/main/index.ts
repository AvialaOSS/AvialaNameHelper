/**
 * Sandbox entry point. Shows the UI, routes messages, and pushes selection
 * changes.
 *
 * Variable reads and writes live in `./variables`, `./readSnapshot` and
 * `./usage`; binding sites are defined once in `./bound`. All *naming* logic —
 * the grammar and the migration rule engine — lives in the iframe, so this
 * bundle carries no vocabulary and no rule table.
 *
 * Only `applyRenames` and `createVariable` write anything, and both belong to
 * the Validator and the Builder. Every migration message routed here is a read.
 */

import type {
  MainToUiMessage,
  ScanScope,
  UiToMainMessage,
} from "../protocol/messages";
import { collectBoundVariableIds } from "./bound";
import { readSnapshot } from "./readSnapshot";
import { runUsageCensus } from "./usage";
import {
  applyRenames,
  createVariable,
  describeVariablesByIds,
  snapshotLocalCollections,
  snapshotLocalVariables,
} from "./variables";

const PLUGIN_VERSION = "0.1.0";
const SELECTION_DEBOUNCE_MS = 150;

// Wide enough for the migrator's three-column table, tall enough for the Builder form.
figma.showUI(__html__, { width: 720, height: 720 });

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

/** Push the current local collections so the Builder can offer create targets. */
async function sendCollections(): Promise<void> {
  post({
    type: "COLLECTIONS",
    collections: await snapshotLocalCollections(),
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

/**
 * Re-read the file, and refuse to walk when it moved.
 *
 * The epoch is recomputed from a fresh snapshot rather than trusted from the one
 * the UI holds. A census over a file that changed since the plan was built would
 * attribute bindings to rows that no longer describe them, and the walk is the
 * expensive part — too expensive to spend on an answer that is already stale.
 */
async function sendCensus(epoch: string): Promise<void> {
  const snapshot = await readSnapshot();
  if (snapshot.epoch !== epoch) {
    post({
      type: "MIGRATION_EPOCH_MISMATCH",
      planEpoch: epoch,
      fileEpoch: snapshot.epoch,
      snapshot,
    });
    return;
  }
  const result = await runUsageCensus(snapshot, (progress) =>
    post({ type: "USAGE_CENSUS_PROGRESS", progress })
  );
  post({ type: "USAGE_CENSUS", census: result });
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
      await sendCollections();
      break;
    case "REQUEST_COLLECTIONS":
      await sendCollections();
      break;
    case "SCAN_REQUEST":
      await scan(message.scope);
      break;
    case "MIGRATION_SCAN_REQUEST":
      post({ type: "MIGRATION_SNAPSHOT", snapshot: await readSnapshot() });
      break;
    case "USAGE_CENSUS_REQUEST":
      await sendCensus(message.epoch);
      break;
    case "CREATE_VARIABLE": {
      const variable = await createVariable({
        name: message.name,
        collectionId: message.collectionId,
        resolvedType: message.resolvedType,
      });
      post({ type: "VARIABLE_CREATED", variable });
      break;
    }
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
