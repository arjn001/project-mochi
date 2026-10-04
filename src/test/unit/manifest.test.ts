import * as assert from "node:assert";
import * as fs from "node:fs";
import * as path from "node:path";

const root = path.resolve(__dirname, "../../..");

function readJson(file: string): any {
  return JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
}

// "^1.125.0" becomes [1, 125, 0].
function parseVersion(range: string): number[] {
  return range.replace(/^[^\d]*/, "").split(".").map(Number);
}

function isNewer(a: number[], b: number[]): boolean {
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) {
      return a[i] > b[i];
    }
  }
  return false;
}

describe("package.json", () => {
  it("does not use @types/vscode newer than the oldest supported VS Code", () => {
    const engine = readJson("package.json").engines.vscode;
    const types = readJson("node_modules/@types/vscode/package.json").version;

    assert.ok(
      !isNewer(parseVersion(types), parseVersion(engine)),
      `@types/vscode ${types} is newer than engines.vscode ${engine}. ` +
        `Mochi could use VS Code features that its oldest supported version ` +
        `doesn't have. Lower @types/vscode to ${parseVersion(engine).join(".")} ` +
        `or below, or raise engines.vscode.`
    );
  });
});
