import * as assert from "node:assert";
import { loadDefaultPack } from "../../packs/defaultPack";
import { PackLayer } from "../../packs/format";
import { GiftDrafts } from "../../packs/giftDraft";
import { LAYER_KEY } from "../../packs/personalLayer";
import { checkGiftName, checkNote } from "../../yours/edits";
import { giftActions, previewLines, startFrom } from "../../yours/giftActions";
import { GIFT_PARTS, toFromYours } from "../../yours/messages";

// "Make a gift" (MOCHI-55), with a real draft store over a pretend
// globalState that also holds her own layer.
function setUp(mine?: PackLayer, answer = true) {
  const data = new Map<string, unknown>(mine ? [[LAYER_KEY, mine]] : []);
  const store = { get: (key: string) => data.get(key), update: async (key: string, value: unknown) => void data.set(key, value) };
  const drafts = new GiftDrafts(store);
  const pack = loadDefaultPack();
  const asked: string[] = [];
  const actions = giftActions({
    draft: () => drafts.draft(),
    saveDraft: (draft) => drafts.save(draft),
    myLayer: () => data.get(LAYER_KEY) as PackLayer | undefined,
    base: pack,
    confirm: async (question) => (asked.push(question), answer),
  });
  return { actions, drafts, data, asked };
}

const mine: PackLayer = { format: 1, user: { name: "Alex" }, voice: { style: "Calm." }, phrases: { stuck: ["Mine!"], celebrate: ["Go {thing}!"] } };

describe("Make a gift", () => {
  it("saves what she writes into the gift, never into her own layer", async () => {
    const { actions, drafts, data } = setUp(mine);
    for (const [field, value] of [
      ["gift.name", " Sam "],
      ["gift.from", "Alex"],
      ["gift.note", "Happy birthday!\r\nMochi is all yours."],
      ["gift.style", "Extra sleepy."],
      ["gift.lines.stuck", "Need a paw?\n\nI'm here!"],
    ] as const) {
      assert.deepStrictEqual(await actions.edit(field, value), { ok: true }, field);
    }
    assert.deepStrictEqual(drafts.draft(), {
      from: "Alex",
      note: "Happy birthday!\nMochi is all yours.",
      layer: { format: 1, user: { name: "Sam" }, voice: { style: "Extra sleepy." }, phrases: { stuck: ["Need a paw?", "I'm here!"] } },
    });
    assert.deepStrictEqual(data.get(LAYER_KEY), mine);
  });

  it("clears a name, the note, or lines when she empties them", async () => {
    const { actions, drafts } = setUp();
    await actions.edit("gift.name", "Sam");
    await actions.edit("gift.from", "Alex");
    await actions.edit("gift.note", "Hi!");
    await actions.edit("gift.lines.stuck", "Paw?");
    for (const field of ["gift.name", "gift.from", "gift.note", "gift.lines.stuck"] as const) {
      await actions.edit(field, "  ");
    }
    assert.deepStrictEqual(drafts.draft(), { layer: { format: 1 } });
  });

  it("saves nothing that doesn't fit, and says why kindly", async () => {
    const { actions, drafts } = setUp();
    await actions.edit("gift.name", "Sam");
    const before = drafts.draft();
    for (const [field, value] of [
      ["gift.name", "x".repeat(31)],
      ["gift.from", "Alex\nBob"],
      ["gift.note", "x".repeat(301)],
      ["gift.note", "Hi ‮olleh"],
      ["gift.lines.stuck", "Stuck on {thing}?"],
      ["gift.style", 42],
    ] as const) {
      const result = await actions.edit(field, value);
      assert.ok(!result.ok && result.hint, `${field} ${String(value).slice(0, 20)}`);
    }
    assert.deepStrictEqual(drafts.draft(), before);
  });

  it("never changes her settings or her own touches, even if asked", async () => {
    const { actions, data } = setUp(mine);
    for (const field of ["name", "learningMode", "speakUp", "style", "lines.stuck"] as const) {
      assert.strictEqual((await actions.edit(field, "x")).ok, false, field);
    }
    assert.deepStrictEqual(data.get(LAYER_KEY), mine);
    // The page's messages can't name them either.
    assert.strictEqual(toFromYours({ type: "edit", field: "learningMode", value: false }, GIFT_PARTS), undefined);
    assert.strictEqual(toFromYours({ type: "button", button: "removeClaudeKey" }, GIFT_PARTS), undefined);
    assert.ok(toFromYours({ type: "edit", field: "gift.note", value: "Hi" }, GIFT_PARTS));
  });

  it("offers Start from my touches only when she has some", async () => {
    const buttons = async (layer?: PackLayer) =>
      (await setUp(layer).actions.state()).sections
        .flatMap((section) => section.fields)
        .flatMap((field) => (field.kind === "actions" ? field.buttons.map((button) => button.id) : []));
    assert.ok((await buttons(mine)).includes("startFromMine"));
    assert.ok(!(await buttons({ format: 1, user: { name: "Alex" } })).includes("startFromMine"));
    assert.ok(!(await buttons()).includes("startFromMine"));
  });

  it("starts from her touches without her name, keeping what the gift has", async () => {
    const { actions, drafts } = setUp(mine);
    await actions.edit("gift.lines.stuck", "Gift line");
    await actions.button("startFromMine");
    assert.deepStrictEqual(drafts.draft().layer, { format: 1, voice: { style: "Calm." }, phrases: { stuck: ["Gift line"], celebrate: ["Go {thing}!"] } });
    assert.deepStrictEqual(startFrom({ format: 1, voice: { style: "Gift." } }, mine).voice, { style: "Gift." });
  });

  it("starts over only after a clear yes", async () => {
    const kept = setUp(undefined, false);
    await kept.actions.edit("gift.name", "Sam");
    await kept.actions.button("startOver");
    assert.strictEqual(kept.drafts.draft().layer.user?.name, "Sam");
    assert.deepStrictEqual(kept.asked, ["Start over?"]);

    const cleared = setUp();
    await cleared.actions.edit("gift.name", "Sam");
    await cleared.actions.button("startOver");
    assert.deepStrictEqual(cleared.drafts.draft(), { layer: { format: 1 } });
  });

  describe("the preview", () => {
    const base = loadDefaultPack();

    it("says the gift's lines where it has them, and Mochi's own elsewhere, filled in", () => {
      const lines = previewLines(base, { format: 1, user: { name: "Sam" }, phrases: { celebrate: ["Paws up, {thing}!"], stuck: ["Need a paw?"] } }, 0);
      const by = Object.fromEntries(lines.map(({ moment, line }) => [moment, line]));
      assert.strictEqual(by.stuck, "Need a paw?");
      assert.strictEqual(by.celebrate, "Paws up, your homework!");
      assert.strictEqual(lines.length, 9);
      for (const { moment, line } of lines) {
        assert.doesNotMatch(line, /\{[^}]*\}|undefined/, `${moment}: ${line}`);
      }
    });

    it("uses lines with {name} only when the gift has a name", () => {
      const greeting = { greeting: ["Hi, {name}!", "Hello there!"] };
      const withName = [0, 1].map((turn) => previewLines(base, { format: 1, user: { name: "Sam" }, phrases: greeting }, turn)[0].line);
      assert.deepStrictEqual(withName, ["Hi, Sam!", "Hello there!"]);
      const without = [0, 1].map((turn) => previewLines(base, { format: 1, phrases: greeting }, turn)[0].line);
      assert.deepStrictEqual(without, ["Hello there!", "Hello there!"]);
    });

    it("shows the latest after each change, and another line when asked", async () => {
      const { actions } = setUp();
      await actions.edit("gift.lines.stuck", "One\nTwo");
      const stuck = () => actions.preview!().items.find((item) => item.label === "When you're stuck")!.line;
      assert.strictEqual(stuck(), "One");
      await actions.button("anotherLine");
      assert.strictEqual(stuck(), "Two");
      const state = await actions.state();
      assert.ok(state.sections.some((section) => section.fields.some((field) => field.kind === "preview")));
    });

    it("explains style notes only when the gift has some", async () => {
      const { actions } = setUp();
      assert.strictEqual(actions.preview!().note, undefined);
      await actions.edit("gift.style", "Sleepy.");
      assert.ok(actions.preview!().note);
    });
  });

  describe("checking names and the note", () => {
    it("takes a name like hers, or nothing", () => {
      assert.deepStrictEqual(checkGiftName(" Sam "), { ok: true, name: "Sam" });
      assert.deepStrictEqual(checkGiftName(""), { ok: true });
      for (const odd of ["x".repeat(31), "Sam\nAlex", "Sam\u0007", 5]) {
        assert.strictEqual(checkGiftName(odd).ok, false, String(odd));
      }
    });

    it("takes a short note with line breaks, in Unix line endings", () => {
      assert.deepStrictEqual(checkNote(" One\r\nTwo\rThree "), { ok: true, note: "One\nTwo\nThree" });
      assert.deepStrictEqual(checkNote("  "), { ok: true });
      for (const odd of ["x".repeat(301), "Hi\u0000", "Hi ⁦there", null]) {
        assert.strictEqual(checkNote(odd).ok, false, String(odd));
      }
    });
  });
});
