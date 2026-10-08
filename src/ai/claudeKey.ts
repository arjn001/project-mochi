import * as vscode from "vscode";

// Her own Claude key (MOCHI-53, part 2), kept in VS Code's secret storage:
// her system's keychain, on her own computer, even when Mochi runs on a
// remote machine. Never in settings, files, or Mochi's other storage.
export const CLAUDE_KEY = "mochi.claudeKey";

// True while a key is saved, so "Mochi: Remove my Claude key" only shows
// when there's one to remove.
export const HAS_CLAUDE_KEY = "mochi.hasClaudeKey";

export class ClaudeKey implements vscode.Disposable {
  private readonly changed = new vscode.EventEmitter<void>();
  // When the key is added or removed, in this window or another one.
  readonly onDidChange = this.changed.event;
  private readonly watching: vscode.Disposable;

  constructor(private readonly secrets: vscode.SecretStorage) {
    this.watching = secrets.onDidChange((event) => {
      if (event.key === CLAUDE_KEY) {
        void this.refresh();
      }
    });
    void this.refresh();
  }

  // Undefined when there's no key, or the keychain can't be read.
  async get(): Promise<string | undefined> {
    try {
      return (await this.secrets.get(CLAUDE_KEY)) || undefined;
    } catch {
      return undefined;
    }
  }

  // Throws if the keychain can't save it, so she can be told.
  async save(key: string): Promise<void> {
    await this.secrets.store(CLAUDE_KEY, key);
  }

  async remove(): Promise<void> {
    await this.secrets.delete(CLAUDE_KEY);
  }

  private async refresh(): Promise<void> {
    await vscode.commands.executeCommand("setContext", HAS_CLAUDE_KEY, (await this.get()) !== undefined);
    this.changed.fire();
  }

  dispose(): void {
    this.watching.dispose();
    this.changed.dispose();
  }
}
