import { Button, Stack, Tag, Typography } from "@aviala-design/spiral";
import { EditCopy, SymbolAdd } from "@aviala-design/icons";
import type { NameParts } from "../../../grammar";

export type SegmentSlot = "category" | "property" | "variant" | "state";

const SLOTS: readonly SegmentSlot[] = [
  "category",
  "property",
  "variant",
  "state",
];

type NamePreviewProps = {
  name: string;
  /** True once category + property are chosen, i.e. the name is usable. */
  complete: boolean;
  parts: NameParts;
  onClearSegment: (slot: SegmentSlot) => void;
  /** True when a name is composed AND a destination collection is chosen. */
  canCreate: boolean;
  creating: boolean;
  copied: boolean;
  onCopy: () => void;
  onCreate: () => void;
};

export function NamePreview({
  name,
  complete,
  parts,
  onClearSegment,
  canCreate,
  creating,
  copied,
  onCopy,
  onCreate,
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
              closeLabel={`清除 ${slot}`}
              onClose={() => onClearSegment(slot)}
            >
              {parts[slot]}
            </Tag>
          ))}
        </Stack>
      ) : null}

      <Button
        mode="primary"
        size="regular"
        leftIcon={<SymbolAdd aria-hidden />}
        loading={creating}
        disabled={!canCreate}
        onClick={onCreate}
      >
        创建变量
      </Button>

      <Button
        mode="second"
        size="regular"
        leftIcon={<EditCopy aria-hidden />}
        disabled={!complete}
        onClick={onCopy}
      >
        {copied ? "已复制" : "复制名字"}
      </Button>
    </Stack>
  );
}
