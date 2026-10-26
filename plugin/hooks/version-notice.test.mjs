// Tests for version-notice.mjs. Run from the repo root: `node --test plugin/hooks/version-notice.test.mjs`.
// The hook compares `Synced to` in .sdlc/CONFIG.md above the payload's cwd with the version in
// ../.claude-plugin/plugin.json. Whatever happens it exits 0.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HOOK = fileURLToPath(new URL('./version-notice.mjs', import.meta.url))
const PLUGIN = JSON.parse(readFileSync(fileURLToPath(new URL('../.claude-plugin/plugin.json', import.meta.url)), 'utf8')).version

const run = (stdin) => spawnSync(process.execPath, [HOOK], { input: stdin, encoding: 'utf8' })
const start = (cwd) => run(JSON.stringify({ session_id: 'test', hook_event_name: 'SessionStart', cwd }))

// A temp repo whose .sdlc/CONFIG.md holds `config`; returns a nested cwd to prove the walk up.
const repoWith = (config) => {
  const root = mkdtempSync(join(tmpdir(), 'version-notice-'))
  mkdirSync(join(root, '.sdlc'))
  if (config !== null) writeFileSync(join(root, '.sdlc', 'CONFIG.md'), config)
  const nested = join(root, 'src', 'deep')
  mkdirSync(nested, { recursive: true })
  return { root, nested }
}
const table = (v) => `# wiring\n\nGenerated 2026-10-26 by leeway-sdlc ${v}.\n\n## Repo copies\n\n| | |\n|---|---|\n| Synced to | ${v} |\n`
const silent = (result) => {
  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.stdout, '')
}

test('behind: one context line naming both versions and the sync skill', () => {
  const result = start(repoWith(table('0.0.9')).nested)
  assert.equal(result.status, 0, result.stderr)
  const out = JSON.parse(result.stdout)
  assert.equal(out.hookSpecificOutput.hookEventName, 'SessionStart')
  const line = out.hookSpecificOutput.additionalContext
  assert.ok(!line.includes('\n'))
  assert.ok(line.includes('0.0.9') && line.includes(PLUGIN) && line.includes('/leeway-sdlc:sync-repo'), line)
})

test('equal: silent', () => silent(start(repoWith(table(PLUGIN)).root)))

test('ahead: silent', () => silent(start(repoWith(table('99.0.0')).root)))

// The hook reads plugin.json relative to its own file, so a copy of it in a temp tree sees whatever
// plugin version the test writes there.
const asPlugin = (version) => {
  const tree = mkdtempSync(join(tmpdir(), 'version-notice-plugin-'))
  mkdirSync(join(tree, 'hooks'))
  mkdirSync(join(tree, '.claude-plugin'))
  copyFileSync(HOOK, join(tree, 'hooks', 'version-notice.mjs'))
  writeFileSync(join(tree, '.claude-plugin', 'plugin.json'), JSON.stringify({ name: 'leeway-sdlc', version }))
  return (cwd) =>
    spawnSync(process.execPath, [join(tree, 'hooks', 'version-notice.mjs')], {
      input: JSON.stringify({ hook_event_name: 'SessionStart', cwd }),
      encoding: 'utf8',
    })
}

test('numeric, not lexical, comparison', () => {
  // As strings '0.9.0' sorts after '0.10.0'; as numbers it is behind it.
  const plugin = asPlugin('0.10.0')
  const behind = plugin(repoWith(table('0.9.0')).root)
  assert.match(behind.stdout, /0\.9\.0/)
  silent(asPlugin('0.9.0')(repoWith(table('0.10.0')).root))
  silent(plugin(repoWith(table('0.10.0')).root))
})

test('no CONFIG above cwd: silent', () => {
  const dir = mkdtempSync(join(tmpdir(), 'version-notice-none-'))
  silent(start(dir))
})

test('CONFIG without a Synced to row: silent', () => silent(start(repoWith('# wiring\n\nnothing here\n').root)))

test('unreadable or garbage CONFIG: silent', () => {
  silent(start(repoWith('\u0000\u0001 garbage |||| Synced to | not-a-version\n').root))
  // A directory where the file should be cannot be read as text.
  const { root } = repoWith(null)
  mkdirSync(join(root, '.sdlc', 'CONFIG.md'))
  silent(start(root))
})

test('garbage stdin: silent', () => {
  silent(run('not json'))
  silent(run(''))
})

test('accepts Synced-to and a colon, case-insensitively', () => {
  for (const row of ['synced-to: 0.0.9', '| SYNCED TO | v0.0.9 |', 'Synced to: 0.0.9']) {
    const result = start(repoWith(`# x\n\n${row}\n`).root)
    assert.match(result.stdout, /0\.0\.9/, row)
    assert.equal(result.status, 0)
  }
})
