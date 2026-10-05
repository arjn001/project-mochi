// The gatekeeper decides whether Mochi may speak up on its own, right now.
// Plain code with no VS Code dependency, so it can be unit tested alone.
// It only covers things Mochi starts. When she opens Mochi and asks
// something, Mochi always answers, whatever the speak-up level.

export type SpeakUp = "quiet" | "gentle" | "chatty";

// Where Mochi can show something (see PRESENCE.md).
export type Place = "status" | "panel" | "hint" | "nudge";

export const SPEAK_UP_LEVELS: readonly SpeakUp[] = ["quiet", "gentle", "chatty"];
export const DEFAULT_SPEAK_UP: SpeakUp = "gentle";

// Settings can be typed by hand, so anything unexpected ("loud", a number,
// nothing at all) falls back to the default instead of breaking Mochi.
export function toSpeakUp(value: unknown): SpeakUp {
  if (typeof value === "string") {
    const level = value.trim().toLowerCase();
    if ((SPEAK_UP_LEVELS as readonly string[]).includes(level)) {
      return level as SpeakUp;
    }
  }
  return DEFAULT_SPEAK_UP;
}

export interface Request {
  place: Place;
  // Fun facts and small talk, not help. Only chatty allows these.
  extra?: boolean;
}

export function maySpeak(request: Request, speakUp: unknown): boolean {
  const level = toSpeakUp(speakUp);

  if (request.extra && level !== "chatty") {
    return false;
  }
  // The mood line is always there, even in quiet mode.
  if (request.place === "status") {
    return true;
  }
  // Panel greetings, code hints, and nudges: everything but quiet.
  return level !== "quiet";
}
