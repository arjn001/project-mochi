import { randomBytes } from "node:crypto";
import * as vscode from "vscode";
import { panelHtml } from "./html";
import { ChatChange } from "./chatLog";
import { ChatEntry, FromPanel, PanelButton, PanelState, ToPanel, toFromPanel } from "./messages";

// What the panel asks the rest of Mochi to do.
export interface PanelActions {
  state(): PanelState;
  chat(): readonly ChatEntry[];
  // True if it was sent, so the panel knows whether to put the text back.
  ask(text: string): Promise<boolean>;
  button(button: PanelButton): Promise<void>;
  chip(entry: number, chip: string): void;
  // The x on the attachment chip.
  leaveOut(): void;
  // Stops the answer being written.
  stop(): Promise<void>;
  copy(text: string): Promise<void>;
  openLink(url: string): Promise<void>;
}

// Mochi's panel, the "Mochi" tab in the secondary side bar (MOCHI-16). A
// webview with a strict content security policy, styled only from VS Code's
// theme. It holds no state of its own beyond her unsent draft: Mochi sends
// everything it shows whenever it opens or something changes.
export class MochiPanel implements vscode.WebviewViewProvider {
  private view: vscode.WebviewView | undefined;
  private ready = false;
  private whenReadyCallbacks: (() => void)[] = [];
  // "Forget everything" while the panel was closed: clear the draft the
  // next time it opens.
  private forgetDraft = false;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly actions: PanelActions
  ) {}

  resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view;
    this.ready = false;
    const media = vscode.Uri.joinPath(this.extensionUri, "media");
    const script = vscode.Uri.joinPath(this.extensionUri, "dist", "webview");
    view.webview.options = {
      enableScripts: true,
      // Only Mochi's media (the stylesheet and icon font) and the panel's
      // script, nothing else from her computer.
      localResourceRoots: [media, script],
    };
    view.webview.html = panelHtml({
      cspSource: view.webview.cspSource,
      nonce: randomBytes(16).toString("base64"),
      styleUri: view.webview.asWebviewUri(vscode.Uri.joinPath(media, "panel", "panel.css")).toString(),
      scriptUri: view.webview.asWebviewUri(vscode.Uri.joinPath(script, "panel.js")).toString(),
    });
    view.webview.onDidReceiveMessage((message) => this.receive(toFromPanel(message)));
    view.onDidChangeVisibility(() => this.refresh());
    view.onDidDispose(() => {
      this.view = undefined;
      this.ready = false;
    });
  }

  // Whether she can see the panel right now.
  get visible(): boolean {
    return this.ready && this.view?.visible === true;
  }

  // Resolves true once the panel is open and showing, or false after `ms`.
  // False right away if the panel isn't opening at all, unless `opening`
  // says Mochi just asked VS Code to open it.
  whenVisible(ms: number, opening = false): Promise<boolean> {
    if (this.visible || (!this.view && !opening)) {
      return Promise.resolve(this.visible);
    }
    return new Promise((done) => {
      const timer = setTimeout(() => done(this.visible), ms);
      this.whenReadyCallbacks.push(() => {
        clearTimeout(timer);
        done(this.visible);
      });
    });
  }

  // Shows the latest state and the whole chat, if the panel is open.
  refresh(): void {
    if (this.visible) {
      this.post({ type: "show", state: this.actions.state(), chat: this.actions.chat() });
    }
  }

  // The chat changed. A closed panel catches up when it opens.
  chatChanged(change: Exclude<ChatChange, { type: "done" }>): void {
    if (!this.visible) {
      return;
    }
    this.post(change.type === "all" ? { type: "chat", chat: this.actions.chat() } : change);
  }

  // Read once by screen readers, if she can see the panel.
  announce(text: string): void {
    if (this.visible) {
      this.post({ type: "announce", text });
    }
  }

  // Shows the panel without taking her focus, like when she clicks "Explain
  // with Mochi" in the editor.
  reveal(): void {
    if (this.view) {
      if (!this.view.visible) {
        this.view.show(true);
      }
      return;
    }
    // Not opened yet in this window: open Mochi's tab, then hand her focus
    // back to the editor she was in.
    void vscode.commands
      .executeCommand("mochi.open")
      .then(() => vscode.commands.executeCommand("workbench.action.focusActiveEditorGroup"));
  }

  hint(text: string): void {
    this.post({ type: "hint", text });
  }

  // "Forget everything": the unsent draft goes too.
  forget(): void {
    if (this.ready) {
      this.post({ type: "forget" });
    } else {
      this.forgetDraft = true;
    }
  }

  private post(message: ToPanel): void {
    if (this.ready) {
      void this.view?.webview.postMessage(message);
    }
  }

  // Anything that isn't a message Mochi knows is ignored.
  private async receive(message: FromPanel | undefined): Promise<void> {
    switch (message?.type) {
      case "ready":
        this.ready = true;
        if (this.forgetDraft) {
          this.forgetDraft = false;
          this.post({ type: "forget" });
        }
        this.refresh();
        for (const callback of this.whenReadyCallbacks.splice(0)) {
          callback();
        }
        break;
      case "ask":
        this.post({ type: "asked", sent: await this.actions.ask(message.text) });
        break;
      case "button":
        await this.actions.button(message.button);
        break;
      case "chip":
        this.actions.chip(message.entry, message.chip);
        break;
      case "leaveOut":
        this.actions.leaveOut();
        break;
      case "stop":
        await this.actions.stop();
        break;
      case "copy":
        await this.actions.copy(message.text);
        break;
      case "openLink":
        await this.actions.openLink(message.url);
        break;
    }
  }

  register(): vscode.Disposable {
    return vscode.window.registerWebviewViewProvider("mochi.home", this);
  }
}
