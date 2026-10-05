// The late-night nudge (MOCHI-35). Plain code with no VS Code dependency.
import { maySpeak } from "./gatekeeper";

export const DEFAULT_LATE_HOUR = 23;
// Late night lasts until this hour in the morning.
export const MORNING_HOUR = 5;

// Settings can be typed by hand, so anything unexpected is 23:00.
export function toLateHour(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 23
    ? value
    : DEFAULT_LATE_HOUR;
}

// Late from the late hour until 5:00. A late hour after midnight (like 1)
// means only 1:00 to 5:00 is late.
export function isLate(hour: number, lateHour: number = DEFAULT_LATE_HOUR): boolean {
  return lateHour >= MORNING_HOUR
    ? hour >= lateHour || hour < MORNING_HOUR
    : hour >= lateHour && hour < MORNING_HOUR;
}

// Which night a moment belongs to: 1:30 on the 6th is still the night of
// the 5th. Used so there's only one nudge per night.
export function nightOf(now: Date): string {
  const day = new Date(now);
  if (day.getHours() < MORNING_HOUR) {
    day.setDate(day.getDate() - 1);
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
}

export interface LateNightCheck {
  now: Date;
  lateHour: number;
  speakUp: unknown;
  // The night she was last nudged, if ever (see nightOf).
  lastNudgedNight: string | undefined;
  focusing: boolean;
  theme: "light" | "dark" | "highContrast";
}

// "dim" offers a darker theme, "company" just keeps her company, and
// undefined means no nudge right now. Checked when she types, so it only
// happens while she's actually coding.
export function lateNightNudge(check: LateNightCheck): "dim" | "company" | undefined {
  if (
    !isLate(check.now.getHours(), check.lateHour) ||
    !maySpeak({ place: "nudge" }, check.speakUp) ||
    // Never during a focus session she started; her next typing after it
    // ends gets the nudge instead.
    check.focusing ||
    check.lastNudgedNight === nightOf(check.now)
  ) {
    return undefined;
  }
  // Only a light theme gets the dim offer. Dark and every high contrast
  // theme, light or dark, get company only.
  return check.theme === "light" ? "dim" : "company";
}
