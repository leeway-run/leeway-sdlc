// LWY-189.6 (TC-6): what HARNESS says about auto mode is what a live run showed, recorded in docs/targets/claude.md.
// The tests pin the record's shape and how HARNESS and the record agree, and never which way the probe came out:
// a record with auto mode started is checked call by call, one where it could not be started keeps HARNESS's UNVERIFIED.
//
// The record, "## Unattended in auto mode" in docs/targets/claude.md:
//   - **Claude Code version:** <x.y.z>
//   - **Date:** <YYYY-MM-DD>
//   - **Auto mode started:** yes | no
//   - **How auto mode was started:** <text; with "no", what was tried and why it could not be started>
//   and, with "yes", a table with exactly the columns `call | command | result | output`, one row per call below, where
//   `result` is ran, prompted or refused and `output` is what the call printed (a refusal's text, for refused).
//   Optional bullets that back c1's two claims: `- **Protected paths:** ...` (.git and .claude in a worktree) and
//   `- **Session start directory:** ...` (what an edit under .worktrees/ is judged against).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (path) => readFileSync(join(root, path), 'utf8').replace(/\r\n/g, '\n');
const flat = (text) => text.replace(/\s+/g, ' ');
const sentences = (text) => flat(text).split(/(?<=[.!?;])\s+/);

const CALLS = [
  'git worktree add', 'git add', 'git commit', 'git push', 'git merge', 'git status --short', 'git diff',
  'leeway-sdlc-raise', 'leeway-sdlc-wait-answer', 'leeway-sdlc-session-tokens', 'node -e', 'gh pr view',
  'git push main', 'git -c core.fsmonitor status',
];
const RESULTS = ['ran', 'prompted', 'refused'];
const HEADING = 'Unattended in auto mode';
const RED = 'red-test-TC-6: ';

// The raw text under a heading (any level), up to the next heading of the same or a higher level.
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
const cell = (c) => c.trim().replace(/^`+|`+$/g, '').replace(/^\*\*|\*\*$/g, '').trim();

function record() {
  assert.ok(existsSync(join(root, 'docs/targets/claude.md')), 'docs/targets/claude.md does not exist');
  const section = rawUnder(read('docs/targets/claude.md'), HEADING);
  const started = bullet(section, 'Auto mode started');
  const rows = section.split('\n').filter((l) => l.startsWith('|')).map((l) => l.replace(/^\||\|\s*$/g, '').split('|').map(cell));
  return { section, started, rows };
}

function calls(rec) {
  const [header, sep, ...body] = rec.rows;
  assert.deepEqual(header, ['call', 'command', 'result', 'output'], 'the table\'s columns are call | command | result | output');
  assert.ok(sep && sep.every((c) => /^:?-+:?$/.test(c)), 'no header separator row');
  const out = new Map();
  for (const r of body) {
    assert.equal(r.length, 4, `a row has ${r.length} cells, not 4: ${r.join(' | ')}`);
    assert.ok(!out.has(r[0]), `call "${r[0]}" appears twice`);
    out.set(r[0], { command: r[1], result: r[2].toLowerCase(), output: r[3] });
  }
  return out;
}

const permissions = () => rawUnder(read('plugin/HARNESS.md'), 'Permissions for an unattended run');

test('TC-6: claude.md has "Unattended in auto mode" with the version, the date and how auto mode was started', { skip: RED + 'docs/targets/claude.md has no "Unattended in auto mode" section yet (LWY-189.6 records the probe there)' }, () => {
  const { started, section } = record();
  assert.match(bullet(section, 'Claude Code version') ?? '', /\d+\.\d+\.\d+/);
  assert.match(bullet(section, 'Date') ?? '', /^\d{4}-\d{2}-\d{2}$/);
  assert.match(started ?? '', /^(yes|no)$/i, '"Auto mode started" is yes or no');
  assert.ok((bullet(section, 'How auto mode was started') ?? '').length > 10, 'no "How auto mode was started" text');
});

test('TC-6: with auto mode started, the record has one row per listed call, each ran, prompted or refused, with its output', { skip: RED + 'no per-call table in docs/targets/claude.md yet' }, () => {
  const rec = record();
  if (/^no$/i.test(rec.started ?? '')) return;
  const got = calls(rec);
  assert.deepEqual([...got.keys()].sort(), [...CALLS].sort(), 'the rows are exactly the listed calls');
  for (const [call, r] of got) {
    assert.ok(RESULTS.includes(r.result), `${call}: result "${r.result}" is not ran, prompted or refused`);
    assert.ok(r.command.length > 0, `${call}: no command`);
    assert.ok(r.output.length > 0, `${call}: no output${r.result === 'refused' ? ' (a refusal\'s text)' : ''}`);
  }
});

test('TC-6: HARNESS cites the section, and keeps UNVERIFIED about auto mode only if the record says it could not be started', { skip: RED + 'HARNESS does not cite "Unattended in auto mode" and still carries UNVERIFIED about auto mode' }, () => {
  const rec = record();
  const text = permissions();
  assert.match(flat(text), /docs\/targets\/claude\.md/);
  assert.ok(flat(text).includes(`"${HEADING}"`), `HARNESS does not cite the "${HEADING}" section`);
  if (/^no$/i.test(rec.started ?? '')) assert.match(text, /UNVERIFIED/, 'auto mode was not started, so HARNESS keeps UNVERIFIED');
  else assert.doesNotMatch(text, /UNVERIFIED/, 'auto mode was probed, so HARNESS carries no UNVERIFIED about it');
});

test('TC-6: HARNESS names each call the record marks prompted or refused as a limit, and says no call or run unprompted', { skip: RED + 'HARNESS names no limits of an unattended run, since no record exists' }, () => {
  const rec = record();
  if (/^no$/i.test(rec.started ?? '')) return;
  const text = permissions();
  const all = sentences(text);
  const unprompted = /without (a |any )?(permission )?prompt|no (permission )?prompt|unprompted|never prompts?|doesn't prompt|does not prompt|without asking/i;
  for (const [call, r] of calls(rec)) {
    const named = all.filter((s) => s.includes('`' + call + '`'));
    if (r.result === 'ran') continue;
    assert.ok(named.length > 0, `HARNESS does not name \`${call}\` as a limit, and the record says it ${r.result}`);
    assert.ok(named.some((s) => new RegExp(r.result === 'refused' ? 'refus' : 'prompt', 'i').test(s)), `no sentence says \`${call}\` ${r.result}`);
    for (const s of named) assert.doesNotMatch(s, unprompted, `HARNESS says \`${call}\` runs without a prompt, and the record says it ${r.result}`);
  }
  const anyLimit = [...calls(rec).values()].some((r) => r.result !== 'ran');
  if (anyLimit) for (const s of all) assert.doesNotMatch(s, /\b(every|all|each) (call|verb)s?\b[^.]*\b(runs?|ran)\b|\bno (call|verb) (prompts?|is refused|asks)|\bnothing (prompts?|asks)/i, 'a blanket "no call prompts" claim, with a prompted or refused call on record');
});

test('TC-6: c1, the .git/.claude protection and the session-start claims are backed by the record or hedged', { skip: RED + 'HARNESS says edits under .worktrees/ are judged against the session\'s start directory with no record and no hedge' }, () => {
  const hasSection = existsSync(join(root, 'docs/targets/claude.md')) && read('docs/targets/claude.md').includes(`\n## ${HEADING}\n`);
  const rec = hasSection ? record() : { section: '', started: undefined };
  const text = permissions();
  const hedged = (s) => /\bnot (known|shown|verified|tried|seen)\b|\bunknown\b/i.test(s) || (/^no$/i.test(rec.started ?? '') && /UNVERIFIED/.test(s));
  const backed = (label) => (bullet(rec.section, label) ?? '').length > 10;
  // c27: Claude Code's own protection of writes in .git or .claude inside a worktree.
  const paragraphs = text.split(/\n\s*\n/).filter((p) => /\.git\b/.test(p) && /\.claude\b/.test(p) && /protection/i.test(p));
  for (const p of paragraphs) assert.ok(backed('Protected paths') || hedged(flat(p)), 'the .git/.claude protection claim has no "Protected paths" record and no hedge');
  // c28: edits under .worktrees/ are judged against the directory the session started in.
  const claims = sentences(text).filter((s) => /\.worktrees\//.test(s) && /started|session start/i.test(s));
  for (const s of claims) assert.ok(backed('Session start directory') || hedged(s), `the session-start claim has no "Session start directory" record and no hedge: ${s}`);
});
