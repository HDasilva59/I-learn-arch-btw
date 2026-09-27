import {
  commandWords,
  parseShell,
  type CommandNode,
  type RedirectionOperator,
  type WordNode,
} from "./shell-ast";
import {
  identifyCommand,
  matchCommand as matchManPageCommand,
  resolveManPage,
  type CommandExplanationStep,
  type ManPage,
  type ManPageCatalog,
  type ResolvedCommand,
} from "./manpage-matcher";
import { analyzeShell, flattenAnalyses } from "./command-analyzer";
import { parseFindExpression, type FindExpression } from "./find-expression";

export type CommandGuide = ManPage;
export type { CommandExplanationStep } from "./manpage-matcher";

export type CommandExplanationLevel = {
  kind: "syntax" | "command" | "intent";
  label: string;
  summary: string;
  steps: readonly CommandExplanationStep[];
};

export type CommandExplanation =
  | {
      kind: "empty";
      input: string;
    }
  | {
      kind: "recognized";
      input: string;
      command: string;
      summary: string;
      plainEnglish: string;
      steps: readonly CommandExplanationStep[];
      levels: readonly CommandExplanationLevel[];
      note: string;
      risk: {
        label: string;
        message: string;
      };
    }
  | {
      kind: "unknown";
      input: string;
      command: string;
      plainEnglish?: string;
    };

type GuideCatalog = ManPageCatalog;
type GuideResolver = (tokens: readonly string[]) => string | undefined;

const COMMAND_NAMES: Readonly<Record<string, string>> = {
  alias: "a shell shortcut manager",
  awk: "a text-processing language",
  base64: "a Base64 encoder and decoder",
  basename: "a filename extractor",
  blkid: "a block-device attribute viewer",
  cat: "a file reader",
  cd: "the shell's directory changer",
  chmod: "a permission mode changer",
  chown: "an ownership changer",
  chgrp: "a group ownership changer",
  chrt: "a real-time scheduling policy tool",
  clear: "the terminal display clearer",
  comm: "a sorted-file comparer",
  command: "the shell command resolver",
  cp: "a file copier",
  curl: "a network transfer client",
  cut: "a column selector",
  date: "a date and time formatter",
  dd: "a raw data copier",
  df: "a filesystem space reporter",
  diff: "a file difference reporter",
  dirname: "a directory-name extractor",
  dmesg: "a kernel message viewer",
  depmod: "a kernel module dependency builder",
  du: "a directory space estimator",
  echo: "a text printer and file writer",
  env: "an environment viewer",
  export: "an environment variable exporter",
  exec: "a shell process replacer",
  file: "a file type detector",
  fdisk: "a partition-table editor",
  free: "a memory usage reporter",
  find: "a filesystem searcher",
  findfs: "a filesystem identifier resolver",
  findmnt: "a mounted-filesystem viewer",
  fstrim: "a filesystem discard tool",
  fsck: "a filesystem checker and repair tool",
  getconf: "a system-configuration viewer",
  getent: "a name-service database viewer",
  groups: "a group membership viewer",
  gzip: "a file compressor",
  grep: "a text searcher",
  head: "a file previewer",
  help: "the Bash builtin help viewer",
  history: "the shell history viewer",
  hostname: "a system name viewer",
  id: "a user and group identity viewer",
  install: "a file installer",
  ip: "the Linux network configuration tool",
  insmod: "a single kernel module loader",
  ionice: "an I/O scheduling policy tool",
  jobs: "the shell job viewer",
  join: "a sorted-file joiner",
  journalctl: "the system journal viewer",
  kill: "a process signal sender",
  last: "a login history viewer",
  less: "a paged file reader",
  ln: "a link creator",
  ls: "a directory lister",
  lsblk: "a block device lister",
  lscpu: "a CPU information viewer",
  lsmod: "a loaded-kernel-module viewer",
  lsns: "a Linux namespace viewer",
  logger: "a system-log message writer",
  man: "the local manual viewer",
  md5sum: "an MD5 checksum tool",
  mkdir: "a directory creator",
  mktemp: "a temporary file creator",
  modinfo: "a kernel module metadata viewer",
  modprobe: "a kernel module loader",
  mount: "a filesystem mounter",
  mv: "a file mover and renamer",
  nice: "a process priority wrapper",
  nl: "a line numberer",
  nohup: "a hangup-resistant command wrapper",
  nsenter: "a namespace entry tool",
  od: "a byte representation viewer",
  passwd: "a password manager",
  paste: "a column joiner",
  pacman: "the Arch Linux package manager",
  pgrep: "a process finder",
  pkill: "a process signal matcher",
  popd: "a directory stack popper",
  printenv: "an environment variable viewer",
  printf: "a formatted text printer",
  ps: "a process list viewer",
  pwd: "the current directory viewer",
  pushd: "a directory stack pusher",
  read: "a shell input reader",
  readlink: "a symbolic link reader",
  realpath: "a canonical path resolver",
  rm: "a file remover",
  rmdir: "an empty directory remover",
  renice: "a process priority changer",
  rsync: "a file synchronization tool",
  rmmod: "a kernel module remover",
  scp: "an SSH file copier",
  sed: "a stream text editor",
  seq: "a number sequence generator",
  sha256sum: "a SHA-256 checksum tool",
  shred: "a file overwrite tool",
  shuf: "a random line selector",
  sleep: "a delay command",
  split: "a file splitter",
  ss: "a socket viewer",
  sort: "a line sorter",
  source: "a shell file loader",
  stat: "a file metadata viewer",
  stty: "a terminal setting manager",
  su: "a user switcher",
  swapoff: "a swap deactivator",
  swapon: "a swap activator",
  sysctl: "a kernel runtime-parameter viewer",
  systemctl: "the systemd service manager",
  taskset: "a process CPU-affinity tool",
  tail: "a file ending previewer",
  tar: "an archive manager",
  tac: "a reverse line printer",
  tee: "a pipeline output splitter",
  test: "a shell condition tester",
  top: "a live process viewer",
  touch: "a file creator",
  tr: "a character translator",
  truncate: "a file size changer",
  type: "the shell command resolver",
  umask: "a new-file permission mask manager",
  umount: "a filesystem unmount tool",
  unshare: "a namespace creation tool",
  udevadm: "the Linux device-manager control tool",
  unalias: "a shell alias remover",
  uniq: "an adjacent duplicate filter",
  uname: "a system identity viewer",
  unset: "a shell variable remover",
  uptime: "a system uptime viewer",
  wget: "a web downloader",
  wc: "a file counter",
  which: "an executable locator",
  whoami: "the current user viewer",
  who: "a logged-in user viewer",
  xargs: "a command builder",
  yes: "a repeated output generator",
  partx: "a kernel partition-table updater",
  prlimit: "a process resource-limit tool",
  setpriv: "a process privilege configuration tool",
};

const DIRECT_GUIDES: Readonly<Record<string, string>> = {
  alias: "alias",
  cat: "cat",
  clear: "clear",
  env: "env",
  export: "export",
  history: "history",
  ls: "ls",
  mkdir: "mkdir",
  mv: "mv",
  ps: "ps",
  pwd: "pwd",
  rm: "rm",
  sort: "sort",
  top: "top",
  touch: "touch",
  type: "type",
  uname: "uname",
  wc: "wc",
  which: "which",
  whoami: "whoami",
};

const GUIDE_RESOLVERS: readonly GuideResolver[] = [
  (tokens) => matchCommand(tokens, "cd", "cd"),
  (tokens) => matchCommand(tokens, "echo", "echo"),
  (tokens) => matchCommand(tokens, "less", "less"),
  (tokens) => matchCommand(tokens, "man", "man"),
  (tokens) => matchCommand(tokens, "grep", "grep"),
  (tokens) => matchCommand(tokens, "head", "head"),
  (tokens) => matchCommand(tokens, "tail", "tail"),
  (tokens) => matchCommand(tokens, "find", tokens.includes("-type") ? "findType" : "findName"),
  (tokens) => matchCommand(tokens, "cp", "cp"),
  (tokens) => matchCommand(tokens, "chmod", "chmod"),
  (tokens) => matchCommand(tokens, "chown", "chown"),
  (tokens) => matchCommand(tokens, "gzip", "gzip"),
  (tokens) => matchCommand(tokens, "kill", "kill"),
  (tokens) => matchCommand(tokens, "printenv", "printenv"),
  (tokens) => matchCommand(tokens, "systemctl", systemctlGuide(tokens)),
  (tokens) => matchCommand(tokens, "journalctl", tokens[1] === "-b" ? "journalctlBoot" : undefined),
  (tokens) => matchCommand(tokens, "tar", resolveTarGuide(tokens)),
  (tokens) => matchCommand(tokens, "pacman", resolvePacmanGuide(tokens)),
];

const MUTATING_GUIDES = new Set([
  "alias",
  "chrt",
  "chgrp",
  "chmod",
  "chown",
  "cp",
  "echo",
  "export",
  "gzip",
  "install",
  "ln",
  "mkdir",
  "mktemp",
  "mount",
  "depmod",
  "fstrim",
  "fdisk",
  "insmod",
  "ionice",
  "logger",
  "modprobe",
  "mv",
  "nsenter",
  "passwd",
  "pacmanInstall",
  "pacmanRemove",
  "pacmanSyu",
  "pacmanUpgrade",
  "popd",
  "pushd",
  "rm",
  "rmdir",
  "renice",
  "rmmod",
  "sed",
  "setpriv",
  "set",
  "stty",
  "swapoff",
  "swapon",
  "sync",
  "sysctl",
  "taskset",
  "tee",
  "tarCreate",
  "touch",
  "truncate",
  "umask",
  "umount",
  "unalias",
  "unset",
  "udevadm",
  "unshare",
  "partx",
  "prlimit",
  "systemctlDaemonReload",
  "systemctlDisable",
  "systemctlEnable",
  "systemctlRestart",
  "systemctlStart",
  "systemctlStop",
  "tarAppend",
  "tarDelete",
  "tarExtract",
  "tarUpdate",
]);

const DANGEROUS_GUIDES = new Set(["chrt", "dd", "exec", "fdisk", "fsck", "fstrim", "insmod", "kill", "modprobe", "mount", "nsenter", "partx", "passwd", "pacmanRemove", "pacmanUpgrade", "pkill", "prlimit", "rm", "rmmod", "setpriv", "shred", "source", "swapoff", "sysctl", "systemctlDisable", "systemctlRestart", "systemctlStart", "systemctlStop", "tarDelete", "tarExtract", "taskset", "truncate", "udevadm", "umount", "unshare"]);

const EXTERNAL_GUIDES = new Set(["curl", "rsync", "scp", "ssh", "wget", "xargs"]);

const ARGUMENT_MEANINGS: Readonly<Record<string, string>> = {
  alias: "the name and shortcut to save in this shell",
  awk: "the program and input fields to process",
  basename: "the path and optional suffix to strip",
  blkid: "the block device whose filesystem tags should be printed",
  chgrp: "the new group and path to change",
  chrt: "the scheduling policy, priority, or process ID to inspect",
  cd: "the directory where the shell should move",
  chmod: "the permission mode and path to change",
  chown: "the new user, group, and path",
  comm: "the two sorted files to compare",
  cp: "the source path and destination path",
  curl: "the URL and optional request data",
  cut: "the fields, characters, or bytes to select",
  dirname: "the path whose directory name should be printed",
  diff: "the two files or directories to compare",
  depmod: "the kernel release whose module dependencies should be generated",
  file: "the path to identify",
  fdisk: "the block device whose partition table should be inspected",
  findType: "the starting path and entry type to keep",
  findName: "the starting path and search pattern",
  findfs: "the label, UUID, or partition tag to resolve",
  findmnt: "the device or mountpoint to inspect",
  fstrim: "the mounted filesystem whose unused blocks should be discarded",
  fsck: "the filesystem to check",
  getconf: "the configuration variable and optional pathname to query",
  getent: "the NSS database and optional key to query",
  grep: "the pattern and file whose contents will be read",
  groups: "the user whose group membership should be printed",
  hostname: "the name or hostname information to inspect",
  id: "the user whose identity should be printed",
  install: "the source file and destination path",
  insmod: "the kernel module file to insert",
  ip: "the network object and address or route arguments",
  ionice: "the process ID or command whose I/O priority should change",
  jobs: "the shell job identifier to inspect",
  echo: "the text to print or write",
  last: "the user or terminal whose login records should be shown",
  head: "the line count and file to read",
  journalctlBoot: "the boot filter to inspect",
  kill: "the process ID that receives the signal",
  less: "the file to read",
  ln: "the target and new link name",
  man: "the command whose manual page will open",
  mkdir: "the directory to create",
  mktemp: "the filename template or temporary directory",
  modinfo: "the kernel module whose metadata should be printed",
  modprobe: "the kernel module to load or remove",
  mount: "the device and directory to connect",
  mv: "the source path and new path",
  nice: "the command whose scheduling priority should change",
  nl: "the file whose lines should be numbered",
  nohup: "the command that should survive terminal hangup",
  nsenter: "the target process ID and namespaces to enter",
  passwd: "the account whose password status should change",
  paste: "the files whose lines should be joined",
  pacmanInstall: "the package to install",
  pacmanQueryInfo: "the installed package to inspect",
  pacmanQuerySearch: "the term to search among installed packages",
  pacmanRemove: "the package to remove",
  pacmanSearchRepo: "the term to search in repositories",
  pgrep: "the process name or pattern to find",
  pkill: "the process pattern that receives the signal",
  printf: "the format string and values to print",
  printenv: "the environment variable to read",
  pushd: "the directory to push onto the shell stack",
  read: "the shell variables that receive input",
  readlink: "the symbolic link or path to resolve",
  realpath: "the path to canonicalize",
  renice: "the process, process group, or user whose priority should change",
  rm: "the path to remove",
  rmdir: "the empty directory to remove",
  rmmod: "the kernel module to remove",
  rsync: "the source and destination paths to synchronize",
  scp: "the local or remote source and destination paths",
  sed: "the editing script and input file",
  seq: "the first, increment, and last numbers",
  setpriv: "the program whose privilege context should change",
  shred: "the file to overwrite or remove",
  split: "the input file and output prefix",
  ss: "the socket filters to inspect",
  sort: "the file whose lines will be sorted",
  source: "the shell file to read and execute",
  stat: "the path whose metadata should be printed",
  su: "the account and optional command to run as that user",
  swapoff: "the swap device or file to disable",
  swapon: "the swap device or file to enable",
  sysctl: "the kernel parameter or configuration file to inspect",
  systemctlStatus: "the service to inspect",
  systemctlStart: "the service to start",
  systemctlStop: "the service to stop",
  systemctlRestart: "the service to restart",
  systemctlEnable: "the service to enable at startup",
  systemctlDisable: "the service to disable at startup",
  taskset: "the CPU mask or process whose affinity should change",
  tac: "the input file whose records should be reversed",
  tail: "the line count and file to read",
  tarCreate: "the archive name and files to store in it",
  tar: "the archive operation and its archive filename",
  tarAppend: "the archive name and files to append",
  tarDelete: "the uncompressed archive and members to remove",
  tarDiff: "the archive and filesystem members to compare",
  tarExtract: "the archive and optional members to extract",
  tarList: "the archive name to inspect",
  tarUpdate: "the archive name and files to update",
  tee: "the output files that should receive a copy",
  test: "the file, string, or numeric condition to evaluate",
  touch: "the file to create or timestamp to update",
  tr: "the character sets to translate or delete",
  truncate: "the file and target size to apply",
  type: "the command name to resolve",
  umask: "the permission mask to show or set",
  umount: "the device or directory to detach",
  unshare: "the namespaces and program to isolate",
  udevadm: "the device path or udev subcommand to inspect",
  uniq: "the input whose adjacent duplicates should be filtered",
  unset: "the variable or function name to remove",
  uptime: "the uptime format or display mode",
  wget: "the URL and download destination",
  wc: "the file to measure",
  which: "the executable name to locate",
  who: "the login record or output mode to inspect",
  xargs: "the input items and command to construct",
  partx: "the block device and partition numbers to update",
  prlimit: "the process and resource limits to inspect or set",
};

function normalize(input: string): string {
  let normalized = "";
  let quote: '"' | "'" | null = null;
  let pendingSpace = false;

  for (const character of input.trim()) {
    if (quote) {
      normalized += character;

      if (character === quote) {
        quote = null;
      }

      continue;
    }

    if (character === '"' || character === "'") {
      if (pendingSpace && normalized) {
        normalized += " ";
      }

      pendingSpace = false;
      quote = character;
      normalized += character;
    } else if (/\s/.test(character)) {
      pendingSpace = true;
    } else {
      if (pendingSpace && normalized) {
        normalized += " ";
      }

      pendingSpace = false;
      normalized += character;
    }
  }

  return normalized;
}

function matchCommand(tokens: readonly string[], command: string, guideId: string | undefined): string | undefined {
  return tokens[0] === command ? guideId : undefined;
}

const TAR_OLD_OPTION_LETTERS = "AacCdDfFgGijJkKlLmMNOopPrRsStTuvwWxXzZ";

function isTarOldStyleOptions(token: string | undefined): boolean {
  return Boolean(token && /^[A-Za-z]+$/.test(token) && [...token].every((letter) => TAR_OLD_OPTION_LETTERS.includes(letter)));
}

function hasTarOption(tokens: readonly string[], shortOption: string, longOption: string): boolean {
  const shortLetter = shortOption.slice(1);

  return tokens.slice(1).some((token, index) => {
    if (token === shortOption || token === longOption || token.startsWith(`${longOption}=`)) {
      return true;
    }

    if (token.startsWith("-") && !token.startsWith("--")) {
      return token.slice(1).includes(shortLetter);
    }

    return index === 0 && isTarOldStyleOptions(token) && token.includes(shortLetter);
  });
}

function resolveTarGuide(tokens: readonly string[]): string {
  if (hasTarOption(tokens, "-x", "--extract")) {
    return "tarExtract";
  }

  if (hasTarOption(tokens, "-c", "--create")) {
    return "tarCreate";
  }

  if (hasTarOption(tokens, "-t", "--list")) {
    return "tarList";
  }

  if (hasTarOption(tokens, "-r", "--append")) {
    return "tarAppend";
  }

  if (hasTarOption(tokens, "-u", "--update")) {
    return "tarUpdate";
  }

  if (hasTarOption(tokens, "-d", "--diff") || hasTarOption(tokens, "-d", "--compare")) {
    return "tarDiff";
  }

  if (tokens.slice(1).some((token) => token === "--delete" || token.startsWith("--delete="))) {
    return "tarDelete";
  }

  return "tar";
}

function resolvePacmanGuide(tokens: readonly string[]): string | undefined {
  const options = tokens.slice(1).filter((token) => /^-[A-Za-z]+$/.test(token));
  const optionString = options.join("");

  if (optionString === "-Syu" || optionString === "-Syyu") {
    return "pacmanSyu";
  }

  if (optionString === "-Ss") {
    return "pacmanSearchRepo";
  }

  if (optionString === "-S") {
    return "pacmanInstall";
  }

  if (optionString === "-Q") {
    return "pacmanQuery";
  }

  if (optionString === "-Qs") {
    return "pacmanQuerySearch";
  }

  if (optionString === "-Qi") {
    return "pacmanQueryInfo";
  }

  if (optionString === "-Ql") {
    return "pacmanQueryFiles";
  }

  if (optionString === "-Qdtq") {
    return "pacmanOrphansQuiet";
  }

  if (optionString === "-Qdt") {
    return "pacmanOrphans";
  }

  if (optionString === "-Rns") {
    return "pacmanRemove";
  }

  if (optionString === "-U") {
    return "pacmanUpgrade";
  }

  if (optionString === "-F" || optionString === "-Fy" || optionString === "-Fl" || optionString === "-Fx") {
    return "pacmanFiles";
  }

  if (optionString === "-T") {
    return "pacmanDeptest";
  }

  if (optionString === "-h") {
    return "pacmanHelp";
  }

  if (optionString === "-V") {
    return "pacmanVersion";
  }

  return undefined;
}

function systemctlGuide(tokens: readonly string[]): string | undefined {
  switch (tokens[1]) {
    case "--failed":
      return "systemctlFailed";
    case "status":
      return "systemctlStatus";
    case "start":
      return "systemctlStart";
    case "stop":
      return "systemctlStop";
    case "restart":
      return "systemctlRestart";
    case "enable":
      return "systemctlEnable";
    case "disable":
      return "systemctlDisable";
    case "daemon-reload":
      return "systemctlDaemonReload";
    default:
      return undefined;
  }
}

function resolveGuide(tokens: readonly string[], guides: GuideCatalog): string | undefined {
  const commandName = tokens[0] ?? "";

  for (const resolver of GUIDE_RESOLVERS) {
    const guideId = resolver(tokens);

    if (guideId && guides[guideId]) {
      return guideId;
    }
  }

  const directGuideId = DIRECT_GUIDES[commandName] ?? commandName;

  if (directGuideId && guides[directGuideId]) {
    return directGuideId;
  }

  return undefined;
}

function stripQuotes(token: string): string {
  return token.length > 1 && ((token.startsWith("'") && token.endsWith("'")) || (token.startsWith('"') && token.endsWith('"')))
    ? token.slice(1, -1)
    : token;
}

function listWithAnd(items: readonly string[]): string {
  if (items.length <= 1) {
    return items[0] ?? "";
  }

  if (items.length === 2) {
    return `${items[0]} and ${items[1]}`;
  }

  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

type ProcessSubstitutionWord = Extract<WordNode, { kind: "process-substitution" }>;

function nestedCommandWords(word: ProcessSubstitutionWord): readonly WordNode[] {
  const firstPipeline = word.body.pipelines[0];
  return firstPipeline?.commands[0] ? commandWords(firstPipeline.commands[0]) : [];
}

function isSimpleSortWord(word: ProcessSubstitutionWord): boolean {
  return word.body.pipelines.length === 1
    && word.body.pipelines[0].commands.length === 1
    && word.body.pipelines[0].operators.length === 0
    && nestedCommandWords(word)[0]?.raw === "sort";
}

function sortSourceFromWord(word: ProcessSubstitutionWord): string | undefined {
  return nestedCommandWords(word)
    .slice(1)
    .map((part) => part.raw)
    .findLast((part) => !part.startsWith("-"));
}

function processSubstitutionInputDescriptionFromWord(word: ProcessSubstitutionWord): string {
  if (isSimpleSortWord(word)) {
    const source = sortSourceFromWord(word);
    return source ? `the sorted output of ${stripQuotes(source)}` : "the sorted output";
  }

  const hasInnerPipeline = word.body.pipelines.some((pipeline) => pipeline.commands.length > 1);

  if (hasInnerPipeline) {
    return "the output of the inner pipeline";
  }

  const command = nestedCommandWords(word)[0]?.raw;
  return command ? `the output of ${command}` : "the output of the inner command";
}

function processSubstitutionMeaningFromWord(word: ProcessSubstitutionWord): string {
  if (isSimpleSortWord(word)) {
    const source = sortSourceFromWord(word);
    return source
      ? `sorts ${stripQuotes(source)} and exposes the result as a temporary input`
      : "sorts its input and exposes the result as a temporary input";
  }

  const hasInnerPipeline = word.body.pipelines.some((pipeline) => pipeline.commands.length > 1);

  if (hasInnerPipeline) {
    return "runs the inner pipeline and exposes its output as a temporary input";
  }

  const command = nestedCommandWords(word)[0]?.raw;
  const description = command ? COMMAND_NAMES[command] ?? "a shell command or program" : "an inner command";
  return `runs ${description} and exposes its output as a temporary input`;
}

function commOptionMeaning(token: string): string | undefined {
  if (!/^-[123]{2,3}$/.test(token)) {
    return undefined;
  }

  const hiddenColumns = [...new Set(token.slice(1))];
  const visibleColumns = ["1", "2", "3"].filter((column) => !hiddenColumns.includes(column));

  if (visibleColumns.length === 1) {
    const visibleMeaning = visibleColumns[0] === "1"
      ? "lines unique to the first input"
      : visibleColumns[0] === "2"
        ? "lines unique to the second input"
        : "lines common to both inputs";

    return `hides columns ${hiddenColumns.join(" and ")}, leaving only ${visibleMeaning}.`;
  }

  return `hides columns ${hiddenColumns.join(" and ")}.`;
}

function redirectionMeaning(operator: RedirectionOperator): string {
  switch (operator) {
    case ">":
      return "writes standard output to the target, replacing its contents";
    case ">>":
      return "appends standard output to the target";
    case "<":
      return "reads standard input from the target";
    case "2>":
      return "writes error output to the target, replacing its contents";
    case "2>>":
      return "appends error output to the target";
    case "2>&":
      return "duplicates the target file descriptor for error output";
    case "&>":
      return "writes standard output and error output to the target, replacing its contents";
    case "&>>":
      return "appends standard output and error output to the target";
    case ">&":
      return "duplicates the target file descriptor for standard output";
    case "<<<":
      return "passes the target string to standard input";
    case "<&":
      return "duplicates the target file descriptor for standard input";
    default: {
      const _exhaustive: never = operator;
      return _exhaustive;
    }
  }
}

function riskFor(guideId: string): { label: string; message: string } {
  if (DANGEROUS_GUIDES.has(guideId)) {
    return {
      label: "Check before running",
      message: "This can stop a process, delete data, or remove packages. Check every path, PID, or package name.",
    };
  }

  if (EXTERNAL_GUIDES.has(guideId)) {
    return {
      label: "Can affect another system",
      message: "This command can contact a remote host, transfer data, or execute generated arguments. Check the destination and input first.",
    };
  }

  if (MUTATING_GUIDES.has(guideId)) {
    return {
      label: "Changes system state",
      message: "This command does more than read. Check the target and requested permissions before confirming.",
    };
  }

  return {
    label: "Read-only in principle",
    message: "It observes or prints information. The result can still depend on the current user and system.",
  };
}

type ParsedStage = {
  input: string;
  node: CommandNode;
  resolved: ResolvedCommand;
  tokens: readonly string[];
  command: string;
  guideId: string | undefined;
  guide: CommandGuide | undefined;
};

function parseStage(node: CommandNode, guides: GuideCatalog): ParsedStage {
  const words = commandWords(node).map((word) => word.raw);
  const commandTokens = words[0] === "sudo" ? words.slice(1) : words;
  const identification = resolveManPage(
    identifyCommand(node),
    guides,
    (resolvedWords) => resolveGuide(resolvedWords, guides),
  );

  return {
    input: node.raw,
    node,
    resolved: identification,
    tokens: words,
    command: identification.name || commandTokens[0] || node.raw,
    guideId: identification.guideId,
    guide: identification.manPage,
  };
}

function findCommandSteps(stage: ParsedStage, guides: GuideCatalog): readonly CommandExplanationStep[] | undefined {
  const expression = findExpressionFor(stage);

  if (!expression) {
    return undefined;
  }

  const steps: CommandExplanationStep[] = [{ token: "find", explanation: "searches a directory tree" }];

  for (const root of expression.roots) {
    steps.push({ token: stripQuotes(root.raw), explanation: "the starting path for the search" });
  }

  for (const clause of expression.clauses) {
    if (clause.kind === "type") {
      const type = clause.value.kind === "word" ? clause.value.raw : "entry";
      const meaning = type === "f" ? "keeps regular files" : type === "d" ? "keeps directories" : `keeps ${type} filesystem entries`;
      steps.push({ token: `-type ${stripQuotes(clause.value.raw)}`, explanation: meaning });
      continue;
    }

    if (clause.kind === "name") {
      steps.push({ token: clause.operator, explanation: clause.operator === "-iname" ? "matches the filename against a case-insensitive pattern" : "matches the filename against a pattern" });
      steps.push({ token: stripQuotes(clause.pattern.raw), explanation: "the filename pattern to match" });
      continue;
    }

    if (clause.kind === "exec") {
      steps.push({ token: "-exec", explanation: "runs a nested command for each matched path" });
      const nestedStage = parseStage(clause.command, guides);
      const nestedGrep = grepExecDetails(clause.command);
      const nestedSteps = stepsFor(nestedStage, guides).map((step, index) => {
        if (index === 0) {
          return { ...step, explanation: `runs this command for each matched path` };
        }

        if (step.token === "{}") {
          return { ...step, explanation: "the matched path inserted into the nested command" };
        }

        if (nestedGrep && step.token === nestedGrep.pattern) {
          return { ...step, explanation: "the text to search for in each matched file" };
        }

        return step;
      });
      steps.push(...nestedSteps);
      steps.push({ token: clause.terminator === ";" ? "\\;" : "+", explanation: "ends the per-match command" });
      continue;
    }

    steps.push({
      token: [clause.operator, ...clause.arguments.map((argument) => stripQuotes(argument.raw))].join(" "),
      explanation: "a find expression predicate",
    });
  }

  for (const redirection of expression.redirections) {
    steps.push({ token: redirection.raw, explanation: redirectionMeaning(redirection.operator) });
  }

  return steps;
}

function stepsFor(stage: ParsedStage, guides: GuideCatalog): readonly CommandExplanationStep[] {
  if (!stage.guideId || !stage.guide) {
    return [{ token: stage.command, explanation: `runs ${COMMAND_NAMES[stage.command] ?? "a command"}` }];
  }

  if (stage.command === "find") {
    return findCommandSteps(stage, guides) ?? [];
  }

  return matchManPageCommand(
    stage.resolved,
    {
      commandDescription: (command) => COMMAND_NAMES[command] ?? "a shell command or program",
      argumentMeaning: ARGUMENT_MEANINGS[stage.guideId] ?? "the value or path passed to the command",
      optionMeaning: (token) => stage.command === "comm" ? commOptionMeaning(token) : undefined,
      redirectionMeaning,
      processSubstitutionMeaning: (word) => processSubstitutionMeaningFromWord(word),
      isOldStyleOption: (token, wordIndex) => stage.command === "tar" && wordIndex === 0 && isTarOldStyleOptions(token),
    },
  );
}

function lowerFirst(value: string): string {
  const sentence = value.trim().replace(/[.]$/, "");
  return sentence ? `${sentence[0].toLowerCase()}${sentence.slice(1)}` : sentence;
}

function hasShortOption(tokens: readonly string[], letter: string): boolean {
  return tokens.some((token) => token === `-${letter}` || (/^-[A-Za-z0-9]+$/.test(token) && token.slice(1).includes(letter)));
}

function argumentAfter(tokens: readonly string[], option: string): string | undefined {
  const optionIndex = tokens.findIndex((token) => token === option);
  return optionIndex >= 0 ? tokens[optionIndex + 1] : undefined;
}

type StageActionResolver = (stage: ParsedStage, nextStage: ParsedStage | undefined) => string;

function firstPlainArgument(tokens: readonly string[]): string | undefined {
  return tokens.slice(1).find((token) => !token.startsWith("-") && !token.startsWith("<(") && token !== "|");
}

function findExpressionFor(stage: ParsedStage): FindExpression | undefined {
  const parsed = parseFindExpression(stage.node);
  return parsed.kind === "parsed" ? parsed.expression : undefined;
}

function findPatternDescription(pattern: string): string {
  const value = stripQuotes(pattern);

  return value.startsWith("*.") ? `${value.slice(1)} files` : `paths matching ${value}`;
}

function findAction(stage: ParsedStage): string {
  const expression = findExpressionFor(stage);

  if (!expression) {
    return "searches a directory tree";
  }

  const location = pathDescription(expression.roots[0]?.raw);
  const typeClause = expression.clauses.find((clause) => clause.kind === "type");
  const nameClause = expression.clauses.find((clause) => clause.kind === "name");
  const execClause = expression.clauses.find((clause) => clause.kind === "exec");
  const type = typeClause?.kind === "type" && typeClause.value.kind === "word"
    ? typeClause.value.raw === "f" ? "regular files" : typeClause.value.raw === "d" ? "directories" : "matching paths"
    : "matching paths";
  const target = nameClause?.kind === "name" && nameClause.pattern.kind === "word"
    ? findPatternDescription(nameClause.pattern.raw)
    : type;
  const grepCommand = execClause?.kind === "exec" ? commandWords(execClause.command).map((word) => word.raw) : [];
  const grepPattern = grepCommand.slice(1).find((token) => !token.startsWith("-") && token !== "{}")
    ?? "the matching pattern";

  return execClause?.kind === "exec" && grepCommand[0] === "grep"
    ? `searches ${location} for ${target}, then searches each matching file for lines containing ${stripQuotes(grepPattern)}`
    : `searches ${location} for ${target}`;
}

function wcAction(tokens: readonly string[]): string {
  const units = new Set<string>();
  const optionTokens = tokens.filter((token) => /^-[lwmc]+$/.test(token));

  for (const option of optionTokens) {
    for (const letter of option.slice(1)) {
      units.add(letter === "l" ? "lines" : letter === "w" ? "words" : letter === "m" ? "characters" : "bytes");
    }
  }

  const selectedUnits = [...units];

  return selectedUnits.length > 0
    ? `counts ${listWithAnd(selectedUnits)}`
    : "counts lines, words, and bytes";
}

const STAGE_ACTION_RESOLVERS: Readonly<Record<string, StageActionResolver>> = {
  cat: () => "prints its input",
  cut: (stage) => hasShortOption(stage.tokens, "f") ? "selects fields from each input line" : "selects characters or bytes from each input line",
  diff: (stage) => hasShortOption(stage.tokens, "q") ? "reports whether the inputs differ" : "shows line-by-line differences between the inputs",
  du: (stage) => {
    const target = firstPlainArgument(stage.tokens);
    const location = target ? ` under ${stripQuotes(target) === "." ? "the current directory" : stripQuotes(target)}` : "under the current directory";
    const subject = hasShortOption(stage.tokens, "a") ? "files and directories" : "directories";
    return `estimates disk space used by ${subject}${location}`;
  },
  find: findAction,
  grep: (stage) => {
    const pattern = firstPlainArgument(stage.tokens);

    return pattern ? `searches for lines matching ${stripQuotes(pattern)}` : "searches for matching lines";
  },
  head: (stage) => {
    const shortCount = stage.tokens.find((token) => /^-\d+$/.test(token));
    const longCount = stage.tokens.find((token) => token.startsWith("--lines="))?.split("=", 2)[1];
    const optionCount = argumentAfter(stage.tokens, "-n") ?? argumentAfter(stage.tokens, "--lines");
    const count = shortCount?.slice(1) ?? longCount ?? optionCount ?? "10";

    return `keeps the first ${count} lines`;
  },
  join: () => "joins matching lines from two sorted inputs using a shared field",
  paste: () => "joins corresponding lines side by side",
  sed: () => "transforms or filters text one line at a time",
  sort: (stage) => {
    const numeric = hasShortOption(stage.tokens, "n");
    const reverse = hasShortOption(stage.tokens, "r");
    const humanReadable = hasShortOption(stage.tokens, "h");

    if (humanReadable && reverse) {
      return "sorts human-readable sizes from largest to smallest";
    }

    if (numeric && reverse) {
      return "sorts the results numerically from largest to smallest";
    }

    if (numeric) {
      return "sorts the results numerically";
    }

    if (reverse) {
      return "sorts the results in reverse order";
    }

    return "sorts the results";
  },
  stat: (stage) => {
    const format = stage.tokens.find((token) => token.startsWith("--printf=")) ?? argumentAfter(stage.tokens, "--printf");

    return format?.includes("%s") && format.includes("%n") ? "prints each file's size and name" : "prints file metadata";
  },
  tac: () => "prints input lines in reverse order",
  tail: (stage) => {
    const shortCount = stage.tokens.find((token) => /^-\d+$/.test(token));
    const longCount = stage.tokens.find((token) => token.startsWith("--lines="))?.split("=", 2)[1];
    const optionCount = argumentAfter(stage.tokens, "-n") ?? argumentAfter(stage.tokens, "--lines");
    const count = shortCount?.slice(1) ?? longCount ?? optionCount ?? "10";

    return `keeps the last ${count} lines`;
  },
  tee: (stage) => hasShortOption(stage.tokens, "a") ? "copies input to the terminal and appends it to files" : "copies input to the terminal and files",
  tr: (stage) => hasShortOption(stage.tokens, "d") ? "deletes selected characters" : hasShortOption(stage.tokens, "s") ? "squeezes repeated characters" : "translates characters",
  uniq: (stage) => hasShortOption(stage.tokens, "c") ? "counts adjacent repeated lines" : hasShortOption(stage.tokens, "d") ? "prints only repeated lines" : hasShortOption(stage.tokens, "u") ? "prints only unique lines" : "filters adjacent repeated lines",
  wc: (stage) => wcAction(stage.tokens),
  xargs: (stage, nextStage) => {
    const targetCommandName = stage.tokens.slice(1).find((token) => COMMAND_NAMES[token]) ?? stage.tokens.slice(1).find((token) => !token.startsWith("-") && !/^\d+$/.test(token));
    const targetCommand = targetCommandName ? ` for ${targetCommandName}` : nextStage?.command ? ` for ${nextStage.command}` : " into command arguments";

    return `turns incoming items into arguments${targetCommand}`;
  },
};

function stageAction(stage: ParsedStage, nextStage: ParsedStage | undefined): string {
  const resolvedAction = STAGE_ACTION_RESOLVERS[stage.command]?.(stage, nextStage);
  const action = resolvedAction ?? (stage.guide ? lowerFirst(stage.guide.purpose) : `runs ${COMMAND_NAMES[stage.command] ?? "a command"}`);
  const processInputs = stage.node.parts
    .flatMap((part) => part.kind === "redirection" ? [part.target] : [part])
    .filter((word): word is ProcessSubstitutionWord => word.kind === "process-substitution")
    .map(processSubstitutionInputDescriptionFromWord);

  return processInputs.length > 0 ? `${action} using ${listWithAnd(processInputs)}` : action;
}

type PipelineIntentResolver = (
  stages: readonly ParsedStage[],
  separators: readonly string[],
) => string | undefined;

function pathDescription(token: string | undefined): string {
  if (!token || stripQuotes(token) === ".") {
    return "the current directory";
  }

  return stripQuotes(token);
}

function headCount(stage: ParsedStage): string {
  const shortCount = stage.tokens.find((token) => /^-\d+$/.test(token));
  const longCount = stage.tokens.find((token) => token.startsWith("--lines="))?.split("=", 2)[1];
  return shortCount?.slice(1) ?? longCount ?? argumentAfter(stage.tokens, "-n") ?? argumentAfter(stage.tokens, "--lines") ?? "10";
}

function grepExecDetails(command: CommandNode): { pattern: string; qualifiers: readonly string[] } | undefined {
  const tokens = commandWords(command).map((word) => word.raw);

  if (tokens[0] !== "grep") {
    return undefined;
  }

  const pattern = tokens.slice(1).find((token) => !token.startsWith("-") && token !== "{}");

  if (!pattern) {
    return undefined;
  }

  const qualifiers = [
    ...(hasShortOption(tokens, "i") ? ["case-insensitively"] : []),
    ...(hasShortOption(tokens, "H") ? ["with filenames"] : []),
    ...(hasShortOption(tokens, "n") ? ["with line numbers"] : []),
  ];

  return { pattern: stripQuotes(pattern), qualifiers };
}

const PIPELINE_INTENT_RESOLVERS: readonly PipelineIntentResolver[] = [
  (stages, separators) => {
    if (separators.some((separator) => separator !== "|") || stages.length !== 2) {
      return undefined;
    }

    const [findStage, headStage] = stages;

    if (findStage.command !== "find" || headStage.command !== "head") {
      return undefined;
    }

    const expression = findExpressionFor(findStage);
    const execClause = expression?.clauses.find((clause) => clause.kind === "exec");
    const details = execClause?.kind === "exec" ? grepExecDetails(execClause.command) : undefined;

    if (!expression || !execClause || execClause.kind !== "exec" || !details) {
      return undefined;
    }

    const root = pathDescription(expression.roots[0]?.raw);
    const nameClause = expression.clauses.find((clause) => clause.kind === "name");
    const typeClause = expression.clauses.find((clause) => clause.kind === "type");
    const type = typeClause?.kind === "type" && typeClause.value.kind === "word"
      ? typeClause.value.raw === "f" ? "regular files" : typeClause.value.raw === "d" ? "directories" : "matching paths"
      : "matching paths";
    const target = nameClause?.kind === "name" && nameClause.pattern.kind === "word"
      ? findPatternDescription(nameClause.pattern.raw)
      : type;
    const qualifiers = details.qualifiers.length > 0 ? ` (${listWithAnd(details.qualifiers)})` : "";
    const hidesErrors = expression.redirections.some((redirection) =>
      redirection.operator === "2>" && stripQuotes(redirection.target.raw) === "/dev/null",
    );
    const actions = [
      `find lines containing "${details.pattern}" inside them${qualifiers}`,
      ...(hidesErrors ? ["hide permission/error messages"] : []),
      `show only the first ${headCount(headStage)} matches`,
    ];

    return `Search ${root} for ${target}, ${actions.join(", ")}.`;
  },
  (stages, separators) => {
    if (separators.some((separator) => separator !== "|") || stages.length !== 3) {
      return undefined;
    }

    const [duStage, sortStage, headStage] = stages;

    if (duStage.command !== "du" || sortStage.command !== "sort" || headStage.command !== "head") {
      return undefined;
    }

    const reverse = hasShortOption(sortStage.tokens, "r");
    const humanReadable = hasShortOption(sortStage.tokens, "h");

    if (!reverse || !humanReadable) {
      return undefined;
    }

    const count = headCount(headStage);
    const subject = hasShortOption(duStage.tokens, "a") ? "files and directories" : "directories";
    const location = pathDescription(firstPlainArgument(duStage.tokens));

    return `Find the ${count} largest ${subject} under ${location}.`;
  },
  (stages, separators) => {
    if (separators.some((separator) => separator !== "|") || stages.length !== 2) {
      return undefined;
    }

    const [sortStage, headStage] = stages;

    if (sortStage.command !== "sort" || headStage.command !== "head" || !hasShortOption(sortStage.tokens, "r")) {
      return undefined;
    }

    return `Keep the first ${headCount(headStage)} entries after sorting them from largest to smallest.`;
  },
  (stages, separators) => {
    if (separators.some((separator) => separator !== "|") || stages.length !== 2) {
      return undefined;
    }

    const [grepStage, wcStage] = stages;

    return grepStage.command === "grep" && wcStage.command === "wc" && hasShortOption(wcStage.tokens, "l")
      ? "Count the lines that match the search pattern."
      : undefined;
  },
];

function pipelineIntent(stages: readonly ParsedStage[], separators: readonly string[]): string | undefined {
  return PIPELINE_INTENT_RESOLVERS
    .map((resolver) => resolver(stages, separators))
    .find((intent): intent is string => Boolean(intent));
}

function syntaxSteps(stages: readonly ParsedStage[], separators: readonly string[]): readonly CommandExplanationStep[] {
  return stages.flatMap((stage, index) => [
    ...(index > 0 ? [{
      token: separators[index - 1] ?? "|",
      explanation: separatorMeaning(separators[index - 1] ?? "|", stage.command),
    }] : []),
    ...stage.node.parts.flatMap((part) => {
      if (part.kind === "redirection") {
        return [{
          token: part.raw,
          explanation: redirectionMeaning(part.operator),
        }];
      }

      return part.kind === "process-substitution"
        ? [{ token: part.raw, explanation: processSubstitutionMeaningFromWord(part) }]
        : [];
    }),
  ]);
}

function commandLevelSteps(
  stages: readonly ParsedStage[],
  separators: readonly string[],
  syntax: readonly CommandExplanationStep[],
  guides: GuideCatalog,
): readonly CommandExplanationStep[] {
  const syntaxTokens = new Set(syntax.map((step) => step.token));
  return pipelineSteps(stages, separators, guides).filter((step) =>
    !syntaxTokens.has(step.token) && !/^(?:\d+)?(?:>|<)|^&>/.test(step.token),
  );
}

function explanationLevels(
  stages: readonly ParsedStage[],
  separators: readonly string[],
  plainEnglish: string,
  guides: GuideCatalog,
): readonly CommandExplanationLevel[] {
  const syntax = syntaxSteps(stages, separators);

  return [
    {
      kind: "syntax",
      label: "Syntax",
      summary: syntax.length > 0 ? "How the shell connects, redirects, and supplies data." : "No shell-level operators or redirections were found.",
      steps: syntax,
    },
    {
      kind: "command",
      label: "Command",
      summary: "What each command and option contributes.",
      steps: commandLevelSteps(stages, separators, syntax, guides),
    },
    {
      kind: "intent",
      label: "Intent",
      summary: plainEnglish,
      steps: [],
    },
  ];
}

function pipelineSentence(stages: readonly ParsedStage[], separators: readonly string[]): string {
  const actions = stages.map((stage, index) => stageAction(stage, stages[index + 1]));

  if (actions.length === 1) {
    return sentenceFromAction(actions[0]);
  }

  const clauses = actions.slice(1).map((action, index) => {
    const separator = separators[index] ?? "|";

    switch (separator) {
      case "&&":
        return `only if that succeeds, it ${action}`;
      case "||":
        return `if that fails, it ${action}`;
      case ";":
        return `then it ${action}`;
      default:
        return `then it ${action}`;
    }
  });

  return `It ${actions[0]}, ${clauses.join(", ")}.`;
}

function sentenceFromAction(action: string): string {
  return `${action.charAt(0).toUpperCase()}${action.slice(1)}.`;
}

function pipelineSteps(stages: readonly ParsedStage[], separators: readonly string[], guides: GuideCatalog): readonly CommandExplanationStep[] {
  return stages.flatMap((stage, index) => [
    ...(index > 0 ? [{
      token: separators[index - 1] ?? "|",
      explanation: separatorMeaning(separators[index - 1] ?? "|", stage.command),
    }] : []),
    ...stepsFor(stage, guides),
  ]);
}

function commandExpression(stages: readonly ParsedStage[], separators: readonly string[]): string {
  return stages.reduce((expression, stage, index) => {
    if (index === 0) {
      return stage.command;
    }

    return `${expression} ${separators[index - 1] ?? "|"} ${stage.command}`;
  }, "");
}

function shellOperatorNote(separators: readonly string[]): string {
  const hasPipe = separators.some((separator) => separator === "|" || separator === "|&");
  const hasConditional = separators.some((separator) => separator === "&&" || separator === "||" || separator === ";");

  if (hasPipe && hasConditional) {
    return "The shell combines pipes and conditional operators to control how output and exit status flow between stages.";
  }

  if (hasConditional) {
    return "The shell operators control whether the next command runs based on the previous command's exit status.";
  }

  return "The pipe passes each stage's standard output into the next command.";
}

function separatorMeaning(separator: string, nextCommand: string): string {
  switch (separator) {
    case "|":
      return `passes the previous stage's standard output into ${nextCommand}`;
    case "|&":
      return `passes the previous stage's output and errors into ${nextCommand}`;
    case "&&":
      return `runs ${nextCommand} only if the previous command succeeds`;
    case "||":
      return `runs ${nextCommand} only if the previous command fails`;
    case ";":
      return `runs ${nextCommand} after the previous command`;
    default:
      return `connects the previous command to ${nextCommand}`;
  }
}

function commInputWords(stage: ParsedStage): readonly WordNode[] {
  const words = commandWords(stage.node);
  const commandIndex = words[0]?.raw === "sudo" ? 2 : 1;

  return words.slice(commandIndex).filter((word) => !word.raw.startsWith("-"));
}

function commInputLabel(word: WordNode, index: number): string {
  if (word.kind === "process-substitution") {
    const source = sortSourceFromWord(word);

    return source ? stripQuotes(source) : `input ${index + 1}`;
  }

  return stripQuotes(word.raw);
}

function commPlainEnglish(stage: ParsedStage): string {
  const inputWords = commInputWords(stage).slice(0, 2);
  const inputs = inputWords.map(commInputLabel);
  const firstInput = inputs[0] ?? "the first input";
  const secondInput = inputs[1] ?? "the second input";
  const sortedProcessSubstitutions = inputWords.length === 2
    && inputWords.every((word): word is ProcessSubstitutionWord => word.kind === "process-substitution" && isSimpleSortWord(word));
  const sortedSuffix = sortedProcessSubstitutions ? ", sorting both files first" : "";

  if (hasShortOption(stage.tokens, "2") && hasShortOption(stage.tokens, "3") && !hasShortOption(stage.tokens, "1")) {
    return `Print lines that exist in ${firstInput} but not in ${secondInput}${sortedSuffix}.`;
  }

  if (hasShortOption(stage.tokens, "1") && hasShortOption(stage.tokens, "3") && !hasShortOption(stage.tokens, "2")) {
    return `Print lines that exist in ${secondInput} but not in ${firstInput}${sortedSuffix}.`;
  }

  if (hasShortOption(stage.tokens, "1") && hasShortOption(stage.tokens, "2") && !hasShortOption(stage.tokens, "3")) {
    return `Print lines common to ${firstInput} and ${secondInput}${sortedSuffix}.`;
  }

  return inputWords.length === 2
    ? `Compare ${firstInput} and ${secondInput} line by line in three columns${sortedSuffix}.`
    : "Compare two sorted inputs line by line in three columns.";
}

function commNote(stage: ParsedStage, fallback: string): string {
  const inputs = commInputWords(stage).slice(0, 2);
  const sortedProcessSubstitutions = inputs.length === 2
    && inputs.every((word): word is ProcessSubstitutionWord => word.kind === "process-substitution" && isSimpleSortWord(word));

  return sortedProcessSubstitutions
    ? "comm requires sorted input. Here, process substitution (<(...)) sorts both files without creating intermediate files."
    : fallback;
}

function riskForGuideIds(guideIds: readonly string[], composed: boolean): { label: string; message: string } {

  if (guideIds.some((guideId) => DANGEROUS_GUIDES.has(guideId))) {
    return {
      label: "Check before running",
      message: composed
        ? "At least one stage or nested command can stop a process, overwrite files, delete data, or change the system. Check the whole command first."
        : "This command or a nested command can stop a process, overwrite files, delete data, or change the system. Check every target first.",
    };
  }

  if (guideIds.some((guideId) => EXTERNAL_GUIDES.has(guideId))) {
    return {
      label: "Can execute generated input",
      message: composed
        ? "At least one stage or nested command can run generated input or contact another system. Check every stage and the data flowing between them."
        : "This command or a nested command can run generated input or contact another system. Check the destination and input first.",
    };
  }

  if (guideIds.some((guideId) => MUTATING_GUIDES.has(guideId))) {
    return {
      label: "Changes system state",
      message: composed
        ? "At least one stage or nested command can change files or system state. Check every destination and generated argument before confirming."
        : "This command or a nested command can change files or system state. Check the destination and generated arguments before confirming.",
    };
  }

  return riskFor(guideIds[0] ?? "");
}

function riskForPipeline(stages: readonly ParsedStage[], nestedCommands: readonly ResolvedCommand[]): { label: string; message: string } {
  const guideIds = [
    ...stages.flatMap((stage) => (stage.guideId ? [stage.guideId] : [])),
    ...nestedCommands.flatMap((command) => (command.guideId ? [command.guideId] : [])),
  ];

  return riskForGuideIds(guideIds, stages.length > 1 || nestedCommands.length > 0);
}

export function explainCommand(input: string, guides: GuideCatalog): CommandExplanation {
  const normalizedInput = normalize(input);

  if (!normalizedInput) {
    return { kind: "empty", input: "" };
  }

  const parsedShell = parseShell(input.trim());

  if (parsedShell.kind === "error") {
    return {
      kind: "unknown",
      input: normalizedInput,
      command: normalizedInput.split(/\s+/, 1)[0] ?? normalizedInput,
      plainEnglish: parsedShell.message,
    };
  }

  const stageGroups = parsedShell.ast.pipelines.map((pipeline) => pipeline.commands.map((command) => parseStage(command, guides)));
  const stages = stageGroups.flat();
  const separators = parsedShell.ast.pipelines.flatMap((pipeline, pipelineIndex) => [
    ...pipeline.operators,
    ...(pipelineIndex < parsedShell.ast.operators.length ? [parsedShell.ast.operators[pipelineIndex]] : []),
  ]);
  const firstStage = stages[0];
  const unknownStage = stages.find((stage) => !stage.guideId || !stage.guide);

  if (!firstStage) {
    return { kind: "unknown", input: normalizedInput, command: normalizedInput };
  }

  const analyses = analyzeShell(parsedShell.ast, {
    catalog: guides,
    resolveGuide: (resolvedWords) => resolveGuide(resolvedWords, guides),
  });
  const identifiedCommands = flattenAnalyses(analyses).map((analysis) => analysis.resolved);
  const unknownNestedCommand = identifiedCommands.find((identified) => !identified.guideId || !identified.manPage);

  if (unknownStage || unknownNestedCommand) {
    const unknownCommand = unknownStage?.command ?? unknownNestedCommand?.name ?? firstStage.command;
    return {
      kind: "unknown",
      input: normalizedInput,
      command: unknownCommand,
      ...(stages.length > 1 || unknownNestedCommand ? { plainEnglish: `This command connects ${stages.map((stage) => stage.command).join(" → ")}, but I do not have a reliable guide for ${unknownCommand} yet.` } : {}),
    };
  }

  const guideId = firstStage.guideId;
  const guide = firstStage.guide;

  if (!guideId || !guide) {
    return { kind: "unknown", input: normalizedInput, command: firstStage.command };
  }

  const isPipeline = stages.length > 1;
  const intent = isPipeline ? pipelineIntent(stages, separators) : undefined;
  const hasProcessSubstitution = firstStage.node.parts.some((part) =>
    (part.kind === "process-substitution") || (part.kind === "redirection" && part.target.kind === "process-substitution"),
  );
  const plainEnglish = intent
    ?? (firstStage.command === "comm" && !isPipeline
    ? commPlainEnglish(firstStage)
    : isPipeline
      ? pipelineSentence(stages, separators)
      : hasProcessSubstitution
        ? sentenceFromAction(stageAction(firstStage, undefined))
      : guide.purpose);
  const baseNote = isPipeline
    ? `${shellOperatorNote(separators)} ${guide.note}`
    : firstStage.command === "comm"
      ? commNote(firstStage, guide.note)
      : guide.note;
  const hasProcessSubstitutionInPipeline = stages.some((stage) => stage.node.parts.some((part) =>
    (part.kind === "process-substitution") || (part.kind === "redirection" && part.target.kind === "process-substitution"),
  ));
  const note = !isPipeline && firstStage.command === "comm"
    ? baseNote
    : hasProcessSubstitutionInPipeline
      ? `${baseNote} Process substitution (<(...)) runs each inner command and exposes its output as an input without creating named intermediate files.`
      : baseNote;

  return {
    kind: "recognized",
    input: normalizedInput,
    command: commandExpression(stages, separators),
    summary: guide.purpose,
    plainEnglish,
    steps: isPipeline ? pipelineSteps(stages, separators, guides) : stepsFor(firstStage, guides),
    levels: explanationLevels(stages, separators, plainEnglish, guides),
    note,
    risk: isPipeline ? riskForPipeline(stages, identifiedCommands) : riskForGuideIds(
      identifiedCommands.flatMap((command) => (command.guideId ? [command.guideId] : [])),
      identifiedCommands.length > 1,
    ),
  };
}
