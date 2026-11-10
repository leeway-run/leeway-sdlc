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
//   - **Stories in flight:** the two story refs and what was open on the second (its interview wait)
// HARNESS fails closed: a sentence on one of those topics claims it only if the record says yes; otherwise it is hedged
// (UNVERIFIED, not shown, not verified, not seen, did not). A topic the record says yes to is stated in HARNESS.
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

// claim: any wording that could assert the topic (so a sentence on it is checked against the record). says: what stating it as
// shown looks like; every pattern must match one unhedged sentence. Broad claim, narrow says: the pin fails closed.
const TOPICS = [
  { label: 'Invoked skill took over', claim: /\b(takes?|took) over\b|\binstructions\b/i, says: [/\b(takes?|took) over\b/i] },
  { label: 'Session kept its alias', claim: /\balias\b|\bidentity\b|\b(keeps?|kept|retains?)\b/i, says: [/\b(keeps?|kept|retains?)\b.*\b(alias|identity)\b/i] },
  { label: 'Wait woke the session on exit', claim: /\b(waits?|waiting|wakes?|woke|waking)\b|\bbackground (task|wait|job)s?\b/i, says: [/\b(wakes?|woke)\b.*\bexit/i] },
  { label: "Second story's planning carried on", claim: /\b(other|second|another) stor(y|ies)\b|\bplanning\b|\bcarr(y|ies) on\b|\bsurvives?\b/i, says: [/\b(other|second|another) stor(y|ies)\b/i, /\b(carr(y|ies) on|survives?|keeps? planning|continues?)\b/i] },
  { label: 'Hand-back resumed the first run', claim: /\bhand-back\b|\bhands? back\b|\b(resumes?|continues?|picks? up)\b|\b(first|second) run\b/i, says: [/\b(resumes?|continues?|picks? up|carries on)\b.*\b(first|same)\b.*\brun\b/i] },
];
const HEDGE = /UNVERIFIED|\bnot (shown|verified|seen)\b|\bdid not\b/i;

// Returns the failures: a claim sentence the record does not back, or a yes the section does not state.
function disagreements(rec, section) {
  const sents = sentences(section);
  const out = [];
  for (const { label, claim, says } of TOPICS) {
    const yes = /^yes\b/i.test(bullet(rec, label) ?? '');
    if (yes) {
      if (!sents.some((s) => says.every((r) => r.test(s)) && !HEDGE.test(s))) out.push(`the record says yes to "${label}" and HARNESS does not state it`);
    } else {
      for (const s of sents.filter((t) => claim.test(t) && !HEDGE.test(t))) out.push(`the record does not show "${label}" and HARNESS claims it: ${s}`);
    }
  }
  return out;
}

test('TC-2: plugin/HARNESS.md has "Handing over to a skill" after "Delegating to a named agent", naming leeway-sdlc:<skill>', () => {
  const doc = read('plugin/HARNESS.md');
  const at = doc.indexOf(`\n## ${HEADING}\n`);
  assert.ok(at > 0, `no "${HEADING}" heading in plugin/HARNESS.md`);
  const delegating = doc.indexOf('\n## Delegating to a named agent\n');
  assert.ok(delegating > 0, 'plugin/HARNESS.md has no "Delegating to a named agent" heading');
  assert.ok(at > delegating, 'the section comes after "Delegating to a named agent"');
  const text = flat(rawUnder(doc, HEADING));
  assert.match(text, /Skill tool/);
  assert.ok(text.includes('leeway-sdlc:<skill>') || text.includes('leeway-sdlc:shape-project'), 'names leeway-sdlc:<skill>');
  assert.ok(text.includes('leeway-sdlc:shape-project'), 'gives leeway-sdlc:shape-project as the example');
});

test('TC-2: every generated harness has "Handing over to a skill", naming shape-project and marked UNVERIFIED', () => {
  for (const f of generated()) {
    const doc = read(f);
    assert.ok(doc.includes(`\n## ${HEADING}\n`), `${f}: no "${HEADING}" heading`);
    const text = rawUnder(doc, HEADING);
    assert.match(text, /shape-project/, `${f}: the section does not name shape-project`);
    assert.match(text, /UNVERIFIED/, `${f}: the hand-over is not marked UNVERIFIED, and no probe ran there`);
  }
});

test('TC-2: claude.md has "Handing over to a skill" with the version, the date and one yes or no per question', () => {
  const section = rawUnder(read('docs/targets/claude.md'), HEADING);
  assert.match(bullet(section, 'Claude Code version') ?? '', /\d+\.\d+\.\d+/);
  assert.match(bullet(section, 'Date') ?? '', /^\d{4}-\d{2}-\d{2}/);
  for (const { label } of TOPICS) assert.match(bullet(section, label) ?? '', /^(yes|no)\b.{10,}/i, `"${label}" is yes or no, then what was seen`);
  const flight = bullet(section, 'Stories in flight') ?? '';
  const refs = new Set(flight.match(/\b[A-Z][A-Z0-9]*-\d+(\.\d+)?\b/g) ?? []);
  assert.ok(refs.size >= 2, `"Stories in flight" names two stories by ref: ${flight}`);
  assert.match(flight, /\b(wait|interview)\b/i, '"Stories in flight" says what was open on the second story');
});

test('TC-2: HARNESS claims a topic only if the record says yes, and states each topic the record says yes to', () => {
  const rec = rawUnder(read('docs/targets/claude.md'), HEADING);
  assert.deepEqual(disagreements(rec, rawUnder(read('plugin/HARNESS.md'), HEADING)), []);
});

test('TC-2: the Claude line cites the record by its heading and path', () => {
  const text = flat(rawUnder(read('plugin/HARNESS.md'), HEADING));
  assert.match(text, /docs\/targets\/claude\.md/);
  assert.ok(text.includes(`"${HEADING}"`), `HARNESS does not cite the "${HEADING}" record`);
});
