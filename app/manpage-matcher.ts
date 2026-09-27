import {
  commandWords,
  type CommandNode,
  type CommandPart,
  type RedirectionNode,
  type WordNode,
} from "./shell-ast";

export type ManPage = {
  purpose: string;
  syntax: string;
  parts: readonly {
    token: string;
    meaning: string;
  }[];
  note: string;
};

export type ManPageCatalog = Readonly<Record<string, ManPage>>;

export type CommandExplanationStep = {
  token: string;
  explanation: string;
};

export type CommandResolver = (words: readonly string[]) => string | undefined;

export type CommandIdentity = {
  node: CommandNode;
  name: string;
  rawWords: readonly string[];
  wrappers: readonly string[];
};

export type ResolvedCommand = CommandIdentity & {
  guideId: string | undefined;
  manPage: ManPage | undefined;
};

export type MatchContext = {
  commandDescription: (command: string) => string;
  argumentMeaning: string;
  optionMeaning: (token: string, manPage: ManPage) => string | undefined;
  redirectionMeaning: (operator: RedirectionNode["operator"]) => string;
  processSubstitutionMeaning: (word: Extract<WordNode, { kind: "process-substitution" }>) => string;
  isOldStyleOption?: (token: string, wordIndex: number) => boolean;
};

export function identifyCommand(node: CommandNode): CommandIdentity {
  const words = commandWords(node).map((word) => word.raw);
  const wrappers = words[0] === "sudo" ? ["sudo"] : [];
  const name = words[wrappers.length] ?? "";

  return {
    node,
    name,
    rawWords: words,
    wrappers,
  };
}

export function resolveManPage(
  identity: CommandIdentity,
  catalog: ManPageCatalog,
  resolveGuide: CommandResolver,
): ResolvedCommand {
  const commandWordsWithoutWrappers = identity.rawWords.slice(identity.wrappers.length);
  const guideId = resolveGuide(commandWordsWithoutWrappers);

  return {
    ...identity,
    guideId,
    manPage: guideId ? catalog[guideId] : undefined,
  };
}

function optionSteps(token: string, manPage: ManPage): readonly CommandExplanationStep[] {
  const normalizedToken = token.startsWith("-") ? token : `-${token}`;
  const optionName = normalizedToken.split("=", 1)[0];
  const exactMeaning = manPage.parts.find((part) => part.token === token)?.meaning
    ?? manPage.parts.find((part) => part.token === optionName)?.meaning;

  if (exactMeaning) {
    return [{ token, explanation: exactMeaning }];
  }

  if (/^-[A-Za-z]{2,}$/.test(normalizedToken)) {
    const compactOptions = [...normalizedToken.slice(1)].map((letter) => `-${letter}`);
    const meanings = compactOptions.map((option) => manPage.parts.find((part) => part.token === option));

    if (meanings.every((part) => part !== undefined)) {
      return meanings.map((part) => ({ token: part.token, explanation: part.meaning }));
    }
  }

  return [{ token, explanation: "an option passed to this command" }];
}

function matchOption(
  token: string,
  manPage: ManPage,
  context: MatchContext,
): readonly CommandExplanationStep[] {
  const normalizedToken = token.startsWith("-") ? token : `-${token}`;
  const optionName = normalizedToken.split("=", 1)[0];
  const exactMeaning = manPage.parts.find((part) => part.token === token)?.meaning
    ?? manPage.parts.find((part) => part.token === optionName)?.meaning;

  if (exactMeaning) {
    return [{ token, explanation: exactMeaning }];
  }

  const contextualMeaning = context.optionMeaning(token, manPage);

  return contextualMeaning
    ? [{ token, explanation: contextualMeaning }]
    : optionSteps(token, manPage);
}

function commandPartWords(parts: readonly CommandPart[]): readonly WordNode[] {
  return parts.filter((part): part is WordNode => part.kind !== "redirection");
}

function commandIndex(parts: readonly CommandPart[]): number {
  const words = commandPartWords(parts);
  return words[0]?.raw === "sudo" ? 1 : 0;
}

function isOptionWord(word: WordNode, command: string, wordIndex: number, context: MatchContext): boolean {
  return word.kind === "word"
    && (word.raw.startsWith("-") || context.isOldStyleOption?.(word.raw, wordIndex) === true)
    && !(command === "tar" && wordIndex === 0 && context.isOldStyleOption?.(word.raw, wordIndex) !== true);
}

export function matchCommand(
  identified: ResolvedCommand,
  context: MatchContext,
): readonly CommandExplanationStep[] {
  const { node, name, manPage, guideId } = identified;
  const words = commandWords(node);
  const commandWordIndex = commandIndex(node.parts);
  const steps: CommandExplanationStep[] = [];

  if (words[0]?.raw === "sudo") {
    steps.push({ token: "sudo", explanation: "asks for administrator privileges for the command that follows" });
  }

  const commandWord = words[commandWordIndex];

  if (!commandWord) {
    return steps;
  }

  steps.push({
    token: commandWord.raw,
    explanation: name === "comm"
      ? "compares two sorted inputs line by line"
      : `runs ${context.commandDescription(name)}`,
  });

  if (!manPage || !guideId) {
    return steps;
  }

  let seenWords = 0;
  const argumentParts = node.parts.filter((part) => {
    if (part.kind === "redirection") {
      return true;
    }

    const keep = seenWords > commandWordIndex;
    seenWords += 1;
    return keep;
  });

  for (let index = 0; index < argumentParts.length; index += 1) {
    const part = argumentParts[index];

    if (part.kind === "redirection") {
      steps.push({
        token: redirectionToken(part),
        explanation: context.redirectionMeaning(part.operator),
      });
      continue;
    }

    if (part.kind === "process-substitution") {
      steps.push({ token: part.raw, explanation: context.processSubstitutionMeaning(part) });
      continue;
    }

    const nextPart = argumentParts[index + 1];
    const pairedPart = nextPart?.kind === "word"
      ? manPage.parts.find((candidate) => candidate.token === `${part.raw} ${nextPart.raw}`)
      : undefined;

    if (pairedPart) {
      steps.push({ token: `${part.raw} ${nextPart.raw}`, explanation: pairedPart.meaning });
      index += 1;
      continue;
    }

    const wordIndex = index;

    if (isOptionWord(part, name, wordIndex, context)) {
      steps.push(...matchOption(part.raw, manPage, context));
      continue;
    }

    steps.push({
      token: stripQuotes(part.raw),
      explanation: context.argumentMeaning,
    });
  }

  return steps;
}

function stripQuotes(token: string): string {
  return token.length > 1 && ((token.startsWith("'") && token.endsWith("'")) || (token.startsWith('"') && token.endsWith('"')))
    ? token.slice(1, -1)
    : token;
}

function redirectionToken(redirection: RedirectionNode): string {
  const target = stripQuotes(redirection.target.raw);
  const attachesTarget = redirection.operator === "2>&" || redirection.operator === ">&" || redirection.operator === "<&";

  return attachesTarget ? `${redirection.operator}${target}` : `${redirection.operator} ${target}`;
}
