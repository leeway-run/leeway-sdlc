#!/usr/bin/env node
// Counts an agent's new tokens from its transcript, reading it line by line and never writing.
//
//   node session-tokens.mjs --subagent <transcript>                      a subagent's own transcript, whole
//   node session-tokens.mjs --session <transcript> --from <ms> --to <ms> the session's own entries in a window
//   node session-tokens.mjs --subagent-id <agent id>                     as --subagent, finding Claude Code's transcript
//   node session-tokens.mjs --this-session --from <ms> --to <ms>         as --session, finding Claude Code's transcript
//
// The last two look under ${CLAUDE_CONFIG_DIR:-$HOME/.claude}/projects/*/ for the session CLAUDE_CODE_SESSION_ID names, so
// the call needs no variable in braces, which Claude Code's permission check will not approve from a rule.
//
//   --from, --to           milliseconds since the epoch, as `node -e 'console.log(Date.now())'` prints them; the
//                          window is from <= t < to
//
// A call belongs to the window holding its earliest line, so two windows that share a boundary never count one call
// twice. Its later lines can be far off, so --session also holds the ids of calls begun in the SLACK_MS before the
// window.
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
//      read, may hold tokens. In --session it matters only if it can fall in the window: a call by its own time, a
//      line that does not parse by the latest time up to the next timed entry, give or take SLACK_MS. Printing the rest
//      would be recorded as a whole count, and Leeway would not mark the total incomplete.
//
// Holds the ids of the window and of the slack before it, never the file. No dependencies.

import { createReadStream, existsSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { createInterface } from 'node:readline'

const EXIT = { counted: 0, usage: 1, unreadable: 2, incomplete: 3 }

// How far a transcript's times can stray. Measured over 12,133 calls: one call's lines span at most 99 s, and a line is
// at most 190 s older than a line above it.
const SLACK_MS = 300_000

const fail = (code, msg) => {
  process.stderr.write(`session-tokens: ${msg}\n`)
  process.exit(code)
}
const usage = (msg) =>
  fail(EXIT.usage, `${msg}\nusage: node session-tokens.mjs --subagent <transcript>\n       node session-tokens.mjs --session <transcript> --from <ms> --to <ms>\n       node session-tokens.mjs --subagent-id <agent id>\n       node session-tokens.mjs --this-session --from <ms> --to <ms>`)

// The one file under some project directory, named after the session: the project directory is where the session started.
const claudeTranscript = (under) => {
  const id = process.env.CLAUDE_CODE_SESSION_ID
  if (!id) fail(EXIT.unreadable, 'CLAUDE_CODE_SESSION_ID is not set, so no transcript can be found. No count: leave --tokens out.')
  const projects = join(process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude'), 'projects')
  const found = (existsSync(projects) ? readdirSync(projects) : []).map((d) => join(projects, d, under(id))).find((p) => existsSync(p))
  if (!found) fail(EXIT.unreadable, `no transcript for this session under ${projects}. No count: leave --tokens out.`)
  return found
}

const parse = (argv) => {
  const o = {}
  for (let i = 0; i < argv.length; i++) {
    const w = argv[i]
    if (w === '--this-session') {
      o['this-session'] = true
      continue
    }
    if (!['--subagent', '--subagent-id', '--session', '--from', '--to'].includes(w)) usage(`unknown argument ${w}`)
    if (argv[i + 1] === undefined) usage(`${w} needs a value`)
    o[w.slice(2)] = argv[++i]
  }
  if (['subagent', 'subagent-id', 'session', 'this-session'].filter((k) => k in o).length !== 1) {
    usage('give one of --subagent, --subagent-id, --session and --this-session')
  }
  if ('subagent' in o || 'subagent-id' in o) {
    if ('from' in o || 'to' in o) usage('--from and --to go with --session or --this-session')
    if ('subagent' in o) return { path: o.subagent }
    if (!/^[\w-]+$/.test(o['subagent-id'])) usage('--subagent-id needs an agent id')
    return { path: null, find: (id) => join(id, 'subagents', `agent-${o['subagent-id']}.jsonl`) }
  }
  for (const k of ['from', 'to']) if (!/^\d{13}$/.test(o[k] ?? '')) usage(`--${k} needs milliseconds since the epoch, as node -e 'console.log(Date.now())' prints them`)
  const window = { from: Number(o.from), to: Number(o.to) }
  if (window.from > window.to) usage('--from is after --to')
  return 'session' in o ? { path: o.session, window } : { path: null, find: (id) => `${id}.jsonl`, window }
}

const whole = (n) => Number.isSafeInteger(n) && n >= 0

// The call's new tokens, or null when its fields cannot be read.
const newTokens = (usage) => {
  const { input_tokens: input, output_tokens: output, cache_creation_input_tokens: written = 0 } = usage
  return whole(input) && whole(output) && whole(written) ? input + written + output : null
}

const count = async ({ path, window }) => {
  const calls = new Map() // id to its new tokens
  const begun = new Set() // ids with a line in the slack before the window: those calls are not this window's
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
      else if (last < window.to + SLACK_MS) undecided++
      continue
    }
    const at = typeof entry?.timestamp === 'string' ? Date.parse(entry.timestamp) : NaN
    if (window && !Number.isNaN(at)) {
      last = Math.max(last, at)
      if (last >= window.from - SLACK_MS) lost += undecided
      undecided = 0
    }
    if (entry?.type !== 'assistant' || !entry.message?.usage) continue
    const id = entry.message.id
    if (window) {
      if (entry.isSidechain === true) continue
      if (!Number.isNaN(at)) {
        if (at >= window.to) continue
        if (at < window.from) {
          if (at >= window.from - SLACK_MS) begun.add(id)
          continue
        }
      }
      // Whose it is, or when it was, cannot be told, so it may be one of ours.
      if (typeof entry.isSidechain !== 'boolean' || Number.isNaN(at)) {
        lost++
        continue
      }
    }
    if (typeof id !== 'string' || !id) {
      lost++
      continue
    }
    if (calls.has(id)) continue
    const tokens = newTokens(entry.message.usage)
    if (tokens === null) {
      lost++
      continue
    }
    calls.set(id, tokens)
  }
  for (const id of begun) calls.delete(id)
  let sum = 0
  for (const tokens of calls.values()) sum += tokens
  return { sum, calls: calls.size, lost: lost + undecided }
}

const options = parse(process.argv.slice(2))
if (options.find) options.path = claudeTranscript(options.find)
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
