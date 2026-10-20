import { randomBytes } from "node:crypto";
import * as vscode from "vscode";
import { giftStrings, yoursStrings } from "../strings";
import { yoursHtml } from "./html";
import { ButtonId, FieldId, FromYours, GIFT_PARTS, PageParts, PreviewField, ToYours, YoursState, YOURS_PARTS, toFromYours } from "./messages";

// What the page asks the rest of Mochi for.
export interface YoursActions {
  state(): YoursState | Promise<YoursState>;
  // Checks and saves one change: saved, or a kind hint.
  edit(field: FieldId, value: string | number | boolean): Promise<{ ok: true } | { ok: false; hint: string }>;
  // Runs the command a button stands for.
  button(button: ButtonId): Promise<void>;
  // The page's preview, if it has one, sent again after each change.
  preview?(): PreviewField;
}

// Which page this is: VS Code's name for it, its tab title, and the fields
// and buttons it has.
export interface PageKind {
  viewType: string;
  title: string;
  parts: PageParts;
}

export const YOURS_PAGE: PageKind = { viewType: "mochi.yours", title: yoursStrings.title, parts: YOURS_PARTS };
export const GIFT_PAGE: PageKind = { viewType: "mochi.gift", title: giftStrings.title, parts: GIFT_PARTS };

// A page in the editor area: "Make it yours" (MOCHI-43), and "Make a gift"
// (MOCHI-55), which shares its script and look. Opened from the Command
// Palette or the Mochi tab's ... menu. A webview with the panel's strict
// content security policy. Opening it again brings the same tab forward.
export class MochiPage implements vscode.Disposable {
  private panel: vscode.WebviewPanel | undefined;
  private ready = false;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly actions: YoursActions,
    private readonly kind: PageKind = YOURS_PAGE
  ) {}

  open(): void {
    if (this.panel) {
      this.panel.reveal();
      return;
    }
    const media = vscode.Uri.joinPath(this.extensionUri, "media");
    const scripts = vscode.Uri.joinPath(this.extensionUri, "dist", "webview");
    const panel = vscode.window.createWebviewPanel(this.kind.viewType, this.kind.title, vscode.ViewColumn.Active, {
      enableScripts: true,
      // Only Mochi's media and the page's script, nothing else from her
      // computer.
      localResourceRoots: [media, scripts],
    });
    panel.iconPath = vscode.Uri.joinPath(media, "icons", "mochi-here.svg");
    const webview = panel.webview;
    webview.html = yoursHtml({
      cspSource: webview.cspSource,
      nonce: randomBytes(16).toString("base64"),
      tokensUri: webview.asWebviewUri(vscode.Uri.joinPath(media, "panel", "panel.css")).toString(),
      styleUri: webview.asWebviewUri(vscode.Uri.joinPath(media, "yours", "yours.css")).toString(),
      scriptUri: webview.asWebviewUri(vscode.Uri.joinPath(scripts, "yours.js")).toString(),
    });
    webview.onDidReceiveMessage((message) => void this.receive(toFromYours(message, this.kind.parts)));
    // Back in view: show the latest, in case something changed elsewhere.
    panel.onDidChangeViewState(() => void this.refresh());
    panel.onDidDispose(() => {
      this.panel = undefined;
      this.ready = false;
    });
    this.panel = panel;
  }

  // Shows the latest, if the page is open.
  async refresh(): Promise<void> {
    if (this.panel && this.ready) {
      this.post({ type: "show", state: await this.actions.state() });
    }
  }

  dispose(): void {
    this.panel?.dispose();
  }

  private post(message: ToYours): void {
    void this.panel?.webview.postMessage(message);
  }

  // Anything that isn't a message Mochi knows is ignored.
  private async receive(message: FromYours | undefined): Promise<void> {
    switch (message?.type) {
      case "ready":
        this.ready = true;
        await this.refresh();
        break;
      case "edit": {
        const result = await this.actions.edit(message.field, message.value);
        this.post(result.ok ? { type: "result", field: message.field, ok: true } : { type: "result", field: message.field, ok: false, hint: result.hint });
        if (result.ok && this.actions.preview) {
          this.post({ type: "preview", field: this.actions.preview() });
        }
        break;
      }
      case "button":
        await this.actions.button(message.button);
        await this.refresh();
        break;
    }
  }
}
