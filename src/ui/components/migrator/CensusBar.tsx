import { Badge, Progress, Stack, Typography } from "@aviala-design/spiral";
import type {
  CensusProgress,
  UsageCensusResult,
} from "../../../protocol/messages";

type CensusBarProps = {
  progress: CensusProgress | null;
  census: UsageCensusResult | null;
};

function seconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

/**
 * The census walk's progress, and its totals once it lands.
 *
 * A document-wide walk has no upper bound on runtime, so the bar exists to make
 * a slow crawl distinguishable from a hang. The totals stay on screen afterwards
 * rather than being replaced by the table, because "1284 nodes in 4.2s" is what
 * tells the user the counts below came from a complete walk.
 */
export function CensusBar({ progress, census }: CensusBarProps) {
  if (progress) {
    const percent =
      progress.pagesTotal > 0
        ? Math.round((progress.pagesDone / progress.pagesTotal) * 100)
        : 0;
    return (
      <Stack gap="inside" className="w-full">
        <Progress value={percent} label={progress.pageName} />
        <Typography level="caption" className="text-[var(--muted-foreground)]">
          {`第 ${progress.pagesDone + 1}／${progress.pagesTotal} 页 · 已扫 ${
            progress.nodesScanned
          } 个节点 · ${seconds(progress.elapsedMs)}`}
        </Typography>
      </Stack>
    );
  }

  if (!census) {
    return (
      <Typography level="caption" className="text-[var(--muted-foreground)]">
        还没测量用量。普查跑完之前，下面的计数只含别名这一项。
      </Typography>
    );
  }

  const gaps = census.gaps.length + census.gapsOmitted;

  return (
    <Stack gap="inside" className="w-full">
      <Stack direction="row" gap="inside" className="w-full items-center">
        <Typography level="caption" className="text-[var(--muted-foreground)]">
          {`${census.pagesScanned} 页 · ${census.nodesScanned} 个节点 · ${seconds(
            census.durationMs
          )}`}
        </Typography>
        {gaps > 0 ? (
          <Badge style="warning" level="caption">
            {`${gaps} 处读不出来`}
          </Badge>
        ) : (
          <Badge style="success" level="caption">
            完整
          </Badge>
        )}
      </Stack>
      {gaps > 0 ? (
        <Typography level="caption" className="text-[var(--muted-foreground)]">
          有些承载体读不出来，所以计数只是下限，它们本可能触及的那些行已被关闭。等文件静止后重跑一次。
        </Typography>
      ) : null}
    </Stack>
  );
}
