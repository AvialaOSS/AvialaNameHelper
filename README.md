# AvialaNameHelper

A Figma plugin that helps designers name **Figma Variables (design tokens)** with a
single, predictable convention. It ships two modes — a **Builder** for composing new
names and a **Validator** for auditing and batch-renaming existing variables.

The naming convention promoted by this plugin is:

```
--aviala-{category}-{property}-{variant}-{state}
```

- `category` — the token domain, e.g. `color`, `interaction`, `size`, `gap`,
  `padding`, `line-height`, `font-size`, `font-weight`, `border-radius`,
  `transparency`, `shadow`, `typography`.
- `property` — what is being described within that category, e.g. `primary`,
  `neutral`, `lightbackground`, `filled`, `middle`.
- `variant` — an optional refinement, e.g. a color family step or a tone.
- `state` — an optional interaction state, e.g. `hover`, `active`, `disabled`,
  `checked`, `in-progress`.

Only `category` and `property` are always required; `variant` and `state` appear
only where the grammar allows them.

## What "selected variables" means

Figma does **not** expose which rows are highlighted inside the Variables editing
panel — `figma.currentPage.selection` returns **nodes**, not variables. So in this
plugin the "selection scope" is defined as:

> the local variables **bound to the currently selected nodes** (scanning both
> `node.boundVariables` and each paint's `paint.boundVariables`), plus whatever you
> tick in the plugin's own results list.

Remote (library) variables are surfaced read-only and are skipped on rename.

## Modes

### Builder

Four cascading pickers — category → property → variant → state — drive a live name
preview. Changing an earlier segment resets the later ones; variant/state pickers are
disabled and cleared when the grammar does not allow them. The preview supports copy
and "apply to selection" (renames the first bound local variable when a node with
bindings is selected).

### Validator

Pick a scope ("bound to selection" or "all local variables"), scan, and get a table
of name / status / suggested fix / actions. Every issue is reported with a specific
code (`missing-prefix`, `unknown-category`, `case-violation`, `group-separator`, …).
Suggested fixes normalize prefixes, separators, casing, synonyms and segment order,
and fall back to bounded edit-distance repair. Rename a single row inline or select
rows and batch-rename; results are summarized as "N succeeded, M failed".

## Development

Requires Node >= 20 and pnpm.

```bash
pnpm install
```

### Local plugin workflow

```bash
pnpm dev        # watch-builds dist/main.js and dist/ui.html
```

Then in **Figma desktop**: Plugins → Development → Import plugin from manifest… →
select this repo's `manifest.json`. Re-run the plugin after each rebuild; you only
need to re-import when `manifest.json` itself changes.

The UI is bundled into a single fully-inlined `dist/ui.html` (no remote requests),
and the sandbox is a self-contained `dist/main.js` IIFE with no DOM access.

### Scripts

| Script              | Description                                       |
| ------------------- | ------------------------------------------------- |
| `pnpm dev`          | Watch-build both the sandbox and the UI           |
| `pnpm build`        | Clean and produce `dist/main.js` + `dist/ui.html` |
| `pnpm typecheck`    | `tsc -b` across the main / ui / node sub-projects |
| `pnpm test`         | Run the grammar unit tests (vitest, node env)     |
| `pnpm lint`         | ESLint (flat config)                              |
| `pnpm format`       | Prettier write                                    |
| `pnpm format:check` | Prettier check                                    |
| `pnpm verify`       | lint + typecheck + test + build                   |

## Architecture

```
src/
├── grammar/     # pure, DOM-free naming logic: vocabulary, grammar table,
│                # compose / parse / validate / suggest (+ unit tests)
├── protocol/    # typed postMessage contract shared by main and UI
├── main/        # Figma sandbox thread: Variables read/write IO only
└── ui/          # React + Spiral (@aviala-design/spiral) iframe app
```

All naming logic lives in `src/grammar` as pure functions so it can be unit-tested
in Node and bundled into the UI, keeping `main.js` minimal — the sandbox only
shuttles raw variable data and final rename strings.

## License

MIT © AvialaOSS
