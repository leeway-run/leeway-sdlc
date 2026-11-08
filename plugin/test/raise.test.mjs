// Tests for plugin/scripts/raise.mjs (LWY-160.4 c2). Run from the repo root: `node --test plugin/test/raise.test.mjs`.
// A fake `leeway` records the argv it was given and answers from a plan, as in wait-answer.test.mjs.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

const SCRIPT = fileURLToPath(new URL('../scripts/raise.mjs', import.meta.url))
const BIN = fileURLToPath(new URL('../bin/leeway-sdlc-raise', import.meta.url))

const FAKE = `
import { appendFileSync, readFileSync } from 'node:fs'
appendFileSync(process.env.FAKE_LOG, JSON.stringify(process.argv.slice(2)) + '\\n')
const r = JSON.parse(readFileSync(process.env.FAKE_PLAN, 'utf8'))
if (r.stdout) process.stdout.write(r.stdout)
if (r.stderr) process.stderr.write(r.stderr)
process.exitCode = r.code ?? 0
`

// Text an agent writes, quoting code: every one of these is something a shell would act on inside double quotes.
const NASTY = "Keep `rulesVersion` in the key; $HOME and $(rm -rf x) stay text, it's SCR-1.2's\nsecond line"
const FIELDS = {
  type: 'blocker',
  question: `- starts with a dash: ${NASTY}`,
  context: `- the guard is missing: ${NASTY}`,
  tradeoff: NASTY,
  advice: NASTY,
  options: [{ label: "Fix `it`", argument: NASTY, suggested: true }, { label: 'Stop', argument: "it's $x" }],
  meanwhile: NASTY,
  comment: 'c4',
}

const run = (fields, { plan = { stdout: '{"escalation":{"escalation":"e3"}}\n' }, args, bin = false } = {}) => {
  const dir = mkdtempSync(join(tmpdir(), 'raise-'))
  try {
    const log = join(dir, 'calls.jsonl')
    writeFileSync(log, '')
    writeFileSync(join(dir, 'plan.json'), JSON.stringify(plan))
    writeFileSync(join(dir, 'fake.mjs'), FAKE)
    writeFileSync(join(dir, 'leeway'), `#!/bin/sh\nexec "${process.execPath}" "${join(dir, 'fake.mjs')}" "$@"\n`)
    chmodSync(join(dir, 'leeway'), 0o755)
    const file = join(dir, 'fields.json')
    writeFileSync(file, typeof fields === 'string' ? fields : JSON.stringify(fields))
    const env = { ...process.env, PATH: `${dir}${delimiter}${process.env.PATH}`, FAKE_LOG: log, FAKE_PLAN: join(dir, 'plan.json') }
    const argv = args ?? ['--server', 'https://x.test', '--as', 'quiet-wren/agent', 'SCR-1', file, '--', 'leeway']
    const r = bin ? spawnSync(BIN, argv, { env, encoding: 'utf8' }) : spawnSync(process.execPath, [SCRIPT, ...argv], { env, encoding: 'utf8' })
    const calls = readFileSync(log, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
    return { ...r, calls }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

// What the CLI does with its argv: the global words, then the command's flags by node's own parseArgs, strict as the CLI's.
const asTheCliReadsIt = (argv) => {
  const at = argv.indexOf('raise')
  const string = { type: 'string' }
  return parseArgs({
    args: argv.slice(at + 2).filter((w, i, all) => w !== '--as' && all[i - 1] !== '--as'),
    options: { type: string, question: string, context: string, tradeoff: string, advice: string, options: string, meanwhile: string, comment: string },
    strict: true,
  }).values
}

test('a field with a backtick, a $, an apostrophe, a newline or a leading dash reaches the CLI as written, in one call', () => {
  const r = run(FIELDS)
  assert.equal(r.status, 0, r.stderr)
  assert.equal(r.calls.length, 1)
  const [argv] = r.calls
  assert.deepEqual(argv.slice(0, 8), ['--server', 'https://x.test', '--json', 'escalation', 'raise', 'SCR-1', '--as', 'quiet-wren/agent'])
  const got = asTheCliReadsIt(argv)
  for (const k of ['type', 'question', 'context', 'tradeoff', 'advice', 'meanwhile', 'comment']) assert.equal(got[k], FIELDS[k], k)
  assert.deepEqual(JSON.parse(got.options), FIELDS.options)
  assert.ok(!argv.includes('--stdin'), 'no field goes by --stdin')
})

test('prints the CLI\'s output and hands back its exit code, a refusal included', () => {
  assert.equal(run(FIELDS).stdout, '{"escalation":{"escalation":"e3"}}\n')
  const refused = run(FIELDS, { plan: { stderr: 'leeway: --context must be text of at most 1,000 characters (invalid_context)\n', code: 1 } })
  assert.equal(refused.status, 1)
  assert.match(refused.stderr, /\(invalid_context\)/)
  const old = run(FIELDS, { plan: { stderr: "Unknown option '--type'\n", code: 2 } })
  assert.equal(old.status, 2)
  assert.match(old.stderr, /Unknown option '--type'/)
})

test('the flags go in a fixed order, and an optional field left out sends no flag', () => {
  const { tradeoff, advice, comment, ...bare } = FIELDS
  const r = run(bare)
  assert.equal(r.status, 0, r.stderr)
  assert.deepEqual(r.calls[0].slice(8).map((a) => a.split('=')[0]), ['--type', '--question', '--context', '--options', '--meanwhile'])
})

test('a fields file it cannot use raises nothing and exits 2', () => {
  const { context, ...noContext } = FIELDS
  for (const [why, fields, says] of [
    ['not JSON', '{"type": "blocker",', /is not JSON/],
    ['an array', '[]', /is not one JSON object/],
    ['a field it does not know', { ...FIELDS, tradoff: 'x' }, /does not know: "tradoff"/],
    ['no context', noContext, /has no "context"/],
    ['options as a string', { ...FIELDS, options: '[]' }, /"options" .* must be an array/],
    ['a number for a text', { ...FIELDS, advice: 3 }, /"advice" .* must be a string/],
  ]) {
    const r = run(fields)
    assert.equal(r.status, 2, why)
    assert.match(r.stderr, says, why)
    assert.match(r.stderr, /nothing was raised/, why)
    assert.equal(r.calls.length, 0, `${why}: the CLI ran`)
  }
})

test('a wrong call raises nothing and exits 2', () => {
  for (const args of [
    ['--as', 'a/agent', 'SCR-1', 'f.json', '--', 'leeway'],
    ['--server', 'https://x.test', 'SCR-1', 'f.json', '--', 'leeway'],
    ['--server', 'https://x.test', '--as', 'a/agent', 'SCR-1', '--', 'leeway'],
    ['--server', 'https://x.test', '--as', 'a/agent', 'SCR-1', 'f.json'],
    ['--server', 'https://x.test', '--as', 'a/agent', '--json', 'SCR-1', 'f.json', '--', 'leeway'],
  ]) {
    const r = run(FIELDS, { args })
    assert.equal(r.status, 2, args.join(' '))
    assert.equal(r.calls.length, 0, args.join(' '))
  }
})

test('the bin wrapper runs it and hands back its exit code', { skip: process.platform === 'win32' }, () => {
  const r = run(FIELDS, { bin: true })
  assert.equal(r.status, 0, r.stderr)
  assert.equal(r.calls.length, 1)
  assert.equal(asTheCliReadsIt(r.calls[0]).advice, NASTY)
})
