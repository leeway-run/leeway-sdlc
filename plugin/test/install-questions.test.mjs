import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const skill = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'skills', 'sdlc-install', 'SKILL.md'),
  'utf8',
).replace(/\r\n/g, '\n');

const interview = skill.slice(skill.indexOf('## Step 4'), skill.indexOf('## Step 5'));
const questions = [...interview.matchAll(/^(\d+)\. \*\*([^*]+)\*\*([\s\S]*?)(?=^\d+\. \*\*|^\S)/gm)].map(
  ([, n, title, body]) => ({ n: Number(n), title, body: body.replace(/\s+/g, ' ') }),
);
const words = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven',
  'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];

test('the question cap is the number of numbered questions, numbered in order', () => {
  const cap = /\*\*At most (\w+) questions/.exec(interview);
  assert.ok(cap, 'the interview states no cap');
  assert.deepEqual(questions.map((q) => q.n), questions.map((_, i) => i + 1));
  assert.equal(words.indexOf(cap[1]), questions.length);
});

test('the conditional questions are asked only on a divergence, and raised as yes/no', () => {
  const yesNo = /\*\*Yes\/no questions\*\* \(([^)]*)\)/.exec(skill);
  assert.ok(yesNo, 'no yes/no list in "Where the human is asked"');
  const conditional = questions.filter((q) => q.n >= 13);
  assert.deepEqual(
    conditional.map((q) => q.title),
    ['What the block repeats.', 'Branch prefixes.', 'Blocking rungs.', 'The unattended allow-list.'],
  );
  for (const q of conditional) {
    assert.match(q.body, /\bonly when\b/, `question ${q.n} (${q.title}) has no condition`);
    assert.match(yesNo[1], new RegExp(`\\b${q.n}\\b`), `question ${q.n} is not in the yes/no list`);
  }
});
