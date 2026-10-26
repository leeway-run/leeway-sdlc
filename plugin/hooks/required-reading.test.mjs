// Tests for required-reading.mjs. Run from the repo root: `node --test plugin/hooks/required-reading.test.mjs`.
// Each case spawns the hook exactly as Claude Code does -- a SubagentStart payload as JSON on stdin --
// and asserts on what it prints: one JSON object carrying the context, or nothing.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HOOK = fileURLToPath(new URL('./required-reading.mjs', import.meta.url))
const IMPLEMENTER = 'leeway-sdlc:sdlc-implementer'

const TABLE = [
  '| Paths | Read | Why |',
  '|---|---|---|',
  '| `web/src/**` | `.claude/skills/frontend/SKILL.md` | frontend conventions |',
]

const repoWith = (config) => {
  const root = mkdtempSync(join(tmpdir(), 'required-reading-'))
  if (config !== null) {
    mkdirSync(join(root, '.sdlc'))
    writeFileSync(join(root, '.sdlc', 'CONFIG.md'), config)
  }
  return root
}

const configWith = (...sectionLines) =>
  ['# leeway-sdlc wiring for this repo', '', '## Lanes', '', '| a | b |', '|---|---|', '| x | y |', '', ...sectionLines, '', '## Topology', '', '| | |'].join('\n')

const run = (cwd, agentType = IMPLEMENTER) =>
  spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({
      session_id: 'test',
      hook_event_name: 'SubagentStart',
      cwd,
      ...(agentType === null ? {} : { agent_type: agentType }),
    }),
    encoding: 'utf8',
  })

const contextOf = (result) => JSON.parse(result.stdout).hookSpecificOutput

test('injects the Required reading table for an leeway-sdlc agent', () => {
  const result = run(repoWith(configWith('## Required reading', '', ...TABLE)))
  assert.equal(result.status, 0)
  const output = contextOf(result)
  assert.equal(output.hookEventName, 'SubagentStart')
  for (const row of TABLE) assert.ok(output.additionalContext.includes(row), `missing row: ${row}`)
  assert.ok(output.additionalContext.includes('*Rules read*'))
})

test('stops at the next section: rows of other tables are not injected', () => {
  const output = contextOf(run(repoWith(configWith('## Required reading', '', ...TABLE))))
  assert.ok(!output.additionalContext.includes('| x | y |'))
})

test('finds the config from a subdirectory, as a worktree path below the root', () => {
  const root = repoWith(configWith('## Required reading', '', ...TABLE))
  const nested = join(root, 'web', 'src')
  mkdirSync(nested, { recursive: true })
  assert.ok(contextOf(run(nested)).additionalContext.includes('web/src/**'))
})

test('prints nothing for an agent that is not this plugin\'s', () => {
  const result = run(repoWith(configWith('## Required reading', '', ...TABLE)), 'other-plugin:reviewer')
  assert.equal(result.status, 0)
  assert.equal(result.stdout, '')
})

test('prints nothing when the payload carries no agent_type', () => {
  assert.equal(run(repoWith(configWith('## Required reading', '', ...TABLE)), null).stdout, '')
})

test('prints nothing when the repo has no .sdlc/CONFIG.md', () => {
  const result = run(repoWith(null))
  assert.equal(result.status, 0)
  assert.equal(result.stdout, '')
})

test('prints nothing when the section is missing', () => {
  assert.equal(run(repoWith(configWith())).stdout, '')
})

test('prints nothing when the section has a header but no data row', () => {
  assert.equal(run(repoWith(configWith('## Required reading', '', TABLE[0], TABLE[1]))).stdout, '')
})

test('exits 0 and prints nothing on a payload that is not JSON', () => {
  const result = spawnSync(process.execPath, [HOOK], { input: 'not json', encoding: 'utf8' })
  assert.equal(result.status, 0)
  assert.equal(result.stdout, '')
})
