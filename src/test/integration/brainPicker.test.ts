import * as assert from "node:assert";
import * as vscode from "vscode";
import { BrainPicker } from "../../ai/brainPicker";
import { ClaudeModel } from "../../ai/claude";
import { ClaudeModels } from "../../ai/claudeBrains";
import { Provider } from "../../ai/provider";

// Which brain answers (MOCHI-70), in real VS Code with no Copilot and a
// fake Claude key and model list. Nothing here asks any brain anything.

const haiku: ClaudeModel = { id: "claude-haiku-4-5", name: "Claude Haiku 4.5", maxInputTokens: 200_000 };

function memento(): vscode.Memento {
  const data = new Map<string, unknown>();
  return {
    keys: () => [...data.keys()],
    get: <T>(key: string, fallback?: T) => (data.has(key) ? (data.get(key) as T) : fallback),
    update: async (key: string, value: unknown) => void (value === undefined ? data.delete(key) : data.set(key, value)),
  } as vscode.Memento;
}

function picker(key: string | undefined, models: ClaudeModel[]) {
  const claude = {
    key: { get: async () => key },
    list: async () => models,
    brain: (model: ClaudeModel): Provider => ({ name: model.name, isAvailable: async () => true, send: async function* () {} }),
  } as unknown as ClaudeModels;
  return new BrainPicker(memento(), claude);
}

const setting = () => vscode.workspace.getConfiguration("mochi");

describe("which brain answers", () => {
  afterEach(async () => {
    await setting().update("brain", undefined, vscode.ConfigurationTarget.Global);
  });

  it("has none with no Copilot and no Claude key, so Mochi offers to set one up", async () => {
    assert.deepStrictEqual(await picker(undefined, []).forQuestion(), { kind: "none" });
  });

  it("waits, rather than offering setup, when she has a key but Claude listed no models", async () => {
    assert.deepStrictEqual(await picker("sk-ant-test", []).forQuestion(), { kind: "waiting" });
  });

  it("uses her pick, with no stand-in note", async () => {
    await setting().update("brain", "claude-key/claude-haiku-4-5", vscode.ConfigurationTarget.Global);
    const brain = await picker("sk-ant-test", [haiku]).forQuestion();
    assert.strictEqual(brain.kind, "use");
    assert.strictEqual(brain.kind === "use" && brain.provider.name, "Claude Haiku 4.5");
    assert.strictEqual(brain.kind === "use" && brain.note, undefined);
  });

  it("shows her pick at the top of the chat, or nothing when Mochi would ask first", async () => {
    const brains = picker("sk-ant-test", [haiku]);
    assert.strictEqual(await brains.current(), undefined, "No pick and no Auto: Mochi asks first.");
    await setting().update("brain", "claude-key/claude-haiku-4-5", vscode.ConfigurationTarget.Global);
    assert.strictEqual(await brains.current(), "Claude Haiku 4.5");
  });

  it("never treats a malformed pick as a brain", async () => {
    await setting().update("brain", "not a brain", vscode.ConfigurationTarget.Global);
    assert.strictEqual(await picker("sk-ant-test", [haiku]).current(), undefined);
  });
});
