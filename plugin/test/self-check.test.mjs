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

// "e.g." and "i.e." are folded to "eg" and "ie" so a sentence is not cut after them.
const norm = (s) => s.toLowerCase().replace(/[‘’]/g, "'").replace(/`/g, '').replace(/\be\.g\./g, 'eg').replace(/\bi\.e\./g, 'ie').replace(/\s+/g, ' ');
const splitSentences = (text) => text.split(/(?<=[.!?;])\s+/);

// Sentences that tell the planner to give the mapping to somewhere. A sentence names the mapping (mapping, self-check,
// the trace, the check/map) and either has a giving verb or names a place it could go (reviewer, prompt, design doc, comment,
// posted). "nowhere" clears it anywhere in the sentence; never/not/no/without/don't clear it only before the first
// verb or place, so "Post the mapping, not the tasks" is flagged.
const NAMES_MAPPING = /\b(mapping|self-check|the trace|the check|the map|your map)\b/;
const GIVES = /\b(post|stor|sav|pass|send|sent|past|put|add|includ|writ|wrote|written|hand|giv|gave|attach|shar|record|forward|log|deliver|provid|leav|keep|kept|cop|mention|list|show|tell|submit|publish|upload|embed|append)\w*|\b(reviewer|prompt|design doc|comment)/;
const NEGATES = /\b(never|not|no|without|don't|do not)\b/;
function instructsToPassOn(sentenceList) {
  return sentenceList.filter((s) => {
    if (!NAMES_MAPPING.test(s) || /\bnowhere\b/.test(s)) return false;
    const first = GIVES.exec(s);
    return first !== null && !NEGATES.test(s.slice(0, first.index));
  });
}

const step8 = section(skill, '## 8. The plan gate');
const DELEGATE = '### Delegate to the divergence reviewer with ids, not a story';
const beforeDelegate = step8.includes(DELEGATE) ? step8.slice(0, step8.indexOf(DELEGATE)) : '';
// The self-check: from the phrase "Trace it yourself first" to the delegation heading; '' when it is absent.
const at = norm(beforeDelegate).indexOf('trace it yourself first');
const selfCheck = at < 0 ? '' : norm(beforeDelegate.slice(beforeDelegate.toLowerCase().indexOf('trace it yourself first')));
const sentences = splitSentences(selfCheck);

// Pin 1 (LWY-202 AC-1, TC-1): "Trace it yourself first" sits in step 8, ahead of the "Delegate to the divergence reviewer" heading.
test('red-test-TC-1 pin 1: step 8 has "Trace it yourself first" before the delegation heading', { skip: 'red-test-TC-1: step 8 has no self-check part yet' }, () => {
  assert.ok(step8.includes(DELEGATE), 'step 8 still has the delegation heading');
  assert.ok(at >= 0, 'step 8 holds "Trace it yourself first" before the delegation heading');
});

// Pin 2 (AC-1, TC-1): "fails without it" - each AC and TC clause maps to a task and a named test.
test('red-test-AC-1 pin 2: the self-check maps every AC and TC clause to a task and a named test that fails without it', { skip: 'red-test-AC-1: no clause-to-test map in step 8' }, () => {
  assert.ok(sentences.some((s) => s.includes('clause') && s.includes('task') && s.includes('named test') && /fails? without it/.test(s)),
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
  assert.ok(selfCheck.includes('design doc') && selfCheck.includes("reviewer's prompt") && /\b(post|posted|comment)\b/.test(selfCheck),
    'it names the design doc, the reviewer\'s prompt and a posted comment as places it is not');
  assert.deepEqual(instructsToPassOn(sentences), [], 'no sentence tells the planner to post, store or pass the mapping');
});

// The pin 5 checker against inline strings (not SKILL.md): known-bad sentences are flagged, known-good ones are not.
test('pin 5 checker (guard): flags text that hands the mapping on, passes text that says it is written nowhere', () => {
  const bad = [
    'Hand the mapping to the reviewer in the delegation.',
    'Post the mapping, not the tasks.',
    'Give the reviewer the mapping.',
    'Attach the mapping to the design doc.',
    'The self-check goes in the reviewer\'s prompt.',
    'Record the trace in a comment.',
    'Share the mapping with the reviewer before it reads the plan.',
  ];
  const good = [
    'The mapping is written nowhere: not posted, not in the design doc and not in the reviewer\'s prompt.',
    'Never post the mapping, in the design doc or a comment.',
    'The mapping is posted nowhere.',
    'Do not put the mapping in the reviewer\'s prompt.',
    'Fix every gap in the task descriptions and the hazard register, then delegate.',
  ];
  for (const text of bad) assert.equal(instructsToPassOn(splitSentences(norm(text))).length, 1, `flagged: ${text}`);
  for (const text of good) assert.deepEqual(instructsToPassOn(splitSentences(norm(text))), [], `accepted: ${text}`);
  assert.equal(splitSentences(norm('Map each clause, e.g. an AC bullet, to a task. Then fix gaps.')).length, 2, 'e.g. does not split a sentence');
});

// Pin 6 (AC-2, TC-2): a guard on existing text, not a red test: "Never your summary." stays in step 8.
test('TC-2 pin 6 (guard): "Never your summary." is still in step 8', () => {
  assert.ok(step8.includes('**Never your summary.**'), 'step 8 holds "**Never your summary.**"');
});
