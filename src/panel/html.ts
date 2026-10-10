// The panel's page (MOCHI-16). Plain code with no VS Code dependency.
//
// Structure only: no words (they arrive from Mochi in a "show" message), no
// inline styles or scripts (a strict content security policy forbids them),
// and no colors (they live in media/panel/panel.css, from VS Code's theme).

export interface PanelPage {
  // The webview's own source, for the content security policy.
  cspSource: string;
  // A fresh random value for each page, so only Mochi's script runs.
  nonce: string;
  styleUri: string;
  scriptUri: string;
}

// Nothing is allowed unless listed: the stylesheet and the icon font from
// Mochi's own files, and the one script carrying the nonce.
export const contentSecurityPolicy = (page: Pick<PanelPage, "cspSource" | "nonce">): string =>
  [
    "default-src 'none'",
    `style-src ${page.cspSource}`,
    `font-src ${page.cspSource}`,
    `script-src 'nonce-${page.nonce}'`,
  ].join("; ");

export function panelHtml(page: PanelPage): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="${contentSecurityPolicy(page)}">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="${page.styleUri}">
</head>
<body>
  <header class="mochi-top">
    <span class="mochi-avatar" id="avatar" aria-hidden="true"></span>
    <p class="mochi-mood" id="mood"></p>
    <p class="mochi-greeting" id="greeting" aria-live="polite"></p>
    <button class="mochi-button mochi-primary" id="welcome" type="button" hidden></button>
  </header>
  <main class="mochi-middle">
    <div class="mochi-actions">
      <button class="mochi-button" id="explain" type="button"></button>
      <button class="mochi-button" id="focus" type="button"></button>
      <button class="mochi-button" id="dark" type="button"></button>
    </div>
    <p class="mochi-hint" id="hint" aria-live="polite"></p>
  </main>
  <footer class="mochi-bottom">
    <form class="mochi-ask" id="ask-form">
      <label class="mochi-hidden-label" id="ask-label" for="ask"></label>
      <textarea class="mochi-box" id="ask" rows="3"></textarea>
      <button class="mochi-button mochi-primary" id="send" type="submit"></button>
    </form>
  </footer>
  <script nonce="${page.nonce}" src="${page.scriptUri}"></script>
</body>
</html>`;
}
