import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const plugin = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...parts) => readFileSync(join(plugin, ...parts), 'utf8').replace(/\r\n/g, '\n');

const reviewer = read('agents', 'sdlc-divergence-reviewer.md');
const skill = read('skills', 'plan-project', 'SKILL.md');
const process_ = read('PROCESS.md');

// The text from a heading line to the next heading of the same or a higher level; '' when there is no such heading.
function section(text, heading) {
  const level = /^#+/.exec(heading)[0].length;
  const lines = text.split('\n');
  const start = lines.findIndex((line) => line === heading);
  if (start < 0) return '';
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    const m = /^(#+) /.exec(lines[i]);
    if (m && m[1].length <= level) { end = i; break; }
  }
  return lines.slice(start, end).join('\n');
}

// A section as paragraphs and list items, each on one line, so a phrase wrapped across lines still matches.
const blocks = (text) => text.split(/\n\n|\n(?=- |\d+\. )/).map((b) => b.replace(/\s+/g, ' ').trim());
const blockWith = (text, ...phrases) => blocks(text).find((b) => phrases.every((p) => b.includes(p)));

const reReview = section(reviewer, '## Re-review');
const receive = section(reviewer, '## What you receive, and what you must not');
const reportTemplate = section(reviewer, '## The report');
const step8 = section(skill, '## 8. The plan gate');
const delegate = section(skill, '### Delegate to the divergence reviewer with ids, not a story');
const gate = process_.slice(process_.indexOf('## The plan gate'));
const gateItem1 = gate.slice(gate.indexOf('\n1. '), gate.indexOf('\n2. '));

const FIXED_INPUT = 'Line one\n\nline  two — é\n';
const FIXED_FINGERPRINT = '7f0c0d4d9ecb';

test('pin 1: the read log has a Fingerprint column, and the named node -e command gives the fixed value', { skip: 'red-test-TC-1: reviewer read log lacks the Fingerprint column and its command' }, () => {
  const header = reviewer.split('\n').find((line) => line.startsWith('| Item | Kind |'));
  assert.ok(header, 'the read log table header is missing');
  assert.ok(header.includes('| Fingerprint |'), `the read log has no Fingerprint column: ${header}`);
  // The command: a fenced block right after a line naming "Fingerprint command"; one `node -e` line that
  // reads the text on stdin and prints the first 12 hex characters of its SHA-256.
  const m = /Fingerprint command[^\n]*\n+```[a-z]*\n([\s\S]*?)\n```/.exec(reviewer);
  assert.ok(m, 'no fenced block follows a "Fingerprint command" line');
  const command = m[1].trim();
  assert.ok(command.startsWith('node -e'), `the command is not a node -e one-liner: ${command}`);
  const run = spawnSync('bash', ['-c', command], { input: FIXED_INPUT, encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.stdout.trim(), FIXED_FINGERPRINT);
});

test('pin 2: a changed fingerprint, or an item missing from the previous read log, is read in full and traced', { skip: 'red-test-AC-1 / TC-2: reviewer has no Re-review section' }, () => {
  assert.ok(reReview, 'the reviewer has no "## Re-review" section');
  assert.ok(
    blockWith(reReview, 'fingerprint changed', 'missing from the previous read log', 'read in full and traced'),
    'no paragraph of "## Re-review" says a changed fingerprint or an item missing from the previous read log is read in full and traced',
  );
});

test('pin 3: ## Earlier findings lists every finding of the previous report, closed or not closed', { skip: 'red-test-AC-1 / TC-3: reviewer has no Earlier findings section' }, () => {
  assert.ok(reReview, 'the reviewer has no "## Re-review" section');
  assert.ok(
    blockWith(reReview, '## Earlier findings', 'every finding of the previous report', 'closed or not closed'),
    'no paragraph of "## Re-review" says ## Earlier findings lists every finding of the previous report, closed or not closed',
  );
  assert.ok(reportTemplate.includes('\n## Earlier findings\n'), 'the report template has no "## Earlier findings" heading');
});

test('pin 4: a new finding on an unchanged item is marked missed earlier and keeps its tag', { skip: 'red-test-AC-2 / TC-3: reviewer has no missed earlier rule' }, () => {
  assert.ok(reReview, 'the reviewer has no "## Re-review" section');
  assert.ok(
    blockWith(reReview, 'unchanged', '`missed earlier`', 'keeps its tag'),
    'no paragraph of "## Re-review" says a new finding on an unchanged item is marked `missed earlier` and keeps its tag',
  );
});

test('pin 5: the reviewer never reads the planner replies, and reads its own continuation reply', { skip: 'red-test-TC-2: reviewer text does not exclude the planner replies' }, () => {
  assert.ok(
    blockWith(receive, '# QUESTIONs applied', '# BLOCKERs fixed', '<alias>/planner', 'never read'),
    '"What you receive" does not say to never read the planner replies `# QUESTIONs applied` and `# BLOCKERs fixed` (posted `--as <alias>/planner`)',
  );
  assert.ok(
    blockWith(receive, '<alias>/reviewer', "your own report's continuation"),
    '"What you receive" does not say to read your own report\'s continuation, a reply posted `--as <alias>/reviewer`',
  );
  assert.ok(receive.includes('never the planner\'s summary') || receive.includes('You never receive the planner\'s summary'), 'the planner\'s-summary rule is gone');
});

test('pin 6: plan-project step 8 passes, per story, that story\'s previous report cN and the mode', { skip: 'red-test-TC-2: step 8 passes no previous report or mode' }, () => {
  assert.ok(
    blockWith(delegate, 'per story', "that story's previous report `cN`", '`re-review`', '`full`'),
    'no item of "Delegate to the divergence reviewer" passes, per story, that story\'s previous report `cN` and the mode (`re-review` or `full`)',
  );
  assert.ok(
    blockWith(step8, 'missing from the previous read log', 'counts as changed'),
    'step 8 does not say an item missing from the previous read log counts as changed',
  );
});

test('pin 7: step 8 makes it full when a thread step into shape follows the previous report', { skip: 'red-test-AC-3 / TC-4: step 8 has no full rule after reshaping' }, () => {
  assert.ok(
    blockWith(step8, 'a thread `step` into `shape` after the previous report', 'full'),
    'step 8 does not say the mode is full when a thread `step` into `shape` follows the previous report',
  );
});

test('pin 8: step 8 makes it full when the person asks in the session', { skip: 'red-test-AC-3 / TC-4: step 8 has no full rule when asked' }, () => {
  assert.ok(
    blockWith(step8, 'the person asks for one in the session', 'full'),
    'step 8 does not say the mode is full when the person asks for one in the session',
  );
});

test('pin 9: step 8 makes it full when the previous report has no Fingerprint column', { skip: 'red-test-TC-4: step 8 has no full rule for an old report' }, () => {
  assert.ok(
    blockWith(step8, 'the previous report has no `Fingerprint` column', 'full'),
    'step 8 does not say the mode is full when the previous report has no `Fingerprint` column',
  );
});

test('pin 10: step 8 treats a TC change alone as a re-review', { skip: 'red-test-AC-3 / TC-4: step 8 has no TC-change rule' }, () => {
  assert.ok(
    blockWith(step8, 'a TC change alone is a re-review'),
    'step 8 does not say a TC change alone is a re-review',
  );
});

test('PROCESS.md, the plan gate item 1: a re-review also gets the previous report', { skip: 'red-test-TC-2: PROCESS.md plan gate item 1 does not mention the previous report' }, () => {
  assert.ok(
    blockWith(gateItem1, 're-review', 'previous report'),
    'PROCESS.md "The plan gate" item 1 does not say a re-review also gets the previous report',
  );
});
