import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const plugin = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(plugin, path), 'utf8').replace(/\r\n/g, '\n');
const flat = (text) => text.replace(/\s+/g, ' ');

const skill = read('skills/run/SKILL.md');
const process_ = read('PROCESS.md');

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
  const end = until ? text.indexOf(until, at + lead.length) : -1;
  return text.slice(at, end < 0 ? undefined : end);
}

const WAITS = /\b[Ww]aits?\b[^.]*\("Wait, then carry on"\)|\bwaits\b/;

test('every escalation run raises is followed by the wait, not the end of the turn', () => {
  const wait = under(skill, 'Wait, then carry on');
  assert.match(wait, /Every escalation this skill raises is followed by a wait, not by the end of the turn/);
  assert.match(wait, /in a sub-issue, issue or project run/);
  assert.match(flat(skill), /then you wait for its answer \("Wait, then carry on"\)/);
});

test('it posts what it posts today, then says once what it waits on and until when', () => {
  const wait = under(skill, 'Wait, then carry on');
  assert.match(wait, /Post what the path posts\*\*, unchanged: the context comment, the escalation and, on an issue run's stop, the `# Run status` comment/);
  assert.match(wait, /`escalation\.escalation` in the answer \(`e1`\) is the `eN` you wait on/);
  assert.match(wait, /Say once in the session\*\* what you wait on and until when/);
  assert.match(wait, /Once, not per check/);
});

test('it waits on wait-answer.mjs, started as HARNESS.md "Waiting for an answer" says', () => {
  const wait = under(skill, 'Wait, then carry on');
  assert.match(wait, /`HARNESS\.md`, "Waiting for an answer", says/);
  assert.match(wait, /node <plugin-files>\/scripts\/wait-answer\.mjs --server <server> <ref> <eN> -- <cli>/);
  assert.match(wait, /Do not poll the issue yourself/);
});

test('each exit of the script has its one meaning', () => {
  const wait = under(skill, 'Wait, then carry on');
  const row = (code) => {
    const m = wait.match(new RegExp(`\\| ${code} \\|([^\\n]*?)\\| (\\d|\\*\\*|5\\.)`));
    assert.ok(m, `no row for exit ${code}`);
    return m[1];
  };
  assert.match(row(0), /answered.*carry on/);
  assert.match(row(2), /no answer by the deadline.*stop the turn.*re-invoking `run` resumes/);
  assert.match(row(4), /a blocker outside Leeway: stop the turn, and name the action, `leeway login --server <server>`, after which re-invoking `run` resumes/);
  assert.match(row(3), /Leeway did not answer.*stop the turn.*stop 10/);
  assert.match(row(1), /a bug in this run: stop the turn/);
});

test('on an answer it carries on as a re-invoke would, and writes nothing twice', () => {
  const wait = under(skill, 'Wait, then carry on');
  assert.match(wait, /On an answer, carry on exactly as a re-invoke of `run` would/);
  assert.match(wait, /`escalations\[\]\.answer` is the answer a re-invoke reads/);
  assert.match(wait, /Nothing is written twice\.\*\*.*no second escalation, comment or iteration for the stop you waited on/);
  assert.match(wait, /An answer that ends the work\*\*.*stop there and say so/);
});

test('an action a person can take is put to them as an escalation; only one outside Leeway stops', () => {
  const wait = under(skill, 'Wait, then carry on');
  assert.match(wait, /An answer that needs a person to act first\*\* is put to them as a new escalation.*waited on the same way/);
  assert.match(wait, /Stop and name the action only when it is outside Leeway, such as a login on the machine/);
});

test('a non-answer is never taken for an answer', () => {
  const wait = under(skill, 'Wait, then carry on');
  assert.match(wait, /Only the answer is an answer\.\*\* A comment, a status change, an edited description or another escalation's answer is not, and a run never proceeds on an unanswered escalation/);
});

test('each wait has its own deadline', () => {
  assert.match(under(skill, 'Wait, then carry on'), /A later escalation in the same run waits the same way, with a deadline of its own: each wait starts its 16 hours fresh/);
});

test('each stop path in run waits on its escalation', () => {
  const paths = {
    'the round-0 cap': from(under(skill, 'Round 0: red tests first'), '**The cap.**'),
    'a wrong frozen test': from(under(skill, 'The freeze'), '**A frozen test that is wrong'),
    'a stalled round': from(under(skill, '2. Gate, commit, push, record'), '2. **Stalled-round check.**', '3. **Push'),
    'a BLOCKED brief': from(under(skill, 'A BLOCKED brief'), '5. **Wait.**'),
    'a finding that needs a human': from(under(skill, '4. Gate again, record, act'), '3. **A dispute or a finding', '```'),
    'the debt proposal': from(under(skill, 'What a deferred finding becomes'), '| Technical debt', '| Anything else'),
    'the code-round cap': from(under(skill, 'Then'), '**The caps.**', '**Spend rounds'),
    'a merge conflict at the story gate': from(under(skill, 'The story gate'), '1. **Merge the story', '2. Run'),
    'a hard stop': from(under(skill, 'On a stop'), '7. **Wait on the stop'),
  };
  for (const [name, text] of Object.entries(paths)) {
    assert.match(text, WAITS, `${name} does not wait`);
    assert.doesNotMatch(text, /\bStop\.\*\*|then stop\b|, and you stop|stop and escalate/, `${name} still stops`);
  }
  assert.match(paths['the debt proposal'], /in an issue run that the run waits here for the answer \(its stop 4\)/);
  assert.match(paths['a merge conflict at the story gate'], /escalate and wait \("Wait, then carry on"\).*or escalate and wait if it names none/);
});

test('the hard stop waits after its status comment, and on an answer carries on without writing it again', () => {
  const stop = under(skill, 'On a stop');
  assert.match(stop, /7\. \*\*Wait on the stop's one escalation\*\* \("Wait, then carry on"\)\. On its answer the run carries on from where step 1 left it, the condition overridden by that answer, and writes none of steps 4 and 5 again/);
  assert.match(stop, /Only when the wait ends without an answer, or the answer ends the work, stop the turn/);
  assert.match(stop, /Stop 10 has no escalation to wait on/);
  assert.match(under(skill, 'Hard stop conditions'), /Its wait is step 7 of "On a stop", after the status comment, not a second one before it/);
});

test('an issue or project run ends at a stop only once the wait has ended', () => {
  assert.match(under(skill, 'Run an issue'), /A stop whose answer arrives while the run waits is not an ending: the run carries on/);
  assert.match(under(skill, 'Run a project'), /An issue whose stop is answered while its run waits has not stopped: its run carries on, and so does the project run/);
});

test('"stop the turn" is said only where the wait ends without an answer', () => {
  const allowed = [under(skill, 'Wait, then carry on'), under(skill, 'On a stop')].join(' ');
  const count = (text) => (text.match(/stop the turn/g) || []).length;
  assert.equal(count(flat(skill)), count(allowed), 'run says "stop the turn" outside "Wait, then carry on" and "On a stop"');
});

test('PROCESS.md: run waits, every other skill stops, and only the answer is one', () => {
  const rule = under(process_, 'Questions to the human are escalations');
  assert.match(rule, /Then, in `run`, wait for the answer\*\*: say once what it waits on and until when, wait on `scripts\/wait-answer\.mjs` \(as `HARNESS\.md`, "Waiting for an answer", says\), and on an answer carry on as a re-invoke would, writing nothing twice/);
  assert.match(rule, /for a blocker outside Leeway \(such as `leeway login`\), naming the action/);
  assert.match(rule, /\*\*Every other skill stops the turn\*\*/);
  assert.match(rule, /a comment, a status change or an edited description is not/);
  assert.match(rule, /raises the escalation from the block, and waits\./);
});

test('shape-project and plan-project still stop the turn after their escalations', () => {
  assert.match(flat(read('skills/shape-project/SKILL.md')), /escalation on the story, and then you stop the turn/);
  assert.match(flat(read('skills/plan-project/SKILL.md')), /escalation on the story, and then you stop the turn/);
});
