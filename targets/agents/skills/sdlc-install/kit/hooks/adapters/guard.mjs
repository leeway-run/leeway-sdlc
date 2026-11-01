// The git and Leeway guards for agents other than Claude Code: `node guard.mjs <agent> [--governed]`.
//
// Claude Code runs git-guard.mjs and leeway-guard.mjs directly. Every other agent runs this file, which
// reads that agent's pre-command hook payload, decides whether the caller is governed, and asks the
// same two cores (`judge` in ../git-guard.mjs and ../leeway-guard.mjs) for the verdict. The judging
// is never duplicated here: a fix to a core reaches every agent.
//
// <agent> is one of codex, copilot, gemini, cursor, grok, opencode. It names the payload's origin in
// messages and selects nothing else today; the shapes below are all tried, because two agents in the
// list read each other's formats (Grok reads Claude and Cursor hooks, Copilot reads Claude's).
//
// WHO IS GOVERNED. The orchestrator must stay free to commit, merge and write to Leeway, so a call
// is judged only when it can be attributed to one of this plugin's agents. Three rules, any of which
// governs the call:
//   a. Identity in the payload: an agent field naming `leeway-sdlc:<agent>` or `sdlc-<agent>`.
//      Which field each agent sends is UNVERIFIED until docs/targets/<agent>.md records the spike.
//   b. `--governed` on the command line: the hook is declared on the agent definition itself
//      (Copilot's *.agent.md `hooks:`), so every call it sees is the subagent's.
//   c. A live marker in `.sdlc/.governed/` of the cwd or any ancestor, written by the orchestrator
//      with adapters/governed.mjs before it delegates and removed when the subagent returns. The
//      orchestrator waits while a subagent works, so judging every call in that window is the
//      subagent's. While a marker is live, a shell command that names `.sdlc/.governed` is blocked, so
//      the subagent cannot simply delete it. `governed.mjs off` stays allowed: the orchestrator needs it
//      while the marker is live. So rule c stops a subagent that slips, not one set on getting past
//      it; the same is true of every rule here (PROCESS.md, "The cast": the hook is not a vault).
//
// Contract: JSON on stdin; exit 0 allows; exit 2 blocks with the reason on stderr. Exit 2 is the deny
// every target documents (Codex, Copilot, Gemini, Cursor and Grok all treat it as a block), and it
// fails closed if an agent misreads structured output, which a JSON deny on exit 0 would not.
// Unreadable input allows, as in the Claude hooks. No dependencies.
// Tests: `node --test plugin/hooks/adapters/guard.test.mjs`.

import { readdirSync, readFileSync, realpathSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { judge as judgeGit } from '../git-guard.mjs'
import { judge as judgeLeeway } from '../leeway-guard.mjs'

export const AGENTS = new Set(['codex', 'copilot', 'gemini', 'cursor', 'grok', 'opencode'])

const GOVERNED_NAME = /^(?:leeway-sdlc:)?sdlc-(?:implementer|reviewer|divergence-reviewer)$/
// Fields an agent might use to say which agent made the call. Narrowed per agent after the spikes.
const IDENTITY_FIELDS = ['agent_type', 'agentType', 'agent_name', 'agentName', 'subagent_type', 'subagentType', 'agent']

const read = async () => {
  const chunks = []
  for await (const chunk of process.stdin) chunks.push(chunk)
  return Buffer.concat(chunks).toString('utf8')
}

// An argv array (Codex can send one) as a command line the cores can lex.
const argvToCommand = (argv) =>
  argv.map((a) => (typeof a === 'string' && /^[\w@%+=:,./-]+$/.test(a) ? a : `'${String(a).replace(/'/g, `'\\''`)}'`)).join(' ')

const asCommand = (value) => {
  if (typeof value === 'string') return value
  if (Array.isArray(value) && value.length > 0) return argvToCommand(value)
  return null
}

const parseMaybeJson = (value) => {
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

// The shell command in a payload, from any of the shapes the targets send, or null.
//   Claude, Codex, Gemini:  tool_input.command       (Gemini's tool is run_shell_command)
//   Copilot CLI:            toolArgs.command          (toolArgs may arrive as a JSON string)
//   Grok Build:             toolInput.command
//   Cursor:                 command                   (beforeShellExecution)
//   OpenCode plugin:        args.command              (passed by plugins/opencode.js)
export const commandOf = (payload) => {
  if (!payload || typeof payload !== 'object') return null
  const candidates = [
    payload.tool_input?.command,
    parseMaybeJson(payload.toolArgs)?.command,
    payload.toolInput?.command,
    payload.args?.command,
    payload.command,
  ]
  for (const c of candidates) {
    const command = asCommand(c)
    if (command !== null) return command
  }
  return null
}

const identityGoverned = (payload) =>
  IDENTITY_FIELDS.some((field) => {
    const value = payload?.[field]
    const name = typeof value === 'string' ? value : typeof value?.name === 'string' ? value.name : null
    return name !== null && GOVERNED_NAME.test(name)
  })

// Live markers in `.sdlc/.governed/` of `dir` and every ancestor. A marker is JSON `{until}` (epoch
// ms); an expired or unreadable marker is not live, so a crashed run cannot lock the orchestrator out.
export const liveMarkers = (dir, now = Date.now()) => {
  const found = []
  let current = resolve(dir)
  for (;;) {
    const markers = join(current, '.sdlc', '.governed')
    let names = []
    try {
      if (statSync(markers).isDirectory()) names = readdirSync(markers)
    } catch {
      names = []
    }
    for (const name of names) {
      try {
        const { until } = JSON.parse(readFileSync(join(markers, name), 'utf8'))
        if (typeof until === 'number' && until > now) found.push(join(markers, name))
      } catch {
        // not a marker
      }
    }
    const parent = dirname(current)
    if (parent === current) return found
    current = parent
  }
}

const TAMPER = /\.sdlc[\\/]+\.governed/

// The verdict for one payload: { block: false } or { block: true, message }.
export const decide = (payload, { governedFlag = false, cwd = process.cwd(), now = Date.now() } = {}) => {
  const command = commandOf(payload)
  if (command === null) return { block: false }
  const markerDir = typeof payload?.cwd === 'string' ? payload.cwd : typeof payload?.workspaceRoot === 'string' ? payload.workspaceRoot : cwd
  const markers = governedFlag || identityGoverned(payload) ? [] : liveMarkers(markerDir, now)
  const governed = governedFlag || identityGoverned(payload) || markers.length > 0
  if (!governed) return { block: false }
  if (markers.length > 0 && TAMPER.test(command)) {
    return {
      block: true,
      message:
        'Blocked: the governed-agent marker belongs to the orchestrator, which removes it when you return.\n' +
        'Finish the task and return your brief.',
    }
  }
  for (const judge of [judgeGit, judgeLeeway]) {
    const verdict = judge(command)
    if (verdict.block) return verdict
  }
  return { block: false }
}

const main = async () => {
  const [agent, ...flags] = process.argv.slice(2)
  if (!AGENTS.has(agent)) {
    console.error(`guard.mjs: unknown agent ${JSON.stringify(agent)}; expected one of ${[...AGENTS].join(', ')}`)
    process.exit(0) // A wiring mistake must not block every command the orchestrator runs.
  }
  let payload
  try {
    payload = JSON.parse(await read())
  } catch {
    process.exit(0)
  }
  const verdict = decide(payload, { governedFlag: flags.includes('--governed') })
  if (verdict.block) {
    console.error(verdict.message)
    process.exit(2)
  }
  process.exit(0)
}

const isMain = () => {
  try {
    return import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href
  } catch {
    return false
  }
}
if (isMain()) main()
