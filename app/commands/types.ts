import type { ManPage } from "../manpage-matcher";

export type CommandCatalog = Readonly<Record<string, ManPage>>;

export type LinuxFoundation =
  | "shell"
  | "filesystem"
  | "text"
  | "processes"
  | "network"
  | "system"
  | "packages";

export type CommandEffect =
  | "filesystem"
  | "processes"
  | "network"
  | "privilege"
  | "packages"
  | "shell";

export type CommandCatalogProblem = {
  guideId: string;
  field: "purpose" | "syntax" | "note" | "parts";
  message: string;
};

function isBlank(value: string): boolean {
  return value.trim().length === 0;
}

export function commandCatalogProblems(catalog: CommandCatalog): readonly CommandCatalogProblem[] {
  return Object.entries(catalog).flatMap(([guideId, guide]) => {
    const problems: CommandCatalogProblem[] = [];

    if (isBlank(guide.purpose)) {
      problems.push({ guideId, field: "purpose", message: "must contain a plain-language purpose" });
    }

    if (isBlank(guide.syntax)) {
      problems.push({ guideId, field: "syntax", message: "must contain a usage shape" });
    }

    if (isBlank(guide.note)) {
      problems.push({ guideId, field: "note", message: "must contain a safety or usage note" });
    }

    const emptyPart = guide.parts.find((part) => isBlank(part.token) || isBlank(part.meaning));

    if (emptyPart) {
      problems.push({ guideId, field: "parts", message: "every option must have a token and an explanation" });
    }

    return problems;
  });
}

export function defineCommandCatalog<T extends CommandCatalog>(catalog: T): T {
  const problems = commandCatalogProblems(catalog);

  if (problems.length > 0) {
    const details = problems.map((problem) => `${problem.guideId}.${problem.field}: ${problem.message}`).join("\n");
    throw new Error(`Invalid command catalog:\n${details}`);
  }

  return catalog;
}
