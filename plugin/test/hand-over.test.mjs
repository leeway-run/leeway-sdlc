// LWY-222.1 (TC-2, TC-6): every harness has "Handing over to a skill", and what the Claude one says is what a probe recorded
// in docs/targets/claude.md, "Handing over to a skill". The pins check agreement between the record and HARNESS, never which
// way the probe came out.
//
// Files read: plugin/HARNESS.md, docs/targets/claude.md, targets/agents/HARNESS.md, targets/agents/skills/sdlc-install/kit/HARNESS.md,
// targets/agents/skills/sdlc-install/kit/harness/*.md. The phrases pinned: the heading "Handing over to a skill", `leeway-sdlc:<skill>`,
// `leeway-sdlc:shape-project`, "UNVERIFIED".
//
// The record, "## Handing over to a skill" in docs/targets/claude.md, has these bullets, each yes or no with the evidence after it:
//   - **Claude Code version:** <x.y.z>
//   - **Date:** <YYYY-MM-DD>
//   - **Invoked skill took over:** yes | no
//   - **Session kept its alias:** yes | no
//   - **Wait woke the session on exit:** yes | no
//   - **Second story's planning carried on:** yes | no
//   - **Hand-back resumed the first run:** yes | no
// HARNESS fails closed: a sentence on one of those topics claims it only if the record says yes; otherwise it is hedged
// (UNVERIFIED, not shown, did not, ...). A topic the record says yes to is stated in HARNESS.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (path) => readFileSync(join(root, path), 'utf8').replace(/\r\n/g, '\n');
const flat = (text) => text.replace(/\s+/g, ' ');
const sentences = (text) => flat(text).split(/(?<=[.!?;])\s+/);
const HEADING = 'Handing over to a skill';

function rawUnder(doc, heading) {
  const m = doc.match(new RegExp(`\\n(#+) ${heading}\\n`));
  assert.ok(m, `no "${heading}" heading`);
  const start = m.index + 1;
  const next = new RegExp(`\\n#{1,${m[1].length}} `, 'g');
  next.lastIndex = start + 1;
  const end = next.exec(doc);
  return doc.slice(start, end ? end.index : undefined);
}
const bullet = (section, label) => section.match(new RegExp(`^- \\*\\*${label}:\\*\\*[ \\t]*(.*)$`, 'm'))?.[1].trim();

const KIT = 'targets/agents/skills/sdlc-install/kit/harness';
const generated = () => [
  'targets/agents/HARNESS.md', 'targets/agents/skills/sdlc-install/kit/HARNESS.md',
  ...readdirSync(join(root, KIT)).filter((f) => f.endsWith('.md')).map((f) => `${KIT}/${f}`),
];

const TOPICS = [
  { label: 'Invoked skill took over', claim: /\b(takes?|took) over\b|\binstructions\b/i },
  { label: 'Session kept its alias', claim: /\balias\b/i },
  { label: 'Wait woke the session on exit', claim: /\b(waits?|waiting)\b/i },
  { label: "Second story's planning carried on", claim: /\b(other|second) stor(y|ies)\b|\bplanning\b/i },
  { label: 'Hand-back resumed the first run', claim: /\bhand-back\b|\bresumes?\b|\bsecond run\b/i },
];
const HEDGE = /UNVERIFIED|\bnot (shown|known|verified|tried|seen)\b|\bdid not\b|\bdoes not\b|\bno (wake|wakes)\b|\bunknown\b/i;

test('TC-2: plugin/HARNESS.md has "Handing over to a skill" after "Delegating to a named agent", naming leeway-sdlc:<skill>', { skip: 'red-test-TC-2: the hand-over section and its probe record do not exist yet' }, () => {
  const doc = read('plugin/HARNESS.md');
  const at = doc.indexOf(`\n## ${HEADING}\n`);
  assert.ok(at > 0, `no "${HEADING}" heading in plugin/HARNESS.md`);
  assert.ok(at > doc.indexOf('\n## Delegating to a named agent\n'), 'the section comes after "Delegating to a named agent"');
  const text = flat(rawUnder(doc, HEADING));
  assert.match(text, /Skill tool/);
  assert.ok(text.includes('leeway-sdlc:<skill>') || text.includes('leeway-sdlc:shape-project'), 'names leeway-sdlc:<skill>');
  assert.ok(text.includes('leeway-sdlc:shape-project'), 'gives leeway-sdlc:shape-project as the example');
});

test('TC-2: every generated harness has "Handing over to a skill", naming shape-project and marked UNVERIFIED', { skip: 'red-test-TC-2: the hand-over section and its probe record do not exist yet' }, () => {
  for (const f of generated()) {
    const doc = read(f);
    assert.ok(doc.includes(`\n## ${HEADING}\n`), `${f}: no "${HEADING}" heading`);
    const text = rawUnder(doc, HEADING);
    assert.match(text, /shape-project/, `${f}: the section does not name shape-project`);
    assert.match(text, /UNVERIFIED/, `${f}: the hand-over is not marked UNVERIFIED, and no probe ran there`);
  }
});

test('TC-2: claude.md has "Handing over to a skill" with the version, the date and one yes or no per question', { skip: 'red-test-TC-2: the hand-over section and its probe record do not exist yet' }, () => {
  const section = rawUnder(read('docs/targets/claude.md'), HEADING);
  assert.match(bullet(section, 'Claude Code version') ?? '', /\d+\.\d+\.\d+/);
  assert.match(bullet(section, 'Date') ?? '', /^\d{4}-\d{2}-\d{2}/);
  for (const { label } of TOPICS) assert.match(bullet(section, label) ?? '', /^(yes|no)\b.{10,}/i, `"${label}" is yes or no, then what was seen`);
});

test('TC-2: HARNESS claims a topic only if the record says yes, and states each topic the record says yes to', { skip: 'red-test-TC-2: the hand-over section and its probe record do not exist yet' }, () => {
  const rec = rawUnder(read('docs/targets/claude.md'), HEADING);
  const sents = sentences(rawUnder(read('plugin/HARNESS.md'), HEADING));
  for (const { label, claim } of TOPICS) {
    const yes = /^yes\b/i.test(bullet(rec, label) ?? '');
    const on = sents.filter((s) => claim.test(s));
    if (yes) assert.ok(on.some((s) => !HEDGE.test(s)), `the record says yes to "${label}" and HARNESS does not state it`);
    else for (const s of on) assert.match(s, HEDGE, `the record does not show "${label}" and HARNESS claims it: ${s}`);
  }
});

test('TC-2: the Claude line cites the record by its heading and path', { skip: 'red-test-TC-2: the hand-over section and its probe record do not exist yet' }, () => {
  const text = flat(rawUnder(read('plugin/HARNESS.md'), HEADING));
  assert.match(text, /docs\/targets\/claude\.md/);
  assert.ok(text.includes(`"${HEADING}"`), `HARNESS does not cite the "${HEADING}" record`);
});
