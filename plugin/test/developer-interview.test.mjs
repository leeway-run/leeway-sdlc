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
const step52 = stepPart('2. **The Plan record, now, once', '3. **The stories**, in the project');
const step54 = stepPart('4. **Floor questions, per story', '5. **The tasks**');
const intro = flat(raw.slice(start, raw.indexOf('### Where it stands', start)));
const doneWhen = stepPart('## Done when', '\0');

test('the interview sits after the product check and step 2, before the design doc', () => {
  assert.ok(start > raw.indexOf('## 1. Product check') && start > raw.indexOf('## 2. Read before designing'), 'not after them');
  assert.ok(start < end, 'not before step 3');
  assert.match(skill, /\| a `plan` step \| "The developer interview" runs, before step 3 \|/);
});

test('AC-1: the open technical decisions go to the developer as escalations before the design doc', () => {
  assert.match(interview, /After the product check and step 2, before step 3, on every story this skill plans\*\*, with a design doc or without one/);
  assert.match(interview, /go to the developer now, as escalations \(step 0, "Where the human is asked"\), never in the terminal\. Several stories share one round\./);
  assert.match(skill, /checks each issue's product side and sends its gaps back to the PO \(when its type has a shape step\), interviews the developer on what the code leaves open, writes the design doc/);
});

test('AC-2: the first round holds every decision that depends on no other answer', () => {
  assert.match(interview, /Every open decision that depends on no other answer goes out together\*\*, so one sitting answers them, and the ones that shape the plan most are among them/);
  assert.match(interview, /Check the round first \(step 0\): where one answer would settle or change another question, merge them, or hold the dependent one/);
});

test('AC-3: a follow-up round holds only what an answer opened, and drops what one settled', () => {
  assert.match(interview, /A round holds \*\*only what an answer opened\*\*, its comment naming the `<ref> eN` that opened it, and each held question/);
  assert.match(interview, /\*\*Drop what an answer settled:\*\* it is not asked again, and it is not raised for confirmation/);
});

test('AC-4: it waits with wait-answer.mjs and resumes from Leeway alone, whenever the answer comes', () => {
  assert.match(interview, /### Where it stands, from Leeway alone Every invocation starts here, after step 2, and takes nothing from an earlier session/);
  assert.match(interview, /A question's comment holding `Held on <ref> eN`, with none on it, has not been raised/);
  assert.match(interview, /node <plugin-files>\/scripts\/wait-answer\.mjs --server <server> <ref> <eN> -- <cli>/);
  assert.match(interview, /\| 2 \| no answer by the deadline \| stop the turn, naming the escalations and the story: they stay, and re-invoking `plan-project` resumes/);
  assert.match(interview, /Where `HARNESS\.md` says `wait: stop`, skip the wait and act at once as for exit 2/);
  assert.match(interview, /A person can answer at once or days later: the answer is read the same way, and a re-invoke with one still open waits on it again, with no second comment or escalation/);
});

test('AC-4: a partly answered round stays open, and an answer settling an open question does not close it', () => {
  assert.match(interview, /\*\*A partly answered round is still open:\*\* one answer of two starts nothing/);
  assert.match(interview, /\*\*An answer that settles a question still open\*\* does not close it: nothing can withdraw an escalation, and you do not answer one yourself/);
  assert.match(interview, /Say in the session that eN is settled by eM and only needs its answer, raise nothing about it, and keep waiting/);
  assert.match(interview, /An answer that ends the work is followed: stop there and say so, and that any other stays open/);
});

test('AC-5: nothing the code or an earlier answer settles is asked', () => {
  assert.match(interview, /Nothing the code, the docs, the body, a comment or an earlier answer settles is asked/);
  assert.match(part('What is asked'), /\*\*Do not ask what is already settled\.\*\* Read the code first \(step 2\)\./);
  assert.match(flat(part('What is asked')), /an earlier answer is any `escalations\[\]\.answer` on this story, the Plan record or a sibling story: the PO's, a QUESTION's \(step 8\), or an earlier round's/);
  assert.match(step2, /Then \*\*the surfaces the story touches in the code\*\*/);
});

test('AC-5: what is asked is an open decision, and each open question for dev is settled or asked', () => {
  const asked = flat(part('What is asked'));
  assert.match(asked, /\*\*An open decision\*\* is one the story, the code and the docs leave open, with more than one reasonable answer, that would change the plan's shape or be costly to change later: a data model, a boundary, a dependency, a sequence, what a `TC-n` would bind/);
  assert.match(asked, /A local choice nobody would want a say in is yours, and goes in the design doc/);
  assert.match(asked, /Each \*Open question for dev\* is either settled from the code or asked/);
});

test('AC-6: no design doc while the interview is open', () => {
  assert.match(step3, /\*\*Not while the interview is open\.\*\* Read each story and its Plan record again now: an open escalation \(its own, on one of its question comments, or one a `Held on` names\), /);
  assert.match(step3, /a question comment after its latest `# Interview closed`, or no `# Interview closed` at all goes back to "The developer interview"\. Nothing from here on is written first: no design doc, no `TC-n`, no task, and no project or Plan record beyond what the interview needed\./);
  assert.match(doneWhen, /Every planned story, a new one too, has a `# Interview closed`, posted before its design doc, and no escalation of its interview open\./);
});

test('AC-7: a product question stays a gap for the PO', () => {
  assert.match(interview, /\*\*A product question is not asked here\.\*\* What the user gets, an `AC-n`, a scope call: it stays a product gap for the PO\. Go to step 1, "Gaps → back to the PO", even with a round open, raise nothing more for the interview, and wait as that step says/);
  assert.match(interview, /Nothing can withdraw an open escalation, so the gap comment names any still open: step 0 reads one as shaping unfinished on a type with no shaped step, and they must be answered too/);
  assert.match(interview, /\*\*A story step 1 held gets no interview until it passes\.\*\* Step 1 runs first, so a product gap and an interview question are never in one round: the gap's escalation is for the PO, and this round is for the developer/);
  assert.match(flat(part('What is asked')), /On a type without `shape` there is no PO: decide it with the human by escalation, as step 3 says, in this round, and say in its comment that it is a product decision/);
});

test('the design doc links the escalations rather than restating them', () => {
  assert.match(skill, /\*\*it links their escalations \(`<ref> eN`\) rather than restating them\*\*/);
  assert.doesNotMatch(skill, /tradeoffs, open questions\./);
});

test('a type with no design doc carries the answers in the story and task descriptions', () => {
  assert.match(step3, /each carrying the interview's answers that bind it and citing their `<ref> eN`/);
});

test('floor questions join the first round, and are not raised twice; a QUESTION is not the interview', () => {
  const first = flat(part('The first round'));
  assert.match(first, /\*\*Step 5's floor questions and its repository question go out with this round\*\*, when `product get` and `git remote` show the second will be asked/);
  assert.match(first, /They are not interview questions, and are raised as step 5 says, each comment opening `# Floor question: <refs>`/);
  assert.match(step54, /A question already raised \(a comment opening `# Floor question`, on the story or on the Plan record naming it, with an escalation on it\) is not raised again: read its answer/);
  assert.match(step54, /post the context as a comment, opening `# Floor question: <refs>`/);
  assert.match(step54, /stories one answer would settle together share one comment and one escalation, naming each, on the Plan record/);
  assert.match(step53, /in one round with step 4's floor questions, since neither depends on the other, unless the interview's first round already did/);
  assert.match(interview, /A QUESTION from the divergence review \(step 8\) is not this interview: it comes after the design doc, on comments of its own, and it reopens nothing here/);
});

test('skipping: nothing open is the one way past it, tied to "Does this need planning at all?"', () => {
  const first = flat(part('The first round'));
  assert.match(first, /\*\*Nothing open is the only way past the interview, and size is not one\.\*\* A one-file fix with an obvious test never gets here \("Does this need planning at all\?"\); a story that does get here has its trigger, however few its lines/);
  assert.match(first, /With no decision open, no floor question left to raise and no shared question naming it, post `# Interview closed` saying why, raise nothing, and carry on at step 3/);
  assert.match(skill, /A story this section sends to `run` skips the interview with the rest of this skill; one it sends here is never too small for it/);
});

test('the contract and the harnesses say the interview waits', () => {
  assert.match(read('plugin/PROCESS.md'), /\*\*Then wait for the answer, in every skill that raises\*\*: `run`, `plan-project`, `shape-project`, `sync-repo`, `sdlc-install` and `sdlc-tune`\./);
  assert.doesNotMatch(read('plugin/PROCESS.md'), /Every other skill stops the turn/);
  assert.match(read('plugin/PROCESS.md'), /Before the design doc it interviews the developer in rounds of escalations/);
  assert.match(read('plugin/HARNESS.md'), /`plan-project`'s developer interview starts and reads its waits the same way; re-invoking `plan-project` resumes it\. Every other skill that raises an escalation starts and reads its waits the same way/);
  assert.match(read('scripts/targets.mjs'), /plan-project\\`'s developer interview does not wait either/);
  assert.match(read('targets/agents/skills/sdlc-install/kit/harness/codex.md'), /`plan-project`'s developer interview does not wait either/);
  assert.match(read('docs/targets/README.md'), /`plan-project`'s developer interview uses the same script and follows the same line, and so does every other skill that raises an escalation \(`PROCESS\.md`, "Questions to the human are escalations"\)\. Where a skill stops instead of waiting, nobody is listening, so a question a person asks of the agent on that escalation is handed back to them after 30 minutes\./);
  assert.match(read('targets/agents/HARNESS.md'), /`plan-project`'s developer interview stops the same way/);
});

test('the waiting probe in docs/targets/README.md gives its fake the ref wait-answer matches on', () => {
  assert.match(read('docs/targets/README.md'), /with one escalation, `ref: "PRB-1", number: 1`, whose `answer` is null on the first call/);
  assert.match(read('docs/targets/README.md'), /wait-answer\.mjs --server https:\/\/probe\.test PRB-1 e1/);
});

test('every interview path keeps the escalation shape: 2 to 5 options, the pick first', () => {
  assert.match(interview, /2 to 5 options, your pick first/);
  assert.match(interview, /A decision with more than 5 options is cut to the real ones/);
});

// Where a question lives, and that a story closes only itself.
test('a question lives on one issue: its story, or the Plan record when it binds several', () => {
  assert.match(intro, /\*\*Each question lives on one issue, and each story closes only itself\.\*\*/);
  assert.match(intro, /A question that binds one story goes on that story\. One that binds several goes on their project's Plan record, naming them, and no other story gets a mark/);
  assert.doesNotMatch(raw, /# Interview: on/);
});

test('the Plan record is found from Leeway, and made only when such a question needs it', () => {
  assert.match(intro, /The Plan record's ref ends the project's description \(`project get`: `Plan record: <ref>`\)/);
  assert.match(intro, /or, if a crash left that out, it is the issue titled `Plan record` in `issue list`/);
  assert.match(intro, /With neither and such a question to raise, run step 5\.1 and step 5\.2 now/);
});

test('step 5.2 holds for a record or project made early: nothing created twice, the link added late', () => {
  assert.match(step52, /one comment per nit and per status update, and any interview question that binds several stories/);
  assert.match(step52, /Adopting a project that already has a Plan record \(a row there, or the interview made it\): use that collector, and create nothing, adding a missing row and a missing `Plan record: <ref>` line/);
  assert.match(step52, /\*\*A project or record made before the design doc existed\*\* gets the design doc link and the plan branch's name now, in one more resend of its description, re-read first/);
});

test("in this skill an issue's escalations are its own, read before step 0's tables", () => {
  const sentence = /\*\*In this skill an issue's escalations are only the entries whose `ref` is that issue:\*\* a story's list also carries its sub-issues', with numbers that collide/;
  assert.match(step0, sentence);
  assert.ok(step0.search(sentence) < step0.indexOf('| `shape`, or no step at '), "after the shape row that reads it");
  assert.match(step0, /A sub-issue's open one, on a re-plan, is `run`'s and holds nothing here: name it in the session, and do not wait on it/);
  assert.match(step0, /with a body and no open escalation: /);
  assert.match(step0, /With no body, or an escalation still open: \*\*say shaping is not finished/);
  assert.match(step0, /An open escalation with no answer means do not proceed/);
  assert.match(flat(part('Where it stands, from Leeway alone')), /`comments` and `escalations\[\]`, each issue's own \(step 0\)/);
});

test('a story that does not exist yet is created first, so a question can name it', () => {
  assert.match(intro, /\*\*A story that does not exist yet is created first, so a question can name it\.\*\*/);
  assert.match(intro, /Only a type with a `plan` step and no `shape` gets here, checked in `process get` before anything is created; with `shape` it is a step 1 gap/);
  assert.match(intro, /First look in `project list` and that project's `issue list` for what a crash left/);
  assert.match(intro, /Then step 5\.1, since `issue update` has no project field, and step 5\.3's command, with its body and type and no tasks/);
  assert.match(intro, /Take it through step 0 and interview it like any other: step 5 adopts both/);
  assert.match(intro, /One found only at step 4 or 5 is the same: nothing is written for it until a `# Interview closed` names it/);
  assert.match(step53, /One the work needs and nobody wrote is created with this command before its interview, only for a type with a `plan` step and no `shape`/);
});

// The state machine: every row, in order, then each rule on its own. Each pin reads one row or one part.
const firstCell = (row) => row.split(' | ')[0];

test('resume table: six rows, in this order, the crash check first, the open check before the rest', () => {
  assert.deepEqual(resume.map(firstCell), [
    '| a question comment after its latest `# Interview closed`, if any, with no escalation and no `Held on`',
    '| a question comment on the Plan record, with none on it, no open escalation on it and no `# Interview closed`',
    '| an open escalation: its own, on one of its question comments, or one a `Held on` names',
    '| a question comment after its latest `# Interview closed`, if any',
    '| a `# Interview closed`',
    '| none of these',
  ]);
});

const rowPins = [
  ['crash row: raises on that comment, with no second comment', 0, /a session ended between the two calls: raise it now, with no second comment/],
  ['crash row: not when an answer settled it', 0, /unless an answer settled it, which `# Interview closed` then names/],
  ['crash row: goes on down the table', 0, /Go on down this table/],
  ['shared-only row: a shared question is not its first round', 1, /a shared question is not its first round: its own decisions go out now as "The first round"/],
  ['shared-only row: beside a shared one still open, which does not hold them', 1, /beside any shared one still open, and the next row does not hold them/],
  ['shared-only row: goes on down the table', 1, /Go on down this table/],
  ['open row: waits and raises nothing new', 2, /do not proceed and raise nothing new: wait \(below\)/],
  ['open row: any of the story\'s, not only the interview\'s', 2, /any open escalation of the story, not only the interview's/],
  ['answered row: goes to the next round', 3, /\| read the answers: "The next round" \|$/],
  ['finished row: carries on at step 3, and answers stand on a re-plan', 4, /it is finished: carry on at step 3\. The answers stand on a re-plan/],
  ['finished row: a decision a BLOCKER or a changed AC opens goes out as the next round', 4, /Where a BLOCKER or a changed `AC-n` opens a decision nobody was asked, its question goes out as the next round, naming what opened it/],
  ['not-started row: goes to the first round', 5, /\| it has not started: "The first round" \|$/],
];
for (const [name, row, pattern] of rowPins) test(name, () => assert.match(resume[row] ?? '', pattern));

const exitPins = [
  ['exit 0: reads every story this session plans again', '0', /\| answered \| read every story this session plans again\./],
  ['exit 0: another open is waited on with its own ref and 16 hours', '0', /Another still open: wait on that one, with its `ref` and 16 hours of its own\./],
  ['exit 0: none open goes back to the table', '0', /None: the table above/],
  ['exit 1: a bug in this run stops the turn', '1', /\| the call was wrong, or `<ref>` has no `eN` \| a bug in this run: stop the turn and say so \|/],
  ['exit 2: stops the turn', '2', /\| no answer by the deadline \| stop the turn/],
  ['exit 3: Leeway did not answer stops the turn', '3', /\| Leeway did not answer \| stop the turn and say so; re-invoking resumes \|/],
  ['exit 5: a question is answered and the same escalation waited on again', '5', /\| a question is waiting \| not an answer: answer it and wait again on the same escalation, as `PROCESS\.md`, "Questions to the human are escalations", says\. Nothing else moves \|/],
  ['exit 4: names the login action', '4', /\| the CLI asked for `leeway login` \| stop the turn and name the action, `leeway login --server <server>`; re-invoking resumes \|/],
];
for (const [name, code, pattern] of exitPins) {
  test(name, () => assert.match(exits.find((r) => r.startsWith(`| ${code} |`)) ?? '', pattern));
}

const partPins = [
  ['a question is its own comment, naming its stories', 'Where it stands, from Leeway alone', /A question is \*\*its own top-level comment\*\*, its body opening `# Interview question <n>, round <r>: <refs>`, the stories it binds/],
  ['reads each story and its Plan record, nothing from a session', 'Where it stands, from Leeway alone', /`issue get` on each story, on its Plan record and on any `<ref>` a `Held on` names holds it all: `comments` and `escalations\[\]`, each issue's own \(step 0\)/],
  ['the tie: a question\'s escalation is set on its own comment', 'Where it stands, from Leeway alone', /with its escalation's `--comment` set to that comment's `cN`/],
  ['a comment\'s own escalation is read from comments[].escalation', 'Where it stands, from Leeway alone', /A comment's own escalation is `comments\[\]\.escalation`, `\{number, open\}` or null/],
  ['what a story\'s question comments are, on it or on the Plan record', 'Where it stands, from Leeway alone', /\*\*A story's question comments\*\* are these and any `# Floor question: <refs>`, on it or on the Plan record naming it/],
  ['the end mark is on the story, and "after" goes by createdAt', 'Where it stands, from Leeway alone', /Its interview ends at a comment on it opening `# Interview closed`, and "after" goes by `createdAt`\. The first row that fits decides/],
  ['before asking: the project\'s open escalations, by the call that lists them', 'What is asked', /Then read the project's questions: its open escalations \(`escalation list <KEY> --projectId <id>`\)/],
  ['before asking: the answers on its other stories, one issue get each', 'What is asked', /and the answers on its other stories \(`issue get` on each in `issue list`\)/],
  ['the read\'s size: stories only, their own escalations, no comments', 'What is asked', /That is one call a story, sub-issues skipped, and from each you keep only its own `escalations\[\]` \(step 0\), none of its comments/],
  ['the read has no cap, and says why', 'What is asked', /It has no cap: a story left unread is how one decision gets two answers/],
  ['a sibling\'s open question is held on, not asked again', 'What is asked', /A sibling's open question that binds this story is not asked again: this story's comment holds on it, with `Held on <ref> eN`/],
  ['first round: a question\'s comment, then the raise on the issue it is on', 'The first round', /For each, post its comment, the context and what the code shows, then `escalation raise <ref> --type clarification --json`, `<ref>` the issue it is on/],
  ['first round: the raise is tied by --comment cN', 'The first round', /\(`escalation\.escalation` in the answer is the `eN`\) with `--comment cN`, the fields step 0 names, 2 to 5 options/],
  ['first round: --meanwhile says nothing moves until it closes', 'The first round', /--meanwhile "Nothing: no design doc, criteria or tasks until the interview closes\."/],
  ['first round: held questions are posted, naming what they wait on with its ref', 'The first round', /Post the held ones' comments last, each holding `Held on <ref> eN`, the escalations it waits on, so a re-invoke finds them/],
  ['the wait: says once what it waits on', 'Wait, then read', /Say once what you wait on and until when/],
  ['the wait: as run does, on the first open one, polling nothing', 'Wait, then read', /Then wait on the first open escalation, as `run` does \(`run`, "Wait, then carry on"\), started as `HARNESS\.md`, "Waiting for an answer", says, polling nothing and doing no other work of this plan/],
  ['the wait uses the entry\'s own ref, the story, the Plan record or a sibling', 'Wait, then read', /`<ref>` is the entry's own `ref`, the story, the Plan record or a sibling story/],
  ['only the answer is an answer', 'Wait, then read', /Only the answer is an answer: a comment, a status change or an edited description is not/],
  ['next round: only with every escalation answered, reading each label and note', 'The next round', /With every escalation answered, read each `label` and `note`, then re-read what they touch/],
  ['next round: raises each held question still undecided on its comment', 'The next round', /each held question that is still undecided: its comment's `Held on` escalations all answered, and raised on that comment/],
  ['next round: raises and waits, its round one higher', 'The next round', /Raise it and wait as above, its round one higher/],
  ['next round: a missed first-round decision is asked, not decided alone', 'The next round', /A first-round decision a crash or a miss left out is not decided alone in the design doc: it goes out here, its comment saying it was missed/],
  ['close: one end mark, on the story, only with nothing open or left for it', 'Close it', /With nothing open for the story and nothing left to raise for it, post one comment on it opening `# Interview closed`/],
  ['close: lists the escalations with their ref and what an answer settled, restating no answer', 'Close it', /one line per escalation \(`<ref> eN`, and which question\), and one per question an answer settled and which\. It restates no answer/],
  ['close: a story closes only itself', 'Close it', /Another story of the round gets its own when its own table reaches this/],
  ['close: then step 3', 'Close it', /Then carry on at step 3\./],
];
for (const [name, heading, pattern] of partPins) test(name, () => assert.match(flat(part(heading)), pattern));

test("step 0: every escalation is waited on, the interview's no longer the one exception", () => {
  assert.doesNotMatch(step0, /then you stop the turn/);
  assert.match(step0, /it is a Leeway escalation on the story, and then you wait for its answer; one that stories share goes on their Plan record\./);
  assert.doesNotMatch(step0, /The one exception to stopping/);
  assert.match(step0, /\*\*Every escalation this skill raises is waited on\*\*, as "Wait, then read" \(under "The developer interview"\) says/);
});
