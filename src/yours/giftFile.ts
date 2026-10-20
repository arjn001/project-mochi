// Saving a gift as a .mochigift file (MOCHI-55), from "Make a gift", and
// her own touches from "Make it yours" in the same format.
//
// Mochi only writes the file she picks in the save dialog, and nothing
// else. It goes through VS Code's file system, so in a remote window it can
// be saved on the remote machine or, with "Show Local", on her own computer
// (VS Code hands Mochi that as a vscode-local address and writes it there;
// checked in VS Code 1.141's workbench code, 2026-10-19).
import * as os from "node:os";
import * as path from "node:path";
import * as vscode from "vscode";
import { GIFT_EXTENSION, GiftDraft, giftText } from "../packs/gift";
import { giftStrings } from "../strings";

// The save dialog and the disk, passed in so tests can use a temp folder.
export interface GiftFileIo {
  pick(defaultName: string): Thenable<vscode.Uri | undefined>;
  write(uri: vscode.Uri, content: Uint8Array): Thenable<void>;
}

export const dialogIo: GiftFileIo = {
  // Her home folder to start with, never her project, so a gift doesn't
  // end up in her commits by accident.
  pick: (defaultName) =>
    vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(path.join(os.homedir(), defaultName)),
      filters: { [giftStrings.fileType]: [GIFT_EXTENSION] },
    }),
  write: (uri, content) => vscode.workspace.fs.writeFile(uri, content),
};

export type SaveResult = { result: "empty" } | { result: "cancelled" } | { result: "failed" } | { result: "saved"; uri: vscode.Uri; name: string };

// Writes the gift to the file she picks. Nothing is asked when there's
// nothing to unwrap yet.
export async function saveGiftFile(gift: GiftDraft, defaultName: string, io: GiftFileIo = dialogIo): Promise<SaveResult> {
  const text = giftText(gift);
  if (!text.ok) {
    return { result: "empty" };
  }
  const uri = await io.pick(defaultName);
  if (!uri) {
    return { result: "cancelled" };
  }
  try {
    await io.write(uri, Buffer.from(text.value, "utf8"));
  } catch {
    return { result: "failed" };
  }
  return { result: "saved", uri, name: path.posix.basename(uri.path) };
}

// "Show the file" opens her file manager there, only in a window on her
// own computer. In a remote window there's no button, since revealing a
// file saved with "Show Local" isn't checked yet.
const canReveal = (uri: vscode.Uri): boolean => uri.scheme === "file" && vscode.env.remoteName === undefined;

// Save gift file..., with a kind line for every outcome.
export async function wrapGift(gift: GiftDraft, io: GiftFileIo = dialogIo): Promise<SaveResult> {
  const saved = await saveGiftFile(gift, giftStrings.defaultName, io);
  if (saved.result === "empty") {
    void vscode.window.showInformationMessage(giftStrings.nothingYet);
  } else if (saved.result === "failed") {
    const again = await vscode.window.showWarningMessage(giftStrings.couldntSave, giftStrings.saveGift);
    if (again === giftStrings.saveGift) {
      return wrapGift(gift, io);
    }
  } else if (saved.result === "saved") {
    const buttons = canReveal(saved.uri) ? [giftStrings.showFile] : [];
    void vscode.window.showInformationMessage(giftStrings.wrapped(saved.name), ...buttons).then((choice) => {
      if (choice === giftStrings.showFile) {
        void vscode.commands.executeCommand("revealFileInOS", saved.uri);
      }
    });
  }
  return saved;
}
