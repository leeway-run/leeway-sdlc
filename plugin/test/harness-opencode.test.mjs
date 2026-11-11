// LWY-214.4: the OpenCode HARNESS's mechanisms, and the verified promise README and agent-setup make.
// Every mechanism the harness states is one docs/targets/opencode.md records from a real 2.x session, and one the
// probe did not settle is marked UNVERIFIED rather than stated as fact (TC-4); the wait text mirrors
// plugin/HARNESS.md (Claude Code), and the exit-5 sentence is the counterpart of the one
// plugin/test/run-waits.test.mjs pins there. Run:
// `node --test plugin/test/harness-opencode.test.mjs`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { harness, TARGETS } from '../../scripts/targets.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (path) => readFileSync(join(root, path), 'utf8').replace(/\r\n/g, '\n');
const flat = (text) => text.replace(/\s+/g, ' ');

const page = read('docs/targets/opencode.md');
const opencode = TARGETS.find((t) => t.id === 'opencode');
const openHarness = read('targets/agents/skills/sdlc-install/kit/harness/opencode.md');
const anyHarness = read('targets/agents/HARNESS.md');
const packageReadme = read('targets/agents/README.md');
const rootReadme = read('README.md');
const prompt = read('agent-setup/prompt.md');

// The text under `heading` (any level), up to the next heading of the same or a higher level, on one line.
const under = (doc, heading) => {
  const m = doc.match(new RegExp(`\\n(#+) ${heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\n`));
  assert.ok(m, `no "${heading}" heading`);
  const start = m.index + 1;
  const next = new RegExp(`\\n#{1,${m[1].length}} `, 'g');
  next.lastIndex = start + 1;
  const end = next.exec(doc);
  return flat(doc.slice(start, end ? end.index : undefined));
};

test('the page is filled and ends wait: background, so a verified claim is backed', () => {
  // The negative case: no "verified" claim is legitimate unless the page names the tested version and waits.
  assert.match(page, /^# OpenCode/);
  assert.match(page, /Version tested:\*\* 2\.2\.6/);
  assert.match(page, /^wait: background$/m);
  assert.doesNotMatch(page, /^wait: stop$/m);
  assert.doesNotMatch(page, /\b(?:still|yet) not run\b/i);
});

test('the opencode row renders wait: background, and names wait-answer.mjs with "nothing appended"', () => {
  assert.ok(opencode.wait, 'the opencode row has no wait text');
  const wait = under(harness(opencode, 'x', ''), 'Waiting for an answer');
  assert.match(wait, /wait: background/);
  assert.match(wait, /Start `wait-answer\.mjs` \(run, "Wait, then carry on"\) with the shell tool in its background mode, as it is, with nothing appended/);
  // The completion notice is what resumes the session, so no turn is spent per check (the page's measurement).
  assert.match(wait, /the session resumes by itself when it exits, on a notice that carries the command's output and its exit code/);
  assert.ok(flat(openHarness).includes(wait), 'the generated harness does not carry the rendered wait section');
});

test('the generated harness carries the exit-5 sentence, the counterpart of Claude Code\'s', () => {
  // plugin/test/run-waits.test.mjs pins the Claude Code sentence; this is the same shape for OpenCode.
  assert.match(
    flat(openHarness),
    /Exit 5 is a question, not the end: answer it, then start the wait again the same way, a new background command \(`PROCESS\.md`, "Questions to the human are escalations"\)\./,
  );
});

test('the harness marks the untried append mechanism UNVERIFIED, never stating it as fact', () => {
  // The negative case (TC-4): a mechanism the probe did not settle is marked, never stated from docs alone. The page's
  // "Not shown" says the `; echo $?` caveat was not tried here, so the harness must say so rather than transplant
  // Claude Code's claim.
  const wait = under(openHarness, 'Waiting for an answer');
  assert.match(wait, /UNVERIFIED: whether appending to the command changes the reported exit code was not tried here\./);
  // The instruction stays "with nothing appended".
  assert.match(wait, /as it is, with nothing appended/);
  // The transplant is gone: the harness does not assert the `; echo` clause, which only Claude Code's page measured.
  assert.doesNotMatch(wait, /`; echo`/);
  assert.doesNotMatch(wait, /the completion notice reports the exit code, so/);
  // And the page backs the negative: the append question is exactly what it did not try.
  assert.match(page, /whether appending to the command changes\s+the reported code \(the Claude Code page's `; echo \$\?` caveat was not tried here\)/);
});

test('the marker paragraph is not used for OpenCode, matching rule a on the page', () => {
  const marker = under(openHarness, 'Governed-agent marker');
  assert.match(marker, /governed-marker: not used/);
  assert.match(marker, /The guards identify this plugin's agents from the `agent` the event carries with each call/);
  assert.match(marker, /You never write one\./);
  // Rule a is what the page measured: the payload names the calling agent.
  assert.match(page, /Governed-agent rule: a\./);
  assert.match(page, /the payload names the calling agent, `event\.agent`/);
});

test('the delegation text names the measured tool and field, right after "delegate"', () => {
  const delegate = under(openHarness, 'Delegating to a named agent');
  assert.match(delegate, /Use the `subagent` tool, with `agent` set to the agent name/);
  assert.doesNotMatch(delegate, /Task tool with `subagent_type`/);
  // The measurement: the main agent called the `subagent` tool with `{"agent":"sdlc-implementer",…}`.
  assert.match(page, /Delegation by name:\*\* yes/);
  assert.match(page, /the main agent called the `subagent` tool with\s*`\{"agent":"sdlc-implementer"/);
});

test("the generated harness's pickup line states the mechanism the page records, matching the row's after text", () => {
  assert.match(page, /reload on save — editing `\.opencode\/plugins\/probe\.js` while the server\s+ran put the new code in force for the next session, no restart/);
  assert.match(opencode.after, /OpenCode 2\.x reloads `\.opencode\/plugins\/leeway-sdlc\.js` on save \(measured — docs\/targets\/opencode\.md\)/);
  assert.ok(flat(openHarness).includes(flat(opencode.after)), "the generated harness does not carry the row's after text");
});

test('only OpenCode\'s harness takes the wait, marker and verified banner; the other five are untouched', () => {
  const preview =
    '> **Tested with Claude Code only.** Support for other agents is built in but has not been verified yet. ' +
    'Verified support will come later. If you run into an issue, let us know: https://github.com/leeway-run/leeway-sdlc/issues';
  for (const t of TARGETS) {
    const text = read(join('targets', 'agents', 'skills', 'sdlc-install', 'kit', 'harness', `${t.id}.md`));
    if (t.id === 'opencode') {
      assert.match(text, /\*\*Verified with OpenCode 2\.x\.\*\*/, 'OpenCode\'s banner names it verified');
      assert.match(under(text, 'Governed-agent marker'), /governed-marker: not used/);
      assert.match(under(text, 'Waiting for an answer'), /wait: background/);
    } else {
      assert.ok(text.includes(preview), `${t.id}'s harness banner is not the preview notice, byte for byte`);
      assert.match(under(text, 'Governed-agent marker'), /governed-marker: required/);
      assert.match(under(text, 'Waiting for an answer'), /wait: stop/);
      assert.equal(t.wait, null, `${t.id} gained a wait`);
    }
  }
  // The package's own harness (targets/agents/HARNESS.md) serves every non-Claude-Code agent at once, so its
  // banner is the package one: OpenCode verified alongside Claude Code, the rest a preview.
  assert.match(
    anyHarness,
    /\*\*Claude Code and OpenCode 2\.x are verified; the other agents are a preview\.\*\*/,
    'the package harness banner does not name OpenCode verified',
  );
  assert.doesNotMatch(anyHarness, /Tested with Claude Code only/, 'the package harness still claims OpenCode untested');
  // The kit's copy of the same file (what sdlc-install writes to .sdlc/kit/HARNESS.md) carries the same banner.
  const kitHarness = read(join('targets', 'agents', 'skills', 'sdlc-install', 'kit', 'HARNESS.md'));
  assert.equal(kitHarness, anyHarness, "the kit's HARNESS.md and the package's are not the same any-agent file");
});

test('the package README names OpenCode 2.x verified and the other agents a preview', () => {
  assert.match(flat(packageReadme), /OpenCode 2\.x is verified; the other agents are a preview\./);
  assert.match(flat(packageReadme), /OpenCode 2\.2\.6 session/);
});

test('agent-setup names 2.x verified for OpenCode and no longer claims it untested, the other lines unchanged', () => {
  // The positive pin: OpenCode 2.x is named verified.
  assert.match(flat(prompt), /leeway-sdlc is verified with Claude Code and OpenCode 2\.x; the other agents are a preview\./);
  assert.match(flat(prompt), /If the agent is a preview — any but Claude Code and OpenCode 2\.x — end with: "leeway-sdlc is a preview for your agent so far; Claude Code and OpenCode 2\.x are verified\./);
  // The negative case: the old untested claim about OpenCode is gone.
  assert.doesNotMatch(flat(prompt), /tested with Claude Code only/);
  assert.doesNotMatch(flat(prompt), /is tested with Claude Code only so far/);
  // The per-agent sections are unchanged: the install commands and the after text still come from the rows.
  for (const t of TARGETS) {
    const section = prompt.slice(prompt.indexOf(`### ${t.name}\n`), prompt.indexOf(`\n### `, prompt.indexOf(`### ${t.name}\n`) + 1));
    assert.ok(section.startsWith(`### ${t.name}\n`), `${t.name}'s section is missing`);
    assert.ok(section.includes(`After step 4: ${t.after}`), `${t.name}'s after line changed`);
  }
});

test('README names OpenCode 2.x verified, the rest preview, and states 2.x is the version', () => {
  const other = flat(rootReadme.slice(rootReadme.indexOf('## Other agents'), rootReadme.indexOf('## Status')));
  assert.match(other, /OpenCode 2\.x is verified; the other agents are a preview\./);
  assert.match(other, /recorded in \[docs\/targets\/opencode\.md\]\(docs\/targets\/opencode\.md\)/);
  assert.match(other, /For OpenCode that is \*\*2\.x\*\*, the version it is verified against; 1\.x is not offered/);
  assert.match(other, /Support for Codex, GitHub Copilot, Gemini\s+>\s+CLI, Cursor and Grok Build is built in but has not been verified yet/);
});

test('no second wait script exists: the OpenCode harness runs the kit\'s wait-answer.mjs unchanged', () => {
  const scripts = readdirSync(join(root, 'plugin', 'scripts'));
  assert.deepEqual(scripts.filter((n) => /wait/i.test(n)), ['wait-answer.mjs']);
  assert.match(harness(opencode, 'x', ''), /wait-answer:\*\* `node \.sdlc\/kit\/scripts\/wait-answer\.mjs`/);
  assert.doesNotMatch(openHarness, /opencode-wait|wait-answer-opencode/i);
});