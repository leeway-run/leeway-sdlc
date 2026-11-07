// The pre-push guard sdlc-install writes on a yes (LWY-157.2), run for real: plain git against a local bare remote, with
// the machine's git config shut out. Each test fills the template and writes it where the install does.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const TEMPLATE = 'skills/sdlc-install/scaffold/hooks/pre-push.tmpl'
const template = readFileSync(join(ROOT, 'plugin', TEMPLATE), 'utf8')
const skip = process.platform === 'win32'

// The machine's config can set core.hooksPath, init.defaultBranch or a signing rule, and a test run from a hook has GIT_DIR.
const env = (dir) => ({
  ...Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('GIT_'))),
  HOME: dir,
  XDG_CONFIG_HOME: dir,
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_AUTHOR_NAME: 't',
  GIT_AUTHOR_EMAIL: 't@t',
  GIT_COMMITTER_NAME: 't',
  GIT_COMMITTER_EMAIL: 't@t',
})

const fixture = (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'pre-push-guard-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const git = (cwd, ...args) => spawnSync('git', args, { cwd, env: env(dir), encoding: 'utf8' })
  const ok = (cwd, ...args) => {
    const r = git(cwd, ...args)
    assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`)
    return r.stdout.trim()
  }
  const remote = join(dir, 'r.git')
  const primary = join(dir, 'p')
  ok(dir, 'init', '-q', '--bare', '-b', 'main', remote)
  ok(dir, 'init', '-q', '-b', 'main', primary)
  ok(primary, 'remote', 'add', 'origin', remote)
  const commit = (cwd, name) => {
    writeFileSync(join(cwd, name), name)
    ok(cwd, 'add', name)
    ok(cwd, 'commit', '-qm', name)
  }
  commit(primary, 'base')
  for (const branch of ['main', 'plan', 'develop']) ok(primary, 'push', '-q', 'origin', `HEAD:refs/heads/${branch}`)
  ok(primary, 'fetch', '-q', 'origin')
  ok(primary, 'switch', '-qc', 'story')
  commit(primary, 'story-1')
  ok(primary, 'push', '-qu', 'origin', 'story')
  // A linked worktree that is detached, as the story gate's merge worktree is.
  const merge = join(dir, 'merge')
  ok(primary, 'worktree', 'add', '-q', '--detach', merge, 'origin/plan')
  ok(merge, 'merge', '-q', '--no-ff', '-m', 'merge story', 'story')
  const at = (ref) => git(remote, 'rev-parse', '--verify', '-q', ref).stdout.trim()
  const install = (integration = 'main') => {
    // What the install does: the path detection prints, resolved as git does from where it runs.
    const hook = resolve(primary, ok(primary, 'rev-parse', '--git-path', 'hooks/pre-push'))
    mkdirSync(dirname(hook), { recursive: true })
    writeFileSync(hook, template.replace('{{INTEGRATION_BRANCH}}', integration))
    chmodSync(hook, 0o755)
    return hook
  }
  return { dir, git, ok, commit, remote, primary, merge, at, install }
}

// A refused push prints the guard's own line and leaves every ref of the remote where it was. The line is what shows the
// guard refused, and not git or the server.
const refused = (f, cwd, ...args) => {
  const before = f.ok(f.remote, 'for-each-ref')
  const r = f.git(cwd, 'push', ...args)
  assert.notEqual(r.status, 0, `push ${args.join(' ')} went through: ${r.stderr}`)
  assert.match(r.stderr, /pre-push guard: refused /, `push ${args.join(' ')} failed, but not by the guard: ${r.stderr}`)
  assert.equal(f.ok(f.remote, 'for-each-ref'), before, `push ${args.join(' ')} moved a ref`)
}
const passed = (f, cwd, ...args) => {
  const r = f.git(cwd, 'push', ...args)
  assert.equal(r.status, 0, `push ${args.join(' ')} refused: ${r.stderr}`)
  assert.doesNotMatch(r.stderr, /pre-push guard/)
}
// Rewrite the story branch, so a push of it is not a fast-forward.
const rewrite = (f) => {
  f.ok(f.primary, 'commit', '-q', '--amend', '-m', 'rewritten')
}

test('the template fills to a script with no placeholder left', () => {
  assert.equal(template.match(/\{\{\w+\}\}/g).join(), '{{INTEGRATION_BRANCH}}')
  assert.ok(template.startsWith('#!/bin/sh\n'))
})

test('by detection\'s rule it counts: it reads stdin and is not keyed on the current branch', () => {
  assert.match(template, /while read -r local_ref local_oid remote_ref remote_oid/)
  assert.doesNotMatch(template, /abbrev-ref|symbolic-ref|branch --show-current/)
})

test('with no hook, every push the guard refuses goes through, so the guard is why they are refused', { skip }, (t) => {
  const f = fixture(t)
  passed(f, f.primary, 'origin', 'HEAD:main')
  passed(f, f.merge, 'origin', 'HEAD:develop')
  rewrite(f)
  passed(f, f.primary, '--force', 'origin', 'story')
})

test('a push to the integration branch is refused, in every refspec form', { skip }, (t) => {
  const f = fixture(t)
  f.install()
  for (const refspec of ['HEAD:main', 'story:main', 'HEAD:refs/heads/main', 'refs/heads/story:refs/heads/main', '+HEAD:main']) {
    refused(f, f.primary, 'origin', refspec)
  }
  refused(f, f.primary, '--force', 'origin', 'HEAD:main')
  f.ok(f.primary, 'switch', '-q', 'main')
  f.commit(f.primary, 'on-main')
  refused(f, f.primary, 'origin', 'main')
  refused(f, f.primary, 'origin', 'HEAD')
})

test('deleting the integration branch is refused', { skip }, (t) => {
  const f = fixture(t)
  f.install()
  refused(f, f.primary, 'origin', ':main')
  refused(f, f.primary, 'origin', '--delete', 'main')
})

test('one refused ref refuses the whole push', { skip }, (t) => {
  const f = fixture(t)
  f.install()
  f.commit(f.primary, 'story-2')
  refused(f, f.primary, 'origin', 'story', 'HEAD:main')
})

test('from a detached linked worktree: HEAD to the integration branch is refused, HEAD to a plan branch passes', { skip }, (t) => {
  const f = fixture(t)
  f.install()
  assert.equal(f.ok(f.merge, 'rev-parse', '--abbrev-ref', 'HEAD'), 'HEAD')
  refused(f, f.merge, 'origin', 'HEAD:main')
  const head = f.ok(f.merge, 'rev-parse', 'HEAD')
  passed(f, f.merge, 'origin', 'HEAD:plan')
  assert.equal(f.at('refs/heads/plan'), head)
})

test('a force push is refused on any ref, whichever way it is written', { skip }, (t) => {
  const f = fixture(t)
  f.install()
  const lease = f.at('refs/heads/story')
  rewrite(f)
  refused(f, f.primary, '--force', 'origin', 'story')
  refused(f, f.primary, '-f', 'origin', 'HEAD:story')
  refused(f, f.primary, 'origin', '+story')
  refused(f, f.primary, 'origin', '+HEAD:refs/heads/story')
  refused(f, f.primary, `--force-with-lease=story:${lease}`, 'origin', 'story')
  refused(f, f.primary, '--force-if-includes', '--force-with-lease', 'origin', 'story')
})

test('a force push from a detached linked worktree, and one that rewinds a plan branch, are refused', { skip }, (t) => {
  const f = fixture(t)
  f.install()
  passed(f, f.merge, 'origin', 'HEAD:plan')
  f.ok(f.merge, 'commit', '-q', '--amend', '-m', 'rewritten')
  refused(f, f.merge, '--force', 'origin', 'HEAD:plan')
  f.ok(f.merge, 'reset', '-q', '--hard', 'HEAD~1')
  refused(f, f.merge, '--force', 'origin', 'HEAD:plan')
})

test('a force push over a commit this clone does not have is refused', { skip }, (t) => {
  const f = fixture(t)
  const other = join(f.dir, 'other')
  f.ok(f.dir, 'clone', '-q', '-b', 'story', f.remote, other)
  f.commit(other, 'theirs')
  f.ok(other, 'push', '-q', 'origin', 'story')
  f.install()
  f.commit(f.primary, 'ours')
  assert.notEqual(f.git(f.primary, 'cat-file', '-e', f.at('refs/heads/story')).status, 0, 'this clone has the commit')
  refused(f, f.primary, '--force', 'origin', 'story')
})

test('story, task and plan branches pass: a new branch, a fast-forward, a delete', { skip }, (t) => {
  const f = fixture(t)
  f.install()
  f.commit(f.primary, 'story-2')
  passed(f, f.primary, 'origin', 'story')
  passed(f, f.primary, '-u', 'origin', 'HEAD:refs/heads/fix/lwy-1.1-task')
  passed(f, f.primary, 'origin', 'story:plan')
  assert.equal(f.at('refs/heads/plan'), f.ok(f.primary, 'rev-parse', 'HEAD'))
  passed(f, f.primary, 'origin', '--delete', 'fix/lwy-1.1-task')
  assert.equal(f.at('refs/heads/fix/lwy-1.1-task'), '')
})

test('only the exact ref is the integration branch', { skip }, (t) => {
  const f = fixture(t)
  f.install()
  for (const name of ['refs/heads/main2', 'refs/heads/feat/main', 'refs/tags/main']) passed(f, f.primary, 'origin', `HEAD:${name}`)
})

test('the branch named at install is the one refused', { skip }, (t) => {
  const f = fixture(t)
  f.install('develop')
  refused(f, f.primary, 'origin', 'HEAD:develop')
  refused(f, f.merge, 'origin', 'HEAD:develop')
  passed(f, f.primary, 'origin', 'HEAD:main')
})

test('--force on a fast-forward looks like any other push on stdin, and passes: it overwrites nothing', { skip }, (t) => {
  const f = fixture(t)
  f.install()
  f.commit(f.primary, 'story-2')
  passed(f, f.primary, '--force', 'origin', 'story')
})

test('what the install says is true: --no-verify and -c core.hooksPath skip it', { skip }, (t) => {
  const f = fixture(t)
  f.install()
  passed(f, f.primary, '--no-verify', 'origin', 'HEAD:main')
  f.commit(f.primary, 'story-2')
  const r = f.git(f.primary, '-c', `core.hooksPath=${join(f.dir, 'none')}`, 'push', 'origin', 'HEAD:main')
  assert.equal(r.status, 0, r.stderr)
  assert.equal(f.at('refs/heads/main'), f.ok(f.primary, 'rev-parse', 'HEAD'))
})

test('why it goes in .git/hooks and what that costs: every worktree of the clone has it, another clone does not', { skip }, (t) => {
  const f = fixture(t)
  const hook = f.install()
  const linked = join(f.dir, 'linked')
  f.ok(f.primary, 'worktree', 'add', '-q', '-b', 'task', linked, 'story')
  assert.equal(resolve(linked, f.ok(linked, 'rev-parse', '--git-path', 'hooks/pre-push')), hook)
  refused(f, linked, 'origin', 'HEAD:main')
  const other = join(f.dir, 'other')
  f.ok(f.dir, 'clone', '-q', '-b', 'story', f.remote, other)
  passed(f, other, 'origin', 'HEAD:main')
})

test('why a core.hooksPath is in the way: with one set, git runs nothing from .git/hooks', { skip }, (t) => {
  const f = fixture(t)
  f.install()
  f.ok(f.primary, 'config', 'core.hooksPath', '.githooks')
  passed(f, f.primary, 'origin', 'HEAD:main')
})

test('the check the install prints: refuses by name with no repo state, passes anything else', { skip }, (t) => {
  const f = fixture(t)
  const hook = f.install('main')
  const feed = (line) => spawnSync(hook, { input: `${line}\n`, env: env(f.dir), encoding: 'utf8' })
  const no = feed('HEAD 0 refs/heads/main 0')
  assert.equal(no.status, 1)
  assert.match(no.stderr, /pre-push guard: refused HEAD -> refs\/heads\/main/)
  assert.equal(feed('HEAD 0 refs/heads/other 0').status, 0)
})

test('the script ships to other agents, unchanged, in both places the build puts a skill\'s files', () => {
  for (const pkg of ['targets/agents/skills/sdlc-install', 'targets/agents/skills/sdlc-install/kit/skills/sdlc-install']) {
    assert.equal(readFileSync(join(ROOT, pkg, 'scaffold/hooks/pre-push.tmpl'), 'utf8'), template, pkg)
  }
})
