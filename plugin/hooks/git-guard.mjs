// PreToolUse hook for this plugin's SDLC subagents.
//
// The workflow rests on one invariant: the orchestrator is the single git writer. Subagents may
// stage (`git add`) so the orchestrator can gate and commit their work, and may read history, but
// must not mutate history, refs, or the worktree layout. A tools allowlist cannot express that --
// `git add` and `git commit` are both Bash -- so it is enforced here instead.
//
// WIRED VIA hooks.json, NOT AGENT FRONTMATTER. An inline `hooks:` block in a plugin-provided
// agent's frontmatter is NOT honoured -- measured twice on 2026-08-30, with a plugin-relative path
// and again with an absolute one, and in both runs the subagent's `git commit` succeeded. So the
// hook is declared globally on Bash and scopes itself here instead, by reading `agent_type` off the
// payload. The orchestrator's calls carry no `agent_type` at all; a subagent's carry
// `<plugin>:<agent>`. That is the whole scoping mechanism, and it is why this file must never block
// a call it cannot attribute. (Design doc, "CLI, not MCP" and "Hazards".)
//
// Contract: read the tool call as JSON on stdin, exit 0 to allow, exit 2 to block with the reason
// on stderr. Node rather than a shell script because jq is not installed and this must work on
// Windows as well as POSIX. No dependencies. Tests: `node --test plugin/hooks/git-guard.test.mjs`.
//
// What this is not: a sandbox. It reads the command text, so a git alias defined in the repo's
// config, a script file the agent wrote and then runs, or an interpreter (`node -e`, `python -c`)
// calling git are out of its reach. It closes the direct forms and the common wrappers -- `sh -c`,
// `bash -lc`, `env`, `command`, `xargs`, `$(...)` -- so that reaching git through them is not the
// path of least resistance.

// Only this plugin's own agents are governed. Another plugin's agents, and the orchestrator, are
// never this hook's business even though it sees their Bash calls.
const GOVERNED_AGENT_PREFIX = 'leeway-sdlc:'

// Bound: a command is judged in at most MAX_SCRIPTS nested scripts (each `sh -c`, `eval`, `$(...)`
// body counts one, chain depth at most MAX_DEPTH). A command past either limit is BLOCKED, not
// allowed: nothing legitimate nests that deep, and failing open would let a long `eval eval ...`
// chain carry a commit past the guard. Each script is lexed once, in linear time.
const MAX_SCRIPTS = 200
const MAX_DEPTH = 8
class TooComplex extends Error {}

const TOPOLOGY = 'branch topology belongs to the orchestrator'
const DISCARDS = 'this can silently discard uncommitted work'

// Verbs blocked whatever their arguments.
const BLOCKED = new Map([
  ['commit', 'the orchestrator commits, after the verification gate'],
  ['push', 'the orchestrator pushes; a subagent must never reach a remote'],
  ['pull', 'pull is a fetch plus a merge or rebase, and ' + TOPOLOGY],
  ['merge', TOPOLOGY],
  ['rebase', TOPOLOGY],
  ['cherry-pick', TOPOLOGY],
  ['revert', TOPOLOGY],
  ['am', 'am turns patches into commits, and the orchestrator commits'],
  ['reset', 'this discards staged work the orchestrator has not gated yet'],
  ['checkout', DISCARDS],
  ['switch', DISCARDS],
  ['restore', DISCARDS],
  ['stash', 'this hides work the orchestrator is about to gate'],
  ['clean', 'this deletes untracked files, including ones you just wrote'],
  ['tag', 'tags are release state, not task state'],
  ['config', 'config changes can disable the repo guards (see core.hooksPath)'],
  ['update-ref', 'refs belong to the orchestrator'],
  ['filter-branch', 'never, from anywhere'],
])

// Verbs blocked unless the subcommand is a read. `null` stands for "no subcommand given".
const SUBCOMMAND_RULES = new Map([
  [
    'worktree',
    {
      allowed: new Set(['list']),
      optsWithValue: new Set(),
      reason:
        'worktree lifecycle (add, remove, prune, move, lock, unlock, repair) is orchestrator-only; ' +
        'only `git worktree list` is available',
    },
  ],
  [
    'notes',
    {
      allowed: new Set([null, 'list', 'show', 'get-ref']),
      optsWithValue: new Set(['--ref']),
      reason: 'notes are written to refs, and refs belong to the orchestrator; list and show are available',
    },
  ],
  [
    'submodule',
    {
      allowed: new Set([null, 'status', 'summary', 'foreach']),
      optsWithValue: new Set(),
      reason:
        'submodule update, add, deinit, sync, init and set-* move submodule pointers or config, ' +
        'which belong to the orchestrator; status and summary are available',
    },
  ],
])

// `git branch` flags that create, delete, rename, copy or force-move a ref, or edit its config.
const BRANCH_WRITE_FLAGS = new Set([
  '-d', '-D', '--delete', '-m', '-M', '--move', '-c', '-C', '--copy', '-f', '--force',
  '-u', '--set-upstream-to', '--unset-upstream', '--edit-description', '--track', '--no-track',
])
const BRANCH_WRITE_SHORT = /[dDmMcCfu]/
// Flags that make `git branch <x>` a listing filter rather than a creation.
const BRANCH_LIST_FLAGS = new Set([
  '-l', '--list', '-a', '--all', '-r', '--remotes', '--contains', '--no-contains',
  '--merged', '--no-merged', '--points-at', '--show-current',
])
const BRANCH_OPTS_WITH_VALUE = new Set(['--contains', '--no-contains', '--merged', '--no-merged', '--points-at', '--sort', '--format', '--column'])

// `git apply` writes only the working tree by default -- the same thing Edit does, so it stays
// available. These flags make it write the index as well: `--cached` stages content that is not in
// the working tree, so the gate would test one tree and the orchestrator commit another. `--index`
// and `--3way` are blocked with it; the workaround is `git apply` then `git add`, which keeps
// `git add <paths>` the one way a subagent stages.
const APPLY_INDEX_FLAGS = new Set(['--index', '--cached', '-3', '--3way'])

// Global options that take a separate value, so the token after them is not the git verb.
const OPTS_WITH_VALUE = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--exec-path', '--config-env'])

// Shells whose `-c <script>` (or Windows equivalent) runs a nested command line.
const POSIX_SHELLS = new Set(['sh', 'bash', 'zsh', 'dash', 'ksh', 'ash', 'mksh'])
const PWSH = new Set(['pwsh', 'powershell'])

const read = async () => {
  const chunks = []
  for await (const chunk of process.stdin) chunks.push(chunk)
  return Buffer.concat(chunks).toString('utf8')
}

// A small shell lexer: enough of POSIX quoting to know where words and commands begin and end.
// Returns the command segments (each a list of words) and any `$(...)` / backtick bodies found
// inside double quotes, which run as commands of their own.
const lex = (src) => {
  const segments = []
  const nested = []
  let words = []
  let word = ''
  let inWord = false
  const endWord = () => {
    if (inWord) words.push(word)
    word = ''
    inWord = false
  }
  const endSegment = () => {
    endWord()
    if (words.length) segments.push(words)
    words = []
  }
  // Index of the char closing a `$(` opened just before `start`, honouring nesting.
  const closeParen = (start) => {
    let depth = 1
    for (let k = start; k < src.length; k++) {
      if (src[k] === '(') depth++
      else if (src[k] === ')' && --depth === 0) return k
    }
    return src.length
  }
  let i = 0
  while (i < src.length) {
    const ch = src[i]
    if (ch === '$' && (src[i + 1] === "'" || src[i + 1] === '"')) {
      i++ // `$'...'` and `$"..."` quote like `'...'` and `"..."`; the `$` is not part of the word.
    } else if (ch === "'") {
      inWord = true
      const end = src.indexOf("'", i + 1)
      const stop = end === -1 ? src.length : end
      word += src.slice(i + 1, stop)
      i = stop + 1
    } else if (ch === '"') {
      inWord = true
      i++
      while (i < src.length && src[i] !== '"') {
        if (src[i] === '\\' && i + 1 < src.length) {
          // Inside double quotes a backslash escapes only $ ` " \ and newline; before anything
          // else it is literal, which keeps "C:\Program Files\Git\bin\git.exe" intact.
          word += /[$`"\\\n]/.test(src[i + 1]) ? src[i + 1] : src[i] + src[i + 1]
          i += 2
        } else if (src[i] === '$' && src[i + 1] === '(') {
          const end = closeParen(i + 2)
          nested.push(src.slice(i + 2, end))
          word += src.slice(i, end + 1)
          i = end + 1
        } else if (src[i] === '`') {
          const end = src.indexOf('`', i + 1)
          const stop = end === -1 ? src.length : end
          nested.push(src.slice(i + 1, stop))
          word += src.slice(i, stop + 1)
          i = stop + 1
        } else {
          word += src[i++]
        }
      }
      i++
    } else if (ch === '\\' && i + 1 < src.length) {
      inWord = true
      if (src[i + 1] !== '\n') word += src[i + 1]
      i += 2
    } else if (/[;&|\n()`]/.test(ch)) {
      // Command separators, pipes, subshells and unquoted command substitution all start a new
      // command, so each side is examined on its own.
      endSegment()
      i++
    } else if (/\s/.test(ch)) {
      endWord()
      i++
    } else {
      inWord = true
      word += ch
      i++
    }
  }
  endSegment()
  return { segments, nested }
}

// `C:\Program Files\Git\bin\git.exe` and `/usr/bin/git` are both git.
const commandName = (word) =>
  word.split(/[\\/]/).pop().toLowerCase().replace(/\.exe$/, '')

// For a shell-wrapper word at `words[i]`, the nested script it runs, or null.
const wrappedScript = (words, i) => {
  const name = commandName(words[i])
  if (POSIX_SHELLS.has(name)) {
    let runsString = false
    let j = i + 1
    for (; j < words.length && /^[-+]/.test(words[j]); j++) {
      const opt = words[j]
      if (opt === '-o' || opt === '+o' || opt === '-O' || opt === '+O') j++
      else if (/^-[a-zA-Z]*c[a-zA-Z]*$/.test(opt)) runsString = true
    }
    return runsString && j < words.length ? words[j] : null
  }
  if (name === 'eval') return words.slice(i + 1).join(' ')
  if (name === 'env') {
    // `env -S 'git commit'` splits its one argument into a command line.
    const j = words.findIndex((w, k) => k > i && (w === '-S' || w === '--split-string'))
    return j === -1 || j + 1 >= words.length ? null : words[j + 1]
  }
  if (PWSH.has(name)) {
    for (let j = i + 1; j < words.length; j++) {
      const opt = words[j].toLowerCase()
      if (/^-(e|ec|enc|encodedcommand)$/.test(opt) && j + 1 < words.length) {
        return Buffer.from(words[j + 1], 'base64').toString('utf16le')
      }
      if (/^-(c|command)$/.test(opt)) return words.slice(j + 1).join(' ')
    }
    return null
  }
  if (name === 'cmd') {
    const j = words.findIndex((w, k) => k > i && /^\/[ck]$/i.test(w))
    return j === -1 ? null : words.slice(j + 1).join(' ')
  }
  return null
}

// Every git invocation in a command line, as { verb, args, globals }, following shell wrappers.
// A `git` word anywhere in a segment counts, which is what catches `env X=1 git ...`,
// `command git ...`, `xargs -n1 git ...`, `timeout 5 git ...` without listing each wrapper.
const gitInvocations = (command, depth = 0, budget = { left: MAX_SCRIPTS }) => {
  if (depth > MAX_DEPTH || --budget.left < 0) throw new TooComplex()
  const found = []
  const { segments, nested } = lex(command)
  for (const script of nested) found.push(...gitInvocations(script, depth + 1, budget))
  for (const words of segments) {
    for (let i = 0; i < words.length; i++) {
      const script = wrappedScript(words, i)
      if (script) found.push(...gitInvocations(script, depth + 1, budget))
      if (commandName(words[i]) !== 'git') continue
      const globals = []
      let j = i + 1
      while (j < words.length && words[j].startsWith('-')) {
        globals.push(words[j])
        if (OPTS_WITH_VALUE.has(words[j])) j++
        j++
      }
      if (j < words.length) found.push({ verb: words[j], args: words.slice(j + 1), globals })
    }
  }
  return found
}

// First non-option argument, skipping options that take a separate value.
const firstPositional = (args, optsWithValue) => {
  for (let k = 0; k < args.length; k++) {
    if (optsWithValue.has(args[k])) k++
    else if (!args[k].startsWith('-')) return args[k]
  }
  return null
}

const branchReason = (args) => {
  let listing = false
  let positional = false
  for (let k = 0; k < args.length; k++) {
    const arg = args[k]
    const flag = arg.split('=')[0]
    if (BRANCH_WRITE_FLAGS.has(flag)) return `\`${arg}\` changes a branch`
    if (/^-[a-zA-Z]{2,}$/.test(arg) && BRANCH_WRITE_SHORT.test(arg)) return `\`${arg}\` changes a branch`
    if (BRANCH_LIST_FLAGS.has(flag)) listing = true
    if (BRANCH_OPTS_WITH_VALUE.has(arg)) k++
    else if (arg === '--') positional = positional || k + 1 < args.length
    else if (!arg.startsWith('-')) positional = true
  }
  if (positional && !listing) return 'naming a branch without a listing flag creates it'
  return null
}

// Why this invocation is blocked, or null to allow it.
const blockReason = ({ verb, args, globals }) => {
  if (globals.some((g) => g === '-c' || g === '--config-env' || g.startsWith('--config-env='))) {
    return 'a per-invocation `-c` override is config, and config changes can disable the repo guards or alias a blocked verb'
  }
  const fixed = BLOCKED.get(verb)
  if (fixed) return fixed
  const rule = SUBCOMMAND_RULES.get(verb)
  if (rule) {
    const sub = firstPositional(args, rule.optsWithValue)
    if (verb === 'submodule' && sub === 'foreach') {
      // foreach runs its argument as a command in every submodule; judge that command.
      const inner = gitInvocations(args.slice(args.indexOf('foreach') + 1).join(' '))
      for (const call of inner) {
        const reason = blockReason(call)
        if (reason) return reason
      }
      return null
    }
    return rule.allowed.has(sub) ? null : rule.reason
  }
  if (verb === 'branch') {
    const why = branchReason(args)
    return why ? `${why}, and creating, deleting, renaming, copying or force-moving branches belongs to the orchestrator; listing branches is available` : null
  }
  if (verb === 'apply') {
    const flag = args.find((a) => APPLY_INDEX_FLAGS.has(a))
    return flag
      ? `\`git apply ${flag}\` writes the index; run \`git apply\` without it and stage with \`git add <paths>\``
      : null
  }
  return null
}

const main = async () => {
  let input
  try {
    input = JSON.parse(await read())
  } catch {
    process.exit(0) // Never block because the hook could not parse its own input.
  }
  const command = input?.tool_input?.command
  if (typeof command !== 'string') process.exit(0)

  // Scope. The orchestrator is the single writer and must stay free to commit, merge and push, so
  // a call with no agent_type is never ours to judge. Absent or foreign attribution allows.
  const agentType = input?.agent_type
  if (typeof agentType !== 'string' || !agentType.startsWith(GOVERNED_AGENT_PREFIX)) process.exit(0)

  let call
  let reason
  try {
    for (call of gitInvocations(command)) {
      reason = blockReason(call)
      if (reason) break
    }
  } catch (err) {
    if (err instanceof TooComplex) {
      console.error('Blocked: this command nests shells, eval or substitutions too deeply to judge safely. Write it plainly.')
      process.exit(2)
    }
    process.exit(0) // A lexer bug must not turn into a block the agent cannot explain.
  }
  if (reason) {
    console.error(
      `Blocked: \`git ${call.verb}\` is not available to this subagent -- ${reason}.\n` +
        `You may \`git add <paths>\` to stage your work, and read history with status, diff, log and show.\n` +
        `If the task cannot proceed without it, say so in your brief under Uncertainties, or return BLOCKED.`,
    )
    process.exit(2)
  }
  process.exit(0)
}

main()
