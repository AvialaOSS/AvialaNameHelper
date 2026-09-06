import { renameSync, rmSync } from "node:fs";
import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

// Figma loads the UI via figma.showUI(__html__) from ONE html file. Vite emits
// `index.html` under the root; rename it to the stable `dist/ui.html` after
// every bundle. closeBundle also fires on each --watch rebuild, so `pnpm dev`
// keeps dist/ui.html fresh without a separate postbuild script.
function finalizeUiHtml(): Plugin {
  return {
    name: "finalize-ui-html",
    closeBundle() {
      const from = path.resolve("dist/ui/index.html");
      const to = path.resolve("dist/ui.html");
      rmSync(to, { force: true });
      renameSync(from, to);
      rmSync(path.resolve("dist/ui"), { recursive: true, force: true });
    },
  };
}

export default defineConfig({
  root: "src/ui",
  plugins: [react(), tailwindcss(), viteSingleFile(), finalizeUiHtml()],
  build: {
    outDir: "../../dist/ui",
    emptyOutDir: true,
    // One stylesheet + inline everything so the iframe makes zero requests
    // (Figma's UI CSP blocks all remote resources).
    cssCodeSplit: false,
    assetsInlineLimit: 100000000,
    chunkSizeWarningLimit: 4096,
    target: "es2022",
    // Everything is inlined into one chunk (inlineDynamicImports), so Vite's
    // module-preload polyfill is dead code that only adds a stray `fetch`. Drop
    // it to keep the CSP-strict iframe free of any network primitive.
    modulePreload: false,
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
