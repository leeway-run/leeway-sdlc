import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// LWY-189.2: sdlc-install writes no permission rule, and question 16 is the pre-push guard on its own.

const skills = join(dirname(fileURLToPath(import.meta.url)), '..', 'skills');
const read = (...path) => readFileSync(join(skills, ...path), 'utf8').replace(/\r\n/g, '\n');
const flat = (text) => text.replace(/\s+/g, ' ');
const skill = read('sdlc-install', 'SKILL.md');
const detection = read('sdlc-install', 'references', 'detection.md');

const interview = skill.slice(skill.indexOf('## Step 4'), skill.indexOf('## Step 5'));
const questions = [...interview.matchAll(/^(\d+)\. \*\*([^*]+)\*\*([\s\S]*?)(?=^\d+\. \*\*|^\S)/gm)].map(
  ([, n, title, body]) => ({ n: Number(n), title, body: flat(body) }),
);
const q16 = questions.find((q) => q.n === 16);

// A mention of a permission list or rule. Only a negator standing directly before the term ("writes no allow rule") is
// not one: a "not" elsewhere in the sentence excuses nothing.
const NEGATED_BEFORE = /\b(no|not|never|without|none)\s+((write|writes|add|adds|keep|keeps|name|names|needs?)\s+)?((an?|the|any)\s+)?(permission\s+)?$/i;
const mentions = (text, term) => {
  const flatText = flat(text);
  return [...flatText.matchAll(term)].filter((m) => !NEGATED_BEFORE.test(flatText.slice(0, m.index))).map((m) => m[0]);
};
const LIST = /allow[- ]?list|allow[- ]rules?|permission rules?|\bpermissions\b|\bBash\(/gi;
const rulesNamed = (text) => mentions(text, LIST);

// What only a rule-writing install says: the rules' words, the warnings' counts, the push rule, the file they went in.
const RULE_TALK = /Say before the yes|\bfourteen\b|\bfifteen\b|push rule|missing entr|(on|off) the list|An existing allow-list|\.claude\/settings\.json|16's offer/i;

// The writes of step 6 for question 16: "16, yes" now, "16, yes: merge" and "16's offer, yes" in today's text.
const guardBullets = () => skill.split(/\n(?=- \*\*)/).filter((b) => /^- \*\*16(?:'s offer)?, yes\*\*/.test(b)).map((b) => flat(b.split('\n### ')[0]));
const guardStep = () => guardBullets().at(-1);

// The closing paragraph, up to the shape of the report that follows it.
const endingStart = skill.indexOf('**Then state what this install did not settle**');
const closing = flat(skill.slice(endingStart, skill.indexOf('Write each item for a reader', endingStart)));

// Words that only a permission list needs, on top of RULE_TALK. A negator directly before one excuses it. Excluded, because
// they are not about a list: detection's "entry point" (a build file) and "which git allows" (a branch name with a `'`).
const PERMISSION_WORDS = [/\bpermissions?\b/gi, /\ballow(?:ed|s)?\b/gi, /settings\.json|Claude settings/gi, /\bentr(?:y|ies)\b/gi];
const permissionWords = (text) => PERMISSION_WORDS.flatMap((term) => mentions(text.replace(/entry points?/gi, '').replace(/which git allows/g, ''), term));

test('TC-1: the install says nothing of a permission rule or allow-list, in the skill or in detection', () => {
  assert.deepEqual(rulesNamed(skill), [], 'SKILL.md');
  assert.deepEqual(rulesNamed(detection), [], 'references/detection.md');
  assert.doesNotMatch(flat(skill), RULE_TALK, 'SKILL.md');
  assert.doesNotMatch(flat(detection), RULE_TALK, 'references/detection.md');
});

test('TC-1: nothing the install writes in step 6 is a rule: the "16, yes" merge into permissions.allow is gone', () => {
  assert.doesNotMatch(flat(skill), /\*\*16, yes\*\*: merge/);
  const step = guardStep();
  assert.doesNotMatch(step, RULE_TALK);
  assert.deepEqual(rulesNamed(step), []);
});

test('TC-3: question 16 is "The pre-push guard", asked only when no guard counts, so a guard found means it is not asked', () => {
  assert.ok(q16, 'no question 16');
  assert.equal(q16.title, 'The pre-push guard.');
  assert.match(q16.body, /Asked in step 5, only when the process read back has a `build` step with `unattended` true and detection \("A pre-push guard"\) (finds|found) no guard that counts/);
  assert.doesNotMatch(q16.body, /\bor \("A pre-push guard"\)/, 'a missing guard is one of two conditions, so a guard found can still ask');
  assert.doesNotMatch(q16.body, /An existing allow-list/);
});

test('TC-3: before the yes, question 16 says run needs the guard, what skips it, and that it stays in this clone', () => {
  assert.match(q16.body, /`run` needs the guard for an unattended run/);
  assert.match(q16.body, /`--no-verify` and `-c core\.hooksPath` skip it/);
  assert.match(q16.body, /it stays in this clone/);
});

test('TC-1: question 16 mentions no rule, no warning count and no push rule', () => {
  assert.deepEqual(rulesNamed(q16.body), []);
  assert.doesNotMatch(q16.body, RULE_TALK);
});

test('TC-3: the offer keeps today\'s wording, minus the rule sentences', () => {
  assert.match(q16.body, /ask "Write a pre-push guard to `<the path detection printed>`\? It refuses a push to `<integration branch>` and a force push to any ref, and lets other pushes through, `run`'s `HEAD:<base>` to a plan branch included\."/);
  assert.match(q16.body, /Pre-filled yes\./);
  assert.match(q16.body, /A hook or `core\.hooksPath` in the way:\*\* make no offer\. Never overwrite it and never chain to it silently\./);
  assert.match(q16.body, /`scaffold\/hooks\/pre-push\.tmpl` in this skill is the script to combine/);
  assert.match(q16.body, /A `'` in the integration branch's name:\*\* make no offer\. Say why: the script holds the name in single quotes, so a `'` breaks it and it then refuses every push from this clone\./);
});

test('TC-3: a yes writes the guard to the path detection printed and tries it; the try, the re-check and the refusal case stay', () => {
  const step = guardStep();
  assert.match(step, /run detection's first and third commands again: if anything is now at that path or `core\.hooksPath` is set, write nothing, and it is the branch "A hook or `core\.hooksPath` in the way"/);
  assert.match(step, /write `scaffold\/hooks\/pre-push\.tmpl` in this skill to that path, with `\{\{INTEGRATION_BRANCH\}\}` filled from the integration branch/);
  assert.match(step, /echo "HEAD 0 refs\/heads\/<integration branch> 0" \| <that path>; echo \$\?/);
  assert.match(step, /echo "HEAD 0 refs\/heads\/<any other branch> 0" \| <that path>; echo \$\?/);
  assert.match(step, /Say where you put it\. If the try prints anything else, delete the file this install just wrote: say what it printed\./);
  assert.match(step, /If the write or the `chmod` is refused, tell the person what to do themselves, which is to put that same filled script, printed in full, at `<that path>` and make it executable/);
  assert.doesNotMatch(step, /allow|push rule|`git push`/i);
});

test('TC-3: "What waits" and the yes/no list have no second offer to number: question 16 is the guard question alone', () => {
  assert.doesNotMatch(skill, /question 16's offer|16's offer/);
  const yesNo = /\*\*Yes\/no questions\*\* \(([^)]*)\)/.exec(skill);
  assert.ok(yesNo, 'no yes/no list');
  assert.match(yesNo[1], /\b16\b/);
  assert.deepEqual(questions.map((q) => q.n), questions.map((_, i) => i + 1), 'a gap in the numbering');
  assert.equal(q16 && questions.at(-1).n, 16);
});

test('TC-1: the closing report names the guard outcomes and no allow-list outcome', () => {
  const start = skill.indexOf('**Then state what this install did not settle**');
  assert.ok(start >= 0, 'no closing paragraph');
  const ending = flat(skill.slice(start));
  assert.doesNotMatch(ending, /allow-list|an allow-list|startup warnings|push rule|too wide/i);
  assert.match(ending, /a pre-push guard written \(where it is, and that another clone gets one by running this install there\)/);
  assert.match(ending, /a hook or `core\.hooksPath` that kept the guard from being written \(what is there, and that the guard is theirs to combine\)/);
  assert.match(ending, /a `'` in the integration branch's name that did \(why, and that the guard is theirs to write\)/);
  assert.match(ending, /a guard the write or `chmod` was refused for \(what the person is to put where\)/);
});

test('TC-1: detection no longer reads an allow-list, and keeps the guard and whether the install can write one', () => {
  const text = flat(detection);
  assert.ok(!text.includes('**An existing allow-list.**'));
  assert.ok(text.includes('**A pre-push guard.**'));
  assert.ok(text.includes('**Whether the install can write a guard.**'));
  assert.doesNotMatch(text, /push[`]? is not a missing entry|a repo already at fourteen rules|An existing push rule with no guard/);
  assert.match(text, /Report what you found, and why a hook you found does not count\. Question 16 tells the person the truth by it\./);
});

test('TC-1: question 16, its yes step, the ending and detection use no permission vocabulary, however it is reworded', () => {
  assert.deepEqual(permissionWords(q16.body), [], 'question 16');
  assert.deepEqual(permissionWords(guardBullets().join(' ')), [], 'the "16, yes" bullet');
  assert.deepEqual(permissionWords(closing), [], 'the ending');
  assert.deepEqual(permissionWords(detection), [], 'references/detection.md');
  assert.deepEqual(mentions(q16.body, /`git push`/g), [], 'a `git push` in question 16');
});

test('TC-3: question 16 offers only on the three branches of today\'s offer, and a no is "no guard: an unattended run cannot start"', () => {
  const bullets = [...(' ' + q16.body).matchAll(/ - \*\*([^*]+)\*\*/g)].map((m) => m[1]);
  assert.deepEqual(bullets, [
    'Nothing in the way:',
    'A hook or `core.hooksPath` in the way:',
    'A `\'` in the integration branch\'s name:',
  ]);
  for (const sentence of q16.body.split(/(?<=[.?!]) /).filter((s) => /\bguard (is )?found\b/i.test(s))) {
    assert.match(sentence, /\b(not|no|never|nothing)\b/i, `a guard found must not ask or offer: ${sentence}`);
  }
  assert.match(q16.body, /no guard[^.]*an unattended run cannot start/i);
});

test('TC-3: the ending keeps "no guard: an unattended run cannot start"', () => {
  assert.match(closing, /no guard[^.]*an unattended run cannot start/i);
});

// This one passes today and must keep passing: the negative case that a hook in the way is never overwritten.
test('a hook or core.hooksPath already in the way is never overwritten, and nothing chains to it silently', () => {
  const text = flat(skill);
  assert.match(text, /Never overwrite it and never chain to it silently/);
  assert.match(text, /if anything is now at that path or `core\.hooksPath` is set, write nothing/);
  const scope = { 'question 16': q16.body, 'the 16 yes step': guardBullets().join(' '), 'detection.md': flat(detection) };
  for (const [where, body] of Object.entries(scope)) {
    for (const m of body.matchAll(/overwrit\w*/gi)) {
      assert.match(body.slice(0, m.index), /\b(never|not)\s+$/i, `${where}: "${body.slice(Math.max(0, m.index - 30), m.index + 20)}" is not directly after a negator`);
    }
  }
});
