import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const [oldShape, oldPlan] = ['shape', 'plan'].map((verb) => `${verb}-work`);
const oldName = new RegExp(`${oldShape}|${oldPlan}`);
const legacySentence = new RegExp(`\\*\\*Legacy value:\\*\\* [^.]*\`filing-work: ${oldPlan}\`[^.]*\\.`, 'g');

function files(path) {
  if (!existsSync(path)) return [];
  if (!statSync(path).isDirectory()) return [path];
  return readdirSync(path).flatMap((name) => files(join(path, name)));
}

const read = (path) => readFileSync(path, 'utf8').replace(/\s+/g, ' ');

test('no skill directory keeps an old name', () => {
  for (const dir of ['plugin/skills', 'targets/agents/skills', 'targets/agents/skills/sdlc-install/kit/skills']) {
    for (const name of [oldShape, oldPlan]) {
      assert.ok(!existsSync(join(root, dir, name)), `${dir}/${name} still exists`);
    }
  }
  for (const name of ['shape-project', 'plan-project']) {
    assert.ok(existsSync(join(root, 'plugin', 'skills', name, 'SKILL.md')), `plugin/skills/${name} is missing`);
  }
});

test('no old skill name survives outside the labelled legacy-value sentence', () => {
  const scanned = ['plugin', 'targets', 'README.md', 'agent-setup', 'scripts'].flatMap((path) => files(join(root, path)));
  const left = scanned.filter((file) => oldName.test(read(file).replace(legacySentence, '')));
  assert.deepEqual(left.map((file) => relative(root, file)), []);
});

test('install and sync-repo still read the old filing-work value as plan-project', () => {
  for (const skill of ['sdlc-install', 'sync-repo']) {
    const sentences = read(join(root, 'plugin', 'skills', skill, 'SKILL.md')).match(legacySentence) ?? [];
    assert.equal(sentences.length, 1, `${skill} has ${sentences.length} legacy-value sentences`);
    assert.ok(sentences[0].includes('the same answer as `plan-project`'), sentences[0]);
  }
});
