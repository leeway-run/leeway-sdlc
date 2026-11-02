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
  assert.match(exceptions, /Two stories keep the approval round, and the PO is told why:/);
  const labels = [...exceptions.matchAll(/(?:^| )- \*\*([^*]+)\*\* /g)].map((m) => m[1]);
  assert.deepEqual(labels, ['Already planned', 'No shaped step']);
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
    /\*\*Re-read the issue first and stop if `issue\.description` is not the baseline\*\*: the one quoted under `Description at this round:` in the latest round's first comment, or the one step 0 read when nothing was asked; replacing a description silently clobbers an edit made in the UI in between\./,
  );
  assert.match(section(skill, '## 3. '), /first comment also quotes the description as it is \(or "none yet"\) under the line `Description at this round:`; the latest round's quote/);
});

test('a UI edit found on the re-read is kept, and the step ends', () => {
  const step = section(skill, '## 5. ');
  assert.match(step, /Take the edit into the body instead: rebuild the body on the version just read \(step 4\), keeping the edit, and list in the inference comment what the edit changed and how the body keeps it\./);
  assert.match(step, /Where the edit contradicts an answer, that is something new unclear: raise it as in step 3 and stop\./);
  assert.match(step, /Otherwise the version just read is the baseline now: start this step again\./);
  assert.doesNotMatch(step, /Show the new version and start this step again/);
});

test('the Status line names the PO even when shaping asked nothing', () => {
  const step = section(skill, '## 5. ');
  assert.match(step, /the answerer's name on the latest round's escalations \(`escalations\[\]\.answer\.by\.userName`\)\. When shaping asked nothing, it is the name `<cli> whoami` shows/);
  assert.match(step, /not signed in, no write can succeed, so stop and say so/);
});

test('PROCESS.md says shaping ends at the shaped step, without an approval question', () => {
  const shaping = section(contract, '## Before the plan: shaping');
  assert.match(shaping, /\*\*Shaping ends at the shaped step\*\*, the type's first `gate` step after `shape` with no `plan` step between them/);
  assert.match(shaping, /one whose type has no shaped step\./);
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
