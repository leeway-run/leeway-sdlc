// LWY-214.3: the install's OpenCode guard check must exercise the plugin as OpenCode 2.x loads it, not
// the adapter pipe alone, which passes while the plugin never loads (docs/targets/opencode.md, "Hook
// payloads": 2.x rejects a V1 file at load and the guards sit silently absent). These pin the three
// texts and the row's reload wording. Run: `node --test plugin/test/install-opencode-check.test.mjs`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TARGETS } from '../../scripts/targets.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (path) => readFileSync(join(root, path), 'utf8').replace(/\r\n/g, '\n');
const flat = (text) => text.replace(/\s+/g, ' ');

const install = read('plugin/skills/sdlc-install/SKILL.md');
const sync = read('plugin/skills/sync-repo/SKILL.md');
const opencode = TARGETS.find((t) => t.id === 'opencode');
const harness = read('targets/agents/skills/sdlc-install/kit/harness/opencode.md');

// Step 7's wiring-check bullet, from its lead to the next bullet at the same depth.
const step7 = (() => {
  const at = install.indexOf('confirm the guard works **as this agent loads it**');
  assert.ok(at >= 0, 'step 7 no longer has the wiring-check bullet');
  const end = install.indexOf('\n- Print what to do next', at);
  assert.ok(end > at, 'step 7\'s wiring-check bullet is not before the "Print what to do next" bullet');
  return flat(install.slice(at, end));
})();

test('the OpenCode branch exists: the check exercises the plugin as OpenCode loads it', () => {
  assert.match(step7, /\*\*OpenCode:\*\* the adapter pipe alone is not the check/);
  assert.match(step7, /one scratch OpenCode run in a copy of this repo that has the written wiring/);
  assert.match(step7, /with the governed marker live and a governed shell call made, must be \*\*refused\*\* with the guard's reason, and the call must not run/);
  assert.match(step7, /opencode run --auto \[--model <provider\/model>\] "Run exactly this command with the shell tool and report its output verbatim: git commit --allow-empty -m check"/);
});

test('the adapter pipe alone is not the OpenCode path', () => {
  // The pipe stays, but as the branch for every other agent, named as such.
  assert.match(step7, /\*\*Every agent but OpenCode:\*\* pipe a governed payload through the hook and expect exit 2/);
  assert.ok(
    step7.includes(`echo '{"tool_input":{"command":"git commit -m x"}}' | node .sdlc/kit/hooks/adapters/guard.mjs <agent> --governed; echo $?`),
    'the adapter pipe command is gone from the non-OpenCode branch',
  );
  assert.match(step7, /a payload piped straight through `guard\.mjs` exits 2 while the plugin OpenCode never loaded sits on disk with the guards silently absent/);
});

test('where it cannot verify through the agent, it says what it could not verify and never claims the guards are live', () => {
  assert.match(step7, /\*\*Where you cannot run a scratch OpenCode session\*\*/);
  assert.match(step7, /do not fall back to the adapter pipe and call it verified/);
  assert.match(step7, /say what you could not verify, plainly, as an item in the "did not settle" list below, and never claim the guards are live when the plugin's load was not shown/);
  // The negative case, at the text: an absent or V1 file means the check fails, named as the cause.
  assert.match(step7, /A run that commits, or prints no refusal, means the plugin is not loaded: \*\*the check fails\*\*/);
  assert.match(step7, /a V1 file left at `\.opencode\/plugins\/leeway-sdlc\.js` \(or none\) is why/);
  assert.match(step7, /Confirm at least that the file at `\.opencode\/plugins\/leeway-sdlc\.js` is the V2 shape \(`Plugin\.define` with a `setup`, not a function returning `tool\.execute\.before`\)/);
});

test('the wiring list keeps the two OpenCode paths the build writes', () => {
  const wiring = /^## Wiring\n([\s\S]*?)(?=^## )/m.exec(harness)?.[1];
  assert.ok(wiring, 'the OpenCode harness has no "## Wiring" section');
  assert.match(wiring, /sdlc-install writes these from `kit\/wiring\/opencode\/`, and sync-repo keeps them current:/);
  assert.match(wiring, /`\.opencode\/plugins\/leeway-sdlc\.js`/);
  assert.match(wiring, /`\.opencode\/agents\/<agent>\.md`/);
  assert.deepEqual(
    Object.keys(opencode.wiring([{ name: '<agent>', description: '', body: '', readOnly: false }])).sort(),
    ['.opencode/agents/<agent>.md', '.opencode/plugins/leeway-sdlc.js'],
  );
});

test('sync-repo: the OpenCode refresh replaces the V1 file with the V2 one, and a modified file keeps the diff-and-ask rule', () => {
  const at = sync.indexOf('**OpenCode\'s guard plugin is a copy like any other');
  assert.ok(at >= 0, 'sync-repo no longer names the OpenCode guard plugin');
  const end = sync.indexOf('\nCompare with', at);
  assert.ok(end > at, 'the OpenCode note is not before the compare paragraph');
  const note = flat(sync.slice(at, end));
  assert.match(note, /a repo installed before this release has the V1 file/);
  assert.match(note, /the V1 shape — a function returning a `tool\.execute\.before` key — which OpenCode 2\.x \*\*refuses at load\*\*/);
  assert.match(note, /Take replaces the V1 file with the V2 one/);
  assert.match(note, /a file the team modified is \*\*different otherwise\*\* and gets the diff and the question, never a silent overwrite/);
  assert.match(note, /The agent files \(`\.opencode\/agents\/<agent>\.md`\) refresh the same way/);
});

test("the row's after text states the mechanism docs/targets/opencode.md records", () => {
  const page = read('docs/targets/opencode.md');
  // The page records reload-on-save: a save put the new plugin in force without a restart.
  assert.match(page, /reload on save — editing `\.opencode\/plugins\/probe\.js` while the server\s+ran put the new code in force for the next session, no restart/);
  assert.match(opencode.after, /OpenCode 2\.x reloads `\.opencode\/plugins\/leeway-sdlc\.js` on save \(measured — docs\/targets\/opencode\.md\)/);
  assert.doesNotMatch(opencode.after, /[Rr]estart OpenCode so it loads/);
  assert.match(opencode.restart, /reloads on save/);
  // The generated harness carries the same line, so plugin/ and targets/agents/ agree.
  assert.ok(flat(harness).includes(flat(opencode.after)), 'the generated harness does not carry the row\'s after text');
});

test('install, update, refresh and installed name the measured commands, not the tree/main subpath', () => {
  const SUBPATH = 'leeway-run/leeway-sdlc/tree/main/targets/agents/skills';
  const PLAIN = 'leeway-run/leeway-sdlc/targets/agents/skills';
  assert.deepEqual(opencode.install, [`\`npx -y skills add ${PLAIN} -a opencode --yes\``]);
  // The update runs the same plain form; it names tree/main only to say why it is not used.
  assert.match(opencode.update, new RegExp(`^\`npx -y skills add ${PLAIN.replace(/[/.]/g, '\\$&')} -a opencode --yes\` again`));
  assert.doesNotMatch(opencode.update, new RegExp(`skills add ${SUBPATH.replace(/[/.]/g, '\\$&')}`));
  // The measurement that settles it: tree/main exits 0 with "No skills found".
  const page = read('docs/targets/opencode.md');
  assert.ok(page.includes(SUBPATH), 'the page no longer records the tree/main form');
  assert.match(page, /`npx -y skills add …\/tree\/main\/targets\/agents\/skills -a opencode --yes` exits 0 with "No skills found" and installs\s+nothing/);
  assert.match(opencode.installed, /npx skills list -a opencode/);
  assert.match(opencode.refresh, /the update command fetches the latest/);
});