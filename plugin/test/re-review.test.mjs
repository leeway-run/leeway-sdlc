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
// A line inside a ``` fence is never a heading.
function section(text, heading) {
  const level = /^#+/.exec(heading)[0].length;
  const lines = text.split('\n');
  const start = lines.findIndex((line) => line === heading);
  if (start < 0) return '';
  let end = lines.length;
  let fenced = false;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^\s*```/.test(lines[i])) { fenced = !fenced; continue; }
    const m = !fenced && /^(#+) /.exec(lines[i]);
    if (m && m[1].length <= level) { end = i; break; }
  }
  return lines.slice(start, end).join('\n');
}

// Matching ignores case and curly apostrophes.
const norm = (s) => s.toLowerCase().replace(/[\u2018\u2019]/g, "'");

// A section as paragraphs and list items, each on one line, so a phrase wrapped across lines still matches.
const blocks = (text) => text.split(/\n\n|\n(?=- |\d+\. )/).map((b) => norm(b.replace(/\s+/g, ' ').trim()));
// The first block holding, for every argument, that phrase (a string) or one of those phrases (an array of variants).
const blockWith = (text, ...groups) =>
  blocks(text).find((b) => groups.every((g) => [].concat(g).some((p) => b.includes(norm(p)))));

// Sentences of a block (already normalised), backticks dropped, so a negation is found whatever the markup.
const sentences = (block) => block.replace(/`/g, '').split(/(?<=[.!?;])\s+/);
const has = (s, groups) => groups.every((g) => [].concat(g).some((p) => s.includes(norm(p).replace(/`/g, ''))));
// Like blockWith, but no sentence of the block that holds the `trigger` phrase may also hold a `banned` one,
// so "The mode is not full when ..." does not satisfy "The mode is full when ...". Sentences without the trigger are not
// checked: the rule for a TC change ("... does not make it full") can share a block with them.
const blockWithout = (text, groups, trigger, banned) =>
  blocks(text).find((b) => groups.every((g) => [].concat(g).some((p) => b.includes(norm(p)))) &&
    !sentences(b).some((x) => has(x, [trigger]) && banned.some((p) => x.includes(p))));
const NOT_FULL = ['not full', 'never full', 'not be full', "isn't full", 'not the full', 'never the full'];

const reReview = section(reviewer, '## Re-review');
const receive = section(reviewer, '## What you receive, and what you must not');
// The report template: the fenced block that follows the "## The report" heading.
const reportTemplate = (/```[a-z]*\n([\s\S]*?)\n```/.exec(section(reviewer, '## The report')) || [])[1] || '';
const step8 = section(skill, '## 8. The plan gate');
const delegate = section(skill, '### Delegate to the divergence reviewer with ids, not a story');
const gate = process_.slice(process_.indexOf('## The plan gate'));
const gateItem1 = gate.slice(gate.indexOf('\n1. '), gate.indexOf('\n2. '));

const FIXED_INPUT = 'Line one\n\nline  two — é\n';
const FIXED_FINGERPRINT = '7f0c0d4d9ecb';

test('pin 1: the read log has a Fingerprint column, and the named node -e command gives the fixed value', () => {
  const header = reviewer.split('\n').find((line) => line.startsWith('| Item | Kind |'));
  assert.ok(header, 'the read log table header is missing');
  assert.ok(header.includes('| Fingerprint |'), `the read log has no Fingerprint column: ${header}`);
  // The command: a fenced block right after a line naming "Fingerprint command"; one `node -e` line that prints the
  // first 12 hex characters of the SHA-256 of the text, read on stdin or taken as an argument ($1).
  const m = /fingerprint command[^\n]*\n+```[a-z]*\n([\s\S]*?)\n```/i.exec(reviewer);
  assert.ok(m, 'no fenced block follows a "Fingerprint command" line');
  const command = m[1].trim();
  assert.ok(command.startsWith('node -e'), `the command is not a node -e one-liner: ${command}`);
  // The text goes both ways, on stdin and as $1, so whichever form the command uses is given its input.
  const run = (text) => spawnSync('bash', ['-c', command, 'fingerprint', text], { input: text, encoding: 'utf8' });
  const first = run(FIXED_INPUT);
  assert.equal(first.status, 0, first.stderr);
  assert.equal(first.stdout.trim(), FIXED_FINGERPRINT);
  const other = run('another text\n');
  assert.equal(other.status, 0, other.stderr);
  assert.match(other.stdout.trim(), /^[0-9a-f]{12}$/, 'the command does not compute the fingerprint of the text it is given');
  assert.notEqual(other.stdout.trim(), FIXED_FINGERPRINT);
});

test('pin 2: a changed fingerprint, or an item missing from the previous read log, is read in full and traced', () => {
  assert.ok(reReview, 'the reviewer has no "## Re-review" section');
  assert.ok(
    blockWith(reReview,
      ['fingerprint changed', 'changed fingerprint', 'fingerprint has changed', 'fingerprint differs'],
      'missing from the previous read log',
      ['read in full and traced', 'read in full, and traced', 'read in full and is traced']),
    'no paragraph of "## Re-review" says a changed fingerprint or an item missing from the previous read log is read in full and traced',
  );
});

test('pin 3: ## Earlier findings lists every finding of the previous report, closed or not closed', () => {
  assert.ok(reReview, 'the reviewer has no "## Re-review" section');
  assert.ok(
    blockWith(reReview,
      '## Earlier findings',
      ['every finding of the previous report', 'every finding in the previous report', 'every earlier finding', 'every finding from the previous report'],
      ['closed or not closed', 'closed and not closed', 'whether closed or not', 'closed or open', 'closed and open']),
    'no paragraph of "## Re-review" says ## Earlier findings lists every finding of the previous report, closed or not closed',
  );
  assert.ok(reportTemplate.split('\n').includes('## Earlier findings'), 'the fenced report template has no "## Earlier findings" heading line');
});

test('pin 4: a new finding on an unchanged item is marked missed earlier and keeps its tag', () => {
  assert.ok(reReview, 'the reviewer has no "## Re-review" section');
  assert.ok(
    blockWith(reReview, 'unchanged', '`missed earlier`', ['keeps its tag', 'keeps the tag', 'keeps its own tag', 'keeps its severity tag']),
    'no paragraph of "## Re-review" says a new finding on an unchanged item is marked `missed earlier` and keeps its tag',
  );
});

test('pin 5: the reviewer never reads the planner replies, and reads its own continuation reply', () => {
  assert.ok(
    blockWith(receive, '# QUESTIONs applied', '# BLOCKERs fixed', '<alias>/planner', 'never read'),
    '"What you receive" does not say to never read the planner replies `# QUESTIONs applied` and `# BLOCKERs fixed` (posted `--as <alias>/planner`)',
  );
  assert.ok(
    blockWith(receive, '<alias>/reviewer', ["your own report's continuation", 'your own continuation', "your report's continuation"]),
    '"What you receive" does not say to read your own report\'s continuation, a reply posted `--as <alias>/reviewer`',
  );
  assert.ok(blockWith(receive, ["never the planner's summary", "never receive the planner's summary"]), "the planner's-summary rule is gone");
});

test('pin 6: plan-project step 8 passes, per story, that story\'s previous report cN and the mode', () => {
  assert.ok(
    blockWith(delegate,
      ['per story', 'for each story', "each story's", 'for every story'],
      ['previous report `cn`', "previous report's `cn`"],
      '`re-review`',
      '`full`'),
    'no item of "Delegate to the divergence reviewer" passes, per story, that story\'s previous report `cN` and the mode (`re-review` or `full`)',
  );
  assert.ok(
    blockWithout(step8, ['missing from the previous read log', ['counts as changed', 'count as changed', 'is changed', 'is treated as changed']],
      'missing from the previous read log', ['not count', 'never count', 'not treated', 'never treated', 'not changed', 'never changed', "doesn't count"]),
    'step 8 does not say an item missing from the previous read log counts as changed',
  );
});

test('pin 7: step 8 makes it full when a thread step into shape follows the previous report', () => {
  assert.ok(
    blockWithout(step8,
      ['`step` into `shape`', ['after the previous report', 'follows the previous report', 'following the previous report', 'since the previous report'], 'full'],
      'into shape', NOT_FULL),
    'step 8 does not say the mode is full when a thread `step` into `shape` follows the previous report',
  );
});

test('pin 8: step 8 makes it full when the person asks in the session', () => {
  assert.ok(
    blockWithout(step8,
      [['asks in the session', 'asks for one in the session', 'asks for a full review in the session', 'asks for a full one in the session'], 'full'],
      'in the session', NOT_FULL),
    'step 8 does not say the mode is full when the person asks (for one) in the session',
  );
});

test('pin 9: step 8 makes it full when the previous report has no Fingerprint column', () => {
  assert.ok(
    blockWithout(step8,
      [['previous report has no `fingerprint` column', 'previous report lacks a `fingerprint` column', 'previous report without a `fingerprint` column', 'previous report has no fingerprint column'], 'full'],
      'fingerprint', NOT_FULL),
    'step 8 does not say the mode is full when the previous report has no `Fingerprint` column',
  );
});

test('pin 10: step 8 treats a TC change alone as a re-review', () => {
  assert.ok(
    blocks(step8).some((b) => sentences(b).some((x) =>
      has(x, ['tc change', ['alone', 'included'], ['is a re-review', 'otherwise a re-review', 'does not make it full', 'does not make a review full', 'does not make the review full', 'not full']]) &&
      !['is full', 'is a full', 'makes it full', 'makes a review full', 'makes the review full', 'not a re-review', 'never a re-review', 'not make it a re-review'].some((p) => x.includes(p)))),
    'step 8 does not say, in one sentence, that a TC change alone is a re-review and does not make a review full',
  );
});

test('PROCESS.md, the plan gate item 1: a re-review also gets the previous report', () => {
  assert.ok(
    blockWith(gateItem1, 're-review', 'previous report'),
    'PROCESS.md "The plan gate" item 1 does not say a re-review also gets the previous report',
  );
});
