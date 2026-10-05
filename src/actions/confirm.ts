// Every action Mochi takes is offered first, and only runs after she says
// yes (MOCHI-31). Plain code with no VS Code dependency.
//
// An action's "do it" step is stored under a symbol only this file knows, so
// nothing else can run it. The only way to act is offer(), which asks first.

const perform = Symbol("perform");

// Puts things back the way they were.
export type Undo = () => Promise<void>;

export interface Action {
  // The question, in Mochi's voice: "Want me to dim things with a darker theme?"
  readonly question: string;
  // The yes button: "Dim things".
  readonly yes: string;
  // Said after acting, next to an Undo button: "Done! Changed your mind?"
  readonly done: string;
  // If this returns a reason, there's nothing to do: Mochi says why instead
  // of asking. Like "You're already on a dark theme."
  readonly skip?: () => string | undefined;
  readonly [perform]: () => Promise<Undo | undefined>;
}

export interface ActionSpec {
  question: string;
  yes: string;
  done: string;
  skip?: () => string | undefined;
  // Does the thing. Returns how to undo it, if it can be undone.
  act: () => Promise<Undo | undefined>;
}

export function defineAction(spec: ActionSpec): Action {
  return { question: spec.question, yes: spec.yes, done: spec.done, skip: spec.skip, [perform]: spec.act };
}

export const NOT_NOW = "Not now";
export const UNDO = "Undo";

// Shows a message with buttons and returns the one she picked, or undefined
// if she closed it. In VS Code this is a notification; in tests, a fake.
export type Choose = (message: string, buttons: string[]) => Promise<string | undefined>;

export type Outcome = "skipped" | "declined" | "done" | "undone";

export async function offer(action: Action, choose: Choose): Promise<Outcome> {
  const reason = action.skip?.();
  if (reason) {
    await choose(reason, []);
    return "skipped";
  }
  // Anything but a clear yes, including closing it, means no.
  if ((await choose(action.question, [action.yes, NOT_NOW])) !== action.yes) {
    return "declined";
  }
  const undo = await action[perform]();
  if (!undo) {
    return "done";
  }
  if ((await choose(action.done, [UNDO])) === UNDO) {
    await undo();
    return "undone";
  }
  return "done";
}
