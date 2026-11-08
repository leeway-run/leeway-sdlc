import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const skill = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'skills', 'run', 'SKILL.md'), 'utf8')
  .replace(/\r\n/g, '\n');

function section(heading) {
  const start = skill.indexOf(`\n## ${heading}\n`);
  assert.ok(start >= 0, `run/SKILL.md has no "${heading}" section`);
  const end = skill.indexOf('\n## ', start + 1);
  return skill.slice(start, end < 0 ? undefined : end);
}

// The numbered step of "What the ref is" whose bold lead starts with `lead`, joined onto one line.
function step(lead) {
  const steps = section('What the ref is').split(/\n(?=\d+\. )/);
  const found = steps.find((s) => new RegExp(`^\\d+\\. \\*\\*${lead}`).test(s));
  assert.ok(found, `"What the ref is" has no step "${lead}"`);
  return found.replace(/\s+/g, ' ');
}

// The bullets of a step, each joined onto one line.
const bullets = (text) => text.split(/ - (?=\*\*)/).slice(1);

test('run refuses a ref of another product, and stops', () => {
  const refusal = step('A ref of another product is refused');
  assert.match(refusal, /key is not `product:` in `\.sdlc\/leeway\.md`/);
  assert.match(refusal, /and stop\./);
});

test('run refuses what is not work, saying why and writing nothing', () => {
  const refusal = step('Refuse what is not work');
  assert.match(refusal, /saying why and writing nothing/);
  const items = bullets(refusal);

  const plan = items.filter((b) => b.startsWith('**the Plan record**'));
  assert.equal(plan.length, 1, 'no refusal of the Plan record');
  assert.match(plan[0], /the \*Nit collectors\* table in `\.sdlc\/leeway\.md` names/);
  assert.match(plan[0], /nothing runs it/);

  const closed = items.filter((b) => /`done` or `cancelled`/.test(b));
  assert.equal(closed.length, 1, 'no refusal of a done or cancelled ref');
  assert.match(closed[0], /^\*\*an issue or sub-issue whose `issue\.status` is `done` or `cancelled`\*\*/);
  assert.match(closed[0], /nothing left to run/);
});

test('the refusals come before run dispatches on what the ref is', () => {
  const text = section('What the ref is');
  const dispatch = text.indexOf('**Then run it as what it is:**');
  assert.ok(dispatch >= 0, 'no dispatch step');
  for (const lead of ['**A ref of another product is refused.**', '**Refuse what is not work**']) {
    const at = text.indexOf(lead);
    assert.ok(at >= 0 && at < dispatch, `${lead} is not before the dispatch`);
  }
});
