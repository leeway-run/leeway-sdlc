import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const skill = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'skills', 'plan-work', 'SKILL.md'), 'utf8');
const description = /^---\r?\n[\s\S]*?^description: (.*)$/m.exec(skill)?.[1];

test('plan-work has a description', () => {
  assert.ok(description, 'plan-work SKILL.md has no description: line');
});

test('the first 200 characters of plan-work\'s description carry the trigger', () => {
  const start = description.slice(0, 200);
  assert.ok(!description.startsWith('Plan a piece of work before any code is written'), start);
  assert.ok(/\bfiled?\b/i.test(start) && /\bissues?\b/i.test(start), start);
});

test('plan-work\'s description keeps the plan-step fact and the skip clause', () => {
  assert.ok(description.includes('Runs only for an issue whose type has a plan step.'), description);
  assert.ok(description.includes('Skip it for a one-file fix with an obvious test.'), description);
});
