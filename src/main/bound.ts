/**
 * Collect variable ids bound to a set of nodes.
 *
 * Bindings live in two places and both must be scanned:
 *  - `node.boundVariables` — scalar/effect fields (width, corner radius, opacity…)
 *  - each paint's own `boundVariables` — e.g. a solid fill's color
 *
 * Under `documentAccess: "dynamic-page"` the selected nodes are on the already
 * loaded current page, so their fields are readable; we still read defensively
 * in case a node is only partially loaded.
 */

type LooseAlias = { id?: unknown };
type LooseBoundHolder = {
  boundVariables?: Record<string, LooseAlias | LooseAlias[] | undefined>;
};

function addAlias(value: unknown, ids: Set<string>): void {
  if (Array.isArray(value)) {
    for (const item of value) addAlias(item, ids);
    return;
  }
  if (value && typeof value === "object") {
    const id = (value as LooseAlias).id;
    if (typeof id === "string" && id.length > 0) ids.add(id);
  }
}

function addBoundVariables(holder: unknown, ids: Set<string>): void {
  if (!holder || typeof holder !== "object") return;
  const bound = (holder as LooseBoundHolder).boundVariables;
  if (!bound || typeof bound !== "object") return;
  for (const value of Object.values(bound)) addAlias(value, ids);
}

function addPaintBindings(node: SceneNode, ids: Set<string>): void {
  const painted = node as unknown as { fills?: unknown; strokes?: unknown };
  for (const paintList of [painted.fills, painted.strokes]) {
    if (!Array.isArray(paintList)) continue; // skip figma.mixed and absent fields
    for (const paint of paintList) addBoundVariables(paint, ids);
  }
}

export function collectBoundVariableIds(nodes: readonly SceneNode[]): string[] {
  const ids = new Set<string>();
  for (const node of nodes) {
    try {
      addBoundVariables(node, ids);
      addPaintBindings(node, ids);
    } catch {
      // Unreadable field on a partially loaded node — skip it.
    }
  }
  return [...ids];
}
