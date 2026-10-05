import * as assert from "node:assert";
import { askMochi } from "../../ai/askMochi";
import { compose } from "../../ai/compose";
import { Provider } from "../../ai/provider";
import { Answer, Attachment, GatedRequest, throughShareGate } from "../../ai/shareGate";

const errors: Attachment = { kind: "errors", label: "homework.py", text: "NameError: name 'x' is not defined" };

// A fake brain that answers in two pieces and remembers what reached it.
function fakeBrain(available = true) {
  const received: { request: GatedRequest; instructions: string }[] = [];
  const brain: Provider = {
    name: "Fake Brain",
    isAvailable: async () => available,
    send: async function* (request, instructions) {
      received.push({ request, instructions });
      yield "Hello ";
      yield "there!";
    },
  };
  return { brain, received };
}

const answering = (answer: Answer) => async () => answer;

async function collect(text: AsyncIterable<string>): Promise<string> {
  let all = "";
  for await (const piece of text) {
    all += piece;
  }
  return all;
}

describe("asking Mochi", () => {
  it("streams the brain's answer back", async () => {
    const { brain } = fakeBrain();
    const result = await askMochi({ message: "Hi!", attachments: [] }, brain, "Be kind.", answering("cancel"));
    assert.strictEqual(result.status, "answer");
    assert.strictEqual(result.status === "answer" && (await collect(result.text)), "Hello there!");
  });

  it("offers to set up a brain when there is none, or it isn't available", async () => {
    const ask = answering("share");
    assert.deepStrictEqual(await askMochi({ message: "Hi", attachments: [] }, undefined, "", ask), { status: "noBrain" });
    assert.deepStrictEqual(
      await askMochi({ message: "Hi", attachments: [] }, fakeBrain(false).brain, "", ask),
      { status: "noBrain" }
    );
  });

  it("sends nothing to the brain when she cancels at the share gate", async () => {
    const { brain, received } = fakeBrain();
    const result = await askMochi({ message: "Why?", attachments: [errors] }, brain, "", answering("cancel"));
    assert.deepStrictEqual(result, { status: "notSent" });
    assert.strictEqual(received.length, 0, "Nothing may reach the brain after Cancel.");
  });

  it("names the brain in the share question", async () => {
    const asked: string[] = [];
    await askMochi({ message: "Why?", attachments: [errors] }, fakeBrain().brain, "", async (q) => {
      asked.push(q);
      return "cancel";
    });
    assert.deepStrictEqual(asked, ["Share the errors in homework.py with Fake Brain?"]);
  });

  it("gives the brain the instructions and only what she agreed to share", async () => {
    const { brain, received } = fakeBrain();
    const result = await askMochi({ message: "Why?", attachments: [errors] }, brain, "Be kind.", answering("sendWithout"));
    assert.strictEqual(result.status, "answer");
    if (result.status === "answer") {
      await collect(result.text);
    }
    assert.strictEqual(received[0].instructions, "Be kind.");
    assert.deepStrictEqual(received[0].request.attachments, [], "She chose Send without it.");
  });
});

describe("composing a request for the AI", () => {
  it("puts her message first, then each attachment in a fenced block", async () => {
    const gated = await throughShareGate({ message: " Why does this fail? ", attachments: [errors] }, "Claude", answering("share"));
    assert.strictEqual(
      compose(gated!),
      "Why does this fail?\n\nErrors in homework.py:\n```\nNameError: name 'x' is not defined\n```"
    );
  });
});
