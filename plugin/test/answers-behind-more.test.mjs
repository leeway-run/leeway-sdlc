// LWY-266.2 pins beyond the frozen plugin/test/answers-behind.test.mjs, on plugin/skills/run/SKILL.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const plugin = process.env.PLUGIN_DIR || join(dirname(fileURLToPath(import.meta.url)), '..');
const skill = readFileSync(join(plugin, 'skills/run/SKILL.md'), 'utf8').replace(/\r\n/g, '\n');
const flat = (text) => text.replace(/\s+/g, ' ').trim();

// The heading line containing `title`, down to the next heading of its level or above, on one line.
const section = (title) => {
  const lines = skill.split('\n');
  const first = lines.findIndex((l) => /^#+ /.test(l) && l.includes(title));
  assert.notEqual(first, -1, `no heading titled ${title}`);
  const level = /^(#+) /.exec(lines[first])[1].length;
  let end = lines.length;
  for (let i = first + 1; i < lines.length; i++) {
    const h = /^(#+) /.exec(lines[i]);
    if (h && h[1].length <= level) { end = i; break; }
  }
  return flat(lines.slice(first, end).join('\n'));
};
const between = (text, from, to) => {
  const at = text.indexOf(from);
  assert.notEqual(at, -1, `no "${from}"`);
  const end = to ? text.indexOf(to, at + from.length) : text.length;
  assert.notEqual(end, -1, `no "${to}" after "${from}"`);
  return text.slice(at, end);
};

test('a reading posts unless the latest comment is already one naming the same <ref> eN', () => {
  const bullet = between(section('Reading the answers behind'), '- **Each action checks its marker first.**', '- **The plan\'s end** lists');
  assert.match(bullet, /It posts unless the latest comment is already one naming the same `<ref> eN`\./);
});

// A wait in any wording is a wait unless a negation comes before it in its own clause.
const WAIT = /\b(wait(?:s|ed|ing)?|await(?:s|ed|ing)?|hold(?:s|ing)?|held|stop(?:s|ped|ping)?|block(?:s|ed|ing)?|paus(?:e|es|ed|ing)|until)\b/gi;
const NEGATION = /\b(never|not|no|nothing|nor|neither|without|none|n't)\b/i;
const CARRY_ON_NOT = /\b(?:not|never)\s+(?:carr(?:y|ies)|go(?:es)?|proceed(?:s)?|continue(?:s)?)\s+on\b/i;
const waitsIn = (text) => {
  const cleaned = flat(text).replaceAll('"Stop, or decide and continue"', '');
  const bad = [];
  for (const clause of cleaned.split(/[.;:,]/)) {
    if (CARRY_ON_NOT.test(clause)) { bad.push(clause.trim()); continue; }
    for (const m of clause.matchAll(WAIT)) {
      if (!NEGATION.test(clause.slice(0, m.index))) { bad.push(clause.trim()); break; }
    }
  }
  return bad;
};

const debtTexts = () => {
  const row = between(section('What a deferred finding becomes'), '| Technical debt', '| Anything else');
  const step = between(section('Land the task'), '5. **A debt proposal is not waited on here.**', '6. **Friction');
  const lead = between(section('Wait, then carry on'), 'a debt proposal ("What a deferred finding becomes")', 'Where a path below');
  return { row, step, lead };
};

test('the debt proposal waits nowhere, in any wording', () => {
  for (const [name, text] of Object.entries(debtTexts())) {
    assert.deepEqual(waitsIn(text), [], `${name} waits or stops`);
  }
});

test('the wait check catches each wording of a wait added to the debt row', () => {
  const { row } = debtTexts();
  const added = [
    'The run waits for the answer.',
    'The run awaits the answer.',
    'The run holds here for the answer.',
    'The loop is held until the answer comes.',
    'The run stops for the answer.',
    'The run is blocked on the answer.',
    'The run pauses for the answer.',
    'The row stays open until it is answered.',
    'The run does not carry on until the answer is in.',
    'The run never carries on without a pause for the answer.',
  ];
  for (const sentence of added) {
    assert.notDeepEqual(waitsIn(`${row} ${sentence}`), [], `not caught: ${sentence}`);
  }
});

test('without a plan branch, the not-yet-merged status update is skipped only when it names the same stories and follow-ups', () => {
  const end = between(section("The plan's end"), '- **With no plan branch**');
  const bullet = between(end, '- **Any story does not:**', '**Both ways');
  assert.match(bullet, /unless the collector's latest comment is already one naming the same stories and follow-ups/);
});
