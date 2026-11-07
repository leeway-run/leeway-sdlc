// Tests for plugin/scripts/session-tokens.mjs. Run from the repo root: `node --test plugin/test/session-tokens.test.mjs`.
// Fixture transcripts are written to a temp dir, in the shape of Claude Code's: a model call is a `type: "assistant"`
// line with `message.id` and `message.usage`, on as many lines as it has content blocks.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { constants } from 'node:buffer'
import { closeSync, mkdtempSync, openSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync, writeSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT = fileURLToPath(new URL('../scripts/session-tokens.mjs', import.meta.url))
const SECRET = 'transcript-text-that-must-never-be-printed'

// Seconds on a fixed clock: t(10) is the stamp 10 s after T0, in ms, and iso(10.5) is the time of an entry half a second later.
const T0 = 1_794_000_000
const ms = (s) => Math.round((T0 + s) * 1000)
const t = (s) => String(ms(s))
const iso = (s) => new Date(ms(s)).toISOString()

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

test('two spans that share a boundary count a call once between them', () => {
  const lines = [call('a', 15), call('b', 20), call('c', 20.5), call('d', 25)]
  counted(session(lines, 10, 20), 111)
  counted(session(lines, 20, 30), 333)
})

test('one call with lines either side of a boundary counts once, in the window holding its earliest line', () => {
  const straddles = (lines) => {
    counted(session(lines, 10, 20), 111)
    const later = session(lines, 20, 30)
    counted(later, 0)
    assert.match(later.stderr, /no model calls in the window/)
  }
  straddles([call('a', 19.2), call('a', 20.1)])
  straddles([call('a', 20.1), call('a', 19.2)]) // the file need not be in time order
  // Lines 99 s apart, the longest spread measured, and the later window still leaves the call to the earlier.
  counted(session([call('a', 100), call('a', 199), call('b', 205)], 90, 150), 111)
  counted(session([call('a', 100), call('a', 199), call('b', 205)], 150, 250), 111)
})

test('the end of a span is stamped to the millisecond, so a call in its own second counts', () => {
  const lines = [call('a', 15), call('last', 20.3), call('next', 20.5)]
  counted(session(lines, 10, 20.4), 222)
  counted(session(lines, 20.4, 30), 111)
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
  const s = spawnSync(process.execPath, [SCRIPT, '--session', join(tmpdir(), 'session-tokens-no-such-file.jsonl'), '--from', t(1), '--to', t(2)], { encoding: 'utf8' })
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

test('a malformed line near the window, by neighbours whose times stray, withholds the number', () => {
  refused(session([call('a', 15), `{"${SECRET}`, other(5), call('b', 16)], 10, 20), 3, /could not be read/) // the next time is older than the last
  refused(session([call('a', 1000), `{"${SECRET}`, other(1), call('b', 1001)], 1000, 1010), 3, /could not be read/) // far older, still
  refused(session([call('a', 5), `{"${SECRET}`, call('b', 9), call('c', 15)], 10, 20), 3, /could not be read/) // just before the window
  refused(session([call('c', 15), call('b', 25), `{"${SECRET}`, call('d', 26)], 10, 20), 3, /could not be read/) // just after it
  refused(session([call('c', 15), call('b', 25), `{"${SECRET}`], 10, 20), 3, /could not be read/) // a last line, just after it
})

test('a malformed line clear of the window leaves the count whole', () => {
  counted(session([call('a', 1), `{"${SECRET}`, call('b', 2), call('c', 1000)], 1000, 1010), 111) // well before it
  counted(session([call('c', 15), call('b', 1000), `{"${SECRET}`, call('d', 1001)], 10, 20), 111) // well after it
  counted(session([call('c', 15), call('b', 1000), `{"${SECRET}`], 10, 20), 111) // a half-written last line, well after it
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

test('a call with no flag whose time is clear of the window leaves the count whole', () => {
  const noFlag = (at) => {
    const c = call('old', at)
    delete c.isSidechain
    return c
  }
  counted(session([noFlag(1), call('a', 15)], 10, 20), 111)
  counted(session([call('a', 15), noFlag(25)], 10, 20), 111)
})

test('the arguments: one mode, its options, milliseconds', () => {
  const go = (...args) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' })
  for (const args of [
    [],
    ['--subagent'],
    ['--subagent', 'a', '--session', 'b'],
    ['--subagent', 'a', '--from', t(1), '--to', t(2)],
    ['--session', 'a'],
    ['--session', 'a', '--from', t(1)],
    ['--session', 'a', '--to', t(1)],
    ['--session', 'a', '--from', 'x', '--to', t(2)],
    ['--session', 'a', '--from', '2026-11-07T00:00:00Z', '--to', t(2)],
    ['--session', 'a', '--from', `${t(1)}.5`, '--to', t(2)],
    ['--session', 'a', '--from', String(T0), '--to', String(T0 + 1)], // whole seconds, as date +%s prints them
    ['--session', 'a', '--from', t(3), '--to', t(2)],
    ['--session', 'a', '--from', t(1), '--to', t(2), 'extra'],
    ['--bogus', 'a'],
  ]) {
    refused(go(...args), 1, /usage: node session-tokens\.mjs/)
  }
})

// The file is longer than the longest string V8 can make, so a whole-file read to a string fails however much memory the
// machine has, and the heap cap fails a read that keeps its lines. It is sparse, so it costs no disk: its padding lines
// are NULs, which do not parse, and sit after a time well past the window, so they do not withhold the number.
test('it streams: a transcript longer than any string node can hold is counted', () => {
  const dir = mkdtempSync(join(tmpdir(), 'session-tokens-big-'))
  const file = join(dir, 'big.jsonl')
  const fd = openSync(file, 'w')
  try {
    let at = 0
    const put = (text) => (at += writeSync(fd, text, at))
    put(JSON.stringify(call('a', 50)) + '\n')
    put(JSON.stringify(other(1000)) + '\n')
    const end = constants.MAX_STRING_LENGTH + 64 * 1024 * 1024
    while (at < end) {
      at += 64 * 1024
      put('\n')
    }
    put(JSON.stringify(call('a', 51)) + '\n')
    put(JSON.stringify(call('b', 52)) + '\n') // past the padding, so a read that stops early misses it
    closeSync(fd)
    assert.ok(statSync(file).size > constants.MAX_STRING_LENGTH)
    const r = spawnSync(process.execPath, ['--max-old-space-size=24', SCRIPT, '--session', file, '--from', t(0), '--to', t(100)], { encoding: 'utf8' })
    counted(r, 222)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
