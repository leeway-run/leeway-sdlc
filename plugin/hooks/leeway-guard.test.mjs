// Tests for leeway-guard.mjs. Run from the repo root: `node --test plugin/hooks/leeway-guard.test.mjs`.
// Each case spawns the hook as Claude Code does -- a PreToolUse payload as JSON on stdin -- and
// asserts on the exit code: 0 allows, 2 blocks.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const GUARD = fileURLToPath(new URL('./leeway-guard.mjs', import.meta.url))
const IMPLEMENTER = 'leeway-sdlc:sdlc-implementer'
const REVIEWER = 'leeway-sdlc:sdlc-reviewer'

const run = (stdin) => spawnSync(process.execPath, [GUARD], { input: stdin, encoding: 'utf8' })

// Pass `null` as agentType to omit the field entirely, as the orchestrator's own calls do.
const payload = (command, agentType = IMPLEMENTER) =>
  JSON.stringify({
    session_id: 'test',
    hook_event_name: 'PreToolUse',
    tool_name: 'Bash',
    tool_input: { command },
    ...(agentType === null ? {} : { agent_type: agentType }),
  })

const expectExit = (command, code, agentType) => {
  const result = run(payload(command, agentType))
  assert.equal(result.status, code, `${JSON.stringify(command)} -> exit ${result.status}; stderr: ${result.stderr}`)
  return result
}

test('a governed implementer cannot comment', () => {
  const result = expectExit('leeway comment add LWY-1 --stdin body', 2)
  assert.match(result.stderr, /only writer/)
  assert.match(result.stderr, /get\|list/)
})

test('a governed reviewer cannot record an iteration, through node and the bundle path', () => {
  expectExit('node apps/cli/dist/leeway.js iteration record LWY-1.1 abc', 2, REVIEWER)
  expectExit('node /c/Users/nick/Development/leeway/apps/cli/dist/leeway.js iteration record LWY-1.1 abc', 2, REVIEWER)
})

test('the other writes are blocked', () => {
  for (const command of [
    'leeway issue update LWY-1 --status done',
    'leeway issue create --title x',
    'leeway escalation raise LWY-1 q',
    'leeway escalation answer 3 a',
    'leeway pr link LWY-1.1 http://x',
    'leeway dependency add LWY-1 LWY-2',
    'leeway process update --stdin',
    'leeway login',
    'leeway logout',
    'leeway --as nick comment add LWY-1 x',
  ]) expectExit(command, 2)
})

test('wrappers do not hide a write', () => {
  for (const command of [
    'cd x && leeway comment add LWY-1 x',
    'echo hi; leeway issue delete LWY-1 --yes',
    'cat body | leeway comment add LWY-1 --stdin',
    'bash -lc "leeway comment add LWY-1 x"',
    'sh -c \'node apps/cli/dist/leeway.js issue update LWY-1\'',
    'env FOO=1 leeway comment add LWY-1 x',
    'command leeway comment add LWY-1 x',
    'echo $(leeway comment add LWY-1 x)',
    'echo "$(leeway comment add LWY-1 x)"',
    'echo LWY-1 | xargs -n1 leeway issue delete',
  ]) expectExit(command, 2)
})

test('a governed agent may read', () => {
  for (const command of [
    'leeway --json issue get LWY-1',
    'leeway review get LWY-1.1',
    'leeway whoami',
    'leeway issue update --help',
    'leeway issue list',
    'leeway escalation list LWY',
    'leeway help',
    'leeway version',
    'leeway --version',
    'leeway --as nick issue get LWY-1',
    'node apps/cli/dist/leeway.js process get',
  ]) expectExit(command, 0)
})

test('the orchestrator (no agent_type) may write', () => {
  expectExit('leeway comment add LWY-1 --stdin body', 0, null)
})

test('another plugin\'s agent is not governed', () => {
  expectExit('leeway comment add LWY-1 --stdin body', 0, ['ai', 'sdlc:sdlc-implementer'].join('-'))
})

test('a string argument that mentions leeway is not a call', () => {
  expectExit('echo "leeway comment add"', 0)
  expectExit('git add plugin/hooks/leeway-guard.mjs', 0)
})

test('unparsable stdin and a missing command allow', () => {
  assert.equal(run('not json').status, 0)
  assert.equal(run(JSON.stringify({ agent_type: IMPLEMENTER, tool_input: {} })).status, 0)
})

test('a 10 KiB command is judged quickly and correctly', () => {
  const filler = 'x'.repeat(10 * 1024)
  for (const [command, code] of [
    [`echo ${filler} && leeway issue get X`, 0],
    [`echo ${filler} && leeway comment add X y`, 2],
    [`echo "${filler}" && leeway comment add X y`, 2],
    [`echo '${'('.repeat(10 * 1024)}' && leeway issue get X`, 0],
  ]) {
    const started = Date.now()
    expectExit(command, code)
    assert.ok(Date.now() - started < 1000, 'took over a second')
  }
})

test('an eval chain is bounded: judged fast, and blocked rather than allowed past the limit', () => {
  const chain = (n) => Array(n).fill('eval').join(' ')
  for (const [command, code] of [
    [`${chain(30)} leeway issue get X`, 2],
    [`${chain(30)} leeway comment add X y`, 2],
    [`${chain(3)} leeway comment add X y`, 2],
    [`${chain(3)} leeway issue get X`, 0],
    [`${chain(Math.floor((10 * 1024) / 5))} leeway comment add X y`, 2],
  ]) {
    const started = Date.now()
    expectExit(command, code)
    assert.ok(Date.now() - started < 1000, `took over a second: ${command.length} bytes`)
  }
})

test('the npx package form is the CLI', () => {
  expectExit('npx @leeway-run/cli comment add LWY-1 --stdin body', 2)
  expectExit('npx -y @leeway-run/cli@1.2.3 comment add LWY-1', 2)
  expectExit('npx @leeway-run/cli issue get LWY-1', 0)
  expectExit('npm install -g @leeway-run/cli', 0)
  expectExit('npx @leeway/cli comment add LWY-1 --stdin body', 2)
  expectExit('npx -y @leeway/cli@1.2.3 comment add LWY-1', 2)
  expectExit('npx @leeway/cli issue get LWY-1', 0)
  expectExit('npx @leeway/cli --help', 0)
  expectExit('npm install -g @leeway/cli', 0)
  expectExit('npx @leeway/cli comment add LWY-1', 0, null)
})

test('quoting and extension forms are the CLI', () => {
  expectExit("$'leeway' comment add LWY-1 body", 2)
  expectExit('$"leeway" comment add LWY-1 body', 2)
  expectExit("$'leeway' issue get LWY-1", 0)
  expectExit('leeway.cmd comment add LWY-1 body', 2)
  expectExit(String.raw`"C:\tools\leeway.ps1" comment add LWY-1 body`, 2)
  expectExit('leeway.cmd issue get LWY-1', 0)
})

test('a shell reading its script from stdin is a wrapper', () => {
  expectExit('echo "leeway comment add LWY-1 body" | sh', 2)
  expectExit('echo "leeway comment add LWY-1 body" | bash -s', 2)
  expectExit('bash <<< "leeway comment add LWY-1 body"', 2)
  expectExit('echo "leeway issue get LWY-1" | sh', 0)
  expectExit('echo "leeway comment add LWY-1 body" | sh', 0, null)
})

test('xargs feeding leeway: judged by what the command names, unknown is blocked', () => {
  expectExit('echo comment add | xargs leeway', 2)
  expectExit('echo LWY-1 | xargs leeway issue', 2)
  expectExit('echo LWY-1 | xargs -n1 leeway comment add', 2)
  expectExit('echo LWY-1 | xargs -n1 leeway issue get', 0)
  expectExit('echo comment add | xargs leeway', 0, null)
})

test('more nested scripts than the budget allows are blocked, fewer are judged', () => {
  const subs = (n) => `echo "${'$(true)'.repeat(n)}"`
  expectExit(`${subs(250)} && leeway issue get X`, 2)
  expectExit(`${subs(50)} && leeway issue get X`, 0)
  expectExit(`${subs(50)} && leeway comment add X y`, 2)
})
