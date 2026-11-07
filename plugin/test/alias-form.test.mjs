import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const plugin = join(dirname(fileURLToPath(import.meta.url)), '..');

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

const read = (path) => readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
const rel = (path) => relative(plugin, path).split(sep).join('/');

// Everything an agent is told to read: the skills with their templates and references, the agents, the contract.
const texts = [
  ...files(join(plugin, 'skills')),
  ...files(join(plugin, 'agents')),
  ...files(join(plugin, 'craft')),
  join(plugin, 'PROCESS.md'),
  join(plugin, 'HARNESS.md'),
];

function cast() {
  const process = read(join(plugin, 'PROCESS.md'));
  const start = process.indexOf('\n## The cast\n');
  assert.ok(start >= 0, 'PROCESS.md has no "The cast" section');
  return process.slice(start, process.indexOf('\n## ', start + 1));
}

const flat = (text) => text.replace(/\s+/g, ' ');

test('the scan reaches the skills, the agents, the templates and the contract', () => {
  for (const name of ['skills/run/SKILL.md', 'skills/run/templates/BRIEF.md', 'agents/sdlc-implementer.md', 'PROCESS.md']) {
    assert.ok(texts.map(rel).includes(name), `${name} is not scanned`);
  }
});

test('no skill, agent or template teaches the old alias form', () => {
  const taught = /two\s+hex|hex\s+digit|<word>-|--as\s+[a-z]+-[0-9a-f]{2}\//i;
  const offenders = texts.filter((path) => taught.test(read(path)));
  assert.deepEqual(offenders.map(rel), []);
});

test('an old alias appears only in the sentence that says old aliases keep their form', () => {
  const offenders = texts.filter((path) => rel(path) !== 'PROCESS.md' && /kestrel-[0-9a-f]{2}\b/.test(read(path)));
  assert.deepEqual(offenders.map(rel), []);
  const process = flat(read(join(plugin, 'PROCESS.md')));
  assert.equal(process.match(/kestrel-[0-9a-f]{2}\b/g).length, 1);
  assert.match(process, /Aliases already in a thread \(`kestrel-b1`\) keep their old form and still display as themselves\./);
});

test('the rule names activeAgents, the suffix, the fallback and the CLI check', () => {
  const rule = flat(cast());
  assert.match(rule, /an adjective and a bird, two lowercase words joined by a hyphen \(`quiet-wren`\)/);
  assert.match(rule, /`leeway --json project get <KEY> <projectId>`, with the project id from `issue get`'s `project\.id`/);
  assert.match(rule, /its `activeAgents` lists those that acted in the last 24 hours/);
  assert.match(rule, /add `-2`, then `-3` and so on, until the alias is in neither \(`quiet-wren-2`\)/);
  assert.match(rule, /returns no `activeAgents`; then the issue's aliases are the only check/);
  assert.ok(rule.includes('matches `^[a-z][a-z0-9-]{1,23}$`'), 'the rule does not name the regex');
  assert.match(rule, /A task resumed in a later session carries that session's alias, a new one chosen the same way/);
  assert.match(rule, /\*\*With no project in hand\*\* there is nothing to read/);
});

test('every pair the lists can make, with -99, passes the CLI check, at the length the rule states', () => {
  const rule = flat(cast());
  const list = (lead) => new RegExp(`\\*\\*${lead}:\\*\\* ([a-z, ]+)\\.`).exec(rule)[1].split(', ');
  const adjectives = list('Adjectives');
  const birds = list('Birds');
  assert.ok(adjectives.length >= 20 && birds.length >= 20, 'the lists are too short to make collisions rare');
  const check = /^[a-z][a-z0-9-]{1,23}$/;
  let longest = 0;
  for (const adjective of adjectives) {
    for (const bird of birds) {
      const alias = `${adjective}-${bird}-99`;
      assert.match(alias, check);
      longest = Math.max(longest, alias.length);
    }
  }
  assert.equal(longest, 19);
  assert.match(rule, /the longest pair with `-99` is 19 characters/);
});

test('each skill that chooses an alias says the new form and points at the rule', () => {
  for (const name of ['run', 'sync-repo', 'plan-project', 'sdlc-install', 'sdlc-tune', 'shape-project']) {
    const text = flat(read(join(plugin, 'skills', name, 'SKILL.md')));
    assert.match(text, /an adjective and a bird/, `${name} does not say the form`);
    assert.match(text, /`quiet-wren`/, `${name} has no example`);
    assert.match(text, /`PROCESS\.md`,? \(?"The cast"/, `${name} does not point at the rule`);
  }
});

test('each skill says which project it reads, or that it has none', () => {
  const says = {
    run: /the project's `activeAgents` \(`leeway --json project get <KEY> <project\.id>`\) or the issue's `agents`/,
    'sync-repo': /the named issue's \(`issue get <issue>`: `project\.id`\); this mode always has one/,
    'plan-project': /Planning into a project this session is about to create, there is no project to read: a pair at random/,
    'sdlc-install': /with none named there is no project to read, so take a pair at random/,
    'sdlc-tune': /in the terminal with no issue named, a pair at random, as there is no project to read/,
    'shape-project': /a project this session creates has nothing to read, so take a pair at random/,
  };
  for (const [name, pattern] of Object.entries(says)) {
    assert.match(flat(read(join(plugin, 'skills', name, 'SKILL.md'))), pattern, name);
  }
});
