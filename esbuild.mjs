// Bundles Mochi into dist/extension.js, and the panel's own script into
// dist/webview/panel.js (MOCHI-16): the only code in the published .vsix. TypeScript still compiles everything to out/ for the
// tests and the development-only tools (see DECISIONS.md, "Building and
// packaging"). `node esbuild.mjs --watch` rebuilds on every change, for F5.
//
// Warnings count as errors. Third-party code in the bundle must be listed,
// with its license, in THIRD_PARTY_NOTICES.md; `npm run notices` rewrites
// that file from what esbuild actually bundled.
import * as esbuild from "esbuild";
import * as fs from "node:fs";
import * as path from "node:path";

const watch = process.argv.includes("--watch");
const writeNotices = process.argv.includes("--notices");
const NOTICES = "THIRD_PARTY_NOTICES.md";

// The development-only tools are loaded with require() only in development
// mode. They stay out of the bundle; at runtime the bundle loads them from
// out/, which never ships.
const devToolsStayOut = {
  name: "dev-tools-stay-out",
  setup(build) {
    build.onResolve({ filter: /^\.\/dev\/devTools$/ }, () => ({ path: "../out/dev/devTools.js", external: true }));
  },
};

// The packages esbuild put in the bundles, sorted: files that add bytes to
// them, not everything esbuild read and then left out as unused.
function bundledPackages(metafiles) {
  const names = new Set();
  for (const metafile of metafiles) {
    for (const output of Object.values(metafile.outputs)) {
      for (const [input, { bytesInOutput }] of Object.entries(output.inputs)) {
        const match = /(?:^|\/)node_modules\/((?:@[^/]+\/)?[^/]+)\//.exec(input);
        if (match && bytesInOutput > 0) {
          names.add(match[1]);
        }
      }
    }
  }
  return [...names].sort().map((name) => {
    const dir = path.join("node_modules", name);
    const manifest = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"));
    return { name, version: manifest.version, license: manifest.license, repository: manifest.repository, dir };
  });
}

const heading = (pkg) => `## ${pkg.name} ${pkg.version}`;

function noticesText(packages) {
  const parts = [
    "# Third-party notices",
    "",
    "Mochi's code is bundled into one file, `dist/extension.js`, which includes",
    "code from the packages below. Their licenses follow.",
    "",
    "This file is written by `npm run notices`. Don't edit it by hand.",
  ];
  if (packages.length === 0) {
    parts.push("", "The bundle includes no third-party code right now.");
  }
  for (const pkg of packages) {
    const file = fs.readdirSync(pkg.dir).find((name) => /^(licen[cs]e|copying|unlicense)(\.(md|txt))?$/i.test(name));
    const repository = typeof pkg.repository === "string" ? pkg.repository : pkg.repository?.url;
    parts.push("", heading(pkg), "", `License: ${pkg.license}`);
    if (file) {
      parts.push("", "```", fs.readFileSync(path.join(pkg.dir, file), "utf8").trim(), "```");
    } else {
      parts.push("", `The package includes no license file. Its source and license: ${repository ?? "(no repository listed)"}`);
    }
  }
  return parts.join("\n") + "\n";
}

// Problems with the notices, if any: every bundled package listed, nothing
// else.
function noticesProblems(packages) {
  const listed = fs.existsSync(NOTICES)
    ? fs.readFileSync(NOTICES, "utf8").split("\n").filter((line) => line.startsWith("## "))
    : [];
  const bundled = packages.map(heading);
  const missing = bundled.filter((line) => !listed.includes(line));
  const extra = listed.filter((line) => !bundled.includes(line));
  if (missing.length === 0 && extra.length === 0) {
    return [];
  }
  return [`${NOTICES} doesn't match the bundle. Run npm run notices. Missing: ${missing.join(", ") || "none"}. Not bundled: ${extra.join(", ") || "none"}.`];
}

// The latest metafile of each bundle, so the notices are checked against
// both together.
const latest = new Map();

// Tells VS Code's watch task when a build starts and ends, and prints errors
// on one line it can read (see .vscode/tasks.json). Warnings count as errors.
const progress = {
  name: "progress",
  setup(build) {
    build.onStart(() => console.log("[watch] build started"));
    build.onEnd((result) => {
      for (const { text, location } of [...result.errors, ...result.warnings]) {
        console.error(`✘ [ERROR] ${text} (${location?.file}:${location?.line}:${location?.column})`);
      }
      if (result.metafile) {
        latest.set(build.initialOptions.outfile, result.metafile);
      }
      if (watch && latest.size === 2) {
        for (const problem of noticesProblems(bundledPackages(latest.values()))) {
          console.error(`✘ [ERROR] ${problem}`);
        }
      }
      console.log("[watch] build finished");
    });
  },
};

const extension = {
  entryPoints: ["src/extension.ts"],
  bundle: true,
  outfile: "dist/extension.js",
  platform: "node",
  format: "cjs",
  // VS Code 1.125, our oldest supported version, runs Node 22.
  target: "node22",
  sourcemap: true,
  metafile: true,
  // VS Code provides this module at runtime. Everything else is bundled.
  external: ["vscode"],
  plugins: [devToolsStayOut, progress],
  logLevel: "silent",
};

// The panel's script runs in the webview, a browser inside VS Code.
const panel = {
  entryPoints: ["src/webview/panel.ts"],
  bundle: true,
  outfile: "dist/webview/panel.js",
  platform: "browser",
  format: "iife",
  target: "es2022",
  sourcemap: true,
  metafile: true,
  plugins: [progress],
  logLevel: "silent",
};

if (watch) {
  await Promise.all([extension, panel].map(async (options) => (await esbuild.context(options)).watch()));
} else {
  const results = await Promise.all([esbuild.build(extension), esbuild.build(panel)]);
  const packages = bundledPackages(results.map((result) => result.metafile));
  if (writeNotices) {
    fs.writeFileSync(NOTICES, noticesText(packages));
    console.log(`Wrote ${NOTICES}: ${packages.map((pkg) => pkg.name).join(", ") || "no third-party code"}.`);
  }
  const failed = results.some((result) => result.errors.length > 0 || result.warnings.length > 0);
  if (failed || (!writeNotices && noticesProblems(packages).length > 0)) {
    process.exit(1);
  }
}
