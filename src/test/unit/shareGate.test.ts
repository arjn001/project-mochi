import * as assert from "node:assert";
import { Answer, Attachment, question, throughShareGate } from "../../ai/shareGate";

const errors: Attachment = { kind: "errors", label: "homework.py", text: "NameError: x" };
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
  it("lets her own typed message through without asking", async () => {
    const her = fakeAsk("cancel");
    const sent = await throughShareGate({ message: "What's a list?", attachments: [] }, "Claude", her.ask);
    assert.deepStrictEqual(sent, { message: "What's a list?", attachments: [] });
    assert.strictEqual(her.asked.length, 0, "Nothing was attached, so there was nothing to ask about.");
  });

  it("asks before sending anything Mochi attached, naming the AI", async () => {
    const her = fakeAsk("share");
    const sent = await throughShareGate({ message: "Help?", attachments: [errors] }, "Claude", her.ask);
    assert.deepStrictEqual(her.asked, ["Share the errors in homework.py with Claude?"]);
    assert.deepStrictEqual(sent?.attachments, [errors]);
  });

  it("sends nothing at all when she cancels", async () => {
    const sent = await throughShareGate({ message: "Help?", attachments: [errors] }, "Claude", fakeAsk("cancel").ask);
    assert.strictEqual(sent, undefined, "Cancel must stop the whole request.");
  });

  it("sends only her message when she picks Send without it", async () => {
    const sent = await throughShareGate(
      { message: "Help?", attachments: [errors, file] },
      "Claude",
      fakeAsk("sendWithout").ask
    );
    assert.deepStrictEqual(sent, { message: "Help?", attachments: [] }, "The attachments must be left behind.");
  });

  it("sends nothing when there's no message and nothing to share", async () => {
    assert.strictEqual(await throughShareGate({ message: "  ", attachments: [] }, "Claude", fakeAsk("share").ask), undefined);
    assert.strictEqual(
      await throughShareGate({ message: "", attachments: [errors] }, "Claude", fakeAsk("sendWithout").ask),
      undefined
    );
  });

  it("refuses a request that doesn't say which AI it goes to", async () => {
    await assert.rejects(
      throughShareGate({ message: "Hi", attachments: [] }, " ", fakeAsk("share").ask),
      /which AI/
    );
  });

  it("asks in plain words, listing everything that would be shared", () => {
    assert.strictEqual(question([selection], "Claude"), "Share the selected code from homework.py with Claude?");
    assert.strictEqual(
      question([errors, file], "GitHub Copilot"),
      "Share the errors in homework.py and the open file notes.md with GitHub Copilot?"
    );
    assert.strictEqual(
      question([selection, errors, file], "Claude"),
      "Share the selected code from homework.py, the errors in homework.py and the open file notes.md with Claude?"
    );
  });
});
