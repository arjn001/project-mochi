import * as assert from "node:assert";
import * as fs from "node:fs";
import * as path from "node:path";

const root = path.resolve(__dirname, "../../..");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const fontConfig = require(path.join(root, ".fantasticonrc.js"));

describe("mood icons", () => {
  const icons: Record<string, any> = pkg.contributes.icons;

  it("point at a font file that exists", () => {
    for (const [name, icon] of Object.entries(icons)) {
      const fontPath = path.join(root, icon.default.fontPath);
      assert.ok(
        fs.existsSync(fontPath),
        `${name} points at ${icon.default.fontPath}, which doesn't exist. Run npm run build:icons.`
      );
    }
  });

  it("use the same character numbers the font was built with", () => {
    for (const [name, icon] of Object.entries(icons)) {
      const inPackage = parseInt(icon.default.fontCharacter.replace("\\", ""), 16);
      const inFont = fontConfig.codepoints[name];
      assert.strictEqual(
        inPackage,
        inFont,
        `${name} uses \\${inPackage.toString(16).toUpperCase()} in package.json, but the ` +
          `font has it at \\${inFont?.toString(16).toUpperCase()}. The status bar would ` +
          `show the wrong icon. Make package.json match .fantasticonrc.js.`
      );
    }
  });
});
