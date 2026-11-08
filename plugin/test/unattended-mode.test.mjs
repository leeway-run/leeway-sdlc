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

// A mention of a permission list or rule. Only a negator standing directly before the term ("writes no allow rule") is not one:
// a "not" elsewhere in the sentence excuses nothing.
const NEGATED_BEFORE = /\b(no|not|never|without|none)\s+((write|writes|add|adds|keep|keeps|name|names|needs?)\s+)?((an?|the|any)\s+)?(permission\s+)?$/i;
const mentions = (text, term) => {
  const flatText = flat(text);
  return [...flatText.matchAll(term)].filter((m) => !NEGATED_BEFORE.test(flatText.slice(0, m.index))).map((m) => m[0]);
};
const LIST = /allow[- ]?list|allow[- ]rules?|permission rules?|permissions\.allow|\bBash\(/gi;
const rulesNamed = (text) => mentions(text, LIST);

// A sentence that ties a merge to a permission prompt, however it is worded. Only "no (permission) prompt" is allowed.
const sentences = (text) => flat(text).split(/(?<=[.!?;])\s+/);
const PROMPT = /\bprompts?\b/gi;
const promptClaims = (text) => sentences(text).filter((s) => /merg/i.test(s) && mentions(s, PROMPT).length > 0);
const promptsIn = (text) => mentions(text, PROMPT);

test('TC-2: HARNESS says an unattended run uses auto mode, and without it a person approves each prompt', () => {
  const text = permissions();
  assert.match(text, /auto mode/i);
  assert.match(text, /person approves (each|every) prompt/i);
  assert.match(text, /UNVERIFIED/i);
  assert.doesNotMatch(text, /Say before the yes/);
  assert.doesNotMatch(text, /\| run's list names \|/);
  assert.doesNotMatch(text, /Bash\(git -C \*/);
  assert.match(text, /verb[- ]first/i);
  assert.match(text, /--server/);
  assert.match(text, /git -C/);
});

test('TC-1: HARNESS, run, PROCESS and the agents tell nobody to write or rely on a permission rule', () => {
  for (const file of ['plugin/HARNESS.md', 'plugin/skills/run/SKILL.md', 'plugin/PROCESS.md', 'plugin/agents/sdlc-implementer.md', 'plugin/agents/sdlc-reviewer.md']) {
    assert.deepEqual(rulesNamed(read(file)), [], file);
  }
});

test('TC-1: the bin scripts and the manifest check say bin/ gives every person and version the same command, with no rule named', () => {
  for (const file of ['plugin/bin/leeway-sdlc-raise', 'plugin/bin/leeway-sdlc-session-tokens', 'plugin/bin/leeway-sdlc-wait-answer', '.github/scripts/check-manifests.mjs']) {
    const text = read(file);
    assert.doesNotMatch(text, /allow[- ]?list|allow[- ]rules?/i, file);
    assert.match(text, /same command|every person|every version|per-version/i, file);
  }
});

test('TC-1: PROCESS prints a call verb first without a rule, and the CLI\'s own raise is not said to sit on a list', () => {
  const process_ = flat(read('plugin/PROCESS.md'));
  const verb = process_.slice(process_.indexOf('**Verb first.**'), process_.indexOf('- Long bodies go in through'));
  assert.ok(verb.length > 0, 'no "Verb first." bullet');
  assert.match(verb, /<cli> --server <server> <resource> <verb> <args> --as <alias>\/<role> --json/);
  assert.deepEqual(rulesNamed(verb), []);
  assert.doesNotMatch(verb, /matches the text before its first/);
  const raise = process_.match(/The CLI's own raise, with the fields as flags[^.]*\./);
  assert.ok(raise, 'no sentence on the CLI\'s own raise');
  assert.deepEqual(rulesNamed(raise[0]), []);
  assert.doesNotMatch(raise[0], /off run's/);
});

test('TC-2: run, "Unattended prerequisites", has no allow-list item and names the agent\'s unattended mode', () => {
  const text = prereqs();
  assert.doesNotMatch(text, /A permission allow-list|What the list cannot promise/);
  assert.match(text, /unattended mode/i);
  assert.match(text, /HARNESS\.md/);
  assert.match(text, /`node -e`[^.]*\b(lanes?|lane commands)\b[^.]*can run anything/i);
  assert.match(text, /You never answer your own escalation/);
  assert.match(text, /held[^.]*rule|rule[^.]*not[^.]*list/i);
});

test('TC-3: run still requires the pre-push guard, and says --no-verify and core.hooksPath skip it', () => {
  const text = prereqs();
  const guard = text.slice(text.indexOf('**A pre-push guard'), text.indexOf('**A per-worktree setup command'));
  assert.ok(guard.length > 0, 'no guard bullet');
  assert.match(guard, /refuses the integration branch and a force push/);
  assert.match(guard, /`--no-verify`/);
  assert.match(guard, /`-c core\.hooksPath`/);
  assert.doesNotMatch(guard, /allow-?list|allow rule|`push` verb off/i);
  const pre6 = flat(run.slice(run.indexOf('6. **The unattended prerequisites are in place**')));
  assert.match(pre6.slice(0, 300), /The unattended prerequisites are in place\*\*[^.]*or a human is watching and says so/);
  assert.deepEqual(rulesNamed(pre6.slice(0, 300)), []);
});

test('TC-4: the plan merges on the person\'s word, and no permission prompt is said to hold it', () => {
  assert.match(run, /\*\*The plan merges into `main` on the person's word; no run merges it by itself\.\*\*/);
  const all = prereqs();
  const guardAt = all.indexOf('- **A pre-push guard');
  const mergeAt = all.lastIndexOf('`gh pr merge`', guardAt);
  const para = mergeAt < 0 ? '' : all.slice(mergeAt, guardAt);
  assert.ok(para.length > 0, 'no paragraph on `gh pr merge` in "Unattended prerequisites"');
  assert.match(para, /person's word/);
  assert.deepEqual(rulesNamed(para), []);
  assert.deepEqual(promptsIn(para), [], 'a permission prompt is tied to the merge');
  assert.deepEqual(promptClaims(run), [], 'a sentence in run ties a merge to a prompt');
});

test('TC-1: run mentions no allow-list at all, except in a sentence saying the plugin writes no rule', () => {
  const stray = sentences(run).filter((s) => /allow[- ]?list/i.test(s) && !/\bwrites? no (allow|permission) rules?\b/i.test(s));
  assert.deepEqual(stray, []);
});

test('negative: the printed call forms stay, in run and in both agents, with the reason for them and no list named', () => {
  const line = flat(run.slice(run.indexOf('**Every call is printed verb first**'), run.indexOf('## What the ref is')));
  assert.match(line, /`leeway spend record <ref> 3 --as <alias>\/agent --json`/);
  assert.match(line, /Write each call as it is printed here, `--server` included\./);
  assert.deepEqual(rulesNamed(line), []);
  for (const file of ['plugin/agents/sdlc-implementer.md', 'plugin/agents/sdlc-reviewer.md']) {
    const text = flat(read(file));
    assert.match(text, /<cli> --server <server> /, file);
    assert.match(text, /`git -C <the worktree's absolute path>`/, file);
    assert.match(text, /`cd <path> && git`[^.]*prompts|prompts[^.]*`cd <path> && git`/, file);
    assert.match(text, /(one|a single) (call|command|git verb)|per verb|one verb|verb per call/i, file);
    assert.deepEqual(rulesNamed(text), [], file);
  }
});
