// The gift file (MOCHI-55): a personal layer made for someone else, saved as
// one .mochigift file. Plain code with no VS Code dependency. See
// docs/PACKS.md, "The gift file".
//
// A gift is plain JSON text, never a zip, so there's nothing to unpack. The
// layer inside is checked like any personal layer (it can't replace Mochi's
// personality), and a note and the maker's name can come along for the
// "You've got a gift!" screen. Neither one is sent to the AI or becomes part
// of her voice. A gift can't carry settings, the brain, keys, or chats: the
// format has no place for them, and the writer copies only what it knows.
import { packStrings } from "../strings";
import { Checked, MOMENTS, Moment, PACK_FORMAT, PackLayer, checkName, checkPersonalLayer, checkText, isObject, onlyKeys } from "./format";

export const GIFT_FORMAT = 1;
export const GIFT_EXTENSION = "mochigift";

export const GIFT_LIMITS = {
  // The maker's name, on one line, like her name.
  from: 30,
  // A few sentences for her.
  note: 300,
};

export interface Gift {
  mochigift: typeof GIFT_FORMAT;
  // Who made it, as she knows them.
  from?: string;
  // A note for her, shown when she unwraps it.
  note?: string;
  layer: PackLayer;
}

// True if a layer sets nothing, so a gift of it would have nothing to unwrap.
export function layerIsEmpty(layer: PackLayer): boolean {
  return (
    layer.name === undefined &&
    layer.voice?.style === undefined &&
    layer.user?.name === undefined &&
    !MOMENTS.some((moment) => layer.phrases?.[moment] !== undefined)
  );
}

// The maker's name, the note, and the layer, checked the same way in a gift
// and in a gift being made. The layer, if it passed.
function checkParts(input: Record<string, unknown>, errors: string[]): PackLayer | undefined {
  if (input.from !== undefined) {
    checkName(input.from, '"from"', errors);
  }
  if (input.note !== undefined) {
    checkText(input.note, GIFT_LIMITS.note, '"note"', errors);
  }
  const layer = checkPersonalLayer(input.layer);
  if (!layer.ok) {
    errors.push(...layer.errors);
    return undefined;
  }
  return layer.value;
}

// Checks a gift strictly: the envelope, then the layer, the same way her own
// personal layer is checked.
export function checkGift(input: unknown): Checked<Gift> {
  if (!isObject(input)) {
    return { ok: false, errors: [packStrings.giftNotObject] };
  }
  const errors: string[] = [];
  onlyKeys(input, ["mochigift", "from", "note", "layer"], "The gift", errors);
  if (input.mochigift !== GIFT_FORMAT) {
    errors.push(packStrings.giftFormat(GIFT_FORMAT));
  }
  const layer = checkParts(input, errors);
  if (layer && layerIsEmpty(layer)) {
    errors.push(packStrings.giftEmpty);
  }
  return errors.length ? { ok: false, errors } : { ok: true, value: input as unknown as Gift };
}

// A gift being made, before it's saved as a file. It may still be empty.
export type GiftDraft = Omit<Gift, "mochigift">;

export function checkGiftDraft(input: unknown): Checked<GiftDraft> {
  if (!isObject(input)) {
    return { ok: false, errors: [packStrings.giftNotObject] };
  }
  const errors: string[] = [];
  onlyKeys(input, ["from", "note", "layer"], "The gift", errors);
  checkParts(input, errors);
  return errors.length ? { ok: false, errors } : { ok: true, value: input as unknown as GiftDraft };
}

// Copies only the fields a layer may have, in a fixed order, so nothing else
// that happens to be on the object (a setting, a key) can end up in a file.
function copyLayer(layer: PackLayer): PackLayer {
  const copy: PackLayer = { format: PACK_FORMAT };
  if (layer.name !== undefined) {
    copy.name = layer.name;
  }
  if (layer.voice?.style !== undefined) {
    copy.voice = { style: layer.voice.style };
  }
  const phrases: Partial<Record<Moment, string[]>> = {};
  for (const moment of MOMENTS) {
    const lines = layer.phrases?.[moment];
    if (lines !== undefined) {
      phrases[moment] = [...lines];
    }
  }
  if (Object.keys(phrases).length) {
    copy.phrases = phrases;
  }
  if (layer.user?.name !== undefined) {
    copy.user = { name: layer.user.name };
  }
  return copy;
}

// The text of a gift file: readable JSON with Unix line endings and a final
// line break, the same on every system. Checked before it's written, so
// Mochi never saves a gift it wouldn't unwrap.
export function giftText(gift: GiftDraft): Checked<string> {
  const envelope: Gift = {
    mochigift: GIFT_FORMAT,
    ...(gift.from !== undefined && { from: gift.from }),
    ...(gift.note !== undefined && { note: gift.note }),
    layer: copyLayer(gift.layer),
  };
  const checked = checkGift(envelope);
  return checked.ok ? { ok: true, value: `${JSON.stringify(envelope, null, 2)}\n` } : checked;
}
