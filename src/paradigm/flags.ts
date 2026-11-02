/**
 * The vocabulary of plan annotations: what a row *does*, what it *costs*, why
 * it is *locked*, and what is *wrong* with the evidence behind it.
 *
 * Mirrors the `ISSUE_LABELS` pattern in `src/grammar/validate.ts`: a closed
 * union plus an exhaustive label record, so adding a code without a label is a
 * type error rather than a blank chip in the UI.
 */

/**
 * What the executor would do to this variable.
 *
 * There is no `"move"` member on purpose. Figma has no move operation — a move
 * is a recreate followed by a remove — so "move" describes *how*, not *what*.
 * The what is still `rename` (the variable ends up with a different name); the
 * how lives on `PlanRow.viaMove`. Keeping them separate is what lets the census
 * say "197 renames" while the cost model says "59 of them destroy identity".
 */
export type ActionKind = "rename" | "delete" | "merge" | "unchanged" | "flag";

export const ACTION_LABELS: Readonly<Record<ActionKind, string>> = {
  rename: "重命名",
  delete: "删除",
  merge: "并入另一个变量",
  unchanged: "已处于目标状态",
  flag: "需要人工处理，未算出动作",
};

/**
 * Chip text, as against `ACTION_LABELS`' tooltip prose.
 *
 * This used to be derived by capitalizing the enum value, which stopped working
 * the moment the labels became Chinese: there is no case to flip. Two maps that
 * can drift is the price of a compact chip, and the drift is contained because
 * both live here and both are exhaustive over the same union.
 */
export const ACTION_SHORT_LABELS: Readonly<Record<ActionKind, string>> = {
  rename: "重命名",
  delete: "删除",
  merge: "并入",
  unchanged: "已达标",
  flag: "待处理",
};

/**
 * Cost tier, by whether the operation preserves the variable's *identity*.
 * Aliases and layer bindings both resolve through identity, so anything that
 * preserves it is invisible to the rest of the document.
 *
 * - `free` — rename, regroup, rename collection, narrow scopes, add a mode.
 * - `priced` — change collection: recreate then remove. Three costs, only the
 *   inbound-alias one is countable; see NAMING.md's cost model.
 * - `unpriced` — delete or merge away. The target is unknown, so not even the
 *   rebuild is mechanical.
 */
export type Tier = "free" | "priced" | "unpriced";

export const TIER_LABELS: Readonly<Record<Tier, string>> = {
  free: "免费 — 身份保留",
  priced: "有代价 — 身份丢失，目标已知",
  unpriced: "无法计价 — 身份丢失，目标未知",
};

/** Chip text; see `ACTION_SHORT_LABELS` for why this is a second map. */
export const TIER_SHORT_LABELS: Readonly<Record<Tier, string>> = {
  free: "免费",
  priced: "有代价",
  unpriced: "无法计价",
};

/**
 * Why a row is locked: computed and displayed, but not selectable by default
 * and skipped by batch apply. Unlocking is per row, never bulk.
 *
 * Two of these gate *values* rather than *names* — `high-contrast-values` and
 * `expression-values` — so a row can carry one of them and still have a
 * perfectly determined rename.
 */
export type LockReason =
  /**
   * The camelCase group names are my inference from the file's own convention,
   * unconfirmed. Covers `lineHeight`, `borderRadius`, `borderThickness` only —
   * `Button` → `button` is stated outright in NAMING.md and is not an inference.
   */
  | "group-camelCase"
  /** The scale word pool convergence (8 deletions) needs re-confirmation. */
  | "scale-word-pool"
  /** The user deferred the Button layer: "先定范式，Button 层后续再修". */
  | "component-deferred"
  /** Drop it or rename it — undecided; it is the only `normal` variable that never re-points. */
  | "normal-background-theme"
  /** High Contrast values are unwritten; blocked on the opacity/transparency polarity. */
  | "high-contrast-values"
  /** `borderRadius` collection placement is an unresolved ambiguity between two instructions. */
  | "borderRadius-collection"
  /** Value is a `VARIABLE_EXPRESSION` the API cannot read; any rebuild destroys it. */
  | "expression-values";

export const LOCK_LABELS: Readonly<Record<LockReason, string>> = {
  "group-camelCase": "分组的 camelCase 命名是我从文件自身惯例推断的，未经确认",
  "scale-word-pool": "刻度词池的收敛结果需要再确认",
  "component-deferred": "Button 层按你的决定延后处理",
  "normal-background-theme": "删除还是重命名尚未决定",
  "high-contrast-values": "High Contrast 下的值还没写",
  "borderRadius-collection": "borderRadius 该放进哪个 collection 存在歧义",
  "expression-values": "值是一个 API 读不出来的表达式",
};

/** Chip text; see `ACTION_SHORT_LABELS` for why this is a second map. */
export const LOCK_SHORT_LABELS: Readonly<Record<LockReason, string>> = {
  "group-camelCase": "驼峰未确认",
  "scale-word-pool": "词池待确认",
  "component-deferred": "Button 延后",
  "normal-background-theme": "去留未定",
  "high-contrast-values": "对比值未写",
  "borderRadius-collection": "归属有歧义",
  "expression-values": "表达式不可读",
};

/**
 * What is wrong with the evidence or the target behind a row. Flags are
 * advisory except where a guard promotes one to a hard refusal — see
 * `HARD_REFUSAL_FLAGS`.
 */
export type FlagCode =
  /** Live leaf is not in the rule's source table and not in its target table. */
  | "unmapped-leaf"
  /** Live group has no rule at all inside a known collection. */
  | "unmapped-group"
  /** Variable sits in a collection no rule claims. */
  | "unexpected-collection"
  /** A rule's target collection does not exist and cannot be created here. */
  | "missing-collection"
  /** Remote variable: read-only in this file, must be fixed in the library. */
  | "remote-readonly"
  /** Name carries Figma's silent `" 2"` collision suffix. */
  | "collision-suffix"
  /** At least one mode's value could not be read. */
  | "unreadable-value"
  /** A deletion would discard a mode whose value differs from the default. */
  | "dropped-mode-differs"
  /** The target name is not derivable from evidence; a human must write it. */
  | "needs-authoring"
  /** Two rows would land on the same name inside the same target collection. */
  | "target-collision"
  /** The usage census could not read everything, so counts are a floor. */
  | "census-incomplete";

export const FLAG_LABELS: Readonly<Record<FlagCode, string>> = {
  "unmapped-leaf": "leaf 不在任何规则的来源表或目标表里",
  "unmapped-group": "已知 collection 内，这个 group 完全没有规则",
  "unexpected-collection": "没有任何规则认领这个 collection",
  "missing-collection": "目标 collection 不存在，也无法在这里创建",
  "remote-readonly": "远端变量：在本文件只读，必须到源 library 里修",
  "collision-suffix": '名字带着 Figma 静默添加的 " 2" 冲突后缀',
  "unreadable-value": "至少有一个 mode 的值读不出来",
  "dropped-mode-differs": "删除会丢掉一个与默认值不同的 mode",
  "needs-authoring": "目标名字无法从证据推出，必须由人来写",
  "target-collision": "两行会落到同一 collection 内的同一个名字",
  "census-incomplete": "用量普查没能读完，计数只是下限",
};

/** Chip text; see `ACTION_SHORT_LABELS` for why this is a second map. */
export const FLAG_SHORT_LABELS: Readonly<Record<FlagCode, string>> = {
  "unmapped-leaf": "leaf 无规则",
  "unmapped-group": "group 无规则",
  "unexpected-collection": "collection 无主",
  "missing-collection": "collection 缺失",
  "remote-readonly": "远端只读",
  "collision-suffix": "冲突后缀",
  "unreadable-value": "值不可读",
  "dropped-mode-differs": "mode 值会丢",
  "needs-authoring": "需人工命名",
  "target-collision": "目标名冲突",
  "census-incomplete": "普查不完整",
};

/**
 * Flags that turn a row into a hard refusal rather than a warning. An unreadable
 * value means a rebuild would permanently destroy data with no trace, and a
 * target collision means Figma would silently append `" 2"` — both are worse
 * than doing nothing.
 */
export const HARD_REFUSAL_FLAGS: readonly FlagCode[] = [
  "unreadable-value",
  "target-collision",
  "census-incomplete",
];

/** Whether a row is selectable at all, given its own annotations. */
export function isSelectable(
  action: ActionKind,
  applicability: "local" | "upstream",
  flags: readonly FlagCode[]
): boolean {
  if (applicability !== "local") return false;
  if (action === "flag" || action === "unchanged") return false;
  return !flags.some((flag) => HARD_REFUSAL_FLAGS.includes(flag));
}
