import { SegmentatorGroup, SegmentatorItem } from "@aviala-design/spiral";
import {
  GeneralSearch,
  GeneralTodoList,
  SymbolAdd,
} from "@aviala-design/icons";

export type Mode = "builder" | "validator" | "migrator";

type ModeSwitchProps = {
  value: Mode;
  onChange: (mode: Mode) => void;
};

export function ModeSwitch({ value, onChange }: ModeSwitchProps) {
  return (
    <SegmentatorGroup
      value={value}
      onValueChange={(next) => onChange(next as Mode)}
      mode="tiled"
      equalWidth
    >
      <SegmentatorItem value="builder" leftIcon={<SymbolAdd aria-hidden />}>
        新建变量
      </SegmentatorItem>
      <SegmentatorItem
        value="validator"
        leftIcon={<GeneralSearch aria-hidden />}
      >
        名字校验
      </SegmentatorItem>
      <SegmentatorItem
        value="migrator"
        leftIcon={<GeneralTodoList aria-hidden />}
      >
        范式迁移
      </SegmentatorItem>
    </SegmentatorGroup>
  );
}
