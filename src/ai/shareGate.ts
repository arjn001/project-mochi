// The share gate: the only way anything reaches an AI (see ARCHITECTURE.md).
// Plain code with no VS Code dependency, so it can be unit tested alone.
//
// What she types herself goes through, because pressing send is her click.
// Anything Mochi attaches on its own (selected code, errors, the open file)
// is only sent after she says yes to a question naming the AI it goes to.

// Something Mochi wants to send along, like the errors in a file.
export interface Attachment {
  kind: "selection" | "errors" | "file";
  // Where it comes from, shown in the question, like "homework.py".
  label: string;
  text: string;
}

export interface Request {
  message: string;
  attachments: Attachment[];
}

// Only this file can stamp a request as having passed the gate. The AI
// providers accept nothing else, so no path to an AI can skip the gate.
declare const passed: unique symbol;
export type GatedRequest = Request & { readonly [passed]: true };

export type Answer = "share" | "sendWithout" | "cancel";

// Asks her the question. In VS Code this is a dialog; in tests, a fake.
export type Ask = (question: string) => Promise<Answer>;

function describe(attachment: Attachment): string {
  switch (attachment.kind) {
    case "selection":
      return `the selected code from ${attachment.label}`;
    case "errors":
      return `the errors in ${attachment.label}`;
    case "file":
      return `the open file ${attachment.label}`;
  }
}

// "Share the errors in homework.py and the open file notes.md with Claude?"
export function question(attachments: Attachment[], provider: string): string {
  const items = attachments.map(describe);
  const list = items.length > 1 ? `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}` : items[0];
  return `Share ${list} with ${provider}?`;
}

const stamp = (request: Request) => request as GatedRequest;

// Returns the request to send, or undefined if nothing should be sent.
export async function throughShareGate(
  request: Request,
  provider: string,
  ask: Ask
): Promise<GatedRequest | undefined> {
  if (provider.trim() === "") {
    throw new Error("The share gate needs to know which AI the request goes to.");
  }
  if (request.attachments.length === 0) {
    return request.message.trim() === "" ? undefined : stamp(request);
  }

  const answer = await ask(question(request.attachments, provider));
  if (answer === "share") {
    return stamp(request);
  }
  if (answer === "sendWithout" && request.message.trim() !== "") {
    return stamp({ message: request.message, attachments: [] });
  }
  return undefined;
}
