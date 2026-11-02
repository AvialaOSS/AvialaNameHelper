/**
 * The paradigm as data. Everything NAMING.md asserts about the *target* state
 * lives here: the five namespaces, the seven local collections with their axes
 * and modes, the closed vocabularies, the required scopes, the explicit-mode
 * transfer map, and the lock policy.
 *
 * Two constraints shape this file:
 *
 * 1. **No `figma` types.** This module is in the `include` of both
 *    `tsconfig.main.json` and `tsconfig.ui.json`. The main project has no DOM
 *    lib and the UI project has no `@figma/plugin-typings`, so anything Figma-
 *    specific would fail to compile on one side. Scope names are therefore
 *    plain strings (`"STROKE_COLOR"`), not `VariableScope` — the executor maps
 *    them onto the API's literals and reads the result back.
 * 2. **Names, not ids.** Collection identity in the live file is matched by
 *    `key` (see `snapshot.ts`); the names here are the *targets*, which is what
 *    makes a rule table able to say "this variable should end up in
 *    `scaleDensity`" without knowing whether the file has been migrated yet.
 */

import type { ActionKind, LockReason } from "./flags";

// ---------------------------------------------------------------------------
// Namespaces
// ---------------------------------------------------------------------------

/**
 * A namespace is the *shape of a name*; a collection is a Figma container with
 * a set of modes. The two are orthogonal — `scale` spans three collections and
 * `effect` spans two — because the group prefix already carries the namespace,
 * so splitting the collections loses nothing.
 */
export type Namespace =
  "palette" | "semantic" | "scale" | "component" | "effect";

export const NAMESPACES: readonly Namespace[] = [
  "palette",
  "semantic",
  "scale",
  "component",
  "effect",
];

/** The slot grammar of each namespace, for display. `{a}-{b}` is one slot. */
export const NAMESPACE_SHAPES: Readonly<Record<Namespace, string>> = {
  palette: "{family}/{step}",
  semantic: "{use}/{tone}-{slot}",
  scale: "{category}/{step}",
  component: "{type}-{component}-{level}-{role}-{state}",
  effect: "effect/{name}-{position}",
};

// ---------------------------------------------------------------------------
// Target collections
// ---------------------------------------------------------------------------

/**
 * The axis a collection carries. One collection carries exactly one axis,
 * because a layer can only bind one mode per collection — so two independent
 * axes (density and contrast) cannot share a variable and must be split.
 */
export type Axis = "theme" | "density" | "contrast" | "presence";

export type TargetCollection = {
  name: string;
  namespace: Namespace;
  /** `null` when the collection has a single mode and carries no axis. */
  axis: Axis | null;
  modes: readonly string[];
  groups: readonly string[];
  /**
   * Local variable count at the **167** moment: re-partitioned, alias shells
   * cleared, but before the 8 deletions and 4 merges. This is the count in
   * NAMING.md's layout table.
   */
  layoutCount: number;
  /** Local variable count at the **155** moment: fully converged. */
  convergedCount: number;
  /** Today's collection names this one is carved out of. */
  sources: readonly string[];
};

/**
 * The seven local target collections. `layoutCount` sums to 167 and
 * `convergedCount` sums to 155; both sums are asserted in `layout.test.ts`,
 * because NAMING.md contains three different totals for the same file and the
 * only defence against mixing them up is making each one load-bearing.
 */
export const TARGET_COLLECTIONS: readonly TargetCollection[] = [
  {
    name: "semantic",
    namespace: "semantic",
    axis: "theme",
    modes: ["Light", "Dark"],
    groups: ["border", "box", "control", "text"],
    layoutCount: 66,
    convergedCount: 66,
    sources: ["colorSystem"],
  },
  {
    name: "effect",
    namespace: "effect",
    axis: null,
    modes: ["Default"],
    groups: ["effect"],
    layoutCount: 5,
    convergedCount: 5,
    sources: ["colorSystem"],
  },
  {
    name: "effectSwitch",
    namespace: "effect",
    axis: "presence",
    modes: ["ON", "OFF"],
    groups: ["effect"],
    layoutCount: 5,
    convergedCount: 5,
    sources: ["specialEffort"],
  },
  {
    name: "scaleDensity",
    namespace: "scale",
    axis: "density",
    modes: ["Default", "Mobile Friendly"],
    groups: ["size", "lineHeight", "borderRadius"],
    layoutCount: 27,
    convergedCount: 22,
    sources: ["numbers"],
  },
  {
    name: "scaleContrast",
    namespace: "scale",
    axis: "contrast",
    modes: ["Default", "High Contrast"],
    groups: ["transparency"],
    layoutCount: 5,
    convergedCount: 5,
    sources: ["numbers"],
  },
  {
    name: "scaleStatic",
    namespace: "scale",
    axis: null,
    modes: ["Default"],
    groups: ["padding", "gap", "borderThickness", "fontWeight"],
    layoutCount: 30,
    convergedCount: 27,
    sources: ["numbers", "fontWeight"],
  },
  {
    name: "component",
    namespace: "component",
    axis: null,
    modes: ["Mode 1"],
    groups: ["button"],
    layoutCount: 29,
    convergedCount: 25,
    sources: ["componentVariables"],
  },
];

/** The one collection this file can never touch: the upstream colour library. */
export const UPSTREAM_COLLECTION = {
  name: "Aviala Design Colors",
  namespace: "palette" as Namespace,
  axis: "theme" as Axis,
  modes: ["Light", "Dark"] as readonly string[],
  groups: [
    "primary",
    "success",
    "warning",
    "error",
    "info",
    "neutral",
  ] as readonly string[],
  /** Not a local count — how many of its variables this file references. */
  referencedCount: 42,
} as const;

export function findTargetCollection(
  name: string
): TargetCollection | undefined {
  return TARGET_COLLECTIONS.find((collection) => collection.name === name);
}

/**
 * Collections that are *renamed* rather than built. A rename keeps the same
 * `VariableCollection` object and therefore the same id, so every explicit mode
 * pin on it survives untouched — the cheapest possible outcome, and the reason
 * the theme and presence axes cost nothing to relabel.
 */
export const RENAMED_COLLECTIONS: Readonly<Record<string, string>> = {
  colorSystem: "semantic",
  specialEffort: "effectSwitch",
  componentVariables: "component",
};

/** Collections created empty in Stage 3, so Stage 4 has somewhere to rebuild into. */
export const NEW_COLLECTIONS: readonly string[] = [
  "scaleDensity",
  "scaleContrast",
  "scaleStatic",
  "effect",
];

/**
 * Collections that end up empty and are then removed. `VariableCollection.remove()`
 * takes every variable inside it, so the executor must read `variableIds.length`
 * at runtime and refuse unless it is zero — the plan's number is not evidence.
 */
export const DISSOLVED_COLLECTIONS: readonly string[] = [
  "numbers",
  "fontWeight",
];

// ---------------------------------------------------------------------------
// Explicit mode transfer
// ---------------------------------------------------------------------------

/** Source mode name → target mode name. Empty means the pin is deliberately dropped. */
export type ModeNameMap = Readonly<Record<string, string>>;

/** One source collection's transfers, keyed by target collection name. */
export type CollectionModeTransfer = Readonly<Record<string, ModeNameMap>>;

/**
 * `node.explicitVariableModes` is keyed by **collection id**, and a binding
 * census is structurally blind to it: when a collection dissolves, every frame
 * pinned to it silently falls back to Default while its bindings keep resolving
 * to a live variable. The census reads the same before and after; only the
 * resolved values change.
 *
 * So every move must carry an explicit map from source mode name to target mode
 * name, and the executor must compare pin counts before and after and fail the
 * whole action if any went missing. An empty map is a real answer — it means the
 * target has no corresponding axis and the pin is deliberately not carried.
 *
 * Measured exposure in this file: of the 56 `numbers` variables, exactly 10 hold
 * different values across the two modes (size 4, lineHeight 4, transparency 2).
 * The other 46 are identical, so a lost pin on them is invisible today and
 * becomes visible the first time someone authors a difference.
 */
export const EXPLICIT_MODE_TRANSFER: Readonly<
  Record<string, CollectionModeTransfer>
> = {
  // Real moves — the source collection object is destroyed.
  numbers: {
    scaleDensity: { Default: "Default", "Mobile Friendly": "Mobile Friendly" },
    // Deliberately drops the Mobile Friendly pin: transparency's axis is
    // contrast, not density. A frame that wanted Mobile Friendly has no
    // corresponding High Contrast preference to inherit, and inventing one
    // would be a design decision made by a migration script.
    scaleContrast: { Default: "Default" },
    scaleStatic: { Default: "Default" },
  },
  fontWeight: {
    // Single-mode source; a pin on it selects the only mode there is.
    scaleStatic: {},
  },
  colorSystem: {
    // The five `special-effort` variables move out to a single-mode collection.
    // This is safe because their values are identical in Light and Dark — four
    // literals match exactly and the fifth is one alias in both modes — so the
    // theme axis has nothing to say about them. It is also why `effect` has no
    // theme axis at all.
    effect: {},
    // Same object, renamed. Recorded so a test can assert that every multi-mode
    // source of a real move has a non-empty transfer.
    semantic: { Light: "Light", Dark: "Dark" },
  },
  // Same object, renamed.
  specialEffort: { effectSwitch: { ON: "ON", OFF: "OFF" } },
  componentVariables: { component: { "Mode 1": "Mode 1" } },
};

/** Whether getting a variable from one collection to another destroys it. */
export function isMove(
  sourceCollection: string,
  targetCollection: string
): boolean {
  if (sourceCollection === targetCollection) return false;
  return RENAMED_COLLECTIONS[sourceCollection] !== targetCollection;
}

/**
 * The mode-name map for one move. `{}` when the target carries no corresponding
 * axis, which is a deliberate loss rather than an oversight.
 */
export function explicitModeTransfer(
  sourceCollection: string,
  targetCollection: string
): ModeNameMap {
  return EXPLICIT_MODE_TRANSFER[sourceCollection]?.[targetCollection] ?? {};
}

// ---------------------------------------------------------------------------
// Closed vocabularies
// ---------------------------------------------------------------------------

/**
 * The vocabularies are closed: a word not listed here is not a step, it is a
 * misspelling or an undocumented addition. That is what makes rule 3 (never
 * repeat the group in the leaf) safe to apply by table lookup rather than by
 * string surgery — `box/box-blackOnly` must become `box/normal-background-black-only`,
 * and no transform on the source string can produce `only` from `blackOnly`.
 * **The vocabulary wins over any string transform.**
 */

export const PALETTE_FAMILIES = [
  "primary",
  "success",
  "warning",
  "error",
  "info",
  "neutral",
] as const;

/** Colour families run 1–12, `neutral` runs 1–14. */
export const PALETTE_STEP_MAX: Readonly<
  Record<(typeof PALETTE_FAMILIES)[number], number>
> = {
  primary: 12,
  success: 12,
  warning: 12,
  error: 12,
  info: 12,
  neutral: 14,
};

export const SEMANTIC_USES = ["border", "box", "control", "text"] as const;

export const SEMANTIC_TONES = [
  "normal",
  "theme",
  "success",
  "warning",
  "error",
  "info",
] as const;

export const BOX_INTENSITY = [
  "lightBackground",
  "primaryBackground",
  "secondaryBackground",
] as const;

/** Neutral box surfaces are stepped 1–3, plus a terminal absolute `only`. */
export const BOX_NEUTRAL_STEPS = ["1", "2", "3", "only"] as const;
export const BOX_NEUTRAL_BASES = ["black", "white"] as const;

export const TEXT_ROLES = ["text", "title", "caption"] as const;
export const TEXT_NEUTRAL_BASES = ["black", "white"] as const;

export const SCALE_CATEGORIES = [
  "size",
  "lineHeight",
  "borderRadius",
  "transparency",
  "padding",
  "gap",
  "borderThickness",
  "fontWeight",
] as const;

export type ScaleCategory = (typeof SCALE_CATEGORIES)[number];

/**
 * The shared total order. Each measuring category takes an **order-preserving
 * subset**, not a contiguous run: `borderThickness` uses `none` `regular`
 * `middle` `large` and skips the four words in between, because its values are
 * 0/1/2/3 and calling a 3-unit border `small` would misdescribe the heaviest
 * border in the system.
 *
 * `big < large` reads backwards in English but holds across `size` (20 < 26),
 * `padding` (14 < 18) and `borderRadius` (12 < 16), so it is the system's
 * established convention rather than an error.
 */
export const SCALE_WORD_POOL = [
  "none",
  "min",
  "tiny",
  "small",
  "regular",
  "middle",
  "big",
  "large",
  "huge",
  "max",
] as const;

/**
 * The five categories that draw from the word pool. Convergence removes 8 of
 * their 43 steps; this is the set the `scale-word-pool` lock is scoped to, and
 * deliberately excludes `gap`, `transparency` and `fontWeight`, whose word lists
 * are settled and carry no open question.
 */
export const WORD_POOL_CATEGORIES = [
  "size",
  "lineHeight",
  "borderRadius",
  "padding",
  "borderThickness",
] as const;

/**
 * `gap` is excluded from the word pool on purpose. Its steps say *where* space
 * is used, not how big it is, which is the entire reason the category exists;
 * six of its eight values coincide with `padding`, so folding it into the pool
 * would leave eight size words and lose the usage guidance.
 */
export const GAP_STEPS = [
  "none",
  "inside",
  "insideSpace",
  "componentSpace",
  "contentSpace",
  "blockSpace",
  "chapterSpace",
  "pageSpace",
] as const;

/** Ordered; values are 300/350/400/500/600/700, so name order matches numeric order. */
export const FONT_WEIGHTS = [
  "light",
  "semiLight",
  "regular",
  "medium",
  "semiBold",
  "bold",
] as const;

/** Ordered by nothing — these are states, not a scale. */
export const TRANSPARENCY_STEPS = [
  "loading",
  "disabled",
  "placeholder",
  "hover",
  "active",
] as const;

export const COMPONENT_TYPES = [
  "color",
  "transition",
  "animation",
  "font",
  "size",
  "radius",
  "space",
] as const;

export const COMPONENT_LEVELS = [
  "primary",
  "secondary",
  "tertiary",
  "noBackground",
  "outline",
  "noBackgroundCustom",
  "outlineCustom",
] as const;

export const COMPONENT_ROLES = ["background", "text"] as const;

export const COMPONENT_STATES = [
  "default",
  "hover",
  "active",
  "disabled",
  "selected",
  "checked",
  "focus",
] as const;

export const EFFECT_NAMES = ["lightEffort", "lineShadow"] as const;
export const EFFECT_POSITIONS = ["top", "bottom", "bottomDeep", "all"] as const;

// ---------------------------------------------------------------------------
// Required scopes
// ---------------------------------------------------------------------------

/** What the scopes must be derived from. */
export type ScopeKey = {
  namespace: Namespace;
  collection: string;
  group: string | null;
  leaf: string;
};

const SCOPES = {
  strokeColor: ["STROKE_COLOR"],
  frameShapeFill: ["FRAME_FILL", "SHAPE_FILL"],
  frameShapeTextFill: ["FRAME_FILL", "SHAPE_FILL", "TEXT_FILL"],
  textFill: ["TEXT_FILL"],
  fontSize: ["FONT_SIZE", "WIDTH_HEIGHT"],
  lineHeight: ["LINE_HEIGHT"],
  gap: ["GAP"],
  cornerRadius: ["CORNER_RADIUS"],
  strokeFloat: ["STROKE_FLOAT"],
  fontWeight: ["FONT_WEIGHT"],
  opacity: ["OPACITY"],
  effectColor: ["EFFECT_COLOR"],
  allFills: ["ALL_FILLS"],
} as const satisfies Readonly<Record<string, readonly string[]>>;

/**
 * The required scopes for one target variable, or `null` when the paradigm
 * declines to set any.
 *
 * Two of these are derived from the name rather than chosen independently:
 * `component` already carries a closed `role` slot, and `effect`'s scope
 * follows its closed `name` slot. `scale`'s category is likewise a closed
 * 8-word vocabulary.
 *
 * Writing scopes is free — they are a property, not an identity — but the API
 * is explicit that it "does not prevent that variable from being bound in other
 * scopes... This only limits the variables that are shown in pickers within the
 * Figma UI". So narrowing retroactively flags nothing, an existing misbinding
 * keeps rendering, and every write must be read back because a silent no-op is
 * indistinguishable from success.
 */
export function requiredScopes(key: ScopeKey): readonly string[] | null {
  switch (key.namespace) {
    case "palette":
      // Set upstream in the library; invisible from a consuming file.
      return null;

    case "semantic":
      switch (key.group) {
        case "border":
          return SCOPES.strokeColor;
        case "box":
          return SCOPES.frameShapeFill;
        case "control":
          return SCOPES.frameShapeTextFill;
        case "text":
          return SCOPES.textFill;
        default:
          // The one ungrouped `semantic` variable. NAMING.md's scope table says
          // "—" and the known-exceptions section says to delete it outright, so
          // there is no scope to write.
          return null;
      }

    case "effect":
      // `lineShadow` colours an effect, `lightEffort` fills a shape.
      return effectNameOf(key.leaf) === "lightEffort"
        ? SCOPES.allFills
        : SCOPES.effectColor;

    case "scale":
      switch (key.group) {
        case "size":
          return SCOPES.fontSize;
        case "lineHeight":
          return SCOPES.lineHeight;
        case "padding":
        case "gap":
          return SCOPES.gap;
        case "borderRadius":
          return SCOPES.cornerRadius;
        case "borderThickness":
          return SCOPES.strokeFloat;
        case "fontWeight":
          return SCOPES.fontWeight;
        case "transparency":
          return SCOPES.opacity;
        default:
          return null;
      }

    case "component":
      return componentRoleOf(key.leaf) === "text"
        ? SCOPES.textFill
        : SCOPES.frameShapeFill;
  }
}

/** The `name` slot of an `effect/{name}-{position}` leaf, or `null`. */
export function effectNameOf(
  leaf: string
): (typeof EFFECT_NAMES)[number] | null {
  const head = leaf.slice(
    0,
    leaf.indexOf("-") < 0 ? leaf.length : leaf.indexOf("-")
  );
  return (EFFECT_NAMES as readonly string[]).includes(head)
    ? (head as (typeof EFFECT_NAMES)[number])
    : null;
}

/**
 * The `role` slot of a `{type}-{component}-{level}-{role}-{state}` leaf.
 * Index 3 is stable even for the multi-word levels (`noBackgroundCustom`),
 * because those are written camelCase and therefore occupy one `-` segment.
 */
export function componentRoleOf(
  leaf: string
): (typeof COMPONENT_ROLES)[number] | null {
  const role = leaf.split("-")[3];
  return (COMPONENT_ROLES as readonly string[]).includes(role ?? "")
    ? (role as (typeof COMPONENT_ROLES)[number])
    : null;
}

// ---------------------------------------------------------------------------
// Lock policy
// ---------------------------------------------------------------------------

/**
 * What the policy is allowed to look at. Deliberately structural rather than
 * the whole plan row, so the policy cannot start depending on data it has no
 * business reading (census counts, ids) and so it stays testable in isolation.
 */
export type LockInput = {
  namespace: Namespace;
  sourceCollection: string;
  sourceGroup: string | null;
  /** Source leaf, for the one policy rule that names a specific variable. */
  sourceLeaf: string;
  targetCollection: string;
  targetGroup: string | null;
  action: ActionKind;
  /** True when any mode's value came back as a `VARIABLE_EXPRESSION`. */
  hasUnreadableExpression: boolean;
};

export type LockRule = {
  reason: LockReason;
  applies(input: LockInput): boolean;
};

/**
 * Groups whose camelCase spelling is my inference from the file's own
 * convention, not something the user has confirmed. `Button` → `button` is
 * *not* in here: NAMING.md states it outright, and that layer is locked by
 * `component-deferred` instead.
 */
const INFERRED_CAMELCASE_GROUPS: Readonly<Record<string, readonly string[]>> = {
  scaleDensity: ["lineHeight", "borderRadius"],
  scaleStatic: ["borderThickness"],
};

/**
 * Rows that are computed and displayed but not selectable by default, and that
 * batch apply skips. Unlocking is per row, never bulk.
 *
 * A row can carry several reasons; the count that matters is the union. Tests
 * read this array rather than hard-coding 35 or 61, so narrowing a reason here
 * is the only edit needed to change the totals.
 */
export const LOCK_POLICY: readonly LockRule[] = [
  {
    reason: "group-camelCase",
    applies: (input) =>
      INFERRED_CAMELCASE_GROUPS[input.targetCollection]?.includes(
        input.targetGroup ?? ""
      ) === true,
  },
  {
    reason: "scale-word-pool",
    // Scoped to the five pool categories only. `gap` (8), `transparency` (5)
    // and `fontWeight` (6) have settled word lists and no open question, so
    // locking them would hold 19 rows hostage to a decision that was already
    // made. Applies to deletions too — the pool convergence is what causes them.
    applies: (input) =>
      input.namespace === "scale" &&
      (WORD_POOL_CATEGORIES as readonly string[]).includes(
        input.targetGroup ?? ""
      ),
  },
  {
    reason: "component-deferred",
    // "先定范式，Button 层后续再修." The 25 identity renames are computed
    // because the group change is real, but the layer is not being touched this
    // round and its vocabulary is the thinnest in the file (7 declared types,
    // 1 attested).
    applies: (input) => input.namespace === "component",
  },
  {
    reason: "normal-background-theme",
    // The only `normal` variable that never re-points across Light and Dark,
    // and it duplicates `box/normal-background-white-3` in Light. Its name says
    // theme, its behaviour is theme-independent. Drop or rename is undecided.
    applies: (input) =>
      input.namespace === "semantic" &&
      input.sourceLeaf === "normal-background-theme",
  },
  {
    reason: "high-contrast-values",
    // Gates values, not names: the High Contrast column is unwritten because
    // nothing records whether `80` means 80% opaque or 80% transparent, and the
    // direction of the adjustment depends entirely on that.
    applies: (input) => input.targetCollection === "scaleContrast",
  },
  {
    reason: "borderRadius-collection",
    // Two instructions were received — "border-radius gets its own collection"
    // and "split scale three ways by mode axis" — which conflict if "its own"
    // means *alone*. The paradigm reads it as "out of the static collection".
    // Reversing it later costs nothing: `borderRadius` has 0 inbound aliases.
    applies: (input) => input.targetGroup === "borderRadius",
  },
  {
    reason: "expression-values",
    // A `VARIABLE_EXPRESSION` cannot be read through the API, so any rebuild
    // destroys it permanently and leaves no trace. Free-tier renames do not
    // touch values and are safe; the lock exists so Stage 4 cannot pick them up.
    applies: (input) => input.hasUnreadableExpression,
  },
];

/** Every lock reason that applies to a row, in policy order, deduplicated. */
export function lockReasonsFor(input: LockInput): LockReason[] {
  const reasons: LockReason[] = [];
  for (const rule of LOCK_POLICY) {
    if (rule.applies(input) && !reasons.includes(rule.reason))
      reasons.push(rule.reason);
  }
  return reasons;
}
