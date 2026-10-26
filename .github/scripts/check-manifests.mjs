// Parses both manifests and checks the fields a release depends on. `claude` is not on a runner, so this stands in for `claude plugin validate`.
// Usage: node check-manifests.mjs
import fs from "node:fs";

const read = (path) => JSON.parse(fs.readFileSync(new URL(`../../${path}`, import.meta.url), "utf8"));
const plugin = read("plugin/.claude-plugin/plugin.json");
const market = read(".claude-plugin/marketplace.json");

const problems = [];
if (plugin.name !== "leeway-sdlc") problems.push(`plugin.json name is ${JSON.stringify(plugin.name)}, expected "leeway-sdlc"`);
if (!/^\d+\.\d+\.\d+$/.test(plugin.version ?? "")) problems.push(`plugin.json version ${JSON.stringify(plugin.version)} is not x.y.z`);
const entry = (market.plugins ?? []).find((p) => p.name === plugin.name);
if (!entry) problems.push(`marketplace.json lists no plugin named ${plugin.name}`);
else if (entry.source !== "./plugin") problems.push(`marketplace.json source is ${JSON.stringify(entry.source)}, expected "./plugin"`);

if (problems.length) {
  for (const p of problems) console.error(p);
  process.exit(1);
}
console.log(`manifests ok: ${plugin.name} ${plugin.version}`);
