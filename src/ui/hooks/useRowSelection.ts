import { useEffect, useState } from "react";

export type RowSelectionState = {
  selectedIds: ReadonlySet<string>;
  toggleRow: (id: string) => void;
  /** Sweep every selectable row, or clear the set when all are already in it. */
  toggleAll: () => void;
};

/**
 * Checkbox selection over a table's selectable rows.
 *
 * `selectableIds` is the list `toggleAll` sweeps. Rows outside it are the
 * caller's responsibility to disable, because whether a row can be selected
 * depends on the row's own flags and tier, which this hook knows nothing about.
 *
 * `resetKey` clears the set whenever it changes. A selection must not outlive
 * the scan that produced it: ids are stable across a rename but not across a
 * restructure, and a set carried over from a previous scan would silently drop
 * members, so a batch the user watched grow to forty rows could write thirty.
 */
export function useRowSelection(
  selectableIds: readonly string[],
  resetKey: unknown
): RowSelectionState {
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(
    () => new Set()
  );

  useEffect(() => {
    setSelectedIds(new Set());
  }, [resetKey]);

  const toggleRow = (id: string): void =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = (): void =>
    setSelectedIds((prev) => {
      const allSelected =
        selectableIds.length > 0 && selectableIds.every((id) => prev.has(id));
      return allSelected ? new Set() : new Set(selectableIds);
    });

  return { selectedIds, toggleRow, toggleAll };
}
