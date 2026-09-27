import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

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

function cleanMarkdown(value) {
  return value
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/<([^>]+)>/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
}

function firstDescription(lines) {
  return lines
    .filter((line) => line.startsWith("> "))
    .map((line) => cleanMarkdown(line.slice(2)))
    .find((line) => line.length > 0 && !/^more information:/i.test(line))
    ?? "A command with a practical reference page in tldr-pages.";
}

function examplesFrom(markdown) {
  const examples = [];
  let description = "";

  for (const line of markdown.split(/\r?\n/)) {
    if (line.startsWith("- ")) {
      description = cleanMarkdown(line.slice(2));
      continue;
    }

    const command = line.match(/^`([^`]+)`$/)?.[1];

    if (command && description) {
      examples.push({ command, description });
      description = "";
    }
  }

  return examples;
}

function optionNames(command) {
  const options = [];
  const addOption = (value) => {
    const option = value.match(/^-{1,2}[A-Za-z0-9][A-Za-z0-9-]*/)?.[0];

    if (option && !options.includes(option)) {
      options.push(option);
    }
  };

  for (const match of command.matchAll(/\{\{\[([^\]]+)\]\}\}|(-{1,2}[A-Za-z0-9][A-Za-z0-9-]*)/g)) {
    if (match[1]) {
      for (const alternative of match[1].split("|")) {
        for (const token of alternative.trim().split(/\s+/)) {
          addOption(token);
        }
      }
    } else if (match[2]) {
      addOption(match[2]);
    }
  }

  return options;
}

function simplifyExample(command) {
  return command
    .replace(/\{\{\[([^|\]]+)(?:\|[^\]]+)?\]\}\}/g, "$1")
    .replace(/\{\{([^}]+)\}\}/g, (_, value) => value.replace(/^\[|\]$/g, "").split("|")[0])
    .replace(/\s+/g, " ")
    .trim();
}

function aliasTarget(markdown) {
  return markdown.match(/alias of `([^`]+)`/i)?.[1];
}

function subcommandParts(command, example, description) {
  const simplified = simplifyExample(example);
  const words = simplified.match(/(?:"[^"]*"|'[^']*'|\S+)/g) ?? [];
  const root = words[0];

  if (!root || root !== command.split("-", 1)[0] || !command.startsWith(`${root}-`)) {
    return [];
  }

  const firstOption = words.findIndex((word) => word.startsWith("-"));
  const end = firstOption >= 0 ? firstOption : words.length;
  const expectedSuffix = command.slice(root.length + 1);
  const candidate = words.slice(1, end).join(" ");

  return candidate === expectedSuffix
    ? [{ token: candidate, meaning: description }]
    : [];
}

function optionMeaning(token, description) {
  if (["--format", "--printf"].includes(token) && !/format|template|output/i.test(description)) {
    return "Choose the output format using a template.";
  }

  return description;
}

function tldrGuide(command, pagePath, markdown, inheritedGuide) {
  const lines = markdown.split(/\r?\n/);
  const examples = examplesFrom(markdown);
  const sourceGuide = inheritedGuide ?? {
    purpose: firstDescription(lines),
    syntax: examples[0] ? simplifyExample(examples[0].command) : `${command} [options] [arguments]`,
    parts: examples.flatMap((example) => [
      ...subcommandParts(command, example.command, example.description),
      ...optionNames(example.command).map((token) => ({ token, meaning: optionMeaning(token, example.description) })),
    ]),
  };
  const partsByToken = new Map();

  for (const part of sourceGuide.parts) {
    if (!partsByToken.has(part.token)) {
      partsByToken.set(part.token, part);
    }
  }

  const alias = aliasTarget(markdown);

  if (alias && command.includes("-")) {
    const root = command.split("-", 1)[0];
    const aliasToken = command.slice(root.length + 1);

    if (!partsByToken.has(aliasToken)) {
      partsByToken.set(aliasToken, {
        token: aliasToken,
        meaning: `an alias for ${alias.replace(/^\S+\s+/, "")}`,
      });
    }
  }

  return {
    purpose: sourceGuide.purpose,
    syntax: sourceGuide.syntax,
    parts: [...partsByToken.values()],
    note: `Summarized from tldr-pages (${pagePath}). Read the linked tldr page, --help, and the local man page before relying on command-specific options.`,
  };
}

function readTarEntries(archive) {
  const entries = new Map();
  let offset = 0;

  while (offset + 512 <= archive.length) {
    const header = archive.subarray(offset, offset + 512);
    const name = header.subarray(0, 100).toString("utf8").replace(/\0.*$/, "");

    if (!name) {
      break;
    }

    const prefix = header.subarray(345, 500).toString("utf8").replace(/\0.*$/, "");
    const sizeText = header.subarray(124, 136).toString("utf8").replace(/\0.*$/, "").trim();
    const size = sizeText ? Number.parseInt(sizeText, 8) : 0;
    const type = header[156];
    const dataStart = offset + 512;
    const dataEnd = dataStart + size;
    const fullName = prefix ? `${prefix}/${name}` : name;
    const pagesIndex = fullName.indexOf("pages/");

    if ((type === 0 || type === 48) && pagesIndex >= 0) {
      entries.set(fullName.slice(pagesIndex), archive.subarray(dataStart, dataEnd).toString("utf8"));
    }

    offset = dataStart + Math.ceil(size / 512) * 512;
  }

  return entries;
}

async function fetchPageSources(commit) {
  const response = await fetch(`https://codeload.github.com/tldr-pages/tldr/tar.gz/${commit}`, { headers: apiHeaders });

  if (!response.ok) {
    throw new Error(`tldr archive request failed (${response.status}).`);
  }

  return readTarEntries(gunzipSync(Buffer.from(await response.arrayBuffer())));
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
const pageSources = await fetchPageSources(sourceCommit);
const pagesByCommand = new Map(pages.map((page) => [page.command, page]));
const guidesByCommand = new Map();
const resolvingCommands = new Set();

function guideForPage(page) {
  if (!page) {
    return undefined;
  }

  const existingGuide = guidesByCommand.get(page.command);

  if (existingGuide) {
    return existingGuide;
  }

  if (resolvingCommands.has(page.command)) {
    return undefined;
  }

  const markdown = pageSources.get(page.path);

  if (!markdown) {
    throw new Error(`The tldr archive did not contain ${page.path}.`);
  }

  resolvingCommands.add(page.command);
  const alias = aliasTarget(markdown);
  const aliasCommand = alias?.split(/\s+/).filter((word) => word !== "tldr").join("-");
  const inheritedGuide = aliasCommand ? guideForPage(pagesByCommand.get(aliasCommand)) : undefined;
  const guide = tldrGuide(page.command, page.path, markdown, inheritedGuide);

  resolvingCommands.delete(page.command);
  guidesByCommand.set(page.command, guide);
  return guide;
}

for (const page of pages) {
  guideForPage(page);
}

const pageEntries = pages.map((page) => `  ${objectKey(page.command)}: ${quoted(`pages/${page.platform}/${page.command}.md`)},`).join("\n");
const guideEntries = pages.map((page) => {
  const guide = guidesByCommand.get(page.command);
  const serializedGuide = JSON.stringify(guide, null, 2).replace(/\n/g, "\n  ");
  return `  ${objectKey(page.command)}: generatedGuide(${serializedGuide}),`;
}).join("\n");

const output = `/*
 * AUTO-GENERATED FILE. Do not edit by hand.
 * Refresh with: pnpm commands:sync-tldr
 *
 * This catalog stores concise tldr purposes, usage shapes, and option references.
 * Keep authored guides in the other domain files so this file remains regenerable.
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

function generatedGuide(guide: ManPage): ManPage {
  return guide;
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
