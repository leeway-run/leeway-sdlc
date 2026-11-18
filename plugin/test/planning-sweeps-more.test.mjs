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

// Review round 2: c7 (the gate sentence), c9 (the sweeps carried through the loop).
const reviewer = () => read('agents/sdlc-divergence-reviewer.md');
const planProject = () => read('skills/plan-project/SKILL.md');

test('c7: plan-project step 4 says a plan without all three does not pass the plan gate', () => {
  const sweeps = section(planProject(), '### The three sweeps');
  assert.ok(sweeps.includes('A plan without all three does not pass the plan gate.'), 'the gate sentence is missing');
});

test('c9: the reviewer\'s PASS needs the three sweeps present and complete', () => {
  assert.ok(section(reviewer(), '## Verdict rules').includes('the three sweeps are present and complete'), 'the verdict rules do not mention the sweeps');
});

test('c9: the report has a "Sweeps read" section saying where they were read', () => {
  const report = flat(reviewer().slice(reviewer().indexOf('## The report')));
  assert.ok(report.includes('## Sweeps read'), 'the report template has no "## Sweeps read" section');
  assert.ok(report.includes('Where they were read'), 'the section does not say where');
});

test('c9: "Trace it yourself first" has the planner check its own sweeps before delegating', () => {
  assert.ok(section(planProject(), '### Trace it yourself first').includes('Check your own three sweeps'), 'no self-check of the sweeps');
});

test('c9: "What you receive" lists where the sweeps are among the items the prompt carries', () => {
  const receive = section(reviewer(), '## What you receive, and what you must not');
  assert.ok(receive.includes('**where the sweeps are**'), 'the sweeps location is not among the listed items');
});
