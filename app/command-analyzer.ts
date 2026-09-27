import { parseFindExpression } from "./find-expression";
import {
  identifyCommand,
  resolveManPage,
  type CommandResolver,
  type ManPageCatalog,
  type ResolvedCommand,
} from "./manpage-matcher";
import type { CommandNode, ShellAst } from "./shell-ast";

export type CommandAnalysis = {
  kind: "command-analysis";
  resolved: ResolvedCommand;
  nested: readonly CommandAnalysis[];
};

export type AnalysisContext = {
  catalog: ManPageCatalog;
  resolveGuide: CommandResolver;
};

type CommandLanguage = {
  nestedCommands: (node: CommandNode) => readonly CommandNode[];
};

const COMMAND_LANGUAGES: Readonly<Record<string, CommandLanguage>> = {
  find: {
    nestedCommands: (node) => {
      const parsed = parseFindExpression(node);

      return parsed.kind === "parsed"
        ? parsed.expression.clauses.flatMap((clause) => clause.kind === "exec" ? [clause.command] : [])
        : [];
    },
  },
};

export function analyzeShell(ast: ShellAst, context: AnalysisContext): readonly CommandAnalysis[] {
  return ast.pipelines.flatMap((pipeline) => pipeline.commands.map((command) => analyzeCommand(command, context)));
}

function analyzeCommand(node: CommandNode, context: AnalysisContext): CommandAnalysis {
  const resolved = resolveManPage(identifyCommand(node), context.catalog, context.resolveGuide);
  const processSubstitutions = node.parts.flatMap((part) => {
    const word = part.kind === "redirection" ? part.target : part;

    return word.kind === "process-substitution"
      ? word.body.pipelines.flatMap((pipeline) => pipeline.commands)
      : [];
  });
  const languageCommands = COMMAND_LANGUAGES[resolved.name]?.nestedCommands(node) ?? [];
  const nested = [...processSubstitutions, ...languageCommands]
    .map((nestedCommand) => analyzeCommand(nestedCommand, context));

  return { kind: "command-analysis", resolved, nested };
}

export function flattenAnalyses(analyses: readonly CommandAnalysis[]): readonly CommandAnalysis[] {
  return analyses.flatMap((analysis) => [analysis, ...flattenAnalyses(analysis.nested)]);
}
