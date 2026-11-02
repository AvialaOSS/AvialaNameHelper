/**
 * The paradigm engine: NAMING.md as executable data.
 *
 * Pure — no `figma`, no DOM, no Node. That is enforced twice over, not by
 * convention: `tsconfig.main.json` includes this directory and its `lib` has no
 * DOM, so a stray `window` is a *type* error; and `eslint.config.mjs` restricts
 * the same globals for `src/paradigm/**`, including `figma`, which `src/main`
 * deliberately allows.
 *
 * The golden fixture in `__fixtures__/` is not re-exported. Tests import it
 * directly, so nothing that reaches a bundle depends on 142 KB of literal data.
 */

export * from "./flags";
export * from "./layout";
export * from "./names";
export * from "./ops";
export * from "./plan";
export * from "./rules";
export * from "./snapshot";
export * from "./target";
