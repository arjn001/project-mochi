// The script inside the "Make it yours" page (MOCHI-43). It runs in the
// webview, not in the extension: it shows what Mochi sends and reports what
// she changes. It decides nothing and has no words of its own, and builds
// everything with createElement and text nodes, never HTML.
import { Field, FieldId, FromYours, ToYours, YoursState } from "../yours/messages";

interface VsCodeApi {
  postMessage(message: FromYours): void;
}
declare function acquireVsCodeApi(): VsCodeApi;

const vscode = acquireVsCodeApi();
const title = document.getElementById("title") as HTMLHeadingElement;
const sections = document.getElementById("sections") as HTMLDivElement;

let savedWord = "";
// Each field's status line: "Saved", or a kind hint.
const statuses = new Map<FieldId, HTMLElement>();
const timers = new Map<FieldId, ReturnType<typeof setTimeout>>();

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

const edit = (field: FieldId, value: string | number | boolean) => vscode.postMessage({ type: "edit", field, value });

// The quiet status after a field: announced politely to screen readers.
function status(field: FieldId): HTMLElement {
  const line = element("span", "mochi-yours-status");
  line.id = `status-${field}`;
  line.setAttribute("aria-live", "polite");
  statuses.set(field, line);
  return line;
}

function draw(field: Field): HTMLElement {
  const row = element("div", "mochi-yours-field");
  switch (field.kind) {
    case "choice": {
      const group = element("fieldset", "mochi-yours-choice");
      group.append(element("legend", "mochi-yours-label", field.label));
      for (const option of field.options) {
        const id = `${field.id}-${option.value}`;
        const radio = element("input");
        radio.type = "radio";
        radio.name = field.id;
        radio.id = id;
        radio.value = option.value;
        radio.checked = option.value === field.value;
        radio.addEventListener("change", () => edit(field.id, option.value));
        const label = element("label", "mochi-yours-option");
        label.htmlFor = id;
        label.append(element("span", "mochi-yours-option-name", option.label), element("span", "mochi-yours-description", option.description));
        const line = element("div", "mochi-yours-option-row");
        line.append(radio, label);
        group.append(line);
      }
      row.append(group);
      break;
    }
    case "toggle": {
      const box = element("input");
      box.type = "checkbox";
      box.id = field.id;
      box.checked = field.value;
      box.addEventListener("change", () => edit(field.id, box.checked));
      const label = element("label", "mochi-yours-label", field.label);
      label.htmlFor = field.id;
      const line = element("div", "mochi-yours-option-row");
      line.append(box, label);
      row.append(line, element("p", "mochi-yours-description", field.description));
      break;
    }
    case "number": {
      const label = element("label", "mochi-yours-label", field.label);
      label.htmlFor = field.id;
      const input = element("input", "mochi-yours-input mochi-yours-number");
      input.type = "number";
      input.id = field.id;
      input.min = String(field.min);
      input.max = String(field.max);
      input.step = "1";
      input.value = String(field.value);
      // Saved on Enter or when she leaves the field, never every keystroke.
      input.addEventListener("change", () => edit(field.id, input.value));
      row.append(label, element("p", "mochi-yours-description", field.description), input);
      break;
    }
  }
  if (field.note) {
    row.append(element("p", "mochi-yours-note", field.note));
  }
  row.append(status(field.id));
  return row;
}

function show(state: YoursState): void {
  document.title = state.title;
  title.textContent = state.title;
  savedWord = state.saved;
  statuses.clear();
  sections.replaceChildren(
    ...state.sections.map((section) => {
      const box = element("section", "mochi-yours-section");
      box.append(element("h2", "mochi-yours-heading", section.heading), ...section.fields.map(draw));
      return box;
    })
  );
}

function result(field: FieldId, ok: boolean, hint?: string): void {
  const line = statuses.get(field);
  if (!line) {
    return;
  }
  clearTimeout(timers.get(field));
  line.classList.toggle("mochi-yours-hint", !ok);
  line.textContent = ok ? savedWord : (hint ?? "");
  // "Saved" fades after a moment; a hint stays until she fixes it.
  if (ok) {
    timers.set(field, setTimeout(() => (line.textContent = ""), 2000));
  }
}

window.addEventListener("message", (event: MessageEvent<ToYours>) => {
  const message = event.data;
  if (message.type === "show") {
    show(message.state);
  } else if (message.type === "result") {
    result(message.field, message.ok, message.ok ? undefined : message.hint);
  }
});

vscode.postMessage({ type: "ready" });
