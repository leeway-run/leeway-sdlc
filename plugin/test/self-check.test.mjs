import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Text pins on one file only: plugin/skills/plan-project/SKILL.md. This test file is never read.
const plugin = join(dirname(fileURLToPath(import.meta.url)), '..');
const skill = readFileSync(join(plugin, 'skills', 'plan-project', 'SKILL.md'), 'utf8').replace(/\r\n/g, '\n');

// The text from a heading line to the next heading of the same or a higher level; '' when there is no such heading.
// A line inside a ``` fence is never a heading.
function section(text, heading) {
  const level = /^#+/.exec(heading)[0].length;
  const lines = text.split('\n');
  const start = lines.findIndex((line) => line === heading);
  if (start < 0) return '';
  let end = lines.length;
  let fenced = false;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^\s*```/.test(lines[i])) { fenced = !fenced; continue; }
    const m = !fenced && /^(#+) /.exec(lines[i]);
    if (m && m[1].length <= level) { end = i; break; }
  }
  return lines.slice(start, end).join('\n');
}

const norm = (s) => s.toLowerCase().replace(/[‘’]/g, "'").replace(/`/g, '').replace(/\s+/g, ' ');

const step8 = section(skill, '## 8. The plan gate');
const DELEGATE = '### Delegate to the divergence reviewer with ids, not a story';
const beforeDelegate = step8.includes(DELEGATE) ? step8.slice(0, step8.indexOf(DELEGATE)) : '';
// The self-check: from the phrase "Trace it yourself first" to the delegation heading; '' when it is absent.
const at = norm(beforeDelegate).indexOf('trace it yourself first');
const selfCheck = at < 0 ? '' : norm(beforeDelegate.slice(beforeDelegate.toLowerCase().indexOf('trace it yourself first')));
const sentences = selfCheck.split(/(?<=[.!?;])\s+/);

// Pin 1 (LWY-202 AC-1, TC-1): "Trace it yourself first" sits in step 8, ahead of the "Delegate to the divergence reviewer" heading.
test('red-test-TC-1 pin 1: step 8 has "Trace it yourself first" before the delegation heading', { skip: 'red-test-TC-1: step 8 has no self-check part yet' }, () => {
  assert.ok(step8.includes(DELEGATE), 'step 8 still has the delegation heading');
  assert.ok(at >= 0, 'step 8 holds "Trace it yourself first" before the delegation heading');
});

// Pin 2 (AC-1, TC-1): "fails without it" - each AC and TC clause maps to a task and a named test.
test('red-test-AC-1 pin 2: the self-check maps every AC and TC clause to a task and a named test that fails without it', { skip: 'red-test-AC-1: no clause-to-test map in step 8' }, () => {
  assert.ok(sentences.some((s) => s.includes('clause') && s.includes('task') && s.includes('named test') && s.includes('fails without it')),
    'a sentence maps clause, task and "named test ... fails without it"');
});

// Pin 3 (AC-1, TC-1): "the task that builds it" - each field or capability one task uses.
test('red-test-AC-1 pin 3: the self-check maps every field or capability one task uses to the task that builds it', { skip: 'red-test-AC-1: no field-to-builder map in step 8' }, () => {
  assert.ok(sentences.some((s) => s.includes('field or capability') && s.includes('the task that builds it')),
    'a sentence maps "field or capability" to "the task that builds it"');
});

// Pin 4 (AC-1, TC-1): gaps are fixed in the task descriptions and the hazard register, before delegating.
test('red-test-AC-1 pin 4: gaps are fixed in the task descriptions and the hazard register before delegating', { skip: 'red-test-AC-1: no fix-first rule in step 8' }, () => {
  assert.ok(sentences.some((s) => s.includes('gap') && s.includes('fix') && s.includes('task descriptions') &&
    s.includes('hazard register') && s.includes('before')),
    'a sentence says a gap is fixed in the task descriptions and the hazard register before delegating');
});

// Pin 5 (AC-2, TC-2): "written nowhere" - not posted, not in the design doc, not in the reviewer's prompt;
// and no sentence about the mapping tells the planner to post, store or pass it.
test('red-test-AC-2 pin 5: the mapping is written nowhere, and nothing says to post, store or pass it', { skip: 'red-test-AC-2: step 8 does not say the mapping is written nowhere' }, () => {
  assert.ok(sentences.some((s) => s.includes('written nowhere')), 'the self-check says the mapping is "written nowhere"');
  assert.ok(selfCheck.includes('design doc') && selfCheck.includes("reviewer's prompt") && selfCheck.includes('posted'),
    'it names the design doc, the reviewer\'s prompt and a posted comment as places it is not');
  const instructing = sentences.filter((s) => /\b(mapping|map|maps)\b/.test(s) && /\b(post|store|save|pass|send|paste|put|add|include|write)\b/.test(s) &&
    !/\b(nowhere|not|never|no)\b/.test(s));
  assert.deepEqual(instructing, [], 'no sentence tells the planner to post, store or pass the mapping');
});

// Pin 6 (AC-2, TC-2): a guard on existing text, not a red test: "Never your summary." stays in step 8.
test('TC-2 pin 6 (guard): "Never your summary." is still in step 8', () => {
  assert.ok(step8.includes('**Never your summary.**'), 'step 8 holds "**Never your summary.**"');
});
