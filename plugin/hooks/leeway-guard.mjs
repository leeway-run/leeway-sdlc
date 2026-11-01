// PreToolUse hook for this plugin's SDLC subagents: a governed agent may read Leeway through the
// `leeway` CLI, never write to it.
//
// The orchestrator is the single writer to the tracker. A subagent that holds the user's logged-in
// CLI could otherwise comment, record an iteration or answer an escalation under the user's name,
// and no tools allowlist can tell `leeway issue get` from `leeway issue update` -- both are Bash.
// Same scoping as git-guard.mjs: the call is judged only when `agent_type` starts with this
// plugin's prefix, so the orchestrator (no `agent_type`) and another plugin's agents pass.
//
// Contract: read the tool call as JSON on stdin, exit 0 to allow, exit 2 to block with the reason
// on stderr. No dependencies. Tests: `node --test plugin/hooks/leeway-guard.test.mjs`.
//
// The lexer below (lex, wrappedScript; commandName also strips .cmd/.bat/.ps1) is copied from git-guard.mjs, not shared: each
// hook stays one self-contained file that can be read, tested and run on its own. A fix to one
// belongs in the other.
//
// What this is not: a sandbox. It closes the direct forms (`leeway`, `leeway.js`, `.cmd`, `.ps1`,
// `npx @leeway-run/cli`) and the common wrappers (`sh -c`, `eval`, `env -S`, `pwsh -c`, `cmd /c`, a shell
// reading its script from a pipe or here-string, `xargs leeway`). Out of reach: a script file the
// agent wrote and then runs, an interpreter (`node -e`, `python -c`) calling the CLI, a variable or
// alias standing for the program (`$L`, `alias`, `eval $CMD`), an ANSI-C escape spelling the name
// (`$'\x6ceeway'`), and an unquoted Windows path (the shell would eat its backslashes).
//
// Bound: a command is judged in at most MAX_SCRIPTS nested scripts (each `sh -c`, `eval`,
// `$(...)` body counts one, chain depth at most MAX_DEPTH). A command past either limit is
// BLOCKED, not allowed: nothing legitimate nests that deep, and failing open would let a long
// `eval eval ...` chain carry a write past the guard. Each script is lexed once, in linear time.

import { realpathSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const GOVERNED_AGENT_PREFIX = 'leeway-sdlc:'

const MAX_SCRIPTS = 200
const MAX_DEPTH = 8
class TooComplex extends Error {}

// Verbs (the second word, after the resource) that only read.
const READ_VERBS = new Set(['get', 'list', 'whoami', 'help', 'version'])
// Top-level commands that are not `<resource> <verb>`: these read, or (login, logout) write.
const READ_COMMANDS = new Set(['whoami', 'help', 'version'])
// Global flags that take a separate value, so the token after them is not a resource or verb.
const OPTS_WITH_VALUE = new Set(['--as', '--server'])
const HELP_FLAGS = new Set(['-h', '--help', '--version'])

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

// `C:\Program Files\...\leeway.cmd` and `/usr/bin/leeway` are both leeway.
const commandName = (word) =>
  word.split(/[\\/]/).pop().toLowerCase().replace(/\.(exe|cmd|bat|ps1)$/, '')

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

// The leeway CLI is `leeway` on PATH, `node <path>/leeway.js`, or the package `@leeway-run/cli`
// (`npx @leeway-run/cli`, `npx @leeway-run/cli@1.2.3`). `@leeway/cli`, its placeholder name, still counts.
const isLeeway = (word) => {
  const name = commandName(word)
  return name === 'leeway' || name === 'leeway.js' || /^@leeway(-run)?\/cli(@[^/\s]*)?$/i.test(word)
}

// A POSIX shell with no `-c` and no script operand (or only a `<<<` / `<` redirection) reads its script from stdin.
const readsStdin = (words, i) => {
  if (!POSIX_SHELLS.has(commandName(words[i]))) return false
  let j = i + 1
  for (; j < words.length && /^[-+]/.test(words[j]); j++) {
    if (/^-[a-zA-Z]*c[a-zA-Z]*$/.test(words[j])) return false
    if (/^[-+][oO]$/.test(words[j])) j++
  }
  return j >= words.length || words[j].startsWith('<')
}

// Every leeway invocation in a command line, as { args, fromXargs }, following shell wrappers.
// `budget` is shared across the whole recursion, so work is bounded however the chain is shaped.
const leewayInvocations = (command, depth = 0, budget = { left: MAX_SCRIPTS }) => {
  if (depth > MAX_DEPTH || --budget.left < 0) throw new TooComplex()
  const found = []
  const { segments, nested } = lex(command)
  for (const script of nested) found.push(...leewayInvocations(script, depth + 1, budget))
  let stdinShell = false
  for (const words of segments) {
    const xargsAt = words.findIndex((w) => commandName(w) === 'xargs')
    for (let i = 0; i < words.length; i++) {
      const script = wrappedScript(words, i)
      if (script) found.push(...leewayInvocations(script, depth + 1, budget))
      if (readsStdin(words, i)) stdinShell = true
      if (isLeeway(words[i])) found.push({ args: words.slice(i + 1), fromXargs: xargsAt !== -1 && xargsAt < i })
    }
  }
  if (stdinShell) {
    // The script arrives on stdin and cannot be seen; judge every multi-word argument as one.
    for (const words of segments) {
      for (const w of words) if (/\s/.test(w)) found.push(...leewayInvocations(w, depth + 1, budget))
    }
  }
  return found
}

// The command's own words once global flags are dropped, then why it is a write, or null.
// With `fromXargs` the missing words arrive on stdin, so a call that does not name a read is unknown.
const writeReason = ({ args, fromXargs }) => {
  if (args.some((a) => HELP_FLAGS.has(a))) return null
  const positionals = []
  for (let k = 0; k < args.length; k++) {
    if (OPTS_WITH_VALUE.has(args[k])) k++
    else if (!args[k].startsWith('-')) positionals.push(args[k])
  }
  const [first, second] = positionals
  if (first !== undefined && READ_COMMANDS.has(first)) return null
  if (first === 'login' || first === 'logout') return `\`${first}\` changes the stored credential`
  if (fromXargs && (first === undefined || second === undefined)) {
    return 'the arguments come from xargs and cannot be judged'
  }
  if (first === undefined || second === undefined || READ_VERBS.has(second)) return null
  return `\`${first} ${second}\` writes`
}

// The decision for one command a governed agent wants to run, independent of any agent's hook
// format: `{ block: false }`, or `{ block: true, message }`. Exported for adapters/guard.mjs.
export const judge = (command) => {
  if (typeof command !== 'string') return { block: false }
  let invocations
  try {
    invocations = leewayInvocations(command)
  } catch (err) {
    if (err instanceof TooComplex) {
      return { block: true, message: 'Blocked: this command nests shells, eval or substitutions too deeply to judge safely. Write it plainly.' }
    }
    return { block: false } // A lexer bug must not turn into a block the agent cannot explain.
  }
  for (const call of invocations) {
    const reason = writeReason(call)
    if (!reason) continue
    return {
      block: true,
      message:
        `Blocked: ${reason}, and the orchestrator is the only writer to Leeway.\n` +
        `You may read: leeway <resource> get|list, leeway whoami, leeway help, leeway version, and --help on any command.\n` +
        `If the task needs a write, say so in your brief under Uncertainties, or return BLOCKED.`,
    }
  }
  return { block: false }
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

  const agentType = input?.agent_type
  if (typeof agentType !== 'string' || !agentType.startsWith(GOVERNED_AGENT_PREFIX)) process.exit(0)

  const verdict = judge(command)
  if (verdict.block) {
    console.error(verdict.message)
    process.exit(2)
  }
  process.exit(0)
}

// Run as a hook only when executed directly; importing this file (the adapters do) has no effect.
const isMain = () => {
  try {
    return import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href
  } catch {
    return false
  }
}
if (isMain()) main()
