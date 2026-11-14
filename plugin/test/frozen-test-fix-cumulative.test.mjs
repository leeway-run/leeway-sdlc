// LWY-244.1 round 4: the `unchanged since round <N>` marker is verified, not trusted (AC-2, TC-1), and the
// implementer's own definition carries the cumulative rule and the else-BLOCKED branch (AC-6, TC-4).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const plugin = process.env.PLUGIN_DIR || join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(plugin, path), 'utf8').replace(/\r\n/g, '\n');
const flat = (text) => text.replace(/\s+/g, ' ');

const run = flat(read('skills/run/SKILL.md'));
const implementer = flat(read('agents/sdlc-implementer.md'));
const reviewer = flat(read('agents/sdlc-reviewer.md'));
const brief = flat(read('skills/run/templates/BRIEF.md'));

test('AC-2: the reviewer verifies each unchanged marker against the named round\'s diff, and a false one is a freeze BLOCKER', () => {
  assert.match(reviewer, /verify the marker.*git -C <worktree> diff <sha of round N> -- <file>/);
  assert.match(reviewer, /iterations\[\]/);
  assert.match(reviewer, /where the sha is that round's iteration commit \(`iterations\[\]` in the JSON of `leeway issue get <ref> --json`, or the Head sha of that round's brief\)/);
  assert.match(reviewer, /The output must be empty, or only the removed skip marker\./);
  assert.match(reviewer, /A false marker is an unmet condition: a \*\*BLOCKER\*\* tagged `freeze`/);
});

test('AC-2: SKILL and the BRIEF template say the marker is verified, and the gate stays mechanical', () => {
  assert.match(run, /verified the marker: `git -C <worktree> diff <sha of round N> -- <file>`/);
  assert.match(run, /<file>` is empty, or only the un-skip, where the sha is that round's iteration commit \(`iterations\[\]` in the JSON of `leeway issue get <ref> --json`, or the Head sha of that round's brief\)/);
  assert.match(run, /A false marker is an unmet condition, a `freeze` BLOCKER/);
  assert.match(run, /The gate stays mechanical: it checks names, not markers/);
  assert.match(brief, /reviewer checks each marker against that round's commit.*`freeze` BLOCKER/);
});

test('TC-4: the implementer returns BLOCKED when any condition fails, and knows the section is cumulative', () => {
  assert.match(implementer, /If any one fails, it is the spec amendment above, and you return `BLOCKED`/);
  assert.match(implementer, /The section is cumulative: every later brief re-lists each fix since round 0/);
  assert.match(implementer, /the marker must be true/);
});
