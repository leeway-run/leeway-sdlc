// LWY-160.3, TC-3: every skill that raises an escalation waits on it, as run's "Wait, then carry on" does, and stops
// the turn only where the wait ends without an answer. run's own raise sites are pinned in run-waits.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const plugin = join(dirname(fileURLToPath(import.meta.url)), '..');
const flat = (text) => text.replace(/\s+/g, ' ');
const skill = (name) => flat(readFileSync(join(plugin, 'skills', name, 'SKILL.md'), 'utf8'));

// The text from `lead` up to `until`, on one line.
function from(text, lead, until) {
  const at = text.indexOf(lead);
  assert.ok(at >= 0, `no "${lead}"`);
  const end = text.indexOf(until, at + lead.length);
  assert.ok(end >= 0, `no "${until}" after "${lead}"`);
  return text.slice(at, end);
}

// A skill raises when its text calls `escalation raise`, or says to raise an escalation.
const RAISES = /escalation raise|raise[^.]{0,60}escalation/i;
const WAITERS = ['plan-project', 'run', 'sdlc-install', 'sdlc-tune', 'shape-project', 'sync-repo'];

test('the skills that raise an escalation are the ones this file checks', () => {
  const raising = readdirSync(join(plugin, 'skills'))
    .filter((d) => existsSync(join(plugin, 'skills', d, 'SKILL.md')) && RAISES.test(skill(d)))
    .sort();
  assert.deepEqual(raising, WAITERS, 'a skill raises an escalation that this test does not check for a wait');
});

// Each raise site, from the raise to the next thing, says it waits and does not end the turn there.
const WAITS = /\bwait(s|ed)?\b/i;
const ENDS = /stop the turn|\bthen stop\b|\band stop\b|\bstop again\b|\*\*stop\*\*|\*\*Stop\*\*/;
const sites = {
  'shape-project: where the human is asked': ['shape-project', 'question: it is a Leeway escalation on the story', 'Post the context first'],
  'shape-project: a round of questions': ['shape-project', 'Each area is one comment', 'The round\'s first comment'],
  'shape-project: a follow-up': ['shape-project', 'An answer that does is a follow-up', 'A later round drops'],
  'shape-project: an edit that contradicts an answer': ['shape-project', 'Where the edit contradicts an answer', 'Otherwise the version'],
  'shape-project: the approval round': ['shape-project', 'Then raise one escalation, *Write this body', 'On *Do not write*'],
  'plan-project: where the human is asked': ['plan-project', 'it is a Leeway escalation on the story', 'Post the context first'],
  'plan-project: the product gaps': ['plan-project', 'Then set the story back to the PO\'s step', 'The answer has to reach the body'],
  'plan-project: a product question in the interview': ['plan-project', '**A product question is not asked here.**', 'Nothing can withdraw'],
  'plan-project: the floor questions': ['plan-project', 'the rest go out together.', 'On an answer, or on resume, write each answer'],
  'plan-project: the QUESTIONs': ['plan-project', 'Raise the QUESTIONs, when the report has any', '; then **stop**'],
  'plan-project: a held QUESTION': ['plan-project', 'Wait on each QUESTION\'s escalation in turn', 'When every one is answered'],
  'plan-project: three RETURNs': ['plan-project', 'tied to the latest report with `--comment cN`', 'Give two options'],
  'sync-repo: the round': ['sync-repo', '2. Raise every one of them in the same turn', 'On every answer'],
  'sync-repo: an open question on resume': ['sync-repo', '**While any question is open', 'So the tree stays clean'],
  'sdlc-install: the interview': ['sdlc-install', 'raise each interview question as an escalation', 'Raise with `--json`'],
  'sdlc-tune: a confirmation': ['sdlc-tune', 'Raise it with `--json` and **note the id it returns**', 'On its answer'],
};
for (const [name, [s, lead, until]] of Object.entries(sites)) {
  test(`${name}: waits on its escalation, and does not end the turn there`, () => {
    const text = from(skill(s), lead, until);
    assert.match(text, WAITS, `${name} does not wait`);
    assert.doesNotMatch(text, ENDS, `${name} still ends the turn`);
  });
}

test('each skill that raises points to run\'s "Wait, then carry on" and the contract, and does not copy the loop', () => {
  for (const s of WAITERS.filter((w) => w !== 'run')) {
    const text = skill(s);
    assert.match(text, /`run`, "Wait, then carry on"/, `${s} does not point to run's "Wait, then carry on"`);
    assert.match(text, /`PROCESS\.md`, "Questions to the human are escalations"/, `${s} does not point to the contract`);
    assert.doesNotMatch(text, /clarification answer/, `${s} copies the loop for a question asked of the agent`);
  }
});

// "stop the turn" is said in these skills only where a wait ends without an answer (an exit, or `wait: stop`).
test('a skill that raises stops the turn only where its wait ends without an answer', () => {
  for (const s of WAITERS.filter((w) => w !== 'run')) {
    for (const sentence of skill(s).split(/(?<=\.)\s/)) {
      if (!/stop the turn/.test(sentence)) continue;
      assert.match(sentence, /exit|wait: stop|deadline|leeway login|Leeway did not answer|bug in this run/, `${s}: "${sentence}"`);
    }
  }
});

test('each skill says what it does on an answer', () => {
  assert.match(skill('shape-project'), /\*\*On every answer of the round, carry on as a re-invoke would\*\*, writing nothing twice: step 1 reads the answers, a follow-up goes out as step 3 says and is waited on the same way, and with none, steps 4 and 5 propose and write the body and set the shaped step/);
  assert.match(skill('plan-project'), /\*\*On an answer, and on resume\*\*, read the answers with `issue get` \(`escalations\[\]\.answer`\) and the story's step and comments, and carry on from the first thing not done, writing nothing twice/);
  assert.match(skill('sync-repo'), /On every answer, carry on as "On resume" says, writing nothing twice\./);
  assert.match(skill('sdlc-install'), /\*\*On every answer, carry on as the interview's order says\*\*: raise the next round, the questions that waited on the answers now in \("Rounds", below\), and once the answers a step needs are all in, take that step/);
  assert.match(skill('sdlc-tune'), /On its answer, or on resume, read `<cli> issue get <ref> --json`/);
  assert.match(skill('sdlc-tune'), /Write only when it is the yes option, and go on from the step that asked\./);
});

test('a person at the terminal does not stop install or tune from waiting', () => {
  assert.match(skill('sdlc-install'), /Wait even when the person is at the terminal: they answer on the escalation, and a reply typed in the terminal is not an answer\./);
  assert.match(skill('sdlc-tune'), /wait even with the person at the terminal, since only the escalation's answer is one/);
});

test('no answer moves a story out of the shaped step or the plan gate', () => {
  assert.match(skill('shape-project'), /No answer moves the story out of the shaped step: that move is the PO's\./);
  assert.match(skill('plan-project'), /\*\*No answer moves a story out of the shaped step or the plan gate\*\*: those moves are a person's \(step 7\)\./);
  const questions = skill('plan-project');
  assert.match(questions, /\*\*Applying a QUESTION's answer is not the gate decision\.\*\* It changes a description or a task and posts `# QUESTIONs applied`, and it never moves the story, whatever the answer says, even one that reads as a pass\./);
  assert.match(questions, /Say so, and stop: move nothing, so the story stays where it was, at the plan gate or at `ready`\./);
  assert.match(questions, /So whatever the answer, this session does not plan the story again: it says the answer in the session and that the story waits at `shape` for the PO, and stops\./);
});

// Where an agent cannot wait (`wait: stop`), the skill stops, and a person's question to the agent goes unheard.
test('each agent target that does not wait says a question asked of the agent is handed back after 30 minutes', () => {
  const root = join(plugin, '..');
  const said = /a question a person asks of the agent on (such an|that|its) escalation is handed back to them after 30 minutes/;
  assert.match(flat(readFileSync(join(root, 'docs', 'targets', 'README.md'), 'utf8')), said, 'docs/targets/README.md');
  const pages = readdirSync(join(root, 'docs', 'targets')).filter((f) => f.endsWith('.md') && !['README.md', 'TEMPLATE.md'].includes(f));
  const kit = join(root, 'targets', 'agents', 'skills', 'sdlc-install', 'kit', 'harness');
  let stops = 0;
  for (const f of pages) {
    const page = readFileSync(join(root, 'docs', 'targets', f), 'utf8');
    if (!/^wait: stop$/m.test(page)) continue;
    stops++;
    assert.match(flat(page), said, `docs/targets/${f}`);
    assert.match(flat(page), /a run here stops after an escalation, and so does every other skill that raises one/, `docs/targets/${f}`);
    const harness = flat(readFileSync(join(kit, f), 'utf8'));
    assert.match(harness, /Nor does any other skill that raises one \(`PROCESS\.md`, "Questions to the human are escalations"\): each stops the turn the same way/, `kit/harness/${f}`);
    assert.match(harness, said, `kit/harness/${f}`);
  }
  assert.ok(stops > 0, 'no target says wait: stop');
  assert.match(flat(readFileSync(join(root, 'targets', 'agents', 'HARNESS.md'), 'utf8')), said, 'targets/agents/HARNESS.md');
});
