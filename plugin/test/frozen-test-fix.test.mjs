// LWY-244.1: a mechanical fix to a frozen test stays in the run (AC-1), a weakened one still stops it (AC-2), the gate
// checks names and the reviewer judges (TC-1), and every document says it once (AC-6, TC-4).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const plugin = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(plugin, path), 'utf8').replace(/\r\n/g, '\n');
const flat = (text) => text.replace(/\s+/g, ' ');

const processDoc = flat(read('PROCESS.md'));
const runRaw = read('skills/run/SKILL.md');
const run = flat(runRaw);
const implementer = flat(read('agents/sdlc-implementer.md'));
const reviewer = flat(read('agents/sdlc-reviewer.md'));
const brief = flat(read('skills/run/templates/BRIEF.md'));
const verdict = flat(read('skills/run/templates/VERDICT.md'));

const slice = (text, from, to) => {
  const start = text.indexOf(from);
  assert.notEqual(start, -1, `anchor not found: ${from}`);
  const end = text.indexOf(to, start);
  assert.notEqual(end, -1, `anchor not found: ${to}`);
  return flat(text.slice(start, end));
};
const freeze = slice(runRaw, '#### The freeze', '### 1. Delegate to the implementer');
const stepThree = slice(runRaw, '- **The freeze, or its absence**', '- **The round\'s commit.**');

test('AC-1: the implementer may change a frozen test only when all three conditions hold, and reports it', { skip: 'red-test-AC-1: the implementer has no exception yet' }, () => {
  assert.match(implementer, /the criterion it serves is unchanged/i);
  assert.match(implementer, /no assertion is removed or weakened \(a looser match, a smaller set, a dropped negative case\)/i);
  assert.match(implementer, /only lets the test observe the behaviour it already names \(a fixture, a query, a lookup, a setup step\)/i);
  assert.match(implementer, /all three/i);
  assert.match(implementer, /## Frozen test fix/);
});

test('AC-2: the implementer still never edits, weakens or deletes an assertion', { skip: 'red-test-AC-2: the exception is not worded yet' }, () => {
  assert.match(implementer, /Never edit, weaken, or delete an assertion/);
  assert.match(implementer, /## Frozen test fix/);
});

test('AC-1: the brief carries a Frozen test fix section after Red tests, with the diff and why, or none', { skip: 'red-test-AC-1: the brief template has no section yet' }, () => {
  assert.match(brief, /## Red tests .*## Frozen test fix .*## Claims/);
  const section = brief.slice(brief.indexOf('## Frozen test fix'), brief.indexOf('## Claims'));
  assert.match(section, /beyond its skip marker/i);
  assert.match(section, /round-0 commit/i);
  assert.match(section, /verbatim/i);
  assert.match(section, /why each condition holds/i);
  assert.match(section, /none/);
  assert.match(section, /unchanged since round <N>/);
});

test('TC-1: the gate requires every frozen file changed beyond removed skip markers to be named, and does not judge', { skip: 'red-test-TC-1: the freeze gate checks no names yet' }, () => {
  assert.match(freeze, /beyond removed skip markers/i);
  assert.match(freeze, /named in the brief's `## Frozen test fix` section/);
  assert.match(freeze, /one not named stops the round before the record/i);
  assert.match(freeze, /The gate does not judge the conditions/i);
});

test('AC-1: the section is cumulative, a later round re-lists each fix and the reviewer judges only new or changed ones', { skip: 'red-test-AC-1: the section is not cumulative yet' }, () => {
  assert.match(freeze, /The section is cumulative/i);
  assert.match(freeze, /re-lists each fix since round 0/i);
  assert.match(freeze, /unchanged since round <N>/);
  assert.match(freeze, /A round whose brief does not re-list an earlier fix stops at the gate/i);
  assert.match(freeze, /an entry whose diff changed is judged again/i);
  assert.match(freeze, /marked unchanged .*as judged/i);
});

test('AC-1: the later-implementer prompt says the section is cumulative', { skip: 'red-test-AC-1: the prompt line is not there yet' }, () => {
  assert.match(freeze, /Every later implementer prompt .*the section is cumulative/i);
});

test('AC-1: the iteration note names the fix', { skip: 'red-test-AC-1: no note is named yet' }, () => {
  assert.match(freeze, /frozen test fix: <paths>/);
  assert.match(freeze, /--note/);
});

test('AC-1: the later-reviewer prompt line, in "The freeze" and in step 3, names the change and the three conditions', { skip: 'red-test-AC-1: the prompt line is not there yet' }, () => {
  for (const text of [freeze, stepThree]) {
    assert.match(text, /a frozen test was changed/i);
    assert.match(text, /lists the files/i);
    assert.match(text, /judges each against the three conditions/i);
  }
});

test('AC-2: the reviewer passes a named change meeting all three conditions and blocks one that fails any, tagged freeze', { skip: 'red-test-AC-2: the reviewer has no exception yet' }, () => {
  assert.match(reviewer, /named in the .*## Frozen test fix.* meeting all three conditions is not a BLOCKER/i);
  assert.match(reviewer, /(unmet|failing) condition is a \*\*BLOCKER\*\* tagged `freeze`/i);
  assert.match(reviewer, /removes or weakens an assertion/i);
  assert.match(reviewer, /judge.* new or changed since the last judged round/i);
  assert.match(reviewer, /unchanged since round <N>/);
});

test('AC-2: the verdict template names the check on its Red tests line', { skip: 'red-test-AC-2: the verdict line does not name it yet' }, () => {
  const line = verdict.slice(verdict.indexOf('**Red tests:**'), verdict.indexOf('**Verified:**'));
  assert.match(line, /Frozen test fix/);
  assert.match(line, /three conditions/i);
});

test('AC-2: a freeze BLOCKER is hard stop 8, the spec amendment, escalated to the criterion\'s owner as a blocker', { skip: 'red-test-AC-2: run does not route the freeze BLOCKER yet' }, () => {
  assert.match(freeze, /A `freeze` BLOCKER is hard stop 8/i);
  assert.match(freeze, /"type": "blocker"/);
  assert.match(freeze, /product owner for an `AC-n`/);
});

test('AC-6: PROCESS.md says it in the freeze paragraph', { skip: 'red-test-AC-6: PROCESS.md does not say it yet' }, () => {
  const para = slice(processDoc, 'On a PASS the tests are **frozen**', 'A task whose type says `redTests: false`');
  assert.match(para, /Frozen test fix/);
  assert.match(para, /three conditions/i);
  assert.match(processDoc, /spec amendment only the criterion's owner can make/);
});
