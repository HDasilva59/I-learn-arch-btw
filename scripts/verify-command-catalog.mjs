import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const domainsDirectory = path.join(projectRoot, "app", "commands", "domains");
const domainFiles = (await readdir(domainsDirectory)).filter((file) => file.endsWith(".ts"));
const sourceByFile = new Map(
  await Promise.all(domainFiles.map(async (file) => [file, await readFile(path.join(domainsDirectory, file), "utf8")])),
);

const guideIds = new Set();
const duplicateGuideIds = new Set();

for (const source of sourceByFile.values()) {
  for (const match of source.matchAll(/^  (?:"([^"]+)"|([A-Za-z0-9_-]+)): (?:\{|generatedGuide\()/gm)) {
    const guideId = match[1] ?? match[2];

    if (guideIds.has(guideId)) {
      duplicateGuideIds.add(guideId);
    }

    guideIds.add(guideId);
  }
}

const archwikiSource = sourceByFile.get("archwiki.ts");
const tldrSource = sourceByFile.get("tldr.ts");
const thirdPartyNotices = await readFile(path.join(projectRoot, "THIRD_PARTY_NOTICES.md"), "utf8");

if (!archwikiSource) {
  throw new Error("Missing app/commands/domains/archwiki.ts");
}

if (!tldrSource) {
  throw new Error("Missing app/commands/domains/tldr.ts. Run pnpm commands:sync-tldr.");
}

const licensingProblems = [
  tldrSource.includes("AUTO-GENERATED FILE") ? "" : "tldr.ts must remain marked as generated",
  tldrSource.includes('license: "CC BY 4.0"') ? "" : "tldr.ts must declare the tldr CC BY 4.0 license",
  tldrSource.includes('repository: "https://github.com/tldr-pages/tldr"') ? "" : "tldr.ts must link to the tldr repository",
  tldrSource.includes('commit: "') ? "" : "tldr.ts must record the source commit",
  thirdPartyNotices.includes("tldr-pages/tldr") ? "" : "THIRD_PARTY_NOTICES.md must attribute tldr-pages",
  thirdPartyNotices.includes("creativecommons.org/licenses/by/4.0/") ? "" : "THIRD_PARTY_NOTICES.md must link to CC BY 4.0",
].filter(Boolean);

function readStringList(name) {
  const start = archwikiSource.indexOf(`export const ${name} = [`);
  const end = archwikiSource.indexOf("] as const;", start);

  if (start < 0 || end < 0) {
    throw new Error(`Cannot read ${name} from archwiki.ts`);
  }

  return [...archwikiSource.slice(start, end).matchAll(/"([^"]+)"/g)].map((match) => match[1]);
}

const archwikiCommands = [...new Set([
  ...readStringList("ARCHWIKI_CATEGORY_COMMANDS"),
  ...readStringList("CORE_UTILITY_COMMANDS"),
])];
const aliasesStart = archwikiSource.indexOf("const ARCHWIKI_GUIDE_ALIASES");
const aliasesEnd = archwikiSource.indexOf("};", aliasesStart);
const aliases = new Map();

for (const match of archwikiSource.slice(aliasesStart, aliasesEnd).matchAll(/^  ([A-Za-z0-9_-]+): \[(.*?)\],$/gm)) {
  aliases.set(match[1], [...match[2].matchAll(/"([^"]+)"/g)].map((entry) => entry[1]));
}

const missingArchwikiCommands = archwikiCommands.filter((command) => {
  const coveredByVariant = (aliases.get(command) ?? []).some((guideId) => guideIds.has(guideId));
  return !guideIds.has(command) && !coveredByVariant;
});

if (duplicateGuideIds.size > 0 || missingArchwikiCommands.length > 0 || licensingProblems.length > 0) {
  const details = [
    duplicateGuideIds.size > 0 ? `Duplicate guide ids: ${[...duplicateGuideIds].join(", ")}` : "",
    missingArchwikiCommands.length > 0 ? `Missing ArchWiki commands: ${missingArchwikiCommands.join(", ")}` : "",
    licensingProblems.length > 0 ? `Licensing checks: ${licensingProblems.join("; ")}` : "",
  ].filter(Boolean).join("\n");

  throw new Error(details);
}

console.log(`Command catalog verified: ${guideIds.size} guides; ${archwikiCommands.length} ArchWiki commands covered.`);
