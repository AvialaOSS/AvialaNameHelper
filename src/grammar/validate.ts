import {
  ALL_SEGMENT_WORDS,
  CASE_WHITELIST,
  getProperty,
  NAME_PREFIX,
  type NameParts,
} from "./grammar";
import { parseName } from "./parse";

export type IssueCode =
  | "missing-prefix"
  | "empty-segment"
  | "unknown-category"
  | "unknown-property"
  | "unknown-variant"
  | "unknown-state"
  | "case-violation"
  | "group-separator"
  | "unrecognized-tail"
  | "malformed";

export type Issue = { code: IssueCode; message: string };

export type ValidationResult = {
  valid: boolean;
  parts?: NameParts;
  issues: Issue[];
};

/** Human-readable label for each issue code (used by the UI legend/tooltips). */
export const ISSUE_LABELS: Readonly<Record<IssueCode, string>> = {
  "missing-prefix": "缺少 --aviala- 前缀",
  "empty-segment": "存在空段",
  "unknown-category": "未知的 category",
  "unknown-property": "未知的 property",
  "unknown-variant": "未知的 variant",
  "unknown-state": "未知的 state",
  "case-violation": "大小写不合规",
  "group-separator": "含 Figma 分组分隔符",
  "unrecognized-tail": "无法识别的尾段",
  malformed: "格式错误",
};

/**
 * Validate a token name against the grammar. Returns every problem found (not
 * just the first) so the Validator table can show rich, specific feedback.
 */
export function validateName(name: string): ValidationResult {
  const issues: Issue[] = [];

  if (typeof name !== "string" || name.trim().length === 0) {
    return {
      valid: false,
      issues: [{ code: "malformed", message: "名字是空的。" }],
    };
  }

  const trimmed = name.trim();

  if (trimmed.includes("/")) {
    issues.push({
      code: "group-separator",
      message: "含有 Figma 的分组分隔符「/」；规范名字是扁平的。",
    });
  }

  const bodyForCase = trimmed.startsWith(NAME_PREFIX)
    ? trimmed.slice(NAME_PREFIX.length)
    : trimmed;
  for (const token of bodyForCase.split("-")) {
    if (token.length === 0) continue;
    if (/[A-Z]/.test(token) && !CASE_WHITELIST.has(token)) {
      issues.push({
        code: "case-violation",
        message: `片段「${token}」必须是小写。`,
      });
    }
  }

  const parsed = parseName(trimmed);
  if (parsed.ok) {
    return { valid: issues.length === 0, parts: parsed.parts, issues };
  }

  const rest = (parsed.rest ?? []).join("-");
  switch (parsed.reason) {
    case "missing-prefix":
      issues.push({
        code: "missing-prefix",
        message: `必须以「${NAME_PREFIX}」开头。`,
      });
      break;
    case "empty":
      issues.push({
        code: "malformed",
        message: "前缀后面什么也没有。",
      });
      break;
    case "empty-segment":
      issues.push({
        code: "empty-segment",
        message: "含有空段（连字符重复，或开头／结尾多了一个）。",
      });
      break;
    case "unknown-category":
      issues.push({
        code: "unknown-category",
        message: rest
          ? `「${rest}」不是以任何已知的 category 开头。`
          : "未知的 category。",
      });
      break;
    case "unknown-property":
      issues.push({
        code: "unknown-property",
        message: `「${rest}」不是「${parsed.parts.category}」的 property。`,
      });
      break;
    case "unrecognized-tail": {
      const spec = getProperty(parsed.parts.category, parsed.parts.property);
      const variantOpen =
        !!spec &&
        spec.variants.length > 0 &&
        parsed.parts.variant === undefined;
      const stateOpen =
        !!spec && spec.states.length > 0 && parsed.parts.state === undefined;
      const knownWord = (parsed.rest ?? []).some((token) =>
        ALL_SEGMENT_WORDS.has(token)
      );
      if (variantOpen && knownWord) {
        issues.push({
          code: "unknown-variant",
          message: `「${rest}」在这里不是合法的 variant。`,
        });
      } else if (stateOpen && knownWord) {
        issues.push({
          code: "unknown-state",
          message: `「${rest}」在这里不是合法的 state。`,
        });
      } else {
        issues.push({
          code: "unrecognized-tail",
          message: `无法识别的尾段「${rest}」。`,
        });
      }
      break;
    }
  }

  return { valid: false, issues };
}
