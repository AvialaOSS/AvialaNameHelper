import {
  CATEGORY_SET,
  getCategory,
  getProperty,
  NAME_PREFIX,
  type NameParts,
} from "./grammar";

export type ParseFailureReason =
  | "empty"
  | "missing-prefix"
  | "empty-segment"
  | "unknown-category"
  | "unknown-property"
  | "unrecognized-tail";

export type ParseResult =
  | { ok: true; parts: NameParts }
  | {
      ok: false;
      reason: ParseFailureReason;
      parts: Partial<NameParts>;
      rest?: string[];
    };

/**
 * Longest slug in the grammar spans three tokens ("level4-with-line"); allow a
 * little headroom so a future longer alias still parses.
 */
const MAX_SLUG_TOKENS = 4;

/**
 * Greedy longest-match: try to match the longest slug from `candidates` against
 * `tokens[start..]`, joining consecutive tokens with "-". This is what lets
 * multi-word segments (`border-radius`, `in-progress`, `weight-text`) survive a
 * naive dash split.
 */
function matchLongest(
  tokens: readonly string[],
  start: number,
  candidates: ReadonlySet<string>
): { slug: string; end: number } | null {
  const maxSpan = Math.min(tokens.length - start, MAX_SLUG_TOKENS);
  for (let span = maxSpan; span >= 1; span--) {
    const joined = tokens.slice(start, start + span).join("-");
    if (candidates.has(joined)) return { slug: joined, end: start + span };
  }
  return null;
}

/**
 * Parse a canonical name into its parts using positional greedy longest-match:
 * category → property → variant → state. Matching is case-sensitive; the
 * suggester is responsible for normalizing casing before parsing.
 */
export function parseName(name: string): ParseResult {
  if (typeof name !== "string")
    return { ok: false, reason: "empty", parts: {} };

  const trimmed = name.trim();
  if (trimmed.length === 0) return { ok: false, reason: "empty", parts: {} };
  if (!trimmed.startsWith(NAME_PREFIX))
    return { ok: false, reason: "missing-prefix", parts: {} };

  const body = trimmed.slice(NAME_PREFIX.length);
  if (body.length === 0) return { ok: false, reason: "empty", parts: {} };

  const tokens = body.split("-");
  if (tokens.some((token) => token.length === 0)) {
    return { ok: false, reason: "empty-segment", parts: {} };
  }

  let pos = 0;

  const categoryMatch = matchLongest(tokens, pos, CATEGORY_SET);
  if (!categoryMatch)
    return {
      ok: false,
      reason: "unknown-category",
      parts: {},
      rest: tokens.slice(pos),
    };
  const category = categoryMatch.slug;
  pos = categoryMatch.end;

  const categorySpec = getCategory(category);
  if (!categorySpec)
    return {
      ok: false,
      reason: "unknown-category",
      parts: {},
      rest: tokens.slice(pos),
    };

  const propertySet = new Set(categorySpec.properties.map((p) => p.slug));
  const propertyMatch = matchLongest(tokens, pos, propertySet);
  if (!propertyMatch) {
    return {
      ok: false,
      reason: "unknown-property",
      parts: { category },
      rest: tokens.slice(pos),
    };
  }
  const property = propertyMatch.slug;
  pos = propertyMatch.end;

  const propertySpec = getProperty(category, property);
  if (!propertySpec)
    return { ok: false, reason: "unknown-property", parts: { category } };

  let variant: string | undefined;
  if (propertySpec.variants.length > 0) {
    const variantMatch = matchLongest(
      tokens,
      pos,
      new Set(propertySpec.variants)
    );
    if (variantMatch) {
      variant = variantMatch.slug;
      pos = variantMatch.end;
    }
  }

  let state: string | undefined;
  if (propertySpec.states.length > 0) {
    const stateMatch = matchLongest(tokens, pos, new Set(propertySpec.states));
    if (stateMatch) {
      state = stateMatch.slug;
      pos = stateMatch.end;
    }
  }

  if (pos < tokens.length) {
    return {
      ok: false,
      reason: "unrecognized-tail",
      parts: { category, property, variant, state },
      rest: tokens.slice(pos),
    };
  }

  return { ok: true, parts: { category, property, variant, state } };
}
