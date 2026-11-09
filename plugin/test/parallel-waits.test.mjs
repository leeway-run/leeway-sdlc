import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// LWY-183.1: every escalation of a round is waited on at once. Each test names the phrase it pins and the file(s) it reads;
// this file never reads itself. Round 0: skipped until the code round writes the text.
const RED = 'red-test-';

const plugin = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(plugin, path), 'utf8').replace(/\r\n/g, '\n');
const flat = (text) => text.replace(/\s+/g, ' ');

// The text under `heading` (any level), up to the next heading of the same or a higher level, on one line.
function under(doc, heading) {
  const m = doc.match(new RegExp(`\\n(#+) ${heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\n`));
  assert.ok(m, `no "${heading}" heading`);
  const start = m.index + 1;
  const next = new RegExp(`\\n#{1,${m[1].length}} `, 'g');
  next.lastIndex = start + 1;
  const end = next.exec(doc);
  return flat(doc.slice(start, end ? end.index : undefined));
}

// The sentence-run starting at `lead` and ending before `until`, on one line.
function from(text, lead, until) {
  const at = text.indexOf(lead);
  assert.ok(at >= 0, `no "${lead}"`);
  if (!until) return text.slice(at);
  const end = text.indexOf(until, at + lead.length);
  assert.ok(end >= 0, `no "${until}" after "${lead}"`);
  return text.slice(at, end);
}

const AT_ONCE = 'start one background wait per open escalation of the round, all together';
const SITES = [
  'skills/run/SKILL.md',
  'skills/plan-project/SKILL.md',
  'skills/shape-project/SKILL.md',
  'skills/sdlc-install/SKILL.md',
  'skills/sync-repo/SKILL.md',
  'skills/sdlc-tune/SKILL.md',
];

// Pin 1 (TC-1): the phrase AT_ONCE, in each of eight files; PROCESS.md under "Then wait for the answer", HARNESS.md under
// "Waiting for an answer".
for (const file of SITES) {
  test(`${file} starts one background wait per open escalation of a round, together`, () => {
    assert.ok(flat(read(file)).includes(AT_ONCE), `${file} lacks "${AT_ONCE}"`);
  });
}

test('PROCESS.md, "Then wait for the answer", starts one background wait per open escalation of a round, together', () => {
  const rule = under(read('PROCESS.md'), 'Questions to the human are escalations');
  const wait = from(rule, '**Then wait for the answer, in every skill that raises**', 'A wait that holds work stops the turn only when:');
  assert.ok(wait.includes(AT_ONCE), `no "${AT_ONCE}" in "Then wait for the answer"`);
});

test('HARNESS.md, "Waiting for an answer", starts one background wait per open escalation of a round, together', () => {
  const wait = under(read('HARNESS.md'), 'Waiting for an answer');
  assert.ok(wait.includes(AT_ONCE), `no "${AT_ONCE}" in "Waiting for an answer"`);
});

// Also catches a waiting site worded "wait on ... in turn" or "wait ... one after another" within one sentence (shape-project's
// "wait on each open escalation of the round in turn" among them). Not run's or PROCESS.md's "one after another" about a project's
// issues, PROCESS.md's "through it in turn" or sdlc-tune's "written in turn": none follows "wait" in its sentence.
const WAIT_SERIAL = /\bwait(?:ed)? on[^.]{0,80}\bin turn\b|\bwait(?:ed)?\b[^.]{0,120}\bone after another\b/gi;

// Pin 2 (TC-1): none of the old phrases, nor a WAIT_SERIAL match, in run, plan-project, shape-project, sdlc-install, sync-repo, sdlc-tune, PROCESS.md, HARNESS.md.
test('none of the old waiting phrases is left in a waiting site', () => {
  const old = [
    'waited on one after another',
    'wait on each open one in turn',
    'on each in turn',
    "Wait on each QUESTION's escalation in turn",
    'wait on each open gap escalation in turn',
    'wait on it ("Wait, then carry on"), one after another',
    'of the stop\'s escalations** ("Wait, then carry on"), one after another',
  ];
  for (const file of [...SITES, 'PROCESS.md', 'HARNESS.md']) {
    const text = flat(read(file));
    for (const phrase of old) assert.ok(!text.includes(phrase), `${file} still says "${phrase}"`);
    for (const m of text.matchAll(WAIT_SERIAL)) assert.fail(`${file} still says "${m[0]}", which matches ${WAIT_SERIAL}`);
  }
});

// Pins 3 to 5 (TC-2): run, "Wait, then carry on".
test('run: exit 0 carries on only when every escalation of the round is answered', () => {
  assert.ok(under(read('skills/run/SKILL.md'), 'Wait, then carry on').includes('Exit 0 carries on only when every escalation of the round is answered'), `lacks ${JSON.stringify('Exit 0 carries on only when every escalation of the round is answered')}`);
});

test("run: exit 5 answers the question and restarts that escalation's wait only", () => {
  assert.ok(under(read('skills/run/SKILL.md'), 'Wait, then carry on').includes("Exit 5 answers the question and restarts that escalation's wait only"), `lacks ${JSON.stringify("Exit 5 answers the question and restarts that escalation's wait only")}`);
});

test('run: a stop exit acts as it does today for that exit and leaves the other waits running', () => {
  assert.ok(under(read('skills/run/SKILL.md'), 'Wait, then carry on').includes('A stop exit (2, 3, 4, 1 or any other) acts as it does today for that exit and leaves the other waits running'), `lacks ${JSON.stringify('A stop exit (2, 3, 4, 1 or any other) acts as it does today for that exit and leaves the other waits running')}`);
});

// Pins 6 and 7 (TC-4): PROCESS.md, "A question asked of the agent is answered, then the wait starts again."
const asked = () => {
  const rule = under(read('PROCESS.md'), 'Questions to the human are escalations');
  return from(rule, '**A question asked of the agent is answered', '**Escalations go out in rounds.**');
};

test('PROCESS.md: a null by.actor.role is answered as <alias>/agent', () => {
  assert.ok(asked().includes('a null `by.actor.role` is answered as `<alias>/agent`'), `lacks ${JSON.stringify('a null `by.actor.role` is answered as `<alias>/agent`')}`);
});

test('PROCESS.md: an answer refused with invalid_clarification_answer is shortened and written once more', () => {
  assert.ok(asked().includes('a refusal with `invalid_clarification_answer` (an answer over 1,000 characters) is shortened and written once more, not treated as an outage'), `lacks ${JSON.stringify('a refusal with `invalid_clarification_answer` (an answer over 1,000 characters) is shortened and written once more, not treated as an outage')}`);
});
