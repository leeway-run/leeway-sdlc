import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const raw = readFileSync(join(here, '..', 'skills', 'plan-project', 'SKILL.md'), 'utf8');
const fixtureText = readFileSync(join(here, 'fixtures', 'sibling-read-issue.json'), 'utf8');
const fixture = JSON.parse(fixtureText);

// The "What is asked" section only, so the slug's `node -e` elsewhere in the file cannot be taken for the filter.
const section = () => {
  const from = raw.indexOf('### What is asked\n');
  assert.ok(from !== -1, 'no "### What is asked" heading');
  const next = raw.indexOf('\n### ', from + 4);
  return raw.slice(from, next === -1 ? undefined : next);
};

// Pins the whole line: `<cli> --server <server> issue get <ref> --json | node -e "<filter>"`, verb first as PROCESS.md's "Verb first" prints it.
const COMMAND = /<cli> --server <server> issue get <ref> --json \| node -e "([^"]+)"/;
const filterBody = () => {
  const m = section().match(COMMAND);
  assert.ok(m, 'no `<cli> --server <server> issue get <ref> --json | node -e "…"` in "What is asked"');
  return m[1];
};
const run = (body, input) => JSON.parse(execFileSync(process.execPath, ['-e', body], { input, encoding: 'utf8' }));
const mine = fixture.escalations.filter((e) => e.ref === fixture.issue.ref);

test('TC-1: What is asked gives the whole sibling-read command line, issue get --json piped to node -e', { skip: 'red-test-TC-1: SKILL.md has no the sibling-read command line in "What is asked" yet' }, () => {
  assert.ok(filterBody().length > 0);
});

test('TC-2: the filter returns only the story\'s escalations, each whole, answer included', { skip: 'red-test-TC-2: the filter is not written into SKILL.md yet' }, () => {
  assert.equal(mine.length, 2);
  assert.ok(mine.some((e) => e.answer) && mine.some((e) => !e.answer), 'fixture needs an answered and an open one');
  assert.deepEqual(run(filterBody(), fixtureText), mine);
});

test('TC-2 negative: a sub-issue\'s escalation with the same number does not survive, and nothing else of the issue does', { skip: 'red-test-TC-2: the filter is not written into SKILL.md yet' }, () => {
  const out = run(filterBody(), fixtureText);
  assert.ok(Array.isArray(out), 'the output is the escalations array only');
  assert.ok(fixture.escalations.some((e) => e.ref !== fixture.issue.ref && mine.some((m) => m.number === e.number)), 'fixture must collide on number');
  assert.ok(out.every((e) => e.ref === fixture.issue.ref), 'a sub-issue escalation survived');
  assert.equal(out.length, mine.length);
  assert.ok(!JSON.stringify(out).includes('Sub-issue'), 'sub-issue text survived');
  assert.ok(!JSON.stringify(out).includes('a long comment'), 'a comment survived');
});
