// LWY-266.6: the plan branch is current at story start (TC-8) and "blocked by" means merged (TC-9, AC-6 completeness).
// Text pins on plugin/skills/run/SKILL.md: "Story start", precondition 3, "The task order" step 5, "Run a project" step 2,
// and hard stop 7's row. Design doc: docs/archive/lwy-266-an-unattended-run-decides-and-continues.md, "The plan branch
// stays current, and 'blocked by' means merged". Round 0: each test is skipped with the criterion it serves. Every form
// is a FIXED PHRASE, no word-list judgement of meaning.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const plugin = process.env.PLUGIN_DIR || join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(plugin, path), 'utf8').replace(/\r\n/g, '\n');
const flat = (text) => text.replace(/\s+/g, ' ');

const red = (criterion, name, fn) => test(`${criterion}: ${name}`, { skip: `red-test-${criterion}` }, fn);

const run = read('skills/run/SKILL.md');

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

// The run starting at `lead` and ending before `until`, on one line.
function from(text, lead, until) {
  const at = text.indexOf(lead);
  assert.ok(at >= 0, `no "${lead}"`);
  const end = until ? text.indexOf(until, at + lead.length) : -1;
  assert.ok(!until || end >= 0, `no "${until}" after "${lead}"`);
  return text.slice(at, until ? end : undefined);
}

const has = (text, phrase, where) => assert.ok(text.includes(phrase), `${where} lacks: ${phrase}`);

const storyStart = () => under(run, 'Story start');
const bringCurrent = () => from(storyStart(), "**When the story's base is a plan branch, bring it current before the baseline:**", '2. **Create or reuse the story worktree**');

const subIssueStep = () => from(under(run, 'Run a sub-issue'), '3. **Check whether it is blocked.**', '4. **Round 0, or straight to implementing.**');
const precondition = () => from(under(run, 'Preconditions: all of them, or do not start'), '3. **The story is not blocked**', '4. **Leeway answers.**');
const taskOrder = () => from(under(run, 'The task order'), '5. **Refuse a task whose blockers are not cleared**', '**Re-read the children before each task.**');
const projectStep = () => from(under(run, 'Run a project'), '- **Refuse an issue whose blockers are not cleared**', '- **Skip an issue its issue run refuses**');
const places = () => [
  ['"Run a sub-issue" step 0.3', subIssueStep()],
  ['precondition 3', precondition()],
  ['"The task order" step 5', taskOrder()],
  ['"Run a project" step 2', projectStep()],
];

const CLEARED = 'A blocker is cleared when its `status` is `done` or `cancelled`; a blocker that is a story is also cleared at a step after its `build` step (never at `planned`, `ready` or `build` itself), and a blocker that is a sub-issue is cleared only when `done` or `cancelled`, never at a step short of that, `in_review` included.';

red('TC-8', "story start brings the plan branch current before the baseline, through the story gate's detached merge worktree, and pushes the base", () => {
  const s = bringCurrent();
  has(s, 'merge the integration branch into it through the detached merge worktree of "The story gate", step 5, and push the base.', 'story start');
});

red('TC-8', "story start cites step 5's commands and failure paths rather than copying them", () => {
  const s = bringCurrent();
  has(s, 'Run the commands and failure paths of "The story gate", step 5, with the integration branch as what is merged and the plan branch as the base: fetch both fresh, the `merge-base --is-ancestor` check, the push of `HEAD:<base>`.', 'story start');
  for (const copied of ['worktree add --detach', 'merge --no-ff -F', 'push origin HEAD:<base> ']) {
    assert.ok(!s.includes(copied), `story start copies step 5: ${copied}`);
  }
});

red('TC-8', "a continuation run whose base already holds the integration branch's head writes nothing", () => {
  has(bringCurrent(), "A continuation run whose base already holds the integration branch's head (`git -C <primary> merge-base --is-ancestor origin/<integration branch> origin/<base>` exits 0) writes nothing: no worktree, no merge, no push.", 'story start');
});

red('TC-8', 'a non-mechanical conflict aborts the merge and is stop 7, never resolved by hand at story start', () => {
  const s = bringCurrent();
  has(s, 'A conflict in a file a person wrote that is not mechanical is never resolved by hand here: abort the merge (`git -C <primary>/.worktrees/merge-<story> merge --abort`), remove the worktree, and stop (hard stop 7).', 'story start');
  assert.ok(!/resolve conflicts \*\*yourself\*\*/.test(storyStart()), 'story start tells the run to resolve conflicts by hand');
  const row = from(under(run, 'Hard stop conditions'), '| 7 | **A merge conflict with the base that is not mechanical**', '| 8 |');
  has(row, '"The story gate", "Story start"', "hard stop 7's Detected cell");
});

red('TC-8', 'one merge per story start, after step 1 and before step 2 (the worktree), so before the baseline', () => {
  const s = storyStart();
  const at = s.indexOf("**When the story's base is a plan branch");
  assert.ok(s.indexOf('1. **Set the story to its build step**') < at, 'the paragraph is not after step 1');
  assert.ok(at < s.indexOf('2. **Create or reuse the story worktree**'), 'the paragraph is not before step 2');
  has(bringCurrent(), 'One merge per story start, made before the baseline: a story worktree cut in step 2 is cut from the base as it then stands, and one reused from an earlier run is left as it is, because "The story gate", step 1, brings the base into the story branch.', 'story start');
});

red('TC-9', 'the cleared rule is the same fixed sentence in precondition 3, "The task order" step 5 and "Run a project" step 2', () => {
  for (const [where, text] of places()) has(text, CLEARED, where);
});

red('TC-9', 'no place keeps "not done" or "neither `done` nor `cancelled`" for what clears a blocker', () => {
  for (const [where, text] of places()) {
    assert.ok(!/not done/.test(text), `${where} keeps "not done"`);
    assert.ok(!/neither `done` nor `cancelled`/.test(text), `${where} keeps "neither done nor cancelled"`);
  }
});

red('TC-9', 'a sub-issue short of `done` and a story before its `build` step are never cleared, named in each place', () => {
  for (const [where, text] of places()) {
    has(text, '(never at `planned`, `ready` or `build` itself)', where);
    has(text, 'never at a step short of that, `in_review` included', where);
  }
});

red('TC-9', 'the "Run a project" prose says "not cleared", not "not done"', () => {
  const p = under(run, 'Run a project');
  has(p, 'It is skipped as an issue whose blockers are not cleared is:', '"Run a project"');
  has(p, 'or the blockers not cleared), and the issues not started', '"Run a project"');
  assert.ok(!/blockers (are )?not done|blockers not done/.test(p), '"Run a project" keeps "not done"');
});

red('AC-6', 'completeness holds in run: the plan branch is kept current at story start and "blocked by" is read as merged', () => {
  has(bringCurrent(), 'bring it current before the baseline', 'story start');
  has(precondition(), CLEARED, 'precondition 3');
});
