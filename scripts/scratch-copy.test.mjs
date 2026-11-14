// Run: `node --test scripts/scratch-copy.test.mjs`.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT = fileURLToPath(new URL('./scratch-copy.mjs', import.meta.url))

const git = (cwd, ...args) => {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' })
  assert.equal(r.status, 0, r.stderr)
}
const run = (cwd, ...args) => spawnSync(process.execPath, [SCRIPT, ...args], { cwd, encoding: 'utf8' })

// A temp repo with sub/a.txt staged, then edited without staging, and an untracked file; plus an empty parent for dests.
const setup = () => {
  const dir = mkdtempSync(join(tmpdir(), 'leeway-sdlc-scratch-'))
  git(dir, 'init', '-q')
  mkdirSync(join(dir, 'sub'))
  writeFileSync(join(dir, 'sub', 'a.txt'), 'staged\n')
  git(dir, 'add', '.')
  writeFileSync(join(dir, 'sub', 'a.txt'), 'edited, not staged\n')
  writeFileSync(join(dir, 'untracked.txt'), 'x\n')
  const parent = mkdtempSync(join(tmpdir(), 'leeway-sdlc-scratch-dest-'))
  return { dir, parent, done: () => [dir, parent].forEach((p) => rmSync(p, { recursive: true, force: true })) }
}

test('the copy holds the staged bytes and no untracked file', () => {
  const { dir, parent, done } = setup()
  try {
    const dest = join(parent, 'copy')
    const r = run(dir, dest)
    assert.equal(r.status, 0, r.stderr)
    assert.equal(readFileSync(join(dest, 'sub', 'a.txt'), 'utf8'), 'staged\n')
    assert.equal(existsSync(join(dest, 'untracked.txt')), false)
    assert.equal(readFileSync(join(dir, 'sub', 'a.txt'), 'utf8'), 'edited, not staged\n')
  } finally {
    done()
  }
})

test('an empty existing dest is used, and a relative one resolves against the cwd', () => {
  const { dir, parent, done } = setup()
  try {
    mkdirSync(join(parent, 'empty'))
    const r = run(dir, join('..', basename(parent), 'empty'))
    assert.equal(r.status, 0, r.stderr)
    assert.equal(readFileSync(join(parent, 'empty', 'sub', 'a.txt'), 'utf8'), 'staged\n')
  } finally {
    done()
  }
})

test('a non-empty dest is refused and nothing is written', () => {
  const { dir, parent, done } = setup()
  try {
    writeFileSync(join(parent, 'keep.txt'), 'mine\n')
    const r = run(dir, parent)
    assert.notEqual(r.status, 0)
    assert.deepEqual(readdirSync(parent), ['keep.txt'])
  } finally {
    done()
  }
})

test('--help says what it is for and exits 0', () => {
  const r = run(tmpdir(), '--help')
  assert.equal(r.status, 0)
  assert.match(r.stdout, /usage: node scripts\/scratch-copy\.mjs <dest>/)
})
