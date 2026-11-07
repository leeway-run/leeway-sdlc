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
  assert.match(interview, /A question's comment holding `Held on eN` has not been raised yet/);
  assert.match(interview, /node <plugin-files>\/scripts\/wait-answer\.mjs --server <server> <story> <eN> -- <cli>/);
  assert.match(interview, /\| 2 \| no answer by the deadline \| stop the turn, naming the escalations and the story: they stay, and re-invoking `plan-project` resumes/);
  assert.match(interview, /Where `HARNESS\.md` says `wait: stop`, skip the wait and act at once as for exit 2/);
  assert.match(interview, /a re-invoke with one still open waits on it again, with no second comment or escalation/);
  assert.match(interview, /a session ended between the two calls: raise it now, with no second comment/);
});

test('AC-4: a partly answered round stays open, and an answer settling an open question does not close it', () => {
  assert.match(interview, /\*\*A partly answered round is still open:\*\* one answer of two starts nothing/);
  assert.match(interview, /nothing can withdraw an escalation, and you do not answer one yourself/);
});

test('AC-5: nothing the code or an earlier answer settles is asked', () => {
  assert.match(interview, /Nothing the code, the docs, the body, a comment or an earlier answer settles is asked/);
  assert.match(interview, /Read the code first \(step 2\)/);
});

test('AC-6: no design doc while an interview escalation is open', () => {
  assert.match(skill, /\*\*Not while the interview is open\.\*\* Read the story again now: an open escalation, a question comment after the latest `# Interview closed`, or no `# Interview closed` at all goes back to "The developer interview"\. Nothing from here on is written first: no design doc, no `TC-n`, no project and no task\./);
  assert.match(interview, /\| an open escalation \| do not proceed and raise nothing new: wait/);
  assert.match(skill, /Every planned story has a `# Interview closed`, posted before its design doc, and no escalation of its interview open\./);
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
  assert.match(read('plugin/PROCESS.md'), /`plan-project`'s developer interview waits the same way, and stops where its wait ends without an answer/);
  assert.match(read('plugin/PROCESS.md'), /Before the design doc it interviews the developer in rounds of escalations/);
  assert.match(read('plugin/HARNESS.md'), /`plan-project`'s developer interview starts and reads its waits the same way; re-invoking `plan-project` resumes it/);
  assert.match(read('scripts/targets.mjs'), /plan-project\\`'s developer interview does not wait either/);
  assert.match(read('targets/agents/skills/sdlc-install/kit/harness/codex.md'), /`plan-project`'s developer interview does not wait either/);
  assert.match(read('targets/agents/HARNESS.md'), /`plan-project`'s developer interview stops the same way/);
});

test('every interview path keeps the escalation shape: 2 to 5 options, the recommended first', () => {
  assert.match(interview, /2 to 5 options, the recommended one first/);
  assert.match(interview, /A decision with more than 5 options is cut to the real ones/);
});
