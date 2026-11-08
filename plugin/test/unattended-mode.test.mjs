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

// Naming a permission list or rule. A sentence that negates it ("writes no allow rule") is not an instruction to write one.
const LIST = /allow[- ]?list|allow[- ]rules?|permission rules?|permissions\.allow|\bBash\(/i;
const NEGATES = /\b(no|not|never|none|nor|neither|without|instead|rather than|gone|replaces?|replaced)\b|n't/i;
// Clauses, so that a negation in one clause does not excuse a claim in the next.
const sentences = (text) => flat(text).split(/(?<=[.!?,;])\s+/);
const instructing = (text) => sentences(text).filter((s) => !NEGATES.test(s)).join(' ');

// A claim that a permission prompt holds, gates or is where the yes is given. "No permission prompt holds it" is not that claim.
const PROMPT_HOLDS = /prompt[^.]*\b(yes|word|holds?|held|stops?|gates?|gated|asks?)\b|\b(yes|word|holds?|held|stops?|gates?|gated)\b[^.]*prompt/i;
const promptHolds = (text) => sentences(text).filter((s) => !NEGATES.test(s) && PROMPT_HOLDS.test(s));

test('TC-2: HARNESS says an unattended run uses auto mode, and without it a person approves each prompt', { skip: 'red-test-TC-2: HARNESS still has the rule table' }, () => {
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

test('TC-1: HARNESS, run, PROCESS and the agents tell nobody to write or rely on a permission rule', { skip: 'red-test-TC-1: these files still name an allow-list' }, () => {
  for (const file of ['plugin/HARNESS.md', 'plugin/skills/run/SKILL.md', 'plugin/PROCESS.md', 'plugin/agents/sdlc-implementer.md', 'plugin/agents/sdlc-reviewer.md']) {
    assert.doesNotMatch(instructing(read(file)), LIST, file);
  }
});

test('TC-1: the bin scripts and the manifest check say bin/ gives every person and version the same command, with no rule named', { skip: 'red-test-TC-1: the headers still say "so an allow rule can name it"' }, () => {
  for (const file of ['plugin/bin/leeway-sdlc-raise', 'plugin/bin/leeway-sdlc-session-tokens', 'plugin/bin/leeway-sdlc-wait-answer', '.github/scripts/check-manifests.mjs']) {
    const text = read(file);
    assert.doesNotMatch(text, /allow[- ]?list|allow[- ]rules?/i, file);
    assert.match(text, /same command|every person|every version|per-version/i, file);
  }
});

test('TC-1: PROCESS prints a call verb first without a rule, and the CLI\'s own raise is not said to sit on a list', { skip: 'red-test-TC-1: PROCESS lines 106 and 317 still name a permission rule and the allow-list' }, () => {
  const process_ = flat(read('plugin/PROCESS.md'));
  const verb = process_.slice(process_.indexOf('**Verb first.**'), process_.indexOf('- Long bodies go in through'));
  assert.ok(verb.length > 0, 'no "Verb first." bullet');
  assert.match(verb, /<cli> --server <server> <resource> <verb> <args> --as <alias>\/<role> --json/);
  assert.doesNotMatch(instructing(verb), LIST);
  assert.doesNotMatch(verb, /matches the text before its first/);
  const raise = process_.match(/The CLI's own raise, with the fields as flags[^.]*\./);
  assert.ok(raise, 'no sentence on the CLI\'s own raise');
  assert.doesNotMatch(instructing(raise[0]), LIST);
  assert.doesNotMatch(raise[0], /off run's/);
});

test('TC-2: run, "Unattended prerequisites", has no allow-list item and names the agent\'s unattended mode', { skip: 'red-test-TC-2: run still opens with "A permission allow-list"' }, () => {
  const text = prereqs();
  assert.doesNotMatch(text, /A permission allow-list|What the list cannot promise/);
  assert.match(text, /unattended mode/i);
  assert.match(text, /HARNESS\.md/);
  assert.match(text, /`node -e`[^.]*\b(lanes?|lane commands)\b[^.]*can run anything/i);
  assert.match(text, /You never answer your own escalation/);
  assert.match(text, /held[^.]*rule|rule[^.]*not[^.]*list/i);
});

test('TC-3: run still requires the pre-push guard, and says --no-verify and core.hooksPath skip it', { skip: 'red-test-TC-3: the guard bullet is still tied to the allow-list' }, () => {
  const text = prereqs();
  const guard = text.slice(text.indexOf('**A pre-push guard'), text.indexOf('**A per-worktree setup command'));
  assert.ok(guard.length > 0, 'no guard bullet');
  assert.match(guard, /refuses the integration branch and a force push/);
  assert.match(guard, /`--no-verify`/);
  assert.match(guard, /`-c core\.hooksPath`/);
  assert.doesNotMatch(guard, /allow-?list|allow rule|`push` verb off/i);
  const pre6 = flat(run.slice(run.indexOf('6. **The unattended prerequisites are in place**')));
  assert.match(pre6.slice(0, 300), /The unattended prerequisites are in place\*\*[^.]*or a human is watching and says so/);
  assert.doesNotMatch(instructing(pre6.slice(0, 300)), LIST);
});

test('TC-4: the plan merges on the person\'s word, and no permission prompt is said to hold it', { skip: 'red-test-TC-4: run says the prompt is where the person\'s yes is their word' }, () => {
  assert.match(run, /\*\*The plan merges into `main` on the person's word; no run merges it by itself\.\*\*/);
  const all = prereqs();
  const guardAt = all.indexOf('- **A pre-push guard');
  const mergeAt = all.lastIndexOf('`gh pr merge`', guardAt);
  const para = mergeAt < 0 ? '' : all.slice(mergeAt, guardAt);
  assert.doesNotMatch(instructing(para), LIST);
  assert.deepEqual(promptHolds(para), []);
  const merging = sentences(run).filter((s) => /merge|person's (yes|word)/i.test(s));
  assert.deepEqual(promptHolds(merging.join(' ')), []);
});

test('negative: the printed call forms stay, in run and in both agents, with the reason for them and no list named', { skip: 'red-test-TC-2: line 33 and the agents still say the order "the allow-list matches"' }, () => {
  const line = flat(run.slice(run.indexOf('**Every call is printed verb first**'), run.indexOf('## What the ref is')));
  assert.match(line, /`leeway spend record <ref> 3 --as <alias>\/agent --json`/);
  assert.match(line, /Write each call as it is printed here, `--server` included\./);
  assert.doesNotMatch(instructing(line), LIST);
  for (const file of ['plugin/agents/sdlc-implementer.md', 'plugin/agents/sdlc-reviewer.md']) {
    const text = flat(read(file));
    assert.match(text, /<cli> --server <server> /, file);
    assert.match(text, /`git -C <the worktree's absolute path>`/, file);
    assert.match(text, /`cd <path> && git`[^.]*prompts|prompts[^.]*`cd <path> && git`/, file);
    assert.match(text, /(one|a single) (call|command|git verb)|per verb|one verb|verb per call/i, file);
    assert.doesNotMatch(instructing(text), LIST, file);
  }
});
