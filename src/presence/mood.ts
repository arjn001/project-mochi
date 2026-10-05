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

// In quiet mode, napping always wins over any other mood (see PRESENCE.md).
export function moodLine(speakUp: unknown, mood: Mood = "purring"): MoodLine {
  return toSpeakUp(speakUp) === "quiet" ? quietLine : lines[mood];
}
