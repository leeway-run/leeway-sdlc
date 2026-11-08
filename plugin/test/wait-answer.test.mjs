// Tests for plugin/scripts/wait-answer.mjs. Run from the repo root: `node --test plugin/test/wait-answer.test.mjs`.
// A fake `leeway` on PATH records every invocation and answers from a plan: one response per call, the last repeating.
// Timings are shrunk through the script's own arguments, in seconds; a test's own arguments come after them and win.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from '../scripts/wait-answer.mjs'

const SCRIPT = fileURLToPath(new URL('../scripts/wait-answer.mjs', import.meta.url))
const WRITE_VERBS = /\b(create|update|add|remove|record|raise|answer|link|unlink|login|logout|delete)\b/

const FAKE = `
import { appendFileSync, readFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
const log = process.env.FAKE_LOG
const plan = JSON.parse(readFileSync(process.env.FAKE_PLAN, 'utf8'))
const n = readFileSync(log, 'utf8').split('\\n').filter(Boolean).length
appendFileSync(log, JSON.stringify({ at: Date.now(), argv: process.argv.slice(2) }) + '\\n')
const r = plan[Math.min(n, plan.length - 1)]
// A grandchild that inherits the pipes, as a wrapper script's child would.
if (r.grandchild) spawn(process.execPath, ['-e', 'setTimeout(() => {}, ' + r.grandchild + ')'], { stdio: 'inherit' })
setTimeout(() => {
  if (r.stdout !== undefined) process.stdout.write(typeof r.stdout === 'string' ? r.stdout : JSON.stringify(r.stdout))
  if (r.stderr) process.stderr.write(r.stderr)
  process.exitCode = r.code ?? 0
}, r.delay ?? 0)
`

const by = { userId: 'u1', userName: 'Nick', actor: null }
const esc = (number, answer = null, clarifications = []) => ({ number, ref: 'LWY-1', question: 'q', options: [], meanwhile: 'm', answer, clarifications })
const answered = (label, note = '') => ({ label, note, by, answeredAt: 1 })
// A question about an escalation as `issue get` gives it, oldest first in `clarifications`: answer is null until it is answered.
const asked = (number, answer = null) => ({ number, question: `question ${number}`, askedAt: 1000 + number, by, answer, answeredAt: answer === null ? null : 2000 + number, answeredBy: answer === null ? null : by })
const issue = (...escalations) => ({ stdout: { issue: { ref: 'LWY-1', status: 'todo' }, comments: [], escalations } })

const run = (plan, args = [], timings = ['--first', '0.05', '--cap', '0.2', '--deadline', '1.5', '--call-timeout', '1']) => {
  const dir = mkdtempSync(join(tmpdir(), 'wait-answer-'))
  const log = join(dir, 'calls.jsonl')
  writeFileSync(log, '')
  writeFileSync(join(dir, 'plan.json'), JSON.stringify(plan))
  writeFileSync(join(dir, 'fake.mjs'), FAKE)
  writeFileSync(join(dir, 'leeway'), `#!/bin/sh\nexec "${process.execPath}" "${join(dir, 'fake.mjs')}" "$@"\n`)
  chmodSync(join(dir, 'leeway'), 0o755)
  const env = { ...process.env, PATH: `${dir}${delimiter}${process.env.PATH}`, FAKE_LOG: log, FAKE_PLAN: join(dir, 'plan.json') }
  const started = Date.now()
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [SCRIPT, '--server', 'https://x.test', 'LWY-1', ...timings, ...args, '--', 'leeway'], { env })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (d) => (stdout += d))
    child.stderr.on('data', (d) => (stderr += d))
    child.on('close', (status) => {
      const calls = readFileSync(log, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
      rmSync(dir, { recursive: true, force: true })
      resolve({ status, stdout, stderr, calls, started, ended: Date.now() })
    })
  })
}

const readOnly = (calls) => {
  assert.ok(calls.length > 0)
  for (const { argv } of calls) {
    assert.deepEqual(argv, ['--server', 'https://x.test', '--json', 'issue', 'get', 'LWY-1'])
    assert.ok(!argv.includes('--as'), argv.join(' '))
    assert.doesNotMatch(argv.join(' '), WRITE_VERBS)
  }
}

test('ends on the answer to its own escalation and prints it', async () => {
  const r = await run([issue(esc(1), esc(2)), issue(esc(1), esc(2, answered('Yes', 'go ahead')))], ['e2'])
  assert.equal(r.status, 0, r.stderr)
  assert.deepEqual(JSON.parse(r.stdout), { label: 'Yes', note: 'go ahead', by })
  assert.equal(r.calls.length, 2)
  readOnly(r.calls)
})

test('accepts the number without the e', async () => {
  const r = await run([issue(esc(3, answered('No')))], ['3'])
  assert.equal(r.status, 0, r.stderr)
  assert.equal(JSON.parse(r.stdout).label, 'No')
})

test('an answer on another escalation, a comment or a status change never ends the wait', async () => {
  const noise = {
    stdout: {
      issue: { ref: 'LWY-1', status: 'done', description: 'answered: yes' },
      comments: [{ body: 'e2: Yes' }],
      escalations: [esc(1, answered('Other')), esc(2), esc(3, answered('Other'))],
    },
  }
  const r = await run([issue(esc(1), esc(2)), noise], ['e2'])
  assert.equal(r.status, 2, `${r.stderr} ${r.stdout}`)
  assert.equal(r.stdout, '')
  assert.ok(r.calls.length >= 3)
  readOnly(r.calls)
})

test('the gaps start at --first, double to --cap, and the deadline ends with the gave-up code', async () => {
  const r = await run([issue(esc(2))], ['e2'], ['--first', '0.1', '--cap', '0.4', '--deadline', '1.6', '--call-timeout', '1'])
  assert.equal(r.status, 2, r.stderr)
  assert.match(r.stderr, /no answer to LWY-1 e2 by /)
  readOnly(r.calls)
  // The first check comes --first after the script starts; that span also holds Node's start-up, so only its floor is pinned.
  assert.ok(r.calls[0].at - r.started >= 100, `first call at ${r.calls[0].at - r.started} ms`)
  const at = r.calls.map((c) => c.at)
  const gaps = at.slice(1).map((t, i) => t - at[i])
  // Planned after the first: 200, 400, 400, 400, then whatever is left before 1600 ms. Each gap also carries a call's spawn time.
  for (const [i, want] of [200, 400, 400].entries()) {
    assert.ok(gaps[i] >= want - 15 && gaps[i] < want + 150, `gap ${i} was ${gaps[i]} ms, want about ${want}: ${gaps}`)
  }
  assert.ok(r.calls.at(-1).at - r.started <= 1600 + 300, `last call at ${r.calls.at(-1).at - r.started} ms`)
  assert.ok(r.ended - r.started < 1600 + 600, `exited at ${r.ended - r.started} ms`)
})

test('the deadline holds even when it falls inside a gap', async () => {
  // Checks at 1 s, then the 2 s gap is cut to end at 1.5 s; without the cut the script would run past 3 s.
  const r = await run([issue(esc(1))], ['e1'], ['--first', '1', '--cap', '10', '--deadline', '1.5', '--call-timeout', '1'])
  assert.equal(r.status, 2, r.stderr)
  assert.equal(r.calls.length, 2)
  assert.ok(r.ended - r.started < 1500 + 400, `exited at ${r.ended - r.started} ms`)
})

test('one transient failure does not end the wait', async () => {
  const r = await run([{ stderr: 'cannot reach https://x.test: fetch failed', code: 1 }, issue(esc(1, answered('Yes')))], ['e1'])
  assert.equal(r.status, 0, r.stderr)
  assert.equal(r.calls.length, 2)
})

test('a good check resets the failure count, so failures that alternate with good checks never give up early', async () => {
  const fail = { stderr: 'cannot reach https://x.test: fetch failed', code: 1 }
  const plan = Array.from({ length: 40 }, (_, i) => (i % 2 ? issue(esc(1)) : fail))
  const r = await run(plan, ['e1', '--max-failures', '2'], ['--first', '0.05', '--cap', '0.05', '--deadline', '0.8', '--call-timeout', '1'])
  assert.equal(r.status, 2, r.stderr)
  assert.ok(r.calls.length >= 4, `${r.calls.length} calls`)
})

test('the defaults are a first check after 60 s, a 900 s cap and a 16 hour deadline', () => {
  const o = parse(['--server', 'https://x.test', 'LWY-1', 'e2', '--', 'node', '/a b/leeway.js'])
  assert.deepEqual(o, { first: 60, cap: 900, deadline: 57600, callTimeout: 60, maxFailures: 4, server: 'https://x.test', ref: 'LWY-1', number: 2, cli: ['node', '/a b/leeway.js'] })
})

test('Leeway unreachable for --max-failures checks in a row exits 3', async () => {
  const r = await run([{ stderr: 'cannot reach https://x.test: fetch failed', code: 1 }], ['e1', '--max-failures', '3'])
  assert.equal(r.status, 3, r.stderr)
  assert.equal(r.calls.length, 3)
  assert.match(r.stderr, /fetch failed/)
})

test('a login that expires mid-wait exits 4 and names leeway login', async () => {
  const expired = { stderr: 'error: https://x.test did not accept the saved token. Run: leeway login --server https://x.test', code: 1 }
  const r = await run([issue(esc(1)), expired], ['e1', '--max-failures', '2'])
  assert.equal(r.status, 4, r.stderr)
  assert.match(r.stderr, /login has expired.*leeway login --server https:\/\/x\.test/)
  readOnly(r.calls)
})

test('a call that hangs is cut at --call-timeout and counts as a failure', async () => {
  const r = await run([{ delay: 5000, stdout: {} }], ['e1', '--max-failures', '2', '--call-timeout', '0.2'])
  assert.equal(r.status, 3, r.stderr)
  assert.match(r.stderr, /longer than 0.2s/)
  assert.ok(r.ended - r.started < 2000)
})

test('a call whose grandchild holds the pipes open is still cut at --call-timeout', async () => {
  const r = await run([{ grandchild: 4000, delay: 5000, stdout: {} }], ['e1', '--max-failures', '1', '--call-timeout', '0.3'])
  assert.equal(r.status, 3, r.stderr)
  assert.match(r.stderr, /longer than 0.3s/)
  assert.ok(r.ended - r.started < 1500, `exited at ${r.ended - r.started} ms`)
})

test('output that is not one JSON document with an escalations array is a failure, not an answer', async () => {
  for (const stdout of ['{"escalations":[]}{"escalations":[]}', 'null', '5', '{"issue":{}}']) {
    const r = await run([{ stdout }], ['e1', '--max-failures', '2'])
    assert.equal(r.status, 3, `${stdout}: ${r.stderr}`)
    assert.match(r.stderr, /one JSON document with an escalations array/)
    assert.equal(r.calls.length, 2)
  }
})

test("a sub-issue's escalation with the same number is not the ref's own", async () => {
  // A parent's list is merged oldest first, so the sub-issue's answered e1 comes before the parent's open e1.
  const sub = { ...esc(1, answered('Sub')), ref: 'LWY-1.1' }
  const r = await run([issue(sub, esc(1)), issue(sub, esc(1)), issue(sub, esc(1, answered('Own')))], ['e1'])
  assert.equal(r.status, 0)
  assert.equal(JSON.parse(r.stdout).label, 'Own')
  assert.equal(r.calls.length, 3)
  const only = await run([issue(sub)], ['e1'])
  assert.equal(only.status, 1)
  assert.match(only.stderr, /no escalation e1/)
})

test('an escalation the issue does not have exits 1 instead of waiting', async () => {
  const r = await run([issue(esc(1))], ['e9'])
  assert.equal(r.status, 1)
  assert.match(r.stderr, /no escalation e9/)
  assert.equal(r.calls.length, 1)
})

test('an open question about its escalation stops the wait with exit 5 and prints it, never a label', async () => {
  const r = await run([issue(esc(1), esc(2)), issue(esc(1), esc(2, null, [asked(1, 'yes'), asked(2), asked(3)]))], ['e2'])
  assert.equal(r.status, 5, r.stderr)
  assert.equal(r.stderr, '')
  const out = JSON.parse(r.stdout)
  assert.deepEqual(out, { clarification: 'q2', question: 'question 2', askedAt: 1002 })
  assert.ok(!('label' in out))
  assert.equal(r.calls.length, 2)
  readOnly(r.calls)
})

test('an answer wins over an open question: an answered escalation exits 0', async () => {
  const r = await run([issue(esc(1, answered('Yes'), [asked(1)]))], ['e1'])
  assert.equal(r.status, 0, r.stderr)
  assert.deepEqual(JSON.parse(r.stdout), { label: 'Yes', note: '', by })
  assert.equal(r.calls.length, 1)
})

test('a question that has an answer does not stop the wait', async () => {
  const r = await run([issue(esc(1, null, [asked(1, 'yes'), asked(2, 'no')]))], ['e1'])
  assert.equal(r.status, 2, `${r.stderr} ${r.stdout}`)
  assert.equal(r.stdout, '')
  assert.ok(r.calls.length >= 3)
})

test("a question on another escalation, or on a sub-issue's escalation with the same number, does not stop the wait", async () => {
  // Merged oldest first, so the sub-issue's e2 and its open question come before the ref's own e2.
  const sub = { ...esc(2, null, [asked(1)]), ref: 'LWY-1.1' }
  const r = await run([issue(esc(1, null, [asked(1)]), sub, esc(2))], ['e2'])
  assert.equal(r.status, 2, `${r.stderr} ${r.stdout}`)
  assert.equal(r.stdout, '')
  assert.ok(r.calls.length >= 3)
  readOnly(r.calls)
})

test('usage errors exit 1 without calling the CLI', async () => {
  for (const args of [['x9'], ['e1', '--first', '0']]) {
    const r = await run([issue(esc(1))], args, [])
    assert.equal(r.status, 1, args.join(' '))
    assert.equal(r.calls.length, 0)
  }
})
