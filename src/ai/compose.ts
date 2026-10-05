// Turns a request that passed the share gate into the text an AI reads.
// Plain code with no VS Code dependency.
import { Attachment, GatedRequest } from "./shareGate";

function describe(attachment: Attachment): string {
  switch (attachment.kind) {
    case "selection":
      return `Selected code from ${attachment.label}`;
    case "errors":
      return `Errors in ${attachment.label}`;
    case "file":
      return `The open file ${attachment.label}`;
  }
}

// Her message first, then each attachment in its own fenced block.
export function compose(request: GatedRequest): string {
  const parts = [request.message.trim()];
  for (const attachment of request.attachments) {
    parts.push(`${describe(attachment)}:\n\`\`\`\n${attachment.text}\n\`\`\``);
  }
  return parts.join("\n\n");
}
