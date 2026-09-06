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
  "missing-prefix": "Missing --aviala- prefix",
  "empty-segment": "Empty segment",
  "unknown-category": "Unknown category",
  "unknown-property": "Unknown property",
  "unknown-variant": "Unknown variant",
  "unknown-state": "Unknown state",
  "case-violation": "Case violation",
  "group-separator": "Figma group separator",
  "unrecognized-tail": "Unrecognized tail",
  malformed: "Malformed",
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
      issues: [{ code: "malformed", message: "Name is empty." }],
    };
  }

  const trimmed = name.trim();

  if (trimmed.includes("/")) {
    issues.push({
      code: "group-separator",
      message:
        'Contains the Figma group separator "/"; canonical names are flat.',
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
        message: `Segment "${token}" must be lowercase.`,
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
        message: `Must start with "${NAME_PREFIX}".`,
      });
      break;
    case "empty":
      issues.push({
        code: "malformed",
        message: "Nothing follows the prefix.",
      });
      break;
    case "empty-segment":
      issues.push({
        code: "empty-segment",
        message:
          "Contains an empty segment (doubled, leading or trailing dash).",
      });
      break;
    case "unknown-category":
      issues.push({
        code: "unknown-category",
        message: rest
          ? `"${rest}" does not start with a known category.`
          : "Unknown category.",
      });
      break;
    case "unknown-property":
      issues.push({
        code: "unknown-property",
        message: `"${rest}" is not a property of "${parsed.parts.category}".`,
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
          message: `"${rest}" is not a valid variant here.`,
        });
      } else if (stateOpen && knownWord) {
        issues.push({
          code: "unknown-state",
          message: `"${rest}" is not a valid state here.`,
        });
      } else {
        issues.push({
          code: "unrecognized-tail",
          message: `Unrecognized trailing segment "${rest}".`,
        });
      }
      break;
    }
  }

  return { valid: false, issues };
}
