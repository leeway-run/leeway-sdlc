// LWY-266.3, round 1: two pins the frozen plugin/test/decide-it-yourself.test.mjs cannot carry (verdict c28's c26 and c27,
// decided in c29). That file is frozen at the round-0 commit, so these live beside it.
//   c26: a clause that forbids `BLOCKED` and then permits it for a case off the stop list ("unless", "save when", "whereas",
//        "aside from", ...) in sdlc-implementer.md and run's implementer prompt.
//   c27: a clause of run (and VERDICT.md) that puts the *Test* line into the fields file, even when it holds a negator that
//        does not govern the copy ("Do not forget to put ...", "... without delay").
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const plugin = process.env.PLUGIN_DIR || join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(plugin, path), 'utf8').replace(/\r\n/g, '\n');
const flat = (text) => text.replace(/\s+/g, ' ').trim();

// Same splitting as decide-it-yourself.test.mjs: blocks (paragraphs, a list after a colon joined), then clauses at . ; ! ? : and em dashes.
const blocks = (text) => {
  const out = [];
  for (const chunk of text.replace(/^[ \t]*>[ \t]?/gm, '').split(/\n[ \t]*\n/)) {
    if (out.length && (/^ {2,}\S/.test(chunk) || (/:\s*$/.test(out[out.length - 1]) && /^\s*(?:[-*+]|\d+[.)])\s/.test(chunk)))) out[out.length - 1] += `\n${chunk}`;
    else out.push(chunk);
  }
  return out.map(flat).filter(Boolean);
};
const clauses = (text) => flat(text).split(/(?<=[.;!?]|(?<!Status):)\s+|\s+—\s+/);
const itemClauses = (b) => b.split(/\s+(?:[-*+]|\d+[.)])\s+(?=[A-Z`*_])/).flatMap(clauses);
const clausesOf = (text) => blocks(text).flatMap((b) => itemClauses(b.replace(/\s+—\s+/g, ': ').replace(/([.!?])\*{1,2}\s+/g, '$1 ')));
const slice = (text, from, to) => {
  const start = text.indexOf(from);
  assert.notEqual(start, -1, `anchor not found: ${from}`);
  const end = text.indexOf(to, start + from.length);
  assert.notEqual(end, -1, `anchor not found: ${to}`);
  return text.slice(start, end);
};

// ---- c26: forbid `BLOCKED`, then permit it ------------------------------------------------------------------------------

const FORBIDS_BLOCKED = /\b(?:never|not|don't|doesn't|cannot|can't|nor)\b(?:\s+\w+){0,4}\s+\W*BLOCKED\b/i;
// Whatever follows the forbidden `BLOCKED` that takes the forbidding back, or sets a case apart from it.
const TAKES_BACK = /\b(?:unless|save|aside|apart|whereas|barring|bar|other than|except|excepting|but|though|although|yet|however|if|when|whenever|while|until)\b/i;
// The one tail that stays: the stop list itself ("..., unless it is on the stop list").
const STOP_LIST_TAIL = /^(?:unless|except)\s+(?:it|the question|the decision|a question|a decision)\s+(?:is|are)\s+on\s+the\s+stop[- ]list\W*$/i;
const forbidsThenPermits = (text) =>
  clausesOf(text).filter((c) => {
    const m = FORBIDS_BLOCKED.exec(c);
    if (!m) return false;
    const tail = c.slice(m.index + m[0].length);
    const at = tail.search(TAKES_BACK);
    return at !== -1 && !STOP_LIST_TAIL.test(tail.slice(at).trim());
  });

const implementerPrompt = () => slice(read('skills/run/SKILL.md'), '- **How it reaches Leeway**, in these words or the equivalent:', '> **Embed critical inputs');

test('AC-4 (c26): no clause of sdlc-implementer.md or of run\'s implementer prompt forbids `BLOCKED` and then permits it for a case off the stop list', () => {
  assert.deepEqual(forbidsThenPermits(read('agents/sdlc-implementer.md')), [], 'sdlc-implementer.md');
  assert.deepEqual(forbidsThenPermits(implementerPrompt()), [], "run's implementer prompt");
});

test('AC-4 (c26): the check flags each way of taking a forbidding back, and keeps the plain forbiddings', () => {
  for (const bad of [
    'Never return `BLOCKED` for a doubt unless you feel like it.',
    'Never return `BLOCKED` for a doubt, save when it is hard.',
    'Never return `BLOCKED` for a doubt, whereas for a hard one do.',
    'Never return `BLOCKED` for a doubt, aside from a hard one.',
    'Never return `BLOCKED` for a doubt, barring a hard one.',
    'Never return `BLOCKED` for a doubt, other than a hard one.',
    'Never return `BLOCKED` for a doubt, apart from a hard one.',
    'Never return `BLOCKED` for a doubt, except when it is hard.',
    'Do not return `BLOCKED` for a doubt, but do for a hard one.',
    'Never return `BLOCKED` for a doubt if it is hard.',
    'Never return `BLOCKED` for a question unless it is on the stop list or you are unsure.',
    'Never return `BLOCKED` for a question unless it is on the stop list, or you feel like it.',
  ]) {
    assert.notDeepEqual(forbidsThenPermits(bad), [], bad);
  }
  for (const good of [
    'Build it that way, and do not return `BLOCKED`.',
    'Write the gap under *Uncertainties* with the deciding criterion and build it that way, not `BLOCKED`.',
    'Never return `BLOCKED` for a question off the stop list.',
    'Never return `BLOCKED` for a question unless it is on the stop list.',
    'Return `BLOCKED` with a `## Question` block only for a question on the stop list, and never build a pick for it.',
  ]) {
    assert.deepEqual(forbidsThenPermits(good), [], good);
  }
});

// ---- c27: the *Test* line into the fields file ---------------------------------------------------------------------------

const TEST_LINE = /\*{1,2}Test:?\*{1,2}/;
// Only a negator right before the verb that copies counts: "is not copied", "must never be put", "does not copy". A negator before
// "forget", or "without delay", does not govern the copy.
const PUT_VERB = '(?:copied|copy|copies|copying|put|puts|putting|added|add|adds|sent|send|sends|included|include|includes|written|write|writes|placed|place|places|pasted|paste|pastes|raised|raise|raises)';
const NEGATED_COPY = new RegExp(`\\b(?:not|never|nor|isn't|aren't|don't|doesn't)\\s+(?:be\\s+|been\\s+)?${PUT_VERB}\\b`, 'i');
const KEPT_OUT = /^(?:(?!\b(?:not|never|nor|don't|doesn't)\b).)*\b(?:kept|keep|left|leave|leaves|stays|stay)\b[^.]{0,30}\bout of\b/i;
const putsTestIntoFields = (text) =>
  clausesOf(text).filter((c) => TEST_LINE.test(c) && /\bfields?\b/i.test(c) && !NEGATED_COPY.test(c) && !KEPT_OUT.test(c));

test('AC-4 (c27): no clause of run or of VERDICT.md puts the *Test* line into the fields file', () => {
  assert.deepEqual(putsTestIntoFields(read('skills/run/SKILL.md')), [], 'run');
  assert.deepEqual(putsTestIntoFields(read('skills/run/templates/VERDICT.md')), [], 'VERDICT.md');
});

test('AC-4 (c27): the check flags a negator that does not govern the copy, and keeps the sentences that keep the *Test* out', () => {
  for (const bad of [
    'Do not forget to put the *Test* line into the fields file.',
    'Never forget to copy the *Test* line into the fields.',
    'Raise the *Test* line in the fields file without delay.',
    'Do not hesitate to add the *Test* line to the fields file.',
    'Do not omit the *Test* line from the fields file.',
    'The *Test* line goes into the fields file.',
    'Copy each line, the *Test* line too, into the fields file.',
    'Never keep the *Test* line out of the fields file.',
  ]) {
    assert.notDeepEqual(putsTestIntoFields(bad), [], bad);
  }
  for (const good of [
    'The *Test* line is not copied into the fields file, it goes to the live finding with the pick.',
    'The **Test** line is never copied into the fields file.',
    'The *Test* line must not be put into the fields file.',
    'The orchestrator does not copy this line into the escalation\'s fields: the *Test* line stays with the finding.',
    'Keep the *Test* line out of the fields file.',
    'Each line goes to its field, except the *Test* line, which is not copied into the fields file.',
  ]) {
    assert.deepEqual(putsTestIntoFields(good), [], good);
  }
});
