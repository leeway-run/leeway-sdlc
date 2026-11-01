// Parses the manifests and checks the fields a release depends on. `claude` is not on a runner, so this stands in for `claude plugin validate`.
// Every version a harness reads must be the same: plugin.json, plugin/HARNESS.md, and the generated package for other agents.
// Usage: node check-manifests.mjs
import fs from "node:fs";

const text = (path) => fs.readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const read = (path) => JSON.parse(text(path));
const plugin = read("plugin/.claude-plugin/plugin.json");
const market = read(".claude-plugin/marketplace.json");
const agents = read("targets/agents/plugin.json");
const harnessVersion = (path) => /^version:\s*(\S+)/m.exec(text(path))?.[1];

const problems = [];
if (plugin.name !== "leeway-sdlc") problems.push(`plugin.json name is ${JSON.stringify(plugin.name)}, expected "leeway-sdlc"`);
if (!/^\d+\.\d+\.\d+$/.test(plugin.version ?? "")) problems.push(`plugin.json version ${JSON.stringify(plugin.version)} is not x.y.z`);
const expect = [
  ["leeway-sdlc", "./plugin"],
  ["leeway-sdlc-agents", "./targets/agents"],
];
for (const [name, source] of expect) {
  const entry = (market.plugins ?? []).find((p) => p.name === name);
  if (!entry) problems.push(`marketplace.json lists no plugin named ${name}`);
  else if (entry.source !== source) problems.push(`marketplace.json source of ${name} is ${JSON.stringify(entry.source)}, expected "${source}"`);
}
if (agents.name !== "leeway-sdlc-agents") problems.push(`targets/agents/plugin.json name is ${JSON.stringify(agents.name)}`);
for (const [where, v] of [
  ["targets/agents/plugin.json", agents.version],
  ["plugin/HARNESS.md", harnessVersion("plugin/HARNESS.md")],
  ["targets/agents/HARNESS.md", harnessVersion("targets/agents/HARNESS.md")],
]) {
  if (v !== plugin.version) problems.push(`${where} version ${JSON.stringify(v)} != plugin.json ${plugin.version}`);
}

if (problems.length) {
  for (const p of problems) console.error(p);
  process.exit(1);
}
console.log(`manifests ok: ${plugin.name} and ${agents.name} ${plugin.version}`);
