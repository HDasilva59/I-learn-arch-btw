import type { ResolvedCommand } from "./manpage-matcher";
import {
  EFFECTS_BY_COMMAND,
  FOUNDATION_BY_COMMAND,
  PRIVILEGE_COMMANDS,
} from "./commands/metadata";
import type { CommandEffect, LinuxFoundation } from "./commands/types";

export type { CommandEffect, LinuxFoundation } from "./commands/types";

function unique<T>(values: readonly T[]): readonly T[] {
  return [...new Set(values)];
}

export function foundationsForCommand(command: ResolvedCommand): readonly LinuxFoundation[] {
  return FOUNDATION_BY_COMMAND[command.name] ?? [];
}

export function effectsForCommand(command: ResolvedCommand): readonly CommandEffect[] {
  return unique([
    ...(command.wrappers.some((wrapper) => PRIVILEGE_COMMANDS.has(wrapper)) ? ["privilege" as const] : []),
    ...(PRIVILEGE_COMMANDS.has(command.name) ? ["privilege" as const] : []),
    ...(command.guideId?.startsWith("pacman") ? ["packages" as const] : []),
    ...(EFFECTS_BY_COMMAND[command.name] ?? []),
  ]);
}

export function effectLabel(effect: CommandEffect): string {
  switch (effect) {
    case "filesystem":
      return "filesystem";
    case "processes":
      return "processes";
    case "network":
      return "network";
    case "privilege":
      return "privilege";
    case "packages":
      return "packages";
    case "shell":
      return "shell state";
    default: {
      const _exhaustive: never = effect;
      return _exhaustive;
    }
  }
}
