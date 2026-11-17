// LWY-266.2: `run` reads the answers behind its picks and debt proposals ("Reading the answers behind"), at every round
// boundary, before the story gate's merge and at the plan's end, and no debt proposal waits anywhere.
// Text pins on plugin/skills/run/SKILL.md. Round 0: each test is skipped with the criterion it serves.
// Design doc: docs/archive/lwy-266-an-unattended-run-decides-and-continues.md, "Reading the answers behind".
//
// The unit a pin binds facts in is a BLOCK, never a sentence: a list item together with its nested children (a parent
// bullet's words travel with its children), a paragraph, or a table row. Facts the criteria tie together (a differing
// answer is `backlog` and never `done`) are checked inside one such unit; a wait is judged in its own clause.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const plugin = process.env.PLUGIN_DIR || join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(plugin, path), 'utf8').replace(/\r\n/g, '\n');
const flat = (text) => text.replace(/\s+/g, ' ').trim();

const red = (criterion, name, fn) => test(`${criterion}: ${name}`, { skip: `red-test-${criterion}` }, fn);

const run = () => read('skills/run/SKILL.md');

// The heading line containing `title`, down to the next heading of its level or above (fenced blocks skipped).
const rawSection = (text, title) => {
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
  return out.join('\n');
};
const rawSlice = (text, from, to) => {
  const start = text.indexOf(from);
  assert.notEqual(start, -1, `anchor not found: ${from}`);
  const end = text.indexOf(to, start);
  assert.notEqual(end, -1, `anchor not found: ${to}`);
  return text.slice(start, end);
};

// A tree of blocks. A list item owns its nested items and the lines that continue it; a table row, a heading and a
// paragraph are leaves. `own` is the node's own words, `subtree` its own words and every descendant's.
const ITEM = /^\s*(?:[-*]|\d+\.)\s+/;
const tree = (raw) => {
  const roots = [];
  const stack = [];
  let cur = null;
  let blank = false;
  let fenced = false;
  const add = (line, kind, parent) => {
    const node = { lines: [line.trim()], kind, children: [] };
    (parent ? parent.children : roots).push(node);
    return node;
  };
  for (const line of raw.split('\n')) {
    if (/^\s*```/.test(line)) {
      fenced = !fenced;
      continue;
    }
    if (fenced) {
      if (cur) cur.lines.push(line.trim());
      continue;
    }
    if (!line.trim()) {
      blank = true;
      continue;
    }
    const indent = /^\s*/.exec(line)[0].length;
    if (ITEM.test(line)) {
      while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop();
      cur = add(line, 'item', stack.length ? stack[stack.length - 1].node : null);
      stack.push({ indent, node: cur });
    } else if (/^\s*\|/.test(line) || /^#+ /.test(line)) {
      stack.length = 0;
      cur = add(line, /^#+ /.test(line) ? 'heading' : 'row', null);
    } else if (cur && cur.kind !== 'row' && cur.kind !== 'heading' && !blank) {
      cur.lines.push(line.trim());
    } else if (blank && stack.length && indent > stack[stack.length - 1].indent) {
      while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop();
      cur = stack[stack.length - 1].node;
      cur.lines.push(line.trim());
    } else {
      stack.length = 0;
      cur = add(line, 'para', null);
    }
    blank = false;
  }
  const finish = (n) => {
    n.own = flat(n.lines.join(' '));
    n.children.forEach(finish);
  };
  roots.forEach(finish);
  return roots;
};
const subtree = (n) => flat([n.own, ...n.children.map(subtree)].join(' '));
const walk = (n, fn, ancestors = []) => {
  fn(n, ancestors);
  n.children.forEach((k) => walk(k, fn, [...ancestors, n]));
};
const nodes = (raw) => {
  const all = [];
  tree(raw).forEach((r) => walk(r, (n, anc) => all.push({ node: n, ancestors: anc })));
  return all;
};
// The top-level blocks of a text, each flattened with everything nested in it.
const blocks = (raw) => tree(raw).filter((n) => n.kind !== 'heading').map(subtree);
const blockSays = (raw, ...res) => blocks(raw).some((b) => res.every((re) => re.test(b)));
const assertBlock = (raw, ...res) =>
  assert.ok(blockSays(raw, ...res), `no block (a list item with its children, a paragraph or a table row) says all of ${res.join(' and ')}`);

// The same, tied to one item: some list item, paragraph or row whose own words match `anchor`, with what is nested in it and
// the words of the items above it, says the rest. Where a parent bullet holds several steps, the step is the unit.
const assertAt = (raw, anchor, ...res) =>
  assert.ok(
    nodes(raw).some(({ node, ancestors }) => {
      if (!anchor.test(node.own)) return false;
      const text = flat([...ancestors.map((a) => a.own), subtree(node)].join(' '));
      return res.every((re) => re.test(text));
    }),
    `no list item, paragraph or row about ${anchor} says all of ${res.join(' and ')}`,
  );

const splitSentences = (text) =>
  flat(text)
    .split(/(?<=[.?!])\s+(?=[A-Z`*#|(<"])|\s*\|\s*/)
    .filter(Boolean);
// A clause: a sentence cut at punctuation and at the words that start a new statement. A wait is judged in its own.
const clauses = (sentence) =>
  sentence
    .replace(/,?\s*\b(such as|for example|for instance|namely)\b/gi, ' $1')
    .split(/\s*(?:[,;:—|(]|\b(?:and|but|while|until|whereas|which|since|because|though|although)\b)\s*/i)
    .filter(Boolean);
const NEG = /\b(?:not|never|no|nor|neither|without|cannot)\b|n't\b/i;
// A word is negated when a negation comes before it in its clause ("never waits", "without a wait"), not after it
// ("waits on it without a timeout").
const negates = (clause, re) => {
  const hit = re.exec(clause);
  return Boolean(hit) && NEG.test(clause.slice(0, hit.index));
};

const SUB = 'Reading the answers behind';
const sub = () => rawSection(run(), SUB);
const BEFORE = /\b(?:before|ahead of|prior to)\b/i;
const PLANS_END = /plan'?s end|end of the plan/i;

const DEBT = /\bdebt\b/i;
const WAIT = /\b(?:a?wait\w*|holds?|stops? (?:\w+ ){0,2}(?:for|on|until|at) (?:an? |the |each |every |any |its )?debt)\b/i;
const DEBT_BLOCKS = /\bdebt (?:\w+ ){0,2}(blocks?(?! nothing)|blocked|halts?|stalls?|pauses?|stops?)\b/i;
// Where in the clause a wait (or a debt proposal that blocks, halts or stops) is said, or -1.
const waitAt = (clause, extra = null) => {
  const at = [];
  for (const re of [WAIT, extra]) {
    const m = re && re.exec(clause);
    if (m) at.push(m.index);
  }
  const b = DEBT_BLOCKS.exec(clause);
  if (b) at.push(b.index + b[0].length - b[1].length);
  return at.length ? Math.min(...at) : -1;
};
// The one clause about a wait that stays: "nothing in hand waits on it", the debt row's reassurance.
const EXEMPT = /\bnothing (?:in hand |else )?waits? on\b/i;
// The sentences of a tree that carry a wait in a clause of their own that no negation in that clause cancels, where the clause
// (or the one before it, or the list item it sits under) names `debt`, or `all`: "A debt proposal is raised and the run waits on it".
const debtWaits = (raw, { all = false, extra = null } = {}) => {
  const out = new Set();
  for (const { node, ancestors } of nodes(raw)) {
    const context = ancestors.map((a) => a.own).join(' ');
    for (const sentence of splitSentences(node.own)) {
      const cs = clauses(sentence);
      cs.forEach((c, i) => {
        const aboutDebt = all || DEBT.test(c) || (i > 0 && DEBT.test(cs[i - 1])) || DEBT.test(context);
        const at = waitAt(c, extra);
        if (aboutDebt && at !== -1 && !NEG.test(c.slice(0, at)) && !EXEMPT.test(c)) out.add(sentence);
      });
    }
  }
  return [...out];
};

// A differing answer's units: the list items, paragraphs or rows whose own words mention "differ", each with all that is
// nested in it. Walking its clauses in order, a clause names the case it speaks of (differs, or matches) and the clauses
// after it keep that case until another names one, so "a matching answer posts X and sets it `done`; a differing one ..."
// keeps each `done` with its own case.
const DIFFER = /differ/i;
const MATCH = /\b(?:match\w*|equal\w*|agree\w*)\b/i;
const NOT_ABOUT_THE_ANSWER = /plan'?s end|status update|\blists?\b|unanswered/i;
const ALREADY = /already|marker|second reading/i;
// A unit is the item itself, with the items that go on from it ("- It stays `backlog` ...", with no case of its own).
const CONTINUES = /^\W*(?:it|its|the follow-up|then|that|this|once)\b/i;
const differUnits = (raw) => {
  const units = [];
  const find = (siblings) =>
    siblings.forEach((n, i) => {
      if (!DIFFER.test(n.own)) return find(n.children);
      const unit = [n];
      for (const next of siblings.slice(i + 1)) {
        if (next.kind !== 'item' || DIFFER.test(next.own) || MATCH.test(next.own) || !CONTINUES.test(next.own)) break;
        unit.push(next);
      }
      units.push(unit);
    });
  find(tree(raw));
  return units;
};
const differFacts = (unit) => {
  const facts = { sets_done: [], never_done: false, backlog: false };
  const go = (n, caseOf) => {
    for (const sentence of splitSentences(n.own)) {
      for (const c of clauses(sentence)) {
        if (DIFFER.test(c) || (MATCH.test(c) && NEG.test(c))) caseOf = 'differs';
        else if (MATCH.test(c)) caseOf = 'matches';
        if (caseOf === 'differs' && /\bbacklog\b/i.test(c)) facts.backlog = true;
        if (!/\bdone\b/i.test(c)) continue;
        if (negates(c, /\bdone\b/i)) {
          if (caseOf === 'differs' && !NOT_ABOUT_THE_ANSWER.test(sentence)) facts.never_done = true;
        } else if (caseOf === 'differs' && !ALREADY.test(c)) facts.sets_done.push(c);
      }
    }
    n.children.forEach((k) => go(k, caseOf));
    return caseOf;
  };
  let caseOf = null;
  for (const n of unit) caseOf = go(n, caseOf);
  return facts;
};

red('TC-4', 'the subsection "Reading the answers behind" exists, under a heading of its own', () => {
  assert.ok(/^#{3,5} .*Reading the answers behind/m.test(run()), 'anchor not found: a heading titled Reading the answers behind');
});

red('TC-4', 'it is read at every round boundary: before the next implementer round and before the next task', () => {
  const s = sub();
  assert.match(flat(s), /round boundary/i);
  assertBlock(s, BEFORE, /next implementer round/i);
  assertBlock(s, BEFORE, /next task/i);
});

red('TC-4', 'it is read at the story gate, before step 1\'s merge', () => {
  assertBlock(sub(), /story gate/i, BEFORE, /merge/i);
});

red('TC-4', 'it is read at the plan\'s end, before its status update', () => {
  assertBlock(sub(), PLANS_END, BEFORE, /status update/i);
});

red('TC-4', 'the story gate calls it before its first step (the merge of the base), and the plan\'s end before its status update', () => {
  const gate = flat(rawSection(run(), 'The story gate'));
  const at = gate.indexOf(SUB);
  assert.notEqual(at, -1, 'the story gate does not name "Reading the answers behind"');
  const merge = gate.indexOf("Merge the story's base into the story branch");
  assert.notEqual(merge, -1, 'anchor not found: Merge the story\'s base into the story branch');
  assert.ok(at < merge, 'named after the merge');
  const end = flat(rawSection(run(), "The plan's end"));
  const atEnd = end.indexOf(SUB);
  assert.notEqual(atEnd, -1, 'the plan\'s end does not name "Reading the answers behind"');
  const update = end.indexOf("Post the plan's status update");
  assert.notEqual(update, -1, 'anchor not found: Post the plan\'s status update');
  assert.ok(atEnd < update, 'named after the status update');
});

red('TC-4', 'a round boundary calls it, from outside the subsection, the story gate and the plan\'s end', () => {
  const text = run();
  const outside = text.replace(rawSection(text, SUB), '');
  assertBlock(outside, new RegExp(SUB), /round boundary|before the next (?:implementer round|task)/i);
  assert.match(flat(outside), /round boundary|next implementer round/i);
});

red('TC-4', 'the index is the project\'s issue list: titles starting `Follow-up: <ref> eN`, neither done nor cancelled, one issue get each', () => {
  const s = sub();
  assertBlock(s, /issue list/, /project/i);
  assert.match(flat(s), /Follow-up: <ref> eN/);
  assertBlock(s, /\bneither\b/i, /\bdone\b/, /\bcancelled\b/);
  assertBlock(s, /`?issue get\b/, /\b(?:one|each|every|per)\b/i);
  assert.ok(
    blockSays(s, /issue list/, /titles?/i, /\b(?:no|not|without|never) descriptions?\b/i) ||
      blockSays(s, /issue list/, /\b(?:only (?:the )?titles|titles only)\b/i),
    'no block says the issue list gives titles and no descriptions',
  );
});

red('TC-4', 'escalation list is not used for the index (LWY-164)', () => {
  const s = sub();
  const mentions = nodes(s).flatMap(({ node }) => splitSentences(node.own).flatMap(clauses)).filter((c) => /escalation list/i.test(c));
  assert.ok(mentions.some((c) => NEG.test(c)), 'no clause says escalation list is not used');
  for (const c of mentions) {
    if (!NEG.test(c)) assert.doesNotMatch(c, /\b(?:use[sd]?|using|run|runs|read|reads|call|calls|rely|relies)\b/i, `escalation list is used: ${c}`);
  }
  assert.match(flat(s), /LWY-164/);
});

red('TC-4', 'a follow-up is found by its title in the index, so a plain run reads no description to find it', () => {
  assertBlock(sub(), /title/i, /\b(?:starts?|starting|begins?|beginning|prefix\w*)\b/i, /Follow-up: <ref> eN/);
});

red('AC-2', 'debt proposals are read from issue get on the story, whose escalations[] carries its sub-issues\'', () => {
  const s = sub();
  assertBlock(s, /debt/i, /issue get <story>|`issue get` on the story/i);
  assertBlock(s, /escalations\[\]/, /sub-issues/i);
});

red('AC-2', 'the story in hand at a round boundary and at the story gate, every story of the project at the plan\'s end', () => {
  const s = sub();
  assertBlock(s, /story in hand/i);
  assertBlock(s, /every story/i, PLANS_END);
});

red('AC-2', 'on "File it" the debt issue is filed as "What a deferred finding becomes" says, its title ending `(<ref> eN)` and its description carrying `Escalation: <ref> eN`', () => {
  const s = sub();
  assertBlock(s, /File it/);
  assertBlock(s, /What a deferred finding becomes/);
  assertBlock(s, /File it|filed|files/i, /title/i, /\b(?:ending|ends?|suffix)\b[^.;]*`?\(<ref> eN\)`?/i);
  assertBlock(s, /File it|filed|files/i, /description/i, /`Escalation: <ref> eN`/);
});

red('AC-3', 'a matching answer (its label equal to the pick) posts `# Pick stood — <ref> eN` and sets the follow-up done', () => {
  const s = sub();
  assertBlock(s, MATCH, /label/i, /pick/i);
  assertBlock(s, MATCH, /`# Pick stood — <ref> eN`/);
  assertBlock(s, MATCH, /`?\bdone\b`?/);
});

red('AC-3', 'a differing answer posts `# Answer differs — <ref> eN` quoting label and note, and leaves the follow-up backlog', () => {
  const s = sub();
  assertBlock(s, /`# Answer differs — <ref> eN`/, /label/i, /note/i);
  assert.ok(differUnits(s).some((u) => differFacts(u).backlog), 'no list item, paragraph or row about a differing answer says it stays backlog');
});

red('AC-3', 'a differing answer never sets done', () => {
  const units = differUnits(sub());
  assert.ok(units.length > 0, 'nothing says what a differing answer does');
  assert.ok(units.some((u) => differFacts(u).never_done), 'nothing about a differing answer says it is never done');
  for (const u of units) assert.deepEqual(differFacts(u).sets_done, [], `a differing answer is not kept off done`);
});

red('AC-3', 'a follow-up whose escalation is unanswered is never closed', () => {
  const UNANSWERED = /\b(?:unanswered|not (?:yet )?answered|no answer|without an answer)\b/i;
  const closes = /\bclos\w*|\bdone\b|\bcomplet\w*|\bresolv\w*/i;
  const ok = tree(sub()).some((root) => {
    const sentences = [];
    walk(root, (n) => sentences.push(...splitSentences(n.own)));
    if (!UNANSWERED.test(sentences.join(' '))) return false;
    return sentences
      .filter((st) => !DIFFER.test(st) && !MATCH.test(st) && !/plan'?s end|status update/i.test(st))
      .some((st) => clauses(st).some((c) => (NEG.test(c) && closes.test(c)) || (/\b(?:stays?|remains?|leave|leaves|left|kept|keeps?)\b/i.test(c) && /\bopen\b/i.test(c))));
  });
  assert.ok(ok, 'nothing says an unanswered follow-up is never closed');
});

red('TC-4', 'each action checks its marker before writing: a follow-up already done or already carrying `# Answer differs — <ref> eN`', () => {
  const s = sub();
  assertBlock(s, /already/i, /`?\bdone\b`?/, /`# Answer differs — <ref> eN`/);
  assertBlock(s, /\b(?:marker|already)\b/i, /\b(?:before|first)\b/i, /\b(?:writ\w*|post\w*|act\w*|fil\w*)\b/i);
});

red('TC-4', 'the marker of a debt issue is a title already ending `(<ref> eN)`, found in the same issue list', () => {
  assertBlock(sub(), /already/i, /title/i, /\(<ref> eN\)/, /issue list/);
});

red('TC-4', 'a second reading writes nothing: no second comment, nothing closed twice, no second debt issue', () => {
  const s = sub();
  assertBlock(s, /\b(?:second|repeated?|again)\b/i, /\b(?:writes? nothing|nothing (?:new |more )?(?:is )?written|writes? no)\b|\b(?:no|nor|never) (?:second|further|new|extra)\b/i);
  assertBlock(s, /\b(?:second|repeated?|again)\b/i, /comment|debt issue|clos/i, /\b(?:no|not|never|nor|nothing)\b/i);
});

red('TC-4', 'the reading copies the plan\'s end\'s form: post unless the latest state is already the same', () => {
  assertBlock(sub(), /\b(?:unless|only when|skip\w*|checks?)\b/i, /already/i);
});

red('AC-3', 'the story gate reads and never waits: it merges the story with escalations and follow-ups still open', () => {
  const gate = rawSection(run(), 'The story gate');
  const where = [...tree(gate), ...tree(sub()).filter((n) => /story gate/i.test(subtree(n)))].filter((n) => n.kind !== 'heading');
  const wordsOf = (n) => {
    const all = [];
    walk(n, (x) => all.push(...splitSentences(x.own)));
    return all;
  };
  const neverWaits = where.some((n) => wordsOf(n).some((st) => clauses(st).some((c) => negates(c, /\bwait\w*/i))));
  assert.ok(neverWaits, 'no clause about the story gate says it never waits');
  const merges = where.map(subtree).some((b) => /merg/i.test(b) && /\b(?:open|unanswered|unresolved)\b/i.test(b) && /escalation/i.test(b) && /follow-up/i.test(b));
  assert.ok(merges, 'nothing says the story is merged with escalations and follow-ups still open');
  for (const n of where) {
    for (const st of wordsOf(n)) {
      for (const c of clauses(st)) {
        if (/\bwait\w*/i.test(c) && /\b(?:escalations?|follow-ups?|answers?)\b/i.test(c) && !negates(c, /\bwait\w*/i)) assert.fail(`the story gate waits: ${st}`);
      }
    }
  }
});

red('TC-4', 'no polling: a reading is one issue list and one issue get per follow-up, never a loop or a wait', () => {
  assertBlock(sub(), /\bno polling\b|\b(?:never|not|does not) poll\w*|\bwithout polling\b/i);
});

const ENDING = /\b(?:ending|final (?:message|report|summary)|closing (?:message|report|summary|words)|last message|end(?:s)? by saying|(?:session|run)'s (?:end|report))\b/i;
red('AC-3', 'the plan\'s end lists every follow-up whose escalation is unanswered and every one whose answer differs and is not done, in its status update and in its ending', () => {
  const end = rawSection(run(), "The plan's end");
  assertAt(end, /status update/i, /unanswered/i, /differ/i);
  assertAt(end, ENDING, /unanswered/i, /differ/i);
  assertAt(end, /differ/i, /\b(?:not|never|no)\b[^.;]*\bdone\b/i);
});

red('AC-3', 'the plan\'s end lists them for the person who decides the merge into main', () => {
  assertAt(rawSection(run(), "The plan's end"), /unanswered/i, /\b(?:person|human|decides?)\b/i);
});

red('AC-2', 'the debt row of "What a deferred finding becomes" no longer says the run waits: the run carries on and the proposal is read later', () => {
  const rows = rawSlice(run(), '| Technical debt: the fix is a design decision', '| Anything else');
  assert.deepEqual(debtWaits(rows, { all: true }), []);
  assert.match(flat(rows), /carries on|carry on/i);
  assert.match(flat(rows), /Reading the answers behind/);
  assert.match(flat(rows), /File it/);
});

red('AC-2', '"Land the task" no longer waits on a debt proposal (step 5 is gone or says it does not wait), and step 6\'s friction proposal depends on no answer', () => {
  const land = rawSection(run(), 'Land the task');
  assert.deepEqual(debtWaits(land), []);
  assert.match(flat(land), /Friction/);
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
  assert.deepEqual(debtWaits(stops, { extra: /\bstops?\b/i }), []);
  const mentions = nodes(stops)
    .flatMap(({ node }) => splitSentences(node.own))
    .filter((st) => DEBT.test(st) && /\b(?:wait\w*|stops?|holds?)\b/i.test(st) && !negates(st, /\b(?:wait\w*|stops?|holds?)\b/i) && !EXEMPT.test(st));
  assert.deepEqual(mentions, []);
});

red('AC-2', 'proven false: a run waits on a debt proposal anywhere in run (no sentence about a debt proposal waits, stops or holds without a negation in its own clause)', () => {
  assert.deepEqual(debtWaits(run()), []);
});

red('AC-2', '"Wait, then carry on" no longer names a debt proposal after its task as a wait that carries on when it ends unanswered', () => {
  assert.deepEqual(debtWaits(rawSection(run(), 'Wait, then carry on')), []);
});

red('AC-2', 'the debt proposal is read, not waited on: its escalation is raised and the run carries on, reading it at the next reading point', () => {
  const s = sub();
  assertBlock(s, /debt/i, /answer/i, /\b(?:read|reading)\b/i);
  const ok = tree(s).some((root) => {
    const sentences = [];
    walk(root, (n) => sentences.push(...splitSentences(n.own)));
    return DEBT.test(sentences.join(' ')) && sentences.some((st) => clauses(st).some((c) => negates(c, /\b(?:wait\w*|stops?|holds?)\b/i)));
  });
  assert.ok(ok, 'nothing says a debt proposal is not waited on');
});
