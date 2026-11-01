import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const plugin = join(dirname(fileURLToPath(import.meta.url)), '..');
const here = join(plugin, 'test');

function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return path === here ? [] : files(path);
    return /\.(md|tmpl|mjs|json)$/.test(entry.name) ? [path] : [];
  });
}

// A sentence: a paragraph, list item or table row, joined onto one line, split after a full stop.
function sentences(text) {
  const units = [];
  let unit = [];
  for (const line of text.replace(/\r\n/g, '\n').split('\n')) {
    if (/^\s*$/.test(line) || /^\s*([-*|]|\d+\.)\s/.test(line)) {
      if (unit.length) units.push(unit.join(' '));
      unit = [];
    }
    if (!/^\s*$/.test(line)) unit.push(line.trim());
  }
  if (unit.length) units.push(unit.join(' '));
  return units.flatMap((u) => u.split(/(?<=\.)\s+(?=[A-Z`*])/));
}

const all = files(plugin).flatMap((path) =>
  sentences(readFileSync(path, 'utf8')).map((sentence) => ({ at: relative(plugin, path), sentence })),
);

test('the friction collector is named only in a sentence labelled legacy', () => {
  const named = all.filter(({ sentence }) => /friction[- ]collector/i.test(sentence));
  assert.ok(named.length > 0, 'no legacy path names friction-collector');
  const unlabelled = named.filter(({ sentence }) => !/legacy/i.test(sentence));
  assert.deepEqual(unlabelled, []);
});

test('no sentence files friction as a comment, except a legacy one', () => {
  const comment = /comment add|\bcomments?( already)? on (the|that|its)( friction)? (collector|issue)\b/;
  const offending = all.filter(
    ({ sentence }) => /friction/i.test(sentence) && comment.test(sentence) && !/legacy/i.test(sentence),
  );
  assert.deepEqual(offending, []);
});

test('the binding template names a friction project, not a collector', () => {
  const binding = readFileSync(join(plugin, 'skills', 'sdlc-install', 'scaffold', 'leeway.md.tmpl'), 'utf8');
  assert.ok(binding.includes('\nfriction-project: {{FRICTION_PROJECT}}\n'));
  assert.ok(!binding.includes('friction-collector') && !binding.includes('FRICTION_COLLECTOR'));
});

test('run-task and run-story file accepted friction as a chore issue in the friction project', () => {
  for (const skill of ['run-task', 'run-story']) {
    const text = readFileSync(join(plugin, 'skills', skill, 'SKILL.md'), 'utf8').replace(/\s+/g, ' ');
    assert.ok(text.includes('issue list <KEY> <friction project>'), `${skill} does not dedupe against the project`);
    assert.ok(
      text.includes('issue create <KEY> --projectId <friction project> --type chore'),
      `${skill} does not file friction as an issue`,
    );
  }
});
