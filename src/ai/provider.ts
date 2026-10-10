// The one interface every AI sits behind (see ARCHITECTURE.md). Plain code
// with no VS Code dependency. The rest of Mochi never knows which AI answers.
import { problemStrings } from "../strings";
import { Turn } from "./history";
import { GatedRequest } from "./shareGate";

export interface SendOptions {
  // The recent messages of the conversation, oldest first (MOCHI-21).
  history?: readonly Turn[];
  // Stops the answer.
  signal?: AbortSignal;
  // Continues an answer that reached the length limit, after "Keep going"
  // (MOCHI-67).
  soFar?: string;
}

export interface Provider {
  // Shown to her, including in the share gate's question.
  readonly name: string;
  // How much the brain can take, in tokens, if it says.
  readonly maxInputTokens?: number;
  // Whether this brain can answer right now, like Copilot being signed in.
  isAvailable(): Promise<boolean>;
  // Only takes a GatedRequest, so nothing reaches an AI without the share
  // gate. Streams the answer back as it's written.
  send(request: GatedRequest, instructions: string, options?: SendOptions): AsyncIterable<string>;
}

// Why a brain couldn't answer, in words Mochi can say kindly.
export type BrainProblem =
  | "noPermission"
  | "blocked"
  | "unavailable"
  | "keyRejected"
  | "billing"
  | "busy"
  | "gone"
  | "tooLong"
  | "offline"
  | "declined"
  // The answer reached the length limit. Not an error: she can keep going.
  | "cutOff"
  | "other";

// What she can do about it, as a button next to the message.
export type BrainHelp = "addClaudeKey" | "claudeBilling" | "keepGoing";

export class BrainError extends Error {
  constructor(readonly problem: BrainProblem, message: string, readonly help?: BrainHelp) {
    super(message);
  }
}

// What Mochi tells her for each problem.
export const brainProblemMessages: Record<BrainProblem, string> = {
  noPermission: "Mochi needs your OK to use this brain. Ask again and choose Allow.",
  blocked: "This brain is resting for now, maybe a usage limit. Try again a bit later.",
  unavailable: "This brain isn't available right now. Check that you're signed in, then try again.",
  keyRejected: problemStrings.keyRejected,
  billing: problemStrings.billing,
  busy: problemStrings.busy,
  gone: problemStrings.gone,
  tooLong: problemStrings.tooLong,
  offline: problemStrings.offline,
  declined: problemStrings.declined,
  cutOff: problemStrings.cutOff,
  other: "Something went wrong while Mochi was thinking. Try again in a moment.",
};

// The button for each kind of help.
export const brainHelpButtons: Record<BrainHelp, string> = {
  addClaudeKey: problemStrings.addClaudeKey,
  claudeBilling: problemStrings.openConsole,
  keepGoing: problemStrings.keepGoing,
};
