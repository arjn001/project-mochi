// What happens when she asks Mochi something. Plain code with no VS Code
// dependency, so the whole flow can be unit tested with a fake brain.
import { Provider } from "./provider";
import { Ask, Request, throughShareGate } from "./shareGate";

export type Asked =
  // No brain is set up or available. Mochi offers to set one up.
  | { status: "noBrain" }
  // She cancelled at the share gate, or there was nothing to send.
  | { status: "notSent" }
  | { status: "answer"; text: AsyncIterable<string> };

export async function askMochi(
  request: Request,
  provider: Provider | undefined,
  instructions: string,
  askToShare: Ask,
  signal?: AbortSignal
): Promise<Asked> {
  if (!provider || !(await provider.isAvailable())) {
    return { status: "noBrain" };
  }
  const gated = await throughShareGate(request, provider.name, askToShare);
  if (!gated) {
    return { status: "notSent" };
  }
  return { status: "answer", text: provider.send(gated, instructions, signal) };
}

// The one prompt when there's no brain (see DECISIONS.md: no nagging).
export const NO_BRAIN = "I'd need a brain to answer that. Want to set one up?";
