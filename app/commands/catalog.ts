import { defineCommandCatalog } from "./types";
import { archivesGuides } from "./domains/archives";
import { archwikiGuides, missingArchWikiCommands } from "./domains/archwiki";
import { filesystemGuides } from "./domains/filesystem";
import { kernelGuides } from "./domains/kernel";
import { networkGuides } from "./domains/network";
import { packagesGuides } from "./domains/packages";
import { processesGuides } from "./domains/processes";
import { shellGuides } from "./domains/shell";
import { systemGuides } from "./domains/system";
import { textGuides } from "./domains/text";
import { tldrGuides } from "./domains/tldr";

const RAW_COMMAND_GUIDES = {
  ...shellGuides,
  ...filesystemGuides,
  ...textGuides,
  ...processesGuides,
  ...networkGuides,
  ...systemGuides,
  ...kernelGuides,
  ...packagesGuides,
  ...archivesGuides,
  ...archwikiGuides,
  ...tldrGuides,
};

const missingArchWiki = missingArchWikiCommands(RAW_COMMAND_GUIDES);

if (missingArchWiki.length > 0) {
  throw new Error(`ArchWiki command coverage is incomplete: ${missingArchWiki.join(", ")}`);
}

/**
 * The public catalog stays flat so lessons, search, and the analyzer do not
 * care which domain owns a guide.
 */
export const COMMAND_GUIDES = defineCommandCatalog(RAW_COMMAND_GUIDES);

export type CommandGuideId = keyof typeof COMMAND_GUIDES;
