// One row per agent other than Claude Code. build-targets.mjs renders each row into that agent's
// HARNESS.md, its wiring (subagents + the guard hook) and its section of agent-setup/prompt.md, so the
// three never disagree. Facts marked UNVERIFIED come from the agent's docs (2026-11) and are confirmed
// or corrected by the Phase 0 spike in docs/targets/<id>.md.

const GUARD = (agent, extra = '') => `node .sdlc/kit/hooks/adapters/guard.mjs ${agent}${extra}`
const REPO = 'leeway-run/leeway-sdlc'
const SKILLS_PATH = 'targets/agents/skills'

const quote = (s) => JSON.stringify(s) // valid as a YAML and a TOML basic string
const json = (o) => JSON.stringify(o, null, 2) + '\n'

// `a` is { name, description, readOnly, body } parsed from plugin/agents/<name>.md.
const md = (front, body) => `---\n${front.filter(Boolean).join('\n')}\n---\n\n${body.trimStart()}`

export const TARGETS = [
  {
    id: 'codex',
    name: 'OpenAI Codex CLI',
    instructionsFile: 'AGENTS.md',
    floorImport: 'read-first',
    delegate:
      'Ask for the named agent explicitly, for example "spawn the `sdlc-implementer` agent with this prompt: …". Custom agents are `.codex/agents/<name>.toml`. UNVERIFIED: that the main agent selects a custom agent by name; if it starts a generic one instead, stop and say so rather than running the loop without the agent\'s instructions.',
    permissions: '`.codex/config.toml` (approval policy and sandbox), or the `/approvals` setting for one person.',
    installed: 'the leeway-sdlc entry under `/plugins` in the Codex TUI.',
    refresh: '`codex plugin marketplace add leeway-run/leeway-sdlc` refreshes the marketplace; the new version is in `targets/agents/HARNESS.md` there.',
    update: 'update leeway-sdlc-agents from `/plugins`.',
    restart: 'start a new Codex session.',
    commands: 'skills are invoked as `$<skill>` or picked from `/skills`, for example `$sync-repo`.',
    install: [
      '`codex plugin marketplace add leeway-run/leeway-sdlc`',
      'In Codex, open `/plugins` and install **leeway-sdlc-agents**.',
    ],
    after: 'Open `/hooks` and trust the leeway-sdlc hook in `.codex/hooks.json`: Codex does not run a project hook until you do.',
    wiring: (agents) => ({
      '.codex/hooks.json': json({ hooks: { PreToolUse: [{ matcher: '.*', hooks: [{ type: 'command', command: GUARD('codex') }] }] } }),
      ...Object.fromEntries(
        agents.map((a) => [
          `.codex/agents/${a.name}.toml`,
          `name = ${quote(a.name)}\ndescription = ${quote(a.description)}\ndeveloper_instructions = '''\n${a.body.trim()}\n'''\n`,
        ]),
      ),
    }),
  },
  {
    id: 'copilot',
    name: 'GitHub Copilot (CLI and VS Code agent mode)',
    instructionsFile: 'AGENTS.md',
    floorImport: 'read-first',
    delegate:
      'Delegate to the custom agent by name: in Copilot CLI the `task` tool with the agent `sdlc-implementer` (or ask "use the sdlc-implementer agent to …"); in VS Code, `runSubagent` with that agent. Agents are `.github/agents/<name>.agent.md`.',
    permissions: '`.github/copilot/settings.json` (`permissions`), or `--allow-tool` flags for one run.',
    installed: '`copilot plugin list`.',
    refresh: '`copilot plugin marketplace update` where it was installed from a marketplace; otherwise the install command again.',
    update: '`copilot plugin install leeway-run/leeway-sdlc:targets/agents` again (it replaces the installed version).',
    restart: 'start a new Copilot session (VS Code: reload the window).',
    commands: 'skills are invoked as `/<skill>`, for example `/sync-repo`.',
    install: [
      'Copilot CLI: `copilot plugin install leeway-run/leeway-sdlc:targets/agents`',
      'VS Code: Command Palette → **Chat: Install Plugin from Source** → `https://github.com/leeway-run/leeway-sdlc`, path `targets/agents`.',
    ],
    after: 'Nothing to trust: Copilot runs `.github/hooks/*.json` from the repo. The Copilot cloud coding agent is not supported by this version.',
    wiring: (agents) => ({
      '.github/hooks/leeway-sdlc.json': json({ version: 1, hooks: { preToolUse: [{ type: 'command', bash: GUARD('copilot'), timeoutSec: 30 }] } }),
      ...Object.fromEntries(
        agents.map((a) => [
          `.github/agents/${a.name}.agent.md`,
          md(
            [
              `name: ${a.name}`,
              `description: ${quote(a.description)}`,
              // Rule b: the hook on the agent itself, so it governs only this agent. UNVERIFIED shape.
              'hooks:',
              '  preToolUse:',
              '    - type: command',
              `      bash: ${quote(GUARD('copilot', ' --governed'))}`,
            ],
            a.body,
          ),
        ]),
      ),
    }),
  },
  {
    id: 'gemini',
    name: 'Google Gemini CLI',
    instructionsFile: 'GEMINI.md',
    floorImport: '@',
    delegate:
      'Each agent in `.gemini/agents/` is a tool of the same name: call the `sdlc-implementer` tool with the prompt. A subagent cannot start another one.',
    permissions: '`.gemini/settings.json` (`tools.allowed`), or `--allowed-tools` for one run.',
    installed: '`gemini skills list`.',
    refresh: 'the install command again; the new version is in `targets/agents/HARNESS.md` of `leeway-run/leeway-sdlc`.',
    update: '`gemini skills install https://github.com/leeway-run/leeway-sdlc --path targets/agents/skills --scope workspace --consent` again.',
    restart: 'start a new Gemini CLI session.',
    commands: 'skills are invoked by name, for example "run the sync-repo skill".',
    install: ['`gemini skills install https://github.com/leeway-run/leeway-sdlc --path targets/agents/skills --scope workspace --consent`'],
    after: 'Nothing to trust. If your account was moved to Antigravity CLI, this setup is UNVERIFIED there.',
    wiring: (agents) => ({
      '.gemini/settings.json': json({
        hooks: { BeforeTool: [{ matcher: 'run_shell_command', hooks: [{ type: 'command', name: 'leeway-sdlc-guard', command: GUARD('gemini') }] }] },
      }),
      ...Object.fromEntries(
        agents.map((a) => [`.gemini/agents/${a.name}.md`, md([`name: ${a.name}`, `description: ${quote(a.description)}`], a.body)]),
      ),
    }),
  },
  {
    id: 'cursor',
    name: 'Cursor (agent and CLI)',
    instructionsFile: 'AGENTS.md',
    floorImport: 'read-first',
    delegate: 'Ask for the subagent by name ("use the sdlc-implementer subagent to …", or `/sdlc-implementer`). Agents are `.cursor/agents/<name>.md`.',
    permissions: '`.cursor/cli.json` (`permissions.allow`) for the CLI; the agent settings for the editor.',
    installed: '`npx skills list -a cursor`.',
    refresh: 'nothing to refresh: the update command fetches the latest.',
    update: `\`npx -y skills add ${REPO}/tree/main/${SKILLS_PATH} -a cursor --yes\` again. UNVERIFIED: the subpath form; see docs/targets/cursor.md.`,
    restart: 'start a new chat (CLI: restart `cursor-agent`).',
    commands: 'skills are invoked by name, for example "run the sync-repo skill".',
    install: [`\`npx -y skills add ${REPO}/tree/main/${SKILLS_PATH} -a cursor --yes\``],
    after: 'Nothing to trust: Cursor runs `.cursor/hooks.json` from the repo.',
    wiring: (agents) => ({
      '.cursor/hooks.json': json({ version: 1, hooks: { beforeShellExecution: [{ command: GUARD('cursor') }] } }),
      ...Object.fromEntries(
        agents.map((a) => [
          `.cursor/agents/${a.name}.md`,
          md([`name: ${a.name}`, `description: ${quote(a.description)}`, a.readOnly ? 'readonly: true' : null], a.body),
        ]),
      ),
    }),
  },
  {
    id: 'opencode',
    name: 'OpenCode',
    instructionsFile: 'AGENTS.md',
    floorImport: 'read-first',
    floorSetting: 'also add the ENGINEERING path to `instructions` in `opencode.json` (OpenCode does not follow `@` imports).',
    delegate: 'Use the Task tool with `subagent_type` set to the agent name, for example `sdlc-implementer`. Agents are `.opencode/agents/<name>.md` with `mode: subagent`.',
    permissions: '`opencode.json` (`permission.bash`).',
    installed: '`npx skills list -a opencode`.',
    refresh: 'nothing to refresh: the update command fetches the latest.',
    update: `\`npx -y skills add ${REPO}/tree/main/${SKILLS_PATH} -a opencode --yes\` again. UNVERIFIED: the subpath form; see docs/targets/opencode.md.`,
    restart: 'restart OpenCode (plugins load at startup).',
    commands: 'skills are invoked by name, for example "run the sync-repo skill".',
    install: [`\`npx -y skills add ${REPO}/tree/main/${SKILLS_PATH} -a opencode --yes\``],
    after: 'Restart OpenCode so it loads `.opencode/plugins/leeway-sdlc.js`.',
    wiring: (agents) => ({
      '.opencode/plugins/leeway-sdlc.js': `// The leeway-sdlc guards for OpenCode, which has no shell-command hooks: a plugin's
// tool.execute.before throws to refuse a call. Judges with the same adapter as every other agent.
// Written by sdlc-install; synced by sync-repo. See .sdlc/kit/HARNESS.md, "Governed-agent marker".
import { decide } from '../../.sdlc/kit/hooks/adapters/guard.mjs'

export const LeewaySdlcGuard = async ({ directory } = {}) => ({
  'tool.execute.before': async (input, output) => {
    if (input?.tool !== 'bash') return
    const verdict = decide({ args: output?.args, cwd: directory })
    if (verdict.block) throw new Error(verdict.message)
  },
})
`,
      ...Object.fromEntries(
        agents.map((a) => [
          `.opencode/agents/${a.name}.md`,
          md([`description: ${quote(a.description)}`, 'mode: subagent', a.readOnly ? 'permission:\n  edit: deny' : null], a.body),
        ]),
      ),
    }),
  },
  {
    id: 'grok',
    name: 'xAI Grok Build',
    instructionsFile: 'AGENTS.md',
    floorImport: 'read-first',
    delegate: 'Delegate to the custom subagent by name ("use the sdlc-implementer subagent to …"). Agents are `.grok/agents/<name>.md`. UNVERIFIED: the delegation tool\'s name.',
    permissions: '`~/.grok/config.toml` or the project\'s `.grok/` settings (permission rules).',
    installed: '`grok inspect` (lists skills).',
    refresh: 'nothing to refresh: the update command fetches the latest.',
    update: `\`npx -y skills add ${REPO}/tree/main/${SKILLS_PATH} -a grok --yes\` again.`,
    restart: 'start a new Grok session.',
    commands: 'user-invocable skills are `/<skill>`, for example `/sync-repo`.',
    install: [`\`npx -y skills add ${REPO}/tree/main/${SKILLS_PATH} -a grok --yes\``],
    after: 'Run `/hooks-trust` in Grok so it runs `.grok/hooks/leeway-sdlc.json`. Grok hooks fail open: a crashed or timed-out guard lets the command run.',
    wiring: (agents) => ({
      '.grok/hooks/leeway-sdlc.json': json({ hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: GUARD('grok') }] }] } }),
      ...Object.fromEntries(
        agents.map((a) => [`.grok/agents/${a.name}.md`, md([`name: ${a.name}`, `description: ${quote(a.description)}`], a.body)]),
      ),
    }),
  },
]

// The HARNESS.md of one agent, in the shape of plugin/HARNESS.md (the Claude Code one).
export const harness = (t, version, notice) => `# Harness: ${t.name}

${notice}

The skills and \`PROCESS.md\` describe the loop in terms any coding agent can follow; this file supplies what
depends on the agent running it. Read it alongside \`PROCESS.md\`; where the two disagree on a mechanism, this file
wins. Generated by scripts/build-targets.mjs from scripts/targets.mjs; do not edit a copy by hand.

version: ${version}
agent: ${t.id}
plugin-files: .sdlc/kit/

## Delegating to a named agent

${t.delegate} Every delegation starts a **fresh** agent, and its final message is what you gate.

## Governed-agent marker

governed-marker: required

The guards cannot yet tell a subagent's shell call from yours in ${t.name} (docs/targets/${t.id}.md records what
its hooks send). So mark the window: immediately before each delegation, from the repo root,

    node .sdlc/kit/hooks/adapters/governed.mjs on <task-ref>

and as soon as the agent returns, **however it returns**,

    node .sdlc/kit/hooks/adapters/governed.mjs off <task-ref>

While the marker is live every shell call is judged as the subagent's, yours included, so never commit, push or
write to Leeway with it on. It expires on its own after two hours, so a crashed run cannot lock you out for longer.

## Required reading

run-task pastes the *Required reading* rows into each brief; no hook injects them here.

## Instructions and local notes

- **instructions-file:** \`${t.instructionsFile}\`.
- **floor-import:** ${t.floorImport === '@' ? '`@` (the managed block imports the floor with an `@` line)' : 'read-first (this agent does not expand `@` imports: the block tells the agent to read the floor)'}${t.floorSetting ? `; ${t.floorSetting}` : ''}.
- **local-notes-file:** \`.sdlc/local.md\`, gitignored.

## Wiring

sdlc-install writes these from \`kit/wiring/${t.id}/\`, and sync-repo keeps them current:
${Object.keys(t.wiring([{ name: 'sdlc-implementer', description: '', body: '' }]))
  .map((p) => `- \`${p.replace('sdlc-implementer', '<agent>')}\``)
  .join('\n')}

After writing them: ${t.after}

## Permissions for an unattended run

run-story's allow-list goes in ${t.permissions}

## Installed version, update and restart

- **installed:** ${t.installed}
- **refresh the source:** ${t.refresh}
- **update:** ${t.update}
- **restart:** ${t.restart}
- **commands:** ${t.commands}
`
