import * as assert from "node:assert";
import { Conversation } from "../../ai/conversation";
import { BrainError, Provider, SendOptions, brainHelpButtons, brainProblemMessages } from "../../ai/provider";
import { ChatLog } from "../../panel/chatLog";
import { brainStrings } from "../../strings";

// The conversation's logic, in real VS Code with fake brains and the real
// chat (MOCHI-70): one answer at a time, Stop, problems, Keep going, and
// the history sent along. No attachments, so no share dialog is shown.

const tick = (ms = 20) => new Promise((done) => setTimeout(done, ms));

// Waits until something is true, so slow CI machines don't make tests flaky.
async function until(condition: () => boolean, what: string): Promise<void> {
  for (let i = 0; i < 200 && !condition(); i++) {
    await tick(10);
  }
  assert.ok(condition(), `Timed out waiting: ${what}`);
}

// A brain that answers with the given pieces, waiting `gap` ms between
// them, and remembers what each request carried.
function brain(pieces: string[], gap = 0, fail?: BrainError) {
  const calls: SendOptions[] = [];
  const provider: Provider = {
    name: "Fake Brain",
    isAvailable: async () => true,
    send: async function* (_request, _instructions, options = {}) {
      calls.push(options);
      for (const piece of pieces) {
        if (options.signal?.aborted) {
          return;
        }
        if (gap) {
          await tick(gap);
        }
        if (options.signal?.aborted) {
          return;
        }
        yield piece;
      }
      if (fail) {
        throw fail;
      }
    },
  };
  return { provider, calls };
}

function conversation(provider: Provider | "waiting") {
  const chat = new ChatLog();
  const brains = { forQuestion: async () => (provider === "waiting" ? ({ kind: "waiting" } as const) : ({ kind: "use", provider } as const)) };
  return { chat, talk: new Conversation(brains, () => "rules", chat, () => chat.saved()) };
}

const ask = (talk: Conversation, message: string) => talk.ask({ message, attachments: [] }, message);

describe("the conversation", () => {
  it("streams the answer into the chat, then marks it done", async () => {
    const { chat, talk } = conversation(brain(["A list ", "is a row of boxes."]).provider);
    await ask(talk, "what's a list?");
    const answer = chat.entries().at(-1)!;
    assert.strictEqual(answer.text, "A list is a row of boxes.");
    assert.strictEqual(answer.answering, undefined);
    assert.strictEqual(chat.answering(), false);
  });

  it("stops an answer, keeping what was written, marked stopped", async () => {
    const { chat, talk } = conversation(brain(["One ", "two ", "three ", "four"], 30).provider);
    const answering = ask(talk, "count");
    await until(() => (chat.entries()[1]?.text ?? "") !== "", "the first words");
    await talk.stop();
    await answering;
    const answer = chat.entries().at(-1)!;
    assert.strictEqual(answer.stopped, true);
    assert.ok(answer.text.length > 0 && !answer.text.includes("four"), answer.text);
  });

  it("answers one question at a time: a new one stops the last, and never writes into its bubble", async () => {
    const slow = brain(["slow ", "slow ", "slow ", "slow"], 30);
    const { chat, talk } = conversation(slow.provider);
    const first = ask(talk, "first");
    await until(() => (chat.entries()[1]?.text ?? "") !== "", "the first answer to start");
    // The second question's brain answers quickly.
    slow.provider.send = brain(["quick answer"]).provider.send;
    await ask(talk, "second");
    await first;
    const [, firstAnswer, , secondAnswer] = chat.entries();
    assert.strictEqual(firstAnswer.stopped, true);
    assert.ok(!firstAnswer.text.includes("quick"), firstAnswer.text);
    assert.strictEqual(secondAnswer.text, "quick answer");
  });

  it("sends the recent messages along with the next question", async () => {
    const fake = brain(["A row of boxes."]);
    const { talk } = conversation(fake.provider);
    await ask(talk, "what's a list?");
    await ask(talk, "and a tuple?");
    assert.deepStrictEqual(fake.calls[1].history, [
      { from: "her", text: "what's a list?" },
      { from: "mochi", text: "A row of boxes." },
    ]);
  });

  it("shows a brain's problem as a kind line, with no chip when there's nothing to do", async () => {
    const { chat, talk } = conversation(brain([], 0, new BrainError("blocked", "rate limited")).provider);
    await ask(talk, "hi");
    await until(() => chat.entries().at(-1)?.problem === true, "the kind line");
    const line = chat.entries().at(-1)!;
    assert.strictEqual(line.text, brainProblemMessages.blocked);
    assert.strictEqual(line.problem, true);
    assert.strictEqual(line.chips, undefined);
  });

  it("offers Keep going for an answer that reached the limit, and continues the same answer", async () => {
    const fake = brain(["A long first part"], 0, new BrainError("cutOff", "max tokens", "keepGoing"));
    const { chat, talk } = conversation(fake.provider);
    await ask(talk, "explain everything");
    await until(() => chat.entries().at(-1)?.chips !== undefined, "the Keep going chip");
    const note = chat.entries().at(-1)!;
    assert.deepStrictEqual(note.chips?.choices.map((c) => c.label), [brainHelpButtons.keepGoing]);

    // The rest arrives with Keep going.
    fake.provider.send = brain([" and the rest."]).provider.send;
    chat.choose(note.id, note.chips!.choices[0].id);
    const answer = chat.entries().find((e) => e.from === "mochi" && !e.problem)!;
    await until(() => answer.text.endsWith("the rest."), "the rest of the answer");
    assert.strictEqual(answer.text, "A long first part and the rest.");
  });

  it("says one line, and asks nothing, while she hasn't picked a brain", async () => {
    const { chat, talk } = conversation("waiting");
    assert.strictEqual(await ask(talk, "hi"), undefined);
    assert.deepStrictEqual(chat.entries().map((e) => e.text), [brainStrings.waiting]);
  });

  it("stopping with nothing running does nothing", async () => {
    const { chat, talk } = conversation(brain(["hi"]).provider);
    await talk.stop();
    assert.deepStrictEqual(chat.entries(), []);
  });
});
