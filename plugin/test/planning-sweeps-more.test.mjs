// LWY-266.5 review round 1, c2 and c3 (decision c5): pins beside the frozen plugin/test/planning-sweeps.test.mjs.
// c2: the reviewer's `- **Sweeps.**` item sits in step 6, "Look for what is missing".
// c3: the read-paths sweep carries AC-6's scope, the fixed phrase `for each rule the story adds or restricts`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const plugin = process.env.PLUGIN_DIR || join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(plugin, path), 'utf8').replace(/\r\n/g, '\n');
const flat = (text) => text.replace(/\s+/g, ' ');

// The heading line containing `title`, down to the next heading of its level or above.
const section = (text, title) => {
  const all = text.split('\n');
  const first = all.findIndex((line) => /^#+ /.test(line) && line.includes(title));
  assert.notEqual(first, -1, `anchor not found: a heading titled ${title}`);
  const level = /^(#+) /.exec(all[first])[1].length;
  const out = [all[first]];
  for (const line of all.slice(first + 1)) {
    const heading = /^(#+) /.exec(line);
    if (heading && heading[1].length <= level) break;
    out.push(line);
  }
  return flat(out.join('\n'));
};

test('c2: the reviewer\'s "- **Sweeps.**" item sits in step 6, "Look for what is missing"', () => {
  const step6 = section(read('agents/sdlc-divergence-reviewer.md'), '### 6. Look for what is missing');
  assert.ok(step6.includes('- **Sweeps.** '), 'step 6 has no "- **Sweeps.**" item');
  for (const phrase of ['is a BLOCKER', 'never a NOTE or a QUESTION']) assert.ok(step6.includes(phrase), `step 6 lacks ${phrase}`);
});

test('c3: the read-paths sweep says "for each rule the story adds or restricts"', () => {
  const sweeps = section(read('skills/plan-project/SKILL.md'), '### The three sweeps');
  const readPaths = sweeps.slice(sweeps.indexOf('**Read paths.**'), sweeps.indexOf('**Blast radius.**'));
  assert.ok(readPaths.includes('**Read paths.**'), 'no read-paths item');
  assert.ok(readPaths.includes('for each rule the story adds or restricts'), 'the read-paths sweep lacks the scope phrase');
});
