import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// LWY-239.2: guards beside shaping-product-check.test.mjs, for wrong texts that file's pins accept.
// Reads only skills/shape-project/SKILL.md, never this file.
const plugin = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(plugin, path), 'utf8').replace(/\r\n/g, '\n');
const shape = read('skills/shape-project/SKILL.md');

const oneLine = (text) => text.replace(/\s+/g, ' ');

// The text from a heading line up to the next heading of the same or a higher level, on one line.
function section(text, heading, level) {
  const chunks = text.split(new RegExp(`\\n(?=#{1,${level}} )`));
  const found = chunks.find((chunk) => chunk.startsWith(heading));
  assert.ok(found, `no "${heading}" section`);
  return oneLine(found);
}

const stepOne = () => section(shape, '## 1. Read before asking', 2);
const stepThree = () => section(shape, '## 3. Walk the gaps with the PO', 2);
const stepFive = () => section(shape, '## 5. Write the body, then stop at the shaped step', 2);

// Negative case: step 5 does not refuse over OPEN: lines, whatever else it says about them.
test('shape-project step 5 never says shaping refuses', () => {
  assert.doesNotMatch(stepFive(), /refus/i);
});

// AC-3: a line under Open questions for dev that the user would see the answer to is asked in the round.
test('shape-project steps 1 and 3 ask, in the round, an Open questions for dev line the user would see the answer to', () => {
  assert.match(`${stepOne()} ${stepThree()}`, /asked in the round/);
});

// Negative case: a gap other than a chosen OPEN: line is a follow-up round, with no carve-out.
test('shape-project step 5 gives "follow-up round, not a write" no exception', () => {
  const step = stepFive();
  assert.match(step, /follow-up round, not a write/);
  assert.doesNotMatch(step, /follow-up round, not a write[^.]*\b(?:except|unless)\b/i);
});
