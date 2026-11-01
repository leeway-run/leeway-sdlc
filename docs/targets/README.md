# Phase 0: what each agent's hooks actually send

Before leeway-sdlc ships for an agent, we need answers to a few questions about it. The answers come from running
that agent, not from its docs. Each agent gets a page here, `docs/targets/<agent>.md`, filled in from
[`TEMPLATE.md`](TEMPLATE.md). The answers decide how `plugin/hooks/adapters/guard.mjs` scopes the guards for that
agent:

| Rule | When to use it | How it governs |
|---|---|---|
| **a** | The hook payload names the agent that made the call | an identity field matching `sdlc-*` / `leeway-sdlc:sdlc-*` |
| **b** | Hooks can be declared on the agent definition itself | `guard.mjs <agent> --governed` in that agent's hooks |
| **c** | Neither of those is possible | a marker written by `adapters/governed.mjs` while the subagent runs |

## The run, per agent (about an hour)

1. In a scratch git repo, install and sign in to the agent.
2. Copy `probe.mjs` from this directory to `<scratch>/.probe/probe.mjs`.
3. Wire it into the agent's hooks with the snippet below. For each event, pass the agent's id and the event name
   (`node .probe/probe.mjs <agent> <event>`). Trust the hooks if the agent asks.
4. Add a custom subagent named `sdlc-implementer` with the snippet below (an instruction like "run the shell command
   the user gives you, then stop").
5. In the main session, ask the agent to run `git status`.
6. Ask the agent to **delegate to `sdlc-implementer`** and have it run `git log -1`.
7. Read `<scratch>/.sdlc-probe/<agent>.jsonl`. Steps 5 and 6 should give one PreToolUse line each, plus lines for
   any session or subagent events.
8. Try the guard. Wire `node <repo>/plugin/hooks/adapters/guard.mjs <agent> --governed` instead of the probe. Ask
   the agent to run `git commit --allow-empty -m probe`. Confirm that the commit is refused **and** that the agent
   shows the reason. This checks that exit 2 with stderr is a deny for this agent.
9. Fill in `docs/targets/<agent>.md`. Paste one redacted payload from the main session and one from the subagent
   into `plugin/hooks/adapters/fixtures/<agent>.json`, so the tests use real shapes.

The probe logs payloads and environment variable **names**. It never logs environment values, apart from a few
hook-metadata variables. Still read the `.jsonl` file before you commit any of it.

## Wiring, per agent

These snippets are taken from each agent's docs as of 2026-11. If a snippet doesn't work, say so on that agent's
page.

### Codex CLI — `<scratch>/.codex/hooks.json`
```json
{ "hooks": {
  "PreToolUse":    [{ "matcher": ".*", "hooks": [{ "type": "command", "command": "node .probe/probe.mjs codex PreToolUse" }] }],
  "SubagentStart": [{ "hooks": [{ "type": "command", "command": "node .probe/probe.mjs codex SubagentStart" }] }],
  "SessionStart":  [{ "hooks": [{ "type": "command", "command": "node .probe/probe.mjs codex SessionStart" }] }]
} }
```
Trust the hooks in `/hooks`. Subagent file `.codex/agents/sdlc-implementer.toml`:
`name = "sdlc-implementer"`, `description = "…"`, `developer_instructions = "…"`.
Also check: does the main agent pick `sdlc-implementer` **by name** when asked?

### GitHub Copilot CLI — `<scratch>/.github/hooks/probe.json`
```json
{ "version": 1, "hooks": {
  "preToolUse":    [{ "type": "command", "bash": "node .probe/probe.mjs copilot preToolUse" }],
  "subagentStart": [{ "type": "command", "bash": "node .probe/probe.mjs copilot subagentStart" }],
  "sessionStart":  [{ "type": "command", "bash": "node .probe/probe.mjs copilot sessionStart" }]
} }
```
Subagent `.github/agents/sdlc-implementer.agent.md`. Run it twice:

- once with no `hooks:` in its frontmatter;
- once with `hooks:` running `node .probe/probe.mjs copilot agent-preToolUse`.

The second run checks rule b. Do agent-level hooks fire **only** for that agent? Repeat in VS Code agent mode.

### Gemini CLI — `<scratch>/.gemini/settings.json`
```json
{ "hooks": {
  "BeforeTool":   [{ "matcher": ".*", "hooks": [{ "type": "command", "command": "node .probe/probe.mjs gemini BeforeTool" }] }],
  "SessionStart": [{ "hooks": [{ "type": "command", "command": "node .probe/probe.mjs gemini SessionStart" }] }]
} }
```
Subagent `.gemini/agents/sdlc-implementer.md` (frontmatter `name`, `description`). Also check:

- Can `gemini extensions install` install from a subdirectory or a `--ref` of `leeway-run/leeway-sdlc`?
- Does Antigravity CLI load the same extension?

### Cursor (CLI and IDE) — `<scratch>/.cursor/hooks.json`
```json
{ "version": 1, "hooks": {
  "beforeShellExecution": [{ "command": "node .probe/probe.mjs cursor beforeShellExecution" }],
  "preToolUse":           [{ "command": "node .probe/probe.mjs cursor preToolUse" }]
} }
```
Subagent `.cursor/agents/sdlc-implementer.md`.

### OpenCode — `<scratch>/.opencode/plugins/probe.js`
```js
import { appendFileSync, mkdirSync } from 'node:fs'
export const Probe = async (ctx) => ({
  'tool.execute.before': async (input, output) => {
    mkdirSync('.sdlc-probe', { recursive: true })
    appendFileSync('.sdlc-probe/opencode.jsonl', JSON.stringify({ at: new Date().toISOString(), input, args: output.args, ctxKeys: Object.keys(ctx ?? {}) }) + '\n')
  },
})
```
Subagent `.opencode/agents/sdlc-implementer.md` with `mode: subagent`. Also check:

- Does `input` carry the session or agent? Does a subagent's call carry a different `sessionID` from the parent's?
- Throwing an Error is the documented deny. Does it actually stop a **bash** call?

### Grok Build — `<scratch>/.grok/hooks/probe.json`
```json
{ "hooks": {
  "PreToolUse":    [{ "matcher": ".*", "hooks": [{ "type": "command", "command": "node .probe/probe.mjs grok PreToolUse" }] }],
  "SubagentStart": [{ "hooks": [{ "type": "command", "command": "node .probe/probe.mjs grok SubagentStart" }] }],
  "SessionStart":  [{ "hooks": [{ "type": "command", "command": "node .probe/probe.mjs grok SessionStart" }] }]
} }
```
Trust the hooks with `/hooks-trust`. Subagent `.grok/agents/sdlc-implementer.md`. Also check whether
`grok plugin marketplace add leeway-run/leeway-sdlc` followed by `grok plugin install leeway-sdlc --trust` installs
the Claude plugin unchanged. If it does, record which parts work: skills, agents, hooks, and `${CLAUDE_PLUGIN_ROOT}`.
