// Picks what Mochi says from a pack. Plain code with no VS Code dependency.
import { DEFAULT_LATE_HOUR, isLate } from "../moments/lateNight";
import { Moment, Pack, fill, usesName } from "./format";

export type TimeOfDay = "morning" | "afternoon" | "evening" | "late";

// The late hour is a setting, 23:00 by default (see moments/lateNight.ts).
export function timeOfDay(hour: number, lateHour: number = DEFAULT_LATE_HOUR): TimeOfDay {
  if (isLate(hour, lateHour)) {
    return "late";
  }
  if (hour < 12) {
    return "morning";
  }
  return hour < 17 ? "afternoon" : "evening";
}

// Picks one line for a moment and fills it in. Lines with {name} are only
// picked when she has set a name. `random` is passed in so tests can choose.
export function pickPhrase(
  pack: Pack,
  moment: Moment,
  values: Record<string, string> = {},
  random: () => number = Math.random
): string {
  const name = pack.user?.name;
  const usable = pack.phrases[moment].filter((phrase) => name || !usesName(phrase));
  const phrase = usable[Math.floor(random() * usable.length)];
  return fill(phrase, { ...values, companion: pack.name, ...(name ? { name } : {}) });
}

// The greeting for when VS Code opens. After the late-night hour it's a
// night-owl greeting, because "Good night" sounds like goodbye.
export function greeting(pack: Pack, now: Date, random?: () => number, lateHour?: number): string {
  const time = timeOfDay(now.getHours(), lateHour);
  return time === "late"
    ? pickPhrase(pack, "greetingLate", {}, random)
    : pickPhrase(pack, "greeting", { timeOfDay: time }, random);
}
