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

  it("puts Make it yours in the ... menu of Mochi's tab, before Clear chat", () => {
    const menu = readJson("package.json").contributes.menus["view/title"];
    assert.deepStrictEqual(
      menu.map((m: { command: string; group: string }) => [m.command, m.group]),
      [
        ["mochi.makeItYours", "mochi@0"],
        ["mochi.clearChat", "mochi@1"],
      ]
    );
  });

  it("puts Clear chat in the ... menu of Mochi's tab, not as a bare icon", () => {
    const pkg = readJson("package.json");
    const item = pkg.contributes.menus["view/title"].find((m: { command: string }) => m.command === "mochi.clearChat");
    assert.strictEqual(item.when, "view == mochi.home");
    assert.ok(!item.group.startsWith("navigation"), "The navigation group would show it as an icon in the title bar.");
    assert.ok(pkg.contributes.commands.some((c: { command: string; title: string }) => c.command === "mochi.clearChat" && c.title === "Clear chat"));
  });

  it("is listed on the Marketplace as a preview, under the MIT License", () => {
    const pkg = readJson("package.json");
    assert.strictEqual(pkg.preview, true);
    assert.strictEqual(pkg.license, "MIT");
    assert.match(fs.readFileSync(path.join(root, "LICENSE"), "utf8"), /^MIT License/);
    assert.ok(!pkg.scripts.package.includes("--skip-license"));
    assert.deepStrictEqual(pkg.galleryBanner, { color: "#6B3FA0", theme: "dark" });
    for (const field of ["publisher", "repository", "categories", "keywords", "icon"]) {
      assert.ok(pkg[field], `${field} is missing`);
    }
  });

  it("has a 128x128 PNG store icon", () => {
    const png = fs.readFileSync(path.join(root, readJson("package.json").icon));
    assert.strictEqual(png.subarray(1, 4).toString(), "PNG");
    assert.deepStrictEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [128, 128]);
  });

  it("says in the README that the name, icons, and art aren't covered by the MIT License", () => {
    const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
    assert.match(readme, /early preview/);
    assert.match(readme, /## Notice[\s\S]*all rights reserved/);
    assert.doesNotMatch(readme, /\u2014/, "No em dashes.");
  });

  it("keeps her brain choice in her own settings only", () => {
    const setting = readJson("package.json").contributes.configuration.properties["mochi.brain"];
    assert.strictEqual(setting.default, "");
    assert.strictEqual(setting.scope, "application", "A project's settings must not be able to change her brain.");
  });
});
