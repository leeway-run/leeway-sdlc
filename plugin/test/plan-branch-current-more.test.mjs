// LWY-266.6 round 5: the story-start paragraph cites step 5, whose ancestor check tests the base's head inside what is
// merged in. At story start the plan branch's head is never inside the integration branch, so the paragraph must
// say what is checked instead. Fixed phrases on plugin/skills/run/SKILL.md, "Story start".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const plugin = process.env.PLUGIN_DIR || join(dirname(fileURLToPath(import.meta.url)), '..');
const run = readFileSync(join(plugin, 'skills/run/SKILL.md'), 'utf8').replace(/\r\n/g, '\n').replace(/\s+/g, ' ');
const start = run.slice(run.indexOf("**When the story's base is a plan branch"), run.indexOf('2. **Create or reuse the story worktree**'));
const has = (phrase) => assert.ok(start.includes(phrase), `story start lacks: ${phrase}`);

test('story start checks that the merge worktree HEAD equals origin/<base>, and begins again when the base moved', () => {
  has("**Three things differ from step 5's text, which tests the other direction.** The ancestor check here asks whether the merge worktree's detached `HEAD` equals `origin/<base>` as just fetched (`git -C <primary>/.worktrees/merge-<story> rev-parse HEAD` against `git -C <primary> rev-parse origin/<base>`); when it does not, the base moved: remove the worktree and begin this paragraph again, which is what \"go back to step 1\" means here.");
});

test('story start\'s push failure path refetches the base and tests origin/<base> against the merge worktree HEAD', () => {
  has("If the push of the base fails, fetch `<base>` again: when `origin/<base>` is not an ancestor of the merge worktree's `HEAD` (`git -C <primary>/.worktrees/merge-<story> merge-base --is-ancestor origin/<base> HEAD`), the base moved, so remove the worktree and begin this paragraph again; otherwise remove the worktree, stop and say what git printed.");
});

test('story start\'s merge has its own message subject', () => {
  has("The merge's message file carries its own subject, `Merge <integration branch> into <base>`.");
});

test('story start never asks whether the plan branch head is an ancestor of the integration branch', () => {
  assert.ok(!start.includes('merge-base --is-ancestor HEAD <story branch>'));
  assert.ok(!start.includes('merge-base --is-ancestor origin/<base> origin/<integration branch>'));
});
