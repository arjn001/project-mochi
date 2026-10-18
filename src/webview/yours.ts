// The script inside the "Make it yours" page (MOCHI-43). It runs in the
// webview, not in the extension: it shows what Mochi sends and reports what
// she changes. It decides nothing and has no words of its own, and builds
// everything with createElement and text nodes, never HTML.
import { FromYours, ToYours, YoursState } from "../yours/messages";

interface VsCodeApi {
  postMessage(message: FromYours): void;
}
declare function acquireVsCodeApi(): VsCodeApi;

const vscode = acquireVsCodeApi();
const title = document.getElementById("title") as HTMLHeadingElement;
const sections = document.getElementById("sections") as HTMLDivElement;

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

function section(heading: string): HTMLElement {
  const box = element("section", "mochi-yours-section");
  box.append(element("h2", "mochi-yours-heading", heading));
  return box;
}

function show(state: YoursState): void {
  document.title = state.title;
  title.textContent = state.title;
  const { about, talk, brain, focus, touches } = state.sections;
  sections.replaceChildren(section(about), section(talk), section(brain), section(focus), section(touches));
}

window.addEventListener("message", (event: MessageEvent<ToYours>) => {
  if (event.data.type === "show") {
    show(event.data.state);
  }
});

vscode.postMessage({ type: "ready" });
