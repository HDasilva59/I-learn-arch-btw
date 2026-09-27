import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const domainsDirectory = path.join(projectRoot, "app", "commands", "domains");
const outputPath = path.join(domainsDirectory, "tldr.ts");
const apiHeaders = {
  Accept: "application/vnd.github+json",
  "User-Agent": "tuto-arch-tldr-sync",
};

async function fetchJson(url) {
  const response = await fetch(url, { headers: apiHeaders });

  if (!response.ok) {
    throw new Error(`GitHub API request failed (${response.status}): ${url}`);
  }

  return response.json();
}

function guideIdsFromSource(source) {
  return [...source.matchAll(/^  (?:"([^"]+)"|([A-Za-z0-9_-]+)): (?:\{|generatedGuide\()/gm)]
    .map((match) => match[1] ?? match[2]);
}

function stringListFromSource(source, name) {
  const start = source.indexOf(`export const ${name} = [`);
  const end = source.indexOf("] as const;", start);

  if (start < 0 || end < 0) {
    return [];
  }

  return [...source.slice(start, end).matchAll(/"([^"]+)"/g)].map((match) => match[1]);
}

function pageName(pagePath) {
  return pagePath.slice(pagePath.lastIndexOf("/") + 1, -3);
}

function isValidCommandName(command) {
  return /^[A-Za-z0-9][A-Za-z0-9+._-]*$/.test(command) && !command.includes("@");
}

function quoted(value) {
  return JSON.stringify(value);
}

function objectKey(value) {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(value) ? value : quoted(value);
}

const domainFiles = (await readdir(domainsDirectory))
  .filter((file) => file.endsWith(".ts") && file !== "tldr.ts")
  .sort();
const domainSources = await Promise.all(domainFiles.map((file) => readFile(path.join(domainsDirectory, file), "utf8")));
const existingGuideIds = new Set(domainSources.flatMap(guideIdsFromSource));
const reservedCommandNames = new Set([
  ...existingGuideIds,
  ...domainSources.flatMap((source) => [
    ...stringListFromSource(source, "ARCHWIKI_CATEGORY_COMMANDS"),
    ...stringListFromSource(source, "CORE_UTILITY_COMMANDS"),
  ]),
]);

const [tree, commit] = await Promise.all([
  fetchJson("https://api.github.com/repos/tldr-pages/tldr/git/trees/main?recursive=1"),
  fetchJson("https://api.github.com/repos/tldr-pages/tldr/commits/main"),
]);

if (tree.truncated) {
  throw new Error("The tldr repository tree was truncated; refusing to generate an incomplete inventory.");
}

const candidatePages = tree.tree
  .filter((entry) => entry.type === "blob" && /^pages\/(common|linux)\/[^/]+\.md$/.test(entry.path))
  .map((entry) => ({ path: entry.path, command: pageName(entry.path), platform: entry.path.split("/")[1] }))
  .filter((page) => isValidCommandName(page.command))
  .sort((left, right) => left.command.localeCompare(right.command) || left.platform.localeCompare(right.platform));

const pageByCommand = new Map();
const skippedPages = [];

for (const page of candidatePages) {
  const existingPage = pageByCommand.get(page.command);

  if (existingPage) {
    skippedPages.push({ ...page, reason: `duplicate of pages/${existingPage.platform}/${page.command}.md` });
    continue;
  }

  if (existingGuideIds.has(page.command)) {
    skippedPages.push({ ...page, reason: "already covered by a curated or ArchWiki guide" });
    continue;
  }

  const commandPrefix = page.command.split("-", 1)[0];
  const isKnownSubcommand = page.command.includes("-")
    && !reservedCommandNames.has(page.command)
    && reservedCommandNames.has(commandPrefix);

  if (isKnownSubcommand) {
    skippedPages.push({ ...page, reason: `subcommand page for ${commandPrefix}` });
    continue;
  }

  pageByCommand.set(page.command, page);
}

const pages = [...pageByCommand.values()].sort((left, right) => left.command.localeCompare(right.command));
const sourceCommit = typeof commit.sha === "string" ? commit.sha : "main";
const sourceDate = new Date().toISOString().slice(0, 10);
const pageEntries = pages.map((page) => `  ${objectKey(page.command)}: ${quoted(`pages/${page.platform}/${page.command}.md`)},`).join("\n");
const guideEntries = pages.map((page) => `  ${objectKey(page.command)}: generatedGuide(${quoted(page.command)}),`).join("\n");

const output = `/*
 * AUTO-GENERATED FILE. Do not edit by hand.
 * Refresh with: pnpm commands:sync-tldr
 *
 * This inventory intentionally imports command names and page locations only.
 * It does not copy tldr page prose or examples into this application.
 */
import type { ManPage } from "../../manpage-matcher";
import type { CommandCatalog } from "../types";

export const TLDR_SOURCE = {
  name: "tldr-pages/tldr",
  repository: "https://github.com/tldr-pages/tldr",
  license: "CC BY 4.0",
  licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
  commit: ${quoted(sourceCommit)},
  syncedAt: ${quoted(sourceDate)},
} as const;

export const TLDR_PAGE_PATHS = {
${pageEntries}
} as const;

export const TLDR_COMMANDS = Object.keys(TLDR_PAGE_PATHS) as readonly (keyof typeof TLDR_PAGE_PATHS)[];

function generatedGuide(command: string): ManPage {
  return {
    purpose: "A command with a practical reference page in tldr-pages.",
    syntax: \`\${command} [options] [arguments]\`,
    parts: [],
    note: \"This is an inventory entry generated from tldr-pages. Read the linked tldr page, --help, and the local man page before relying on command-specific options.\",
  };
}

export const tldrGuides = {
${guideEntries}
} satisfies CommandCatalog;

export const TLDR_SYNC_STATS = {
  candidatePages: ${candidatePages.length},
  importedCommands: ${pages.length},
  skippedPages: ${skippedPages.length},
} as const;
`;

await writeFile(outputPath, output, "utf8");

console.log(`tldr inventory synced: ${pages.length} commands imported; ${skippedPages.length} pages filtered; source ${sourceCommit.slice(0, 12)}.`);
