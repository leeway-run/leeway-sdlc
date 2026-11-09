// The plugin's bin/ wrappers and the kit copies other agents run, moved from allow-list.test.mjs (LWY-189.5) with its UNVERIFIED-rule assertion left out.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { TARGETS, harness } from '../../scripts/targets.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SERVER = 'https://s.test'

for (const [name, script] of [['leeway-sdlc-wait-answer', 'wait-answer.mjs'], ['leeway-sdlc-session-tokens', 'session-tokens.mjs'], ['leeway-sdlc-raise', 'raise.mjs']]) {
  test(`${name} runs ${script} and hands back its exit code`, { skip: process.platform === 'win32' }, () => {
    const bin = join(ROOT, 'plugin', 'bin', name)
    assert.ok(statSync(bin).mode & 0o111, 'not executable')
    const usage = spawnSync(bin, ['--nonsense'], { encoding: 'utf8' })
    assert.equal(usage.status, name === 'leeway-sdlc-raise' ? 2 : 1, usage.stderr)
    assert.match(usage.stderr, new RegExp(script.replace('.mjs', '')))
  })
}

test('leeway-sdlc-wait-answer exits 0 with the answer, through the bin wrapper', { skip: process.platform === 'win32' }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'bin-wrappers-'))
  try {
    const fake = join(dir, 'fake.mjs')
    writeFileSync(fake, 'console.log(JSON.stringify({escalations:[{ref:"X",number:1,answer:{label:"A",note:"",by:"p"}}]}))\n')
    const r = spawnSync(join(ROOT, 'plugin', 'bin', 'leeway-sdlc-wait-answer'), ['--server', SERVER, 'X', 'e1', '--first', '0.01', '--', process.execPath, fake], { encoding: 'utf8' })
    assert.equal(r.status, 0, r.stderr)
    assert.deepEqual(JSON.parse(r.stdout), { label: 'A', note: '', by: 'p' })
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

for (const [name, script] of [['leeway-sdlc-wait-answer', 'wait-answer'], ['leeway-sdlc-session-tokens', 'session-tokens'], ['leeway-sdlc-raise', 'raise']]) {
  test(`${name} reached through a symlink, absolute or relative, still finds its script`, { skip: process.platform === 'win32' }, () => {
    const dir = mkdtempSync(join(tmpdir(), 'bin-wrappers-'))
    try {
      const bin = join(ROOT, 'plugin', 'bin', name)
      const sub = join(dir, 'a b')
      mkdirSync(sub)
      for (const target of [bin, relative(sub, bin)]) {
        const link = join(sub, target === bin ? 'absolute' : 'relative')
        symlinkSync(target, link)
        const r = spawnSync(link, ['--nonsense'], { encoding: 'utf8' })
        assert.equal(r.status, name === 'leeway-sdlc-raise' ? 2 : 1, r.stderr)
        assert.match(r.stderr, new RegExp(script))
        assert.doesNotMatch(r.stderr, /MODULE_NOT_FOUND/)
      }
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
}

test('other agents run the scripts from .sdlc/kit, where the build copies them, and get no bin/', () => {
  for (const t of TARGETS) {
    const text = harness(t, '0.0.0', 'notice')
    assert.match(text, /\*\*wait-answer:\*\* `node \.sdlc\/kit\/scripts\/wait-answer\.mjs`/, t.id)
    assert.match(text, /\*\*session-tokens:\*\* `node \.sdlc\/kit\/scripts\/session-tokens\.mjs`/, t.id)
    assert.match(text, /\*\*raise:\*\* `node \.sdlc\/kit\/scripts\/raise\.mjs`/, t.id)
  }
  assert.throws(() => statSync(join(ROOT, 'targets', 'agents', 'bin')))
  assert.ok(statSync(join(ROOT, 'targets', 'agents', 'skills', 'sdlc-install', 'kit', 'scripts', 'wait-answer.mjs')))
  assert.ok(statSync(join(ROOT, 'targets', 'agents', 'skills', 'sdlc-install', 'kit', 'scripts', 'raise.mjs')))
})
