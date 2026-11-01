import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const [oldShape, oldPlan] = ['shape', 'plan'].map((verb) => `${verb}-work`);
const [oldTask, oldStory] = ['task', 'story'].map((noun) => `run-${noun}`);
const oldName = new RegExp([oldShape, oldPlan, oldTask, oldStory].join('|'));
const legacySentence = new RegExp(`\\*\\*Legacy value:\\*\\* [^.]*\`filing-work: ${oldPlan}\`[^.]*\\.`, 'g');
const legacyFiles = ['plugin/skills', 'targets/agents/skills'].flatMap((dir) =>
  ['sdlc-install', 'sync-repo'].map((skill) => `${dir}/${skill}/SKILL.md`),
);

function files(path) {
  if (!existsSync(path)) return [];
  if (!statSync(path).isDirectory()) return [path];
  return readdirSync(path).flatMap((name) => files(join(path, name)));
}

const read = (path) => readFileSync(path, 'utf8').replace(/(\w)-\s+/g, '$1-').replace(/\s+/g, ' ');

function withoutLegacySentence(file) {
  const path = relative(root, file);
  const text = read(file);
  if (!legacyFiles.includes(path)) return text;
  const sentences = text.match(legacySentence) ?? [];
  assert.equal(sentences.length, 1, `${path} has ${sentences.length} legacy-value sentences`);
  assert.equal(sentences[0].match(new RegExp(oldName, 'g')).length, 1, `${path}: the legacy-value sentence names more than the value`);
  return text.replace(legacySentence, '');
}

test('no skill directory keeps an old name', () => {
  for (const dir of ['plugin/skills', 'targets/agents/skills', 'targets/agents/skills/sdlc-install/kit/skills']) {
    for (const name of [oldShape, oldPlan, oldTask, oldStory]) {
      assert.ok(!existsSync(join(root, dir, name)), `${dir}/${name} still exists`);
    }
  }
  for (const name of ['shape-project', 'plan-project', 'run']) {
    assert.ok(existsSync(join(root, 'plugin', 'skills', name, 'SKILL.md')), `plugin/skills/${name} is missing`);
  }
});

test('no old skill name survives outside the labelled legacy-value sentence', () => {
  const scanned = ['plugin', 'targets', 'README.md', 'agent-setup', 'scripts'].flatMap((path) => files(join(root, path)));
  const left = scanned.filter((file) => oldName.test(withoutLegacySentence(file)));
  assert.deepEqual(left.map((file) => relative(root, file)), []);
});

test('install and sync-repo still read the old filing-work value as plan-project', () => {
  for (const skill of ['sdlc-install', 'sync-repo']) {
    const sentences = read(join(root, 'plugin', 'skills', skill, 'SKILL.md')).match(legacySentence) ?? [];
    assert.equal(sentences.length, 1, `${skill} has ${sentences.length} legacy-value sentences`);
    assert.ok(sentences[0].includes('the same answer as `plan-project`'), sentences[0]);
  }
});

test('taking the kit removes what only the repo copy has, so a renamed skill directory goes', () => {
  const take = read(join(root, 'plugin', 'skills', 'sync-repo', 'SKILL.md')).match(/- \*\*Take\*\* → .*?A second compare then says "the same"\./)?.[0] ?? '';
  assert.ok(take.includes('remove each file or directory the diff reports as only in `.sdlc/kit/`'), take);
});

test('the brief and verdict templates moved with the run skill', () => {
  for (const name of ['BRIEF.md', 'VERDICT.md']) {
    assert.ok(existsSync(join(root, 'plugin', 'skills', 'run', 'templates', name)), `plugin/skills/run/templates/${name} is missing`);
  }
});
