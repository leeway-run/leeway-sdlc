import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const plugin = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(plugin, path), 'utf8').replace(/\r\n/g, '\n');
const flat = (text) => text.replace(/\s+/g, ' ');

const GUIDANCE = 'skills/plan-project/references/task-size.md';
const REVIEWER = 'agents/sdlc-divergence-reviewer.md';
const PLAN = 'skills/plan-project/SKILL.md';
const TEMPLATE = 'skills/sdlc-install/scaffold/CONFIG.md.tmpl';
const POINTS = ['pure-logic', 'removal', 'large-screen', 'isolation-or-auth'];

// The text under a `##` or `###` heading that starts with `heading`.
function raw(text, heading) {
  const found = text.split(/\n(?=#{2,3} )/).find((chunk) => chunk.startsWith(heading));
  assert.ok(found, `no "${heading}" section`);
  return found;
}

// A row of the reviewer's Findings table, by its bold tag.
function row(tag) {
  const found = read(REVIEWER)
    .split('\n')
    .find((line) => line.startsWith(`| **${tag}**`));
  assert.ok(found, `no ${tag} row`);
  return flat(found);
}

// Anything that talks about a task's size.
const SIZE_TALK = /too big|too large|oversiz|task size|\bbig(ger)?\b|\blarge\b|\bsize\b/i;

// The sentences of a flattened text.
const sentences = (text) => text.split(/(?<=[.!?])\s+/);

// The reviewer's bullet that starts with `lead`, up to the next bullet, blank line or heading.
function bullet(text, lead) {
  const start = text.indexOf(lead);
  assert.ok(start >= 0, `no "${lead}" bullet`);
  return flat(text.slice(start).split(/\n(?=- \*\*|\n|#)/)[0]);
}

function files(dir) {
  return readdirSync(join(plugin, dir)).flatMap((name) => {
    const path = join(dir, name);
    return statSync(join(plugin, path)).isDirectory() ? files(path) : [path.replace(/\\/g, '/')];
  });
}

test('AC-1 / TC-1: task-size.md gives the default slice, the one-field example and the test', () => {
  const text = flat(read(GUIDANCE));
  assert.match(text, /thin slice of one behaviour/i);
  assert.match(text, /database field/i);
  assert.match(text, /one task/);
  assert.match(text, /one reviewer/);
  assert.match(text, /one review round/);
  assert.match(text, /examples?, not a (closed|complete) list|not a (closed|complete) list/);
  assert.match(text, /\bnot a rule\b/i);
});

test('AC-1 / TC-1: task-size.md names the four split points, backticked', () => {
  const text = read(GUIDANCE);
  for (const point of POINTS) assert.ok(text.includes(`\`${point}\``), `no \`${point}\``);
});

test('AC-1 / Negative: task-size.md says layers do not decide size', () => {
  const text = flat(read(GUIDANCE));
  assert.match(
    text,
    /(layers?|how many layers)[^.;]*\b(do(es)? not|don't|never)\s+(decide|determine|set)|\bnot (by )?how many layers/i,
    'no sentence says layers do not decide size',
  );
  assert.match(text, /\b(no|not|never|without)\b[^.]*\bline[- ](count|estimate)/i, 'no sentence disclaims a line-count estimate');
});

test('TC-2 / AC-2: the reviewer\'s QUESTION and BLOCKER rows say nothing about task size', () => {
  for (const tag of ['QUESTION', 'BLOCKER']) assert.doesNotMatch(row(tag), SIZE_TALK, `${tag} row talks about size`);
});

test('TC-2 / AC-2: the reviewer\'s NOTE row names the task-size guidance and the point it strains', () => {
  const note = row('NOTE');
  assert.match(note, /task[- ]size|the guidance/i);
  assert.match(note, /split/i);
  assert.match(note, /point/i);
});

test('TC-2: the reviewer judges against the guidance in its prompt, not a count of its own', () => {
  const text = flat(read(REVIEWER));
  assert.match(text, /task[- ]size guidance/i);
  assert.match(bullet(read(REVIEWER), '- **Tasks too big for one review round'), /task[- ]size|the guidance/i, 'the too-big bullet does not judge against the guidance');
  const received = flat(raw(read(REVIEWER), '## What you receive'));
  assert.match(received, /task[- ]size guidance/i);
});

test('TC-2: with no guidance in its prompt the reviewer raises no size finding', () => {
  assert.match(flat(read(REVIEWER)), /no size finding/i);
});

test('TC-4 / AC-1: "many hundreds of lines" and "stays in one layer" appear in none of the three files', () => {
  for (const path of [REVIEWER, PLAN, GUIDANCE]) {
    const text = flat(read(path));
    assert.doesNotMatch(text, /many hundreds of lines/i, `${path}: many hundreds of lines`);
    assert.doesNotMatch(text, /stays? (in|within) one layer/i, `${path}: stays in one layer`);
  }
  assert.doesNotMatch(flat(read(REVIEWER)), /more than one layer|several surfaces/i, 'the reviewer still counts layers or surfaces');
});

test('TC-1: each point name is in no file under skills/ or agents/ other than task-size.md', () => {
  const all = [...files('skills'), ...files('agents')].filter((p) => p !== GUIDANCE);
  assert.ok(read(GUIDANCE).length > 0);
  for (const path of all) {
    const text = read(path);
    for (const point of POINTS) assert.ok(!text.includes(`\`${point}\``), `${path} has \`${point}\``);
  }
});

test('TC-1: plan-project step 4 reads references/task-size.md before cutting tasks', () => {
  assert.match(flat(raw(read(PLAN), '## 4. ')), /references\/task-size\.md/);
});

test('TC-1 / TC-3: plan-project pastes the effective guidance into the reviewer prompt', () => {
  const text = flat(raw(read(PLAN), '### Delegate to the divergence reviewer'));
  assert.match(text, /task-size\.md/);
  assert.match(text, /`off`/);
  assert.match(text, /`added`/);
  assert.match(text, /as written/);
  const unknown = sentences(text).find((s) => /(unknown|does not have|do not have|lacks?|no such)/i.test(s) && /\bpoint\b/i.test(s) && /in the session/i.test(s));
  assert.ok(unknown, 'no one sentence says a row naming an unknown point is reported in the session');
  assert.match(unknown, /ignor/i);
  assert.doesNotMatch(unknown, /\b(never|not|don't)\s+(be\s+)?(report|reported|say|said|says|mention)/i, 'the sentence negates the report');
  assert.match(text, /`off`[^.]*remov|remov[^.]*`off`/i);
  assert.match(text, /`added`[^.]*append|append[^.]*`added`/i);
  const absent = sentences(text).find((s) => /as written/i.test(s) && (/\bno\b[^.]*\bsection\b/i.test(s) || /empty table|absent section|missing section/i.test(s)));
  assert.ok(absent, 'no one sentence says an absent section or empty table means the file as written');
});

test('TC-3: CONFIG.md.tmpl has a Task size section with an empty table', () => {
  const text = read(TEMPLATE);
  const section = raw(text, '## Task size');
  const lines = section.split('\n');
  assert.ok(lines.includes('| Point | Off or added | Text |'), 'no header row');
  const table = lines.filter((line) => line.startsWith('|'));
  assert.equal(table.length, 2, 'the table has rows besides the header and its separator');
  assert.match(table[1], /^\|[-\s|:]+\|$/);
  const prose = lines.slice(1).filter((line) => line.trim() && !line.startsWith('|'));
  assert.ok(prose.some((line) => /\brows?\b/i.test(line)), 'no line says what a row does');
});

test('TC-3: the template header comment names Task size', () => {
  const text = read(TEMPLATE);
  const comment = text.slice(0, text.indexOf('## Doc map')).match(/<!--[\s\S]*?-->/);
  assert.ok(comment, 'no header comment');
  assert.match(flat(comment[0]), /Task size/);
});
