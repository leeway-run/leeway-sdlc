// The pre-push guard sdlc-install writes on a yes (LWY-157.2), run for real: plain git against a local bare remote, with
// the machine's git config shut out. Each test fills the template and writes it where the install does.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const TEMPLATE = 'skills/sdlc-install/scaffold/hooks/pre-push.tmpl'
const template = readFileSync(join(ROOT, 'plugin', TEMPLATE), 'utf8')
const skip = process.platform === 'win32'
// The lines the install prints for writing the hook, as sdlc-install's step says them: the fixture runs these, so a line the
// step drops is a line no test here has.
// The last "16, yes" bullet: "16's offer, yes" before LWY-189.2, "16, yes" after it, when the allow-list's bullet of that name is gone.
const skillText = readFileSync(join(ROOT, 'plugin/skills/sdlc-install/SKILL.md'), 'utf8')
const step = skillText.slice([...skillText.matchAll(/\*\*16(?:'s offer)?, yes\*\*/g)].at(-1).index)
const printed = step.slice(step.indexOf('```sh') + 5, step.indexOf('```', step.indexOf('```sh') + 5)).trim().split('\n').map((l) => l.trim())

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

const fill = (integration) => template.replace('{{INTEGRATION_BRANCH}}', integration)

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
  // With no template, so no .git/hooks: the path detection prints has no directory until the install's lines make one.
  ok(dir, 'init', '-q', '--template=', '-b', 'main', primary)
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
    // What the install does: the path detection prints, resolved as git does from where it runs, and the step's own lines.
    const path = ok(primary, 'rev-parse', '--git-path', 'hooks/pre-push')
    const hook = resolve(primary, path)
    const run = (prefix) => {
      const line = printed.find((l) => l.startsWith(prefix)).replaceAll('<that path>', path)
      const r = spawnSync('sh', ['-c', line], { cwd: primary, env: env(dir), encoding: 'utf8' })
      assert.equal(r.status, 0, `${line}: ${r.stderr}`)
    }
    run('mkdir ')
    writeFileSync(hook, fill(integration))
    run('chmod ')
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
  assert.match(template, /while IFS= read -r line; do/)
  assert.match(template, /<local ref> <local oid> <remote ref> <remote oid>/)
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

// What the refusal may say over a commit this clone lacks: the hook can't tell forced from unforced there, so it names both.
const NAMES_BOTH = /a commit this clone doesn't have: either a force push, or a push git rejects anyway \(fetch first\)/
const CLAIMS_FORCE = /refused [^\n]*: a force push/

test('an unforced push over a commit this clone does not have makes no claim of force: it names both, as git would reject it', { skip }, (t) => {
  const f = fixture(t)
  const other = join(f.dir, 'other')
  f.ok(f.dir, 'clone', '-q', '-b', 'story', f.remote, other)
  f.commit(other, 'theirs')
  f.ok(other, 'push', '-q', 'origin', 'story')
  f.commit(f.primary, 'ours')
  const theirs = f.at('refs/heads/story')
  assert.notEqual(f.git(f.primary, 'cat-file', '-e', theirs).status, 0, 'this clone has the commit')
  // Git's own answer to this push, with no hook: the line's "rejects anyway" is true.
  const own = f.git(f.primary, 'push', 'origin', 'story')
  assert.notEqual(own.status, 0)
  assert.match(own.stderr, /\(fetch first\)/)
  f.install()
  refused(f, f.primary, 'origin', 'story')
  const unforced = f.git(f.primary, 'push', 'origin', 'story')
  assert.match(unforced.stderr, NAMES_BOTH)
  assert.doesNotMatch(unforced.stderr, CLAIMS_FORCE)
  // Forced, the same line and the same refusal: stdin is the same, so nothing else could be true of it.
  const forced = f.git(f.primary, 'push', '--force', 'origin', 'story')
  assert.notEqual(forced.status, 0)
  assert.match(forced.stderr, NAMES_BOTH)
  assert.equal(f.at('refs/heads/story'), theirs)
})

test('a force push over a commit this clone has is called one: git rejects the unforced push before the hook', { skip }, (t) => {
  const f = fixture(t)
  f.install()
  rewrite(f)
  const unforced = f.git(f.primary, 'push', 'origin', 'story')
  assert.notEqual(unforced.status, 0)
  assert.match(unforced.stderr, /non-fast-forward/)
  assert.doesNotMatch(unforced.stderr, /pre-push guard/)
  const forced = f.git(f.primary, 'push', '--force', 'origin', 'story')
  assert.notEqual(forced.status, 0)
  assert.match(forced.stderr, CLAIMS_FORCE)
  assert.doesNotMatch(forced.stderr, NAMES_BOTH)
})

// Two tags on the remote at the story's commit, one light and one annotated, with a commit after them to move them to.
const tagged = (f) => {
  f.ok(f.primary, 'tag', 'light')
  f.ok(f.primary, 'tag', '-a', '-m', 'annotated', 'annotated')
  f.ok(f.primary, 'push', '-q', 'origin', 'light', 'annotated')
  f.commit(f.primary, 'after-tags')
}

test('with no hook, a tag moved forward by force goes through, so the guard is why it is refused', { skip }, (t) => {
  const f = fixture(t)
  tagged(f)
  const before = f.at('refs/tags/light')
  f.ok(f.primary, 'tag', '-f', 'light')
  passed(f, f.primary, '--force', 'origin', 'light')
  assert.notEqual(f.at('refs/tags/light'), before)
})

test('a tag the remote has is not moved: forward, backward or annotated, forced or not', { skip }, (t) => {
  const f = fixture(t)
  tagged(f)
  f.install()
  // Forward, onto a descendant, which the ancestry test alone would pass.
  f.ok(f.primary, 'tag', '-f', 'light')
  f.ok(f.primary, 'tag', '-f', '-a', '-m', 'moved', 'annotated')
  for (const tag of ['light', 'annotated']) {
    refused(f, f.primary, '--force', 'origin', tag)
    refused(f, f.primary, 'origin', `+refs/tags/${tag}`)
    const unforced = f.git(f.primary, 'push', 'origin', tag)
    assert.match(unforced.stderr, /the remote already has this tag, at [0-9a-f]+, and a tag is not moved, forced or not\./)
    assert.doesNotMatch(unforced.stderr, CLAIMS_FORCE)
  }
  // Backward.
  f.ok(f.primary, 'tag', '-f', 'light', 'HEAD~2')
  f.ok(f.primary, 'tag', '-f', '-a', '-m', 'moved back', 'annotated', 'HEAD~2')
  for (const tag of ['light', 'annotated']) refused(f, f.primary, '--force', 'origin', tag)
})

test('a new tag passes, light or annotated, an unchanged one passes, and so does deleting one', { skip }, (t) => {
  const f = fixture(t)
  tagged(f)
  f.install()
  f.ok(f.primary, 'tag', 'new-light')
  f.ok(f.primary, 'tag', '-a', '-m', 'new', 'new-annotated')
  passed(f, f.primary, 'origin', 'new-light', 'new-annotated')
  assert.equal(f.at('refs/tags/new-light'), f.ok(f.primary, 'rev-parse', 'HEAD'))
  passed(f, f.primary, '--tags', 'origin')
  passed(f, f.primary, '--force', 'origin', 'light')
  passed(f, f.primary, 'origin', '--delete', 'refs/tags/new-light')
  assert.equal(f.at('refs/tags/new-light'), '')
})

test('a local ref holding a space is read whole: its push passes, and to the integration branch the refusal names it', { skip }, (t) => {
  const f = fixture(t)
  f.install()
  f.ok(f.primary, 'commit', '-q', '--allow-empty', '-m', 'two words')
  const r = f.git(f.primary, 'push', 'origin', 'HEAD^{/two words}:main')
  assert.notEqual(r.status, 0)
  assert.match(r.stderr, /refused HEAD\^\{\/two words\} -> refs\/heads\/main: the integration branch is not pushed to\./)
  passed(f, f.primary, 'origin', 'HEAD^{/two words}:plan')
  assert.equal(f.at('refs/heads/plan'), f.ok(f.primary, 'rev-parse', 'HEAD'))
})

test('the install\'s lines make the hook\'s directory when the clone has none', { skip }, (t) => {
  const f = fixture(t)
  const path = f.ok(f.primary, 'rev-parse', '--git-path', 'hooks/pre-push')
  assert.ok(!existsSync(dirname(resolve(f.primary, path))), 'the fixture has a hooks directory, so this covers nothing')
  assert.ok(printed[0].startsWith('mkdir -p '), 'the directory comes first, before the write')
  assert.ok(existsSync(f.install()))
  refused(f, f.primary, 'origin', 'HEAD:main')
})

test('why the install makes no offer on a name holding a quote: the script breaks, and refuses every push', { skip }, (t) => {
  const f = fixture(t)
  const hook = f.install()
  writeFileSync(hook, fill("it's"))
  const r = spawnSync(hook, { input: 'HEAD 0 refs/heads/other 0\n', env: env(f.dir), encoding: 'utf8' })
  assert.notEqual(r.status, 0)
  // The same line passes with any name that doesn't hold one, the other characters git allows and the shell reads included.
  for (const name of ['release/1.x', 'a.b', 'a`b', 'a&b', 'a;b', 'a"b', 'x$(touch${IFS}pwned)']) {
    writeFileSync(hook, fill(name))
    const ok = spawnSync(hook, { input: 'HEAD 0 refs/heads/other 0\n', cwd: f.dir, env: env(f.dir), encoding: 'utf8' })
    assert.equal(ok.status, 0, name)
    assert.ok(!existsSync(join(f.dir, 'pwned')), name)
    const no = spawnSync(hook, { input: `HEAD 0 refs/heads/${name} 0\n`, cwd: f.dir, env: env(f.dir), encoding: 'utf8' })
    assert.equal(no.status, 1, name)
  }
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
