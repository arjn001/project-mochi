import * as assert from "node:assert";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as vscode from "vscode";
import { checkGift, giftText } from "../../packs/gift";
import { GiftFileIo, dialogIo, exportTouches, saveGiftFile } from "../../yours/giftFile";

// Saving a gift file (MOCHI-55) through VS Code's real file system, into a
// temp folder, with a pretend save dialog.

describe("saving a gift file", () => {
  let folder: string;
  beforeEach(() => (folder = fs.mkdtempSync(path.join(os.tmpdir(), "mochi-gift-"))));
  afterEach(() => fs.rmSync(folder, { recursive: true, force: true }));

  // A save dialog that picks `name` in the temp folder, and remembers being
  // asked.
  function pickIn(name: string | undefined): GiftFileIo & { asked: string[] } {
    const asked: string[] = [];
    return {
      asked,
      pick: async (defaultName) => (asked.push(defaultName), name === undefined ? undefined : vscode.Uri.file(path.join(folder, name))),
      write: dialogIo.write,
    };
  }

  const gift = { from: "Zoë", note: "For you!\nWith love.", layer: { format: 1 as const, user: { name: "さくら" }, phrases: { stuck: ["Need a paw?"] } } };

  it("writes the gift she picked a place for, exactly as checked, in UTF-8", async () => {
    const io = pickIn("for-you.mochigift");
    const saved = await saveGiftFile(gift, "for-you.mochigift", io);
    assert.strictEqual(saved.result, "saved");
    assert.deepStrictEqual(io.asked, ["for-you.mochigift"]);
    const text = fs.readFileSync(path.join(folder, "for-you.mochigift"), "utf8");
    const expected = giftText(gift);
    assert.ok(expected.ok);
    assert.strictEqual(text, expected.value);
    assert.ok(checkGift(JSON.parse(text)).ok);
    assert.strictEqual(saved.result === "saved" && saved.name, "for-you.mochigift");
  });

  it("doesn't ask where to save when there's nothing to unwrap", async () => {
    const io = pickIn("empty.mochigift");
    assert.deepStrictEqual(await saveGiftFile({ from: "Zoë", note: "Hi", layer: { format: 1 } }, "for-you.mochigift", io), { result: "empty" });
    assert.deepStrictEqual(io.asked, []);
    assert.deepStrictEqual(fs.readdirSync(folder), []);
  });

  it("writes nothing when she closes the dialog", async () => {
    assert.deepStrictEqual(await saveGiftFile(gift, "for-you.mochigift", pickIn(undefined)), { result: "cancelled" });
    assert.deepStrictEqual(fs.readdirSync(folder), []);
  });

  it("saves her own touches as a gift file with no note, named my-mochi", async () => {
    const io = pickIn("my-mochi.mochigift");
    const mine = { format: 1 as const, user: { name: "Sam" }, voice: { style: "Calm." } };
    assert.strictEqual((await exportTouches(mine, io)).result, "saved");
    assert.deepStrictEqual(io.asked, ["my-mochi.mochigift"]);
    assert.deepStrictEqual(JSON.parse(fs.readFileSync(path.join(folder, "my-mochi.mochigift"), "utf8")), { mochigift: 1, layer: mine });
  });

  it("says it failed, without throwing, when the place can't be written", async () => {
    fs.writeFileSync(path.join(folder, "not-a-folder"), "");
    const saved = await saveGiftFile(gift, "for-you.mochigift", pickIn(path.join("not-a-folder", "for-you.mochigift")));
    assert.deepStrictEqual(saved, { result: "failed" });
  });
});
