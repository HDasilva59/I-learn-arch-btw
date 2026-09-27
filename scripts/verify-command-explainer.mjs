import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";

const projectRoot = path.resolve(import.meta.dirname, "..");
const outputRoot = mkdtempSync(path.join(tmpdir(), "tuto-arch-explainer-"));

try {
  const compile = spawnSync(
    "pnpm",
    [
      "exec",
      "tsc",
      "app/command-explainer.ts",
      "app/commands/catalog.ts",
      "--target",
      "ES2022",
      "--module",
      "commonjs",
      "--moduleResolution",
      "node",
      "--lib",
      "esnext,dom",
      "--esModuleInterop",
      "--skipLibCheck",
      "--outDir",
      outputRoot,
    ],
    { cwd: projectRoot, encoding: "utf8" },
  );

  if (compile.status !== 0) {
    process.stderr.write(`${compile.stdout}${compile.stderr}`);
    process.exit(1);
  }

  const check = spawnSync(
    process.execPath,
    [
      "-e",
      `
const path = require("node:path");
const outputRoot = process.argv[1];
const { explainCommand } = require(path.join(outputRoot, "command-explainer.js"));
const { COMMAND_GUIDES } = require(path.join(outputRoot, "commands", "catalog.js"));
const { TLDR_COMMANDS, tldrGuides } = require(path.join(outputRoot, "commands", "domains", "tldr.js"));
const input = "docker ps --filter \\"status=running\\" --format '{{.ID}}\\\\t{{.Image}}\\\\t{{.Names}}'";
const result = explainCommand(input, COMMAND_GUIDES);
const expected = "List Docker containers.";

const placeholder = "A command with a practical reference page in tldr-pages.";
const placeholderCommands = TLDR_COMMANDS.filter((command) => tldrGuides[command].purpose === placeholder);

if (placeholderCommands.length > 0) {
  throw new Error("Generated tldr guides still use the placeholder for: " + placeholderCommands.slice(0, 5).join(", "));
}

if (result.kind !== "recognized") {
  throw new Error("Expected a recognized command, got " + result.kind + ".");
}

if (result.plainEnglish !== expected) {
  throw new Error("Unexpected plain-English explanation. Expected " + JSON.stringify(expected) + ", got " + JSON.stringify(result.plainEnglish) + ".");
}

const steps = new Map(result.steps.map((step) => [step.token, step.explanation]));
const expectedSteps = new Map([
  ["ps", "an alias for container ls"],
  ["--filter", "Filter containers that contain a substring in their name:"],
  ["status=running", "the filter condition passed to the command"],
  ["--format", "Choose the output format using a template."],
  ["{{.ID}}\\\\t{{.Image}}\\\\t{{.Names}}", "the output format or template passed to the command"],
]);

for (const [token, explanation] of expectedSteps) {
  if (steps.get(token) !== explanation) {
    throw new Error("Unexpected explanation for " + token + ". Expected " + JSON.stringify(explanation) + ", got " + JSON.stringify(steps.get(token)) + ".");
  }
}

const tldrResult = explainCommand("2to3 --write path/to/file.py", COMMAND_GUIDES);

if (tldrResult.kind !== "recognized" || tldrResult.plainEnglish !== "Automated Python 2 to 3 code conversion.") {
  throw new Error("A non-Docker tldr command did not use its generated summary.");
}

if (!tldrResult.steps.some((step) => step.token === "--write" && step.explanation === "Convert a Python 2 file to Python 3:")) {
  throw new Error("A non-Docker tldr command did not retain its generated option explanation.");
}

console.log(JSON.stringify({ kind: result.kind, plainEnglish: result.plainEnglish, steps: result.steps }, null, 2));
`,
      outputRoot,
    ],
    { cwd: projectRoot, encoding: "utf8" },
  );

  process.stdout.write(`${check.stdout}${check.stderr}`);

  if (check.status !== 0) {
    process.exit(check.status ?? 1);
  }
} finally {
  rmSync(outputRoot, { recursive: true, force: true });
}
