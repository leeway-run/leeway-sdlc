import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const plugin = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(plugin, path), 'utf8').replace(/\r\n/g, '\n');
const skills = readdirSync(join(plugin, 'skills')).map((name) => [name, read(`skills/${name}/SKILL.md`)]);
const contract = read('PROCESS.md');

// A table row whose first cell is the shaped step or the plan gate names the source of every sentence in it.
const ROW_SOURCE = /^\| the (?:shaped step|plan gate)(?:, [^|]*)? \|/;
const sentences = (flat) => flat.split(/(?<=[.;!?]\**)\s+(?=[A-Z*`(_])|; | \| /);

// Sentences; in a row whose first cell names the source, each sentence carries that cell.
function units(text) {
  const out = [];
  for (const block of text.split(/\n\s*\n|\n(?=\s*\|)|\n(?=\s*(?:\d+\.|-) )/)) {
    const flat = block.replace(/\s+/g, ' ').trim();
    const source = flat.match(ROW_SOURCE);
    if (source) out.push(...sentences(flat.slice(source[0].length).trim()).map((s) => `${source[0]} ${s}`));
    else out.push(...sentences(flat));
  }
  return out;
}

const WRITE = /--(?:step|status) (?!null\b)[<`a-z]/;
const SOURCE =
  /\b(?:from|out of|leaves?|left|leaving|at|on|in|past|pass(?:es)?) (?:(?:the|its|a) (?:shaped step|plan gate|gate)\b|`(?:shaped|gate)`)|\bshaped story\b/i;
// Only a clause that says the person did ask: "until the person asks" or "the person has not asked" is not one.
const ASKED = /\b(?:because|when|if|once|after|as|since|move|transition) (?:the|a) person ask(?:s|ed)\b/i;
const REFUSE =
  /\b(?:may not|cannot|can't|is not allowed to|isn't allowed to|not permitted to|not able to|unable to|no permission)\b|\bonly (?:the|a) person can\b/i;
const MOVE = /\b(?:mov(?:e|es|ed|ing)|drag(?:s|ged|ging)?)\b/;

const writes = (text) => units(text).filter((u) => WRITE.test(u));
const outOfGate = (u) => ROW_SOURCE.test(u) || SOURCE.test(u);
// The two moves plan-project makes on its own (LWY-200.1), each only on its condition and with its record: out of the shaped
// step with no shaping escalation open, and to `ready` on a PASS, or on PASS WITH DECISIONS once `# QUESTIONs applied` is posted.
const AUTOMATIC = [
  /^\| the shaped step, with no shaping escalation open \| .*--step <the plan step's id>.*`# Planning started`/,
  /^On a PASS,\s.*--status ready.*`# Moved to ready`/,
  /^On PASS WITH DECISIONS, once every QUESTION is answered and the `# QUESTIONs applied` reply is posted\b.*--status ready.*`# Moved to ready`/,
];
const automatic = (u) => AUTOMATIC.some((re) => re.test(u));
const unasked = (text) => writes(text).filter((u) => outOfGate(u) && !ASKED.test(u) && !automatic(u));
const refusals = (text) => units(text).filter((u) => REFUSE.test(u) && MOVE.test(u));

// A move whose source is named in an earlier sentence is invisible to `unasked`; pinning the count of these writes
// per skill makes a new one fail here until someone has read it.
const TARGETS = { plan: /--step (?:<the plan step|plan\b)/, ready: /--status ready\b/, build: /--step build\b/ };
const tally = (text) => {
  const all = writes(text);
  return Object.fromEntries(Object.entries(TARGETS).map(([k, re]) => [k, all.filter((u) => re.test(u)).length]));
};
const TALLY = {
  'plan-project': { plan: 3, ready: 5, build: 0 },
  run: { plan: 0, ready: 0, build: 3 },
};
const NONE = { plan: 0, ready: 0, build: 0 };

test('no skill moves a story out of the shaped step or the plan gate unless the person asked, or it is one of plan-project\'s two own moves', () => {
  for (const [name, text] of skills) assert.deepEqual(unasked(text), [], name);
});

test('no skill says the agent may not make a move', () => {
  for (const [name, text] of skills) assert.deepEqual(refusals(text), [], name);
});

test('each skill has the writes to the plan step, ready and build it had when they were last read', () => {
  for (const [name, text] of skills)
    assert.deepEqual(tally(text), TALLY[name] ?? NONE, `${name}: read the new write; if it moves a story out of the shaped step or the plan gate, it must say the person asked. Then update TALLY`);
});

test('the scan reads the existing writes and tells them apart from a move out of those steps', () => {
  const all = skills.flatMap(([, text]) => writes(text));
  const has = (re) => all.filter((u) => re.test(u));
  for (const re of [/--step <the plan step's id>/, /--status ready/, /--step build/, /--step <the shaped step's id>/, /--status done/]) {
    assert.ok(has(re).length > 0, `no write matching ${re}`);
    assert.deepEqual(has(re).filter((u) => outOfGate(u) && !automatic(u)), [], String(re));
  }
});

test('plan-project\'s two own moves are let through only on their condition and with their record', () => {
  const plan = skills.find(([name]) => name === 'plan-project')[1];
  const own = writes(plan).filter(automatic);
  assert.equal(own.length, 3, own.join('\n'));
  const planted = [
    '| the shaped step, with a shaping escalation open | `<cli> --as <alias>/planner issue update <story> --step <the plan step\'s id>`, say so in the session, and post a comment opening `# Planning started` |',
    '| the shaped step, with no shaping escalation open | `<cli> --as <alias>/planner issue update <story> --step <the plan step\'s id>`, then carry on |',
    'On a PASS at the plan gate, move the story to `ready` with `<cli> --as <alias>/planner issue update <story> --status ready` (no step).',
    'On a RETURN at the plan gate, move the story to `ready` with `<cli> --as <alias>/planner issue update <story> --status ready` and a comment opening `# Moved to ready`.',
    'On PASS WITH DECISIONS, move the story out of the plan gate with `<cli> --as <alias>/planner issue update <story> --status ready` and a comment opening `# Moved to ready`.',
  ];
  for (const text of planted) assert.equal(unasked(`Intro.\n\n${text}\n`).length, 1, text);
  for (const text of own) assert.deepEqual(unasked(`Intro.\n\n${text}\n`), [], text);
});

test('a planted unprompted move is caught, and the same move the person asked for is not', () => {
  const sentence = 'On a story at the shaped step, run `<cli> issue update <story> --step <the plan step\'s id>` and carry on.';
  const row = '| the plan gate | `<cli> issue update <story> --status ready`, then carry on |';
  const leave = 'Then move it out of the plan gate: `issue update <story> --step build`.';
  const elsewhere = '| the shaped step | `issue update <story> --step <the plan step\'s id>`, then carry on. Do not move it unless the person asks |';
  const reviewed = [
    'When the story sits in the shaped step, set <cli> --as <alias>/planner issue update <story> --step <the plan step\'s id> and carry on.',
    'For a shaped story, <cli> --as <alias>/planner issue update <story> --step <the plan step\'s id>, then carry on.',
    'With the story at the gate and no BLOCKER, <cli> --as <alias>/agent issue update <story> --status ready.',
    'A story at its plan gate with no QUESTION open: <cli> --as <alias>/agent issue update <story> --status ready.',
    'On a PASS, pass the gate yourself: <cli> --as <alias>/agent issue update <story> --status ready.',
    'At the plan gate, with a PASS: <cli> --as <alias>/agent issue update <story> --status ready.',
    '- At the plan gate, with a PASS: <cli> --as <alias>/agent issue update <story> --status ready.',
    'Do not wait until the person asks: move it from the plan gate with <cli> --as <alias>/agent issue update <story> --status ready.',
    'Even if the person has not asked, move it out of the plan gate: `issue update <story> --status ready`.',
  ];
  for (const planted of [sentence, row, leave, elsewhere, ...reviewed])
    assert.equal(unasked(`Intro.\n\n${planted}\n`).length, 1, planted);
  const asked = 'Because the person asked, move the story from the shaped step: `issue update <story> --step <the plan step\'s id>`.';
  assert.deepEqual(unasked(asked), []);
  assert.deepEqual(unasked('For a type without one, the story is `--status ready`.'), []);
  assert.deepEqual(unasked('When the person asks, move it out of the plan gate: `issue update <story> --status ready`.'), []);
});

test('a planted move whose source is a sentence earlier changes the tally', () => {
  const plan = skills.find(([name]) => name === 'plan-project')[1];
  const planted = 'If the story is at the plan gate and the report is a PASS, carry on. Run <cli> --as <alias>/agent issue update <story> --status ready.';
  assert.deepEqual(unasked(`Intro.\n\n${planted}\n`), []);
  assert.notDeepEqual(tally(`${plan}\n${planted}\n`), TALLY['plan-project']);
});

test('a sentence sending the person to the UI because the agent may not move it is caught', () => {
  for (const planted of [
    'Tell the person to move it to `ready` in the UI: the agent may not make that move.',
    'You cannot move a story out of the plan gate, so ask the person to do it by hand.',
    'The agent is not able to move it out of the gate; ask the person to do it in the UI.',
    'The agent is unable to move it to `ready`, so the person does it in the UI.',
    'Only the person can move a story to ready, in the UI; the agent must not.',
    'Ask the person to drag the story to ready in the UI: the agent has no permission to.',
  ])
    assert.equal(refusals(`Intro.\n\n${planted}\n`).length, 1, planted);
});

test('PROCESS.md says any skill makes the move the person asks for, and only plan-project moves a shaped or gated story on its own', () => {
  const cast = contract.split(/\n(?=## )/).find((s) => s.startsWith('## The cast')).replace(/\s+/g, ' ');
  assert.match(cast, /\*\*A move the person asks for\.\*\* Any skill makes any move the person asks for in the session/);
  assert.match(cast, /`issue update <ref> --step <id>` or `--status <status>`, as `<alias>\/agent`, and then says which move it made, from where to where, and what it leaves unmet \(an open or unapplied QUESTION, no coverage report, no tasks\)\./);
  assert.doesNotMatch(cast, /What no skill does is move a story out of the shaped step or the plan gate on its own initiative/);
  assert.match(cast, /Only `plan-project` moves a story out of the shaped step or the plan gate on its own, on the conditions "Before the plan: shaping" and "The plan gate" give, and no other skill does: any other skill moves it only when a person asks\./);
  assert.match(contract, /\| `manual` \| .* It never does the work, and it moves the issue past it only when a person asks \("The cast"\) \|/);
  const run = skills.find(([name]) => name === 'run')[1].replace(/\s+/g, ' ');
  assert.match(run, /the plugin never does a manual step and moves the story past it only when the person asks \(`PROCESS\.md`, "The cast"\)\./);
  assert.match(contract, /\| status \| always `issue update --step` or `--status`; never by iteration or escalation; a move the person asks for as `<alias>\/agent`, named in the session \("The cast"\) \|/);
});

test('after a move the person asked for, plan-project restarts at step 0 only from the plan step, and otherwise stops', () => {
  const plan = skills.find(([name]) => name === 'plan-project')[1].replace(/\s+/g, ' ');
  assert.match(plan, /as `<alias>\/agent` and say which move you made \(`PROCESS\.md`, "The cast"\)\. When that move put the story at the plan step, read the story again and start again at step 0\. After any other move, say where the story now is and stop: make no further move of your own\./);
});

test('step 8 says a RETURN, and PASS WITH DECISIONS with a QUESTION open or unapplied, is "not moved", in those words', () => {
  const step8 = skills.find(([name]) => name === 'plan-project')[1].split(/\n(?=## )/).find((s) => s.startsWith('## 8. ')).replace(/\s+/g, ' ');
  assert.match(step8, /A RETURN is not moved to `ready`: the story stays at the plan gate/);
  assert.match(step8, /with a QUESTION still open, the story is not moved: it stays at the plan gate while it waits/);
  assert.match(step8, /no `# QUESTIONs applied` reply, the story is not moved: it stays at the plan gate until the reply is posted/);
});

test('the install question says plan-project moves a shaped story and a PASS, and only a RETURN or an open QUESTION waits', () => {
  const install = read('skills/sdlc-install/SKILL.md').replace(/\s+/g, ' ');
  assert.doesNotMatch(install, /waits at shaped and at planned for a person to move it on/);
  assert.match(install, /running plan-project on a shaped story moves it to planning, and a PASS moves it to ready; a RETURN or an open QUESTION waits at planned for a person/);
});
