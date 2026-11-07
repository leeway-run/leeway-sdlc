// What sdlc-install's allow-list names, against what run prints (LWY-157). A rule matches the text before its first `*`
// as written, so this checks every call run prints against the list by the rule Claude Code documents ("Configure
// permissions", "Wildcard patterns" and "Compound commands"). The matcher is a model of those docs, not Claude Code.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { TARGETS, harness } from '../../scripts/targets.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (path) => readFileSync(join(ROOT, path), 'utf8').replace(/\r\n/g, '\n')
const flat = (text) => text.replace(/\s+/g, ' ')

const run = read('plugin/skills/run/SKILL.md')
const claudeHarness = read('plugin/HARNESS.md')

const CLI = 'mycli'
const SERVER = 'https://s.test'

// ---- The documented rule.
const matches = (rule, command) => {
  if (rule.endsWith(' *') && rule.indexOf('*') === rule.length - 1 && command === rule.slice(0, -2)) return true
  const source = rule.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\/]/g, '\\$&')).join('[\\s\\S]*')
  return new RegExp(`^${source}$`).test(command)
}
// Every subcommand must be allowed on its own; a pipe in quotes is not a separator.
const subcommands = (command) => {
  const parts = []
  let quote = null
  let part = ''
  for (let i = 0; i < command.length; i++) {
    const c = command[i]
    if (quote) {
      if (c === quote) quote = null
      part += c
    } else if (c === "'" || c === '"') {
      quote = c
      part += c
    } else if (c === '|' || c === ';' || c === '\n' || (c === '&' && command[i + 1] === '&')) {
      if (command[i + 1] === c) i++
      parts.push(part)
      part = ''
    } else part += c
  }
  parts.push(part)
  return parts.map((p) => p.trim()).filter(Boolean)
}
const allowed = (rules, command) => subcommands(command).every((sub) => rules.some((r) => matches(r, sub)))

test('the model agrees with the table in the docs', () => {
  for (const [rule, yes, no] of [
    ['npm run *', ['npm run build', 'npm run test --watch', 'npm run'], ['npm install']],
    ['git log * main', ['git log --oneline main', 'git log -5 main'], ['git log main', 'git push origin main']],
    ['git * main', ['git merge main', 'git -c core.fsmonitor=x diff main'], ['git log']],
    ['ls *', ['ls -la', 'ls'], ['lsof']],
    ['* --help *', ['npm --help x'], ['npm --help']],
  ]) {
    for (const c of yes) assert.ok(matches(rule, c), `${rule} should match ${c}`)
    for (const c of no) assert.ok(!matches(rule, c), `${rule} should not match ${c}`)
  }
  assert.ok(!allowed(['safe *'], 'safe x && other y'))
})

// ---- The list, read from run's own text.
const prereq = run.slice(run.indexOf('### Unattended prerequisites'), run.indexOf('### Parallel stories'))
const spansOf = (label) => {
  const at = prereq.indexOf(label)
  assert.ok(at >= 0, `no ${label} in "Unattended prerequisites"`)
  const end = /\.(\n| )/.exec(prereq.slice(prereq.indexOf(':', at)))
  const line = prereq.slice(prereq.indexOf(':', at), prereq.indexOf(':', at) + end.index)
  return [...line.matchAll(/`([^`]+)`/g)].map((m) => m[1])
}
const LEEWAY = spansOf('**Leeway verbs:**')
const GIT = spansOf('**git verbs,**').filter((s) => !s.startsWith('git -C'))
const leewayRule = (verb) => `${CLI} --server ${SERVER} ${verb} *`
const gitRule = (verb) => `git -C * ${verb} *`
const RULES = [
  ...LEEWAY.map(leewayRule),
  ...GIT.map(gitRule),
  'node -e *',
  'gh pr create *',
  'gh pr view *',
  'leeway-sdlc-wait-answer *',
  'leeway-sdlc-session-tokens *',
]

test('the list names the verbs of a run and nothing more', () => {
  assert.deepEqual(LEEWAY, [
    'issue get', 'issue list', 'issue update', 'issue create', 'comment add', 'iteration record', 'spend record',
    'escalation raise', 'escalation list', 'review get', 'project get', 'project link', 'process get',
  ])
  assert.deepEqual(GIT, ['add', 'commit', 'push', 'fetch', 'merge', 'merge-base', 'worktree', 'branch -d', 'ls-remote', 'rev-parse', 'diff', 'status', 'show'])
})

test('the verbs a run does not call miss every rule, so they prompt', () => {
  for (const verb of ['escalation answer', 'issue delete', 'product delete', 'process update', 'some new-verb']) {
    assert.ok(!LEEWAY.includes(verb), verb)
    assert.ok(!allowed(RULES, `${CLI} --server ${SERVER} ${verb} X --as a/agent --json`), `${verb} is allowed`)
  }
  assert.ok(!allowed(RULES, 'gh pr merge 3'), 'gh pr merge is allowed')
})

// ---- Every call run prints.
// A code span or a line of a fence. Not the read-only paragraph, which lists what a subagent may not do.
const denials = [run.indexOf('**How it reaches Leeway**, in these words'), run.indexOf('> **You never ask the user')]
const printed = (text) => {
  const spans = []
  text.split(/^\s*```.*$/m).forEach((part, i) => {
    if (i % 2) spans.push(...part.split('\n').map((l) => l.trim()).filter(Boolean))
    else spans.push(...[...part.matchAll(/`([^`]+)`/g)].map((m) => m[1].replace(/\s*\n\s*>?\s*/g, ' ')))
  })
  return spans
}
const list = [run.indexOf('- **A permission allow-list**'), run.indexOf('- **A pre-push guard')]
const body = run.slice(0, denials[0]) + run.slice(denials[1], list[0]) + run.slice(list[1])
const SPANS = printed(body)
// Fill a printed call in, as an orchestrator would.
const fill = (call) =>
  call
    .replace(/^leeway\b/, `${CLI} --server ${SERVER}`)
    .replace(/^<cli> --server <server>/, `${CLI} --server ${SERVER}`)
    .replace(/\s+#.*$/, '')
const stripRedirect = (c) => c.replace(/\s<[\w.-]*\.md$/, '')

test('every Leeway call run prints is verb first and on the list', () => {
  const calls = SPANS.filter((s) => /^leeway\s/.test(s) && !/^leeway login\b/.test(s))
  assert.ok(calls.length > 30, `only ${calls.length} calls found`)
  for (const call of calls) {
    const m = /^leeway ([a-z-]+) ([a-z-]+)/.exec(call)
    assert.ok(m, `not verb first: ${call}`)
    assert.ok(LEEWAY.includes(`${m[1]} ${m[2]}`), `off the list, so it prompts: ${call}`)
    const command = stripRedirect(fill(call))
    assert.ok(allowed(RULES, command), `no rule matches: ${command}`)
  }
})

test('a call printed with no leeway word in front is verb first and on the list too', () => {
  const resources = /^(issue|comment|iteration|spend|escalation|review|project|process|dependency|pr|product) ([a-z-]+)\b/
  const bare = SPANS.map((s) => resources.exec(s)).filter(Boolean)
  assert.ok(bare.length > 5, `only ${bare.length} found`)
  for (const m of bare) assert.ok(LEEWAY.includes(`${m[1]} ${m[2]}`), `off the list, so it prompts: ${m.input}`)
  for (const s of SPANS) assert.doesNotMatch(s, /^--as \S+ [a-z]/, `flags before the verb: ${s}`)
})

test('the reads a subagent is told to make are printed with the server, verb first', () => {
  const told = flat(run.slice(denials[0], denials[1])).replace(/ > /g, ' ')
  assert.match(told, /`<cli> --server <server> issue get <ref> --json`, `\.\.\. review get <ref> --json`, `\.\.\. escalation list <KEY> --json`/)
  for (const agent of ['sdlc-implementer', 'sdlc-reviewer']) {
    const text = read(`plugin/agents/${agent}.md`)
    assert.doesNotMatch(text, /^leeway --/m, agent)
    for (const c of ['issue get <ref> --json', 'review get <ref> --json', 'escalation list <KEY> --json']) {
      assert.ok(text.includes(`<cli> --server <server> ${c}`), `${agent}: ${c}`)
      assert.ok(allowed(RULES, `${CLI} --server ${SERVER} ${c}`), c)
    }
  }
})

test('every git call of run is git -C with a verb on the list', () => {
  const git = SPANS.filter((s) => /^git\s/.test(s))
  const own = git.filter((s) => s.startsWith('git -C ') && s !== 'git -C <absolute path>')
  assert.ok(own.length >= 10, `only ${own.length} found`)
  for (const call of own) {
    const m = /^git -C <[^>]+> ([a-z-]+)( -d)?/.exec(call)
    assert.ok(m, `not git -C <path> <verb>: ${call}`)
    assert.ok(GIT.includes(m[1] + (m[2] ?? '')), `off the list, so it prompts: ${call}`)
    assert.ok(allowed(RULES, fill(call)), `no rule matches: ${call}`)
  }
  // The brief's Verification section is named by its text and the guard's bullet names the push; no other span goes without -C.
  assert.deepEqual([...new Set(git.filter((s) => !s.startsWith('git -C ')))].sort(), ['git diff --cached --stat', 'git push', 'git status --short'])
})

test('the rest of what run runs matches: the scripts, the gh calls, the counting one-liner', () => {
  for (const c of [
    `leeway-sdlc-wait-answer --server ${SERVER} X e1 -- ${CLI}`,
    'leeway-sdlc-session-tokens --subagent-id abc',
    'leeway-sdlc-session-tokens --this-session --from 1 --to 2',
    `gh pr create --draft --base main --head plan --title "x" --body-file /r/.worktrees/.run/b.md`,
    'gh pr view x --json number,state,url',
    "node -e 'console.log(Date.now())'",
  ]) assert.ok(allowed(RULES, c), c)
  const oneLiner = SPANS.find((s) => /^leeway issue get <ref> --json \| node -e/.test(s))
  assert.ok(oneLiner, 'the counting one-liner is gone or not verb first')
  assert.ok(allowed(RULES, fill(oneLiner)))
})

test('the old forms miss, which is the bug: flags before the verb, no --server, or no -C', () => {
  assert.ok(!allowed(RULES, `${CLI} --server ${SERVER} --as a/agent --json spend record X 3`))
  assert.ok(!allowed(RULES, `${CLI} spend record X 3`))
  assert.ok(!matches('leeway spend record *', `leeway --server ${SERVER} --as a/agent --json spend record X 3`))
  assert.ok(!allowed(RULES, 'git commit -m x'))
})

test('the two weaknesses the install owns up to are real', () => {
  assert.ok(allowed(RULES, 'git -C /r -c core.fsmonitor=/tmp/x commit -m y'))
  assert.ok(allowed(RULES, 'git -C /r push origin main -m commit z'))
})

// ---- The plugin's bin/.
for (const [name, script] of [['leeway-sdlc-wait-answer', 'wait-answer.mjs'], ['leeway-sdlc-session-tokens', 'session-tokens.mjs']]) {
  test(`${name} runs ${script} and hands back its exit code`, { skip: process.platform === 'win32' }, () => {
    const bin = join(ROOT, 'plugin', 'bin', name)
    assert.ok(statSync(bin).mode & 0o111, 'not executable')
    const usage = spawnSync(bin, ['--nonsense'], { encoding: 'utf8' })
    assert.equal(usage.status, 1, usage.stderr)
    assert.match(usage.stderr, new RegExp(script.replace('.mjs', '')))
  })
}

test('leeway-sdlc-wait-answer exits 0 with the answer, through the bin wrapper', { skip: process.platform === 'win32' }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'allow-list-'))
  try {
    const fake = join(dir, 'fake.mjs')
    writeFileSync(fake, 'console.log(JSON.stringify({escalations:[{number:1,answer:{label:"A",note:"",by:"p"}}]}))\n')
    const r = spawnSync(join(ROOT, 'plugin', 'bin', 'leeway-sdlc-wait-answer'), ['--server', SERVER, 'X', 'e1', '--first', '0.01', '--', process.execPath, fake], { encoding: 'utf8' })
    assert.equal(r.status, 0, r.stderr)
    assert.deepEqual(JSON.parse(r.stdout), { label: 'A', note: '', by: 'p' })
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('other agents run the scripts from .sdlc/kit, where the build copies them, and get no bin/', () => {
  for (const t of TARGETS) {
    const text = harness(t, '0.0.0', 'notice')
    assert.match(text, /\*\*wait-answer:\*\* `node \.sdlc\/kit\/scripts\/wait-answer\.mjs`/, t.id)
    assert.match(text, /\*\*session-tokens:\*\* `node \.sdlc\/kit\/scripts\/session-tokens\.mjs`/, t.id)
    assert.match(flat(text), /UNVERIFIED: how .* matches a rule against a command with flags/, t.id)
  }
  assert.throws(() => statSync(join(ROOT, 'targets', 'agents', 'bin')))
  assert.ok(statSync(join(ROOT, 'targets', 'agents', 'skills', 'sdlc-install', 'kit', 'scripts', 'wait-answer.mjs')))
})

// ---- The prose. Each is checked by deleting it in a copy: see the brief.
export const PINS = [
  // Claude Code's rule forms, and what its harness tells the person before the yes.
  ['plugin/HARNESS.md', '`Bash(<cli> --server <server> <verb> *)`'],
  ['plugin/HARNESS.md', '| a git verb | `Bash(git -C * <verb> *)`, for example `Bash(git -C * commit *)` |'],
  ['plugin/HARNESS.md', '`Bash(leeway-sdlc-wait-answer *)`, `Bash(leeway-sdlc-session-tokens *)`'],
  ['plugin/HARNESS.md', '`Edit(/.worktrees/**)`, which also covers the `Write` tool'],
  ['plugin/HARNESS.md', "so a call with flags before the verb, or with no `--server`, misses and prompts"],
  ['plugin/HARNESS.md', 'so start the session at the repo root'],
  ['plugin/HARNESS.md', 'for a `claude -p` run, use `.claude/settings.local.json`, untracked, or the rules do not apply'],
  ['plugin/HARNESS.md', 'shows a startup warning, "allows any option at its *": thirteen rows below the banner at every session start (twelve while `git push` is off the list)'],
  ['plugin/HARNESS.md', '`-c core.fsmonitor=<script>` runs a program'],
  ['plugin/HARNESS.md', '`git -C <path> push origin main -m commit z` matches the `commit` rule'],
  ['plugin/HARNESS.md', 'It adds little over what the list already allows: `node -e` and the lane commands can already run any program'],
  ['plugin/HARNESS.md', "claude.ai and Cowork don't install a plugin with a top-level `bin/`"],
  ['plugin/HARNESS.md', '**wait-answer:** `leeway-sdlc-wait-answer`'],
  ['plugin/HARNESS.md', '**session-tokens:** `leeway-sdlc-session-tokens`'],
  ['README.md', "claude.ai and Cowork don't install a plugin that has one"],
  // The install says it before the yes.
  ['plugin/skills/sdlc-install/SKILL.md', '**Before the yes, tell the person what it approves and what it leaves open**'],
  ['plugin/skills/sdlc-install/SKILL.md', '`HARNESS.md`, "Say before the yes", lists for this agent (on Claude Code, the startup warnings, what the git rules also approve, and why that adds little)'],
  ['plugin/skills/sdlc-install/SKILL.md', 'A rule stops the call an agent ordinarily writes, not a determined one.'],
  ['plugin/skills/sdlc-install/SKILL.md', '`node -e` and the lane commands can run anything, including `leeway escalation answer`'],
  ['plugin/skills/sdlc-install/SKILL.md', '`leeway-guard` does not govern the orchestrator, so an orchestrator could answer its own escalation without a prompt'],
  ['plugin/skills/sdlc-install/SKILL.md', 'An improvised command off the list still prompts, so a yes does not promise a run with no prompt.'],
  ['plugin/skills/sdlc-install/SKILL.md', 'No real unattended run has yet tried this list on a fresh install.'],
  ['plugin/skills/sdlc-install/SKILL.md', 'the rules of its table in `permissions.allow` of `.claude/settings.json`'],
  ['plugin/skills/sdlc-install/SKILL.md', 'an allow-list added (the startup warnings at each session, and what question 16 said it leaves open)'],
  // An existing list.
  ['plugin/skills/sdlc-install/references/detection.md', '**Dead, matches nothing `run` prints:**'],
  ['plugin/skills/sdlc-install/references/detection.md', '`Bash(leeway spend record:*)`'],
  ['plugin/skills/sdlc-install/references/detection.md', "a kit script's per-version path"],
  ['plugin/skills/sdlc-install/references/detection.md', '**Too wide:**'],
  ['plugin/skills/sdlc-install/references/detection.md', 'while it stays, `escalation answer`, the deletes and any new CLI verb run with no prompt'],
  ['plugin/skills/sync-repo/SKILL.md', 'whose question 16 adds the new ones'],
  // run, and the plugin's general form.
  ['plugin/skills/run/SKILL.md', '**Every call is printed verb first**'],
  ['plugin/skills/run/SKILL.md', "**Where `run`'s own files go.**"],
  ['plugin/skills/run/SKILL.md', 'goes in `.worktrees/.run/` of the primary checkout, named after the ref and passed by absolute path'],
  ['plugin/skills/run/SKILL.md', 'Any other verb prompts: `escalation answer`, `issue delete`, `product delete`, `process update`, and any verb a later CLI adds.'],
  ['plugin/skills/run/SKILL.md', 'An improvised command, one an agent makes up that is not on the list, still prompts'],
  ['plugin/skills/run/SKILL.md', '`node -e` and the lane commands can run anything, including `leeway escalation answer`, and `leeway-guard` does not govern the orchestrator'],
  ['plugin/skills/run/SKILL.md', 'A rule stops the call an agent ordinarily writes, not a determined one.'],
  ['plugin/skills/run/SKILL.md', "**You never answer your own escalation:** an answer is the person's"],
  ['plugin/PROCESS.md', '`<cli> --server <server> <resource> <verb> <args> --as <alias>/<role> --json`'],
  ['plugin/PROCESS.md', 'an attended skill that still prints them before the verb works: it only prompts'],
  ['plugin/agents/sdlc-implementer.md', '`cd <path> && git` included, and a prompt stops the run'],
  ['plugin/agents/sdlc-reviewer.md', 'Anything else prompts, `cd <path> && git` included.'],
]

test('the prose carries what the install owes', () => {
  for (const [path, needle] of PINS) assert.ok(flat(read(path)).includes(needle), `${path} no longer says: ${needle}`)
})
