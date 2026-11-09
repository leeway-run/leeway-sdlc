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
  if (!until) return text.slice(at);
  const end = text.indexOf(until, at + lead.length);
  assert.ok(end >= 0, `no "${until}" after "${lead}"`);
  return text.slice(at, end);
}

const WAITS = /\bwait(s|ed)?\b[^.]*\("Wait, then carry on"\)/i;
const STOPS = /\bthen stop\b|, and you stop|stop and escalate|\bstop[.;,]/i;

test('every escalation run raises is followed by the wait, not the end of the turn', () => {
  const wait = under(skill, 'Wait, then carry on');
  assert.match(wait, /Every escalation this skill raises is followed by a wait, not by the end of the turn/);
  assert.match(wait, /in a sub-issue, issue or project run/);
  assert.match(flat(skill), /then you wait for its answer \("Wait, then carry on"\)/);
});

test('it posts what it posts today, then says once what it waits on and until when', () => {
  const wait = under(skill, 'Wait, then carry on');
  assert.match(wait, /Post what the path posts\*\*, unchanged: the context comment, the escalation and, on an issue run's stop, the `# Run status` comment/);
  assert.match(wait, /`<raise>` prints the escalation as JSON: `escalation\.escalation` in it \(`e1`\) is the `eN` you wait on/);
  assert.match(wait, /Say once in the session\*\* what you wait on and until when/);
  assert.match(wait, /Once, not per check/);
});

test('it waits on wait-answer.mjs, started as HARNESS.md "Waiting for an answer" says', () => {
  const wait = under(skill, 'Wait, then carry on');
  assert.match(wait, /`HARNESS\.md`, "Waiting for an answer", says/);
  assert.match(wait, /<wait-answer> --server <server> <ref> <eN> -- <cli>/);
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
  assert.match(row(5), /^ a question is waiting; `\{"clarification","question","askedAt"\}` on stdout \| not an answer and not an end: answer it and wait again on the same escalation, as `PROCESS\.md`, "Questions to the human are escalations", says\. Carry on only on exit 0 \|/);
});

test('exit 5 is never an end: a wait that blocks nothing answers the question and waits again too', () => {
  const wait = under(skill, 'Wait, then carry on');
  assert.match(wait, /Act on how it exits, as the table says\*\*, with one exception: a wait on something that blocks nothing, such as a sub-issue run's debt proposal after its task is `done` \("Land the task", step 5\), carries on instead of stopping when it ends without an answer \(exit 2, 3 or 4\)\./);
  assert.equal((wait.match(/as the table says/g) || []).length, 1, 'step 4 says "as the table says" more than once');
});

test('PROCESS.md: on a question the orchestrator answers as the raising role, says so once, and waits again', () => {
  const rule = under(process_, 'Questions to the human are escalations');
  const loop = from(rule, '**A question asked of the agent is answered, then the wait starts again.**', '**Escalations go out in rounds.**');
  assert.match(rule, /A question asked of the agent while it waits does not end the wait \(the next point\)\./);
  assert.match(loop, /the wait exits 5 on the question, printing `\{"clarification":"qN","question":"…","askedAt":<ms>\}`\. The orchestrator answers it, never a subagent/);
  assert.match(loop, /Answer from what you know\*\*, reading the code where that settles it, and the questions already answered on that escalation, so the answer agrees with them: `leeway clarification list <ref> <eN> --json`/);
  assert.match(loop, /An answer that changes the options or the advice says so in its text; the escalation itself is not changed\./);
  assert.match(loop, /`<role>` is `by\.actor\.role` of the escalation's entry in `escalations\[\]` of `leeway issue get <ref> --json`/);
  assert.match(loop, /leeway clarification answer <ref> <eN> <qN> --as <alias>\/<role> --stdin answer < <file>/);
  assert.doesNotMatch(loop, /--answer "/);
  assert.match(loop, /The answer goes in from a file, never inline, since an answer drawn from the code can hold a backtick or a `\$` the shell would run/);
  assert.match(loop, /Say once in the session\*\* that qN on eN is answered, and until when the new wait runs/);
  assert.match(loop, /Wait again on the same escalation\*\*, the same command, with 16 hours of its own\./);
  assert.match(loop, /Nothing else is written: no second escalation and no comment for it\. A question is not the answer: do no work that depends on the escalation, and carry on only on exit 0\./);
});

test('PROCESS.md: an answer that is not written ends the loop as exit 3 or 4 does, never in another wait', () => {
  const loop = from(under(process_, 'Questions to the human are escalations'), '**A question asked of the agent is answered', '**Escalations go out in rounds.**');
  assert.match(loop, /If the answer is not written\*\* \(the CLI refuses it, Leeway does not answer, or it asks for `leeway login`\), do not wait again, because the question still open would end the next wait at once: act as for exit 4 where the CLI asked for `leeway login`, and as for exit 3 otherwise, naming the escalation and the question and saying what the CLI said\./);
  // Only a wait that holds work is met again by a re-invoke; one that blocks nothing carries on (LWY-160.2 c3).
  assert.match(loop, /Where the wait holds work, that stops the turn, and a re-invoke waits again and meets the question again\. Where it blocks nothing, say once in the session that qN on eN is unanswered, and carry on as on exit 3 or 4\./);
  assert.doesNotMatch(loop, /otherwise, naming the escalation and the question and saying what the CLI said\. A re-invoke waits again/);
});

test('HARNESS.md: exit 5 starts the background wait again', () => {
  assert.match(flat(read('HARNESS.md')), /Exit 5 is a question, not the end: answer it, then start the wait again the same way, a new background command \(`PROCESS\.md`, "Questions to the human are escalations"\)\./);
});

test('only the orchestrator answers: the subagents print no clarification answer', () => {
  for (const f of ['agents/sdlc-implementer.md', 'agents/sdlc-reviewer.md', 'skills/run/templates/BRIEF.md', 'skills/run/templates/VERDICT.md']) {
    assert.doesNotMatch(read(f), /clarification answer/, f);
  }
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
    // Each path starts after the lead-in that names its condition (the round-0 cap's "stop." and the frozen test's
    // "Stop."), and ends before the next path.
    'the round-0 cap': from(under(skill, 'Round 0: red tests first'), 'Two failed attempts mean', '#### The freeze'),
    'a wrong frozen test': from(under(skill, 'The freeze'), 'Show the criterion', '**At the PASS'),
    'a stalled round': from(under(skill, '2. Gate, commit, push, record'), '2. **Stalled-round check.**', '3. **Push'),
    'a BLOCKED brief': from(under(skill, 'A BLOCKED brief'), '5. **Wait.**'),
    'a finding that needs a human': from(under(skill, '4. Gate again, record, act'), '3. **A dispute or a finding', '```'),
    'the debt proposal': from(under(skill, 'What a deferred finding becomes'), '| Technical debt', '| Anything else'),
    'the code-round cap': from(under(skill, 'Then'), '**The caps.**', '**Spend rounds'),
    'a merge conflict at the story gate': from(under(skill, 'The story gate'), '1. **Merge the story', '2. Run'),
    'a hard stop': from(under(skill, 'On a stop'), '7. **Wait on each of the stop'),
  };
  for (const [name, text] of Object.entries(paths)) {
    assert.match(text, WAITS, `${name} does not wait`);
    assert.doesNotMatch(text, STOPS, `${name} still stops`);
  }
  assert.match(paths['the debt proposal'], /in an issue run that the run waits here for the answer \(its stop 4\)/);
  assert.match(paths['the debt proposal'], /In a sub-issue run the loop does carry on: the task lands, and the run waits on the proposal \("Wait, then carry on"\) before it ends \("Land the task", step 5\)/);
  assert.match(paths['a merge conflict at the story gate'], /escalate and wait \("Wait, then carry on"\).*or escalate and wait if it names none/);
});

test('a sub-issue run waits on its debt proposal once the task has landed, and files only on a yes', () => {
  const land = under(skill, 'Land the task');
  const step = from(land, '5. **Wait on each debt proposal', '6. **Friction');
  assert.match(step, /only when `run` was invoked on the sub-issue itself\*\* \(an issue run has already waited on it, as its stop 4\)/);
  assert.match(step, /start its wait \("Wait, then carry on"\), all together with the others\. On a yes, file the issue as that row says; on a no, the finding stays a nit\./);
  assert.ok(land.indexOf('4. **Remove the task worktree') < land.indexOf('5. **Wait on each debt proposal'), 'the debt wait does not come after the task has landed');
  assert.match(step, /A wait here that ends without an answer \(exit 2, 3 or 4\) does not end the run\*\*: the proposal blocks nothing and the task is already `done`, so there is nothing a re-invoke could resume\. Leave the escalation open, say once that the finding stays unfiled until someone answers it and files it, and go on to step 6\./);
  assert.doesNotMatch(step, STOPS, 'the debt wait stops the run');
  assert.match(under(skill, 'Wait, then carry on'), /Act on how it exits, as the table says\*\*, with one exception: a wait on something that blocks nothing, such as a sub-issue run's debt proposal after its task is `done` \("Land the task", step 5\), carries on instead of stopping when it ends without an answer \(exit 2, 3 or 4\)\./);
  assert.match(under(skill, 'What a deferred finding becomes'), /quoting the answer's `label` and `note`/);
  assert.doesNotMatch(under(skill, 'What a deferred finding becomes'), /answer's `option`/);
});

test('in an issue run, a debt follow-up is filed by the run on a yes and stays a nit on a no', () => {
  const note = from(under(skill, 'Hard stop conditions'), '**3 and 4: finish landing the task first.**', '**5 replaces');
  assert.match(note, /A `debt` follow-up is the proposal's escalation: on a yes the run files the issue as "What a deferred finding becomes" says, and on a no the finding stays a nit\./);
  assert.doesNotMatch(note, /filed by nobody/);
});

test('time spent in a wait does not count toward the wall-clock budget', () => {
  assert.match(under(skill, 'Story start'), /\*\*wall-clock\*\* is `totals\.minutes`\. A continuation run reads them there, never from the `Spend` line of a `# Run status` comment\. Time spent in a wait \("Wait, then carry on"\) does not count toward wall-clock\./);
});

test('the hard stop waits after its status comment, and on an answer carries on without writing it again', () => {
  const stop = under(skill, 'On a stop');
  assert.match(stop, /7\. \*\*Wait on each of the stop's escalations\*\* \("Wait, then carry on"\), all together\. Once every one is answered the run carries on from where step 1 left it, the condition overridden by those answers, and writes none of steps 4 and 5 again/);
  assert.match(stop, /Only when a wait ends without an answer, or an answer ends the work, stop the turn/);
  assert.match(stop, /Stop 10 has no escalation to wait on/);
  assert.match(under(skill, 'Hard stop conditions'), /Its wait is step 7 of "On a stop", after the status comment, not a second one before it/);
});

test('an issue or project run ends at a stop only once the wait has ended', () => {
  assert.match(under(skill, 'Run an issue'), /A stop whose every answer arrives while the run waits is not an ending: the run carries on/);
  assert.match(under(skill, 'Run a project'), /An issue whose stop is wholly answered while its run waits has not stopped: its run carries on, and so does the project run/);
});

test('"stop the turn" is said only where the wait ends without an answer', () => {
  const allowed = [under(skill, 'Wait, then carry on'), under(skill, 'On a stop')].join(' ');
  const count = (text) => (text.match(/stop the turn/g) || []).length;
  assert.equal(count(flat(skill)), count(allowed), 'run says "stop the turn" outside "Wait, then carry on" and "On a stop"');
});

test('PROCESS.md: every skill that raises waits, it names every stop, and only the answer is one', () => {
  const rule = under(process_, 'Questions to the human are escalations');
  assert.match(rule, /Then wait for the answer, in every skill that raises\*\*: `run`, `plan-project`, `shape-project`, `sync-repo`, `sdlc-install` and `sdlc-tune`\. Say once what it waits on and until when, start one background wait per open escalation of the round, all together, on `scripts\/wait-answer\.mjs` \(as `HARNESS\.md`, "Waiting for an answer", says\), act on each exit as run's "Wait, then carry on" does, and on an answer, once every escalation of the round is answered, carry on as a re-invoke of that skill would, writing nothing twice/);
  assert.doesNotMatch(rule, /Every other skill stops the turn/);
  assert.match(rule, /Where `HARNESS\.md` says `wait: stop`, no wait starts: act at once as for exit 2\./);
  // Every stop, listed (LWY-160.2 c2): exits 2, 3, 4, 1 and any other, a refused answer write, and an answer that ends the work.
  const stops = from(rule, 'A wait that holds work stops the turn only when:', 'A wait that blocks nothing');
  assert.match(stops, /it ends without an answer \(exit 2, about 16 hours; exit 3, Leeway unreachable\), naming the escalation and the issue;/);
  assert.match(stops, /it ends on a blocker outside Leeway \(exit 4, `leeway login`\), naming the action;/);
  assert.match(stops, /it ends in a bug \(exit 1\) or never ran \(any other exit\), saying so;/);
  assert.match(stops, /the answer to a question asked of the agent is not written \(the next point\);/);
  assert.match(stops, /or the answer ends the work\./);
  assert.match(rule, /A wait that blocks nothing \(run's debt proposal once its task has landed, "Land the task", step 5\) does not stop the turn on exit 2, 3 or 4, nor on an answer that is not written: it says once that the escalation stays unanswered and carries on\./);
  assert.match(rule, /a comment, a status change or an edited description is not/);
  assert.match(rule, /raises the escalation from the block, and waits\./);
});

test('PROCESS.md: the loop and the round cap wait on their escalation, not stop', () => {
  const loop = under(process_, 'The loop');
  assert.match(loop, /it waits for a human only where one of its stop conditions fires, each ending in one escalation, or one per independent question where a round has more, that it waits on, carrying on when every answer has come \("Questions to the human are escalations"\)/);
  assert.doesNotMatch(loop, /stops for a human/);
  assert.match(loop, /\*\*The round cap\.\*\*.*one escalation, and the work waits on its answer \("Questions to the human are escalations"\)/);
  assert.doesNotMatch(loop, /one escalation, and the work stops/);
});

test('shape-project and plan-project wait after their escalations, no longer stopping the turn', () => {
  assert.match(flat(read('skills/shape-project/SKILL.md')), /escalation on the story, and then you wait for its answer/);
  assert.match(flat(read('skills/plan-project/SKILL.md')), /escalation on the story, and then you wait for its answer/);
  assert.doesNotMatch(flat(read('skills/shape-project/SKILL.md')), /escalation on the story, and then you stop the turn/);
  assert.doesNotMatch(flat(read('skills/plan-project/SKILL.md')), /escalation on the story, and then you stop the turn/);
});
