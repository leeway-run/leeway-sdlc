// LWY-220.2, TC-3, TC-5: sdlc-install copies only the shared kit into .sdlc/kit/, no file names the two directories it
// leaves out as paths under .sdlc/kit/, and the built kit still ships them. Run: `node --test plugin/test/install-kit-copy.test.mjs`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TARGETS } from '../../scripts/targets.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const flat = (text) => text.replace(/\s+/g, ' ');
const install = flat(readFileSync(join(root, 'plugin', 'skills', 'sdlc-install', 'SKILL.md'), 'utf8'));

// The bullet for `plugin-files: .sdlc/kit/`, up to the next bullet.
const bullet = /- \*\*Where `HARNESS\.md` says `plugin-files: \.sdlc\/kit\/`\*\*(.*?)(?= - `\.sdlc\/templates\/|$)/.exec(install)?.[1] ?? '';

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

test('red-test-TC-3: sdlc-install copies kit/ to .sdlc/kit/ except harness/ and wiring/, and says why', { skip: 'red-test-TC-3: the paragraph still says to copy kit/ whole' }, () => {
  assert.match(bullet, /copy this skill's `kit\/`/, 'could not find the plugin-files bullet');
  assert.match(bullet, /except `harness\/` and `wiring\/`/);
  assert.doesNotMatch(bullet, /`\.sdlc\/kit\/` whole/);
  assert.match(bullet, /nothing reads them there/);
  assert.match(bullet, /`sync-repo` compares against the installed skill/);
});

test('TC-3: HARNESS.md still comes from kit/harness/<agent>.md and the wiring from kit/wiring/<agent>/ (guard: true before and after)', () => {
  assert.match(bullet, /`kit\/harness\/<agent>\.md` (as|over) `\.sdlc\/kit\/HARNESS\.md`/);
  assert.match(bullet, /`kit\/wiring\/<agent>\/`/);
  assert.match(bullet, /never an overwrite/);
});

// Built from parts so this file does not name the paths it forbids.
const forbidden = [['.sdlc', 'kit', 'harness'].join('/'), ['.sdlc', 'kit', 'wiring'].join('/')];
const scanned = ['plugin', join('targets', 'agents')].flatMap((dir) => files(join(root, dir)));

test('the scan reaches plugin/ and the built kit', () => {
  const rel = scanned.map((path) => relative(root, path).split(sep).join('/'));
  assert.ok(rel.includes('plugin/skills/sdlc-install/SKILL.md'));
  assert.ok(rel.includes('targets/agents/skills/sdlc-install/SKILL.md'));
  assert.ok(rel.some((path) => path.startsWith('targets/agents/skills/sdlc-install/kit/harness/')));
});

test('TC-5: no file under plugin/ or targets/agents/ names the harness or wiring directory as a path under .sdlc/kit/ (guard: true before and after)', () => {
  const offenders = scanned.filter((path) => {
    const text = readFileSync(path, 'utf8');
    return forbidden.some((literal) => text.includes(literal));
  });
  assert.deepEqual(offenders.map((path) => relative(root, path)), []);
});

test('TC-5: the built kit still holds harness/ and wiring/ for every target (guard: true before and after)', () => {
  const kit = join(root, 'targets', 'agents', 'skills', 'sdlc-install', 'kit');
  assert.ok(TARGETS.length > 0);
  for (const { id } of TARGETS) {
    assert.ok(existsSync(join(kit, 'harness', `${id}.md`)), `kit/harness/${id}.md is missing`);
    assert.ok(existsSync(join(kit, 'wiring', id)), `kit/wiring/${id}/ is missing`);
  }
});

test('red-test-TC-3: the generated skills tell a skill what .sdlc/kit/ holds, without harness/ or wiring/', { skip: 'red-test-TC-3: the generated header does not yet say .sdlc/kit/ holds no harness/ or wiring/' }, () => {
  const text = flat(readFileSync(join(root, 'targets', 'agents', 'skills', 'sdlc-install', 'SKILL.md'), 'utf8'));
  assert.match(text, /not `?harness\/`? or `?wiring\/`?/);
});

test('TC-3: .sdlc/kit/skills/ stays, with the scaffold templates plan-project falls back to (guard)', () => {
  assert.ok(existsSync(join(root, 'targets', 'agents', 'skills', 'sdlc-install', 'kit', 'skills', 'sdlc-install', 'scaffold', 'templates')));
  assert.doesNotMatch(bullet, /except[^.]*`skills\//);
});
