// Checking what she changes on the "Make it yours" page (MOCHI-43), before
// anything is saved. Plain code with no VS Code dependency. A value that
// doesn't fit gets a kind hint and isn't saved.
import { MAX_FOCUS_MINUTES, MIN_FOCUS_MINUTES } from "../focus/timer";
import { LIMITS, Moment, PackLayer, TEXT_DIRECTION, placeholdersFor, usesName } from "../packs/format";
import { nameProblem } from "../packs/personalLayer";
import { GIFT_LIMITS } from "../packs/gift";
import { personalStrings, yoursStrings } from "../strings";
import { FieldId } from "./messages";

export type Checked = { ok: true; value: string | number | boolean } | { ok: false; hint: string };

const SPEAK_UP = ["quiet", "gentle", "chatty"];

// A whole number, from what the page sent (a number, or text she typed).
function wholeNumber(value: unknown): number | undefined {
  const number = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : NaN;
  return Number.isInteger(number) ? number : undefined;
}

export function checkEdit(field: FieldId, value: unknown): Checked {
  switch (field) {
    // The same checks, and kind words, as "What should I call you?".
    case "name": {
      const problem = typeof value === "string" ? nameProblem(value) : yoursStrings.pickOne;
      return problem ? { ok: false, hint: problem } : { ok: true, value: (value as string).trim() };
    }
    case "speakUp":
      return typeof value === "string" && SPEAK_UP.includes(value) ? { ok: true, value } : { ok: false, hint: yoursStrings.pickOne };
    case "learningMode":
      return typeof value === "boolean" ? { ok: true, value } : { ok: false, hint: yoursStrings.pickOne };
    case "focusMinutes": {
      const minutes = wholeNumber(value);
      return minutes !== undefined && minutes >= MIN_FOCUS_MINUTES && minutes <= MAX_FOCUS_MINUTES
        ? { ok: true, value: minutes }
        : { ok: false, hint: yoursStrings.focusRange(MIN_FOCUS_MINUTES, MAX_FOCUS_MINUTES) };
    }
    case "lateHour": {
      const hour = wholeNumber(value);
      return hour !== undefined && hour >= 0 && hour <= 23 ? { ok: true, value: hour } : { ok: false, hint: yoursStrings.hourRange };
    }
    // Style notes and lines have their own checks, below.
    default:
      return { ok: false, hint: yoursStrings.pickOne };
  }
}

// Her own lines for a moment, from the box (one per row): checked the way
// the pack format will, but with kind words. Empty means Mochi's own lines.
export function checkLines(moment: Moment, value: unknown): { ok: true; lines: string[] } | { ok: false; hint: string } {
  if (typeof value !== "string") {
    return { ok: false, hint: yoursStrings.pickOne };
  }
  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "");
  if (lines.length > LIMITS.phrasesPerMoment) {
    return { ok: false, hint: yoursStrings.tooManyLines(LIMITS.phrasesPerMoment) };
  }
  const allowed = placeholdersFor(moment);
  for (const [index, line] of lines.entries()) {
    if (line.length > LIMITS.phrase) {
      return { ok: false, hint: yoursStrings.lineTooLong(index + 1, LIMITS.phrase) };
    }
    if (/[\u0000-\u001F\u007F]/.test(line) || TEXT_DIRECTION.test(line)) {
      return { ok: false, hint: yoursStrings.hiddenCharacters(index + 1) };
    }
    for (const [, key] of line.matchAll(/\{([^{}]*)\}/g)) {
      if (!allowed.includes(key)) {
        return { ok: false, hint: yoursStrings.unknownPlaceholder(index + 1, key) };
      }
    }
  }
  if (lines.length > 0 && lines.every(usesName)) {
    return { ok: false, hint: yoursStrings.needsNoName };
  }
  return { ok: true, lines };
}

// Her style notes: a few words, or nothing for Mochi's usual style.
export function checkStyle(value: unknown): { ok: true; style: string } | { ok: false; hint: string } {
  if (typeof value !== "string") {
    return { ok: false, hint: yoursStrings.pickOne };
  }
  const style = value.trim();
  if (style.length > LIMITS.style) {
    return { ok: false, hint: yoursStrings.styleTooLong(LIMITS.style) };
  }
  if (/[\u0000-\u0008\u000B-\u001F\u007F]/.test(style) || TEXT_DIRECTION.test(style)) {
    return { ok: false, hint: yoursStrings.hiddenCharacters(1) };
  }
  return { ok: true, style };
}

// A name on a gift (MOCHI-55): hers, or the maker's. The same checks and
// kind words as her own name, but empty is fine: it means no name.
export function checkGiftName(value: unknown): { ok: true; name?: string } | { ok: false; hint: string } {
  if (typeof value !== "string") {
    return { ok: false, hint: yoursStrings.pickOne };
  }
  if (value.trim() === "") {
    return { ok: true };
  }
  const problem = nameProblem(value);
  return problem ? { ok: false, hint: problem } : { ok: true, name: value.trim() };
}

// The maker's note on a gift: a few sentences, line breaks allowed, or
// nothing.
export function checkNote(value: unknown): { ok: true; note?: string } | { ok: false; hint: string } {
  if (typeof value !== "string") {
    return { ok: false, hint: yoursStrings.pickOne };
  }
  const note = value.replace(/\r\n?/g, "\n").trim();
  if (note.length > GIFT_LIMITS.note) {
    return { ok: false, hint: yoursStrings.styleTooLong(GIFT_LIMITS.note) };
  }
  if (/[\u0000-\u0008\u000B-\u001F\u007F]/.test(note) || TEXT_DIRECTION.test(note)) {
    return { ok: false, hint: personalStrings.nameHidden };
  }
  return note ? { ok: true, note } : { ok: true };
}

// A layer with one touch changed: the style notes, or one moment's lines.
// Empty means Mochi's own again, so that part is left out of the layer.
export function withTouch(layer: PackLayer | undefined, touch: "style" | Moment, value: unknown): { ok: true; layer: PackLayer } | { ok: false; hint: string } {
  const next: PackLayer = { format: 1, ...layer };
  if (touch === "style") {
    const style = checkStyle(value);
    if (!style.ok) {
      return style;
    }
    const { style: _old, ...voice } = next.voice ?? {};
    next.voice = style.style ? { ...voice, style: style.style } : voice;
    if (Object.keys(next.voice).length === 0) {
      delete next.voice;
    }
    return { ok: true, layer: next };
  }
  const lines = checkLines(touch, value);
  if (!lines.ok) {
    return lines;
  }
  const { [touch]: _old, ...phrases } = next.phrases ?? {};
  next.phrases = lines.lines.length ? { ...phrases, [touch]: lines.lines } : phrases;
  if (Object.keys(next.phrases).length === 0) {
    delete next.phrases;
  }
  return { ok: true, layer: next };
}
