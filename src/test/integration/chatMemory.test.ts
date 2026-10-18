import * as assert from "node:assert";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { ChatLog } from "../../panel/chatLog";
import { ChatMemory } from "../../panel/chatMemory";
import { ChatStore, Generation } from "../../panel/chatStore";
import { chatStrings } from "../../strings";

// Keeping the chat for each project (MOCHI-70), in real VS Code with a
// real store in a temporary folder.

const PROJECT = "file:///homework-3";

function sharedGeneration(): Generation {
  let value: string | undefined;
  return { get: () => value, set: async (next) => void (value = next) };
}

describe("keeping the chat for each project", () => {
  let root: string;
  let folder: string;
  const memories: ChatMemory[] = [];

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "mochi-memory-"));
    folder = path.join(root, "chats");
  });
  afterEach(() => {
    for (const memory of memories.splice(0)) {
      memory.dispose();
    }
    fs.rmSync(root, { recursive: true, force: true });
  });

  // `project` is what identifies her project; "none" means no folder open.
  function remembering(store: ChatStore, project: string | "none" = PROJECT) {
    const chat = new ChatLog(() => memory.changed());
    const memory: ChatMemory = new ChatMemory(store, chat, () => (project === "none" ? undefined : project));
    memories.push(memory);
    return { chat, memory };
  }

  it("saves the chat, and brings it back before anything asked while it loaded", async () => {
    const generation = sharedGeneration();
    const first = remembering(new ChatStore(folder, generation));
    await first.memory.start();
    first.chat.respond("I finished my homework", "Yay!");
    await first.memory.flush();

    const later = remembering(new ChatStore(folder, generation));
    // She asks something before the saved chat has loaded.
    const loading = later.memory.start();
    later.chat.say("A quick line.");
    await loading;
    assert.deepStrictEqual(later.chat.entries().map((e) => e.text), ["I finished my homework", "Yay!", "A quick line."]);
  });

  it("says once, kindly, when the chat can't be saved, and keeps working", async () => {
    const store = new ChatStore(folder, sharedGeneration());
    store.save = async () => {
      throw new Error("disk full");
    };
    const { chat, memory } = remembering(store);
    await memory.start();
    chat.say("one");
    await memory.flush();
    chat.say("two");
    await memory.flush();
    const lines = chat.entries().map((e) => e.text);
    assert.strictEqual(lines.filter((line) => line.startsWith(chatStrings.couldntSave("x").slice(0, 20))).length, 1, lines.join(" | "));
    assert.ok(lines.includes("two"), "The chat keeps working.");
  });

  it("never saves an old chat back after Forget everything in another window", async () => {
    const generation = sharedGeneration();
    const here = remembering(new ChatStore(folder, generation));
    await here.memory.start();
    here.chat.say("an old line");
    await new ChatStore(folder, generation).forgetAll();
    await here.memory.flush();
    assert.deepStrictEqual(here.chat.entries(), [], "This window's chat goes too.");
    assert.deepStrictEqual((await new ChatStore(folder, generation).load(PROJECT)).entries, []);
  });

  it("clears this project's chat, on screen and on disk", async () => {
    const generation = sharedGeneration();
    const { chat, memory } = remembering(new ChatStore(folder, generation));
    await memory.start();
    chat.say("a line");
    await memory.flush();
    await memory.clear();
    await memory.flush();
    assert.deepStrictEqual(chat.entries(), []);
    assert.deepStrictEqual((await new ChatStore(folder, generation).load(PROJECT)).entries, []);
  });

  it("forgets every chat with Forget everything", async () => {
    const generation = sharedGeneration();
    const { chat, memory } = remembering(new ChatStore(folder, generation));
    await memory.start();
    chat.say("a line");
    await memory.flush();
    await memory.forgetAll();
    assert.deepStrictEqual(chat.entries(), []);
    assert.deepStrictEqual(fs.readdirSync(folder), ["generation"]);
  });

  it("keeps a chat with no folder open only until VS Code closes", async () => {
    const { chat, memory } = remembering(new ChatStore(folder, sharedGeneration()), "none");
    await memory.start();
    chat.say("a line");
    await memory.flush();
    const files = fs.existsSync(folder) ? fs.readdirSync(folder).filter((name) => name.endsWith(".json")) : [];
    assert.deepStrictEqual(files, [], "Nothing is written for a window with no folder.");
  });
});
