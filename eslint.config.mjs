import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

// Flat config for the whole repo, trimmed from spiral-2's. Type-aware linting is
// intentionally off so `lint` never needs a prior build.
export default tseslint.config(
  {
    ignores: ["**/node_modules/**", "**/dist/**", "**/coverage/**"],
  },

  js.configs.recommended,
  tseslint.configs.recommended,

  {
    plugins: { "react-hooks": reactHooks },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { ...globals.browser, ...globals.es2022 },
    },
  },

  // Classic hooks rules only (v7 `recommended` also enables React Compiler
  // checks that are out of scope for this gate).
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
    languageOptions: {
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },

  // TypeScript does its own undefined-symbol checking; no-undef only produces
  // false positives here (e.g. the `figma` sandbox global).
  {
    files: ["**/*.{ts,tsx}"],
    rules: { "no-undef": "off" },
  },

  // Figma sandbox: no DOM, no Node — only ES2022 plus the `figma` / `__html__`
  // globals. Restricting DOM globals here catches accidental `window` use that
  // would crash the sandbox at runtime.
  {
    files: ["src/main/**/*.ts"],
    languageOptions: {
      globals: {
        ...globals.es2022,
        figma: "readonly",
        __html__: "readonly",
        console: "readonly",
      },
    },
    rules: {
      "no-restricted-globals": [
        "error",
        "window",
        "document",
        "navigator",
        "fetch",
        "localStorage",
      ],
    },
  },

  // Config and build files run in Node.
  {
    files: ["**/*.{mjs,cjs}", "**/*.config.{js,ts,mjs}"],
    languageOptions: {
      globals: { ...globals.node, ...globals.es2022 },
    },
  },

  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },

  // Tests may reach for looser typing.
  {
    files: ["**/*.test.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
    },
  },

  // Must stay last: drops every rule Prettier owns.
  prettier
);
