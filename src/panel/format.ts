// Turns an answer into a small tree of safe pieces for the chat (MOCHI-21).
// Plain code with no VS Code or browser dependency: the panel's script
// builds the tree with createElement and text nodes, never innerHTML, so
// nothing in an answer can become live HTML.
//
// Only a safe subset is understood: paragraphs, headings, lists, code
// blocks, **bold**, *italic*, `inline code`, and https links. Everything
// else, including any HTML, stays exactly as written, as text.

export type Inline =
  | { kind: "text"; text: string }
  | { kind: "bold"; children: Inline[] }
  | { kind: "italic"; children: Inline[] }
  | { kind: "code"; text: string }
  // `domain` is always shown, so a link can't hide where it goes.
  | { kind: "link"; text: string; url: string; domain: string; showDomain: boolean };

export type Block =
  | { kind: "paragraph"; inlines: Inline[] }
  | { kind: "heading"; inlines: Inline[] }
  | { kind: "list"; ordered: boolean; items: Inline[][] }
  | { kind: "code"; language?: string; text: string };

// A link Mochi will open: https only, a real host, no user name or password
// hidden in it (like https://bank.com@other.site). Anything else is text.
export function safeLink(candidate: string): { url: string; domain: string } | undefined {
  if (!/^https:\/\/\S+$/.test(candidate)) {
    return undefined;
  }
  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:" || url.hostname === "" || url.username !== "" || url.password !== "") {
      return undefined;
    }
    return { url: url.href, domain: url.hostname };
  } catch {
    return undefined;
  }
}

const FENCE = /^\s*```\s*([\w+#.-]{0,20})?\s*$/;
const FENCE_END = /^\s*```\s*$/;
const HEADING = /^#{1,3}\s+(.*)$/;
const ITEM = /^\s*(?:([-*•])|(\d{1,3})[.)])\s+(.*)$/;

export function formatAnswer(answer: string): Block[] {
  const blocks: Block[] = [];
  const lines = answer.split(/\r?\n/);
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | undefined;

  const endParagraph = () => {
    if (paragraph.length > 0) {
      blocks.push({ kind: "paragraph", inlines: formatInline(paragraph.join("\n")) });
      paragraph = [];
    }
  };
  const endList = () => {
    if (list) {
      blocks.push({ kind: "list", ordered: list.ordered, items: list.items.map(formatInline) });
      list = undefined;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fence = FENCE.exec(line);
    if (fence) {
      endParagraph();
      endList();
      const code: string[] = [];
      // An unclosed fence (like an answer still being written) runs to the
      // end.
      for (i++; i < lines.length && !FENCE_END.test(lines[i]); i++) {
        code.push(lines[i]);
      }
      blocks.push({ kind: "code", ...(fence[1] ? { language: fence[1] } : {}), text: code.join("\n") });
      continue;
    }
    if (line.trim() === "") {
      endParagraph();
      endList();
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading) {
      endParagraph();
      endList();
      blocks.push({ kind: "heading", inlines: formatInline(heading[1]) });
      continue;
    }
    const item = ITEM.exec(line);
    if (item) {
      endParagraph();
      const ordered = item[2] !== undefined;
      if (list && list.ordered !== ordered) {
        endList();
      }
      list ??= { ordered, items: [] };
      list.items.push(item[3]);
      continue;
    }
    if (list && /^\s+\S/.test(line)) {
      // An indented line continues the last item.
      list.items[list.items.length - 1] += `\n${line.trim()}`;
      continue;
    }
    endList();
    paragraph.push(line);
  }
  endParagraph();
  endList();
  return blocks;
}

// Characters that end a bare link, so "see https://a.com." keeps the dot as
// text.
const BARE_LINK = /https:\/\/[^\s<>()[\]"'`]+/y;
const MARKDOWN_LINK = /\[([^\]\n]{1,300})\]\(([^)\s]{1,2000})\)/y;
const TRAILING = /[.,!?;:]+$/;

export function formatInline(text: string): Inline[] {
  const out: Inline[] = [];
  const pushText = (value: string) => {
    if (value === "") {
      return;
    }
    const last = out[out.length - 1];
    if (last?.kind === "text") {
      last.text += value;
    } else {
      out.push({ kind: "text", text: value });
    }
  };

  let i = 0;
  while (i < text.length) {
    const at = (s: string) => text.startsWith(s, i);

    if (at("`")) {
      const end = text.indexOf("`", i + 1);
      if (end > i + 1) {
        out.push({ kind: "code", text: text.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }
    if (at("**")) {
      const end = text.indexOf("**", i + 2);
      if (end > i + 2) {
        out.push({ kind: "bold", children: formatInline(text.slice(i + 2, end)) });
        i = end + 2;
        continue;
      }
    }
    if (at("*") && !at("**") && /\S/.test(text[i + 1] ?? " ")) {
      const end = text.indexOf("*", i + 1);
      if (end > i + 1 && text[end - 1] !== " ") {
        out.push({ kind: "italic", children: formatInline(text.slice(i + 1, end)) });
        i = end + 1;
        continue;
      }
    }
    if (at("[")) {
      MARKDOWN_LINK.lastIndex = i;
      const match = MARKDOWN_LINK.exec(text);
      const link = match && safeLink(match[2]);
      if (match && link) {
        const label = match[1];
        out.push({ kind: "link", text: label, ...link, showDomain: label !== link.url && label !== link.domain });
        i += match[0].length;
        continue;
      }
    }
    if (at("https://")) {
      BARE_LINK.lastIndex = i;
      const found = BARE_LINK.exec(text);
      if (found) {
        const address = found[0].replace(TRAILING, "");
        const link = safeLink(address);
        if (link) {
          out.push({ kind: "link", text: address, ...link, showDomain: false });
          i += address.length;
          continue;
        }
      }
    }
    pushText(text[i]);
    i++;
  }
  return out;
}
