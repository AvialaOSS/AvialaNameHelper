import {
  Badge,
  Stack,
  Table,
  TableCell,
  TableHead,
  TableRow,
  Tag,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  Typography,
} from "@aviala-design/spiral";
import {
  ACTION_LABELS,
  ACTION_SHORT_LABELS,
  FLAG_LABELS,
  FLAG_SHORT_LABELS,
  LOCK_LABELS,
  LOCK_SHORT_LABELS,
  TIER_LABELS,
  TIER_SHORT_LABELS,
  type ActionKind,
  type PlanRow,
} from "../../../paradigm";
import type { PublishStatus } from "../../../protocol/messages";

type MigrationTableProps = {
  rows: readonly PlanRow[];
  /** Keyed by variable id; empty until a census completes. */
  publishStatus: Record<string, PublishStatus | null>;
};

const ACTION_STYLE: Readonly<
  Record<ActionKind, "info" | "fail" | "warning" | "success">
> = {
  rename: "info",
  delete: "fail",
  merge: "warning",
  unchanged: "success",
  flag: "fail",
};

const PUBLISH_LABELS: Readonly<Record<PublishStatus, string>> = {
  UNPUBLISHED: "未发布",
  CURRENT: "已同步",
  CHANGED: "有改动",
};

/**
 * Relative column widths, as grow factors against a zero basis.
 *
 * Proportional rather than fixed pixels so the drag grip stays useful: at any
 * window width the three columns keep the same share. Inline style rather than a
 * class because `.aviala-table-cell` already sets `flex: 1 1 0`, which is what
 * made all three columns equal thirds and every cell 94px wide at 400px.
 */
const COLUMN_WEIGHTS = {
  variable: 32,
  plan: 36,
  usage: 24,
} as const;

const COLUMN_STYLE = (weight: number) => ({ flexGrow: weight, flexBasis: 0 });

function Explained({
  text,
  detail,
  style,
}: {
  text: string;
  detail: string;
  style?: "info" | "fail" | "warning" | "success";
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {style ? (
          <Badge style={style} level="caption">
            {text}
          </Badge>
        ) : (
          <Tag level="caption">{text}</Tag>
        )}
      </TooltipTrigger>
      <TooltipContent side="top" level="caption">
        {detail}
      </TooltipContent>
    </Tooltip>
  );
}

function UsageCell({
  row,
  publishStatus,
}: {
  row: PlanRow;
  publishStatus: PublishStatus | null;
}) {
  const census = row.census;
  if (!census) {
    return (
      <Typography level="caption" className="text-[var(--muted-foreground)]">
        未测量
      </Typography>
    );
  }

  return (
    <Stack gap="inside" className="w-full">
      <Typography level="caption">
        {`${census.aliasInbound} 别名 · ${census.layerBindings} 图层 · ${census.styleBindings} 样式`}
      </Typography>
      <Typography level="caption" className="text-[var(--muted-foreground)]">
        {`${census.explicitModeAssignments} mode 钉定 · 远端未知`}
      </Typography>
      <Stack direction="row" gap="inside" className="flex-wrap">
        {census.known ? null : (
          <Explained
            text="下限"
            style="warning"
            detail="有些承载体读不出来，所以这些计数只是下限，不是总数。普查完整之前这一行是关闭的。"
          />
        )}
        {census.sitesTruncated ? (
          <Explained
            text="站点已截断"
            detail="绑定站点比下钻能携带的多。计数是精确的，被截断的只是列出来的那些站点。"
          />
        ) : null}
        {publishStatus ? (
          <Explained
            text={PUBLISH_LABELS[publishStatus]}
            detail={`getPublishStatusAsync() 返回 ${publishStatus}。本工具对它的解读是推断，不是已验证的 Figma 行为。`}
          />
        ) : null}
      </Stack>
    </Stack>
  );
}

/**
 * The plan, one row per variable.
 *
 * Read-only in this stage: there is no checkbox and no button, because nothing
 * in the sandbox can write yet. The row a user would select is still fully
 * described — action, tier, locks, flags, scopes, usage — so the table is the
 * thing to check the engine against before any of it is allowed to touch a file.
 *
 * The table is its own scroll container rather than being wrapped in a `Scroll`:
 * `.aviala-table` already scrolls, and nesting a second scroller around it means
 * `stickyHeader` would stick to a box as tall as its own content, i.e. nowhere.
 */
export function MigrationTable({ rows, publishStatus }: MigrationTableProps) {
  return (
    <Table stickyHeader className="min-h-0 flex-1">
      <TableRow header>
        <TableHead style={COLUMN_STYLE(COLUMN_WEIGHTS.variable)}>
          变量
        </TableHead>
        <TableHead style={COLUMN_STYLE(COLUMN_WEIGHTS.plan)}>计划</TableHead>
        <TableHead style={COLUMN_STYLE(COLUMN_WEIGHTS.usage)}>
          用量 · 本文件内精确
        </TableHead>
      </TableRow>
      {rows.map((row) => (
        <TableRow key={row.variableId}>
          <TableCell style={COLUMN_STYLE(COLUMN_WEIGHTS.variable)}>
            <Stack gap="inside" className="w-full">
              <span className="font-mono text-[13px] break-all">
                {row.source.name}
              </span>
              {row.target && row.target.name !== row.source.name ? (
                <span className="font-mono text-[12px] break-all text-[var(--muted-foreground)]">
                  {`→ ${row.target.name}`}
                </span>
              ) : null}
              <Typography
                level="caption"
                className="text-[var(--muted-foreground)]"
              >
                {row.target && row.target.collection !== row.source.collection
                  ? `${row.source.collection} → ${row.target.collection}`
                  : row.source.collection}
                {row.namespace ? ` · ${row.namespace}` : ""}
                {row.applicability === "upstream" ? " · 远端" : ""}
              </Typography>
            </Stack>
          </TableCell>
          <TableCell style={COLUMN_STYLE(COLUMN_WEIGHTS.plan)}>
            <Stack gap="inside" className="w-full">
              <Stack direction="row" gap="inside" className="flex-wrap">
                <Explained
                  text={ACTION_SHORT_LABELS[row.action]}
                  style={ACTION_STYLE[row.action]}
                  detail={ACTION_LABELS[row.action]}
                />
                <Explained
                  text={TIER_SHORT_LABELS[row.tier]}
                  detail={TIER_LABELS[row.tier]}
                />
                {row.viaMove ? (
                  <Explained
                    text="移动"
                    style="warning"
                    detail="达成目标意味着要在另一个 collection 里重建这个变量、再删掉旧的。Figma 没有移动操作，所以身份会丢失：入站别名会断，图层绑定会断，显式的 mode 钉定会消失。"
                  />
                ) : null}
                {row.scopes.changeNeeded ? (
                  <Explained
                    text="Scopes"
                    detail={`当前是 ${
                      row.scopes.current.join(", ") || "无"
                    }；范式要求 ${row.scopes.required?.join(", ") ?? "无"}。`}
                  />
                ) : null}
              </Stack>
              {row.locks.length > 0 || row.flags.length > 0 ? (
                <Stack direction="row" gap="inside" className="flex-wrap">
                  {row.locks.map((lock) => (
                    <Explained
                      key={lock}
                      text={LOCK_SHORT_LABELS[lock]}
                      detail={`${LOCK_LABELS[lock]}。会算出来也会显示，但默认不勾选——要纳入就得逐行单独解锁。`}
                    />
                  ))}
                  {row.flags.map((flag) => (
                    <Explained
                      key={flag}
                      text={FLAG_SHORT_LABELS[flag]}
                      style="fail"
                      detail={FLAG_LABELS[flag]}
                    />
                  ))}
                </Stack>
              ) : null}
              <Typography
                level="caption"
                className="text-[var(--muted-foreground)]"
              >
                {row.detail}
              </Typography>
            </Stack>
          </TableCell>
          <TableCell style={COLUMN_STYLE(COLUMN_WEIGHTS.usage)}>
            <UsageCell
              row={row}
              publishStatus={publishStatus[row.variableId] ?? null}
            />
          </TableCell>
        </TableRow>
      ))}
    </Table>
  );
}
