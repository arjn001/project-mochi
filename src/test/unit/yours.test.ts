import * as assert from "node:assert";
import * as fs from "node:fs";
import * as path from "node:path";
import { yoursHtml } from "../../yours/html";
import { MOMENTS } from "../../packs/format";
import { checkEdit, checkLines, checkStyle } from "../../yours/edits";
import { MOMENT_IDS, toFromYours } from "../../yours/messages";

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
    it("accepts an edit to a field Mochi knows", () => {
      assert.deepStrictEqual(toFromYours({ type: "edit", field: "focusMinutes", value: "45" }), { type: "edit", field: "focusMinutes", value: "45" });
      assert.deepStrictEqual(toFromYours({ type: "edit", field: "learningMode", value: false }), { type: "edit", field: "learningMode", value: false });
      assert.deepStrictEqual(toFromYours({ type: "button", button: "chooseBrain" }), { type: "button", button: "chooseBrain" });
    });

    it("ignores anything it doesn't know", () => {
      assert.deepStrictEqual(toFromYours({ type: "ready" }), { type: "ready" });
      for (const odd of [
        undefined,
        null,
        "ready",
        { type: "run", command: "rm -rf" },
        { type: "edit", field: "brain", value: "copilot/auto" },
        { type: "edit", field: "workbench.colorTheme", value: "Dark Modern" },
        { type: "edit", field: "focusMinutes", value: { minutes: 45 } },
        { type: "edit", field: "focusMinutes", value: Number.NaN },
        { type: "edit", field: "focusMinutes", value: "x".repeat(20_000) },
        { type: "button", button: "workbench.action.reloadWindow" },
      ]) {
        assert.strictEqual(toFromYours(odd), undefined, JSON.stringify(odd)?.slice(0, 80));
      }
    });
  });

  describe("checking what she changes", () => {
    it("checks her name the same way as \"What should I call you?\"", () => {
      assert.deepStrictEqual(checkEdit("name", " Sam "), { ok: true, value: "Sam" });
      for (const odd of ["", "   ", "x".repeat(31), "Sam\nSmith", 7]) {
        assert.strictEqual(checkEdit("name", odd).ok, false, JSON.stringify(odd));
      }
    });

    it("accepts the three speak-up levels, and nothing else", () => {
      for (const level of ["quiet", "gentle", "chatty"]) {
        assert.deepStrictEqual(checkEdit("speakUp", level), { ok: true, value: level });
      }
      for (const odd of ["loud", "", "Quiet", 1]) {
        assert.strictEqual(checkEdit("speakUp", odd).ok, false, String(odd));
      }
    });

    it("takes Learning mode as on or off only", () => {
      assert.deepStrictEqual(checkEdit("learningMode", false), { ok: true, value: false });
      assert.strictEqual(checkEdit("learningMode", "false").ok, false);
    });

    it("takes a focus length of whole minutes from 5 to 120, typed or not", () => {
      assert.deepStrictEqual(checkEdit("focusMinutes", "45"), { ok: true, value: 45 });
      assert.deepStrictEqual(checkEdit("focusMinutes", 5), { ok: true, value: 5 });
      assert.deepStrictEqual(checkEdit("focusMinutes", 120), { ok: true, value: 120 });
      for (const odd of [4, 121, 25.5, "", "abc", "25 min", -10]) {
        const checked = checkEdit("focusMinutes", odd);
        assert.strictEqual(checked.ok, false, String(odd));
        assert.match(checked.ok ? "" : checked.hint, /5 to 120/);
      }
    });

    it("takes a late-night hour from 0 to 23", () => {
      assert.deepStrictEqual(checkEdit("lateHour", "0"), { ok: true, value: 0 });
      assert.deepStrictEqual(checkEdit("lateHour", 23), { ok: true, value: 23 });
      for (const odd of [24, -1, 22.5, "eleven"]) {
        assert.strictEqual(checkEdit("lateHour", odd).ok, false, String(odd));
      }
    });
  });

  describe("her own lines and style notes", () => {
    it("lists the same moments as the pack format", () => {
      assert.deepStrictEqual([...MOMENT_IDS], [...MOMENTS]);
    });

    it("takes one line per row, trimmed, skipping empty rows", () => {
      assert.deepStrictEqual(checkLines("stuck", " Want a paw? \n\n\r\nNeed a hand?\n"), { ok: true, lines: ["Want a paw?", "Need a hand?"] });
      assert.deepStrictEqual(checkLines("stuck", "   "), { ok: true, lines: [] }, "Empty means Mochi's own lines.");
    });

    it("allows only the placeholders a moment can use", () => {
      assert.ok(checkLines("celebrate", "Yay, {thing}!").ok);
      assert.strictEqual(checkLines("stuck", "Yay, {thing}!").ok, false);
      assert.strictEqual(checkLines("celebrate", "Hi {name}!").ok, false, "celebrate can't use {name}.");
    });

    it("needs one greeting without {name}, for when no name is set", () => {
      assert.strictEqual(checkLines("greeting", "Hi {name}!").ok, false);
      assert.ok(checkLines("greeting", "Hi {name}!\nHi there!").ok);
    });

    it("keeps lines to the pack's limits", () => {
      assert.strictEqual(checkLines("stuck", "x".repeat(201)).ok, false);
      assert.strictEqual(checkLines("stuck", Array.from({ length: 21 }, (_, i) => `line ${i}`).join("\n")).ok, false);
      assert.strictEqual(checkLines("stuck", "flip \u202E this").ok, false, "Characters that flip the text are refused.");
    });

    it("takes short style notes only", () => {
      assert.deepStrictEqual(checkStyle("  short and calm "), { ok: true, style: "short and calm" });
      assert.strictEqual(checkStyle("x".repeat(401)).ok, false);
      assert.strictEqual(checkStyle(42).ok, false);
    });
  });
});
