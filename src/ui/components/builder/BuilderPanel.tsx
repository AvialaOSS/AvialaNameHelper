import { useEffect, useState } from "react";
import { Feedback, Stack, Typography } from "@aviala-design/spiral";
import {
  composeName,
  getCategory,
  getProperty,
  GRAMMAR,
  type CategorySpec,
  type NameParts,
} from "../../../grammar";
import { COLOR_FAMILIES, NEUTRAL_FAMILY } from "../../../grammar/vocabulary";
import type { VariableInfo } from "../../../protocol/messages";
import type { FigmaBridge } from "../../bridge";
import { copyText } from "../../lib/clipboard";
import { NamePreview, type SegmentSlot } from "./NamePreview";
import {
  SegmentPicker,
  type PickerGroup,
  type PickerOption,
} from "./SegmentPicker";

const EMPTY_VARS: VariableInfo[] = [];

const CATEGORY_OPTIONS: PickerOption[] = GRAMMAR.map((category) => ({
  value: category.slug,
  label: category.label,
}));

const FAMILY_SLUGS = new Set<string>([...COLOR_FAMILIES, NEUTRAL_FAMILY]);

function option(slug: string, label: string): PickerOption {
  return { value: slug, label };
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
  if (families.length) groups.push({ label: "Families", options: families });
  if (semantic.length) groups.push({ label: "Semantic", options: semantic });
  return { groups };
}

export function BuilderPanel({ bridge }: { bridge: FigmaBridge }) {
  const { state, requestScan, renameOne, clearApply } = bridge;
  const [parts, setParts] = useState<NameParts>({
    category: "",
    property: "",
    variant: "",
    state: "",
  });
  const [targetId, setTargetId] = useState("");
  const [copied, setCopied] = useState(false);

  const hasSelection = state.selection.hasSelection;
  const selectionSignature = state.selection.nodeIds.join(",");

  useEffect(() => {
    if (!hasSelection) return;
    requestScan("bound");
  }, [requestScan, selectionSignature, hasSelection]);

  const boundVariables =
    state.scan?.scope === "bound" ? state.scan.variables : EMPTY_VARS;
  const targets = boundVariables.filter((variable) => !variable.isRemote);
  const hasRemote = boundVariables.some((variable) => variable.isRemote);
  const effectiveTargetId = targets.some((t) => t.id === targetId)
    ? targetId
    : (targets[0]?.id ?? "");

  const category = getCategory(parts.category);
  const spec = getProperty(parts.category, parts.property);
  const choices = propertyChoices(category);
  const variantOptions = spec ? spec.variants.map((v) => option(v, v)) : [];
  const stateOptions = spec ? spec.states.map((s) => option(s, s)) : [];

  const name = composeName(parts);
  const complete = Boolean(parts.category && parts.property);

  const selectCategory = (value: string) =>
    setParts({ category: value, property: "", variant: "", state: "" });
  const selectProperty = (value: string) =>
    setParts((prev) => ({ ...prev, property: value, variant: "", state: "" }));
  const selectVariant = (value: string) =>
    setParts((prev) => ({ ...prev, variant: value }));
  const selectState = (value: string) =>
    setParts((prev) => ({ ...prev, state: value }));

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

  const handleApply = () => {
    if (!complete || !effectiveTargetId) return;
    renameOne(effectiveTargetId, name);
  };

  const apply = state.lastApply;
  const feedbackType = apply
    ? apply.failed.length === 0
      ? "success"
      : apply.renamed.length === 0
        ? "wrong"
        : "warning"
    : "normal";

  return (
    <Stack gap="component" className="h-full overflow-auto p-4">
      <Stack gap="component">
        <SegmentPicker
          id="seg-category"
          label="Category"
          value={parts.category}
          onChange={selectCategory}
          options={CATEGORY_OPTIONS}
          placeholder="Choose a category"
        />
        <SegmentPicker
          id="seg-property"
          label="Property"
          value={parts.property}
          onChange={selectProperty}
          options={choices.options}
          groups={choices.groups}
          disabled={!category}
          placeholder={category ? "Choose a property" : "Pick a category first"}
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
              ? "No variant for this property."
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
              ? "No state for this property."
              : undefined
          }
        />
      </Stack>

      <Typography level="caption" className="text-[var(--muted-foreground)]">
        {hasSelection
          ? `${boundVariables.length} variable(s) bound to the selection`
          : "No node selected on the canvas"}
      </Typography>

      <NamePreview
        name={name}
        complete={complete}
        parts={parts}
        onClearSegment={clearSegment}
        targets={targets}
        targetId={effectiveTargetId}
        onTargetChange={setTargetId}
        hasRemote={hasRemote}
        applying={state.applying}
        copied={copied}
        onCopy={handleCopy}
        onApply={handleApply}
      />

      {apply ? (
        <Feedback
          type={feedbackType}
          size="small"
          showClose
          onClose={clearApply}
          title={`${apply.renamed.length} renamed${
            apply.failed.length ? `, ${apply.failed.length} failed` : ""
          }`}
          description={
            apply.failed.length
              ? apply.failed
                  .map((failure) => `${failure.oldName}: ${failure.error}`)
                  .join(" · ")
              : undefined
          }
        />
      ) : null}
    </Stack>
  );
}
