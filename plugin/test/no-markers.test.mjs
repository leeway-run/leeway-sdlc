import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const plugin = join(dirname(fileURLToPath(import.meta.url)), '..');

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

function templateDirs(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (!statSync(path).isDirectory()) return [];
    return name === 'templates' ? [path] : templateDirs(path);
  });
}

const agents = files(join(plugin, 'agents'));
const templates = templateDirs(join(plugin, 'skills')).flatMap(files);
const rel = (path) => relative(plugin, path).split(sep).join('/');

test('the scan reaches the agents and the templates', () => {
  assert.ok(agents.length >= 3, `agents found: ${agents.map(rel)}`);
  for (const name of ['BRIEF.md', 'VERDICT.md', 'STORY.md.tmpl', 'TASK.md.tmpl']) {
    assert.ok(templates.some((path) => path.endsWith(name)), `${name} not found under skills/**/templates`);
  }
});

test('no agent or template contains an HTML comment, which Leeway shows as text', () => {
  const offenders = [...agents, ...templates].filter((path) => readFileSync(path, 'utf8').includes('<!--'));
  assert.deepEqual(offenders.map(rel), []);
});

test('no agent frontmatter names an MCP tool', () => {
  const offenders = agents.filter((path) => {
    const text = readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
    const frontmatter = /^---\n([\s\S]*?)\n---\n/.exec(text);
    assert.ok(frontmatter, `${rel(path)} has no frontmatter`);
    return frontmatter[1].includes('mcp__');
  });
  assert.deepEqual(offenders.map(rel), []);
});

const read = (path) => readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
const templateText = (name) => read(templates.find((path) => path.endsWith(name)));
const contractFiles = [...agents, ...templates, join(plugin, 'PROCESS.md')];

test('a brief and a verdict open with one heading everywhere', () => {
  const stale = contractFiles.filter((path) => /(Brief|Verdict) · /.test(read(path)));
  assert.deepEqual(stale.map(rel), []);
  const process = read(join(plugin, 'PROCESS.md'));
  assert.ok(process.includes('# Handoff brief — <ref> · round <N>'), 'PROCESS.md lacks the brief heading');
  assert.ok(process.includes('# Review verdict: PASS | FAIL — <ref> · round <N>'), 'PROCESS.md lacks the verdict heading');
  assert.ok(templateText('BRIEF.md').includes('\n# Handoff brief — <ref> · round <N>\n'));
  assert.ok(templateText('VERDICT.md').includes('\n# Review verdict: PASS | FAIL — <ref> · round <N>\n'));
});

test('the brief and the verdict both carry a Friction section', () => {
  for (const name of ['BRIEF.md', 'VERDICT.md']) {
    assert.ok(templateText(name).includes('\n## Friction\n'), `${name} has no Friction section`);
  }
});

test('every agent says it never writes to Leeway', () => {
  const silent = agents.filter((path) => !/never \*write\* to Leeway|never writes to Leeway/.test(read(path)));
  assert.deepEqual(silent.map(rel), []);
});
