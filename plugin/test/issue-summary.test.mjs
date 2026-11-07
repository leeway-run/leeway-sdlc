import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const plugin = join(dirname(fileURLToPath(import.meta.url)), '..');
const here = join(plugin, 'test');

function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return path === here ? [] : files(path);
    return /\.(md|tmpl)$/.test(entry.name) ? [path] : [];
  });
}

// A command is code: a line of a fenced block (joined to the next when it ends in `\`), or an inline code span
// (which may wrap, but never across a blank line). A span that names `issue create` with no flag after it is a
// mention in prose, not a command.
function creates(text) {
  const found = [];
  const prose = text.replace(/\r\n/g, '\n').replace(/^[ \t]*```[^\n]*\n([\s\S]*?)^[ \t]*```/gm, (_, body) => {
    found.push(...body.replace(/\\\n/g, ' ').split('\n'));
    return '';
  });
  for (const [, span] of prose.matchAll(/`([^`\n]+(?:\n(?![ \t]*\n)[^`\n]*)*)`/g)) found.push(span);
  return found.map((code) => code.replace(/\s+/g, ' ').trim()).filter((code) => /\bissue create\b.*\s--/.test(code));
}

const commands = files(plugin).flatMap((path) =>
  creates(readFileSync(path, 'utf8')).map((command) => ({ at: relative(plugin, path), command })),
);

test('every issue create the plugin runs passes --summary', () => {
  assert.ok(commands.length >= 7, `found only ${commands.length} issue create commands`);
  const bare = commands.filter(({ command }) => !/\s--summary\s/.test(command));
  assert.deepEqual(bare, []);
});

test('a 0.2.0 issue create or a wrapped one without --summary is caught, and a mention is not', () => {
  const v020 =
    '| Security | **File its own issue now**: `leeway --as <alias>/agent issue create <KEY> --projectId <project.id> --title "…" --status backlog --stdin description <desc.md`, in the task\'s project |';
  assert.equal(creates(v020).filter((c) => !/\s--summary\s/.test(c)).length, 1);
  const wrapped = '```sh\nleeway issue create <KEY> \\\n  --projectId <id> --title "x" --stdin description <d\n```\n';
  assert.equal(creates(wrapped).filter((c) => !/\s--summary\s/.test(c)).length, 1);
  assert.deepEqual(creates('You **never write**: no `issue create` or `update`. On a yes, `issue create` as above.'), []);
});
