import type { CommandCatalog } from "../types";
export const shellGuides = {
  pwd: {
    purpose: "Print the full path of the directory where the shell is working.",
    syntax: "pwd [option]",
    parts: [
      { token: "-L", meaning: "Show the logical path, including symbolic links." },
      { token: "-P", meaning: "Show the physical path with symbolic links resolved." },
    ],
    note: "Run pwd whenever you are unsure where a relative path will start.",
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
  echo: {
    purpose: "Print text, or send that text to a file with redirection.",
    syntax: "echo text > file",
    parts: [
      { token: ">", meaning: "Write output to a file and replace its current contents." },
      { token: ">>", meaning: "Append output to a file in a real shell." },
    ],
    note: "The single > operator is destructive when the target file already contains text.",
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
  umask: {
    purpose: "Show or set the permission bits removed from newly created files and directories.",
    syntax: "umask [options] [mode]",
    parts: [
      { token: "-S", meaning: "Print or accept the symbolic permission form." },
    ],
    note: "umask is a shell setting. It affects future creations in the current shell and its child processes, not existing files.",
  },
  tty: {
    purpose: "Print the terminal device connected to standard input, or report whether one exists.",
    syntax: "tty [options]",
    parts: [
      { token: "-s", meaning: "Print nothing and use the exit status as the result." },
    ],
    note: "tty helps scripts detect whether input or output is connected to an interactive terminal.",
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
  exec: {
    purpose: "Replace the current shell process with another command.",
    syntax: "exec [options] command [argument]",
    parts: [
      { token: "-c", meaning: "Start the command with an empty environment." },
      { token: "-a", meaning: "Set the value shown as the command's zeroth argument." },
    ],
    note: "exec does not start a child process. In an interactive shell, it can replace your shell session immediately.",
  },
} satisfies CommandCatalog;

