// Explaining errors and code, one step at a time (MOCHI-30). Plain code
// with no VS Code dependency.
//
// The learning ladder, from VISION principle 3 (explain and guide rather
// than doing coursework): Explain is the default. A hint only if she asks,
// and the fix only when she explicitly asks for it. With Learning mode off
// (MOCHI-64), "direct" explains briefly and shows the fix right away.
import { Attachment, Request } from "./shareGate";

export type Step = "explain" | "hint" | "fix" | "direct";

const ERROR_STEPS: Record<Step, string> = {
  explain: "Explain this error: what it means, why it happens, and where to look. Don't give the fix.",
  hint: "Give me a hint for this error: one small nudge in the right direction, not the fix.",
  fix: "Show me the fix: the smallest change that fixes it, and why it works.",
  direct: "Explain this error briefly, then show the fix: the smallest change that fixes it, and why it works.",
};

// Where explaining an error starts: the bottom of the ladder, or straight to
// the fix when Learning mode is off.
export const firstStep = (learning: boolean): Step => (learning ? "explain" : "direct");

// Lines shared around an error: the error line, and this many above and below.
export const LINES_AROUND = 3;

// The lines around an error, numbered so the AI can say "line 12".
export function linesAround(lines: string[], errorLine: number, around: number = LINES_AROUND) {
  const from = Math.max(1, errorLine - around);
  const to = Math.min(lines.length, errorLine + around);
  const width = String(to).length;
  const text = lines
    .slice(from - 1, to)
    .map((line, i) => `${String(from + i).padStart(width)}| ${line}`)
    .join("\n");
  return { from, to, text };
}

export interface CodeError {
  message: string;
  // The file name, never the full path.
  file: string;
  // Every line of the file. Only the few around the error are shared.
  lines: string[];
  // Starts at 1.
  line: number;
}

// The error message travels inside the attachment, so "Send without it"
// leaves it behind too.
export function errorRequest(step: Step, error: CodeError): Request {
  const { from, to, text } = linesAround(error.lines, error.line);
  const attachment: Attachment = {
    kind: "errorContext",
    label: error.file,
    text: `Error: ${error.message}\n\n${text}`,
    from,
    to,
    errorLine: error.line,
  };
  return { message: ERROR_STEPS[step], attachments: [attachment] };
}

export function stepMessage(step: Step): string {
  return ERROR_STEPS[step];
}

export function selectionRequest(file: string, code: string): Request {
  return {
    message: "Explain this code: what it does and how it works, in plain words.",
    attachments: [{ kind: "selection", label: file, text: code }],
  };
}

// What Mochi offers after each step, in its own words. Never skips ahead.
export function nextSteps(step: Step): { prompt: string; choices: { label: string; step: Step }[] } | undefined {
  switch (step) {
    case "explain":
      return {
        prompt: "Want a hint, or the fix?",
        choices: [
          { label: "Give me a hint", step: "hint" },
          { label: "Show the fix", step: "fix" },
        ],
      };
    case "hint":
      return { prompt: "Want to see the fix?", choices: [{ label: "Show the fix", step: "fix" }] };
    case "fix":
    case "direct":
      return undefined;
  }
}
