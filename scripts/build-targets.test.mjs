// End to end for the generated package, without any agent: build it, lay it into a temp repo as
// sdlc-install does (kit → .sdlc/kit, wiring/<agent> → repo root), then run each agent's guard hook
// exactly as its wiring declares it. Run: `node --test scripts/build-targets.test.mjs`.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execSync, spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const KIT = join(ROOT, 'targets', 'agents', 'skills', 'sdlc-install', 'kit')

// The shell command each agent's wiring runs before a tool call, and a payload in that agent's shape.
const HOOKS = {
  codex: { file: '.codex/hooks.json', cmd: (j) => j.hooks.PreToolUse[0].hooks[0].command, payload: (c, cwd) => ({ cwd, tool_name: 'Bash', tool_input: { command: c } }) },
  copilot: { file: '.github/hooks/leeway-sdlc.json', cmd: (j) => j.hooks.preToolUse[0].bash, payload: (c, cwd) => ({ cwd, toolName: 'bash', toolArgs: JSON.stringify({ command: c }) }) },
  gemini: { file: '.gemini/settings.json', cmd: (j) => j.hooks.BeforeTool[0].hooks[0].command, payload: (c, cwd) => ({ cwd, tool_name: 'run_shell_command', tool_input: { command: c } }) },
  cursor: { file: '.cursor/hooks.json', cmd: (j) => j.hooks.beforeShellExecution[0].command, payload: (c, cwd) => ({ cwd, command: c }) },
  grok: { file: '.grok/hooks/leeway-sdlc.json', cmd: (j) => j.hooks.PreToolUse[0].hooks[0].command, payload: (c, cwd) => ({ workspaceRoot: cwd, toolName: 'Bash', toolInput: { command: c } }) },
}

const installInto = (agent) => {
  const repo = mkdtempSync(join(tmpdir(), `leeway-install-${agent}-`))
  cpSync(KIT, join(repo, '.sdlc', 'kit'), { recursive: true })
  cpSync(join(KIT, 'harness', `${agent}.md`), join(repo, '.sdlc', 'kit', 'HARNESS.md'))
  cpSync(join(KIT, 'wiring', agent), repo, { recursive: true })
  return repo
}

const governed = (repo, verb) =>
  execSync(`"${process.execPath}" .sdlc/kit/hooks/adapters/governed.mjs ${verb} T-1`, { cwd: repo, encoding: 'utf8' })

test('the committed package is what the build produces', () => {
  const r = spawnSync(process.execPath, [join(ROOT, 'scripts', 'build-targets.mjs'), '--check'], { encoding: 'utf8' })
  assert.equal(r.status, 0, r.stderr)
})

for (const [agent, hook] of Object.entries(HOOKS)) {
  test(`${agent}: the wired hook allows the orchestrator and blocks under the marker`, () => {
    const repo = installInto(agent)
    try {
      const command = hook.cmd(JSON.parse(readFileSync(join(repo, hook.file), 'utf8'))).replace(/^node /, `"${process.execPath}" `)
      const run = (c) => spawnSync(command, { shell: true, cwd: repo, input: JSON.stringify(hook.payload(c, repo)), encoding: 'utf8' })
      assert.equal(run('git commit -m x').status, 0, 'no marker: the orchestrator commits')
      governed(repo, 'on')
      const blocked = run('git commit -m x')
      assert.equal(blocked.status, 2, blocked.stderr)
      assert.match(blocked.stderr, /git commit/)
      assert.equal(run('leeway issue update LW-1 --status done').status, 2)
      assert.equal(run('leeway issue get LW-1').status, 0)
      assert.equal(run('rm -rf .sdlc/.governed').status, 2)
      governed(repo, 'off')
      assert.equal(run('git commit -m x').status, 0, 'marker off: the orchestrator commits again')
      assert.match(readFileSync(join(repo, '.sdlc', 'kit', 'HARNESS.md'), 'utf8'), new RegExp(`^agent: ${agent}$`, 'm'))
    } finally {
      rmSync(repo, { recursive: true, force: true })
    }
  })
}

test('copilot: the hook on the agent itself governs without a marker', () => {
  const repo = installInto('copilot')
  try {
    const front = readFileSync(join(repo, '.github', 'agents', 'sdlc-implementer.agent.md'), 'utf8')
    const command = JSON.parse(/bash: (".*")/.exec(front)[1]).replace(/^node /, `"${process.execPath}" `)
    const r = spawnSync(command, { shell: true, cwd: repo, input: JSON.stringify({ toolName: 'bash', toolArgs: { command: 'git push' } }), encoding: 'utf8' })
    assert.equal(r.status, 2, r.stderr)
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

test('opencode: the plugin refuses a governed bash call by throwing', async () => {
  const repo = installInto('opencode')
  try {
    const plugin = join(repo, '.opencode', 'plugins', 'leeway-sdlc.js')
    assert.ok(existsSync(plugin))
    const { LeewaySdlcGuard } = await import(pathToFileURL(plugin).href)
    const hooks = await LeewaySdlcGuard({ directory: repo })
    const before = hooks['tool.execute.before']
    await before({ tool: 'bash' }, { args: { command: 'git commit -m x' } })
    governed(repo, 'on')
    await assert.rejects(before({ tool: 'bash' }, { args: { command: 'git commit -m x' } }), /git commit/)
    await before({ tool: 'read' }, { args: { filePath: 'x' } })
    governed(repo, 'off')
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})
