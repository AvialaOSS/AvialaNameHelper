/**
 * Generates `src/paradigm/__fixtures__/goldenDump.ts` from a real
 * AvialaVariableInspector export.
 *
 * Run: `node scripts/build-golden-fixture.mjs <path-to-dump.json>`
 *
 * Two reasons this exists rather than committing the JSON:
 *
 * 1. **Size.** The export is 340 KB, most of it stage-2 resolution detail
 *    (alias chains, terminal colours, hex strings) that the rule engine never
 *    reads. The projection is a fraction of that.
 * 2. **Type cost.** Both composite tsconfig projects include `src/paradigm`, so
 *    an unannotated literal would be inferred twice and emit multi-megabyte
 *    declaration files. The generated export is annotated `MigrationSnapshot`,
 *    which keeps the `.d.ts` down to the type name.
 *
 * The projection also normalizes value kinds into the engine's closed union.
 * The dump in hand predates the Inspector's `raw.ts` fix, so it reports the
 * twelve `VARIABLE_EXPRESSION` values as `{kind:"EASING", easingType:
 * "VARIABLE_EXPRESSION"}` — an easing tag with the function and arguments
 * discarded. A newer export reports them as `UNKNOWN`. Both map to `UNREADABLE`
 * here, and `src/main/readSnapshot.ts` must apply the same mapping when it reads
 * a live file, or the golden test will be validating a shape production never
 * produces. Stage 2's verification asserts the live plan equals the golden one,
 * which is what catches the two drifting apart.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(here, "../src/paradigm/__fixtures__/goldenDump.ts");

const input = process.argv[2];
if (!input) {
  console.error("usage: node scripts/build-golden-fixture.mjs <dump.json>");
  process.exit(1);
}

const dump = JSON.parse(readFileSync(input, "utf8"));

const UNREADABLE_EASING = "VARIABLE_EXPRESSION";

function projectValue(value) {
  if (value === null || value === undefined) return { kind: "UNSET" };
  switch (value.kind) {
    case "ALIAS":
      // Chain, terminal and status are resolution detail; the engine only needs
      // to know which variable this cell points at.
      return { kind: "ALIAS", targetId: value.targetId };
    case "COLOR":
      return { kind: "COLOR", r: value.r, g: value.g, b: value.b, a: value.a };
    case "FLOAT":
      return { kind: "FLOAT", value: value.value };
    case "NUMBER":
      return value.value === null
        ? { kind: "UNREADABLE", text: value.text ?? "non-finite number" }
        : { kind: "FLOAT", value: value.value };
    case "STRING":
      return { kind: "STRING", value: value.value };
    case "BOOLEAN":
      return { kind: "BOOLEAN", value: value.value };
    case "EASING":
      return value.easingType === UNREADABLE_EASING
        ? { kind: "UNREADABLE", text: UNREADABLE_EASING }
        : { kind: "EASING", easingType: value.easingType };
    default:
      return { kind: "UNREADABLE", text: value.text ?? `kind:${value.kind}` };
  }
}

function projectVariable(variable, collectionKeyById) {
  const values = variable.values.map((modeValue) => ({
    modeId: modeValue.modeId,
    modeName: modeValue.modeName,
    isDefault: modeValue.isDefault,
    value: projectValue(modeValue.value),
  }));
  return {
    id: variable.id,
    key: variable.key,
    name: variable.name,
    // The dump reports "" for an ungrouped variable; the engine's contract is
    // null, and the difference decides whether the target name grows a slash.
    group: variable.group === "" ? null : variable.group,
    leaf: variable.leaf,
    description: variable.description ?? "",
    resolvedType: variable.resolvedType,
    scopes: variable.scopes ?? [],
    collectionId: variable.collectionId,
    collectionName: variable.collectionName,
    // Unknown for external variables: their collection is not enumerable from a
    // consuming file, and no rule needs it because palette rows are never
    // applicable here.
    collectionKey: collectionKeyById.get(variable.collectionId) ?? "",
    isRemote: variable.remote === true,
    hiddenFromPublishing: variable.hiddenFromPublishing === true,
    values,
  };
}

const collectionKeyById = new Map(dump.collections.map((c) => [c.id, c.key]));

const collections = dump.collections.map((collection) => ({
  id: collection.id,
  key: collection.key,
  name: collection.name,
  isRemote: collection.remote === true,
  defaultModeId: collection.defaultModeId,
  modes: collection.modes.map((mode) => ({
    modeId: mode.modeId,
    name: mode.name,
    isDefault: mode.isDefault === true,
  })),
}));

const variables = dump.variables.map((v) =>
  projectVariable(v, collectionKeyById)
);
const externalVariables = dump.externalVariables.map((v) =>
  projectVariable(v, collectionKeyById)
);

// The dump's own `unreadableVariableIds` lists variables it could not fetch at
// all (empty here). The snapshot's field means something different and more
// consequential: variables holding a value the API cannot express, which a
// rebuild would destroy without a trace.
const unreadableVariableIds = [...variables, ...externalVariables]
  .filter((v) => v.values.some((mv) => mv.value.kind === "UNREADABLE"))
  .map((v) => v.id)
  .sort();

const json = (value) => JSON.stringify(value).replace(/</g, "\\u003c");

const header = `/**
 * GENERATED FILE — do not edit. Regenerate with:
 *   node scripts/build-golden-fixture.mjs <dump.json>
 *
 * Source: ${dump.generator?.plugin ?? "?"} ${dump.generator?.pluginVersion ?? "?"},
 * file "${dump.source?.fileName}" captured ${dump.source?.capturedAt}.
 * Dump schemaVersion ${dump.schemaVersion}.
 *
 * This is the golden evidence for the migration engine: a projection of a real
 * AvialaVariableInspector export of the Components file, reduced to what the
 * rule engine reads. \`golden.test.ts\` asserts the projection reproduces the
 * dump's own statistics before it asserts anything about the rules, so a
 * truncated or mis-projected fixture fails as itself rather than as a mysterious
 * rule mismatch.
 */

import type { MigrationSnapshot } from "../../protocol/migration";
import { computeEpoch } from "../snapshot";

/** The dump's self-reported statistics, verbatim. */
export const GOLDEN_STATS = ${json(dump.stats)} as const;

/** Provenance, verbatim. */
export const GOLDEN_SOURCE = ${json(dump.source)} as const;

/** The dump's own read diagnostics, verbatim. */
export const GOLDEN_DIAGNOSTICS = ${json(dump.diagnostics)} as const;

const PROJECTED: MigrationSnapshot = {
  // Filled in below: the epoch is derived from the projection, and duplicating
  // the hash function into a generator script would give two implementations
  // something to disagree about.
  epoch: "",
  capturedAt: ${json(dump.source?.capturedAt ?? "")},
  fileName: ${json(dump.source?.fileName ?? "")},
  collections: ${json(collections)},
  variables: ${json(variables)},
  externalVariables: ${json(externalVariables)},
  unreadableVariableIds: ${json(unreadableVariableIds)},
  unresolvedAliasTargetIds: ${json(dump.unresolvedAliasTargetIds ?? [])},
};

export const GOLDEN_SNAPSHOT: MigrationSnapshot = {
  ...PROJECTED,
  epoch: computeEpoch(PROJECTED),
};
`;

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, header, "utf8");

const bytes = Buffer.byteLength(header, "utf8");
console.log(`wrote ${OUT}`);
console.log(`  ${bytes.toLocaleString("en-US")} bytes`);
console.log(
  `  collections ${collections.length} · variables ${variables.length} · external ${externalVariables.length} · unreadable ${unreadableVariableIds.length}`
);
