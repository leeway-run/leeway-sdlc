// LWY-160.4: every escalation the plugin raises carries LWY-159's fields (TC-4), its pick marked on the option and
// argued in Advice, never as a "Recommended:" prefix (TC-5), within the server's limits (TC-6), on a server that has
// the fields (TC-7). Replaces LWY-155's checks of the "Recommended:" prefix.
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
const docs = markdown(plugin).map((path) => [relative(plugin, path), flat(readFileSync(path, 'utf8'))]);

// Every literal `escalation raise <ref> …` or `escalation raise LWY-1 …` in the plugin's text, inline or in a block.
const raises = docs.flatMap(([path, text]) =>
  [...text.matchAll(/`([^`]*escalation raise [<A-Z][^`]*)`/g)].map((m) => [path, m[1]]),
);

test('the raises this file checks are found', () => {
  assert.ok(raises.length >= 10, `only ${raises.length} raise commands found`);
});

test('TC-4: every raise the plugin writes out passes --type', () => {
  for (const [path, command] of raises) assert.match(command, /--type /, `${path}: ${command.slice(0, 120)}`);
});

test('TC-4: every full raise passes its context from a file, a trade-off and, but for shape-project, advice', () => {
  const full = raises.filter(([, c]) => /--options/.test(c));
  assert.ok(full.length >= 7, `only ${full.length} full raises found`);
  for (const [path, command] of full) {
    const at = `${path}: ${command.slice(0, 120)}`;
    assert.match(command, /--stdin context/, at);
    assert.match(command, /--tradeoff /, at);
    assert.match(command, /--question /, at);
    if (path === 'skills/shape-project/SKILL.md') assert.doesNotMatch(command, /--advice|"suggested"/, at);
    else assert.match(command, /--advice /, at);
  }
});

// The options of a raise written out with real JSON: at most one suggested, and it is the first.
const optionsOf = (command) => {
  const m = command.match(/--options '(\[.*?\])'/);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch { return null; }
};

test('TC-5: where a raise marks a pick, it is the only one and it comes first, and no argument argues it', () => {
  let checked = 0;
  for (const [path, command] of raises) {
    const options = optionsOf(command);
    if (!options) continue;
    checked++;
    const suggested = options.flatMap((o, i) => (o.suggested ? [i] : []));
    assert.ok(suggested.length <= 1, `${path}: more than one suggested option`);
    if (suggested.length) assert.equal(suggested[0], 0, `${path}: the suggested option is not first`);
    for (const o of options) assert.doesNotMatch(o.argument, /^(Recommended|No recommendation)\b/, `${path}: ${o.label}`);
  }
  assert.ok(checked >= 4, `only ${checked} raises with options to parse`);
});

test('TC-5: no "Recommended:" or "No recommendation:" prefix is left anywhere in the plugin', () => {
  for (const [path, text] of docs) assert.doesNotMatch(text, /Recommended:|No recommendation:/, path);
});

test('TC-4, TC-5: the contract names the fields, the types and where the pick goes', () => {
  assert.match(process_, /leeway escalation raise <ref> --as <alias>\/<role> --json --type <type> --question "…" --tradeoff "…" --advice "…" --options '\[\{"label":"…","argument":"…","suggested":true\},\{"label":"…","argument":"…"\}\]' --meanwhile "…" --comment cN --stdin context < <context file>/);
  assert.match(process_, /\*\*`--type`, always\.\*\* `blocker` when work has stopped on it: a `BLOCKED` brief, a stalled round, a cap, a frozen test that needs a spec amendment, a stop of an issue run\. `clarification` for a question about how to go on that stops nothing yet: an op question, a plan-gate QUESTION, a shaping, interview or floor question, an install, sync or tune question\. `debt` for a debt proposal, `nit` for a friction proposal\./);
  assert.match(process_, /\*\*2 to 5 options\*\*, each a `label` and an `argument` that says what happens if it is picked/);
  assert.match(process_, /\*\*The pick comes first and is marked `"suggested": true`\*\*, the only option so marked, and Advice says why\. Where the agent truly has no pick it invents none: no option is suggested, and Advice says there is no pick and why\./);
  assert.match(process_, /An orchestrator raising an implementer's `## Question` or a reviewer's `Escalates` block passes its fields through unchanged and keeps its order and its pick\./);
});

test('AC-4: a context is the specific thing, never only a reference, and a refusal of one is rewritten', () => {
  assert.match(process_, /\*\*`--context`: the specific thing behind the question, in plain lines\*\*/);
  assert.match(process_, /\*\*Never only a reference\*\*: "See c12", a URL or a ref alone is no context, and the server refuses it \(`invalid_context`\)/);
  assert.match(process_, /`invalid_context` means the context was only a reference: write the specific thing into it and raise once more\./);
  for (const [name, text] of Object.entries({ run, plan, shape, sync, install, tune })) {
    assert.match(text, /never only/, `${name} does not say its context is never only a reference`);
  }
});

test('TC-6: every text within 1,000 characters, and a context too long for that says how many more and where', () => {
  assert.match(process_, /\*\*At most 1,000 characters\*\* each in the question, the context, the trade-off, the advice and each argument; a label at most 60 and `--meanwhile` at most 500\. A context that would not fit lists the worst items, then says how many more there are and where they are/);
  for (const [path, text] of docs) assert.doesNotMatch(text, /question[^.]{0,20}at most 500|at most 500 characters/, path);
});

test('TC-7: a server without the fields stops the raise with a line naming LWY-159', () => {
  assert.match(process_, /A raise the CLI refuses with `Unknown option '--type'` \(or `--context`, `--tradeoff`, `--advice`\) is a Leeway server older than LWY-159, which this plugin needs: raise nothing more and stop the turn/);
});

test('TC-4: run names the type of each of its raises', () => {
  assert.match(run, /\| a stalled round; a round cap or a round-0 cap; a frozen test that needs a spec amendment; a merge conflict at the story gate; an issue run's stop on the story \| `blocker` \|/);
  assert.match(run, /\| a `BLOCKED` brief's `## Question`, a reviewer's `Escalates:` block \| the block's own `Type:` line, unedited \|/);
  assert.match(run, /\| a debt proposal \("What a deferred finding becomes"\) \| `debt` \|/);
  assert.match(run, /\| a friction proposal \("Land the task", step 6; "The friction harvest"\) \| `nit` \|/);
  assert.match(run, /an escalation on the sub-issue, `--type debt`, its context the finding and what leaving it costs/);
  assert.match(run, /as `<alias>\/agent`, `--type nit` \(options "File them" and "File none"/);
  assert.match(run, /`<alias>\/agent`, `--type blocker`, tied to the status comment/);
  assert.match(run, /whose context gives each outstanding finding in a line of its own, what it says and its `cN`/);
});

test('TC-4: plan-project, shape-project, sync-repo, sdlc-install and sdlc-tune name their types', () => {
  assert.match(plan, /The type is `clarification` for every question this skill asks \(the product gaps, the interview, the floor and repository questions, the plan gate's QUESTIONs\) and `blocker` for "Three RETURNs"/);
  assert.match(plan, /the context the QUESTION and the findings it rests on, in plain lines, so a person decides it from the escalation alone/);
  assert.match(shape, /escalation raise <ref> --type clarification/);
  assert.match(sync, /escalation raise <issue> --type clarification --comment cN/);
  assert.match(install, /`--type clarification`/);
  assert.match(tune, /`--type clarification`/);
});

test('TC-5: shape-project keeps the likeliest answer first, takes the PO\'s answer as given and marks no pick', () => {
  assert.match(shape, /2 to 5 options, the likeliest answer first/);
  assert.match(shape, /\*\*No pick:\*\* no `--advice`, and no option is marked `"suggested"`, since the answer is the PO's to give\./);
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
  }
  assert.match(implementer, /its Type, the Context behind it in plain lines, the Trade-off and your Advice/);
  assert.match(implementer, /your pick first and marked `\(suggested\)`, or none marked and Advice saying why/);
  assert.match(reviewer, /\*\*Type\*\* .*\*\*Context\*\* \(the finding or dispute behind it in plain lines, never only its `F<n>` or `cN`\), \*\*Trade-off\*\*, \*\*Advice\*\*/);
  assert.match(run, /Raise its `## Question` block \*\*unedited\*\*, as the implementer, tied to the brief, each line to its flag/);
  assert.match(run, /Each line of the block goes to its flag, unedited, its \*Context\* in the file and `"suggested": true` on the option it marks/);
});

// The server's own rule (LWY-159, `onlyReference`): strip URLs, refs and the pointer words; nothing left is refused.
const onlyReference = (text) =>
  text
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\b[A-Z][A-Z0-9]*-\d+(\.\d+)*\b|\b[ceq]\d+\b/g, '')
    .replace(/\b(see|per|the|report|comment|above|below)\b/gi, '')
    .replace(/[\s\p{P}]/gu, '') === '';

test('TC-6, AC-4: the worked example\'s escalation is decidable from itself and within the limits', () => {
  const lines = Object.fromEntries(
    [...verdict.slice(verdict.indexOf('## Worked example')).matchAll(/- \*\*(Type|Question|Context|Trade-off|Advice):\*\* (.*?)(?= - \*\*)/g)]
      .map(([, k, v]) => [k, v.trim()]),
  );
  assert.equal(lines.Type, 'blocker');
  for (const k of ['Question', 'Context', 'Trade-off', 'Advice']) {
    assert.ok(lines[k], `the example has no ${k}`);
    assert.ok(lines[k].length <= 1000, `the example's ${k} is over 1,000 characters`);
  }
  assert.equal(onlyReference(lines.Context), false);
  assert.equal(onlyReference('See c12.'), true, 'the check would pass a bare reference');
  const command = raises.find(([path]) => path === 'skills/run/templates/VERDICT.md')[1];
  for (const o of optionsOf(command)) assert.ok(o.argument.length <= 1000 && o.label.length <= 60, o.label);
});
