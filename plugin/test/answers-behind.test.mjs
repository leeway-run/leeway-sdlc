// LWY-266.2: `run` reads the answers behind its picks and debt proposals ("Reading the answers behind"), at every round
// boundary, before the story gate's merge and at the plan's end, and no debt proposal waits anywhere.
// Text pins on plugin/skills/run/SKILL.md. Round 0: each test is skipped with the criterion it serves.
// Design doc: docs/archive/lwy-266-an-unattended-run-decides-and-continues.md, "Reading the answers behind".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const plugin = process.env.PLUGIN_DIR || join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(plugin, path), 'utf8').replace(/\r\n/g, '\n');
const flat = (text) => text.replace(/\s+/g, ' ');

const red = (criterion, name, fn) => test(`${criterion}: ${name}`, { skip: `red-test-${criterion}` }, fn);

const run = () => read('skills/run/SKILL.md');

// The heading line containing `title`, down to the next heading of its level or above (fenced blocks skipped).
const section = (text, title) => {
  const all = text.split('\n');
  const first = all.findIndex((line) => /^#+ /.test(line) && line.includes(title));
  assert.notEqual(first, -1, `anchor not found: a heading titled ${title}`);
  const lines = all.slice(first);
  const level = /^(#+) /.exec(lines[0])[1].length;
  const out = [lines[0]];
  let fenced = false;
  for (const line of lines.slice(1)) {
    if (/^\s*```/.test(line)) fenced = !fenced;
    const heading = !fenced && /^(#+) /.exec(line);
    if (heading && heading[1].length <= level) break;
    out.push(line);
  }
  return flat(out.join('\n'));
};
const slice = (text, from, to) => {
  const start = text.indexOf(from);
  assert.notEqual(start, -1, `anchor not found: ${from}`);
  const end = text.indexOf(to, start);
  assert.notEqual(end, -1, `anchor not found: ${to}`);
  return flat(text.slice(start, end));
};

// Sentences of flattened text, so a pin binds words that sit in one sentence whatever the line wrapping.
const sentences = (text) => flat(text).split(/(?<=[.?!])\s+(?=[A-Z`*#|(<"])/);
const says = (text, ...res) => sentences(text).some((s) => res.every((re) => re.test(s)));
const assertSays = (text, ...res) =>
  assert.ok(says(text, ...res), `no sentence says all of ${res.join(' and ')}`);
// The same, a clause at a time (cut at commas and semicolons), where one sentence holds two rules.
const saysClause = (text, ...res) =>
  sentences(text).some((s) => s.split(/[,;]/).some((c) => res.every((re) => re.test(c))));
// Chunks of raw text (a list item, a table row, a paragraph) cut into sentences, for the whole-file sweep.
const sweep = (text) =>
  text
    .split(/\n\s*\n|\n(?=\s*(?:\d+\.|[-*]) |\|)/)
    .flatMap((chunk) => sentences(chunk));

const SUB = 'Reading the answers behind';
const sub = () => section(run(), SUB);
const NEGATION = /\b(no longer|never|not|no wait)\b/i;

red('TC-4', 'the subsection "Reading the answers behind" exists, under a heading of its own', () => {
  assert.ok(/^#{3,5} .*Reading the answers behind/m.test(run()), "anchor not found: a heading titled Reading the answers behind");
});

red('TC-4', 'it is read at every round boundary: before the next implementer round and before the next task', () => {
  const s = sub();
  assertSays(s, /round boundary/i);
  assertSays(s, /before/i, /next implementer round/i);
  assertSays(s, /before/i, /next task/i);
});

red('TC-4', 'it is read at the story gate, before step 1\'s merge', () => {
  const s = sub();
  assertSays(s, /story gate/i, /before/i, /merge/i);
});

red('TC-4', 'it is read at the plan\'s end, before its status update', () => {
  const s = sub();
  assertSays(s, /plan's end/i, /before/i, /status update/i);
});

red('TC-4', 'the story gate calls it before its first step (the merge of the base), and the plan\'s end before its status update', () => {
  const gate = section(run(), 'The story gate');
  const at = gate.indexOf(SUB);
  assert.notEqual(at, -1, 'the story gate does not name "Reading the answers behind"');
  assert.ok(at < gate.indexOf("Merge the story's base into the story branch"), 'named after the merge');
  const end = section(run(), "The plan's end");
  const atEnd = end.indexOf(SUB);
  assert.notEqual(atEnd, -1, 'the plan\'s end does not name "Reading the answers behind"');
  assert.ok(atEnd < end.indexOf("Post the plan's status update"), 'named after the status update');
});

red('TC-4', 'a round boundary calls it, from outside the subsection, the story gate and the plan\'s end', () => {
  const text = run();
  assert.ok(
    sweep(text).some((s) => s.includes(SUB) && !/^#+ /.test(s) && /round boundary|before the next (implementer round|task)/i.test(s)),
    'no sentence names the subsection at a round boundary',
  );
  const outside = flat(text).split(sub())[0];
  assert.match(outside, /round boundary|next implementer round/i);
});

red('TC-4', 'the index is the project\'s issue list: titles starting `Follow-up: <ref> eN`, neither done nor cancelled, one issue get each', () => {
  const s = sub();
  assertSays(s, /`issue list`|issue list/, /project/i);
  assertSays(s, /Follow-up: <ref> eN/);
  assertSays(s, /neither/i, /`?done`?/, /`?cancelled`?/);
  assertSays(s, /one `?issue get/i);
  assertSays(s, /issue list/, /titles?/i, /(no|not|without) descriptions?/i);
  assertSays(s, /one[^.]*issue list/i, /(one reply|no pagination|one page)/i);
});

red('TC-4', 'escalation list is not used for the index (LWY-164)', () => {
  const s = sub();
  assertSays(s, /escalation list/, /\b(not|never|cannot)\b/i);
  assert.match(s, /LWY-164/);
  assert.doesNotMatch(s, /leeway escalation list/);
});

red('TC-4', 'a follow-up is found by its title in the index, so a plain run reads no description to find it', () => {
  assertSays(sub(), /title/i, /starts?/i, /Follow-up: <ref> eN/);
});

red('AC-2', 'debt proposals are read from issue get on the story, whose escalations[] carries its sub-issues\'', () => {
  const s = sub();
  assertSays(s, /debt/i, /issue get <story>|`issue get` on the story/i);
  assertSays(s, /escalations\[\]/, /sub-issues/i);
});

red('AC-2', 'the story in hand at a round boundary and at the story gate, every story of the project at the plan\'s end', () => {
  const s = sub();
  assertSays(s, /story in hand/i, /round boundary/i, /story gate/i);
  assertSays(s, /every story/i, /plan's end/i);
});

red('AC-2', 'on "File it" the debt issue is filed as "What a deferred finding becomes" says, its title ending `(<ref> eN)` and its description carrying `Escalation: <ref> eN`', () => {
  const s = sub();
  assertSays(s, /File it/);
  assertSays(s, /What a deferred finding becomes/);
  assertSays(s, /File it|filed|files/i, /title/i, /ending `?\(<ref> eN\)`?|ends `?\(<ref> eN\)`?/i);
  assertSays(s, /File it|filed|files/i, /description/i, /`Escalation: <ref> eN`/);
});

red('AC-3', 'a matching answer (its label equal to the pick) posts `# Pick stood — <ref> eN` and sets the follow-up done', () => {
  const s = sub();
  assertSays(s, /match/i, /label/i, /pick/i);
  assertSays(s, /`# Pick stood — <ref> eN`/);
  assertSays(s, /match/i, /`?done`?/);
});

red('AC-3', 'a differing answer posts `# Answer differs — <ref> eN` quoting label and note, and leaves the follow-up backlog', () => {
  const s = sub();
  assertSays(s, /`# Answer differs — <ref> eN`/, /label/i, /note/i);
  assertSays(s, /differ/i, /`?backlog`?/);
});

red('AC-3', 'a differing answer never sets done', () => {
  const s = sub();
  const about = sentences(s).filter((x) => /differ/i.test(x) && /\bdone\b/.test(x) && !/already|marker/i.test(x));
  assert.ok(about.length > 0, 'no sentence says what a differing answer does with `done`');
  for (const x of about) {
    for (const c of x.split(/[,;]/)) {
      if (/\bdone\b/.test(c) && !/match/i.test(c)) assert.match(c, NEGATION, `a differing answer is not kept off done: ${c}`);
    }
  }
  assert.ok(saysClause(s, /differ/i, /\b(never|not|no)\b[^,;]*\bdone\b/i), 'no clause says a differing answer is never done');
});

red('AC-3', 'a follow-up whose escalation is unanswered is never closed', () => {
  assert.ok(saysClause(sub(), /unanswered/i, /\b(never|not)\b/i, /(closed|closes|`?done`?)/i), 'no clause says an unanswered follow-up is never closed');
});

red('TC-4', 'each action checks its marker before writing: a follow-up already done or already carrying `# Answer differs — <ref> eN`', () => {
  const s = sub();
  assertSays(s, /already/i, /`?done`?/, /`# Answer differs — <ref> eN`/);
  assertSays(s, /before/i, /writ/i);
});

red('TC-4', 'the marker of a debt issue is a title already ending `(<ref> eN)`, found in the same issue list', () => {
  assertSays(sub(), /already/i, /title/i, /\(<ref> eN\)/, /issue list/);
});

red('TC-4', 'a second reading writes nothing: no second comment, nothing closed twice, no second debt issue', () => {
  const s = sub();
  assertSays(s, /second reading/i, /writes? nothing/i);
  assertSays(s, /second/i, /comment|debt issue|closes?/i, /\b(no|never|not|nothing)\b/i);
});

red('TC-4', 'the reading copies the plan\'s end\'s form: post unless the latest state is already the same', () => {
  assertSays(sub(), /unless|only when|skip|checks?/i, /already/i);
});

red('AC-3', 'the story gate reads and never waits: it merges the story with escalations and follow-ups still open', () => {
  const gate = section(run(), 'The story gate');
  assertSays(gate, /\b(never|not|no)\b[^.]*wait|wait[^.]*\b(never|not)\b/i, /escalation/i, /follow-up/i);
  assertSays(gate, /merge/i, /open/i, /escalation/i, /follow-up/i);
  assertSays(sub(), /reads?/i, /\b(never waits?|does not wait|no wait|not wait)\b/i);
});

red('TC-4', 'no polling: a reading is one issue list and one issue get per follow-up, never a loop or a wait', () => {
  const s = sub();
  assertSays(s, /\bno polling\b|never polls|does not poll/i);
});

red('AC-3', 'the plan\'s end lists every follow-up whose escalation is unanswered and every one whose answer differs and is not done, in its status update and in its ending', () => {
  const end = section(run(), "The plan's end");
  assertSays(end, /status update/i, /unanswered/i, /differ/i);
  assertSays(end, /\bend(ing|s)?\b|end by saying/i, /unanswered/i, /differ/i);
  assertSays(end, /differ/i, /not `?done`?/i);
});

red('AC-3', 'the plan\'s end lists them for the person who decides the merge into main', () => {
  const end = section(run(), "The plan's end");
  assertSays(end, /unanswered/i, /person|decides?/i);
});

red('AC-2', 'the debt row of "What a deferred finding becomes" no longer says the run waits: the run carries on and the proposal is read later', () => {
  const rows = slice(run(), '| Technical debt: the fix is a design decision', '| Anything else');
  assert.doesNotMatch(rows, /run waits/i);
  assert.doesNotMatch(rows, /waits on the proposal/i);
  assert.doesNotMatch(rows, /its stop 4/i);
  assert.doesNotMatch(rows, /Wait, then carry on/);
  assert.doesNotMatch(rows, /"Land the task", step 5/);
  assert.match(rows, /carries on|carry on/i);
  assert.match(rows, /Reading the answers behind/);
  assert.match(rows, /File it/);
});

red('AC-2', '"Land the task" no longer waits on a debt proposal (step 5 is gone or says it does not wait), and step 6\'s friction proposal depends on no answer', () => {
  const land = section(run(), 'Land the task');
  assert.doesNotMatch(land, /Wait on each debt proposal/);
  assert.doesNotMatch(land, /start its wait/i);
  assert.doesNotMatch(land, /Wait, then carry on/);
  for (const x of sentences(land)) {
    if (/\bdebt\b/i.test(x) && /\bwait/i.test(x)) assert.match(x, NEGATION, `Land the task waits on a debt proposal: ${x}`);
  }
  assert.match(land, /Friction/);
});

red('AC-2', 'hard stop 4 and its notes no longer say a debt proposal stops or holds the run', () => {
  const text = run();
  const from = text.indexOf('### Hard stop conditions');
  assert.notEqual(from, -1, 'anchor not found: ### Hard stop conditions');
  const stops = text.slice(from, text.indexOf('### On a stop', from));
  const row4 = stops.split('\n').find((l) => /^\| 4( \(removed: [^|]*\))? \|/.test(l));
  assert.ok(row4, 'hard-stop row 4 not found');
  assert.doesNotMatch(flat(row4), /needs a human yes/);
  assert.doesNotMatch(flat(stops), /A `debt` follow-up is the proposal's escalation/);
  for (const x of sweep(stops)) {
    if (/\bdebt\b/i.test(x) && /\b(wait\w*|stops?|holds?)\b/i.test(x)) assert.match(x, NEGATION, `hard stops: a debt proposal stops: ${x}`);
  }
});

red('AC-2', 'proven false: a run waits on a debt proposal anywhere in run (no sentence about a debt proposal waits, stops or holds without a negation)', () => {
  const offenders = sweep(run()).filter(
    (x) => /\bdebt\b/i.test(x) && /\b(wait\w*|holds?)\b/i.test(x) && !NEGATION.test(x),
  );
  assert.deepEqual(offenders, []);
});

red('AC-2', '"Wait, then carry on" no longer names a debt proposal after its task as a wait that carries on when it ends unanswered', () => {
  for (const x of sentences(section(run(), 'Wait, then carry on'))) {
    if (/\bdebt\b/i.test(x)) assert.match(x, NEGATION, `a wait is still described for a debt proposal: ${x}`);
  }
});

red('AC-2', 'the debt proposal is read, not waited on: its escalation is raised and the run carries on, reading it at the next reading point', () => {
  const s = sub();
  assertSays(s, /debt/i, /answer/i, /(read|reading)/i);
  assertSays(s, /debt/i, /\b(no longer|never|not)\b/i, /(wait|stop)/i);
});
