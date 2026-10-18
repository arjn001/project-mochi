// Checking what she changes on the "Make it yours" page (MOCHI-43), before
// anything is saved. Plain code with no VS Code dependency. A value that
// doesn't fit gets a kind hint and isn't saved.
import { MAX_FOCUS_MINUTES, MIN_FOCUS_MINUTES } from "../focus/timer";
import { nameProblem } from "../packs/personalLayer";
import { yoursStrings } from "../strings";
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
  }
}
