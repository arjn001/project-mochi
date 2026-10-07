// Noticing when she's stuck on an error (MOCHI-34). Plain code with no
// VS Code dependency.
//
// Errors (and warnings that crash, see problems.ts), only in the file she's
// editing, and only while she's actively editing it. Each error is offered
// once per VS Code session, and nothing about her code is ever saved to disk.
import { Problem, countsAsError } from "../problems";
import { maySpeak } from "./gatekeeper";

// How long an error has to stay before Mochi offers a paw (see MOMENTS.md).
export const STUCK_AFTER_MS = 2 * 60_000;
// She counts as actively editing if she typed in the file this recently.
export const EDITING_WITHIN_MS = 5 * 60_000;

export interface FileError extends Problem {
  message: string;
  // Starts at 0, like VS Code.
  line: number;
}

const tidy = (line: string | undefined) => (line ?? "").trim().replace(/\s+/g, " ");

// Who an error is: its message plus the code on its line and the lines right
// around it. Never the line number, so an error that moves down when she adds
// lines above it is still the same error.
export function errorKey(file: string, message: string, lines: string[], line: number): string {
  return [file, message, tidy(lines[line - 1]), tidy(lines[line]), tidy(lines[line + 1])].join("\n");
}

// When each error was first seen. Errors that went away are forgotten, and
// errors still there keep their first-seen time.
export function track(previous: Map<string, number>, currentKeys: string[], now: number): Map<string, number> {
  const next = new Map<string, number>();
  for (const key of currentKeys) {
    next.set(key, previous.get(key) ?? now);
  }
  return next;
}

export interface StuckCheck {
  now: number;
  // When she last typed in this file, if ever.
  lastEditAt: number | undefined;
  speakUp: unknown;
  // From track(): each error still here, and when it was first seen.
  tracked: Map<string, number>;
  // Errors already offered this session.
  offered: ReadonlySet<string>;
}

// The errors to offer a paw for right now.
export function stuckOn(check: StuckCheck): string[] {
  const editing = check.lastEditAt !== undefined && check.now - check.lastEditAt <= EDITING_WITHIN_MS;
  if (!editing || !maySpeak({ place: "hint" }, check.speakUp)) {
    return [];
  }
  return [...check.tracked]
    .filter(([key, since]) => check.now - since >= STUCK_AFTER_MS && !check.offered.has(key))
    .map(([key]) => key);
}

export const onlyErrors = (errors: FileError[]) => errors.filter(countsAsError);
