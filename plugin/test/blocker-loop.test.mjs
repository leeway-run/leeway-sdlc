import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// LWY-200.2: on a RETURN whose BLOCKERs are all wording fixes, plan-project fixes them, replies `# BLOCKERs fixed`, and
// runs another review, at most 2 times, before it stops at the plan gate. Each pin names the phrase it matches and the
// file and section it reads. It reads only plan-project/SKILL.md and PROCESS.md, never this file.
const plugin = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...parts) => readFileSync(join(plugin, ...parts), 'utf8').replace(/\r\n/g, '\n');

const planProject = read('skills', 'plan-project', 'SKILL.md');
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

const report = section(planProject, '### Post the full report, then stop at the gate');
const step0 = flat(section(planProject, '## 0. '));
const gate = section(contract, '## The plan gate');

// No negation in the sentence: an affirmative claim is not met by its negation.
const AFFIRMED = /^(?!.*\b(?:not|never|no|without)\b)/;
// "at most 2", and no other number after "at most" in the sentence.
const AT_MOST_2 = /\b[Aa]t most 2\b/;
const NO_OTHER_BOUND = /^(?!.*\b[Aa]t most (?!2\b))/;

// --- the bound: at most 2 automatic rounds -------------------------------------------------------------------

// Pinned in `plugin/skills/plan-project/SKILL.md`, step 8, "Post the full report, then stop at the gate".
test('step 8 "Post the full report": at most 2 automatic rounds follow the gate\'s first report', () => {
  found(report, 'saying at most 2 automatic rounds follow the first report, and no other bound',
    AT_MOST_2, NO_OTHER_BOUND, /\bautomatic rounds?\b/, /\bfirst report\b/, /^(?!.*\b(?:never|no)\b)/);
});

test('step 8 "Post the full report": a third automatic round never starts, and the story stops at the plan gate with the latest report', () => {
  found(report, 'saying a third automatic round never starts',
    /\bthird\b/, /\bautomatic round\b/, /\b(?:never starts?|does not start|is never started)\b/);
  found(report, 'saying that after the 2 automatic rounds the story stops at the plan gate with the latest report',
    /\b[Aa]fter\b/, /\b(?:2|two) automatic rounds\b/, /\bstops? at the plan gate\b/, /\blatest report\b/, /^(?!.*\bnever stops\b)/);
});

// --- each round's report is posted before the next fix ----------------------------------------------------

test('step 8 "Post the full report": each automatic round\'s report is posted `--as <alias>/reviewer` through this section before the next fix', () => {
  found(report, 'saying each automatic round returns through "Post the full report", its report posted `--as <alias>/reviewer`, before any item is fixed',
    /\b(?:[Ee]ach|[Ee]very) automatic round\b/, /"Post the full report"/, /`--as <alias>\/reviewer`/,
    /\bposted\b.*\bbefore\b.*\b(?:fix|fixes|fixed|edit|edits)\b/, /^(?!.*\b(?:not|never|no)\b)/);
});

// --- the reply: `# BLOCKERs fixed`, in the form of `# QUESTIONs applied` ----------------------------------

test('step 8 "Post the full report": the reply `# BLOCKERs fixed` is a reply to the report, one line per BLOCKER with its number, item and change', () => {
  found(report, 'saying the planner replies to the report (`comment add <story> --parent cN --stdin body`) with a body opening `# BLOCKERs fixed`, one line per BLOCKER: number, item, change',
    /--parent cN --stdin body/, /\bbody opening `# BLOCKERs fixed`/, /\bone line per BLOCKER\b/, /\bnumber\b/, /\bitem\b/, /\bchange\b/);
});

// --- what a wording fix is, and what stops the loop -----------------------------------------------------

test('step 8 "Post the full report": the loop starts only when every BLOCKER is a fix to existing items that opens no decision', () => {
  found(report, 'saying plan-project judges the BLOCKERs and starts only when every one is a fix to existing items that opens no decision',
    /\bjudge/i, /\bevery (?:one|BLOCKER)\b/, /\bexisting items\b/, /\bopens? no decision\b/, /\bonly when\b/);
});

test('step 8 "Post the full report": a wording fix edits existing items only: a description, a test, a blocking relation between existing tasks or a hazard owner', () => {
  found(report, 'listing what a wording fix edits: existing items only, a description, a test, a blocking relation between existing tasks, a hazard owner',
    /\bwording fix\b/, /\bexisting items only\b/, /\ba description\b/, /\ba test\b/, /\ba blocking relation between existing tasks\b/, /\ba hazard owner\b/);
});

test('step 8 "Post the full report": a BLOCKER that needs a new task or a decision is never in a `# BLOCKERs fixed` reply, and the story stops at the plan gate', () => {
  found(report, 'saying a BLOCKER that needs a new task or a decision is never listed in a `# BLOCKERs fixed` reply and the story stops at the plan gate',
    /\bBLOCKER that needs a new task or a decision\b/, /\b(?:never|not)\b[^:]*`# BLOCKERs fixed` reply/, /\bstops? at the plan gate\b/, /^(?!.*\bnever stops\b)/);
});

test('step 8 "Post the full report": a QUESTION still open stops the loop at the plan gate', () => {
  found(report, 'saying a QUESTION still open stops the loop and the story stays at the plan gate',
    /\b[Aa] QUESTION still open\b/, /\bstops? the loop\b/, /\bplan gate\b/, AFFIRMED);
});

// --- the re-review, and the answered QUESTIONs applied before it ------------------------------------------------

test('step 8 "Post the full report": each automatic round delegates a re-review to a fresh sdlc-divergence-reviewer, given the previous report\'s `cN` and the mode `re-review`', () => {
  found(report, 'saying each automatic round delegates a re-review to a fresh sdlc-divergence-reviewer, passed the previous report\'s `cN` and the mode `re-review`',
    /\b(?:[Ee]ach|[Ee]very) automatic round\b/, /\bre-review\b/, /\bfresh sdlc-divergence-reviewer\b/, /\bprevious report's `cN`/, /\bmode `re-review`/, /^(?!.*\b(?:not|never|no|without)\b)/);
});

test('step 8 "Post the full report": each automatic round applies the answered QUESTIONs before the re-review', () => {
  found(report, 'saying each automatic round applies the answered QUESTIONs before it delegates the re-review',
    /\b(?:[Ee]ach|[Ee]very) automatic round\b/, /\bapplies the answered QUESTIONs\b/, /\bbefore (?:it delegates )?the re-review\b/, AFFIRMED);
});

// --- per story ------------------------------------------------------------------------------------------------

test('step 8 "Post the full report": the loop runs per story; one story\'s loop never holds or moves another story', () => {
  found(report, 'saying the loop runs per story, and one story\'s loop never holds or moves another story',
    /\bThe loop runs per story\b/, /\bone story's loop\b/, /\bnever (?:holds or moves|moves or holds) another story\b/);
});

// --- a PASS from any round ------------------------------------------------------------------------------

test('step 8 "Post the full report": a PASS from any automatic round moves the story to `ready` with the same `# Moved to ready` comment', () => {
  found(report, 'saying a PASS from any automatic round moves the story to `ready` like a first-report PASS, with the same `# Moved to ready` comment naming that report\'s `cN`',
    /^A PASS(?! WITH)\b/, /\bany automatic round\b/, /\bmoves the story to `ready`/, /\bsame `# Moved to ready` comment\b/, /`cN`/, AFFIRMED);
});

// --- step 0: the three-RETURNs window --------------------------------------------------------------------

// Pinned in `plugin/skills/plan-project/SKILL.md`, step 0, the paragraph that starts "Count its coverage reports" and ends
// at "Three or more: do not re-plan".
test('step 0: a coverage report with a `# BLOCKERs fixed` reply is not counted, and one without it is', () => {
  const from = step0.indexOf('Count its coverage reports');
  const to = step0.indexOf('Three or more: do not re-plan');
  assert.ok(from >= 0 && to > from, 'step 0 has no window paragraph from "Count its coverage reports" to "Three or more: do not re-plan"');
  const window = step0.slice(from, to);
  found(window, 'saying a report with a `# BLOCKERs fixed` reply is not counted',
    /\b[Aa] (?:coverage )?report with a `# BLOCKERs fixed` reply\b/, /\b(?:is not counted|is never counted|does not count)\b/, /^(?!.*\bwithout\b)/);
  found(window, 'saying a report without a `# BLOCKERs fixed` reply is counted',
    /\bwithout\b/, /\b(?:is counted|still counts|counts)\b/, /^(?!.*\b(?:not|never)\b)/);
});

// --- PROCESS.md "The plan gate" ----------------------------------------------------------------------------

test('PROCESS.md "The plan gate": a RETURN whose every BLOCKER is a wording fix is fixed and re-reviewed at most 2 times before the gate', () => {
  found(gate, 'saying that on a RETURN where every BLOCKER is a fix to existing items, plan-project fixes it, replies `# BLOCKERs fixed` and runs a re-review at most 2 times before the story stops at the plan gate',
    /\bRETURN\b/, /\bevery BLOCKER\b/, /\bexisting items\b/, /`# BLOCKERs fixed`/, AT_MOST_2, NO_OTHER_BOUND, /\bre-review\b/, /\bplan gate\b/);
});
