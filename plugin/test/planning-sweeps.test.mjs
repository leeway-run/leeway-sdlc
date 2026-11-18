// LWY-266.5: the three planning sweeps (AC-6, TC-7, TC-10) and the plan gate that checks them.
// Text pins on plugin/skills/plan-project/SKILL.md (step 4 "The three sweeps", step 8's delegation, "Done when") and
// plugin/agents/sdlc-divergence-reviewer.md (step 6's bullet, the findings table). Design doc:
// docs/archive/lwy-266-an-unattended-run-decides-and-continues.md, "Planning sweeps". Round 0: each test is skipped
// with the criterion it serves. Every form is a FIXED PHRASE, no word-list judgement of meaning.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const plugin = process.env.PLUGIN_DIR || join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(plugin, path), 'utf8').replace(/\r\n/g, '\n');
const flat = (text) => text.replace(/\s+/g, ' ');

const red = (criterion, name, fn) => test(`${criterion}: ${name}`, { skip: `red-test-${criterion}` }, fn);

// The heading line containing `title`, down to the next heading of its level or above (fenced blocks skipped).
const section = (text, title) => {
  const all = text.split('\n');
  const first = all.findIndex((line) => /^#+ /.test(line) && line.includes(title));
  assert.notEqual(first, -1, `anchor not found: a heading titled ${title}`);
  const lines = all.slice(first);
  const level = /^(#+) /.exec(lines[0])[1].length;
  const out = [lines[0]];
  let fenced = false;
  for (const line of lines.slice(1)) {
    if (/^\s*```/.test(line)) fenced = !fenced;
    const heading = !fenced && /^(#+) /.exec(line);
    if (heading && heading[1].length <= level) break;
    out.push(line);
  }
  return flat(out.join('\n'));
};
// One list item (or table row) of `text` that starts with `start`, up to the next blank line or item.
const item = (text, start) => {
  const lines = text.split('\n');
  const first = lines.findIndex((l) => l.startsWith(start));
  assert.notEqual(first, -1, `anchor not found: an item starting ${start}`);
  const out = [lines[first]];
  for (const l of lines.slice(first + 1)) {
    if (l.trim() === '' || /^\s*(- |\d+\. |\|)/.test(l)) break;
    out.push(l);
  }
  return flat(out.join('\n'));
};
const has = (text, phrase, why) => assert.ok(text.includes(phrase), `${why}: missing the phrase ${JSON.stringify(phrase)}`);

const planProject = () => read('skills/plan-project/SKILL.md');
const reviewer = () => read('agents/sdlc-divergence-reviewer.md');
const step4 = () => section(planProject(), '## 4. Two lists, and never one');
const sweeps = () => section(planProject(), '### The three sweeps');
const delegate = () => section(planProject(), '### Delegate to the divergence reviewer with ids, not a story');
const bullet = () => item(reviewer(), '- **Sweeps.**');
const tableRow = (tag) => item(reviewer().slice(reviewer().indexOf('## Findings')), `| **${tag}** |`);

// AC-6, TC-7: where the sweeps are, and the three of them.
red('AC-6', 'plan-project step 4 has "The three sweeps" naming read paths, blast radius and completeness', () => {
  has(step4(), '### The three sweeps', 'step 4');
  for (const label of ['**Read paths.**', '**Blast radius.**', '**Completeness.**']) has(sweeps(), label, 'The three sweeps');
});

red('TC-7', 'the sweeps are recorded under `## Sweeps` in the design doc, or in a story comment opening `# Sweeps`', () => {
  has(sweeps(), 'recorded under `## Sweeps` in the design doc', 'the location rule');
  has(sweeps(), "where the type's plan step writes no design doc, in a story comment opening `# Sweeps`", 'the location rule');
});

red('AC-6', 'read paths: every op and surface that returns the affected data, each with a criterion and a test', () => {
  const s = sweeps();
  has(s, 'every op and surface that returns the affected data', 'read paths');
  has(s, 'each names its `TC-n` or hazard row and its test', 'read paths');
});

red('AC-6', 'blast radius: enforced rules, dependent scripts and helpers, and the migration timing', () => {
  const s = sweeps();
  has(s, 'every rule the touched code already enforces (caps, rate limits)', 'blast radius');
  has(s, 'every script, test helper and evidence tool that depends on a changed flow', 'blast radius');
  has(s, "a migration's time on a copy of real data, where the repo says how to make one", 'blast radius');
  has(s, 'the migration was not timed', 'blast radius');
});

red('AC-6', "completeness: phone frames, each dropping migration's rollout order, the plan branch kept current, \"blocked by\" read as merged", () => {
  const s = sweeps();
  has(s, "each screen's phone frame, where the floor asks for one", 'completeness');
  has(s, 'the rollout order of each migration that drops something', 'completeness');
  has(s, '`run` keeps the plan branch current', 'completeness');
  has(s, 'reads "blocked by" as merged', 'completeness');
});

// Negative case: a read-path item with no test, a blast-radius item with no owner or reason, are not allowed items.
red('AC-6', 'a read-path item without a test, and a blast-radius item without an owner or a reason, are not allowed', () => {
  const s = sweeps();
  has(s, 'No read-path item is without a test.', 'the read-path rule');
  has(s, 'Each blast-radius item names its owning task or says "unaffected, because".', 'the blast-radius rule');
  has(s, 'No blast-radius item is without an owner or a reason.', 'the blast-radius rule');
});

red('AC-6', 'a plan without all three sweeps does not pass the plan gate: step 8 and "Done when" name them', () => {
  has(delegate(), "Where the sweeps are: the design doc's `## Sweeps` section, or the story comment opening `# Sweeps`.", 'step 8 delegation');
  has(section(planProject(), '## Done when'),
    'Every plan has its three sweeps recorded: read paths, blast radius and completeness, under `## Sweeps` or in a story comment opening `# Sweeps`.',
    '"Done when"');
});

// TC-7: the divergence reviewer's BLOCKER.
red('TC-7', "the reviewer's step 6 bullet makes each of the three sweeps missing a BLOCKER, never a NOTE or a QUESTION", () => {
  const b = bullet();
  has(b, 'A missing read-paths sweep, a missing blast-radius sweep or a missing completeness sweep is a BLOCKER', 'the reviewer bullet');
  has(b, 'a read-path item with no criterion or test is a BLOCKER', 'the reviewer bullet');
  has(b, 'a blast-radius item with no owner or reason is a BLOCKER', 'the reviewer bullet');
  has(b, 'never a NOTE or a QUESTION', 'the reviewer bullet');
  const rest = b.replace('never a NOTE or a QUESTION', '');
  assert.ok(!/\b(NOTE|QUESTION)\b/.test(rest), `the bullet tags a sweep finding something else: ${rest}`);
});

red('TC-7', "the reviewer's findings table names the sweeps in the BLOCKER row only", () => {
  const blocker = tableRow('BLOCKER');
  has(blocker, 'a missing sweep (read paths, blast radius or completeness); a read-path item with no criterion or test; a blast-radius item with no owner or reason', 'the BLOCKER row');
  for (const tag of ['QUESTION', 'NOTE']) assert.ok(!/sweep|read-path|blast-radius/.test(tableRow(tag)), `the ${tag} row names a sweep`);
});

red('TC-7', 'the reviewer reads the sweeps where the planner says: the `## Sweeps` section or the `# Sweeps` comment', () => {
  has(flat(reviewer()), "The sweeps are in the design doc's `## Sweeps` section or in the story comment opening `# Sweeps`, where your prompt says.", 'what you receive');
});
