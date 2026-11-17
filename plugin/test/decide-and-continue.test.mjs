// LWY-266.1: `run` stops for the stop list and decides and continues on the rest ("Stop, or decide and continue").
// Text pins on plugin/skills/run/SKILL.md and plugin/PROCESS.md. Round 0: each test is skipped with the criterion it serves.
// The phrases the code rounds must use are the ones pinned below; the design doc is
// docs/archive/lwy-266-an-unattended-run-decides-and-continues.md, "Stop, or decide and continue".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const plugin = process.env.PLUGIN_DIR || join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(plugin, path), 'utf8').replace(/\r\n/g, '\n');
const flat = (text) => text.replace(/\s+/g, ' ');

const red = (criterion, name, fn) => test(`${criterion}: ${name}`, { skip: `red-test-${criterion}: LWY-266.1 round 0, the words are not written yet` }, fn);

const run = () => read('skills/run/SKILL.md');
const process_ = () => read('PROCESS.md');

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
// A row of the "Hard stop conditions" table (the writes table of "The writes of one round" has rows 1 to 12 too).
const hardStops = () => {
  const text = read('skills/run/SKILL.md');
  const from = text.indexOf('### Hard stop conditions');
  assert.notEqual(from, -1, 'anchor not found: ### Hard stop conditions');
  return text.slice(from, text.indexOf('### On a stop', from));
};
const row = (n) => {
  const line = hardStops().split('\n').find((l) => new RegExp(`^\\| ${n}( \\(removed: [^|]*\\))? \\|`).test(l));
  assert.ok(line, `hard-stop row ${n} not found`);
  return flat(line);
};

const SUB = 'Stop, or decide and continue';
const TRIAGE = 'Before raising a block: do the criteria decide it?';
const sub = () => section(run(), SUB);
const processEscalations = () => slice(process_(), '## Questions to the human are escalations', '\n## ');

// "A block is a stop when going on would ..., or when ...": the stop list, down to its closing sentence.
const stopList = (text) => {
  const lower = flat(text).toLowerCase();
  const start = lower.indexOf('a block is a stop when');
  assert.notEqual(start, -1, 'anchor not found: "A block is a stop when"');
  const end = lower.indexOf('cannot tell', start);
  assert.notEqual(end, -1, 'anchor not found: "cannot tell"');
  return lower.slice(start, end);
};

const ITEMS = {
  'production': /\bproduction\b/,
  'a merge into main': /merge into `?main`?/,
  'real data': /\breal data\b/,
  'a secret': /\ba secret\b/,
  'the wider of two access options': /the wider of two access options/,
  'marks no option (suggested)': /marks no option `?\(suggested\)`?/,
  'an action the permission check refused': /an action the permission check refused/,
};

for (const [name, re] of Object.entries(ITEMS)) {
  red('TC-1', `the stop list names "${name}", in run's subsection and in PROCESS.md`, () => {
    assert.match(stopList(sub()), re, 'run');
    assert.match(stopList(processEscalations()), re, 'PROCESS.md');
  });
}

red('TC-1', 'the stop list is exactly seven items, the same in run and PROCESS.md', () => {
  const found = (text) => Object.entries(ITEMS).filter(([, re]) => re.test(stopList(text))).length;
  assert.equal(found(sub()), 7);
  assert.equal(found(processEscalations()), 7);
});

red('TC-1', 'the stop list reads word for word the same in run and PROCESS.md (backticks and asterisks aside)', () => {
  const bare = (text) => stopList(text).replace(/[`*]/g, '').replace(/\s+/g, ' ').trim();
  assert.equal(bare(sub()), bare(processEscalations()));
});

red('TC-1', '"when the orchestrator cannot tell, it is a stop" is in run and in PROCESS.md', () => {
  assert.match(sub().toLowerCase(), /when the orchestrator cannot tell, it is a stop/);
  assert.match(processEscalations().toLowerCase(), /when the orchestrator cannot tell, it is a stop/);
});

red('TC-1', 'PROCESS.md: a stop holds the work, anything else is decided and continued, and the held-until-answered line for either kind is gone', () => {
  const s = processEscalations();
  assert.doesNotMatch(s, /Either kind holds the work that depends on it until it is answered/);
  assert.match(s, /a stop holds (the work|it)/i);
  assert.match(s, /decided and continued/i);
  assert.match(s, /Stop, or decide and continue/);
});

red('TC-1', 'PROCESS.md keeps the cast\'s "Guessing silently" line', () => {
  assert.match(flat(process_()), /Guessing silently/);
});

red('AC-2', 'the subsection "Stop, or decide and continue" sits right after the triage subsection, before "A BLOCKED brief"', () => {
  const text = run();
  const at = (h) => text.indexOf(h);
  assert.ok(at(`#### ${SUB}`) !== -1, 'heading missing');
  assert.ok(at(`#### ${TRIAGE}`) < at(`#### ${SUB}`));
  assert.ok(at(`#### ${SUB}`) < at('#### A BLOCKED brief'));
});

red('TC-2', 'the order is triage, then stop list, then decide and continue; the stop list is not placed after decide and continue', () => {
  const text = read('skills/run/SKILL.md');
  const body = text.slice(text.indexOf(`#### ${SUB}`), text.indexOf('#### A BLOCKED brief'));
  const triage = body.indexOf('**The triage');
  const stop = body.indexOf('**The stop list');
  const decide = body.indexOf('**Decide and continue');
  assert.ok(triage !== -1 && stop !== -1 && decide !== -1, 'the three bold labels "The triage", "The stop list", "Decide and continue" must all be there');
  assert.ok(triage < stop, 'the triage comes before the stop list');
  assert.ok(stop < decide, 'the stop list comes before decide and continue');
});

red('TC-2', 'the triage runs first and unchanged: the subsection cites it, and a spec amendment never reaches the subsection (stop 8)', () => {
  const s = sub();
  assert.match(s, /Before raising a block: do the criteria decide it\?/);
  assert.match(s, /spec amendment/i);
  assert.match(s, /`?freeze`? BLOCKER/);
  assert.match(s, /never reach(es)?/i);
  assert.match(s, /(hard )?stop 8/i);
  assert.match(row(8), /A frozen test needs a spec amendment/);
  assert.match(row(8), /\| "The freeze" \| the sub-issue run's, on the sub-issue \|/);
});

red('TC-1', 'a stop is raised and waited on as today: fields unedited, the block\'s own type', () => {
  const stop = sub().slice(sub().indexOf('**The stop list'), sub().indexOf('**Decide and continue'));
  assert.match(stop, /raised and waited on/i);
  assert.match(stop, /fields unedited/i);
  assert.match(stop, /its own type|the block's own type/i);
});

const steps = () => {
  const s = sub();
  const from = s.indexOf('**Decide and continue');
  assert.notEqual(from, -1, 'anchor not found: **Decide and continue');
  return s.slice(from);
};
const STEPS = [
  ['file the follow-up', /\*\*File the follow-up\*\*/],
  ['post the comment', /`# Decided and continued — <ref> · round <N>`/],
  ['raise the escalation', /\*\*Raise the escalation\*\*/],
  ['retitle the follow-up', /`Follow-up: <ref> eN — <[^>]+>`/],
  ['carry on', /\*\*Carry on\*\*/],
];

red('TC-3', 'the five continue steps are there, in order: follow-up, comment, escalation, retitle, carry on', () => {
  const s = steps();
  let last = -1;
  for (const [name, re] of STEPS) {
    const m = re.exec(s);
    assert.ok(m, `step missing: ${name}`);
    assert.ok(m.index > last, `step out of order: ${name}`);
    last = m.index;
  }
});

red('TC-3', 'the follow-up is filed in the story\'s project, in backlog, typed as plan-project step 5.2 types the Plan record (cited, not restated)', () => {
  const s = steps();
  assert.match(s, /story's project/);
  assert.match(s, /`?backlog`?/);
  assert.match(s, /`plan-project` step 5\.2/);
});

red('TC-3', 'the comment is posted on the sub-issue as the agent, with the pick and the follow-up\'s ref', () => {
  const s = steps();
  const part = s.slice(s.search(STEPS[1][1]), s.search(STEPS[2][1]));
  assert.match(part, /sub-issue/);
  assert.match(part, /<alias>\/agent/);
  assert.match(part, /pick/);
  assert.match(part, /follow-up's ref/);
});

red('TC-3', 'the escalation is tied to the comment, its fields unedited except type clarification and a meanwhile naming the pick and the follow-up', () => {
  const s = steps();
  const part = s.slice(s.search(STEPS[2][1]), s.search(STEPS[3][1]));
  assert.match(part, /tied to (that|the|this) (decided-and-continued )?comment|tied to the `# Decided and continued/i);
  assert.match(part, /unedited except/);
  assert.match(part, /"type": "clarification"/);
  assert.match(part, /"meanwhile"/);
  assert.match(part, /(run|orchestrator)[^.]*(carried on|carries on|carrying on|continued)[^.]*pick/i);
  assert.match(part, /follow-up's ref/);
});

red('TC-3', 'a continued block\'s escalation is never typed blocker', () => {
  const s = sub();
  assert.doesNotMatch(steps(), /"type": "blocker"/);
  assert.match(s, /never `?blocker`?|not `?blocker`?/i);
});

red('TC-3', 'the follow-up is retitled `Follow-up: <ref> eN — <question>` and `Escalation: <ref> eN` is added to its description, because issue list returns titles only', () => {
  const s = steps();
  const part = s.slice(s.search(STEPS[3][1]), s.search(STEPS[4][1]));
  assert.match(part, /`Follow-up: <ref> eN — <question[^>]*>`/);
  assert.match(part, /`Escalation: <ref> eN`/);
  assert.match(part, /description/);
  assert.match(part, /issue list/);
  assert.match(part, /titles/);
});

red('TC-3', 'the escalation is never raised before its comment and follow-up exist (the step order says so)', () => {
  const s = steps();
  assert.match(sub(), /never[^.]*raised[^.]*(without|before)[^.]*comment[^.]*follow-up/i);
  assert.ok(s.search(STEPS[0][1]) < s.search(STEPS[1][1]) && s.search(STEPS[1][1]) < s.search(STEPS[2][1]), 'follow-up, then comment, then escalation');
});

red('TC-3', 'carry on: the sub-issue is not set blocked and no wait starts; the pick goes into the next round', () => {
  const s = steps();
  const part = s.slice(s.search(STEPS[4][1]));
  assert.match(part, /not set `?blocked`?/);
  assert.match(part, /no wait starts/);
  assert.match(part, /next round/);
});

red('TC-3', 'a PASS with a continued Escalates: block runs one more round within roundCap', () => {
  const s = sub();
  assert.match(s, /a PASS with one runs one more round within `roundCap`/i);
  const then = slice(run(), '#### Then', '**The caps.**');
  assert.match(then, /continued/i);
  assert.match(then, /one more round/);
  assert.match(then, /roundCap/);
});

red('TC-3', 'the caps name a continued block like a decided one, and the round that would pass the cap is not run (hard stop 1 still fires)', () => {
  const caps = slice(run(), '**The caps.**', '**Spend rounds on the risk');
  assert.match(caps, /continued/i);
  assert.match(caps, /is not run/);
  assert.match(caps, /hard stop 1/);
  assert.match(row(1), /at `roundCap`/);
});

red('TC-3', 'a BLOCKED brief (steps 3 to 5) routes an undecided block through the subsection: a stop raises and waits, a continued block raises without waiting and the sub-issue is not set blocked', () => {
  const b = slice(run(), '#### A BLOCKED brief', '### 3. Delegate to the reviewer');
  assert.match(b, /Stop, or decide and continue/);
  assert.match(b, /continued/i);
  const i3 = b.indexOf(' 3. Run the triage');
  assert.notEqual(i3, -1, 'anchor not found: step 3, "Run the triage"');
  const i4 = b.indexOf(' 4. ', i3);
  const i5 = b.indexOf(' 5. ', i4);
  assert.ok(i4 !== -1 && i5 !== -1, 'steps 4 and 5 not found after step 3');
  const step4 = b.slice(i4, i5);
  assert.match(step4, /continued/i);
  assert.match(step4, /not set `?blocked`?|leaves the status as it is/i);
  const step5 = b.slice(i5);
  assert.match(step5, /continued/i);
});

red('TC-3', 'the verdict step 3 (Gate again, record, act) routes an undecided Escalates: block through the subsection', () => {
  const v = slice(run(), '3. **A dispute or a finding that needs a human**', '### Land the task');
  assert.match(v, /Stop, or decide and continue/);
  assert.match(v, /continued/i);
});

red('TC-3', 'the raise table has a continued block\'s row, typed clarification', () => {
  const table = slice(run(), '| Raise | `"type"` |', '**Statuses and steps are set, never inferred.**');
  const line = table.split('| ').find((c) => /continued/i.test(c));
  assert.ok(line, 'no row names a continued block');
  assert.match(table, /continued[^|]*\| `clarification` \|/i);
});

red('TC-5', 'hard-stop row 4 stays, numbered, as "removed", and row 11 is the stop list; no row is renumbered', () => {
  assert.match(row(4), /^\| 4( \(removed: [^|]*\))? \|/);
  assert.match(row(4), /removed: a debt proposal no longer stops the run, LWY-266/);
  assert.match(row(11), /A block on the stop list/);
  assert.match(row(11), /Stop, or decide and continue/);
  const ids = hardStops().split('\n').filter((l) => /^\| \d+( \(removed: [^|]*\))? \|/.test(l)).map((l) => Number(/^\| (\d+) /.exec(l)[1]));
  assert.deepEqual(ids, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  assert.match(row(10), /Leeway is unreachable/);
  assert.match(row(5), /A second verification-gate hallucination/);
  assert.match(row(8), /A frozen test needs a spec amendment/);
});

red('TC-5', 'the note on "3 and 4" is adjusted to 3 only', () => {
  const notes = slice(run(), 'Notes on the ones that need them:', '- **5 replaces');
  assert.doesNotMatch(notes, /\*\*3 and 4/);
  assert.match(notes, /\*\*3:/);
});

red('TC-5', 'the "every place the sub-issue run itself says stop" paragraph drops the raised ## Question and Escalates: block in favour of row 11', () => {
  const p = slice(run(), '**And every place the sub-issue run itself says stop', 'Notes on the ones that need them');
  assert.doesNotMatch(p, /a raised `## Question`/);
  assert.doesNotMatch(p, /a raised\s+`Escalates:` block/);
  assert.match(p, /(hard )?stop 11|row 11|block on the stop list/i);
});

red('AC-1', 'only a stop is held: a block off the stop list is never waited on, and one on it is never continued', () => {
  const s = sub();
  assert.match(s, /never continued|is never continued/i);
  assert.match(s, /the stricter/i);
});
