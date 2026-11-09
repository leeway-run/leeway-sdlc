import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const plugin = join(dirname(fileURLToPath(import.meta.url)), '..');
const flat = (text) => text.replace(/\s+/g, ' ');
const read = (path) => flat(readFileSync(join(plugin, path), 'utf8'));
const skill = (name) => read(`skills/${name}/SKILL.md`);
const SECTION = '"Questions to the human are escalations"';

test('PROCESS.md states the three round rules under "Questions to the human are escalations"', () => {
  const contract = readFileSync(join(plugin, 'PROCESS.md'), 'utf8');
  const start = contract.indexOf('## Questions to the human are escalations');
  assert.ok(start >= 0, 'no section');
  const section = flat(contract.slice(start, contract.indexOf('\n## ', start + 1)));
  assert.match(section, /\*\*Check the round before raising it\.\*\* Would one answer settle or change another question\? Merge them into one, or hold the dependent one for the next round\./);
  assert.match(section, /\*\*Independent questions go out together\.\*\* Do not ration them: the first round covers as much ground as it can, and later rounds are follow-ups only\./);
  assert.match(section, /\*\*A later round drops what an answer settled\.\*\* It is not asked again, and it is not raised for confirmation\./);
});

test('every skill that raises escalations points at the rules and restates the check', () => {
  for (const name of ['shape-project', 'plan-project', 'run', 'sdlc-install', 'sdlc-tune', 'sync-repo']) {
    const text = skill(name);
    assert.ok(text.includes(`\`PROCESS.md\`, ${SECTION}`), `${name} does not cite the section`);
    assert.match(text, /[Rr]ound/, name);
    assert.match(text, /later round drops what an answer settled|A question an answer settled is dropped/, `${name} drops nothing`);
  }
});

test('shape-project checks the round and does not ration it', () => {
  const text = skill('shape-project');
  assert.doesNotMatch(text, /one area at a time/);
  assert.match(text, /\*\*Check the round before raising it\*\* \(`PROCESS\.md`, "Questions to the human are escalations"\): where one answer would settle or change another question, merge them into one, or hold the dependent one for the next round\./);
  assert.match(text, /Every other question goes out now, together/);
});

test('plan-project merges floor questions one answer settles, and sends the rest together', () => {
  const text = skill('plan-project');
  assert.match(text, /\*\*All of it is one round:\*\* stories one answer would settle together share one comment and one escalation/);
  assert.match(text, /On an answer, or on resume, write each answer into every task of each story it names/);
  assert.match(text, /create no tasks for a story whose question is open or held\. A held question goes out once the answer it waits on is in, unless that answer settled it, and is waited on the same way/);
  assert.match(text, /ask once by escalation, in one round with step 4's floor questions/);
});

test('plan-project merges a report\'s dependent QUESTIONs, and a held one keeps the story through the applied reply', () => {
  const text = skill('plan-project');
  assert.match(text, /QUESTIONs where one answer would settle or change another are merged into one, under the lowest number/);
  assert.doesNotMatch(text, /merged and never held/);
  assert.match(text, /Where the merge would need more than 5 options, hold the dependent QUESTION for the next round instead, and withhold the `# QUESTIONs applied` reply until it is answered or an answer settled it: `run` counts only the escalations on these comments, so a QUESTION not yet raised holds the story through that reply alone\./);
  assert.match(text, /On an answer, or on resume, raise a held QUESTION \(one the report has with no comment yet\), unless an answer settled it, and wait on it the same way\. When every one is answered/);
  assert.match(text, /Every other QUESTION goes out now, together\./);
  assert.match(text, /and one line per held QUESTION an answer settled\. That reply is what makes them applied/);
  assert.match(text, /escalation on it, or held for the next round as "The QUESTIONs" says, and the story waits/);
});

test('PROCESS.md says a QUESTION can be held, and sends the reader to plan-project', () => {
  assert.match(read('PROCESS.md'), /A QUESTION held for the next round goes out then, or never where an answer settled it \(`plan-project`, "The QUESTIONs"\)\./);
});

test('run raises independent questions together and does not hide the friction proposal behind a wait', () => {
  const text = skill('run');
  assert.match(text, /\*\*Check the round before raising more than one\*\*/);
  assert.match(text, /Independent ones are raised together, not rationed behind a wait, and waited on one after another/);
  assert.match(text, /A brief with a second block raises it in the same round/);
  assert.match(text, /A verdict with more than one `Escalates:` block raises them all in this round/);
  assert.match(text, /\*\*Debt proposals from one verdict are one round\*\*/);
  assert.match(text, /Step 6's friction proposal depends on no answer here, so where there is a wait to do, do step 6's collecting and raise its proposal first/);
});

test('a stop or a resume in run carries every escalation of the round, not one', () => {
  const text = skill('run');
  assert.doesNotMatch(text, /stop's one escalation/);
  assert.match(text, /\*\*Work held on a round carries on only when every escalation of the round is answered, with all the answers reaching it\*\*/);
  assert.match(text, /read each escalation the brief raised \(`escalations\[\]\.answer`\)\. One still open and no answer ended the work: wait on it, and start no round\. All answered:/);
  assert.match(text, /run the next round with all the answers pasted into the prompt/);
  assert.match(text, /PASS or FAIL handling until every one is answered/);
  assert.match(text, /a second block on one finding gets a comment of its own/);
  assert.match(text, /one `# Run status` comment on the story names each of the stop's escalations/);
  assert.match(text, /Every escalation it names must be answered, or the change it asked for recorded\. One open and that change not recorded/);
  assert.match(text, /Each stop ends in \*\*one escalation\*\*, or in one per independent question where the sub-issue run raised a round of them/);
  assert.match(text, /Where the sub-issue run raised it or them, add each id to the status comment/);
  assert.match(text, /with the comment's `cN` and each escalation id\./);
  assert.match(text, /7\. \*\*Wait on each of the stop's escalations\*\*/);
  assert.match(text, /Two escalations are still one action/);
  assert.match(text, /through one status comment and its escalations\./);
});

test('an answer that ends the work in run says the other escalation stays open', () => {
  assert.match(skill('run'), /\*\*An answer that ends the work\*\* \(for example "Cancel it"\) is followed: stop there and say so\. Say too that any other escalation of the round stays open, because nothing can withdraw it, and must be answered before a re-invoke\./);
});

test('the brief and verdict templates can carry two independent questions, and merge dependent ones', () => {
  assert.match(read('skills/run/templates/BRIEF.md'), /merge them into this one block; where neither would, write a second `## Question` block, so both go out in one round/);
  assert.match(read('skills/run/templates/VERDICT.md'), /One block per question that depends on no other; where one answer would settle or change another, merge them\./);
});

test('sdlc-install raises the interview in rounds, each waiting only on what it reads', () => {
  const text = skill('sdlc-install');
  const start = text.indexOf('- **Rounds**');
  assert.ok(start >= 0, 'no Rounds bullet');
  const rounds = text.slice(start, text.indexOf('Anywhere else,', start));
  assert.match(text, /and wait until the round is answered/);
  assert.doesNotMatch(text, /stop the turn until the round is answered/);
  assert.match(rounds, /every question not yet answered that waits on no open answer, raised together, not rationed/);
  assert.ok(rounds.includes('What waits: questions 2 and 12 on question 1 (the product they read); question 10 on which agent this is, where that is asked (it names its instructions file); question 13 on 10 (a block handed over to paste is not there to replace what question 13 removes); question 3 on 2; question 4 on 3 (the types kept); question 5 on 4 (a `build` step removed or added changes its list); questions 14 and 15 on 2 to 5, or on 2 alone at (d); question 16 on the process read back;'), 'the wait list changed');
  assert.match(rounds, /Everything else goes in the first round/);
  assert.match(rounds, /on \(d\), questions 3 to 5 are never raised/);
});

test('sdlc-install\'s wait list has question 16 alone: the guard question has no second offer to wait on 16', () => {
  const text = skill('sdlc-install');
  const rounds = text.slice(text.indexOf('- **Rounds**'));
  assert.ok(rounds.includes('What waits: questions 2 and 12 on question 1 (the product they read); question 10 on which agent this is, where that is asked (it names its instructions file); question 13 on 10 (a block handed over to paste is not there to replace what question 13 removes); question 3 on 2; question 4 on 3 (the types kept); question 5 on 4 (a `build` step removed or added changes its list); questions 14 and 15 on 2 to 5, or on 2 alone at (d); question 16 on the process read back; step 6\'s plan on all of them.'), 'the wait list is not the one with question 16 alone');
});

test('sdlc-tune holds a request behind the new flow only when that answer changes it', () => {
  const text = skill('sdlc-tune');
  assert.match(text, /that order holds only for a request on a type the new flow changes/);
  assert.match(text, /A request on any other type depends on no open answer: its question goes out in the same round/);
  assert.match(text, /each with its own noted id/);
  assert.match(text, /each yes is written in turn, from a fresh Step 1 read\./);
  assert.match(text, /A yes the fresh read already carries is not written again; one it does not carry is\./);
  assert.match(text, /\*\*retry the write once, rebuilt from a fresh Step 1 read\*\* \(a new `before\.json` and `after\.json`/);
});

test('sync-repo holds only the contract block behind the filing-work question', () => {
  const text = skill('sync-repo');
  assert.doesNotMatch(text, /the one question raised before the others/);
  assert.doesNotMatch(text, /None → raise it, then stop the turn/);
  assert.match(text, /Open → leave it open and go on\. None → raise it, with the others\./);
  assert.match(text, /Only the contract block waits on this answer/);
  assert.match(text, /Every other copy and step 1's other offers depend on no answer here, so they are compared and go out in the same round/);
  assert.match(text, /the only question held for a later round is the contract block's/);
});

test('sync-repo waits on any open question, filing-work included, and writes nothing until none is', () => {
  const text = skill('sync-repo');
  assert.match(text, /\*\*While any question is open, the `filing-work:` question included, write nothing, in the repo or to the process, wait on it \(above\), and do not go on to step 3's writes or to step 4\.\*\*/);
  assert.match(text, /An open `filing-work:` question is waited on like any other open question \("On resume"\), even with every copy answered: step 4 never runs on it/);
  assert.match(text, /An answered one is acted on in step 3, once no question remains open\./);
  assert.match(text, /The latest answered one for a copy is its answer\./);
  assert.match(text, /raise one follow-up escalation for that copy, before anything is written/);
});
