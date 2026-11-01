import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const skills = ['plugin/skills', 'targets/agents/skills'].flatMap((dir) =>
  readdirSync(join(root, dir))
    .map((name) => `${dir}/${name}/SKILL.md`)
    .filter((path) => existsSync(join(root, path))),
);
const descriptionOf = (path) =>
  /^---\r?\n[\s\S]*?^description: (.*)$/m.exec(readFileSync(join(root, path), 'utf8'))?.[1];

test('the plugin and the generated package have the same skills, and some', () => {
  const names = (dir) => skills.filter((path) => path.startsWith(dir)).map((path) => path.split('/').at(-2));
  assert.ok(names('plugin/').length > 0);
  assert.deepEqual(names('targets/'), names('plugin/'));
});

for (const path of skills) {
  test(`${path}: the description uses Leeway's nouns, not story or task`, () => {
    const description = descriptionOf(path);
    assert.ok(description, `${path} has no description: line`);
    assert.deepEqual(description.match(/\b(stor(y|ies)|tasks?)\b/gi) ?? [], [], description);
  });

  test(`${path}: the description fits the 1,024-character limit`, () => {
    assert.ok(descriptionOf(path).length <= 1024, `${descriptionOf(path).length} characters`);
  });
}
