import { readFileSync } from "node:fs";
import { defineConfig } from "@vscode/test-cli";

// Test on the oldest VS Code we promise to support (engines.vscode).
const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));
const oldestSupported = pkg.engines.vscode.replace(/^[^\d]*/, "");

export default defineConfig({
  files: "out/test/integration/**/*.test.js",
  version: oldestSupported,
  mocha: {
    ui: "bdd",
    timeout: 20000,
  },
});
