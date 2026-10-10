import * as vscode from "vscode";
import { Pack } from "../packs/format";
import { GreetingSurface } from "../presence/greetingSurface";
import { readLateHour, readSpeakUp } from "../settings";
import {
  LastCoding,
  TodaysGreeting,
  cleanProjectName,
  greetingText,
  shouldGreet,
  shouldSaveCoding,
  toLastCoding,
  toTodaysGreeting,
} from "./greeting";
import { nightOf } from "./lateNight";

// When she last typed in a file, and the project's folder name. Kept in
// Mochi's private global state on her computer; never a path, and nothing
// from her code.
export const LAST_CODING = "mochi.lastCoding";
// The day she was last greeted, shared by all her windows.
export const LAST_GREETED = "mochi.lastGreetedDay";
// Today's greeting line, so the panel shows the same line all day, in every
// window (MOCHI-16).
export const TODAYS_GREETING = "mochi.todaysGreeting";

// The project open in this window, by name: the folder's name, or the
// workspace's name when several folders are open.
export function projectName(): string | undefined {
  const folders = vscode.workspace.workspaceFolders ?? [];
  if (folders.length === 0) {
    return undefined;
  }
  return cleanProjectName(folders.length === 1 ? folders[0].name : vscode.workspace.name);
}

// Saves when she last coded, at most once a minute, not on every keystroke.
export function rememberCoding(state: vscode.Memento): vscode.Disposable {
  let lastSavedAt: number | undefined;
  return vscode.workspace.onDidChangeTextDocument((event) => {
    const typing = event.contentChanges.length > 0 && ["file", "untitled"].includes(event.document.uri.scheme);
    const now = Date.now();
    if (!typing || !shouldSaveCoding(lastSavedAt, now)) {
      return;
    }
    lastSavedAt = now;
    void state.update(LAST_CODING, { at: now, project: projectName() });
  });
}

export class Greeter {
  // When she last coded before this VS Code started, read before today's
  // typing replaces it.
  private previous: LastCoding | undefined;

  constructor(
    private readonly state: vscode.Memento,
    private readonly pack: () => Pack,
    private readonly isFocusing: () => boolean,
    private readonly surface: GreetingSurface
  ) {
    this.previous = toLastCoding(state.get(LAST_CODING));
  }

  // For "Forget everything": when and where she last coded, the day she was
  // last greeted, and today's greeting line.
  async forget(): Promise<void> {
    this.previous = undefined;
    await this.state.update(LAST_CODING, undefined);
    await this.state.update(LAST_GREETED, undefined);
    await this.state.update(TODAYS_GREETING, undefined);
  }

  // Today's greeting: the line already picked today, or a new one, picked
  // now and kept for the rest of the day. Showing it in the panel doesn't
  // count as greeting her: the once-a-day greeting can still come.
  todays(now: Date = new Date()): TodaysGreeting {
    const day = nightOf(now);
    const saved = toTodaysGreeting(this.state.get(TODAYS_GREETING), day);
    if (saved) {
      return saved;
    }
    const text = greetingText(this.pack(), { now, lateHour: readLateHour(), last: this.previous, project: projectName() });
    return this.keepToday({ day, text });
  }

  // Keeps a line as today's greeting, like the first-run welcome.
  keepToday(greeting: TodaysGreeting): TodaysGreeting {
    void this.state.update(TODAYS_GREETING, greeting);
    return greeting;
  }

  // Greets if it's time, and returns what Mochi said. `force` skips the
  // once-a-day and quiet checks, and `last` pretends she last coded at
  // another time; both are only for the developer tools and tests.
  async greet(options: { force?: boolean; last?: LastCoding } = {}): Promise<string | undefined> {
    try {
      const now = new Date();
      if (!options.force) {
        const lastGreeted = this.state.get(LAST_GREETED);
        const due = shouldGreet({
          now,
          speakUp: readSpeakUp(),
          focusing: this.isFocusing(),
          lastGreetedDay: typeof lastGreeted === "string" ? lastGreeted : undefined,
        });
        if (!due) {
          return undefined;
        }
        // Saved before showing, so another window won't greet too.
        await this.state.update(LAST_GREETED, nightOf(now));
      }
      // The developer tools ask for a fresh line; otherwise it's today's.
      const text =
        options.force || options.last
          ? greetingText(this.pack(), { now, lateHour: readLateHour(), last: options.last ?? this.previous, project: projectName() })
          : this.todays(now).text;
      this.surface.show(text);
      return text;
    } catch {
      // A greeting is a nicety Mochi starts on its own, so a problem stays
      // quiet instead of showing an error.
      return undefined;
    }
  }
}
