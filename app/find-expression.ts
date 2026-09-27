import {
  commandWords,
  parseShell,
  type CommandNode,
  type RedirectionNode,
  type WordNode,
} from "./shell-ast";

export type FindClause =
  | {
      kind: "type";
      value: WordNode;
    }
  | {
      kind: "name";
      operator: "-name" | "-iname";
      pattern: WordNode;
    }
  | {
      kind: "exec";
      command: CommandNode;
      terminator: ";" | "+";
      usesPathPlaceholder: boolean;
    }
  | {
      kind: "predicate";
      operator: string;
      arguments: readonly WordNode[];
    };

export type FindExpression = {
  kind: "find-expression";
  roots: readonly WordNode[];
  clauses: readonly FindClause[];
  redirections: readonly RedirectionNode[];
};

export type FindParseResult =
  | {
      kind: "parsed";
      expression: FindExpression;
    }
  | {
      kind: "not-find";
    }
  | {
      kind: "error";
      message: string;
    };

const PREDICATE_ARITIES: Readonly<Record<string, number>> = {
  "-amin": 1,
  "-anewer": 1,
  "-atime": 1,
  "-cmin": 1,
  "-cnewer": 1,
  "-ctime": 1,
  "-daystart": 0,
  "-delete": 0,
  "-depth": 0,
  "-empty": 0,
  "-false": 0,
  "-fstype": 1,
  "-gid": 1,
  "-group": 1,
  "-iname": 1,
  "-inum": 1,
  "-links": 1,
  "-maxdepth": 1,
  "-mindepth": 1,
  "-mtime": 1,
  "-newer": 1,
  "-nogroup": 0,
  "-nouser": 0,
  "-path": 1,
  "-perm": 1,
  "-print": 0,
  "-print0": 0,
  "-prune": 0,
  "-size": 1,
  "-user": 1,
  "-xdev": 0,
  "-xtype": 1,
};

function isWord(word: WordNode, value?: string): word is Extract<WordNode, { kind: "word" }> {
  return word.kind === "word" && (value === undefined || word.raw === value);
}

function isExecTerminator(word: WordNode): word is Extract<WordNode, { kind: "word" }> {
  return isWord(word) && [";", "\\;", "+", "\\+"].includes(word.raw);
}

function normalizeExecTerminator(raw: string): ";" | "+" {
  return raw.endsWith("+") ? "+" : ";";
}

function nestedCommand(words: readonly WordNode[]): CommandNode | undefined {
  const source = words.map((word) => word.raw).join(" ");
  const parsed = parseShell(source);

  if (parsed.kind !== "parsed" || parsed.ast.pipelines.length !== 1 || parsed.ast.pipelines[0].commands.length !== 1) {
    return undefined;
  }

  return parsed.ast.pipelines[0].commands[0];
}

export function parseFindExpression(command: CommandNode): FindParseResult {
  const words = commandWords(command);

  if (!isWord(words[0], "find")) {
    return { kind: "not-find" };
  }

  const roots: WordNode[] = [];
  const clauses: FindClause[] = [];
  let index = 1;

  while (index < words.length) {
    const word = words[index];

    if (!isWord(word) || !word.raw.startsWith("-")) {
      roots.push(word);
      index += 1;
      continue;
    }

    if (word.raw === "-type") {
      const value = words[index + 1];

      if (!value) {
        return { kind: "error", message: "find -type is missing its entry type." };
      }

      clauses.push({ kind: "type", value });
      index += 2;
      continue;
    }

    if (word.raw === "-name" || word.raw === "-iname") {
      const pattern = words[index + 1];

      if (!pattern) {
        return { kind: "error", message: `find ${word.raw} is missing its pattern.` };
      }

      clauses.push({ kind: "name", operator: word.raw === "-iname" ? "-iname" : "-name", pattern });
      index += 2;
      continue;
    }

    if (word.raw === "-exec") {
      const actionWords: WordNode[] = [];
      let terminator: ";" | "+" | undefined;
      let actionIndex = index + 1;

      for (; actionIndex < words.length; actionIndex += 1) {
        const actionWord = words[actionIndex];

        if (isExecTerminator(actionWord)) {
          terminator = normalizeExecTerminator(actionWord.raw);
          break;
        }

        actionWords.push(actionWord);
      }

      if (!terminator) {
        return { kind: "error", message: "find -exec is missing its terminating \\; or +." };
      }

      const nested = nestedCommand(actionWords);

      if (!nested) {
        return { kind: "error", message: "find -exec contains a command shape this parser cannot explain yet." };
      }

      clauses.push({
        kind: "exec",
        command: nested,
        terminator,
        usesPathPlaceholder: actionWords.some((actionWord) => isWord(actionWord, "{}")),
      });
      index = actionIndex + 1;
      continue;
    }

    const arity = PREDICATE_ARITIES[word.raw] ?? 0;
    const predicateArguments = words.slice(index + 1, index + 1 + arity);
    clauses.push({ kind: "predicate", operator: word.raw, arguments: predicateArguments });
    index += 1 + predicateArguments.length;
  }

  return {
    kind: "parsed",
    expression: {
      kind: "find-expression",
      roots,
      clauses,
      redirections: command.parts.filter((part): part is RedirectionNode => part.kind === "redirection"),
    },
  };
}
