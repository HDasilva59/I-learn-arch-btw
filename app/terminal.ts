export type FileEntry =
  | { kind: "directory"; mode?: string; owner?: string; group?: string }
  | { kind: "file"; content: string; mode?: string; owner?: string; group?: string };

type FileSystem = Readonly<Record<string, FileEntry>>;

export type TerminalSession = {
  cwd: string;
  filesystem: FileSystem;
  installedPackages: readonly string[];
  environment: Readonly<Record<string, string>>;
  aliases: Readonly<Record<string, string>>;
  history: readonly string[];
};

export type TerminalLine = {
  kind: "output" | "error";
  text: string;
};

export type TerminalResult =
  | (TerminalLine & { session: TerminalSession; normalizedInput: string })
  | { kind: "clear"; text: ""; session: TerminalSession; normalizedInput: string };

type PackageRecord = {
  name: string;
  version: string;
  description: string;
  repository: string;
  files: readonly string[];
};

const PACKAGES: readonly PackageRecord[] = [
  { name: "alacritty", version: "0.13.2-1", description: "A cross-platform, GPU accelerated terminal emulator", repository: "extra", files: ["/usr/bin/alacritty", "/usr/share/applications/Alacritty.desktop"] },
  { name: "bash", version: "5.2.026-1", description: "The GNU Bourne Again shell", repository: "core", files: ["/usr/bin/bash", "/usr/share/man/man1/bash.1.gz"] },
  { name: "coreutils", version: "9.5-1", description: "The basic file, shell and text manipulation utilities", repository: "core", files: ["/usr/bin/cat", "/usr/bin/ls", "/usr/bin/pwd"] },
  { name: "git", version: "2.45.2-1", description: "The fast distributed version control system", repository: "extra", files: ["/usr/bin/git", "/usr/share/man/man1/git.1.gz"] },
  { name: "htop", version: "3.3.0-1", description: "Interactive process viewer", repository: "extra", files: ["/usr/bin/htop", "/usr/share/man/man1/htop.1.gz"] },
  { name: "neovim", version: "0.10.0-2", description: "Fork of Vim aiming to aggressively refactor its code", repository: "extra", files: ["/usr/bin/nvim", "/usr/share/applications/nvim.desktop"] },
  { name: "pacman", version: "6.1.0-3", description: "A library-based package manager with dependency support", repository: "core", files: ["/usr/bin/pacman", "/etc/pacman.conf", "/var/log/pacman.log"] },
  { name: "python", version: "3.12.4-1", description: "Next generation of the python high-level programming language", repository: "core", files: ["/usr/bin/python", "/usr/lib/python3.12"] },
  { name: "python-pip", version: "24.1-1", description: "The PyPA recommended tool for installing Python packages", repository: "extra", files: ["/usr/bin/pip", "/usr/lib/python3.12/site-packages"] },
  { name: "ripgrep", version: "14.1.0-1", description: "A search tool that combines the usability of ag with the speed of grep", repository: "extra", files: ["/usr/bin/rg", "/usr/share/man/man1/rg.1.gz"] },
  { name: "zsh", version: "5.9-4", description: "A very advanced and programmable command interpreter", repository: "core", files: ["/usr/bin/zsh", "/usr/share/man/man1/zsh.1.gz"] },
];

const INITIAL_INSTALLED_PACKAGES = ["alacritty", "bash", "coreutils", "git", "neovim", "pacman", "python", "python-pip", "ripgrep", "zsh"] as const;

function initialFileSystem(): FileSystem {
  return {
    "/": { kind: "directory" },
    "/etc": { kind: "directory" },
    "/home": { kind: "directory" },
    "/home/student": { kind: "directory" },
    "/home/student/.bashrc": { kind: "file", content: "# Your shell starts here.\n" },
    "/home/student/notes.txt": { kind: "file", content: "Arch is a rolling release.\nRead before you update.\n" },
    "/home/student/projects": { kind: "directory" },
    "/home/student/projects/hello.txt": { kind: "file", content: "Hello from the practice shell.\n" },
    "/tmp": { kind: "directory" },
    "/var": { kind: "directory" },
    "/var/log": { kind: "directory" },
    "/var/log/pacman.log": { kind: "file", content: "[2024-06-18] [ALPM] upgraded pacman (6.0.2-8 -> 6.1.0-3)\n" },
  };
}

export function createInitialTerminalSession(): TerminalSession {
  return {
    cwd: "/home/student",
    filesystem: initialFileSystem(),
    installedPackages: [...INITIAL_INSTALLED_PACKAGES],
    environment: {
      HOME: "/home/student",
      PATH: "/usr/local/bin:/usr/bin:/bin",
      PWD: "/home/student",
      SHELL: "/usr/bin/bash",
      USER: "student",
    },
    aliases: {},
    history: [],
  };
}

function output(text: string, session: TerminalSession, normalizedInput: string): TerminalResult {
  return { kind: "output", text, session, normalizedInput };
}

function error(text: string, session: TerminalSession, normalizedInput: string): TerminalResult {
  return { kind: "error", text, session, normalizedInput };
}

function normalizeInput(input: string): string {
  return input.trim().replace(/\s+/g, " ");
}

function tokenize(input: string): readonly string[] {
  const tokens = input.match(/"[^"]*"|'[^']*'|\S+/g) ?? [];
  return tokens.map((token) => {
    if ((token.startsWith('"') && token.endsWith('"')) || (token.startsWith("'") && token.endsWith("'"))) {
      return token.slice(1, -1);
    }

    return token;
  });
}

function resolvePath(input: string, cwd: string): string {
  const expanded = input === "~" || input.startsWith("~/")
    ? `/home/student${input.slice(1)}`
    : input.startsWith("/")
      ? input
      : `${cwd}/${input}`;
  const parts: string[] = [];

  for (const part of expanded.split("/")) {
    if (!part || part === ".") {
      continue;
    }

    if (part === "..") {
      parts.pop();
      continue;
    }

    parts.push(part);
  }

  return `/${parts.join("/")}`;
}

function parentPath(path: string): string {
  const separator = path.lastIndexOf("/");
  return separator <= 0 ? "/" : path.slice(0, separator);
}

function entryAt(session: TerminalSession, path: string): FileEntry | undefined {
  return session.filesystem[path];
}

function withFileSystem(session: TerminalSession, filesystem: Record<string, FileEntry>): TerminalSession {
  return { ...session, filesystem };
}

function entryMode(entry: FileEntry): string {
  if (!entry.mode) {
    return entry.kind === "directory" ? "drwxr-xr-x" : "-rw-r--r--";
  }

  if (/^[0-7]{3,4}$/.test(entry.mode)) {
    const digits = entry.mode.slice(-3);
    const permissions = digits.split("").map((digit) => {
      const value = Number(digit);
      return `${value & 4 ? "r" : "-"}${value & 2 ? "w" : "-"}${value & 1 ? "x" : "-"}`;
    }).join("");

    return `${entry.kind === "directory" ? "d" : "-"}${permissions}`;
  }

  return entry.mode;
}

function entryOwner(entry: FileEntry): string {
  return entry.owner ?? "student";
}

function entryGroup(entry: FileEntry): string {
  return entry.group ?? "student";
}

function basename(path: string): string {
  return path.split("/").pop() || "/";
}

function fileSize(entry: FileEntry): number {
  return entry.kind === "file" ? entry.content.length : 4096;
}

function longListing(name: string, entry: FileEntry): string {
  return `${entryMode(entry)} 1 ${entryOwner(entry)} ${entryGroup(entry)} ${String(fileSize(entry)).padStart(5, " ")} Jun 18 10:42 ${name}${entry.kind === "directory" ? "/" : ""}`;
}

function withEnvironment(session: TerminalSession, environment: Record<string, string>): TerminalSession {
  return { ...session, environment };
}

function withAliases(session: TerminalSession, aliases: Record<string, string>): TerminalSession {
  return { ...session, aliases };
}

function removePath(filesystem: Record<string, FileEntry>, path: string, recursive: boolean): Record<string, FileEntry> {
  const entry = filesystem[path];

  if (!entry) {
    return filesystem;
  }

  if (entry.kind === "directory" && recursive) {
    for (const childPath of Object.keys(filesystem)) {
      if (childPath === path || childPath.startsWith(`${path}/`)) {
        delete filesystem[childPath];
      }
    }
  } else {
    delete filesystem[path];
  }

  return filesystem;
}

function copyTree(filesystem: Record<string, FileEntry>, source: string, destination: string): Record<string, FileEntry> {
  const next = { ...filesystem };

  for (const [path, entry] of Object.entries(filesystem)) {
    if (path === source || path.startsWith(`${source}/`)) {
      const suffix = path.slice(source.length);
      next[`${destination}${suffix}`] = entry;
    }
  }

  return next;
}

function expandVariables(text: string, environment: Readonly<Record<string, string>>): string {
  return text.replace(/\$([A-Z_][A-Z0-9_]*)/gi, (_, name: string) => environment[name] ?? "");
}

function matchesPattern(name: string, pattern: string): boolean {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`).test(name);
}

function fileLines(content: string): string[] {
  return content.split(/\r?\n/).filter((line, index, lines) => index < lines.length - 1 || line.length > 0);
}

function visibleChildEntries(session: TerminalSession, directory: string, showHidden: boolean): Array<[string, FileEntry]> {
  const prefix = directory === "/" ? "/" : `${directory}/`;
  const children = new Map<string, FileEntry>();

  for (const [path, entry] of Object.entries(session.filesystem)) {
    if (!path.startsWith(prefix) || path === directory) {
      continue;
    }

    const rest = path.slice(prefix.length);
    const [name] = rest.split("/");

    if (!name || (!showHidden && name.startsWith("."))) {
      continue;
    }

    children.set(name, entry);
  }

  return [...children.entries()]
    .sort(([left], [right]) => left.localeCompare(right));
}

function packageByName(name: string): PackageRecord | undefined {
  return PACKAGES.find((item) => item.name === name);
}

function packageSearch(packages: readonly PackageRecord[], query: string): PackageRecord[] {
  const normalizedQuery = query.toLowerCase();
  return packages.filter((item) => `${item.name} ${item.description}`.toLowerCase().includes(normalizedQuery));
}

function runPacman(args: readonly string[], session: TerminalSession, needsRoot: boolean, normalizedInput: string): TerminalResult {
  const operation = args[0];
  const installed = PACKAGES.filter((item) => session.installedPackages.includes(item.name));

  if (operation === "-Syu") {
    return output(":: Synchronizing package databases...\n core is up to date\n extra is up to date\n:: Starting full system upgrade...\n there is nothing to do\n\n[safe browser simulation] No real system was changed.", session, normalizedInput);
  }

  if (operation === "-S") {
    if (!needsRoot) {
      return error("error: you cannot perform this operation unless you are root", session, normalizedInput);
    }

    const packageName = args[1];
    const packageInfo = packageName ? packageByName(packageName) : undefined;

    if (!packageInfo) {
      return error(`error: target not found: ${packageName ?? "(missing package name)"}`, session, normalizedInput);
    }

    if (session.installedPackages.includes(packageInfo.name)) {
      return output(`${packageInfo.name} is already up to date\n\n[safe browser simulation] No real system was changed.`, session, normalizedInput);
    }

    return output(`resolving dependencies...\nlooking for conflicting packages...\ninstalling ${packageInfo.name} ${packageInfo.version}\n\n[safe browser simulation] No real system was changed.`, { ...session, installedPackages: [...session.installedPackages, packageInfo.name] }, normalizedInput);
  }

  if (operation === "-Rns") {
    if (!needsRoot) {
      return error("error: you cannot perform this operation unless you are root", session, normalizedInput);
    }

    const packageName = args[1];

    if (!packageName || !session.installedPackages.includes(packageName)) {
      return error(`error: target not found: ${packageName ?? "(missing package name)"}`, session, normalizedInput);
    }

    return output(`checking dependencies...\nremoving ${packageName}\n\n[safe browser simulation] No real system was changed.`, { ...session, installedPackages: session.installedPackages.filter((name) => name !== packageName) }, normalizedInput);
  }

  if (operation === "-Q") {
    return output(installed.map((item) => `${item.name} ${item.version}`).join("\n"), session, normalizedInput);
  }

  if (operation === "-Qs" || operation === "-Ss") {
    const matches = packageSearch(operation === "-Qs" ? installed : PACKAGES, args.slice(1).join(" "));
    return output(matches.length > 0 ? matches.map((item) => `${item.repository}/${item.name} ${item.version}\n    ${item.description}`).join("\n") : "No matching packages found.", session, normalizedInput);
  }

  if (operation === "-Qi") {
    const packageInfo = args[1] ? packageByName(args[1]) : undefined;

    if (!packageInfo || !session.installedPackages.includes(packageInfo.name)) {
      return error(`error: package '${args[1] ?? ""}' was not found in the local database`, session, normalizedInput);
    }

    return output(`Name            : ${packageInfo.name}\nVersion         : ${packageInfo.version}\nDescription     : ${packageInfo.description}\nArchitecture     : x86_64\nRepository      : ${packageInfo.repository}\nInstall Date    : simulated`, session, normalizedInput);
  }

  if (operation === "-Ql") {
    const packageInfo = args[1] ? packageByName(args[1]) : undefined;

    if (!packageInfo || !session.installedPackages.includes(packageInfo.name)) {
      return error(`error: package '${args[1] ?? ""}' was not found in the local database`, session, normalizedInput);
    }

    return output(packageInfo.files.map((path) => `${packageInfo.name} ${path}`).join("\n"), session, normalizedInput);
  }

  if (operation === "-Qdt" || operation === "-Qdtq") {
    const orphans = installed.filter((item) => item.name === "python-pip");
    return output(orphans.length > 0 ? orphans.map((item) => operation === "-Qdtq" ? item.name : `${item.name} ${item.version}`).join("\n") : "", session, normalizedInput);
  }

  return error(`error: unsupported pacman operation '${operation ?? ""}' in the safe browser shell`, session, normalizedInput);
}

export function runTerminalCommand(input: string, session: TerminalSession): TerminalResult {
  const normalizedInput = normalizeInput(input);
  const tokens = tokenize(input);

  if (tokens.length === 0) {
    return output("", session, normalizedInput);
  }

  const alias = session.aliases[tokens[0]];
  const commandTokens = alias ? [...tokenize(alias), ...tokens.slice(1)] : [...tokens];
  const needsRoot = commandTokens[0] === "sudo";

  if (needsRoot) {
    commandTokens.shift();
  }

  const command = commandTokens[0];
  const args = commandTokens.slice(1);

  if (!command) {
    return error("sudo: a command is required", session, normalizedInput);
  }

  if (command === "clear") {
    return { kind: "clear", text: "", session, normalizedInput };
  }

  if (command === "pwd") {
    return output(session.cwd, session, normalizedInput);
  }

  if (command === "whoami") {
    return output(needsRoot ? "root" : "student", session, normalizedInput);
  }

  if (command === "uname") {
    return output(args.includes("-a") ? "Linux arch-practice 6.9.3-arch1-1 x86_64 GNU/Linux" : "Linux", session, normalizedInput);
  }

  if (command === "help") {
    return output("Safe commands: pwd, ls, cd, cat, less, man, mkdir, touch, echo, cp, mv, rm, rmdir, find, grep, head, tail, wc, sort, chmod, chown, tar, gzip, gunzip, ps, top, kill, pacman, systemctl, journalctl, whoami, uname, which, type, env, printenv, export, alias, history, clear, help", session, normalizedInput);
  }

  if (command === "history") {
    return output(session.history.map((item, index) => `${String(index + 1).padStart(3, " ")}  ${item}`).join("\n"), session, normalizedInput);
  }

  if (command === "alias") {
    const definition = args[0];

    if (!definition) {
      return output(Object.entries(session.aliases).map(([name, value]) => `alias ${name}='${value}'`).join("\n"), session, normalizedInput);
    }

    const separator = definition.indexOf("=");

    if (separator <= 0) {
      return error("alias: expected name=value", session, normalizedInput);
    }

    const name = definition.slice(0, separator);
    const value = definition.slice(separator + 1);
    return output("", withAliases(session, { ...session.aliases, [name]: value }), normalizedInput);
  }

  if (command === "export") {
    const definition = args[0];
    const separator = definition?.indexOf("=") ?? -1;

    if (!definition || separator <= 0) {
      return error("export: expected NAME=value", session, normalizedInput);
    }

    const name = definition.slice(0, separator);
    const value = expandVariables(definition.slice(separator + 1), session.environment);
    return output("", withEnvironment(session, { ...session.environment, [name]: value }), normalizedInput);
  }

  if (command === "env" || command === "printenv") {
    const target = args[0];

    if (command === "printenv" && target) {
      return output(session.environment[target] ?? "", session, normalizedInput);
    }

    return output(Object.entries(session.environment).map(([name, value]) => `${name}=${value}`).join("\n"), session, normalizedInput);
  }

  if (command === "type") {
    const target = args[0];
    const aliases = target && session.aliases[target];

    if (aliases) {
      return output(`${target} is aliased to '${aliases}'`, session, normalizedInput);
    }

    const knownCommands = ["bash", "cat", "cd", "clear", "echo", "find", "grep", "ls", "pacman", "python", "systemctl", "journalctl"];
    return target && knownCommands.includes(target)
      ? output(`${target} is /usr/bin/${target}`, session, normalizedInput)
      : error(`bash: type: ${target ?? "(missing command)"}: not found`, session, normalizedInput);
  }

  if (command === "man" || command === "less") {
    const target = args[0];

    if (command === "man" && target === "pacman") {
      return output("PACMAN(8)\n\nName\n  pacman - the Arch Linux package manager\n\nCommon queries\n  -Q    query installed packages\n  -Qs   search installed packages\n  -Qi   show package information\n  -Ql   list package files\n\nPress q in a real man page to leave it.", session, normalizedInput);
    }

    if (target) {
      const path = resolvePath(target, session.cwd);
      const entry = entryAt(session, path);

      if (entry?.kind === "file") {
        return output(entry.content, session, normalizedInput);
      }
    }

    return output("This safe shell includes short examples for the commands in the lesson. Try man pacman.", session, normalizedInput);
  }

  if (command === "ls") {
    const showHidden = args.some((arg) => arg.includes("a"));
    const long = args.some((arg) => arg.includes("l"));
    const target = args.findLast((arg) => !arg.startsWith("-")) ?? session.cwd;
    const path = resolvePath(target, session.cwd);
    const entry = entryAt(session, path);

    if (!entry) {
      return error(`ls: cannot access '${target}': No such file or directory`, session, normalizedInput);
    }

    if (entry.kind === "file") {
      return output(long ? longListing(basename(path), entry) : basename(path), session, normalizedInput);
    }

    const children = visibleChildEntries(session, path, showHidden);
    return output(long ? children.map(([name, child]) => longListing(name, child)).join("\n") : children.map(([name, child]) => child.kind === "directory" ? `${name}/` : name).join("  "), session, normalizedInput);
  }

  if (command === "cd") {
    const target = args[0] ?? "~";
    const path = resolvePath(target, session.cwd);
    const entry = entryAt(session, path);

    if (!entry) {
      return error(`bash: cd: ${target}: No such file or directory`, session, normalizedInput);
    }

    if (entry.kind !== "directory") {
      return error(`bash: cd: ${target}: Not a directory`, session, normalizedInput);
    }

    return output("", { ...session, cwd: path, environment: { ...session.environment, PWD: path } }, normalizedInput);
  }

  if (command === "cat") {
    const target = args[0];
    const path = target ? resolvePath(target, session.cwd) : "";
    const entry = path ? entryAt(session, path) : undefined;

    if (!entry) {
      return error(`cat: ${target ?? "(missing file)"}: No such file or directory`, session, normalizedInput);
    }

    if (entry.kind !== "file") {
      return error(`cat: ${target}: Is a directory`, session, normalizedInput);
    }

    return output(entry.content, session, normalizedInput);
  }

  if (command === "mkdir" || command === "touch") {
    const recursive = command === "mkdir" && args[0] === "-p";
    const target = recursive ? args[1] : args[0];

    if (!target || target.startsWith("-")) {
      return error(`${command}: missing file operand`, session, normalizedInput);
    }

    const path = resolvePath(target, session.cwd);

    if (recursive) {
      const filesystem: Record<string, FileEntry> = { ...session.filesystem };
      const parts = path.split("/").filter(Boolean);
      let current = "";

      for (const part of parts) {
        current += `/${part}`;
        const existing = filesystem[current];

        if (existing?.kind === "file") {
          return error(`mkdir: cannot create directory '${target}': File exists`, session, normalizedInput);
        }

        filesystem[current] ??= { kind: "directory" };
      }

      return output("", withFileSystem(session, filesystem), normalizedInput);
    }

    const parent = entryAt(session, parentPath(path));

    if (!parent || parent.kind !== "directory") {
      return error(`${command}: cannot create '${target}': No such file or directory`, session, normalizedInput);
    }

    if (entryAt(session, path)) {
      return command === "mkdir" ? error(`mkdir: cannot create directory '${target}': File exists`, session, normalizedInput) : output("", session, normalizedInput);
    }

    const filesystem: Record<string, FileEntry> = { ...session.filesystem, [path]: command === "mkdir" ? { kind: "directory" } : { kind: "file", content: "" } };
    return output("", withFileSystem(session, filesystem), normalizedInput);
  }

  if (command === "cp" || command === "mv") {
    const recursive = args[0] === "-r" || args[0] === "-R";
    const sourceTarget = recursive ? args[1] : args[0];
    const destinationTarget = recursive ? args[2] : args[1];

    if (!sourceTarget || !destinationTarget) {
      return error(`${command}: missing file operand`, session, normalizedInput);
    }

    const source = resolvePath(sourceTarget, session.cwd);
    const sourceEntry = entryAt(session, source);

    if (!sourceEntry) {
      return error(`${command}: cannot stat '${sourceTarget}': No such file or directory`, session, normalizedInput);
    }

    if (sourceEntry.kind === "directory" && !recursive) {
      return error(`${command}: -r not specified; omitting directory '${sourceTarget}'`, session, normalizedInput);
    }

    const destination = resolvePath(destinationTarget, session.cwd);
    const destinationEntry = entryAt(session, destination);
    const finalDestination = destinationEntry?.kind === "directory" ? `${destination}/${basename(source)}` : destination;

    if (sourceEntry.kind === "directory" && (finalDestination === source || finalDestination.startsWith(`${source}/`))) {
      return error(`${command}: cannot move a directory into itself`, session, normalizedInput);
    }

    const parent = entryAt(session, parentPath(finalDestination));

    if (!parent || parent.kind !== "directory") {
      return error(`${command}: cannot create '${destinationTarget}': No such file or directory`, session, normalizedInput);
    }

    let filesystem = copyTree({ ...session.filesystem }, source, finalDestination);

    if (command === "mv") {
      filesystem = removePath(filesystem, source, sourceEntry.kind === "directory");
    }

    return output("", withFileSystem(session, filesystem), normalizedInput);
  }

  if (command === "rmdir") {
    const target = args[0];
    const path = target ? resolvePath(target, session.cwd) : "";
    const entry = path ? entryAt(session, path) : undefined;

    if (!entry || entry.kind !== "directory") {
      return error(`rmdir: failed to remove '${target ?? ""}': No such directory`, session, normalizedInput);
    }

    const hasChildren = Object.keys(session.filesystem).some((childPath) => childPath.startsWith(`${path}/`));

    if (hasChildren) {
      return error(`rmdir: failed to remove '${target}': Directory not empty`, session, normalizedInput);
    }

    const filesystem = { ...session.filesystem };
    delete filesystem[path];
    return output("", withFileSystem(session, filesystem), normalizedInput);
  }

  if (command === "rm") {
    const recursive = args.includes("-r") || args.includes("-R");
    const target = args.find((arg) => !arg.startsWith("-"));
    const path = target ? resolvePath(target, session.cwd) : "";
    const entry = path ? entryAt(session, path) : undefined;

    if (!entry) {
      return error(`rm: cannot remove '${target ?? ""}': No such file or directory`, session, normalizedInput);
    }

    if (entry.kind === "directory" && !recursive) {
      return error(`rm: cannot remove '${target}': Is a directory`, session, normalizedInput);
    }

    const filesystem = removePath({ ...session.filesystem }, path, recursive);
    return output("[safe browser simulation] Removed only from the virtual filesystem.", withFileSystem(session, filesystem), normalizedInput);
  }

  if (command === "echo") {
    const redirectionIndex = args.indexOf(">");
    const text = expandVariables((redirectionIndex === -1 ? args : args.slice(0, redirectionIndex)).join(" "), session.environment);

    if (redirectionIndex !== -1) {
      const target = args[redirectionIndex + 1];

      if (!target || redirectionIndex !== args.length - 2) {
        return error("echo: safe shell supports one simple > file redirection", session, normalizedInput);
      }

      const path = resolvePath(target, session.cwd);
      const existing = entryAt(session, path);

      if (existing?.kind === "directory") {
        return error(`bash: ${target}: Is a directory`, session, normalizedInput);
      }

      const parent = entryAt(session, parentPath(path));

      if (!parent || parent.kind !== "directory") {
        return error(`bash: ${target}: No such file or directory`, session, normalizedInput);
      }

      const filesystem: Record<string, FileEntry> = { ...session.filesystem, [path]: { kind: "file", content: `${text}\n` } };
      return output("", withFileSystem(session, filesystem), normalizedInput);
    }

    return output(text, session, normalizedInput);
  }

  if (command === "grep") {
    const query = args[0];
    const target = args[1];
    const path = target ? resolvePath(target, session.cwd) : "";
    const entry = path ? entryAt(session, path) : undefined;

    if (!query || !entry) {
      return error(`grep: ${target ?? "(missing file)"}: No such file or directory`, session, normalizedInput);
    }

    if (entry.kind !== "file") {
      return error(`grep: ${target}: Is a directory`, session, normalizedInput);
    }

    const matches = fileLines(entry.content).filter((line) => line.includes(query));
    return output(matches.join("\n"), session, normalizedInput);
  }

  if (command === "find") {
    const rootTarget = args[0] && !args[0].startsWith("-") ? args[0] : ".";
    const root = resolvePath(rootTarget, session.cwd);
    const nameIndex = args.indexOf("-name");
    const typeIndex = args.indexOf("-type");
    const namePattern = nameIndex >= 0 ? args[nameIndex + 1] : undefined;
    const type = typeIndex >= 0 ? args[typeIndex + 1] : undefined;
    const matches = Object.entries(session.filesystem)
      .filter(([path, entry]) => {
        if (path !== root && !path.startsWith(`${root}/`)) {
          return false;
        }

        if (type === "f" && entry.kind !== "file") {
          return false;
        }

        if (type === "d" && entry.kind !== "directory") {
          return false;
        }

        return !namePattern || matchesPattern(basename(path), namePattern);
      })
      .map(([path]) => path)
      .sort();

    return output(matches.join("\n"), session, normalizedInput);
  }

  if (command === "head" || command === "tail") {
    const lineFlagIndex = args.indexOf("-n");
    const count = lineFlagIndex >= 0 ? Number(args[lineFlagIndex + 1]) : 10;
    const target = args.find((arg, index) => !arg.startsWith("-") && index !== lineFlagIndex + 1);
    const path = target ? resolvePath(target, session.cwd) : "";
    const entry = path ? entryAt(session, path) : undefined;

    if (!entry || entry.kind !== "file" || !Number.isFinite(count)) {
      return error(`${command}: cannot read '${target ?? ""}'`, session, normalizedInput);
    }

    const lines = fileLines(entry.content);
    return output((command === "head" ? lines.slice(0, count) : lines.slice(-count)).join("\n"), session, normalizedInput);
  }

  if (command === "wc") {
    const target = args.find((arg) => !arg.startsWith("-"));
    const path = target ? resolvePath(target, session.cwd) : "";
    const entry = path ? entryAt(session, path) : undefined;

    if (!entry || entry.kind !== "file") {
      return error(`wc: ${target ?? "(missing file)"}: No such file or directory`, session, normalizedInput);
    }

    const lines = fileLines(entry.content);
    return output(args.includes("-l") ? `${String(lines.length).padStart(7, " ")} ${target}` : `${lines.length} ${entry.content.trim().split(/\s+/).filter(Boolean).length} ${entry.content.length} ${target}`, session, normalizedInput);
  }

  if (command === "sort") {
    const target = args[0];
    const path = target ? resolvePath(target, session.cwd) : "";
    const entry = path ? entryAt(session, path) : undefined;

    if (!entry || entry.kind !== "file") {
      return error(`sort: ${target ?? "(missing file)"}: No such file or directory`, session, normalizedInput);
    }

    return output(fileLines(entry.content).sort((left, right) => left.localeCompare(right)).join("\n"), session, normalizedInput);
  }

  if (command === "chmod") {
    const mode = args[0];
    const target = args[1];
    const path = target ? resolvePath(target, session.cwd) : "";
    const entry = path ? entryAt(session, path) : undefined;

    if (!mode || !target || !/^(?:[0-7]{3,4}|[ugoa]*[+-][rwx]+)$/.test(mode)) {
      return error("chmod: safe shell expects a numeric mode or a simple symbolic mode", session, normalizedInput);
    }

    if (!entry) {
      return error(`chmod: cannot access '${target}': No such file or directory`, session, normalizedInput);
    }

    const filesystem = { ...session.filesystem, [path]: { ...entry, mode } };
    return output("", withFileSystem(session, filesystem), normalizedInput);
  }

  if (command === "chown") {
    const owner = args[0];
    const target = args[1];
    const path = target ? resolvePath(target, session.cwd) : "";
    const entry = path ? entryAt(session, path) : undefined;

    if (!owner || !target || !owner.includes(":")) {
      return error("chown: safe shell expects user:group file", session, normalizedInput);
    }

    if (!entry) {
      return error(`chown: cannot access '${target}': No such file or directory`, session, normalizedInput);
    }

    const [user, group] = owner.split(":");
    const filesystem = { ...session.filesystem, [path]: { ...entry, owner: user, group } };
    return output("", withFileSystem(session, filesystem), normalizedInput);
  }

  if (command === "tar") {
    const operation = args[0];

    if (operation === "-cf") {
      const archiveTarget = args[1];
      const sourceTargets = args.slice(2);

      if (!archiveTarget || sourceTargets.length === 0) {
        return error("tar: safe shell expects -cf archive.tar file...", session, normalizedInput);
      }

      const archivePath = resolvePath(archiveTarget, session.cwd);
      const sourcePaths = sourceTargets.map((target) => resolvePath(target, session.cwd));

      if (sourcePaths.some((path) => !entryAt(session, path))) {
        return error("tar: one of the source paths does not exist", session, normalizedInput);
      }

      const filesystem: Record<string, FileEntry> = {
        ...session.filesystem,
        [archivePath]: { kind: "file", content: `TAR ARCHIVE\n${sourcePaths.join("\n")}\n` },
      };
      return output("", withFileSystem(session, filesystem), normalizedInput);
    }

    if (operation === "-tf") {
      const archiveTarget = args[1];
      const path = archiveTarget ? resolvePath(archiveTarget, session.cwd) : "";
      const entry = path ? entryAt(session, path) : undefined;

      if (!entry || entry.kind !== "file" || !entry.content.startsWith("TAR ARCHIVE")) {
        return error(`tar: '${archiveTarget ?? ""}': This is not a simulated tar archive`, session, normalizedInput);
      }

      return output(fileLines(entry.content).slice(1).join("\n"), session, normalizedInput);
    }

    if (operation === "-xf") {
      const archiveTarget = args[1];
      return output(`x ${archiveTarget ?? "(missing archive)"}\n[safe browser simulation] No files were extracted on your computer.`, session, normalizedInput);
    }

    return error("tar: safe shell supports -cf, -tf, and -xf", session, normalizedInput);
  }

  if (command === "gzip" || command === "gunzip") {
    const keep = args.includes("-k");
    const target = args.find((arg) => !arg.startsWith("-"));
    const path = target ? resolvePath(target, session.cwd) : "";
    const entry = path ? entryAt(session, path) : undefined;

    if (!target || !entry || entry.kind !== "file") {
      return error(`${command}: cannot access '${target ?? ""}'`, session, normalizedInput);
    }

    if (command === "gzip") {
      const filesystem: Record<string, FileEntry> = { ...session.filesystem, [`${path}.gz`]: { kind: "file", content: `GZIP\n${entry.content}` } };

      if (!keep) {
        delete filesystem[path];
      }

      return output("", withFileSystem(session, filesystem), normalizedInput);
    }

    const outputPath = path.endsWith(".gz") ? path.slice(0, -3) : `${path}.out`;
    const content = entry.content.startsWith("GZIP\n") ? entry.content.slice(5) : entry.content;
    const filesystem: Record<string, FileEntry> = { ...session.filesystem, [outputPath]: { kind: "file", content } };
    delete filesystem[path];
    return output("", withFileSystem(session, filesystem), normalizedInput);
  }

  if (command === "ps") {
    return output("  PID TTY          TIME CMD\n 1001 pts/0    00:00:00 bash\n 1002 pts/0    00:00:00 pacman", session, normalizedInput);
  }

  if (command === "top") {
    return output("top - simulated snapshot\nTasks: 2 total, 1 running, 1 sleeping\n  PID USER      CPU%  COMMAND\n 1001 student    0.0  bash\n 1002 student    0.0  pacman", session, normalizedInput);
  }

  if (command === "kill") {
    const pid = args[0];
    return pid ? output(`Sent TERM to simulated process ${pid}.\n[safe browser simulation] No real process was affected.`, session, normalizedInput) : error("kill: usage: kill PID", session, normalizedInput);
  }

  if (command === "pacman") {
    return runPacman(args, session, needsRoot, normalizedInput);
  }

  if (command === "systemctl") {
    if (args[0] === "--failed") {
      return output("  UNIT LOAD   ACTIVE SUB    DESCRIPTION\n\n0 loaded units listed.", session, normalizedInput);
    }

    return output("● sshd.service - OpenSSH server\n   Loaded: loaded\n   Active: active (running)\n\n[safe browser simulation]", session, normalizedInput);
  }

  if (command === "journalctl") {
    return output("Jun 18 10:42:01 arch-practice systemd[1]: Startup finished in 1.2s.\nJun 18 10:42:02 arch-practice systemd[1]: Started Network Manager.", session, normalizedInput);
  }

  if (command === "which") {
    const target = args[0];
    const knownCommands = ["bash", "cat", "cd", "clear", "cp", "echo", "find", "grep", "gzip", "head", "journalctl", "ls", "man", "mkdir", "mv", "pacman", "printenv", "python", "rm", "rmdir", "sort", "systemctl", "tail", "tar", "touch", "uname", "wc", "whoami"];
    return target && knownCommands.includes(target) ? output(`/usr/bin/${target}`, session, normalizedInput) : output("", session, normalizedInput);
  }

  return error(`bash: ${command}: command not found in the safe browser shell`, session, normalizedInput);
}
