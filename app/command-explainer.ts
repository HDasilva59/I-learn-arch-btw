export type CommandGuide = {
  purpose: string;
  syntax: string;
  parts: readonly {
    token: string;
    meaning: string;
  }[];
  note: string;
};

export type CommandExplanationStep = {
  token: string;
  explanation: string;
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

type GuideCatalog = Readonly<Record<string, CommandGuide>>;
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

function tokenize(input: string): readonly string[] {
  const tokens: string[] = [];
  let current = "";
  let quote: '"' | "'" | null = null;

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

    if (/\s/.test(character)) {
      if (current) {
        tokens.push(current);
        current = "";
      }

      continue;
    }

    current += character;
  }

  if (current) {
    tokens.push(current);
  }

  return tokens;
}

function normalize(input: string): string {
  return input.trim().replace(/\s+/g, " ");
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

function optionSteps(token: string, guide: CommandGuide): readonly CommandExplanationStep[] {
  const normalizedToken = token.startsWith("-") ? token : `-${token}`;
  const optionName = normalizedToken.split("=", 1)[0];
  const exactMeaning = guide.parts.find((part) => part.token === token)?.meaning ?? guide.parts.find((part) => part.token === optionName)?.meaning;

  if (exactMeaning) {
    return [{ token, explanation: exactMeaning }];
  }

  if (/^-[A-Za-z]{2,}$/.test(normalizedToken)) {
    const compactOptions = [...normalizedToken.slice(1)].map((letter) => `-${letter}`);
    const meanings = compactOptions.map((option) => guide.parts.find((part) => part.token === option));

    if (meanings.every((part) => part !== undefined)) {
      return meanings.map((part) => ({ token: part.token, explanation: part.meaning }));
    }
  }

  return [{ token, explanation: "an option passed to this command" }];
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

function stepsFor(tokens: readonly string[], guideId: string, guide: CommandGuide): readonly CommandExplanationStep[] {
  const command = tokens[0] ?? "";
  const steps: CommandExplanationStep[] = [];

  if (command === "sudo") {
    steps.push({ token: "sudo", explanation: "asks for administrator privileges for the command that follows" });
  }

  const commandIndex = command === "sudo" ? 1 : 0;
  const commandName = tokens[commandIndex] ?? "";
  const commandDescription = COMMAND_NAMES[commandName] ?? "a shell command or program";
  steps.push({ token: commandName, explanation: `runs ${commandDescription}` });

  const argumentTokens = tokens.slice(commandIndex + 1);

  for (let index = 0; index < argumentTokens.length; index += 1) {
    const token = argumentTokens[index];
    const oldTarOptions = commandName === "tar" && index === 0 && isTarOldStyleOptions(token);
    const nextToken = argumentTokens[index + 1];
    const pairedPart = nextToken ? guide.parts.find((part) => part.token === `${token} ${nextToken}`) : undefined;

    if (pairedPart) {
      steps.push({ token: `${token} ${nextToken}`, explanation: pairedPart.meaning });
      index += 1;
      continue;
    }

    if (token.startsWith("-") || token === ">" || token === ">>" || oldTarOptions) {
      steps.push(...optionSteps(token, guide));
      continue;
    }

    const argument = stripQuotes(token);
    const meaning = ARGUMENT_MEANINGS[guideId] ?? "the value or path passed to the command";
    steps.push({ token: argument, explanation: meaning });
  }

  return steps;
}

type ParsedStage = {
  input: string;
  tokens: readonly string[];
  command: string;
  guideId: string | undefined;
  guide: CommandGuide | undefined;
};

function splitPipeline(input: string): readonly string[] {
  const stages: string[] = [];
  let current = "";
  let quote: '"' | "'" | null = null;

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

    if (character === "|" && input[index + 1] !== "|") {
      stages.push(current.trim());
      current = "";

      if (input[index + 1] === "&") {
        index += 1;
      }

      continue;
    }

    current += character;
  }

  if (current.trim()) {
    stages.push(current.trim());
  }

  return stages;
}

function parseStage(input: string, guides: GuideCatalog): ParsedStage {
  const rawTokens = tokenize(input);
  const tokens = rawTokens[0] === "sudo" ? ["sudo", ...rawTokens.slice(1)] : rawTokens;
  const commandTokens = tokens[0] === "sudo" ? tokens.slice(1) : tokens;
  const guideId = resolveGuide(commandTokens, guides);

  return {
    input,
    tokens,
    command: commandTokens[0] ?? input,
    guideId,
    guide: guideId ? guides[guideId] : undefined,
  };
}

function lowerFirst(value: string): string {
  const sentence = value.trim().replace(/[.]$/, "");
  return sentence ? `${sentence[0].toLowerCase()}${sentence.slice(1)}` : sentence;
}

function hasShortOption(tokens: readonly string[], letter: string): boolean {
  return tokens.some((token) => token === `-${letter}` || (/^-[A-Za-z]+$/.test(token) && token.slice(1).includes(letter)));
}

function argumentAfter(tokens: readonly string[], option: string): string | undefined {
  const optionIndex = tokens.findIndex((token) => token === option);
  return optionIndex >= 0 ? tokens[optionIndex + 1] : undefined;
}

function stageAction(stage: ParsedStage, nextStage: ParsedStage | undefined): string {
  const tokens = stage.tokens;

  if (stage.command === "find") {
    const startPath = tokens[1] && !tokens[1].startsWith("-") ? stripQuotes(tokens[1]) : ".";
    const location = startPath === "." ? "the current directory" : `the ${startPath} directory`;
    const type = argumentAfter(tokens, "-type");
    const target = type === "f" ? "regular files" : type === "d" ? "directories" : "matching paths";
    const output = tokens.includes("-print0") ? " and outputs each match as a NUL-separated path" : "";
    return `searches ${location} for ${target}${output}`;
  }

  if (stage.command === "xargs") {
    const targetCommandName = tokens.slice(1).find((token) => COMMAND_NAMES[token]) ?? tokens.slice(1).find((token) => !token.startsWith("-") && !/^\d+$/.test(token));
    const targetCommand = targetCommandName ? ` for ${targetCommandName}` : nextStage?.command ? ` for ${nextStage.command}` : " into command arguments";
    return `turns incoming items into arguments${targetCommand}`;
  }

  if (stage.command === "stat") {
    const format = tokens.find((token) => token.startsWith("--printf=")) ?? argumentAfter(tokens, "--printf");

    if (format?.includes("%s") && format.includes("%n")) {
      return "prints each file's size and name";
    }

    return "prints file metadata";
  }

  if (stage.command === "sort") {
    const numeric = hasShortOption(tokens, "n");
    const reverse = hasShortOption(tokens, "r");

    if (numeric && reverse) {
      return "sorts the results numerically from largest to smallest";
    }

    if (numeric) {
      return "sorts the results numerically";
    }

    if (reverse) {
      return "sorts the results in reverse order";
    }
  }

  if (stage.command === "head") {
    const shortCount = tokens.find((token) => /^-\d+$/.test(token));
    const longCount = tokens.find((token) => token.startsWith("--lines="))?.split("=", 2)[1];
    const optionCount = argumentAfter(tokens, "-n") ?? argumentAfter(tokens, "--lines");
    const count = shortCount?.slice(1) ?? longCount ?? optionCount ?? "10";
    return `keeps the first ${count} lines`;
  }

  if (stage.guide) {
    return lowerFirst(stage.guide.purpose);
  }

  return `runs ${COMMAND_NAMES[stage.command] ?? "a command"}`;
}

function pipelineSentence(stages: readonly ParsedStage[]): string {
  const actions = stages.map((stage, index) => stageAction(stage, stages[index + 1]));

  if (actions.length === 1) {
    return `${actions[0].charAt(0).toUpperCase()}${actions[0].slice(1)}.`;
  }

  if (actions.length === 2) {
    return `It ${actions[0]}, then ${actions[1]}.`;
  }

  const finalAction = actions[actions.length - 1];
  const middleActions = actions.slice(1, -1).map((action) => `then ${action}`);

  return `It ${actions[0]}, ${[...middleActions, `and finally ${finalAction}`].join(", ")}.`;
}

function pipelineSteps(stages: readonly ParsedStage[]): readonly CommandExplanationStep[] {
  return stages.flatMap((stage, index) => [
    ...(index > 0 ? [{ token: "|", explanation: `passes the previous stage's output into ${stage.command}` }] : []),
    ...(stage.guideId && stage.guide ? stepsFor(stage.tokens, stage.guideId, stage.guide) : [{ token: stage.command, explanation: `runs ${COMMAND_NAMES[stage.command] ?? "a command"}` }]),
  ]);
}

function riskForPipeline(stages: readonly ParsedStage[]): { label: string; message: string } {
  const guideIds = stages.flatMap((stage) => (stage.guideId ? [stage.guideId] : []));

  if (guideIds.some((guideId) => DANGEROUS_GUIDES.has(guideId))) {
    return {
      label: "Check before running",
      message: "At least one stage can stop a process, overwrite files, delete data, or change the system. Check the whole pipeline first.",
    };
  }

  if (guideIds.some((guideId) => EXTERNAL_GUIDES.has(guideId))) {
    return {
      label: "Can execute generated input",
      message: "At least one stage can run a command or contact another system using generated input. Check every stage and the data flowing between them.",
    };
  }

  if (guideIds.some((guideId) => MUTATING_GUIDES.has(guideId))) {
    return {
      label: "Changes system state",
      message: "At least one stage can change files or system state. Check the destination and generated arguments before confirming.",
    };
  }

  return riskFor(guideIds[0] ?? "");
}

export function explainCommand(input: string, guides: GuideCatalog): CommandExplanation {
  const normalizedInput = normalize(input);

  if (!normalizedInput) {
    return { kind: "empty", input: "" };
  }

  const stages = splitPipeline(normalizedInput).map((stage) => parseStage(stage, guides));
  const firstStage = stages[0];
  const unknownStage = stages.find((stage) => !stage.guideId || !stage.guide);

  if (unknownStage) {
    return {
      kind: "unknown",
      input: normalizedInput,
      command: unknownStage.command,
      ...(stages.length > 1 ? { plainEnglish: `This pipeline passes output through ${stages.map((stage) => stage.command).join(" → ")}, but I do not have a reliable guide for ${unknownStage.command} yet.` } : {}),
    };
  }

  const guideId = firstStage.guideId;
  const guide = firstStage.guide;

  if (!guideId || !guide) {
    return { kind: "unknown", input: normalizedInput, command: firstStage.command };
  }

  const isPipeline = stages.length > 1;

  return {
    kind: "recognized",
    input: normalizedInput,
    command: stages.map((stage) => stage.command).join(" | "),
    summary: guide.purpose,
    plainEnglish: isPipeline ? pipelineSentence(stages) : guide.purpose,
    steps: isPipeline ? pipelineSteps(stages) : stepsFor(firstStage.tokens, guideId, guide),
    note: isPipeline ? `The pipe passes each stage's standard output into the next command. ${guide.note}` : guide.note,
    risk: isPipeline ? riskForPipeline(stages) : riskFor(guideId),
  };
}
