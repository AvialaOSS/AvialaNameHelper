/**
 * The grammar table: `category → property → variant → state`.
 *
 * This single structure drives three things at once — the Builder's cascading
 * pickers (what options are legal next), the Validator (what parses), and the
 * suggester (what a segment could be corrected to). It is seeded with the real
 * Aviala vocabulary from `./vocabulary` but arranged into the clean target
 * grammar `--aviala-{category}-{property}-{variant}-{state}`.
 */

import {
  CASE_WHITELIST,
  COLOR_FAMILIES,
  COLOR_INTENSITIES,
  COLOR_SEMANTIC_PROPERTIES,
  COLOR_STATES,
  COLOR_TONES,
  FONT_SIZE_STEPS,
  FONT_WEIGHT_STEPS,
  GAP_STEPS,
  HUE_STEPS,
  INTERACTION_FILLS,
  INTERACTION_STATES,
  LINE_HEIGHT_STEPS,
  NEUTRAL_FAMILY,
  NEUTRAL_STEPS,
  PADDING_STEPS,
  RADIUS_STEPS,
  SHADOW_STEPS,
  SIZE_STEPS,
  TYPOGRAPHY_DIMENSIONS,
  TYPOGRAPHY_LEVELS,
  TRANSPARENCY_STEPS,
} from "./vocabulary";

export const NAME_PREFIX = "--aviala-";

export type NameParts = {
  category: string;
  property: string;
  variant?: string;
  state?: string;
};

export type PropertySpec = {
  slug: string;
  label: string;
  /** Legal values for the third segment. */
  variants: readonly string[];
  /** Legal values for the fourth segment. */
  states: readonly string[];
};

export type CategoryKind = "color" | "scalar" | "enum";

export type CategorySpec = {
  slug: string;
  label: string;
  kind: CategoryKind;
  properties: readonly PropertySpec[];
};

/** Turn a slug into a human label ("line-height" → "Line height"). */
function titleize(slug: string): string {
  const spaced = slug.replace(/-/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function prop(
  slug: string,
  variants: readonly string[] = [],
  states: readonly string[] = []
): PropertySpec {
  return { slug, label: titleize(slug), variants, states };
}

/** Variant pool for semantic color slots: tone ∪ intensity. */
const COLOR_SEMANTIC_VARIANTS: readonly string[] = [
  ...COLOR_TONES,
  ...COLOR_INTENSITIES,
];

const COLOR_PROPERTIES: readonly PropertySpec[] = [
  ...COLOR_FAMILIES.map((family) => prop(family, HUE_STEPS)),
  prop(NEUTRAL_FAMILY, NEUTRAL_STEPS),
  ...COLOR_SEMANTIC_PROPERTIES.map((semantic) =>
    prop(semantic, COLOR_SEMANTIC_VARIANTS, COLOR_STATES)
  ),
];

const INTERACTION_PROPERTIES: readonly PropertySpec[] = INTERACTION_FILLS.map(
  (fill) => prop(fill, [], INTERACTION_STATES)
);

/** A scalar category is a flat list of steps with no variant/state. */
function scalarCategory(slug: string, steps: readonly string[]): CategorySpec {
  return {
    slug,
    label: titleize(slug),
    kind: "scalar",
    properties: steps.map((s) => prop(s)),
  };
}

export const GRAMMAR: readonly CategorySpec[] = [
  {
    slug: "color",
    label: "Color",
    kind: "color",
    properties: COLOR_PROPERTIES,
  },
  {
    slug: "interaction",
    label: "Interaction",
    kind: "color",
    properties: INTERACTION_PROPERTIES,
  },
  scalarCategory("size", SIZE_STEPS),
  scalarCategory("padding", PADDING_STEPS),
  scalarCategory("gap", GAP_STEPS),
  scalarCategory("line-height", LINE_HEIGHT_STEPS),
  scalarCategory("font-size", FONT_SIZE_STEPS),
  scalarCategory("font-weight", FONT_WEIGHT_STEPS),
  scalarCategory("border-radius", RADIUS_STEPS),
  scalarCategory("transparency", TRANSPARENCY_STEPS),
  scalarCategory("shadow", SHADOW_STEPS),
  {
    slug: "typography",
    label: "Typography",
    kind: "enum",
    properties: TYPOGRAPHY_LEVELS.map((level) =>
      prop(level, TYPOGRAPHY_DIMENSIONS)
    ),
  },
];

/* -------------------------------------------------------------------------- */
/* Lookups                                                                    */
/* -------------------------------------------------------------------------- */

const CATEGORY_BY_SLUG = new Map<string, CategorySpec>(
  GRAMMAR.map((c) => [c.slug, c])
);

const PROPERTY_BY_SLUG = new Map<string, Map<string, PropertySpec>>(
  GRAMMAR.map((c) => [c.slug, new Map(c.properties.map((p) => [p.slug, p]))])
);

export function getCategory(
  slug: string | undefined
): CategorySpec | undefined {
  return slug === undefined ? undefined : CATEGORY_BY_SLUG.get(slug);
}

export function getProperty(
  category: string | undefined,
  slug: string | undefined
): PropertySpec | undefined {
  if (category === undefined || slug === undefined) return undefined;
  return PROPERTY_BY_SLUG.get(category)?.get(slug);
}

/** All category slugs, in display order. */
export const CATEGORY_SLUGS: readonly string[] = GRAMMAR.map((c) => c.slug);

const CATEGORY_SET = new Set<string>(CATEGORY_SLUGS);

/** Every property slug grouped by the categories that declare it (many-to-many). */
const PROPERTY_CATEGORIES = new Map<string, string[]>();
for (const category of GRAMMAR) {
  for (const property of category.properties) {
    const list = PROPERTY_CATEGORIES.get(property.slug);
    if (list) {
      if (!list.includes(category.slug)) list.push(category.slug);
    } else {
      PROPERTY_CATEGORIES.set(property.slug, [category.slug]);
    }
  }
}

/** Categories that declare a given property slug, in GRAMMAR order. */
export function categoriesForProperty(slug: string): readonly string[] {
  return PROPERTY_CATEGORIES.get(slug) ?? [];
}

/**
 * Every distinct word that appears in any slug, split on "-". Used by the
 * tokenizer/validator to tell "a known word in the wrong place" from "gibberish".
 */
export const ALL_SEGMENT_WORDS: ReadonlySet<string> = (() => {
  const words = new Set<string>();
  const add = (slug: string) => {
    for (const part of slug.split("-")) words.add(part);
  };
  for (const category of GRAMMAR) {
    add(category.slug);
    for (const property of category.properties) {
      add(property.slug);
      property.variants.forEach(add);
      property.states.forEach(add);
    }
  }
  return words;
})();

export { CASE_WHITELIST, CATEGORY_SET };
