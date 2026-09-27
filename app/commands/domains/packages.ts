import type { CommandCatalog } from "../types";
export const packagesGuides = {
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
} satisfies CommandCatalog;

