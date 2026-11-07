// Tests for plugin/scripts/session-tokens.mjs. Run from the repo root: `node --test plugin/test/session-tokens.test.mjs`.
// Fixture transcripts are written to a temp dir, in the shape of Claude Code's: a model call is a `type: "assistant"`
// line with `message.id` and `message.usage`, on as many lines as it has content blocks.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { closeSync, mkdtempSync, openSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync, writeSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT = fileURLToPath(new URL('../scripts/session-tokens.mjs', import.meta.url))
const SECRET = 'transcript-text-that-must-never-be-printed'

// Seconds on a fixed clock: t(10) is 10 s after T0, and iso(10.5) is the time of an entry half a second later.
const T0 = 1_794_000_000
const t = (s) => String(T0 + s)
const iso = (s) => new Date((T0 + s) * 1000).toISOString()

const call = (id, at, { input = 1, write = 10, read = 1000, output = 100, sidechain = false } = {}) => ({
  type: 'assistant',
  isSidechain: sidechain,
  timestamp: iso(at),
  message: {
    id,
    role: 'assistant',
    content: [{ type: 'text', text: SECRET }],
    usage: { input_tokens: input, cache_creation_input_tokens: write, cache_read_input_tokens: read, output_tokens: output },
  },
})
const other = (at) => ({ type: 'user', isSidechain: false, timestamp: iso(at), message: { role: 'user', content: SECRET } })

const run = (lines, args, { raw = false } = {}) => {
  const dir = mkdtempSync(join(tmpdir(), 'session-tokens-'))
  const file = join(dir, 'transcript.jsonl')
  writeFileSync(file, raw ? lines : lines.map((l) => (typeof l === 'string' ? l : JSON.stringify(l))).join('\n') + '\n')
  const before = { bytes: readFileSync(file), mtime: statSync(file).mtimeMs, names: readdirSync(dir) }
  const r = spawnSync(process.execPath, [SCRIPT, ...args(file)], { encoding: 'utf8' })
  assert.deepEqual(readFileSync(file), before.bytes, 'the transcript changed')
  assert.equal(statSync(file).mtimeMs, before.mtime, 'the transcript was written')
  assert.deepEqual(readdirSync(dir), before.names, 'a file was written beside it')
  rmSync(dir, { recursive: true, force: true })
  assert.ok(!r.stdout.includes(SECRET) && !r.stderr.includes(SECRET), 'transcript text was printed')
  return r
}
const subagent = (lines, opts) => run(lines, (f) => ['--subagent', f], opts)
const session = (lines, from = 0, to = 100, opts) => run(lines, (f) => ['--session', f, '--from', t(from), '--to', t(to)], opts)

const counted = (r, n) => {
  assert.equal(r.status, 0, r.stderr)
  assert.equal(r.stdout, `${n}\n`)
}
const refused = (r, code, pattern) => {
  assert.equal(r.status, code)
  assert.equal(r.stdout, '', 'a refusal printed a number')
  assert.match(r.stderr, pattern)
}

test('the unit: input + cache writes + output, summed over the calls; cache reads never count', () => {
  const r = subagent([call('a', 1, { input: 3, write: 50, read: 90_000, output: 7 }), call('b', 2, { input: 2, write: 0, read: 91_000, output: 11 })])
  counted(r, 3 + 50 + 7 + 2 + 11)
  assert.equal(r.stderr, '')
})

test('a call with no cache-write field counts its input and output', () => {
  const c = call('a', 1, { input: 3, output: 7 })
  delete c.message.usage.cache_creation_input_tokens
  counted(subagent([c]), 10)
})

test('a repeated message.id counts once', () => {
  counted(subagent([call('a', 1), call('a', 1.1), call('a', 1.2), call('b', 2)]), 222)
  counted(session([call('a', 1), call('a', 1.1), call('a', 1.2), call('b', 2)]), 222)
})

test('subagent mode counts the whole transcript, whose own entries are all sidechain', () => {
  counted(subagent([other(1), call('a', 1, { sidechain: true }), other(2), call('b', 500_000, { sidechain: true })]), 222)
})

test('session mode leaves out a subagent\'s entries', () => {
  counted(session([call('a', 1), call('sub', 2, { sidechain: true, input: 1_000_000 })]), 111)
})

test('session mode counts only the window, from <= t < to', () => {
  const lines = [call('before', 9.999), call('first', 10), call('inside', 15), call('lastsecond', 19.999), call('at-end', 20), call('after', 30)]
  counted(session(lines, 10, 20), 333)
})

test('two spans that share a second count a call once between them', () => {
  const lines = [call('a', 15), call('b', 20), call('c', 20.5), call('d', 25)]
  counted(session(lines, 10, 20), 111)
  counted(session(lines, 20, 30), 333)
})

test('a window with no calls prints 0 and says so', () => {
  const r = session([call('a', 1), other(50), call('b', 90)], 40, 60)
  counted(r, 0)
  assert.match(r.stderr, /no model calls in the window, so the count is 0/)
  counted(session([call('a', 50)], 50, 50), 0) // an empty window
})

test('a transcript with no calls prints 0 and says so; an empty file is one', () => {
  const r = subagent([other(1)])
  counted(r, 0)
  assert.match(r.stderr, /no model calls in the transcript, so the count is 0/)
  const empty = subagent('', { raw: true })
  counted(empty, 0)
  assert.match(empty.stderr, /no model calls/)
})

test('a line that is not a model call is not one: other types, and an assistant line with no usage', () => {
  const nousage = { type: 'assistant', isSidechain: false, timestamp: iso(1), message: { id: 'x', content: [] } }
  const usageElsewhere = { type: 'progress', isSidechain: false, timestamp: iso(1), message: call('y', 1).message }
  counted(subagent([nousage, usageElsewhere, 'null', '5', call('a', 1)]), 111)
})

test('a missing file exits 2 with no number', () => {
  const r = spawnSync(process.execPath, [SCRIPT, '--subagent', join(tmpdir(), 'session-tokens-no-such-file.jsonl')], { encoding: 'utf8' })
  refused(r, 2, /cannot read the transcript .*ENOENT.*leave --tokens out/)
  const s = spawnSync(process.execPath, [SCRIPT, '--session', join(tmpdir(), 'session-tokens-no-such-file.jsonl'), '--from', '1', '--to', '2'], { encoding: 'utf8' })
  refused(s, 2, /cannot read the transcript/)
})

test('a directory is not a transcript: exit 2, no number', () => {
  const dir = mkdtempSync(join(tmpdir(), 'session-tokens-dir-'))
  refused(spawnSync(process.execPath, [SCRIPT, '--subagent', dir], { encoding: 'utf8' }), 2, /cannot read the transcript .*EISDIR/)
  rmSync(dir, { recursive: true, force: true })
})

test('a malformed line in a subagent transcript withholds the number, and never quotes the line', () => {
  refused(subagent([call('a', 1), `{"type":"assistant","note":"${SECRET}`, call('b', 2)]), 3, /could not be read in .*: 1\. No count: leave --tokens out/)
})

test('a malformed line in the window withholds the number', () => {
  refused(session([call('a', 15), `{"${SECRET}`, call('b', 16)], 10, 20), 3, /could not be read/)
})

test('a malformed line that can fall in the window, by the times around it, withholds the number', () => {
  refused(session([call('a', 5), `{"${SECRET}`, call('b', 15)], 10, 20), 3, /could not be read/) // into the window
  refused(session([call('a', 15), `{"${SECRET}`, call('b', 25)], 10, 20), 3, /could not be read/) // out of it
  refused(session([call('a', 5), `{"${SECRET}`, call('b', 25)], 10, 20), 3, /could not be read/) // across it
  refused(session([call('a', 5), `{"${SECRET}`], 10, 20), 3, /could not be read/) // nothing after it to say
  refused(session([`{"${SECRET}`, call('b', 15)], 10, 20), 3, /could not be read/) // nothing before it to say
})

test('a malformed line clear of the window leaves the count whole', () => {
  counted(session([call('a', 1), `{"${SECRET}`, call('b', 2), call('c', 15)], 10, 20), 111) // before it
  counted(session([call('c', 15), call('b', 25), `{"${SECRET}`, call('d', 26)], 10, 20), 111) // after it
  counted(session([call('c', 15), call('b', 25), `{"${SECRET}`], 10, 20), 111) // a half-written last line, after it
})

test('a call whose fields cannot be read withholds the number', () => {
  const noId = call('a', 15)
  delete noId.message.id
  const badUsage = call('a', 15)
  badUsage.message.usage.output_tokens = '100'
  const fractional = call('a', 15)
  fractional.message.usage.input_tokens = 1.5
  const negative = call('a', 15)
  negative.message.usage.cache_creation_input_tokens = -1
  const noInput = call('a', 15)
  delete noInput.message.usage.input_tokens
  for (const c of [noId, badUsage, fractional, negative, noInput]) {
    refused(subagent([c]), 3, /could not be read/)
    refused(session([c], 10, 20), 3, /could not be read/)
  }
})

test('session mode: a call it cannot place or attribute withholds the number', () => {
  const noFlag = call('a', 15)
  delete noFlag.isSidechain
  const noTime = call('a', 15)
  delete noTime.timestamp
  const badTime = { ...call('a', 15), timestamp: 'not a time' }
  for (const c of [noFlag, noTime, badTime]) refused(session([c], 10, 20), 3, /could not be read/)
  counted(subagent([noFlag, noTime, badTime]), 111) // subagent mode needs neither, and all three are one id
})

test('the arguments: one mode, its options, whole seconds', () => {
  const go = (...args) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' })
  for (const args of [
    [],
    ['--subagent'],
    ['--subagent', 'a', '--session', 'b'],
    ['--subagent', 'a', '--from', '1', '--to', '2'],
    ['--session', 'a'],
    ['--session', 'a', '--from', '1'],
    ['--session', 'a', '--to', '1'],
    ['--session', 'a', '--from', 'x', '--to', '2'],
    ['--session', 'a', '--from', '2026-11-07T00:00:00Z', '--to', '2'],
    ['--session', 'a', '--from', '1.5', '--to', '2'],
    ['--session', 'a', '--from', '3', '--to', '2'],
    ['--session', 'a', '--from', '1', '--to', '2', 'extra'],
    ['--bogus', 'a'],
  ]) {
    refused(go(...args), 1, /usage: node session-tokens\.mjs/)
  }
})

test('it streams: a transcript far larger than the heap it may use is counted', () => {
  const dir = mkdtempSync(join(tmpdir(), 'session-tokens-big-'))
  const file = join(dir, 'big.jsonl')
  const padding = 'x'.repeat(64 * 1024)
  const fd = openSync(file, 'w')
  let expected = 0
  for (let i = 0; i < 1000; i++) {
    const entry = i % 2 ? call(`c${i % 8}`, 50) : other(50)
    if (i % 2 && i < 8) expected += 111 // c1, c3, c5, c7, each repeated through the file
    writeSync(fd, JSON.stringify({ ...entry, padding }) + '\n')
  }
  closeSync(fd)
  assert.ok(statSync(file).size > 60 * 1024 * 1024)
  const r = spawnSync(process.execPath, ['--max-old-space-size=24', SCRIPT, '--session', file, '--from', t(0), '--to', t(100)], { encoding: 'utf8' })
  rmSync(dir, { recursive: true, force: true })
  counted(r, expected)
})
