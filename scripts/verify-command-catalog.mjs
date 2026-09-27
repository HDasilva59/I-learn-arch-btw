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

if (!archwikiSource) {
  throw new Error("Missing app/commands/domains/archwiki.ts");
}

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

if (duplicateGuideIds.size > 0 || missingArchwikiCommands.length > 0) {
  const details = [
    duplicateGuideIds.size > 0 ? `Duplicate guide ids: ${[...duplicateGuideIds].join(", ")}` : "",
    missingArchwikiCommands.length > 0 ? `Missing ArchWiki commands: ${missingArchwikiCommands.join(", ")}` : "",
  ].filter(Boolean).join("\n");

  throw new Error(details);
}

console.log(`Command catalog verified: ${guideIds.size} guides; ${archwikiCommands.length} ArchWiki commands covered.`);
