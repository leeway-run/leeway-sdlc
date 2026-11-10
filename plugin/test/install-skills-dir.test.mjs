// LWY-220.1, TC-1: sdlc-install gitignores the skills directory HARNESS.md names, only when it is not `none`, and
// leaves skills-lock.json committed. Run: `node --test plugin/test/install-skills-dir.test.mjs`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const flat = (text) => text.replace(/\s+/g, ' ');
const install = flat(readFileSync(join(root, 'plugin', 'skills', 'sdlc-install', 'SKILL.md'), 'utf8'));

// The bullet that writes the .gitignore lines, up to the next bullet.
const bullet = /- `\.gitignore` lines (.*?)(?= - \*\*Where|$)/.exec(install)?.[1] ?? '';

test('red-test-TC-1: the .gitignore bullet adds the skills-dir path HARNESS.md names, only when it is not none', () => {
  assert.match(bullet, /\.worktrees\/.*\.sdlc\/\.governed\//, 'could not find the .gitignore bullet');
  assert.match(bullet, /\*\*skills-dir\*\*/);
  assert.match(bullet, /only if absent/);
  assert.match(bullet, /not `none`/);
  assert.match(bullet, /nothing for `none`|adds nothing for `none`|none` adds nothing/);
});

test('red-test-TC-1: skills-lock.json stays committed, and no ignore line is a pattern or a parent directory', () => {
  assert.match(bullet, /`skills-lock\.json` (stays|is) committed/);
  // Exactly the directory, never `.agents/` or a glob that would match skills-lock.json.
  assert.doesNotMatch(bullet, /gitignore[^.]*`\.agents\/?`|`\.grok\/?`|`\.agents\/\*/);
});

test('red-test-TC-1: the check-ignore step after the .gitignore write includes the skills-dir', () => {
  const step = /`\{\{LOCAL_NOTES_FILE\}\}`\*\* — (.*?)(?= ## Step 7|$)/.exec(install)?.[1] ?? '';
  assert.match(step, /git check-ignore/);
  assert.match(step, /skills-dir/);
});
