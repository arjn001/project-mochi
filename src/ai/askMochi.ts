// What happens when she asks Mochi something. Plain code with no VS Code
// dependency, so the whole flow can be unit tested with a fake brain.
import { Turn } from "./history";
import { Provider } from "./provider";
import { Ask, GatedRequest, Request, throughShareGate } from "./shareGate";

export type Asked =
  // No brain is set up or available. Mochi offers to set one up.
  | { status: "noBrain" }
  // She cancelled at the share gate, or there was nothing to send.
  | { status: "notSent" }
  // Something came from a file that usually holds secrets.
  | { status: "refused"; reason: string }
  // `request` is what was sent, for follow-ups like a hint (see followUp).
  | { status: "answer"; text: AsyncIterable<string>; request: GatedRequest };

export async function askMochi(
  request: Request,
  provider: Provider | undefined,
  instructions: string,
  askToShare: Ask,
  signal?: AbortSignal,
  // The recent messages sent along (MOCHI-21).
  history: readonly Turn[] = []
): Promise<Asked> {
  if (!provider || !(await provider.isAvailable())) {
    return { status: "noBrain" };
  }
  const gate = await throughShareGate(request, provider.name, askToShare);
  if (gate.status !== "sent") {
    return gate;
  }
  return { status: "answer", text: provider.send(gate.request, instructions, { history, signal }), request: gate.request };
}

// The one prompt when there's no brain (see DECISIONS.md: no nagging).
export const NO_BRAIN = "I'd need a brain to answer that. Want to set one up?";
