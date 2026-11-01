import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const skills = join(dirname(fileURLToPath(import.meta.url)), '..', 'skills');
const read = (...path) => readFileSync(join(skills, ...path), 'utf8').replace(/\r\n/g, '\n');
const skill = read('sdlc-install', 'SKILL.md');
const detection = read('sdlc-install', 'references', 'detection.md');
const oneLine = (text) => text.replace(/\s+/g, ' ');

const interview = skill.slice(skill.indexOf('## Step 4'), skill.indexOf('## Step 5'));
const questions = [...interview.matchAll(/^(\d+)\. \*\*([^*]+)\*\*([\s\S]*?)(?=^\d+\. \*\*|^\S)/gm)].map(
  ([, n, title, body]) => ({ n: Number(n), title, body: body.replace(/\s+/g, ' ') }),
);
const words = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven',
  'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];

test('the question cap is the number of numbered questions, numbered in order', () => {
  const cap = /\*\*At most (\w+) questions/.exec(interview);
  assert.ok(cap, 'the interview states no cap');
  assert.deepEqual(questions.map((q) => q.n), questions.map((_, i) => i + 1));
  assert.equal(words.indexOf(cap[1]), questions.length);
});

test('the conditional questions are asked only on a divergence, and raised as yes/no', () => {
  const yesNo = /\*\*Yes\/no questions\*\* \(([^)]*)\)/.exec(skill);
  assert.ok(yesNo, 'no yes/no list in "Where the human is asked"');
  const conditional = questions.filter((q) => q.n >= 13);
  assert.deepEqual(
    conditional.map((q) => q.title),
    ['What the block repeats.', 'Branch prefixes.', 'Blocking rungs.', 'The unattended allow-list.'],
  );
  for (const q of conditional) {
    assert.match(q.body, /\bonly when\b/, `question ${q.n} (${q.title}) has no condition`);
    assert.match(yesNo[1], new RegExp(`\\b${q.n}\\b`), `question ${q.n} is not in the yes/no list`);
  }
});

test('the floor is imported once: the fill follows the file, and sync-repo fills it the same way', () => {
  const q13 = questions.find((q) => q.n === 13);
  assert.match(q13.body, /\*\*Never a second import of the floor\*\*/);
  assert.match(q13.body, /`\{\{IMPORT_FLOOR\}\}` follows the file, not the answer/);

  const start = skill.indexOf('- **`{{IMPORT_FLOOR}}`**');
  assert.ok(start >= 0, 'no {{IMPORT_FLOOR}} placeholder entry');
  const entry = oneLine(skill.slice(start, skill.indexOf('\n- **`{{', start + 1)));
  assert.match(entry, /already imports the floor outside the markers\*\* \(after question 13's write\), the read-first line in every agent: a second import is never written/);
  assert.doesNotMatch(entry, /keep both/i, 'the fill must not depend on the answer');

  const row = read('sync-repo', 'SKILL.md').split('\n').find((line) => line.startsWith('| the contract block |'));
  assert.ok(row, 'sync-repo has no contract-block row');
  assert.match(row, /`\{\{IMPORT_FLOOR\}\}` as the read-first line when the instructions file already imports the floor outside the markers/);
});

test('the branch-prefix count names each branch once and ignores remote-tracking merges', () => {
  const pipeline = /```sh\n(\{ git for-each-ref[\s\S]*?)\n```/.exec(detection);
  assert.ok(pipeline, 'detection.md has no branch-prefix pipeline');
  const dir = mkdtempSync(join(tmpdir(), 'prefixes-'));
  const git = (...args) =>
    execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', ...args], {
      cwd: dir,
      stdio: 'pipe',
    });
  try {
    git('init', '-q', '-b', 'main');
    git('commit', '-q', '--allow-empty', '-m', 'root');
    for (const branch of ['feature/a', 'feature/b']) {
      git('switch', '-q', '-c', branch);
      git('commit', '-q', '--allow-empty', '-m', branch);
      git('switch', '-q', 'main');
      git('merge', '-q', '--no-ff', '-m', `Merge branch '${branch}'`, branch);
    }
    for (let i = 0; i < 3; i += 1) {
      git('switch', '-q', '-c', `side${i}`);
      git('commit', '-q', '--allow-empty', '-m', `side ${i}`);
      git('switch', '-q', 'main');
      git('merge', '-q', '--no-ff', '-m', "Merge remote-tracking branch 'origin/main'", `side${i}`);
    }
    const counts = execFileSync('bash', ['-c', pipeline[1]], { cwd: dir, encoding: 'utf8' });
    assert.deepEqual(counts.trim().split('\n').map((line) => line.trim()), ['2 feature']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
