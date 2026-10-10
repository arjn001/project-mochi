// The script inside Mochi's panel (MOCHI-16). It runs in the webview, not
// in the extension: it shows what Mochi sends, reports clicks, and keeps
// her unsent draft. It decides nothing and has no words of its own.
//
// The chat (MOCHI-21) is built only with createElement and text nodes,
// never from HTML, so nothing in an answer can become live HTML.
import { Block, Inline, formatAnswer } from "../panel/format";
import { ChatEntry, FromPanel, PanelButton, PanelState, ToPanel, sendsOnKey } from "../panel/messages";

interface VsCodeApi {
  postMessage(message: FromPanel): void;
  getState(): unknown;
  setState(state: unknown): void;
}
declare function acquireVsCodeApi(): VsCodeApi;

const vscode = acquireVsCodeApi();
const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const avatar = byId<HTMLSpanElement>("avatar");
const mood = byId<HTMLParagraphElement>("mood");
const greeting = byId<HTMLParagraphElement>("greeting");
const welcome = byId<HTMLButtonElement>("welcome");
const hint = byId<HTMLParagraphElement>("hint");
const askForm = byId<HTMLFormElement>("ask-form");
const askLabel = byId<HTMLLabelElement>("ask-label");
const box = byId<HTMLTextAreaElement>("ask");
const send = byId<HTMLButtonElement>("send");
const chat = byId<HTMLDivElement>("chat");
const buttons: Record<Exclude<PanelButton, "welcome">, HTMLButtonElement> = {
  explain: byId("explain"),
  focus: byId("focus"),
  dark: byId("dark"),
};

// The draft survives the panel being hidden and shown again.
const saveDraft = () => vscode.setState({ draft: box.value });
const saved = vscode.getState() as { draft?: unknown } | undefined;
if (typeof saved?.draft === "string") {
  box.value = saved.draft;
}

// What she last sent, put back if it couldn't be sent.
let pending = "";

// The chat's own words, from Mochi.
let labels: PanelState["chat"] = { empty: "", you: "", mochi: "", copy: "", copied: "" };
// Each message's bubble, so streamed text redraws only that one.
let messages = new Map<number, { entry: ChatEntry; bubble: HTMLElement }>();
let redraw = new Set<number>();

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const made = document.createElement(tag);
  if (className) {
    made.className = className;
  }
  if (text !== undefined) {
    made.textContent = text;
  }
  return made;
}

function inlines(pieces: Inline[], into: HTMLElement): void {
  for (const piece of pieces) {
    switch (piece.kind) {
      case "text":
        into.append(document.createTextNode(piece.text));
        break;
      case "bold": {
        const strong = element("strong");
        inlines(piece.children, strong);
        into.append(strong);
        break;
      }
      case "italic": {
        const em = element("em");
        inlines(piece.children, em);
        into.append(em);
        break;
      }
      case "code":
        into.append(element("code", "mochi-inline-code", piece.text));
        break;
      case "link": {
        // Only https links reach here (format.ts), and Mochi checks again
        // before opening one through VS Code.
        const link = element("a", "mochi-link", piece.text);
        link.href = piece.url;
        link.addEventListener("click", (event) => {
          event.preventDefault();
          vscode.postMessage({ type: "openLink", url: piece.url });
        });
        into.append(link);
        if (piece.showDomain) {
          into.append(element("span", "mochi-link-domain", ` (${piece.domain})`));
        }
        break;
      }
    }
  }
}

function blocks(answer: Block[], into: HTMLElement): void {
  for (const block of answer) {
    switch (block.kind) {
      case "paragraph": {
        const p = element("p");
        inlines(block.inlines, p);
        into.append(p);
        break;
      }
      case "heading": {
        const p = element("p", "mochi-heading");
        inlines(block.inlines, p);
        into.append(p);
        break;
      }
      case "list": {
        const list = element(block.ordered ? "ol" : "ul");
        for (const item of block.items) {
          const li = element("li");
          inlines(item, li);
          list.append(li);
        }
        into.append(list);
        break;
      }
      case "code": {
        const box = element("div", "mochi-code");
        const pre = element("pre");
        pre.append(element("code", undefined, block.text));
        const copy = element("button", "mochi-copy", labels.copy);
        copy.type = "button";
        copy.addEventListener("click", () => {
          vscode.postMessage({ type: "copy", text: block.text });
          copy.textContent = labels.copied;
          setTimeout(() => (copy.textContent = labels.copy), 1500);
        });
        // Copy sits in its own row, so it never covers the code.
        const top = element("div", "mochi-code-top");
        top.append(copy);
        box.append(top, pre);
        into.append(box);
        break;
      }
    }
  }
}

// Her messages are shown exactly as she typed them; Mochi's are formatted.
function fillBubble(bubble: HTMLElement, entry: ChatEntry): void {
  bubble.replaceChildren();
  if (entry.from === "her") {
    bubble.textContent = entry.text;
  } else {
    blocks(formatAnswer(entry.text), bubble);
  }
}

function message(entry: ChatEntry): HTMLElement {
  const row = element("div", `mochi-message mochi-from-${entry.from}${entry.problem ? " mochi-problem" : ""}`);
  row.setAttribute("role", "group");
  row.setAttribute("aria-label", entry.from === "her" ? labels.you : labels.mochi);
  if (entry.from === "mochi") {
    const cat = element("span", "mochi-message-cat");
    cat.setAttribute("aria-hidden", "true");
    row.append(cat);
  }
  const column = element("div", "mochi-message-body");
  const bubble = element("div", "mochi-bubble");
  fillBubble(bubble, entry);
  column.append(bubble);
  if (entry.chips) {
    const chips = element("div", "mochi-chips");
    if (entry.chips.prompt) {
      chips.append(element("span", "mochi-chips-prompt", entry.chips.prompt));
    }
    for (const choice of entry.chips.choices) {
      const chip = element("button", "mochi-chip", choice.label);
      chip.type = "button";
      chip.addEventListener("click", () => vscode.postMessage({ type: "chip", entry: entry.id, chip: choice.id }));
      chips.append(chip);
    }
    column.append(chips);
  }
  row.append(column);
  messages.set(entry.id, { entry, bubble });
  return row;
}

// Keeps the newest message in view, unless she scrolled up to read.
function keepingScroll(change: () => void): void {
  const atBottom = chat.scrollHeight - chat.scrollTop - chat.clientHeight < 40;
  change();
  if (atBottom) {
    chat.scrollTop = chat.scrollHeight;
  }
}

function showChat(entries: readonly ChatEntry[]): void {
  keepingScroll(() => {
    messages = new Map();
    redraw.clear();
    chat.replaceChildren(...(entries.length === 0 ? [element("p", "mochi-chat-empty", labels.empty)] : entries.map(message)));
  });
}

// Streamed text arrives in small pieces, so the bubble is redrawn at most
// once a frame.
function append(id: number, text: string): void {
  const shown = messages.get(id);
  if (!shown) {
    return;
  }
  shown.entry.text += text;
  if (redraw.size === 0) {
    requestAnimationFrame(() => {
      keepingScroll(() => {
        for (const waiting of redraw) {
          const again = messages.get(waiting);
          if (again) {
            fillBubble(again.bubble, again.entry);
          }
        }
        redraw.clear();
      });
    });
  }
  redraw.add(id);
}

function show(state: PanelState): void {
  avatar.dataset.glyph = state.mood.glyph;
  mood.textContent = state.mood.words;
  greeting.textContent = state.greeting;
  welcome.hidden = !state.welcomeButton;
  welcome.textContent = state.welcomeButton ?? "";
  buttons.explain.textContent = state.buttons.explain;
  buttons.focus.textContent = state.buttons.focus;
  buttons.dark.textContent = state.buttons.dark;
  askLabel.textContent = state.ask.label;
  box.placeholder = state.ask.label;
  labels = state.chat;
  // An arrow on screen; "Send" as its tooltip and for screen readers.
  send.title = state.ask.send;
  send.setAttribute("aria-label", state.ask.send);
}

// The box grows with what she types, up to a limit (then it scrolls), and
// Send only lights up when there's something to send.
function fitBox(): void {
  box.style.height = "auto";
  box.style.height = `${Math.min(box.scrollHeight, 200)}px`;
  send.disabled = box.value.trim() === "";
}

function sendAsk(): void {
  const text = box.value;
  if (text.trim() === "") {
    return;
  }
  pending = text;
  box.value = "";
  saveDraft();
  fitBox();
  vscode.postMessage({ type: "ask", text });
}

window.addEventListener("message", (event: MessageEvent<ToPanel>) => {
  const message = event.data;
  switch (message.type) {
    case "show":
      show(message.state);
      showChat(message.chat);
      break;
    case "chat":
      showChat(message.chat);
      break;
    case "append":
      append(message.id, message.text);
      break;
    case "hint":
      hint.textContent = message.text;
      break;
    case "asked":
      // Never lost: if it wasn't sent, it goes back in the box, unless
      // she's already typing something new.
      if (!message.sent && box.value === "") {
        box.value = pending;
        saveDraft();
        fitBox();
      }
      pending = "";
      break;
    case "forget":
      box.value = "";
      pending = "";
      saveDraft();
      fitBox();
      break;
  }
});

for (const [name, button] of Object.entries(buttons)) {
  button.addEventListener("click", () => {
    hint.textContent = "";
    vscode.postMessage({ type: "button", button: name as PanelButton });
  });
}
welcome.addEventListener("click", () => vscode.postMessage({ type: "button", button: "welcome" }));

box.addEventListener("input", () => {
  saveDraft();
  fitBox();
});
fitBox();
box.addEventListener("keydown", (event) => {
  if (sendsOnKey(event.key, event.shiftKey, event.isComposing)) {
    event.preventDefault();
    sendAsk();
  }
});
askForm.addEventListener("submit", (event) => {
  event.preventDefault();
  sendAsk();
});

vscode.postMessage({ type: "ready" });
