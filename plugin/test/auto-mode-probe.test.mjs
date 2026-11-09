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
//   `result` is ran, prompted or refused and `output` is what the call printed: real text, never `-`, `n/a` or empty,
//   and a refusal's text (more than one word) for refused. A `|` inside a cell is written `\|`. The fsmonitor row's command
//   contains `core.fsmonitor` and the `git push main` row's contains `main`. Each call has one bucket: a call a classifier
//   blocked and then allowed, or one that timed out, goes in the bucket it ended in, with the nuance in `output`.
//   Optional bullets that back c1's two claims: `- **Protected paths:** ...` (.git and .claude in a worktree) and
//   `- **Session start directory:** ...` (what an edit under .worktrees/ is judged against).
//
// HARNESS fails closed. A sentence naming (backticked) a call the record marks prompted or refused must say prompt or
// refus, name no call the record marks ran, and carry no run verb (runs, ran, goes through, allowed, approved, automatic,
// on its own, without a prompt, ...): so each limit gets its own sentence, and an "except" or "every other call ran" goes in
// another. A backticked call-like span (git, gh, node, leeway-sdlc-...) in such a sentence is a call of the record, so
// HARNESS claims nothing the probe did not show. c1's two claims (the .git and .claude protection, the session start
// directory) are backed by their bullet or hedged ("not known", "not shown", ...) in the same sentence as the claim.
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
  const rows = section.split('\n').filter((l) => l.startsWith('|')).map((l) => l.replace(/^\||(?<!\\)\|\s*$/g, '').split(/(?<!\\)\|/).map((c) => cell(c.replace(/\\\|/g, '|'))));
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

const PLACEHOLDER = /^(-+|—|–|n\/?a|)$/i;
const RUN = /\b(runs|ran|running)\b|\b(can|will|may|does|do|would|to|not|just|simply) run\b|goes? through|went through|allowed|allows?\b|approved|automatic(ally)?|on its own|on their own|without (a |any )?(permission )?prompt|no (permission )?prompt|unprompted|never prompts?|(does not|doesn't) prompt|without asking|permitted|passes|succeeds|proceeds/i;

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
    assert.ok(!PLACEHOLDER.test(r.output), `${call}: no output (a placeholder is not what the call printed${r.result === 'refused' ? '; a refusal\'s text' : ''})`);
    if (r.result === 'refused') assert.ok(r.output.split(/\s+/).length > 1, `${call}: a refused row's output is the refusal's text, not one word: ${r.output}`);
  }
  assert.ok(got.get('git -c core.fsmonitor status')?.command.includes('core.fsmonitor'), 'the fsmonitor row\'s command contains core.fsmonitor');
  assert.ok(got.get('git push main')?.command.includes('main'), 'the `git push main` row\'s command contains main');
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
  const got = calls(rec);
  const names = (s, call) => s.includes('`' + call + '`');
  const ranCalls = [...got].filter(([, r]) => r.result === 'ran').map(([c]) => c);
  for (const [call, r] of got) {
    if (r.result === 'ran') continue;
    const named = all.filter((s) => names(s, call));
    assert.ok(named.length > 0, `HARNESS does not name \`${call}\` as a limit, and the record says it ${r.result}`);
    assert.ok(named.some((s) => new RegExp(r.result === 'refused' ? 'refus' : 'prompt', 'i').test(s)), `no sentence says \`${call}\` ${r.result}`);
  }
  const limitCalls = [...got].filter(([, r]) => r.result !== 'ran').map(([c]) => c);
  for (const s of all) {
    const spans = (s.match(/`[^`]+`/g) ?? []).map((x) => x.slice(1, -1)).filter((c) => /^(git|gh|node|leeway-sdlc-)/.test(c));
    if (limitCalls.some((c) => names(s, c)) || (/prompt|refus/i.test(s) && spans.length)) for (const call of spans) assert.ok(got.has(call), `HARNESS says \`${call}\` prompts or is refused, and the record has no such call: ${s}`);
    if (!limitCalls.some((c) => names(s, c))) continue;
    assert.match(s, /prompt|refus/i, `a sentence names a limit and says neither prompt nor refus: ${s}`);
    assert.doesNotMatch(s, RUN, `a sentence names a call the record marks prompted or refused and says it runs: ${s}`);
    const withRan = ranCalls.find((c) => names(s, c));
    assert.ok(!withRan, `a limit shares a sentence with \`${withRan}\`, which the record marks ran (each limit gets its own sentence): ${s}`);
  }
  const anyLimit = limitCalls.length > 0;
  if (anyLimit) for (const s of all) assert.doesNotMatch(s, /\b(every|all|each) (call|verb)s?\b[^.]*\b(runs?|ran)\b|\bno (call|verb) (prompts?|is refused|asks)|\bnothing (prompts?|asks)/i, 'a blanket "no call prompts" claim, with a prompted or refused call on record');
});

test('TC-6: c1, the .git/.claude protection and the session-start claims are backed by the record or hedged', { skip: RED + 'HARNESS says edits under .worktrees/ are judged against the session\'s start directory with no record and no hedge' }, () => {
  const hasSection = existsSync(join(root, 'docs/targets/claude.md')) && read('docs/targets/claude.md').includes(`\n## ${HEADING}\n`);
  const rec = hasSection ? record() : { section: '', started: undefined };
  const text = permissions();
  const hedged = (s) => /\bnot (known|shown|verified|tried|seen)\b|\bunknown\b/i.test(s) || (/^no$/i.test(rec.started ?? '') && /UNVERIFIED/.test(s));
  const backed = (label) => (bullet(rec.section, label) ?? '').length > 10;
  // c27: Claude Code's own protection of writes in .git or .claude inside a worktree.
  const protection = sentences(text).filter((s) => /\.git\b/.test(s) && /\.claude\b/.test(s));
  for (const s of protection) assert.ok(backed('Protected paths') || hedged(s), `the .git/.claude claim has no "Protected paths" record and no hedge in its sentence: ${s}`);
  // c28: edits under .worktrees/ are judged against the directory the session started in.
  const claims = sentences(text).filter((s) => /\.worktrees\b/.test(s) && /\bsession\b/i.test(s) && /\b(start|started|starts|began|begin|begins|launch|launched|cwd|directory)\b/i.test(s));
  for (const s of claims) assert.ok(backed('Session start directory') || hedged(s), `the session-start claim has no "Session start directory" record and no hedge: ${s}`);
});
