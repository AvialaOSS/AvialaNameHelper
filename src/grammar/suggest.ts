import { composeName } from "./compose";
import {
  getCategory,
  getProperty,
  GRAMMAR,
  NAME_PREFIX,
  CATEGORY_SLUGS,
  type NameParts,
} from "./grammar";
import { parseName } from "./parse";
import {
  CASE_WHITELIST,
  CATEGORY_SYNONYMS,
  RADIUS_SYNONYMS,
  TONE_SYNONYMS,
} from "./vocabulary";

export type SuggestAction =
  | { type: "prefix"; message: string }
  | { type: "separator"; message: string }
  | { type: "case"; message: string }
  | { type: "synonym"; from: string; to: string }
  | { type: "corrected"; from: string; to: string }
  | { type: "reordered"; message: string }
  | { type: "inferred-category"; category: string }
  | { type: "dropped"; segment: string };

export type SuggestResult = {
  suggested: string | null;
  changed: boolean;
  actions: SuggestAction[];
};

const MAX_SLUG_TOKENS = 4;
const MAX_DISTANCE = 2;

/* -------------------------------------------------------------------------- */
/* Precomputed candidate indexes                                              */
/* -------------------------------------------------------------------------- */

const PROPERTY_EXACT_BY_CAT = new Map<string, Set<string>>(
  GRAMMAR.map((c) => [c.slug, new Set(c.properties.map((p) => p.slug))])
);

const PROPERTY_SYN_BY_CAT = new Map<string, Readonly<Record<string, string>>>(
  GRAMMAR.map((c) => [
    c.slug,
    c.slug === "border-radius" ? RADIUS_SYNONYMS : {},
  ])
);

const CATEGORY_CANDIDATES = new Set<string>(CATEGORY_SLUGS);

type Match = {
  slug: string;
  canonical: string;
  start: number;
  end: number;
  synonym: boolean;
};

function isFree(consumed: boolean[], start: number, span: number): boolean {
  for (let k = start; k < start + span; k++) if (consumed[k]) return false;
  return true;
}

function markConsumed(consumed: boolean[], match: Match): void {
  for (let k = match.start; k < match.end; k++) consumed[k] = true;
}

/** Leftmost, then longest, exact-or-synonym match over unconsumed tokens. */
function scanLongest(
  tokens: string[],
  consumed: boolean[],
  exact: ReadonlySet<string>,
  synonyms: Readonly<Record<string, string>> = {}
): Match | null {
  for (let start = 0; start < tokens.length; start++) {
    if (consumed[start]) continue;
    const maxSpan = Math.min(MAX_SLUG_TOKENS, tokens.length - start);
    for (let span = maxSpan; span >= 1; span--) {
      if (!isFree(consumed, start, span)) continue;
      const joined = tokens.slice(start, start + span).join("-");
      if (exact.has(joined)) {
        return {
          slug: joined,
          canonical: joined,
          start,
          end: start + span,
          synonym: false,
        };
      }
      if (synonyms[joined]) {
        return {
          slug: joined,
          canonical: synonyms[joined],
          start,
          end: start + span,
          synonym: true,
        };
      }
    }
  }
  return null;
}

function scanProperty(
  tokens: string[],
  consumed: boolean[],
  category: string | undefined
): (Match & { category: string }) | null {
  const cats = category ? [category] : CATEGORY_SLUGS.slice();
  for (let start = 0; start < tokens.length; start++) {
    if (consumed[start]) continue;
    const maxSpan = Math.min(MAX_SLUG_TOKENS, tokens.length - start);
    for (let span = maxSpan; span >= 1; span--) {
      if (!isFree(consumed, start, span)) continue;
      const joined = tokens.slice(start, start + span).join("-");
      for (const cat of cats) {
        const exact = PROPERTY_EXACT_BY_CAT.get(cat)!;
        const syn = PROPERTY_SYN_BY_CAT.get(cat)!;
        if (exact.has(joined)) {
          return {
            slug: joined,
            canonical: joined,
            start,
            end: start + span,
            synonym: false,
            category: cat,
          };
        }
        if (syn[joined]) {
          return {
            slug: joined,
            canonical: syn[joined],
            start,
            end: start + span,
            synonym: true,
            category: cat,
          };
        }
      }
    }
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/* Bounded Levenshtein                                                        */
/* -------------------------------------------------------------------------- */

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (Math.abs(m - n) > MAX_DISTANCE) return MAX_DISTANCE + 1;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const curr = [i];
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    prev = curr;
  }
  return prev[n];
}

function nearest(token: string, candidates: Iterable<string>): string | null {
  let best: string | null = null;
  let bestDistance = MAX_DISTANCE + 1;
  for (const candidate of candidates) {
    const distance = levenshtein(token, candidate);
    if (distance > MAX_DISTANCE) continue;
    if (
      distance < bestDistance ||
      (distance === bestDistance && best !== null && candidate < best)
    ) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
}

/* -------------------------------------------------------------------------- */
/* Normalization                                                              */
/* -------------------------------------------------------------------------- */

function lowerToken(token: string, actions: SuggestAction[]): string {
  for (const allowed of CASE_WHITELIST) {
    if (token.toLowerCase() === allowed.toLowerCase()) {
      if (token !== allowed)
        actions.push({
          type: "case",
          message: `Normalized "${token}" → "${allowed}".`,
        });
      return allowed;
    }
  }
  const lower = token.toLowerCase();
  if (lower !== token)
    actions.push({ type: "case", message: `Lowercased "${token}".` });
  return lower;
}

function normalize(raw: string, actions: SuggestAction[]): string[] {
  let s = raw.trim();
  const hadCanonicalPrefix = s.startsWith(NAME_PREFIX);

  if (/[\s_/]/.test(s)) {
    actions.push({
      type: "separator",
      message: "Converted spaces / underscores / slashes to dashes.",
    });
    s = s.replace(/[\s_/]+/g, "-");
  }

  s = s.replace(/^[-_]+/, "");
  if (/^aviala-/i.test(s)) s = s.replace(/^aviala-/i, "");

  if (!hadCanonicalPrefix)
    actions.push({
      type: "prefix",
      message: `Added the "${NAME_PREFIX}" prefix.`,
    });

  return s
    .split("-")
    .filter((token) => token.length > 0)
    .map((token) => lowerToken(token, actions));
}

/* -------------------------------------------------------------------------- */
/* Reconstruction                                                             */
/* -------------------------------------------------------------------------- */

function reconstruct(
  tokens: string[],
  actions: SuggestAction[]
): NameParts | null {
  const consumed = new Array<boolean>(tokens.length).fill(false);
  // Start index of each filled slot, in canonical order, to detect reordering.
  const positions: number[] = [];

  let category: string | undefined;
  const categoryMatch = scanLongest(
    tokens,
    consumed,
    CATEGORY_CANDIDATES,
    CATEGORY_SYNONYMS
  );
  if (categoryMatch) {
    category = categoryMatch.canonical;
    if (categoryMatch.synonym) {
      actions.push({
        type: "synonym",
        from: categoryMatch.slug,
        to: categoryMatch.canonical,
      });
    }
    markConsumed(consumed, categoryMatch);
    positions.push(categoryMatch.start);
  }

  let property: string | undefined;
  const propertyMatch = scanProperty(tokens, consumed, category);
  if (propertyMatch) {
    property = propertyMatch.canonical;
    if (propertyMatch.synonym) {
      actions.push({
        type: "synonym",
        from: propertyMatch.slug,
        to: propertyMatch.canonical,
      });
    }
    markConsumed(consumed, propertyMatch);
    positions.push(propertyMatch.start);
    if (!category) {
      category = propertyMatch.category;
      actions.push({ type: "inferred-category", category });
    }
  } else if (category) {
    // Required-slot repair: fuzzy-match a property within the known category.
    const candidates = getCategory(category)!.properties.map((p) => p.slug);
    for (let i = 0; i < tokens.length && !property; i++) {
      if (consumed[i]) continue;
      const fix = nearest(tokens[i], candidates);
      if (fix) {
        property = fix;
        consumed[i] = true;
        positions.push(i);
        actions.push({ type: "corrected", from: tokens[i], to: fix });
      }
    }
  }

  if (!category || !property) return null;
  const spec = getProperty(category, property);
  if (!spec) return null;

  let variant: string | undefined;
  if (spec.variants.length > 0) {
    const synonyms = category === "color" ? TONE_SYNONYMS : {};
    const variantMatch = scanLongest(
      tokens,
      consumed,
      new Set(spec.variants),
      synonyms
    );
    if (variantMatch) {
      variant = variantMatch.canonical;
      if (variantMatch.synonym) {
        actions.push({
          type: "synonym",
          from: variantMatch.slug,
          to: variantMatch.canonical,
        });
      }
      markConsumed(consumed, variantMatch);
      positions.push(variantMatch.start);
    }
  }

  let state: string | undefined;
  if (spec.states.length > 0) {
    const stateMatch = scanLongest(tokens, consumed, new Set(spec.states));
    if (stateMatch) {
      state = stateMatch.canonical;
      markConsumed(consumed, stateMatch);
      positions.push(stateMatch.start);
    }
  }

  // Fuzzy-fill an empty variant/state slot from a leftover token, then drop the rest.
  const leftovers = tokens
    .map((token, index) => ({ token, index }))
    .filter(({ index }) => !consumed[index]);
  for (const { token, index } of leftovers) {
    if (variant === undefined && spec.variants.length > 0) {
      const fix = nearest(token, spec.variants);
      if (fix) {
        variant = fix;
        consumed[index] = true;
        positions.push(index);
        actions.push({ type: "corrected", from: token, to: fix });
        continue;
      }
    }
    if (state === undefined && spec.states.length > 0) {
      const fix = nearest(token, spec.states);
      if (fix) {
        state = fix;
        consumed[index] = true;
        positions.push(index);
        actions.push({ type: "corrected", from: token, to: fix });
        continue;
      }
    }
    actions.push({ type: "dropped", segment: token });
  }

  const reordered = positions.some(
    (position, i) => i > 0 && position < positions[i - 1]
  );
  if (reordered) {
    actions.push({
      type: "reordered",
      message: "Reordered into category-property-variant-state.",
    });
  }

  return { category, property, variant, state };
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Produce a best-effort canonical name for a dirty input.
 *
 * Order of operations: cheap normalizations (prefix / separators / casing) →
 * exact positional reconstruction with synonym folding and category inference →
 * bounded edit-distance repair for a missing property/variant/state → dropping
 * whatever cannot be recognized. Returns `suggested: null` when nothing
 * meaningful can be reconstructed.
 */
export function suggestFix(name: string): SuggestResult {
  const trimmed = typeof name === "string" ? name.trim() : "";

  const fast = parseName(trimmed);
  if (fast.ok) {
    const suggested = composeName(fast.parts);
    return { suggested, changed: suggested !== trimmed, actions: [] };
  }

  const actions: SuggestAction[] = [];
  const tokens = normalize(trimmed, actions);
  if (tokens.length === 0)
    return { suggested: null, changed: false, actions: [] };

  const parts = reconstruct(tokens, actions);
  if (!parts) return { suggested: null, changed: false, actions };

  const suggested = composeName(parts);
  return { suggested, changed: suggested !== trimmed, actions };
}
