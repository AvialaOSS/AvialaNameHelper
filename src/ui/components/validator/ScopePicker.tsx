import { Button, RadioGroup, RadioInput, Stack } from "@aviala-design/spiral";
import { GeneralRefresh } from "@aviala-design/icons";
import type { ScanScope } from "../../../protocol/messages";

type ScopePickerProps = {
  scope: ScanScope;
  onChange: (scope: ScanScope) => void;
  onScan: () => void;
  scanning: boolean;
  boundCount: number;
  hasSelection: boolean;
};

export function ScopePicker({
  scope,
  onChange,
  onScan,
  scanning,
  boundCount,
  hasSelection,
}: ScopePickerProps) {
  return (
    <Stack gap="component">
      <RadioGroup
        direction="vertical"
        value={scope}
        onValueChange={(next) => onChange(next as ScanScope)}
      >
        <RadioInput
          value="bound"
          title="Bound to selection"
          description={
            hasSelection
              ? `${boundCount} variable(s) on the selected node(s)`
              : "Select a node on the canvas first"
          }
          disabled={!hasSelection}
        />
        <RadioInput
          value="local"
          title="All local variables"
          description="Every variable defined in this file"
        />
      </RadioGroup>
      <Button
        mode="primary"
        size="regular"
        leftIcon={<GeneralRefresh aria-hidden />}
        loading={scanning}
        onClick={onScan}
      >
        Scan
      </Button>
    </Stack>
  );
}
