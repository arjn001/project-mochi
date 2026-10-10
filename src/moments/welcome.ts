// The first-run welcome (MOCHI-42): one greeting, where Mochi lives, and a
// brain check. Plain code with no VS Code dependency.
import { SpeakUp } from "./gatekeeper";
import { welcomeStrings } from "../strings";

// What the brain check found. It only looks at what's available: it never
// asks a brain anything, so it can't show Copilot's permission prompt or
// spend anything.
export type BrainCheck =
  // Mochi would think with this brain if she asked now.
  | { kind: "ready"; label: string }
  // Brains are there, but none is chosen yet: Mochi asks when she first
  // asks something (MOCHI-53), so the welcome doesn't mention one.
  | { kind: "ask" }
  // Nothing at all. `copilotSetup` is false in editors without VS Code's
  // Copilot setup, like VSCodium.
  | { kind: "none"; copilotSetup: boolean };

export type WelcomeButton = "setUpCopilot" | "chooseBrain";

export function welcomeText(companion: string, brain: BrainCheck): { text: string; button?: WelcomeButton } {
  const start = [welcomeStrings.hello(companion), welcomeStrings.where];
  switch (brain.kind) {
    case "ready":
      return { text: [...start, welcomeStrings.ready(brain.label)].join(" ") };
    case "ask":
      return { text: start.join(" ") };
    case "none":
      return brain.copilotSetup
        ? { text: [...start, welcomeStrings.copilot].join(" "), button: "setUpCopilot" }
        : { text: [...start, welcomeStrings.choose].join(" "), button: "chooseBrain" };
  }
}

// Whether she's been welcomed, from Mochi's storage: true, false (not yet),
// or undefined before this version. Someone who used Mochi before the
// welcome existed has greeting memories, and is never welcomed as new.
export function wasWelcomed(stored: unknown, hasGreetingMemory: boolean): boolean {
  return typeof stored === "boolean" ? stored : hasGreetingMemory;
}

// The welcome waits for a start that's not in quiet mode and not during a
// focus session, like the greeting.
export const welcomeDue = (welcomed: boolean, speakUp: SpeakUp, focusing: boolean): boolean =>
  !welcomed && speakUp !== "quiet" && !focusing;
