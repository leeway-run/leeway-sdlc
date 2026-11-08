import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const install = join(dirname(fileURLToPath(import.meta.url)), '..', 'skills', 'sdlc-install');
const read = (path) => readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
const skill = read(join(install, 'SKILL.md'));
const block = read(join(install, 'scaffold', 'AGENT-BLOCK.md.tmpl'));
const binding = read(join(install, 'scaffold', 'leeway.md.tmpl'));

function ruleFromSkill() {
  const start = skill.indexOf('- **`{{FILING_WORK_RULE}}`**');
  assert.ok(start >= 0, 'sdlc-install lists no {{FILING_WORK_RULE}} placeholder');
  const fence = /\n {2}```markdown\n([\s\S]*?)\n {2}```\n/.exec(skill.slice(start));
  assert.ok(fence, 'the {{FILING_WORK_RULE}} entry carries no markdown block');
  return fence[1].split('\n').map((line) => line.replace(/^ {2}/, '')).join('\n');
}

function fill(template, filingWork) {
  if (filingWork === 'plan-project') return template.replace('{{FILING_WORK_RULE}}', ruleFromSkill());
  return template.replace('{{FILING_WORK_RULE}}\n\n', '');
}

const optIn = 'CLI command).\n\n';

test('the binding template carries a filing-work line', () => {
  assert.ok(binding.includes('\nfiling-work: {{FILING_WORK}}\n'));
});

test('the block template has the placeholder on its own line after the opt-in paragraph', () => {
  assert.ok(block.includes(`${optIn}{{FILING_WORK_RULE}}\n\nPairing turn by turn`));
});

test('sync-repo fills the placeholder from the binding when it compares the block', () => {
  const sync = read(join(install, '..', 'sync-repo', 'SKILL.md'));
  const row = sync.split('\n').find((line) => line.startsWith('| the contract block |'));
  assert.ok(row, 'sync-repo has no contract-block row');
  assert.ok(row.includes('`{{FILING_WORK_RULE}}`') && row.includes('`filing-work:`'), row);
});

test('filled with plan-project, the block carries the rule', () => {
  const filled = fill(block, 'plan-project');
  assert.ok(!filled.includes('{{FILING_WORK_RULE}}'));
  assert.ok(filled.includes(`${optIn}**Filing work in Leeway is planning, even while pairing.**`));
  for (const words of ['invoke\n`plan-project`', '"turn this feedback into tickets"', 'stays opt-in.\n\nPairing']) {
    assert.ok(filled.includes(words), `rule lacks ${JSON.stringify(words)}`);
  }
  assert.ok(!filled.includes('\n\n\n'));
});

test('filled with manual, the block has no trace of the rule and no blank-line scar', () => {
  assert.ok(skill.includes('delete the placeholder\'s line and the blank line after it'));
  const filled = fill(block, 'manual');
  assert.ok(!filled.includes('{{FILING_WORK_RULE}}'));
  assert.ok(!/Filing work|filing work|plan-project`\. That/.test(filled), 'manual fill still carries rule text');
  assert.ok(filled.includes(`${optIn}Pairing turn by turn`));
  assert.ok(!filled.includes('\n\n\n'));
});
