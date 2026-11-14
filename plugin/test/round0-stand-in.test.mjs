// LWY-244.2: round 0 proves its tests can pass against a temporary stand-in (AC-3), every document says it once (AC-6),
// and each rule is pinned (TC-4).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const plugin = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(plugin, path), 'utf8').replace(/\r\n/g, '\n');
const flat = (text) => text.replace(/\s+/g, ' ');

const slice = (text, from, to) => {
  const start = text.indexOf(from);
  assert.notEqual(start, -1, `anchor not found: ${from}`);
  const end = text.indexOf(to, start);
  assert.notEqual(end, -1, `anchor not found: ${to}`);
  return flat(text.slice(start, end));
};

const implementer = slice(read('agents/sdlc-implementer.md'), '**One exception: round 0.**', '## Frozen tests');
const briefRed = slice(read('skills/run/templates/BRIEF.md'), '## Red tests', '## Frozen test fix');
const runRound0 = slice(read('skills/run/SKILL.md'), '### Round 0: red tests first', '#### The freeze');
const runImplementer = slice(read('skills/run/SKILL.md'), '- **The prompt says this is round 0.**', '- **The gate also checks**');
const runGate = slice(read('skills/run/SKILL.md'), '- **The gate also checks**', '- **The reviewer reviews tests against criteria');
const reviewer = slice(read('agents/sdlc-reviewer.md'), '**Round 0 is a different review.**', '**After a round 0, check the freeze');
const verdictRed = slice(read('skills/run/templates/VERDICT.md'), '- **Red tests:**', '- **Verified:**');
const processRound0 = slice(read('PROCESS.md'), '**round 0**: the implementer writes', 'task whose type says `redTests: false`');

test('AC-3: the implementer writes a temporary stand-in, runs each test un-skipped against it, pastes the passing output', { skip: 'red-test-AC-3: the stand-in rule is not in the docs yet' }, () => {
  assert.match(implementer, /write a temporary stand-in/i);
  assert.match(implementer, /run each test un-skipped against it/i);
  assert.match(implementer, /paste the passing output/i);
});

test('AC-3: the implementer deletes the stand-in and re-skips before staging, so it never reaches the round-0 commit', { skip: 'red-test-AC-3: the stand-in rule is not in the docs yet' }, () => {
  assert.match(implementer, /delete the stand-in and re-skip[^.]*before (you )?stag/i);
});

test('AC-3: where no stand-in can be written for a test, the implementer says why for that test', { skip: 'red-test-AC-3: the stand-in rule is not in the docs yet' }, () => {
  assert.match(implementer, /where no stand-in can be written for a test, say why for that test/i);
});

test('AC-3: the brief\'s Red tests table gains the stand-in column, and the round-0 sentence says so', { skip: 'red-test-AC-3: the stand-in rule is not in the docs yet' }, () => {
  assert.match(briefRed, /\| Failure when un-skipped \(verbatim\) \| Passes against the stand-in \(verbatim\), or why none \|/);
  assert.match(briefRed, /Round 0:\*\*[^|]*stand-in[^|]*delete[^|]*stand-in/i);
});

test('AC-3: run\'s round 0 tells the implementer to use a stand-in and delete it before staging', { skip: 'red-test-AC-3: the stand-in rule is not in the docs yet' }, () => {
  assert.match(runImplementer, /temporary stand-in/i);
  assert.match(runImplementer, /passing run per test/i);
  assert.match(runImplementer, /deletes the stand-in[^.]*before staging|before staging[^.]*deletes the stand-in/i);
});

test('AC-3: run\'s gate checks each row has a passing run or a reason, and the staged-set check refuses a stand-in left staged', { skip: 'red-test-AC-3: the stand-in rule is not in the docs yet' }, () => {
  assert.match(runGate, /each row (of the Red tests table )?(has|carries) a passing run against the stand-in or a reason why none/i);
  assert.match(runGate, /staged set[^.]*already refuses a stand-in left staged|already refuses a stand-in left staged/i);
});

test('AC-3: the reviewer checks each passing run against the test it names and judges each "why none"', { skip: 'red-test-AC-3: the stand-in rule is not in the docs yet' }, () => {
  assert.match(reviewer, /each passing (stand-in )?run against the test it names/i);
  assert.match(reviewer, /judge each "why none"[^.]*accepted[^.]*finding/i);
});

test('AC-3: the reviewer still never edits code, and never writes the stand-in', { skip: 'red-test-AC-3: the stand-in rule is not in the docs yet' }, () => {
  assert.match(reviewer, /never edits code[^.]*stand-in|stand-in[^.]*never edits code/i);
  assert.match(reviewer, /(do not|does not|never) write (or edit )?(the |a )?stand-in/i);
});

test('AC-3: the verdict\'s round-0 Red tests line names the stand-in check', { skip: 'red-test-AC-3: the stand-in rule is not in the docs yet' }, () => {
  assert.match(verdictRed, /stand-in/i);
  assert.match(verdictRed, /passing run[^.]*(test|tests) it names/i);
});

test('AC-6: PROCESS.md and run\'s round 0 section say the stand-in in one place each', { skip: 'red-test-AC-6: the stand-in rule is not in the docs yet' }, () => {
  assert.match(processRound0, /temporary stand-in/i);
  assert.match(processRound0, /(removed|deleted) before (it is )?stag/i);
  assert.match(runRound0, /stand-in/i);
});

test('TC-4 negative: a stand-in staged in round 0 is refused by the gate, and the implementer is told never to stage it', { skip: 'red-test-TC-4: the stand-in rule is not in the docs yet' }, () => {
  assert.match(runGate, /staged set[^.]*stand-in|stand-in[^.]*staged set/i);
  assert.match(implementer, /never (stage|commit)[^.]*stand-in|stand-in[^.]*(never|not) (reach|staged)/i);
});
