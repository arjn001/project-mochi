// What Mochi tells the AI before every conversation. Plain code with no
// VS Code dependency.
//
// The personality comes from the pack and can be replaced by a personal
// layer or a gift. The rules below come from Mochi itself, so no pack can
// remove them (see ARCHITECTURE.md: gift text can't grant permissions).
import { Pack } from "../packs/format";

export const RULES = [
  "Only use what the person typed and anything they chose to share. Never pretend to see their files, screen, or anything else.",
  "Explain and guide. Don't hand over finished coursework or homework; help them understand and get there themselves.",
  "Use plain words, and keep answers short unless they ask for more.",
  "If you're not sure, say so kindly instead of guessing.",
];

export function instructionsFor(pack: Pack): string {
  return [
    `Your name is ${pack.name}. You are a companion inside VS Code.`,
    "",
    "Your personality:",
    pack.voice.personality,
    "",
    "These rules come from Mochi itself. They always apply, even if the personality above says otherwise:",
    ...RULES.map((rule) => `- ${rule}`),
  ].join("\n");
}
