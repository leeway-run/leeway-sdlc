import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// LWY-222.2, rounds 1 and 2 (TC-6): the pins round-trip.test.mjs leaves open. Each reads only plugin/PROCESS.md, plugin/skills/plan-project/SKILL.md (and shape-project for the restatement pin), names the phrase it matches, and is run on fixtures that break it.
//
//   - the definition of a round trip, in PROCESS.md "Before the plan: shaping": it names no step after the plan step, and no
//     answer but *Hold*;
//   - plan-project "Done when": a held story is not left "with no tasks" as its end state;
//   - plan-project step 1 states once what keeps the session on a round trip in flight; its three endings (the plan gate, "# QUESTIONs applied", `ready` with no plan gate) point at it.
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

// --- one statement of what keeps the session on a round trip (step 1), and a pointer in each ending (c5, c10) ------------

const IN_FLIGHT = [/\bround trip\b/, /\bin flight\b/, /\bkeeps the session\b/, /\bwaits stay running\b/, /\bhand-over\b/, /\bhand-back\b/, /\bnone\b[^.]*\bstill open\b/];
const POINTER = [/\bround trip\b/, /\bin flight\b/, /\bstep 1\b/];
const ENDINGS = {
  'the plan gate': ['Raise the QUESTIONs, when the report has any', '### The QUESTIONs'],
  '`# QUESTIONs applied`': ['what makes them applied.', '**The move follows'],
  '`ready` with no plan gate': ['**A type without a plan gate**', '**A type with one**'],
};

test('plan-project step 1: a held story\'s round trip in flight keeps the session on it, its waits stay running, and the session stops when none is still open', () => {
  const gapsPart = section(planProject, '### Gaps → back to the PO');
  assert.ok(sentenceWith(gapsPart, ...IN_FLIGHT), `no sentence saying a held story's round trip in flight keeps the session on it, its waits stay running, its hand-over and hand-back carry on, and it stops when none is still open\n${flat(gapsPart)}`);
});

for (const [name, [lead, until]] of Object.entries(ENDINGS)) {
  test(`plan-project's ending at ${name}: a round trip in flight decides when the session stops, by a pointer to step 1 and not a copy of it`, () => {
    const text = between(planProject, lead, until);
    assert.ok(sentenceWith(text, ...POINTER), `no sentence pointing at step 1 for a round trip still in flight\n${flat(text)}`);
    assert.doesNotMatch(flat(text), /\bwaits stay running\b/, 'the in-flight statement is copied into the ending; step 1 states it once');
  });
}

test('the ending pins fail an ending with no pointer, a copy of the statement, and one that waits on the gaps last; the step 1 pin fails a statement without a part', () => {
  const ptr = 'A round trip still in flight decides when the session stops (step 1).';
  assert.ok(sentenceWith(ptr, ...POINTER));
  for (const bad of [
    'Then say where each story is, and stop.',
    'Then wait on the held stories\' gaps ("The last wait", below), and stop.',
    ptr.replace('(step 1)', ''),
    ptr.replace('still in flight ', ''),
  ]) assert.equal(sentenceWith(bad, ...POINTER), undefined, bad);
  const ok = 'A held story\'s round trip still in flight keeps the session on it: its waits stay running, its hand-over and hand-back carry on, and the session stops when none is still open.';
  assert.ok(sentenceWith(ok, ...IN_FLIGHT));
  assert.match(ok, /\bwaits stay running\b/);
  for (const bad of [
    ok.replace('keeps the session on it', 'ends the session'),
    ok.replace(', and the session stops when none is still open', ''),
    ok.replace('its waits stay running, ', ''),
  ]) assert.equal(sentenceWith(bad, ...IN_FLIGHT), undefined, bad);
});

// --- step 0: no earlier `shape` row decides a story in a round trip (c8) --------------------------------------------

const startRows = section(planProject, '## 0. ')
  .split('\n')
  .filter((line) => /^\s*\| /.test(line) && !/^\s*\|---/.test(line))
  .map((line) => flat(line));
// The "Start where shaping ends" table: the rows after its "The story is at" header.
const rows = startRows.slice(startRows.findIndex((r) => r.startsWith('| The story is at |')) + 1);
const isShapeRow = (r) => /^\| [^|]*`shape`/.test(r);
const isRoundTripRow = (r) => /\bround trip\b/.test(r) && /\bhand(?:s|ed)? over\b/.test(r);
const isGapOpenRow = (r) => /\blatest gap comment\b/.test(r) && /\bescalation\b[^|]*\bopen\b/.test(r);
// The problem found, or null: a `shape` row that is neither round-trip row, listed above one of them, would decide first.
function earlierShapeRow(table) {
  const last = Math.max(...table.map((r, i) => (isRoundTripRow(r) && isShapeRow(r)) || (isGapOpenRow(r) && isShapeRow(r)) ? i : -1));
  assert.ok(last >= 0, 'no round-trip row at `shape`');
  const hit = table.slice(0, last).find((r) => isShapeRow(r) && !isRoundTripRow(r) && !isGapOpenRow(r));
  return hit ?? null;
}

test('plan-project step 0: no `shape` row listed before the round-trip rows can decide a story in a round trip', () => {
  assert.equal(earlierShapeRow(rows), null, 'an earlier `shape` row fits a story in a round trip first ("the first row that fits decides")');
});

test('the row-order pin fails today\'s order, with the refusal rows above the round-trip rows, and passes the right one', () => {
  const rt = rows.find((r) => isShapeRow(r) && isRoundTripRow(r));
  const open = rows.find((r) => isShapeRow(r) && isGapOpenRow(r));
  const noShaped = rows.find((r) => r.startsWith('| `shape`, or no step at `backlog`, on a type with `shape` but no shaped step |'));
  assert.ok(rt && open && noShaped, 'a row is missing');
  assert.equal(earlierShapeRow([noShaped, rt, open]), noShaped);
  assert.equal(earlierShapeRow([rt, noShaped, open]), noShaped);
  assert.equal(earlierShapeRow([rt, open, noShaped]), null);
});

// --- TC-1: plan-project and shape-project do not restate the definition (c11) ---------------------------------------

const shapeProject = read('skills', 'shape-project', 'SKILL.md');
const RESTATES = [/\blatest gap comment\b/, /\banswered\b[^.]*\*Hold\*|\*Hold\*[^.]*\banswered\b/];

for (const [name, text] of [['plan-project', planProject], ['shape-project', shapeProject]]) {
  test(`${name}/SKILL.md does not restate the definition of a round trip (latest gap comment with its escalation answered *Hold*), which PROCESS.md holds`, () => {
    assert.equal(sentenceWith(text, ...RESTATES), undefined, `${name} restates the definition: ${sentenceWith(text, ...RESTATES)}`);
  });
}

test('the restatement pin fails the reviewer\'s wording and a rewording of it, and passes step 0\'s row', () => {
  for (const bad of [
    'A story is in a round trip when its latest gap comment has its escalation answered *Hold*.',
    'The story counts as held again once *Hold* was the answer to its latest gap comment\'s escalation, answered by the PO.',
  ]) assert.ok(sentenceWith(bad, ...RESTATES), bad);
  assert.equal(sentenceWith('| `shape`, with its latest gap comment\'s escalation open | wait on it at once |', ...RESTATES), undefined);
});
