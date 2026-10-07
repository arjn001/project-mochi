// Which problems in her code count as errors for Mochi (MOCHI-66). Plain
// code with no VS Code dependency.
//
// Errors always count. A few warnings count too, because they always crash
// the program when it runs, like Pylance's "y" is not defined (a NameError).
// They're matched by the tool and the warning's code, never its text, so it
// works in any display language. Ordinary warnings, like an unused import,
// never count.

// The one place to add another warning that crashes.
export const CRASHING_WARNINGS: readonly { sources: readonly string[]; code: string }[] = [
  // Python: a name that isn't defined anywhere (NameError when it runs).
  { sources: ["pylance", "pyright", "basedpyright"], code: "reportUndefinedVariable" },
];

export interface Problem {
  severity: "error" | "warning" | "other";
  // The tool that reported it, like "Pylance".
  source?: string;
  // Its code, like "reportUndefinedVariable". VS Code also allows a code
  // with a link to its documentation.
  code?: string | number | { value: string | number };
}

const codeOf = (code: Problem["code"]): string | undefined =>
  code === undefined ? undefined : typeof code === "object" ? String(code.value) : String(code);

export function countsAsError(problem: Problem): boolean {
  if (problem.severity === "error") {
    return true;
  }
  if (problem.severity !== "warning") {
    return false;
  }
  const source = (problem.source ?? "").toLowerCase();
  const code = codeOf(problem.code);
  return CRASHING_WARNINGS.some((w) => w.sources.includes(source) && w.code === code);
}
