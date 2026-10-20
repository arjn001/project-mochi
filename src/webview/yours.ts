// The script inside the "Make it yours" page (MOCHI-43), also used by
// "Make a gift" (MOCHI-55). It runs in the webview, not in the extension:
// it shows what Mochi sends and reports what she changes. It decides
// nothing and has no words of its own, and builds everything with
// createElement and text nodes, never HTML.
import { Field, FieldId, FromYours, PreviewField, ToYours, YoursState } from "../yours/messages";

interface VsCodeApi {
  postMessage(message: FromYours): void;
}
declare function acquireVsCodeApi(): VsCodeApi;

const vscode = acquireVsCodeApi();
const title = document.getElementById("title") as HTMLHeadingElement;
const intro = document.getElementById("intro") as HTMLParagraphElement;
const sections = document.getElementById("sections") as HTMLDivElement;

let savedWord = "";
// The preview, if the page has one, so a change can redraw just that.
let previewRow: HTMLElement | undefined;
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
    case "longText":
    case "lines": {
      const label = element("label", "mochi-yours-label", field.label);
      label.htmlFor = field.id;
      const box = element("textarea", "mochi-yours-input mochi-yours-area");
      box.id = field.id;
      if (field.kind === "longText") {
        box.value = field.value;
        box.maxLength = field.maxLength;
        box.rows = 3;
      } else {
        box.value = field.value.join("\n");
        // Mochi's own lines, as an example of what goes here.
        box.placeholder = field.example;
        box.rows = Math.max(3, Math.min(8, field.example.split("\n").length + 1));
      }
      // Enter adds a line here, so it's saved when she leaves the field,
      // and only when it changed.
      let kept = box.value;
      box.addEventListener("change", () => {
        if (box.value !== kept) {
          kept = box.value;
          edit(field.id, box.value);
        }
      });
      row.append(label, element("p", "mochi-yours-description", field.description), box);
      break;
    }
    case "text": {
      const label = element("label", "mochi-yours-label", field.label);
      label.htmlFor = field.id;
      const input = element("input", "mochi-yours-input mochi-yours-text");
      input.type = "text";
      input.id = field.id;
      input.value = field.value;
      input.placeholder = field.placeholder;
      input.maxLength = field.maxLength;
      // Saved on Enter or when she leaves the field, never every keystroke,
      // and only when it changed. An empty field never erases her name:
      // that's what "Forget my name" is for. A gift's names can be emptied.
      let kept = field.value;
      const save = () => {
        if ((field.clearable || input.value.trim() !== "") && input.value !== kept) {
          kept = input.value;
          edit(field.id, input.value);
        }
      };
      input.addEventListener("change", save);
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && !event.isComposing) {
          event.preventDefault();
          save();
        }
      });
      row.append(label, input);
      break;
    }
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
    case "actions": {
      if (field.now) {
        row.append(element("p", "mochi-yours-now", field.now));
      }
      const buttons = element("div", "mochi-yours-buttons");
      for (const button of field.buttons) {
        const made = element("button", "mochi-button", button.label);
        made.type = "button";
        made.id = `button-${button.id}`;
        made.addEventListener("click", () => vscode.postMessage({ type: "button", button: button.id }));
        buttons.append(made);
      }
      row.append(buttons);
      return row;
    }
    case "preview": {
      // Mochi's bubbles, like in the panel, with the little cat.
      const list = element("div", "mochi-yours-preview");
      for (const item of field.items) {
        const message = element("div", "mochi-message mochi-from-mochi");
        const cat = element("span", "mochi-message-cat");
        cat.setAttribute("aria-hidden", "true");
        const body = element("div", "mochi-message-body");
        body.append(element("p", "mochi-yours-description", item.label), element("div", "mochi-bubble", item.line));
        message.append(cat, body);
        list.append(message);
      }
      row.append(list);
      if (field.note) {
        row.append(element("p", "mochi-yours-note", field.note));
      }
      previewRow = row;
      return row;
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
  intro.textContent = state.intro ?? "";
  intro.hidden = !state.intro;
  savedWord = state.saved;
  statuses.clear();
  previewRow = undefined;
  // Whatever she was on keeps focus after the page is redrawn, like a
  // button she just pressed.
  const focused = document.activeElement?.id;
  sections.replaceChildren(
    ...state.sections.map((section) => {
      const box = element("section", "mochi-yours-section");
      if (section.heading) {
        box.append(element("h2", "mochi-yours-heading", section.heading));
      }
      box.append(...section.fields.map(draw));
      return box;
    })
  );
  if (focused) {
    document.getElementById(focused)?.focus();
  }
}

function showPreview(field: PreviewField): void {
  previewRow?.replaceWith(draw(field));
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
  } else if (message.type === "preview") {
    showPreview(message.field);
  } else if (message.type === "result") {
    result(message.field, message.ok, message.ok ? undefined : message.hint);
  }
});

vscode.postMessage({ type: "ready" });
