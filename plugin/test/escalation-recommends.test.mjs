// LWY-160.4: every escalation the plugin raises carries LWY-159's fields (TC-4), its pick marked on the option and
// argued in Advice, never as a "Recommended:" prefix (TC-5), within the server's limits (TC-6), on a server that has
// the fields (TC-7). Every raise goes through the raise script from a file of its fields, so no field reaches a shell
// (round 1's c2). Replaces LWY-155's checks of the "Recommended:" prefix.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const plugin = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(plugin, path), 'utf8').replace(/\r\n/g, '\n');
const flat = (text) => text.replace(/\s+/g, ' ');

const process_ = flat(read('PROCESS.md'));
const plan = flat(read('skills/plan-project/SKILL.md'));
const run = flat(read('skills/run/SKILL.md'));
const shape = flat(read('skills/shape-project/SKILL.md'));
const sync = flat(read('skills/sync-repo/SKILL.md'));
const install = flat(read('skills/sdlc-install/SKILL.md'));
const tune = flat(read('skills/sdlc-tune/SKILL.md'));
const implementer = flat(read('agents/sdlc-implementer.md'));
const reviewer = flat(read('agents/sdlc-reviewer.md'));
const brief = flat(read('skills/run/templates/BRIEF.md'));
const verdict = flat(read('skills/run/templates/VERDICT.md'));

const markdown = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? (e.name === 'node_modules' ? [] : markdown(join(dir, e.name))) : e.name.endsWith('.md') ? [join(dir, e.name)] : [],
  );
const raw = markdown(plugin).map((path) => [relative(plugin, path), readFileSync(path, 'utf8').replace(/\r\n/g, '\n')]);
const docs = raw.map(([path, text]) => [path, flat(text)]);

// Every fields file the plugin writes out: the content of each ```json fence, which must parse.
const fieldFiles = raw.flatMap(([path, text]) =>
  [...text.matchAll(/^( *)```json\n([\s\S]*?)\n\1```$/gm)].map((m) => {
    let fields;
    assert.doesNotThrow(() => (fields = JSON.parse(m[2])), `${path}: a json fence that is not JSON`);
    return [path, fields];
  }),
);
// Every raise the plugin writes out: `<raise> …`, in a sh fence or a code span.
const raiseCalls = docs.flatMap(([path, text]) => [...text.matchAll(/<raise> --[^`]*/g)].map((m) => [path, m[0].trim()]));

test('the fields files and the raises this file checks are found', () => {
  assert.ok(fieldFiles.length >= 6, `only ${fieldFiles.length} fields files found`);
  assert.ok(raiseCalls.length >= 10, `only ${raiseCalls.length} raises found`);
});

test('c2: every raise is the raise script with a fields file, and no field goes on a command line', () => {
  for (const [path, call] of raiseCalls) {
    assert.match(call, /^<raise> --server <server> --as <alias>\/[a-z<>]+|^<raise> --server <server> --as quiet-wren\/reviewer/, `${path}: ${call}`);
    assert.match(call, / <fields file> -- (<cli>|leeway)$/, `${path}: ${call}`);
  }
  for (const [path, text] of docs) {
    assert.doesNotMatch(text, /escalation raise [<A-Z]/, `${path}: the CLI's raise written out, its fields on a command line`);
    assert.doesNotMatch(text, /--stdin context|--(question|tradeoff|advice|meanwhile) "/, `${path}: a field as a flag`);
  }
  assert.match(process_, /\*\*Every field goes in the file, never on a command line\.\*\* A question, a context, an argument or a piece of advice is drawn from a report or the code, and holds backticks, `\$` and apostrophes that a shell would run, expand or end a quote on/);
  assert.match(process_, /The CLI's own raise, with the fields as flags, is off run's allow-list, so it prompts\./);
});

test('TC-1: the CLI\'s own raise, with the fields as flags, is not said to sit off a list', { skip: 'red-test-TC-1: PROCESS still says it "is off run\'s allow-list, so it prompts"' }, () => {
  const raise = process_.match(/The CLI's own raise, with the fields as flags[^.]*\./);
  assert.ok(raise, 'no sentence on the CLI\'s own raise');
  assert.ok(!/allow[- ]?list|allow[- ]rules?|permission rules?/i.test(raise[0]) || /\b(no|not|never|without)\b|n't/i.test(raise[0]), raise[0]);
});

const TYPES = ['blocker', 'clarification', 'debt', 'nit'];

test('TC-4: every fields file has a type, a question, a context, a trade-off, options and meanwhile; advice but in shape-project', () => {
  for (const [path, f] of fieldFiles) {
    for (const k of ['type', 'question', 'context', 'tradeoff', 'options', 'meanwhile']) assert.ok(k in f, `${path}: no "${k}"`);
    assert.ok(TYPES.includes(f.type) || /^<[Tt]ype>$/.test(f.type), `${path}: type ${f.type}`);
    if (path === 'skills/shape-project/SKILL.md') assert.ok(!('advice' in f) && !f.options.some((o) => o.suggested), `${path}: shape-project advises`);
    else assert.ok('advice' in f, `${path}: no "advice"`);
  }
});

test('TC-5: where a fields file marks a pick, it is the only one and it comes first, and no argument argues it', () => {
  let checked = 0;
  for (const [path, f] of fieldFiles) {
    checked++;
    const suggested = f.options.flatMap((o, i) => (o.suggested ? [i] : []));
    assert.ok(suggested.length <= 1, `${path}: more than one suggested option`);
    if (suggested.length) assert.equal(suggested[0], 0, `${path}: the suggested option is not first`);
    for (const o of f.options) assert.doesNotMatch(o.argument, /^(Recommended|No recommendation)\b/, `${path}: ${o.label}`);
  }
  assert.ok(checked >= 6, `only ${checked} fields files with options`);
});

test('TC-5: no "Recommended:" or "No recommendation:" prefix is left anywhere in the plugin', () => {
  for (const [path, text] of docs) assert.doesNotMatch(text, /Recommended:|No recommendation:/, path);
});

test('TC-4, TC-5: the contract names the fields and where the pick goes', () => {
  assert.match(process_, /```json \{"type":"<type>","question":"…","context":"…","tradeoff":"…","advice":"…","options":\[\{"label":"…","argument":"…","suggested":true\},\{"label":"…","argument":"…"\}\],"meanwhile":"…","comment":"cN"\} ``` ```sh <raise> --server <server> --as <alias>\/<role> <ref> <fields file> -- <cli> ```/);
  assert.match(process_, /\*\*2 to 5 options\*\*, each a `label` and an `argument` that says what happens if it is picked/);
  assert.match(process_, /\*\*The pick comes first and is marked `"suggested": true`\*\*, the only option so marked, and Advice says why\. Where the agent truly has no pick it invents none: no option is suggested, and Advice says there is no pick and why\./);
  assert.match(process_, /An orchestrator raising an implementer's `## Question` or a reviewer's `Escalates` block passes its fields through unchanged and keeps its order and its pick\./);
});

// Round 1's c5: a type is a kind of question, not whether something has stopped yet.
test('TC-4: the types are defined by what kind of question each is', () => {
  assert.match(process_, /\*\*`"type"`, always, by what kind of question it is\.\*\* `blocker`: the work has stopped on a failure or a block, and cannot go on as planned until a person decides: a `BLOCKED` brief, a stalled round, a cap, a frozen test that needs a spec amendment, a stop of an issue run\. `clarification`: a decision the plan or the operation needs from a person before the work it shapes, where nothing has failed: an op question, a plan-gate QUESTION, a shaping, interview or floor question, an install, sync or tune question\. Either kind holds the work that depends on it until it is answered\. `debt` for a debt proposal, `nit` for a friction proposal\./);
  for (const [path, text] of docs) assert.doesNotMatch(text, /stops nothing yet/, path);
});

test('AC-4: a context is the specific thing, never only a reference', () => {
  assert.match(process_, /\*\*`"context"`: the specific thing behind the question, in plain lines\*\*/);
  assert.match(process_, /\*\*Never only a reference\*\*: "See c12", a URL or a ref alone is no context, and the server refuses it \(`invalid_context`\)/);
  for (const [name, text] of Object.entries({ run, plan, shape, sync, install, tune })) {
    assert.match(text, /never only/, `${name} does not say its context is never only a reference`);
  }
});

// Round 1's c3: the server sends invalid_context for a reference-only context and for one over 1,000 characters.
test('AC-4, TC-6: a refusal names both causes of invalid_context, the other over-long fields, and what a second refusal does', () => {
  assert.match(process_, /`invalid_context` has two causes\. A context that is only a reference: write the specific thing behind it, one plain line each\. A context over 1,000 characters: cut it to the worst items, one line each, and end with how many more there are and where\./);
  assert.match(process_, /`invalid_question` \(empty, or over 1,000 characters\), `invalid_tradeoff` and `invalid_advice` \(over 1,000\), `invalid_meanwhile` \(over 500\) and `invalid_options` \(not 2 to 5, a label empty, over 60 or repeated, an argument over 1,000, or more than one suggested\): shorten or fix that field, keeping what decides the question\./);
  assert.match(process_, /\*\*A second refusal stops the turn\*\*: raise nothing more, and say which escalation on which issue was not raised and what the CLI printed\./);
  assert.doesNotMatch(process_, /`invalid_context` means the context was only a reference/);
});

test('TC-6: every text within 1,000 characters, and a context too long for that says how many more and where', () => {
  assert.match(process_, /\*\*At most 1,000 characters\*\* each in the question, the context, the trade-off, the advice and each argument; a label at most 60 and `"meanwhile"` at most 500\. A context that would not fit lists the worst items, then says how many more there are and where they are/);
  for (const [path, text] of docs) assert.doesNotMatch(text, /question[^.]{0,20}at most 500|at most 500 characters/, path);
});

test('TC-7: a server without the fields stops the raise with a line naming LWY-159', () => {
  const notes = readFileSync(join(plugin, '..', 'RELEASE_NOTES.md'), 'utf8');
  const headline = flat(notes.slice(notes.indexOf('## 0.3.0'), notes.indexOf('\n- ', notes.indexOf('## 0.3.0'))));
  assert.match(headline, /\*\*It also needs one with LWY-159's escalation fields\*\*/, 'the 0.3.0 headline does not name LWY-159');
  assert.match(process_, /A raise the CLI refuses with `Unknown option '--type'` \(or `--context`, `--tradeoff`, `--advice`\) is a Leeway server older than LWY-159, which this plugin needs: raise nothing more and stop the turn/);
});

test('TC-4: run names the type of each of its raises in its table', () => {
  assert.match(run, /\| a stalled round; a round cap or a round-0 cap; a frozen test that needs a spec amendment; a merge conflict at the story gate; an issue run's stop on the story \| `blocker` \|/);
  assert.match(run, /\| a `BLOCKED` brief's `## Question`, a reviewer's `Escalates:` block \| the block's own `Type:` line, unedited \|/);
  assert.match(run, /\| a debt proposal \("What a deferred finding becomes"\) \| `debt` \|/);
  assert.match(run, /\| a friction proposal \("Land the task", step 6; "The friction harvest"\) \| `nit` \|/);
});

// Round 1's c4: each prose raise names its type where it sits, found by its own words. Each anchor occurs once, and the
// type must follow it within the same raise (before the anchor's sentence moves on to another raise).
const PROSE_RAISES = [
  ['run: the round-0 cap', run, 'Leave the task at `red-tests` (set again after the FAIL) and raise one escalation on the sub-issue as `<alias>/agent`,', 'blocker'],
  ['run: the round cap', run, 'is a stop: leave the sub-issue as it is and raise an escalation on it as `<alias>/agent`,', 'blocker'],
  ['run: a debt proposal', run, '**Ask, and file only on a yes**: an escalation on the sub-issue,', 'debt'],
  ['run: friction at the end of a sub-issue run', run, 'Propose what is left as **one escalation** on the sub-issue, as `<alias>/agent`,', 'nit'],
  ['run: the friction harvest', run, 'Propose** what is left as one escalation on the story, as `<alias>/agent`,', 'nit'],
  ['run: an issue run\'s stop', run, 'One the issue run raises is on the story, as `<alias>/agent`,', 'blocker'],
  ['run: the ask for the plan\'s pull request', run, 'Only with neither, raise an escalation on the nit collector', 'clarification'],
  ['run: a person asked to act first', run, '**An answer that needs a person to act first** is put to them as a new escalation,', 'clarification'],
  ['plan-project: an interview question', plan, 'then raise it with `<raise>` as step 0 says,', 'clarification'],
  ['sync-repo: a differing copy', sync, 'then raise an escalation on `<issue>`,', 'clarification'],
  ['sdlc-install: an interview question', install, 'Each escalation carries the fields of `PROCESS.md`,', 'clarification', 420],
  ['sdlc-tune: a confirmation', tune, 'It carries the fields of `PROCESS.md`,', 'clarification', 420],
];
for (const [name, text, anchor, type, window = 260] of PROSE_RAISES) {
  test(`c4: ${name} names its type, "${type}", where it is raised`, () => {
    const at = text.indexOf(anchor);
    assert.ok(at >= 0, `no "${anchor}"`);
    assert.equal(text.indexOf(anchor, at + 1), -1, `"${anchor}" is not unique`);
    const after = text.slice(at + anchor.length, at + anchor.length + window);
    assert.ok(after.includes(`\`"type": "${type}"\``), `${name}: no \`"type": "${type}"\` after "${anchor}"`);
  });
}

test('TC-4: plan-project and shape-project name their types', () => {
  assert.match(plan, /The type is `clarification` for every question this skill asks \(the product gaps, the interview, the floor and repository questions, the plan gate's QUESTIONs\) and `blocker` for "Three RETURNs"/);
  assert.match(plan, /the context the QUESTION and the findings it rests on, in plain lines, so a person decides it from the escalation alone/);
  assert.equal(fieldFiles.find(([p]) => p === 'skills/shape-project/SKILL.md')[1].type, 'clarification');
});

test('TC-5: shape-project keeps the likeliest answer first, takes the PO\'s answer as given and marks no pick', () => {
  assert.match(shape, /2 to 5 options, the likeliest answer first/);
  assert.match(shape, /\*\*No pick:\*\* no `"advice"`, and no option is marked `"suggested"`, since the answer is the PO's to give\./);
  assert.match(shape, /Take the PO's answer as given; where they are unsure, it is an `OPEN:` line, not a nudge toward an answer/);
  assert.doesNotMatch(shape, /recommend/i);
  assert.match(process_, /`shape-project` does not recommend: it puts the likeliest answer first, marks no option suggested, gives no Advice and takes the PO's answer as given\./);
});

test('TC-5: the implementer\'s ## Question and the reviewer\'s Escalates carry the fields, in the agents and templates', () => {
  for (const [name, text] of Object.entries({ brief, verdict })) {
    for (const field of ['Type', 'Question', 'Context', 'Trade-off', 'Advice', 'Options']) {
      assert.match(text, new RegExp(`- \\*\\*${field}:\\*\\*`), `${name} has no ${field} line`);
    }
    assert.match(text, /`<?[^`]*`? \(suggested\) — /, `${name} does not show how the pick is marked`);
    assert.match(text, /the orchestrator copies each line into a file of the escalation's fields, never onto a command line, so a backtick, a `\$` or an apostrophe arrives as you wrote it/, `${name}: the block's author is not told code is safe to quote`);
  }
  assert.match(implementer, /its Type, the Context behind it in plain lines, the Trade-off and your Advice/);
  assert.match(implementer, /your pick first and marked `\(suggested\)`, or none marked and Advice saying why/);
  assert.match(reviewer, /\*\*Type\*\* .*\*\*Context\*\* \(the finding or dispute behind it in plain lines, never only its `F<n>` or `cN`\), \*\*Trade-off\*\*, \*\*Advice\*\*/);
  assert.match(run, /Raise its `## Question` block \*\*unedited\*\*, as the implementer, tied to the brief, each line to its field: \*Type\*, \*Question\*, \*Context\*, \*Trade-off\*, \*Advice\* and \*Meanwhile\* copied into the fields file as written, backticks and all/);
  assert.match(run, /Each line of the block goes to its field, unedited, backticks and all, and `"suggested": true` on the option it marks/);
});

// The server's own rule (LWY-159, `onlyReference`): strip URLs, refs and the pointer words; nothing left is refused.
const onlyReference = (text) =>
  text
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\b[A-Z][A-Z0-9]*-\d+(\.\d+)*\b|\b[ceq]\d+\b/g, '')
    .replace(/\b(see|per|the|report|comment|above|below)\b/gi, '')
    .replace(/[\s\p{P}]/gu, '') === '';

// The worked example's block, line by line, and the fields file the orchestrator writes from it: the same text.
test('TC-5, TC-6, AC-4: the worked example raises its block unchanged, decidable from itself and within the limits', () => {
  const example = verdict.slice(verdict.indexOf('## Worked example'));
  const lines = Object.fromEntries(
    [...example.matchAll(/- \*\*(Type|Question|Context|Trade-off|Advice|Meanwhile):\*\* (.*?)(?= - \*\*| ## )/g)].map(([, k, v]) => [k, v.trim()]),
  );
  const options = [...example.matchAll(/\d\. `([^`]+)`( \(suggested\))? — (.*?)(?= \d\. `| - \*\*)/g)].map(([, label, s, argument]) => ({ label, argument: argument.trim(), ...(s ? { suggested: true } : {}) }));
  const [, f] = fieldFiles.find(([p, x]) => p === 'skills/run/templates/VERDICT.md' && x.comment === 'c6');
  assert.deepEqual(
    { type: f.type, question: f.question, context: f.context, tradeoff: f.tradeoff, advice: f.advice, meanwhile: f.meanwhile, options: f.options },
    { type: lines.Type, question: lines.Question, context: lines.Context, tradeoff: lines['Trade-off'], advice: lines.Advice, meanwhile: lines.Meanwhile, options },
  );
  assert.match(f.meanwhile, /`in_progress`/, 'the example no longer shows a backtick passing through');
  assert.equal(f.type, 'blocker');
  for (const k of ['question', 'context', 'tradeoff', 'advice']) assert.ok(f[k].length <= 1000, `the example's ${k} is over 1,000 characters`);
  for (const o of f.options) assert.ok(o.argument.length <= 1000 && o.label.length <= 60, o.label);
  assert.equal(onlyReference(f.context), false);
  assert.equal(onlyReference('See c12.'), true, 'the check would pass a bare reference');
});
