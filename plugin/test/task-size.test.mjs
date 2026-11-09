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

function files(dir) {
  return readdirSync(join(plugin, dir)).flatMap((name) => {
    const path = join(dir, name);
    return statSync(join(plugin, path)).isDirectory() ? files(path) : [path];
  });
}

test('AC-1 / TC-1: task-size.md gives the default slice, the one-field example and the test', { skip: 'red-test-AC-1: task-size.md does not exist yet' }, () => {
  const text = flat(read(GUIDANCE));
  assert.match(text, /thin slice of one behaviour/);
  assert.match(text, /database field/);
  assert.match(text, /one task/);
  assert.match(text, /one reviewer/);
  assert.match(text, /one review round/);
  assert.match(text, /examples?, not a (closed|complete) list|not a (closed|complete) list/);
  assert.match(text, /guidance[^.]*not a rule|not a rule/);
});

test('AC-1 / TC-1: task-size.md names the four split points, backticked', { skip: 'red-test-TC-1: task-size.md does not exist yet' }, () => {
  const text = read(GUIDANCE);
  for (const point of POINTS) assert.ok(text.includes(`\`${point}\``), `no \`${point}\``);
});

test('AC-1 / Negative: task-size.md says layers do not decide size', { skip: 'red-test-AC-1: task-size.md does not exist yet' }, () => {
  assert.match(read(GUIDANCE), /\blayers?\b/i);
});

test('TC-2 / AC-2: the reviewer\'s QUESTION and BLOCKER rows say nothing about task size', { skip: 'red-test-TC-2: the QUESTION row still has "a task you judge too big"' }, () => {
  for (const tag of ['QUESTION', 'BLOCKER']) assert.doesNotMatch(row(tag), SIZE_TALK, `${tag} row talks about size`);
});

test('TC-2 / AC-2: the reviewer\'s NOTE row names the task-size guidance and the point it strains', { skip: 'red-test-AC-2: the NOTE row has no size entry' }, () => {
  const note = row('NOTE');
  assert.match(note, /task[- ]size guidance/i);
  assert.match(note, /point/i);
});

test('TC-2: the reviewer judges against the guidance in its prompt, not a count of its own', { skip: 'red-test-TC-2: "What you receive" does not mention the guidance' }, () => {
  const text = flat(read(REVIEWER));
  assert.match(text, /task[- ]size guidance/i);
  const received = flat(raw(read(REVIEWER), '## What you receive'));
  assert.match(received, /task[- ]size guidance/i);
});

test('TC-2: with no guidance in its prompt the reviewer raises no size finding', { skip: 'red-test-TC-2: the reviewer says nothing of a missing guidance' }, () => {
  assert.match(flat(read(REVIEWER)), /no size finding/i);
});

test('TC-4 / AC-1: "many hundreds of lines" and "stays in one layer" appear in none of the three files', { skip: 'red-test-TC-4: the reviewer still says "many hundreds of lines", and task-size.md does not exist' }, () => {
  for (const path of [REVIEWER, PLAN, GUIDANCE]) {
    const text = flat(read(path));
    assert.doesNotMatch(text, /many hundreds of lines/, `${path}: many hundreds of lines`);
    assert.doesNotMatch(text, /stays in one layer/, `${path}: stays in one layer`);
  }
});

test('TC-1: each point name is in no file under skills/ or agents/ other than task-size.md', { skip: 'red-test-TC-1: task-size.md does not exist yet, so the one copy is missing' }, () => {
  const all = [...files('skills'), ...files('agents')].filter((p) => p !== GUIDANCE);
  assert.ok(read(GUIDANCE).length > 0);
  for (const path of all) {
    const text = read(path);
    for (const point of POINTS) assert.ok(!text.includes(`\`${point}\``), `${path} has \`${point}\``);
  }
});

test('TC-1: plan-project step 4 reads references/task-size.md before cutting tasks', { skip: 'red-test-TC-1: step 4 does not name the guidance' }, () => {
  assert.match(flat(raw(read(PLAN), '## 4. ')), /references\/task-size\.md/);
});

test('TC-1 / TC-3: plan-project pastes the effective guidance into the reviewer prompt', { skip: 'red-test-TC-3: the delegation section has no guidance bullet' }, () => {
  const text = flat(raw(read(PLAN), '### Delegate to the divergence reviewer'));
  assert.match(text, /task-size\.md/);
  assert.match(text, /`off`/);
  assert.match(text, /`added`/);
  assert.match(text, /as written/);
  assert.match(text, /(unknown|does not have|no such)[^.]*point|point[^.]*(unknown|does not have)/i);
  assert.match(text, /in the session/);
});

test('TC-3: CONFIG.md.tmpl has a Task size section with an empty table', { skip: 'red-test-TC-3: the template has no Task size section' }, () => {
  const text = read(TEMPLATE);
  const section = raw(text, '## Task size');
  assert.ok(section.includes('| Point | Off or added | Text |'));
});

test('TC-3: the template header comment names Task size', { skip: 'red-test-TC-3: the header comment does not name the section' }, () => {
  const text = read(TEMPLATE);
  const comment = text.slice(0, text.indexOf('## Doc map')).match(/<!--[\s\S]*?-->/);
  assert.ok(comment, 'no header comment');
  assert.match(flat(comment[0]), /Task size/);
});
