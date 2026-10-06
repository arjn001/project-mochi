import * as vscode from "vscode";
import { Pack } from "../packs/format";
import { GreetingSurface } from "../presence/greetingSurface";
import { readLateHour, readSpeakUp } from "../settings";
import { LastCoding, cleanProjectName, greetingText, shouldGreet, shouldSaveCoding, toLastCoding } from "./greeting";
import { nightOf } from "./lateNight";

// When she last typed in a file, and the project's folder name. Kept in
// Mochi's private global state on her computer; never a path, and nothing
// from her code.
export const LAST_CODING = "mochi.lastCoding";
// The day she was last greeted, shared by all her windows.
export const LAST_GREETED = "mochi.lastGreetedDay";

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
  private readonly previous: LastCoding | undefined;

  constructor(
    private readonly state: vscode.Memento,
    private readonly pack: () => Pack,
    private readonly isFocusing: () => boolean,
    private readonly surface: GreetingSurface
  ) {
    this.previous = toLastCoding(state.get(LAST_CODING));
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
      const text = greetingText(this.pack(), {
        now,
        lateHour: readLateHour(),
        last: options.last ?? this.previous,
        project: projectName(),
      });
      this.surface.show(text);
      return text;
    } catch {
      // A greeting is a nicety Mochi starts on its own, so a problem stays
      // quiet instead of showing an error.
      return undefined;
    }
  }
}
