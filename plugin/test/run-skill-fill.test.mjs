import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TARGETS } from '../../scripts/targets.mjs';

const plugin = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
const skill = read(join(plugin, 'skills', 'sdlc-install', 'SKILL.md'));
const block = read(join(plugin, 'skills', 'sdlc-install', 'scaffold', 'AGENT-BLOCK.md.tmpl'));
const words = "leeway-sdlc's `run` skill";

const commandsOf = (harness) => /^- \*\*commands:\*\* (.+)$/m.exec(harness)[1];
const harnesses = [
  { id: 'claude-code', commands: commandsOf(read(join(plugin, 'HARNESS.md'))) },
  ...TARGETS.map((t) => ({ id: t.id, commands: t.commands })),
];

function formOf(commands) {
  const code = /`([^`]*<skill>[^`]*)`/.exec(commands);
  if (code) return code[1];
  assert.match(commands, /invoked by name/, `no commands form in ${JSON.stringify(commands)}`);
  return 'by name';
}

function fillsFromSkill() {
  const start = skill.indexOf('- **`{{RUN_SKILL}}`**');
  assert.ok(start >= 0, 'sdlc-install lists no {{RUN_SKILL}} placeholder');
  const end = skill.indexOf('\n- **', start + 1);
  const fills = [];
  for (const line of skill.slice(start, end).split('\n')) {
    const item = /^ {2}- (.+?): (.+)$/.exec(line);
    if (!item) continue;
    const span = /^``(.*)``$/.exec(item[2]);
    assert.ok(span, `the fill for ${item[1]} is not one double-backtick code span: ${item[2]}`);
    const text = span[1].replace(/^ | $/g, '');
    const code = /^`([^`]+)`/.exec(item[1]);
    fills.push({ form: code ? code[1] : /^skills invoked by name\b/.test(item[1]) ? 'by name' : item[1], text });
  }
  return fills;
}

function fillFor(form) {
  const matches = fillsFromSkill().filter((f) => f.form === form);
  assert.equal(matches.length, 1, `the {{RUN_SKILL}} entry gives ${matches.length} fills for ${form}`);
  return matches[0].text;
}

const runLine = (filled) => filled.split('\n').find((line) => line.endsWith('`.sdlc/leeway.md` names the'));
const expected = {
  'claude-code': 'or `/leeway-sdlc:run`. The process itself is read from Leeway (`.sdlc/leeway.md` names the',
  codex: 'or `$run`. The process itself is read from Leeway (`.sdlc/leeway.md` names the',
  copilot: 'or `/run`. The process itself is read from Leeway (`.sdlc/leeway.md` names the',
  grok: 'or `/run`. The process itself is read from Leeway (`.sdlc/leeway.md` names the',
  cursor: `or ${words}. The process itself is read from Leeway (\`.sdlc/leeway.md\` names the`,
  gemini: `or ${words}. The process itself is read from Leeway (\`.sdlc/leeway.md\` names the`,
  opencode: `or ${words}. The process itself is read from Leeway (\`.sdlc/leeway.md\` names the`,
};

test('the block template carries {{RUN_SKILL}} with no markup of its own', () => {
  assert.ok(block.includes('\nor {{RUN_SKILL}}. The process itself'));
});

test('the entry says how a fill is read from its double backticks, padding included', () => {
  const start = skill.indexOf('- **`{{RUN_SKILL}}`**');
  const prose = skill.slice(start, skill.indexOf('\n  - ', start)).replace(/\s+/g, ' ');
  for (const rule of [
    'The placeholder is replaced by the text inside the double backticks for that **commands** form, exactly: the backticks inside it stay, and nothing is added round it.',
    'A space just inside the double backticks is Markdown padding, not part of the fill.',
  ]) assert.ok(prose.includes(rule), `the {{RUN_SKILL}} entry does not say: ${rule}`);
});

test('every harness has an expected line, and every commands form one fill', () => {
  assert.deepEqual(harnesses.map((h) => h.id).sort(), Object.keys(expected).sort());
  const forms = [...new Set(harnesses.map((h) => formOf(h.commands)))];
  assert.deepEqual(fillsFromSkill().map((f) => f.form).sort(), forms.sort());
});

for (const { id, commands } of harnesses) {
  test(`filled for ${id} as the entry says, the block names run exactly`, () => {
    const form = formOf(commands);
    const text = fillFor(form);
    if (form !== 'by name') assert.equal(text, `\`${form.replace('<skill>', 'run')}\``);
    const filled = block.replace('{{RUN_SKILL}}', text);
    assert.ok(!filled.includes('{{RUN_SKILL}}'));
    assert.equal(runLine(filled), expected[id]);
  });
}

test('the words form is spelled one way wherever a skill names run in words', () => {
  const run = read(join(plugin, 'skills', 'run', 'SKILL.md'));
  assert.ok(run.includes(`as ${words} where it names skills in words`));
  for (const text of [skill, run]) assert.ok(!/leeway-sdlc's "?run"? skill|"leeway-sdlc's `run` skill"/.test(text));
});

test('sync-repo fills {{RUN_SKILL}} as sdlc-install does when it compares the block', () => {
  const sync = read(join(plugin, 'skills', 'sync-repo', 'SKILL.md'));
  const row = sync.split('\n').find((line) => line.startsWith('| the contract block |'));
  assert.ok(row, 'sync-repo has no contract-block row');
  assert.ok(row.includes('filled in as sdlc-install fills it') && row.includes('`{{RUN_SKILL}}` from its **commands**'), row);
});
