// The script inside Mochi's panel (MOCHI-16). It runs in the webview, not
// in the extension: it shows what Mochi sends, reports clicks, and keeps
// her unsent draft. It decides nothing and has no words of its own.
//
// The chat (MOCHI-21) is built only with createElement and text nodes,
// never from HTML, so nothing in an answer can become live HTML.
import { Block, Inline, formatAnswer } from "../panel/format";
import { ChatEntry, FromPanel, PanelButton, PanelState, ToPanel, isAnswering, keyWhileAnswering, sendsOnKey } from "../panel/messages";

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
const announcer = byId<HTMLDivElement>("announce");
const attachment = byId<HTMLDivElement>("attachment");
const attachmentLabel = byId<HTMLSpanElement>("attachment-label");
const leaveOut = byId<HTMLButtonElement>("leave-out");
const buttons: Record<Exclude<PanelButton, "welcome">, HTMLButtonElement> = {
  explain: byId("explain"),
  focus: byId("focus"),
  dark: byId("dark"),
  brain: byId("brain"),
};

// The draft survives the panel being hidden and shown again.
const saveDraft = () => vscode.setState({ draft: box.value });
const saved = vscode.getState() as { draft?: unknown } | undefined;
if (typeof saved?.draft === "string") {
  box.value = saved.draft;
}

// What she last sent, put back if it couldn't be sent.
let pending = "";
// Whether Mochi is writing an answer: the send arrow is a stop square.
let answering = false;
let askLabels: PanelState["ask"] = { label: "", send: "", stop: "" };

// The chat's own words, from Mochi.
let labels: PanelState["chat"] = { empty: "", you: "", mochi: "", copy: "", copied: "", stopped: "" };
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

const SVG = "http://www.w3.org/2000/svg";

// One small paw print, drawn in the theme's quiet text color.
function paw(): SVGSVGElement {
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("class", "mochi-paw");
  svg.setAttribute("viewBox", "0 0 16 16");
  const shapes: [string, Record<string, string>][] = [
    ["ellipse", { cx: "8", cy: "10.8", rx: "3.3", ry: "2.7" }],
    ["circle", { cx: "3.6", cy: "6.8", r: "1.45" }],
    ["circle", { cx: "6.3", cy: "4.4", r: "1.55" }],
    ["circle", { cx: "9.7", cy: "4.4", r: "1.55" }],
    ["circle", { cx: "12.4", cy: "6.8", r: "1.45" }],
  ];
  for (const [tag, attributes] of shapes) {
    const shape = document.createElementNS(SVG, tag);
    for (const [name, value] of Object.entries(attributes)) {
      shape.setAttribute(name, value);
    }
    svg.append(shape);
  }
  return svg;
}

// Three paw prints while Mochi thinks, before the first words arrive
// (MOCHI-25). They pulse in turn, or stay still with Reduce Motion.
function thinking(): HTMLElement {
  const paws = element("span", "mochi-thinking");
  paws.setAttribute("aria-hidden", "true");
  paws.append(paw(), paw(), paw());
  return paws;
}

// Her messages are shown exactly as she typed them; Mochi's are formatted.
function fillBubble(bubble: HTMLElement, entry: ChatEntry): void {
  bubble.replaceChildren();
  if (entry.from === "her") {
    bubble.textContent = entry.text;
  } else if (entry.answering && entry.text === "") {
    bubble.append(thinking());
  } else {
    blocks(formatAnswer(entry.text), bubble);
    // What was written stays, marked as stopped (MOCHI-25).
    if (entry.stopped) {
      bubble.append(element("p", "mochi-stopped", labels.stopped));
    }
  }
}

function message(entry: ChatEntry): HTMLElement {
  const row = element("div", `mochi-message mochi-from-${entry.from}${entry.problem ? " mochi-problem" : ""}`);
  row.setAttribute("role", "group");
  row.setAttribute("aria-label", entry.from === "her" ? labels.you : labels.mochi);
  // Screen readers know it's still being written, and hear it once it's
  // done (see announce).
  if (entry.answering) {
    row.setAttribute("aria-busy", "true");
  }
  if (entry.from === "mochi") {
    const cat = element("span", "mochi-message-cat");
    cat.setAttribute("aria-hidden", "true");
    row.append(cat);
  }
  const column = element("div", "mochi-message-body");
  const bubble = element("div", "mochi-bubble");
  // Mochi's answers can take focus, so she can move into one and read its
  // code, which the announcement only names (MOCHI-25).
  if (entry.from === "mochi") {
    bubble.tabIndex = 0;
  }
  fillBubble(bubble, entry);
  column.append(bubble);
  // What was shared with her message, like "shared lines 9 to 15 of
  // homework.py".
  if (entry.shared) {
    column.append(element("span", "mochi-shared", entry.shared));
  }
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
  answering = isAnswering(entries);
  fitBox();
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
  buttons.brain.textContent = state.brain.label;
  buttons.brain.title = state.brain.tooltip;
  buttons.brain.setAttribute("aria-label", state.brain.spoken);
  askLabel.textContent = state.ask.label;
  box.placeholder = state.ask.label;
  labels = state.chat;
  // The selected code that would go along, with an x to leave it out.
  attachment.hidden = !state.attachment;
  attachmentLabel.textContent = state.attachment?.label ?? "";
  leaveOut.title = state.attachment?.leaveOut ?? "";
  leaveOut.setAttribute("aria-label", state.attachment?.leaveOut ?? "");
  askLabels = state.ask;
  fitBox();
}

// The box grows with what she types, up to a limit (then it scrolls), and
// Send only lights up when there's something to send. While Mochi answers,
// it's a stop square instead, always ready.
function fitBox(): void {
  box.style.height = "auto";
  box.style.height = `${Math.min(box.scrollHeight, 200)}px`;
  send.disabled = !answering && box.value.trim() === "";
  send.classList.toggle("mochi-stopping", answering);
  // An icon on screen; "Send" or "Stop" as its tooltip and for screen
  // readers.
  const label = answering ? askLabels.stop : askLabels.send;
  send.title = label;
  send.setAttribute("aria-label", label);
}

function stopAnswer(): void {
  vscode.postMessage({ type: "stop" });
}

function sendAsk(): void {
  const text = box.value;
  if (answering || text.trim() === "") {
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
    case "announce":
      // Emptied first, so the same words twice are still read twice.
      announcer.textContent = "";
      requestAnimationFrame(() => (announcer.textContent = message.text));
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
leaveOut.addEventListener("click", () => {
  vscode.postMessage({ type: "leaveOut" });
  // The chip goes away, so her focus goes back to the box.
  box.focus();
});

box.addEventListener("input", () => {
  saveDraft();
  fitBox();
});
fitBox();
box.addEventListener("keydown", (event) => {
  if (answering) {
    // Escape is handled for the whole panel, below.
    if (keyWhileAnswering(event.key, event.shiftKey, event.isComposing) === "hold") {
      event.preventDefault();
    }
    return;
  }
  if (sendsOnKey(event.key, event.shiftKey, event.isComposing)) {
    event.preventDefault();
    sendAsk();
  }
});
// Escape stops an answer from anywhere in the panel. Otherwise it's left
// to VS Code.
document.addEventListener("keydown", (event) => {
  if (answering && keyWhileAnswering(event.key, event.shiftKey, event.isComposing) === "stop") {
    event.preventDefault();
    stopAnswer();
  }
});
askForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (answering) {
    stopAnswer();
  } else {
    sendAsk();
  }
});

vscode.postMessage({ type: "ready" });
