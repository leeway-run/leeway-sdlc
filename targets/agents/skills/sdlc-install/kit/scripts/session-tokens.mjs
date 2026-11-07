#!/usr/bin/env node
// Counts an agent's new tokens from its transcript, reading it line by line and never writing.
//
//   node session-tokens.mjs --subagent <transcript>                      a subagent's own transcript, whole
//   node session-tokens.mjs --session <transcript> --from <s> --to <s>   the session's own entries in a window
//
//   --from, --to           whole seconds since the epoch, as `date +%s` prints them; the window is from <= t < to, so
//                          two spans that share a second never count one call twice
//
// A new token is input_tokens + cache_creation_input_tokens + output_tokens, summed over the agent's model calls;
// cache_read_input_tokens is never counted. A model call is a `type: "assistant"` line with `message.usage`. It appears
// on several lines with the same `message.id` and the same usage, so each id counts once. Only --session reads
// `isSidechain`, and leaves out what is true: a subagent's own entries are all true, so --subagent must not filter on it.
//
// stdout holds one whole number or nothing. Transcript text is never printed, on stdout or stderr.
//
// Exit codes, with a line on stderr for every one but a count above 0:
//   0  the count, on stdout. It is 0 only when there were no model calls, and stderr says so.
//   1  usage
//   2  the transcript is missing or cannot be read: no number
//   3  the count would not be complete: no number. A line that does not parse, or a model call whose fields cannot be
//      read, may hold tokens. In --session it matters only if it can fall in the window, judged by the times on either
//      side of it. Printing the rest would be recorded as a whole count, and Leeway would not mark the total incomplete.
//
// Holds the running sum and the ids seen, never the file. No dependencies.

import { createReadStream } from 'node:fs'
import { createInterface } from 'node:readline'

const EXIT = { counted: 0, usage: 1, unreadable: 2, incomplete: 3 }

const fail = (code, msg) => {
  process.stderr.write(`session-tokens: ${msg}\n`)
  process.exit(code)
}
const usage = (msg) =>
  fail(EXIT.usage, `${msg}\nusage: node session-tokens.mjs --subagent <transcript>\n       node session-tokens.mjs --session <transcript> --from <s> --to <s>`)

const parse = (argv) => {
  const o = {}
  for (let i = 0; i < argv.length; i++) {
    const w = argv[i]
    if (!['--subagent', '--session', '--from', '--to'].includes(w)) usage(`unknown argument ${w}`)
    if (argv[i + 1] === undefined) usage(`${w} needs a value`)
    o[w.slice(2)] = argv[++i]
  }
  if (('subagent' in o) === ('session' in o)) usage('give one of --subagent and --session')
  if ('subagent' in o) {
    if ('from' in o || 'to' in o) usage('--from and --to go with --session')
    return { path: o.subagent }
  }
  for (const k of ['from', 'to']) if (!/^\d+$/.test(o[k] ?? '')) usage(`--${k} needs whole seconds since the epoch, as date +%s prints them`)
  const window = { from: Number(o.from) * 1000, to: Number(o.to) * 1000 }
  if (window.from > window.to) usage('--from is after --to')
  return { path: o.session, window }
}

const whole = (n) => Number.isSafeInteger(n) && n >= 0

// The call's new tokens, or null when its fields cannot be read.
const newTokens = (usage) => {
  const { input_tokens: input, output_tokens: output, cache_creation_input_tokens: written = 0 } = usage
  return whole(input) && whole(output) && whole(written) ? input + written + output : null
}

const count = async ({ path, window }) => {
  const seen = new Set()
  let sum = 0
  let lost = 0 // lines or calls that may hold tokens this count does not have
  let undecided = 0 // lines that do not parse, until the next time says whether they are before the window
  let last = -Infinity // the latest time read so far
  const input = createReadStream(path, { encoding: 'utf8' })
  for await (const line of createInterface({ input, crlfDelay: Infinity })) {
    if (!line.trim()) continue
    let entry
    try {
      entry = JSON.parse(line)
    } catch {
      if (!window) lost++
      else if (last < window.to) undecided++
      continue
    }
    const at = typeof entry?.timestamp === 'string' ? Date.parse(entry.timestamp) : NaN
    if (window && !Number.isNaN(at)) {
      if (at >= window.from) lost += undecided
      undecided = 0
      last = Math.max(last, at)
    }
    if (entry?.type !== 'assistant' || !entry.message?.usage) continue
    if (window) {
      if (entry.isSidechain === true) continue
      // Whose it is, or when it was, cannot be told, so it may be one of ours.
      if (typeof entry.isSidechain !== 'boolean' || Number.isNaN(at)) {
        lost++
        continue
      }
      if (at < window.from || at >= window.to) continue
    }
    const id = entry.message.id
    if (typeof id !== 'string' || !id) {
      lost++
      continue
    }
    if (seen.has(id)) continue
    const tokens = newTokens(entry.message.usage)
    if (tokens === null) {
      lost++
      continue
    }
    seen.add(id)
    sum += tokens
  }
  return { sum, calls: seen.size, lost: lost + undecided }
}

const options = parse(process.argv.slice(2))
let result
try {
  result = await count(options)
} catch (e) {
  fail(EXIT.unreadable, `cannot read the transcript ${options.path}: ${e.code ?? 'read error'}. No count: leave --tokens out.`)
}
if (result.lost) {
  fail(EXIT.incomplete, `entries that may hold tokens could not be read in ${options.path}: ${result.lost}. No count: leave --tokens out.`)
}
if (!result.calls) process.stderr.write(`session-tokens: no model calls in ${options.window ? 'the window' : 'the transcript'}, so the count is 0.\n`)
process.stdout.write(`${result.sum}\n`)
