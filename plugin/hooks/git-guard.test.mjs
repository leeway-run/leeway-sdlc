// Tests for git-guard.mjs. Run from the repo root: `node --test plugin/hooks/git-guard.test.mjs`.
// Each case spawns the hook exactly as Claude Code does -- a PreToolUse payload as JSON on stdin --
// and asserts on the exit code: 0 allows, 2 blocks.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const GUARD = fileURLToPath(new URL('./git-guard.mjs', import.meta.url))
const IMPLEMENTER = 'leeway-sdlc:sdlc-implementer'

const run = (stdin) => spawnSync(process.execPath, [GUARD], { input: stdin, encoding: 'utf8' })

// Pass `null` as agentType to omit the field entirely, as the orchestrator's own calls do.
const payload = (command, agentType = IMPLEMENTER) =>
  JSON.stringify({
    session_id: 'test',
    hook_event_name: 'PreToolUse',
    tool_name: 'Bash',
    tool_input: { command },
    ...(agentType === null ? {} : { agent_type: agentType }),
  })

const expectExit = (command, code, agentType) => {
  const result = run(payload(command, agentType))
  assert.equal(result.status, code, `${JSON.stringify(command)} -> exit ${result.status}; stderr: ${result.stderr}`)
  return result
}

const ALLOWED = [
  'git status --short',
  'git diff --cached',
  'git log --oneline -5',
  'git show HEAD~1:README.md',
  'git add src/a.ts src/b.ts',
  'git rev-parse --show-toplevel',
  'git ls-files',
  'git ls-tree -r HEAD',
  'git blame src/a.ts',
  'git grep -n "git commit"',
  'git -C repo status',
  'git branch',
  'git branch -a',
  'git branch -vv',
  'git branch --show-current',
  'git branch --list "feature/*"',
  'git branch --contains HEAD',
  'git worktree list',
  'git worktree list --porcelain',
  'git notes list',
  'git notes show HEAD',
  'git submodule status',
  'git submodule',
  'git apply fix.patch',
  'git apply --check fix.patch',
  'git status --short && echo "---PROOF---" && pwd',
  'grep -rn "git push" plugin/',
  'cd server && git diff',
  'bash -c "git status"',
  'env GIT_PAGER=cat git log',
  'git submodule foreach git status',
]

const BLOCKED = [
  'git commit -m "x"',
  'git push origin HEAD',
  'git merge main',
  'git pull',
  'git rebase main',
  'git reset --hard',
  'git checkout -- file',
  'git stash',
  'git tag v1',
  'git config core.hooksPath /dev/null',
  'cd server && git commit -m x',
  'git status; git commit -m x',
  'git diff | git apply --cached',
  'git -C repo commit -m x',
  'git -c alias.st=commit st',
  '"C:\\Program Files\\Git\\bin\\git.exe" commit -m x',
  "'C:/Program Files/Git/cmd/git.exe' push",
  '/usr/bin/git push',
  // worktree lifecycle
  'git worktree add ../wt feature/x',
  'git worktree remove ../wt',
  'git worktree prune',
  'git worktree move ../wt ../wt2',
  'git worktree lock ../wt',
  'git worktree unlock ../wt',
  // branch writes
  'git branch -d old',
  'git branch -D old',
  'git branch --delete old',
  'git branch -m old new',
  'git branch -M new',
  'git branch --move old new',
  'git branch -c old new',
  'git branch -C old new',
  'git branch --copy old new',
  'git branch -f main HEAD~1',
  'git branch --force main HEAD~1',
  'git branch -df old',
  'git branch new-branch',
  'git branch --set-upstream-to=origin/main',
  // am, notes, submodule, apply-to-index
  'git am < 0001.patch',
  'git notes add -m "x" HEAD',
  'git notes edit HEAD',
  'git notes remove HEAD',
  'git notes append -m x HEAD',
  'git notes copy HEAD HEAD~1',
  'git notes --ref=review add -m x',
  'git submodule update --init --recursive',
  'git submodule add https://example.invalid/r.git repos/r',
  'git submodule deinit repos/r',
  'git submodule sync',
  'git submodule foreach git commit -m x',
  'git submodule foreach "git push"',
  'git apply --index fix.patch',
  'git apply --cached fix.patch',
  'git apply -3 fix.patch',
]

const WRAPPED = [
  'sh -c "git commit -m x"',
  "bash -c 'git push'",
  "bash -lc 'git worktree add ../wt'",
  'bash -l -c "cd x && git merge main"',
  'zsh -ec "git branch -D old"',
  'env GIT_AUTHOR_NAME=x git commit -m x',
  'env -i PATH=/usr/bin git push',
  'env -S "git commit -m x"',
  'command git commit -m x',
  'xargs git branch -D',
  'git branch --format="%(refname:short)" | xargs -n1 git branch -D',
  'xargs -I{} git worktree remove {}',
  'timeout 30 git push',
  'eval "git commit -m x"',
  'echo "$(git commit -m x)"',
  'echo `git push`',
  '(cd x && git commit -m x)',
  'sh -c "bash -c \\"git commit -m x\\""',
  'pwsh -Command "git commit -m x"',
  'cmd /c "git push"',
]

for (const command of ALLOWED) {
  test(`allows: ${command}`, () => expectExit(command, 0))
}

for (const command of BLOCKED) {
  test(`blocks: ${command}`, () => {
    const result = expectExit(command, 2)
    assert.match(result.stderr, /^Blocked: `git /)
  })
}

for (const command of WRAPPED) {
  test(`blocks wrapped: ${command}`, () => expectExit(command, 2))
}

test('the reviewer is governed too', () => expectExit('git commit -m x', 2, 'leeway-sdlc:sdlc-reviewer'))

test('the worktree block names worktree lifecycle as orchestrator-only', () => {
  const { stderr } = expectExit('git worktree add ../wt', 2)
  assert.match(stderr, /worktree lifecycle .* is orchestrator-only/)
})

test('the orchestrator (no agent_type) may commit, push and manage worktrees', () => {
  for (const command of ['git commit -m x', 'git push', 'git worktree add ../wt', 'git branch -D old', 'sh -c "git merge x"']) {
    expectExit(command, 0, null)
  }
})

test('a foreign plugin agent is not governed', () => expectExit('git commit -m x', 0, 'other-plugin:builder'))

test('a non-string agent_type is not governed', () => expectExit('git commit -m x', 0, 42))

test('unparseable input fails open', () => {
  assert.equal(run('not json {').status, 0)
  assert.equal(run('').status, 0)
})

test('a payload without a command string fails open', () => {
  assert.equal(run(JSON.stringify({ tool_name: 'Bash', tool_input: {}, agent_type: IMPLEMENTER })).status, 0)
  assert.equal(run(JSON.stringify({ tool_name: 'Bash', tool_input: { command: 7 }, agent_type: IMPLEMENTER })).status, 0)
})

test('an eval chain is bounded: judged fast, and blocked rather than allowed past the limit', () => {
  const chain = (n) => Array(n).fill('eval').join(' ')
  for (const [command, code] of [
    [`${chain(30)} git status`, 2],
    [`${chain(30)} git commit -m x`, 2],
    [`${chain(3)} git commit -m x`, 2],
    [`${chain(3)} git status`, 0],
    [`${chain(Math.floor((10 * 1024) / 5))} git commit -m x`, 2],
  ]) {
    const started = Date.now()
    expectExit(command, code)
    assert.ok(Date.now() - started < 1000, `took over a second: ${command.length} bytes`)
  }
})

test("$'...' quoting does not hide git", () => expectExit("$'git' commit -m x", 2))

test('more nested scripts than the budget allows are blocked, fewer are judged', () => {
  const subs = (n) => `echo "${'$(true)'.repeat(n)}"`
  expectExit(`${subs(250)} && git status`, 2)
  expectExit(`${subs(50)} && git status`, 0)
  expectExit(`${subs(50)} && git commit -m x`, 2)
})
