import * as assert from "node:assert";
import {
  OfferCheck,
  Project,
  blocker,
  blockerMessage,
  countRequirements,
  doneMessage,
  installQuestion,
  isMacPlaceholder,
  parsePythonVersion,
  pythonCandidates,
  shouldOffer,
  shouldOfferGitignore,
  venvPython,
  withVenvIgnored,
} from "../../actions/pythonProject";

// A trusted project with Python files and nothing set up yet.
const project = (overrides: Partial<Project> = {}): Project => ({
  trusted: true,
  topLevel: ["homework.py", "requirements.txt"],
  envFolders: [],
  ...overrides,
});

// Gentle mode, never offered before. Tests change one thing.
const offerCheck = (overrides: Partial<OfferCheck> = {}): OfferCheck => ({
  project: project(),
  speakUp: "gentle",
  offeredBefore: false,
  looksLikePython: true,
  pythonFound: true,
  ...overrides,
});

describe("setting up a Python project", () => {
  describe("workspace trust", () => {
    it("never sets up an untrusted folder", () => {
      assert.deepStrictEqual(blocker(project({ trusted: false })), { kind: "untrusted" });
    });

    it("checks trust before anything else", () => {
      const untrusted = project({ trusted: false, topLevel: ["poetry.lock"], envFolders: [".venv"] });
      assert.strictEqual(blocker(untrusted)?.kind, "untrusted");
    });

    it("never offers in an untrusted folder", () => {
      assert.strictEqual(shouldOffer(offerCheck({ project: project({ trusted: false }) })), false);
    });

    it("explains kindly instead", () => {
      assert.match(blockerMessage({ kind: "untrusted" }), /Restricted Mode/);
    });
  });

  describe("other tools", () => {
    for (const [file, tool] of [
      ["environment.yml", "conda"],
      ["Pipfile", "Pipenv"],
      ["poetry.lock", "Poetry"],
      ["uv.lock", "uv"],
    ]) {
      it(`leaves a project with ${file} to ${tool}`, () => {
        const b = blocker(project({ topLevel: ["main.py", file] }));
        assert.deepStrictEqual(b, { kind: "otherTool", file, tool });
        assert.strictEqual(shouldOffer(offerCheck({ project: project({ topLevel: [file] }) })), false);
      });
    }

    it("names the tool when she runs the command", () => {
      assert.strictEqual(
        blockerMessage({ kind: "otherTool", file: "poetry.lock", tool: "Poetry" }),
        "This project uses Poetry (I spotted poetry.lock), so I'll let Poetry handle its environment."
      );
    });
  });

  describe("an environment that's already there", () => {
    for (const folder of [".venv", "venv", "env"]) {
      it(`finds one in ${folder}/`, () => {
        assert.deepStrictEqual(blocker(project({ envFolders: [folder] })), { kind: "hasEnvironment", folder });
      });
    }

    it("sets up a project with nothing in the way", () => {
      assert.strictEqual(blocker(project()), undefined);
    });
  });

  describe("offering on its own", () => {
    it("offers for a Python project with nothing set up", () => {
      assert.strictEqual(shouldOffer(offerCheck()), true);
    });

    it("offers once per project, ever", () => {
      assert.strictEqual(shouldOffer(offerCheck({ offeredBefore: true })), false);
    });

    it("never offers in quiet mode", () => {
      assert.strictEqual(shouldOffer(offerCheck({ speakUp: "quiet" })), false);
    });

    it("only offers for Python projects, when Python is installed", () => {
      assert.strictEqual(shouldOffer(offerCheck({ looksLikePython: false })), false);
      assert.strictEqual(shouldOffer(offerCheck({ pythonFound: false })), false);
    });

    it("doesn't offer when there's already an environment", () => {
      assert.strictEqual(shouldOffer(offerCheck({ project: project({ envFolders: ["venv"] }) })), false);
    });
  });

  describe(".gitignore", () => {
    const old = { major: 3, minor: 9 };

    it("offers to ignore .venv in a git repo that doesn't yet", () => {
      assert.strictEqual(shouldOfferGitignore({ inGitRepo: true, ignored: false, version: old }), true);
    });

    it("doesn't offer outside git, or when .venv is already ignored", () => {
      assert.strictEqual(shouldOfferGitignore({ inGitRepo: false, ignored: false, version: old }), false);
      assert.strictEqual(shouldOfferGitignore({ inGitRepo: true, ignored: true, version: old }), false);
    });

    it("doesn't offer on Python 3.13 and newer, where .venv ignores itself", () => {
      assert.strictEqual(shouldOfferGitignore({ inGitRepo: true, ignored: false, version: { major: 3, minor: 13 } }), false);
      assert.strictEqual(shouldOfferGitignore({ inGitRepo: true, ignored: false, version: { major: 3, minor: 14 } }), false);
    });

    it("adds .venv/ on its own line", () => {
      assert.strictEqual(withVenvIgnored(undefined), ".venv/\n");
      assert.strictEqual(withVenvIgnored("node_modules/\n"), "node_modules/\n.venv/\n");
      assert.strictEqual(withVenvIgnored("node_modules/"), "node_modules/\n.venv/\n");
    });
  });

  describe("finding Python", () => {
    it("tries python3 on Mac and Linux, and py on Windows", () => {
      assert.deepStrictEqual(pythonCandidates("darwin").map((c) => c.command), ["python3", "python"]);
      assert.deepStrictEqual(pythonCandidates("win32").map((c) => c.command), ["py", "python"]);
    });

    it("reads the version, and nothing else counts", () => {
      assert.deepStrictEqual(parsePythonVersion("Python 3.12.4\n"), { major: 3, minor: 12 });
      assert.strictEqual(parsePythonVersion("Python was not found; run without arguments to install"), undefined);
      assert.strictEqual(parsePythonVersion(""), undefined);
    });

    it("skips the Mac's placeholder python3 when the developer tools are missing", () => {
      assert.strictEqual(isMacPlaceholder("darwin", "/usr/bin/python3", false), true);
      assert.strictEqual(isMacPlaceholder("darwin", "/usr/bin/python3", true), false);
      assert.strictEqual(isMacPlaceholder("darwin", "/opt/homebrew/bin/python3", false), false);
      assert.strictEqual(isMacPlaceholder("linux", "/usr/bin/python3", false), false);
    });

    it("finds the venv's own Python on each system", () => {
      assert.deepStrictEqual(venvPython("darwin"), [".venv", "bin", "python"]);
      assert.deepStrictEqual(venvPython("win32"), [".venv", "Scripts", "python.exe"]);
    });
  });

  describe("what Mochi says", () => {
    it("teaches the command that matches her system", () => {
      assert.strictEqual(
        doneMessage({ command: "python3", args: [] }),
        "Your Python project is all set up in .venv! Next time you can do this yourself with python3 -m venv .venv"
      );
      assert.match(doneMessage({ command: "py", args: ["-3"] }), /with py -3 -m venv \.venv$/);
    });

    it("counts the packages in requirements.txt, not comments or options", () => {
      const text = "# for class\nrequests==2.32.0\n\n--index-url https://example.org\nnumpy  # maths\n-r more.txt\n-e .\n";
      assert.strictEqual(countRequirements(text), 3);
      assert.strictEqual(countRequirements("# nothing yet\n"), 0);
    });

    it("asks before installing, with the number of packages", () => {
      assert.strictEqual(installQuestion(3), "This project lists 3 packages in requirements.txt. Install them too?");
      assert.strictEqual(installQuestion(1), "This project lists 1 package in requirements.txt. Install it too?");
    });
  });
});
