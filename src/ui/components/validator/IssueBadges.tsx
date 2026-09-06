import {
  Stack,
  Tag,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@aviala-design/spiral";
import { ISSUE_LABELS, type Issue } from "../../../grammar";

type IssueBadgesProps = {
  issues: readonly Issue[];
};

/** One tooltip-wrapped tag per validation issue; the tooltip carries the detail. */
export function IssueBadges({ issues }: IssueBadgesProps) {
  if (issues.length === 0) return null;
  return (
    <Stack direction="row" gap="inside" className="flex-wrap">
      {issues.map((issue, index) => (
        <Tooltip key={`${issue.code}-${index}`}>
          <TooltipTrigger asChild>
            <Tag level="caption">{ISSUE_LABELS[issue.code]}</Tag>
          </TooltipTrigger>
          <TooltipContent side="top" level="caption">
            {issue.message}
          </TooltipContent>
        </Tooltip>
      ))}
    </Stack>
  );
}
