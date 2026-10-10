// The script inside Mochi's panel (MOCHI-16). It runs in the webview, not
// in the extension: it shows what Mochi sends, reports clicks, and keeps
// her unsent draft. It decides nothing and has no words of its own.
import { FromPanel, PanelButton, PanelState, ToPanel, sendsOnKey } from "../panel/messages";

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
  send.textContent = state.ask.send;
}

function sendAsk(): void {
  const text = box.value;
  if (text.trim() === "") {
    return;
  }
  pending = text;
  box.value = "";
  saveDraft();
  vscode.postMessage({ type: "ask", text });
}

window.addEventListener("message", (event: MessageEvent<ToPanel>) => {
  const message = event.data;
  switch (message.type) {
    case "show":
      show(message.state);
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
      }
      pending = "";
      break;
    case "forget":
      box.value = "";
      pending = "";
      saveDraft();
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

box.addEventListener("input", saveDraft);
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
