import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// LWY-239.3: stories in one shaping round that cut against the same rule get one question.
// Reads only skills/shape-project/SKILL.md, never this file.
const plugin = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(plugin, path), 'utf8').replace(/\r\n/g, '\n');
const shape = read('skills/shape-project/SKILL.md');

const oneLine = (text) => text.replace(/\s+/g, ' ');

// The text from a heading line up to the next heading of the same or a higher level, on one line.
function section(text, heading, level) {
  const chunks = text.split(new RegExp(`\\n(?=#{1,${level}} )`));
  const found = chunks.find((chunk) => chunk.startsWith(heading));
  assert.ok(found, `no "${heading}" section`);
  return oneLine(found);
}

// The "Wait, then carry on." paragraph: from its bold lead-in to the next blank line, on one line.
function waitParagraph(text) {
  const start = text.indexOf('**Wait, then carry on.**');
  assert.ok(start >= 0, 'no "Wait, then carry on." paragraph');
  const end = text.indexOf('\n\n', start);
  return oneLine(text.slice(start, end < 0 ? undefined : end));
}

const stepThree = () => section(shape, '## 3. Walk the gaps with the PO', 2);
const stepFive = () => section(shape, '## 5. Write the body, then stop at the shaped step', 2);
const stepSix = () => section(shape, '## 6. A new story, or several', 2);

// The passive ("is raised once") is deliberate: skills-wait.test.mjs's RAISE_AT rejects an imperative raise without a wait.
// AC-2 (last rule): raise once on the first story, the others hold with a comment and raise nothing.
for (const [name, step] of [['3', stepThree], ['6', stepSix]]) {
  test(`shape-project step ${name} raises a rule question shared by stories of one session once, on the first of them`, { skip: 'red-test-AC-2: step text absent until LWY-239.3 is built' }, () => {
    assert.match(step(), /stories shaped in one session cut against the same rule/);
    assert.match(step(), /the rule question is raised once, on the first of them/);
    assert.doesNotMatch(step(), /raised on every story/);
  });

  test(`shape-project step ${name} gives each other story a Held on comment and no escalation of its own for that rule`, { skip: 'red-test-TC-4: step text absent until LWY-239.3 is built' }, () => {
    assert.match(step(), /each other story gets a comment holding `Held on <ref> eN`/i);
    assert.match(step(), /no escalation of its own for that rule/);
  });

  // Negative case: the shared question is not raised a second time on another story.
  test(`shape-project step ${name} never raises the shared question a second time on another story`, { skip: 'red-test-AC-2: step text absent until LWY-239.3 is built' }, () => {
    assert.match(step(), /(?:never|not) raised[^.]*(?:a second time|again)[^.]*(?:another|other) story/);
  });
}

// TC-4: a held story waits on the escalation its Held on comment names.
test('shape-project "Wait, then carry on" has a held story wait on the escalation its Held on names, <ref> being that escalation\'s issue', { skip: 'red-test-TC-4: wait paragraph lacks the Held on wait until LWY-239.3 is built' }, () => {
  const wait = waitParagraph(shape);
  assert.match(wait, /a held story waits on the escalation its `Held on` names/i);
  assert.match(wait, /`<ref>` is that escalation's issue/);
});

// TC-4: step 5 counts held escalations as the story's own, keeping the pinned sentence.
test('shape-project step 5 counts the escalations a story holds on toward "every escalation on the story is answered"', { skip: 'red-test-TC-4: step 5 does not count held escalations until LWY-239.3 is built' }, () => {
  const step = stepFive();
  assert.match(step, /every escalation on the story is answered and no answer leaves something new unclear/);
  assert.match(step, /the escalations the story holds on (?:count|counts) (?:as its own|toward|towards) /);
  assert.doesNotMatch(step, /holds on[^.]*(?:do not|does not|never|not) count/);
});

test('shape-project step 5 writes the shared answer into each story\'s body', { skip: 'red-test-AC-2: step 5 text absent until LWY-239.3 is built' }, () => {
  assert.match(stepFive(), /answer[^.]*is written into each story's body/);
  assert.doesNotMatch(stepFive(), /writes? (?:its|the) body before/);
});

test('shape-project step 5 has a re-invoked shaping read the Held on comment and the escalation it names', { skip: 'red-test-TC-4: step 5 text absent until LWY-239.3 is built' }, () => {
  assert.match(stepFive(), /[Rr]e-invoking[^.]*reads the `Held on` comment and the escalation it names/);
});

// Negative case: a held story writes nothing while the escalation it holds on is open.
test('shape-project step 5 has a story holding on another\'s escalation write no body and set no shaped step while that escalation is open', { skip: 'red-test-AC-2: step 5 text absent until LWY-239.3 is built' }, () => {
  assert.match(stepFive(), /holding on another's escalation[^.]*(?:writes? no body|does not write its body)[^.]*(?:sets? no shaped step|does not set the shaped step)[^.]*while that escalation is open/);
});
