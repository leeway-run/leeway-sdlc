import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const flat = (text) => text.replace(/\s+/g, ' ');
const read = (path) => flat(readFileSync(join(root, path), 'utf8'));
const raw = readFileSync(join(root, 'plugin/skills/plan-project/SKILL.md'), 'utf8');
const skill = flat(raw);

// The interview's own section, between its heading and step 3's.
const start = raw.indexOf('## The developer interview\n');
const end = raw.indexOf('## 3. Write the design doc');
const interview = flat(raw.slice(start, end));

// One part of the interview, or one row of its tables, so a pin cannot be met by the same words elsewhere in the file.
const part = (heading) => {
  const from = raw.indexOf(`### ${heading}\n`, start);
  assert.ok(from > start && from < end, `no part ${heading}`);
  const next = raw.indexOf('\n### ', from + 4);
  return raw.slice(from, next === -1 || next > end ? end : next);
};
const rows = (text) => text.split('\n').filter((l) => l.startsWith('|') && !l.startsWith('|---')).slice(1);
const resume = rows(part('Where it stands, from Leeway alone'));
const exits = rows(part('Wait, then read'));
const stepPart = (from, to) => flat(raw.slice(raw.indexOf(from), raw.indexOf(to)));
const step0 = stepPart('## 0. Orient', '## Does this need planning');
const step2 = stepPart('## 2. Read before designing', '## The developer interview');
const step3 = stepPart('## 3. Write the design doc', '### The technical criteria');
const step53 = stepPart('3. **The stories**, in the project', '4. **Floor questions, per story');
const step54 = stepPart('4. **Floor questions, per story', '5. **The tasks**');
const doneWhen = stepPart('## Done when', '\0');

test('the interview sits after the product check and step 2, before the design doc', () => {
  assert.ok(start > raw.indexOf('## 1. Product check') && start > raw.indexOf('## 2. Read before designing'), 'not after them');
  assert.ok(start < end, 'not before step 3');
  assert.match(skill, /\| a `plan` step \| "The developer interview" runs, before step 3 \|/);
});

test('AC-1: the open technical decisions go to the developer as escalations before the design doc', () => {
  assert.match(interview, /After the product check and step 2, before step 3, on every story this skill plans/);
  assert.match(interview, /go to the developer now, as escalations \(step 0, "Where the human is asked"\), never in the terminal/);
});

test('AC-2: the first round holds every decision that depends on no other answer', () => {
  assert.match(interview, /Every open decision that depends on no other answer goes out together/);
  assert.match(interview, /where one answer would settle or change another question, merge them, or hold the dependent one/);
});

test('AC-3: a follow-up round holds only what an answer opened, and drops what one settled', () => {
  assert.match(interview, /A round holds \*\*only what an answer opened\*\*, its comment naming the `eN` that opened it, and each held question/);
  assert.match(interview, /\*\*Drop what an answer settled:\*\* it is not asked again, and it is not raised for confirmation/);
});

test('AC-4: it waits with wait-answer.mjs and resumes from Leeway alone, whenever the answer comes', () => {
  assert.match(interview, /### Where it stands, from Leeway alone Every invocation starts here, after step 2, and takes nothing from an earlier session/);
  assert.match(interview, /A question is \*\*its own top-level comment\*\*, its body opening `# Interview question <n>, round <r>`/);
  assert.match(interview, /A question's comment holding `Held on eN`, with none on it, has not been raised/);
  assert.match(interview, /node <plugin-files>\/scripts\/wait-answer\.mjs --server <server> <ref> <eN> -- <cli>/);
  assert.match(interview, /\| 2 \| no answer by the deadline \| stop the turn, naming the escalations and the story: they stay, and re-invoking `plan-project` resumes/);
  assert.match(interview, /Where `HARNESS\.md` says `wait: stop`, skip the wait and act at once as for exit 2/);
  assert.match(interview, /a re-invoke with one still open waits on it again, with no second comment or escalation/);
  });

test('AC-4: a partly answered round stays open, and an answer settling an open question does not close it', () => {
  assert.match(interview, /\*\*A partly answered round is still open:\*\* one answer of two starts nothing/);
  assert.match(interview, /nothing can withdraw an escalation, and you do not answer one yourself/);
});

test('AC-5: nothing the code or an earlier answer settles is asked', () => {
  assert.match(interview, /Nothing the code, the docs, the body, a comment or an earlier answer settles is asked/);
  assert.match(part('What is asked'), /Read the code first \(step 2\)\./);
  assert.match(step2, /Then \*\*the surfaces the story touches in the code\*\*/);
});

test('AC-6: no design doc while an interview escalation is open', () => {
  assert.match(step3, /\*\*Not while the interview is open\.\*\* Read each story again now: an open escalation, /);
  assert.match(step3, /a question comment after the latest `# Interview closed`, or no `# Interview closed` at all goes back to "The developer interview"\. Nothing from here on is written first: no design doc, no `TC-n`, no task, and no project beyond the one a new story needed\./);
  assert.match(doneWhen, /and no escalation of its interview open\./);
});

test('AC-7: a product question stays a gap for the PO', () => {
  assert.match(interview, /\*\*A product question is not asked here\.\*\* What the user gets, an `AC-n`, a scope call: it stays a product gap for the PO\. Go to step 1, "Gaps → back to the PO", even with a round open/);
  assert.match(interview, /\*\*A story step 1 held gets no interview until it passes\.\*\* Step 1 runs first, so a product gap and an interview question are never in one round/);
});

test('the design doc links the escalations rather than restating them', () => {
  assert.match(skill, /\*\*it links their escalations \(`<ref> eN`\) rather than restating them\*\*/);
  assert.doesNotMatch(skill, /tradeoffs, open questions\./);
});

test('floor questions join the first round and are not raised twice; a QUESTION is not the interview', () => {
  assert.match(interview, /\*\*Step 5's floor questions and its repository question go out with this round\*\*/);
  assert.match(skill, /A question already raised with the interview's first round \(a comment opening `# Floor question` with an escalation on it\) is not raised again: read its answer/);
  assert.match(skill, /unless the interview's first round already did/);
  assert.match(interview, /A QUESTION from the divergence review \(step 8\) is not this interview/);
});

test('skipping: nothing open is the one way past it, tied to "Does this need planning at all?"', () => {
  assert.match(interview, /\*\*Nothing open is the only way past the interview, and size is not one\.\*\*/);
  assert.match(skill, /A story this section sends to `run` skips the interview with the rest of this skill; one it sends here is never too small for it/);
});

test('the contract and the harnesses say the interview waits', () => {
  assert.match(read('plugin/PROCESS.md'), /`plan-project` waits the same way while its developer interview holds it, on any open escalation of the story, and stops where that wait ends without an answer; elsewhere its escalations stop the turn\. \*\*Every other skill stops the turn\*\*/);
  assert.match(read('plugin/PROCESS.md'), /Before the design doc it interviews the developer in rounds of escalations/);
  assert.match(read('plugin/HARNESS.md'), /`plan-project`'s developer interview starts and reads its waits the same way; re-invoking `plan-project` resumes it/);
  assert.match(read('scripts/targets.mjs'), /plan-project\\`'s developer interview does not wait either/);
  assert.match(read('targets/agents/skills/sdlc-install/kit/harness/codex.md'), /`plan-project`'s developer interview does not wait either/);
  assert.match(read('docs/targets/README.md'), /`plan-project`'s developer interview uses the same script and follows the same line\./);
  assert.match(read('targets/agents/HARNESS.md'), /`plan-project`'s developer interview stops the same way/);
});

test('every interview path keeps the escalation shape: 2 to 5 options, the recommended first', () => {
  assert.match(interview, /2 to 5 options, the recommended one first/);
  assert.match(interview, /A decision with more than 5 options is cut to the real ones/);
});

// The state machine: every row, in order, then each rule on its own. Each pin reads one row or one part.
const firstCell = (row) => row.split(' | ')[0];

test('resume table: five rows, in this order, the crash check before the finished check', () => {
  assert.deepEqual(resume.map((r) => firstCell(r).replace(/`/g, '').slice(2, 20)), [
    'a question comment',
    'a # Interview clos',
    'an open escalation',
    'every escalation a',
    'no question comment'.slice(0, 18),
  ]);
});

const rowPins = [
  ['crash row: finds a question comment after the latest close with no escalation and no Held on', 'a question comment after', /^\| a question comment after the latest `# Interview closed`, if any, with no escalation and no `Held on` \|/],
  ['crash row: raises on that comment, with no second comment', 'a question comment after', /raise it now, with no second comment/],
  ['crash row: not when an answer settled it', 'a question comment after', /unless an answer settled it, which `# Interview closed` then names/],
  ['crash row: goes on down the table', 'a question comment after', /Go on down this table/],
  ['finished row: only with no question comment after the close', 'a `# Interview closed`', /^\| a `# Interview closed` with no question comment after it/],
  ['finished row: only with no open escalation', 'a `# Interview closed`', /and no open escalation \|/],
  ['finished row: carries on at step 3, and answers stand on a re-plan', 'a `# Interview closed`', /it is finished: carry on at step 3\. The answers stand on a re-plan/],
  ['finished row: a decision a BLOCKER or a changed AC opens goes out as the next round', 'a `# Interview closed`', /Where a BLOCKER or a changed `AC-n` opens a decision nobody was asked, its question goes out as the next round/],
  ['open row: an open escalation', 'an open escalation', /^\| an open escalation,/],
  ['open row: a spanning question open on the other story', 'an open escalation', /or a `# Interview: on <ref> cN` whose comment there has one open \|/],
  ['open row: waits and raises nothing new', 'an open escalation', /do not proceed and raise nothing new: wait \(below\)/],
  ['open row: any of the story\'s, not only the interview\'s', 'an open escalation', /any open escalation of the story, not only the interview's/],
  ['answered row: goes to the next round', 'every escalation answered', /^\| every escalation answered, and a question comment \| read the answers: "The next round" \|$/],
  ['not-started row: goes to the first round', 'no question comment', /^\| no question comment \| it has not started: "The first round" \|$/],
];
for (const [name, opening, pattern] of rowPins) test(name, () => assert.match(resume.find((r) => r.startsWith(`| ${opening}`)) ?? '', pattern));

const exitPins = [
  ['exit 0: reads every story of the round again', '0', /\| answered \| read every story of the round again\./],
  ['exit 0: another open is waited on with its own ref and 16 hours', '0', /Another still open: wait on that one, with its `ref` and 16 hours of its own\./],
  ['exit 0: none open goes to the next round', '0', /None: "The next round"/],
  ['exit 1: a bug in this run stops the turn', '1', /\| the call was wrong, or `<ref>` has no `eN` \| a bug in this run: stop the turn and say so \|/],
  ['exit 2: stops the turn', '2', /\| no answer by the deadline \| stop the turn/],
  ['exit 3: Leeway did not answer stops the turn', '3', /\| Leeway did not answer \| stop the turn and say so; re-invoking resumes \|/],
  ['exit 4: names the login action', '4', /\| the CLI asked for `leeway login` \| stop the turn and name the action, `leeway login --server <server>`; re-invoking resumes \|/],
];
for (const [name, code, pattern] of exitPins) {
  test(name, () => assert.match(exits.find((r) => r.startsWith(`| ${code} |`)) ?? '', pattern));
}

const partPins = [
  ['c2: the story\'s escalations are the entries whose ref is the story', 'Where it stands, from Leeway alone', /\*\*the story's escalations, here and at step 3, are the entries whose `ref` is the story\.\*\*/],
  ['c2: a sub-issue\'s open escalation holds nothing on a re-plan', 'Where it stands, from Leeway alone', /A sub-issue's open one, on a re-plan, is `run`'s and holds nothing here: name it in the session, and do not wait on it/],
  ['c2: the wait uses the entry\'s own ref', 'Wait, then read', /`<ref>` is the entry's own `ref`/],
  ['the tie: a question\'s escalation is set on its own comment, and why', 'Where it stands, from Leeway alone', /with its escalation's `--comment` set to that comment's `cN`, because a comment holds one open escalation and a reply has no `cN`/],
  ['c9: a comment\'s own escalation is read from comments[].escalation', 'Where it stands, from Leeway alone', /A comment's own escalation is `comments\[\]\.escalation`, `\{number, open\}` or null/],
  ['c4: what counts as a question comment, a spanning one read on its story', 'Where it stands, from Leeway alone', /A \*\*question comment\*\* is one of these, a `# Floor question`, or a `# Interview: on <ref> cN`, which stands for that comment on `<ref>` and is read there/],
  ['the end mark', 'Where it stands, from Leeway alone', /The interview ends at a comment opening `# Interview closed`\. The first row that fits decides/],
  ['first round: the raise is tied by --comment cN', 'The first round', /`escalation raise <story> --json` \(`escalation\.escalation` in the answer is the `eN`\) with `--comment cN`/],
  ['first round: --meanwhile says nothing moves until it closes', 'The first round', /--meanwhile "Nothing: no design doc, criteria or tasks until the interview closes\."/],
  ['first round: held questions are posted, naming what they wait on', 'The first round', /Post the held ones' comments last, each holding `Held on eN`, the escalations it waits on, so a re-invoke finds them/],
  ['c4: a spanning decision is one escalation, with a comment on each other story before the raise', 'The first round', /A decision spanning stories is one escalation on the first, its comment naming the others\. Before raising it, post a comment on each other story opening `# Interview: on <ref> cN`/],
  ['the wait: says once what it waits on', 'Wait, then read', /Say once what you wait on and until when/],
  ['only the answer is an answer', 'Wait, then read', /Only the answer is an answer: a comment, a status change or an edited description is not/],
  ['next round: reads each label and note', 'The next round', /read each `label` and `note`/],
  ['next round: raises each held question still undecided on its comment', 'The next round', /each held question that is still undecided: its comment's `Held on` escalations all answered, and raised on that comment/],
  ['next round: a missed first-round decision is asked, not decided alone', 'The next round', /A first-round decision a crash or a miss left out is not decided alone in the design doc: it goes out here/],
  ['close: posts the end mark on each story of the round', 'Close it', /post one comment on each story of the round opening `# Interview closed`/],
  ['close: lists the escalations and settled held questions, restating no answer', 'Close it', /one line per escalation \(`eN`, and which question\), and one per held question an answer settled and which\. It restates no answer/],
  ['close: then step 3', 'Close it', /Then carry on at step 3\./],
  ['no PO: a product question goes to the human in this round', 'What is asked', /On a type without `shape` there is no PO: decide it with the human by escalation, as step 3 says, in this round/],
];
for (const [name, heading, pattern] of partPins) test(name, () => assert.match(flat(part(heading)), pattern));

test('c3: a story that does not exist yet is created first, so its round has a ref', () => {
  const intro = flat(raw.slice(start, raw.indexOf('### Where it stands', start)));
  assert.match(intro, /\*\*A story that does not exist yet is created first, so its round has a ref\.\*\*/);
  assert.match(intro, /with its body and type and no tasks, in its project/);
  assert.match(intro, /One found only at step 4 or 5 is the same: nothing is written for it until its own `# Interview closed`/);
});

test('c3: step 5.3 says it is created before its interview, and "Done when" holds for it', () => {
  assert.match(step53, /One the work needs and nobody wrote is created with this command before its interview, only for a type without `shape`/);
  assert.match(doneWhen, /Every planned story, a new one too, has a `# Interview closed`, posted before its design doc/);
});

test('c4: step 3 reads a spanning question on the story it is on', () => {
  assert.match(step3, /a `# Interview: on <ref> cN` whose comment there has one open/);
});

test('step 5.4: a floor question has its own heading', () => {
  assert.match(step54, /post the context as a comment, opening `# Floor question`/);
});

test("step 0's exception: the interview waits where every other question stops the turn", () => {
  assert.match(step0, /then you stop the turn/);
  assert.match(step0, /\*\*The one exception to stopping is "The developer interview", which waits on its escalations first\*\* and stops the turn where that wait ends with no answer/);
});

test('a type with no design doc carries the answers in the story and task descriptions', () => {
  assert.match(step3, /each carrying the interview's answers that bind it and citing their `eN`/);
});
