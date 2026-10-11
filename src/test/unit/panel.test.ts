import * as assert from "node:assert";
import * as fs from "node:fs";
import * as path from "node:path";
import { toTodaysGreeting } from "../../moments/greeting";
import { contentSecurityPolicy, panelHtml } from "../../panel/html";
import { MAX_ASK_LENGTH, isAnswering, keyWhileAnswering, sendsOnKey, toFromPanel } from "../../panel/messages";
import { moodLine, moodParts } from "../../presence/mood";

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
    // The first block, with the parts nested inside it.
    const open = withoutComments.indexOf("{");
    let depth = 0;
    let close = open;
    for (; close < withoutComments.length; close++) {
      depth += withoutComments[close] === "{" ? 1 : withoutComments[close] === "}" ? -1 : 0;
      if (depth === 0) {
        break;
      }
    }
    const tokens = withoutComments.slice(0, close + 1);
    const rest = withoutComments.slice(close + 1);
    const part = (theme: string) => new RegExp(`&\\.${theme}\\s*\\{([^}]*)\\}`).exec(tokens)?.[1] ?? "";
    const RAW = /#[0-9a-f]{3,8}\b|\b(rgba?|hsla?)\(/i;

    it("keeps raw colors in the token block's light and dark parts only", () => {
      assert.doesNotMatch(rest, RAW, "A raw color outside the token block.");
      const outsideParts = tokens.replace(/&\.vscode-(light|dark)\s*\{[^}]*\}/g, "");
      assert.doesNotMatch(outsideParts, RAW, "A raw color in the token block, but outside its light and dark parts.");
      assert.match(part("vscode-light"), RAW);
      assert.match(part("vscode-dark"), RAW);
    });

    it("never gives high contrast themes colors of its own", () => {
      assert.doesNotMatch(withoutComments, /vscode-high-contrast/);
    });

    it("only uses VS Code's variables and Mochi's tokens", () => {
      for (const [, name] of withoutComments.matchAll(/var\((--[\w-]+)/g)) {
        assert.match(name, /^--(vscode|mochi)-/, name);
      }
    });

    it("defines Mochi's tokens in one place, the first block", () => {
      assert.match(tokens, /^\s*body\s*\{/);
      assert.doesNotMatch(rest, /--mochi-[\w-]+\s*:/, "A --mochi- token is defined outside the first block.");
      for (const [, token] of rest.matchAll(/var\((--mochi-[\w-]+)/g)) {
        assert.match(tokens, new RegExp(`${token}\\s*:`), `${token} is used but never defined.`);
      }
    });

    it("keeps the paw prints still with Reduce Motion, VS Code's or the system's", () => {
      assert.match(withoutComments, /body\.vscode-reduce-motion \.mochi-paw\s*\{[^}]*animation:\s*none/);
      assert.match(withoutComments, /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.mochi-paw\s*\{[^}]*animation:\s*none/);
    });

    describe("contrast (WCAG AA)", () => {
      // The theme's own colors, from VS Code's Light Modern and Dark Modern
      // (extensions/theme-defaults/themes, checked 2026-10-10).
      const themes = {
        "vscode-light": { foreground: "#3b3b3b", quiet: "#3b3b3b", sideBar: "#f8f8f8" },
        "vscode-dark": { foreground: "#cccccc", quiet: "#9d9d9d", sideBar: "#181818" },
      };
      const luminance = (hex: string) => {
        const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
        const linear = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
        return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
      };
      const contrast = (a: string, b: string) => {
        const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
        return (high + 0.05) / (low + 0.05);
      };
      const token = (theme: string, name: string) => {
        const value = new RegExp(`--mochi-${name}:\\s*(#[0-9a-f]{6})`, "i").exec(part(theme))?.[1];
        assert.ok(value, `--mochi-${name} isn't set for ${theme}.`);
        return value;
      };

      for (const [theme, colors] of Object.entries(themes)) {
        it(`meets 4.5:1 for every text in ${theme === "vscode-light" ? "Light" : "Dark"} Modern`, () => {
          const pairs: [string, string, string][] = [
            ["text on Mochi's bubble", colors.foreground, token(theme, "reply-bubble")],
            ["text on her bubble", colors.foreground, token(theme, "her-bubble")],
            ["quiet text (Stopped) on Mochi's bubble", colors.quiet, token(theme, "reply-bubble")],
            ["links on Mochi's bubble", token(theme, "accent"), token(theme, "reply-bubble")],
            ["chips on the panel", token(theme, "accent"), colors.sideBar],
            ["chips on Mochi's bubble", token(theme, "accent"), token(theme, "reply-bubble")],
          ];
          for (const [what, text, background] of pairs) {
            const ratio = contrast(text, background);
            assert.ok(ratio >= 4.5, `${what}: ${ratio.toFixed(2)}:1`);
          }
        });

        it(`shows the paw prints at 3:1 or more in ${theme === "vscode-light" ? "Light" : "Dark"} Modern`, () => {
          // Graphics need 3:1. The paws pulse up from 35%, and are at full
          // strength at the top of each step and with Reduce Motion (70%).
          assert.ok(contrast(token(theme, "accent"), token(theme, "reply-bubble")) >= 3);
        });
      }
    });
  });

  describe("messages from the panel", () => {
    it("accepts the messages Mochi knows", () => {
      assert.deepStrictEqual(toFromPanel({ type: "ready" }), { type: "ready" });
      assert.deepStrictEqual(toFromPanel({ type: "ask", text: "what's a list?" }), { type: "ask", text: "what's a list?" });
      assert.deepStrictEqual(toFromPanel({ type: "button", button: "focus" }), { type: "button", button: "focus" });
      assert.deepStrictEqual(toFromPanel({ type: "button", button: "brain" }), { type: "button", button: "brain" });
      assert.deepStrictEqual(toFromPanel({ type: "leaveOut", extra: "ignored" }), { type: "leaveOut" });
      assert.deepStrictEqual(toFromPanel({ type: "stop" }), { type: "stop" });
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

    it("while Mochi answers: Escape stops, Enter does nothing, and typing works", () => {
      assert.strictEqual(keyWhileAnswering("Escape", false, false), "stop");
      assert.strictEqual(keyWhileAnswering("Enter", false, false), "hold");
      assert.strictEqual(keyWhileAnswering("Enter", true, false), undefined, "Shift+Enter still adds a line.");
      assert.strictEqual(keyWhileAnswering("a", false, false), undefined);
      assert.strictEqual(keyWhileAnswering("Escape", false, true), undefined, "Escape cancels her input method first.");
    });

    it("shows Stop only while an answer is being written", () => {
      assert.strictEqual(isAnswering([{ id: 1, from: "mochi", text: "Hi", answering: true }]), true);
      assert.strictEqual(isAnswering([{ id: 1, from: "mochi", text: "Hi", stopped: true }]), false);
      assert.strictEqual(isAnswering([]), false);
    });
  });

  describe("the mood at the top", () => {
    it("is the status bar's mood, as an icon and words", () => {
      assert.deepStrictEqual(moodParts(moodLine("gentle")), { glyph: "purring", words: "Mochi is purring" });
      assert.deepStrictEqual(moodParts(moodLine("quiet")), { glyph: "napping", words: "Mochi is napping" });
      assert.deepStrictEqual(moodParts(moodLine("quiet", undefined, 18)), { glyph: "here", words: "Focusing · 18 min left" });
    });
  });

  describe("today's greeting", () => {
    it("keeps the same line all day", () => {
      assert.deepStrictEqual(toTodaysGreeting({ day: "2026-10-10", text: "Good morning!" }, "2026-10-10"), {
        day: "2026-10-10",
        text: "Good morning!",
      });
    });

    it("picks a new one the next day", () => {
      assert.strictEqual(toTodaysGreeting({ day: "2026-10-09", text: "Good morning!" }, "2026-10-10"), undefined);
    });

    it("remembers which line is the welcome, so it can name the brain later", () => {
      assert.strictEqual(toTodaysGreeting({ day: "2026-10-10", text: "Hi!", welcome: true }, "2026-10-10")?.welcome, true);
      assert.strictEqual(toTodaysGreeting({ day: "2026-10-10", text: "Hi!", welcome: "yes" }, "2026-10-10")?.welcome, undefined);
    });

    it("keeps the welcome's button, and ignores anything odd", () => {
      assert.strictEqual(toTodaysGreeting({ day: "2026-10-10", text: "Hi!", button: "setUpCopilot" }, "2026-10-10")?.button, "setUpCopilot");
      assert.strictEqual(toTodaysGreeting({ day: "2026-10-10", text: "Hi!", button: "format" }, "2026-10-10")?.button, undefined);
      for (const odd of [undefined, "Hi!", { day: "2026-10-10" }, { day: "2026-10-10", text: "" }]) {
        assert.strictEqual(toTodaysGreeting(odd, "2026-10-10"), undefined);
      }
    });
  });
});
