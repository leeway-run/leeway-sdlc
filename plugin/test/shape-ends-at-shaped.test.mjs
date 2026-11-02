import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const plugin = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(plugin, path), 'utf8').replace(/\r\n/g, '\n');
const skill = read('skills/shape-project/SKILL.md');
const contract = read('PROCESS.md');

const EXCEPTIONS = '### When the approval round stays';
const APPROVAL = [/Write this body/, /\*Write it\*/];

// The text under each `##` or `###` heading, keyed by the heading and joined onto one line.
function sections(text) {
  return text.split(/\n(?=#{2,3} )/).map((chunk) => ({
    heading: chunk.split('\n')[0],
    text: chunk.replace(/\s+/g, ' '),
  }));
}

// The approval question, or its options, anywhere but under the exceptions heading.
const unlabelled = (text) =>
  sections(text)
    .filter(({ heading }) => heading !== EXCEPTIONS)
    .flatMap(({ heading, text }) => APPROVAL.filter((re) => re.test(text)).map((re) => `${heading}: ${re}`));

const section = (text, heading) => {
  const found = sections(text).find((s) => s.heading.startsWith(heading));
  assert.ok(found, `no "${heading}" section`);
  return found.text;
};

test('shape-project asks whether to write the body only in the labelled exceptions', () => {
  assert.deepEqual(unlabelled(skill), []);
  const exceptions = section(skill, EXCEPTIONS);
  assert.match(exceptions, /\*Write this body to `<ref>`\?\*/);
  assert.match(exceptions, /- \*\*Already planned\*\* /);
  assert.match(exceptions, /- \*\*No gate after `shape`\*\* /);
});

test('shaping with every answer in writes, posts one inference comment and ends at the shaped step', () => {
  const step = section(skill, '## 5. ');
  assert.match(step, /every escalation on the story is answered and no answer leaves something new unclear/);
  assert.match(step, /No escalation asks whether to write the body/);
  assert.match(step, /the type's first step of kind `gate` after its `shape` step, with no `plan` step between them/);
  assert.match(step, /by kind and position, never by id/);
  assert.match(step, /post \*\*one\*\* comment on the story: what the body says beyond the PO's answers/);
  assert.match(step, /issue update <ref> --step <the shaped step's id>`, and stop/);
  assert.doesNotMatch(step.split(EXCEPTIONS)[0], /--step shaped\b/);
});

test('the re-read before writing stays', () => {
  const step = section(skill, '## 5. ');
  assert.match(
    step,
    /\*\*Re-read the issue first and stop if `issue\.description` is not the one shaping started from\*\*.*replacing a description silently clobbers an edit made in the UI in between\. Show the new version and start this step again\./,
  );
  assert.match(section(skill, '## 3. '), /first comment also quotes the description as it is/);
});

test('PROCESS.md says shaping ends at the shaped step, without an approval question', () => {
  const shaping = section(contract, '## Before the plan: shaping');
  assert.match(shaping, /\*\*Shaping ends at the shaped step\*\*/);
  assert.match(shaping, /No escalation asks whether to write the body/);
  assert.deepEqual(unlabelled(contract), []);
});

test('the 0.2.0 step 5, or the question moved out of its exceptions, is caught', () => {
  const v020 =
    '## 5. Show the diff, ask, then write the body only\n\nPost one comment on the story with the current description. Then raise one escalation, *Write this body to\n`<ref>`?*, with the options *Write it*, *Write it with the changes in my note* and *Do not write*, and stop.\n';
  assert.equal(unlabelled(v020).length, 2);
  const moved = skill.replace(`${EXCEPTIONS}\n`, '');
  assert.ok(unlabelled(moved).length > 0, 'removing the exceptions heading is not caught');
  assert.deepEqual(unlabelled(`${EXCEPTIONS}\n\n${v020.split('\n\n')[1]}`), []);
});
