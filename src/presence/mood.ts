// What the status bar mood line says for each mood. Plain code with no
// VS Code dependency, so the rules can be unit tested alone.
import { toSpeakUp } from "../moments/gatekeeper";

export type Mood = "here" | "purring" | "napping";

export interface MoodLine {
  text: string;
  tooltip: string;
  // Read by screen readers instead of the icon and text.
  label: string;
}

const lines: Record<Mood, MoodLine> = {
  here: {
    text: "$(mochi-here) Mochi is here",
    tooltip: "Open Mochi",
    label: "Mochi is here. Open Mochi.",
  },
  purring: {
    text: "$(mochi-purring) Mochi is purring",
    tooltip: "Open Mochi",
    label: "Mochi is purring. Open Mochi.",
  },
  napping: {
    text: "$(mochi-napping) Mochi is napping",
    tooltip: "Open Mochi",
    label: "Mochi is napping. Open Mochi.",
  },
};

const quietLine: MoodLine = {
  text: "$(mochi-napping) Mochi is napping",
  tooltip: "Quiet mode. Click to open Mochi.",
  label: "Mochi is napping. Quiet mode. Open Mochi.",
};

function focusLine(minutesLeft: number): MoodLine {
  const left = `${minutesLeft} min left`;
  return {
    text: `$(mochi-here) Focusing · ${left}`,
    tooltip: "Focus session. Click to stop it or open Mochi.",
    label: `Focusing, ${left}. Stop the session or open Mochi.`,
  };
}

function breakLine(minutesLeft: number): MoodLine {
  const left = `${minutesLeft} min left`;
  return {
    text: `$(mochi-purring) Break · ${left}`,
    tooltip: "Break time. Click to open Mochi.",
    label: `Break, ${left}. Open Mochi.`,
  };
}

// The same line for the panel (MOCHI-16): which icon, and the words without
// the "$(mochi-...)" icon code.
export function moodParts(line: MoodLine): { glyph: Mood; words: string } {
  const match = /^\$\(mochi-(here|purring|napping)\) (.*)$/.exec(line.text);
  return match ? { glyph: match[1] as Mood, words: match[2] } : { glyph: "here", words: line.text };
}

// What the mood line shows (see PRESENCE.md):
// - A focus session or a break she started always shows, even in quiet
//   mode.
// - Otherwise, in quiet mode, napping wins over anything Mochi starts.
export function moodLine(speakUp: unknown, mood: Mood = "purring", focusMinutesLeft?: number, breakMinutesLeft?: number): MoodLine {
  if (focusMinutesLeft !== undefined) {
    return focusLine(focusMinutesLeft);
  }
  if (breakMinutesLeft !== undefined) {
    return breakLine(breakMinutesLeft);
  }
  return toSpeakUp(speakUp) === "quiet" ? quietLine : lines[mood];
}
