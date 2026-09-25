"use client";

import { useEffect, useState, type FormEvent } from "react";

import { createInitialTerminalSession, runTerminalCommand, type TerminalLine, type TerminalSession } from "./terminal";

type LessonId =
  | "terminal"
  | "filesystem"
  | "workspace"
  | "pacman-install"
  | "pacman-query"
  | "cleanup"
  | "tools"
  | "services"
  | "file-operations"
  | "search-files"
  | "text-tools"
  | "permissions"
  | "archives"
  | "processes"
  | "environment"
  | "productivity";

type IconName =
  | "arrow"
  | "book"
  | "check"
  | "clock"
  | "copy"
  | "database"
  | "external"
  | "lock"
  | "refresh"
  | "search"
  | "shield"
  | "spark"
  | "terminal";

type Lesson = {
  id: LessonId;
  module: string;
  number: string;
  title: string;
  duration: string;
  summary: string;
  terminalTasks: readonly [TerminalTask, ...TerminalTask[]];
  takeaways: readonly string[];
  exercise: {
    question: string;
    options: readonly {
      id: string;
      label: string;
    }[];
    correctOptionId: string;
    hint: string;
    success: string;
  };
  source: {
    label: string;
    href: string;
  };
};

type CommandGuide = {
  purpose: string;
  syntax: string;
  parts: readonly {
    token: string;
    meaning: string;
  }[];
  note: string;
};

type TerminalTask = {
  id: string;
  command: string;
  guideId: keyof typeof COMMAND_GUIDES;
  title: string;
  prompt: string;
  explanation: string;
  success: string;
};

type LessonState = {
  completedTaskIds: readonly string[];
  quizPassed: boolean;
};

type Progress = {
  activeLessonId: LessonId;
  lessonStates: Partial<Record<LessonId, LessonState>>;
};

type ExerciseState = {
  lessonId: LessonId;
  selectedOptionId: string | null;
  status: "idle" | "correct" | "incorrect";
};

type TerminalDisplayLine = TerminalLine | { kind: "command"; text: string };

const STORAGE_KEY = "i-learn-arch-btw-progress-v2";

const EMPTY_LESSON_STATE: LessonState = {
  completedTaskIds: [],
  quizPassed: false,
};

const COMMAND_GUIDES = {
  pwd: {
    purpose: "Print the full path of the directory where the shell is working.",
    syntax: "pwd [option]",
    parts: [
      { token: "-L", meaning: "Show the logical path, including symbolic links." },
      { token: "-P", meaning: "Show the physical path with symbolic links resolved." },
    ],
    note: "Run pwd whenever you are unsure where a relative path will start.",
  },
  ls: {
    purpose: "List the files and directories in a path.",
    syntax: "ls [options] [path]",
    parts: [
      { token: "-l", meaning: "Use the long format with permissions, owner, size, and date." },
      { token: "-a", meaning: "Include hidden entries whose names start with a dot." },
      { token: "-h", meaning: "Show sizes in a human-readable format when used with -l." },
      { token: "-la", meaning: "Combine -l and -a. This is the form used in the exercise." },
    ],
    note: "Options can often be combined. Read ls -la from left to right as long format plus all entries.",
  },
  cd: {
    purpose: "Change the shell's current working directory.",
    syntax: "cd [directory]",
    parts: [
      { token: "~", meaning: "The current user's home directory." },
      { token: "..", meaning: "The parent directory." },
      { token: "/", meaning: "The root of the filesystem." },
    ],
    note: "cd changes the starting point for later relative paths, but it does not print anything when it succeeds.",
  },
  cat: {
    purpose: "Print a short file directly to standard output.",
    syntax: "cat [file]",
    parts: [],
    note: "Use cat for short files. Use less when the output may be longer than one screen.",
  },
  less: {
    purpose: "Read a file one screen at a time.",
    syntax: "less [file]",
    parts: [
      { token: "Space", meaning: "Move forward one screen in a real less session." },
      { token: "q", meaning: "Quit the pager in a real terminal." },
    ],
    note: "The practice shell prints the file as a safe preview. The real less program is interactive.",
  },
  man: {
    purpose: "Open the local manual page for a command.",
    syntax: "man [command]",
    parts: [
      { token: "-k", meaning: "Search manual page names and descriptions in a real system." },
    ],
    note: "Read the SYNOPSIS and OPTIONS sections before trying an unfamiliar flag.",
  },
  mkdir: {
    purpose: "Create one or more directories.",
    syntax: "mkdir [options] directory",
    parts: [
      { token: "-p", meaning: "Create missing parent directories and avoid an error when the target exists." },
    ],
    note: "The exercise uses the plain form because the parent directory already exists.",
  },
  touch: {
    purpose: "Create an empty file or update a file's timestamps.",
    syntax: "touch file",
    parts: [],
    note: "touch does not open an editor. Use echo, a text editor, or a redirect to add content.",
  },
  echo: {
    purpose: "Print text, or send that text to a file with redirection.",
    syntax: "echo text > file",
    parts: [
      { token: ">", meaning: "Write output to a file and replace its current contents." },
      { token: ">>", meaning: "Append output to a file in a real shell." },
    ],
    note: "The single > operator is destructive when the target file already contains text.",
  },
  pacmanSyu: {
    purpose: "Synchronize package databases and upgrade all installed packages.",
    syntax: "sudo pacman -Syu",
    parts: [
      { token: "sudo", meaning: "Run the package operation with administrator privileges." },
      { token: "-S", meaning: "Synchronize packages with repository databases." },
      { token: "-y", meaning: "Refresh the package database metadata." },
      { token: "-u", meaning: "Upgrade packages that have newer versions." },
    ],
    note: "Avoid partial upgrades. On Arch, use the complete -Syu form and read current news before upgrading.",
  },
  pacmanSearchRepo: {
    purpose: "Search packages available in configured repositories.",
    syntax: "pacman -Ss search-term",
    parts: [
      { token: "-S", meaning: "Use the synchronized repository database." },
      { token: "-s", meaning: "Search package names and descriptions." },
    ],
    note: "-Ss searches repositories. Its local-database counterpart is -Qs.",
  },
  pacmanInstall: {
    purpose: "Install a package from a configured repository.",
    syntax: "sudo pacman -S package",
    parts: [
      { token: "sudo", meaning: "Request administrator privileges for the install." },
      { token: "-S", meaning: "Synchronize and install the named package." },
    ],
    note: "Read the package list and dependency changes before confirming an install on a real system.",
  },
  pacmanQuery: {
    purpose: "List packages installed in the local pacman database.",
    syntax: "pacman -Q",
    parts: [
      { token: "-Q", meaning: "Query the local package database instead of the repositories." },
    ],
    note: "This answers what is installed. It does not search packages that are only available online.",
  },
  pacmanQuerySearch: {
    purpose: "Search installed packages by name or description.",
    syntax: "pacman -Qs search-term",
    parts: [
      { token: "-Q", meaning: "Query the local installed-package database." },
      { token: "-s", meaning: "Search names and descriptions." },
    ],
    note: "Use -Ss when you want repository packages that are not installed yet.",
  },
  pacmanQueryInfo: {
    purpose: "Show metadata for one installed package.",
    syntax: "pacman -Qi package",
    parts: [
      { token: "-Q", meaning: "Query the local package database." },
      { token: "-i", meaning: "Print detailed package information." },
    ],
    note: "Use this before removing or diagnosing a package so you know its version and description.",
  },
  pacmanQueryFiles: {
    purpose: "List the files owned by an installed package.",
    syntax: "pacman -Ql package",
    parts: [
      { token: "-Q", meaning: "Query the local package database." },
      { token: "-l", meaning: "List the package's installed files." },
    ],
    note: "This is useful when you know a package owns a command or configuration file.",
  },
  pacmanOrphans: {
    purpose: "Find installed dependencies that no installed package needs anymore.",
    syntax: "pacman -Qdt",
    parts: [
      { token: "-Q", meaning: "Query the local package database." },
      { token: "-d", meaning: "Limit results to packages installed as dependencies." },
      { token: "-t", meaning: "Limit results to dependencies no longer required." },
    ],
    note: "Review the list before removing anything. An orphan can still be useful to you.",
  },
  pacmanRemove: {
    purpose: "Remove a package, unused dependencies, and saved configuration files.",
    syntax: "sudo pacman -Rns package",
    parts: [
      { token: "-R", meaning: "Remove the named package." },
      { token: "-n", meaning: "Remove package backup configuration files." },
      { token: "-s", meaning: "Remove dependencies that nothing else needs." },
    ],
    note: "Inspect pacman's proposed removal list. Never paste a removal command you do not understand.",
  },
  pacmanOrphansQuiet: {
    purpose: "Print only the names of orphaned dependency packages.",
    syntax: "pacman -Qdtq",
    parts: [
      { token: "-q", meaning: "Use quiet output without package versions or extra detail." },
    ],
    note: "Quiet output is useful for scripts, but it gives you less context for a manual review.",
  },
  which: {
    purpose: "Show the executable path selected through PATH.",
    syntax: "which command",
    parts: [],
    note: "Use type when you also want to detect aliases, builtins, or shell functions.",
  },
  whoami: {
    purpose: "Print the username attached to the current shell process.",
    syntax: "whoami",
    parts: [],
    note: "Check this before commands that need ownership or administrator access.",
  },
  uname: {
    purpose: "Print system and kernel identity information.",
    syntax: "uname [options]",
    parts: [
      { token: "-a", meaning: "Print all available system identity fields." },
    ],
    note: "uname -a is a useful first report when you need to identify a machine or architecture.",
  },
  systemctlFailed: {
    purpose: "List systemd units that failed to start.",
    syntax: "systemctl --failed",
    parts: [
      { token: "--failed", meaning: "Filter the unit list to failed services and other units." },
    ],
    note: "This inspects state. It does not restart or change a service.",
  },
  journalctlBoot: {
    purpose: "Read messages from the current system boot.",
    syntax: "journalctl -b",
    parts: [
      { token: "-b", meaning: "Select the current boot. A number can select an older boot in a real system." },
    ],
    note: "Use the journal as evidence before changing a service or configuration.",
  },
  systemctlStatus: {
    purpose: "Show the state and recent information for one service.",
    syntax: "systemctl status service",
    parts: [
      { token: "status", meaning: "Read the unit state, process information, and recent log lines." },
    ],
    note: "status is read-only. Commands such as start, stop, and restart change service state.",
  },
  cp: {
    purpose: "Copy a file or directory to another path.",
    syntax: "cp [options] source destination",
    parts: [
      { token: "-r", meaning: "Copy a directory and its contents recursively." },
    ],
    note: "cp keeps the original. Check the destination path before copying over an existing file.",
  },
  mv: {
    purpose: "Move a path or rename it.",
    syntax: "mv source destination",
    parts: [],
    note: "mv does not keep a second copy. A rename stays on the same filesystem when possible.",
  },
  rm: {
    purpose: "Remove a file or, with care, a directory tree.",
    syntax: "rm [options] path",
    parts: [
      { token: "-r", meaning: "Remove a directory and its contents recursively." },
      { token: "-f", meaning: "Skip some prompts and missing-file errors in a real shell." },
    ],
    note: "rm has no recycle bin. Confirm the path and use the smallest option set that solves the task.",
  },
  findName: {
    purpose: "Search a directory tree for paths whose names match a pattern.",
    syntax: "find path -name pattern",
    parts: [
      { token: "-name", meaning: "Match the final name of each path." },
      { token: ".", meaning: "Start at the current directory." },
    ],
    note: "Quote patterns containing wildcards so the shell does not expand them before find sees them.",
  },
  findType: {
    purpose: "Search a directory tree and keep only one kind of filesystem entry.",
    syntax: "find path -type f",
    parts: [
      { token: "-type f", meaning: "Keep regular files." },
      { token: "-type d", meaning: "Keep directories instead." },
    ],
    note: "Combine -type with -name when a search needs both a kind and a name.",
  },
  grep: {
    purpose: "Search file contents for lines that contain a pattern.",
    syntax: "grep pattern file",
    parts: [
      { token: "-n", meaning: "Print matching line numbers in a real grep command." },
      { token: "-i", meaning: "Ignore letter case in a real grep command." },
    ],
    note: "find locates paths. grep reads the text inside those paths.",
  },
  head: {
    purpose: "Print the beginning of a file.",
    syntax: "head -n count file",
    parts: [
      { token: "-n", meaning: "Choose how many lines to print." },
    ],
    note: "head is useful for checking a file format before processing the whole file.",
  },
  tail: {
    purpose: "Print the end of a file.",
    syntax: "tail -n count file",
    parts: [
      { token: "-n", meaning: "Choose how many lines to print." },
      { token: "-f", meaning: "Follow new log lines in a real terminal." },
    ],
    note: "tail -f keeps running. The exercise uses -n so it returns immediately.",
  },
  wc: {
    purpose: "Count lines, words, and bytes in a file.",
    syntax: "wc -l file",
    parts: [
      { token: "-l", meaning: "Print the line count." },
      { token: "-w", meaning: "Print the word count in a real wc command." },
      { token: "-c", meaning: "Print the byte count in a real wc command." },
    ],
    note: "Use one flag when you want a focused measurement instead of all three counts.",
  },
  sort: {
    purpose: "Print file lines in sorted order.",
    syntax: "sort [options] file",
    parts: [
      { token: "-r", meaning: "Reverse the sort order in a real sort command." },
      { token: "-n", meaning: "Compare values as numbers in a real sort command." },
    ],
    note: "sort prints reordered output. It does not rewrite the source file unless you redirect it.",
  },
  lsLong: {
    purpose: "Inspect permissions, ownership, size, and timestamp for one path.",
    syntax: "ls -l path",
    parts: [
      { token: "-l", meaning: "Use the long listing format." },
      { token: "rwx", meaning: "Read, write, and execute permission bits." },
    ],
    note: "Read the mode as owner, group, then others. The first character tells you file or directory.",
  },
  chmod: {
    purpose: "Change the permission mode of a path.",
    syntax: "chmod 600 file",
    parts: [
      { token: "6", meaning: "Owner gets read 4 plus write 2." },
      { token: "0", meaning: "The group gets no permissions." },
      { token: "0", meaning: "Other users get no permissions." },
    ],
    note: "The three digits represent owner, group, and others. Read 4, write 2, and execute 1 are added together.",
  },
  chown: {
    purpose: "Change the owner and group recorded for a path.",
    syntax: "chown user:group file",
    parts: [
      { token: ":", meaning: "Separate the new user name from the new group name." },
    ],
    note: "Changing ownership usually needs administrator privileges on a real system.",
  },
  tarCreate: {
    purpose: "Create an archive that groups files without compressing them.",
    syntax: "tar -cf archive.tar file...",
    parts: [
      { token: "-c", meaning: "Create a new archive." },
      { token: "-f", meaning: "Use the next argument as the archive filename." },
    ],
    note: "The archive filename follows -f. Keep the option and filename together while reading the command.",
  },
  tarList: {
    purpose: "List an archive's entries without extracting them.",
    syntax: "tar -tf archive.tar",
    parts: [
      { token: "-t", meaning: "List the archive table of contents." },
      { token: "-f", meaning: "Read the archive named by the next argument." },
    ],
    note: "Inspect unknown archives before extracting them into a real directory.",
  },
  gzip: {
    purpose: "Compress one file with gzip.",
    syntax: "gzip [options] file",
    parts: [
      { token: "-k", meaning: "Keep the original file while creating the .gz file." },
    ],
    note: "gzip compresses one file. tar is what groups multiple paths into one archive first.",
  },
  ps: {
    purpose: "Show a point-in-time list of running processes.",
    syntax: "ps",
    parts: [
      { token: "PID", meaning: "The process identifier used by commands such as kill." },
      { token: "CMD", meaning: "The command that started the process." },
    ],
    note: "Read the PID and command together before sending a signal.",
  },
  top: {
    purpose: "View process activity in a continuously updating interface.",
    syntax: "top -n 1",
    parts: [
      { token: "-n 1", meaning: "Take one update and exit instead of looping forever." },
    ],
    note: "The exercise uses one snapshot so the browser shell stays predictable.",
  },
  kill: {
    purpose: "Send a signal to a process identified by its PID.",
    syntax: "kill PID",
    parts: [
      { token: "TERM", meaning: "The default request asks a process to stop cleanly." },
      { token: "-9", meaning: "Force termination in a real system. Use it only when gentler signals fail." },
    ],
    note: "A PID can be reused. Confirm the process before sending a signal on a real machine.",
  },
  type: {
    purpose: "Ask the shell how it resolves a command name.",
    syntax: "type command",
    parts: [],
    note: "type can reveal an alias or shell builtin that which would not show as a normal executable.",
  },
  export: {
    purpose: "Set a shell variable and export it to child commands.",
    syntax: "export NAME=value",
    parts: [
      { token: "NAME=value", meaning: "Assign a value without spaces around the equals sign." },
    ],
    note: "The value lasts for this shell session. It does not permanently edit your configuration files.",
  },
  printenv: {
    purpose: "Print one environment variable or the complete environment.",
    syntax: "printenv NAME",
    parts: [],
    note: "Use printenv to verify a variable after setting it with export.",
  },
  env: {
    purpose: "Print the environment passed to commands from this shell.",
    syntax: "env",
    parts: [],
    note: "Environment values can contain sensitive data. Avoid exposing secrets in shared logs.",
  },
  clear: {
    purpose: "Clear the visible terminal display.",
    syntax: "clear",
    parts: [],
    note: "clear changes the display only. It does not undo commands, delete files, or erase history.",
  },
  alias: {
    purpose: "Create a short name for a longer command in the current shell.",
    syntax: "alias name='command and options'",
    parts: [
      { token: "=", meaning: "Assign the command text to the alias name." },
      { token: "'...'", meaning: "Keep spaces and special characters together in the alias definition." },
    ],
    note: "Aliases are shell shortcuts. They usually disappear when the shell exits unless saved in a shell config file.",
  },
  history: {
    purpose: "Print commands entered in the current shell history.",
    syntax: "history",
    parts: [],
    note: "History helps you review what you actually ran. It is not a record of every process on the machine.",
  },
} satisfies Record<string, CommandGuide>;

const LESSONS: readonly Lesson[] = [
  {
    id: "terminal",
    module: "Terminal foundations",
    number: "01",
    title: "Find your bearings",
    duration: "5 min",
    summary:
      "Before you change anything, know where you are. These three commands make the shell feel less like a blank screen and more like a map.",
    terminalTasks: [
      { id: "pwd", command: "pwd", guideId: "pwd", title: "Find your location", prompt: "Print the full path of your current directory.", explanation: "Print the directory you are in.", success: "You found your starting point. The shell reports /home/student." },
      { id: "ls", command: "ls -la", guideId: "ls", title: "Inspect the directory", prompt: "List visible and hidden files with details.", explanation: "List visible and hidden files with details.", success: "You inspected the directory without changing it." },
      { id: "cd", command: "cd /etc", guideId: "cd", title: "Move deliberately", prompt: "Move into the system configuration directory.", explanation: "Move into a directory.", success: "You moved through the filesystem using an absolute path." },
    ],
    takeaways: [
      "pwd answers: where am I?",
      "ls answers: what is here?",
      "cd answers: where do I want to go?",
    ],
    exercise: {
      question: "Which command tells you the full path of your current directory?",
      options: [
        { id: "pwd", label: "pwd" },
        { id: "ls", label: "ls -la" },
        { id: "cd", label: "cd ~" },
      ],
      correctOptionId: "pwd",
      hint: "Think of the command that prints your working directory.",
      success: "Exactly. pwd prints the path you are standing in right now.",
    },
    source: {
      label: "Read more on the Arch Wiki",
      href: "https://wiki.archlinux.org/title/General_recommendations",
    },
  },
  {
    id: "filesystem",
    module: "Terminal foundations",
    number: "02",
    title: "Read before you run",
    duration: "6 min",
    summary:
      "Linux commands become safer when you slow down long enough to inspect them. Learn the tools that explain files, commands, and the system around you.",
    terminalTasks: [
      { id: "cat", command: "cat notes.txt", guideId: "cat", title: "Read a small file", prompt: "Print the contents of notes.txt.", explanation: "Print a small text file.", success: "You read a short file directly." },
      { id: "less", command: "less /var/log/pacman.log", guideId: "less", title: "Page through a log", prompt: "Read the package log one screen at a time.", explanation: "Read a long file one screen at a time.", success: "You inspected a longer file without dumping it blindly." },
      { id: "man", command: "man pacman", guideId: "man", title: "Use the manual", prompt: "Open the short pacman manual in the practice shell.", explanation: "Open the manual for a command.", success: "You checked the local reference before running a package command." },
    ],
    takeaways: [
      "Use cat for short files and less for long ones.",
      "man command is the local reference for command options.",
      "Press q to leave less and most manual pages.",
    ],
    exercise: {
      question: "You want to read a long log without dumping it all into the terminal. Which tool fits?",
      options: [
        { id: "less", label: "less /var/log/pacman.log" },
        { id: "rm", label: "rm /var/log/pacman.log" },
        { id: "cd", label: "cd /var/log/pacman.log" },
      ],
      correctOptionId: "less",
      hint: "Choose the command that lets you page through a file.",
      success: "Right. less opens a scrollable view and leaves the file untouched.",
    },
    source: {
      label: "Read the Arch Wiki recommendations",
      href: "https://wiki.archlinux.org/title/General_recommendations",
    },
  },
  {
    id: "workspace",
    module: "Terminal foundations",
    number: "03",
    title: "Make a small workspace",
    duration: "5 min",
    summary:
      "A shell becomes useful when it changes something. Create a directory, add a note, and inspect the result without touching anything outside this practice session.",
    terminalTasks: [
      { id: "mkdir", command: "mkdir practice", guideId: "mkdir", title: "Create a workspace", prompt: "Create a directory called practice in your home directory.", explanation: "Create a new directory.", success: "You created a workspace inside this resettable session." },
      { id: "touch", command: "touch practice/todo.txt", guideId: "touch", title: "Create a file", prompt: "Create an empty todo.txt file inside practice.", explanation: "Create an empty file.", success: "You created a file without opening an editor." },
      { id: "echo", command: "echo 'read the wiki' > practice/todo.txt", guideId: "echo", title: "Write a note", prompt: "Write a short note into todo.txt with redirection.", explanation: "Write a short note into a file.", success: "You wrote data into a file using shell redirection." },
      { id: "ls-practice", command: "ls practice", guideId: "ls", title: "Inspect the result", prompt: "List the files inside your new workspace.", explanation: "Inspect the directory you just made.", success: "You verified the workspace instead of assuming it worked." },
    ],
    takeaways: [
      "mkdir creates directories; touch creates empty files.",
      "Use > carefully: it replaces the contents of a file.",
      "Practice changes are disposable until you make them on a real system.",
    ],
    exercise: {
      question: "Which command creates a directory named practice?",
      options: [
        { id: "mkdir", label: "mkdir practice" },
        { id: "touch", label: "touch practice" },
        { id: "cd", label: "cd practice" },
      ],
      correctOptionId: "mkdir",
      hint: "Choose the command whose name means 'make directory'.",
      success: "Correct. mkdir creates a directory, while cd only moves into one that already exists.",
    },
    source: {
      label: "Read the Arch Wiki recommendations",
      href: "https://wiki.archlinux.org/title/General_recommendations",
    },
  },
  {
    id: "pacman-install",
    module: "Package management",
    number: "04",
    title: "Install and upgrade safely",
    duration: "7 min",
    summary:
      "pacman is Arch's package manager. Learn the everyday commands for syncing repository databases, upgrading the whole system, and installing a package.",
    terminalTasks: [
      { id: "full-upgrade", command: "sudo pacman -Syu", guideId: "pacmanSyu", title: "Preview a full upgrade", prompt: "Run the full system upgrade command.", explanation: "Refresh package databases and upgrade the full system.", success: "You used the full upgrade shape. In a real Arch terminal, read the news before confirming." },
      { id: "search-repositories", command: "pacman -Ss terminal", guideId: "pacmanSearchRepo", title: "Search repositories", prompt: "Search repository names and descriptions for terminal tools.", explanation: "Search repository names and descriptions.", success: "You searched available packages before installing one." },
      { id: "install-package", command: "sudo pacman -S htop", guideId: "pacmanInstall", title: "Install one package", prompt: "Install htop from the configured repositories.", explanation: "Install a package from a configured repository.", success: "You installed a package in the simulation. Nothing changed on your computer." },
    ],
    takeaways: [
      "Use -Syu for a full system upgrade.",
      "Use -S to install from an official repository.",
      "Avoid refreshing package databases without upgrading the system.",
    ],
    exercise: {
      question: "Which command is the normal full-system upgrade on Arch?",
      options: [
        { id: "safe-upgrade", label: "sudo pacman -Syu" },
        { id: "sync-only", label: "sudo pacman -Sy" },
        { id: "install", label: "sudo pacman -S package_name" },
      ],
      correctOptionId: "safe-upgrade",
      hint: "The full upgrade combines sync, refresh, and upgrade flags.",
      success: "Correct. Arch recommends full upgrades with pacman -Syu.",
    },
    source: {
      label: "Read the pacman guide",
      href: "https://wiki.archlinux.org/title/Pacman",
    },
  },
  {
    id: "pacman-query",
    module: "Package management",
    number: "05",
    title: "See what you have",
    duration: "6 min",
    summary:
      "The pacman database knows what is installed, where it came from, and which files it owns. Query it before guessing or reinstalling.",
    terminalTasks: [
      { id: "query-all", command: "pacman -Q", guideId: "pacmanQuery", title: "List installed packages", prompt: "List every package installed in the local database.", explanation: "List every installed package.", success: "You queried the local package database." },
      { id: "query-search", command: "pacman -Qs terminal", guideId: "pacmanQuerySearch", title: "Search installed packages", prompt: "Search installed packages for terminal-related tools.", explanation: "Search installed packages by name or description.", success: "You searched locally instead of confusing installed packages with repositories." },
      { id: "query-info", command: "pacman -Qi pacman", guideId: "pacmanQueryInfo", title: "Read package details", prompt: "Show detailed information about pacman.", explanation: "Show detailed information about an installed package.", success: "You inspected package metadata before guessing." },
      { id: "query-files", command: "pacman -Ql pacman", guideId: "pacmanQueryFiles", title: "Inspect owned files", prompt: "List the files installed by pacman.", explanation: "List the files installed by a package.", success: "You checked which files belong to a package." },
    ],
    takeaways: [
      "-Q queries the local installed-package database.",
      "-Qs searches installed packages by name and description.",
      "-Qi and -Ql answer detail and file-ownership questions.",
    ],
    exercise: {
      question: "You want to find installed packages related to 'terminal'. Which command should you reach for?",
      options: [
        { id: "search-installed", label: "pacman -Qs terminal" },
        { id: "search-repos", label: "pacman -Ss terminal" },
        { id: "files", label: "pacman -Ql terminal" },
      ],
      correctOptionId: "search-installed",
      hint: "The lowercase s searches the local database when paired with Q.",
      success: "Yes. pacman -Qs searches the packages already installed on your system.",
    },
    source: {
      label: "Read pacman queries",
      href: "https://wiki.archlinux.org/title/Pacman#Querying_package_databases",
    },
  },
  {
    id: "cleanup",
    module: "Package management",
    number: "06",
    title: "Remove without surprises",
    duration: "5 min",
    summary:
      "Removing software is part of keeping a system understandable. See what pacman plans to remove, then clean up packages that nothing needs.",
    terminalTasks: [
      { id: "orphans", command: "pacman -Qdt", guideId: "pacmanOrphans", title: "Find orphaned packages", prompt: "List dependencies that no installed package needs anymore.", explanation: "List installed dependencies no package now needs.", success: "You found the review list. Check it before removing anything in a real system." },
      { id: "remove-package", command: "sudo pacman -Rns python-pip", guideId: "pacmanRemove", title: "Preview a removal", prompt: "Remove the simulated orphan python-pip with its unused dependencies.", explanation: "Remove a package, unused dependencies, and its saved configuration files.", success: "You reviewed a removal action. This browser simulation changed nothing on your computer." },
      { id: "orphans-again", command: "pacman -Qdtq", guideId: "pacmanOrphansQuiet", title: "Recheck the database", prompt: "Print orphan package names only after the removal preview.", explanation: "Print only the package names that are orphaned.", success: "You checked the result instead of deleting a list blindly." },
    ],
    takeaways: [
      "Read pacman's removal plan before confirming.",
      "-Rns removes a package and dependencies no longer needed.",
      "Check orphaned packages before deleting them in bulk.",
    ],
    exercise: {
      question: "What does pacman -Qdt help you find?",
      options: [
        { id: "orphans", label: "Dependencies that nothing needs anymore" },
        { id: "updates", label: "Packages with available updates" },
        { id: "files", label: "Every file in the root filesystem" },
      ],
      correctOptionId: "orphans",
      hint: "The t flag filters packages installed as dependencies, and d finds unused ones.",
      success: "That is it. pacman -Qdt lists orphaned dependencies for review.",
    },
    source: {
      label: "Read system maintenance",
      href: "https://wiki.archlinux.org/title/System_maintenance#Clean_the_filesystem",
    },
  },
  {
    id: "tools",
    module: "Terminal foundations",
    number: "07",
    title: "Know which tool will run",
    duration: "5 min",
    summary:
      "When a command behaves unexpectedly, identify the program first. A few small checks tell you who you are, which Linux you are on, and where a command comes from.",
    terminalTasks: [
      { id: "which", command: "which pacman", guideId: "which", title: "Locate a command", prompt: "Print the path of the pacman executable available in this shell.", explanation: "Show which executable would run.", success: "You found the executable path before relying on it." },
      { id: "whoami", command: "whoami", guideId: "whoami", title: "Identify the user", prompt: "Print the current user.", explanation: "Print the current user.", success: "You checked which user is running the command." },
      { id: "uname", command: "uname -a", guideId: "uname", title: "Read system identity", prompt: "Print basic kernel and architecture information.", explanation: "Print basic kernel and architecture information.", success: "You checked the machine identity before troubleshooting it." },
    ],
    takeaways: [
      "which helps reveal which executable your shell will use.",
      "whoami answers which user is running the command.",
      "uname gives a compact view of the kernel and architecture.",
    ],
    exercise: {
      question: "Which command shows the executable path selected for pacman?",
      options: [
        { id: "which", label: "which pacman" },
        { id: "where", label: "where pacman" },
        { id: "path", label: "path pacman" },
      ],
      correctOptionId: "which",
      hint: "Use the command that searches your PATH for an executable.",
      success: "Exactly. which pacman shows the path the shell resolves.",
    },
    source: {
      label: "Read the Arch Wiki shell guidance",
      href: "https://wiki.archlinux.org/title/General_recommendations#Console",
    },
  },
  {
    id: "services",
    module: "System maintenance",
    number: "08",
    title: "Check the machine",
    duration: "6 min",
    summary:
      "A good maintainer checks signals before changing things. systemctl shows service failures. journalctl shows what happened during the current boot.",
    terminalTasks: [
      { id: "failed-services", command: "systemctl --failed", guideId: "systemctlFailed", title: "Check failed services", prompt: "Ask systemctl for failed system services.", explanation: "Show failed system services.", success: "You checked the machine before changing it." },
      { id: "boot-journal", command: "journalctl -b", guideId: "journalctlBoot", title: "Read this boot's journal", prompt: "Read the journal entries from the current boot.", explanation: "Read the journal for the current boot.", success: "You looked at evidence from the current boot." },
      { id: "service-status", command: "systemctl status sshd", guideId: "systemctlStatus", title: "Inspect one service", prompt: "Inspect the simulated sshd service status.", explanation: "Inspect one service and its recent logs.", success: "You inspected one service without restarting anything." },
    ],
    takeaways: [
      "systemctl manages systemd services.",
      "journalctl reads the systemd journal.",
      "Check Arch news before a system upgrade that may need manual action.",
    ],
    exercise: {
      question: "Which command gives you a quick list of failed system services?",
      options: [
        { id: "failed", label: "systemctl --failed" },
        { id: "journal", label: "journalctl -b" },
        { id: "restart", label: "systemctl restart all" },
      ],
      correctOptionId: "failed",
      hint: "Use systemctl with the flag that asks for failed units.",
      success: "Correct. systemctl --failed is a useful first check when a service misbehaves.",
    },
    source: {
      label: "Read system maintenance",
      href: "https://wiki.archlinux.org/title/System_maintenance",
    },
  },
  {
    id: "file-operations",
    module: "Core file commands",
    number: "09",
    title: "Move files with intent",
    duration: "8 min",
    summary: "Create, copy, rename, and remove files in a disposable workspace. The shell will do exactly what you ask, so slow down and inspect each result.",
    terminalTasks: [
      { id: "file-mkdir", command: "mkdir files", guideId: "mkdir", title: "Create a folder", prompt: "Create a directory named files.", explanation: "Create a container for the file exercise.", success: "You created a dedicated workspace for the file operations." },
      { id: "file-touch", command: "touch files/one.txt", guideId: "touch", title: "Create a file", prompt: "Create one.txt inside files.", explanation: "Create an empty file.", success: "You created a file without opening an editor." },
      { id: "file-copy", command: "cp files/one.txt files/two.txt", guideId: "cp", title: "Copy a file", prompt: "Copy one.txt to a new file named two.txt.", explanation: "Duplicate a file while keeping the original.", success: "You copied the file and kept the original in place." },
      { id: "file-move", command: "mv files/two.txt files/renamed.txt", guideId: "mv", title: "Rename a file", prompt: "Move two.txt to renamed.txt.", explanation: "Move a file or rename it.", success: "You renamed the copy with mv." },
      { id: "file-remove", command: "rm files/renamed.txt", guideId: "rm", title: "Remove one file", prompt: "Remove the renamed file from the virtual workspace.", explanation: "Delete a file in this safe simulation.", success: "You removed one file. In a real shell, rm does not use a recycle bin." },
      { id: "file-list", command: "ls files", guideId: "ls", title: "Verify the result", prompt: "List the remaining files in files.", explanation: "Check what remains after the operation.", success: "You inspected the final state instead of assuming it." },
    ],
    takeaways: [
      "cp preserves the source; mv changes its path or name.",
      "rm is immediate in a real shell. Verify the path before using it.",
      "Small inspect-after-change habits prevent large mistakes.",
    ],
    exercise: {
      question: "Which command renames a file without keeping a second copy?",
      options: [
        { id: "move", label: "mv old.txt new.txt" },
        { id: "copy", label: "cp old.txt new.txt" },
        { id: "remove", label: "rm old.txt" },
      ],
      correctOptionId: "move",
      hint: "The command name describes moving a path to a new path.",
      success: "Correct. mv is used both for moving and renaming files.",
    },
    source: {
      label: "Read the Linux Command Handbook",
      href: "https://www.freecodecamp.org/news/the-linux-commands-handbook/",
    },
  },
  {
    id: "search-files",
    module: "Search and text",
    number: "10",
    title: "Find what you need",
    duration: "7 min",
    summary: "Learn the difference between finding paths and searching file contents. These two questions look similar, but they need different commands.",
    terminalTasks: [
      { id: "find-name", command: "find . -name notes.txt", guideId: "findName", title: "Find a path", prompt: "Search the current tree for notes.txt.", explanation: "Search file and directory names recursively.", success: "You searched paths with find." },
      { id: "find-files", command: "find . -type f", guideId: "findType", title: "Filter to files", prompt: "List regular files below the current directory.", explanation: "Limit a recursive search to files.", success: "You narrowed the search with a type filter." },
      { id: "grep-content", command: "grep Arch notes.txt", guideId: "grep", title: "Search contents", prompt: "Search notes.txt for the word Arch.", explanation: "Search text inside a file.", success: "You searched file contents with grep." },
    ],
    takeaways: [
      "find searches the filesystem tree; grep searches text content.",
      "Use quotes around patterns when the shell could interpret special characters.",
      "Start with a narrow path before searching a large tree.",
    ],
    exercise: {
      question: "Which command searches inside a file for matching text?",
      options: [
        { id: "grep", label: "grep Arch notes.txt" },
        { id: "find", label: "find . -name Arch" },
        { id: "which", label: "which Arch" },
      ],
      correctOptionId: "grep",
      hint: "Choose the command designed to search file contents.",
      success: "Exactly. grep searches text, while find searches paths.",
    },
    source: {
      label: "Read the Linux Command Handbook",
      href: "https://www.freecodecamp.org/news/the-linux-commands-handbook/",
    },
  },
  {
    id: "text-tools",
    module: "Search and text",
    number: "11",
    title: "Read text in slices",
    duration: "7 min",
    summary: "Long output is easier to understand when you ask focused questions. Preview the beginning, inspect the end, count lines, and sort a file.",
    terminalTasks: [
      { id: "head", command: "head -n 1 notes.txt", guideId: "head", title: "Read the beginning", prompt: "Print the first line of notes.txt.", explanation: "Preview the start of a file.", success: "You read only the beginning of the file." },
      { id: "tail", command: "tail -n 1 notes.txt", guideId: "tail", title: "Read the end", prompt: "Print the final line of notes.txt.", explanation: "Preview the end of a file.", success: "You inspected the end without printing everything." },
      { id: "wc", command: "wc -l notes.txt", guideId: "wc", title: "Count lines", prompt: "Count the lines in notes.txt.", explanation: "Measure a file by line count.", success: "You asked wc for a concrete size signal." },
      { id: "sort", command: "sort notes.txt", guideId: "sort", title: "Sort output", prompt: "Print the notes in sorted order.", explanation: "Sort lines alphabetically.", success: "You sorted output without modifying the source file." },
    ],
    takeaways: [
      "head and tail are useful for logs and large files.",
      "wc answers simple size questions before you process data.",
      "sort changes the order of output, not the file itself.",
    ],
    exercise: {
      question: "Which command shows the last lines of a log?",
      options: [
        { id: "tail", label: "tail -n 10 app.log" },
        { id: "head", label: "head -n 10 app.log" },
        { id: "wc", label: "wc -l app.log" },
      ],
      correctOptionId: "tail",
      hint: "Think about the command whose name describes the end of a file.",
      success: "Right. tail is the usual starting point for watching recent log lines.",
    },
    source: {
      label: "Read the Linux Command Handbook",
      href: "https://www.freecodecamp.org/news/the-linux-commands-handbook/",
    },
  },
  {
    id: "permissions",
    module: "Permissions",
    number: "12",
    title: "Read and change permissions",
    duration: "8 min",
    summary: "Linux files carry permissions for the owner, group, and everyone else. Inspect them first, then make one deliberate change in the virtual filesystem.",
    terminalTasks: [
      { id: "ls-long", command: "ls -l notes.txt", guideId: "lsLong", title: "Inspect permissions", prompt: "Print the long listing for notes.txt.", explanation: "Read mode, owner, size, and timestamp details.", success: "You inspected permissions before changing them." },
      { id: "chmod", command: "chmod 600 notes.txt", guideId: "chmod", title: "Restrict a file", prompt: "Give the owner read and write access, and remove access for everyone else.", explanation: "Change a file's permission mode.", success: "You changed permissions in the virtual filesystem." },
      { id: "chown", command: "chown student:student notes.txt", guideId: "chown", title: "Set ownership", prompt: "Set notes.txt to the student user and group.", explanation: "Change a file's simulated owner and group.", success: "You set the simulated ownership explicitly." },
    ],
    takeaways: [
      "The first permission triplet belongs to the owner, then group, then others.",
      "chmod changes access; chown changes ownership.",
      "Never change permissions recursively until you understand the target tree.",
    ],
    exercise: {
      question: "What does chmod change?",
      options: [
        { id: "mode", label: "A file's permission mode" },
        { id: "content", label: "A file's text content" },
        { id: "path", label: "A file's parent directory" },
      ],
      correctOptionId: "mode",
      hint: "chmod contains the word mode.",
      success: "Correct. chmod changes who can read, write, or execute a path.",
    },
    source: {
      label: "Read the Linux Command Handbook",
      href: "https://www.freecodecamp.org/news/the-linux-commands-handbook/",
    },
  },
  {
    id: "archives",
    module: "Archives",
    number: "13",
    title: "Bundle files safely",
    duration: "7 min",
    summary: "Archives are a practical way to group files for transfer or backup. Build one, inspect it, then compress it without touching the host machine.",
    terminalTasks: [
      { id: "tar-create", command: "tar -cf notes.tar notes.txt", guideId: "tarCreate", title: "Create an archive", prompt: "Create notes.tar containing notes.txt.", explanation: "Bundle a file into a tar archive.", success: "You created a simulated tar archive." },
      { id: "tar-list", command: "tar -tf notes.tar", guideId: "tarList", title: "Inspect an archive", prompt: "List the contents of notes.tar without extracting it.", explanation: "Inspect archive contents before extraction.", success: "You checked the archive before unpacking it." },
      { id: "gzip", command: "gzip notes.tar", guideId: "gzip", title: "Compress the archive", prompt: "Compress notes.tar with gzip.", explanation: "Compress an archive into a .gz file.", success: "You compressed the archive in the virtual filesystem." },
    ],
    takeaways: [
      "tar groups files; gzip compresses data.",
      "Inspect an archive before extracting it into a real directory.",
      "Use -k when you need to keep the original file during compression.",
    ],
    exercise: {
      question: "Which command lists an archive without extracting it?",
      options: [
        { id: "list", label: "tar -tf archive.tar" },
        { id: "extract", label: "tar -xf archive.tar" },
        { id: "compress", label: "gzip archive.tar" },
      ],
      correctOptionId: "list",
      hint: "The t flag asks tar to list its table of contents.",
      success: "Exactly. Inspecting first avoids unpacking unknown files blindly.",
    },
    source: {
      label: "Read the Linux Command Handbook",
      href: "https://www.freecodecamp.org/news/the-linux-commands-handbook/",
    },
  },
  {
    id: "processes",
    module: "Processes",
    number: "14",
    title: "Observe running processes",
    duration: "6 min",
    summary: "A process is a running program. Learn to inspect the process table and understand what a signal would do before using one on a real system.",
    terminalTasks: [
      { id: "ps", command: "ps", guideId: "ps", title: "List processes", prompt: "Print the simulated process table.", explanation: "Show processes attached to this session.", success: "You inspected processes before trying to stop anything." },
      { id: "top", command: "top -n 1", guideId: "top", title: "Read a live-style view", prompt: "Take one simulated snapshot of process activity.", explanation: "View a compact activity snapshot.", success: "You read a process snapshot without starting a persistent loop." },
      { id: "kill", command: "kill 1001", guideId: "kill", title: "Preview a signal", prompt: "Send a simulated TERM signal to process 1001.", explanation: "Practice the shape of a process signal safely.", success: "You practiced kill without affecting a real process." },
    ],
    takeaways: [
      "ps gives a point-in-time process list; top is designed for repeated observation.",
      "kill sends a signal. It does not always mean immediate deletion.",
      "Identify the correct PID before sending a signal on a real machine.",
    ],
    exercise: {
      question: "What does ps primarily show?",
      options: [
        { id: "processes", label: "Running processes" },
        { id: "packages", label: "Installed packages" },
        { id: "permissions", label: "File permissions" },
      ],
      correctOptionId: "processes",
      hint: "ps is short for process status.",
      success: "Correct. ps is a first tool for seeing what is running.",
    },
    source: {
      label: "Read the Linux Command Handbook",
      href: "https://www.freecodecamp.org/news/the-linux-commands-handbook/",
    },
  },
  {
    id: "environment",
    module: "Environment",
    number: "15",
    title: "Understand your shell environment",
    duration: "7 min",
    summary: "Commands inherit an environment of named values. Inspect it, set one temporary value, and learn how the shell resolves a command.",
    terminalTasks: [
      { id: "type", command: "type pacman", guideId: "type", title: "Ask the shell", prompt: "Ask the shell what kind of command pacman is.", explanation: "Inspect how the shell resolves a command.", success: "You asked the shell to explain its command lookup." },
      { id: "export", command: "export COURSE=arch", guideId: "export", title: "Set a variable", prompt: "Set a COURSE variable to arch for this session.", explanation: "Add a value to the current shell environment.", success: "You set a session-only environment variable." },
      { id: "printenv", command: "printenv COURSE", guideId: "printenv", title: "Read one variable", prompt: "Print the COURSE variable you just set.", explanation: "Read one environment variable.", success: "You verified the value instead of assuming it was exported." },
      { id: "env", command: "env", guideId: "env", title: "Inspect the environment", prompt: "Print the environment available to this safe shell.", explanation: "List the current environment values.", success: "You inspected the environment that commands inherit." },
    ],
    takeaways: [
      "export makes a variable available to commands started from the shell.",
      "which and type answer related but different command lookup questions.",
      "Environment values are session state. Do not put secrets in them casually.",
    ],
    exercise: {
      question: "Which command prints the value of one environment variable?",
      options: [
        { id: "printenv", label: "printenv PATH" },
        { id: "export", label: "export PATH=/tmp" },
        { id: "env-set", label: "env PATH" },
      ],
      correctOptionId: "printenv",
      hint: "Choose the command whose name means print environment.",
      success: "Yes. printenv can show one variable or the whole environment.",
    },
    source: {
      label: "Read the Linux Command Handbook",
      href: "https://www.freecodecamp.org/news/the-linux-commands-handbook/",
    },
  },
  {
    id: "productivity",
    module: "Shell productivity",
    number: "16",
    title: "Make the shell yours",
    duration: "7 min",
    summary: "A few shell features reduce repetition without hiding what is happening. Create an alias, use it, inspect history, and clear the screen deliberately.",
    terminalTasks: [
      { id: "clear", command: "clear", guideId: "clear", title: "Reset your view", prompt: "Clear the terminal display before the next exercise.", explanation: "Remove old output from the terminal view.", success: "You cleared the view. The session state remains intact." },
      { id: "alias", command: "alias ll='ls -la'", guideId: "alias", title: "Create a shortcut", prompt: "Create an ll alias for ls -la.", explanation: "Give a frequently used command a short name.", success: "You created a temporary shell alias." },
      { id: "alias-use", command: "ll", guideId: "alias", title: "Use the shortcut", prompt: "Run the alias you just created.", explanation: "Use a command shortcut in the current session.", success: "You used the alias and saw the expanded command's result." },
      { id: "history", command: "history", guideId: "history", title: "Review your trail", prompt: "Print the commands entered in this practice session.", explanation: "Review recent shell commands.", success: "You reviewed your command history." },
    ],
    takeaways: [
      "Aliases are convenience layers, not new programs.",
      "history helps you recover what you actually typed.",
      "clear removes output from view; it does not undo a command.",
    ],
    exercise: {
      question: "What does clear change?",
      options: [
        { id: "screen", label: "The terminal display" },
        { id: "history", label: "The command history" },
        { id: "filesystem", label: "The filesystem" },
      ],
      correctOptionId: "screen",
      hint: "It changes what you see, not what has happened.",
      success: "Correct. clear cleans the display and leaves the session state alone.",
    },
    source: {
      label: "Read the Linux Command Handbook",
      href: "https://www.freecodecamp.org/news/the-linux-commands-handbook/",
    },
  },
];

const DEFAULT_PROGRESS: Progress = {
  activeLessonId: "terminal",
  lessonStates: {},
};

const INITIAL_TERMINAL_LINES: readonly TerminalDisplayLine[] = [
  { kind: "output", text: "Safe browser shell. Type help to see the allowlisted commands." },
  { kind: "output", text: "Nothing runs on your computer and nothing leaves this page." },
];

const iconPaths: Record<IconName, readonly string[]> = {
  arrow: ["M5 12h14", "m13 6 6 6-6 6"],
  book: ["M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5z", "M4 5.5v16", "M8 7h8", "M8 11h6"],
  check: ["m5 12 4 4L19 6"],
  clock: ["M12 7v5l3 2", "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"],
  copy: ["M8 8V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-3", "M4 9a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"],
  database: ["M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3Z", "M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6", "M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"],
  external: ["M14 4h6v6", "m20 4-9 9", "M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5"],
  lock: ["M6 10h12v10H6z", "M8 10V7a4 4 0 0 1 8 0v3"],
  refresh: ["M20 11a8 8 0 0 0-14.9-3L3 11", "M3 5v6h6", "M4 13a8 8 0 0 0 14.9 3L21 13", "M21 19v-6h-6"],
  search: ["m21 21-4.3-4.3", "M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14Z"],
  shield: ["M12 3 20 6v6c0 5-3.4 8.2-8 10-4.6-1.8-8-5-8-10V6z", "m9 12 2 2 4-4"],
  spark: ["m12 3-1.4 5.6L5 10l5.6 1.4L12 17l1.4-5.6L19 10l-5.6-1.4Z", "m19 16-.7 2.3L16 19l2.3.7L19 22l.7-2.3L22 19l-2.3-.7Z"],
  terminal: ["M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z", "m6 10 3 2-3 2", "h5"],
};

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      className="icon"
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
    >
      {iconPaths[name].map((path) => (
        <path key={path} d={path} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      ))}
    </svg>
  );
}

function isLessonId(value: unknown): value is LessonId {
  return typeof value === "string" && LESSONS.some((lesson) => lesson.id === value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function lessonStateFor(progress: Progress, lessonId: LessonId): LessonState {
  return progress.lessonStates[lessonId] ?? EMPTY_LESSON_STATE;
}

function updateLessonState(progress: Progress, lessonId: LessonId, update: (state: LessonState) => LessonState): Progress {
  const currentState = lessonStateFor(progress, lessonId);

  return {
    ...progress,
    lessonStates: {
      ...progress.lessonStates,
      [lessonId]: update(currentState),
    },
  };
}

function isLessonComplete(lesson: Lesson, progress: Progress): boolean {
  const state = lessonStateFor(progress, lesson.id);

  return state.quizPassed && lesson.terminalTasks.every((task) => state.completedTaskIds.includes(task.id));
}

function readProgress(): Progress {
  const raw = window.localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    return DEFAULT_PROGRESS;
  }

  try {
    const parsed: unknown = JSON.parse(raw);

    if (!isRecord(parsed)) {
      return DEFAULT_PROGRESS;
    }

    const activeLessonId = isLessonId(parsed.activeLessonId) ? parsed.activeLessonId : DEFAULT_PROGRESS.activeLessonId;
    const lessonStates: Partial<Record<LessonId, LessonState>> = {};

    if (isRecord(parsed.lessonStates)) {
      for (const lesson of LESSONS) {
        const rawState = parsed.lessonStates[lesson.id];

        if (!isRecord(rawState)) {
          continue;
        }

        const completedTaskIds = Array.isArray(rawState.completedTaskIds)
          ? rawState.completedTaskIds.filter((taskId): taskId is string => typeof taskId === "string" && lesson.terminalTasks.some((task) => task.id === taskId))
          : [];

        lessonStates[lesson.id] = {
          completedTaskIds: [...new Set(completedTaskIds)],
          quizPassed: rawState.quizPassed === true,
        };
      }
    }

    return {
      activeLessonId,
      lessonStates,
    };
  } catch {
    return DEFAULT_PROGRESS;
  }
}

function lessonIcon(lessonId: LessonId): IconName {
  switch (lessonId) {
    case "terminal":
      return "terminal";
    case "filesystem":
      return "book";
    case "workspace":
      return "terminal";
    case "pacman-install":
      return "database";
    case "pacman-query":
      return "search";
    case "cleanup":
      return "refresh";
    case "tools":
      return "search";
    case "services":
      return "shield";
    case "file-operations":
      return "book";
    case "search-files":
      return "search";
    case "text-tools":
      return "terminal";
    case "permissions":
      return "lock";
    case "archives":
      return "database";
    case "processes":
      return "refresh";
    case "environment":
      return "spark";
    case "productivity":
      return "clock";
    default: {
      const _exhaustive: never = lessonId;
      return _exhaustive;
    }
  }
}

export default function Home() {
  const [progress, setProgress] = useState<Progress>(() => {
    if (typeof window === "undefined") {
      return DEFAULT_PROGRESS;
    }

    return readProgress();
  });
  const [hydrated, setHydrated] = useState(false);
  const [copied, setCopied] = useState(false);
  const [exerciseState, setExerciseState] = useState<ExerciseState>({
    lessonId: DEFAULT_PROGRESS.activeLessonId,
    selectedOptionId: null,
    status: "idle",
  });
  const [terminalSession, setTerminalSession] = useState<TerminalSession>(() => createInitialTerminalSession());
  const [terminalLines, setTerminalLines] = useState<readonly TerminalDisplayLine[]>(INITIAL_TERMINAL_LINES);
  const [terminalInput, setTerminalInput] = useState("");

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setHydrated(true));

    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (hydrated) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    }
  }, [hydrated, progress]);

  const visibleProgress = hydrated ? progress : DEFAULT_PROGRESS;
  const activeLesson = LESSONS.find((lesson) => lesson.id === visibleProgress.activeLessonId) ?? LESSONS[0];
  const activeIndex = LESSONS.findIndex((lesson) => lesson.id === activeLesson.id);
  const activeLessonState = lessonStateFor(visibleProgress, activeLesson.id);
  const completedTaskCount = activeLesson.terminalTasks.filter((task) => activeLessonState.completedTaskIds.includes(task.id)).length;
  const terminalObjectivesComplete = completedTaskCount === activeLesson.terminalTasks.length;
  const activeLessonComplete = isLessonComplete(activeLesson, visibleProgress);
  const currentTask = activeLesson.terminalTasks.find((task) => !activeLessonState.completedTaskIds.includes(task.id)) ?? activeLesson.terminalTasks[activeLesson.terminalTasks.length - 1];
  const nextLesson = activeLessonComplete ? LESSONS[activeIndex + 1] : undefined;
  const completedCount = LESSONS.filter((lesson) => isLessonComplete(lesson, visibleProgress)).length;
  const terminalGoalCount = LESSONS.reduce((count, lesson) => count + lesson.terminalTasks.length, 0);
  const progressPercent = Math.round((completedCount / LESSONS.length) * 100);
  const isExerciseForActiveLesson = exerciseState.lessonId === activeLesson.id;
  const exerciseStatus = isExerciseForActiveLesson ? exerciseState.status : "idle";
  const selectedOptionId = isExerciseForActiveLesson ? exerciseState.selectedOptionId : null;

  function openLesson(lesson: Lesson) {
    const lessonIndex = LESSONS.findIndex((item) => item.id === lesson.id);
    const previousLesson = LESSONS[lessonIndex - 1];
    const unlocked = lessonIndex === 0 || (previousLesson !== undefined && isLessonComplete(previousLesson, progress));

    if (!unlocked) {
      return;
    }

    setProgress((current) => ({ ...current, activeLessonId: lesson.id }));
    setExerciseState({ lessonId: lesson.id, selectedOptionId: null, status: "idle" });
    setTerminalSession(createInitialTerminalSession());
    setTerminalLines(INITIAL_TERMINAL_LINES);
    setTerminalInput("");
    document.getElementById("lesson")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function answerExercise(optionId: string) {
    if (!terminalObjectivesComplete) {
      return;
    }

    const isCorrect = optionId === activeLesson.exercise.correctOptionId;

    setExerciseState({
      lessonId: activeLesson.id,
      selectedOptionId: optionId,
      status: isCorrect ? "correct" : "incorrect",
    });

    if (isCorrect) {
      setProgress((current) => updateLessonState(current, activeLesson.id, (state) => ({
        ...state,
        quizPassed: true,
      })));
    }
  }

  async function copyActiveCommand() {
    await navigator.clipboard.writeText(activeLesson.terminalTasks[0].command);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  function scrollToLesson() {
    document.getElementById("lesson")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function resetTerminal() {
    setTerminalSession(createInitialTerminalSession());
    setTerminalLines(INITIAL_TERMINAL_LINES);
    setTerminalInput("");
  }

  function submitTerminalCommand(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const command = terminalInput.trim();

    if (!command) {
      return;
    }

    const result = runTerminalCommand(command, terminalSession);
    const commandLine: TerminalDisplayLine = { kind: "command", text: `${terminalSession.cwd} $ ${command}` };
    const completedTaskIds = activeLessonState.completedTaskIds;
    const nextTask = activeLesson.terminalTasks.find((task) => !completedTaskIds.includes(task.id));
    const matchedTask = nextTask?.command === result.normalizedInput ? nextTask : undefined;
    const nextSession: TerminalSession = {
      ...result.session,
      history: [...terminalSession.history, command],
    };

    setTerminalSession(nextSession);
    setTerminalInput("");

    const successLine: TerminalDisplayLine | undefined = result.kind !== "error" && matchedTask
      ? { kind: "output", text: `✓ ${matchedTask.success}` }
      : undefined;

    if (result.kind === "clear") {
      setTerminalLines(successLine ? [successLine] : []);
    } else {
      const responseLine: TerminalDisplayLine = { kind: result.kind, text: result.text };
      setTerminalLines((current) => [...current, commandLine, ...(responseLine.text ? [responseLine] : []), ...(successLine ? [successLine] : [])]);
    }

    if (matchedTask && result.kind !== "error") {
      setProgress((current) => updateLessonState(current, activeLesson.id, (state) => ({
        ...state,
        completedTaskIds: state.completedTaskIds.includes(matchedTask.id)
          ? state.completedTaskIds
          : [...state.completedTaskIds, matchedTask.id],
      })));
    }
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup">
          <span aria-hidden="true" className="brand-mark">
            <span />
            <span />
            <span />
          </span>
          <span className="brand-name">I learn arch btw</span>
        </div>

        <div className="sidebar-heading">Arch foundations</div>
        <p className="sidebar-intro">Read the field. Run the command. Keep what sticks.</p>
        <div className="path-card">
          <div className="path-card-topline">
            <span>Path progress</span>
            <span>{progressPercent}%</span>
          </div>
          <div className="progress-track dark-track">
            <span style={{ transform: `scaleX(${progressPercent / 100})` }} />
          </div>
          <p>{completedCount} of {LESSONS.length} lessons complete</p>
        </div>

        <nav aria-label="Course lessons" className="lesson-nav">
          {LESSONS.map((lesson, index) => {
            const completed = isLessonComplete(lesson, visibleProgress);
            const previousLesson = LESSONS[index - 1];
            const unlocked = index === 0 || (previousLesson !== undefined && isLessonComplete(previousLesson, visibleProgress));
            const active = lesson.id === activeLesson.id;

            return (
              <button
                aria-current={active ? "step" : undefined}
                className={`lesson-nav-item ${active ? "is-active" : ""} ${completed ? "is-complete" : ""} ${!unlocked ? "is-locked" : ""}`}
                disabled={!unlocked}
                key={lesson.id}
                onClick={() => openLesson(lesson)}
                type="button"
              >
                <span className="lesson-nav-icon">
                  {completed ? <Icon name="check" size={15} /> : unlocked ? <Icon name={lessonIcon(lesson.id)} size={15} /> : <Icon name="lock" size={14} />}
                </span>
                <span className="lesson-nav-copy">
                  <span className="lesson-nav-number">{lesson.number} / {lesson.module}</span>
                  <span>{lesson.title}</span>
                </span>
                {active && <span className="nav-active-dot" />}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <a href="https://wiki.archlinux.org/" rel="noreferrer" target="_blank">
            <span className="footer-icon"><Icon name="external" size={15} /></span>
            <span><strong>Arch Wiki</strong><small>The source behind the lessons</small></span>
          </a>
          <div className="local-note"><span className="save-dot" /> Progress saved locally</div>
        </div>
      </aside>

      <section className="content-shell">
        <header className="topbar">
          <div className="breadcrumb"><span>Course</span><span>/</span><strong>Arch foundations</strong></div>
          <div className="topbar-status"><span className="save-dot" />{hydrated ? "Saved locally" : "Loading path"}<span className="topbar-divider" />No account needed</div>
        </header>

        <div className="page-content">
          <section className="hero-panel">
            <div className="hero-copy">
              <div className="hero-index">FIELD 01 / {String(LESSONS.length).padStart(2, "0")}</div>
              <h1>Arch, one <em>command</em> at a time.</h1>
              <p>Build a working Linux vocabulary. Learn what each command does, run it in the practice shell, then prove you got it.</p>
              <button className="primary-button hero-button" onClick={nextLesson ? () => openLesson(nextLesson) : scrollToLesson} type="button">
                <span>{completedCount === 0 ? "Start the course" : nextLesson ? "Continue learning" : "Review the course"}</span>
                <span className="button-icon"><Icon name="arrow" size={17} /></span>
              </button>
              <div className="hero-meta"><span><Icon name="clock" size={15} /> About 2 hours</span><span><Icon name="shield" size={15} /> Safe browser practice</span></div>
            </div>
            <div aria-hidden="true" className="hero-visual">
              <div className="data-field-header"><span>LIVE INPUT / SAFE MODE</span><strong>{String(activeIndex + 1).padStart(2, "0")}</strong></div>
              <div className="data-field">
                <div className="data-bars" aria-hidden="true">
                  <span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span />
                </div>
                <div className="data-field-grid" aria-hidden="true"><span /><span /><span /><span /><span /><span /><span /><span /></div>
                <div className="terminal-window">
                  <div className="terminal-bar"><span /><span /><span /><b>arch-practice</b><i>READY</i></div>
                  <div className="terminal-line"><span className="terminal-prompt">~ $</span> pacman -Syu</div>
                  <div className="terminal-muted">:: Synchronizing package databases...</div>
                  <div className="terminal-muted"> core  132.4 KiB  1.8 MiB/s 00:00</div>
                  <div className="terminal-success">:: Starting full system upgrade...</div>
                  <div className="terminal-cursor"><span className="terminal-prompt">~ $</span><i /></div>
                </div>
                <div className="data-field-caption"><span>TRACE / command → result → recall</span><span>{String(completedCount).padStart(2, "0")} MARKED</span></div>
              </div>
              <div className="visual-caption"><span className="caption-bar" /> Small commands. Real understanding.</div>
            </div>
          </section>

          <section aria-label="Course stats" className="stats-row">
            <div className="register-item register-primary"><span className="stat-label">Course progress</span><strong>{progressPercent}<small>%</small></strong><div className="progress-track light-track"><span style={{ transform: `scaleX(${progressPercent / 100})` }} /></div><span className="stat-foot">{completedCount} / {LESSONS.length} lessons marked</span></div>
            <div className="register-item"><span className="stat-label">Terminal goals</span><strong>{terminalGoalCount}</strong><span className="stat-foot">Every command is hands-on</span></div>
            <div className="register-item register-note"><span className="stat-label"><Icon name="spark" size={15} /> Learner note</span><p>You do not need to memorize flags. Learn how to look them up.</p></div>
          </section>

          <section className="continue-header">
            <div>
              <div className="section-label">ACTIVE RUN / LESSON {activeLesson.number}</div>
              <h2>Build your command line muscle.</h2>
            </div>
            <div className="continue-count"><span>{String(activeIndex + 1).padStart(2, "0")}</span> / {String(LESSONS.length).padStart(2, "0")}</div>
          </section>

          <section className="learning-grid" id="lesson">
            <article className="lesson-card">
              <div className="lesson-card-header">
                <div className="lesson-kicker"><span className="lesson-kicker-icon"><Icon name={lessonIcon(activeLesson.id)} size={17} /></span><span>{activeLesson.module}</span><span className="kicker-separator" /><span>Lesson {activeLesson.number}</span></div>
                <span className="duration"><Icon name="clock" size={15} /> {activeLesson.duration}</span>
              </div>
              <h2>{activeLesson.title}</h2>
              <p className="lesson-summary">{activeLesson.summary}</p>

              <div className="command-heading"><span>Command guide</span><button aria-label="Copy first command" className="copy-button" onClick={copyActiveCommand} type="button"><Icon name={copied ? "check" : "copy"} size={15} /> {copied ? "Copied" : "Copy first"}</button></div>
              <div className="command-guide-list">
                {activeLesson.terminalTasks.map((task, index) => (
                  <details className="command-guide-card" key={task.id} name="command-guide" open={index === 0}>
                    <summary className="command-guide-summary"><span className="command-guide-index">{String(index + 1).padStart(2, "0")}</span><code>{task.command}</code><span className="command-guide-toggle" aria-hidden="true">+</span></summary>
                    <div className="command-guide-content">
                      <p>{COMMAND_GUIDES[task.guideId].purpose}</p>
                      <div className="command-guide-syntax"><span>Syntax</span><code>{COMMAND_GUIDES[task.guideId].syntax}</code></div>
                      {COMMAND_GUIDES[task.guideId].parts.length > 0 && <div className="command-guide-parts"><span>Flags and parts</span><ul>{COMMAND_GUIDES[task.guideId].parts.map((part) => <li key={`${task.id}-${part.token}`}><code>{part.token}</code><span>{part.meaning}</span></li>)}</ul></div>}
                      <p className="command-guide-note">{COMMAND_GUIDES[task.guideId].note}</p>
                    </div>
                  </details>
                ))}
              </div>

              <div className="terminal-practice">
                <div className="terminal-practice-header">
                  <div>
                    <div className="terminal-practice-label"><Icon name="terminal" size={15} /> Practice in the browser</div>
                    <h3>{terminalObjectivesComplete ? "Terminal objectives complete" : currentTask.title}</h3>
                  </div>
                  <span className="safe-badge"><span /> Safe mode</span>
                </div>
                <p className="terminal-task-prompt">{terminalObjectivesComplete ? "You completed every command objective. Take the quiz below to unlock the next lesson." : currentTask.prompt}</p>
                <div className="terminal-objectives" aria-label="Terminal objectives">
                  <div className="terminal-objectives-heading"><span>Objectives</span><strong>{completedTaskCount}/{activeLesson.terminalTasks.length}</strong></div>
                  <ol>
                    {activeLesson.terminalTasks.map((task, index) => {
                      const completed = activeLessonState.completedTaskIds.includes(task.id);

                      return (
                        <li className={completed ? "is-complete" : index === completedTaskCount ? "is-current" : ""} key={task.id}>
                          <span className="terminal-objective-marker">{completed ? <Icon name="check" size={12} /> : index + 1}</span>
                          <span><strong>{task.title}</strong><code>{task.command}</code></span>
                        </li>
                      );
                    })}
                  </ol>
                </div>
                <div className="practice-terminal">
                  <div className="practice-terminal-bar"><span><i /><i /><i /></span><b>arch-practice</b><button aria-label="Reset practice terminal" onClick={resetTerminal} type="button"><Icon name="refresh" size={14} /></button></div>
                  <div className="practice-terminal-body" role="log" aria-live="polite">
                    {terminalLines.map((line, index) => <div className={`terminal-output-line terminal-line-${line.kind}`} key={`${line.kind}-${index}-${line.text}`}><span>{line.kind === "command" ? "" : line.kind === "error" ? "!" : ""}</span>{line.text}</div>)}
                    <form className="terminal-input-row" onSubmit={submitTerminalCommand}>
                      <label htmlFor="practice-terminal-input">{terminalSession.cwd} $</label>
                      <input autoComplete="off" id="practice-terminal-input" onChange={(event) => setTerminalInput(event.target.value)} spellCheck={false} value={terminalInput} />
                    </form>
                  </div>
                </div>
                <div className="terminal-task-footer">
                  <span className={terminalObjectivesComplete ? "task-complete" : ""}>{terminalObjectivesComplete ? <><Icon name="check" size={13} /> All terminal objectives passed. Take the quiz next.</> : <><span className="task-arrow">↳</span> Objective {completedTaskCount + 1} of {activeLesson.terminalTasks.length}.</>}</span>
                  {activeLessonComplete && nextLesson && <button className="terminal-next-button" onClick={() => openLesson(nextLesson)} type="button">Next lesson <Icon name="arrow" size={14} /></button>}
                </div>
                <div className="terminal-disclaimer"><Icon name="shield" size={14} /> This is a browser-only practice shell. It cannot access your computer or run arbitrary commands.</div>
              </div>

              <div className="takeaway-heading"><span>Keep in your pocket</span><span className="takeaway-line" /></div>
              <ul className="takeaway-list">
                {activeLesson.takeaways.map((takeaway) => <li key={takeaway}><span><Icon name="check" size={13} /></span>{takeaway}</li>)}
              </ul>

              <a className="source-link" href={activeLesson.source.href} rel="noreferrer" target="_blank"><span>{activeLesson.source.label}</span><Icon name="external" size={14} /></a>
            </article>

            <aside className={`exercise-card ${terminalObjectivesComplete ? "" : "is-locked"}`}>
              <div className="exercise-topline"><span className="exercise-label"><Icon name={terminalObjectivesComplete ? "spark" : "lock"} size={15} /> {terminalObjectivesComplete ? "Knowledge check" : "Quiz locked"}</span><span className="exercise-number">{activeLesson.number} / {String(LESSONS.length).padStart(2, "0")}</span></div>
              <h3>{terminalObjectivesComplete ? "Make it stick." : "Finish the terminal first."}</h3>
              <p className="exercise-question">{activeLesson.exercise.question}</p>
              {!terminalObjectivesComplete && <div className="exercise-locked-copy"><Icon name="lock" size={14} /> Complete every terminal objective above to unlock this quiz.</div>}
              <div className="option-list">
                {activeLesson.exercise.options.map((option) => {
                  const selected = selectedOptionId === option.id;
                  const correct = exerciseStatus === "correct" && selected;
                  const incorrect = exerciseStatus === "incorrect" && selected;

                  return (
                    <button aria-pressed={selected} className={`option-button ${selected ? "is-selected" : ""} ${correct ? "is-correct" : ""} ${incorrect ? "is-incorrect" : ""}`} disabled={exerciseStatus === "correct" || !terminalObjectivesComplete} key={option.id} onClick={() => answerExercise(option.id)} type="button">
                      <span className="option-marker">{correct ? <Icon name="check" size={14} /> : String.fromCharCode(65 + activeLesson.exercise.options.indexOf(option))}</span>
                      <code>{option.label}</code>
                    </button>
                  );
                })}
              </div>
              {exerciseStatus === "idle" && terminalObjectivesComplete && <p className="exercise-help">Choose an answer to check your understanding.</p>}
              {exerciseStatus === "incorrect" && <div className="feedback feedback-error"><span className="feedback-icon">!</span><p>Not quite. {activeLesson.exercise.hint}</p></div>}
              {exerciseStatus === "correct" && <div className={`feedback ${activeLessonComplete ? "feedback-success" : "feedback-pending"}`}><span className="feedback-icon"><Icon name="check" size={15} /></span><div><strong>{activeLessonComplete ? "Lesson complete." : "Quiz passed."}</strong><p>{activeLessonComplete ? activeLesson.exercise.success : `Finish ${activeLesson.terminalTasks.length - completedTaskCount} terminal objective${activeLesson.terminalTasks.length - completedTaskCount === 1 ? "" : "s"} to unlock the next lesson.`}</p></div></div>}
              {exerciseStatus === "correct" && activeLessonComplete && nextLesson && <button className="next-button" onClick={() => openLesson(nextLesson)} type="button"><span>Next lesson</span><Icon name="arrow" size={17} /></button>}
              {exerciseStatus === "correct" && activeLessonComplete && !nextLesson && <div className="course-complete"><Icon name="spark" size={17} /> You finished the path.</div>}
            </aside>
          </section>

          <section className="reference-section">
            <div className="reference-header"><div><div className="section-label">REFERENCE / PACMAN</div><h2>Package queries at a glance.</h2></div><a href="https://wiki.archlinux.org/title/Pacman" rel="noreferrer" target="_blank">Full pacman guide <Icon name="external" size={14} /></a></div>
            <div className="reference-grid">
              <div className="reference-card"><span className="reference-icon"><Icon name="database" size={17} /></span><code>pacman -Q</code><p>List all installed packages.</p></div>
              <div className="reference-card"><span className="reference-icon"><Icon name="search" size={17} /></span><code>pacman -Qs term</code><p>Search installed packages.</p></div>
              <div className="reference-card"><span className="reference-icon"><Icon name="book" size={17} /></span><code>pacman -Qi name</code><p>Read package details.</p></div>
              <div className="reference-card"><span className="reference-icon"><Icon name="terminal" size={17} /></span><code>pacman -Ql name</code><p>List a package&apos;s files.</p></div>
            </div>
          </section>

          <footer className="page-footer"><span>Made for the curious.</span><span>I learn arch btw / 2026</span><a href="https://wiki.archlinux.org/" rel="noreferrer" target="_blank">Source material from Arch Wiki <Icon name="external" size={13} /></a></footer>
        </div>
      </section>
    </main>
  );
}
