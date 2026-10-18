// How the share gate's dialog turns her click into an answer (MOCHI-70).
// Plain code with no VS Code dependency, so every answer can be tested: a
// mistake here could send code she didn't agree to share.
import { shareStrings } from "../strings";
import { Answer, Ask } from "./shareGate";

// The two dialogs it uses. Both are modal, so nothing is sent while she
// decides. Each resolves with the button she clicked, or undefined if she
// closed it.
export interface Dialogs {
  warning(question: string, buttons: string[]): PromiseLike<string | undefined>;
  information(question: string, detail: string, buttons: string[]): PromiseLike<string | undefined>;
}

export function dialogAsk(dialogs: Dialogs): Ask {
  return async (question, about = "attachments"): Promise<Answer> => {
    // What she typed looks like a secret: its only yes is "Send anyway".
    if (about === "typedSecret") {
      return (await dialogs.warning(question, [shareStrings.sendAnyway])) === shareStrings.sendAnyway ? "share" : "cancel";
    }
    const choice = await dialogs.information(question, shareStrings.detail, [shareStrings.share, shareStrings.sendWithout]);
    if (choice === shareStrings.share) {
      return "share";
    }
    if (choice === shareStrings.sendWithout) {
      return "sendWithout";
    }
    // Closing it, Escape, or anything else she didn't clearly pick.
    return "cancel";
  };
}
