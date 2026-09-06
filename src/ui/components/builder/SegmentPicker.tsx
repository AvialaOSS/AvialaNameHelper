import {
  Label,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
  Stack,
  Typography,
} from "@aviala-design/spiral";

/**
 * Radix forbids an empty-string item value, so optional slots (variant / state)
 * use this sentinel to represent "no value" while still showing a real label.
 */
const EMPTY = "__empty__";

export type PickerOption = { value: string; label: string };
export type PickerGroup = { label: string; options: PickerOption[] };

type SegmentPickerProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options?: PickerOption[];
  groups?: PickerGroup[];
  placeholder?: string;
  disabled?: boolean;
  /** When true, an extra "none" item lets the user clear an optional slot. */
  allowEmpty?: boolean;
  hint?: string;
};

export function SegmentPicker({
  id,
  label,
  value,
  onChange,
  options,
  groups,
  placeholder = "Select…",
  disabled = false,
  allowEmpty = false,
  hint,
}: SegmentPickerProps) {
  const rootValue = allowEmpty && value === "" ? EMPTY : value;
  const hasChoices = (groups?.length ?? 0) > 0 || (options?.length ?? 0) > 0;

  return (
    <Stack gap="inside">
      <Label htmlFor={id}>{label}</Label>
      <Select
        value={rootValue}
        onValueChange={(next) => onChange(next === EMPTY ? "" : next)}
        disabled={disabled || !hasChoices}
      >
        <SelectTrigger id={id} size="regular" placeholder={placeholder}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {allowEmpty ? <SelectItem value={EMPTY}>— none —</SelectItem> : null}
          {groups
            ? groups.map((group) => (
                <SelectGroup key={group.label}>
                  <SelectLabel>{group.label}</SelectLabel>
                  {group.options.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))
            : options?.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
        </SelectContent>
      </Select>
      {hint ? (
        <Typography level="caption" className="text-[var(--muted-foreground)]">
          {hint}
        </Typography>
      ) : null}
    </Stack>
  );
}
