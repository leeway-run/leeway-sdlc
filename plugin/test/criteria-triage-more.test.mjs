// LWY-244.3 round 4: pins for rules the frozen criteria-triage.test.mjs leaves open (c15, c16, c17, c18).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const plugin = process.env.PLUGIN_DIR || join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(plugin, path), 'utf8').replace(/\r\n/g, '\n');
const flat = (text) => text.replace(/\s+/g, ' ');

const slice = (text, from, to) => {
  const start = text.indexOf(from);
  assert.notEqual(start, -1, `anchor not found: ${from}`);
  const end = text.indexOf(to, start);
  assert.notEqual(end, -1, `anchor not found: ${to}`);
  return flat(text.slice(start, end));
};

const run = () => read('skills/run/SKILL.md');
const triage = () => slice(run(), '#### Before raising a block: do the criteria decide it?', '#### A BLOCKED brief');
const escalationsProcess = () => slice(read('PROCESS.md'), '## Questions to the human are escalations', '\n## ');

test('c15: only the decision comment of a whole-round block is added by hand, and a server refusal falls back to the agent comment', () => {
  const s = triage();
  assert.match(s, /An `F<n>` block's finding comment exists already and is live/);
  assert.match(s, /add the decision comment's `cN` to the live findings by hand/);
  assert.match(s, /If the server refuses the verdict post because of that `cN`[^.]{0,60}post the verdict without it and record the decision's outcome in a comment from `<alias>\/agent`/);
});

test('c15: the next reviewer is told to report a refused decision in its verdict body, not under Settles', () => {
  const s = slice(run(), '- **The earlier findings still live**', '- **How it reaches Leeway**: the implementer');
  assert.match(s, /report that decision's outcome in the verdict body, not under \*Settles\*/);
});

test('c16: a decided `## Question` at roundCap is not run, in "The caps" and in hard-stop row 1', () => {
  const caps = slice(run(), '**The caps.**', '**Spend rounds on the risk');
  assert.match(caps, /whether the block was a PASS verdict's `Escalates:` or a `BLOCKED` brief's `## Question`[^.]{0,40}hard stop 1/);
  const row = /\| 1 \| \*\*The round cap is hit\*\*[^\n]*/.exec(run());
  assert.ok(row, 'hard-stop row 1 not found');
  assert.match(flat(row[0]), /a `BLOCKED` brief whose `## Question` is decided or continued, that needs one more round/);
});

test('c17: PROCESS.md says a spec amendment never comes to the triage', () => {
  assert.match(escalationsProcess(), /A spec amendment never comes to the triage\./);
});

test('c17: run says a spec amendment never reaches the check, a freeze BLOCKER included, and goes to hard stop 8', () => {
  assert.match(triage(), /\*\*A spec amendment never reaches this check\.\*\* A frozen test that needs one, a `freeze` BLOCKER included, goes to hard stop 8/);
});

test('c18: the always-raised list is wrapped over three lines, the same in run and PROCESS.md', () => {
  const lines = (text) => {
    const i = text.indexOf('the criteria allow more than one answer');
    assert.notEqual(i, -1, 'list not found');
    const end = text.indexOf('intent doc', i) + 'intent doc'.length;
    return text.slice(i, end).split('\n').map((l) => l.trim());
  };
  const a = lines(read('skills/run/SKILL.md'));
  const b = lines(read('PROCESS.md'));
  assert.equal(a.length, 3);
  assert.deepEqual(a, b);
  for (const l of a) assert.ok(l.length < 130, `line too long (${l.length}): ${l}`);
});
