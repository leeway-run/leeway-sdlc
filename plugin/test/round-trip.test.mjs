import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// LWY-222.2 (TC-1, TC-3, TC-4, TC-5, AC-1..AC-5): plan-project's half of the round trip, a story that planning sends back to
// the PO being shaped and planned again in the same session. Each pin names the phrase it matches and the file and section
// it reads. It reads only plugin/PROCESS.md and the two SKILL.md files below, never this file.
//
// A pin is skipped (`red-test-<criterion>`) until the text exists; LWY-222.2's implementer removes the skip and changes the
// text, and nothing else. Pins with no skip pass today and guard what must not change.
const plugin = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...parts) => readFileSync(join(plugin, ...parts), 'utf8').replace(/\r\n/g, '\n');

const planProject = read('skills', 'plan-project', 'SKILL.md');
const shaping = read('skills', 'shape-project', 'SKILL.md');
const contract = read('PROCESS.md');

// --- helpers copied from plan-moves-on-its-own.test.mjs (LWY-200.1) ---------------------------------------------

// The text from the heading line that starts with `heading` to the next heading of the same or a higher level.
// A line inside a ``` fence is never a heading. Fails when there is no such heading, so a renamed section is not a pass.
function section(text, heading) {
  const level = /^#+/.exec(heading)[0].length;
  const lines = text.split('\n');
  const start = lines.findIndex((line) => line.startsWith(heading));
  assert.ok(start >= 0, `no "${heading}" section`);
  let end = lines.length;
  let fenced = false;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^\s*```/.test(lines[i])) { fenced = !fenced; continue; }
    const m = !fenced && /^(#+) /.exec(lines[i]);
    if (m && m[1].length <= level) { end = i; break; }
  }
  return lines.slice(start, end).join('\n');
}
const flat = (text) => text.replace(/\s+/g, ' ').trim();
const sentences = (text) => flat(text).split(/(?<=[.;!?]\**)\s+(?=[A-Z*`(_])|; /);
// The first sentence of `text` matching every pattern; undefined when none does.
const sentenceWith = (text, ...res) => sentences(text).find((s) => res.every((re) => re.test(s)));
const found = (text, what, ...res) => assert.ok(sentenceWith(text, ...res), `no sentence ${what}\n${flat(text).slice(0, 600)}`);

// Step 0's start table, joined onto lines, one per row: the rows' first cell tells which row a pin reads.
const start0 = section(planProject, '## 0. ');
const rows = start0
  .split('\n')
  .filter((line) => /^\s*\| /.test(line) && !/^\s*\|---/.test(line))
  .map((line) => flat(line));
const row = (firstCell) => {
  const hit = rows.find((r) => r.startsWith(`| ${firstCell} |`));
  assert.ok(hit, `no start-table row beginning "| ${firstCell} |"\n${rows.join('\n')}`);
  return hit;
};
const rowIndex = (firstCell) => rows.findIndex((r) => r.startsWith(`| ${firstCell} |`));

const gaps = section(planProject, '### Gaps → back to the PO');
const waitRead = section(planProject, '### Wait, then read');
const questions = section(planProject, '### The QUESTIONs');
const doneWhen = section(planProject, '## Done when');
const shapingPart = section(contract, '## Before the plan: shaping');
const gatePart = section(contract, '## The plan gate');
const description = flat(/^description: (.*)$/m.exec(planProject)[1]);

const SHAPE_ROW = '`shape`, or no step at `backlog`, on a type with a shaped step';
const SHAPED_OPEN_ROW = 'the shaped step, with a shaping escalation open';

// --- TC-1: a round trip is defined once, in PROCESS.md ------------------------------------------------------
//
// One pin per condition of the definition, each reading `plugin/PROCESS.md`, "Before the plan: shaping". The first three
// are one sentence about the story's latest gap comment (it contains "round trip" and "latest gap comment"); the fourth is
// the sentence about the shaping half. A text in which only one condition fails fails only that pin (the matcher test below
// shows it on fixtures).
const DEFINITION = {
  'the latest gap comment is the one whose closing sentence begins "Answer these with `shape-project` on `<ref>`"':
    [/\bround trip\b/, /\blatest gap comment\b/, /Answer these with `shape-project` on `<ref>`/],
  'its escalation is answered *Hold* (and no other answer)':
    [/\bround trip\b/, /\blatest gap comment\b/, /\bescalation\b/, /answered \*Hold\*/],
  'the story is at `shape`, the shaped step or the plan step (and no later one)':
    [/\bround trip\b/, /\blatest gap comment\b/, /at `shape`, the shaped step or the plan step\b/, /^(?!.*plan gate)/],
  'its shaping half is done once a `# Planning started` follows that gap comment':
    [/\bshaping half\b/, /`# Planning started`/, /\bfollows that gap comment\b/],
};
const OTHER_THAN_HOLD = /\*(?:Split|Accept)\b[^*]*\*|\bany answer\b|\bwhatever the answer\b/;

for (const [condition, res] of Object.entries(DEFINITION)) {
  test(`PROCESS.md "Before the plan: shaping" defines a round trip: ${condition}`, () => {
    found(shapingPart, `saying ${condition}`, ...res);
  });
}

test('PROCESS.md "Before the plan: shaping": the definition names no answer but *Hold*', () => {
  const sentence = sentenceWith(shapingPart, /\bround trip\b/, /\blatest gap comment\b/, /answered \*Hold\*/);
  assert.ok(sentence, 'no sentence defining a round trip by its latest gap comment answered *Hold*');
  assert.doesNotMatch(sentence, OTHER_THAN_HOLD);
});

// The matchers above, run on fixtures: the right text passes all four, and each wrong text fails exactly its own condition.
// This runs today: it tests the matchers, not the plugin's text.
test('the round-trip definition pins each fail on exactly the one condition a fixture breaks', () => {
  const good = 'A story is in a round trip when its latest gap comment (the comment whose closing sentence begins *"Answer these with `shape-project` on `<ref>`"*) has its escalation answered *Hold*, and the story is at `shape`, the shaped step or the plan step. Its shaping half is done once a `# Planning started` follows that gap comment.';
  const broken = {
    'a story that planning sends back, whatever the answer': good.replace('answered *Hold*', 'answered *Split the story as proposed*'),
    'the closing sentence is not the one named': good.replace('Answer these with `shape-project` on `<ref>`', 'Answer these as you see fit'),
    'a story past the plan step': good.replace('the shaped step or the plan step', 'the shaped step, the plan step or the plan gate'),
    'a `# Planning started` before the gap comment': good.replace('follows that gap comment', 'precedes that gap comment'),
  };
  const failing = (text) => Object.entries(DEFINITION).filter(([, res]) => !sentenceWith(text, ...res)).map(([name]) => name);
  assert.deepEqual(failing(good), []);
  const names = Object.keys(DEFINITION);
  assert.deepEqual(failing(broken['the closing sentence is not the one named']), [names[0]]);
  assert.deepEqual(failing(broken['a story that planning sends back, whatever the answer']), [names[1]]);
  assert.deepEqual(failing(broken['a story past the plan step']), [names[2]]);
  assert.deepEqual(failing(broken['a `# Planning started` before the gap comment']), [names[3]]);
  assert.ok(OTHER_THAN_HOLD.test(broken['a story that planning sends back, whatever the answer'].replace('answered *Hold*', 'answered *Split*') ));
});

test('PROCESS.md "Before the plan: shaping" gives the four steps of a round trip: Hold, `# Shaping started`, shaping, planning resumes', () => {
  found(shapingPart, 'saying that on *Hold* plan-project posts `# Shaping started` and hands the story to shape-project',
    /\*Hold\*/, /`# Shaping started`/, /\bplan-project\b/, /\bshape-project\b/, /\bhand/);
  found(shapingPart, 'saying that in a round trip shape-project, once the body is written, hands the story back to plan-project',
    /\bround trip\b/, /\bshape-project\b/, /\bplan-project\b/, /\bhand(?:s|ed)?\b[^.]*\bback\b/);
  found(shapingPart, 'saying that in a round trip `# Planning started` says the PO\'s answers to shaping were the approval of the body',
    /\bround trip\b/, /`# Planning started`/, /answers to shaping/, /approval of the body/);
});

test('PROCESS.md: an answer is acted on under the skill whose role raised the escalation, for that story only', () => {
  found(shapingPart, 'saying an answer is acted on under the skill whose role raised it: `agent` for shape-project, `planner` for plan-project',
    /\bacted on\b/, /\brole\b/, /`agent`/, /`planner`/, /\bshape-project\b/, /\bplan-project\b/);
  found(shapingPart, 'saying that answer is acted on for that story only', /\bthat story only\b/);
});

test('PROCESS.md: an escalation raised by `planner` is not acted on under shape-project', () => {
  found(shapingPart, 'saying an answer to an escalation raised as `planner` is not acted on under shape-project',
    /`planner`/, /\bshape-project\b/, /\b(?:not|never)\b/, /\bacted on\b|\bacts on\b/);
});

test('PROCESS.md "The plan gate": Three RETURNs on a type with `shape` goes through the gap path, with an escalation', () => {
  found(gatePart, 'saying that on a type with `shape` three RETURNs go through the gap path: the gap comment, `shape` and the tied "how do we proceed?" escalation',
    /Three RETURNs|three (?:or more )?coverage reports/i, /\bshape\b/, /\bgap\b/, /\bescalation\b/);
});

test('PROCESS.md: nothing counts round trips', () => {
  found(shapingPart, 'saying nothing counts round trips', /\bround trips?\b/, /\bnothing counts\b|\bno limit\b|\bno count\b|\bno cap\b/i);
});

test('PROCESS.md and plan-project do not restate the definition of a round trip (shape-project cites it too)', () => {
  const restated = /at `shape`, the shaped step or the plan step/;
  assert.doesNotMatch(flat(planProject), restated);
  assert.doesNotMatch(flat(shaping), restated);
});

// --- TC-1: plan-project cites the definition and raises tied to the gap comment ------------------------------

test('plan-project cites the definition in PROCESS.md, "Before the plan: shaping"', () => {
  found(gaps + '\n' + start0, 'citing `PROCESS.md`, "Before the plan: shaping" for what a round trip is',
    /\bround trip\b/, /`PROCESS\.md`, "Before the plan: shaping"/);
});

test('plan-project step 1: the "how do we proceed?" escalation is raised with `"comment"` the gap comment\'s `cN`', () => {
  assert.match(flat(gaps), /how do we proceed\?[^.]*`"comment"`[^.]*gap comment's `cN`|`"comment"`[^.]*gap comment's `cN`[^.]*how do we proceed\?/);
});

// --- AC-1, AC-3, TC-4: the gap escalation is waited on at once ----------------------------------------------

test('plan-project step 1: the gap escalation is waited on at once, beside the session\'s other waits', () => {
  found(gaps, 'saying the gap escalation is waited on at once, beside the session\'s other waits',
    /\bwait/i, /\bat once\b/, /\b(?:beside|alongside)\b[^.]*\bother waits\b/);
  assert.doesNotMatch(flat(gaps), /once the rest of the plan is done/);
});

test('plan-project "Wait, then read": a held story\'s gap escalation is waited on when it is raised, not last', () => {
  found(waitRead, 'saying a held story\'s step 1 gap escalation is waited on when it is raised, beside the other waits',
    /\bgap escalation\b/, /\bwaited on\b/, /\b(?:when|as soon as) (?:it is )?raised\b|\bat once\b/, /\b(?:beside|alongside)\b/);
  assert.doesNotMatch(flat(waitRead), /waited on last/);
});

test('plan-project says nothing of "The last wait" or "waited on last" any more', () => {
  assert.doesNotMatch(flat(planProject), /The last wait|waited on last|wait on the held stories' gaps/);
  assert.ok(!/^### The last wait/m.test(planProject), 'the section "The last wait" is still a heading');
});

// The absent-phrase pin of the hazard register, over plan-project/SKILL.md and PROCESS.md.
test('the old sentences "this session does not plan the story again" and "waited on last" appear in neither plan-project nor PROCESS.md', () => {
  for (const [name, text] of Object.entries({ 'plan-project/SKILL.md': planProject, 'PROCESS.md': contract })) {
    for (const phrase of ['this session does not plan the story again', 'waited on last'])
      assert.ok(!flat(text).includes(phrase), `${name} still says "${phrase}"`);
  }
});

// --- AC-1, TC-3: *Hold* hands over, *Split* and *Accept* do not ---------------------------------------------

test('plan-project step 1: on *Hold* it posts `# Shaping started` naming the gap comment\'s `cN` and the escalation\'s `eN`, as `<alias>/planner`', () => {
  found(gaps, 'on *Hold* posting a comment opening `# Shaping started`', /\*Hold\*/, /`# Shaping started`/);
  found(gaps, 'saying `# Shaping started` names the gap comment\'s `cN` and the escalation\'s `eN`',
    /`# Shaping started`/, /gap comment's `cN`/, /escalation's `eN`/);
  found(gaps, 'saying `# Shaping started` is posted as `<alias>/planner`', /`# Shaping started`/, /<alias>\/planner/);
});

test('plan-project step 1: it says each hand-over to shaping in the session', () => {
  found(gaps, 'on *Hold* saying the hand-over to shape-project in the session',
    /\bhand(?:s|ing)? (?:the story )?over\b|\bhand-over\b/, /\bshape-project\b|\bshaping\b/, /\bin the session\b/);
});

test('plan-project step 1: it hands over to shape-project as `HARNESS.md`, "Handing over to a skill", says', () => {
  found(gaps, 'handing over to shape-project as `HARNESS.md`, "Handing over to a skill", says',
    /\bhand(?:s|ing)? over to (?:the )?`?shape-project`?/i, /as `HARNESS\.md`, "Handing over to a skill", says/);
});

test('no skill hands over by reading another skill\'s SKILL.md to follow it', () => {
  for (const [name, text] of Object.entries({ 'plan-project/SKILL.md': planProject, 'shape-project/SKILL.md': shaping })) {
    for (const s of sentences(text)) {
      if (!/\b(?:shape-project|plan-project)\/SKILL\.md\b|\bSKILL\.md\b/.test(s)) continue;
      assert.doesNotMatch(s, /\b(?:read|reads|follow|follows|open|opens|run|runs)\b[^.]*\b(?:shape-project|plan-project)(?:\/|`?'s `?)SKILL\.md\b/, `${name}: "${s}"`);
    }
  }
});

test('plan-project step 1: *Split* starts no shaping', () => {
  found(gaps, 'saying *Split* starts no shaping', /\*Split\b/, /\b(?:starts? (?:no shaping|nothing)|nothing (?:starts|is handed over)|no shaping)\b/);
});

test('plan-project step 1: *Accept* starts no shaping', () => {
  found(gaps, 'saying *Accept* starts no shaping', /\*Accept\b/, /\b(?:starts? (?:no shaping|nothing)|nothing (?:starts|is handed over)|no shaping)\b/);
});

test('plan-project step 1: nothing is handed over to shaping while the gap escalation is open, and only *Hold* hands over', () => {
  found(gaps, 'saying the hand-over to shaping is never made before the escalation is answered *Hold*',
    /\b(?:never|not|only|no)\b/, /\bhand(?:s|ing)? over\b|\bhand-over\b/, /\bopen\b|\banswered\b|\bunanswered\b/, /\*Hold\*/);
});

test('plan-project step 1: the other stories keep planning while a held story is shaped (AC-3)', () => {
  found(gaps, 'saying the other stories keep planning while the held one is shaped',
    /\bshap(?:ed|ing)\b/, /\bother stories\b|\bthe others\b/, /\b(?:keep|carry on|go on)\b[^.]*\bplanning\b|\bplanning (?:carries on|goes on)\b/);
});

// --- the carry-forward from LWY-222.1's probe (docs/targets/claude.md, "Handing over to a skill") ---------------

test('plan-project says the hand-over uses the session\'s alias', () => {
  found(gaps, 'saying shape-project, handed over to, uses the session\'s alias', /\bshape-project\b/, /\bthe session's alias\b/, /\b(?:use|uses|keep|keeps|under)\b/i);
});

test('plan-project says that on the hand-back it continues the earlier run rather than starting a new one', () => {
  found(gaps + '\n' + start0, 'saying that on the hand-back it continues the earlier run, not a new one',
    /\bhand-back\b|\bhands? (?:it|the story) back\b|\bhanded back\b/, /\bcontinue(?:s)? (?:the |this |its )?earlier run\b/,
    /\b(?:not|never|rather than)\b[^.]*\b(?:new|second|another)\b[^.]*\brun\b/);
});

test('plan-project says another story\'s wait is acted on when it exits, whichever skill the session is in', () => {
  found(planProject, 'saying another story\'s wait is acted on when it exits, in whatever skill the session is in',
    /\banother story's\b/i, /\bwait\b/, /\bexits?\b/, /\bacted on\b|\bact on\b/, /\bwhichever skill\b|\bwhatever skill\b/, /\bthe session is in\b/);
});

// --- TC-4: who acts on an answer ---------------------------------------------------------------------------

test('plan-project "Wait, then read": an answer is acted on under the skill whose role raised it', () => {
  found(waitRead, 'saying an answer is acted on under the skill whose role raised the escalation: `planner` here',
    /\bacted on\b/, /\brole\b/, /`planner`/, /\bplan-project\b|\bthis skill\b/);
});

test('plan-project "Wait, then read": an escalation raised by `agent` is not acted on under plan-project', () => {
  found(waitRead, 'saying an answer to an escalation raised as `agent` is not acted on under plan-project (it is shape-project\'s)',
    /`agent`/, /\bshape-project\b/, /\b(?:not|never)\b/, /\bacted on\b|\bacts on\b|\bact on\b/);
});

test('plan-project "Wait, then read": one story\'s answer is acted on for that story only, and neither holds nor moves another', () => {
  found(waitRead, 'saying an answer is acted on for that story only', /\bthat story only\b/);
  found(waitRead, 'saying one story\'s answer neither holds nor moves another story',
    /\banother story\b/, /\b(?:holds?|moves?)\b/, /\b(?:never|not|neither|nor)\b/);
});

// --- step 0's rows: the story is at `shape` in a round trip ---------------------------------------------------

test('step 0: a story at `shape` in a round trip is handed over to shape-project, in a row before the refusal row', () => {
  const refusal = rowIndex(SHAPE_ROW);
  assert.ok(refusal >= 0, `no row "${SHAPE_ROW}"`);
  const before = rows.slice(0, refusal).find((r) => /^\| `shape`/.test(r) && /\bround trip\b/.test(r) && /\bhand(?:s|ed)? over to (?:the )?`?shape-project`?|\bhand(?:s|ing)? over\b/.test(r));
  assert.ok(before, `no row before "${SHAPE_ROW}" about a story at \`shape\` in a round trip being handed over to shape-project\n${rows.join('\n')}`);
  assert.match(before, /as `HARNESS\.md`, "Handing over to a skill", says/);
  assert.doesNotMatch(before, /say shaping is not finished/);
});

test('step 0: a story at `shape` whose latest gap comment\'s escalation is open is waited on, then follows step 1\'s answer', () => {
  const refusal = rowIndex(SHAPE_ROW);
  const hit = rows.slice(0, refusal).find((r) => /^\| `shape`/.test(r) && /\blatest gap comment\b/.test(r) && /\bescalation\b[^|]*\bopen\b/.test(r));
  assert.ok(hit, `no row before "${SHAPE_ROW}" about a story at \`shape\` whose latest gap comment's escalation is open\n${rows.join('\n')}`);
  assert.match(hit, /\bwait(?:ed)? on\b/);
  assert.match(hit, /\bstep 1\b/);
  assert.doesNotMatch(hit, /--step/);
});

test('step 0: the shaped-step row says that in a round trip `# Planning started` says the PO\'s answers to shaping were the approval of the body', () => {
  const r = row('the shaped step, with no shaping escalation open');
  assert.match(r, /`# Planning started`/);
  assert.match(r, /\bin a round trip\b[^|]*\bthe PO's answers to shaping were the approval of the body\b/);
});

test('step 0: a story at the shaped step with a shaping escalation open is still not moved, and its row still comes before the move', () => {
  const r = row(SHAPED_OPEN_ROW);
  assert.match(r, /\*\*say shaping is not finished, and stop\.\*\* Write nothing/);
  assert.doesNotMatch(r, /--step/);
  assert.ok(rowIndex(SHAPED_OPEN_ROW) < rowIndex('the shaped step, with no shaping escalation open'));
});

// --- AC-1 (Three RETURNs), TC-5 -----------------------------------------------------------------------------

test('step 8 Three RETURNs: on a type with `shape` it goes through step 1\'s gap path, with the tied escalation', () => {
  const text = flat(questions);
  assert.doesNotMatch(text, /post what the rounds could not trace as a step 1 comment to the PO, with step 1's ending/);
  found(questions, 'saying that on a type with `shape` three RETURNs take step 1\'s gap path: the gap comment, `shape` and the tied escalation',
    /\bWhen the type has `shape`/, /\bstep 1\b/, /\bgap\b/, /`shape`/, /\bescalation\b/);
});

test('step 8 Three RETURNs: a type with no `shape` still raises *Re-plan once more* / *Stop planning it*', () => {
  found(questions, 'saying a type with no `shape` raises one escalation on the story, tied to the latest report', /\bWhen it has no `shape`/, /\*\*raise one escalation on the story\*\*/, /`"comment"` its `cN`/);
  const text = flat(questions);
  assert.match(text, /\*Re-plan once more\*/);
  assert.match(text, /\*Stop planning it\*/);
});

// --- AC-5, TC-5: no limit on round trips ------------------------------------------------------------------

// A sentence that ties a limit or a count to a round trip: it mentions the gap comment, *Hold*, `# Shaping started` or a round
// trip, and a word of a limit or a count. A sentence that says there is none ("nothing counts round trips") is not one. A sentence that counts coverage reports (step 0's window, Three RETURNs) is not one:
// they count the reports of the plan gate, not trips back to shaping.
const ROUND_TRIP = /\bgap comments?\b|\*Hold\b|`# Shaping started`|\bround trips?\b|\bsent (?:it |the story )?back to `?shape`?/i;
const LIMIT = /\b(?:at most|no more than|up to|limit(?:ed|s)?|caps?|capped|maximum|max|only (?:once|twice|\w+ times)|at the most|\d+ (?:times|rounds|round trips|trips)|(?:two|three|four|five|once|twice) (?:times|rounds|round trips|trips)|counts?|counted|counting)\b/i;
const COVERAGE_REPORTS = /coverage reports?|`# Plan coverage:`|\bwindow\b/i;
const NO_LIMIT = /\bnothing counts\b|\bno (?:limit|count|cap)\b|\bwithout (?:a |any )?(?:limit|cap|count)\b/i;
const ties = (text) => sentences(text).filter((s) => ROUND_TRIP.test(s) && LIMIT.test(s) && !COVERAGE_REPORTS.test(s) && !NO_LIMIT.test(s));

test('AC-5: no text in plan-project, shape-project or PROCESS.md caps or counts round trips; PROCESS.md says nothing counts them', () => {
  for (const [name, text] of Object.entries({ 'plan-project/SKILL.md': planProject, 'shape-project/SKILL.md': shaping, 'PROCESS.md': contract })) {
    assert.deepEqual(ties(text), [], `${name} ties a limit or a count to a round trip`);
  }
  found(shapingPart, 'saying nothing counts round trips', /\bround trips?\b/, /\bnothing counts\b|\bno limit\b|\bno count\b|\bno cap\b/i);
});

// The scan above, run on fixtures: it fails a limit or a count on the gap comment, *Hold* or `# Shaping started`, and passes
// step 0's coverage-report window. This runs today: it tests the matcher, not the plugin's text.
test('the AC-5 scan fails a cap or a count on round trips and passes step 0\'s coverage-report window', () => {
  for (const bad of [
    'A story goes back to shape at most twice: a third gap comment stops the session.',
    'Count the gap comments on the story and stop after three.',
    'After *Hold* shaping runs up to 3 times.',
    'Post `# Shaping started` once, and never a second time; the number of round trips is limited to two.',
    'A round trip is capped at five.',
  ]) assert.ok(ties(bad).length > 0, bad);
  for (const fine of [
    'Count its coverage reports (comments opening `# Plan coverage:`, step 8) posted since the latest of four marks: the latest comment that sent the story back to `shape`, the one whose closing sentence begins *"Answer these with `shape-project` on `<ref>`"*.',
    'Step 0 counts them, before any re-planning: three or more coverage reports in its window.',
    'Nothing counts round trips: a story goes back to shaping as often as planning needs the PO.',
  ]) assert.deepEqual(ties(fine), [], fine);
});

// --- Done when and the description -------------------------------------------------------------------------

test('plan-project "Done when": a story whose gaps went back to the PO is handed to shaping on *Hold*, not left with no tasks and no next step', () => {
  found(doneWhen, 'saying a story whose gaps went back to the PO was handed to shaping on *Hold* (with a `# Shaping started` comment)',
    /\bgaps went back to the PO\b/, /\*Hold\*|`# Shaping started`|\bshape-project\b/);
});

test('plan-project\'s description says a held story is handed to shaping and planning resumes', () => {
  assert.match(description, /\bhands? [^.,-]{0,50}\bto (?:`?shape-project`?|shaping)\b/i);
});

// =====================================================================================================================
// LWY-222.3 (TC-1, TC-3, TC-5, TC-6, AC-2, AC-4, AC-6): shape-project's half of the round trip, and the condition from
// LWY-222.1's probe (docs/targets/claude.md, "Handing over to a skill"). Each pin names the phrase it matches and reads only
// plugin/skills/shape-project/SKILL.md (step 0 item "Start.", step 5, "A reply to the gaps sent back") and plugin/PROCESS.md,
// "Before the plan: shaping". A pin with a `red-test-<criterion>` skip is red until the text exists; LWY-222.3's implementer
// removes the skip and changes the text, and nothing else. Pins with no skip pass today and guard what must not change.
// =====================================================================================================================

const APPROVAL_ROUND = '### When the approval round stays';
const HARNESS_SAYS = /as `HARNESS\.md`, "Handing over to a skill", says/;
// "hand over to `plan-project`", "hands it over to plan-project", "handed over to plan-project"
const HAND_TO_PLAN = /\bhand(?:s|ed)? (?:the story |it )?over to (?:the )?`?plan-project`?/i;

// The four parts of shape-project a pin reads, as text: step 0's "Start." item, its `Unplanned` bullet, step 5 up to the
// approval-round exceptions, and "A reply to the gaps sent back".
function shapeParts(text) {
  const zero = section(text, '## 0. ');
  const m = /^\d+\. \*\*Start\.\*\*/m.exec(zero);
  assert.ok(m, 'no item "Start." in step 0');
  const rest = zero.slice(m.index);
  const end = rest.indexOf('**Where the human is asked.**');
  const start = end > 0 ? rest.slice(0, end) : rest;
  const bullet = /- \*\*Unplanned[\s\S]*?(?=\n\s*- \*\*|$)/.exec(start);
  assert.ok(bullet, 'no `Unplanned` bullet in step 0 item "Start."');
  return {
    start,
    unplanned: bullet[0],
    step5: section(text, '## 5. ').split(APPROVAL_ROUND)[0],
    reply: section(text, '### A reply to the gaps sent back'),
  };
}
const shapeReal = shapeParts(shaping);

// One entry per pin. `run(parts)` throws when the text does not say it.
const SHAPE_CHECKS = [
  {
    id: 'start-hand-over-shaped', crit: 'AC-4',
    name: 'shape-project step 0 "Start.": a story in a round trip at the shaped step is handed over to plan-project',
    why: 'says nothing of a round trip at the shaped step; it is shaped again or told it is planned',
    run: (p) => found(p.start, 'handing over to plan-project a story at the shaped step', /\bshaped step\b/, HAND_TO_PLAN),
  },
  {
    id: 'start-hand-over-plan-step', crit: 'AC-4',
    name: 'shape-project step 0 "Start.": a story at the plan step with a `# Planning started` after the gap comment is handed over to plan-project',
    why: 'a story at the plan step is not recognised as a round trip whose shaping half is done',
    run: (p) => found(p.start, 'handing over a story at the plan step with a `# Planning started` after the gap comment',
      /\bplan step\b/, /`# Planning started`/, /\bgap comment\b/, HAND_TO_PLAN),
  },
  {
    id: 'start-hand-over-harness', crit: 'TC-3',
    name: 'shape-project step 0 "Start.": it hands over to plan-project as `HARNESS.md`, "Handing over to a skill", says',
    why: 'no hand-over to plan-project in step 0',
    run: (p) => found(p.start, 'handing over to plan-project as `HARNESS.md`, "Handing over to a skill", says', HAND_TO_PLAN, HARNESS_SAYS),
  },
  {
    id: 'start-before-unplanned', crit: 'AC-4',
    name: 'shape-project step 0 "Start.": the round-trip hand-over is written before the `Unplanned` rule, so the first rule that fits decides',
    why: 'no round-trip hand-over in step 0 at all',
    run: (p) => {
      const text = flat(p.start);
      const hand = text.search(HAND_TO_PLAN);
      const unplanned = text.search(/\*\*Unplanned/);
      assert.ok(hand >= 0, 'no "hand over to plan-project" in step 0 item "Start."');
      assert.ok(unplanned >= 0, 'no `Unplanned` bullet');
      assert.ok(hand < unplanned, 'the hand-over to plan-project comes after the `Unplanned` rule');
    },
  },
  {
    id: 'start-never-shape-at-plan-step', crit: 'AC-4',
    name: 'shape-project step 0 "Start.": `--step shape` is never set on a story in a round trip at the plan step',
    why: 'nothing stops the `Unplanned` rule setting `--step shape` on a round trip at the plan step, pulling it back',
    run: (p) => found(p.start, 'saying `--step shape` is never set on a story in a round trip at the plan step',
      /\bround trip\b/, /\bplan step\b/, /--step shape/, /\bnever\b/),
  },
  {
    id: 'unplanned-excludes-round-trip', crit: 'AC-4',
    name: 'shape-project step 0 "Start.": the `Unplanned` bullet itself excludes a story in a round trip',
    why: 'the `Unplanned` bullet says nothing of a round trip',
    run: (p) => {
      assert.match(p.unplanned, /\bround trip\b/, 'the `Unplanned` bullet does not name a round trip');
      assert.match(p.unplanned, /\b(?:not|never|except|unless|outside)\b/, 'the `Unplanned` bullet does not exclude it');
    },
  },
  {
    id: 'start-wait-open-gap-escalation', crit: 'AC-4',
    name: 'shape-project step 0 "Start.": a story at `shape` whose latest gap comment\'s escalation is open is waited on',
    why: 'a story at `shape` is only ever set to `shape` again; an open gap escalation is not waited on',
    run: (p) => found(p.start, 'saying a story at `shape` whose latest gap comment\'s escalation is open is waited on',
      /\bat `shape`/i, /\blatest gap comment\b/, /\bescalation\b/, /\bopen\b/, /\bwait(?:ed)? on\b/),
  },
  {
    id: 'start-hold-shapes', crit: 'AC-4',
    name: 'shape-project step 0 "Start.": on *Hold* the waited-on story is shaped',
    why: 'no *Hold* branch in step 0',
    run: (p) => found(p.start, 'saying that on *Hold* the story is shaped', /\*Hold\*/, /\bshape it\b|\bshapes it\b|\bshape the story\b/),
  },
  {
    id: 'start-split-accept-stop', crit: 'AC-4',
    name: 'shape-project step 0 "Start.": on *Split* or *Accept* it says so and stops, shaping nothing',
    why: 'no *Split* or *Accept* branch in step 0',
    run: (p) => found(p.start, 'saying that on *Split* or *Accept* it says so and stops', /\*Split\b/, /\*Accept\b/, /\bsay so\b/, /\bstop\b/),
  },
  {
    id: 'start-answered-hold-shapes', crit: 'AC-4',
    name: 'shape-project step 0 "Start.": a story at `shape` with *Hold* given is shaped as today',
    why: 'no row for a story at `shape` with *Hold* given',
    run: (p) => found(p.start, 'saying a story at `shape` with *Hold* given is shaped as today', /\bat `shape`/i, /\*Hold\*/, /\bas today\b/),
  },
  {
    id: 'start-cites-process', crit: 'TC-1',
    name: 'shape-project step 0 "Start.": it cites `PROCESS.md`, "Before the plan: shaping" for what a round trip is, and that section exists',
    why: 'no citation of the round-trip definition in step 0',
    run: (p) => {
      found(p.start, 'citing `PROCESS.md`, "Before the plan: shaping" for what a round trip is', /\bround trip\b/, /`PROCESS\.md`, "Before the plan: shaping"/);
      assert.ok(section(contract, '## Before the plan: shaping').includes('A round trip'), 'PROCESS.md has no definition to cite');
    },
  },
  {
    id: 'step5-session', crit: 'TC-3',
    name: 'shape-project step 5: in a round trip it says in the session that the story goes back to planning',
    why: 'step 5 stops at the shaped step with no word of planning resuming',
    run: (p) => found(p.step5, 'saying in the session, in a round trip, that the story goes back to planning',
      /\bround trip\b/, /\bin the session\b/, /\bback to planning\b/),
  },
  {
    id: 'step5-inference-comment', crit: 'AC-2',
    name: 'shape-project step 5: in a round trip the inference comment says the story goes back to planning',
    why: 'the inference comment is described with no word of a round trip',
    run: (p) => found(p.step5, 'saying the inference comment, in a round trip, says the story goes back to planning',
      /\bround trip\b/, /\binference comment\b/, /\bback to planning\b/),
  },
  {
    id: 'step5-hand-over', crit: 'AC-2',
    name: 'shape-project step 5: in a round trip it hands over to plan-project as `HARNESS.md`, "Handing over to a skill", says',
    why: 'step 5 never hands over to plan-project',
    run: (p) => found(p.step5, 'handing over to plan-project, in a round trip, as `HARNESS.md`, "Handing over to a skill", says',
      /\bround trip\b/, HAND_TO_PLAN, HARNESS_SAYS),
  },
  {
    id: 'step5-hand-over-after-shaped-step', crit: 'AC-2',
    name: 'shape-project step 5: the hand-over comes after the shaped step is set, not before',
    why: 'no hand-over in step 5',
    run: (p) => {
      const text = flat(p.step5);
      const set = text.indexOf("issue update <ref> --step <the shaped step's id>`");
      const hand = text.search(HAND_TO_PLAN);
      assert.ok(set >= 0, 'step 5 does not set the shaped step');
      assert.ok(hand >= 0, 'no "hand over to plan-project" in step 5');
      assert.ok(set < hand, 'step 5 hands over before it sets the shaped step');
    },
  },
  {
    id: 'step5-outside-stops', crit: 'AC-6',
    name: 'shape-project step 5: outside a round trip it still ends at the shaped step and stops',
    why: 'step 5 does not say where a story outside a round trip ends once step 5 hands over in one',
    run: (p) => found(p.step5, 'saying that outside a round trip shaping ends at the shaped step and stops',
      /\b(?:outside|not in|no) (?:a )?round trip\b/i, /\bshaped step\b/, /\bstops?\b/),
  },
  {
    id: 'from-scratch-hands-nothing-over', crit: 'AC-6',
    name: 'shape-project: a story shaped from scratch (no gap comment, or its escalation answered *Split* or *Accept*) hands nothing over',
    why: 'nothing says that a story shaped from scratch is not handed to planning',
    run: (p) => found(`${p.start}\n${p.step5}`, 'saying a story shaped from scratch (no gap comment, or *Split* or *Accept*) hands nothing over',
      /\bno gap comment\b/, /\*Split\b/, /\*Accept\b/, /\bhands? nothing over\b|\bnever hands? over\b|\bdoes not hand over\b|\bnot handed over\b|\bno hand-over\b/),
  },
  {
    id: 'reply-planning-resumes', crit: 'AC-2',
    name: 'shape-project "A reply to the gaps sent back": in a round trip planning resumes by itself',
    why: 'the reply says the story goes back to plan-project only when someone runs it',
    run: (p) => found(p.reply, 'saying that in a round trip planning resumes by itself', /\bround trip\b/, /\bplanning resumes\b/, /\bby itself\b|\bon its own\b/),
  },
  {
    id: 'alias', crit: 'AC-2',
    name: 'shape-project says the hand-over to plan-project uses the session\'s alias',
    why: 'nothing says which alias plan-project runs under after the hand-back',
    run: (p) => found(`${p.start}\n${p.step5}`, 'saying plan-project, handed back to, uses the session\'s alias',
      /\bplan-project\b/, /\bthe session's alias\b/, /\b(?:use|uses|keep|keeps|under)\b/i),
  },
  {
    id: 'continue-earlier-run', crit: 'AC-2',
    name: 'shape-project says that on the hand-back plan-project continues the earlier run, not a new one',
    why: 'nothing says the hand-back resumes the earlier plan-project run',
    run: (p) => found(`${p.start}\n${p.step5}`, 'saying plan-project continues the earlier run rather than starting a new one',
      /\bplan-project\b/, /\bcontinue(?:s)? (?:the |this |its )?earlier (?:`?plan-project`? )?run\b/,
      /\b(?:not|never|rather than)\b[^.]*\b(?:new|second|another)\b[^.]*\brun\b/),
  },
];

for (const c of SHAPE_CHECKS) {
  test(c.name, () => c.run(shapeReal));
}

// Guards: no skip, they pass today and must keep passing.

// The blocks (paragraphs and list items) that hand over to plan-project without naming a round trip or saying they do not.
const unconditionalHandOvers = (text) =>
  text.split(/\n\s*\n|\n(?=\s*- )/).map(flat).filter((b) => HAND_TO_PLAN.test(b) && !/\bround trip\b|\b(?:not|never|nothing|no)\b/.test(b));

test('shape-project hands over to plan-project only in a round trip: every paragraph or list item that does names one, or says it does not', () => {
  assert.deepEqual(unconditionalHandOvers(shaping), []);
});

test('shape-project does not restate the definition of a round trip: none of the four conditions is said as `PROCESS.md` says it', () => {
  for (const [condition, res] of Object.entries(DEFINITION)) {
    assert.equal(sentenceWith(shaping, ...res), undefined, `shape-project restates: ${condition}`);
  }
});

test('shape-project step 5 still never sets a step called shaped by id, and "A reply to the gaps sent back" still says running plan-project approves the body', () => {
  assert.doesNotMatch(shapeReal.step5, /--step shaped\b/);
  assert.match(flat(shapeReal.reply), /Running `plan-project` on the story approves the body\./);
});

// The checks above, run on fixtures: the right text passes all of them, and each wrong text fails the checks it should.
// This runs today: it tests the matchers, not the plugin's text.
const FX = {
  rt: "   - **A story in a round trip** (`PROCESS.md`, \"Before the plan: shaping\", says what that is): never set `--step shape` on it, which would pull a story at the plan step back. At the shaped step, or at the plan step with a `# Planning started` after the gap comment, its shaping half is done: hand over to `plan-project` for that story as `HARNESS.md`, \"Handing over to a skill\", says, and stop. At `shape`, with its latest gap comment's escalation open, wait on it (\"Wait, then carry on\"): on *Hold* shape it, and on *Split* or *Accept* say so and stop. At `shape` with *Hold* given, shape it as today.\n",
  unplanned: "   - **Unplanned, and not in a round trip:** run `<cli> --as <alias>/agent issue update <ref> --step shape`; the step's status comes with it.\n   - **Done or cancelled:** say so and stop. Change nothing.\n",
  step5: "Set the shaped step, `<cli> --server <server> --as <alias>/agent issue update <ref> --step <the shaped step's id>`, and stop. The story\nwaits there until `plan-project` is run on it, and running it approves the body: say so to the PO. **In a round trip** (`PROCESS.md`, \"Before the plan: shaping\"), the story does not wait there: say in the session, and in the inference comment, that the story goes back to planning, and once the shaped step is set hand over to `plan-project` for that story as `HARNESS.md`, \"Handing over to a skill\", says. It uses the session's alias: `plan-project` continues the earlier `plan-project` run, not a new run. Outside a round trip, shaping ends at the shaped step and stops, as above, and a story shaped from scratch (no gap comment, or one whose escalation was answered *Split* or *Accept*) hands nothing over.",
  reply: "If this round answered gaps a developer sent back, reply to that comment. Running `plan-project` on the story approves the body. In a round trip planning resumes by itself once the body is written, so the reply is the PO's record only.",
};
const fx = (over = {}) => {
  const q = { ...FX, ...over };
  return { start: `5. **Start.** Decide:\n${q.rt}${q.unplanned}`, unplanned: q.unplanned.split('\n')[0], step5: q.step5, reply: q.reply };
};
const failingChecks = (p) => SHAPE_CHECKS.filter((c) => { try { c.run(p); return false; } catch { return true; } }).map((c) => c.id);

test('the shape-project round-trip pins pass on a good wording and fail on each plausible wrong one', () => {
  assert.deepEqual(failingChecks(fx()), []);
  const wrong = {
    'sets --step shape on a round trip': [{ rt: FX.rt.replace('never set', 'set') }, ['start-never-shape-at-plan-step']],
    'the round-trip clause comes after the `Unplanned` rule': [{ rt: '', unplanned: FX.unplanned + FX.rt }, ['start-before-unplanned']],
    'the `Unplanned` bullet does not exclude a round trip': [{ unplanned: FX.unplanned.replace('Unplanned, and not in a round trip', 'Unplanned') }, ['unplanned-excludes-round-trip']],
    '*Split* or *Accept* shapes it too': [{ rt: FX.rt.replace('say so and stop', 'shape it too') }, ['start-split-accept-stop']],
    'only the shaped step is handed over': [{ rt: FX.rt.replace(', or at the plan step with a `# Planning started` after the gap comment,', ',') }, ['start-hand-over-plan-step']],
    'an open gap escalation of any comment is waited on': [{ rt: FX.rt.replace("its latest gap comment's escalation", 'any escalation') }, ['start-wait-open-gap-escalation']],
    'the hand-over is not said in the session': [{ step5: FX.step5.replace('say in the session, and in the inference comment,', 'say in the inference comment') }, ['step5-session']],
    'the inference comment is not told': [{ step5: FX.step5.replace(', and in the inference comment,', ',') }, ['step5-inference-comment']],
    'step 5 hands over for every story': [{ step5: FX.step5.replace('**In a round trip** (`PROCESS.md`, "Before the plan: shaping"), the story does not wait there: say in the session, and in the inference comment, that the story goes back to planning, and once the shaped step is set hand', 'Then hand') }, ['step5-session', 'step5-inference-comment', 'step5-hand-over']],
    'step 5 hands over before it sets the shaped step': [{ step5: 'In a round trip hand over to `plan-project` as `HARNESS.md`, "Handing over to a skill", says. ' + FX.step5 }, ['step5-hand-over-after-shaped-step']],
    'plan-project runs under its own alias': [{ step5: FX.step5.replace("the session's alias", 'its own alias') }, ['alias']],
    'plan-project starts a new run': [{ step5: FX.step5.replace('continues the earlier `plan-project` run, not a new run', 'starts a new run') }, ['continue-earlier-run']],
    'a from-scratch story is handed over': [{ step5: FX.step5.replace(', and a story shaped from scratch (no gap comment, or one whose escalation was answered *Split* or *Accept*) hands nothing over', '') }, ['from-scratch-hands-nothing-over']],
    'the reply says planning waits to be run': [{ reply: FX.reply.replace('planning resumes by itself', 'planning waits for a developer') }, ['reply-planning-resumes']],
  };
  for (const [what, [over, expected]] of Object.entries(wrong)) {
    const failing = failingChecks(fx(over));
    for (const id of expected) assert.ok(failing.includes(id), `"${what}" does not fail ${id}; fails: ${failing.join(', ') || 'nothing'}`);
  }
  const restating = `${FX.rt} A story is in a round trip when its latest gap comment has its escalation answered *Hold*, and the story is at \`shape\`, the shaped step or the plan step.`;
  assert.ok(Object.values(DEFINITION).some((res) => sentenceWith(restating, ...res)), 'a restatement of the definition is not caught');
  assert.equal(unconditionalHandOvers(`${FX.rt}${FX.unplanned}\n${FX.step5}`).length, 0);
  assert.equal(unconditionalHandOvers('Set the shaped step. Then hand over to `plan-project` for that story.').length, 1);
});
