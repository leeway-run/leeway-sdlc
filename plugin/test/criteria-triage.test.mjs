// LWY-244.3: before raising a reviewer's `Escalates:` block or an implementer's `BLOCKED` `## Question`, the
// orchestrator checks whether the criteria decide it (AC-4); a real choice is still raised unedited (AC-5); the
// documents agree (AC-6); a spec amendment never reaches the triage (TC-2); the decision is recorded (TC-5).
// Each assertion that replaces a pin in escalation-recommends.test.mjs says which.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const plugin = process.env.PLUGIN_DIR || join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(plugin, path), 'utf8').replace(/\r\n/g, '\n');
const flat = (text) => text.replace(/\s+/g, ' ');

const slice = (text, from, to) => {
  const start = text.indexOf(from);
  assert.notEqual(start, -1, `anchor not found: ${from}`);
  const end = text.indexOf(to, start);
  assert.notEqual(end, -1, `anchor not found: ${to}`);
  return flat(text.slice(start, end));
};

// The heading line containing `title` (a mention elsewhere does not count), down to the next heading of its level or above (fenced blocks skipped).
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

// A list item (a bullet) from `from` down to the next bullet or heading.
const bullet = (text, from) => {
  const start = text.indexOf(from);
  assert.notEqual(start, -1, `anchor not found: ${from}`);
  const rest = text.slice(start + from.length);
  const end = rest.search(/\n- \*\*|\n## /);
  return flat(from + (end === -1 ? rest : rest.slice(0, end)));
};

const TRIAGE = 'Before raising a block: do the criteria decide it?';
const triage = () => section(read('skills/run/SKILL.md'), TRIAGE);
const blocked = () => slice(read('skills/run/SKILL.md'), '#### A BLOCKED brief', '### 3. Delegate to the reviewer');
const afterReview = () => slice(read('skills/run/SKILL.md'), '### 4. Gate again, record, act', '### Land the task');
const processEscalations = () => slice(read('PROCESS.md'), '## Questions to the human are escalations', '\n## ', );
const listOf = (text) => {
  const m = /more than one answer.*?intent doc/i.exec(text);
  assert.ok(m, 'AC-5 list not found: it runs from "more than one answer" to "intent doc"');
  return m[0].toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
};

const DECIDED = /(criteria (already )?(decides?|answers?|settles?)|decided by the criteria|follows? from the criteria|criterion (decides|answers))/i;
const FINDING_WITH_FIX = /finding,? (with|and) its fix/i;
const DECIDING = /(deciding criterion|criterion that (decides|answers))/i;
const NOT_ESCALATES = /\b(not|rather than|instead of)( in| as| by)?( raising| writing| reporting)?( an?)? `?Escalates:?`? block/i;
const NOT_BLOCKED = /\b(not|rather than|instead of)( in| as| by)?( return(ing)?)?( an?)? `?(Status: )?BLOCKED`?/i;

test('AC-4: run has the subsection, and the decided test is one option following from the criteria, every other unmet or contradicting', () => {
  const s = triage();
  assert.match(s, /one option follows from (the )?(story's )?(acceptance and technical criteria|criteria|`?AC-n`? and `?TC-n`?)/i);
  assert.match(s, /every other (option )?(would )?(either )?(leaves?|leaving) (a criterion|one) unmet or contradicts? (a criterion|one)/i);
});

test('AC-4: adding a field to an existing op\'s response that a criterion needs counts as decided', () => {
  assert.match(triage(), /adding a field to an existing op's response that a criterion needs.{0,40}counts as decided/i);
});

test('AC-5: the triage lists what is still raised unedited, each kind', () => {
  const list = listOf(triage());
  for (const kind of [
    /more than one answer/, /product or scope choice/, /new op or whether something is an op/,
    /removing or renaming a response field/, /\bschema\b/, /\bauth\b/, /ownership boundary/, /rule in the intent doc/,
  ]) assert.match(list, kind);
  assert.match(triage(), /unedited/);
});

test('AC-5, AC-6, TC-2: AC-5\'s always-raised list is the same words in run/SKILL.md and PROCESS.md', () => {
  assert.equal(listOf(processEscalations()), listOf(triage()));
});

test('TC-2: a spec amendment, a `freeze` BLOCKER included, never reaches the triage', () => {
  const s = triage();
  assert.match(s, /spec amendment[^.]{0,120}never (reach(es)?|comes?|goes|gets)|never (reach(es)?|comes?|goes|gets)[^.]{0,80}spec amendment/i);
  assert.match(s, /`?freeze`? BLOCKER[^.]{0,200}(hard stop 8|never (reach(es)?|comes?|goes|gets))|(hard stop 8|never (reach(es)?|comes?|goes|gets))[^.]{0,200}`?freeze`? BLOCKER/);
  assert.match(s, /hard stop 8/i);
});

test('TC-5: a decided block is one comment by <alias>/agent opening "# Decided from the criteria", holding the block, the criterion and the option', () => {
  const s = triage();
  assert.match(s, /# Decided from the criteria — <ref> · round <N>/);
  assert.match(s, /<alias>\/agent`?.{0,60}# Decided from the criteria/);
  assert.match(s, /the block as written/i);
  assert.match(s, /the (deciding )?criterion/i);
  assert.match(s, /the option taken/i);
});

test('AC-4: a decided block raises no escalation', () => {
  assert.match(triage(), /decided.{0,150}(raises? no escalation|raises? nothing|no escalation is raised)/i);
});

test('AC-4: a decided `## Question` runs the next round with the decision in the prompt, step set back as on resume, and the sub-issue is not set `blocked`', () => {
  const s = blocked();
  assert.match(s, /decid(ed|es|e).{0,200}decision.{0,80}prompt/i);
  assert.match(s, /decid(ed|es|e).*(set the step back|step set back|--step (red-tests|implementing))/i);
  assert.match(s, /not (set|marked|moved)( to)? `?blocked`?/i);
});

// Replaces the pin on "Raise its `## Question` block **unedited**, as the implementer, ..." (escalation-recommends, "TC-4: ...").
test('AC-4, AC-5: "A BLOCKED brief" runs the triage first, then raises the block unedited, each line to its field', () => {
  assert.match(blocked(), /(triage|criteria decide).*a stop raises its `## Question` block \*\*unedited\*\*, as the implementer, tied to the brief, each line to its field: \*Type\*, \*Question\*, \*Context\*, \*Trade-off\*, \*Advice\* and \*Meanwhile\* copied into the fields file as written, backticks and all/);
});

// Replaces the pin on "Each line of the block goes to its field, unedited, backticks and all, ..." (escalation-recommends).
test('AC-4, AC-5: the verdict handling runs the triage first, then each line of a raised block goes to its field unedited', () => {
  // Case-sensitive on "Each line", as the pin it replaces is (escalation-recommends l.200).
  assert.match(afterReview(), /([Tt]riage|[Cc]riteria decide).*Each line of the block goes to its field, unedited, backticks and all, and `"suggested": true` on the option it marks/);
});

test('AC-4: a decided `Escalates:` block is a live finding for the next round, and a PASS with one runs one more round counted against roundCap', () => {
  const s = afterReview();
  assert.match(s, /decid(ed|es|e)[^.]{0,60}block.{0,300}(live finding|finding)/i);
  assert.match(s, /PASS.{0,300}one more round.{0,200}roundCap|PASS.{0,300}roundCap.{0,200}one more round/i);
});

test('AC-4: at roundCap a decided block gets no extra round, hard stop 1 fires and its escalation names the decided block', () => {
  const s = afterReview();
  assert.match(s, /hard stop 1/i);
  assert.match(s, /names? the decided or continued block/i);
  assert.match(s, /# Decided from the criteria/);
  assert.match(s, /# Decided and continued/);
});

// Replaces the pin on the raise-table row (escalation-recommends, "TC-4: run names the type of each of its raises in its table").
test('AC-5: the raise-table row says the block is raised unedited after the triage', () => {
  const run = read('skills/run/SKILL.md');
  const row = /\| a `BLOCKED` brief's `## Question` or a reviewer's `Escalates:` block that is a stop[^|]*\|[^|]*\|/.exec(run);
  assert.ok(row, 'raise-table row not found');
  assert.match(row[0], /(triage|criteria).*the block's own `Type:` line, unedited|the block's own `Type:` line, unedited.*(triage|criteria)/i);
});

test('AC-5: the paragraph under the table raises a block unedited after the triage, its order and pick kept', () => {
  const p = slice(read('skills/run/SKILL.md'), '| a friction proposal ("Land the task", step 6; "The friction harvest") | `nit` |', '**Statuses and steps are set');
  assert.match(p, /(?:triage|criteria decide).{0,300}in the block's order, its pick marked as the block marks it, each line copied into its field of the file as written, backticks and all|in the block's order, its pick marked as the block marks it, each line copied into its field of the file as written, backticks and all.{0,300}(?:triage|criteria decide)/i);
});

test('AC-4: the hard-stop table\'s closing paragraph says only a block on the stop list is a stop', () => {
  const p = slice(read('skills/run/SKILL.md'), '**And every place the sub-issue run itself says stop or wait**', 'Notes on the ones that need them:');
  assert.match(p, /a block on the stop list is a stop too \(row 11\)/i);
  assert.match(p, /one the criteria decide raises nothing and one off the stop list is continued/i);
});

// Replaces the pin on "passes its fields through unchanged and keeps its order and its pick" (escalation-recommends, "TC-4, TC-5: the contract ...").
// Deliberately strict (TC-4): it keeps the old pin's "its fields through unchanged ... keeps its order and its pick", so Green's
// "passes the rest through unchanged" (design doc) must keep those words and add the triage.
test('AC-5, AC-6: PROCESS.md passes the fields through unchanged only after the triage', () => {
  assert.match(processEscalations(), /(?:triage|criteria decide).{0,400}(passes|pass) its fields through unchanged.{0,80}keeps its order and its pick|(passes|pass) its fields through unchanged.{0,80}(?:triage|criteria decide).{0,80}keeps its order and its pick|(passes|pass) its fields through unchanged.{0,80}keeps its order and its pick.{0,200}(?:triage|criteria decide)/i);
});

test('AC-4, AC-6: the reviewer reports a gap the criteria decide as a finding with its fix, not an Escalates block', () => {
  const text = read('agents/sdlc-reviewer.md');
  const never = slice(text, '**You never ask the user a question', "**A story's criteria may be in two places.**");
  const bul = bullet(text, '- **Escalates:**');
  for (const s of [never, bul]) {
    assert.match(s, DECIDED);
    assert.match(s, FINDING_WITH_FIX);
    assert.match(s, NOT_ESCALATES);
  }
});

test('AC-4, AC-6: VERDICT.md\'s Escalates line says a gap the criteria decide is a finding with its fix', () => {
  const b = bullet(read('skills/run/templates/VERDICT.md'), '- **Escalates:**');
  assert.match(b, DECIDED);
  assert.match(b, FINDING_WITH_FIX);
});

test('AC-4, AC-6: run\'s reviewer prompt tells it a gap the criteria decide is a finding with its fix, not an Escalates block', () => {
  const s = slice(read('skills/run/SKILL.md'), "- **How it reaches Leeway**: the implementer's read-only", '### 4. Gate again, record, act');
  assert.match(s, DECIDED);
  assert.match(s, FINDING_WITH_FIX);
  assert.match(s, NOT_ESCALATES);
});

test('AC-4, AC-6: the implementer reports a gap the criteria decide under Uncertainties with the deciding criterion, and builds it, not BLOCKED', () => {
  const s = slice(read('agents/sdlc-implementer.md'), '**You have no user to ask.**', '## Proof of life');
  assert.match(s, DECIDED);
  assert.match(s, DECIDING);
  assert.match(s, NOT_BLOCKED);
});

test('AC-4, AC-6: run\'s implementer prompt says the same', () => {
  const s = slice(read('skills/run/SKILL.md'), '- **How it reaches Leeway**, in these words or the equivalent:', '> **Embed critical inputs');
  assert.match(s, DECIDED);
  assert.match(s, DECIDING);
  assert.match(s, NOT_BLOCKED);
});

test('AC-4, AC-6: BRIEF.md says a gap the criteria decide goes under Uncertainties with the deciding criterion, not Status: BLOCKED', () => {
  const s = slice(read('skills/run/templates/BRIEF.md'), '## Uncertainties and cut corners', '- **Type:**');
  assert.match(s, DECIDED);
  assert.match(s, DECIDING);
  assert.match(s, NOT_BLOCKED);
});
