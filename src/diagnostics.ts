import * as vscode from "vscode";
import { countsAsError } from "./problems";

// Whether a problem VS Code shows counts as an error for Mochi: every error,
// plus the few warnings that crash when the code runs (see problems.ts).
export function isMochiError(d: vscode.Diagnostic): boolean {
  const severity =
    d.severity === vscode.DiagnosticSeverity.Error
      ? "error"
      : d.severity === vscode.DiagnosticSeverity.Warning
        ? "warning"
        : "other";
  return countsAsError({ severity, source: d.source, code: d.code });
}
