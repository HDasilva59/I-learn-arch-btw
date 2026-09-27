"use client";

import { useEffect, useState, type FormEvent } from "react";

import {
  explainCommand,
  type CommandExplanation,
  type CommandGuide,
} from "./command-explainer";
import {
  createInitialTerminalSession,
  parseTerminalSession,
  runTerminalCommand,
  type TerminalLine,
  type TerminalSession,
} from "./terminal";
import {
  dueReviewCount,
  recordLearningDay,
  recordTaskAttempt,
  type AchievementId,
  type ReviewRecord,
  type StreakState,
} from "./learning";

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
  challenge?: Challenge;
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

type TerminalTask = {
  id: string;
  command: string;
  guideId: keyof typeof COMMAND_GUIDES;
  title: string;
  prompt: string;
  explanation: string;
  success: string;
};

type ChallengeStep = {
  id: string;
  title: string;
  prompt: string;
  command: string;
  guideId: keyof typeof COMMAND_GUIDES;
  check: ChallengeCheck;
};

type ChallengeCheck =
  | { kind: "output-includes"; text: string }
  | { kind: "exists"; path: string; entryKind: "file" | "directory" }
  | { kind: "file-content"; path: string; text: string }
  | { kind: "mode"; path: string; mode: string }
  | { kind: "moved"; from: string; to: string };

type Challenge = {
  id: string;
  title: string;
  summary: string;
  steps: readonly [ChallengeStep, ...ChallengeStep[]];
  success: string;
};

type LessonState = {
  completedTaskIds: readonly string[];
  quizPassed: boolean;
};

type ChallengeState = {
  completedStepIds: readonly string[];
};

type Progress = {
  activeLessonId: LessonId;
  lessonStates: Partial<Record<LessonId, LessonState>>;
  challengeStates: Readonly<Record<string, ChallengeState>>;
  reviewRecords: Readonly<Record<string, ReviewRecord>>;
  streak: StreakState;
  achievements: readonly AchievementId[];
};

type ExerciseState = {
  lessonId: LessonId;
  selectedOptionId: string | null;
  status: "idle" | "correct" | "incorrect";
};

type TerminalDisplayLine = TerminalLine | { kind: "command"; text: string };

type ReviewTarget = {
  lesson: Lesson;
  task: TerminalTask;
  key: string;
};

const STORAGE_KEY = "i-learn-arch-btw-progress-v3";
const LEGACY_STORAGE_KEY = "i-learn-arch-btw-progress-v2";
const TERMINAL_STORAGE_KEY = "i-learn-arch-btw-terminal-v1";

const EMPTY_LESSON_STATE: LessonState = {
  completedTaskIds: [],
  quizPassed: false,
};

const ACHIEVEMENT_LABELS: readonly { id: AchievementId; label: string }[] = [
  { id: "first-command", label: "First command" },
  { id: "error-decoder", label: "Error decoder" },
  { id: "three-day-streak", label: "Three-day streak" },
  { id: "mission-complete", label: "Mission complete" },
];

const TAR_GUIDE_PARTS = [
  { token: "-c", meaning: "Create a new archive." },
  { token: "-x", meaning: "Extract archive members into the filesystem." },
  { token: "-t", meaning: "List the archive table of contents." },
  { token: "-r", meaning: "Append files to an existing archive." },
  { token: "-u", meaning: "Append files only when they are newer than the archived copy." },
  { token: "-d", meaning: "Compare archive members with the files on disk." },
  { token: "--delete", meaning: "Remove members from an uncompressed archive." },
  { token: "-f", meaning: "Use the next argument as the archive filename." },
  { token: "-C", meaning: "Change directory before processing following file names." },
  { token: "-v", meaning: "Print each file as tar processes it." },
  { token: "-z", meaning: "Use gzip compression or decompression." },
  { token: "-j", meaning: "Use bzip2 compression or decompression." },
  { token: "-J", meaning: "Use xz compression or decompression." },
  { token: "--zstd", meaning: "Use Zstandard compression or decompression." },
  { token: "-a", meaning: "Choose compression from the archive filename suffix when creating." },
  { token: "-O", meaning: "Extract file contents to standard output instead of creating files." },
  { token: "-T", meaning: "Read file names from a file instead of only from arguments." },
  { token: "--exclude", meaning: "Skip members matching a pattern." },
  { token: "--strip-components", meaning: "Remove leading path components when extracting." },
  { token: "-k", meaning: "Keep existing files instead of overwriting them during extraction." },
  { token: "-p", meaning: "Preserve file permissions when extracting." },
  { token: "-P", meaning: "Keep absolute path names. Use only when the archive is trusted." },
  { token: "--numeric-owner", meaning: "Use numeric user and group IDs instead of looking up names." },
  { token: "--no-same-owner", meaning: "Do not try to restore archived ownership when extracting." },
  { token: "--one-file-system", meaning: "Do not cross filesystem boundaries while creating an archive." },
  { token: "--remove-files", meaning: "Remove source files after adding them to the archive." },
  { token: "--checkpoint", meaning: "Print a progress message after a chosen number of records." },
  { token: "--checkpoint-action", meaning: "Run an action when a checkpoint is reached; inspect it carefully." },
] satisfies CommandGuide["parts"];

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
      { token: "--needed", meaning: "Skip packages that are already up to date." },
      { token: "--noconfirm", meaning: "Skip confirmation prompts. Use only when the transaction is fully understood." },
      { token: "--downloadonly", meaning: "Download packages without installing them." },
      { token: "--print", meaning: "Print the targets instead of performing the transaction." },
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
      { token: "--needed", meaning: "Skip packages that are already up to date." },
      { token: "--noconfirm", meaning: "Skip confirmation prompts. Use only when the transaction is fully understood." },
      { token: "--asdeps", meaning: "Mark the package as a dependency instead of an explicitly requested package." },
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
      { token: "--noconfirm", meaning: "Skip confirmation prompts. Never use this to avoid reviewing the removal list." },
      { token: "--print", meaning: "Print the targets instead of removing them." },
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
      { token: "-print0", meaning: "Print each matching path separated by a NUL byte, which is safe for unusual filenames." },
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
      { token: "-20", meaning: "Print only the first 20 lines." },
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
    parts: TAR_GUIDE_PARTS,
    note: "The archive filename follows -f. Keep the option and filename together while reading the command. tar groups files; compression is a separate layer.",
  },
  tarList: {
    purpose: "List an archive's entries without extracting them.",
    syntax: "tar -tf archive.tar",
    parts: TAR_GUIDE_PARTS,
    note: "Inspect unknown archives before extracting them into a real directory.",
  },
  tarExtract: {
    purpose: "Extract archive members into the current directory or a chosen destination.",
    syntax: "tar -xf archive.tar [members...]",
    parts: TAR_GUIDE_PARTS,
    note: "Inspect an unknown archive with tar -tf first. Be especially careful with absolute paths, path traversal, and files that could overwrite existing configuration.",
  },
  tarAppend: {
    purpose: "Append files to the end of an existing uncompressed archive.",
    syntax: "tar -rf archive.tar file...",
    parts: TAR_GUIDE_PARTS,
    note: "Appending does not rewrite earlier archive members. The last copy of a name is normally the one extracted later.",
  },
  tarUpdate: {
    purpose: "Append files only when their filesystem copy is newer than the archive member.",
    syntax: "tar -uf archive.tar file...",
    parts: TAR_GUIDE_PARTS,
    note: "tar -u also appends new archive members, so the archive can contain older and newer copies of the same path.",
  },
  tarDiff: {
    purpose: "Compare archive members with the corresponding files on disk.",
    syntax: "tar -df archive.tar [members...]",
    parts: TAR_GUIDE_PARTS,
    note: "This reports differences without extracting or rewriting the archive.",
  },
  tarDelete: {
    purpose: "Remove named members from an uncompressed archive.",
    syntax: "tar --delete -f archive.tar member...",
    parts: TAR_GUIDE_PARTS,
    note: "Deletion rewrites the archive and is not supported for compressed archives. Keep a backup if the archive matters.",
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
  basename: {
    purpose: "Remove the directory part from a path and print the remaining filename.",
    syntax: "basename [options] path [suffix]",
    parts: [
      { token: "-a", meaning: "Process every path argument instead of only the first." },
      { token: "-s", meaning: "Remove the chosen suffix from the result." },
      { token: "-z", meaning: "End each result with a NUL byte instead of a newline." },
    ],
    note: "basename extracts a name. It does not check whether the path exists.",
  },
  dirname: {
    purpose: "Remove the final filename component from a path and print its directory.",
    syntax: "dirname [options] path",
    parts: [
      { token: "-z", meaning: "End the result with a NUL byte instead of a newline." },
    ],
    note: "dirname works on the text of a path. It does not need the path to exist.",
  },
  file: {
    purpose: "Identify the type of a file from its contents and metadata.",
    syntax: "file [options] path",
    parts: [
      { token: "-b", meaning: "Print the file type without the filename." },
      { token: "-i", meaning: "Print a MIME type and character encoding." },
      { token: "-L", meaning: "Follow symbolic links and inspect their targets." },
      { token: "-z", meaning: "Inspect the contents of compressed files." },
    ],
    note: "file detects formats. It does not open a file in an editor or guarantee that a file is safe.",
  },
  ln: {
    purpose: "Create a hard link or symbolic link to a file or directory.",
    syntax: "ln [options] target link-name",
    parts: [
      { token: "-s", meaning: "Create a symbolic link instead of a hard link." },
      { token: "-f", meaning: "Remove an existing destination before creating the link." },
      { token: "-i", meaning: "Ask before replacing an existing destination." },
      { token: "-n", meaning: "Treat a symlink to a directory as a normal destination." },
      { token: "-v", meaning: "Print each link as it is created." },
    ],
    note: "A symbolic link stores a path. A hard link points to the same filesystem data and usually cannot cross filesystems.",
  },
  readlink: {
    purpose: "Print the target stored in a symbolic link or resolve a path.",
    syntax: "readlink [options] path",
    parts: [
      { token: "-f", meaning: "Resolve every symlink and make the final path absolute." },
      { token: "-e", meaning: "Resolve links only when every part of the path exists." },
      { token: "-m", meaning: "Resolve links without requiring the path to exist." },
      { token: "-n", meaning: "Do not print the final newline." },
    ],
    note: "readlink reads link metadata. It does not follow a link and execute what it points to.",
  },
  realpath: {
    purpose: "Print a canonical absolute path with symbolic links and dot segments resolved.",
    syntax: "realpath [options] path",
    parts: [
      { token: "-e", meaning: "Require every part of the path to exist." },
      { token: "-m", meaning: "Allow missing path components while resolving the name." },
      { token: "-L", meaning: "Follow logical links before resolving dot segments." },
      { token: "-P", meaning: "Resolve physical links before resolving dot segments." },
    ],
    note: "realpath normalizes names. It does not create directories or files.",
  },
  rmdir: {
    purpose: "Remove empty directories.",
    syntax: "rmdir [options] directory",
    parts: [
      { token: "-p", meaning: "Remove empty parent directories after the target." },
      { token: "-v", meaning: "Print a message for each directory removed." },
      { token: "--ignore-fail-on-non-empty", meaning: "Ignore a failure caused by a non-empty directory." },
    ],
    note: "rmdir refuses non-empty directories. Use rm -r only when you have checked the complete tree.",
  },
  du: {
    purpose: "Estimate how much disk space files and directories use.",
    syntax: "du [options] [path]",
    parts: [
      { token: "-h", meaning: "Use readable units such as KiB, MiB, and GiB." },
      { token: "-s", meaning: "Print one total for each argument instead of every child." },
      { token: "-a", meaning: "Include files as well as directories." },
      { token: "-d", meaning: "Limit how many directory levels are reported." },
      { token: "-x", meaning: "Stay on the same filesystem." },
    ],
    note: "du measures directory contents. df measures free space on mounted filesystems.",
  },
  df: {
    purpose: "Report free and used space on mounted filesystems.",
    syntax: "df [options] [path]",
    parts: [
      { token: "-h", meaning: "Use readable units such as GiB and MiB." },
      { token: "-T", meaning: "Include the filesystem type." },
      { token: "-i", meaning: "Report inode usage instead of block usage." },
      { token: "-a", meaning: "Include pseudo, duplicate, and inaccessible filesystems." },
      { token: "-x", meaning: "Exclude a filesystem type from the report." },
    ],
    note: "df answers whether a filesystem is full. Check both space and inodes when writes fail unexpectedly.",
  },
  stat: {
    purpose: "Print detailed metadata about a file or filesystem.",
    syntax: "stat [options] path",
    parts: [
      { token: "-c", meaning: "Print metadata using a custom format." },
      { token: "--printf", meaning: "Print metadata using a format string without adding a final newline automatically." },
      { token: "-f", meaning: "Report the filesystem instead of the file." },
      { token: "-L", meaning: "Follow symbolic links." },
      { token: "-t", meaning: "Print compact machine-readable output." },
    ],
    note: "stat can reveal permissions, ownership, size, timestamps, and inode information.",
  },
  install: {
    purpose: "Copy a file while setting its permissions, owner, or destination directory.",
    syntax: "install [options] source destination",
    parts: [
      { token: "-D", meaning: "Create missing parent directories before copying." },
      { token: "-m", meaning: "Set the destination permission mode." },
      { token: "-o", meaning: "Set the destination owner." },
      { token: "-g", meaning: "Set the destination group." },
      { token: "-s", meaning: "Strip symbols from an installed executable." },
      { token: "-v", meaning: "Print each installation action." },
    ],
    note: "install is common in package and build scripts. It can create directories and change ownership.",
  },
  chgrp: {
    purpose: "Change the group ownership recorded for a file or directory.",
    syntax: "chgrp [options] group path",
    parts: [
      { token: "-R", meaning: "Apply the group change recursively to a directory tree." },
      { token: "-h", meaning: "Change a symbolic link itself instead of its target." },
      { token: "--reference", meaning: "Copy the group from another reference path." },
    ],
    note: "Changing group ownership may require administrator privileges and affects access checks.",
  },
  mktemp: {
    purpose: "Create a unique temporary file or directory.",
    syntax: "mktemp [options] template",
    parts: [
      { token: "-d", meaning: "Create a directory instead of a file." },
      { token: "-p", meaning: "Create the item inside a chosen temporary directory." },
      { token: "--suffix", meaning: "Append a chosen suffix after the random part." },
      { token: "-u", meaning: "Print a name without creating it. This can create race conditions." },
    ],
    note: "Prefer mktemp over guessing a temporary filename. Do not use -u when another process could create the same name.",
  },
  shred: {
    purpose: "Overwrite a file to make ordinary recovery harder before removing it.",
    syntax: "shred [options] file",
    parts: [
      { token: "-n", meaning: "Overwrite the file this many times." },
      { token: "-z", meaning: "Add a final zero-filled overwrite." },
      { token: "-u", meaning: "Remove the file after overwriting it." },
      { token: "-v", meaning: "Print progress information." },
    ],
    note: "shred is not reliable on copy-on-write, journaling, compressed, or flash filesystems. Encryption is a stronger design choice.",
  },
  truncate: {
    purpose: "Change a file to a chosen size, usually by removing or adding zero bytes.",
    syntax: "truncate [options] file",
    parts: [
      { token: "-s", meaning: "Set the new size, such as 0, +1K, or -1M." },
      { token: "--no-create", meaning: "Do not create the file when it does not exist." },
      { token: "--reference", meaning: "Use another file's size as the target size." },
    ],
    note: "truncate can destroy file contents immediately when the new size is smaller.",
  },
  sed: {
    purpose: "Transform or filter text one line at a time.",
    syntax: "sed [options] 'script' [file]",
    parts: [
      { token: "-n", meaning: "Suppress automatic printing so a script can choose what to show." },
      { token: "-E", meaning: "Use extended regular expressions." },
      { token: "-i", meaning: "Edit files in place instead of only printing transformed text." },
      { token: "-e", meaning: "Add a script to execute." },
      { token: "-f", meaning: "Read scripts from a file." },
    ],
    note: "sed prints its result by default. Treat -i as a write operation and test the expression without it first.",
  },
  awk: {
    purpose: "Read structured text, select fields, and run small data-processing programs.",
    syntax: "awk [options] 'program' [file]",
    parts: [
      { token: "-F", meaning: "Set the input field separator." },
      { token: "-v", meaning: "Set a variable before the program starts." },
      { token: "-f", meaning: "Read the awk program from a file." },
      { token: "$1", meaning: "Refer to the first field on the current input line." },
      { token: "$0", meaning: "Refer to the complete current input line." },
    ],
    note: "awk is a programming language as well as a command. Quote its program so the shell does not expand it first.",
  },
  cut: {
    purpose: "Select columns or character ranges from each input line.",
    syntax: "cut [options] [file]",
    parts: [
      { token: "-d", meaning: "Use a chosen delimiter instead of a tab." },
      { token: "-f", meaning: "Select fields by number or range." },
      { token: "-c", meaning: "Select character positions." },
      { token: "-b", meaning: "Select byte positions." },
      { token: "--complement", meaning: "Select everything except the chosen positions." },
    ],
    note: "cut works best with predictable delimiters. Use awk when fields need conditions or calculations.",
  },
  tr: {
    purpose: "Translate, delete, or squeeze characters from standard input.",
    syntax: "tr [options] set1 [set2]",
    parts: [
      { token: "-d", meaning: "Delete characters found in the first set." },
      { token: "-s", meaning: "Collapse repeated characters into one." },
      { token: "-c", meaning: "Use the complement of the first set." },
      { token: "-t", meaning: "Trim the first set to the length of the second before translating." },
    ],
    note: "tr reads standard input. Pair it with a pipe or input redirection when the source is a file.",
  },
  tee: {
    purpose: "Copy standard input to the terminal and one or more files at the same time.",
    syntax: "tee [options] file",
    parts: [
      { token: "-a", meaning: "Append to the file instead of replacing it." },
      { token: "-i", meaning: "Ignore an interrupt signal while writing." },
    ],
    note: "tee is useful when a pipeline should show its output and save a copy. The destination file can still be overwritten.",
  },
  uniq: {
    purpose: "Remove or report adjacent repeated lines.",
    syntax: "uniq [options] [input [output]]",
    parts: [
      { token: "-c", meaning: "Prefix each line with its number of repetitions." },
      { token: "-d", meaning: "Print only lines that repeat." },
      { token: "-u", meaning: "Print only lines that appear once." },
      { token: "-i", meaning: "Compare lines without considering letter case." },
      { token: "-f", meaning: "Skip this many fields before comparing." },
    ],
    note: "uniq only detects repetitions next to each other. Sort input first when duplicates can be separated.",
  },
  tac: {
    purpose: "Print input lines in reverse order.",
    syntax: "tac [options] [file]",
    parts: [
      { token: "-s", meaning: "Use a chosen separator instead of a newline." },
      { token: "-b", meaning: "Attach the separator before each record." },
      { token: "-r", meaning: "Treat the separator as a regular expression." },
    ],
    note: "tac is cat backwards. It prints a transformed view and does not edit the source file.",
  },
  nl: {
    purpose: "Number the lines of text.",
    syntax: "nl [options] [file]",
    parts: [
      { token: "-b", meaning: "Choose which lines receive numbers." },
      { token: "-n", meaning: "Choose the number alignment and format." },
      { token: "-w", meaning: "Choose the width of the number field." },
      { token: "-s", meaning: "Choose the separator after each line number." },
    ],
    note: "nl is a formatting command. It does not change the input file.",
  },
  paste: {
    purpose: "Join corresponding lines from files side by side.",
    syntax: "paste [options] files",
    parts: [
      { token: "-d", meaning: "Use chosen delimiters between columns." },
      { token: "-s", meaning: "Combine each file's lines serially instead of side by side." },
    ],
    note: "Use paste to combine columns. It reads lines as records and does not parse CSV quoting rules.",
  },
  split: {
    purpose: "Split a file or standard input into smaller output files.",
    syntax: "split [options] [file [prefix]]",
    parts: [
      { token: "-l", meaning: "Split after this many lines." },
      { token: "-b", meaning: "Split after this many bytes." },
      { token: "-n", meaning: "Split into this many output pieces." },
      { token: "-d", meaning: "Use numeric suffixes instead of alphabetic suffixes." },
      { token: "-a", meaning: "Choose the length of the output suffix." },
    ],
    note: "split creates files with a prefix. Check the destination directory before creating many pieces.",
  },
  comm: {
    purpose: "Compare two sorted files line by line in three columns.",
    syntax: "comm [options] file1 file2",
    parts: [
      { token: "-1", meaning: "Hide lines found only in the first file." },
      { token: "-2", meaning: "Hide lines found only in the second file." },
      { token: "-3", meaning: "Hide lines found in both files." },
      { token: "--check-order", meaning: "Require both inputs to be sorted." },
    ],
    note: "comm expects sorted input. Use sort first when the files are not already ordered.",
  },
  diff: {
    purpose: "Show line-by-line differences between files or directories.",
    syntax: "diff [options] file1 file2",
    parts: [
      { token: "-u", meaning: "Use the compact unified diff format." },
      { token: "-c", meaning: "Use the context diff format." },
      { token: "-r", meaning: "Compare directory trees recursively." },
      { token: "-q", meaning: "Report only whether files differ." },
      { token: "-w", meaning: "Ignore all whitespace differences." },
    ],
    note: "diff reports changes; it does not apply them. Use patch or a version-control tool to apply a reviewed diff.",
  },
  xargs: {
    purpose: "Build and run commands from items read on standard input.",
    syntax: "xargs [options] command",
    parts: [
      { token: "-0", meaning: "Read NUL-separated items, which safely handles spaces in filenames." },
      { token: "-n", meaning: "Pass at most this many input items per command invocation." },
      { token: "-P", meaning: "Run this many command invocations in parallel." },
      { token: "-I", meaning: "Replace a placeholder in the command with each input item." },
      { token: "-t", meaning: "Print each command before running it." },
      { token: "-p", meaning: "Ask for confirmation before each command." },
    ],
    note: "xargs executes generated commands. Prefer -0 with find -print0 and add -p or -t while learning.",
  },
  seq: {
    purpose: "Print a sequence of numbers.",
    syntax: "seq [options] first [increment] last",
    parts: [
      { token: "-w", meaning: "Pad numbers with leading zeroes to equal width." },
      { token: "-f", meaning: "Format each number using a printf-style format." },
      { token: "-s", meaning: "Use a chosen separator between numbers." },
    ],
    note: "seq generates text. It does not loop by itself; scripts often use it with a shell loop or xargs.",
  },
  date: {
    purpose: "Print or format the current date and time, or parse a date expression.",
    syntax: "date [options] [+format]",
    parts: [
      { token: "-u", meaning: "Use Coordinated Universal Time instead of local time." },
      { token: "-d", meaning: "Format a date described by a human-readable string." },
      { token: "-I", meaning: "Print an ISO 8601 date or timestamp." },
      { token: "-R", meaning: "Print an RFC 5322 date and time." },
      { token: "+%Y-%m-%d", meaning: "Use a format string for the output fields." },
    ],
    note: "date displays time by default. Setting the system clock is a separate privileged operation.",
  },
  printf: {
    purpose: "Print formatted text without the portability surprises of echo.",
    syntax: "printf format [arguments]",
    parts: [
      { token: "%s", meaning: "Insert a string argument." },
      { token: "%d", meaning: "Insert an integer argument." },
      { token: "\\n", meaning: "Insert a newline escape." },
      { token: "-v", meaning: "In Bash, assign formatted output to a variable instead of printing it." },
    ],
    note: "printf is both a Bash builtin and a standalone utility. Quote format strings and user input separately.",
  },
  hostname: {
    purpose: "Print or inspect the system hostname and related name information.",
    syntax: "hostname [options]",
    parts: [
      { token: "-s", meaning: "Print only the short hostname before the first dot." },
      { token: "-f", meaning: "Print the fully qualified domain name." },
      { token: "-i", meaning: "Print the host's address." },
      { token: "-I", meaning: "Print all configured addresses." },
    ],
    note: "Reading a hostname is harmless. Setting one changes system identity and usually needs administrator privileges.",
  },
  id: {
    purpose: "Print the user ID, group ID, and group memberships.",
    syntax: "id [options] [user]",
    parts: [
      { token: "-u", meaning: "Print only the effective user ID." },
      { token: "-g", meaning: "Print only the effective group ID." },
      { token: "-G", meaning: "Print all group IDs." },
      { token: "-n", meaning: "Print names instead of numeric IDs." },
      { token: "-r", meaning: "Print the real ID instead of the effective ID." },
    ],
    note: "id helps explain permission errors by showing which identity a process is using.",
  },
  groups: {
    purpose: "Print the groups a user belongs to.",
    syntax: "groups [user]",
    parts: [],
    note: "Group membership can affect access, but a new login may be needed before changes take effect.",
  },
  free: {
    purpose: "Report used and available memory and swap space.",
    syntax: "free [options]",
    parts: [
      { token: "-h", meaning: "Use readable units." },
      { token: "-m", meaning: "Show values in mebibytes." },
      { token: "-g", meaning: "Show values in gibibytes." },
      { token: "-b", meaning: "Show values in bytes." },
      { token: "-s", meaning: "Repeat the report every chosen number of seconds." },
      { token: "-c", meaning: "Stop after this many repeated reports." },
    ],
    note: "The available column includes reclaimable cache. Do not treat cached memory as permanently unavailable.",
  },
  uptime: {
    purpose: "Print how long the system has been running and its load averages.",
    syntax: "uptime [options]",
    parts: [
      { token: "-p", meaning: "Print the uptime in a friendly phrase." },
      { token: "-s", meaning: "Print the time when the system started." },
    ],
    note: "Load average is not a direct CPU percentage. Interpret it alongside the number of CPU threads and current work.",
  },
  lscpu: {
    purpose: "Display information about the CPU architecture and processor topology.",
    syntax: "lscpu [options]",
    parts: [
      { token: "-e", meaning: "Print an extended table of CPU information." },
      { token: "-p", meaning: "Print a parse-friendly comma-separated table." },
      { token: "-J", meaning: "Print the result as JSON." },
      { token: "-B", meaning: "Use byte units instead of human-readable scaling." },
    ],
    note: "lscpu reads system information. It does not change CPU settings.",
  },
  lsblk: {
    purpose: "List block devices such as disks, partitions, and mount points.",
    syntax: "lsblk [options] [device]",
    parts: [
      { token: "-f", meaning: "Include filesystem type, label, UUID, and mount point." },
      { token: "-o", meaning: "Choose the output columns." },
      { token: "-a", meaning: "Include empty devices." },
      { token: "-p", meaning: "Print full device paths." },
      { token: "-J", meaning: "Print the device tree as JSON." },
      { token: "-m", meaning: "Include device ownership and permissions." },
    ],
    note: "lsblk is read-only. Do not confuse a device name with a safe target for formatting or mounting.",
  },
  mount: {
    purpose: "Attach a filesystem to a directory in the filesystem tree, or list mounted filesystems.",
    syntax: "mount [options] device directory",
    parts: [
      { token: "-t", meaning: "Choose the filesystem type." },
      { token: "-o", meaning: "Set mount options such as ro, noexec, or uid." },
      { token: "-a", meaning: "Mount all filesystems listed in the configuration." },
      { token: "-r", meaning: "Mount read-only." },
      { token: "-w", meaning: "Mount read-write when supported." },
    ],
    note: "mount changes system state and commonly needs root. Verify the device and directory before using it.",
  },
  umount: {
    purpose: "Detach a mounted filesystem from the filesystem tree.",
    syntax: "umount [options] device-or-directory",
    parts: [
      { token: "-a", meaning: "Unmount all eligible filesystems." },
      { token: "-l", meaning: "Detach now and clean up references when the filesystem is no longer busy." },
      { token: "-R", meaning: "Recursively unmount a target and its nested mounts." },
      { token: "-f", meaning: "Force an unmount where the filesystem supports it." },
    ],
    note: "Unmounting a busy filesystem can interrupt programs. Check open files and active shells first.",
  },
  dmesg: {
    purpose: "Read messages from the kernel ring buffer.",
    syntax: "dmesg [options]",
    parts: [
      { token: "-T", meaning: "Show readable timestamps when possible." },
      { token: "-w", meaning: "Wait for and print new messages as they arrive." },
      { token: "-H", meaning: "Use a human-friendly pager-like format." },
      { token: "-l", meaning: "Filter messages by priority level." },
      { token: "--since", meaning: "Show messages newer than a time expression." },
    ],
    note: "Some systems restrict kernel logs to root or members of a special group.",
  },
  who: {
    purpose: "Show users currently logged in and their terminals.",
    syntax: "who [options]",
    parts: [
      { token: "-H", meaning: "Print column headings." },
      { token: "-b", meaning: "Print the last system boot time." },
      { token: "-q", meaning: "Print login names and a count." },
      { token: "-u", meaning: "Include idle time and process information." },
    ],
    note: "who reads login records. It does not show every process or every network connection.",
  },
  last: {
    purpose: "Read the login history recorded by the system.",
    syntax: "last [options] [user-or-terminal]",
    parts: [
      { token: "-n", meaning: "Limit the number of displayed records." },
      { token: "-F", meaning: "Print full login and logout timestamps." },
      { token: "-i", meaning: "Print remote IP addresses instead of hostnames." },
      { token: "-x", meaning: "Include system shutdowns and runlevel changes." },
    ],
    note: "last reads historical records. The result depends on log rotation and the system's accounting configuration.",
  },
  ip: {
    purpose: "Inspect and configure network interfaces, addresses, routes, and neighbors.",
    syntax: "ip [options] object command",
    parts: [
      { token: "-br", meaning: "Use a short human-readable summary format." },
      { token: "-c", meaning: "Use color in terminal output." },
      { token: "-j", meaning: "Print output as JSON." },
      { token: "-4", meaning: "Limit the operation to IPv4." },
      { token: "-6", meaning: "Limit the operation to IPv6." },
      { token: "addr", meaning: "Work with interface addresses." },
      { token: "route", meaning: "Work with the routing table." },
    ],
    note: "ip can be read-only or change live networking. Commands such as ip addr add and ip route change are privileged.",
  },
  ping: {
    purpose: "Send network probes and report whether a host responds.",
    syntax: "ping [options] host",
    parts: [
      { token: "-c", meaning: "Stop after sending this many probes." },
      { token: "-i", meaning: "Wait this many seconds between probes." },
      { token: "-W", meaning: "Wait this many seconds for each reply." },
      { token: "-4", meaning: "Use IPv4 only." },
      { token: "-6", meaning: "Use IPv6 only." },
      { token: "-s", meaning: "Choose the size of the probe payload." },
    ],
    note: "A failed ping does not prove that a host is down. Firewalls and routers can block ICMP.",
  },
  ss: {
    purpose: "Inspect sockets and current network connections.",
    syntax: "ss [options]",
    parts: [
      { token: "-t", meaning: "Show TCP sockets." },
      { token: "-u", meaning: "Show UDP sockets." },
      { token: "-l", meaning: "Show listening sockets." },
      { token: "-n", meaning: "Show numeric addresses and ports without DNS lookups." },
      { token: "-p", meaning: "Show the process using each socket." },
      { token: "-a", meaning: "Show listening and non-listening sockets." },
    ],
    note: "ss is the usual modern replacement for netstat. It observes connections and does not open them.",
  },
  curl: {
    purpose: "Transfer data to or from a URL using protocols such as HTTP and HTTPS.",
    syntax: "curl [options] URL",
    parts: [
      { token: "-I", meaning: "Fetch response headers without the response body." },
      { token: "-L", meaning: "Follow HTTP redirects." },
      { token: "-O", meaning: "Save the response using the remote filename." },
      { token: "-o", meaning: "Save the response to a chosen filename." },
      { token: "-s", meaning: "Use silent mode without progress and error messages." },
      { token: "-f", meaning: "Fail with an error status for HTTP error responses." },
      { token: "-X", meaning: "Choose the HTTP method explicitly." },
      { token: "-d", meaning: "Send request data, commonly for a POST request." },
      { token: "-H", meaning: "Add a request header." },
    ],
    note: "curl downloads or sends data. Never pipe an unfamiliar curl response directly into a shell without inspecting it.",
  },
  wget: {
    purpose: "Download files and web resources from URLs.",
    syntax: "wget [options] URL",
    parts: [
      { token: "-O", meaning: "Write the response to a chosen file." },
      { token: "-q", meaning: "Use quiet output." },
      { token: "-c", meaning: "Resume a partial download when the server supports it." },
      { token: "-r", meaning: "Download recursively from links." },
      { token: "-P", meaning: "Choose the destination directory." },
      { token: "--spider", meaning: "Check a URL without downloading its contents." },
    ],
    note: "wget writes downloaded content to disk. Check the URL and destination before using recursive options.",
  },
  ssh: {
    purpose: "Open an encrypted shell session or run a command on another machine.",
    syntax: "ssh [options] user@host [command]",
    parts: [
      { token: "-p", meaning: "Connect to a chosen remote port." },
      { token: "-i", meaning: "Use a chosen private key file." },
      { token: "-L", meaning: "Forward a local port through the SSH connection." },
      { token: "-R", meaning: "Forward a remote port back through the SSH connection." },
      { token: "-N", meaning: "Do not run a remote command, useful for port forwarding." },
      { token: "-T", meaning: "Disable pseudo-terminal allocation." },
      { token: "-v", meaning: "Print verbose connection diagnostics." },
    ],
    note: "ssh can run remote commands with your remote account's permissions. Read the full command before pressing Enter.",
  },
  scp: {
    purpose: "Copy files between local and remote machines over SSH.",
    syntax: "scp [options] source user@host:destination",
    parts: [
      { token: "-r", meaning: "Copy directories recursively." },
      { token: "-P", meaning: "Use a chosen remote SSH port." },
      { token: "-i", meaning: "Use a chosen private key file." },
      { token: "-p", meaning: "Preserve file times and modes." },
      { token: "-q", meaning: "Suppress progress and warning messages." },
    ],
    note: "The direction is determined by which side contains user@host. Check it before copying a directory tree.",
  },
  pgrep: {
    purpose: "Find process IDs whose command lines match a pattern.",
    syntax: "pgrep [options] pattern",
    parts: [
      { token: "-a", meaning: "Print the full command line with each process ID." },
      { token: "-f", meaning: "Match the complete command line instead of only the executable name." },
      { token: "-u", meaning: "Match processes owned by a user." },
      { token: "-x", meaning: "Require the complete name to match." },
      { token: "-n", meaning: "Select the newest matching process." },
      { token: "-o", meaning: "Select the oldest matching process." },
    ],
    note: "pgrep only finds processes. Verify the command line before sending a signal with kill or pkill.",
  },
  pkill: {
    purpose: "Send a signal to processes whose command lines match a pattern.",
    syntax: "pkill [options] pattern",
    parts: [
      { token: "-f", meaning: "Match the complete command line." },
      { token: "-u", meaning: "Match processes owned by a user." },
      { token: "-e", meaning: "Print the name of each process that receives a signal." },
      { token: "-TERM", meaning: "Send a named signal such as TERM instead of the default." },
    ],
    note: "pkill can stop multiple processes at once. Use pgrep first to inspect the exact matches.",
  },
  nice: {
    purpose: "Run a command with a chosen CPU scheduling niceness.",
    syntax: "nice [option] command",
    parts: [
      { token: "-n", meaning: "Add a niceness adjustment to the command's priority." },
    ],
    note: "A higher niceness usually gives a process less scheduling priority. Lowering niceness may require root.",
  },
  nohup: {
    purpose: "Run a command so it can keep running after the terminal closes.",
    syntax: "nohup command [argument]",
    parts: [],
    note: "nohup redirects output to nohup.out when needed. It does not create a service or monitor the process.",
  },
  timeout: {
    purpose: "Run a command for a limited time and send it a signal when the limit expires.",
    syntax: "timeout [options] duration command",
    parts: [
      { token: "-s", meaning: "Choose the signal sent when the duration expires." },
      { token: "-k", meaning: "Send a second kill signal after an additional grace period." },
      { token: "--preserve-status", meaning: "Return the command's status instead of timeout's status." },
    ],
    note: "timeout limits waiting. It does not guarantee that a command exits cleanly when the signal is ignored.",
  },
  su: {
    purpose: "Start a shell or command as another user.",
    syntax: "su [options] [user]",
    parts: [
      { token: "-", meaning: "Start a login shell with the target user's environment." },
      { token: "-c", meaning: "Run one command instead of opening an interactive shell." },
      { token: "-s", meaning: "Choose the shell to run." },
      { token: "-l", meaning: "Start a login shell." },
    ],
    note: "su changes identity for the new process. Check whether the command will write files as the target user.",
  },
  passwd: {
    purpose: "Change or manage a user's password and password status.",
    syntax: "passwd [options] [user]",
    parts: [
      { token: "-l", meaning: "Lock the password so it cannot be used for authentication." },
      { token: "-u", meaning: "Unlock a previously locked password." },
      { token: "-d", meaning: "Delete the password, which can weaken account security." },
      { token: "-e", meaning: "Expire the password and require a change at next login." },
      { token: "-S", meaning: "Show the password status." },
    ],
    note: "Changing another user's password normally needs administrator privileges. Treat -d and account locks as security changes.",
  },
  umask: {
    purpose: "Show or set the permission bits removed from newly created files and directories.",
    syntax: "umask [options] [mode]",
    parts: [
      { token: "-S", meaning: "Print or accept the symbolic permission form." },
    ],
    note: "umask is a shell setting. It affects future creations in the current shell and its child processes, not existing files.",
  },
  command: {
    purpose: "Run a command while bypassing shell functions and aliases, or inspect how Bash resolves a name.",
    syntax: "command [options] command [argument]",
    parts: [
      { token: "-v", meaning: "Print the command resolution in a compact form." },
      { token: "-V", meaning: "Print a more detailed command resolution." },
      { token: "-p", meaning: "Use a default PATH instead of the current PATH." },
    ],
    note: "command is a Bash builtin. It is useful when an alias or function hides the executable you meant to run.",
  },
  help: {
    purpose: "Show Bash's built-in help for shell commands and topics.",
    syntax: "help [options] [pattern]",
    parts: [
      { token: "-d", meaning: "Print a short description of matching builtins." },
      { token: "-m", meaning: "Print help in a manpage-like format." },
      { token: "-s", meaning: "Print only the short usage synopsis." },
    ],
    note: "Use help for Bash builtins such as cd and read. Use man for external programs.",
  },
  source: {
    purpose: "Read and execute commands from a file in the current shell process.",
    syntax: "source file [argument]",
    parts: [
      { token: ".", meaning: "The shorter POSIX spelling of source." },
    ],
    note: "source can change the current shell's variables, aliases, functions, and directory. Inspect the file before sourcing it.",
  },
  unalias: {
    purpose: "Remove one or more aliases from the current shell.",
    syntax: "unalias [options] name",
    parts: [
      { token: "-a", meaning: "Remove every alias in the current shell." },
    ],
    note: "unalias changes only the current shell unless a configuration file is changed separately.",
  },
  read: {
    purpose: "Read a line from standard input and assign words to shell variables.",
    syntax: "read [options] name",
    parts: [
      { token: "-r", meaning: "Keep backslashes instead of treating them as escape characters." },
      { token: "-p", meaning: "Print a prompt before reading." },
      { token: "-s", meaning: "Do not echo input, useful for secrets." },
      { token: "-t", meaning: "Stop waiting after a timeout." },
      { token: "-n", meaning: "Read after this many characters instead of waiting for a newline." },
    ],
    note: "read is a Bash builtin. Use -r for ordinary text so backslashes are not silently changed.",
  },
  test: {
    purpose: "Evaluate a condition and return success or failure for shell control flow.",
    syntax: "test expression",
    parts: [
      { token: "-f", meaning: "Test whether a path is a regular file." },
      { token: "-d", meaning: "Test whether a path is a directory." },
      { token: "-e", meaning: "Test whether a path exists." },
      { token: "-r", meaning: "Test whether a path is readable." },
      { token: "-w", meaning: "Test whether a path is writable." },
      { token: "-x", meaning: "Test whether a path is executable or searchable." },
    ],
    note: "test is commonly written as [ expression ]. The closing ] is a separate token in that form.",
  },
  set: {
    purpose: "Change Bash options or positional parameters for the current shell.",
    syntax: "set [options] [arguments]",
    parts: [
      { token: "-e", meaning: "Exit when a simple command fails, with important exceptions." },
      { token: "-u", meaning: "Treat unset variables as errors when expanded." },
      { token: "-x", meaning: "Print commands after expansion before executing them." },
      { token: "-o", meaning: "Enable a named Bash option such as pipefail." },
      { token: "+e", meaning: "Disable the errexit option." },
    ],
    note: "set changes shell behavior. Read the script context before enabling strict options in an unfamiliar command.",
  },
  unset: {
    purpose: "Remove shell variables or functions from the current shell.",
    syntax: "unset [options] name",
    parts: [
      { token: "-v", meaning: "Remove a variable." },
      { token: "-f", meaning: "Remove a function." },
    ],
    note: "unset changes only the current shell's state. It does not edit the configuration file that originally defined a variable.",
  },
  exec: {
    purpose: "Replace the current shell process with another command.",
    syntax: "exec [options] command [argument]",
    parts: [
      { token: "-c", meaning: "Start the command with an empty environment." },
      { token: "-a", meaning: "Set the value shown as the command's zeroth argument." },
    ],
    note: "exec does not start a child process. In an interactive shell, it can replace your shell session immediately.",
  },
  jobs: {
    purpose: "List background jobs managed by the current interactive shell.",
    syntax: "jobs [options] [job-id]",
    parts: [
      { token: "-l", meaning: "Include process IDs." },
      { token: "-p", meaning: "Print only the process group leaders." },
      { token: "-r", meaning: "Show only running jobs." },
      { token: "-s", meaning: "Show only stopped jobs." },
    ],
    note: "jobs knows only the current shell's job table. It is not the same as ps, which lists system processes.",
  },
  pushd: {
    purpose: "Change directory and push the previous directory onto Bash's directory stack.",
    syntax: "pushd [options] [directory]",
    parts: [
      { token: "-n", meaning: "Rotate the directory stack without changing the current directory." },
    ],
    note: "pushd pairs with popd. The directory stack belongs to the current shell process.",
  },
  popd: {
    purpose: "Remove a directory from Bash's directory stack and change to the new top entry.",
    syntax: "popd [options] [directory-index]",
    parts: [
      { token: "-n", meaning: "Rotate the directory stack without changing the current directory." },
    ],
    note: "popd only works with directories previously placed on the current shell's stack.",
  },
  systemctlStart: {
    purpose: "Start one or more systemd units.",
    syntax: "systemctl start unit",
    parts: [
      { token: "start", meaning: "Activate the named service or unit now." },
      { token: "--no-block", meaning: "Queue the job and return without waiting for it to finish." },
      { token: "--now", meaning: "Start the unit while changing its enablement when used with enable." },
    ],
    note: "start changes live system state. It does not necessarily make a service start automatically at boot.",
  },
  systemctlStop: {
    purpose: "Stop one or more systemd units.",
    syntax: "systemctl stop unit",
    parts: [
      { token: "stop", meaning: "Deactivate the named service or unit now." },
      { token: "--no-block", meaning: "Queue the stop job and return without waiting." },
    ],
    note: "Stopping a service can interrupt applications and network access. Inspect dependencies before doing it remotely.",
  },
  systemctlRestart: {
    purpose: "Stop and then start one or more systemd units.",
    syntax: "systemctl restart unit",
    parts: [
      { token: "restart", meaning: "Stop the unit and start it again." },
      { token: "--no-block", meaning: "Queue the restart and return without waiting." },
    ],
    note: "restart interrupts the service. reload may apply configuration without stopping it when the service supports reload.",
  },
  systemctlEnable: {
    purpose: "Configure a unit to start automatically at boot or login.",
    syntax: "systemctl enable [options] unit",
    parts: [
      { token: "enable", meaning: "Create the links that make the unit start in its target." },
      { token: "--now", meaning: "Enable the unit and start it immediately." },
      { token: "--force", meaning: "Replace conflicting links when enabling the unit." },
    ],
    note: "enable changes future startup behavior. It does not start the unit unless --now is also present.",
  },
  systemctlDisable: {
    purpose: "Configure a unit not to start automatically at boot or login.",
    syntax: "systemctl disable [options] unit",
    parts: [
      { token: "disable", meaning: "Remove the links that enable the unit at startup." },
      { token: "--now", meaning: "Disable the unit and stop it immediately." },
    ],
    note: "disable changes future startup behavior. It does not stop a running unit unless --now is also present.",
  },
  systemctlDaemonReload: {
    purpose: "Ask systemd to reload unit files after their definitions changed on disk.",
    syntax: "systemctl daemon-reload",
    parts: [
      { token: "daemon-reload", meaning: "Re-read unit files without restarting every service." },
    ],
    note: "daemon-reload does not restart services. Restart or reload the affected unit separately when needed.",
  },
  pacmanUpgrade: {
    purpose: "Install or upgrade a package file and its required dependencies.",
    syntax: "sudo pacman -U package-file",
    parts: [
      { token: "-U", meaning: "Upgrade or install from a local package file or URL." },
      { token: "--needed", meaning: "Skip packages that are already up to date." },
      { token: "--noconfirm", meaning: "Skip confirmation prompts. Use only when the full transaction is already controlled." },
    ],
    note: "A local package file can contain install scripts. Verify its origin and signatures before using it.",
  },
  pacmanFiles: {
    purpose: "Search the synchronized package file database for package ownership.",
    syntax: "pacman -F search-term",
    parts: [
      { token: "-F", meaning: "Query the files database instead of installed packages." },
      { token: "-y", meaning: "Refresh the files database before searching." },
      { token: "-l", meaning: "List files owned by a matching package." },
      { token: "-x", meaning: "Treat the search term as a regular expression." },
    ],
    note: "The files database must be synchronized before its results are current. This command does not install anything.",
  },
  pacmanDeptest: {
    purpose: "Check whether named dependencies are currently satisfied.",
    syntax: "pacman -T dependency",
    parts: [
      { token: "-T", meaning: "Run a dependency test and print unsatisfied dependencies." },
    ],
    note: "pacman -T is useful in scripts and returns a status that can be tested by the shell.",
  },
  pacmanHelp: {
    purpose: "Print pacman's general or operation-specific usage help.",
    syntax: "pacman -h",
    parts: [
      { token: "-h", meaning: "Display syntax and available options, then exit." },
    ],
    note: "Use pacman -S --help or pacman -Q --help for operation-specific options.",
  },
  pacmanVersion: {
    purpose: "Print the installed pacman version and exit.",
    syntax: "pacman -V",
    parts: [
      { token: "-V", meaning: "Display version information." },
    ],
    note: "Version output helps explain why an option may differ between systems.",
  },
  dd: {
    purpose: "Copy and transform raw data at the byte level.",
    syntax: "dd [options]",
    parts: [
      { token: "if=", meaning: "Read from this input file instead of standard input." },
      { token: "of=", meaning: "Write to this output file instead of standard output." },
      { token: "bs=", meaning: "Use this input and output block size." },
      { token: "count=", meaning: "Copy only this many blocks." },
      { token: "status=progress", meaning: "Show transfer progress while copying." },
      { token: "conv=", meaning: "Apply a conversion such as sync, noerror, or notrunc." },
    ],
    note: "dd can overwrite disks and partitions without a recycle bin. Recheck if= and of= before running it.",
  },
  base64: {
    purpose: "Encode binary data as Base64 text or decode Base64 text back to bytes.",
    syntax: "base64 [options] [file]",
    parts: [
      { token: "-d", meaning: "Decode Base64 input instead of encoding it." },
      { token: "-w", meaning: "Wrap encoded output after this many characters." },
      { token: "-i", meaning: "Ignore non-alphabet characters while decoding." },
    ],
    note: "Base64 is an encoding, not encryption. Anyone with the text can decode it.",
  },
  sha256sum: {
    purpose: "Calculate or verify SHA-256 checksums for files.",
    syntax: "sha256sum [options] file",
    parts: [
      { token: "-c", meaning: "Read checksum lines and verify the listed files." },
      { token: "-b", meaning: "Read files in binary mode." },
      { token: "-t", meaning: "Read files in text mode." },
      { token: "--tag", meaning: "Print a named BSD-style checksum record." },
    ],
    note: "A matching checksum verifies content identity, not that the source was trustworthy.",
  },
  md5sum: {
    purpose: "Calculate or verify MD5 checksums for files.",
    syntax: "md5sum [options] file",
    parts: [
      { token: "-c", meaning: "Read checksum lines and verify the listed files." },
      { token: "-b", meaning: "Read files in binary mode." },
      { token: "-t", meaning: "Read files in text mode." },
      { token: "--tag", meaning: "Print a named BSD-style checksum record." },
    ],
    note: "MD5 is not suitable for security signatures. Use SHA-256 or a stronger modern hash for integrity decisions.",
  },
  od: {
    purpose: "Print a file's bytes or other representations for inspection.",
    syntax: "od [options] file",
    parts: [
      { token: "-A", meaning: "Choose how input offsets are printed." },
      { token: "-t", meaning: "Choose the output type such as octal, decimal, or hexadecimal." },
      { token: "-x", meaning: "Print hexadecimal output." },
      { token: "-c", meaning: "Print printable characters and escaped control characters." },
    ],
    note: "od is a read-only inspection tool. It is useful when text tools hide non-printing bytes.",
  },
  fold: {
    purpose: "Wrap long input lines to a chosen width.",
    syntax: "fold [options] [file]",
    parts: [
      { token: "-w", meaning: "Wrap after this many columns or bytes." },
      { token: "-s", meaning: "Break at whitespace when possible." },
      { token: "-b", meaning: "Count bytes instead of screen columns." },
    ],
    note: "fold formats output. It does not insert permanent line breaks into the source file.",
  },
  fmt: {
    purpose: "Reformat text paragraphs to fit a chosen line width.",
    syntax: "fmt [options] [file]",
    parts: [
      { token: "-w", meaning: "Set the target line width." },
      { token: "-s", meaning: "Split long lines but do not join short lines." },
      { token: "-u", meaning: "Use uniform spacing between words and sentences." },
    ],
    note: "fmt rewrites formatted output. Redirect it to a new file first when you need to preserve the original.",
  },
  expand: {
    purpose: "Convert tabs in input to spaces.",
    syntax: "expand [options] [file]",
    parts: [
      { token: "-t", meaning: "Choose the tab stop positions." },
      { token: "-i", meaning: "Convert only tabs at the start of lines." },
    ],
    note: "expand is useful before comparing text or sending it to systems that handle tabs differently.",
  },
  unexpand: {
    purpose: "Convert runs of spaces back into tabs where possible.",
    syntax: "unexpand [options] [file]",
    parts: [
      { token: "-a", meaning: "Convert all runs of spaces, not only leading spaces." },
      { token: "-t", meaning: "Choose the tab stop positions." },
    ],
    note: "unexpand changes formatting in its output stream. It does not edit a file in place by itself.",
  },
  join: {
    purpose: "Join lines from two files using a shared field.",
    syntax: "join [options] file1 file2",
    parts: [
      { token: "-t", meaning: "Use a chosen field separator." },
      { token: "-1", meaning: "Use this field from the first file as the join key." },
      { token: "-2", meaning: "Use this field from the second file as the join key." },
      { token: "-a", meaning: "Also print unpaired lines from the chosen file." },
      { token: "-e", meaning: "Use a replacement for missing fields." },
      { token: "-o", meaning: "Choose the output fields and their order." },
    ],
    note: "join expects both files to be sorted by their join field unless you explicitly handle ordering yourself.",
  },
  shuf: {
    purpose: "Randomly permute lines or choose random items.",
    syntax: "shuf [options] [file]",
    parts: [
      { token: "-i", meaning: "Use an integer range instead of a file." },
      { token: "-n", meaning: "Output only this many results." },
      { token: "-r", meaning: "Allow repeated selections." },
      { token: "-e", meaning: "Treat command-line arguments as input items." },
    ],
    note: "shuf is useful for sampling and test data. Its default random source is not a security protocol.",
  },
  sleep: {
    purpose: "Pause for a chosen amount of time.",
    syntax: "sleep duration",
    parts: [
      { token: "s", meaning: "Use seconds as the duration unit." },
      { token: "m", meaning: "Use minutes as the duration unit." },
      { token: "h", meaning: "Use hours as the duration unit." },
      { token: "d", meaning: "Use days as the duration unit." },
    ],
    note: "sleep waits without changing files. A signal can interrupt it before the duration ends.",
  },
  yes: {
    purpose: "Repeatedly print a string until the process is stopped.",
    syntax: "yes [string]",
    parts: [],
    note: "yes can quickly fill a pipe or terminal with output. Never run it without knowing where its output goes.",
  },
  tty: {
    purpose: "Print the terminal device connected to standard input, or report whether one exists.",
    syntax: "tty [options]",
    parts: [
      { token: "-s", meaning: "Print nothing and use the exit status as the result." },
    ],
    note: "tty helps scripts detect whether input or output is connected to an interactive terminal.",
  },
  sync: {
    purpose: "Ask the kernel to flush pending filesystem data to storage.",
    syntax: "sync [options] [file]",
    parts: [
      { token: "-d", meaning: "Synchronize file data without all metadata when supported." },
      { token: "-f", meaning: "Synchronize the filesystem containing a file." },
    ],
    note: "sync asks the kernel to write pending data. It does not repair filesystem corruption or safely remove a device by itself.",
  },
  stty: {
    purpose: "Read or change terminal line settings.",
    syntax: "stty [options] [setting]",
    parts: [
      { token: "-a", meaning: "Print all current terminal settings." },
      { token: "-F", meaning: "Read or change settings for a chosen terminal device." },
      { token: "sane", meaning: "Reset common terminal settings to a usable baseline." },
    ],
    note: "stty changes how the terminal reads and displays input. It can make a session appear broken until settings are reset.",
  },
  sysctl: {
    purpose: "Read or change kernel runtime parameters exposed through /proc/sys.",
    syntax: "sysctl [options] [variable[=value]]",
    parts: [
      { token: "-a", meaning: "Show all available kernel parameters." },
      { token: "-A", meaning: "Alias for -a on procps implementations." },
      { token: "-X", meaning: "Alias for -a on procps implementations." },
      { token: "-n", meaning: "Print only values, without parameter names." },
      { token: "-N", meaning: "Print only parameter names." },
      { token: "-b", meaning: "Print a value as raw binary data without a trailing newline." },
      { token: "-e", meaning: "Ignore errors for unknown variables." },
      { token: "-q", meaning: "Suppress warnings about unknown keys." },
      { token: "-w", meaning: "Write a new value to a kernel parameter." },
      { token: "-p", meaning: "Load parameters from a configuration file, usually /etc/sysctl.conf." },
      { token: "--deprecated", meaning: "Include deprecated parameters in listings." },
      { token: "--dry-run", meaning: "Print the changes without writing them." },
      { token: "-r", meaning: "Apply the operation to keys matching a regular expression." },
      { token: "--system", meaning: "Load settings from the system configuration locations in order." },
    ],
    note: "Reading is usually harmless; writing kernel parameters changes live system behavior and may require root. Check the parameter's documentation first.",
  },
  lsmod: {
    purpose: "List kernel modules currently loaded into the running kernel.",
    syntax: "lsmod",
    parts: [],
    note: "lsmod reads /proc/modules. Use modinfo to inspect a module and modprobe to load one with dependency handling.",
  },
  modprobe: {
    purpose: "Load or remove a kernel module while resolving its dependencies.",
    syntax: "modprobe [options] module",
    parts: [
      { token: "-a", meaning: "Load every module named on the command line." },
      { token: "-b", meaning: "Use the module blacklist when resolving aliases." },
      { token: "-c", meaning: "Show the effective module configuration." },
      { token: "-C", meaning: "Use a chosen module configuration file." },
      { token: "-d", meaning: "Use a chosen directory as the module tree root." },
      { token: "-D", meaning: "Show the module dependencies without changing loaded modules." },
      { token: "-f", meaning: "Force module insertion or removal when supported. This is dangerous." },
      { token: "-i", meaning: "Ignore install or remove commands from module configuration." },
      { token: "-n", meaning: "Dry-run the operation without changing loaded modules." },
      { token: "-q", meaning: "Suppress error messages for missing modules." },
      { token: "-r", meaning: "Remove a module instead of loading it." },
      { token: "-R", meaning: "Resolve an alias without loading the resulting module." },
      { token: "-S", meaning: "Use a selected kernel release instead of the running release." },
      { token: "-s", meaning: "Send messages to the system log." },
      { token: "-v", meaning: "Print more details about the operation." },
      { token: "-w", meaning: "Wait for a module to become unused before removing it." },
      { token: "--show-depends", meaning: "Print the modules that would be loaded as dependencies." },
      { token: "--first-time", meaning: "Fail if the requested module is already loaded." },
      { token: "--force-vermagic", meaning: "Ignore a kernel version mismatch. This can destabilize the system." },
    ],
    note: "Use modprobe rather than insmod when possible because it understands aliases, configuration, and dependencies. Loading or removing modules normally needs root.",
  },
  modinfo: {
    purpose: "Display metadata, parameters, aliases, and dependencies for a kernel module.",
    syntax: "modinfo [options] module",
    parts: [
      { token: "-F", meaning: "Print only one named metadata field." },
      { token: "-k", meaning: "Inspect modules for a specific kernel release." },
      { token: "-n", meaning: "Print the module filename only." },
      { token: "-0", meaning: "Separate fields with NUL bytes for scripts." },
      { token: "-a", meaning: "Show the module author field." },
      { token: "-d", meaning: "Show the module description field." },
      { token: "-l", meaning: "Show the module license field." },
      { token: "-m", meaning: "Treat the argument as a module name rather than an alias or filename." },
      { token: "-p", meaning: "Show parameters accepted by the module." },
      { token: "-b", meaning: "Use a different module tree as the search base." },
    ],
    note: "modinfo inspects module files; it does not load the module.",
  },
  depmod: {
    purpose: "Generate the dependency and alias files used by the kernel module loader.",
    syntax: "depmod [options] [kernel-release]",
    parts: [
      { token: "-a", meaning: "Process all modules for the selected kernel release." },
      { token: "-A", meaning: "Update only when a module is newer than the existing dependency file." },
      { token: "-b", meaning: "Use a different directory as the module-tree root." },
      { token: "-e", meaning: "Report unresolved symbols." },
      { token: "-F", meaning: "Use a System.map file when checking unresolved symbols." },
      { token: "-C", meaning: "Read module configuration from a chosen path." },
      { token: "-n", meaning: "Print the generated dependency data instead of writing it." },
      { token: "-v", meaning: "Print each processed module." },
      { token: "-w", meaning: "Warn about duplicate module files." },
    ],
    note: "Package managers normally run depmod for you. It updates module metadata, not the kernel image itself.",
  },
  insmod: {
    purpose: "Insert one kernel module file into the running kernel.",
    syntax: "insmod [options] module-file [module-parameters]",
    parts: [
      { token: "-f", meaning: "Force insertion despite a version mismatch when supported." },
      { token: "-s", meaning: "Send messages to the system log instead of the terminal." },
      { token: "-v", meaning: "Print more details about the operation." },
      { token: "-V", meaning: "Print the tool version." },
    ],
    note: "insmod does not resolve dependencies. Prefer modprobe for normal module loading, and treat insertion as a root-level system change.",
  },
  rmmod: {
    purpose: "Remove one or more kernel modules from the running kernel.",
    syntax: "rmmod [options] module",
    parts: [
      { token: "-f", meaning: "Force removal when the kernel was built to allow it." },
      { token: "-s", meaning: "Send messages to the system log." },
      { token: "-v", meaning: "Print more details about the operation." },
      { token: "-w", meaning: "Wait for the module to become unused before removing it." },
    ],
    note: "Removing a module can disconnect hardware or break services that depend on it. Check lsmod and the module dependencies first.",
  },
  findmnt: {
    purpose: "List, search, and verify mounted filesystems and mount-table entries.",
    syntax: "findmnt [options] [device|mountpoint]",
    parts: [
      { token: "-A", meaning: "Disable built-in filters and show all filesystems." },
      { token: "-a", meaning: "Use ASCII characters instead of tree-drawing characters." },
      { token: "-b", meaning: "Print sizes in bytes." },
      { token: "-C", meaning: "Do not canonicalize paths while comparing them." },
      { token: "-c", meaning: "Canonicalize paths." },
      { token: "-D", meaning: "Imitate df output and omit pseudo-filesystems." },
      { token: "-J", meaning: "Print JSON output." },
      { token: "-n", meaning: "Hide the column headings." },
      { token: "-o", meaning: "Choose the output columns." },
      { token: "-t", meaning: "Filter by filesystem type." },
      { token: "--verify", meaning: "Check whether the mount table is internally correct." },
      { token: "-p", meaning: "Poll the mount table and report changes." },
      { token: "-x", meaning: "Verify the mount table content." },
    ],
    note: "For scripts, choose explicit output columns with -o and prefer JSON when the consumer supports it.",
  },
  blkid: {
    purpose: "Locate block devices and print filesystem labels, UUIDs, and types.",
    syntax: "blkid [options] [device]",
    parts: [
      { token: "-o", meaning: "Choose the output format, such as value or export." },
      { token: "-s", meaning: "Print only the selected tag." },
      { token: "-p", meaning: "Perform a low-level probing operation." },
      { token: "-c", meaning: "Use a chosen cache file, or /dev/null to bypass the cache." },
      { token: "-d", meaning: "Do not encode non-printing characters in values." },
      { token: "-D", meaning: "Do not print partition-table details." },
      { token: "-i", meaning: "Gather I/O limit information." },
      { token: "-k", meaning: "List known filesystem and RAID types." },
      { token: "-l", meaning: "Return only the first device matching a token." },
      { token: "-L", meaning: "Find the device with a given filesystem label." },
      { token: "-t", meaning: "Find a device matching a NAME=value token." },
      { token: "-U", meaning: "Find the device with a given filesystem UUID." },
      { token: "-n", meaning: "Restrict probing to selected filesystem types." },
      { token: "-w", meaning: "Choose where the cache is written." },
      { token: "-g", meaning: "Gather probing information without printing normal device output." },
    ],
    note: "blkid reads device metadata. Use findmnt to understand how a device is currently mounted.",
  },
  lsns: {
    purpose: "List Linux namespaces and the processes that own them.",
    syntax: "lsns [options] [namespace-type]",
    parts: [
      { token: "-a", meaning: "List all namespaces, including those without a visible process." },
      { token: "-J", meaning: "Print JSON output." },
      { token: "-l", meaning: "Use a list-style output format." },
      { token: "-n", meaning: "Hide the column headings." },
      { token: "-o", meaning: "Choose the output columns." },
      { token: "-P", meaning: "Include persistent namespaces without a visible process." },
      { token: "-p", meaning: "Show only namespaces used by a process ID." },
      { token: "-r", meaning: "Use raw output." },
      { token: "-t", meaning: "Filter by namespace type, such as net or pid." },
      { token: "-T", meaning: "Display namespaces as a tree." },
      { token: "-u", meaning: "Do not truncate text in columns." },
      { token: "-W", meaning: "Do not wrap multi-line values." },
    ],
    note: "Namespaces isolate process views of resources such as PIDs, mounts, users, and networks. lsns only inspects them.",
  },
  nsenter: {
    purpose: "Run a program inside the namespaces of another process.",
    syntax: "nsenter [options] [program [argument...]]",
    parts: [
      { token: "-t", meaning: "Target the namespaces associated with this process ID." },
      { token: "-a", meaning: "Enter all supported namespaces of the target." },
      { token: "-m", meaning: "Enter the target's mount namespace." },
      { token: "-u", meaning: "Enter the target's UTS hostname/domain namespace." },
      { token: "-i", meaning: "Enter the target's IPC namespace." },
      { token: "-n", meaning: "Enter the target's network namespace." },
      { token: "-p", meaning: "Enter the target's PID namespace." },
      { token: "-U", meaning: "Enter the target's user namespace." },
      { token: "-C", meaning: "Enter the target's cgroup namespace." },
      { token: "-T", meaning: "Enter the target's time namespace." },
      { token: "-S", meaning: "Set the user ID inside the entered namespace." },
      { token: "-G", meaning: "Set the group ID inside the entered namespace." },
      { token: "-r", meaning: "Set the root directory inside the entered namespace." },
      { token: "-w", meaning: "Set the working directory inside the entered namespace." },
      { token: "-e", meaning: "Inherit environment variables from the target process." },
      { token: "-F", meaning: "Do not fork before running the program." },
      { token: "--no-fork", meaning: "Long form of -F: do not fork before running the program." },
    ],
    note: "nsenter can make a shell see another process's mounts, network, or process tree. Check the target PID and command carefully.",
  },
  unshare: {
    purpose: "Run a program in newly created Linux namespaces.",
    syntax: "unshare [options] [program [argument...]]",
    parts: [
      { token: "-m", meaning: "Create a new mount namespace." },
      { token: "-u", meaning: "Create a new UTS hostname/domain namespace." },
      { token: "-i", meaning: "Create a new IPC namespace." },
      { token: "-n", meaning: "Create a new network namespace." },
      { token: "-p", meaning: "Create a new PID namespace." },
      { token: "-U", meaning: "Create a new user namespace." },
      { token: "-C", meaning: "Create a new cgroup namespace." },
      { token: "-f", meaning: "Fork before launching the program." },
      { token: "-R", meaning: "Run the command with a selected root directory." },
      { token: "-w", meaning: "Run the command from a selected working directory." },
      { token: "-S", meaning: "Set the user ID in the new user namespace." },
      { token: "-G", meaning: "Set the group ID in the new user namespace." },
      { token: "-r", meaning: "Map the current user to root in the new user namespace." },
      { token: "-c", meaning: "Map the current user to itself in the new user namespace." },
      { token: "--mount-proc", meaning: "Mount a proc filesystem for the new PID namespace." },
      { token: "--map-auto", meaning: "Automatically map subordinate user and group IDs." },
      { token: "--map-root-user", meaning: "Map the current user to root inside a new user namespace." },
      { token: "--keep-caps", meaning: "Keep capabilities across a user-namespace change." },
      { token: "--kill-child", meaning: "Kill the child process when unshare exits." },
    ],
    note: "Namespaces are powerful isolation primitives, not a complete security boundary by themselves. Start with a disposable environment.",
  },
  chrt: {
    purpose: "Read or change a process's scheduling policy and real-time priority.",
    syntax: "chrt [options] priority command [argument...]",
    parts: [
      { token: "-a", meaning: "Operate on all threads of the selected process." },
      { token: "-m", meaning: "Show the available scheduling policies." },
      { token: "-p", meaning: "Inspect or change an existing process instead of launching a command." },
      { token: "-v", meaning: "Print the selected policy and priority." },
      { token: "-b", meaning: "Use the SCHED_BATCH policy." },
      { token: "-o", meaning: "Use the normal SCHED_OTHER policy." },
      { token: "-f", meaning: "Use the first-in-first-out real-time policy." },
      { token: "-r", meaning: "Use the round-robin real-time policy." },
      { token: "-d", meaning: "Use the deadline scheduling policy." },
      { token: "-i", meaning: "Use the idle scheduling policy." },
      { token: "-e", meaning: "Use the SCHED_EXT policy when the kernel provides it." },
      { token: "-R", meaning: "Set the reset-on-fork scheduling flag." },
      { token: "-T", meaning: "Set the runtime parameter for deadline scheduling." },
      { token: "-P", meaning: "Set the period parameter for deadline scheduling." },
      { token: "-D", meaning: "Set the deadline parameter for deadline scheduling." },
    ],
    note: "Real-time scheduling can starve other work. Changing another process usually requires CAP_SYS_NICE or root.",
  },
  taskset: {
    purpose: "Read or set the CPU affinity mask of a process or command.",
    syntax: "taskset [options] mask|cpu-list command [argument...]",
    parts: [
      { token: "-p", meaning: "Operate on an existing process ID." },
      { token: "-c", meaning: "Use a list of CPU numbers instead of a hexadecimal mask." },
      { token: "-a", meaning: "Apply the operation to all threads of the process." },
    ],
    note: "Affinity changes can make a program slower or prevent it from using available CPUs. Confirm the process and CPU list first.",
  },
  prlimit: {
    purpose: "Read or change the resource limits attached to a process.",
    syntax: "prlimit [options] [--resource[=limit]] [command [argument...]]",
    parts: [
      { token: "-p", meaning: "Inspect or change the limits of this process ID." },
      { token: "-o", meaning: "Choose the output columns." },
      { token: "--raw", meaning: "Use raw output without display formatting." },
      { token: "--noheadings", meaning: "Hide the output headings." },
      { token: "--nofile", meaning: "Set the maximum number of open file descriptors." },
      { token: "--stack", meaning: "Set the maximum process stack size." },
      { token: "--as", meaning: "Set the maximum address-space size." },
      { token: "--cpu", meaning: "Set the maximum CPU time." },
      { token: "--nproc", meaning: "Set the maximum number of processes for the user." },
      { token: "--memlock", meaning: "Set the maximum amount of memory that may be locked." },
      { token: "--core", meaning: "Set the maximum size of core dump files." },
      { token: "--data", meaning: "Set the maximum process data-segment size." },
      { token: "--nice", meaning: "Set the maximum nice priority the process may raise to." },
      { token: "--fsize", meaning: "Set the maximum size of files the process may write." },
      { token: "--sigpending", meaning: "Set the maximum number of pending signals." },
      { token: "--rss", meaning: "Set the maximum resident-set size." },
      { token: "--msgqueue", meaning: "Set the maximum POSIX message-queue bytes." },
      { token: "--rtprio", meaning: "Set the maximum real-time scheduling priority." },
      { token: "--rttime", meaning: "Set the CPU-time limit for real-time scheduling." },
      { token: "--locks", meaning: "Set the maximum number of file locks." },
    ],
    note: "A limit can make a service fail in surprising ways. Use prlimit without a new value to inspect before changing anything.",
  },
  setpriv: {
    purpose: "Run a program with selected user IDs, groups, capabilities, or privilege restrictions.",
    syntax: "setpriv [options] program [argument...]",
    parts: [
      { token: "--no-new-privs", meaning: "Prevent the program and its children from gaining new privileges." },
      { token: "--nnp", meaning: "Short alias for --no-new-privs." },
      { token: "--reuid", meaning: "Run with a selected real and effective user ID." },
      { token: "--regid", meaning: "Run with a selected real and effective group ID." },
      { token: "--ruid", meaning: "Set the real user ID." },
      { token: "--euid", meaning: "Set the effective user ID." },
      { token: "--rgid", meaning: "Set the real group ID." },
      { token: "--egid", meaning: "Set the effective group ID." },
      { token: "--clear-groups", meaning: "Discard supplementary groups." },
      { token: "--keep-groups", meaning: "Keep supplementary groups instead of clearing them." },
      { token: "--init-groups", meaning: "Initialize supplementary groups for the selected user." },
      { token: "--groups", meaning: "Set supplementary groups explicitly." },
      { token: "--inh-caps", meaning: "Set the inheritable capability set." },
      { token: "--ambient-caps", meaning: "Set capabilities preserved across execve." },
      { token: "--bounding-set", meaning: "Change the capabilities the process may ever gain." },
      { token: "--keep-caps", meaning: "Keep capabilities across a user-ID change." },
      { token: "--securebits", meaning: "Set securebits controlling privilege transitions." },
      { token: "--pdeathsig", meaning: "Set or clear the signal delivered when the parent dies." },
      { token: "--ptracer", meaning: "Control which process may ptrace the child." },
      { token: "--list-caps", meaning: "List capability names understood by the tool." },
      { token: "--reset-env", meaning: "Clear the environment and initialize a small safe set." },
      { token: "--dump", meaning: "Print the current privilege state instead of launching a program." },
    ],
    note: "setpriv changes the security context of the child process. A wrong UID, group, or capability set can make a program unsafe or unusable.",
  },
  swapon: {
    purpose: "Enable swap devices or files, or list active swap areas.",
    syntax: "swapon [options] [device|file]",
    parts: [
      { token: "-a", meaning: "Enable all swap entries from /etc/fstab." },
      { token: "-s", meaning: "Show a summary of active swap areas." },
      { token: "--show", meaning: "Print active swap areas in a structured table." },
      { token: "-p", meaning: "Set the swap priority." },
      { token: "-d", meaning: "Enable discard support for the swap area." },
      { token: "-f", meaning: "Reinitialize swap space when its page size needs fixing." },
      { token: "-e", meaning: "Skip unavailable swap entries when used with -a." },
      { token: "-o", meaning: "Set swap-specific options." },
      { token: "-T", meaning: "Use an alternate fstab file." },
      { token: "-L", meaning: "Select a swap area by filesystem label." },
      { token: "-U", meaning: "Select a swap area by UUID." },
      { token: "--raw", meaning: "Use raw output with --show." },
      { token: "--noheadings", meaning: "Hide headings in --show output." },
      { token: "--bytes", meaning: "Print swap sizes in bytes with --show." },
    ],
    note: "Enabling swap changes memory-management behavior and generally requires root. Review the device or file before activating it.",
  },
  swapoff: {
    purpose: "Disable an active swap device or file.",
    syntax: "swapoff [options] [device|file]",
    parts: [
      { token: "-a", meaning: "Disable all swap areas listed in /etc/fstab." },
      { token: "-v", meaning: "Print more details about each operation." },
      { token: "-L", meaning: "Select a swap area by filesystem label." },
      { token: "-U", meaning: "Select a swap area by UUID." },
    ],
    note: "The kernel must move used pages elsewhere. Disabling swap with too little free memory can fail or put pressure on the system.",
  },
  findfs: {
    purpose: "Find a block device by a filesystem label, UUID, or other tag.",
    syntax: "findfs LABEL=label|UUID=uuid|PARTUUID=uuid|PARTLABEL=label",
    parts: [],
    note: "findfs prints a device path and does not mount or modify it.",
  },
  fstrim: {
    purpose: "Discard unused blocks on a mounted filesystem, usually for SSD or thin-provisioned storage.",
    syntax: "fstrim [options] mountpoint",
    parts: [
      { token: "-a", meaning: "Trim all mounted filesystems that support it." },
      { token: "-A", meaning: "Trim filesystems listed in /etc/fstab." },
      { token: "-I", meaning: "Trim filesystems listed in selected files." },
      { token: "-o", meaning: "Start trimming at a byte offset." },
      { token: "-l", meaning: "Limit the number of bytes trimmed." },
      { token: "-m", meaning: "Trim only ranges at least this large." },
      { token: "-t", meaning: "Restrict trimming to selected filesystem types." },
      { token: "-v", meaning: "Report how many bytes were discarded." },
      { token: "-n", meaning: "Perform a dry run without discarding blocks." },
      { token: "--quiet", meaning: "Suppress normal output." },
      { token: "--quiet-unsupported", meaning: "Suppress errors when trim is unsupported." },
    ],
    note: "fstrim is a storage operation. Use the mountpoint you intend and check device or filesystem guidance before scheduling it frequently.",
  },
  fsck: {
    purpose: "Check and, when requested, repair filesystems.",
    syntax: "fsck [options] [filesystem]",
    parts: [
      { token: "-A", meaning: "Check filesystems listed in /etc/fstab." },
      { token: "-C", meaning: "Show a progress bar, optionally using a selected file descriptor." },
      { token: "-l", meaning: "Lock the device for exclusive checking." },
      { token: "-N", meaning: "Show what would be done without running the checker." },
      { token: "-M", meaning: "Skip mounted filesystems." },
      { token: "-P", meaning: "Check filesystems in parallel, including the root filesystem." },
      { token: "-R", meaning: "Skip the root filesystem when checking all entries." },
      { token: "-r", meaning: "Report statistics for each checked device." },
      { token: "-s", meaning: "Serialize filesystem checks instead of running them in parallel." },
      { token: "-T", meaning: "Do not print the tool name in the output." },
      { token: "-V", meaning: "Print each filesystem-specific command before running it." },
      { token: "-t", meaning: "Restrict checks to selected filesystem types." },
    ],
    note: "Never repair a mounted filesystem casually. Use -N for an initial dry run, then consult the filesystem-specific checker manual for repair flags.",
  },
  fdisk: {
    purpose: "Inspect and edit partition tables on block devices.",
    syntax: "fdisk [options] device",
    parts: [
      { token: "-l", meaning: "List partition tables without entering the editor." },
      { token: "-b", meaning: "Set the sector size." },
      { token: "-B", meaning: "Protect boot bits when creating a new partition label." },
      { token: "-c", meaning: "Choose DOS or non-DOS compatibility mode." },
      { token: "-L", meaning: "Choose when to use terminal colors." },
      { token: "-n", meaning: "Do not create a default partition table on an empty device." },
      { token: "-o", meaning: "Choose the columns shown in list output." },
      { token: "-t", meaning: "Recognize only a selected partition-table type." },
      { token: "-u", meaning: "Show sectors instead of cylinders in older output modes." },
      { token: "-w", meaning: "Choose when changes are written to the device." },
      { token: "-W", meaning: "Choose when changes are wiped from the device." },
      { token: "-x", meaning: "Use expert mode with additional partition controls." },
    ],
    note: "fdisk can make a disk unbootable or destroy access to data. Inspect with -l first and never guess the device path.",
  },
  partx: {
    purpose: "Tell the kernel about partitions on a block device and list or remove them from the kernel's view.",
    syntax: "partx [options] device",
    parts: [
      { token: "-a", meaning: "Add partitions to the kernel's partition table." },
      { token: "-d", meaning: "Delete partitions from the kernel's partition table." },
      { token: "-s", meaning: "Show partition sizes in sectors." },
      { token: "-u", meaning: "Update existing partition entries." },
      { token: "-g", meaning: "Hide headings in --show output." },
      { token: "-b", meaning: "Print sizes in bytes." },
      { token: "-n", meaning: "Select a range of partition numbers." },
      { token: "-o", meaning: "Choose the output columns." },
      { token: "-P", meaning: "Use a parsable table output format." },
      { token: "-r", meaning: "Use raw output." },
      { token: "-S", meaning: "Override the sector size." },
      { token: "-t", meaning: "Restrict output or operations to a partition type." },
      { token: "-v", meaning: "Print more details about the operation." },
    ],
    note: "partx changes the kernel's view of partitions and can affect mounts and applications using the device. Confirm the device and partition numbers first.",
  },
  udevadm: {
    purpose: "Query, monitor, test, and trigger Linux device-manager events.",
    syntax: "udevadm command [options]",
    parts: [
      { token: "info", meaning: "Query device properties, attributes, and symlinks." },
      { token: "monitor", meaning: "Listen for kernel and udev device events." },
      { token: "settle", meaning: "Wait until the current udev event queue is processed." },
      { token: "trigger", meaning: "Ask the kernel to replay device events." },
      { token: "test", meaning: "Simulate the udev rule processing for a device." },
      { token: "test-builtin", meaning: "Test one of udev's built-in rule commands." },
      { token: "control", meaning: "Change the running udev daemon's state." },
      { token: "verify", meaning: "Check the syntax and semantics of udev rules files." },
      { token: "wait", meaning: "Wait for a device or device symlink to be initialized." },
      { token: "-q", meaning: "Choose which property to query with udevadm info." },
      { token: "-p", meaning: "Select a device path." },
      { token: "-n", meaning: "Select a device node name." },
      { token: "-r", meaning: "Print absolute paths for device names or symlinks." },
      { token: "-e", meaning: "Print the complete property database when supported." },
      { token: "-s", meaning: "Filter events or attributes by subsystem." },
      { token: "-a", meaning: "Walk the device's sysfs attribute chain." },
      { token: "-t", meaning: "Display a sysfs tree." },
      { token: "-x", meaning: "Print properties as key/value pairs." },
      { token: "-P", meaning: "Prefix exported property names." },
      { token: "-d", meaning: "Print the major/minor device ID for a file." },
      { token: "--json", meaning: "Format supported udevadm output as JSON." },
    ],
    note: "udevadm trigger can cause devices and rules to be reprocessed. Prefer info, monitor, and test while investigating.",
  },
  logger: {
    purpose: "Write a message to the system log or journal.",
    syntax: "logger [options] message",
    parts: [
      { token: "-p", meaning: "Set the facility and severity, such as user.notice." },
      { token: "-t", meaning: "Set the message tag." },
      { token: "-i", meaning: "Include the process ID in the message." },
      { token: "-f", meaning: "Read the message from a file." },
      { token: "-s", meaning: "Also write the message to standard error." },
      { token: "-e", meaning: "Skip empty lines when reading a file." },
      { token: "--no-act", meaning: "Do everything except write the message." },
      { token: "-n", meaning: "Send to a chosen remote syslog server." },
      { token: "-P", meaning: "Use a chosen remote syslog port." },
      { token: "-T", meaning: "Use TCP for a remote syslog destination." },
      { token: "-d", meaning: "Use UDP for a remote syslog destination." },
      { token: "-u", meaning: "Write to a selected Unix socket." },
      { token: "--journald", meaning: "Write a native journald entry." },
    ],
    note: "logger writes an event into system logs; it does not execute the message as a command. Check remote destination options before using them.",
  },
  getconf: {
    purpose: "Query POSIX and system configuration values used by programs.",
    syntax: "getconf [options] variable [pathname]",
    parts: [
      { token: "-v", meaning: "Use a selected specification version." },
    ],
    note: "getconf is useful when a script needs the system's actual limits instead of assuming them.",
  },
  getent: {
    purpose: "Query databases configured through the Name Service Switch, such as users, groups, hosts, and services.",
    syntax: "getent [options] database [key]",
    parts: [
      { token: "-s", meaning: "Use a selected service configuration for the query." },
      { token: "-i", meaning: "Disable internationalized domain-name encoding for host lookups." },
    ],
    note: "Depending on NSS configuration, getent may query local files, DNS, LDAP, or another network service.",
  },
  renice: {
    purpose: "Change the nice value, and therefore scheduling priority, of running processes.",
    syntax: "renice [options] priority [-p pid] [-g pgrp] [-u user]",
    parts: [
      { token: "-n", meaning: "Set the new nice value." },
      { token: "-p", meaning: "Interpret following identifiers as process IDs." },
      { token: "-g", meaning: "Interpret following identifiers as process-group IDs." },
      { token: "-u", meaning: "Interpret following identifiers as usernames." },
      { token: "--priority", meaning: "Set an absolute nice value." },
      { token: "--relative", meaning: "Adjust the current nice value by a relative amount." },
    ],
    note: "A higher nice value gives a process less scheduling priority. Lowering it generally requires extra privilege.",
  },
  ionice: {
    purpose: "Read or change a process's I/O scheduling class and priority.",
    syntax: "ionice [options] [command [argument...]]",
    parts: [
      { token: "-c", meaning: "Choose the I/O scheduling class." },
      { token: "-n", meaning: "Choose the priority within a class that supports it." },
      { token: "-p", meaning: "Operate on an existing process ID." },
      { token: "-P", meaning: "Operate on processes in a process group." },
      { token: "-t", meaning: "Ignore failures when setting a process priority." },
      { token: "-u", meaning: "Operate on processes owned by selected users." },
    ],
    note: "ionice affects how storage work competes with other I/O. Check the process ID before changing a running service.",
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
    challenge: {
      id: "build-a-private-workspace",
      title: "Build a private workspace",
      summary: "Create a project folder, leave a note in it, then lock that note down.",
      steps: [
        { id: "project-dir", title: "Create the project folder", prompt: "Create /home/student/project.", command: "mkdir /home/student/project", guideId: "mkdir", check: { kind: "exists", path: "/home/student/project", entryKind: "directory" } },
        { id: "project-readme", title: "Add a README", prompt: "Create an empty README.md inside /home/student/project.", command: "touch /home/student/project/README.md", guideId: "touch", check: { kind: "exists", path: "/home/student/project/README.md", entryKind: "file" } },
        { id: "project-note", title: "Write the first note", prompt: "Write 'ship it' into /home/student/project/README.md.", command: "echo 'ship it' > /home/student/project/README.md", guideId: "echo", check: { kind: "file-content", path: "/home/student/project/README.md", text: "ship it" } },
        { id: "project-lock", title: "Restrict the note", prompt: "Give the owner read and write access to README.md, and remove access for everyone else.", command: "chmod 600 /home/student/project/README.md", guideId: "chmod", check: { kind: "mode", path: "/home/student/project/README.md", mode: "600" } },
      ],
      success: "You built a small private workspace by chaining commands whose effects stayed in the virtual filesystem.",
    },
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
    challenge: {
      id: "rescue-the-notes",
      title: "Rescue the notes",
      summary: "Find a note, move it into an archive, then verify the new location.",
      steps: [
        { id: "find-notes", title: "Find the note", prompt: "Find notes.txt below /home/student.", command: "find /home/student -name notes.txt", guideId: "findName", check: { kind: "output-includes", text: "/home/student/notes.txt" } },
        { id: "archive-dir", title: "Make an archive folder", prompt: "Create /home/student/archive.", command: "mkdir -p /home/student/archive", guideId: "mkdir", check: { kind: "exists", path: "/home/student/archive", entryKind: "directory" } },
        { id: "move-notes", title: "Move the note", prompt: "Move /home/student/notes.txt into /home/student/archive/notes.txt.", command: "mv /home/student/notes.txt /home/student/archive/notes.txt", guideId: "mv", check: { kind: "moved", from: "/home/student/notes.txt", to: "/home/student/archive/notes.txt" } },
        { id: "verify-archive", title: "Verify the archive", prompt: "List the files inside /home/student/archive.", command: "ls /home/student/archive", guideId: "ls", check: { kind: "output-includes", text: "notes.txt" } },
      ],
      success: "You completed a small recovery job. The file moved and the archive now contains it.",
    },
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
  challengeStates: {},
  reviewRecords: {},
  streak: { current: 0, best: 0, lastActiveDay: null },
  achievements: [],
};

const INITIAL_TERMINAL_LINES: readonly TerminalDisplayLine[] = [
  { kind: "output", text: "Safe browser shell. Type help to see the allowlisted commands." },
  { kind: "output", text: "Nothing runs on your computer and nothing leaves this page." },
];

const EXPLAINER_EXAMPLE = "sudo pacman -Syu";

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

function isAchievementId(value: unknown): value is AchievementId {
  return value === "first-command" || value === "error-decoder" || value === "three-day-streak" || value === "mission-complete";
}

function lessonStateFor(progress: Progress, lessonId: LessonId): LessonState {
  return progress.lessonStates[lessonId] ?? EMPTY_LESSON_STATE;
}

function challengeStateFor(progress: Progress, challengeId: string): ChallengeState {
  return progress.challengeStates[challengeId] ?? { completedStepIds: [] };
}

function taskKey(lessonId: LessonId, taskId: string): string {
  return `${lessonId}:${taskId}`;
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

function updateChallengeState(progress: Progress, challengeId: string, update: (state: ChallengeState) => ChallengeState): Progress {
  const currentState = challengeStateFor(progress, challengeId);

  return {
    ...progress,
    challengeStates: {
      ...progress.challengeStates,
      [challengeId]: update(currentState),
    },
  };
}

function withAchievement(progress: Progress, achievement: AchievementId): Progress {
  return progress.achievements.includes(achievement)
    ? progress
    : { ...progress, achievements: [...progress.achievements, achievement] };
}

function recordPractice(progress: Progress, key: string, outcome: "success" | "failure", usedHint: boolean, now: number): Progress {
  const reviewRecords = recordTaskAttempt(progress.reviewRecords, key, { kind: outcome, usedHint }, now);
  let nextProgress: Progress = {
    ...progress,
    reviewRecords,
    streak: recordLearningDay(progress.streak, now),
  };

  if (outcome === "success") {
    nextProgress = withAchievement(nextProgress, "first-command");
  } else {
    nextProgress = withAchievement(nextProgress, "error-decoder");
  }

  if (nextProgress.streak.current >= 3) {
    nextProgress = withAchievement(nextProgress, "three-day-streak");
  }

  return nextProgress;
}

function isLessonComplete(lesson: Lesson, progress: Progress): boolean {
  const state = lessonStateFor(progress, lesson.id);

  return state.quizPassed && lesson.terminalTasks.every((task) => state.completedTaskIds.includes(task.id));
}

function readProgress(): Progress {
  const raw = window.localStorage.getItem(STORAGE_KEY) ?? window.localStorage.getItem(LEGACY_STORAGE_KEY);

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

    const challengeStates: Record<string, ChallengeState> = {};

    if (isRecord(parsed.challengeStates)) {
      for (const lesson of LESSONS) {
        const challenge = lesson.challenge;

        if (!challenge) {
          continue;
        }

        const rawState = parsed.challengeStates[challenge.id];

        if (!isRecord(rawState) || !Array.isArray(rawState.completedStepIds)) {
          continue;
        }

        challengeStates[challenge.id] = {
          completedStepIds: [...new Set(rawState.completedStepIds.filter((stepId): stepId is string => typeof stepId === "string" && challenge.steps.some((step) => step.id === stepId)))],
        };
      }
    }

    const reviewRecords: Record<string, ReviewRecord> = {};

    if (isRecord(parsed.reviewRecords)) {
      for (const [key, rawRecord] of Object.entries(parsed.reviewRecords)) {
        if (!isRecord(rawRecord) || typeof rawRecord.attempts !== "number" || typeof rawRecord.mistakes !== "number" || typeof rawRecord.intervalDays !== "number" || typeof rawRecord.nextReviewAt !== "number") {
          continue;
        }

        reviewRecords[key] = {
          attempts: Math.max(0, Math.floor(rawRecord.attempts)),
          mistakes: Math.max(0, Math.floor(rawRecord.mistakes)),
          intervalDays: Math.max(1, Math.floor(rawRecord.intervalDays)),
          nextReviewAt: Math.max(0, rawRecord.nextReviewAt),
        };
      }
    }

    const rawStreak = isRecord(parsed.streak) ? parsed.streak : {};
    const streak: StreakState = {
      current: typeof rawStreak.current === "number" ? Math.max(0, Math.floor(rawStreak.current)) : 0,
      best: typeof rawStreak.best === "number" ? Math.max(0, Math.floor(rawStreak.best)) : 0,
      lastActiveDay: typeof rawStreak.lastActiveDay === "string" ? rawStreak.lastActiveDay : null,
    };

    const achievements = Array.isArray(parsed.achievements)
      ? parsed.achievements.filter(isAchievementId)
      : [];

    return {
      activeLessonId,
      lessonStates,
      challengeStates,
      reviewRecords,
      streak,
      achievements: [...new Set(achievements)],
    };
  } catch {
    return DEFAULT_PROGRESS;
  }
}

function readTerminalSession(): TerminalSession {
  const raw = window.localStorage.getItem(TERMINAL_STORAGE_KEY);

  if (!raw) {
    return createInitialTerminalSession();
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    return parseTerminalSession(parsed) ?? createInitialTerminalSession();
  } catch {
    return createInitialTerminalSession();
  }
}

function reviewCandidates(progress: Progress): ReviewTarget[] {
  return LESSONS.flatMap((lesson) => {
    const completedTaskIds = lessonStateFor(progress, lesson.id).completedTaskIds;

    return lesson.terminalTasks
      .filter((task) => completedTaskIds.includes(task.id))
      .map((task) => ({ lesson, task, key: taskKey(lesson.id, task.id) }));
  });
}

function pickReviewTarget(progress: Progress, now: number): ReviewTarget | undefined {
  const candidates = reviewCandidates(progress);

  if (candidates.length === 0) {
    return undefined;
  }

  const due = candidates.filter((candidate) => {
    const record = progress.reviewRecords[candidate.key];
    return !record || record.nextReviewAt <= now;
  });
  const pool = due.length > 0 ? due : candidates;

  return pool[Math.floor(Math.random() * pool.length)] ?? pool[0];
}

function taskHints(task: TerminalTask): readonly [string, string, string] {
  const guide = COMMAND_GUIDES[task.guideId];

  return [
    `Think about the action first. ${task.explanation}`,
    `The syntax to study is ${guide.syntax}.`,
    `Full answer: ${task.command}`,
  ];
}

function challengeStepMatches(step: ChallengeStep, result: ReturnType<typeof runTerminalCommand>): boolean {
  if (result.kind === "error") {
    return false;
  }

  switch (step.check.kind) {
    case "output-includes":
      return result.text.includes(step.check.text);
    case "exists":
      return result.session.filesystem[step.check.path]?.kind === step.check.entryKind;
    case "file-content": {
      const entry = result.session.filesystem[step.check.path];
      return entry?.kind === "file" && entry.content.includes(step.check.text);
    }
    case "mode":
      return result.session.filesystem[step.check.path]?.mode === step.check.mode;
    case "moved":
      return result.session.filesystem[step.check.from] === undefined && result.session.filesystem[step.check.to]?.kind === "file";
    default: {
      const _exhaustive: never = step.check;
      return _exhaustive;
    }
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
  const [terminalSession, setTerminalSession] = useState<TerminalSession>(() => {
    if (typeof window === "undefined") {
      return createInitialTerminalSession();
    }

    return readTerminalSession();
  });
  const [terminalLines, setTerminalLines] = useState<readonly TerminalDisplayLine[]>(INITIAL_TERMINAL_LINES);
  const [terminalInput, setTerminalInput] = useState("");
  const [reviewMode, setReviewMode] = useState(false);
  const [reviewTargetKey, setReviewTargetKey] = useState<string | null>(null);
  const [hintLevel, setHintLevel] = useState(0);
  const [guideQuery, setGuideQuery] = useState("");
  const [reviewNow, setReviewNow] = useState(0);
  const [commandDraft, setCommandDraft] = useState(EXPLAINER_EXAMPLE);
  const [commandExplanation, setCommandExplanation] = useState<CommandExplanation>(() => explainCommand(EXPLAINER_EXAMPLE, COMMAND_GUIDES));

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setHydrated(true);
      setReviewNow(Date.now());
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (hydrated) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
      window.localStorage.setItem(TERMINAL_STORAGE_KEY, JSON.stringify(terminalSession));
    }
  }, [hydrated, progress, terminalSession]);

  const visibleProgress = hydrated ? progress : DEFAULT_PROGRESS;
  const activeLesson = LESSONS.find((lesson) => lesson.id === visibleProgress.activeLessonId) ?? LESSONS[0];
  const activeIndex = LESSONS.findIndex((lesson) => lesson.id === activeLesson.id);
  const activeLessonState = lessonStateFor(visibleProgress, activeLesson.id);
  const completedTaskCount = activeLesson.terminalTasks.filter((task) => activeLessonState.completedTaskIds.includes(task.id)).length;
  const terminalObjectivesComplete = completedTaskCount === activeLesson.terminalTasks.length;
  const activeLessonComplete = isLessonComplete(activeLesson, visibleProgress);
  const currentTask = activeLesson.terminalTasks.find((task) => !activeLessonState.completedTaskIds.includes(task.id)) ?? activeLesson.terminalTasks[activeLesson.terminalTasks.length - 1];
  const reviewTarget = reviewMode
    ? reviewCandidates(visibleProgress).find((candidate) => candidate.key === reviewTargetKey)
    : undefined;
  const practiceTask = reviewTarget?.task ?? currentTask;
  const practiceHints = taskHints(practiceTask);
  const activeChallenge = activeLesson.challenge;
  const activeChallengeState = activeChallenge ? challengeStateFor(visibleProgress, activeChallenge.id) : undefined;
  const challengeStep = activeChallenge?.steps.find((step) => !activeChallengeState?.completedStepIds.includes(step.id));
  const challengeComplete = Boolean(activeChallenge && activeChallengeState && activeChallengeState.completedStepIds.length === activeChallenge.steps.length);
  const nextLesson = activeLessonComplete ? LESSONS[activeIndex + 1] : undefined;
  const completedCount = LESSONS.filter((lesson) => isLessonComplete(lesson, visibleProgress)).length;
  const terminalGoalCount = LESSONS.reduce((count, lesson) => count + lesson.terminalTasks.length, 0);
  const progressPercent = Math.round((completedCount / LESSONS.length) * 100);
  const knownReviewKeys = reviewCandidates(visibleProgress).map((candidate) => candidate.key);
  const reviewDue = reviewNow > 0 ? dueReviewCount(visibleProgress.reviewRecords, knownReviewKeys, reviewNow) : 0;
  const filteredGuides = Object.entries(COMMAND_GUIDES).filter(([name, guide]) => `${name} ${guide.purpose} ${guide.syntax} ${guide.note} ${guide.parts.map((part) => `${part.token} ${part.meaning}`).join(" ")}`.toLowerCase().includes(guideQuery.toLowerCase().trim())).slice(0, 8);
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
    setTerminalSession((current) => ({
      ...current,
      cwd: "/home/student",
      environment: { ...current.environment, PWD: "/home/student" },
    }));
    setTerminalInput("");
    setReviewMode(false);
    setReviewTargetKey(null);
    document.getElementById("lesson")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function startReview() {
    const target = pickReviewTarget(progress, Date.now());

    if (!target) {
      return;
    }

    setReviewMode(true);
    setReviewTargetKey(target.key);
    setTerminalInput("");
    document.getElementById("lesson")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function stopReview() {
    setReviewMode(false);
    setReviewTargetKey(null);
    setHintLevel(0);
    setTerminalInput("");
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

  function scrollToCommandExplainer() {
    document.getElementById("command-explainer")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function submitCommandExplanation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCommandExplanation(explainCommand(commandDraft, COMMAND_GUIDES));
  }

  function resetTerminal() {
    setTerminalSession(createInitialTerminalSession());
    setTerminalLines(INITIAL_TERMINAL_LINES);
    setTerminalInput("");
    setReviewMode(false);
    setReviewTargetKey(null);
    setHintLevel(0);
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
    const matchedTask = !reviewMode && nextTask?.command === result.normalizedInput ? nextTask : undefined;
    const matchedReviewTask = reviewTarget?.task.command === result.normalizedInput ? reviewTarget.task : undefined;
    const matchedChallengeStep = !reviewMode && challengeStep && challengeStepMatches(challengeStep, result) ? challengeStep : undefined;
    const nextSession: TerminalSession = {
      ...result.session,
      history: [...terminalSession.history, command],
    };

    setTerminalSession(nextSession);
    setTerminalInput("");
    if (result.kind !== "error" && (matchedTask || matchedReviewTask || matchedChallengeStep)) {
      setHintLevel(0);
    }

    const successMessages = result.kind !== "error"
      ? [
          matchedTask?.success,
          matchedReviewTask?.success,
          matchedChallengeStep ? `Challenge step complete. ${matchedChallengeStep.title}` : undefined,
        ].filter((message): message is string => Boolean(message))
      : [];
    const successLine: TerminalDisplayLine | undefined = successMessages.length > 0
      ? { kind: "output", text: `✓ ${successMessages.join(" ")}` }
      : undefined;

    if (result.kind === "clear") {
      setTerminalLines(successLine ? [successLine] : []);
    } else {
      const responseLine: TerminalDisplayLine = { kind: result.kind, text: result.text };
      setTerminalLines((current) => [...current, commandLine, ...(responseLine.text ? [responseLine] : []), ...(successLine ? [successLine] : [])]);
    }

    const attemptedKey = reviewTarget?.key ?? (nextTask ? taskKey(activeLesson.id, nextTask.id) : undefined);

    setProgress((current) => {
      let nextProgress = current;
      const successfulCommand = result.kind !== "error";

      if (matchedTask && successfulCommand) {
        nextProgress = updateLessonState(nextProgress, activeLesson.id, (state) => ({
          ...state,
          completedTaskIds: state.completedTaskIds.includes(matchedTask.id)
            ? state.completedTaskIds
            : [...state.completedTaskIds, matchedTask.id],
        }));
      }

      if (activeChallenge && matchedChallengeStep && successfulCommand) {
        nextProgress = updateChallengeState(nextProgress, activeChallenge.id, (state) => ({
          completedStepIds: state.completedStepIds.includes(matchedChallengeStep.id)
            ? state.completedStepIds
            : [...state.completedStepIds, matchedChallengeStep.id],
        }));

        if (activeChallengeState && activeChallengeState.completedStepIds.length + 1 === activeChallenge.steps.length) {
          nextProgress = withAchievement(nextProgress, "mission-complete");
        }
      }

      if (attemptedKey) {
        nextProgress = recordPractice(nextProgress, attemptedKey, successfulCommand && Boolean(matchedTask || matchedReviewTask) ? "success" : "failure", hintLevel > 0, reviewNow);
      }

      return nextProgress;
    });
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
          <div className="local-note"><span className="save-dot" /> Progress saved locally · {visibleProgress.streak.current} day streak</div>
        </div>
      </aside>

      <section className="content-shell">
        <header className="topbar">
          <div className="breadcrumb"><span>Course</span><span>/</span><strong>Arch foundations</strong></div>
          <div className="topbar-status"><span className="save-dot" />{hydrated ? "Saved locally" : "Loading path"}<span className="topbar-divider" />No account needed<button className="review-button" disabled={knownReviewKeys.length === 0} onClick={reviewMode ? stopReview : startReview} type="button">{reviewMode ? "Exit review" : `Review${reviewDue > 0 ? ` · ${reviewDue} due` : ""}`}</button></div>
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
              <button className="hero-tool-link" onClick={scrollToCommandExplainer} type="button">
                <span>Have a command? Paste it here.</span>
                <Icon name="arrow" size={14} />
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
            <div className="register-item register-note"><span className="stat-label"><Icon name="spark" size={15} /> Learning signal</span><p>{reviewDue > 0 ? `${reviewDue} command${reviewDue === 1 ? "" : "s"} due for review.` : "Your review queue is clear."} {visibleProgress.achievements.length} achievement{visibleProgress.achievements.length === 1 ? "" : "s"} unlocked.</p></div>
          </section>

          <section aria-label="Learning signals" className="learning-signal-row">
            <div><span className="stat-label">Streak</span><strong>{visibleProgress.streak.current}<small> days</small></strong><span className="stat-foot">Best run {visibleProgress.streak.best} days</span></div>
            <div><span className="stat-label">Achievements</span><div className="achievement-list">{ACHIEVEMENT_LABELS.map(({ id, label }) => <span className={visibleProgress.achievements.includes(id) ? "achievement is-unlocked" : "achievement"} key={id}>{visibleProgress.achievements.includes(id) ? "✓" : "○"} {label}</span>)}</div></div>
            <div className="learning-signal-action"><span>{reviewDue > 0 ? `${reviewDue} review${reviewDue === 1 ? "" : "s"} waiting.` : "Review appears after you learn a command."}</span><button className="secondary-button" disabled={knownReviewKeys.length === 0} onClick={startReview} type="button">Start review <Icon name="arrow" size={14} /></button></div>
          </section>

          <section aria-labelledby="command-explainer-title" className="command-explainer" id="command-explainer">
            <div className="command-explainer-header">
              <div>
                <div className="section-label">COMMAND CHECK / PASTE TO UNDERSTAND</div>
                <h2 id="command-explainer-title">What does this command actually do?</h2>
              </div>
              <span className="command-explainer-count">{Object.keys(COMMAND_GUIDES).length} command guides</span>
            </div>
            <form className="command-explainer-form" onSubmit={submitCommandExplanation}>
              <label htmlFor="command-explainer-input">Paste a command from the internet</label>
              <div className="command-explainer-input-row">
                <span aria-hidden="true">$</span>
                <input autoComplete="off" id="command-explainer-input" onChange={(event) => setCommandDraft(event.target.value)} placeholder={EXPLAINER_EXAMPLE} spellCheck={false} value={commandDraft} />
                <button className="primary-button" type="submit"><span>Explain command</span><span className="button-icon"><Icon name="arrow" size={15} /></span></button>
              </div>
              <p>Nothing runs here. Common commands, kernel tools, and their flags are explained locally. Use man when an option depends on your installed kernel, util-linux, or kmod version.</p>
            </form>

            {commandExplanation.kind === "recognized" && (
              <div aria-live="polite" className="command-explainer-result">
                <div className="command-explainer-result-header"><span className="command-explainer-status"><span /> Command understood</span><code>{commandExplanation.input}</code></div>
                <p className="command-explainer-summary"><span className="command-explainer-summary-label">In plain English</span>{commandExplanation.plainEnglish}</p>
                <div className="command-breakdown">
                  <span className="command-breakdown-label">Read it left to right</span>
                  <ol>
                    {commandExplanation.steps.map((step, index) => <li key={`${step.token}-${index}`}><code>{step.token}</code><span>{step.explanation}</span></li>)}
                  </ol>
                </div>
                <div className="command-explainer-footer">
                  <p><span>Guide note</span>{commandExplanation.note}</p>
                  <p className="command-risk"><span>{commandExplanation.risk.label}</span>{commandExplanation.risk.message}</p>
                </div>
              </div>
            )}

            {commandExplanation.kind === "unknown" && (
              <div aria-live="polite" className="command-explainer-result is-unknown">
                <div className="command-explainer-result-header"><span className="command-explainer-status"><span /> Not in the local guide</span><code>{commandExplanation.input}</code></div>
                <p className="command-explainer-summary"><span className="command-explainer-summary-label">In plain English</span>{commandExplanation.plainEnglish ?? <>I do not have a reliable explanation for <code>{commandExplanation.command}</code> yet.</>}</p>
                <p className="command-explainer-unknown-note">Do not run a pasted command just because it looks familiar. Check its manual page or a trusted source first.</p>
              </div>
            )}

            {commandExplanation.kind === "empty" && <p aria-live="polite" className="command-explainer-empty">Paste a command to get a plain-language breakdown.</p>}
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

              <div className="command-heading"><span>Command guide</span><button aria-label="Copy first answer" className="copy-button" onClick={copyActiveCommand} type="button"><Icon name={copied ? "check" : "copy"} size={15} /> {copied ? "Copied" : "Copy first answer"}</button></div>
              <div className="command-guide-list">
                {activeLesson.terminalTasks.map((task, index) => (
                  <details className="command-guide-card" key={task.id} name="command-guide">
                    <summary className="command-guide-summary"><span className="command-guide-index">{String(index + 1).padStart(2, "0")}</span><span className="command-guide-title">{task.title}</span><span className="command-guide-toggle" aria-hidden="true">+</span></summary>
                    <div className="command-guide-content">
                      <div className="command-guide-answer"><span>Answer</span><code>{task.command}</code></div>
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
                    <div className="terminal-practice-label"><Icon name="terminal" size={15} /> {reviewMode ? "Review mode" : "Practice in the browser"}</div>
                    <h3>{reviewMode ? `Review / ${practiceTask.title}` : terminalObjectivesComplete ? "Terminal objectives complete" : currentTask.title}</h3>
                  </div>
                  <span className="safe-badge"><span /> Safe mode</span>
                </div>
                <p className="terminal-task-prompt">{reviewMode ? `Recall this command without looking it up. ${practiceTask.prompt}` : terminalObjectivesComplete ? "You completed every command objective. Take the quiz below to unlock the next lesson." : currentTask.prompt}</p>
                <div className="recall-hint">
                  <div><span>Progressive hint {hintLevel}/3</span>{hintLevel > 0 && <p>{practiceHints[hintLevel - 1]}</p>}</div>
                  <button disabled={hintLevel >= practiceHints.length} onClick={() => setHintLevel((level) => Math.min(level + 1, practiceHints.length))} type="button">{hintLevel === 0 ? "Show hint" : hintLevel === 1 ? "Show syntax" : hintLevel === 2 ? "Reveal answer" : "All hints shown"}</button>
                </div>
                <div className="terminal-objectives" aria-label="Terminal objectives">
                  <div className="terminal-objectives-heading"><span>Objectives</span><strong>{completedTaskCount}/{activeLesson.terminalTasks.length}</strong></div>
                  <ol>
                    {activeLesson.terminalTasks.map((task, index) => {
                      const completed = activeLessonState.completedTaskIds.includes(task.id);

                      return (
                        <li className={completed ? "is-complete" : index === completedTaskCount ? "is-current" : ""} key={task.id}>
                          <span className="terminal-objective-marker">{completed ? <Icon name="check" size={12} /> : index + 1}</span>
                          <span><strong>{task.title}</strong><code>{completed ? "passed" : index === completedTaskCount ? "waiting for your command" : "locked until then"}</code></span>
                        </li>
                      );
                    })}
                  </ol>
                </div>
                {activeChallenge && activeChallengeState && <div className="challenge-panel">
                  <div className="challenge-header"><div><span>Mini project · multi-command challenge</span><strong>{activeChallenge.title}</strong></div><b>{activeChallengeState.completedStepIds.length}/{activeChallenge.steps.length}</b></div>
                  <p>{activeChallenge.summary}</p>
                  <ol>
                    {activeChallenge.steps.map((step, index) => {
                      const completed = activeChallengeState.completedStepIds.includes(step.id);

                      return <li className={completed ? "is-complete" : index === activeChallengeState.completedStepIds.length ? "is-current" : ""} key={step.id}><span className="challenge-marker">{completed ? <Icon name="check" size={11} /> : index + 1}</span><span><strong>{step.title}</strong><small>{completed ? "done" : index === activeChallengeState.completedStepIds.length ? step.prompt : "complete the previous step first"}</small></span></li>;
                    })}
                  </ol>
                  {challengeComplete && <div className="challenge-success"><Icon name="check" size={13} /> {activeChallenge.success}</div>}
                </div>}
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
                  <span className={terminalObjectivesComplete ? "task-complete" : ""}>{reviewMode ? <><span className="task-arrow">↳</span> Review one learned command.</> : terminalObjectivesComplete ? <><Icon name="check" size={13} /> All terminal objectives passed. Take the quiz next.</> : <><span className="task-arrow">↳</span> Objective {completedTaskCount + 1} of {activeLesson.terminalTasks.length}.</>}</span>
                  {reviewMode ? <button className="terminal-next-button" onClick={stopReview} type="button">Exit review</button> : activeLessonComplete && nextLesson && <button className="terminal-next-button" onClick={() => openLesson(nextLesson)} type="button">Next lesson <Icon name="arrow" size={14} /></button>}
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

          <section aria-label="Command encyclopedia" className="encyclopedia-section">
            <div className="reference-header"><div><div className="section-label">REFERENCE / COMMANDS</div><h2>Look it up before you guess.</h2></div><div className="encyclopedia-meta"><span className="encyclopedia-count">{Object.keys(COMMAND_GUIDES).length} entries</span><a href="https://www.gnu.org/software/coreutils/manual/coreutils.html" rel="noreferrer" target="_blank">GNU Coreutils</a><a href="https://www.gnu.org/s/bash/manual/bash.html" rel="noreferrer" target="_blank">Bash manual</a><a href="https://man.archlinux.org/" rel="noreferrer" target="_blank">Arch man pages</a></div></div>
            <label className="encyclopedia-search"><Icon name="search" size={15} /><span className="sr-only">Search the command encyclopedia</span><input onChange={(event) => setGuideQuery(event.target.value)} placeholder="Search by command, purpose, or syntax" value={guideQuery} /></label>
            <div className="encyclopedia-grid">
              {filteredGuides.map(([name, guide]) => <details className="encyclopedia-entry" key={name}><summary><code>{name}</code><span>{guide.purpose}</span><b>+</b></summary><div><code>{guide.syntax}</code><p>{guide.note}</p></div></details>)}
            </div>
            {filteredGuides.length === 0 && <p className="encyclopedia-empty">No command matches that search.</p>}
          </section>

          <footer className="page-footer"><span>Made for the curious.</span><span>I learn arch btw / 2026</span><a href="https://wiki.archlinux.org/" rel="noreferrer" target="_blank">Source material from Arch Wiki <Icon name="external" size={13} /></a></footer>
        </div>
      </section>
    </main>
  );
}
