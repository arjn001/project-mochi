// The "Make it yours" page (MOCHI-43), and "Make a gift" (MOCHI-55). Plain code with no VS Code
// dependency. Structure only, like the panel: no words, no inline styles
// or scripts, and no colors (panel.css has Mochi's tokens; yours.css only
// uses them).
import { contentSecurityPolicy } from "../panel/html";

export interface YoursPage {
  cspSource: string;
  nonce: string;
  // The panel's stylesheet, for Mochi's tokens, then the page's own.
  tokensUri: string;
  styleUri: string;
  scriptUri: string;
}

export function yoursHtml(page: YoursPage): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="${contentSecurityPolicy(page)}">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="${page.tokensUri}">
  <link rel="stylesheet" href="${page.styleUri}">
</head>
<body class="mochi-yours">
  <main class="mochi-yours-page">
    <h1 class="mochi-yours-title" id="title"></h1>
    <p class="mochi-yours-intro" id="intro" hidden></p>
    <div id="sections"></div>
  </main>
  <script nonce="${page.nonce}" src="${page.scriptUri}"></script>
</body>
</html>`;
}
