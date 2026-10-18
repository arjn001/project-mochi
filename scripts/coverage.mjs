// Merges the unit and integration coverage reports into one table of
// Mochi's own code (src/, without tests, dev tools, or the panel's script),
// for `npm run coverage` (MOCHI-70). No dependencies.
//
// c8 measures each source file line by line in both runs, so lines merge
// exactly: a line counts as covered if either run reached it. Branches and
// functions don't line up between the two runs, so those are reported per
// run instead.
import { existsSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

const root = process.cwd();
const reports = { unit: "coverage/unit/coverage-final.json", integration: "coverage/integration/coverage-final.json" };

const isMochi = (file) => {
  const path = relative(root, file).split(sep).join("/");
  return path.startsWith("src/") && !/^src\/(test|dev|webview)\//.test(path) ? path : undefined;
};

// Every line, and whether it was reached, per file.
const lines = new Map();
const branches = {};
for (const [run, path] of Object.entries(reports)) {
  if (!existsSync(join(root, path))) {
    console.error(`No ${run} report at ${path}. Run npm run coverage.`);
    process.exit(1);
  }
  let taken = 0;
  let total = 0;
  for (const [file, coverage] of Object.entries(JSON.parse(readFileSync(join(root, path), "utf8")))) {
    const name = isMochi(file);
    if (!name) {
      continue;
    }
    const byLine = lines.get(name) ?? new Map();
    for (const [id, location] of Object.entries(coverage.statementMap)) {
      const line = location.start.line;
      byLine.set(line, (byLine.get(line) ?? false) || coverage.s[id] > 0);
    }
    lines.set(name, byLine);
    for (const counts of Object.values(coverage.b)) {
      total += counts.length;
      taken += counts.filter((count) => count > 0).length;
    }
  }
  branches[run] = total ? (100 * taken) / total : 100;
}

const rows = [...lines].map(([file, byLine]) => {
  const covered = [...byLine.values()].filter(Boolean).length;
  return { file, covered, total: byLine.size, pct: byLine.size ? (100 * covered) / byLine.size : 100 };
});
const covered = rows.reduce((sum, row) => sum + row.covered, 0);
const total = rows.reduce((sum, row) => sum + row.total, 0);

console.log("\nCoverage of Mochi's own code (src/), unit and integration tests together\n");
for (const row of rows.sort((a, b) => a.pct - b.pct || a.file.localeCompare(b.file))) {
  console.log(`${row.pct.toFixed(1).padStart(6)}%  ${String(row.covered).padStart(4)}/${String(row.total).padEnd(4)}  ${row.file}`);
}
console.log(`\nLines: ${((100 * covered) / total).toFixed(1)}% (${covered} of ${total})`);
console.log(`Branches: unit ${branches.unit.toFixed(1)}%, integration ${branches.integration.toFixed(1)}%`);
