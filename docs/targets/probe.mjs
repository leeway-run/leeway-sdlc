// Phase 0 probe: log what an agent's hook receives, and never block.
//
//   node probe.mjs <agent> <event>     (wired as a hook; see README.md in this directory)
//
// Appends one JSON line per call to `.sdlc-probe/<agent>.jsonl` under the hook's working directory:
// the event name given on the command line, the payload exactly as received on stdin, the cwd, and
// the NAMES of environment variables that look agent-provided (never their values, except a short
// allowlist of hook-metadata variables that carry no secret). Always exits 0 and prints nothing, so
// it cannot change what the agent does. No dependencies.

import { appendFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const [agent = 'unknown', event = 'unknown'] = process.argv.slice(2)

const ENV_NAME = /^(CODEX|COPILOT|GITHUB_COPILOT|GEMINI|CURSOR|GROK|OPENCODE|CLAUDE)_/
// Hook metadata only; never a key, token or URL with credentials.
const ENV_VALUE_ALLOW = new Set([
  'GROK_HOOK_EVENT',
  'GROK_HOOK_NAME',
  'GROK_SESSION_ID',
  'GROK_WORKSPACE_ROOT',
  'CODEX_HOOK_EVENT',
  'GEMINI_PROJECT_DIR',
  'CURSOR_PROJECT_DIR',
])

const chunks = []
for await (const chunk of process.stdin) chunks.push(chunk)
const raw = Buffer.concat(chunks).toString('utf8')
let payload
try {
  payload = JSON.parse(raw)
} catch {
  payload = { unparsed: raw.slice(0, 4000) }
}

const env = {}
for (const name of Object.keys(process.env).filter((n) => ENV_NAME.test(n)).sort()) {
  env[name] = ENV_VALUE_ALLOW.has(name) ? process.env[name] : '(set)'
}

try {
  const dir = join(process.cwd(), '.sdlc-probe')
  mkdirSync(dir, { recursive: true })
  appendFileSync(
    join(dir, `${agent}.jsonl`),
    JSON.stringify({ at: new Date().toISOString(), agent, event, cwd: process.cwd(), argv: process.argv.slice(2), env, payload }) + '\n',
  )
} catch {
  // a probe never fails the call
}
process.exit(0)
