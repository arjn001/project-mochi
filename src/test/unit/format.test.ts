import * as assert from "node:assert";
import * as fs from "node:fs";
import * as path from "node:path";
import { Block, Inline, formatAnswer, formatInline, safeLink } from "../../panel/format";

// Every link in the tree, and every piece of text, to check what an answer
// turned into.
function links(blocks: Block[]): { url: string; domain: string; showDomain: boolean }[] {
  const found: { url: string; domain: string; showDomain: boolean }[] = [];
  const walk = (inlines: Inline[]) => {
    for (const piece of inlines) {
      if (piece.kind === "link") {
        found.push({ url: piece.url, domain: piece.domain, showDomain: piece.showDomain });
      } else if (piece.kind === "bold" || piece.kind === "italic") {
        walk(piece.children);
      }
    }
  };
  for (const block of blocks) {
    if (block.kind === "paragraph" || block.kind === "heading") {
      walk(block.inlines);
    } else if (block.kind === "list") {
      block.items.forEach(walk);
    }
  }
  return found;
}

// What a reader would see, in order: text, code, and link text.
function visible(blocks: Block[]): string {
  const inline = (pieces: Inline[]): string =>
    pieces
      .map((piece) =>
        piece.kind === "text" || piece.kind === "code"
          ? piece.text
          : piece.kind === "link"
            ? piece.text
            : inline(piece.children)
      )
      .join("");
  return blocks
    .map((block) =>
      block.kind === "code" ? block.text : block.kind === "list" ? block.items.map(inline).join("\n") : inline(block.inlines)
    )
    .join("\n");
}

describe("formatting answers for the chat", () => {
  describe("hostile answers stay text", () => {
    const hostile = [
      "<script>alert('hi')</script>",
      '<img src=x onerror="alert(1)">',
      '<a href="javascript:alert(1)">click me</a>',
      "<iframe src=https://evil.example></iframe>",
      "<style>body{display:none}</style>",
      "Hello <b onmouseover=alert(1)>there</b>",
    ];

    for (const answer of hostile) {
      it(`keeps ${answer.slice(0, 30)} as plain text`, () => {
        const blocks = formatAnswer(answer);
        assert.strictEqual(visible(blocks), answer, "It reads exactly as written.");
        assert.deepStrictEqual(blocks.map((b) => b.kind), ["paragraph"]);
        // The only live pieces are https links whose address is shown.
        for (const link of links(blocks)) {
          assert.match(link.url, /^https:\/\//);
          assert.strictEqual(link.showDomain, false, "A bare address is shown in full.");
        }
      });
    }

    it("keeps HTML inside a code block as code text", () => {
      assert.deepStrictEqual(formatAnswer("```html\n<script>alert(1)</script>\n<img onerror=x>\n```"), [
        { kind: "code", language: "html", text: "<script>alert(1)</script>\n<img onerror=x>" },
      ]);
    });

    it("never makes javascript:, data:, http:, or file: links", () => {
      for (const answer of [
        "[click](javascript:alert(1))",
        "[click](JavaScript:alert(1))",
        "[pic](data:text/html,<script>alert(1)</script>)",
        "[old](http://example.com)",
        "[file](file:///etc/passwd)",
        "[cmd](command:workbench.action.reloadWindow)",
        "[vsc](vscode://settings)",
      ]) {
        const blocks = formatAnswer(answer);
        assert.deepStrictEqual(links(blocks), [], answer);
        assert.strictEqual(visible(blocks), answer, "It stays exactly as written.");
      }
    });

    it("ignores a language name that isn't one", () => {
      const [block] = formatAnswer('```"><script>\ncode\n```');
      assert.notStrictEqual(block.kind === "code" && block.language, '"><script>');
    });
  });

  describe("links can't hide where they go", () => {
    it("shows the real domain next to a link's own text", () => {
      assert.deepStrictEqual(links(formatAnswer("[Python docs](https://docs.python.org/3/)")), [
        { url: "https://docs.python.org/3/", domain: "docs.python.org", showDomain: true },
      ]);
    });

    it("shows the domain even when the text looks like a different address", () => {
      assert.deepStrictEqual(links(formatAnswer("[https://good.example](https://evil.example/login)")), [
        { url: "https://evil.example/login", domain: "evil.example", showDomain: true },
      ]);
    });

    it("shows a bare address as itself", () => {
      const blocks = formatAnswer("See https://docs.python.org/3/tutorial/.");
      assert.deepStrictEqual(links(blocks), [
        { url: "https://docs.python.org/3/tutorial/", domain: "docs.python.org", showDomain: false },
      ]);
      assert.strictEqual(visible(blocks), "See https://docs.python.org/3/tutorial/.", "The full stop stays text.");
    });

    it("refuses addresses with a user name hidden in them", () => {
      assert.strictEqual(safeLink("https://bank.example@evil.example/"), undefined);
      assert.deepStrictEqual(links(formatAnswer("[bank](https://bank.example@evil.example/)")), []);
    });

    it("shows an international domain in its real, plain form", () => {
      assert.strictEqual(safeLink("https://аpple.com/")?.domain, "xn--pple-43d.com");
    });
  });

  describe("broken markdown", () => {
    it("leaves unclosed marks as text", () => {
      for (const answer of ["**not closed", "*also not", "`no end", "[text](https://a.example", "[only text]"]) {
        assert.strictEqual(visible(formatAnswer(answer)), answer, answer);
      }
    });

    it("runs an unclosed code block to the end, like an answer still being written", () => {
      assert.deepStrictEqual(formatAnswer("Try this:\n```python\nprint('hi')"), [
        { kind: "paragraph", inlines: [{ kind: "text", text: "Try this:" }] },
        { kind: "code", language: "python", text: "print('hi')" },
      ]);
    });

    it("keeps snake_case names whole", () => {
      assert.deepStrictEqual(formatInline("use my_list_name here"), [{ kind: "text", text: "use my_list_name here" }]);
    });

    it("formats a long answer quickly", () => {
      const started = Date.now();
      formatAnswer("A list is a row of boxes. `x` *y* ".repeat(2_000));
      assert.ok(Date.now() - started < 500, "Formatting is fast enough to redo while an answer streams.");
    });
  });

  describe("what it understands", () => {
    it("paragraphs, headings, lists, and code", () => {
      const blocks = formatAnswer("# Lists\n\nA list is **cozy**.\n\n- one\n- two\n\n1. first\n2. second\n\n```\nx = [1]\n```");
      assert.deepStrictEqual(
        blocks.map((b) => b.kind),
        ["heading", "paragraph", "list", "list", "code"]
      );
      assert.deepStrictEqual(blocks[1], {
        kind: "paragraph",
        inlines: [{ kind: "text", text: "A list is " }, { kind: "bold", children: [{ kind: "text", text: "cozy" }] }, { kind: "text", text: "." }],
      });
    });

    it("inline code and italics", () => {
      assert.deepStrictEqual(formatInline("call `len(x)` *now*"), [
        { kind: "text", text: "call " },
        { kind: "code", text: "len(x)" },
        { kind: "text", text: " " },
        { kind: "italic", children: [{ kind: "text", text: "now" }] },
      ]);
    });
  });

  describe("the panel's script", () => {
    const script = fs.readFileSync(path.join(__dirname, "..", "..", "..", "src", "webview", "panel.ts"), "utf8");

    it("never turns text into HTML", () => {
      for (const risky of ["innerHTML", "outerHTML", "insertAdjacentHTML", "document.write", "eval(", "new Function", "createContextualFragment"]) {
        assert.ok(!script.includes(risky), `The panel's script uses ${risky}.`);
      }
    });
  });
});
