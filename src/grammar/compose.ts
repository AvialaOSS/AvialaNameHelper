import { NAME_PREFIX, type NameParts } from "./grammar";

/**
 * Compose a canonical token name from its parts.
 *
 * Empty/undefined segments are dropped, so a parts object with only
 * `{category, property}` yields a three-segment name. Segment internals are
 * preserved verbatim (keeping `littleSmall`, `in-progress`, `level4-with-line`).
 */
export function composeName(parts: NameParts): string {
  const segments = [
    parts.category,
    parts.property,
    parts.variant,
    parts.state,
  ].filter(
    (segment): segment is string =>
      typeof segment === "string" && segment.length > 0
  );
  return NAME_PREFIX + segments.join("-");
}
