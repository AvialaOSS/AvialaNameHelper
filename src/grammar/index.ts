/**
 * Public surface of the naming grammar.
 *
 * `vocabulary.ts` is intentionally not re-exported here: it is the raw word
 * source consumed by `grammar.ts`, and re-exporting it would create ambiguous
 * star exports (e.g. CASE_WHITELIST). Consumers drive pickers and validation
 * through GRAMMAR and the pure functions below.
 */

export * from "./grammar";
export * from "./compose";
export * from "./parse";
export * from "./validate";
export * from "./suggest";
