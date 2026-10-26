// Prints the "## <version>" section of RELEASE_NOTES.md, up to the next "## " heading.
// Usage: node release-notes.mjs <version>
import fs from "node:fs";

const version = process.argv[2] ?? "";
const lines = fs.readFileSync(new URL("../../RELEASE_NOTES.md", import.meta.url), "utf8").split(/\r?\n/);
const start = lines.findIndex((line) => line.trim() === `## ${version}`);
if (!version || start === -1) {
  console.error(`RELEASE_NOTES.md has no "## ${version}" section.`);
  process.exit(1);
}
let end = lines.findIndex((line, i) => i > start && line.startsWith("## "));
if (end === -1) end = lines.length;
const body = lines.slice(start + 1, end).join("\n").trim();
if (!body) {
  console.error(`The "## ${version}" section of RELEASE_NOTES.md is empty.`);
  process.exit(1);
}
console.log(body);
