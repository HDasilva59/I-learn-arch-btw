import { parseFindExpression } from "./find-expression";
import { effectsForCommand, type CommandEffect } from "./command-knowledge";
import {
  identifyCommand,
  resolveManPage,
  type CommandResolver,
  type ManPageCatalog,
  type ResolvedCommand,
} from "./manpage-matcher";
import { shellSubstitutions, type CommandNode, type ShellAst, type ShellSubstitution } from "./shell-ast";

export type CommandOrigin =
  | "top-level"
  | "process-substitution"
  | "command-substitution"
  | "find-exec";

export type CommandAnalysis = {
  kind: "command-analysis";
  origin: CommandOrigin;
  resolved: ResolvedCommand;
  effects: readonly CommandEffect[];
  nested: readonly CommandAnalysis[];
};

export type AnalysisContext = {
  catalog: ManPageCatalog;
  resolveGuide: CommandResolver;
};

type CommandLanguage = {
  nestedCommands: (node: CommandNode) => readonly { node: CommandNode; origin: CommandOrigin }[];
};

const COMMAND_LANGUAGES: Readonly<Record<string, CommandLanguage>> = {
  find: {
    nestedCommands: (node) => {
      const parsed = parseFindExpression(node);

      return parsed.kind === "parsed"
        ? parsed.expression.clauses.flatMap((clause) => clause.kind === "exec" ? [{ node: clause.command, origin: "find-exec" as const }] : [])
        : [];
    },
  },
};

export function analyzeShell(ast: ShellAst, context: AnalysisContext): readonly CommandAnalysis[] {
  return ast.pipelines.flatMap((pipeline) => pipeline.commands.map((command) => analyzeCommand(command, context, "top-level")));
}

function substitutionCommands(substitution: ShellSubstitution): readonly { node: CommandNode; origin: CommandOrigin }[] {
  return substitution.body.pipelines.flatMap((pipeline) => pipeline.commands.map((node) => ({
    node,
    origin: substitution.kind === "process-substitution" ? "process-substitution" as const : "command-substitution" as const,
  })));
}

function nestedCommands(node: CommandNode, resolved: ResolvedCommand): readonly { node: CommandNode; origin: CommandOrigin }[] {
  const substitutions = node.parts.flatMap((part) => {
    const word = part.kind === "redirection" ? part.target : part;

    return shellSubstitutions(word).flatMap(substitutionCommands);
  });
  const languageCommands = COMMAND_LANGUAGES[resolved.name]?.nestedCommands(node) ?? [];

  return [...substitutions, ...languageCommands];
}

function analyzeCommand(node: CommandNode, context: AnalysisContext, origin: CommandOrigin): CommandAnalysis {
  const resolved = resolveManPage(identifyCommand(node), context.catalog, context.resolveGuide);
  const nested = nestedCommands(node, resolved)
    .map((nestedCommand) => analyzeCommand(nestedCommand.node, context, nestedCommand.origin));

  return {
    kind: "command-analysis",
    origin,
    resolved,
    effects: effectsForCommand(resolved),
    nested,
  };
}

export function flattenAnalyses(analyses: readonly CommandAnalysis[]): readonly CommandAnalysis[] {
  return analyses.flatMap((analysis) => [analysis, ...flattenAnalyses(analysis.nested)]);
}
