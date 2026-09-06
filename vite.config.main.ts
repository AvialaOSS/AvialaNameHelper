import { defineConfig } from "vite";

// Sandbox bundle: one self-contained IIFE with no DOM code and no runtime
// imports. Figma loads it as the plugin `main` script.
export default defineConfig({
  build: {
    lib: {
      entry: "src/main/index.ts",
      formats: ["iife"],
      name: "AvialaNameHelperMain",
      fileName: () => "main.js",
    },
    outDir: "dist",
    // Never wipe the sibling UI output (dist/ui.html) written by the UI build.
    emptyOutDir: false,
    // Keep the sandbox readable for Figma's plugin review and for debugging.
    minify: false,
    sourcemap: false,
    target: "es2022",
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
