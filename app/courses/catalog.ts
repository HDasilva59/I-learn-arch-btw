import { COMMAND_GUIDES } from "../commands/catalog";
import { defineCourseCatalog, type Lesson } from "./types";

/**
 * Add or update a lesson here. The page only renders this catalog and stores
 * learner progress; it does not contain course content.
 */
const RAW_LESSONS = [
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
] satisfies readonly Lesson[];

export const LESSONS = defineCourseCatalog(RAW_LESSONS, COMMAND_GUIDES);

