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
          title="绑定到当前选中"
          description={
            hasSelection
              ? `选中的节点上有 ${boundCount} 个变量`
              : "请先在画布上选中一个节点"
          }
          disabled={!hasSelection}
        />
        <RadioInput
          value="local"
          title="全部本地变量"
          description="这个文件里定义的每一个变量"
        />
      </RadioGroup>
      <Button
        mode="primary"
        size="regular"
        leftIcon={<GeneralRefresh aria-hidden />}
        loading={scanning}
        onClick={onScan}
      >
        扫描
      </Button>
    </Stack>
  );
}
