import * as assert from "node:assert";
import * as fs from "node:fs";
import * as path from "node:path";
import { contentSecurityPolicy, panelHtml } from "../../panel/html";
import { MAX_ASK_LENGTH, sendsOnKey, toFromPanel } from "../../panel/messages";

// From out/test/unit/ back to the repo.
const repo = path.join(__dirname, "..", "..", "..");
const page = { cspSource: "vscode-resource:", nonce: "abc123", styleUri: "panel.css", scriptUri: "panel.js" };

describe("Mochi's panel", () => {
  describe("the page", () => {
    it("allows only Mochi's stylesheet, icon font, and nonce-marked script", () => {
      assert.strictEqual(
        contentSecurityPolicy(page),
        "default-src 'none'; style-src vscode-resource:; font-src vscode-resource:; script-src 'nonce-abc123'"
      );
    });

    it("has nothing inline: no style attributes, no script without the nonce", () => {
      const html = panelHtml(page);
      assert.doesNotMatch(html, /unsafe-(inline|eval)/);
      assert.doesNotMatch(html, /\sstyle=/);
      assert.deepStrictEqual(html.match(/<script[^>]*>/g), ['<script nonce="abc123" src="panel.js">']);
    });

    it("labels the box for screen readers", () => {
      assert.match(panelHtml(page), /<label[^>]*for="ask"/);
    });
  });

  describe("the stylesheet", () => {
    const css = fs.readFileSync(path.join(repo, "media", "panel", "panel.css"), "utf8");
    const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");

    it("has no raw colors, only VS Code's theme", () => {
      assert.doesNotMatch(withoutComments, /#[0-9a-f]{3,8}\b/i);
      assert.doesNotMatch(withoutComments, /\b(rgba?|hsla?)\(/i);
    });

    it("only uses VS Code's variables and Mochi's tokens", () => {
      for (const [, name] of withoutComments.matchAll(/var\((--[\w-]+)/g)) {
        assert.match(name, /^--(vscode|mochi)-/, name);
      }
    });

    it("defines Mochi's tokens in one place, the first block", () => {
      const firstBlock = withoutComments.slice(0, withoutComments.indexOf("}"));
      assert.match(firstBlock, /^\s*:root\s*\{/);
      const rest = withoutComments.slice(firstBlock.length);
      assert.doesNotMatch(rest, /--mochi-[\w-]+\s*:/, "A --mochi- token is defined outside the first block.");
      for (const [, token] of rest.matchAll(/var\((--mochi-[\w-]+)/g)) {
        assert.match(firstBlock, new RegExp(`${token}\\s*:`), `${token} is used but never defined.`);
      }
    });
  });

  describe("messages from the panel", () => {
    it("accepts the messages Mochi knows", () => {
      assert.deepStrictEqual(toFromPanel({ type: "ready" }), { type: "ready" });
      assert.deepStrictEqual(toFromPanel({ type: "ask", text: "what's a list?" }), { type: "ask", text: "what's a list?" });
      assert.deepStrictEqual(toFromPanel({ type: "button", button: "focus" }), { type: "button", button: "focus" });
    });

    it("ignores anything else", () => {
      for (const odd of [
        undefined,
        null,
        "ready",
        { type: "run", command: "rm -rf" },
        { type: "button", button: "workbench.action.reloadWindow" },
        { type: "ask", text: "   " },
        { type: "ask", text: 42 },
        { type: "ask", text: "x".repeat(MAX_ASK_LENGTH + 1) },
      ]) {
        assert.strictEqual(toFromPanel(odd), undefined, JSON.stringify(odd)?.slice(0, 60));
      }
    });
  });

  describe("the box's keys", () => {
    it("sends on Enter, adds a line on Shift+Enter", () => {
      assert.strictEqual(sendsOnKey("Enter", false, false), true);
      assert.strictEqual(sendsOnKey("Enter", true, false), false);
      assert.strictEqual(sendsOnKey("a", false, false), false);
    });

    it("never sends while she's composing a character with an input method", () => {
      assert.strictEqual(sendsOnKey("Enter", false, true), false);
    });
  });
});
