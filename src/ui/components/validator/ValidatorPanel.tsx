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
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(
    () => new Set()
  );

  useEffect(() => {
    requestScan(scope);
  }, [requestScan, scope]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [state.scan]);

  const rows = useMemo<ResultRow[]>(
    () =>
      (state.scan?.variables ?? []).map((variable) => ({
        variable,
        result: validateName(variable.name),
        suggest: suggestFix(variable.name),
      })),
    [state.scan]
  );

  const renamable = rows.filter(canRenameRow);
  const selectedRenamable = renamable.filter((row) =>
    selectedIds.has(row.variable.id)
  );
  const remoteCount = rows.filter((row) => row.variable.isRemote).length;
  const validCount = rows.filter(
    (row) => !row.variable.isRemote && row.result.valid
  ).length;

  const toggleRow = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelectedIds((prev) => {
      const allSelected =
        renamable.length > 0 &&
        renamable.every((row) => prev.has(row.variable.id));
      return allSelected
        ? new Set()
        : new Set(renamable.map((row) => row.variable.id));
    });

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
          title="Scan failed"
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
            {`${rows.length} scanned · ${validCount} valid · ${renamable.length} fixable${
              remoteCount ? ` · ${remoteCount} remote` : ""
            }`}
          </Typography>
          {selectedRenamable.length > 0 ? (
            <Stack
              direction="row"
              gap="inside"
              className="items-center justify-between"
            >
              <Typography level="caption">{`${selectedRenamable.length} selected`}</Typography>
              <Button
                size="small"
                mode="primary"
                leftIcon={<GeneralRename aria-hidden />}
                loading={state.applying}
                onClick={batchRename}
              >
                Rename selected
              </Button>
            </Stack>
          ) : null}
        </>
      ) : null}

      {!state.scan ? (
        state.scanning ? (
          <Stack direction="row" gap="inside" className="items-center">
            <Loading level="text" label="Scanning" />
            <Typography level="caption">Scanning variables…</Typography>
          </Stack>
        ) : (
          <EmptyState
            title="No scan yet"
            subtitle="Choose a scope and run a scan."
          />
        )
      ) : rows.length === 0 ? (
        <EmptyState
          title="Nothing to check"
          subtitle={
            scope === "bound"
              ? "No local variables are bound to the current selection."
              : "This file has no local variables."
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
          title={`${apply.renamed.length} renamed${
            apply.failed.length ? `, ${apply.failed.length} failed` : ""
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
