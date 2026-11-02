#!/usr/bin/env node
// Waits for the answer to one escalation, reading Leeway through the CLI and never writing to it.
//
//   node wait-answer.mjs --server <url> <ref> <eN> [options] -- <cli command...>
//
//   <eN>                   the escalation's number on <ref>: e3 or 3
//   <cli command...>       how to run the CLI, for example `leeway` or `node /path/leeway.js`
//   --first <s>            seconds before the first check (default 60); each gap after it doubles
//   --cap <s>              the longest gap between checks (default 900)
//   --deadline <s>         give up this long after the script started (default 57600, 16 hours)
//   --call-timeout <s>     the longest one `issue get` may take (default 60)
//   --max-failures <n>     give up after this many failed checks in a row (default 4)
//
// Each check runs `<cli> --server <url> --json issue get <ref>` and reads `escalations[]`, the entry whose `number` is N.
// Only its `answer` ends the wait; a comment, a status change or another escalation's answer does not.
//
// Exit codes, with a line on stderr for every one but 0:
//   0  answered: prints {"label","note","by"} as JSON on stdout
//   1  usage, or <ref> has no escalation eN
//   2  gave up: no answer by the deadline
//   3  Leeway unreachable: the last <max-failures> checks failed
//   4  unauthorised: the last <max-failures> checks failed and the CLI asked for `leeway login`
//
// No dependencies.

import { spawn } from 'node:child_process'
import { realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const EXIT = { answered: 0, usage: 1, gaveUp: 2, unreachable: 3, unauthorised: 4 }

const usage = (msg) => {
  process.stderr.write(`wait-answer: ${msg}\nusage: node wait-answer.mjs --server <url> <ref> <eN> [--first s] [--cap s] [--deadline s] [--call-timeout s] [--max-failures n] -- <cli...>\n`)
  process.exit(EXIT.usage)
}

export const parse = (argv) => {
  const dash = argv.indexOf('--')
  if (dash === -1 || dash === argv.length - 1) usage('no CLI command after --')
  const cli = argv.slice(dash + 1)
  const opts = { first: 60, cap: 900, deadline: 57600, callTimeout: 60, maxFailures: 4 }
  const names = { '--first': 'first', '--cap': 'cap', '--deadline': 'deadline', '--call-timeout': 'callTimeout', '--max-failures': 'maxFailures' }
  const positional = []
  let server
  const words = argv.slice(0, dash)
  for (let i = 0; i < words.length; i++) {
    const w = words[i]
    if (w === '--server') server = words[++i]
    else if (w in names) {
      const n = Number(words[++i])
      if (!(n > 0)) usage(`${w} needs a positive number`)
      opts[names[w]] = n
    } else if (w.startsWith('--')) usage(`unknown option ${w}`)
    else positional.push(w)
  }
  if (!server) usage('--server is required')
  if (positional.length !== 2) usage('give the ref and the escalation number')
  const m = /^e?(\d+)$/i.exec(positional[1])
  if (!m) usage(`not an escalation number: ${positional[1]}`)
  return { ...opts, server, ref: positional[0], number: Number(m[1]), cli }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// One read. Resolves { issue } or { failure: 'unreachable' | 'unauthorised', detail }.
const check = (o) =>
  new Promise((resolve) => {
    const child = spawn(o.cli[0], [...o.cli.slice(1), '--server', o.server, '--json', 'issue', 'get', o.ref], {
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let out = ''
    let err = ''
    let done = false
    const finish = (r) => {
      if (done) return
      done = true
      clearTimeout(timer)
      resolve(r)
    }
    // Our own timer, not spawn's `timeout`: a wrapper's grandchild can hold the pipes open, and `close` waits for them.
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      child.stdout.destroy()
      child.stderr.destroy()
      finish({ failure: 'unreachable', detail: `issue get took longer than ${o.callTimeout}s` })
    }, o.callTimeout * 1000)
    child.stdout.on('data', (d) => (out += d))
    child.stderr.on('data', (d) => (err += d))
    child.on('error', (e) => finish({ failure: 'unreachable', detail: e.message }))
    child.on('close', (code) => {
      const detail = err.trim() || out.trim()
      // The CLI ends both "not logged in" and "did not accept the saved token" with "Run: leeway login --server <url>".
      if (code !== 0) return finish({ failure: /leeway login/.test(err) ? 'unauthorised' : 'unreachable', detail })
      let issue
      try {
        issue = JSON.parse(out)
      } catch {}
      if (!Array.isArray(issue?.escalations)) return finish({ failure: 'unreachable', detail: 'issue get did not print one JSON document with an escalations array' })
      finish({ issue })
    })
  })

const wait = async (o) => {
  const start = Date.now()
  const deadline = start + o.deadline * 1000
  let gap = o.first * 1000
  let failures = 0
  for (;;) {
    const last = Date.now() + gap >= deadline
    await sleep(Math.max(0, Math.min(gap, deadline - Date.now())))
    const r = await check(o)
    if (r.failure) {
      if (++failures >= o.maxFailures) {
        const login = r.failure === 'unauthorised' ? `; the login has expired or is missing, run: leeway login --server ${o.server}` : ''
        return { code: EXIT[r.failure], message: `${failures} checks in a row failed${login}\n${r.detail}` }
      }
    } else {
      failures = 0
      const esc = r.issue.escalations.find((e) => e.number === o.number)
      if (!esc) return { code: EXIT.usage, message: `${o.ref} has no escalation e${o.number}` }
      if (esc.answer) return { code: EXIT.answered, answer: { label: esc.answer.label, note: esc.answer.note, by: esc.answer.by } }
    }
    if (last) return { code: EXIT.gaveUp, message: `no answer to ${o.ref} e${o.number} by ${new Date(deadline).toISOString()}` }
    gap = Math.min(gap * 2, o.cap * 1000)
  }
}

// Run only as a script, so a test can import `parse` without starting a wait.
if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  const result = await wait(parse(process.argv.slice(2)))
  if (result.answer) process.stdout.write(JSON.stringify(result.answer) + '\n')
  else process.stderr.write(`wait-answer: ${result.message}\n`)
  process.exit(result.code)
}
