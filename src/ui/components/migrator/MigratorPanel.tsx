import { useEffect, useMemo } from "react";
import {
  Alert,
  Button,
  Loading,
  List,
  ListGroup,
  ListItem,
  Stack,
  Typography,
} from "@aviala-design/spiral";
import { GeneralRefresh, SymbolEye } from "@aviala-design/icons";
import { buildPlan, summarizePlan } from "../../../paradigm";
import type { FigmaBridge } from "../../bridge";
import { CensusBar } from "./CensusBar";
import { MigrationTable } from "./MigrationTable";

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

function Line({ children }: { children: string }) {
  return (
    <Typography level="caption" className="text-[var(--muted-foreground)]">
      {children}
    </Typography>
  );
}

/**
 * The plan, read-only.
 *
 * Everything here is computed in the iframe from a snapshot the sandbox read.
 * There is no checkbox and no apply button, because Stage 2 has no write message
 * in the protocol at all — the panel cannot do anything to the file even if the
 * user finds a row they disagree with, which is the point of shipping it first.
 */
export function MigratorPanel({ bridge }: { bridge: FigmaBridge }) {
  const {
    state,
    requestMigrationScan,
    requestUsageCensus,
    clearError,
    clearEpochMismatch,
  } = bridge;
  const { migration } = state;

  useEffect(() => {
    requestMigrationScan();
  }, [requestMigrationScan]);

  const plan = useMemo(() => {
    if (!migration.snapshot) return null;
    // The reducer drops a census when a newer snapshot arrives, but the census
    // also carries the epoch it was counted against, so check it rather than
    // trust the ordering: usage attributed to the wrong rows is worse than none.
    const census =
      migration.census && migration.census.epoch === migration.snapshot.epoch
        ? migration.census.byVariable
        : null;
    return buildPlan(migration.snapshot, census);
  }, [migration.snapshot, migration.census]);

  const summary = useMemo(
    () => (plan ? summarizePlan(plan.rows) : null),
    [plan]
  );

  const mismatch = migration.epochMismatch;

  return (
    <Stack gap="component" className="h-full overflow-hidden p-4">
      <Stack
        direction="row"
        gap="inside"
        className="items-center justify-between"
      >
        <Stack direction="row" gap="inside" className="items-center">
          <Button
            size="small"
            leftIcon={<GeneralRefresh aria-hidden />}
            loading={migration.scanning}
            onClick={requestMigrationScan}
          >
            重读文件
          </Button>
          <Button
            size="small"
            leftIcon={<SymbolEye aria-hidden />}
            disabled={!migration.snapshot}
            loading={migration.censusing}
            onClick={() => {
              if (migration.snapshot)
                requestUsageCensus(migration.snapshot.epoch);
            }}
          >
            测量用量
          </Button>
        </Stack>
        {plan ? (
          <Typography
            level="caption"
            className="text-[var(--muted-foreground)]"
          >
            {migration.snapshot?.fileName}
          </Typography>
        ) : null}
      </Stack>

      {state.error ? (
        <Alert
          type="error"
          size="small"
          title="读取失败"
          description={state.error}
          dismissible
          onDismiss={clearError}
        />
      ) : null}

      {mismatch ? (
        <Alert
          type="warning"
          size="small"
          title="文件已变动"
          description="这份计划算出来之后，变量发生了变化，所以普查被拒绝执行，计划已按当前文件重算。请再测一次用量。"
          dismissible
          onDismiss={clearEpochMismatch}
        />
      ) : null}

      <CensusBar progress={migration.progress} census={migration.census} />

      {summary && plan ? (
        <Stack gap="inside" className="w-full">
          <Line>{`共 ${summary.total} 行 · 本地 ${summary.local} · 远端 ${summary.upstream}`}</Line>
          <Line>{`重命名 ${summary.byAction.rename} · 删除 ${summary.byAction.delete} · 并入 ${summary.byAction.merge} · 已达标 ${summary.byAction.unchanged} · 待处理 ${summary.byAction.flag}`}</Line>
          <Line>{`semantic ${summary.renamesByNamespace.semantic} · scale ${summary.renamesByNamespace.scale} · palette ${summary.renamesByNamespace.palette} · component ${summary.renamesByNamespace.component} · effect ${summary.renamesByNamespace.effect}`}</Line>
          <Line>{`免费 ${summary.localByTier.free} · 有代价 ${summary.localByTier.priced} · 无法计价 ${summary.localByTier.unpriced}`}</Line>
          <Line>{`锁定的重命名 ${summary.lockedLocalRenames} 个 · Stage 3 可写 ${summary.stageThreeAppliable} 个`}</Line>
        </Stack>
      ) : null}

      {!plan ? (
        migration.scanning ? (
          <Stack direction="row" gap="inside" className="items-center">
            <Loading level="text" label="读取中" />
            <Typography level="caption">正在读取变量…</Typography>
          </Stack>
        ) : (
          <EmptyState
            title="还没有计划"
            subtitle="读一次文件，算出范式会改动什么。"
          />
        )
      ) : plan.rows.length === 0 ? (
        <EmptyState
          title="没什么可计划的"
          subtitle="这个文件里没有任何变量，本地和远端都没有。"
        />
      ) : (
        <MigrationTable
          rows={plan.rows}
          publishStatus={migration.census?.publishStatus ?? {}}
        />
      )}

      {plan ? (
        <Typography level="caption" className="text-[var(--muted-foreground)]">
          只读。这一阶段没有任何东西能写入文件。
        </Typography>
      ) : null}
    </Stack>
  );
}
