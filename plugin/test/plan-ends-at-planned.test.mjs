import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const plugin = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(plugin, path), 'utf8').replace(/\r\n/g, '\n');
const skill = read('skills/plan-project/SKILL.md');
const run = read('skills/run/SKILL.md');
const shaping = read('skills/shape-project/SKILL.md');
const contract = read('PROCESS.md');

// The plan-gate approval escalation: its question, its options, or an answer read from it.
const APPROVAL = [/Gate decision\?/, /"label": ?"PASS/, /"label": ?"RETURN"/, /PASS \/ PASS WITH DECISIONS \/ RETURN/, /answered PASS/];
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

const START = '**Start where shaping ends.**';
const start = () => item(raw(skill, '## 0. '), START);

// The first cell of each row of step 0's start table, in order.
const startRows = () =>
  raw(skill, '## 0. ')
    .split('\n')
    .filter((line) => /^\s*\| /.test(line) && !/^\s*\|---/.test(line))
    .map((line) => line.trim().replace(/^\| /, '').split(' | ')[0])
    .filter((cell, i, all) => all.indexOf('The story is at') >= 0 && i > all.indexOf('The story is at'));

test('plan-project, run and PROCESS.md name no plan-gate approval escalation', () => {
  assert.deepEqual(approvals(skill), []);
  assert.deepEqual(approvals(run), []);
  assert.deepEqual(approvals(contract), []);
});

test('the 0.2.0 approval escalation is caught, with or without a space after the colon', () => {
  const v020 =
    '<cli> --server <server> --as <alias>/planner escalation raise <story> --question "Plan coverage for <story>: <verdict>, N questions. Gate decision?" --options \'[{"label":"PASS","argument":"..."},{"label":"PASS WITH DECISIONS","argument":"..."},{"label":"RETURN","argument":"..."}]\'';
  assert.equal(approvals(v020).length, 3);
  assert.equal(approvals('[{"label": "PASS", "argument": "..."}, {"label": "RETURN", "argument": "..."}]').length, 2);
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

test('plan-project starts where shaping ends, and a shaped story waits on the PO', () => {
  const text = start();
  assert.match(text, /the first row that fits decides/);
  assert.match(text, /\| the plan step \| carry on \|/);
  assert.match(text, /\| no step at `backlog`, on a type with no `shape` step \| `<cli> --as <alias>\/planner issue update <story> --step <the plan step's id>`, then carry on \|/);
  assert.match(text, /\| the shaped step \| \*\*say the story waits on the PO, and stop\.\*\* Moving it to the plan step is their approval of the body\. Write nothing, and do not move it \|/);
  assert.match(text, /\| the plan gate \| \*\*say it waits on the gate, and stop\*\*.* Write nothing \|/);
  assert.match(text, /\| anywhere else \(`shape` or no step on a type with a shaped step, a step after the plan gate, `ready` or later\) \|/);
  assert.doesNotMatch(text, /--step plan\b/);
});

test('on a type with shape but no shaped step, plan-project starts from shape after the approval escalation', () => {
  assert.match(
    start(),
    /\| `shape`, or no step at `backlog`, on a type with `shape` but no shaped step \| with a body and no open escalation: `<cli> --as <alias>\/planner issue update <story> --step <the plan step's id>`, then carry on\. Shaping ends at `shape` there, and the PO's yes to shape-project's approval escalation was the approval\. With no body, or an escalation still open: \*\*say shaping is not finished, and stop\.\*\* Write nothing \|/,
  );
  const rows = startRows();
  const row = rows.indexOf('`shape`, or no step at `backlog`, on a type with `shape` but no shaped step');
  assert.ok(row >= 0 && row < rows.findIndex((r) => r.startsWith('anywhere else')), rows.join('\n'));
  assert.match(section(skill, '## 7. '), /Step 0 may set the plan step \(a type with no `shape`, or no shaped step\)/);
});

test('sending gaps back sets the story back to shape, and says what hands it back', () => {
  const gaps = section(skill, '### Gaps → back to the PO');
  assert.match(gaps, /set the story back to the PO's step, `issue update <story> --step shape`/);
  assert.match(gaps, /End with: \*"Answer these with `shape-project` on `<ref>`; moving it to planning hands it back to plan-project\."\*/);
  assert.match(gaps, /On a type with no shaped step, where shaping ends at `shape`, end with \*"Answer these with `shape-project` on `<ref>`, then re-run plan-project\."\* instead\./);
  const reply = section(shaping, '### A reply to the gaps sent back');
  assert.doesNotMatch(reply, /The developer re-runs `plan-project`;/);
  assert.match(reply, /The story goes back to `plan-project` when the PO moves it from the shaped step to the plan step, or, on a type with no shaped step, when the developer re-runs it/);
  const amended = section(shaping, '### When the approval round stays');
  assert.doesNotMatch(amended, /Their next `plan-project` rechecks/);
  assert.match(amended, /Once a person moves the story back to the plan step, `plan-project` rechecks the technical criteria and the tasks that serve it\./);
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

test('answered QUESTIONs are applied before the move, and the application is a reply on the report', () => {
  const questions = section(skill, '### The QUESTIONs');
  assert.match(questions, /A report's QUESTIONs are the escalations whose `comment` is its `cN`\./);
  assert.match(questions, /Say in the session, in this order: answer every QUESTION, run plan-project to apply the answers, then move the story to `ready`\. `run` refuses the story until they are applied\./);
  assert.match(questions, /\*\*reply to the report\*\* \(`comment add <story> --parent cN --stdin body`\) with a body opening `# QUESTIONs applied`/);
  assert.match(questions, /That reply is what makes them applied\./);
  assert.match(questions, /move nothing, so the story stays where it was, at the plan gate or at `ready`\./);
  const rows = startRows();
  const apply = rows.indexOf('the plan gate, or `ready` with no step, with QUESTIONs answered and not applied (step 8, "The QUESTIONs")');
  assert.ok(apply >= 0 && apply < rows.indexOf('the plan gate') && apply < rows.findIndex((r) => r.startsWith('anywhere else')), rows.join('\n'));
  assert.match(start(), /carry on at step 8, "The QUESTIONs": apply them, and move nothing \|/);
});

test('returned and three RETURNs count only the reports since the story last moved to ready, before re-planning', () => {
  const text = start();
  assert.match(text, /Count its coverage reports \(comments opening `# Plan coverage:`, step 8\) posted since it last moved to `ready`: after the latest `thread` entry of kind `status` whose `data\.to` is `ready`, or all of them when there is none\./);
  assert.match(text, /One or two: it was returned from the gate\..* Three: do not re-plan; step 8, "Three RETURNs"\./);
  const gate = section(skill, '### The QUESTIONs');
  assert.match(gate, /\*\*Three RETURNs mean the story is wrong, not the plan\.\*\* Step 0 counts them, before any re-planning: three coverage reports since the story last moved to `ready`\./);
  assert.doesNotMatch(gate, /three coverage reports on it already/);
});

test('run reads the plan gate from the step and from the record', () => {
  const gate = item(raw(run, '### Preconditions'), '**The plan gate is passed**');
  assert.match(gate, /its first step of kind `gate` after its `plan` step, found in `process get` by kind and position, never by id/);
  assert.match(gate, /It is passed when all of these hold, and each one that fails is a stop: say which and stop\./);
  assert.match(gate, /- \*\*The story has tasks\*\* \(`subIssues`\)\./);
  assert.match(gate, /- \*\*The gate is recorded\*\*: a coverage report comment on the story by `<div>\/reviewer` .* opening `# Plan coverage:`\. A gate that only existed in a conversation did not happen: with no report, the story was not gated\./);
  assert.match(gate, /- \*\*It has left the plan gate for `ready` or later\*\*: `issue\.status` is `ready`, `in_progress` or `in_review`, and `issue\.step` is not the plan gate or a step before it\./);
  assert.match(gate, /\*\*A story still at the plan gate waits on the gate\.\*\*/);
  assert.match(gate, /- \*\*The latest report's QUESTIONs are answered and applied\*\*: every escalation whose `comment` is that report's `cN` has an answer \(`escalations\[\]\.answer`\), and the report has a reply opening `# QUESTIONs applied`\./);
  assert.match(gate, /One open waits on that answer; answered and not applied waits on `plan-project`, which applies them\./);
});

test('PROCESS.md tells the two gates apart, and records the gate as a step', () => {
  const runtime = section(contract, '## The process, read at runtime');
  assert.match(runtime, /\| `gate` \| One of two, told apart by position, never by id\. The \*\*shaped step\*\*, a `gate` between `shape` and `plan`: shaping ends there .* The \*\*plan gate\*\*, the type's first `gate` after its `plan` step: planning ends there/);
  assert.doesNotMatch(runtime, /After a gate passes the orchestrator sets `--status ready`/);
  const shapingPart = section(contract, '## Before the plan: shaping');
  assert.match(shapingPart, /\*\*Planning starts at the plan step\.\*\* .* `plan-project` starts only there, or where shaping ends on a type with no shaped step: from `shape` or from no step at `backlog`, setting the plan step itself, since the approval escalation was the approval\./);
  assert.match(shapingPart, /On a story still at the shaped step it says the story waits on the product owner and stops, writing nothing\. A story it sends gaps back on goes back to `shape`\./);
  const gatePart = section(contract, '## The plan gate');
  assert.match(gatePart, /No escalation asks for the gate decision: \*\*the decision is a person's move\.\*\* Moving the story from the plan gate to `ready` passes it; moving it back to the plan step returns it to planning\./);
  assert.match(gatePart, /With QUESTIONs, the order is: answer them, run `plan-project` to apply the answers \(it replies `# QUESTIONs applied` to the report\), then move the story to `ready`\./);
  assert.match(gatePart, /it refuses a story with no coverage report, one still at the plan gate, and one whose latest report has a QUESTION open, or answered and not applied\./);
  assert.match(section(contract, '## Records'), /\| plan gate \| .* the answers applied as a reply to it opening `# QUESTIONs applied`; the story at the plan gate step, and the decision a person's move: to `ready` passes it, back to the plan step returns it \|/);
});
