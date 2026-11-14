import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// LWY-239.2: shaping runs planning's product check before it writes.
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
const stepTwo = () => section(shape, '## 2. Check what exists today', 2);
const stepThree = () => section(shape, '## 3. Walk the gaps with the PO', 2);
const stepFive = () => section(shape, '## 5. Write the body, then stop at the shaped step', 2);
const doneWhen = () => section(shape, '## Done when', 2);

// AC-4: step 1 reads the product check and reads any existing body against it, line by line.
test('shape-project step 1 reads the checklist\'s product check with the checklist', () => {
  assert.match(stepOne(), /`## The product check`/);
});

test('shape-project step 1 reads any body already there against the product check, line by line, whoever wrote it', () => {
  assert.match(stepOne(), /body already there when shaping starts\*{0,2}, whoever wrote it/);
  assert.match(stepOne(), /line by line against the product check/);
});

test('shape-project step 1 sends the existing body\'s gaps out in the first round', () => {
  assert.match(stepOne(), /its gaps go into the first round/);
});

// Negative case: a later round must not ask again what an answer settled.
test('shape-project step 1 applies "do not reopen what the body already answers" only to later rounds', () => {
  assert.match(stepOne(), /do not reopen what the body already answers/);
  assert.match(stepOne(), /(?:reopen what the body already answers[^.]*\blater rounds?\b|\blater rounds?\b[^.]*reopen what the body already answers)/);
});

// AC-3: a line under Open questions for dev gets the "would the user see the answer?" test.
test('shape-project steps 1 and 3 test every Open questions for dev line, one drafted before shaping included, and ask the ones the user would see', () => {
  const steps = `${stepOne()} ${stepThree()}`;
  assert.match(steps, /including one drafted before shaping/);
  assert.match(steps, /would the user see the answer/i);
  assert.match(steps, /leaves (?:that section|\*Open questions for dev\*)/);
});

// AC-2: step 2 asks every intent-doc rule the story could cut against.
test('shape-project step 2 searches the code for each intent-doc rule\'s id and words', () => {
  assert.match(stepTwo(), /search the code for its id[^.]*and its words/);
});

test('shape-project step 2 names the rule, quotes it and says where the code cites it', () => {
  assert.match(stepTwo(), /names the rule, quotes it, and says where the code cites it/);
});

test('shape-project step 2 offers the rule holds, the rule changes and leave it OPEN as the options', () => {
  const step = stepTwo();
  assert.match(step, /\*The rule holds, the story changes\*/);
  assert.match(step, /\*The rule changes, and the story says so\*/);
  assert.match(step, /\*Leave it OPEN\*/);
});

test('shape-project step 2 puts a criterion into the body that updates the intent doc when the rule changes', () => {
  assert.match(stepTwo(), /criterion that the intent doc is updated with the story's work/);
});

// TC-5: the rule question carries no pick.
test('shape-project step 2 gives the rule question no advice and no suggested option', () => {
  const step = stepTwo();
  assert.match(step, /[Nn]o advice and no suggested option/);
  assert.doesNotMatch(step.replace(/[Nn]o advice and no suggested option/g, ''), /advice|suggested/i);
});

// Step 3 points to the product check and repeats none of its rows (the rows' absence is product-check.test.mjs).
test('shape-project step 3 walks the gap kinds of the product check as well as the checklist rows', () => {
  assert.match(stepThree(), /gap kinds of `## The product check`/);
});

// AC-1: step 5 runs the product check before it writes.
test('shape-project step 5 runs the product check on the proposed body before it writes', () => {
  assert.match(stepFive(), /before writing, run the product check on the proposed body/i);
});

// Negative case: no shaped step over a gap that is not a chosen OPEN: line.
test('shape-project step 5 turns a gap other than a chosen OPEN: line into a follow-up round, not a write', () => {
  assert.match(stepFive(), /gap other than an `OPEN:` line the PO chose to leave[^.]*follow-up round/);
  assert.match(stepFive(), /follow-up round, not a write/);
});

// Negative case: no refusal to write only because OPEN: lines are left.
test('shape-project step 5 still writes with OPEN: lines the PO chose to leave', () => {
  assert.match(stepFive(), /`OPEN:` lines the PO chose to leave do not stop the write/);
});

test('shape-project step 5 tells the PO, in the inference comment and the session, that planning will send OPEN: lines back', () => {
  assert.match(stepFive(), /`OPEN:` lines left[^.]*inference comment[^.]*session[^.]*planning will send them back/);
});

// AC-1: the Done when line.
test('shape-project Done when says the product check found no gap except the PO\'s chosen OPEN: lines', () => {
  assert.match(doneWhen(), /product check found no gap except the PO's chosen `OPEN:` lines/);
});
