import * as assert from "node:assert";
import { loadDefaultPack } from "../../packs/defaultPack";
import { LAYER_KEY, PersonalLayer, UNREADABLE_KEY, nameProblem } from "../../packs/personalLayer";

const base = loadDefaultPack();

// A pretend globalState, plus a record of what Mochi told her.
function setUp(stored?: unknown) {
  const data = new Map<string, unknown>(stored === undefined ? [] : [[LAYER_KEY, stored]]);
  const warnings: string[] = [];
  const store = { get: (key: string) => data.get(key), update: async (key: string, value: unknown) => void data.set(key, value) };
  return { data, warnings, personal: new PersonalLayer(store, base, (m) => warnings.push(m)) };
}

describe("her personal layer", () => {
  it("is just the default pack when she hasn't set anything", () => {
    const { personal, warnings } = setUp();
    assert.strictEqual(personal.pack(), base);
    assert.deepStrictEqual(warnings, []);
  });

  it("keeps her name, and uses it right away, with no reload", async () => {
    const { personal } = setUp();
    assert.ok((await personal.setName("  Sam ")).ok);
    assert.strictEqual(personal.name(), "Sam");
    assert.strictEqual(personal.pack().user?.name, "Sam");
  });

  it("forgets her name, keeping her other touches", async () => {
    const { personal, data } = setUp({ format: 1, user: { name: "Sam" }, phrases: { stuck: ["Paw?"] } });
    assert.strictEqual(await personal.forgetName(), true);
    assert.strictEqual(personal.name(), undefined);
    assert.deepStrictEqual(personal.pack().phrases.stuck, ["Paw?"]);
    assert.deepStrictEqual(data.get(LAYER_KEY), { format: 1, phrases: { stuck: ["Paw?"] } });
  });

  it("leaves nothing behind when her name was all there was", async () => {
    const { personal, data } = setUp({ format: 1, user: { name: "Sam" } });
    await personal.forgetName();
    assert.strictEqual(data.get(LAYER_KEY), undefined);
    assert.strictEqual(await personal.forgetName(), false, "Nothing left to forget.");
  });

  it("refuses to save a layer that doesn't pass the checks", async () => {
    const { personal, data } = setUp();
    const result = await personal.save({ format: 1, voice: { personality: "Something else." } });
    assert.ok(!result.ok);
    assert.strictEqual(data.get(LAYER_KEY), undefined);
  });

  it("forgets everything, including an unreadable layer kept aside", async () => {
    const { personal, data } = setUp({ format: 2 });
    await personal.setName("Sam");
    await personal.forgetAll();
    assert.strictEqual(data.get(LAYER_KEY), undefined);
    assert.strictEqual(data.get(UNREADABLE_KEY), undefined);
    assert.strictEqual(personal.pack(), base);
  });

  describe("a damaged or too-new layer", () => {
    const damaged = { format: 2, user: { name: "Sam" } };

    it("falls back to the default pack and tells her once, kindly", () => {
      const { personal, warnings } = setUp(damaged);
      assert.strictEqual(personal.pack(), base);
      personal.pack();
      assert.strictEqual(warnings.length, 1);
      assert.match(warnings[0], /my usual self/);
    });

    it("is kept, never deleted, when something new is saved", async () => {
      const { personal, data } = setUp(damaged);
      await personal.setName("Sam");
      assert.deepStrictEqual(data.get(UNREADABLE_KEY), damaged);
      assert.strictEqual(personal.name(), "Sam");
    });
  });

  describe("names", () => {
    it("can be anything she'd call herself, up to 30 characters on one line", () => {
      for (const name of ["Sam", "Zoë", "さくら", "{name}", "x".repeat(30)]) {
        assert.strictEqual(nameProblem(name), undefined, `${name} should be fine.`);
      }
    });

    it("explains kindly what's wrong", () => {
      assert.match(nameProblem("   ")!, /Type a name/);
      assert.match(nameProblem("x".repeat(31))!, /Up to 30 characters/);
      assert.match(nameProblem("Sam\nB")!, /one line/);
      assert.match(nameProblem("Sam‮")!, /hidden characters/);
    });
  });
});
