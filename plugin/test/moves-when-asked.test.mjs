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
const ROW_SOURCE = /^\| the (?:shaped step|plan gate) \|/;
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
const SOURCE = /\b(?:from|out of|leaves?|left|leaving|at|on) (?:the (?:shaped step|plan gate)|`(?:shaped|gate)`)/i;
const ASKED = /\b(?:the|a) person ask(?:s|ed)\b/;
const REFUSE = /\b(?:may not|cannot|can't|is not allowed to|isn't allowed to|not permitted to)\b/;
const MOVE = /\bmov(?:e|es|ed|ing)\b/;

const writes = (text) => units(text).filter((u) => WRITE.test(u));
const outOfGate = (u) => ROW_SOURCE.test(u) || SOURCE.test(u);
const unasked = (text) => writes(text).filter((u) => outOfGate(u) && !ASKED.test(u));
const refusals = (text) => units(text).filter((u) => REFUSE.test(u) && MOVE.test(u));

test('no skill moves a story out of the shaped step or the plan gate unless the person asked', () => {
  for (const [name, text] of skills) assert.deepEqual(unasked(text), [], name);
});

test('no skill says the agent may not make a move', () => {
  for (const [name, text] of skills) assert.deepEqual(refusals(text), [], name);
});

test('the scan reads the existing writes and tells them apart from a move out of those steps', () => {
  const all = skills.flatMap(([, text]) => writes(text));
  const has = (re) => all.filter((u) => re.test(u));
  for (const re of [/--step <the plan step's id>/, /--status ready/, /--step build/, /--step <the shaped step's id>/, /--status done/]) {
    assert.ok(has(re).length > 0, `no write matching ${re}`);
    assert.deepEqual(has(re).filter(outOfGate), [], String(re));
  }
});

test('a planted unprompted move is caught, and the same move the person asked for is not', () => {
  const sentence = 'On a story at the shaped step, run `<cli> issue update <story> --step <the plan step\'s id>` and carry on.';
  const row = '| the plan gate | `<cli> issue update <story> --status ready`, then carry on |';
  const leave = 'Then move it out of the plan gate: `issue update <story> --step build`.';
  const elsewhere = '| the shaped step | `issue update <story> --step <the plan step\'s id>`, then carry on. Do not move it unless the person asks |';
  for (const planted of [sentence, row, leave, elsewhere]) assert.equal(unasked(`Intro.\n\n${planted}\n`).length, 1, planted);
  const asked = 'Because the person asked, move the story from the shaped step: `issue update <story> --step <the plan step\'s id>`.';
  assert.deepEqual(unasked(asked), []);
  assert.deepEqual(unasked('For a type without one, the story is `--status ready`.'), []);
});

test('a sentence sending the person to the UI because the agent may not move it is caught', () => {
  for (const planted of [
    'Tell the person to move it to `ready` in the UI: the agent may not make that move.',
    'You cannot move a story out of the plan gate, so ask the person to do it by hand.',
  ])
    assert.equal(refusals(`Intro.\n\n${planted}\n`).length, 1, planted);
});

test('PROCESS.md says any skill makes the move the person asks for, and none moves a shaped or gated story on its own', () => {
  const cast = contract.split(/\n(?=## )/).find((s) => s.startsWith('## The cast')).replace(/\s+/g, ' ');
  assert.match(cast, /\*\*A move the person asks for\.\*\* Any skill makes any move the person asks for in the session/);
  assert.match(cast, /`issue update <ref> --step <id>` or `--status <status>`, as `<alias>\/agent`, and then says which move it made/);
  assert.match(cast, /What no skill does is move a story out of the shaped step or the plan gate on its own initiative/);
  assert.match(contract, /\| status \| always `issue update --step` or `--status`; never by iteration or escalation; a move the person asks for as `<alias>\/agent`, named in the session \("The cast"\) \|/);
});
