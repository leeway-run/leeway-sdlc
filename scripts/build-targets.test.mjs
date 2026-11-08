// End to end for the generated package, without any agent: build it, lay it into a temp repo as
// sdlc-install does (kit → .sdlc/kit, wiring/<agent> → repo root), then run each agent's guard hook
// exactly as its wiring declares it. Run: `node --test scripts/build-targets.test.mjs`.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execSync, spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
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
      assert.match(flat, /leeway-sdlc-session-tokens --subagent-id <agent id>/)
      assert.match(flat, /leeway-sdlc-session-tokens --this-session --from <start> --to <end>/)
      assert.match(flat, /a command with a variable in braces prompts/)
      assert.match(flat, /that record leaves `--tokens` out/)
      assert.match(flat, /Never take `subagent_tokens` from the completion notice instead: it is the agent's final context size/)
      assert.match(flat, /Stamp a span's end in one tool call and run the script in a later one, never the same call or the same parallel batch/)
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
      assert.deepEqual(
        readFileSync(join(repo, '.sdlc', 'kit', 'scripts', 'raise.mjs')),
        readFileSync(join(ROOT, 'plugin', 'scripts', 'raise.mjs')),
        'the kit carries the raise script',
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

// LWY-189.4: each other agent's "Permissions for an unattended run" says what Claude Code's says (plugin/HARNESS.md): the agent's own
// unattended or auto-approve mode, or a person approving each prompt, marked UNVERIFIED, and no rule written anywhere.
const generatedHarnesses = () => readdirSync(join(KIT, 'harness')).map((f) => [f, readFileSync(join(KIT, 'harness', f), 'utf8')])
const permissionsOf = (text) => /^## Permissions for an unattended run\n([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(text)?.[1]
// A settings file or a rule key: what a rule would be written into.
const RULE_PLACE = /settings|\.(json|toml|ya?ml)\b|\.(codex|gemini|cursor|grok|opencode)\/|\.github\/copilot|permissions?\.(allow|bash)|tools\.allowed|--allow(ed)?-tool/i
const RULE_TALK = /allow[- ]?list|allow[- ]rules?|permission rules?|Say before the yes|question 16/i

test('red-test-TC-1: every generated harness has the permissions section, marked UNVERIFIED as its other unverified sections are', { skip: 'red-test-TC-1: the generated harnesses still say where run\'s allow-list goes, with no UNVERIFIED: about a mode' }, () => {
  const all = generatedHarnesses()
  assert.equal(all.length, TARGETS.length)
  for (const [file, text] of all) {
    const section = permissionsOf(text)
    assert.ok(section, `${file}: no "## Permissions for an unattended run" section`)
    assert.match(section, /UNVERIFIED: /, `${file}: not marked UNVERIFIED`)
    assert.match(section, /(unattended|auto-approve) mode/i, `${file}: does not say the agent's own mode is used`)
    assert.match(section, /person approves (each|every) prompt/i, `${file}: does not say a person approves each prompt otherwise`)
  }
})

test('red-test-TC-2: no generated harness names a settings file or a rule, or the old question 16 offer', { skip: 'red-test-TC-2: the generated harnesses name a settings file and run\'s allow-list' }, () => {
  for (const [file, text] of generatedHarnesses()) {
    const section = permissionsOf(text)
    assert.ok(section, `${file}: no permissions section`)
    assert.doesNotMatch(section, RULE_PLACE, `${file}: names a settings file or rule key`)
    assert.doesNotMatch(section, RULE_TALK, `${file}: talks of a rule or the old offer`)
    assert.doesNotMatch(text, RULE_TALK, `${file}: says allow-list or Say before the yes outside that section`)
  }
})

test('red-test-TC-2: no harness claims a mode was tried', { skip: 'red-test-TC-2: no harness says so today, so this holds only against a claim the code round might add; see the fooling checks' }, () => {
  for (const [file, text] of generatedHarnesses()) {
    const section = permissionsOf(text) ?? ''
    const flat = section.replace(/\s+/g, ' ')
    // The three words before the claim must hold the negator: "no mode has been tried" is no claim, "auto mode was tried" is one.
    for (const m of flat.matchAll(/((?:\w+\s+){0,3})(?:was|were|has been|have been|had been)\s+(?:tried|tested|verified|confirmed)\b/gi)) {
      assert.match(m[1], /\b(no|not|never)\b/i, `${file}: claims a mode was tried: ${m[0]}`)
    }
  }
})

test('red-test-TC-1: a target\'s permissions field names no settings file or rule: a mode name with its docs, or absent', { skip: 'red-test-TC-1: every target\'s permissions field names a settings file' }, () => {
  for (const t of TARGETS) {
    if (t.permissions === undefined) continue
    assert.doesNotMatch(t.permissions, RULE_PLACE, t.id)
    assert.doesNotMatch(t.permissions, RULE_TALK, t.id)
    assert.match(t.permissions, /https?:\/\//, `${t.id}: a mode name is cited from the agent's docs, or the field is removed`)
  }
})

test('red-test-TC-1: scripts/targets.mjs has no line telling an agent to write a rule', { skip: 'red-test-TC-1: the template and the permissions fields still say allow-list and Say before the yes' }, () => {
  const lines = readFileSync(join(ROOT, 'scripts', 'targets.mjs'), 'utf8').split('\n')
  const hits = lines.map((l, i) => [i + 1, l]).filter(([, l]) => RULE_TALK.test(l))
  assert.deepEqual(hits, [])
})

// The generator's own check, on a copy, so a hand edit to targets/ is shown to fail without touching this tree.
test('build-targets --check fails on a hand edit of a generated harness, and names the file', () => {
  const copy = mkdtempSync(join(tmpdir(), 'leeway-handedit-'))
  try {
    for (const d of ['scripts', 'plugin', 'targets', 'agent-setup']) cpSync(join(ROOT, d), join(copy, d), { recursive: true })
    const script = join(copy, 'scripts', 'build-targets.mjs')
    const run = (...a) => spawnSync(process.execPath, [script, ...a], { cwd: copy, encoding: 'utf8' })
    assert.equal(run().status, 0, 'the copy builds')
    assert.equal(run('--check').status, 0, 'a fresh build checks clean')
    const file = join(copy, 'targets', 'agents', 'skills', 'sdlc-install', 'kit', 'harness', 'cursor.md')
    writeFileSync(file, readFileSync(file, 'utf8') + '\nhand edit\n')
    const r = run('--check')
    assert.equal(r.status, 1)
    assert.match(r.stderr, /harness\/cursor\.md/)
  } finally {
    rmSync(copy, { recursive: true, force: true })
  }
})
