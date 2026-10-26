// Fails unless the release tag (vX.Y.Z, or refs/tags/vX.Y.Z) names the version in plugin/.claude-plugin/plugin.json.
// Usage: node check-tag.mjs <tag>
import fs from "node:fs";

const tag = (process.argv[2] ?? "").replace(/^refs\/tags\//, "");
const { version } = JSON.parse(
  fs.readFileSync(new URL("../../plugin/.claude-plugin/plugin.json", import.meta.url), "utf8"),
);

if (tag !== `v${version}`) {
  console.error(`tag "${tag}" does not match plugin/.claude-plugin/plugin.json version ${version} (expected v${version}). No release was created.`);
  process.exit(1);
}
console.log(`tag ${tag} matches version ${version}`);
