// Tests for adapters/guard.mjs and adapters/governed.mjs.
// Run from the repo root: `node --test plugin/hooks/adapters/guard.test.mjs`.
// Payload shapes follow each agent's documented hook input; docs/targets/<agent>.md replaces them
// with captured payloads once that agent's spike has run.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { commandOf, decide } from './guard.mjs'

const GUARD = fileURLToPath(new URL('./guard.mjs', import.meta.url))
const GOVERNED = fileURLToPath(new URL('./governed.mjs', import.meta.url))

const run = (args, stdin, cwd) => spawnSync(process.execPath, [GUARD, ...args], { input: stdin, encoding: 'utf8', cwd })

// One documented shape per agent, carrying `command`.
const shapes = {
  codex: (command, extra = {}) => ({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command }, ...extra }),
  copilot: (command, extra = {}) => ({ toolName: 'bash', toolArgs: JSON.stringify({ command }), ...extra }),
  gemini: (command, extra = {}) => ({ hook_event_name: 'BeforeTool', tool_name: 'run_shell_command', tool_input: { command }, ...extra }),
  cursor: (command, extra = {}) => ({ hook_event_name: 'beforeShellExecution', command, ...extra }),
  grok: (command, extra = {}) => ({ hookEventName: 'PreToolUse', toolName: 'Bash', toolInput: { command }, ...extra }),
  opencode: (command, extra = {}) => ({ tool: 'bash', args: { command }, ...extra }),
}

const tempRepo = () => {
  const dir = mkdtempSync(join(tmpdir(), 'leeway-guard-'))
  mkdirSync(join(dir, '.sdlc'))
  return dir
}

for (const [agent, shape] of Object.entries(shapes)) {
  test(`${agent}: the command is read from its payload shape`, () => {
    assert.equal(commandOf(shape('git status')), 'git status')
  })

  test(`${agent}: an unattributed call (the orchestrator) is allowed`, () => {
    const dir = tempRepo()
    try {
      const r = run([agent], JSON.stringify(shape('git commit -m x', { cwd: dir })), dir)
      assert.equal(r.status, 0, r.stderr)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test(`${agent}: with --governed, git commit and a Leeway write are blocked, reads allowed`, () => {
    assert.equal(run([agent, '--governed'], JSON.stringify(shape('git commit -m x'))).status, 2)
    assert.equal(run([agent, '--governed'], JSON.stringify(shape('leeway issue update LW-1 --status done'))).status, 2)
    assert.equal(run([agent, '--governed'], JSON.stringify(shape('npx @leeway-run/cli comment add LW-1'))).status, 2)
    assert.equal(run([agent, '--governed'], JSON.stringify(shape('leeway issue get LW-1'))).status, 0)
    assert.equal(run([agent, '--governed'], JSON.stringify(shape('git add src && git diff --cached'))).status, 0)
  })
}

test('identity in the payload governs: namespaced and bare agent names', () => {
  assert.equal(decide(shapes.codex('git push', { agent_type: 'leeway-sdlc:sdlc-implementer' })).block, true)
  assert.equal(decide(shapes.grok('git push', { agentName: 'sdlc-reviewer' })).block, true)
  assert.equal(decide(shapes.gemini('git push', { agent: { name: 'sdlc-divergence-reviewer' } })).block, true)
  assert.equal(decide(shapes.codex('git push', { agent_type: 'some-other-plugin:implementer' })).block, false)
})

test('a live marker governs every call; an expired one does not', () => {
  const dir = tempRepo()
  try {
    mkdirSync(join(dir, '.sdlc', '.governed'))
    const marker = join(dir, '.sdlc', '.governed', 'LW-1')
    writeFileSync(marker, JSON.stringify({ since: 0, until: Date.now() + 60_000 }))
    assert.equal(decide(shapes.cursor('git commit -m x', { cwd: dir })).block, true)
    assert.equal(decide(shapes.cursor('leeway issue list', { cwd: dir })).block, false)
    // From a worktree below the repo, the repo's marker still applies.
    const worktree = join(dir, '.worktrees', 'LW-1')
    mkdirSync(worktree, { recursive: true })
    assert.equal(decide(shapes.cursor('git merge main', { cwd: worktree })).block, true)
    writeFileSync(marker, JSON.stringify({ since: 0, until: Date.now() - 1 }))
    assert.equal(decide(shapes.cursor('git commit -m x', { cwd: dir })).block, false)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('under a marker, the marker directory is off limits but governed.mjs off works', () => {
  const dir = tempRepo()
  try {
    mkdirSync(join(dir, '.sdlc', '.governed'))
    writeFileSync(join(dir, '.sdlc', '.governed', 'LW-1'), JSON.stringify({ until: Date.now() + 60_000 }))
    assert.equal(decide(shapes.opencode('rm -rf .sdlc/.governed', { cwd: dir })).block, true)
    assert.equal(decide(shapes.opencode('node .sdlc/kit/hooks/adapters/governed.mjs off LW-1', { cwd: dir })).block, false)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('governed.mjs on/off/status round-trip, and the guard follows it', () => {
  const dir = tempRepo()
  try {
    const gov = (...args) => spawnSync(process.execPath, [GOVERNED, ...args], { cwd: dir, encoding: 'utf8' })
    assert.equal(gov('on', 'LW-7', '--minutes', '5').status, 0)
    assert.match(gov('status').stdout, /LW-7\tlive until/)
    assert.equal(run(['copilot'], JSON.stringify(shapes.copilot('git push', { cwd: dir })), dir).status, 2)
    assert.equal(gov('off', 'LW-7').status, 0)
    assert.equal(run(['copilot'], JSON.stringify(shapes.copilot('git push', { cwd: dir })), dir).status, 0)
    assert.equal(gov('on', '../escape').status, 1)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('an argv array (Codex) is judged as a command line', () => {
  assert.equal(commandOf({ tool_input: { command: ['bash', '-lc', 'git commit -m "x y"'] } }), `bash -lc 'git commit -m "x y"'`)
  assert.equal(decide({ tool_input: { command: ['bash', '-lc', 'git commit -m x'] } }, { governedFlag: true }).block, true)
})

test('unreadable input, an unknown agent and a payload without a command all allow', () => {
  assert.equal(run(['codex', '--governed'], 'not json').status, 0)
  assert.equal(run(['nope', '--governed'], JSON.stringify(shapes.codex('git push'))).status, 0)
  assert.equal(run(['gemini', '--governed'], JSON.stringify({ tool_name: 'read_file', tool_input: { path: 'x' } })).status, 0)
})

// Real payloads captured in the Phase 0 spikes (fixtures/<agent>.json), when present.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
const FIXTURES = fileURLToPath(new URL('./fixtures/', import.meta.url))
for (const file of existsSync(FIXTURES) ? readdirSync(FIXTURES).filter((f) => f.endsWith('.json')) : []) {
  const { main, subagent, rule } = JSON.parse(readFileSync(join(FIXTURES, file), 'utf8'))
  test(`fixture ${file}: command readable; main ungoverned${rule === 'a' ? '; subagent governed' : ''}`, () => {
    assert.notEqual(commandOf(main), null)
    assert.notEqual(commandOf(subagent), null)
    const asCommit = (p) => JSON.parse(JSON.stringify(p).replace(JSON.stringify(commandOf(p)).slice(1, -1), 'git commit -m fixture'))
    const dir = tempRepo()
    try {
      assert.equal(decide({ ...asCommit(main), cwd: dir }).block, false)
      if (rule === 'a') assert.equal(decide({ ...asCommit(subagent), cwd: dir }).block, true)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
}
