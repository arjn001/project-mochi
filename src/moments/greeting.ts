// The greeting when VS Code opens (MOCHI-33). Plain code with no VS Code
// dependency.
//
// Once a day, across all her windows: the greeting line, then a warm
// welcome back after 2+ days away (never counting them), then "Back to
// homework-3?" when she opens the project she last coded in. At most three
// short sentences, never a wall of text.
import { Pack } from "../packs/format";
import { greeting, pickPhrase } from "../packs/phrases";
import { maySpeak } from "./gatekeeper";
import { nightOf } from "./lateNight";

export const WELCOME_BACK_AFTER_MS = 2 * 24 * 60 * 60_000;
// Saving when she last coded at most this often, not on every keystroke.
export const SAVE_CODING_EVERY_MS = 60_000;
export const PROJECT_NAME_MAX = 30;

// When she last typed in a file, and in which project (its folder name only).
export interface LastCoding {
  at: number;
  project?: string;
}

// Stored values can be anything (an older Mochi, a damaged store), so
// anything unexpected means "nothing known".
export function toLastCoding(value: unknown): LastCoding | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }
  const { at, project } = value as Record<string, unknown>;
  if (typeof at !== "number" || !Number.isFinite(at)) {
    return undefined;
  }
  return typeof project === "string" && project.trim() !== "" ? { at, project } : { at };
}

export const shouldSaveCoding = (lastSavedAt: number | undefined, now: number) =>
  lastSavedAt === undefined || now - lastSavedAt >= SAVE_CODING_EVERY_MS;

// The project's name as she'd say it: no remote suffix like "[SSH: lab]",
// no "(Workspace)", and nothing for an untitled workspace.
export function cleanProjectName(name: string | undefined): string | undefined {
  const clean = (name ?? "")
    .replace(/\s*\[[^\]]*\]\s*$/, "")
    .replace(/\s*\(Workspace\)\s*$/, "")
    .trim();
  return clean === "" || clean === "Untitled" ? undefined : clean;
}

// Long names are shortened, so the greeting stays short.
export const shortProjectName = (name: string) =>
  name.length > PROJECT_NAME_MAX ? `${name.slice(0, PROJECT_NAME_MAX - 1)}…` : name;

export interface GreetCheck {
  now: Date;
  speakUp: unknown;
  // A focus session she started, already running when VS Code opened.
  focusing: boolean;
  // The day she was last greeted, if ever (days run until 5:00, see nightOf).
  lastGreetedDay: string | undefined;
}

export function shouldGreet(check: GreetCheck): boolean {
  return (
    maySpeak({ place: "panel" }, check.speakUp) &&
    !check.focusing &&
    check.lastGreetedDay !== nightOf(check.now)
  );
}

export interface GreetingContext {
  now: Date;
  lateHour: number;
  // From before today's typing.
  last: LastCoding | undefined;
  // The project open now, if any.
  project: string | undefined;
  random?: () => number;
}

export function greetingText(pack: Pack, context: GreetingContext): string {
  const { now, last, project, random } = context;
  const lines = [greeting(pack, now, random, context.lateHour)];
  if (last && now.getTime() - last.at >= WELCOME_BACK_AFTER_MS) {
    lines.push(pickPhrase(pack, "welcomeBack", {}, random));
  }
  if (project && last?.project === project) {
    lines.push(pickPhrase(pack, "backToProject", { project: shortProjectName(project) }, random));
  }
  return lines.join(" ");
}

// Today's greeting (MOCHI-16): one line a day, picked once and kept, so the
// panel shows the same line every time she opens it that day. On her first
// day it's the welcome (MOCHI-42), with its button.
export interface TodaysGreeting {
  // The greeting day, from nightOf(): a late night still counts as the day
  // before.
  day: string;
  text: string;
  button?: "setUpCopilot" | "chooseBrain";
}

// The saved greeting, if it's from `day` and looks right; otherwise a new one
// is picked.
export function toTodaysGreeting(value: unknown, day: string): TodaysGreeting | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }
  const saved = value as Record<string, unknown>;
  if (saved.day !== day || typeof saved.text !== "string" || saved.text === "") {
    return undefined;
  }
  const button = saved.button === "setUpCopilot" || saved.button === "chooseBrain" ? saved.button : undefined;
  return { day, text: saved.text, ...(button ? { button } : {}) };
}
