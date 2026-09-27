export type ShellPipelineOperator = "|" | "|&";
export type ShellScriptOperator = "&&" | "||" | ";";
export const REDIRECTION_OPERATORS = ["2>>", "&>>", "2>&", "2>", "&>", ">&", ">>", "<<<", "<&", ">", "<"] as const;
export type RedirectionOperator = (typeof REDIRECTION_OPERATORS)[number];

export type ShellSubstitution =
  | {
      kind: "process-substitution";
      raw: string;
      body: ShellAst;
    }
  | {
      kind: "command-substitution";
      raw: string;
      body: ShellAst;
    };

export type WordNode =
  | {
      kind: "word";
      raw: string;
      substitutions: readonly ShellSubstitution[];
    }
  | {
      kind: "process-substitution";
      raw: string;
      body: ShellAst;
    }
  | {
      kind: "command-substitution";
      raw: string;
      body: ShellAst;
    };

export type RedirectionNode = {
  kind: "redirection";
  raw: string;
  operator: RedirectionOperator;
  target: WordNode;
};

export type CommandPart = WordNode | RedirectionNode;

export type CommandNode = {
  kind: "command";
  raw: string;
  parts: readonly CommandPart[];
};

export type PipelineNode = {
  kind: "pipeline";
  commands: readonly [CommandNode, ...CommandNode[]];
  operators: readonly ShellPipelineOperator[];
};

export type ShellAst = {
  kind: "script";
  pipelines: readonly [PipelineNode, ...PipelineNode[]];
  operators: readonly ShellScriptOperator[];
};

export type ShellParseResult =
  | {
      kind: "parsed";
      ast: ShellAst;
    }
  | {
      kind: "error";
      input: string;
      message: string;
    };

type SplitOperator = ShellPipelineOperator | ShellScriptOperator;

type SplitSegment = {
  text: string;
  operator: SplitOperator | null;
};

type ReadWordResult =
  | {
      kind: "word";
      word: WordNode;
      end: number;
    }
  | {
      kind: "error";
      message: string;
    };

function substitutionKindAt(input: string, start: number): ShellSubstitution["kind"] | undefined {
  if (input[start] === "<" && input[start + 1] === "(") {
    return "process-substitution";
  }

  if (input[start] === "$" && input[start + 1] === "(") {
    return "command-substitution";
  }

  return undefined;
}

function readDelimited(input: string, start: number): { value: string; end: number } | null {
  if (!substitutionKindAt(input, start)) {
    return null;
  }

  let depth = 1;
  let quote: '"' | "'" | null = null;

  for (let index = start + 2; index < input.length; index += 1) {
    const character = input[index];

    if (quote) {
      if (character === "\\" && quote === '"' && input[index + 1]) {
        index += 1;
      } else if (character === quote) {
        quote = null;
      }

      continue;
    }

    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }

    if (character === "(") {
      depth += 1;
    } else if (character === ")") {
      depth -= 1;

      if (depth === 0) {
        return { value: input.slice(start, index + 1), end: index };
      }
    }
  }

  return null;
}

function parseProcessSubstitution(raw: string): ShellParseResult {
  const bodyStart = 2;
  const body = raw.slice(bodyStart, -1).trim();

  if (!body) {
    return {
      kind: "error",
      input: raw,
      message: "Process substitution is missing its inner command.",
    };
  }

  return parseShell(body);
}

function parseCommandSubstitution(raw: string): ShellParseResult {
  const body = raw.slice(2, -1).trim();

  if (!body) {
    return {
      kind: "error",
      input: raw,
      message: "Command substitution is missing its inner command.",
    };
  }

  return parseShell(body);
}

function parseSubstitution(raw: string, kind: ShellSubstitution["kind"]): ShellParseResult {
  return kind === "process-substitution"
    ? parseProcessSubstitution(raw)
    : parseCommandSubstitution(raw);
}

function matchRedirection(input: string, start: number): RedirectionOperator | undefined {
  if (substitutionKindAt(input, start)) {
    return undefined;
  }

  return REDIRECTION_OPERATORS.find((operator) => input.startsWith(operator, start));
}

function readWord(input: string, start: number): ReadWordResult {
  const initialSubstitutionKind = substitutionKindAt(input, start);

  if (initialSubstitutionKind) {
    const substitution = readDelimited(input, start);

    if (!substitution) {
      return {
        kind: "error",
        message: `${initialSubstitutionKind === "process-substitution" ? "Process" : "Command"} substitution is missing its closing parenthesis.`,
      };
    }

    const body = parseSubstitution(substitution.value, initialSubstitutionKind);

    if (body.kind === "error") {
      return body;
    }

    return {
      kind: "word",
      word: {
        kind: initialSubstitutionKind,
        raw: substitution.value,
        body: body.ast,
      },
      end: substitution.end + 1,
    };
  }

  let raw = "";
  const substitutions: ShellSubstitution[] = [];
  let quote: '"' | "'" | null = null;

  for (let index = start; index < input.length; index += 1) {
    const character = input[index];

    if (quote) {
      if (quote === '"' && input[index] === "$" && input[index + 1] === "(") {
        const substitutionKind = substitutionKindAt(input, index);
        const substitution = readDelimited(input, index);

        if (!substitution || !substitutionKind) {
          return { kind: "error", message: "Command substitution is missing its closing parenthesis." };
        }

        const body = parseSubstitution(substitution.value, substitutionKind);

        if (body.kind === "error") {
          return body;
        }

        raw += substitution.value;
        substitutions.push({ kind: substitutionKind, raw: substitution.value, body: body.ast });
        index = substitution.end;
        continue;
      }

      raw += character;

      if (character === "\\" && quote === '"' && input[index + 1]) {
        raw += input[index + 1];
        index += 1;
      } else if (character === quote) {
        quote = null;
      }

      continue;
    }

    const substitutionKind = substitutionKindAt(input, index);

    if (substitutionKind) {
      const substitution = readDelimited(input, index);

      if (!substitution) {
        return {
          kind: "error",
          message: `${substitutionKind === "process-substitution" ? "Process" : "Command"} substitution is missing its closing parenthesis.`,
        };
      }

      const body = parseSubstitution(substitution.value, substitutionKind);

      if (body.kind === "error") {
        return body;
      }

      raw += substitution.value;
      substitutions.push({ kind: substitutionKind, raw: substitution.value, body: body.ast });
      index = substitution.end;
      continue;
    }

    if (character === '"' || character === "'") {
      quote = character;
      raw += character;
      continue;
    }

    if (character === "\\" && input[index + 1]) {
      raw += character + input[index + 1];
      index += 1;
      continue;
    }

    if (/\s/.test(character) || (raw && matchRedirection(input, index))) {
      break;
    }

    if (!raw && character === "|") {
      break;
    }

    raw += character;
  }

  return raw
    ? { kind: "word", word: { kind: "word", raw, substitutions }, end: start + raw.length }
    : { kind: "error", message: `Expected a shell word near character ${start + 1}.` };
}

function parseCommand(input: string): ShellParseResult | CommandNode {
  const parts: CommandPart[] = [];
  let index = 0;

  while (index < input.length) {
    while (/\s/.test(input[index] ?? "")) {
      index += 1;
    }

    if (index >= input.length) {
      break;
    }

    const operator = matchRedirection(input, index);

    if (operator) {
      const targetStart = index + operator.length;
      let targetIndex = targetStart;

      while (/\s/.test(input[targetIndex] ?? "")) {
        targetIndex += 1;
      }

      const target = readWord(input, targetIndex);

      if (target.kind === "error") {
        return { kind: "error", input, message: `Redirection ${operator} is missing a target.` };
      }

      parts.push({
        kind: "redirection",
        raw: input.slice(index, target.end),
        operator,
        target: target.word,
      });
      index = target.end;
      continue;
    }

    const word = readWord(input, index);

    if (word.kind === "error") {
      return { kind: "error", input, message: word.message };
    }

    parts.push(word.word);
    index = word.end;
  }

  if (parts.length === 0) {
    return { kind: "error", input, message: "Expected a command." };
  }

  return { kind: "command", raw: input.trim(), parts };
}

function splitTopLevel(input: string): ShellParseResult | readonly SplitSegment[] {
  const segments: SplitSegment[] = [];
  let current = "";
  let pendingOperator: SplitOperator | null = null;
  let quote: '"' | "'" | null = null;

  const pushSegment = (operator: SplitOperator) => {
    const text = current.trim();

    if (!text) {
      throw new Error(`Operator ${operator} is missing a command.`);
    }

    segments.push({ text, operator: pendingOperator });
    pendingOperator = operator;
    current = "";
  };

  try {
    for (let index = 0; index < input.length; index += 1) {
      const character = input[index];

      if (quote) {
        current += character;

        if (character === "\\" && quote === '"' && input[index + 1]) {
          current += input[index + 1];
          index += 1;
        } else if (character === quote) {
          quote = null;
        }

        continue;
      }

      if (character === '"' || character === "'") {
        quote = character;
        current += character;
        continue;
      }

      if (character === "\\" && input[index + 1]) {
        current += character + input[index + 1];
        index += 1;
        continue;
      }

      const substitution = readDelimited(input, index);

      if (substitution) {
        current += substitution.value;
        index = substitution.end;
        continue;
      }

      if (character === "|" && input[index + 1] === "&") {
        pushSegment("|&");
        index += 1;
      } else if (character === "|" && input[index + 1] === "|") {
        pushSegment("||");
        index += 1;
      } else if (character === "|" && input[index + 1] !== "|") {
        pushSegment("|");
      } else if (character === "&" && input[index + 1] === "&") {
        pushSegment("&&");
        index += 1;
      } else if (character === ";") {
        pushSegment(";");
      } else {
        current += character;
      }
    }
  } catch (error) {
    return {
      kind: "error",
      input,
      message: error instanceof Error ? error.message : "Could not split the shell command.",
    };
  }

  if (quote) {
    return { kind: "error", input, message: "The command contains an unterminated quote." };
  }

  const finalText = current.trim();

  if (!finalText) {
    return { kind: "error", input, message: "The command ends with an operator." };
  }

  segments.push({ text: finalText, operator: pendingOperator });
  return segments;
}

export function parseShell(input: string): ShellParseResult {
  const trimmedInput = input.trim();

  if (!trimmedInput) {
    return { kind: "error", input, message: "The command is empty." };
  }

  const split = splitTopLevel(trimmedInput);

  if ("kind" in split) {
    return split;
  }

  const pipelines: PipelineNode[] = [];
  const scriptOperators: ShellScriptOperator[] = [];
  let currentCommands: CommandNode[] = [];
  let currentPipelineOperators: ShellPipelineOperator[] = [];

  const flushPipeline = () => {
    if (currentCommands.length === 0) {
      return;
    }

    pipelines.push({
      kind: "pipeline",
      commands: currentCommands as [CommandNode, ...CommandNode[]],
      operators: currentPipelineOperators,
    });
    currentCommands = [];
    currentPipelineOperators = [];
  };

  for (const [index, segment] of split.entries()) {
    const parsedCommand = parseCommand(segment.text);

    if ("kind" in parsedCommand && parsedCommand.kind === "error") {
      return parsedCommand;
    }

    if (index > 0 && segment.operator) {
      if (segment.operator === "|" || segment.operator === "|&") {
        currentPipelineOperators.push(segment.operator);
      } else {
        flushPipeline();
        scriptOperators.push(segment.operator);
      }
    }

    currentCommands.push(parsedCommand as CommandNode);
  }

  flushPipeline();

  if (pipelines.length === 0) {
    return { kind: "error", input, message: "Expected a command." };
  }

  return {
    kind: "parsed",
    ast: {
      kind: "script",
      pipelines: pipelines as [PipelineNode, ...PipelineNode[]],
      operators: scriptOperators,
    },
  };
}

export function commandWords(command: CommandNode): readonly WordNode[] {
  return command.parts.filter((part): part is WordNode => part.kind !== "redirection");
}

export function commandTokenStrings(command: CommandNode): readonly string[] {
  return command.parts.flatMap((part) =>
    part.kind === "redirection" ? [part.operator, part.target.raw] : [part.raw],
  );
}

export function processSubstitutions(ast: ShellAst): readonly WordNode[] {
  return ast.pipelines.flatMap((pipeline) =>
    pipeline.commands.flatMap((command) =>
      command.parts.flatMap((part) => {
        const words = part.kind === "redirection" ? [part.target] : [part];

        return words.flatMap((word) => {
          if (word.kind === "process-substitution") {
            return [word];
          }

          return word.kind === "word"
            ? word.substitutions.filter((substitution) => substitution.kind === "process-substitution")
            : [];
        });
      }),
    ),
  );
}

export function shellSubstitutions(word: WordNode): readonly ShellSubstitution[] {
  return word.kind === "word" ? word.substitutions : [word];
}
