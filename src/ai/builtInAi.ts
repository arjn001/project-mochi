import * as vscode from "vscode";
import { compose } from "./compose";
import { BrainError, BrainProblem, Provider } from "./provider";
import { GatedRequest } from "./shareGate";

// VS Code's built-in AI, through her Copilot sign-in. No key needed. The
// first request shows VS Code's own one-time permission prompt, so it must
// only ever happen because she asked something.
export class BuiltInAi implements Provider {
  readonly name = "Copilot";

  private async model(): Promise<vscode.LanguageModelChat | undefined> {
    const [model] = await vscode.lm.selectChatModels({ vendor: "copilot" });
    return model;
  }

  async isAvailable(): Promise<boolean> {
    try {
      return (await this.model()) !== undefined;
    } catch {
      return false;
    }
  }

  async *send(request: GatedRequest, instructions: string, signal?: AbortSignal): AsyncIterable<string> {
    const model = await this.model();
    if (!model) {
      throw new BrainError("unavailable", "No Copilot model is available.");
    }
    // VS Code has no "system" role, so Mochi's instructions go first, and a
    // short reply from the assistant marks where her question begins.
    const messages = [
      vscode.LanguageModelChatMessage.User(instructions),
      vscode.LanguageModelChatMessage.Assistant("Understood. I'll answer as described, and follow those rules."),
      vscode.LanguageModelChatMessage.User(compose(request)),
    ];
    const cancel = new vscode.CancellationTokenSource();
    signal?.addEventListener("abort", () => cancel.cancel());
    try {
      const response = await model.sendRequest(
        messages,
        { justification: "Mochi uses Copilot to answer the questions you ask it." },
        cancel.token
      );
      for await (const piece of response.text) {
        yield piece;
      }
    } catch (error) {
      throw toBrainError(error);
    } finally {
      cancel.dispose();
    }
  }
}

function toBrainError(error: unknown): BrainError {
  if (error instanceof BrainError) {
    return error;
  }
  if (error instanceof vscode.LanguageModelError) {
    const problems: Record<string, BrainProblem> = {
      [vscode.LanguageModelError.NoPermissions.name]: "noPermission",
      [vscode.LanguageModelError.Blocked.name]: "blocked",
      [vscode.LanguageModelError.NotFound.name]: "unavailable",
    };
    return new BrainError(problems[error.code] ?? "other", error.message);
  }
  return new BrainError("other", error instanceof Error ? error.message : String(error));
}
