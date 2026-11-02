import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const plugin = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(plugin, path), 'utf8').replace(/\r\n/g, '\n');
const skill = read('skills/plan-project/SKILL.md');
const run = read('skills/run/SKILL.md');
const contract = read('PROCESS.md');

// The plan-gate approval escalation: its question, its options, or an answer read from it.
const APPROVAL = [/Gate decision\?/, /"label":"PASS/, /"label":"RETURN"/, /PASS \/ PASS WITH DECISIONS \/ RETURN/, /answered PASS/];
const approvals = (text) => APPROVAL.filter((re) => re.test(text.replace(/\s+/g, ' '))).map(String);

// The text under a `##` or `###` heading that starts with `heading`.
function raw(text, heading) {
  const found = text.split(/\n(?=#{2,3} )/).find((chunk) => chunk.startsWith(heading));
  assert.ok(found, `no "${heading}" section`);
  return found;
}
const section = (text, heading) => raw(text, heading).replace(/\s+/g, ' ');

// A numbered item of a section, by the bold lead it starts with, joined onto one line.
function item(text, lead) {
  const found = text.split(/\n(?=\s*\d+\. )/).find((s) => s.trim().replace(/^\d+\. /, '').startsWith(lead));
  assert.ok(found, `no item "${lead}"`);
  return found.replace(/\s+/g, ' ');
}

test('plan-project, run and PROCESS.md name no plan-gate approval escalation', () => {
  assert.deepEqual(approvals(skill), []);
  assert.deepEqual(approvals(run), []);
  assert.deepEqual(approvals(contract), []);
});

test('the 0.2.0 approval escalation is caught', () => {
  const v020 =
    '<cli> --server <server> --as <alias>/planner escalation raise <story> --question "Plan coverage for <story>: <verdict>, N questions. Gate decision?" --options \'[{"label":"PASS","argument":"..."},{"label":"PASS WITH DECISIONS","argument":"..."},{"label":"RETURN","argument":"..."}]\'';
  assert.equal(approvals(v020).length, 3);
  assert.equal(approvals('an escalation on it answered PASS or PASS WITH DECISIONS').length, 1);
  assert.equal(approvals('the human decision as an escalation with options PASS / PASS WITH DECISIONS / RETURN').length, 1);
});

test('plan-project tells the shaped step from the plan gate, by kind and position', () => {
  const orient = section(skill, '## 0. ');
  assert.match(orient, /\| a `gate` step after `plan` \| step 8 ends planning at the plan gate \|/);
  assert.match(orient, /\*\*The plan gate\*\* is the type's first step of kind `gate` after its `plan` step/);
  assert.match(orient, /A `gate` step before `plan` is the shaped step, where shaping ends: it is not the plan gate\./);
  assert.match(orient, /by kind and position, never by id/);
});

test('plan-project starts only from the plan step, and a shaped story waits on the PO', () => {
  const start = item(raw(skill, '## 0. '), '**Start only from the plan step.**');
  assert.match(start, /\| the plan step \| carry on \|/);
  assert.match(start, /\| no step, on a type with no `shape` step \| `<cli> --as <alias>\/planner issue update <story> --step <the plan step's id>`, then carry on \|/);
  assert.match(start, /\| the shaped step \| \*\*say the story waits on the PO, and stop\.\*\* Moving it to the plan step is their approval of the body\. Write nothing, and do not move it \|/);
  assert.match(start, /\| the plan gate \| .*\*\*say it waits on the gate, and stop\*\*.* Write nothing \|/);
  assert.match(start, /no step on a type with `shape`/);
  assert.doesNotMatch(start, /--step plan\b/);
});

test('sending gaps back sets the story back to shape', () => {
  assert.match(section(skill, '### Gaps → back to the PO'), /set the story back to the PO's step, `issue update <story> --step shape`/);
});

test('planning ends at the plan gate with the report, and the move to ready is a person\'s', () => {
  const gate = section(skill, '## 8. ');
  const [withoutGate, withGate] = gate.split('**A type with one**');
  assert.match(withoutGate, /`issue update <story> --status ready` \(no step\)/);
  assert.match(withGate, /^: `issue update <story> --step <the plan gate's id>`/);
  assert.doesNotMatch(withGate, /--status ready/);
  const report = section(skill, '### Post the full report, then stop at the gate');
  assert.match(report, /Post the \*\*full report\*\* as a comment on each story it covers/);
  assert.match(report, /No escalation asks for the gate decision: the decision is the person's move\./);
  assert.match(report, /\*\*Passing the gate\*\* is a person moving the story from the plan gate to `ready`\./);
  assert.match(report, /\*\*Returning it\*\* is a person moving it back to the plan step\./);
  assert.match(section(skill, '## 7. '), /The moves out of the shaped step and out of the plan gate are a person's\*\*: this skill never makes them on its own initiative\./);
});

test('run reads the plan gate from the step', () => {
  const gate = item(raw(run, '### Preconditions'), '**The plan gate is passed**');
  assert.match(gate, /its first step of kind `gate` after its `plan` step, found in `process get` by kind and position, never by id/);
  assert.match(gate, /the story has left the plan gate for `ready` or later/);
  assert.match(gate, /\*\*A story still at the plan gate waits on the gate\*\*: say so and stop\./);
  assert.doesNotMatch(gate, /escalations\[\]\.answer/);
});

test('PROCESS.md tells the two gates apart, and records the gate as a step', () => {
  const runtime = section(contract, '## The process, read at runtime');
  assert.match(runtime, /\| `gate` \| One of two, told apart by position, never by id\. The \*\*shaped step\*\*, a `gate` between `shape` and `plan`: shaping ends there .* The \*\*plan gate\*\*, the type's first `gate` after its `plan` step: planning ends there/);
  assert.doesNotMatch(runtime, /After a gate passes the orchestrator sets `--status ready`/);
  assert.match(section(contract, '## Before the plan: shaping'), /\*\*Planning starts at the plan step\.\*\* .* on a story still at the shaped step it says the story waits on the product owner and stops, writing nothing\. A story it sends gaps back on goes back to `shape`\./);
  assert.match(section(contract, '## The plan gate'), /No escalation asks for the gate decision: \*\*the decision is a person's move\.\*\* Moving the story from the plan gate to `ready` passes it; moving it back to the plan step returns it to planning\./);
  assert.match(section(contract, '## Records'), /\| plan gate \| .* the story at the plan gate step, and the decision a person's move: to `ready` passes it, back to the plan step returns it \|/);
});
