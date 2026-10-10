import * as assert from "node:assert";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { ChatStore, Generation, MAX_MESSAGES, MAX_PROJECTS, SavedEntry, projectFile, toSavedChat } from "../../panel/chatStore";

// globalState's generation, shared by every "window" in a test.
function sharedGeneration(): Generation & { value?: string } {
  const generation: Generation & { value?: string } = {
    get: () => generation.value,
    set: async (value) => {
      generation.value = value;
    },
  };
  return generation;
}

const hi: SavedEntry[] = [
  { from: "her", text: "what's a list?" },
  { from: "mochi", text: "A list is a row of boxes." },
];

describe("saved chats", () => {
  let root: string;
  let folder: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "mochi-chats-"));
    folder = path.join(root, "chats");
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  it("brings a project's chat back, and keeps each project's apart", async () => {
    const store = new ChatStore(folder, sharedGeneration());
    const { since } = await store.load("file:///homework-3");
    assert.strictEqual(await store.save("file:///homework-3", hi, since), "saved");

    const again = new ChatStore(folder, sharedGeneration());
    assert.deepStrictEqual((await again.load("file:///homework-3")).entries, hi);
    assert.deepStrictEqual(await again.load("file:///homework-4"), { entries: [], damaged: false, since: 0 });
  });

  it("names files by a hash, so no folder name or path shows", async () => {
    const store = new ChatStore(folder, sharedGeneration());
    const { since } = await store.load("file:///Users/sam/homework-3");
    await store.save("file:///Users/sam/homework-3", hi, since);
    const names = fs.readdirSync(folder);
    assert.ok(names.includes(projectFile("file:///Users/sam/homework-3")));
    assert.ok(names.every((name) => !/sam|homework/.test(name)), names.join(", "));
  });

  it("keeps the newest 200 messages", async () => {
    const store = new ChatStore(folder, sharedGeneration());
    const many: SavedEntry[] = Array.from({ length: MAX_MESSAGES + 5 }, (_, i) => ({ from: "her", text: `message ${i}` }));
    const { since } = await store.load("p");
    await store.save("p", many, since);
    const { entries } = await store.load("p");
    assert.strictEqual(entries.length, MAX_MESSAGES);
    assert.strictEqual(entries[0].text, "message 5");
  });

  it("keeps the chats of her 20 most recent projects", async () => {
    const store = new ChatStore(folder, sharedGeneration());
    const { since } = await store.load("project 0");
    for (let i = 0; i <= MAX_PROJECTS; i++) {
      await store.save(`project ${i}`, hi, since);
      // Each save a little later than the one before.
      const file = path.join(folder, projectFile(`project ${i}`));
      const at = new Date(Date.now() - (MAX_PROJECTS - i) * 60_000);
      fs.utimesSync(file, at, at);
    }
    assert.deepStrictEqual((await store.load("project 0")).entries, [], "The oldest project's chat fell off.");
    assert.deepStrictEqual((await store.load("project 1")).entries, hi);
    assert.deepStrictEqual((await store.load(`project ${MAX_PROJECTS}`)).entries, hi);
  });

  it("never writes in place: a temp file, then a rename, with nothing left behind", async () => {
    const store = new ChatStore(folder, sharedGeneration());
    const { since } = await store.load("p");
    await store.save("p", hi, since);
    await store.save("p", [...hi, { from: "her", text: "thanks!" }], since);
    assert.deepStrictEqual(fs.readdirSync(folder).sort(), ["generation", projectFile("p")].sort());
  });

  it("cleans up a temp file a crash left behind", async () => {
    const store = new ChatStore(folder, sharedGeneration());
    const { since } = await store.load("p");
    const leftover = path.join(folder, `${projectFile("p")}.crash.tmp`);
    fs.writeFileSync(leftover, '{"version":1,"messages":[{"from":"her","te');
    const old = new Date(Date.now() - 5 * 60_000);
    fs.utimesSync(leftover, old, old);
    await store.save("p", hi, since);
    assert.ok(!fs.existsSync(leftover));
  });

  it("starts an empty chat when the file is damaged, without throwing", async () => {
    const store = new ChatStore(folder, sharedGeneration());
    await store.load("p");
    for (const broken of ["{not json", "[]", '{"version":99,"messages":[]}', '{"version":1,"messages":[{"from":"cat","text":"hi"}]}']) {
      fs.writeFileSync(path.join(folder, projectFile("p")), broken);
      const loaded = await store.load("p");
      assert.deepStrictEqual([loaded.entries, loaded.damaged], [[], true], broken);
    }
  });

  it("starts an empty chat when the file can't be read", async () => {
    const store = new ChatStore(folder, sharedGeneration());
    await store.load("p");
    // A folder where the file should be: reading it fails.
    fs.mkdirSync(path.join(folder, projectFile("p")));
    const loaded = await store.load("p");
    assert.deepStrictEqual([loaded.entries, loaded.damaged], [[], true]);
  });

  it("reads only what a chat can hold: no chips, nothing extra", () => {
    const text = JSON.stringify({
      version: 1,
      messages: [
        { from: "her", text: "Explain this", shared: "lines 9 to 15 of homework.py", code: "print(x)" },
        { from: "mochi", text: "I'd need a brain.", problem: true, chips: { choices: [] } },
      ],
    });
    assert.deepStrictEqual(toSavedChat(text), [
      { from: "her", text: "Explain this", shared: "lines 9 to 15 of homework.py" },
      { from: "mochi", text: "I'd need a brain.", problem: true },
    ]);
  });

  it("clears one project's chat", async () => {
    const store = new ChatStore(folder, sharedGeneration());
    const { since } = await store.load("a");
    await store.save("a", hi, since);
    await store.save("b", hi, since);
    await store.clear("a");
    assert.deepStrictEqual((await store.load("a")).entries, []);
    assert.deepStrictEqual((await store.load("b")).entries, hi);
  });

  describe("forget everything", () => {
    it("deletes every chat", async () => {
      const store = new ChatStore(folder, sharedGeneration());
      const { since } = await store.load("a");
      await store.save("a", hi, since);
      await store.save("b", hi, since);
      await store.forgetAll();
      assert.deepStrictEqual(fs.readdirSync(folder), ["generation"]);
      assert.deepStrictEqual((await store.load("a")).entries, []);
    });

    it("never lets another window save an old chat back", async () => {
      const generation = sharedGeneration();
      const here = new ChatStore(folder, generation);
      const there = new ChatStore(folder, generation);
      const loadedThere = await there.load("a");
      await here.forgetAll();
      assert.strictEqual(await there.forgottenSince(loadedThere.since), true);
      assert.strictEqual(await there.save("a", hi, loadedThere.since), "forgotten");
      assert.deepStrictEqual((await here.load("a")).entries, []);
    });

    it("holds even when the other window's view of globalState is a moment behind", async () => {
      const here = new ChatStore(folder, sharedGeneration());
      // This window never hears about the new generation.
      const lagging = new ChatStore(folder, sharedGeneration());
      const loaded = await lagging.load("a");
      await here.forgetAll();
      assert.strictEqual(await lagging.save("a", hi, loaded.since), "forgotten");
      assert.deepStrictEqual((await here.load("a")).entries, []);
    });

    it("deletes chats on another machine the next time Mochi opens them there", async () => {
      // globalState is on her own computer, shared by local and remote
      // windows; each machine has its own folder.
      const generation = sharedGeneration();
      const remoteFolder = path.join(root, "remote-chats");
      const remote = new ChatStore(remoteFolder, generation);
      const { since } = await remote.load("ssh project");
      await remote.save("ssh project", hi, since);

      await new ChatStore(folder, generation).forgetAll();

      assert.deepStrictEqual((await new ChatStore(remoteFolder, generation).load("ssh project")).entries, []);
      assert.ok(!fs.existsSync(path.join(remoteFolder, projectFile("ssh project"))));
    });

    it("saves new chats normally afterwards", async () => {
      const store = new ChatStore(folder, sharedGeneration());
      await store.load("a");
      await store.forgetAll();
      const { since } = await store.load("a");
      assert.strictEqual(await store.save("a", hi, since), "saved");
      assert.strictEqual(await store.forgottenSince(since), false);
      assert.deepStrictEqual((await store.load("a")).entries, hi);
    });
  });
});
