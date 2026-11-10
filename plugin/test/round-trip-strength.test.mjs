import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// LWY-222.2, round 1 (TC-6): the pins round-trip.test.mjs leaves open. Each reads only plugin/PROCESS.md and
// plugin/skills/plan-project/SKILL.md, names the phrase it matches, and is run on fixtures that break it.
//
//   - the definition of a round trip, in PROCESS.md "Before the plan: shaping": it names no step after the plan step, and no
//     answer but *Hold*;
//   - plan-project "Done when": a held story is not left "with no tasks" as its end state;
//   - plan-project's three endings (the plan gate, "# QUESTIONs applied", `ready` with no plan gate): a held story's round trip
//     still in flight keeps the session on it, and the session stops when none is still open.
const plugin = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...parts) => readFileSync(join(plugin, ...parts), 'utf8').replace(/\r\n/g, '\n');

const planProject = read('skills', 'plan-project', 'SKILL.md');
const contract = read('PROCESS.md');

// Copied from plan-moves-on-its-own.test.mjs (LWY-200.1), as round-trip.test.mjs does.
function section(text, heading) {
  const level = /^#+/.exec(heading)[0].length;
  const lines = text.split('\n');
  const start = lines.findIndex((line) => line.startsWith(heading));
  assert.ok(start >= 0, `no "${heading}" section`);
  let end = lines.length;
  let fenced = false;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^\s*```/.test(lines[i])) { fenced = !fenced; continue; }
    const m = !fenced && /^(#+) /.exec(lines[i]);
    if (m && m[1].length <= level) { end = i; break; }
  }
  return lines.slice(start, end).join('\n');
}
const flat = (text) => text.replace(/\s+/g, ' ').trim();
const sentences = (text) => flat(text).split(/(?<=[.;!?]\**)\s+(?=[A-Z*`(_])|; /);
const sentenceWith = (text, ...res) => sentences(text).find((s) => res.every((re) => re.test(s)));
const between = (text, lead, until) => {
  const at = text.indexOf(lead);
  assert.ok(at >= 0, `no "${lead}"`);
  const end = text.indexOf(until, at + lead.length);
  assert.ok(end >= 0, `no "${until}" after "${lead}"`);
  return text.slice(at, end);
};

const shapingPart = section(contract, '## Before the plan: shaping');
const doneWhen = section(planProject, '## Done when');

// --- the definition: no step after the plan step (c2), no answer but *Hold* (c3) ---------------------------------

const DEFINITION = [/\bround trip\b/, /\blatest gap comment\b/, /at `shape`, the shaped step or the plan step/];
const LATER_STEP = /\b(?:later|after|beyond)\b|\bor any\b|\bany step\b/i;
const OTHER_THAN_HOLD = /\*(?:Split|Accept)\b[^*]*\*|\bany answer\b|\bwhatever the answer\b/i;

const GOOD = 'A story is in a round trip when its latest gap comment has its escalation answered *Hold*, and the story is at `shape`, the shaped step or the plan step.';

test('PROCESS.md "Before the plan: shaping": the definition of a round trip names no step after the plan step', () => {
  const sentence = sentenceWith(shapingPart, ...DEFINITION);
  assert.ok(sentence, 'no sentence defining a round trip by its latest gap comment and a story at `shape`, the shaped step or the plan step');
  assert.doesNotMatch(sentence, LATER_STEP);
});

test('PROCESS.md "Before the plan: shaping": the definition names no answer but *Hold*', () => {
  const sentence = sentenceWith(shapingPart, ...DEFINITION);
  assert.ok(sentence, 'no sentence defining a round trip');
  assert.doesNotMatch(sentence, OTHER_THAN_HOLD);
});

// The two pins above, run on fixtures. This runs on the fixtures, not on the plugin's text.
test('the definition pins fail a wording that adds a later step or an answer other than *Hold*, and pass the right one', () => {
  assert.doesNotMatch(GOOD, LATER_STEP);
  assert.doesNotMatch(GOOD, OTHER_THAN_HOLD);
  for (const later of [
    GOOD.replace('the plan step.', 'the plan step, or any step after it.'),
    GOOD.replace('or the plan step.', 'or the plan step or a later one.'),
    GOOD.replace('the plan step.', 'the plan step or beyond.'),
    GOOD.replace('the plan step.', 'the plan step or the plan gate, whichever step it has reached after.'),
  ]) {
    assert.ok(sentenceWith(later, ...DEFINITION), `the fixture no longer matches the definition: ${later}`);
    assert.match(later, LATER_STEP, later);
  }
  for (const other of [
    GOOD.replace('answered *Hold*', 'answered *Hold* or *Split the story as proposed*'),
    GOOD.replace('answered *Hold*', 'answered *Accept the gaps as written*'),
    GOOD.replace('answered *Hold*', 'answered with any answer'),
    GOOD.replace('answered *Hold*', 'answered, whatever the answer'),
  ]) assert.match(other, OTHER_THAN_HOLD, other);
});

// --- "Done when": a held story is not left with no tasks as its end state (c4) -------------------------------------

test('plan-project "Done when": a story whose gaps went back to the PO is not left "with no tasks" as its end state', () => {
  const sentence = sentenceWith(doneWhen, /\bgaps went back to the PO\b/);
  assert.ok(sentence, 'no sentence about a story whose gaps went back to the PO');
  assert.doesNotMatch(sentence, /\bno tasks\b/);
  assert.doesNotMatch(flat(doneWhen), /\band it has no tasks\b/);
});

test('the "Done when" pin fails the old wording and passes the new one', () => {
  const NO_TASKS = /\bno tasks\b/;
  assert.match('Every story passed the product check, or its gaps went back to the PO as one comment and it has no tasks.', NO_TASKS);
  assert.doesNotMatch('Every story passed the product check, or its gaps went back to the PO as one comment, and on *Hold* it was handed to shape-project.', NO_TASKS);
});

// --- the endings: a round trip in flight keeps the session on it (c5) ----------------------------------------------

const IN_FLIGHT = [/\bround trip\b/, /\bin flight\b/, /\bkeeps the session\b/, /\bwaits stay running\b/, /\bhand-over\b/, /\bhand-back\b/, /\bnone\b[^.]*\bstill open\b/];
const ENDINGS = {
  'the plan gate': ['Raise the QUESTIONs, when the report has any', '### The QUESTIONs'],
  '`# QUESTIONs applied`': ['what makes them applied.', '**The move follows'],
  '`ready` with no plan gate': ['**A type without a plan gate**', '**A type with one**'],
};

for (const [name, [lead, until]] of Object.entries(ENDINGS)) {
  test(`plan-project's ending at ${name}: a held story's round trip in flight keeps the session on it, and it stops when none is still open`, () => {
    const text = between(planProject, lead, until);
    assert.ok(sentenceWith(text, ...IN_FLIGHT), `no sentence saying a held story's round trip in flight keeps the session on it, its waits stay running, its hand-over and hand-back carry on, and it stops when none is still open\n${flat(text)}`);
  });
}

test('the ending pin fails an ending with no round trip in flight, and one that waits on the gaps last', () => {
  const ok = 'A held story\'s round trip still in flight keeps the session on it (step 1): its waits stay running, its hand-over and hand-back carry on, and the session stops when none is still open.';
  assert.ok(sentenceWith(ok, ...IN_FLIGHT));
  for (const bad of [
    'Then say where each story is, and stop.',
    'Then wait on the held stories\' gaps ("The last wait", below), and stop.',
    ok.replace('keeps the session on it', 'ends the session'),
    ok.replace(', and the session stops when none is still open', ''),
    ok.replace('its waits stay running, ', ''),
  ]) assert.equal(sentenceWith(bad, ...IN_FLIGHT), undefined, bad);
});
