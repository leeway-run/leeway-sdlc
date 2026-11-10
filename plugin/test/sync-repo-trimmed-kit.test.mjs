// LWY-220.3, TC-2/TC-4/TC-7: sync-repo compares the trimmed kit, removes an old repo's harness/ and wiring/ on Take,
// offers the skills-dir ignore line and untracks with `git rm -r --cached`. Run: `node --test plugin/test/sync-repo-trimmed-kit.test.mjs`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const raw = readFileSync(join(root, 'plugin', 'skills', 'sync-repo', 'SKILL.md'), 'utf8');
const flat = (text) => text.replace(/\s+/g, ' ');
const skill = flat(raw);
const row = (label) => raw.split('\n').find((l) => l.startsWith(`| ${label} |`)) ?? '';
const kitRow = flat(row('the kit'));
const ignoreRow = flat(row('the `.gitignore` lines'));
const notes = flat(readFileSync(join(root, 'RELEASE_NOTES.md'), 'utf8'));

test('red-test-TC-4: the kit compare leaves out harness/, wiring/ and HARNESS.md', { skip: 'red-test-TC-4: the kit row compares the whole kit/ today' }, () => {
  assert.match(kitRow, /the kit/, 'could not find the kit row');
  assert.match(kitRow, /(minus|except|excluding|leaving out|without)[^|]*`harness\/`[^|]*`wiring\/`[^|]*`HARNESS\.md`/);
});

test('red-test-TC-4: .sdlc/kit/HARNESS.md is compared with kit/harness/<agent>.md, never the generic HARNESS.md', { skip: 'red-test-TC-4: the kit row names no HARNESS.md compare today' }, () => {
  assert.match(kitRow, /`\.sdlc\/kit\/HARNESS\.md`[^|]*`kit\/harness\/<agent>\.md`/);
  assert.match(kitRow, /one (copy|question)/);
});

test('red-test-TC-4: Take removes the harness/ and wiring/ directories inside .sdlc/kit/ by an explicit step, without the literal paths', { skip: 'red-test-TC-4: no explicit removal step exists today' }, () => {
  assert.match(skill, /(remove|delete)[^|]*`harness\/` and `wiring\/` directories inside `\.sdlc\/kit\/`/);
  assert.match(skill, /Take[^.]*(remove|delete)[^.]*`harness\/` and `wiring\/`|(remove|delete)[^.]*`harness\/` and `wiring\/`[^.]*Take|`harness\/` and `wiring\/`[^.]*on Take/);
  assert.match(skill, /`harness\/` and `wiring\/`[^.]*question|question[^.]*`harness\/` and `wiring\/`/);
  assert.doesNotMatch(skill, /\.sdlc\/kit\/(harness|wiring)/);
});

test('red-test-TC-2: the skills-dir path is one of the .gitignore lines', { skip: 'red-test-TC-2: the .gitignore row has no skills-dir today' }, () => {
  assert.match(ignoreRow, /\.sdlc\/\.governed\//, 'could not find the .gitignore row');
  assert.match(ignoreRow, /\*\*skills-dir\*\*/);
  assert.match(ignoreRow, /not `none`/);
});

test('red-test-TC-2: taking the skills-dir line untracks with git rm -r --cached, and skills-lock.json stays', { skip: 'red-test-TC-2: no untrack step exists today' }, () => {
  assert.match(skill, /git ls-files <skills-dir>/);
  assert.match(skill, /git rm -r --cached <skills-dir>/);
  assert.match(skill, /skills-lock\.json/);
  assert.match(skill, /(stay|remain)[^.]*on disk|on disk/);
});

test('TC-2 guard: every git rm in the skill carries --cached', () => {
  const uses = [...skill.matchAll(/git rm\b[^`]*/g)].map((m) => m[0]);
  for (const u of uses) assert.match(u, /--cached/, `a git rm without --cached: ${u}`);
});

test('TC-2 guard: skills-lock.json is never untracked or ignored', () => {
  assert.doesNotMatch(skill, /git rm[^`]*skills-lock\.json/);
  assert.doesNotMatch(ignoreRow, /skills-lock\.json[^|]*`\.gitignore`/);
});

test('red-test-TC-7: RELEASE_NOTES.md has an Unreleased entry above 0.3.0 on the skills directory and the trimmed kit', { skip: 'red-test-TC-7: no Unreleased entry today' }, () => {
  const at = notes.indexOf('## Unreleased');
  assert.ok(at >= 0, 'no ## Unreleased heading');
  assert.ok(at < notes.indexOf('## 0.3.0'), 'Unreleased must come before 0.3.0');
  const entry = notes.slice(at, notes.indexOf('## 0.3.0'));
  assert.match(entry, /skills director(y|ies)[^.]*gitignored/i);
  assert.match(entry, /untrack/i);
  assert.match(entry, /skills-lock\.json/);
  assert.match(entry, /`harness\/` and `wiring\/`/);
});
