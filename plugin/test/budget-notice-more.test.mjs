// LWY-266.4, round 3: the default budget sdlc-install writes is described as a notice and a stop at twice, never as a
// stop at the first dimension reached.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const plugin = process.env.PLUGIN_DIR || join(dirname(fileURLToPath(import.meta.url)), '..');
const flat = (path) => readFileSync(join(plugin, path), 'utf8').replace(/\s+/g, ' ');

test('sdlc-install describes the default budget as a notice at each dimension and stop 9 at twice any', () => {
  const install = flat('skills/sdlc-install/SKILL.md');
  assert.ok(
    install.includes(
      '(8,000,000 tokens · 15 rounds · 4 h wall-clock: a `# Budget reached` notice at each one reached, and stop 9 at twice any of them)',
    ),
  );
  assert.doesNotMatch(install, /4 h wall-clock, whichever comes first/);
});

test('run describes the dimensions as each checked on its own, not as whichever is hit first', () => {
  const run = flat('skills/run/SKILL.md');
  assert.ok(run.includes('It has up to three dimensions, each checked on its own: `tokens`, `rounds` and `hours`'));
  assert.doesNotMatch(run, /three dimensions, whichever is hit first/);
});
