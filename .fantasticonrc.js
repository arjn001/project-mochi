// Builds media/font/mochi-icons.woff from the mood icons in media/icons/.
// Run with: npm run build:icons
module.exports = {
  inputDir: "media/icons",
  outputDir: "media/font",
  name: "mochi-icons",
  fontTypes: ["woff"],
  assetTypes: [],

  // Same grid as VS Code's own icons: a 300-unit square on the baseline.
  // No normalizing, so every mood keeps its place on the 16x16 grid.
  fontHeight: 300,
  descent: 0,
  normalize: false,

  // Fixed character numbers. package.json points at these, so they must
  // never change. New icons get the next free number.
  codepoints: {
    "mochi-here": 0xe001,
    "mochi-purring": 0xe002,
    "mochi-napping": 0xe003,
  },
};
