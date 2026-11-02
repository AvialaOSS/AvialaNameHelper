import { useEffect, useState } from "react";
import { Button, Feedback, Stack } from "@aviala-design/spiral";
import { GeneralRefresh } from "@aviala-design/icons";
import {
  composeName,
  getCategory,
  getProperty,
  GRAMMAR,
  type CategoryKind,
  type CategorySpec,
  type NameParts,
} from "../../../grammar";
import { COLOR_FAMILIES, NEUTRAL_FAMILY } from "../../../grammar/vocabulary";
import type { VariableResolvedType } from "../../../protocol/messages";
import type { FigmaBridge } from "../../bridge";
import { copyText } from "../../lib/clipboard";
import { NamePreview, type SegmentSlot } from "./NamePreview";
import {
  SegmentPicker,
  type PickerGroup,
  type PickerOption,
} from "./SegmentPicker";

const CATEGORY_OPTIONS: PickerOption[] = GRAMMAR.map((category) => ({
  value: category.slug,
  label: category.label,
}));

const TYPE_OPTIONS: PickerOption[] = [
  { value: "COLOR", label: "Color" },
  { value: "FLOAT", label: "Number" },
  { value: "STRING", label: "String" },
  { value: "BOOLEAN", label: "Boolean" },
];

const FAMILY_SLUGS = new Set<string>([...COLOR_FAMILIES, NEUTRAL_FAMILY]);

function option(slug: string, label: string): PickerOption {
  return { value: slug, label };
}

/** Map a grammar category to the Figma variable type it most likely holds. */
function inferType(kind: CategoryKind | undefined): VariableResolvedType {
  if (kind === "color") return "COLOR";
  if (kind === "enum") return "STRING";
  return "FLOAT";
}

/** Color properties split into hue families vs semantic slots; others stay flat. */
function propertyChoices(category: CategorySpec | undefined): {
  options?: PickerOption[];
  groups?: PickerGroup[];
} {
  if (!category) return {};
  if (category.slug !== "color") {
    return { options: category.properties.map((p) => option(p.slug, p.label)) };
  }
  const families = category.properties
    .filter((p) => FAMILY_SLUGS.has(p.slug))
    .map((p) => option(p.slug, p.label));
  const semantic = category.properties
    .filter((p) => !FAMILY_SLUGS.has(p.slug))
    .map((p) => option(p.slug, p.label));
  const groups: PickerGroup[] = [];
  if (families.length) groups.push({ label: "色族", options: families });
  if (semantic.length) groups.push({ label: "语义槽", options: semantic });
  return { groups };
}

export function BuilderPanel({ bridge }: { bridge: FigmaBridge }) {
  const {
    state,
    requestCollections,
    createVariable,
    clearCreated,
    clearError,
  } = bridge;
  const [parts, setParts] = useState<NameParts>({
    category: "",
    property: "",
    variant: "",
    state: "",
  });
  const [collectionId, setCollectionId] = useState("");
  const [resolvedType, setResolvedType] =
    useState<VariableResolvedType>("COLOR");
  const [copied, setCopied] = useState(false);

  const { collections, creating, lastCreated, error } = state;

  // Refresh the destination list whenever the Builder is (re)mounted, so a
  // collection created in Figma after opening the plugin shows up.
  useEffect(() => {
    requestCollections();
  }, [requestCollections]);

  // Default the destination to the first collection until the user picks one,
  // and re-point if the chosen collection disappears after a refresh.
  useEffect(() => {
    if (collections.length === 0) return;
    setCollectionId((prev) =>
      collections.some((collection) => collection.id === prev)
        ? prev
        : collections[0].id
    );
  }, [collections]);

  const category = getCategory(parts.category);
  const spec = getProperty(parts.category, parts.property);
  const choices = propertyChoices(category);
  const variantOptions = spec ? spec.variants.map((v) => option(v, v)) : [];
  const stateOptions = spec ? spec.states.map((s) => option(s, s)) : [];

  const collectionOptions: PickerOption[] = collections.map((collection) =>
    option(
      collection.id,
      collection.modeNames.length > 1
        ? `${collection.name} · ${collection.modeNames.length} 个 mode`
        : collection.name
    )
  );

  const name = composeName(parts);
  const complete = Boolean(parts.category && parts.property);
  const hasCollection = collections.some(
    (collection) => collection.id === collectionId
  );
  const canCreate = complete && hasCollection && !creating;

  const selectCategory = (value: string) => {
    setParts({ category: value, property: "", variant: "", state: "" });
    setResolvedType(inferType(getCategory(value)?.kind));
  };
  const selectProperty = (value: string) =>
    setParts((prev) => ({ ...prev, property: value, variant: "", state: "" }));
  const selectVariant = (value: string) =>
    setParts((prev) => ({ ...prev, variant: value }));
  const selectState = (value: string) =>
    setParts((prev) => ({ ...prev, state: value }));
  const selectType = (value: string) =>
    setResolvedType(value as VariableResolvedType);

  const clearSegment = (slot: SegmentSlot) =>
    setParts((prev) => {
      if (slot === "category")
        return { category: "", property: "", variant: "", state: "" };
      if (slot === "property")
        return { ...prev, property: "", variant: "", state: "" };
      if (slot === "variant") return { ...prev, variant: "" };
      return { ...prev, state: "" };
    });

  const handleCopy = async () => {
    const ok = await copyText(name);
    if (!ok) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  const handleCreate = () => {
    if (!canCreate) return;
    createVariable(name, collectionId, resolvedType);
  };

  return (
    <Stack gap="component" className="h-full overflow-auto p-4">
      <Stack gap="component">
        <SegmentPicker
          id="seg-category"
          label="Category"
          value={parts.category}
          onChange={selectCategory}
          options={CATEGORY_OPTIONS}
          placeholder="选择一个 category"
        />
        <SegmentPicker
          id="seg-property"
          label="Property"
          value={parts.property}
          onChange={selectProperty}
          options={choices.options}
          groups={choices.groups}
          disabled={!category}
          placeholder={category ? "选择一个 property" : "请先选 category"}
        />
        <SegmentPicker
          id="seg-variant"
          label="Variant"
          value={parts.variant ?? ""}
          onChange={selectVariant}
          options={variantOptions}
          disabled={!spec || variantOptions.length === 0}
          allowEmpty
          placeholder="—"
          hint={
            spec && spec.variants.length === 0
              ? "这个 property 没有 variant。"
              : undefined
          }
        />
        <SegmentPicker
          id="seg-state"
          label="State"
          value={parts.state ?? ""}
          onChange={selectState}
          options={stateOptions}
          disabled={!spec || stateOptions.length === 0}
          allowEmpty
          placeholder="—"
          hint={
            spec && spec.states.length === 0
              ? "这个 property 没有 state。"
              : undefined
          }
        />
      </Stack>

      <Stack gap="component">
        <SegmentPicker
          id="dest-collection"
          label="Collection"
          value={collectionId}
          onChange={setCollectionId}
          options={collectionOptions}
          disabled={collections.length === 0}
          placeholder={
            collections.length ? "选择一个 collection" : "本地没有 collection"
          }
          hint={
            collections.length === 0
              ? "请先在 Figma 的 Variables 面板里建一个 variable collection，再点刷新。"
              : undefined
          }
        />
        <SegmentPicker
          id="dest-type"
          label="Type"
          value={resolvedType}
          onChange={selectType}
          options={TYPE_OPTIONS}
        />
        <Button
          mode="second"
          size="tiny"
          leftIcon={<GeneralRefresh aria-hidden />}
          onClick={requestCollections}
        >
          刷新 collection 列表
        </Button>
      </Stack>

      <NamePreview
        name={name}
        complete={complete}
        parts={parts}
        onClearSegment={clearSegment}
        canCreate={canCreate}
        creating={creating}
        copied={copied}
        onCopy={handleCopy}
        onCreate={handleCreate}
      />

      {error ? (
        <Feedback
          type="wrong"
          size="default"
          showClose
          onClose={clearError}
          title="创建变量失败"
          description={error}
        />
      ) : lastCreated ? (
        <Feedback
          type="success"
          size="default"
          showClose
          onClose={clearCreated}
          title="变量已创建"
          description={`${lastCreated.name} · ${lastCreated.collectionName}`}
        />
      ) : null}
    </Stack>
  );
}
