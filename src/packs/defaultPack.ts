// Loads the default pack that ships with Mochi (packs/default/pack.json).
// Plain Node code with no VS Code dependency, so it can be unit tested.
import * as fs from "node:fs";
import * as path from "node:path";
import { Pack, checkPack } from "./format";

// From out/packs/ back to the extension's root folder, for the unit tests.
// The extension passes the real location, since the bundle lives in dist/.
const DEFAULT_PACK = path.join(__dirname, "..", "..", "packs", "default", "pack.json");

export function loadDefaultPack(file: string = DEFAULT_PACK): Pack {
  const result = checkPack(JSON.parse(fs.readFileSync(file, "utf8")));
  if (!result.ok) {
    // The default pack ships with Mochi, so this is a bug, not bad input.
    throw new Error(`The default pack is broken:\n${result.errors.join("\n")}`);
  }
  return result.value;
}
