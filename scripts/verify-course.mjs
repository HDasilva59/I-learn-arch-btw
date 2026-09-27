const courseUrl = process.env.COURSE_URL ?? "http://127.0.0.1:3000/";
const response = await fetch(courseUrl);
const html = await response.text();

const requiredMarkers = [
  "I learn arch btw",
  "Arch, one",
  "pacman -Syu",
  "pacman -Q",
  "Command guide",
  "Flags and parts",
  "Quiz locked",
  "wiki.archlinux.org",
  "Practice in the browser",
  "Terminal objectives",
  "Terminal goals",
  "Safe browser shell",
  "run arbitrary commands",
  "Progressive hint",
  "Review",
  "Achievements",
  "Command encyclopedia",
  "tldr-pages",
  "CC BY 4.0",
];

const missingMarkers = requiredMarkers.filter((marker) => !html.includes(marker));

if (!response.ok || missingMarkers.length > 0) {
  const details = missingMarkers.length > 0 ? ` Missing: ${missingMarkers.join(", ")}.` : "";
  throw new Error(`Course route returned ${response.status}.${details}`);
}

console.log(`Course route verified at ${courseUrl}`);
