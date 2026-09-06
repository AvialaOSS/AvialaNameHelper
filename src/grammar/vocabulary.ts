/**
 * Real Aviala Design vocabulary harvested from the spiral-2 tokens package.
 *
 * Every list is grounded in an actual source file (noted inline) so that generated
 * names stay faithful to the design system, even though the plugin promotes the
 * cleaner, forward-looking `--aviala-{category}-{property}-{variant}-{state}`
 * grammar rather than the five naming layers that currently coexist in tokens.
 */

/* -------------------------------------------------------------------------- */
/* Color                                                                      */
/* -------------------------------------------------------------------------- */

/** Hue families. Source: packages/tokens/src/engine/variable-map.ts (COLOR_FAMILIES). */
export const COLOR_FAMILIES = [
  "primary",
  "success",
  "warning",
  "error",
  "info",
] as const;

/** Neutral is its own family with a longer ramp. Source: variable-map.ts (ALD_NEUTRAL_RAMP). */
export const NEUTRAL_FAMILY = "neutral";

/** Hue steps run 1–12. Source: source/ald/Aviala Design Colors/{Light,Dark}.tokens.json. */
export const HUE_STEPS: readonly string[] = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "11",
  "12",
];

/** Neutral steps run 1–14. Source: same ALD color tokens (neutral-14 is present). */
export const NEUTRAL_STEPS: readonly string[] = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "11",
  "12",
  "13",
  "14",
];

/**
 * Semantic color slots.
 * Source: source/ald/Components/token-colors/Default.tokens.json + src/semantic/colors.css.
 */
export const COLOR_SEMANTIC_PROPERTIES = [
  "background",
  "lightbackground",
  "primarybackground",
  "secondarybackground",
  "text",
  "title",
  "caption",
  "border",
  "bg",
  "fg",
  "fill",
] as const;

/**
 * Canonical tone qualifiers (variant slot for semantic colors).
 * Source: src/semantic/colors.css (`--*-theme-*`, `--*-normal-*`, `--*-fail-*`).
 * The real source misspells "information" as "infomation"; see TONE_SYNONYMS.
 */
export const COLOR_TONES = [
  "theme",
  "normal",
  "fail",
  "success",
  "warning",
  "info",
] as const;

/**
 * Intensity qualifiers (also variant slot for semantic colors).
 * Source: src/semantic/colors.css (`--text-text-theme-{primary,secondary,light}-black`).
 */
export const COLOR_INTENSITIES = ["primary", "secondary", "light"] as const;

/** Interaction states that meaningfully apply to colors. Source: *-effects.css. */
export const COLOR_STATES = [
  "default",
  "hover",
  "active",
  "disabled",
  "selected",
  "checked",
  "focus",
  "highlight",
  "visited",
] as const;

/* -------------------------------------------------------------------------- */
/* Interaction                                                                */
/* -------------------------------------------------------------------------- */

/** Interaction surface fills. Source: src/semantic/colors.css (`--aviala-interaction-{ghost,filled}-*`). */
export const INTERACTION_FILLS = ["ghost", "filled"] as const;

/**
 * Interaction states. The real source has ghost-{hover,active} and
 * filled-{default,hover,active}; `disabled` completes the clean grammar.
 */
export const INTERACTION_STATES = [
  "default",
  "hover",
  "active",
  "disabled",
] as const;

/* -------------------------------------------------------------------------- */
/* Full state vocabulary                                                      */
/* -------------------------------------------------------------------------- */

/** Every interaction/state suffix seen across the *-effects.css files. */
export const STATES = [
  "default",
  "hover",
  "active",
  "activated",
  "press",
  "selected",
  "checked",
  "unchecked",
  "indeterminate",
  "highlight",
  "disabled",
  "focus",
  "in-range",
  "today",
  "done",
  "fail",
  "waiting",
  "in-progress",
  "visited",
] as const;

/* -------------------------------------------------------------------------- */
/* Numeric scales                                                             */
/* -------------------------------------------------------------------------- */

/** Source: source/ald/Components/base-numbers/Default.tokens.json (size). */
export const SIZE_STEPS = [
  "tiny",
  "small",
  "regular",
  "middle",
  "big",
  "semilarge",
  "semilarger",
  "large",
  "huge",
  "huger",
  "max",
] as const;

/** Source: base-numbers (padding). Note the camelCase `littleSmall`. */
export const PADDING_STEPS = [
  "none",
  "min",
  "tinyer",
  "tiny",
  "smaller",
  "small",
  "littleSmall",
  "default",
  "middle",
  "big",
  "large",
  "max",
] as const;

/** Source: base-numbers (gap). */
export const GAP_STEPS = [
  "none",
  "inside",
  "inside-space",
  "component-space",
  "content-space",
  "block-space",
  "chapter-space",
  "page-space",
] as const;

/** Source: base-numbers (line-height). */
export const LINE_HEIGHT_STEPS = [
  "tiny",
  "small",
  "regular",
  "middle",
  "big",
  "semilarge",
  "large",
  "huge",
  "max",
] as const;

/** Source: base-numbers (transparency). */
export const TRANSPARENCY_STEPS = [
  "loading",
  "disable",
  "placeholder",
] as const;

/* -------------------------------------------------------------------------- */
/* Radius                                                                     */
/* -------------------------------------------------------------------------- */

/** Canonical radius aliases. Source: src/non-color/radius.css (`--radius-{none,xs,sm,md,lg,xl,full}`). */
export const RADIUS_STEPS = [
  "none",
  "xs",
  "sm",
  "md",
  "lg",
  "xl",
  "full",
] as const;

/**
 * Legacy raw radius names → canonical alias.
 * Source: base-numbers (extra-small-2, small, middle, big, large, allround).
 * Only applied when the category is `border-radius`, so `--aviala-size-small`
 * is never corrupted into `sm`.
 */
export const RADIUS_SYNONYMS: Readonly<Record<string, string>> = {
  "extra-small-2": "xs",
  "extra-small": "xs",
  small: "sm",
  middle: "md",
  big: "lg",
  large: "xl",
  allround: "full",
};

/* -------------------------------------------------------------------------- */
/* Typography                                                                 */
/* -------------------------------------------------------------------------- */

/** Source: src/non-color/typography.css (`--font-weight-*`). */
export const FONT_WEIGHT_STEPS = [
  "light",
  "semilight",
  "regular",
  "medium",
  "semibold",
  "bold",
] as const;

/** Source: src/non-color/typography.css (`--font-size-*`). */
export const FONT_SIZE_STEPS = ["xs", "sm", "base", "lg", "xl"] as const;

/** Source: src/non-color/typography.css (`--typography-{display,...,caption}-*`). */
export const TYPOGRAPHY_LEVELS = [
  "display",
  "headline1",
  "headline2",
  "title",
  "subtitle",
  "text",
  "caption",
] as const;

/** Source: src/non-color/typography.css (size / line-height / weight-text / weight-number / fg). */
export const TYPOGRAPHY_DIMENSIONS = [
  "size",
  "line-height",
  "weight-text",
  "weight-number",
  "fg",
] as const;

/* -------------------------------------------------------------------------- */
/* Shadow                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Elevation steps. Source: src/semantic/colors.css (`--aviala-shadow-level4-with-line`,
 * `--aviala-shadow-level5`); the surrounding scale is completed for the clean grammar.
 */
export const SHADOW_STEPS = [
  "level1",
  "level2",
  "level3",
  "level4",
  "level4-with-line",
  "level5",
  "level6",
] as const;

/* -------------------------------------------------------------------------- */
/* Synonyms & casing                                                          */
/* -------------------------------------------------------------------------- */

/** Category-level synonyms folded in by the suggester. */
export const CATEGORY_SYNONYMS: Readonly<Record<string, string>> = {
  radius: "border-radius",
  spacing: "gap",
  weight: "font-weight",
};

/** Tone synonyms (the real source misspells "information"). */
export const TONE_SYNONYMS: Readonly<Record<string, string>> = {
  infomation: "info",
  information: "info",
};

/** Segments permitted to contain uppercase. Source: base-numbers padding `littleSmall`. */
export const CASE_WHITELIST: ReadonlySet<string> = new Set(["littleSmall"]);
