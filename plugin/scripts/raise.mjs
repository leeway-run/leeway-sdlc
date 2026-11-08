#!/usr/bin/env node
// Raises one escalation from a file of its fields, so no text of it passes through a shell.
//
//   node raise.mjs --server <url> --as <alias>/<role> <ref> <fields file> -- <cli command...>
//
//   <ref>                  the issue the escalation goes on
//   <fields file>          one JSON object: "type", "question", "context", "options" and "meanwhile", and where the asker
//                          has them "tradeoff", "advice" and "comment" (the cN it is tied to). Every value is a string but
//                          "options", an array of {"label","argument"[,"suggested":true]}. Any other key is refused.
//   <cli command...>       how to run the CLI, for example `leeway` or `node /path/leeway.js`
//
// It runs `<cli> --server <url> --json escalation raise <ref> --as <alias>/<role> --type=… --question=… …` once, each
// field one argument of its own and none through a shell, so a backtick, a `$`, an apostrophe or a newline in a field
// reaches Leeway as written. `--name=value` keeps a value that starts with a dash a value.
//
// Exit codes: the CLI's own, with its stdout (the raised escalation as JSON) and its stderr passed through unchanged;
// or 2 before anything is sent, with a line on stderr, for a wrong call or a fields file that is unreadable, not JSON,
// missing a field or holding one it does not know.
//
// No dependencies. It writes nothing itself: its one write is the raise the CLI makes.

import { spawn } from 'node:child_process'
import { readFileSync, realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const USAGE = 2
const REQUIRED = ['type', 'question', 'context', 'options', 'meanwhile']
const OPTIONAL = ['tradeoff', 'advice', 'comment']
// The order the flags go in, fixed so a log of two raises reads the same.
const ORDER = ['type', 'question', 'context', 'tradeoff', 'advice', 'options', 'meanwhile', 'comment']

const refuse = (msg) => {
  process.stderr.write(`raise: ${msg}\nusage: node raise.mjs --server <url> --as <alias>/<role> <ref> <fields file> -- <cli...>\nnothing was raised\n`)
  process.exit(USAGE)
}

export const parse = (argv) => {
  const dash = argv.indexOf('--')
  if (dash === -1 || dash === argv.length - 1) refuse('no CLI command after --')
  const cli = argv.slice(dash + 1)
  const words = argv.slice(0, dash)
  const positional = []
  let server
  let as
  for (let i = 0; i < words.length; i++) {
    const w = words[i]
    if (w === '--server') server = words[++i]
    else if (w === '--as') as = words[++i]
    else if (w.startsWith('--')) refuse(`unknown option ${w}`)
    else positional.push(w)
  }
  if (!server) refuse('--server is required')
  if (!as) refuse('--as <alias>/<role> is required')
  if (positional.length !== 2) refuse('give the ref and the fields file')
  return { server, as, ref: positional[0], file: positional[1], cli }
}

// The fields file, checked for shape only: what Leeway accepts (lengths, a context that is only a reference) is the server's to say.
export const fields = (text, file = 'the fields file') => {
  let f
  try {
    f = JSON.parse(text)
  } catch (e) {
    refuse(`${file} is not JSON: ${e.message}`)
  }
  if (!f || typeof f !== 'object' || Array.isArray(f)) refuse(`${file} is not one JSON object`)
  for (const k of Object.keys(f)) if (!ORDER.includes(k)) refuse(`${file} has a field raise does not know: "${k}"`)
  for (const k of REQUIRED) if (!(k in f)) refuse(`${file} has no "${k}"`)
  for (const k of [...REQUIRED, ...OPTIONAL]) {
    if (!(k in f)) continue
    if (k === 'options' ? !Array.isArray(f[k]) : typeof f[k] !== 'string') refuse(`"${k}" in ${file} must be ${k === 'options' ? 'an array' : 'a string'}`)
  }
  return f
}

export const argsFor = (o, f) => [
  ...o.cli.slice(1),
  '--server',
  o.server,
  '--json',
  'escalation',
  'raise',
  o.ref,
  '--as',
  o.as,
  ...ORDER.filter((k) => k in f).map((k) => `--${k}=${k === 'options' ? JSON.stringify(f[k]) : f[k]}`),
]

// Run only as a script, so a test can import the parts without raising anything.
if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  const o = parse(process.argv.slice(2))
  let text
  try {
    text = readFileSync(o.file, 'utf8')
  } catch (e) {
    refuse(`cannot read ${o.file}: ${e.message}`)
  }
  const child = spawn(o.cli[0], argsFor(o, fields(text, o.file)), { stdio: ['ignore', 'inherit', 'inherit'] })
  child.on('error', (e) => refuse(`cannot run ${o.cli[0]}: ${e.message}`))
  child.on('close', (code) => process.exit(code ?? 1))
}
