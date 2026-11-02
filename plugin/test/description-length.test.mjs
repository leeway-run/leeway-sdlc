import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const plugin = join(dirname(fileURLToPath(import.meta.url)), '..');
const root = join(plugin, '..');
const here = join(plugin, 'test');

function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return path === here ? [] : files(path);
    return /\.(md|tmpl|mjs|js|json|toml)$/.test(entry.name) ? [path] : [];
  });
}

// A stated description limit: the old cap's number anywhere, or a count of characters within a clause of the word
// description, either way round. A clause stops at a full stop, a blank line, a table cell, a code span, a quote or
// a placeholder, so `--summary "<at most 280 characters>" --stdin description` is not one.
const clause = '(?:(?!\\n[ \\t]*\\n)[^.|`"<>]){0,80}?';
const limits = [
  /5,000|5000/,
  new RegExp(`description${clause}\\d[\\d,]*[- ]characters?`, 'i'),
  new RegExp(`\\d[\\d,]*[- ]characters?${clause}description`, 'i'),
];

function stated(text) {
  return limits.flatMap((pattern) => text.match(new RegExp(pattern.source, `${pattern.flags}g`)) ?? []);
}

test('no skill, template or target states a description length', () => {
  const sources = [...files(plugin), ...files(join(root, 'targets'))];
  assert.ok(sources.length >= 100, `found only ${sources.length} files`);
  const found = sources.flatMap((path) =>
    stated(readFileSync(path, 'utf8')).map((match) => ({ at: relative(root, path), match })),
  );
  assert.deepEqual(found, []);
});

test('the 0.2.0 wording is caught, and a summary next to a description is not', () => {
  for (const line of [
    'An issue description holds at most 5,000 characters, counted by the server',
    '| **too big** | its part alone passes the 5,000-character description cap |',
    'The description holds at most 6000 characters',
    'a 6,000-character description',
    'A comment body is 1 to 20,000 characters, a description at most 12,000',
  ]) {
    assert.ok(stated(line).length > 0, line);
  }
  assert.deepEqual(
    stated('`issue create <KEY> --title "x" --summary "<at most 280 characters>" --stdin description <d.md`'),
    [],
  );
  assert.deepEqual(stated('A comment body is 1 to 20,000 characters, a title at most 200.'), []);
  assert.deepEqual(stated('the description contains\n\n**Title:** short imperative, around 60 characters'), []);
});

test('plan-project still reads an existing # Technical criteria comment, the latest wins', () => {
  const skill = readFileSync(join(plugin, 'skills', 'plan-project', 'SKILL.md'), 'utf8');
  assert.match(skill, /latest `# Technical\s+criteria` comment/);
  assert.match(skill, /The latest such comment is in force/);
});
