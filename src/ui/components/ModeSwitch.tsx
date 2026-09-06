import { SegmentatorGroup, SegmentatorItem } from "@aviala-design/spiral";
import { GeneralSearch, SymbolAdd } from "@aviala-design/icons";

export type Mode = "builder" | "validator";

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
        Builder
      </SegmentatorItem>
      <SegmentatorItem
        value="validator"
        leftIcon={<GeneralSearch aria-hidden />}
      >
        Validator
      </SegmentatorItem>
    </SegmentatorGroup>
  );
}
