import * as assert from "node:assert";
import { Answer, Attachment, TYPED_SECRET_QUESTION, followUp, question, throughShareGate } from "../../ai/shareGate";

const errorLines: Attachment = {
  kind: "errorContext",
  label: "homework.py",
  text: "9| x = 1\n...\n12| print(y)",
  from: 9,
  to: 15,
  errorLine: 12,
};
const selection: Attachment = { kind: "selection", label: "homework.py", text: "print(x)" };
const file: Attachment = { kind: "file", label: "notes.md", text: "# Notes" };

// A fake "her" that answers the question and remembers what she was asked.
function fakeAsk(answer: Answer) {
  const asked: string[] = [];
  return {
    asked,
    ask: async (q: string) => {
      asked.push(q);
      return answer;
    },
  };
}

describe("share gate", () => {
  describe("what she typed that looks like a secret", () => {
    const typed = "my key is sk-ant-api03-abcdefghijklmnopqrstuvwxyz, why doesn't it work?";

    it("asks before sending, with the warning and Send anyway", async () => {
      const asked: [string, string | undefined][] = [];
      const result = await throughShareGate({ message: typed, attachments: [] }, "Claude", async (q, about) => {
        asked.push([q, about]);
        return "share";
      });
      assert.deepStrictEqual(asked, [
        ["Careful: this looks like it might contain a password or API key. Send anyway?", "typedSecret"],
      ]);
      assert.strictEqual(TYPED_SECRET_QUESTION, asked[0][0]);
      assert.strictEqual(result.status, "sent");
    });

    it("sends nothing when she cancels", async () => {
      const result = await throughShareGate({ message: typed, attachments: [selection] }, "Claude", fakeAsk("cancel").ask);
      assert.deepStrictEqual(result, { status: "notSent" });
    });

    it("asks about what she typed first, then about anything attached", async () => {
      const her = fakeAsk("share");
      await throughShareGate({ message: typed, attachments: [selection] }, "Copilot", her.ask);
      assert.deepStrictEqual(her.asked, [TYPED_SECRET_QUESTION, "Share the selected code from homework.py with Copilot?"]);
    });
  });

  it("lets her own typed message through without asking", async () => {
    const her = fakeAsk("cancel");
    const result = await throughShareGate({ message: "What's a list?", attachments: [] }, "Claude", her.ask);
    assert.strictEqual(result.status, "sent");
    assert.deepStrictEqual(result.status === "sent" && result.request, { message: "What's a list?", attachments: [] });
    assert.strictEqual(her.asked.length, 0, "Nothing was attached, so there was nothing to ask about.");
  });

  it("asks before sending anything Mochi attached, saying exactly what and to which AI", async () => {
    const her = fakeAsk("share");
    const result = await throughShareGate({ message: "Help?", attachments: [errorLines] }, "Copilot", her.ask);
    assert.deepStrictEqual(her.asked, ["Share lines 9 to 15 of homework.py (the error on line 12) with Copilot?"]);
    assert.deepStrictEqual(result.status === "sent" && result.request.attachments, [errorLines]);
  });

  it("sends nothing at all when she cancels", async () => {
    const result = await throughShareGate({ message: "Help?", attachments: [errorLines] }, "Claude", fakeAsk("cancel").ask);
    assert.deepStrictEqual(result, { status: "notSent" }, "Cancel must stop the whole request.");
  });

  it("sends only her message when she picks Send without it", async () => {
    const result = await throughShareGate({ message: "Help?", attachments: [errorLines, file] }, "Claude", fakeAsk("sendWithout").ask);
    assert.deepStrictEqual(result.status === "sent" && result.request, { message: "Help?", attachments: [] });
  });

  it("sends nothing when there's no message and nothing to share", async () => {
    assert.deepStrictEqual(await throughShareGate({ message: "  ", attachments: [] }, "Claude", fakeAsk("share").ask), { status: "notSent" });
    assert.deepStrictEqual(
      await throughShareGate({ message: "", attachments: [errorLines] }, "Claude", fakeAsk("sendWithout").ask),
      { status: "notSent" }
    );
  });

  it("refuses a request that doesn't say which AI it goes to", async () => {
    await assert.rejects(throughShareGate({ message: "Hi", attachments: [] }, " ", fakeAsk("share").ask), /which AI/);
  });

  describe("secrets", () => {
    it("refuses anything from .env or key files, without even asking", async () => {
      for (const label of [".env", ".env.local", "server.pem", "id_rsa"]) {
        const her = fakeAsk("share");
        const result = await throughShareGate(
          { message: "Help?", attachments: [{ kind: "selection", label, text: "SECRET=1" }] },
          "Copilot",
          her.ask
        );
        assert.strictEqual(result.status, "refused", `${label} must never be shared.`);
        assert.match(result.status === "refused" ? result.reason : "", new RegExp(`from ${label.replace(".", "\\.")}`));
        assert.strictEqual(her.asked.length, 0, "She shouldn't even be asked about a secret file.");
      }
    });

    it("warns, but still lets her choose, when text looks like a password or API key", async () => {
      const her = fakeAsk("share");
      const key: Attachment = { kind: "selection", label: "config.py", text: 'API_KEY = "sk-ant-api03-abcdefghijklmnopqrstuvwx"' };
      const result = await throughShareGate({ message: "Help?", attachments: [key] }, "Copilot", her.ask);
      assert.match(her.asked[0], /Careful: this looks like it might contain a password or API key\.$/);
      assert.strictEqual(result.status, "sent", "It's only a warning; she decides.");
    });

    it("doesn't warn about ordinary code", () => {
      assert.doesNotMatch(question([selection], "Copilot"), /Careful/);
    });
  });

  it("lets a follow-up reuse exactly what she agreed to share, with a new message", async () => {
    const result = await throughShareGate({ message: "Explain", attachments: [errorLines] }, "Copilot", fakeAsk("share").ask);
    assert.strictEqual(result.status, "sent");
    if (result.status === "sent") {
      const next = followUp(result.request, "Give me a hint");
      assert.strictEqual(next.message, "Give me a hint");
      assert.deepStrictEqual(next.attachments, [errorLines]);
    }
  });

  it("asks in plain words, listing everything that would be shared", () => {
    assert.strictEqual(question([selection], "Claude"), "Share the selected code from homework.py with Claude?");
    assert.strictEqual(
      question([errorLines, file], "Copilot"),
      "Share lines 9 to 15 of homework.py (the error on line 12) and the open file notes.md with Copilot?"
    );
  });
});
