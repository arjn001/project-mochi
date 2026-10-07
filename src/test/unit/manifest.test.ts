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

  it("lists no developer-only commands, so they never show in the published build", () => {
    const commands: { command: string }[] = readJson("package.json").contributes.commands;
    assert.deepStrictEqual(
      commands.filter((c) => c.command.startsWith("mochi.dev")).map((c) => c.command),
      [],
      "Developer tools are registered only in development mode, never listed in package.json."
    );
  });

  it("ships only the bundle: out/, with the tests and developer tools, stays out", () => {
    assert.strictEqual(readJson("package.json").main, "./dist/extension.js");
    const ignored = fs.readFileSync(path.join(root, ".vscodeignore"), "utf8").split(/\r?\n/);
    assert.ok(ignored.includes("out/**"), ".vscodeignore must leave out/ out of the .vsix.");
  });

  it("keeps Learning mode on by default, and only in her own settings", () => {
    const setting = readJson("package.json").contributes.configuration.properties["mochi.learningMode"];
    assert.strictEqual(setting.default, true);
    assert.strictEqual(setting.scope, "application", "A project's settings must not be able to turn Learning mode off.");
  });

  it("keeps her brain choice in her own settings only", () => {
    const setting = readJson("package.json").contributes.configuration.properties["mochi.brain"];
    assert.strictEqual(setting.default, "");
    assert.strictEqual(setting.scope, "application", "A project's settings must not be able to change her brain.");
  });
});
