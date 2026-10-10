// What screen readers hear when one of Mochi's messages is done (MOCHI-25):
// the cat's name, then the message as plain text, once, never word by
// word. Plain code with no VS Code dependency.
//
// Code blocks are named, not read out ("Code block, 3 lines"): she can
// move into the answer, which can take focus, to read the code itself.
import { chatStrings } from "../strings";
import { Block, Inline, formatAnswer } from "./format";
import { ChatEntry } from "./messages";

function plain(pieces: Inline[]): string {
  return pieces
    .map((piece) => {
      switch (piece.kind) {
        case "text":
        case "code":
          return piece.text;
        case "bold":
        case "italic":
          return plain(piece.children);
        case "link":
          return piece.showDomain ? `${piece.text} (${piece.domain})` : piece.text;
      }
    })
    .join("");
}

function spokenBlock(block: Block): string {
  switch (block.kind) {
    case "paragraph":
    case "heading":
      return plain(block.inlines);
    case "list":
      return block.items.map(plain).join("\n");
    case "code":
      return chatStrings.codeBlock(block.text.replace(/\n$/, "").split("\n").length);
  }
}

// "Mochi: A list is a row of boxes. Code block, 2 lines. Stopped."
export function spokenMessage(companion: string, entry: Pick<ChatEntry, "text" | "stopped">): string {
  const parts = formatAnswer(entry.text).map(spokenBlock).filter((part) => part.trim() !== "");
  if (entry.stopped) {
    parts.push(`${chatStrings.stopped}.`);
  }
  return `${companion}: ${parts.join("\n")}`;
}
