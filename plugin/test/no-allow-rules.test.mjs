// LWY-189.5, TC-1 and TC-7: nothing the plugin ships tells an agent to write a permission rule, and every call `run` prints
// keeps the form a harness that asks about a call matches as written (verb first with `--server`, git as `git -C <path> <verb>`).
// Replaces allow-list.test.mjs, which pinned 0.3.0's allow-list text.
// The scan reads Markdown, templates, TOML, JSON and the hook and adapter scripts (.mjs, .js) whole; plugin/test/ and *.test.mjs are left out.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (path) => readFileSync(join(ROOT, path), 'utf8').replace(/\r\n/g, '\n')
const flat = (text) => text.replace(/\s+/g, ' ')

// ---- The scan: every Markdown, template, TOML, JSON, .mjs and .js file under plugin/ and targets/, the generated harnesses included.
const SCANNED = /\.(md|tmpl|toml|json|mjs|js)$/
const filesUnder = (dir) =>
  readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
    const path = `${dir}/${e.name}`
    if (e.isDirectory()) return path === 'plugin/test' || e.name === 'node_modules' ? [] : filesUnder(path)
    return SCANNED.test(e.name) && !/\.test\.mjs$/.test(e.name) ? [path] : []
  })
const FILES = [...filesUnder('plugin'), ...filesUnder('targets')]

// A rule-shaped token: a tool name, an open bracket and a pattern, or an MCP tool's name.
const RULE = /\b(?:(?:Edit|Read|Write|Glob|Grep|WebFetch)\(\s*[^)\s]|(?:[Bb]ash|[Ww]eb[Ff]etch) ?\(\s*[^)\s]|mcp__\w+)/g
// The phrases for the thing the plugin no longer writes.
const PHRASE = /allow[- ]list|permissions\.(?:allow|deny)|allow rules?\b|approval rules?|allowed[- ]?tools|permission rules?/gi
const WRITES = /\b(?:add|adds|write|writes|writing|put|puts|extend|extends)\b/i
const REMOVES = /\b(?:remove[sd]?|delete[sd]?|no longer)\b/i

// May name them: sync-repo between its two markers and where it removes or names 0.3.0's, and a sentence saying the plugin writes none.
const SYNC_REPO = /^(plugin|targets\/agents)\/skills\/sync-repo\/SKILL\.md$/
const FORMS_FROM = "**The forms of run's 0.3.0 allow-list.**"
const FORMS_TO = '**Never synced, never compared, never opened for writing:**'

const findings = (path, text) => {
  const found = []
  const lines = text.split('\n')
  let formsFrom = Infinity
  let formsTo = Infinity
  if (SYNC_REPO.test(path)) {
    const from = lines.findIndex((l) => l.includes(FORMS_FROM)) + 1
    const to = lines.findIndex((l) => l.includes(FORMS_TO)) + 1
    if (!from || !to || to <= from) found.push({ path, line: 1, why: "sync-repo's 0.3.0 region markers moved" })
    else [formsFrom, formsTo] = [from, to]
  }
  const paragraphOf = (n) => {
    let a = n
    let b = n
    while (a > 0 && lines[a - 1].trim()) a--
    while (b < lines.length - 1 && lines[b + 1].trim()) b++
    return lines.slice(a, b + 1).join(' ')
  }
  // A sentence excuses its phrase only when it says the plugin writes none and no clause after that writes one.
  const writesNone = (sentence) => {
    const at = sentence.search(/\bwrites no\b/)
    return at !== -1 && !WRITES.test(sentence.slice(at + 'writes no'.length))
  }
  lines.forEach((line, i) => {
    const n = i + 1
    for (const m of line.matchAll(RULE)) {
      if (n > formsFrom && n < formsTo) continue
      found.push({ path, line: n, why: `a permission rule: ${line.slice(m.index, m.index + 40).trim()}` })
    }
    for (const m of line.matchAll(PHRASE)) {
      const paragraph = flat(paragraphOf(i))
      const holding = paragraph.split(/(?<=\.)\s+/).filter((s) => s.toLowerCase().includes(m[0].toLowerCase()))
      if (holding.length && holding.every(writesNone)) continue
      if (SYNC_REPO.test(path) && paragraph.includes('0.3.0') && REMOVES.test(paragraph)) continue
      if (SYNC_REPO.test(path) && line.slice(0, m.index).endsWith('0.3.0 ') && holding.every((s) => !WRITES.test(s))) continue
      found.push({ path, line: n, why: `"${m[0]}" outside a line that says the plugin writes none or that sync-repo removes 0.3.0's` })
      break
    }
  })
  return found
}

test('no plugin or target text tells an agent to write a permission rule', () => {
  assert.ok(FILES.length > 60, `only ${FILES.length} files scanned`)
  for (const required of ['plugin/HARNESS.md', 'plugin/skills/run/SKILL.md', 'plugin/skills/sync-repo/SKILL.md', 'targets/agents/HARNESS.md', 'targets/agents/skills/sync-repo/SKILL.md', 'targets/agents/skills/sdlc-install/kit/harness/gemini.md', 'plugin/skills/sdlc-install/scaffold/hooks/pre-push.tmpl']) {
    assert.ok(FILES.includes(required), `not scanned: ${required}`)
  }
  const found = FILES.flatMap((path) => findings(path, read(path)))
  assert.deepEqual(found.map((f) => `${f.path}:${f.line}: ${f.why}`), [])
})

test('the scan fails on an instruction to write a rule, and passes on what the plugin says about having none', () => {
  const hit = (text, path = 'plugin/skills/run/SKILL.md') => findings(path, text)
  for (const text of [
    'Add `Bash(git -C * diff *)` to `.claude/settings.json`.',
    'Write an allow rule for git.',
    'Add it to permissions.allow.',
    'Then add the allow-list.',
    'Add Edit(/.worktrees/**) too.',
    'Add Read(~/x/**) too.',
  ]) assert.equal(hit(text).length, 1, text)
  assert.equal(hit('x\n\nAdd `Bash(git -C * diff *)`\n')[0].line, 3)
  assert.deepEqual(hit('The plugin writes no allow rule\nand no permission setting.'), [])
  assert.deepEqual(hit('Gemini wires `.gemini/settings.json`, and OpenCode `opencode.json` `instructions`.'), [])
  // A "writes no" sentence excuses itself only: not the next sentence, nor a later clause that writes one.
  assert.equal(hit('The plugin writes no allow rule. Add an allow rule for git.').length, 1)
  assert.equal(hit('The plugin writes no allow rule, so add an allow rule.').length, 1)
  // Other spellings of a rule or of the list.
  for (const text of [
    'Add `Bash (git -C * diff *)`.',
    'Add `bash(git status:*)`.',
    'Add Write(/.worktrees/**).',
    'Add WebFetch(domain:x.com).',
    'Add Glob(**).',
    'Add Grep(x).',
    'Allow mcp__leeway__issue_get.',
    'Add Edit( /x ).',
    'Set the allowed tools.',
    'Set "allowedTools": [].',
    'Add the approval rules.',
    'Add a permission rule.',
    'Add it to permissions.deny.',
  ]) assert.equal(hit(text).length, 1, text)
  // sync-repo's 0.3.0 copy is excused between its two markers and nowhere else.
  const sync = `a\n\n${FORMS_FROM} The 0.3.0 list:\n\n- \`Bash(node -e *)\`\n\n${FORMS_TO}\n\nAdd \`Bash(node -e *)\`\n`
  const syncPath = 'plugin/skills/sync-repo/SKILL.md'
  assert.deepEqual(hit(sync, syncPath).map((f) => f.line), [9])
  assert.equal(hit(sync).length, 3)
  // A marker renamed, missing or reversed fails, and a rule after it is still found.
  const unmarked = sync.replace(FORMS_TO, '**Never synced:**')
  assert.deepEqual(hit(unmarked, syncPath).map((f) => f.why).filter((w) => w.includes('region markers moved')).length, 1)
  assert.ok(hit(`${unmarked}Add \`Bash(git -C * diff *)\`.\n`, syncPath).some((f) => f.why.startsWith('a permission rule')))
  assert.ok(hit(sync.replace(FORMS_FROM, '**Renamed:**'), syncPath).some((f) => f.why.includes('region markers moved')))
  assert.ok(hit(`${FORMS_TO}\n\n${FORMS_FROM}\n`, syncPath).some((f) => f.why.includes('region markers moved')))
  const marked = (text) => `${FORMS_FROM}\n\n${FORMS_TO}\n\n${text}\n`
  assert.equal(hit(marked("run's 0.3.0 allow-list is removed."), syncPath).length, 0)
  assert.equal(hit("run's 0.3.0 allow-list is removed.").length, 1)
  // A 0.3.0 paragraph is excused where it removes, and a write instruction in one is not.
  assert.equal(hit(marked('Since 0.3.0, write an allow rule and add it to permissions.allow, per the allow-list.'), syncPath).length, 1)
  assert.equal(hit(marked('The 0.3.0 allow-list has no plugin file.'), syncPath).length, 0)
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

const CLI = 'mycli'
const SERVER = 'https://s.test'
const run = read('plugin/skills/run/SKILL.md')
const spansIn = (text) => [...text.matchAll(/`([^`]+)`/g)].map((m) => m[1])

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

// In run, the read-only paragraph's spans are held to exactly the list in the test below.
const denials = [run.indexOf('**How it reaches Leeway**, in these words'), run.indexOf('> **You never ask the user')]
const PARSED = Object.entries({
  run: run.slice(0, denials[0]) + run.slice(denials[1]),
  BRIEF: read('plugin/skills/run/templates/BRIEF.md'),
  VERDICT: read('plugin/skills/run/templates/VERDICT.md'),
  PROCESS: read('plugin/PROCESS.md'),
  implementer: read('plugin/agents/sdlc-implementer.md'),
  reviewer: read('plugin/agents/sdlc-reviewer.md'),
}).map(([name, text]) => ({ name, ...parse(text) }))
const parsed = (name) => PARSED.find((p) => p.name === name)

test('the section the scan leaves out names these spans and no other', () => {
  assert.ok(denials[0] !== -1 && denials[1] > denials[0], 'run: the read-only paragraph moved')
  assert.deepEqual(spansIn(run.slice(denials[0], denials[1])).map((s) => flat(s.replace(/\n\s*>/g, ''))), [
    '--as', '<cli> --server <server> issue get <ref> --json', '... review get <ref> --json', '... escalation list <KEY> --json',
    "git -C <the worktree's absolute path>", 'cd <path> && git', 'cd <worktree> && <lane>',
    'issue create', 'update', 'comment add', 'iteration record', 'escalation raise', 'answer', 'dependency', 'pr link', 'project', 'process', 'login',
    'leeway-guard', 'git -C <worktree> add', 'Head sha', 'pending',
  ])
})

// Fill a printed call in, as an orchestrator would.
const fill = (call) =>
  call
    .replace(/\s+#\s.*$/, '')
    .replace(/\s<[\w.-]*\.md$/, '')
    .replace(/^leeway\b/, `${CLI} --server ${SERVER}`)
    .replace(/^<cli> --server <server>/, `${CLI} --server ${SERVER}`)
    .replace(/^<cli>(?= )/, CLI)
    .replace(/^<wait-answer>/, 'leeway-sdlc-wait-answer')
    .replace(/^<session-tokens>/, 'leeway-sdlc-session-tokens')
    .replace(/^<raise>/, 'leeway-sdlc-raise')
    .replace(/<(lane|gate command|setup command)>/g, 'mylane x')
    .replace(/<[^<>]+>/g, 'x')

// What a printed call must be: a Leeway one is `<cli> --server <server> <resource> <verb>`, a git one is `git -C <path> <verb>`,
// and `cd <path> && git` is neither. Returns why not, or null.
const wrongWith = (call) => {
  const subs = subcommands(fill(call))
  if (subs.some((s) => /^cd\s/.test(s)) && subs.some((s) => /^git\s/.test(s))) return 'cd before git'
  for (const sub of subs) {
    if (/^git\s/.test(sub) && !/^git -C \S+ [a-z]/.test(sub)) return 'not git -C <path> <verb>'
    if (sub.startsWith(`${CLI} `) && !/^\S+ --server \S+ [a-z][a-z-]* [a-z][a-z-]*/.test(sub)) return 'not verb first with --server'
  }
  return null
}

// The programs a printed call may start with: Leeway's CLI, git, a lane, the plugin's scripts, node, gh, echo and pwd.
const PROGRAMS = new Set([CLI, 'git', 'cd', 'node', 'gh', 'echo', 'pwd', 'mylane', 'leeway-sdlc-wait-answer', 'leeway-sdlc-session-tokens', 'leeway-sdlc-raise'])
const unknownProgram = (call) => {
  for (const sub of subcommands(fill(call))) {
    const program = sub.replace(/^(?:[A-Za-z_]+=\S* )+/, '').split(/\s/)[0]
    if (!PROGRAMS.has(program)) return program
  }
  return null
}

test('flags before the verb, no --server, no -C, or a cd before git is wrong, and the forms run prints are not', () => {
  for (const bad of [
    'leeway --as a/agent --json spend record <ref> 3',
    `${CLI} spend record X 3`,
    'leeway spend X 3',
    'git status --short',
    'git commit -m x',
    'git -c core.fsmonitor=x status',
    'cd /w && git tag x',
    'leeway issue get <ref> --json | git status',
  ]) assert.notEqual(wrongWith(bad), null, bad)
  for (const good of [
    'leeway spend record <ref> 3 --as <alias>/agent --json',
    'git -C <worktree> status --short',
    'git -C <primary> worktree add -b <b> <w> origin/<base>',
    'cd <worktree> && <lane>',
    'leeway issue get <ref> --json | node -e "x"',
  ]) assert.equal(wrongWith(good), null, good)
})

test('a fence this cannot read fails, and so does a Leeway or git command with no backticks', () => {
  for (const { name, unread, lines } of PARSED) {
    assert.deepEqual(unread, [], `${name}: a fence that is not sh, bash, markdown or plain`)
    for (const line of lines) assert.equal(wrongWith(line), null, `${name}: ${line}`)
  }
  for (const fence of ['```shell\nrm x\n```', '```console\nrm x\n```', '~~~sh\nrm x\n~~~', '```sh title=x\nrm x\n```']) assert.ok(parse(fence).unread.length, fence)
  assert.deepEqual(parse('text\n\n    rm -rf x\n\n```markdown\ngit tag x\n```').lines, ['rm -rf x', 'git tag x'])
  assert.deepEqual(parse('```markdown\nsee `git tag x`\n```').spans, ['git tag x'])
})

test('every line of a sh fence keeps its form', () => {
  let n = 0
  for (const { name, shell } of PARSED) {
    for (const line of shell) {
      if (/^(leeway|git|<cli>)\b/.test(line)) n++
      assert.equal(wrongWith(line), null, `${name}: ${line}`)
      assert.equal(unknownProgram(line), null, `${name}: a program this does not know: ${line}`)
    }
  }
  assert.ok(n > 40, `only ${n} fence lines found`)
})

test('an unknown program in a sh fence fails, and so do a path, a variable, a subshell and an assignment', () => {
  for (const bad of ['rm -rf x', './scripts/x.sh --force', '/bin/rm -rf x', '$LEEWAY issue delete X', '(cd x && rm y)', 'foo=1 rm x', 'git -C x status | xargs rm']) {
    assert.notEqual(unknownProgram(bad), null, bad)
  }
  for (const good of ['leeway issue get <ref> --json | node -e "x"', 'FOO=1 git -C x status', '<raise> --server <server> --as <alias>/<role> <ref> <fields file> -- <cli>', 'cd <worktree> && <lane>']) {
    assert.equal(unknownProgram(good), null, good)
  }
})

test('the counting one-liner is printed in run verb first, with the server, as a sh fence line', () => {
  const lines = parsed('run').shell.filter((l) => /^(leeway|<cli>)\b.* --json \| node -e /.test(l))
  assert.equal(lines.length, 1, 'the counting one-liner moved or is printed more than once')
  assert.match(lines[0], /^leeway issue get <ref> --json \| node -e '/)
  assert.equal(wrongWith(lines[0]), null)
  assert.notEqual(wrongWith(lines[0].replace('issue get <ref> --json', '--json issue get <ref>')), null)
})

test('a "$ " line of a template keeps its form, and a fence with no language holds nothing else', () => {
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

// A span that names a form, to say it is refused, rather than a call.
const NAMED = [
  /^git -C <[^>]+>$/, // the form, with no verb
  /^<cli> --server <server>$/, // what `leeway` stands for
  /^leeway login( --server <server>)?$/, // a person's, at a blocker
  /^node (<path>|\/path\/to)\/leeway\.js$/, // a value of cli:
  /^<cli> --server <server> <resource> <verb> <args>/, // the general form in PROCESS.md
]

test('every code span that is a Leeway or git call keeps its form', () => {
  const seen = { git: 0, leeway: 0 }
  for (const { name, spans } of PARSED) {
    for (const s of spans) {
      if (!/^(git|leeway|<cli>) /.test(s) || NAMED.some((re) => re.test(s))) continue
      seen[s.startsWith('git ') ? 'git' : 'leeway']++
      const wrong = wrongWith(s)
      assert.equal(wrong, null, `${name}: ${s}: ${wrong}`)
    }
  }
  assert.ok(seen.leeway > 20, `only ${seen.leeway} leeway calls`)
  assert.ok(seen.git > 10, `only ${seen.git} git calls`)
})

test('a call printed with no leeway word in front is verb first, and no flag comes before the verb', () => {
  const resources = /^(issue|comment|iteration|spend|escalation|review|project|process|dependency|pr|product) ([a-z-]+)\b/
  const { spans } = parsed('run')
  assert.ok(spans.filter((s) => resources.test(s)).length > 5, 'too few bare calls found')
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

test('the steps run prints are still printed, so the checks above cover them', () => {
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
