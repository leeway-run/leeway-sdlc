// The governed-agent marker (rule c in guard.mjs), for agents whose hook payload does not say which
// agent made a call. The orchestrator runs, from the repo root:
//
//   node <plugin>/hooks/adapters/governed.mjs on <name> [--minutes 120]   before delegating
//   node <plugin>/hooks/adapters/governed.mjs off <name>                  when the subagent returns
//   node <plugin>/hooks/adapters/governed.mjs status
//
// `on` writes `.sdlc/.governed/<name>` as JSON `{since, until}`; while it is live the guard judges
// every shell command in the session as the subagent's. `until` bounds a crashed run: an expired
// marker is ignored, so the orchestrator is never locked out for longer than --minutes. `.sdlc/.governed/`
// is gitignored by sdlc-install. No dependencies.

import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const DIR = join(process.cwd(), '.sdlc', '.governed')
const NAME = /^[A-Za-z0-9._-]{1,80}$/

const [verb, name, ...rest] = process.argv.slice(2)
const minutesAt = rest.indexOf('--minutes')
const minutes = minutesAt === -1 ? 120 : Number(rest[minutesAt + 1])

const fail = (message) => {
  console.error(`governed.mjs: ${message}`)
  process.exit(1)
}

if (verb === 'status') {
  let names = []
  try {
    names = readdirSync(DIR)
  } catch {
    names = []
  }
  const now = Date.now()
  for (const n of names) {
    try {
      const { until } = JSON.parse(readFileSync(join(DIR, n), 'utf8'))
      console.log(`${n}\t${until > now ? `live until ${new Date(until).toISOString()}` : 'expired'}`)
    } catch {
      console.log(`${n}\tunreadable`)
    }
  }
  if (names.length === 0) console.log('no markers')
} else if (verb === 'on' || verb === 'off') {
  if (!NAME.test(name ?? '')) fail('give a name: letters, digits, dot, dash or underscore')
  if (verb === 'on') {
    if (!(minutes > 0 && minutes <= 24 * 60)) fail('--minutes must be between 1 and 1440')
    mkdirSync(DIR, { recursive: true })
    const since = Date.now()
    writeFileSync(join(DIR, name), JSON.stringify({ since, until: since + minutes * 60_000 }) + '\n')
    console.log(`governed: ${name} live for ${minutes} min`)
  } else {
    rmSync(join(DIR, name), { force: true })
    console.log(`governed: ${name} removed`)
  }
} else {
  fail('usage: governed.mjs on <name> [--minutes N] | off <name> | status')
}
