// LWY-220.3, c18/c19: the kit row's compare command excludes harness, wiring and HARNESS.md itself, and Take writes
// the compared set. Run: `node --test plugin/test/sync-repo-kit-take.test.mjs`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const raw = readFileSync(join(root, 'plugin', 'skills', 'sync-repo', 'SKILL.md'), 'utf8');
const flat = (text) => text.replace(/\s+/g, ' ');
const kitRow = flat(raw.split('\n').find((l) => l.startsWith('| the kit |')) ?? '');
const take = flat(raw.match(/- \*\*Take\*\*[\s\S]*?(?=\n- \*\*Keep\*\*)/)?.[0] ?? '');

test('the kit row compare command carries -x harness, -x wiring and -x HARNESS.md', () => {
  const command = kitRow.match(/`(diff -ru[^`]*)`/)?.[1] ?? '';
  assert.ok(command, 'no diff -ru command in the kit row');
  for (const name of ['harness', 'wiring', 'HARNESS.md']) {
    assert.ok(command.split(' ').some((w, i, a) => w === '-x' && a[i + 1] === name), `missing -x ${name}`);
  }
});

test('Take writes the compared set: the kit minus harness/, wiring/ and HARNESS.md, plus kit/harness/<agent>.md', () => {
  for (const part of ['`harness/`', '`wiring/`', '`HARNESS.md`', '`kit/harness/<agent>.md`']) {
    assert.ok(take.includes(part), `the Take bullet does not name ${part}`);
  }
});
