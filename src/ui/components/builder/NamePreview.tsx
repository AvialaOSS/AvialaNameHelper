import {
  Alert,
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Stack,
  Tag,
  Typography,
} from "@aviala-design/spiral";
import { EditCopy, SymbolRightCircle } from "@aviala-design/icons";
import type { NameParts } from "../../../grammar";
import type { VariableInfo } from "../../../protocol/messages";

export type SegmentSlot = "category" | "property" | "variant" | "state";

const SLOTS: readonly SegmentSlot[] = [
  "category",
  "property",
  "variant",
  "state",
];

type NamePreviewProps = {
  name: string;
  complete: boolean;
  parts: NameParts;
  onClearSegment: (slot: SegmentSlot) => void;
  /** Bound local variables the composed name can be applied to. */
  targets: VariableInfo[];
  targetId: string;
  onTargetChange: (id: string) => void;
  hasRemote: boolean;
  applying: boolean;
  copied: boolean;
  onCopy: () => void;
  onApply: () => void;
};

export function NamePreview({
  name,
  complete,
  parts,
  onClearSegment,
  targets,
  targetId,
  onTargetChange,
  hasRemote,
  applying,
  copied,
  onCopy,
  onApply,
}: NamePreviewProps) {
  const activeSlots = SLOTS.filter((slot) => parts[slot]);

  return (
    <Stack gap="component">
      <div className="rounded-lg border bg-[var(--card)] px-3 py-2">
        <Typography level="subtitle" as="div" className="font-mono break-all">
          {name || "—"}
        </Typography>
      </div>

      {activeSlots.length > 0 ? (
        <Stack direction="row" gap="inside" className="flex-wrap">
          {activeSlots.map((slot) => (
            <Tag
              key={slot}
              level="caption"
              closable
              closeLabel={`Clear ${slot}`}
              onClose={() => onClearSegment(slot)}
            >
              {parts[slot]}
            </Tag>
          ))}
        </Stack>
      ) : null}

      {hasRemote ? (
        <Alert
          type="warning"
          size="small"
          title="Read-only variables"
          description="Remote variables in the selection cannot be renamed."
        />
      ) : null}

      {targets.length > 0 ? (
        <Stack gap="inside">
          <Typography
            level="caption"
            className="text-[var(--muted-foreground)]"
          >
            Apply to a bound variable
          </Typography>
          <Stack direction="row" gap="inside" className="items-center">
            <Select
              value={targetId}
              onValueChange={onTargetChange}
              disabled={applying}
            >
              <SelectTrigger size="regular" className="flex-1">
                <SelectValue placeholder="Choose a variable" />
              </SelectTrigger>
              <SelectContent>
                {targets.map((target) => (
                  <SelectItem key={target.id} value={target.id}>
                    {target.name} · {target.collectionName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              mode="primary"
              size="regular"
              leftIcon={<SymbolRightCircle aria-hidden />}
              loading={applying}
              disabled={!complete || !targetId}
              onClick={onApply}
            >
              Apply
            </Button>
          </Stack>
        </Stack>
      ) : (
        <Stack gap="inside">
          <Button
            mode="primary"
            size="regular"
            leftIcon={<SymbolRightCircle aria-hidden />}
            disabled
          >
            Apply to selection
          </Button>
          <Typography
            level="caption"
            className="text-[var(--muted-foreground)]"
          >
            Select a node with bound local variables to apply the composed name.
          </Typography>
        </Stack>
      )}

      <Button
        mode="second"
        size="regular"
        leftIcon={<EditCopy aria-hidden />}
        disabled={!complete}
        onClick={onCopy}
      >
        {copied ? "Copied" : "Copy name"}
      </Button>
    </Stack>
  );
}
