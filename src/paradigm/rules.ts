/**
 * The migration rules: one exhaustive `leaf → outcome` table per
 * `(collection, group)` bucket in the live file.
 *
 * This is deliberately **not** a parser. Today's names violate the paradigm, so
 * a general parser would have to reverse-engineer intent from strings that were
 * never well-formed — `box/box-normal-Background-blackOnly` has to become
 * `box/normal-background-black-only`, and no transform on the source produces
 * `only` from `Only`. The tables are the paradigm's *decision*, written down
 * leaf by leaf, and their exhaustiveness is what makes a silent pass impossible:
 * any live leaf that is in neither a table nor its reverse index becomes a
 * `flag` row rather than a no-op.
 *
 * **Convergence.** Stages 3, 4 and 5 are three separate runs, so the second
 * scan sees a half-migrated file. Every table therefore carries a reverse index
 * (`target leaf → source leaves`), and dispatch tries the source shape first and
 * the target shape second. A variable already at its target emits only the
 * deltas that remain — scopes, collection — or `unchanged`.
 */

import type { FlagCode } from "./flags";
import type { Namespace } from "./target";

/** What becomes of one source leaf. */
export type LeafOutcome =
  /** Ends up named `leaf` in the rule's target group. */
  | { kind: "keep"; leaf: string; flags?: readonly FlagCode[] }
  /** Removed outright; the word pool no longer has a step here. */
  | { kind: "delete"; reason: string; flags?: readonly FlagCode[] }
  /** Removed in favour of `into`, which must be a `keep` leaf in this rule. */
  | { kind: "merge"; into: string; flags?: readonly FlagCode[] };

export type Rule = {
  id: string;
  namespace: Namespace;
  sourceCollection: string;
  /** `null` matches ungrouped variables only. */
  sourceGroup: string | null;
  targetCollection: string;
  targetGroup: string | null;
  /**
   * `upstream` rows are computed for completeness but can never be applied
   * here: all 42 are `remote: true`, so they are read-only in this file and the
   * deduplication has to happen in the _Aviala Design Colors_ library.
   */
  applicability: "local" | "upstream";
  leaves: Readonly<Record<string, LeafOutcome>>;
};

const keep = (leaf: string, flags?: readonly FlagCode[]): LeafOutcome =>
  flags ? { kind: "keep", leaf, flags } : { kind: "keep", leaf };
const drop = (reason: string): LeafOutcome => ({ kind: "delete", reason });
const merge = (into: string): LeafOutcome => ({ kind: "merge", into });

// ---------------------------------------------------------------------------
// semantic — 66 variables, all inside `colorSystem`, which is renamed in place
// ---------------------------------------------------------------------------

const SEMANTIC_BORDER: Readonly<Record<string, LeafOutcome>> = {
  "border-fail-primary": keep("error-primary"),
  "border-infomation-primary": keep("info-primary"),
  "border-normal-1": keep("normal-1"),
  "border-normal-2": keep("normal-2"),
  "border-normal-3": keep("normal-3"),
  "border-success-primary": keep("success-primary"),
  "border-theme-primary": keep("theme-primary"),
  "border-warning-primary": keep("warning-primary"),
};

const SEMANTIC_BOX: Readonly<Record<string, LeafOutcome>> = {
  "box-fail-lightBackground": keep("error-lightBackground"),
  "box-fail-primaryBackground": keep("error-primaryBackground"),
  "box-fail-secondaryBackground": keep("error-secondaryBackground"),
  "box-infomation-lightBackground": keep("info-lightBackground"),
  "box-infomation-primaryBackground": keep("info-primaryBackground"),
  "box-infomation-secondaryBackground": keep("info-secondaryBackground"),
  "box-normal-Background-black1": keep("normal-background-black-1"),
  "box-normal-Background-blackOnly": keep("normal-background-black-only"),
  "box-normal-Background-white1": keep("normal-background-white-1"),
  "box-normal-Background-white2": keep("normal-background-white-2"),
  "box-normal-Background-white3": keep("normal-background-white-3"),
  "box-normal-Background-whiteOnly": keep("normal-background-white-only"),
  "box-success-lightBackground": keep("success-lightBackground"),
  "box-success-primaryBackground": keep("success-primaryBackground"),
  "box-success-secondaryBackground": keep("success-secondaryBackground"),
  "box-theme-lightBackground": keep("theme-lightBackground"),
  "box-theme-primaryBackground": keep("theme-primaryBackground"),
  "box-theme-secondaryBackground": keep("theme-secondaryBackground"),
  "box-warning-lightBackground": keep("warning-lightBackground"),
  "box-warning-primaryBackground": keep("warning-primaryBackground"),
  "box-warning-secondaryBackground": keep("warning-secondaryBackground"),
};

const SEMANTIC_CONTROL: Readonly<Record<string, LeafOutcome>> = {
  "control-fail-Background": keep("error-background"),
  "control-fail-lightBackground": keep("error-lightBackground"),
  "control-infomation-Background": keep("info-background"),
  "control-infomation-lightBackground": keep("info-lightBackground"),
  "control-normal-Background-3": keep("normal-background-3"),
  "control-normal-Background-blackOnly": keep("normal-background-black-only"),
  "control-normal-Background-whiteOnly": keep("normal-background-white-only"),
  "control-normal-lightBackground-1": keep("normal-lightBackground-1"),
  "control-normal-lightBackground-2": keep("normal-lightBackground-2"),
  "control-success-Background": keep("success-background"),
  "control-success-lightBackground": keep("success-lightBackground"),
  "control-theme-Background": keep("theme-background"),
  "control-theme-lightBackground": keep("theme-lightBackground"),
  "control-warning-Background": keep("warning-background"),
  "control-warning-lightBackground": keep("warning-lightBackground"),
};

const SEMANTIC_TEXT: Readonly<Record<string, LeafOutcome>> = {
  "text-fail-light-black": keep("error-light-black"),
  "text-fail-primary-black": keep("error-primary-black"),
  "text-fail-secondary-black": keep("error-secondary-black"),
  "text-infomation-light-black": keep("info-light-black"),
  "text-infomation-primary-black": keep("info-primary-black"),
  "text-infomation-secondary-black": keep("info-secondary-black"),
  "text-normal-text-black": keep("normal-text-black"),
  // `text` is the role slot here, not a repeated group: the source reads
  // `text-normal-text-caption-black` and the target drops the middle `text`.
  "text-normal-text-caption-black": keep("normal-caption-black"),
  "text-normal-text-caption-white": keep("normal-caption-white"),
  "text-normal-text-white": keep("normal-text-white"),
  "text-normal-title-black": keep("normal-title-black"),
  "text-normal-title-white": keep("normal-title-white"),
  "text-success-light-black": keep("success-light-black"),
  "text-success-primary-black": keep("success-primary-black"),
  "text-success-secondary-black": keep("success-secondary-black"),
  "text-theme-light-black": keep("theme-light-black"),
  "text-theme-primary-black": keep("theme-primary-black"),
  "text-theme-secondary-black": keep("theme-secondary-black"),
  "text-warning-light-black": keep("warning-light-black"),
  "text-warning-primary-black": keep("warning-primary-black"),
  "text-warning-secondary-black": keep("warning-secondary-black"),
};

/**
 * The single ungrouped `colorSystem` variable. It lands in `box` provisionally,
 * which means two rules share the target `(semantic, box)` — allowed, because
 * the invariant that convergence actually needs is uniqueness of the full
 * target name, and `normal-background-theme` appears in no other table.
 */
const SEMANTIC_UNGROUPED: Readonly<Record<string, LeafOutcome>> = {
  // The only `normal` variable that never re-points: neutral/neutral-3 in both
  // Light and Dark, while every sibling shifts. It also duplicates
  // `box/normal-background-white-3` in Light. The name says theme, the
  // behaviour is theme-independent, and NAMING.md's scope table says "—" with
  // the known-exceptions section saying to delete it outright.
  "normal-background-theme": keep("normal-background-theme", [
    "needs-authoring",
  ]),
};

// ---------------------------------------------------------------------------
// effect — 10 variables across two layers that are not a duplicate pair
// ---------------------------------------------------------------------------

/**
 * The value layer, leaving `colorSystem` for a collection of its own. This is a
 * **move**, not a rename: Figma has no move operation, so it is a rebuild plus a
 * remove, and the five `effectSwitch` aliases that point at these must be
 * re-pointed at the new ids.
 *
 * The Light/Dark pin is deliberately not transferred — `effect` is single-mode
 * because nothing in it differs by theme. Four values are literals identical in
 * both modes and the fifth is one alias (`primary/primary-3`) in both, so the
 * theme axis has nothing to say here.
 */
const EFFECT_VALUES: Readonly<Record<string, LeafOutcome>> = {
  "se-light-effort-bottom": keep("lightEffort-bottom"),
  "se-light-effort-top": keep("lightEffort-top"),
  "se-lineShadow-all": keep("lineShadow-all"),
  "se-lineShadow-bottom": keep("lineShadow-bottom"),
  "se-lineShadow-bottomDeep": keep("lineShadow-bottomDeep"),
};

/**
 * The switch layer. `specialEffort` does not duplicate the five values above —
 * it *references* them and adds the ability to turn them off (ON is an alias,
 * OFF is a literal with alpha 0). Both layers take the same names because they
 * are the same five effects seen from either side of the switch; Figma allows
 * the same name in two different collections.
 *
 * `specialEffort` → `effectSwitch` is a collection rename, so this is free.
 */
const EFFECT_SWITCH: Readonly<Record<string, LeafOutcome>> = {
  "light-effort-bottom": keep("lightEffort-bottom"),
  "light-effort-top": keep("lightEffort-top"),
  "lineShadow-all": keep("lineShadow-all"),
  "lineShadow-bottom": keep("lineShadow-bottom"),
  "lineShadow-bottomDeep": keep("lineShadow-bottomDeep"),
};

// ---------------------------------------------------------------------------
// component — 29 variables, 25 identity renames plus 4 merges
// ---------------------------------------------------------------------------

const SECONDARY_DEFAULT = "color-button-secondary-background-default";
const TERTIARY_DEFAULT = "color-button-tertiary-background-default";

/**
 * The only thing that changes for all 29 is the group: `Button` → `button`.
 * Every leaf below is kept verbatim, including the three camelCase levels
 * (`noBackground`, `noBackgroundCustom`, `outlineCustom`) — an earlier draft of
 * the paradigm wanted those kebab-cased and that decision was withdrawn.
 *
 * The four suffixed entries are copies, not steps: `secondary`'s three all
 * alias `VariableID:1904:2014` and `tertiary`'s three all alias `1904:2018`.
 * Stripping the suffix alone would collide, so they merge. Twelve of the
 * remaining 25 hold a `VARIABLE_EXPRESSION` the API cannot read; those carry
 * the `expression-values` lock, computed from the snapshot rather than listed.
 */
const COMPONENT_BUTTON: Readonly<Record<string, LeafOutcome>> = {
  "color-button-noBackground-background-active": keep(
    "color-button-noBackground-background-active"
  ),
  "color-button-noBackground-background-default": keep(
    "color-button-noBackground-background-default"
  ),
  "color-button-noBackground-background-hover": keep(
    "color-button-noBackground-background-hover"
  ),
  "color-button-noBackground-text-default-caption": keep(
    "color-button-noBackground-text-default-caption"
  ),
  "color-button-noBackground-text-default-text": keep(
    "color-button-noBackground-text-default-text"
  ),
  "color-button-noBackgroundCustom-background-active": keep(
    "color-button-noBackgroundCustom-background-active"
  ),
  "color-button-noBackgroundCustom-background-default": keep(
    "color-button-noBackgroundCustom-background-default"
  ),
  "color-button-noBackgroundCustom-background-hover": keep(
    "color-button-noBackgroundCustom-background-hover"
  ),
  "color-button-outline-background-active": keep(
    "color-button-outline-background-active"
  ),
  "color-button-outline-background-default": keep(
    "color-button-outline-background-default"
  ),
  "color-button-outline-background-hover": keep(
    "color-button-outline-background-hover"
  ),
  "color-button-outlineCustom-background-active": keep(
    "color-button-outlineCustom-background-active"
  ),
  "color-button-outlineCustom-background-default": keep(
    "color-button-outlineCustom-background-default"
  ),
  "color-button-outlineCustom-background-hover": keep(
    "color-button-outlineCustom-background-hover"
  ),
  "color-button-primary-background-active": keep(
    "color-button-primary-background-active"
  ),
  "color-button-primary-background-default": keep(
    "color-button-primary-background-default"
  ),
  "color-button-primary-background-hover": keep(
    "color-button-primary-background-hover"
  ),
  "color-button-primary-text-default-caption": keep(
    "color-button-primary-text-default-caption"
  ),
  "color-button-primary-text-default-text": keep(
    "color-button-primary-text-default-text"
  ),
  [SECONDARY_DEFAULT]: keep(SECONDARY_DEFAULT),
  [`${SECONDARY_DEFAULT} 2`]: merge(SECONDARY_DEFAULT),
  [`${SECONDARY_DEFAULT} 3`]: merge(SECONDARY_DEFAULT),
  "color-button-secondary-text-default-caption": keep(
    "color-button-secondary-text-default-caption"
  ),
  "color-button-secondary-text-default-text": keep(
    "color-button-secondary-text-default-text"
  ),
  [TERTIARY_DEFAULT]: keep(TERTIARY_DEFAULT),
  [`${TERTIARY_DEFAULT} 2`]: merge(TERTIARY_DEFAULT),
  [`${TERTIARY_DEFAULT} 3`]: merge(TERTIARY_DEFAULT),
  "color-button-tertiary-text-default-caption": keep(
    "color-button-tertiary-text-default-caption"
  ),
  "color-button-tertiary-text-default-text": keep(
    "color-button-tertiary-text-default-text"
  ),
};

// ---------------------------------------------------------------------------
// scale — 54 survivors moved out of `numbers` and `fontWeight`, 8 deleted
// ---------------------------------------------------------------------------

const SCALE_SIZE: Readonly<Record<string, LeafOutcome>> = {
  "size-big": keep("big"),
  "size-huge": keep("huge"),
  "size-huger": drop(
    "比较级 `-er` 后缀，而且方向是反的：huger（34）比 huge（30）大，而 padding/tinyer（3）比 tiny（4）小。同一个词缀不能同时表示两个方向。"
  ),
  "size-large": keep("large"),
  "size-max": keep("max"),
  "size-middle": keep("middle"),
  "size-regular": keep("regular"),
  "size-semilarge": drop(
    "单位增量挤在 big（20）和 large（26）之间；词池里没有表示半步的词。"
  ),
  "size-semilarger": drop(
    "比较级 `-er` 后缀，而它依附的那个半步本身就要被删掉。"
  ),
  "size-small": keep("small"),
  "size-tiny": keep("tiny"),
};

const SCALE_LINE_HEIGHT: Readonly<Record<string, LeafOutcome>> = {
  "line-height-big": keep("big"),
  "line-height-huge": keep("huge"),
  "line-height-large": keep("large"),
  "line-height-max": drop(
    "顺序错了：max（44）排在 large（46）和 huge（52）之下，九个里的第七个。删掉它是唯一的修正办法——词池表达不了这个排序。"
  ),
  "line-height-middle": keep("middle"),
  "line-height-regular": keep("regular"),
  "line-height-semilarge": drop(
    "middle（22）和 large（46）之间的半步；词池里没有表示半步的词。"
  ),
  "line-height-small": keep("small"),
  "line-height-tiny": keep("tiny"),
};

const SCALE_BORDER_RADIUS: Readonly<Record<string, LeafOutcome>> = {
  // `allround` (99) is not a step on the scale, it is the absence of one.
  "border-radius-allround": keep("full"),
  "border-radius-big": keep("big"),
  // The source carries Figma's silent collision suffix, which means an
  // unsuffixed `borderRadius/extra-small` once existed and is now gone. The
  // suffix goes with the word it decorates: `extra-small` is not in the pool,
  // and at value 6 the pool word below `small` (8) is `tiny`.
  "border-radius-extra-small 2": keep("tiny"),
  "border-radius-large": keep("large"),
  "border-radius-middle": keep("middle"),
  "border-radius-none": keep("none"),
  "border-radius-small": keep("small"),
};

const SCALE_TRANSPARENCY: Readonly<Record<string, LeafOutcome>> = {
  "transparency-active": keep("active"),
  // Aligned with the state word `component` uses.
  "transparency-disable": keep("disabled"),
  "transparency-hover": keep("hover"),
  "transparency-loading": keep("loading"),
  "transparency-placeholder": keep("placeholder"),
};

const SCALE_PADDING: Readonly<Record<string, LeafOutcome>> = {
  "padding-big": keep("big"),
  // `default` is not a pool word. At 8 it sits between small (6) and middle
  // (10), and the pool word for that position is `regular`. The seven
  // `-default` names in `component` are the `state` slot taking a word normally
  // and must not be touched.
  "padding-default": keep("regular"),
  "padding-large": keep("large"),
  "padding-littleSmall": drop("small（6）和 min（2）之间的怪异单位增量。"),
  "padding-max": keep("max"),
  "padding-middle": keep("middle"),
  "padding-min": keep("min"),
  "padding-none": keep("none"),
  "padding-small": keep("small"),
  "padding-smaller": drop(
    "比较级 `-er` 后缀；small（6）和 tiny（4）之间的怪异单位增量。"
  ),
  "padding-tiny": keep("tiny"),
  "padding-tinyer": drop(
    "比较级 `-er` 后缀，方向朝下；tiny（4）和 min（2）之间的怪异单位增量。"
  ),
};

const SCALE_GAP: Readonly<Record<string, LeafOutcome>> = {
  // `gap` is excluded from the word pool on purpose: these words say where the
  // space is used, not how big it is. Six of the eight values coincide with
  // `padding`, so folding them in would leave eight size words and lose the
  // usage guidance that is the category's entire reason to exist.
  "gap-block-space": keep("blockSpace"),
  "gap-chapter-space": keep("chapterSpace"),
  "gap-component-space": keep("componentSpace"),
  "gap-content-space": keep("contentSpace"),
  "gap-inside": keep("inside"),
  "gap-inside-space": keep("insideSpace"),
  "gap-none": keep("none"),
  "gap-page-space": keep("pageSpace"),
};

const SCALE_BORDER_THICKNESS: Readonly<Record<string, LeafOutcome>> = {
  // An order-preserving subset, not a contiguous run: 0/1/2/3 takes
  // none/regular/middle/large and skips the four words in between, because
  // calling a 3-unit border `small` would misdescribe the heaviest border here.
  "border-thickness-default": keep("regular"),
  "border-thickness-large": keep("large"),
  "border-thickness-middle": keep("middle"),
  "border-thickness-none": keep("none"),
};

const SCALE_FONT_WEIGHT: Readonly<Record<string, LeafOutcome>> = {
  "font-weight-bold": keep("bold"),
  "font-weight-light": keep("light"),
  "font-weight-medium": keep("medium"),
  "font-weight-regular": keep("regular"),
  "font-weight-semibold": keep("semiBold"),
  "font-weight-semilight": keep("semiLight"),
};

// ---------------------------------------------------------------------------
// palette — 42 upstream variables this file can only report on
// ---------------------------------------------------------------------------

/**
 * Every leaf repeats its family, so rule 3 applies to all 42: `error/error-10`
 * → `error/10`. The family is the group and is kept.
 *
 * One rule per family rather than one flat table with a wildcard group. The
 * reverse index would otherwise map the target leaf `2` to six different sources
 * (`error-2`, `info-2`, …), so a converged palette variable could not be
 * attributed to the right one — and convergence is what lets a half-migrated
 * file be re-scanned instead of re-guessed.
 *
 * All 42 are `remote: true` from _Aviala Design Colors_, so they are read-only
 * here and every row is `applicability: "upstream"`. They are still in the plan
 * because `palette` is part of the paradigm and the deduplication has to happen
 * somewhere — just not in this file.
 */
const paletteSteps = (
  family: string,
  steps: readonly number[]
): Readonly<Record<string, LeafOutcome>> =>
  Object.fromEntries(
    steps.map((step) => [`${family}-${step}`, keep(String(step))])
  );

const PALETTE_PRIMARY = paletteSteps("primary", [2, 3, 4, 5, 7, 8, 10]);
const PALETTE_SUCCESS = paletteSteps("success", [2, 4, 5, 7, 8, 10]);
const PALETTE_WARNING = paletteSteps("warning", [2, 4, 5, 7, 8, 10]);
const PALETTE_ERROR = paletteSteps("error", [2, 4, 5, 7, 8, 10]);
const PALETTE_INFO = paletteSteps("info", [2, 4, 5, 7, 8, 10]);
const PALETTE_NEUTRAL = paletteSteps(
  "neutral",
  [1, 2, 3, 4, 5, 6, 8, 10, 11, 13, 14]
);

const paletteRule = (
  family: string,
  leaves: Readonly<Record<string, LeafOutcome>>
): Rule => ({
  id: `palette/${family}`,
  namespace: "palette",
  sourceCollection: "Aviala Design Colors",
  sourceGroup: family,
  targetCollection: "Aviala Design Colors",
  targetGroup: family,
  applicability: "upstream",
  leaves,
});

// ---------------------------------------------------------------------------
// The table
// ---------------------------------------------------------------------------

export const RULES: readonly Rule[] = [
  {
    id: "semantic/border",
    namespace: "semantic",
    sourceCollection: "colorSystem",
    sourceGroup: "border",
    targetCollection: "semantic",
    targetGroup: "border",
    applicability: "local",
    leaves: SEMANTIC_BORDER,
  },
  {
    id: "semantic/box",
    namespace: "semantic",
    sourceCollection: "colorSystem",
    sourceGroup: "box",
    targetCollection: "semantic",
    targetGroup: "box",
    applicability: "local",
    leaves: SEMANTIC_BOX,
  },
  {
    id: "semantic/control",
    namespace: "semantic",
    sourceCollection: "colorSystem",
    sourceGroup: "control",
    targetCollection: "semantic",
    targetGroup: "control",
    applicability: "local",
    leaves: SEMANTIC_CONTROL,
  },
  {
    id: "semantic/text",
    namespace: "semantic",
    sourceCollection: "colorSystem",
    sourceGroup: "text",
    targetCollection: "semantic",
    targetGroup: "text",
    applicability: "local",
    leaves: SEMANTIC_TEXT,
  },
  {
    id: "semantic/(ungrouped)",
    namespace: "semantic",
    sourceCollection: "colorSystem",
    sourceGroup: null,
    targetCollection: "semantic",
    targetGroup: "box",
    applicability: "local",
    leaves: SEMANTIC_UNGROUPED,
  },
  {
    id: "effect/values",
    namespace: "effect",
    sourceCollection: "colorSystem",
    sourceGroup: "special-effort",
    targetCollection: "effect",
    targetGroup: "effect",
    applicability: "local",
    leaves: EFFECT_VALUES,
  },
  {
    id: "effectSwitch",
    namespace: "effect",
    sourceCollection: "specialEffort",
    sourceGroup: null,
    targetCollection: "effectSwitch",
    targetGroup: "effect",
    applicability: "local",
    leaves: EFFECT_SWITCH,
  },
  {
    id: "component/button",
    namespace: "component",
    sourceCollection: "componentVariables",
    sourceGroup: "Button",
    targetCollection: "component",
    targetGroup: "button",
    applicability: "local",
    leaves: COMPONENT_BUTTON,
  },
  {
    id: "scale/size",
    namespace: "scale",
    sourceCollection: "numbers",
    sourceGroup: "size",
    targetCollection: "scaleDensity",
    targetGroup: "size",
    applicability: "local",
    leaves: SCALE_SIZE,
  },
  {
    id: "scale/lineHeight",
    namespace: "scale",
    sourceCollection: "numbers",
    sourceGroup: "line-height",
    targetCollection: "scaleDensity",
    targetGroup: "lineHeight",
    applicability: "local",
    leaves: SCALE_LINE_HEIGHT,
  },
  {
    id: "scale/borderRadius",
    namespace: "scale",
    sourceCollection: "numbers",
    sourceGroup: "border-radius",
    targetCollection: "scaleDensity",
    targetGroup: "borderRadius",
    applicability: "local",
    leaves: SCALE_BORDER_RADIUS,
  },
  {
    id: "scale/transparency",
    namespace: "scale",
    sourceCollection: "numbers",
    sourceGroup: "transparency",
    targetCollection: "scaleContrast",
    targetGroup: "transparency",
    applicability: "local",
    leaves: SCALE_TRANSPARENCY,
  },
  {
    id: "scale/padding",
    namespace: "scale",
    sourceCollection: "numbers",
    sourceGroup: "padding",
    targetCollection: "scaleStatic",
    targetGroup: "padding",
    applicability: "local",
    leaves: SCALE_PADDING,
  },
  {
    id: "scale/gap",
    namespace: "scale",
    sourceCollection: "numbers",
    sourceGroup: "gap",
    targetCollection: "scaleStatic",
    targetGroup: "gap",
    applicability: "local",
    leaves: SCALE_GAP,
  },
  {
    id: "scale/borderThickness",
    namespace: "scale",
    sourceCollection: "numbers",
    sourceGroup: "border-thickness",
    targetCollection: "scaleStatic",
    targetGroup: "borderThickness",
    applicability: "local",
    leaves: SCALE_BORDER_THICKNESS,
  },
  {
    id: "scale/fontWeight",
    namespace: "scale",
    sourceCollection: "fontWeight",
    sourceGroup: null,
    targetCollection: "scaleStatic",
    targetGroup: "fontWeight",
    applicability: "local",
    leaves: SCALE_FONT_WEIGHT,
  },
  paletteRule("primary", PALETTE_PRIMARY),
  paletteRule("success", PALETTE_SUCCESS),
  paletteRule("warning", PALETTE_WARNING),
  paletteRule("error", PALETTE_ERROR),
  paletteRule("info", PALETTE_INFO),
  paletteRule("neutral", PALETTE_NEUTRAL),
];

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

export type TargetIndex = Readonly<Record<string, readonly string[]>>;

/**
 * `target leaf → source leaves`, built once. Several sources can share a target
 * (the four merges do), so the value is a list; a converged variable matches the
 * entry whose source leaf is the winner.
 */
function buildTargetIndex(rule: Rule): TargetIndex {
  const index: Record<string, string[]> = {};
  for (const [sourceLeaf, outcome] of Object.entries(rule.leaves)) {
    if (outcome.kind === "delete") continue;
    const targetLeaf = outcome.kind === "keep" ? outcome.leaf : outcome.into;
    (index[targetLeaf] ??= []).push(sourceLeaf);
  }
  return index;
}

const TARGET_INDEXES: readonly TargetIndex[] = RULES.map(buildTargetIndex);

export function targetIndex(rule: Rule): TargetIndex {
  const at = RULES.indexOf(rule);
  if (at < 0) throw new Error("rule is not in RULES");
  return TARGET_INDEXES[at];
}

export type RuleMatch = {
  rule: Rule;
  /** Which shape of the variable the rule recognised. */
  via: "source" | "target";
  outcome: LeafOutcome;
  /** The source leaf this variable corresponds to, whether or not it still has it. */
  sourceLeaf: string;
};

/**
 * Find the rule and outcome for one live variable.
 *
 * Source shape first: that is the pre-migration case and the one the tables were
 * written for. Target shape second, so a half-migrated file converges instead of
 * re-deriving. `null` means nothing claims this variable and the caller must
 * emit a flag row — never a silent pass.
 *
 * A target-shape match with several candidate source leaves (the merges)
 * resolves to the winner, because the losers no longer exist by the time the
 * winner is at its target.
 */
export function matchRule(
  collectionName: string,
  group: string | null,
  leaf: string
): RuleMatch | null {
  for (const rule of RULES) {
    if (rule.sourceCollection !== collectionName) continue;
    if (rule.sourceGroup !== group) continue;
    const outcome = rule.leaves[leaf];
    if (outcome) return { rule, via: "source", outcome, sourceLeaf: leaf };
  }

  for (const rule of RULES) {
    if (rule.targetCollection !== collectionName) continue;
    if (rule.targetGroup !== group) continue;
    const sources = targetIndex(rule)[leaf];
    if (!sources) continue;
    const winner = sources.find(
      (source) => rule.leaves[source]?.kind === "keep"
    );
    const sourceLeaf = winner ?? sources[0];
    const outcome = rule.leaves[sourceLeaf];
    if (outcome) return { rule, via: "target", outcome, sourceLeaf };
  }

  return null;
}

/** Every source leaf across every rule, for coverage assertions. */
export function allSourceLeaves(): { rule: Rule; leaf: string }[] {
  return RULES.flatMap((rule) =>
    Object.keys(rule.leaves).map((leaf) => ({ rule, leaf }))
  );
}
