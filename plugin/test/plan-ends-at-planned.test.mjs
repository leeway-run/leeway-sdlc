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

test('plan-project starts where shaping ends, moves a shaped story with no shaping escalation open, and refuses the rest', () => {
  const text = start();
  assert.match(text, /the first row that fits decides/);
  assert.match(text, /\| the plan step \| carry on \|/);
  assert.match(text, /\| no step at `backlog`, on a type with no `shape` step \| `<cli> --as <alias>\/planner issue update <story> --step <the plan step's id>`, then carry on \|/);
  assert.match(text, /\| the plan gate \| \*\*say it waits on the gate, and stop\*\*: it was returned, or its session ended before step 8 moved it\. Write nothing, and move it only if the person asks \(step 7\) \|/);
  assert.match(text, /\| anywhere else \(a step after the plan gate, \`ready\` or later\) \|/);
  assert.doesNotMatch(text, /--step plan\b/);
});

// LWY-222.2 (TC-3): the shaped-step row keeps its move and its comment, and adds the round-trip clause after "then carry on".
// Rewritten from the pin that matched the whole row ending at "then carry on |".
test('plan-project\'s shaped-step row moves the story, posts `# Planning started`, and adds that in a round trip the PO\'s answers to shaping were the approval', { skip: 'red-test-TC-3: the shaped-step row has no round-trip clause' }, () => {
  assert.match(start(), /\| the shaped step, with no shaping escalation open \| \`<cli> --as <alias>\/planner issue update <story> --step <the plan step's id>\`, say so in the session, and post a comment opening \`# Planning started\` saying running plan-project was the approval of the body, then carry on[^|]*\bin a round trip\b[^|]*the PO's answers to shaping were the approval of the body[^|]*\|/);
});

test('on a type with shape but no shaped step, plan-project starts from shape after the approval escalation', () => {
  assert.match(
    start(),
    /\| `shape`, or no step at `backlog`, on a type with `shape` but no shaped step \| with a body and no open escalation: `<cli> --as <alias>\/planner issue update <story> --step <the plan step's id>`, then carry on\. Shaping ends at `shape` there, and the PO's yes to shape-project's approval escalation was the approval\. With no body, or an escalation still open: \*\*say shaping is not finished, and stop\.\*\* Write nothing \|/,
  );
  const rows = startRows();
  const row = rows.indexOf('`shape`, or no step at `backlog`, on a type with `shape` but no shaped step');
  assert.ok(row >= 0 && row < rows.findIndex((r) => r.startsWith('anywhere else')), rows.join('\n'));
  assert.match(section(skill, '## 7. '), /Step 0 may set the plan step \(a type with no \`shape\`, or no shaped step, or a story at the shaped step with no shaping escalation open\)/);
});

test('sending gaps back sets the story back to shape, and says what hands it back', () => {
  const gaps = section(skill, '### Gaps → back to the PO');
  assert.match(gaps, /set the story back to the PO's step, `issue update <story> --step shape`/);
  assert.match(gaps, /End with: \*"Answer these with `shape-project` on `<ref>`; moving it to planning hands it back to plan-project\."\*/);
  assert.match(gaps, /On a type with no shaped step, where shaping ends at `shape`, end with \*"Answer these with `shape-project` on `<ref>`, then re-run plan-project\."\* instead\./);
  const reply = section(shaping, '### A reply to the gaps sent back');
  assert.doesNotMatch(reply, /The developer re-runs `plan-project`;/);
  assert.match(reply, /The story goes back to \`plan-project\` when it is run on the story at the shaped step, or, on a type with no shaped step, when the developer re-runs it/);
  const amended = section(shaping, '### When the approval round stays');
  assert.doesNotMatch(amended, /Their next `plan-project` rechecks/);
  assert.match(amended, /Once a person moves the story back to the plan step, `plan-project` rechecks the technical criteria and the tasks that serve it\./);
});

test('planning ends with the report, and the move to ready is plan-project\'s on a PASS', () => {
  const gate = section(skill, '## 8. ');
  const [withoutGate, withGate] = gate.split('**A type with one**');
  assert.match(withoutGate, /`issue update <story> --status ready` \(no step\)/);
  assert.match(withGate, /^: \`issue update <story> --step <the plan gate's id>\`/);
  assert.doesNotMatch(withGate, /--status ready/);
  const report = section(skill, '### Post the full report, then stop at the gate');
  assert.match(report, /Post the \*\*full report\*\* as a comment on each story it covers/);
  assert.match(report, /No escalation asks for the gate decision: the verdict decides, and this skill makes the move\./);
  assert.match(report, /A RETURN is not moved to \`ready\`: the story stays at the plan gate with its report, and a person moves it back to the plan step to return it to planning\./);
  assert.match(report, /The gate is passed per story: one story of a plan moves to \`ready\` while another stays at the plan gate\./);
  assert.match(report, /On a PASS, move the story to \`ready\` with \`<cli> --as <alias>\/planner issue update <story> --status ready\` \(no step\), and post a comment opening \`# Moved to ready\` naming the report's \`cN\` and its verdict\./);
  assert.match(section(skill, '## 7. '), /The moves out of the shaped step and out of the plan gate are this skill's own\*\*: this skill makes them on its own/);
});

test('each QUESTION is a top-level comment of its own, and a report\'s QUESTIONs are the escalations on those comments', () => {
  const questions = section(skill, '### The QUESTIONs');
  assert.match(questions, /Post each QUESTION as \*\*its own top-level comment\*\* on the story, as `<alias>\/planner` \(`comment add <story> --stdin body`\), with a body opening `# QUESTION <n> of c<report>`, where `c<report>` is the report's first comment\./);
  assert.match(questions, /Then raise its escalation with `"comment"` set to that QUESTION comment's `cN`/);
  assert.match(questions, /\*\*A report's QUESTIONs are the escalations on the comments opening `# QUESTION … of c<report>`\*\*; an escalation on no comment, or on the report itself, is not one\./);
  for (const text of [skill, run, contract]) {
    assert.doesNotMatch(text.replace(/\s+/g, ' '), /escalations? whose `comment` is/);
    assert.doesNotMatch(text.replace(/\s+/g, ' '), /tied to the report with `--comment cN`/);
  }
  assert.match(section(skill, '## Done when'), /every QUESTION in it is a comment of its own with an escalation on it/);
});

test('answered QUESTIONs are applied before the move, and the application is a reply on the report', () => {
  const questions = section(skill, '### The QUESTIONs');
  assert.match(questions, /Say in the session, in this order: answer every QUESTION; this session applies the answers as they come, then moves the story to \`ready\` \(if it has ended, run plan-project to apply them and move it\)\. \`run\` refuses the story until they are applied\./);
  assert.match(questions, /\*\*reply to the report\*\* \(`comment add <story> --parent cN --stdin body`\) with a body opening `# QUESTIONs applied`/);
  assert.match(questions, /That reply is what makes them applied\./);
  assert.match(questions, /On PASS WITH DECISIONS with a QUESTION still open, the story is not moved: it stays at the plan gate while it waits\./);
  const rows = startRows();
  const apply = rows.indexOf('the plan gate, or `ready` with no step, with the latest report\'s QUESTIONs answered and not applied (step 8, "The QUESTIONs")');
  assert.ok(apply >= 0 && apply < rows.indexOf('the plan gate') && apply < rows.findIndex((r) => r.startsWith('anywhere else')), rows.join('\n'));
  assert.match(start(), /carry on at step 8, "The QUESTIONs": apply them, and where the latest report's verdict is PASS WITH DECISIONS and the story is still at the plan gate, move it to \`ready\` as that section says \|/);
});

test('returned and three or more RETURNs count only the reports since the latest of the move to ready, the move into planning from shaping, a re-plan answer and a re-plan request', () => {
  const text = start();
  assert.match(text, /Count its coverage reports \(comments opening `# Plan coverage:`, step 8\) posted since the latest of four marks: - its last move to `ready`: the latest `thread` entry of kind `status` whose `data\.to` is `ready`; - its last move into the plan step from `shape` or the shaped step\./);
  assert.match(text, /The thread records no step move, so read it from the latest comment that sent the story back to `shape`, the one whose closing sentence begins \*"Answer these with `shape-project` on `<ref>`"\* \(step 1's gaps, or step 8's "Three RETURNs"\): the story came back to planning after it;/);
  assert.doesNotMatch(text, /the one ending \*"Answer these/);
  const endings = [...section(skill, '### Gaps → back to the PO').matchAll(/[Ee]nd with:? \*"([^"]*)"\*/g)].map((m) => m[1]);
  assert.equal(endings.length, 2, endings.join('\n'));
  for (const ending of endings) assert.match(ending, /^Answer these with `shape-project` on `<ref>`[;,] [^.]*\.$/);
  assert.match(text, /- on a type with no `shape`, the latest "Three RETURNs" escalation answered \*Re-plan once more\* \(step 8\): count only the reports after the one it is tied to \(`escalations\[\]\.comment`\); - the latest comment opening `# Re-plan requested`, posted when a person asks to plan a stopped story again \(step 8\): count only the reports after it\. With no mark, count all of them\./);
  assert.match(text, /None in the window: plan it afresh;.* One or two: it was returned from the gate\..* Three or more: do not re-plan; step 8, "Three RETURNs"\./);
  const gate = section(skill, '### The QUESTIONs');
  assert.match(gate, /\*\*Three RETURNs mean the story is wrong, not the plan\.\*\* Step 0 counts them, before any re-planning: three or more coverage reports in its window\. Then stop re-planning\./);
  assert.match(gate, /When it has no `shape`, \*\*raise one escalation on the story\*\*, tied to the latest report with `"comment"` its `cN`, asking the person how to go on/);
  assert.match(gate, /how do we go on\?"\* The reviewer is tracing a story that does not say what anyone means by it\. Wait on it \(step 0\)\. Give two options, each naming what plan-project does next: - \*Re-plan once more\*: plan-project re-plans it, this session on the answer or the next one\. The answer starts a fresh window \(step 0\), so the count starts again\. - \*Stop planning it\*: plan-project says the story is stopped and stops, this session on the answer or the next one, writing and raising nothing\. To plan it again, the person rewrites the story if they want to, then asks plan-project to plan it again\. To drop it, they close it\./);
  assert.doesNotMatch(gate, /moves it on by hand/);
  assert.match(gate, /The same escalation is not raised twice\. After a \*Re-plan once more\* answer, three more reports raise a new one on the latest report\./);
  assert.match(gate, /When the latest is answered \*Stop planning it\*, say so and stop, unless the person asks in this session to plan the story again\. Then post a comment on the story opening `# Re-plan requested`, saying it was posted because the person asked and naming who asked, and carry on from step 0: the reports after that comment start a fresh window\./);
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
  assert.match(gate, /- \*\*The latest report's QUESTIONs are answered and applied\*\*: every escalation on a comment opening `# QUESTION … of c<report>`, where `c<report>` is that report's first comment, has an answer \(`escalations\[\]\.answer`\), and the report has a reply opening `# QUESTIONs applied`\./);
  assert.match(gate, /One open waits on that answer; answered and not applied waits on `plan-project`, which applies them\./);
});

test('PROCESS.md tells the two gates apart, and records the gate as a step', () => {
  const runtime = section(contract, '## The process, read at runtime');
  assert.match(runtime, /\| `gate` \| One of two, told apart by position, never by id\. The \*\*shaped step\*\*, a `gate` between `shape` and `plan`: shaping ends there .* The \*\*plan gate\*\*, the type's first `gate` after its `plan` step: planning ends there/);
  assert.doesNotMatch(runtime, /After a gate passes the orchestrator sets `--status ready`/);
  const shapingPart = section(contract, '## Before the plan: shaping');
  assert.match(shapingPart, /\*\*Planning starts at the plan step\.\*\* Running \`plan-project\` on a story at the shaped step, with no shaping escalation open, is the approval of the body: it moves the story to the plan step itself and posts \`# Planning started\`, saying the run was the approval\. Where shaping ends on a type with no shaped step, it starts from \`shape\` or from no step at \`backlog\`, setting the plan step itself, since the approval escalation was the approval\./);
  assert.match(shapingPart, /On a type with a shaped step, a story at \`shape\`, or one at the shaped step with a shaping escalation open, is not moved: \`plan-project\` says shaping is not finished and stops, writing nothing\./);
  const gatePart = section(contract, '## The plan gate');
  assert.match(gatePart, /posts each QUESTION as its own top-level comment opening \`# QUESTION <n> of c<report>\` \(\`c<report>\` the report's first comment\) with one escalation on it, and waits on them\. A report's QUESTIONs are the escalations on those comments\./);
  assert.match(gatePart, /No escalation asks for the gate decision: \*\*the verdict decides, and \`plan-project\` makes the move, per story\.\*\* \`plan-project\` moves the story from the plan gate to \`ready\` on a PASS, with a \`# Moved to ready\` comment naming the report's \`cN\` and its verdict\. A RETURN stays at the plan gate: moving it back to the plan step returns it to planning\./);
  assert.match(gatePart, /With QUESTIONs, the order is: answer them, and \`plan-project\` applies the answers \(the session waiting on them does, or a re-invoke once it has ended; it replies \`# QUESTIONs applied\` to the report\) and then moves the story to \`ready\` on PASS WITH DECISIONS, with the same comment\./);
  assert.match(gatePart, /it refuses a story with no coverage report, one still at the plan gate, and one whose latest report has a QUESTION open, or answered and not applied\./);
  assert.match(section(contract, '## Records'), /\| plan gate \| .* each QUESTION in it a top-level comment of its own opening \`# QUESTION <n> of c<report>\` \(\`c<report>\` the report's first comment\), with one escalation tied to that comment with \`--comment cN\`, and the answers applied as a reply to it opening \`# QUESTIONs applied\`; the story at the plan gate step, then \`--status ready\` by \`plan-project\` on a PASS \(on PASS WITH DECISIONS after \`# QUESTIONs applied\`\), with a comment opening \`# Moved to ready\` that names the report's \`cN\` and its verdict; a RETURN stays at the plan gate, and moving it back to the plan step returns it \|/);
});

// LWY-222.2 (TC-1): rewritten from the last sentence of the pin above, "A story it sends gaps back on goes back to `shape`.",
// which said a story sent back to the PO stops there. Now it goes back to `shape` and, on *Hold*, shaping starts.
test('PROCESS.md: a story planning sends gaps back on goes back to `shape`, and on *Hold* shaping starts', { skip: 'red-test-TC-1: PROCESS.md says a story sent back only goes back to `shape`' }, () => {
  const shapingPart = section(contract, '## Before the plan: shaping');
  assert.match(shapingPart, /gaps back[^.]*`shape`[^.]*\*Hold\*|\*Hold\*[^.]*gaps back[^.]*`shape`/);
});

// LWY-222.2 (AC-1): rewritten from the line of the pin below, "When the type has `shape`, set `--step shape` and post what the
// rounds could not trace as a step 1 comment to the PO, with step 1's ending", which made Three RETURNs a comment with no escalation.
test('Three RETURNs on a type with `shape` goes through step 1\'s gap path: the gap comment, `shape` and the tied escalation', { skip: 'red-test-AC-1: Three RETURNs on a type with `shape` is a comment with no escalation' }, () => {
  const gate = section(skill, '### The QUESTIONs');
  assert.doesNotMatch(gate, /When the type has `shape`, set `--step shape` and post what the rounds could not trace as a step 1 comment to the PO, with step 1's ending\./);
  assert.match(gate, /When the type has `shape`, [^.]*\bstep 1's\b[^.]*\bgap\b[^.]*`shape`[^.]*\bescalation\b/);
});
