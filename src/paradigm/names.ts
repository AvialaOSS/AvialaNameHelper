/**
 * Name shape helpers. Pure string functions, no vocabulary knowledge.
 *
 * The one rule that matters: **only the last `/` separates group from leaf.**
 * A variable called `a/b/c` has group `a/b` and leaf `c`, not group `a` and
 * leaf `b/c`. Figma's own UI agrees — it renders every `/` as a folder
 * boundary — but this codebase only ever produces single-level groups, so
 * splitting on the first `/` would silently mis-group anything nested.
 */

export type SplitName = { group: string | null; leaf: string };

/** Split a variable name on its last `/`. No `/` means no group. */
export function splitVariableName(name: string): SplitName {
  const index = name.lastIndexOf("/");
  if (index < 0) return { group: null, leaf: name };
  return { group: name.slice(0, index), leaf: name.slice(index + 1) };
}

/** Join a group and a leaf back into a variable name. */
export function joinVariableName(group: string | null, leaf: string): string {
  return group === null || group.length === 0 ? leaf : `${group}/${leaf}`;
}

/** The `-`-separated slots of a leaf. */
export function leafSegments(leaf: string): string[] {
  return leaf.split("-");
}

const COLLISION_SUFFIX = / \d+$/;

/**
 * Figma silently appends `" 2"` when a name would collide inside a collection.
 * It never throws, so a migration that writes a duplicate name gets a suffixed
 * variable back and no error — which is how the five suffixed names currently
 * in the file came to exist. Detecting the shape is the only way to notice.
 */
export function hasCollisionSuffix(leaf: string): boolean {
  return COLLISION_SUFFIX.test(leaf);
}

/** The leaf with any collision suffix removed. */
export function stripCollisionSuffix(leaf: string): string {
  return leaf.replace(COLLISION_SUFFIX, "");
}

/** True when a name segment starts with an uppercase letter. */
export function startsUppercase(segment: string): boolean {
  const first = segment.charAt(0);
  return (
    first.length > 0 &&
    first === first.toUpperCase() &&
    first !== first.toLowerCase()
  );
}
