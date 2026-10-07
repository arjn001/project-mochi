// "Mochi: Forget everything" (MOCHI-65). Plain code with no VS Code
// dependency.
//
// Clears what Mochi keeps about her: chats, her personal layer, and what it
// remembers about her days (the greeting, tonight's nudge, which projects
// were offered Python setup, a focus session's saved end time). Never her
// settings or a saved AI key. See DECISIONS.md, "What Mochi keeps".
import { forgetStrings } from "./strings";

// One kind of thing Mochi remembers, and how to forget it.
export interface Forgettable {
  forget(): PromiseLike<void> | void;
}

// Asks first, with a question and a plain description of what's cleared.
// True only for a clear yes.
export type Confirm = (question: string, detail: string, yes: string) => PromiseLike<boolean>;

export type ForgetResult = "kept" | "forgotten" | "partly";

export async function forgetEverything(confirm: Confirm, parts: Forgettable[]): Promise<ForgetResult> {
  if (!(await confirm(forgetStrings.question, forgetStrings.detail, forgetStrings.yes))) {
    return "kept";
  }
  // Every part is tried, even if one fails, so as much as possible is gone.
  let failed = false;
  for (const part of parts) {
    try {
      await part.forget();
    } catch {
      failed = true;
    }
  }
  return failed ? "partly" : "forgotten";
}
