// LWY-266.3: implementers and reviewers decide what is theirs ("Decide it yourself").
// Text pins on plugin/PROCESS.md, plugin/agents/sdlc-implementer.md, plugin/agents/sdlc-reviewer.md, plugin/skills/run/SKILL.md
// and the BRIEF.md and VERDICT.md templates. Round 0: each test is skipped with the criterion it serves.
// The design doc is docs/archive/lwy-266-an-unattended-run-decides-and-continues.md, "Decide it yourself".
//
// How these pins are built (LWY-266.2's round 0 took three attempts to learn it):
// - the four list items are pinned by comparing the extracted items across the three files, never by fixed wording;
// - everything else is pinned on meaning inside a block (a paragraph, or a list item with its children, or a table row),
//   not on one sentence, and a negation is judged in its own clause.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const plugin = process.env.PLUGIN_DIR || join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(plugin, path), 'utf8').replace(/\r\n/g, '\n');
const flat = (text) => text.replace(/\s+/g, ' ').trim();

const red = (criterion, name, fn) => test(`${criterion}: ${name}`, { skip: `red-test-${criterion}` }, fn);

const process_ = () => read('PROCESS.md');
const implementer = () => read('agents/sdlc-implementer.md');
const reviewer = () => read('agents/sdlc-reviewer.md');
const run = () => read('skills/run/SKILL.md');
const brief = () => read('skills/run/templates/BRIEF.md');
const verdict = () => read('skills/run/templates/VERDICT.md');

const DECIDED_SECTION = '## Decided and continued';

// ---- helpers ------------------------------------------------------------------------------------------------------

// Paragraph-level blocks of a text: blockquote markers stripped, split on blank lines, an indented chunk (a list item's
// own further paragraph) or a list that follows a paragraph ending in a colon joined to the block before it. Each block is
// returned flattened.
const blocks = (text) => {
  const out = [];
  for (const chunk of text.replace(/^[ \t]*>[ \t]?/gm, '').split(/\n[ \t]*\n/)) {
    if (out.length && (/^ {2,}\S/.test(chunk) || (/:\s*$/.test(out[out.length - 1]) && /^\s*(?:[-*+]|\d+[.)])\s/.test(chunk)))) out[out.length - 1] += `\n${chunk}`;
    else out.push(chunk);
  }
  return out.map(flat).filter(Boolean);
};
// "Status: BLOCKED" is one phrase, so a colon after "Status" does not end a clause.
const clauses = (text) => flat(text).split(/(?<=[.;!?]|(?<!Status):)\s+|\s+—\s+/);
const slice = (text, from, to) => {
  const start = text.indexOf(from);
  assert.notEqual(start, -1, `anchor not found: ${from}`);
  const end = text.indexOf(to, start + from.length);
  assert.notEqual(end, -1, `anchor not found: ${to}`);
  return text.slice(start, end);
};

// The lines of the heading that contains `title`, down to the next heading of its level or above (fenced lines skipped).
const sectionLines = (text, title) => {
  const all = text.split('\n');
  const first = all.findIndex((line) => /^#+ /.test(line) && line.includes(title));
  assert.notEqual(first, -1, `anchor not found: a heading titled ${title}`);
  const level = /^(#+) /.exec(all[first])[1].length;
  const out = [all[first]];
  let fenced = false;
  for (const line of all.slice(first + 1)) {
    if (/^\s*```/.test(line)) fenced = !fenced;
    const heading = !fenced && /^(#+) /.exec(line);
    if (heading && heading[1].length <= level) break;
    out.push(line);
  }
  return out;
};

// The first list after the line that introduces "Decide it yourself" (a heading, or a line that opens with bold or italic
// "Decide it yourself"), as its items: an item is its marker line and everything under it, children and further paragraphs
// included. The list ends at the next heading or at a non-blank line back at or left of the item marker that is not itself
// an item marker.
const MARKER = /^(\s*)(?:[-*+]|\d+[.)])\s+/;
const LIST_ANCHOR = /decide it yourself/i;
const listItems = (text, label) => {
  const lines = text.split('\n');
  const at = lines.findIndex((l) => (/^#+ /.test(l) || /^\s*[*_]+/.test(l)) && LIST_ANCHOR.test(l) && !MARKER.test(l));
  assert.notEqual(at, -1, `${label}: no heading or bold lead "Decide it yourself"`);
  let i = at + 1;
  while (i < lines.length && !MARKER.test(lines[i])) {
    assert.ok(!/^#+ /.test(lines[i]), `${label}: a heading comes before any list item after "Decide it yourself"`);
    i += 1;
  }
  assert.ok(i < lines.length, `${label}: no list after "Decide it yourself"`);
  const base = MARKER.exec(lines[i])[1].length;
  const items = [];
  for (; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^#+ /.test(line)) break;
    const m = MARKER.exec(line);
    if (m && m[1].length === base) {
      items.push([line]);
      continue;
    }
    if (line.trim() === '') {
      items[items.length - 1].push(line);
      continue;
    }
    const indent = /^\s*/.exec(line)[0].length;
    if (indent <= base && lines[i - 1].trim() === '') break;
    items[items.length - 1].push(line);
  }
  return items.map((it) => flat(it.join('\n')).replace(MARKER, ''));
};
const listEnd = (text) => {
  // The line index just past "Decide it yourself"'s list, for the prose that follows it.
  const lines = text.split('\n');
  const at = lines.findIndex((l) => (/^#+ /.test(l) || /^\s*[*_]+/.test(l)) && LIST_ANCHOR.test(l) && !MARKER.test(l));
  let i = at + 1;
  while (i < lines.length && !MARKER.test(lines[i])) i += 1;
  const base = MARKER.exec(lines[i])[1].length;
  let last = i;
  for (; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^#+ /.test(line)) break;
    if (line.trim() === '') continue;
    const indent = /^\s*/.exec(line)[0].length;
    if (indent <= base && !(MARKER.test(line) && indent === base) && lines[i - 1].trim() === '') break;
    last = i;
  }
  return lines.slice(last + 1).join('\n');
};

const processDecide = () => sectionLines(process_(), 'Decide it yourself').join('\n');
const processItems = () => listItems(processDecide(), 'PROCESS.md');
const implementerItems = () => listItems(implementer(), 'sdlc-implementer.md');
const reviewerItems = () => listItems(reviewer(), 'sdlc-reviewer.md');

// What each of the four items of AC-4 says, in the order AC-4 gives them.
const ITEM_MEANING = [
  ['states that should not occur', /\bstates?\b[^.]{0,30}\b(should not|cannot|can not|never)\b[^.]{0,20}\b(occur|happen|arise)\b/i],
  ['error wording', /\berror (wording|messages?|text)\b/i],
  ['a choice between equally good data sources', /\bequally good\b[^.]{0,80}\bdata sources?\b|\bdata sources?\b[^.]{0,80}\bequally good\b/i],
  ['a test-plumbing fix that leaves every assertion unchanged, which for a frozen test is `## Frozen test fix`', null],
];

// "stop list" and "stop-list" are the same words (the task itself writes "a stop-list one").
const STOP = /\bstop[- ]list\b/i;

// Where a block, or a clause, names `BLOCKED` and the `## Question` block together.
const BLOCKED_QUESTION = (b) => /\bBLOCKED\b/.test(b) && /## Question/.test(b);
// The clauses of a block, a list item's marker also ending one: a clause is judged on its own, not on the paragraph around it.
const itemClauses = (b) => b.split(/\s+(?:[-*+]|\d+[.)])\s+(?=[A-Z`*_])/).flatMap(clauses);
// A clause that returns `BLOCKED` with a `## Question` is on the stop list when the stop list is named in it, in its lead (the
// clause before it, when that ends in a colon or semicolon, or the list item's lead line), or in the clause right after it in
// the same block ("That is for the stop list only"). In its own clause the stop list counts unless a "never" or "cannot" stands
// between `BLOCKED` and it ("…only when you cannot decide, and never build a pick for a stop list question" is no rule). A clause
// that says "otherwise" or "any other" is off the list whatever its context says, and a clause that forbids `BLOCKED` is no
// permission. "only" alone does not put a clause on the stop list.
const ON_THE_LIST = /\b(?:for|on|of|from|to|when|if|only)\b[^.;:]{0,40}\bstop[- ]list\b|\bstop[- ]list (?:questions?|ones?|items?|alone|only)\b/i;
const ELSE_MARK = /\b(?:otherwise|any other|anything else|everything else|for the rest|the rest)\b/i;
const NEGATION = /\b(?:never|not|don't|do not|doesn't|cannot|can't|nor)\b/i;
// The stop list named in the clause, but not after a "never" or "cannot" that follows `BLOCKED`.
const namesStopList = (c) => {
  const stop = c.search(STOP);
  return stop !== -1 && !NEGATION.test(c.slice(c.search(/\bBLOCKED\b/), Math.max(stop, 0)));
};
const FORBIDS_BLOCKED = /\b(?:never|not|don't|doesn't|cannot|can't|nor)\b(?:\s+\w+){0,4}\s+\W*BLOCKED\b/i;
const blockedOffTheStopList = (text) => {
  const all = blocks(text).map((b) => itemClauses(b.replace(/\s+—\s+/g, ': ')));
  const off = [];
  all.forEach((units, bi) =>
    units.forEach((c, i) => {
      if (!BLOCKED_QUESTION(c) || FORBIDS_BLOCKED.test(c)) return;
      const lead = i > 0 ? units[i - 1] : bi > 0 ? all[bi - 1].at(-1) : '';
      const context = [/[:;]$/.test(lead) ? lead : '', units[i + 1] || ''];
      const onList = !ELSE_MARK.test(c) && (namesStopList(c) || context.some((x) => ON_THE_LIST.test(x) && !ELSE_MARK.test(x)));
      if (!onList) off.push(c);
    }),
  );
  return off;
};

// A clause that tells the reviewer to write or edit a test: "you" or "the reviewer" as the subject, or a sentence-initial imperative,
// with no negation ahead of it in the clause. "for the next round to write" and "the next round should write" have no such
// subject and are not one. In a *Test* field (inField) the object may be "it" or "them", as the field already names the test.
const WRITE = '(?:write|edit|add|create|author)';
const MODALS = '(?:may |must |should |can |will |also |then |to )*';
const toldToWriteATest = (text, inField = false) =>
  clauses(text).filter((c) => {
    const object = inField ? '(?:tests?|it|them)' : 'tests?';
    if (!inField && !/\btests?\b/i.test(c)) return false;
    // in a *Test* field "write it" is an order only with "yourself" or "this round" ("Write it as the human will read it" is not one)
    const imperative = `^(?:write|edit|create|author)\\b[^.;,]{0,40}\\b(?:tests?${inField ? "|(?:it|them)\\b[^.;,]{0,30}\\b(?:yourself|this round)" : ""})\\b`;
    const subject = new RegExp(
      `\\b(?:you|the reviewer|reviewers?)\\s+${MODALS}${WRITE}s?\\b[^.;]{0,60}\\b${object}\\b|${imperative}|\\b(?:and|then|also)\\s+(?:also\\s+)?${WRITE}\\b[^.;]{0,50}\\b${object}\\b`,
      'i',
    );
    const m = subject.exec(c);
    if (!m) return false;
    if (/^(?:and|then|also)\b/i.test(m[0]) && /\b(next round|next implementer|implementer|round)\b/i.test(c)) return false;
    return !/\b(never|not|no|nor|don't|doesn't|do not|does not|cannot|can't)\b/i.test(c.slice(0, m.index));
  });

// ---- the list: PROCESS.md, and the same four items in both agents --------------------------------------------------------

red('AC-4', 'PROCESS.md has a section "Decide it yourself" whose list is the four items of AC-4, in that order', () => {
  const items = processItems();
  assert.equal(items.length, 4, `the list has ${items.length} items`);
  ITEM_MEANING.slice(0, 3).forEach(([name, re], n) => assert.match(items[n], re, `item ${n + 1} (${name})`));
});

red('AC-4', 'the fourth item is the test-plumbing one: every assertion unchanged, and for a frozen test LWY-244.1\'s `## Frozen test fix`', () => {
  const item = processItems()[3];
  assert.match(item, /\btest[- ]plumbing\b/i);
  assert.match(item, /\bevery assertion\b[^.]{0,40}\bunchanged\b|\bunchanged\b[^.]{0,40}\bevery assertion\b|\bleaves every assertion\b/i);
  assert.match(item, /\bfrozen\b/i);
  assert.match(item, /`## Frozen test fix`/);
});

red('AC-4', 'after the list: "decide and continue" for other behaviour the criteria leave open, then "only the stop list stops"', () => {
  const rest = flat(listEnd(processDecide()));
  const dc = rest.search(/decide and continue/i);
  const stop = rest.search(/only the stop[- ]list stops/i);
  assert.notEqual(dc, -1, 'no "decide and continue" after the list');
  assert.notEqual(stop, -1, 'no "only the stop list stops" after the list');
  assert.ok(dc < stop, '"decide and continue" comes after "only the stop list stops"');
  const between = rest.slice(0, stop);
  assert.match(between, /\bcriteria\b[^.]{0,80}\b(leave|leaves|do not cover|does not cover|not cover|do not decide|does not decide|left open)\b|\b(leave|leaves|left)\b[^.]{0,40}\bopen\b[^.]{0,80}\bcriteria\b|\bcriteria\b[^.]{0,60}\bopen\b/i);
  assert.match(between, /\b(behaviour|behavior)\b/i);
});

red('AC-4', 'the four items read word for word the same in PROCESS.md, sdlc-implementer.md and sdlc-reviewer.md', () => {
  const p = processItems();
  const i = implementerItems();
  const r = reviewerItems();
  assert.equal(p.length, 4);
  assert.deepEqual(i, p, 'sdlc-implementer.md differs from PROCESS.md');
  assert.deepEqual(r, p, 'sdlc-reviewer.md differs from PROCESS.md');
});

// ---- the implementer ----------------------------------------------------------------------------------------------------

red('AC-4', 'the implementer builds a question off the stop list with its pick and reports it in the brief\'s `## Decided and continued` section, in the `## Question` fields with the pick marked', () => {
  const ok = blocks(implementer()).some(
    (b) =>
      b.includes(DECIDED_SECTION) &&
      /## Question/.test(b) &&
      /\bpick\b/i.test(b) &&
      /\bmarked\b|\(suggested\)/i.test(b) &&
      /\bbuil[dt]\b|\bbuilding\b/i.test(b) &&
      STOP.test(b),
  );
  assert.ok(ok, 'no block ties a question off the stop list to its pick, built, and reported under `## Decided and continued` with the `## Question` fields');
});

red('AC-4', 'the implementer returns `BLOCKED` with `## Question` for the stop list only', () => {
  const blocked = blocks(implementer()).filter(BLOCKED_QUESTION);
  assert.ok(blocked.length > 0, 'no block describes returning `BLOCKED` with a `## Question`');
  assert.deepEqual(blockedOffTheStopList(implementer()), [], 'a clause returns BLOCKED with ## Question for a question that is not on the stop list');
  // "for the stop list only", or the rule stated for the stop list ("For a question on the stop list: return BLOCKED"); that no clause
  // allows it off the list is the assertion above
  assert.ok(
    blocked.some((b) => /\bonly\b[^.;]{0,100}\bstop[- ]list\b|\bstop[- ]list\b[^.;]{0,60}\bonly\b|\bstop[- ]list (alone|only)\b/i.test(b) || ON_THE_LIST.test(b)),
    'no block says BLOCKED with ## Question is for the stop list only',
  );
});

red('AC-4', 'the implementer is never allowed to return `BLOCKED` for a question off the stop list, and never builds a pick for one on it', () => {
  const ok = blocks(implementer()).some(
    (b) =>
      /\bBLOCKED\b/.test(b) &&
      STOP.test(b) &&
      clauses(b).some((c) => /\b(never|not|do not|does not|don't)\b(\s+\w+){0,3}\s+(build|built|building|go on|carry on|continue|decide|decided|guess)\b/i.test(c) || /\bnever\b[^.;]{0,40}\b(built|decided|continued)\b/i.test(c)),
  );
  assert.ok(ok, 'no block says a stop-list question is never built with a pick: it returns BLOCKED');
  assert.deepEqual(blockedOffTheStopList(implementer()), [], 'a clause allows BLOCKED with ## Question for a question that need not be on the stop list');
});

// ---- the reviewer -------------------------------------------------------------------------------------------------------

const testField = (text) => {
  const start = text.search(/\*{1,2}Test:?\*{1,2}/);
  assert.notEqual(start, -1, 'no *Test* field');
  const after = text.slice(start).replace(/^\*{1,2}Test:?\*{1,2}/, '');
  const next = after.search(/\*{1,2}[A-Z][A-Za-z-]*:?\*{1,2}/);
  return flat(next === -1 ? after : after.slice(0, next));
};
const escalatesBullet = (text) => {
  const start = text.indexOf('- **Escalates:**');
  assert.notEqual(start, -1, 'anchor not found: - **Escalates:**');
  const lines = text.slice(start).split('\n');
  const out = [lines[0]];
  for (const l of lines.slice(1)) {
    if (/^- \S/.test(l) || /^#+ /.test(l)) break;
    out.push(l);
  }
  return out.join('\n');
};

red('AC-4', 'the reviewer\'s `Escalates:` block gains *Test*: the test that would pin its suggested answer, for the next round to write', () => {
  const field = testField(escalatesBullet(reviewer()));
  assert.match(field, /\bpin(s|ning)?\b/i);
  assert.match(field, /\bsuggested\b|\bpick\b/i);
  assert.match(field, /\bnext round\b/i);
  assert.match(field, /\bwrit(e|es|ten|ing)\b/i);
  assert.deepEqual(toldToWriteATest(field, true), [], 'the Test field tells the reviewer to write the test');
});

red('AC-4', 'the reviewer reads the same decide-it-yourself list, as a gap the criteria decide stays a finding (the list is the four items, identical to PROCESS.md)', () => {
  assert.equal(reviewerItems().length, 4);
  assert.match(flat(reviewer()), /A gap the criteria decide/);
});

red('AC-4', 'the reviewer still never edits code, and is never told to write or edit a test (reviewer definition, run\'s reviewer prompt, VERDICT.md, PROCESS.md)', () => {
  assert.match(flat(reviewer()), /the reviewer never edits code/);
  assert.match(testField(escalatesBullet(reviewer())), /\bnext round\b/i, 'the Escalates block has no *Test* for the next round to write');
  for (const bad of ['Write the test that pins your suggested answer.', 'You write the test that pins your pick.', 'The reviewer may add a test for it.', 'Escalate, and also write a test for the suggested answer.', 'Test: you must create the failing test in the repo.', 'You also write the test.', 'The reviewer writes the test.', 'Write the test yourself.']) {
    assert.notDeepEqual(toldToWriteATest(bad), [], bad);
  }
  for (const bad of ['the test for the next round; you write it yourself', 'the test that pins it, and you write it', 'the reviewer writes it', 'you write them in this round', 'Write it yourself.']) {
    assert.notDeepEqual(toldToWriteATest(bad, true), [], `in a Test field: ${bad}`);
  }
  for (const good of [
    'Test: the test that would pin its suggested answer, for the next round to write.',
    'The reviewer never edits code, not even to try one, and never writes a test.',
    'You do not write or edit a test.',
    'Break a test to watch it fail, and restore it.',
    'The next round should write the test.',
    'Tell the next round to write the test that pins it.',
    'Test: the test that would pin it, for the next round to write the test.',
  ]) {
    assert.deepEqual(toldToWriteATest(good), [], good);
  }
  for (const good of ['the test that would pin its suggested answer, for the next round to write', 'the test for the next round to write; you never write it', 'the next round writes it', 'you do not write them']) {
    assert.deepEqual(toldToWriteATest(good, true), [], `in a Test field: ${good}`);
  }
  const reviewerPrompt = slice(run(), "- **How it reaches Leeway**: the implementer's read-only", '### 4. Gate again, record, act');
  for (const [name, text] of Object.entries({ 'sdlc-reviewer.md': escalatesBullet(reviewer()), 'VERDICT.md': escalatesBullet(verdict()), 'run reviewer prompt': reviewerPrompt })) {
    assert.deepEqual(toldToWriteATest(testField(text), true), [], `the *Test* field in ${name} tells the reviewer to write the test`);
  }
  for (const [name, text] of Object.entries({ 'sdlc-reviewer.md': reviewer(), 'run reviewer prompt': reviewerPrompt, 'VERDICT.md': verdict(), 'PROCESS.md': processDecide() })) {
    assert.deepEqual(toldToWriteATest(text), [], `${name} tells the reviewer to write or edit a test`);
  }
});

// ---- the templates ------------------------------------------------------------------------------------------------------

red('AC-4', 'BRIEF.md has a `## Decided and continued` section: the `## Question` fields with the pick marked, and `none` when empty', () => {
  const lines = brief().split('\n');
  assert.ok(lines.includes(DECIDED_SECTION), 'no line is exactly "## Decided and continued"');
  const body = sectionLines(brief(), 'Decided and continued').join('\n');
  assert.match(body, /\bnone\b/);
  assert.match(body, /## Question/);
  assert.match(body, /\bpick\b/i);
  assert.match(body, /\bmarked\b|\(suggested\)/i);
});

red('AC-4', 'BRIEF.md says `Status: BLOCKED` with a `## Question` is for the stop list, not for a question that can be decided and continued', () => {
  const s = slice(brief(), '## Uncertainties and cut corners', '- **Type:**');
  assert.match(flat(s), STOP);
  assert.match(flat(s), /Decided and continued/);
});

red('AC-4', 'VERDICT.md: *Test* under *Escalates*, in the template line and in the worked example', () => {
  const bullet = escalatesBullet(verdict());
  const field = testField(bullet);
  assert.match(field, /\bpin(s|ning)?\b/i);
  assert.match(field, /\bsuggested\b|\bpick\b/i);
  assert.match(field, /\bnext round\b/i);
  const example = verdict().slice(verdict().indexOf('\n## Worked example'));
  const exampleBlock = escalatesBullet(example);
  assert.match(exampleBlock, /- \*\*Test:\*\*/, 'the worked example\'s Escalates block has no Test line');
});

// ---- run's SKILL.md -----------------------------------------------------------------------------------------------------

const implementerPrompt = () => slice(run(), '- **How it reaches Leeway**, in these words or the equivalent:', '> **Embed critical inputs');
const reviewerPromptText = () => slice(run(), "- **How it reaches Leeway**: the implementer's read-only", '### 4. Gate again, record, act');

red('AC-4', 'run\'s implementer prompt says so, beside "A gap the criteria already decide is not a question": decide it yourself, `## Decided and continued`, `BLOCKED` for the stop list only', () => {
  const s = implementerPrompt();
  const gap = s.indexOf('A gap the criteria already decide is not a question');
  const decided = s.indexOf(DECIDED_SECTION);
  assert.notEqual(gap, -1);
  assert.notEqual(decided, -1, 'the implementer prompt does not name `## Decided and continued`');
  assert.ok(gap < decided, 'the new lines do not sit after the gap line');
  assert.match(flat(s), /decide it yourself/i);
  assert.deepEqual(blockedOffTheStopList(s), [], 'the prompt returns BLOCKED with ## Question for a question that is not on the stop list');
});

red('AC-4', 'run\'s reviewer prompt says so, beside "A gap the criteria decide is a finding, with its fix": the list, and *Test* on an `Escalates:` block', () => {
  const s = reviewerPromptText();
  const gap = s.indexOf('A gap the criteria decide is a');
  const test_ = s.search(/\*{1,2}Test:?\*{1,2}/);
  assert.notEqual(gap, -1);
  assert.notEqual(test_, -1, 'the reviewer prompt does not name *Test*');
  assert.ok(gap < test_, 'the new lines do not sit after the gap line');
  assert.match(flat(s), /decide it yourself/i);
  assert.match(testField(s), /\bpin(s|ning)?\b/i);
});

const gateSection = () => slice(run(), '### 2. Gate, commit, push, record', '### 3. Delegate to the reviewer');

red('AC-4', 'the gate raises each `## Decided and continued` block through "Stop, or decide and continue"', () => {
  const ok = blocks(gateSection()).some((b) => b.includes(DECIDED_SECTION) && /Stop, or decide and continue/.test(b) && /\braise[sd]?\b/i.test(b));
  assert.ok(ok, 'no block of step 2 raises each `## Decided and continued` block through "Stop, or decide and continue"');
});

red('AC-4', 'a `## Decided and continued` block that is on the stop list is a gate failure (the implementer should have returned `BLOCKED`) and is not raised as continued', () => {
  const found = blocks(gateSection()).filter((b) => b.includes(DECIDED_SECTION) && STOP.test(b));
  assert.ok(found.length > 0, 'no block of step 2 speaks of a stop-list `## Decided and continued` block');
  const ok = found.some(
    (b) =>
      /\bgate failure\b|\bfails the gate\b/i.test(b) &&
      /should have returned (`?Status: )?`?BLOCKED`?/i.test(b) &&
      clauses(b).some((c) => /\b(not|never)\b[^.;]{0,50}\b(raised|continued)\b/i.test(c) && !/\b(not|never)\b[^.;]{0,25}\b(a|the) gate failure\b/i.test(c)),
  );
  assert.ok(ok, 'the gate does not call a stop-list `## Decided and continued` block a failure that is not raised as continued');
});

red('AC-4', 'the continued `Escalates:` block\'s live finding carries its *Test*', () => {
  const ok = blocks(run()).some((b) => /\blive finding\b/i.test(b) && /\bEscalates\b/.test(b) && /\*{1,2}Test:?\*{1,2}/.test(b) && /continu|decided/i.test(b));
  assert.ok(ok, 'no block of run ties a continued Escalates block\'s live finding to its *Test*');
});

// An `Escalates:` block is raised with each line to its field, and plugin/scripts/raise.mjs refuses a key it does not know (exit 2):
// a *Test* line copied into the fields file would break every continued raise of such a block.
const OUT_OF_THE_FIELDS = /\b(not|never|nor|without|neither|out of|excluded?|omit(ted)?|left out|leave[sd]? out|kept out|off|apart|away|separate(ly)?|only on|isn't|aren't|no field|outside)\b/i;
red('AC-4', 'the *Test* line goes to the live finding and not into the escalation\'s fields file', () => {
  const found = blocks(run()).filter((b) => /\*{1,2}Test:?\*{1,2}/.test(b) && /\blive finding\b/i.test(b) && /\bfields?\b/i.test(b));
  assert.ok(found.length > 0, 'no block of run names the *Test*, the live finding and the fields file together');
  // An exclusion word within 40 characters of "fields" or "file" ("stays out of the file", "kept apart from the fields", "leave it off
  // the fields file"), in a clause that names the *Test*, or that holds a pronoun ("It is not copied into the fields file") after a clause that does.
  const NAMES_TEST = /\*{1,2}Test:?\*{1,2}|\bTest line\b/;
  const near = new RegExp(`(?:${OUT_OF_THE_FIELDS.source})[^.;]{0,40}\\b(?:fields?|file)\\b|\\b(?:fields?|file)\\b[^.;]{0,40}(?:${OUT_OF_THE_FIELDS.source})`, 'i');
  const ok = found.some((b) => {
    const cs = itemClauses(b);
    return cs.some((c, i) => (near.test(c) || /\bno fields?\b/i.test(c)) && (NAMES_TEST.test(c) || (/\b(?:it|them|this|that)\b/i.test(c) && NAMES_TEST.test(cs[i - 1] || ''))));
  });
  assert.ok(ok, 'no clause says the *Test* line stays out of the escalation\'s fields file');
  for (const b of found) {
    const into = itemClauses(b).filter((c) => /\*{1,2}Test:?\*{1,2}/.test(c) && /\bfields? file\b/i.test(c) && !OUT_OF_THE_FIELDS.test(c));
    assert.deepEqual(into, [], 'a clause puts the *Test* line into the fields file');
  }
});
