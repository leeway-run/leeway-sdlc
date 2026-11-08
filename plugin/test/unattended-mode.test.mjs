import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (path) => readFileSync(join(root, path), 'utf8').replace(/\r\n/g, '\n');
const flat = (text) => text.replace(/\s+/g, ' ');

// The text under `heading` (any level), up to the next heading of the same or a higher level, on one line.
function under(doc, heading) {
  const m = doc.match(new RegExp(`\\n(#+) ${heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\n`));
  assert.ok(m, `no "${heading}" heading`);
  const start = m.index + 1;
  const next = new RegExp(`\\n#{1,${m[1].length}} `, 'g');
  next.lastIndex = start + 1;
  const end = next.exec(doc);
  return flat(doc.slice(start, end ? end.index : undefined));
}

const harness = read('plugin/HARNESS.md');
const run = read('plugin/skills/run/SKILL.md');
const permissions = () => under(harness, 'Permissions for an unattended run');
const prereqs = () => under(run, 'Unattended prerequisites');
const LIST = /allow[- ]?list|allow rule|permission (allow )?rule|permissions\.allow|\bBash\(/i;

test('TC-2: HARNESS says an unattended run uses auto mode, and without it a person approves each prompt', { skip: 'red-test-TC-2: HARNESS still has the rule table' }, () => {
  const text = permissions();
  assert.match(text, /auto mode/i);
  assert.match(text, /person approves each prompt/i);
  assert.match(text, /UNVERIFIED/);
  assert.doesNotMatch(text, /Say before the yes/);
  assert.doesNotMatch(text, /\| run's list names \|/);
  assert.doesNotMatch(text, /Bash\(git -C \*/);
});

test('TC-1: HARNESS, run, PROCESS and the agents tell nobody to write or rely on a permission rule', { skip: 'red-test-TC-1: these files still name an allow-list' }, () => {
  assert.doesNotMatch(permissions(), LIST);
  assert.doesNotMatch(run, LIST);
  for (const file of ['plugin/PROCESS.md', 'plugin/agents/sdlc-implementer.md', 'plugin/agents/sdlc-reviewer.md']) {
    assert.doesNotMatch(read(file), LIST, file);
  }
});

test('TC-1: the bin scripts and the manifest check no longer say a rule names them', { skip: 'red-test-TC-1: the headers still say "so an allow rule can name it"' }, () => {
  for (const file of ['plugin/bin/leeway-sdlc-raise', 'plugin/bin/leeway-sdlc-session-tokens', 'plugin/bin/leeway-sdlc-wait-answer', '.github/scripts/check-manifests.mjs']) {
    assert.doesNotMatch(read(file), /allow rule/i, file);
  }
});

test('TC-2: run, "Unattended prerequisites", has no allow-list item and names the agent\'s unattended mode', { skip: 'red-test-TC-2: run still opens with "A permission allow-list"' }, () => {
  const text = prereqs();
  assert.doesNotMatch(text, /A permission allow-list|What the list cannot promise/);
  assert.match(text, /unattended mode/i);
  assert.match(text, /HARNESS\.md/);
  assert.match(text, /`node -e` and the lane commands can run anything/);
  assert.match(text, /You never answer your own escalation/);
});

test('TC-3: run still requires the pre-push guard, and says --no-verify and core.hooksPath skip it', { skip: 'red-test-TC-3: the guard bullet is still tied to the allow-list' }, () => {
  const text = prereqs();
  const guard = text.slice(text.indexOf('**A pre-push guard'), text.indexOf('**A per-worktree setup command'));
  assert.ok(guard.length > 0, 'no guard bullet');
  assert.match(guard, /refuses the integration branch and a force push/);
  assert.match(guard, /`--no-verify`/);
  assert.match(guard, /`-c core\.hooksPath`/);
  assert.doesNotMatch(guard, /allow-list|`push` verb off/i);
  const pre6 = flat(run.slice(run.indexOf('6. **The unattended prerequisites are in place**')));
  assert.match(pre6.slice(0, 300), /The unattended prerequisites are in place\*\* \(below\), or a human is watching and says so/);
  assert.doesNotMatch(pre6.slice(0, 300), LIST);
});

test('TC-4: the plan merges on the person\'s word, and no permission prompt is said to hold it', { skip: 'red-test-TC-4: run says the prompt is where the person\'s yes is their word' }, () => {
  assert.match(run, /\*\*The plan merges into `main` on the person's word; no run merges it by itself\.\*\*/);
  const para = prereqs().slice(prereqs().indexOf('`gh pr merge`'), prereqs().indexOf('- **A pre-push guard'));
  assert.match(para, /the plan merges into `main` on the person's word/i);
  assert.doesNotMatch(para, /prompt|allow-list/i);
  assert.doesNotMatch(flat(run), /gh pr merge[^.]*\bprompt|\bprompt[^.]*gh pr merge/i);
});

test('negative: the printed call forms stay, and line 33 names no list', { skip: 'red-test-TC-2: line 33 still says the order "the allow-list matches"' }, () => {
  const line = flat(run.slice(run.indexOf('**Every call is printed verb first**'), run.indexOf('## What the ref is')));
  assert.match(line, /`leeway spend record <ref> 3 --as <alias>\/agent --json`/);
  assert.match(line, /Write each call as it is printed here, `--server` included\./);
  assert.doesNotMatch(line, LIST);
  assert.match(flat(read('plugin/agents/sdlc-implementer.md')), /`git -C <the worktree's absolute path>`/);
});
