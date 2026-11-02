import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Feedback,
  List,
  ListGroup,
  ListItem,
  Loading,
  Scroll,
  Stack,
  Typography,
} from "@aviala-design/spiral";
import { GeneralRename } from "@aviala-design/icons";
import { suggestFix, validateName } from "../../../grammar";
import type { RenameRequest, ScanScope } from "../../../protocol/messages";
import type { FigmaBridge } from "../../bridge";
import { useRowSelection } from "../../hooks/useRowSelection";
import { canRenameRow, ResultsTable, type ResultRow } from "./ResultsTable";
import { ScopePicker } from "./ScopePicker";

function EmptyState({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <List>
      <ListGroup>
        <ListItem
          title={title}
          subtitle={subtitle}
          leading="none"
          showTrailing={false}
        />
      </ListGroup>
    </List>
  );
}

export function ValidatorPanel({ bridge }: { bridge: FigmaBridge }) {
  const {
    state,
    requestScan,
    renameOne,
    applyRenames,
    clearApply,
    clearError,
  } = bridge;
  const [scope, setScope] = useState<ScanScope>("local");

  useEffect(() => {
    requestScan(scope);
  }, [requestScan, scope]);

  const rows = useMemo<ResultRow[]>(
    () =>
      (state.scan?.variables ?? []).map((variable) => ({
        variable,
        result: validateName(variable.name),
        suggest: suggestFix(variable.name),
      })),
    [state.scan]
  );

  const renamableIds = useMemo(
    () => rows.filter(canRenameRow).map((row) => row.variable.id),
    [rows]
  );
  const { selectedIds, toggleRow, toggleAll } = useRowSelection(
    renamableIds,
    state.scan
  );

  const renamable = rows.filter(canRenameRow);
  const selectedRenamable = renamable.filter((row) =>
    selectedIds.has(row.variable.id)
  );
  const remoteCount = rows.filter((row) => row.variable.isRemote).length;
  const validCount = rows.filter(
    (row) => !row.variable.isRemote && row.result.valid
  ).length;

  const renameRow = (row: ResultRow) => {
    if (row.suggest.suggested)
      renameOne(row.variable.id, row.suggest.suggested);
  };

  const batchRename = () => {
    const renames: RenameRequest[] = [];
    for (const row of selectedRenamable) {
      if (row.suggest.suggested) {
        renames.push({
          variableId: row.variable.id,
          newName: row.suggest.suggested,
        });
      }
    }
    if (renames.length > 0) applyRenames(renames);
  };

  const apply = state.lastApply;
  const feedbackType = apply
    ? apply.failed.length === 0
      ? "success"
      : apply.renamed.length === 0
        ? "wrong"
        : "warning"
    : "normal";

  const hasResults = Boolean(state.scan) && rows.length > 0;

  return (
    <Stack gap="component" className="h-full overflow-hidden p-4">
      <ScopePicker
        scope={scope}
        onChange={setScope}
        onScan={() => requestScan(scope)}
        scanning={state.scanning}
        boundCount={state.selection.boundVariableCount}
        hasSelection={state.selection.hasSelection}
      />

      {state.error ? (
        <Alert
          type="error"
          size="small"
          title="扫描失败"
          description={state.error}
          dismissible
          onDismiss={clearError}
        />
      ) : null}

      {hasResults ? (
        <>
          <Typography
            level="caption"
            className="text-[var(--muted-foreground)]"
          >
            {`已扫描 ${rows.length} 个 · 合规 ${validCount} 个 · 可修 ${
              renamable.length
            } 个${remoteCount ? ` · 远端 ${remoteCount} 个` : ""}`}
          </Typography>
          {selectedRenamable.length > 0 ? (
            <Stack
              direction="row"
              gap="inside"
              className="items-center justify-between"
            >
              <Typography level="caption">{`已选 ${selectedRenamable.length} 个`}</Typography>
              <Button
                size="small"
                mode="primary"
                leftIcon={<GeneralRename aria-hidden />}
                loading={state.applying}
                onClick={batchRename}
              >
                重命名所选
              </Button>
            </Stack>
          ) : null}
        </>
      ) : null}

      {!state.scan ? (
        state.scanning ? (
          <Stack direction="row" gap="inside" className="items-center">
            <Loading level="text" label="扫描中" />
            <Typography level="caption">正在扫描变量…</Typography>
          </Stack>
        ) : (
          <EmptyState
            title="还没扫描"
            subtitle="选一个范围，然后跑一次扫描。"
          />
        )
      ) : rows.length === 0 ? (
        <EmptyState
          title="没有可校验的变量"
          subtitle={
            scope === "bound"
              ? "当前选中的节点上没有绑定任何本地变量。"
              : "这个文件里没有本地变量。"
          }
        />
      ) : (
        <Scroll orientation="vertical" className="min-h-0 flex-1">
          <ResultsTable
            rows={rows}
            selectedIds={selectedIds}
            onToggleRow={toggleRow}
            onToggleAll={toggleAll}
            onRenameRow={renameRow}
            applying={state.applying}
          />
        </Scroll>
      )}

      {apply ? (
        <Feedback
          type={feedbackType}
          size="small"
          showClose
          onClose={clearApply}
          title={`已重命名 ${apply.renamed.length} 个${
            apply.failed.length ? `，失败 ${apply.failed.length} 个` : ""
          }`}
          description={
            apply.failed.length
              ? apply.failed
                  .map((failure) => `${failure.oldName}: ${failure.error}`)
                  .join(" · ")
              : undefined
          }
        />
      ) : null}
    </Stack>
  );
}
