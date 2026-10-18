import * as assert from "node:assert";
import * as vscode from "vscode";
import { ModelBrain } from "../../ai/builtInAi";
import { BrainError } from "../../ai/provider";
import { GatedRequest } from "../../ai/shareGate";

// A brain from VS Code's built-in AI (Copilot, or another extension's
// model), with a fake model (MOCHI-70): what it's sent, and how its
// problems become Mochi's kind lines.

// Only the test makes a request look like it passed the share gate.
const request = (message: string) => ({ message, attachments: [] }) as unknown as GatedRequest;

type Sent = { messages: vscode.LanguageModelChatMessage[]; options: vscode.LanguageModelChatRequestOptions; token: vscode.CancellationToken };

function model(answer: string[] | Error) {
  const sent: Sent[] = [];
  const fake = {
    id: "auto",
    vendor: "copilot",
    name: "Auto",
    family: "auto",
    version: "1",
    maxInputTokens: 64_000,
    countTokens: async () => 0,
    sendRequest: async (messages: vscode.LanguageModelChatMessage[], options: vscode.LanguageModelChatRequestOptions, token: vscode.CancellationToken) => {
      sent.push({ messages, options, token });
      if (answer instanceof Error) {
        throw answer;
      }
      return {
        text: (async function* () {
          yield* answer;
        })(),
        stream: (async function* () {})(),
      };
    },
  } as unknown as vscode.LanguageModelChat;
  return { brain: new ModelBrain(fake, "Copilot · Auto"), sent };
}

const textOf = (message: vscode.LanguageModelChatMessage) =>
  message.content.map((part) => (part instanceof vscode.LanguageModelTextPart ? part.value : "")).join("");
const roleOf = (message: vscode.LanguageModelChatMessage) =>
  message.role === vscode.LanguageModelChatMessageRole.User ? "user" : "assistant";

async function collect(text: AsyncIterable<string>): Promise<string> {
  let all = "";
  for await (const piece of text) {
    all += piece;
  }
  return all;
}

async function problem(answer: Error): Promise<string | undefined> {
  try {
    await collect(model(answer).brain.send(request("hi"), "rules"));
  } catch (error) {
    return error instanceof BrainError ? error.problem : `not a BrainError: ${error}`;
  }
  return undefined;
}

describe("a brain from VS Code's built-in AI", () => {
  it("sends Mochi's rules first, then the recent messages, then her question", async () => {
    const { brain, sent } = model(["Hi!"]);
    const answer = await collect(
      brain.send(request("and a tuple?"), "Mochi's rules", {
        history: [
          { from: "her", text: "what's a list?" },
          { from: "mochi", text: "A row of boxes." },
        ],
      })
    );
    assert.strictEqual(answer, "Hi!");
    const messages = sent[0].messages.map((m) => [roleOf(m), textOf(m)]);
    assert.deepStrictEqual(messages[0], ["user", "Mochi's rules"]);
    assert.strictEqual(messages[1][0], "assistant", "A short reply marks where the conversation begins.");
    assert.deepStrictEqual(messages.slice(2), [
      ["user", "what's a list?"],
      ["assistant", "A row of boxes."],
      ["user", "and a tuple?"],
    ]);
  });

  it("names the brain in VS Code's permission prompt", async () => {
    const { brain, sent } = model(["Hi!"]);
    await collect(brain.send(request("hi"), "rules"));
    assert.match(sent[0].options.justification ?? "", /Copilot · Auto/);
  });

  it("says how much the model can take, for the history budget", () => {
    assert.strictEqual(model([]).brain.maxInputTokens, 64_000);
  });

  it("cancels the request when she stops the answer", async () => {
    const { brain, sent } = model(["One", "Two"]);
    const stop = new AbortController();
    for await (const _piece of brain.send(request("hi"), "rules", { signal: stop.signal })) {
      assert.strictEqual(sent[0].token.isCancellationRequested, false);
      stop.abort();
      assert.strictEqual(sent[0].token.isCancellationRequested, true);
      break;
    }
  });

  it("turns VS Code's problems into Mochi's kind lines", async () => {
    assert.strictEqual(await problem(vscode.LanguageModelError.NoPermissions("no")), "noPermission");
    assert.strictEqual(await problem(vscode.LanguageModelError.Blocked("limit")), "blocked");
    assert.strictEqual(await problem(vscode.LanguageModelError.NotFound("gone")), "unavailable");
    assert.strictEqual(await problem(new Error("something else")), "other");
  });
});
