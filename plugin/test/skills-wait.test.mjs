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

// A skill raises when its text calls the raise script or `escalation raise`, or says to raise an escalation.
const RAISES = /escalation raise|<raise>|raise[^.]{0,60}escalation/i;
const WAITERS = ['plan-project', 'run', 'sdlc-install', 'sdlc-tune', 'shape-project', 'sync-repo'];

test('the skills that raise an escalation are the ones this file checks', () => {
  const raising = readdirSync(join(plugin, 'skills'))
    .filter((d) => existsSync(join(plugin, 'skills', d, 'SKILL.md')) && RAISES.test(skill(d)))
    .sort();
  assert.deepEqual(raising, WAITERS, 'a skill raises an escalation that this test does not check for a wait');
});

// Each raise site: the text from the raise to past its wait. The first thing it says about the turn is the wait: a
// turn-ending in any wording ("stop the turn", "end the turn", "stop now", "Stop.", "stops", "**stop**") may follow the
// wait, as what happens on its answer or its exit, and never comes before it.
const WAITS = /\b[Ww]ait (on|for|until|as)\b|\b(is|are) waited on\b|\band wait\b/;
const ENDS = /\b(stop|stops|stopped|stopping)\b|\bend(s)? (the|your|this) turn\b/i;
// Words that name a stop and end no turn after a raise: an option's label, what step 8 stops doing, and install's stop
// before anything is raised, when no issue was named.
const NOT_ENDS = [/\*Stop planning it\*/g, /\bstop re-planning\b/g, /with none, stop and say that an issue is needed/g];
const sites = {
  'shape-project: where the human is asked': ['shape-project', '**Where the human is asked.** This repo', 'With no `.sdlc/leeway.md` there is no binding'],
  'shape-project: a round of questions': ['shape-project', '**Wait, then carry on.** Raise each with', 'The round\'s first comment'],
  'shape-project: a follow-up': ['shape-project', 'An answer that does is a follow-up', 'A later round drops'],
  'shape-project: an edit that contradicts an answer': ['shape-project', 'Where the edit contradicts an answer', 'Otherwise the version'],
  'shape-project: the approval round': ['shape-project', 'Then raise one escalation, *Write this body', 'On *Do not write*'],
  'plan-project: where the human is asked': ['plan-project', '**Where the human is asked.** This repo', 'With no `.sdlc/leeway.md` there is no binding'],
  'plan-project: the product gaps': ['plan-project', 'and raise one escalation, *"`<ref>` has N product gaps', '**Several stories:**'],
  'plan-project: the next round': ['plan-project', 'Raise it and wait as above, its round one higher', 'A first-round decision'],
  'plan-project: the floor questions': ['plan-project', 'and raise that rule\'s question as an escalation', 'On an answer, or on resume, write each answer'],
  'plan-project: the QUESTIONs': ['plan-project', 'Raise the QUESTIONs, when the report has any', '### The QUESTIONs'],
  'plan-project: a held QUESTION': ['plan-project', 'raise a held QUESTION (one the', 'When every one is answered'],
  'plan-project: three RETURNs': ['plan-project', '**raise one escalation on the story**', 'Give two options'],
  'plan-project: a QUESTION open on a re-invoke at the plan gate': ['plan-project', 'with a QUESTION of the latest report open', '| the plan gate | '],
  'sync-repo: the round': ['sync-repo', '2. Raise every one of them in the same turn', 'On every answer'],
  'sync-repo: an open question on resume': ['sync-repo', '**While any question is open', 'So the tree stays clean'],
  'sdlc-install: the interview': ['sdlc-install', 'raise each interview question as an escalation', 'Each is raised with `<raise>`'],
  'sdlc-tune: a confirmation': ['sdlc-tune', 'Raise it with `<raise> --server <server>', 'On its answer'],
};
const extract = (s, lead, until) => {
  let text = from(skill(s), lead, until);
  for (const re of NOT_ENDS) text = text.replace(re, '');
  return text;
};
for (const [name, [s, lead, until]] of Object.entries(sites)) {
  test(`${name}: waits on its escalation before anything ends the turn`, () => {
    const text = extract(s, lead, until);
    const wait = text.search(WAITS);
    const end = text.search(ENDS);
    assert.ok(wait >= 0, `${name} does not wait`);
    assert.ok(end < 0 || wait < end, `${name} ends the turn before it waits: "${text.slice(end, end + 60)}"`);
  });
}

// A raise the sites above do not cover is one of these: raised in a round whose wait a site pins, or not a raise of
// this skill at all. Each names the text that says so.
const inRound = [
  ['plan-project', 'a session ended between the two calls: raise it now', 'Then wait on the round as `run` does: start one background wait per open escalation of the round, all together'],
  ['plan-project', 'then raise it with `<raise>` as step 0 says, `"type": "clarification"`, on `<ref>`', 'Then wait on the round as `run` does: start one background wait per open escalation of the round, all together'],
  ['plan-project', 'Then raise its escalation with `"comment"` set to that QUESTION', 'Wait on every QUESTION\'s escalation at once'],
  ['plan-project', 'three more reports raise a new one on the latest report', 'Wait on it (step 0)'], // the same "Three RETURNs" escalation, raised again
  ['sdlc-install', 'raise the next round, the questions that waited', 'wait on them as `run` does: start one background wait per open escalation of the round, all together'],
  ['sdlc-install', 'raise one escalation per ambiguous mapping', 'wait on them as `run` does: start one background wait per open escalation of the round, all together'],
  ['sdlc-install', 'and raise one escalation on it with `"comment"` its `cN`', 'wait on them as `run` does: start one background wait per open escalation of the round, all together'],
  ['sync-repo', 'then raise an escalation on `<issue>`, `"type": "clarification"`', 'then wait on them as `run` does: start one background wait per open escalation of the round, all together'],
  ['sync-repo', 'None → raise it, with the others', 'then wait on them as `run` does: start one background wait per open escalation of the round, all together'],
  ['sync-repo', 'raise one follow-up escalation for that copy', 'then wait on them as `run` does: start one background wait per open escalation of the round, all together'],
];
const notRaises = [
  ['shape-project', 'and they raise it with the developer'], // the PO raises it, not this skill
  ['sync-repo', 'and never raises it twice'], // says the filing-work: question is not raised again
];
// "Raise" followed by what is raised, in any of the wordings the skills use: "raise it", "raise an escalation",
// "raise a new one", "raise a held QUESTION", "raises its own" and the rest.
const RAISE_AT = /escalation raise|\b[Rr]aises? (it|them|one|each|every|that|this|its|the|an|a|all)\b/g;

// LWY-160.4 c4: the wordings LWY-160.3's c9 widened RAISE_AT for, so narrowing it again goes red.
test('RAISE_AT finds each wording of a raise the skills use, and a word that only looks like one', () => {
  const hits = (text) => [...text.matchAll(RAISE_AT)].length;
  for (const wording of ['raise an escalation', 'raise a new one', 'raises it', 'Raise it', 'raise them', 'raise one escalation', 'raises its own', 'Raise every one of them', 'raise the next round', 'escalation raise']) {
    assert.equal(hits(`then ${wording} on the story`), 1, wording);
  }
  for (const word of ['raised it', 'the raise script', 'a raiser', 'praise it']) assert.equal(hits(`then ${word} on the story`), 0, word);
});

test('every raise in a skill that waits is a site above, in a round a site waits on, or not this skill\'s', () => {
  for (const s of WAITERS.filter((w) => w !== 'run')) {
    const text = skill(s);
    const covered = [];
    for (const [k, lead, until] of Object.values(sites)) {
      if (k !== s) continue;
      const at = text.indexOf(lead);
      covered.push([at, text.indexOf(until, at + lead.length)]);
    }
    for (const [k, raise, wait] of inRound) {
      if (k !== s) continue;
      const at = text.indexOf(raise);
      assert.ok(at >= 0, `${s}: no "${raise}"`);
      assert.ok(text.includes(wait), `${s}: no "${wait}"`);
      assert.match(wait, WAITS, `${s}: "${wait}" is not a wait`);
      covered.push([at, at + raise.length]);
    }
    for (const [k, said] of notRaises) {
      if (k !== s) continue;
      const at = text.indexOf(said);
      assert.ok(at >= 0, `${s}: no "${said}"`);
      covered.push([at, at + said.length]);
    }
    for (const m of text.matchAll(RAISE_AT)) {
      const ok = covered.some(([a, b]) => a <= m.index && m.index < b);
      assert.ok(ok, `${s} raises with no wait checked here: "${text.slice(Math.max(0, m.index - 40), m.index + 80)}"`);
    }
  }
});

// LWY-222.2 (TC-4): the held stories' gap escalations are waited on when they are raised (step 1), so no way plan-project's
// plan ends waits on them last, and "The last wait" is gone. Rewritten from the pins that required the last wait.
const endings = {
  'the plan gate': ['Raise the QUESTIONs, when the report has any', '### The QUESTIONs'],
  'the QUESTIONs applied': ['what makes them applied.', '**The move follows'],
  '`ready` with no plan gate': ['**A type without a plan gate**', '**A type with one**'],
};
for (const [name, [lead, until]] of Object.entries(endings)) {
  test(`plan-project's ending at ${name} does not wait on the held stories' gaps last`, () => {
    const text = extract('plan-project', lead, until);
    assert.doesNotMatch(text, /wait on the held stories' gaps|"The last wait"/);
  });
}

test('a plan with no gate ends after every story is at `ready`, and waits on no held story\'s gap last', () => {
  const text = skill('plan-project');
  assert.match(text, /`issue update <story> --status ready` \(no step\), story by story\./);
  assert.doesNotMatch(text, /Once every story of the plan is at `ready`, and not after each one, wait on the held stories' gaps/);
});

test('"The last wait" is gone, and a held story\'s interview escalations no longer point to it', () => {
  const text = skill('plan-project');
  assert.doesNotMatch(text, /"The last wait"|### The last wait/);
  assert.doesNotMatch(text, /Say which held stories it waits on, and which interview escalations stay open without a wait/);
});

test('plan-project waits on a held story\'s gaps at once, beside the other waits, never last', () => {
  const text = skill('plan-project');
  assert.doesNotMatch(text, /it is waited on last|never in the middle of another story's interview/);
  assert.doesNotMatch(text, /\*\*Before the plan ends, wait on every step 1 gap escalation of this session still open\*\*/);
  assert.match(from(text, '### Gaps → back to the PO', '**Several stories:**'), /\bat once\b[^.]*\b(?:beside|alongside)\b[^.]*\bother waits\b|\b(?:beside|alongside)\b[^.]*\bother waits\b[^.]*\bat once\b/);
});

test('each skill that raises points to run\'s "Wait, then carry on" and the contract, and does not copy the loop', () => {
  for (const s of WAITERS.filter((w) => w !== 'run')) {
    const text = skill(s);
    assert.match(text, /`run`, "Wait, then carry on"/, `${s} does not point to run's "Wait, then carry on"`);
    assert.match(text, /`PROCESS\.md`, "Questions to the human are escalations"/, `${s} does not point to the contract`);
    // sync-repo's list of 0.3.0's allow-list rules names `clarification answer` as a rule to remove, not as a step of the loop.
    const loop = text.replaceAll('`Bash(<cli> --server <server> clarification answer *)`', '');
    assert.doesNotMatch(loop, /clarification answer/, `${s} copies the loop for a question asked of the agent`);
  }
});

// The turn is ended, in any of these words, only where a wait ends without an answer (an exit, or `wait: stop`).
const TURN_ENDS = /stop(s)? the turn|\bend(s)? (the|your|this) turn\b|\bstop(s)? now\b|^Stop\.|\*\*Stop\.\*\*/;
test('a skill that raises stops the turn only where its wait ends without an answer', () => {
  for (const s of WAITERS.filter((w) => w !== 'run')) {
    for (const sentence of skill(s).split(/(?<=\.)\s/)) {
      if (!TURN_ENDS.test(sentence)) continue;
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

// sdlc-install has no resume path, so it says what a re-invoke does rather than borrow run's "re-invoking resumes".
test('sdlc-install says a re-invoke does not resume yet, and asks nothing again while its escalations are open', () => {
  const text = skill('sdlc-install');
  assert.match(text, /\*\*A re-invoke does not resume yet\*\*: this skill has no resume path\. Re-invoked while an escalation of its interview on that issue is open \(`<cli> issue get <ref> --json`, `escalations\[\]`\), it asks nothing again, in the terminal or by escalation, and writes nothing/);
  assert.doesNotMatch(text, /with this skill in place of `run`/, 'install reads run\'s "re-invoking `run` resumes" as its own');
  assert.doesNotMatch(text, /as run's table says/, 'install stops as run\'s table says, which promises a resume');
  assert.doesNotMatch(text, /\bresumes\b/, 'install says a re-invoke resumes');
});

test('a person at the terminal does not stop install or tune from waiting', () => {
  assert.match(skill('sdlc-install'), /Wait even when the person is at the terminal: they answer on the escalation, and a reply typed in the terminal is not an answer\./);
  assert.match(skill('sdlc-tune'), /wait even with the person at the terminal, since only the escalation's answer is one/);
});

test('no answer moves a story out of the shaped step or the plan gate', () => {
  assert.match(skill('shape-project'), /No answer moves the story out of the shaped step: running `plan-project` on it does, and is the approval of the body\./);
  assert.match(skill('plan-project'), /\*\*No answer moves a story out of the shaped step or the plan gate\*\*: this skill makes those moves itself, on the conditions step 0's table and step 8 give\./);
  const questions = skill('plan-project');
  assert.match(questions, /\*\*The move follows `# QUESTIONs applied`, not the answer\.\*\* An answer changes a description or a task, and nothing more, whatever it says, even one that reads as a pass\./);
  assert.match(questions, /That reply is what makes them applied\. Say so\./);
});

test('the QUESTIONs ending no longer waits on the held stories\' gaps, and no sentence says the session never plans a held story again', () => {
  const questions = skill('plan-project');
  assert.doesNotMatch(questions, /what makes them applied\. Say so\. Then wait on the held stories' gaps/);
  assert.doesNotMatch(questions, /this session does not plan the story again/);
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
