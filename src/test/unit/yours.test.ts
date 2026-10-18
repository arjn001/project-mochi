import * as assert from "node:assert";
import * as fs from "node:fs";
import * as path from "node:path";
import { yoursHtml } from "../../yours/html";
import { toFromYours } from "../../yours/messages";

// The "Make it yours" page (MOCHI-43).
const repo = path.join(__dirname, "..", "..", "..");
const page = { cspSource: "vscode-resource:", nonce: "abc123", tokensUri: "panel.css", styleUri: "yours.css", scriptUri: "yours.js" };

describe("the Make it yours page", () => {
  describe("the page", () => {
    it("has the panel's strict policy: nothing inline, one script with the nonce", () => {
      const html = yoursHtml(page);
      assert.match(html, /default-src 'none'; style-src vscode-resource:; font-src vscode-resource:; script-src 'nonce-abc123'/);
      assert.doesNotMatch(html, /unsafe-(inline|eval)|\sstyle=/);
      assert.deepStrictEqual(html.match(/<script[^>]*>/g), ['<script nonce="abc123" src="yours.js">']);
    });
  });

  describe("its stylesheet", () => {
    const css = fs.readFileSync(path.join(repo, "media", "yours", "yours.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    const tokens = fs.readFileSync(path.join(repo, "media", "panel", "panel.css"), "utf8");

    it("uses only Mochi's tokens: no raw colors, and no tokens of its own", () => {
      assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|\b(rgba?|hsla?)\(/i);
      assert.doesNotMatch(css, /--[\w-]+\s*:/);
      for (const [, token] of css.matchAll(/var\((--[\w-]+)/g)) {
        assert.match(token, /^--mochi-/, token);
        assert.match(tokens, new RegExp(`${token}\\s*:`), `${token} isn't defined in panel.css.`);
      }
    });
  });

  describe("messages from the page", () => {
    it("ignores anything it doesn't know", () => {
      assert.deepStrictEqual(toFromYours({ type: "ready" }), { type: "ready" });
      for (const odd of [undefined, null, "ready", { type: "run", command: "rm -rf" }]) {
        assert.strictEqual(toFromYours(odd), undefined, JSON.stringify(odd));
      }
    });
  });
});
