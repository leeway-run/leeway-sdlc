// SubagentStart hook for this plugin's SDLC subagents.
//
// A repo's rules often live in skills (a frontend skill, a repository-patterns skill). The
// implementer and the reviewer have no Skill tool, so a task that says "load the frontend skill"
// is a request nobody can follow, and one review elsewhere found exactly the rules that skill states
// broken in a task that had asked for it. This hook makes the routing a mechanism instead: it reads
// the *Required reading* table from the repo's `.sdlc/CONFIG.md` and injects it into the subagent's
// context at start, so which files a path owes is never left to the orchestrator remembering to
// paste it. Whether the agent then read them is checked by the run-task gate, from the brief's and
// the verdict's *Rules read* section; this hook only delivers the table.
//
// WIRED VIA hooks.json, scoped by matcher there and by `agent_type` here. Measured 2026-10-20 on
// Claude Code 2.1.304 (with the plugin this one derives from): a plugin-level SubagentStart hook
// matched on the full agent type fired with that `agent_type`, and its `additionalContext` appeared
// in the subagent's own transcript. Not re-measured under this plugin's name.
//
// Contract: read the SubagentStart payload as JSON on stdin; print one JSON object with
// `hookSpecificOutput.additionalContext`, or print nothing. Always exit 0: a SubagentStart hook
// cannot block, and a repo without the table must not see an error on every spawn. Node rather than
// a shell script for the same reasons as git-guard.mjs. No dependencies.
// Tests: `node --test plugin/hooks/required-reading.test.mjs`.

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

const GOVERNED_AGENT_PREFIX = 'leeway-sdlc:'
const CONFIG = join('.sdlc', 'CONFIG.md')
const SECTION = /^##\s+Required reading\s*$/

const findConfig = (start) => {
  let dir = resolve(start)
  for (;;) {
    const candidate = join(dir, CONFIG)
    if (existsSync(candidate)) return candidate
    const parent = dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

// The table rows of the *Required reading* section, header and separator included, or [] when the
// section is missing or holds no data row.
const requiredReadingRows = (markdown) => {
  const lines = markdown.split(/\r?\n/)
  const start = lines.findIndex((line) => SECTION.test(line))
  if (start === -1) return []
  const rows = []
  for (const line of lines.slice(start + 1)) {
    if (/^##\s/.test(line)) break
    if (line.trim().startsWith('|')) rows.push(line.trim())
    else if (rows.length > 0 && line.trim() === '') break
  }
  const dataRows = rows.filter((row) => !/^\|[\s|:-]+\|$/.test(row)).slice(1)
  return dataRows.length > 0 ? rows : []
}

const contextFor = (rows) =>
  [
    'Required reading for this repo (from `.sdlc/CONFIG.md`, delivered by the leeway-sdlc SubagentStart hook).',
    'Before you write, review or judge a change under a path that matches a glob below, open each listed',
    'file with the Read tool (not cat, not grep) and apply it. List every one you read under *Rules read*',
    'in your brief or verdict, with the heading you applied. The run-task gate compares that list with the',
    'changed paths: a matching file missing from it sends your brief or verdict back.',
    '',
    ...rows,
  ].join('\n')

const main = () => {
  let payload
  try {
    payload = JSON.parse(readFileSync(0, 'utf8'))
  } catch {
    return
  }
  if (!String(payload.agent_type ?? '').startsWith(GOVERNED_AGENT_PREFIX)) return
  const config = findConfig(payload.cwd || process.cwd())
  if (!config) return
  const rows = requiredReadingRows(readFileSync(config, 'utf8'))
  if (rows.length === 0) return
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: { hookEventName: 'SubagentStart', additionalContext: contextFor(rows) },
    }) + '\n',
  )
}

try {
  main()
} catch {
  // Never fail a spawn over the reading list.
}
