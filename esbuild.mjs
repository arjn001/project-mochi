// Bundles Mochi into one file, dist/extension.js: the only code in the
// published .vsix. TypeScript still compiles everything to out/ for the
// tests and the development-only tools (see DECISIONS.md, "Building and
// packaging"). `node esbuild.mjs --watch` rebuilds on every change, for F5.
import * as esbuild from "esbuild";

const watch = process.argv.includes("--watch");

// The development-only tools are loaded with require() only in development
// mode. They stay out of the bundle; at runtime the bundle loads them from
// out/, which never ships.
const devToolsStayOut = {
  name: "dev-tools-stay-out",
  setup(build) {
    build.onResolve({ filter: /^\.\/dev\/devTools$/ }, () => ({ path: "../out/dev/devTools.js", external: true }));
  },
};

// Tells VS Code's watch task when a build starts and ends, and prints errors
// on one line it can read (see .vscode/tasks.json).
const progress = {
  name: "progress",
  setup(build) {
    build.onStart(() => console.log("[watch] build started"));
    build.onEnd((result) => {
      for (const { text, location } of result.errors) {
        console.error(`✘ [ERROR] ${text} (${location?.file}:${location?.line}:${location?.column})`);
      }
      console.log("[watch] build finished");
    });
  },
};

const options = {
  entryPoints: ["src/extension.ts"],
  bundle: true,
  outfile: "dist/extension.js",
  platform: "node",
  format: "cjs",
  // VS Code 1.125, our oldest supported version, runs Node 22.
  target: "node22",
  sourcemap: true,
  // VS Code provides this module at runtime.
  external: ["vscode"],
  plugins: [devToolsStayOut, progress],
  logLevel: "silent",
};

if (watch) {
  await (await esbuild.context(options)).watch();
} else {
  const result = await esbuild.build(options);
  if (result.errors.length > 0) {
    process.exit(1);
  }
}
