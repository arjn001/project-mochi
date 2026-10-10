// The share gate: the only way anything reaches an AI (see ARCHITECTURE.md).
// Plain code with no VS Code dependency, so it can be unit tested alone.
//
// What she types herself goes through, because pressing send is her click,
// unless it looks like a password or API key: then she's asked first.
// Anything Mochi attaches on its own (selected code, errors, the open file)
// is only sent after she says yes to a question naming the AI it goes to.

import { chatStrings } from "../strings";
import { SECRET_WARNING, isSensitiveFile, looksSecret, refusalFor } from "./secrets";

// Something Mochi wants to send along. `label` is the file name, never the
// full path.
export type Attachment =
  // `from` and `to` are the selected lines, when known. Line numbers start
  // at 1.
  | { kind: "selection"; label: string; text: string; from?: number; to?: number }
  | { kind: "file"; label: string; text: string }
  // An error plus a few lines around it. Line numbers start at 1.
  | { kind: "errorContext"; label: string; text: string; from: number; to: number; errorLine: number };

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
// "typedSecret" is the warning about what she typed: its only yes is
// "Send anyway", answered as "share".
export type Ask = (question: string, about?: "attachments" | "typedSecret") => Promise<Answer>;

// When what she typed looks like a password or API key.
export const TYPED_SECRET_QUESTION = `${SECRET_WARNING} Send anyway?`;

export type GateResult =
  | { status: "sent"; request: GatedRequest }
  // Something came from a file that usually holds secrets. Nothing is sent,
  // and she isn't even asked.
  | { status: "refused"; reason: string }
  // She cancelled, or there was nothing to send.
  | { status: "notSent" };

export function describe(attachment: Attachment): string {
  switch (attachment.kind) {
    case "selection":
      if (attachment.from === undefined || attachment.to === undefined) {
        return `the selected code from ${attachment.label}`;
      }
      return attachment.from === attachment.to
        ? `line ${attachment.from} of ${attachment.label}`
        : `lines ${attachment.from} to ${attachment.to} of ${attachment.label}`;
    case "file":
      return `the open file ${attachment.label}`;
    case "errorContext":
      return `lines ${attachment.from} to ${attachment.to} of ${attachment.label} (the error on line ${attachment.errorLine})`;
  }
}

// The chip above the box for selected code: "homework.py, lines 9 to 15"
// (MOCHI-21).
export function chipLabel(attachment: Attachment & { kind: "selection" }): string {
  return chatStrings.attachment(attachment.label, attachment.from, attachment.to);
}

// "Share lines 9 to 15 of homework.py (the error on line 12) with Copilot?"
// Adds a warning when something looks like a password or API key.
export function question(attachments: Attachment[], provider: string): string {
  const items = attachments.map(describe);
  const list = items.length > 1 ? `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}` : items[0];
  const warning = attachments.some((a) => looksSecret(a.text)) ? ` ${SECRET_WARNING}` : "";
  return `Share ${list} with ${provider}?${warning}`;
}

const stamp = (request: Request) => request as GatedRequest;

export async function throughShareGate(request: Request, provider: string, ask: Ask): Promise<GateResult> {
  if (provider.trim() === "") {
    throw new Error("The share gate needs to know which AI the request goes to.");
  }
  const secretFile = request.attachments.find((a) => isSensitiveFile(a.label));
  if (secretFile) {
    return { status: "refused", reason: refusalFor(secretFile.label) };
  }
  if (looksSecret(request.message) && (await ask(TYPED_SECRET_QUESTION, "typedSecret")) !== "share") {
    return { status: "notSent" };
  }
  if (request.attachments.length === 0) {
    return request.message.trim() === "" ? { status: "notSent" } : { status: "sent", request: stamp(request) };
  }

  const answer = await ask(question(request.attachments, provider), "attachments");
  if (answer === "share") {
    return { status: "sent", request: stamp(request) };
  }
  if (answer === "sendWithout" && request.message.trim() !== "") {
    return { status: "sent", request: stamp({ message: request.message, attachments: [] }) };
  }
  return { status: "notSent" };
}

// A follow-up about exactly what she already agreed to share, like asking
// for a hint after an explanation. Only the message changes, so she isn't
// asked again.
export function followUp(approved: GatedRequest, message: string): GatedRequest {
  return stamp({ message, attachments: approved.attachments });
}
