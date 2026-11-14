import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// LWY-239.1: the product check's seven gap kinds are defined in one file, the gap checklist.
const plugin = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(plugin, path), 'utf8').replace(/\r\n/g, '\n');
const checklist = read('skills/shape-project/references/gap-checklist.md');
const plan = read('skills/plan-project/SKILL.md');
const shape = read('skills/shape-project/SKILL.md');

const oneLine = (text) => text.replace(/\s+/g, ' ');
const kinds = ['missing', 'hollow', 'open', 'no negative', 'stale', 'hidden scope', 'too big'];

function section(text, heading, level) {
  const chunks = text.split(new RegExp(`\\n(?=#{1,${level}} )`));
  const found = chunks.find((chunk) => chunk.startsWith(heading));
  assert.ok(found, `no "${heading}" section`);
  return found;
}

const rowOf = (text, kind) => text.split('\n').find((line) => line.startsWith(`| **${kind}** |`));

// TC-1, AC-5: the checklist's "## The product check" holds all seven rows.
test('the gap checklist The product check section has all seven gap-kind rows', { skip: 'red-test-TC-1: the checklist has no "## The product check" section yet' }, () => {
  const body = section(checklist, '## The product check', 2);
  for (const kind of kinds) assert.ok(rowOf(body, kind), `no **${kind}** row in The product check`);
});

// TC-1, AC-5 (negative case): the rows live nowhere else.
for (const [name, text] of [['plan-project', plan], ['shape-project', shape]]) {
  test(`${name} SKILL.md carries no gap-kind row`, { skip: name === 'plan-project' ? 'red-test-TC-1: plan-project step 1 still carries the gap table' : false }, () => {
    for (const kind of kinds) assert.equal(rowOf(text, kind), undefined, `${name} still has a **${kind}** row`);
  });
}

// AC-2 (third rule, planning side): the stale row says a rule change that updates the intent doc is decided.
test('the product check stale row treats an intent-doc rule change that updates the intent doc as decided, not stale', { skip: 'red-test-AC-2: no product check section, and the stale row has no exception yet' }, () => {
  const row = oneLine(rowOf(section(checklist, '## The product check', 2), 'stale') ?? '');
  assert.ok(row, 'no **stale** row in The product check');
  assert.match(row, /changes an intent-doc rule and says the intent doc is updated with the story's work is a decided change, not stale/);
});
