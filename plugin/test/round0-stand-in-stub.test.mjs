// LWY-244.2: a stand-in written over a listed stub passes the staged set check, so the stub case has its own cover.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const plugin = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(plugin, path), 'utf8').replace(/\r\n/g, '\n');
const flat = (text) => text.replace(/\s+/g, ' ');

const slice = (text, from, to) => {
  const start = text.indexOf(from);
  assert.notEqual(start, -1, `anchor not found: ${from}`);
  const end = text.indexOf(to, start);
  assert.notEqual(end, -1, `anchor not found: ${to}`);
  return flat(text.slice(start, end));
};

const runGate = slice(read('skills/run/SKILL.md'), '- **The gate also checks**', '- **The reviewer reviews tests against criteria');
const implementer = slice(read('agents/sdlc-implementer.md'), '**One exception: round 0.**', '## Frozen tests');

test('the gate narrows the staged set claim to every path but a listed stub, and names the reviewer check that covers a stub', () => {
  assert.match(runGate, /already refuses a stand-in left staged at any path but a listed stub's/i);
  assert.match(runGate, /written over a stub fails the reviewer's check that every stub is a signature and nothing more/i);
});

test('the implementer returns a stub the stand-in was written over to a bare signature', () => {
  assert.match(implementer, /stub the stand-in was written over goes back to a bare signature/i);
});
