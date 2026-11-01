import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const skill = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'skills', 'plan-project', 'SKILL.md'), 'utf8');
const description = /^---\r?\n[\s\S]*?^description: (.*)$/m.exec(skill)?.[1];

test('plan-project has a description that stays a valid plain YAML scalar', () => {
  assert.ok(description, 'plan-project SKILL.md has no description: line');
  assert.ok(!/^["'&*!|>%@`{[]/.test(description), 'description starts with a YAML indicator');
  assert.ok(!description.includes(': ') && !description.includes(' #'), 'description has ": " or " #", which break a plain scalar');
});

test('the first 200 characters of plan-project\'s description carry the trigger', () => {
  const start = description.slice(0, 200);
  assert.ok(!description.startsWith('Plan a piece of work before any code is written'), start);
  assert.ok(/\bfiled?\b/i.test(start) && /\bissues?\b/i.test(start), start);
});

test('plan-project\'s description names the requests that trigger it', () => {
  for (const words of ['"file issues"', '"write this up"', '"break it down"', '"park it for later"', '"turn this feedback into tickets"']) {
    assert.ok(description.includes(words), `description lacks ${words}`);
  }
});

test('plan-project\'s description defers to a repo that set filing-work to manual', () => {
  assert.ok(description.includes('unless `.sdlc/leeway.md` sets `filing-work` to `manual`'), description);
  assert.ok(!description.includes('even while pairing'), description);
});

test('plan-project\'s description keeps the plan-step fact and the skip clause', () => {
  assert.ok(description.includes('Runs only for an issue whose type has a plan step.'), description);
  assert.ok(description.includes('Skip it for a one-file fix with an obvious test.'), description);
});
