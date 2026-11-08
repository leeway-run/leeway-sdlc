// What sdlc-install's allow-list names, against what run prints (LWY-157). A rule matches the text before its first `*`
// as written, so this checks every call run prints against the list by the rule Claude Code documents ("Configure
// permissions", "Wildcard patterns" and "Compound commands"). The matcher is a model of those docs, not Claude Code.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative } from 'node:path'
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
// Read-only by Claude Code's built-in set, so they take no rule. Only the ones a printed call uses.
const READ_ONLY = /^(echo|pwd|cd|date)( |$)/
const allowed = (rules, command) => {
  const subs = subcommands(command)
  // "cd with git prompts": a cd that changes directory, before any git in the same command.
  if (subs.some((s) => /^cd\s/.test(s)) && subs.some((s) => /^git\s/.test(s))) return false
  return subs.every((sub) => READ_ONLY.test(sub) || rules.some((r) => matches(r, sub)))
}

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
  // A compound lane: one rule per part, a rule holding && never matches, and cd is fine before a lane but not before git.
  assert.ok(allowed(['npm run lint *', 'npm test *'], 'npm run lint && npm test'))
  assert.ok(!allowed(['npm run lint && npm test *'], 'npm run lint && npm test'))
  assert.ok(allowed(['npm test *'], 'cd /w && npm test'))
  assert.ok(!allowed(['git -C * tag *', 'git tag *'], 'cd /w && git tag x'))
})

// ---- The list, read from run's own text, and the rules, read from the table the install writes.
const prereq = run.slice(run.indexOf('### Unattended prerequisites'), run.indexOf('### Parallel stories'))
const spansIn = (text) => [...text.matchAll(/`([^`]+)`/g)].map((m) => m[1])
const spansOf = (label) => {
  const at = prereq.indexOf(label)
  assert.ok(at >= 0, `no ${label} in "Unattended prerequisites"`)
  const end = /\.(\n| )/.exec(prereq.slice(prereq.indexOf(':', at)))
  return spansIn(prereq.slice(prereq.indexOf(':', at), prereq.indexOf(':', at) + end.index))
}
const REST = flat(prereq.slice(prereq.indexOf('**The rest:**'), prereq.indexOf('**What the list cannot promise.**')))
const LEEWAY = spansOf('**Leeway verbs:**')
const GIT = spansOf('**git verbs,**')

const permissions = claudeHarness.slice(claudeHarness.indexOf('## Permissions for an unattended run'), claudeHarness.indexOf('## Installed version'))
const TEMPLATES = permissions
  .split('\n')
  .filter((l) => l.startsWith('| ') && !l.startsWith("| run's"))
  .flatMap((l) => spansIn(l.split(' | ')[1].split(', for example')[0]))
  .filter((s) => /^(Bash|Read|Edit)\(/.test(s))
const LANE = 'mylane'
const expand = (template) => {
  const inner = template.slice('Bash('.length, -1)
  if (inner.includes('<cli>')) return LEEWAY.map((v) => inner.replace('<cli>', CLI).replace('<server>', SERVER).replace('<verb>', v))
  if (inner.includes('<verb>')) return GIT.map((v) => inner.replace('<verb>', v))
  if (inner.includes('<command>')) return [inner.replace('<command>', LANE)]
  return [inner]
}
const RULES = TEMPLATES.filter((r) => r.startsWith('Bash(')).flatMap(expand)

test('the list names the verbs of a run and nothing more', () => {
  assert.deepEqual(LEEWAY, [
    'issue get', 'issue list', 'issue update', 'issue create', 'comment add', 'iteration record', 'spend record',
    'escalation list', 'clarification answer', 'clarification list', 'review get', 'project get', 'project link', 'process get',
  ])
  assert.deepEqual(GIT, ['add', 'commit', 'push', 'fetch', 'merge', 'merge-base', 'worktree', 'branch -d', 'ls-remote', 'rev-parse', 'diff', 'status', 'show', 'log', 'blame'])
  assert.deepEqual(spansIn(REST), ['.sdlc/CONFIG.md', 'node -e', 'gh pr create', 'gh pr view', '<wait-answer>', '<session-tokens>', '<raise>', '.worktrees/', 'run', 'run'])
  assert.match(REST, /the lane and setup commands/)
  assert.match(REST, /reads of this plugin's own files/)
})

test('the table the install writes holds these rules and no other', () => {
  assert.deepEqual(TEMPLATES, [
    'Bash(<cli> --server <server> <verb> *)',
    'Bash(git -C * <verb> *)',
    'Bash(<command> *)',
    'Bash(node -e *)',
    'Bash(gh pr create *)',
    'Bash(gh pr view *)',
    'Bash(leeway-sdlc-wait-answer *)',
    'Bash(leeway-sdlc-session-tokens *)',
    'Bash(leeway-sdlc-raise *)',
    'Edit(/.worktrees/**)',
    'Read(~/.claude/plugins/cache/*/leeway-sdlc/**)',
  ])
})

test('no rule the harness names stops at the server, the wide form the person turned down', () => {
  for (const m of claudeHarness.matchAll(/Bash\(([^`]*)\)/g)) assert.doesNotMatch(m[1], /--server \S+ \*$/, m[0])
  assert.ok(!RULES.some((r) => /--server \S+ \*$/.test(r)))
})

test('the count of warnings the person is told is the count of git rules', () => {
  const words = { 13: 'thirteen', 14: 'fourteen', 15: 'fifteen', 16: 'sixteen' }
  const text = flat(permissions)
  assert.ok(text.includes(`${words[GIT.length]} rows below the banner`), 'HARNESS.md: the warning count moved')
  assert.ok(text.includes(`(${words[GIT.length - 1]} while \`git push\` is off the list)`), 'HARNESS.md: the count without push moved')
  const question = flat(read('plugin/skills/sdlc-install/SKILL.md'))
  const branch = (from, to) => {
    const [start, end] = [question.indexOf(from), question.indexOf(to)]
    assert.ok(start !== -1 && end !== -1, `question 16: no ${start === -1 ? from : to}`)
    return question.slice(start, end)
  }
  const guarded = branch('**A guard found:**', '**No guard found:**')
  const unguarded = branch('**No guard found:**', '**No guard found, and a push rule already there:**')
  const wide = branch('**No guard found, and a push rule already there:**', 'Then, either way, what no list closes.')
  assert.ok(guarded.includes(`the ${words[GIT.length]} startup warnings`), 'question 16, with a guard: the count moved')
  assert.ok(unguarded.includes(`the ${words[GIT.length - 1]} startup warnings`), 'question 16, with no guard: the count moved')
  assert.ok(guarded.includes('that those rules let a push skip the pre-push guard'), 'question 16, with a guard: the skip')
  assert.ok(!unguarded.includes('skip the pre-push guard'), 'question 16, with no guard: there is no guard to skip')
  assert.ok(unguarded.includes('so every push prompts'), 'question 16, with no guard: every push prompts')
  assert.ok(wide.includes(`the ${words[GIT.length]} startup warnings`), 'question 16, with a push rule and no guard: the rule counts')
  assert.ok(!/stays off|every push prompts|attended/.test(wide), 'question 16, with a push rule and no guard: pushes do not prompt')
  const offer = branch('**The offer, on a yes with no guard found.**', '**A hook or `core.hooksPath` in the way:**')
  assert.ok(offer.includes(`the ${words[GIT.length]} startup warnings`), 'the offer, taken: the rule counts')
  assert.ok(offer.includes(`${words[GIT.length - 1]} startup warnings, every push prompts, and the run is attended`), 'the offer, declined')
})

test('the Read rule reaches the plugin files run reads first, and nothing beside them', () => {
  const pattern = TEMPLATES.find((r) => r.startsWith('Read(')).slice('Read('.length, -1)
  const esc = (s) => s.replace(/[.+?^${}()|[\]\\/]/g, '\\$&')
  const re = new RegExp(`^${pattern.split('**').map((p) => p.split('*').map(esc).join('[^/]*')).join('.*')}$`)
  for (const f of ['HARNESS.md', 'PROCESS.md', 'craft/HOW-WE-CHANGE-CODE.md', 'skills/run/templates/BRIEF.md', 'skills/run/templates/VERDICT.md']) {
    assert.ok(statSync(join(ROOT, 'plugin', f)), f)
    assert.match(`~/.claude/plugins/cache/leeway/leeway-sdlc/0.3.0/${f}`, re)
  }
  assert.doesNotMatch('~/.claude/plugins/cache/cloudflare/cloudflare/1.0.3/plugin.json', re)
  assert.doesNotMatch('~/.claude/plugins/known_marketplaces.json', re)
})

test('the verbs a run does not call miss every rule, so they prompt', () => {
  for (const verb of ['escalation raise', 'escalation answer', 'issue delete', 'product delete', 'process update', 'some new-verb']) {
    assert.ok(!LEEWAY.includes(verb), verb)
    assert.ok(!allowed(RULES, `${CLI} --server ${SERVER} ${verb} X --as a/agent --json`), `${verb} is allowed`)
  }
  for (const c of ['gh pr merge 3', 'gh repo delete x', 'rm -rf /w', 'mv a b', 'mkdir -p /w/x', 'git -C /w tag x', 'git -C /w switch -c y']) {
    assert.ok(!allowed(RULES, c), `${c} is allowed`)
  }
})

// ---- Every call the plugin prints where a run reads it: run, its two templates, PROCESS.md and both agent files.
// A sh fence is commands. A fence with no language holds "$ " lines and placeholders. A markdown fence is an example of a
// comment, so it reads as prose, and its "$ " lines still count. A json fence is a file's content, an escalation's fields, never run. Any other fence is one this cannot read, so it fails.
// A blank line ends a paragraph, so a stray backtick in prose spoils no more than that.
// A line of prose can be a command with no backticks: an indented block, or a line of an example.
const LINE_PROGRAM = /^(?:[A-Z_]+=\S* )?(?:git|leeway|gh|rm|mv|cp|sed|mkdir|chmod|touch|npm|npx|pnpm|yarn|curl|xargs|node|python3?|bash|sh|cat|env)\s/
const FENCES = ['', 'sh', 'bash', 'markdown', 'json']
const parse = (text) => {
  const found = { shell: [], dollar: [], other: [], lines: [], unread: [] }
  const prose = []
  const asProse = (line, example) => {
    prose.push(line)
    if ((example || /^ {4}/.test(line)) && LINE_PROGRAM.test(line.trim())) found.lines.push(line.trim())
  }
  let fence = null
  for (const raw of text.split('\n')) {
    const line = raw.replace(/^\s*>\s?/, '')
    const mark = /^\s*(`{3,})([\w-]*)\s*$/.exec(line)
    if (fence) {
      if (mark && mark[1].length >= fence.ticks && !mark[2]) fence = null
      else if (/^\s*\$ /.test(line)) found.dollar.push(line.trim().slice(2))
      else if (fence.lang === 'sh' || fence.lang === 'bash') found.shell.push(line.trim())
      else if (fence.lang === 'markdown') asProse(line, true)
      else if (fence.lang === 'json') continue
      else if (!fence.lang) found.other.push(line.trim())
    } else if (mark) {
      fence = { ticks: mark[1].length, lang: mark[2] }
      if (!FENCES.includes(mark[2])) found.unread.push(line.trim())
    } else if (/^\s*(~{3,}|`{3,}[^`]*$)/.test(line)) found.unread.push(line.trim())
    else asProse(line)
  }
  const spans = prose.join('\n').split(/\n\s*\n/).flatMap((p) => spansIn(p).map((s) => flat(s).trim()))
  return { shell: found.shell.filter(Boolean), dollar: found.dollar, other: found.other.filter(Boolean), lines: found.lines, unread: found.unread, spans }
}

// In run, the read-only paragraph lists what a subagent may not do, and the list section names what prompts.
const denials = [run.indexOf('**How it reaches Leeway**, in these words'), run.indexOf('> **You never ask the user')]
const list = [run.indexOf('- **A permission allow-list**'), run.indexOf('- **A pre-push guard')]
const PARSED = Object.entries({
  run: run.slice(0, denials[0]) + run.slice(denials[1], list[0]) + run.slice(list[1]),
  BRIEF: read('plugin/skills/run/templates/BRIEF.md'),
  VERDICT: read('plugin/skills/run/templates/VERDICT.md'),
  PROCESS: read('plugin/PROCESS.md'),
  implementer: read('plugin/agents/sdlc-implementer.md'),
  reviewer: read('plugin/agents/sdlc-reviewer.md'),
}).map(([name, text]) => ({ name, ...parse(text) }))
const parsed = (name) => PARSED.find((p) => p.name === name)

// Those two sections name forms without calling them, so they are held to exactly what they name: a new span goes red.
test('the two sections the scan leaves out name these spans and no other', () => {
  assert.deepEqual(spansIn(run.slice(denials[0], denials[1])).map((s) => flat(s.replace(/\n\s*>/g, ''))), [
    '--as', '<cli> --server <server> issue get <ref> --json', '... review get <ref> --json', '... escalation list <KEY> --json',
    "git -C <the worktree's absolute path>", 'cd <path> && git', 'cd <worktree> && <lane>',
    'issue create', 'update', 'comment add', 'iteration record', 'escalation raise', 'answer', 'dependency', 'pr link', 'project', 'process', 'login',
    'leeway-guard', 'git -C <worktree> add', 'Head sha', 'pending',
  ])
  assert.deepEqual(spansIn(run.slice(list[0], list[1])), [
    'HARNESS.md', ...LEEWAY, 'escalation raise', '<raise>', 'escalation answer', 'issue delete', 'product delete', 'process update', 'leeway-guard', 'PROCESS.md',
    'git -C <absolute path> <verb>', ...GIT, ...spansIn(REST),
    'node -e', 'leeway escalation answer', 'leeway-guard', 'gh pr merge', 'main', 'main',
  ])
})

// Fill a printed call in, as an orchestrator would.
const fill = (call) =>
  call
    .replace(/\s+#\s.*$/, '')
    .replace(/\s<[\w.-]*\.md$/, '')
    .replace(/^leeway\b/, `${CLI} --server ${SERVER}`)
    .replace(/^<cli> --server <server>/, `${CLI} --server ${SERVER}`)
    .replace(/^<wait-answer>/, 'leeway-sdlc-wait-answer')
    .replace(/^<session-tokens>/, 'leeway-sdlc-session-tokens')
    .replace(/^<raise>/, 'leeway-sdlc-raise')
    .replace(/<(lane|gate command|setup command)>/g, `${LANE} x`)
    .replace(/<[^<>]+>/g, 'x')

// What `subcommands` does not split runs too, so it is not a call to read as allowed: a single &, $(, <(, backticks and >.
// Single quotes hold all of these; double quotes hold only &, <( and >.
const shellTrick = (command) => {
  let quote = null
  for (let i = 0; i < command.length; i++) {
    const c = command[i]
    if (quote === "'") {
      if (c === "'") quote = null
      continue
    }
    if (c === '`' || (c === '$' && command[i + 1] === '(')) return c === '`' ? 'backticks' : '$('
    if (c === '"') quote = quote ? null : '"'
    else if (c === "'" && !quote) quote = "'"
    else if (!quote && c === '>') return '>'
    else if (!quote && c === '<' && command[i + 1] === '(') return '<('
    else if (!quote && c === '&') {
      if (command[i + 1] !== '&') return '&'
      i++
    }
  }
  return null
}

// What a call must be, beyond matching a rule: verb first and on the list, or -C with a verb on the list.
const wrongWith = (call) => {
  const filled = fill(call)
  const trick = shellTrick(filled)
  if (trick) return `${trick} in a call: what follows it is not checked`
  for (const sub of subcommands(filled)) {
    if (/^git\s/.test(sub)) {
      const m = /^git -C \S+ ([a-z-]+)( -d)?/.exec(sub)
      if (!m) return 'not git -C <path> <verb>'
      if (!GIT.includes(m[1] + (m[2] ?? ''))) return `git verb off the list: ${m[1]}`
    }
    if (sub.startsWith(`${CLI} `)) {
      const m = /^\S+ --server \S+ ([a-z-]+) ([a-z-]+)/.exec(sub)
      if (!m) return 'not verb first'
      if (!LEEWAY.includes(`${m[1]} ${m[2]}`)) return 'off the list'
    }
  }
  return allowed(RULES, filled) ? null : 'no rule matches, so it prompts'
}

test('a fence this cannot read fails, and so does a command with no backticks', () => {
  for (const { name, unread, lines } of PARSED) {
    assert.deepEqual(unread, [], `${name}: a fence that is not sh, bash, markdown or plain`)
    for (const line of lines) assert.equal(wrongWith(line), null, `${name}: ${line}`)
  }
  for (const fence of ['```shell\nrm x\n```', '```console\nrm x\n```', '~~~sh\nrm x\n~~~', '```sh title=x\nrm x\n```']) assert.ok(parse(fence).unread.length, fence)
  assert.deepEqual(parse('text\n\n    rm -rf x\n\n```markdown\ngit tag x\n```').lines, ['rm -rf x', 'git tag x'])
  assert.deepEqual(parse('```markdown\nsee `git tag x`\n```').spans, ['git tag x'])
})

test('every line of a sh fence is a call a rule matches, and any other program fails', () => {
  let n = 0
  for (const { name, shell } of PARSED) {
    for (const line of shell) {
      n++
      assert.equal(wrongWith(line), null, `${name}: ${line}`)
    }
  }
  assert.ok(n > 40, `only ${n} fence lines found`)
})

test('a "$ " line of a template is a call a rule matches, and a fence with no language holds nothing else', () => {
  let n = 0
  for (const { name, dollar, other } of PARSED) {
    for (const line of dollar) {
      n++
      assert.equal(wrongWith(line), null, `${name}: $ ${line}`)
    }
    for (const line of other) assert.match(line, /^(<[^>]+>|### )/, `${name}: a command in a fence with no language: ${line}`)
  }
  assert.ok(n >= 8, `only ${n} found`)
})

// A span whose first word is a program is a call. These name a form, to say it is refused or off the list.
const NAMED = [
  /^git -C <[^>]+>$/, // the form, with no verb
  /^<cli> --server <server>$/, // what `leeway` stands for
  /^cd <path> && git$/,
  /^leeway login( --server <server>)?$/, // a person's, at a blocker
  /^gh pr merge\b/, // on the person's word
  /^node (<path>|\/path\/to)\/leeway\.js$/, // a value of cli:
  /^<cli> --server <server> <resource> <verb> <args>/, // the general form in PROCESS.md
  /^(npm test|node scripts\/lint-docs\.mjs)$/, // an invented repo's lane, in a template's example
]
// Any other span of two words or more whose first word could be a program is a call, so an unknown program fails.
const PROGRAM = /^(?:[a-z][\w.+-]*|[.\/$(]\S*|[A-Za-z_]+=\S*|<cli>|<wait-answer>|<session-tokens>|<raise>)\s/
const NOT_CALLS = new RegExp(`^(?:${[
  'issue', 'comment', 'iteration', 'spend', 'escalation', 'review', 'project', 'process', 'dependency', 'pr', 'product', // a Leeway verb with no program: the next test
  'merge-base', 'rev-parse', 'status', 'worktree', 'branch', // a git verb named on its own
  'it\\.\\S+', 'round', 'the', 'of', 'at', 'end', 'none', 'input_tokens', 'step_set', 'linted', 'skips', // an anchor, a formula, an example's words
  '\\$\\(\\(', '\\(round', '\\.worktrees/<\\S+', // arithmetic, an aside, a path with a placeholder of two words
].join('|')})\\s`)

test('every code span that is a call is one a rule matches', () => {
  const seen = { git: 0, leeway: 0 }
  for (const { name, spans } of PARSED) {
    for (const s of spans) {
      if (!PROGRAM.test(s) || NOT_CALLS.test(s) || NAMED.some((re) => re.test(s))) continue
      if (s.startsWith('git ')) seen.git++
      if (s.startsWith('leeway ')) seen.leeway++
      const wrong = wrongWith(s)
      assert.equal(wrong, null, `${name}: ${s}: ${wrong}. A call a rule misses, or prose: if prose, add its first word to NOT_CALLS`)
    }
  }
  assert.ok(seen.leeway > 20, `only ${seen.leeway} leeway calls`)
  assert.ok(seen.git > 10, `only ${seen.git} git calls`)
})

test('a span starting with a path, a variable, a subshell or an assignment is read as a call, and fails', () => {
  for (const s of ['./scripts/x.sh --force', '/bin/rm -rf x', '$LEEWAY issue delete X', '(cd x && rm y)', 'foo=1 git tag x']) {
    assert.ok(PROGRAM.test(s), s)
    assert.notEqual(wrongWith(s), null, s)
  }
  assert.equal(shellTrick('git -C x diff <(rm y)'), '<(')
  assert.equal(shellTrick("git -C x diff '<(rm y)'"), null)
})

test('a call printed with no leeway word in front is verb first and on the list too', () => {
  const resources = /^(issue|comment|iteration|spend|escalation|review|project|process|dependency|pr|product) ([a-z-]+)\b/
  const { spans } = parsed('run')
  const bare = spans.map((s) => resources.exec(s)).filter(Boolean)
  assert.ok(bare.length > 5, `only ${bare.length} found`)
  for (const m of bare) assert.ok(LEEWAY.includes(`${m[1]} ${m[2]}`), `off the list, so it prompts: ${m.input}`)
  for (const s of spans) assert.doesNotMatch(s, /^--as \S+ [a-z]/, `flags before the verb: ${s}`)
})

test('the reads a subagent is told to make are printed with the server, verb first', () => {
  const told = flat(run.slice(denials[0], denials[1])).replace(/ > /g, ' ')
  assert.match(told, /`<cli> --server <server> issue get <ref> --json`, `\.\.\. review get <ref> --json`, `\.\.\. escalation list <KEY> --json`/)
  for (const agent of ['implementer', 'reviewer']) {
    for (const c of ['issue get <ref> --json', 'review get <ref> --json', 'escalation list <KEY> --json']) {
      assert.ok(parsed(agent).shell.includes(`<cli> --server <server> ${c}`), `${agent}: ${c}`)
    }
  }
})

test('the story gate prints its lines in this order, as one block', () => {
  const block = [
    'git -C <story worktree> push -u origin <story branch>',
    'git -C <primary> fetch origin <base>',
    'git -C <primary> worktree add --detach <primary>/.worktrees/merge-<story> origin/<base>',
    'git -C <primary>/.worktrees/merge-<story> merge-base --is-ancestor HEAD <story branch>',
    'git -C <primary>/.worktrees/merge-<story> merge --no-ff -F <message file> <story branch>',
    'git -C <primary>/.worktrees/merge-<story> push origin HEAD:<base>',
    'git -C <primary> worktree remove <primary>/.worktrees/merge-<story>',
    'git -C <primary> worktree remove <story worktree>',
  ].join('\n   ')
  assert.ok(run.includes(`\n   ${block}\n   \`\`\`\n`), 'the gate lines moved, or something came between them')
})

test('the steps run used to leave unprinted are printed, so the checks above cover them', () => {
  const { shell, spans } = parsed('run')
  for (const c of [
    'git -C <primary> fetch origin <integration branch>',
    'git -C <primary> worktree add -b <plan branch> <primary>/.worktrees/<plan branch> origin/<integration branch>',
    'git -C <primary>/.worktrees/<plan branch> push -u origin <plan branch>',
    'git -C <primary> worktree remove <primary>/.worktrees/<plan branch>',
    'git -C <primary> worktree add -b <story branch> <story worktree> origin/<base>',
    'git -C <primary> worktree add -b <task branch> <task worktree> <story branch>',
    'git -C <story worktree> fetch origin <base>',
    'git -C <story worktree> merge --no-edit origin/<base>',
    'cd <story worktree> && <gate command>',
    'git -C <story worktree> push -u origin <story branch>',
    'git -C <primary> worktree add --detach <primary>/.worktrees/merge-<story> origin/<base>',
    'git -C <primary>/.worktrees/merge-<story> merge-base --is-ancestor HEAD <story branch>',
    'git -C <primary>/.worktrees/merge-<story> merge --no-ff -F <message file> <story branch>',
    'git -C <primary>/.worktrees/merge-<story> push origin HEAD:<base>',
    'git -C <primary> merge-base --is-ancestor origin/<base> <story branch>',
    'git -C <primary> worktree remove <primary>/.worktrees/merge-<story>',
    'git -C <primary> worktree remove <story worktree>',
    'git -C <primary> worktree remove <task worktree>',
    'git -C <primary> branch -d <task branch>',
  ]) assert.ok(shell.includes(c) || spans.includes(c), `no longer printed: ${c}`)
})

test('the forms an agent needs for a delete, a rename and a mutation are printed', () => {
  const implementer = parsed('implementer').shell
  for (const c of [
    `node -e 'require("fs").rmSync("<absolute path>")'`,
    `node -e 'require("fs").renameSync("<absolute from>","<absolute to>")'`,
    `node -e 'require("fs").chmodSync("<absolute path>",0o755)'`,
    'git -C <worktree> add <paths>',
  ]) assert.ok(implementer.includes(c), c)
  const reviewer = parsed('reviewer').shell
  assert.ok(reviewer.includes(`node -e 'const fs=require("fs"),f="<absolute path>",s=fs.readFileSync(f,"utf8"),t=s.replace("<what it guards>","<broken>");if(t===s)throw new Error("no change: text not found");fs.copyFileSync(f,f+".keep");fs.writeFileSync(f,t)'`), 'the mutation, which fails when the text is not found')
  assert.ok(reviewer.includes(`node -e 'const fs=require("fs"),f="<absolute path>";fs.renameSync(f+".keep",f)'`), 'the restore')
  for (const agent of ['implementer', 'reviewer']) assert.ok(!parsed(agent).spans.some((s) => /\bfetch\b/.test(s)), `${agent}: a subagent's only git write is add`)
  assert.ok(reviewer.includes('cd <worktree> && <lane>'), 'the lane')
  assert.ok(reviewer.includes('git -C <worktree> status --short'), 'the check of the restore')
})

test('the rest of what run runs matches: the scripts, the gh calls, the counting one-liner', () => {
  for (const c of [
    `leeway-sdlc-wait-answer --server ${SERVER} X e1 -- ${CLI}`,
    'leeway-sdlc-session-tokens --subagent-id abc',
    'leeway-sdlc-session-tokens --this-session --from 1 --to 2',
    `leeway-sdlc-raise --server ${SERVER} --as a/agent X /r/.worktrees/.run/x-fields.json -- ${CLI}`,
    `gh pr create --draft --base main --head plan --title "x" --body-file /r/.worktrees/.run/b.md`,
    'gh pr view x --json number,state,url',
    "node -e 'console.log(Date.now())'",
    `cd /w && ${LANE} x`,
  ]) assert.ok(allowed(RULES, c), c)
  assert.ok(parsed('run').shell.some((s) => /^leeway issue get <ref> --json \| node -e/.test(s)), 'the counting one-liner is gone or not verb first')
})

test('the old forms miss, which is the bug: flags before the verb, no --server, or no -C', () => {
  assert.ok(!allowed(RULES, `${CLI} --server ${SERVER} --as a/agent --json spend record X 3`))
  assert.ok(!allowed(RULES, `${CLI} spend record X 3`))
  assert.ok(!matches('leeway spend record *', `leeway --server ${SERVER} --as a/agent --json spend record X 3`))
  assert.ok(!allowed(RULES, 'git commit -m x'))
})

test('the weaknesses the install owns up to are real', () => {
  assert.ok(allowed(RULES, 'git -C /r -c core.fsmonitor=/tmp/x commit -m y'))
  assert.ok(allowed(RULES, 'git -C /r push origin main -m commit z'))
  assert.ok(allowed(RULES, 'git -C /r push --no-verify origin main'))
  assert.ok(allowed(RULES, 'git -C /r -c core.hooksPath=/dev/null push origin main'))
})

test('a git verb with nothing after it misses, as the agents are told', () => {
  for (const verb of GIT.filter((v) => v !== 'branch -d')) {
    assert.ok(!allowed(RULES, `git -C /w ${verb}`), verb)
    assert.ok(allowed(RULES, `git -C /w ${verb} x`), verb)
  }
})

// ---- The plugin's bin/.
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
  const dir = mkdtempSync(join(tmpdir(), 'allow-list-'))
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
    const dir = mkdtempSync(join(tmpdir(), 'allow-list-'))
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
    assert.match(flat(text), /UNVERIFIED: how .* matches a rule against a command with flags/, t.id)
  }
  assert.throws(() => statSync(join(ROOT, 'targets', 'agents', 'bin')))
  assert.ok(statSync(join(ROOT, 'targets', 'agents', 'skills', 'sdlc-install', 'kit', 'scripts', 'wait-answer.mjs')))
  assert.ok(statSync(join(ROOT, 'targets', 'agents', 'skills', 'sdlc-install', 'kit', 'scripts', 'raise.mjs')))
})

// ---- The prose. Each is checked by deleting it in a copy: see the brief.
export const PINS = [
  // Claude Code's rule forms, and what its harness tells the person before the yes.
  ['plugin/HARNESS.md', '`Bash(<cli> --server <server> <verb> *)`'],
  ['plugin/HARNESS.md', '| a git verb | `Bash(git -C * <verb> *)`, for example `Bash(git -C * commit *)` |'],
  ['plugin/HARNESS.md', '`Bash(leeway-sdlc-wait-answer *)`, `Bash(leeway-sdlc-session-tokens *)`, `Bash(leeway-sdlc-raise *)`'],
  ['plugin/HARNESS.md', '`Edit(/.worktrees/**)`, which also covers the `Write` tool'],
  ['plugin/HARNESS.md', "so a call with flags before the verb, or with no `--server`, misses and prompts"],
  ['plugin/HARNESS.md', 'so start the session at the repo root'],
  ['plugin/HARNESS.md', 'for a `claude -p` run, use `.claude/settings.local.json`, untracked, or the rules do not apply'],
  ['plugin/HARNESS.md', 'shows a startup warning, "allows any option at its *": fifteen rows below the banner at every session start (fourteen while `git push` is off the list)'],
  ['plugin/HARNESS.md', '`-c core.fsmonitor=<script>` runs a program'],
  ['plugin/HARNESS.md', '`git -C <path> push origin main -m commit z` matches the `commit` rule'],
  ['plugin/HARNESS.md', 'A plugin loaded with `--plugin-dir` is read from wherever that is, and no rule here covers it.'],
  ['plugin/HARNESS.md', 'With no pre-push guard in the repo (sdlc-install\'s detection, "A pre-push guard"), `git push` is off the list: every push prompts, so the run is attended'],
  ['plugin/HARNESS.md', 'On a yes, the install offers to write one in `.git/hooks`, and a no to that leaves this.'],
  ['plugin/HARNESS.md', 'A git verb needs at least one argument to match.'],
  ['plugin/HARNESS.md', '**A compound lane takes one rule per part,**'],
  ['plugin/HARNESS.md', '**A lane runs in a worktree as `cd <worktree> && <lane>`,** which is allowed where `cd <path> && git` is not.'],
  ['plugin/HARNESS.md', 'With `CLAUDE_CONFIG_DIR` set, the cache is under that directory, not `~/.claude`'],
  ['plugin/HARNESS.md', '`Read(//<that directory, with no leading slash>/plugins/cache/*/leeway-sdlc/**)`'],
  ['plugin/HARNESS.md', 'all prompt without the `Read` rule, on an enabled plugin too'],
  ['plugin/HARNESS.md', 'An agent does these through `node -e`'],
  ['plugin/HARNESS.md', '`Bash(git -C * push *)` approves both, so a guard stops the push an agent ordinarily writes, not a determined one, and only a guard that decides from the refs on its stdin (sdlc-install\'s detection, "A pre-push guard") does that: `run` pushes `HEAD:<base>`, from a detached HEAD at the story gate, which a hook keyed on the current branch lets through.'],
  ['plugin/HARNESS.md', 'The guard is per clone while this rule is tracked, so another clone has the rule and no guard.'],
  ['plugin/HARNESS.md', 'A push rule already there stays, and is reported as too wide: while it does, a push runs with no prompt and nothing refuses it (fifteen rows, not fourteen).'],
  ['plugin/HARNESS.md', '`git -C <path> push --no-verify origin <branch>` and `git -C <path> -c core.hooksPath=<dir> push origin <branch>` both skip it'],
  ['plugin/HARNESS.md', 'No `deny` rule is written for those two flags'],
  ['plugin/HARNESS.md', 'Claude Code 2.1.91 and later'],
  ['README.md', 'version 2.1.91 or later'],
  ['plugin/HARNESS.md', 'It adds little over what the list already allows: `node -e` and the lane commands can already run any program'],
  ['plugin/HARNESS.md', "claude.ai and Cowork don't install a plugin with a top-level `bin/`"],
  ['plugin/HARNESS.md', '**wait-answer:** `leeway-sdlc-wait-answer`'],
  ['plugin/HARNESS.md', '**session-tokens:** `leeway-sdlc-session-tokens`'],
  ['plugin/HARNESS.md', '**raise:** `leeway-sdlc-raise`'],
  ['README.md', "claude.ai and Cowork don't install a plugin that has one"],
  // The install says it before the yes.
  ['plugin/skills/sdlc-install/SKILL.md', '**Before the yes, tell the person what it approves and what it leaves open**'],
  ['plugin/skills/sdlc-install/SKILL.md', '**A guard found:** what `HARNESS.md`, "Say before the yes", lists for this agent (on Claude Code, the fifteen startup warnings, what the git rules also approve, that those rules let a push skip the pre-push guard, and why the rest adds little). The guard is per clone while the rule is tracked: `.git/hooks` and the `core.hooksPath` setting stay in this clone, so another clone has the rule and no guard, and its pushes run with no prompt and nothing refusing them.'],
  ['plugin/skills/sdlc-install/SKILL.md', '**No guard found:** a yes brings the offer below. Without it, `git push` stays off the list, so every push prompts. A round always pushes, so **the run is attended**: it stops at its first push until someone answers.'],
  ['plugin/skills/sdlc-install/SKILL.md', 'lists for this agent without a push rule (on Claude Code, the fourteen startup warnings, what the git rules also approve, and why the rest adds little)'],
  ['plugin/skills/sdlc-install/SKILL.md', 'What the person needs for a run with no push prompt: the guard the offer writes, or their own pre-push guard in this repo, in `.git/hooks` or under `core.hooksPath` (a relative one: tracked and executable on the integration branch), deciding from the refs on its stdin, refusing the integration branch and a force push, and then this install run again, which offers the `push` rule.'],
  ['plugin/skills/sdlc-install/SKILL.md', '**No guard found, and a push rule already there:** say this instead of the branch above. Detection reports the rule as too wide. While it stays, a push runs with no prompt and nothing refuses it, so one wrong argument reaches the integration branch, and it is the person\'s to remove, or the offer below closes it.'],
  ['plugin/skills/sdlc-install/SKILL.md', 'A rule stops the call an agent ordinarily writes, not a determined one.'],
  ['plugin/skills/sdlc-install/SKILL.md', '`node -e` and the lane commands can run anything, including `leeway escalation answer`'],
  ['plugin/skills/sdlc-install/SKILL.md', '`leeway-guard` does not govern the orchestrator, so an orchestrator could answer its own escalation without a prompt'],
  ['plugin/skills/sdlc-install/SKILL.md', 'An improvised command off the list still prompts, so a yes does not promise a run with no prompt.'],
  ['plugin/skills/sdlc-install/SKILL.md', 'No real unattended run has yet tried this list on a fresh install.'],
  ['plugin/skills/sdlc-install/SKILL.md', 'the rules of its table in `permissions.allow` of `.claude/settings.json`'],
  ['plugin/skills/sdlc-install/SKILL.md', 'an allow-list added (the startup warnings at each session, and what question 16 said it leaves open)'],
  // The closing report, and the offer.
  ['plugin/skills/sdlc-install/SKILL.md', 'an allow-list added without `git push` (each push prompts until a guard `run` names exists; a push rule already there stays, and pushes run with no prompt: see too wide)'],
  ['plugin/skills/sdlc-install/SKILL.md', 'a pre-push guard written (where it is, and that another clone gets one by running this install there)'],
  ['plugin/skills/sdlc-install/SKILL.md', "a hook or `core.hooksPath` that kept the guard from being written (what is there, and that the guard is theirs to combine), a `'` in the integration branch's name that did (why, and that the guard is theirs to write), a guard the write or `chmod` was refused for (what the person is to put where)"],
  ['plugin/skills/sdlc-install/SKILL.md', 'names, or ("A pre-push guard") no guard that counts.'],
  ['plugin/skills/sdlc-install/SKILL.md', "16, question 16's offer and any"],
  ['plugin/skills/sdlc-install/SKILL.md', "question 16's offer on 16;"],
  ['plugin/skills/sdlc-install/SKILL.md', '**The offer, on a yes with no guard found.** Detection ("Whether the install can write a guard") says whether it can be made:'],
  ['plugin/skills/sdlc-install/SKILL.md', "It refuses a push to `<integration branch>` and a force push to any ref, and lets other pushes through, `run`'s `HEAD:<base>` to a plan branch included. `git push` then goes on the list, and pushes run with no prompt."],
  ['plugin/skills/sdlc-install/SKILL.md', '`--no-verify` and `-c core.hooksPath` skip it and the push rule approves both, so it stops the push an agent ordinarily writes, not a determined one'],
  ['plugin/skills/sdlc-install/SKILL.md', 'so another clone has the rule and no guard until this install runs there.'],
  ['plugin/skills/sdlc-install/SKILL.md', '**A no leaves the outcome of no guard, and say it plainly:** on Claude Code fourteen startup warnings, every push prompts, and the run is attended. With a push rule already there, a no leaves what that branch above says instead.'],
  ['plugin/skills/sdlc-install/SKILL.md', '**A hook or `core.hooksPath` in the way:** make no offer. Never overwrite it and never chain to it silently.'],
  ['plugin/skills/sdlc-install/SKILL.md', 'that the guard is theirs to combine with it, and that `scaffold/hooks/pre-push.tmpl` in this skill is the script to combine.'],
  ['plugin/skills/sdlc-install/SKILL.md', "**A `'` in the integration branch's name:** make no offer. Say why: the script holds the name in single quotes, so a `'` breaks it and it then refuses every push from this clone. The guard is theirs to write from that same script, and the outcome is that of no guard."],
  ['plugin/skills/sdlc-install/SKILL.md', 'With every other entry already there, the offer is question 16 on its own: a repo at fourteen rules is asked only that.'],
  ['plugin/skills/sdlc-install/SKILL.md', 'run detection\'s first and third commands again: if anything is now at that path or `core.hooksPath` is set, write nothing'],
  ['plugin/skills/sdlc-install/SKILL.md', 'Otherwise create its directory, write `scaffold/hooks/pre-push.tmpl` in this skill to that path, with `{{INTEGRATION_BRANCH}}` filled from the integration branch, make it executable'],
  ['plugin/skills/sdlc-install/SKILL.md', 'mkdir -p "$(dirname <that path>)" # before the write: git prints the path even when a clone has no hooks directory'],
  ['plugin/skills/sdlc-install/SKILL.md', 'chmod +x <that path> # after the write'],
  ['plugin/skills/sdlc-install/SKILL.md', 'echo "HEAD 0 refs/heads/<integration branch> 0" | <that path>; echo $? # the refusal, and 1'],
  ['plugin/skills/sdlc-install/SKILL.md', 'echo "HEAD 0 refs/heads/<any other branch> 0" | <that path>; echo $? # 0'],
  ['plugin/skills/sdlc-install/SKILL.md', 'Say where you put it, and only then add `git push` to the allow-list. If the try prints anything else, delete the file this install just wrote and the push rule is not added: say what it printed.'],
  ['plugin/skills/sdlc-install/SKILL.md', 'If the write or the `chmod` is refused, tell the person what to do themselves, which is to put that same filled script, printed in full, at `<that path>` and make it executable, and that the push rule stays off until this install, run again, finds it there.'],
  // An existing list.
  ['plugin/skills/sdlc-install/references/detection.md', '**Dead, matches nothing `run` prints:**'],
  ['plugin/skills/sdlc-install/references/detection.md', '`Bash(leeway spend record:*)`'],
  ['plugin/skills/sdlc-install/references/detection.md', "a kit script's per-version path"],
  ['plugin/skills/sdlc-install/references/detection.md', '**Too wide:**'],
  ['plugin/skills/sdlc-install/references/detection.md', 'while it stays, `escalation answer`, the deletes and any new CLI verb run with no prompt'],
  ['plugin/skills/sync-repo/SKILL.md', 'whose question 16 adds the new ones'],
  // The guard: what counts, and what follows from none.
  ['plugin/skills/sdlc-install/references/detection.md', '**A pre-push guard.**'],
  ['plugin/skills/sdlc-install/references/detection.md', 'git rev-parse --git-path hooks/pre-push'],
  ['plugin/skills/sdlc-install/references/detection.md', 'judged on the push `run` makes: `push origin HEAD:<base>` from a linked worktree, and at the story gate from a detached one.'],
  ['plugin/skills/sdlc-install/references/detection.md', 'git ls-tree origin/<integration branch> -- <that path> # for a relative core.hooksPath: tracked there, mode 100755?'],
  ['plugin/skills/sdlc-install/references/detection.md', 'git config --get core.hooksPath # set here or globally? Exit 1 when it is not'],
  ['plugin/skills/sdlc-install/references/detection.md', 'What counts is an executable file at that path that refuses an update to the integration branch and a force push, deciding from the refs git passes on its stdin, so it refuses `HEAD:<integration branch>` from a detached HEAD'],
  ['plugin/skills/sdlc-install/references/detection.md', 'A hook keyed on the current branch, such as one reading `git rev-parse --abbrev-ref HEAD`, does not count: it refuses `git push origin main` on `main` and lets `HEAD:main` through from any other checkout.'],
  ['plugin/skills/sdlc-install/references/detection.md', 'It can sit in `.git/hooks` or under `core.hooksPath`, which a relative value resolves against the checkout\'s root.'],
  ['plugin/skills/sdlc-install/references/detection.md', 'A relative `core.hooksPath` is therefore per checkout: it counts only when the hook file is tracked and executable on the integration branch, as the second command prints.'],
  ['plugin/skills/sdlc-install/references/detection.md', "If that ref is missing the command is fatal, and a relative path can't count: say so as the reason. It reads the ref as of the last fetch."],
  ['plugin/skills/sdlc-install/references/detection.md', 'Report what you found, and why a hook you found does not count.'],
  ['plugin/skills/sdlc-install/references/detection.md', 'One that is ignored or generated, such as Husky\'s `.husky/_`, does not count, because the merge worktree takes no setup.'],
  ['plugin/skills/sdlc-install/references/detection.md', 'a `pre-push.sample`, a file that is not executable, a hook in a directory git is not pointed at (`.githooks/` with no `core.hooksPath`), a `pre-push` that only lints, and one you could not read to that effect.'],
  ['plugin/skills/sdlc-install/references/detection.md', 'With no guard, `push` is not a missing entry, but the guard is: with every other entry there, question 16 still comes back, so a repo already at fourteen rules gets the offer.'],
  ['plugin/skills/sdlc-install/references/detection.md', 'An existing push rule with no guard, `Bash(git -C * push *)` or a wider one that matches it, is reported as too wide: while it stays, a push runs with no prompt and nothing refuses it, so one wrong argument reaches the integration branch, and it is the person\'s to remove.'],
  ['plugin/skills/sdlc-install/references/detection.md', "**Whether the install can write a guard.** With no guard that counts, question 16 makes its offer only when the third command prints nothing, nothing is at the first command's path and the integration branch's name has no `'`, which git allows and the script's single quotes do not."],
  ['plugin/skills/sdlc-install/references/detection.md', 'a `pre-push` there that does not count, an unexecutable or a dangling one included, and any `core.hooksPath`, because with one set git runs nothing from `.git/hooks`.'],
  ['plugin/skills/sdlc-install/references/detection.md', 'A `pre-push.sample` is not in the way.'],
  ['plugin/skills/sdlc-install/references/detection.md', 'The guard goes in `.git/hooks`, never under a tracked `core.hooksPath`: all of a clone\'s worktrees share it from the moment it is written, the merge worktree too.'],
  ['plugin/skills/sdlc-install/references/detection.md', 'so it does nothing until the hook has reached the integration branch, which the guard itself refuses a push to; its setting is per clone anyway, and it would silently stop every hook already in `.git/hooks`.'],
  ['plugin/skills/sdlc-install/references/detection.md', "What that costs is that the guard isn't versioned: each clone gets it by running the install."],
  ['plugin/skills/sdlc-install/references/detection.md', 'The guard the install writes counts by the rule above.'],
  // run, and the plugin's general form.
  ['plugin/skills/run/SKILL.md', '**The base may have moved since step 1, and what step 2 gated is the story with the base as it was then.**'],
  ['plugin/skills/run/SKILL.md', 'A non-zero exit from `merge-base --is-ancestor` means the base moved: remove this worktree and go back to step 1, before any merge, even one that would be clean, so nothing reaches the base ungated.'],
  ['plugin/skills/run/SKILL.md', 'The check reads the merge worktree\'s detached `HEAD`, which only this worktree changes, because worktrees share `origin/<base>` and a parallel session\'s fetch moves it.'],
  ['plugin/skills/run/SKILL.md', 'With that exit 0 the story already holds `HEAD`, so the merge cannot conflict.'],
  ['plugin/skills/run/SKILL.md', 'If the merge fails all the same, a hook refused it: `git -C <primary> worktree remove --force <primary>/.worktrees/merge-<story>`, stop and say what git printed.'],
  ['plugin/skills/run/SKILL.md', '`sdlc-install` offers to write it (question 16).'],
  ['plugin/skills/run/SKILL.md', '**If the merge push of `HEAD:<base>` fails,** whatever git printed, run `git -C <primary> fetch origin <base>` and `git -C <primary> merge-base --is-ancestor origin/<base> <story branch>`. Non-zero: the base moved, so remove this worktree and go back to step 1. Exit 0: it did not, so remove this worktree, stop and say what git printed.'],
  ['plugin/skills/run/SKILL.md', '**If the push of the story branch fails,** stop and say what git printed: nothing has merged, and step 1 merges only the base, so going back to it would not help.'],
  ['plugin/skills/run/SKILL.md', 'deciding from the refs git passes on its stdin, so it refuses `HEAD:<integration branch>` from a detached HEAD, which is how the story gate pushes.'],
  ['plugin/skills/run/SKILL.md', 'only the first and last of those lines run, and in between comes that convention, such as `gh pr create --base <integration branch> --head <story branch> --title "<story title>" --body-file <body.md>`'],
  ['plugin/skills/run/SKILL.md', 'A branch that already exists, on a resume, is added without `-b`.'],
  ['plugin/skills/run/SKILL.md', 'The merge and plan-cut worktrees take no setup, and a repo whose hooks need one there must say so under *Per-worktree setup* in `.sdlc/CONFIG.md`.'],
  ['plugin/skills/run/SKILL.md', '**Every call is printed verb first**'],
  ['plugin/skills/run/SKILL.md', "**Where `run`'s own files go.**"],
  ['plugin/skills/run/SKILL.md', 'goes in `.worktrees/.run/` of the primary checkout, named after the ref and passed by absolute path'],
  ['plugin/skills/run/SKILL.md', 'Any other verb prompts: `escalation raise` (a run raises through `<raise>`), `escalation answer`, `issue delete`, `product delete`, `process update`, and any verb a later CLI adds.'],
  ['plugin/skills/run/SKILL.md', 'An improvised command, one an agent makes up that is not on the list, still prompts'],
  ['plugin/skills/run/SKILL.md', '`node -e` and the lane commands can run anything, including `leeway escalation answer`, and `leeway-guard` does not govern the orchestrator'],
  ['plugin/skills/run/SKILL.md', 'A rule stops the call an agent ordinarily writes, not a determined one.'],
  ['plugin/skills/run/SKILL.md', '`--no-verify` and `-c core.hooksPath` skip it, and the allow-list\'s push rule approves both, so it stops the push an agent ordinarily writes, not a determined one. Never pass either.'],
  ['plugin/skills/run/SKILL.md', '| any other | the wait never ran'],
  ['plugin/skills/run/SKILL.md', 'and `worktree add` refuses a branch that is ("is already used by worktree")'],
  ['plugin/skills/run/SKILL.md', 'its local `<base>` stays behind `origin/<base>` until its owner pulls'],
  ['plugin/skills/run/SKILL.md', '`mkdir` is not on the allow-list, and `Write` makes the directories it needs'],
  ['plugin/skills/run/SKILL.md', 'with at least one argument after the verb'],
  ['plugin/skills/run/SKILL.md', "**You never answer your own escalation:** an answer is the person's"],
  ['plugin/PROCESS.md', '`<cli> --server <server> <resource> <verb> <args> --as <alias>/<role> --json`'],
  ['plugin/PROCESS.md', 'an attended skill that still prints them before the verb works: it only prompts'],
  ['plugin/agents/sdlc-implementer.md', '`cd <path> && git` included, and a prompt stops the run'],
  ['plugin/agents/sdlc-reviewer.md', 'Anything else prompts, `cd <path> && git` included.'],
  ['plugin/agents/sdlc-implementer.md', 'A git verb needs at least one argument to match'],
  ['plugin/agents/sdlc-reviewer.md', 'A git verb needs at least one argument to match'],
  ['plugin/agents/sdlc-implementer.md', 'A lane runs as `cd <worktree> && <lane>`'],
  ['plugin/agents/sdlc-reviewer.md', 'A lane runs as `cd <worktree> && <lane>`'],
  ['plugin/agents/sdlc-reviewer.md', 'a mutation and its restore go through `node -e`'],
  ['plugin/agents/sdlc-implementer.md', '**Deleting or renaming a file** goes through `node -e`'],
  ['.claude-plugin/marketplace.json', "Claude Code 2.1.91 or later only: claude.ai and Cowork don't install a plugin with a top-level bin/"],
  ['plugin/.claude-plugin/plugin.json', "Claude Code 2.1.91 or later only: claude.ai and Cowork don't install a plugin with a top-level bin/"],
]

test('the prose carries what the install owes', () => {
  for (const [path, needle] of PINS) assert.ok(flat(read(path)).includes(needle), `${path} no longer says: ${needle}`)
})
