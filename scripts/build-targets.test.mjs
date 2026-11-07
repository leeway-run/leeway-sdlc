// End to end for the generated package, without any agent: build it, lay it into a temp repo as
// sdlc-install does (kit → .sdlc/kit, wiring/<agent> → repo root), then run each agent's guard hook
// exactly as its wiring declares it. Run: `node --test scripts/build-targets.test.mjs`.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execSync, spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { harness, TARGETS } from './targets.mjs'

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

// The section run's "Wait, then carry on" points at, with a `wait:` line; `background` only with a probe record saying so.
test('every HARNESS.md says how a run waits, and waits only where a probe showed it', () => {
  const harnesses = [
    ['claude', join(ROOT, 'plugin', 'HARNESS.md')],
    ['any', join(ROOT, 'targets', 'agents', 'HARNESS.md')],
    ['any', join(KIT, 'HARNESS.md')],
    ...readdirSync(join(KIT, 'harness')).map((f) => [f.replace(/\.md$/, ''), join(KIT, 'harness', f)]),
  ]
  assert.equal(harnesses.length, 3 + TARGETS.length)
  for (const [id, path] of harnesses) {
    const text = readFileSync(path, 'utf8')
    const section = /^## Waiting for an answer\n([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(text)?.[1]
    assert.ok(section, `${path}: no "## Waiting for an answer" section`)
    const wait = /^wait: (background|stop)$/m.exec(section)?.[1]
    assert.ok(wait, `${path}: no wait line`)
    // run's step 4 lets a wait that blocks nothing (a debt proposal after the task is done) carry on; stop must too.
    if (wait === 'stop') assert.match(section, /blocks nothing[^.]*carries on/, `${path} stops a wait that blocks nothing`)
    if (wait === 'background') {
      const record = join(ROOT, 'docs', 'targets', `${id}.md`)
      assert.ok(existsSync(record), `${path} waits, but there is no probe record ${record}`)
      assert.match(readFileSync(record, 'utf8'), /^wait: background$/m, `${record} does not record a wait`)
    }
  }
  for (const t of TARGETS) {
    assert.equal(/^wait: (\S+)$/m.exec(harness(t, 'x', ''))[1], t.wait ? 'background' : 'stop', t.id)
  }
})

// The section run's "Recording spend" points at: only Claude Code counts, and every other target leaves --tokens out.
test('every HARNESS.md says whether a run can count tokens, and one that cannot records none', () => {
  const harnesses = [
    ['claude', join(ROOT, 'plugin', 'HARNESS.md')],
    ['any', join(ROOT, 'targets', 'agents', 'HARNESS.md')],
    ['any', join(KIT, 'HARNESS.md')],
    ...readdirSync(join(KIT, 'harness')).map((f) => [f.replace(/\.md$/, ''), join(KIT, 'harness', f)]),
  ]
  assert.equal(harnesses.length, 3 + TARGETS.length)
  for (const [id, path] of harnesses) {
    const section = /^## Counting tokens\n([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(readFileSync(path, 'utf8'))?.[1]
    assert.ok(section, `${path}: no "## Counting tokens" section`)
    const flat = section.replace(/\s+/g, ' ')
    const tokens = /^tokens: (transcripts|none)$/m.exec(section)?.[1]
    assert.equal(tokens, id === 'claude' ? 'transcripts' : 'none', path)
    if (tokens === 'none') {
      assert.match(flat, /every record leaves `--tokens` out \(run, "Recording spend"\)/, path)
      assert.match(flat, /never `--tokens 0`, never an estimate/, path)
      assert.match(flat, /`tokensIncomplete`, a floor, and the run carries on/, path)
    } else {
      assert.match(flat, /projects\/\*\/\$CLAUDE_CODE_SESSION_ID\/subagents\/agent-<agent id>\.jsonl/)
      assert.match(flat, /projects\/\*\/\$CLAUDE_CODE_SESSION_ID\.jsonl/)
      assert.match(flat, /that record leaves `--tokens` out/)
      assert.match(flat, /Never take `subagent_tokens` from the completion notice instead: it is the agent's final context size/)
      assert.match(readFileSync(join(ROOT, 'docs', 'targets', 'claude.md'), 'utf8'), /^tokens: transcripts$/m)
    }
  }
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
      assert.deepEqual(
        readFileSync(join(repo, '.sdlc', 'kit', 'scripts', 'wait-answer.mjs')),
        readFileSync(join(ROOT, 'plugin', 'scripts', 'wait-answer.mjs')),
        'the kit carries the answer-wait script',
      )
      assert.deepEqual(
        readFileSync(join(repo, '.sdlc', 'kit', 'scripts', 'session-tokens.mjs')),
        readFileSync(join(ROOT, 'plugin', 'scripts', 'session-tokens.mjs')),
        'the kit carries the token-counting script',
      )
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
