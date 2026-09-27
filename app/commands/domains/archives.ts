import type { CommandCatalog } from "../types";
import type { ManPage } from "../../manpage-matcher";

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
] satisfies ManPage["parts"];

export const archivesGuides = {
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
} satisfies CommandCatalog;
