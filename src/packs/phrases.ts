// Picks what Mochi says from a pack. Plain code with no VS Code dependency.
import { Moment, Pack, fill, usesName } from "./format";

// After this hour, and until early morning, it's late night (see MOMENTS.md).
export const LATE_HOUR = 23;
const MORNING_HOUR = 5;

export type TimeOfDay = "morning" | "afternoon" | "evening" | "late";

export function timeOfDay(hour: number, lateHour: number = LATE_HOUR): TimeOfDay {
  if (hour >= lateHour || hour < MORNING_HOUR) {
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
export function greeting(pack: Pack, now: Date, random?: () => number): string {
  const time = timeOfDay(now.getHours());
  return time === "late"
    ? pickPhrase(pack, "greetingLate", {}, random)
    : pickPhrase(pack, "greeting", { timeOfDay: time }, random);
}
