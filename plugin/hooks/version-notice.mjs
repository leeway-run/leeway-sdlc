// SessionStart hook: tell the session when the repo's `.sdlc/` copies are older than the plugin.
//
// The repo's `.sdlc/CONFIG.md` carries a `Synced to` row (written by the installer) under
// `## Repo copies`. When that version is behind this plugin's `version` in
// `.claude-plugin/plugin.json`, print one context line pointing at `/leeway-sdlc:sync-repo`.
//
// Accepted forms of the row, case-insensitive: `| Synced to | 0.1.0 |`, `| Synced-to | 0.1.0 |`,
// `Synced to: 0.1.0`, `Synced-to: 0.1.0`. A leading `v` on the version is ignored.
//
// Fail-open: equal or ahead, no CONFIG, no row, an unreadable or unparsable file, bad stdin all
// print nothing and exit 0. This hook never fails a session. Reads stdin and at most two files.
// Tests: `node --test plugin/hooks/version-notice.test.mjs`.

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const CONFIG = join('.sdlc', 'CONFIG.md')
const PLUGIN_JSON = fileURLToPath(new URL('../.claude-plugin/plugin.json', import.meta.url))
const ROW = /^\s*\|?\s*synced[ -]to\s*(?:\||:)\s*v?(\d+\.\d+\.\d+)/im

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

const triple = (version) => version.split('.').map(Number)

const isBehind = (synced, current) => {
  const a = triple(synced)
  const b = triple(current)
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] < b[i]
  return false
}

const main = () => {
  let payload = {}
  try {
    payload = JSON.parse(readFileSync(0, 'utf8'))
  } catch {
    // No usable payload: fall back to the process's own cwd.
  }
  const cwd = typeof payload?.cwd === 'string' && payload.cwd ? payload.cwd : process.cwd()
  const config = findConfig(cwd)
  if (!config) return
  const synced = ROW.exec(readFileSync(config, 'utf8'))?.[1]
  if (!synced) return
  const { version } = JSON.parse(readFileSync(PLUGIN_JSON, 'utf8'))
  const current = /^\d+\.\d+\.\d+$/.test(version) ? version : null
  if (!current || !isBehind(synced, current)) return
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext: `This repo's .sdlc/ files are synced to leeway-sdlc ${synced}, but the installed plugin is ${current}. Run /leeway-sdlc:sync-repo to bring them up to date.`,
      },
    }) + '\n',
  )
}

try {
  main()
} catch {
  // Never fail a session over a version notice.
}
