import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// LWY-204: shaping finds every way in to what a story removes or replaces.
// Reads only the three skill files named below, never this file.
const plugin = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(plugin, path), 'utf8').replace(/\r\n/g, '\n');
const shape = read('skills/shape-project/SKILL.md');
const checklist = read('skills/shape-project/references/gap-checklist.md');
const plan = read('skills/plan-project/SKILL.md');

const oneLine = (text) => text.replace(/\s+/g, ' ');

// The text from a heading line up to the next heading of the same or a higher level, on one line.
function section(text, heading, level) {
  const chunks = text.split(new RegExp(`\\n(?=#{1,${level}} )`));
  const found = chunks.find((chunk) => chunk.startsWith(heading));
  assert.ok(found, `no "${heading}" section`);
  return oneLine(found);
}

const stepTwo = () => section(shape, '## 2. Check what exists today', 2);
const hiddenScope = () => section(checklist, '## Hidden scope', 2);
// The **hidden scope** row of plan-project step 1's gap table.
const hiddenScopeRow = () => {
  const row = plan.split('\n').find((line) => line.startsWith('| **hidden scope** |'));
  assert.ok(row, 'no **hidden scope** row');
  return oneLine(row);
};

// Pin 1: skills/shape-project/SKILL.md, step 2.
test('shape-project step 2 searches for every caller and entry point only when a story removes or replaces a capability', { skip: 'red-test-AC-1: pin 1 (TC-1), step 2 has no entry-point search yet' }, () => {
  assert.match(stepTwo(), /When a story removes or replaces a capability, search the code for every caller and entry point to it/);
});

// Pin 2: skills/shape-project/SKILL.md, step 2.
test('shape-project step 2 shapes a story that only changes behaviour as today', { skip: 'red-test-AC-1: pin 2 (negative case), step 2 does not exempt behaviour-only stories yet' }, () => {
  assert.match(stepTwo(), /A story that only changes how something behaves, removing or replacing nothing, is shaped as today/);
});

// Pin 3: skills/shape-project/SKILL.md, step 2.
test('shape-project step 2 puts each uncovered entry point into the round as a criterion or Out of scope', { skip: 'red-test-AC-1: pin 3 (TC-1), step 2 does not ask about entry points yet' }, () => {
  assert.match(stepTwo(), /Each entry point the story does not already cover goes into the round as a choice: cover it in a criterion, or leave it under \*Out of scope\*/);
});

// Pin 4: skills/shape-project/references/gap-checklist.md, ## Hidden scope.
test('the gap checklist Hidden scope names a removed or replaced capability entry points in a criterion or Out of scope', { skip: 'red-test-AC-2: pin 4 (TC-2), Hidden scope says nothing about entry points yet' }, () => {
  assert.match(hiddenScope(), /A story that removes or replaces a capability names every entry point to it, in a criterion or under \*Out of scope\*/);
});

// Pin 5: skills/plan-project/SKILL.md, step 1, the **hidden scope** row.
test('plan-project step 1 hidden scope row flags an entry point to a removed or replaced capability the body does not name', { skip: 'red-test-AC-2: pin 5 (TC-2), the hidden scope row has no entry-point clause yet' }, () => {
  assert.match(hiddenScopeRow(), /an entry point to a removed or replaced capability that the body does not name/);
});
