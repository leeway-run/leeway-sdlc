import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// LWY-200.1: plan-project moves a story out of the shaped step (to the plan step) and out of the plan gate (to `ready`)
// itself, on its conditions. Each pin names the phrase it matches and the file and section it reads. It reads only
// PROCESS.md and the three SKILL.md files below, never this file.
const plugin = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...parts) => readFileSync(join(plugin, ...parts), 'utf8').replace(/\r\n/g, '\n');

const planProject = read('skills', 'plan-project', 'SKILL.md');
const run = read('skills', 'run', 'SKILL.md');
const shaping = read('skills', 'shape-project', 'SKILL.md');
const contract = read('PROCESS.md');

// The text from the heading line that starts with `heading` to the next heading of the same or a higher level.
// A line inside a ``` fence is never a heading. Fails when there is no such heading, so a renamed section is not a pass.
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
// The first sentence of `text` matching every pattern; undefined when none does.
const sentenceWith = (text, ...res) => sentences(text).find((s) => res.every((re) => re.test(s)));
const found = (text, what, ...res) => assert.ok(sentenceWith(text, ...res), `no sentence ${what}\n${flat(text).slice(0, 600)}`);

// Step 0's start table, joined onto lines, one per row: the rows' first cell tells which row a pin reads.
const start0 = section(planProject, '## 0. ');
const rows = start0
  .split('\n')
  .filter((line) => /^\s*\| /.test(line) && !/^\s*\|---/.test(line))
  .map((line) => flat(line));
const row = (firstCell) => {
  const found = rows.find((r) => r.startsWith(`| ${firstCell} |`));
  assert.ok(found, `no start-table row beginning "| ${firstCell} |"\n${rows.join('\n')}`);
  return found;
};

const step7 = section(planProject, '## 7. ');
const step8 = section(planProject, '## 8. ');
const MOVE_PLAN = /`<cli> --as <alias>\/planner issue update <story> --step <the plan step's id>`/;
const MOVE_READY = /--status ready/;
const NOT_MOVED = /\b(?:not moved|never moved|does not move|do not move|stays at the plan gate)\b/i;

// --- the two moves: AC-1, AC-3, TC-1, TC-2 ----------------------------------------------------------------

// Pinned in `plugin/skills/plan-project/SKILL.md`, step 0, the "Start where shaping ends" table.
test('step 0: a story at the shaped step is moved to the plan step with a `# Planning started` comment', { skip: 'red-test-AC-1: step 0 still says the story waits on the PO' }, () => {
  // the row whose first cell is exactly "the shaped step, with no shaping escalation open"
  const r = row('the shaped step, with no shaping escalation open');
  assert.match(r, MOVE_PLAN);
  assert.match(r, /post a comment opening `# Planning started` saying running plan-project was the approval of the body, then carry on/);
  assert.doesNotMatch(r, /waits on the PO/);
});

// Pinned in `plugin/skills/plan-project/SKILL.md`, step 0, the table's rows, in order: the refusals come before the move.
test('step 0: a story at `shape` is not moved (a type with a shaped step)', { skip: 'red-test-AC-1: step 0 has no row refusing `shape` by name on a type with a shaped step' }, () => {
  const r = row('`shape`, or no step at `backlog`, on a type with a shaped step');
  assert.match(r, /\*\*say shaping is not finished, and stop\.\*\* Write nothing/);
  assert.doesNotMatch(r, /--step/);
  const order = (cell) => rows.findIndex((x) => x.startsWith(`| ${cell} |`));
  assert.ok(order('`shape`, or no step at `backlog`, on a type with a shaped step') < order('the shaped step, with no shaping escalation open'));
});

test('step 0: a story at the shaped step with a shaping escalation open is not moved', { skip: 'red-test-AC-1: step 0 has no row refusing an open shaping escalation at the shaped step' }, () => {
  const r = row('the shaped step, with a shaping escalation open');
  assert.match(r, /\*\*say shaping is not finished, and stop\.\*\* Write nothing/);
  assert.doesNotMatch(r, /--step/);
  const order = (cell) => rows.findIndex((x) => x.startsWith(`| ${cell} |`));
  assert.ok(order('the shaped step, with a shaping escalation open') < order('the shaped step, with no shaping escalation open'));
});

// Pinned in `plugin/skills/plan-project/SKILL.md`, step 8 (every subsection), one sentence per condition.
test('step 8: a PASS moves the story to `ready` with a comment naming the report cN and the verdict', { skip: 'red-test-AC-3: step 8 stops at the plan gate on a PASS' }, () => {
  found(step8, 'on a PASS that moves the story to `ready` with a `# Moved to ready` comment naming `cN` and the verdict',
    /^On a PASS(?! WITH)/, MOVE_READY, /\(no step\)/, /`# Moved to ready`/, /report's `cN`/, /verdict/, /^(?!.*\bperson\b)/);
});

test('step 8: PASS WITH DECISIONS moves the story to `ready` after `# QUESTIONs applied`, with the same comment', { skip: 'red-test-AC-3: step 8 moves nothing after `# QUESTIONs applied`' }, () => {
  found(step8, 'saying PASS WITH DECISIONS moves to `ready` once `# QUESTIONs applied` is posted, with the `# Moved to ready` comment',
    /\bPASS WITH DECISIONS\b/, /`# QUESTIONs applied`/, MOVE_READY, /`# Moved to ready`/, /every QUESTION (?:is )?answered/);
});

test('step 8: a RETURN is not moved to `ready`', { skip: 'red-test-AC-3: step 8 has no sentence keeping a RETURN at the gate' }, () => {
  found(step8, 'saying a RETURN is not moved to `ready` and stays at the plan gate',
    /^A RETURN\b/, NOT_MOVED, /`ready`/, /plan gate/);
});

test('step 8: PASS WITH DECISIONS with a QUESTION open is not moved', { skip: 'red-test-TC-4: step 8 has no sentence keeping a story with a QUESTION open at the gate' }, () => {
  found(step8, 'saying PASS WITH DECISIONS with a QUESTION still open is not moved',
    /\bPASS WITH DECISIONS\b/, /a QUESTION (?:is )?(?:still )?open\b/, NOT_MOVED, /^(?!.*`# QUESTIONs applied`)/);
});

test('step 8: PASS WITH DECISIONS answered but with no `# QUESTIONs applied` reply is not moved', { skip: 'red-test-TC-4: step 8 has no sentence keeping answered-but-unapplied QUESTIONs at the gate' }, () => {
  found(step8, 'saying PASS WITH DECISIONS with every QUESTION answered and no `# QUESTIONs applied` reply is not moved',
    /\bPASS WITH DECISIONS\b/, /every QUESTION (?:is )?answered/, /no `# QUESTIONs applied` reply/, NOT_MOVED);
});

test('the moves are per story: one story of a plan moves to `ready` while another stays at the gate', { skip: 'red-test-TC-3: step 7 and step 8 do not say the moves are per story' }, () => {
  found(step7, 'in step 7 saying the two moves are made per story',
    /\bper story\b/, /shaped step/, /plan gate/);
  found(step8, 'in step 8 saying one story of a plan can move to `ready` while another stays at the gate',
    /\bper story\b|\bone story\b/, /`ready`/, /another/, /plan gate/);
});

test('step 7: plan-project makes the two moves itself and no longer says they are a person\'s', { skip: 'red-test-TC-1: step 7 still says the moves are a person\'s' }, () => {
  const text = flat(step7);
  assert.doesNotMatch(text, /are a person's\*\*: this skill never makes them on its own initiative/);
  found(step7, 'saying, affirmatively, that this skill makes the moves out of the shaped step and out of the plan gate on its own',
    /\bthis skill makes\b/, /shaped step/, /plan gate/, /on its own/, /^(?!.*\b(?:never|no|not|nothing|without)\b)/);
});

// Pinned in `plugin/skills/plan-project/SKILL.md`, step 0, the item "With no `.sdlc/leeway.md`..." that says "No answer moves
// a story out of the shaped step or the plan gate".
test('step 0: an answer still moves no story, and the old sentence saying the moves are a person\'s is gone', { skip: 'red-test-TC-1: step 0 still says those moves are a person\'s (step 7)' }, () => {
  const text = flat(start0);
  assert.doesNotMatch(text, /those moves are a person's \(step 7\)/);
  found(start0, 'saying no answer moves a story and that the moves are this skill\'s own, made as step 0 and step 8 say',
    /\bNo answer moves a story\b/, /\bstep 8\b/, /\bthis skill\b/, /^(?!.*\ba person's\b)/);
});

// Pinned in `plugin/skills/plan-project/SKILL.md`, step 8, "The QUESTIONs": the paragraph "Applying a QUESTION's answer is not
// the gate decision" and the sentence before it, "Say so, and move nothing".
test('step 8 "The QUESTIONs": applying an answer is not the move, and the person-only claims are gone', { skip: 'red-test-TC-1: The QUESTIONs still says applying moves nothing and only a person moves the story to `ready`' }, () => {
  const part = flat(section(planProject, '### The QUESTIONs'));
  assert.doesNotMatch(part, /Say so, and move nothing, so the story stays where it was/);
  assert.doesNotMatch(part, /it never moves the story, whatever the answer says/);
  assert.doesNotMatch(part, /Only a person's move takes the story from the plan gate to `ready`/);
  assert.doesNotMatch(part, /this skill makes that move only when the person asks for it/);
  found(section(planProject, '### The QUESTIONs'), 'saying the move to `ready` follows `# QUESTIONs applied` (it is step 8\'s, not the answer\'s)',
    /`# QUESTIONs applied`/, /`ready`/, /\bmoves?\b/, /^(?!.*\bnever moves\b)/, /^(?!.*\bperson asks\b)/);
});

// Pinned in `plugin/skills/plan-project/SKILL.md`, step 8, "Post the full report, then stop at the gate".
test('step 8 "Post the full report": it no longer says the decision and passing the gate are a person\'s move', { skip: 'red-test-TC-1: the report subsection still says the decision is the person\'s move and passing the gate is a person moving it' }, () => {
  const part = flat(section(planProject, '### Post the full report, then stop at the gate'));
  assert.doesNotMatch(part, /the decision is the person's move/);
  assert.doesNotMatch(part, /\*\*Passing the gate\*\* is a person moving the story from the plan gate to `ready`/);
});

// --- PROCESS.md: TC-1 -----------------------------------------------------------------------------------

// Pinned in `plugin/PROCESS.md`, "The cast", the paragraph "A move the person asks for".
test('PROCESS.md "The cast": plan-project moves a story out of the shaped step and the plan gate on its own, no other skill does', { skip: 'red-test-TC-1: The cast still says no skill moves a story out of those steps on its own initiative' }, () => {
  const cast = section(contract, '## The cast');
  assert.doesNotMatch(flat(cast), /What no skill does is move a story out of the shaped step or the plan gate on its own initiative/);
  found(cast, 'saying only plan-project moves a story out of the shaped step and the plan gate on its own',
    /\bplan-project\b/, /shaped step/, /plan gate/, /on its own/, /\bno other skill\b|\bonly `?plan-project`?\b/i);
});

// Pinned in `plugin/PROCESS.md`, "Before the plan: shaping", the paragraph "Planning starts at the plan step".
test('PROCESS.md "Before the plan: shaping": running plan-project on a story at the shaped step moves it to the plan step', { skip: 'red-test-AC-1: Before the plan: shaping says the story waits on the product owner' }, () => {
  const part = section(contract, '## Before the plan: shaping');
  assert.doesNotMatch(flat(part), /it says the story waits on the product owner and stops, writing nothing/);
  found(part, 'saying plan-project run on a story at the shaped step moves it to the plan step and posts `# Planning started`',
    /\bplan-project\b/, /shaped step/, /plan step/, /`# Planning started`/);
  found(part, 'saying a story at `shape`, or with a shaping escalation open, is not moved',
    /`shape`/, /escalation/, /\bopen\b/, /not (?:moved|started)|says shaping is not finished/);
});

// Pinned in `plugin/PROCESS.md`, "The plan gate", item 3 and the "Records" table's plan gate row.
test('PROCESS.md "The plan gate": plan-project moves a passing story to `ready`; a RETURN stays', { skip: 'red-test-AC-3: The plan gate item 3 says the decision is a person\'s move' }, () => {
  const gate = section(contract, '## The plan gate');
  found(gate, 'saying plan-project moves the story to `ready` on a PASS, with a comment naming the report and verdict',
    /\bplan-project\b/, /\bPASS\b/, /`ready`/, /`# Moved to ready`/);
  found(gate, 'saying a RETURN stays at the plan gate', /\bRETURN\b/, /plan gate/, /stays|stops|not moved/);
  found(gate, 'saying PASS WITH DECISIONS moves after `# QUESTIONs applied`', /\bPASS WITH DECISIONS\b/, /`# QUESTIONs applied`/, /`ready`/);
});

// Pinned in `plugin/PROCESS.md`: "The process, read at runtime" ("A person passes the plan gate by moving the issue to `ready`")
// and "The plan gate" (the QUESTIONs order: "it replies `# QUESTIONs applied` to the report and moves nothing").
test('PROCESS.md "The process, read at runtime" and "The plan gate" no longer say a person passes the gate or that applying moves nothing', { skip: 'red-test-TC-1: both sections still say the person passes the gate and applying moves nothing' }, () => {
  assert.doesNotMatch(flat(section(contract, '## The process, read at runtime')), /A person passes the plan gate by moving the issue to `ready`/);
  assert.doesNotMatch(flat(section(contract, '## The plan gate')), /to the report and moves nothing\)/);
});

test('PROCESS.md "Records": the plan gate row records `# Planning started` and `# Moved to ready`', { skip: 'red-test-TC-2: the Records table has no mention of either record' }, () => {
  const records = section(contract, '## Records');
  const gateRow = flat(records.split('\n').find((line) => line.startsWith('| plan gate |')) ?? '');
  assert.match(gateRow, /`# Moved to ready`/);
  assert.match(flat(records), /`# Planning started`/);
});

// --- the other sentences: shape-project and run -----------------------------------------------------------

// Pinned in `plugin/skills/shape-project/SKILL.md`, step 5 ("Write the body, then stop at the shaped step"), its last words.
test('shape-project tells the PO that running plan-project approves the body', { skip: 'red-test-AC-1: shape-project ends at waits there for the PO' }, () => {
  const last = sentences(section(shaping, '## 5. ').split('\n## ')[0]).slice(-3).join(' ');
  assert.match(last, /running `plan-project` on (?:it|the story) approves the body/i);
});

// Pinned in `plugin/skills/run/SKILL.md`, "Preconditions", the item "The plan gate is passed". run's refusals do not change
// (`plugin/test/run-refusals.test.mjs`, which this task does not touch and which is green today).
test('run says the move to `ready` is plan-project\'s on a PASS, or a person\'s', { skip: 'red-test-TC-5: run says a person passing the gate is that move' }, () => {
  const item = flat(section(run, '### Preconditions'));
  found(item, 'in "The plan gate is passed" saying the move to `ready` is `plan-project`\'s on a PASS, or a person\'s',
    /move to `ready`/, /`plan-project`/, /\bPASS\b/, /or a person's/);
  assert.match(item, /\*\*A story still at the plan gate waits on the gate\.\*\*/);
});

// --- hazard: an old sentence survives -----------------------------------------------------------------------

// Pinned in `plugin/skills/plan-project/SKILL.md` (frontmatter, step 0, "Done when" included), `plugin/PROCESS.md` and
// `plugin/skills/run/SKILL.md`, each phrase matched after whitespace is collapsed. The task names these five.
const OLD = [
  'A person passing the gate is that move',
  'a person passes it by moving',
  'waits at the plan gate for a person',
  "the decision is a person's move",
  "the decision a person's move",
];
const FILES = { 'plan-project/SKILL.md': planProject, 'PROCESS.md': contract, 'run/SKILL.md': run };

test('no old "a person\'s move" phrase survives in plan-project, PROCESS.md or run', { skip: 'red-test-TC-1: all five phrases are still in the files' }, () => {
  for (const [name, text] of Object.entries(FILES))
    for (const phrase of OLD) assert.ok(!flat(text).includes(phrase), `${name} still says "${phrase}"`);
});

// Pinned in `plugin/skills/plan-project/SKILL.md`, step 0's start table: the QUESTIONs rows and the shaped-step rows.
test('step 0 start table: no row says to move nothing unless the person asks, or that the shaped story waits on the PO', { skip: 'red-test-TC-1: two QUESTIONs rows still say move nothing unless the person asks' }, () => {
  for (const r of rows) {
    assert.doesNotMatch(r, /move nothing unless the person asks/, r);
    assert.doesNotMatch(r, /say the story waits on the PO/, r);
  }
});
