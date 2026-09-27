import type { CommandCatalog } from "../types";
export const systemGuides = {
  man: {
    purpose: "Open the local manual page for a command.",
    syntax: "man [command]",
    parts: [
      { token: "-k", meaning: "Search manual page names and descriptions in a real system." },
    ],
    note: "Read the SYNOPSIS and OPTIONS sections before trying an unfamiliar flag.",
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
} satisfies CommandCatalog;

