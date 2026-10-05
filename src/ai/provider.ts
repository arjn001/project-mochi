// The one interface every AI sits behind (see ARCHITECTURE.md). Plain code
// with no VS Code dependency. The rest of Mochi never knows which AI answers.
import { GatedRequest } from "./shareGate";

export interface Provider {
  // Shown to her, including in the share gate's question.
  readonly name: string;
  // Whether this brain can answer right now, like Copilot being signed in.
  isAvailable(): Promise<boolean>;
  // Only takes a GatedRequest, so nothing reaches an AI without the share
  // gate. Streams the answer back as it's written.
  send(request: GatedRequest, instructions: string, signal?: AbortSignal): AsyncIterable<string>;
}

// Why a brain couldn't answer, in words Mochi can say kindly.
export type BrainProblem = "noPermission" | "blocked" | "unavailable" | "other";

export class BrainError extends Error {
  constructor(readonly problem: BrainProblem, message: string) {
    super(message);
  }
}

// What Mochi tells her for each problem.
export const brainProblemMessages: Record<BrainProblem, string> = {
  noPermission: "Mochi needs your OK to use this brain. Ask again and choose Allow.",
  blocked: "This brain is resting for now, maybe a usage limit. Try again a bit later.",
  unavailable: "This brain isn't available right now. Check that you're signed in, then try again.",
  other: "Something went wrong while Mochi was thinking. Try again in a moment.",
};
