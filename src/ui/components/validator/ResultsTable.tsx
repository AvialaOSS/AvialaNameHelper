import {
  Badge,
  Button,
  Stack,
  Table,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@aviala-design/spiral";
import { GeneralRename } from "@aviala-design/icons";
import type { SuggestResult, ValidationResult } from "../../../grammar";
import type { VariableInfo } from "../../../protocol/messages";
import { IssueBadges } from "./IssueBadges";

export type ResultRow = {
  variable: VariableInfo;
  result: ValidationResult;
  suggest: SuggestResult;
};

/** A row can be renamed only when it is local, has a fix, and the fix differs. */
export function canRenameRow(row: ResultRow): boolean {
  return (
    !row.variable.isRemote &&
    row.suggest.changed &&
    row.suggest.suggested !== null
  );
}

function statusOf(row: ResultRow): {
  label: string;
  style: "success" | "fail" | "normal";
} {
  if (row.variable.isRemote) return { label: "远端", style: "normal" };
  if (row.result.valid) return { label: "合规", style: "success" };
  return { label: "不合规", style: "fail" };
}

type ResultsTableProps = {
  rows: ResultRow[];
  selectedIds: ReadonlySet<string>;
  onToggleRow: (id: string) => void;
  onToggleAll: () => void;
  onRenameRow: (row: ResultRow) => void;
  applying: boolean;
};

export function ResultsTable({
  rows,
  selectedIds,
  onToggleRow,
  onToggleAll,
  onRenameRow,
  applying,
}: ResultsTableProps) {
  const renamable = rows.filter(canRenameRow);
  const selectedRenamable = renamable.filter((row) =>
    selectedIds.has(row.variable.id)
  );
  const allChecked =
    renamable.length > 0 && selectedRenamable.length === renamable.length;
  const headerChecked = allChecked
    ? true
    : selectedRenamable.length > 0
      ? "indeterminate"
      : false;

  return (
    <Table>
      <TableRow header>
        <TableHead
          content="checkbox"
          checkboxProps={{
            checked: headerChecked,
            onCheckedChange: onToggleAll,
            disabled: renamable.length === 0,
          }}
        />
        <TableHead>变量</TableHead>
        <TableHead>校验结果</TableHead>
      </TableRow>
      {rows.map((row) => {
        const status = statusOf(row);
        const renamableRow = canRenameRow(row);
        return (
          <TableRow key={row.variable.id}>
            <TableCell
              content="checkbox"
              checkboxProps={{
                checked: selectedIds.has(row.variable.id),
                onCheckedChange: () => onToggleRow(row.variable.id),
                disabled: !renamableRow,
              }}
            />
            <TableCell>
              <Stack gap="inside" className="w-full">
                <Stack
                  direction="row"
                  gap="inside"
                  className="w-full items-center justify-between"
                >
                  <span className="font-mono text-[13px] break-all">
                    {row.variable.name}
                  </span>
                  <Badge style={status.style} level="caption">
                    {status.label}
                  </Badge>
                </Stack>
                <Typography
                  level="caption"
                  className="text-[var(--muted-foreground)]"
                >
                  {row.variable.collectionName} · {row.variable.resolvedType}
                </Typography>
              </Stack>
            </TableCell>
            <TableCell>
              {row.result.valid ? (
                <Typography
                  level="caption"
                  className="text-[var(--muted-foreground)]"
                >
                  符合命名语法。
                </Typography>
              ) : (
                <Stack gap="inside" className="w-full">
                  <IssueBadges issues={row.result.issues} />
                  {row.suggest.suggested ? (
                    <Stack
                      direction="row"
                      gap="inside"
                      className="w-full items-center justify-between"
                    >
                      <span className="font-mono text-[12px] break-all">
                        {row.suggest.suggested}
                      </span>
                      <Button
                        size="tiny"
                        mode="primary"
                        leftIcon={<GeneralRename aria-hidden />}
                        loading={applying}
                        disabled={!renamableRow}
                        onClick={() => onRenameRow(row)}
                      >
                        重命名
                      </Button>
                    </Stack>
                  ) : (
                    <Typography
                      level="caption"
                      className="text-[var(--muted-foreground)]"
                    >
                      没有可用的自动修法。
                    </Typography>
                  )}
                </Stack>
              )}
            </TableCell>
          </TableRow>
        );
      })}
    </Table>
  );
}
