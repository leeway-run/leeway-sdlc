import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const plugin = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(plugin, path), 'utf8').replace(/\r\n/g, '\n');
const flat = (text) => text.replace(/\s+/g, ' ');

const process_ = flat(read('PROCESS.md'));
const plan = flat(read('skills/plan-project/SKILL.md'));
const run = flat(read('skills/run/SKILL.md'));
const implementer = flat(read('agents/sdlc-implementer.md'));
const reviewer = flat(read('agents/sdlc-reviewer.md'));
const brief = flat(read('skills/run/templates/BRIEF.md'));
const verdict = flat(read('skills/run/templates/VERDICT.md'));
const shape = flat(read('skills/shape-project/SKILL.md'));

// The agent's two ways of filling the first option: the pick and its reason, or no pick and its reason.
const PICK = /`Recommended:` and saying why/;
const NO_PICK = /`No recommendation:` and (says why|why)/;

test('AC-1: the process puts the recommended option first, for plan-project and run', () => {
  assert.match(process_, /From `plan-project` and `run`, the recommended option comes first\*\*, and its argument opens `Recommended:` and says why/);
});

test('AC-1: plan-project recommends on every escalation, whatever order a step lists the options in', () => {
  assert.match(plan, /\*\*The recommended option comes first\*\*, its argument opening `Recommended:` and saying why/);
  assert.match(plan, /The options a step below names are the choices, not their order/);
  assert.match(plan, /how do we proceed\?"\*, with the options, your recommended one first, \*Hold;/);
  assert.match(plan, /Its options, your recommended one first, are the alternatives the rule states/);
  assert.match(plan, /\(the options the report gives, 2 to 5, your recommended one first\)/);
  assert.match(plan, /To drop it, they close it\. The order above is not a pick: put first the one you recommend, or say you have none/);
});

test('AC-1: run recommends on every escalation, whatever order a path lists the options in', () => {
  assert.match(run, /\*\*The recommended option comes first on every escalation this skill raises\*\*, its argument opening `Recommended:` and saying why/);
  assert.match(run, /The options a path below names are the choices, not their order/);
});

test('AC-1: the stalled round\'s literal command is not taken for a pick', () => {
  assert.match(run, /"label":"Re-run the implementer".*This order is not a pick: put first the option this round's evidence recommends, and open its argument `Recommended:`\. Then report the escalation id/);
});

test('AC-2: an implementer\'s ## Question carries the recommendation, and its prompt and template ask for it', () => {
  assert.match(implementer, /`## Question` block \(one sentence; 2 to 5 options, each with its argument, the recommended one first with its argument opening `Recommended:` and saying why/);
  assert.match(run, /`## Question` section: the question \(one sentence\), 2 to > 5 options each with its argument, the recommended one first/);
  assert.match(brief, /\*\*Options:\*\* 2 to 5.*The recommended option comes first/);
  assert.match(brief, /1\. `<label>` — Recommended: <why/);
});

test('AC-2: a reviewer\'s Escalates block carries the recommendation, in the agent, the template and its worked example', () => {
  assert.match(reviewer, /\*\*Options\*\* \(2 to 5, each a label of at most 60 characters and an argument of at most 1,000, the recommended one first with its argument opening `Recommended:` and saying why/);
  assert.match(verdict, /\*\*Options:\*\* 2 to 5.*The recommended option comes first, its argument opening `Recommended:` and saying why/);
  assert.match(verdict, /1\. `Include the version` — Recommended: /);
  assert.match(verdict, /--options '\[\{"label":"Include the version","argument":"Recommended: /);
});

test('AC-2: the orchestrator keeps the block\'s order when it raises it', () => {
  assert.match(process_, /An orchestrator raising an implementer's `## Question` or a reviewer's `Escalates` block keeps its order/);
  assert.match(run, /An implementer's `## Question` and a reviewer's `Escalates:` block already carry theirs: raise them in the block's order/);
});

test('AC-3: shape-project keeps the likeliest answer first, takes the PO\'s answer as given and states no pick', () => {
  assert.match(shape, /2 to 5 options, the likeliest answer first/);
  assert.match(shape, /Take the PO's answer as given; where they are unsure, it is an `OPEN:` line, not a nudge toward an answer/);
  assert.doesNotMatch(shape, /recommend/i);
});

test('AC-3: the process rule does not reach shape-project', () => {
  assert.match(process_, /`shape-project` does not recommend: it puts the likeliest answer first, states no pick and takes the PO's answer as given/);
});

test('AC-4: no pick is invented, in any place that asks for one', () => {
  assert.match(process_, /Where the agent truly has no pick it invents none: the first argument opens `No recommendation:` and says why/);
  for (const [name, text] of Object.entries({ plan, run, implementer, reviewer, brief, verdict })) {
    assert.match(text, NO_PICK, `${name} does not say what to write with no pick`);
  }
  for (const [name, text] of Object.entries({ plan, run, implementer, reviewer, verdict })) {
    assert.match(text, PICK, `${name} does not say what the pick's argument opens with`);
  }
});
