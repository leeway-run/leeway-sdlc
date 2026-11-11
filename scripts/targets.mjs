// One row per agent other than Claude Code. build-targets.mjs renders each row into that agent's
// HARNESS.md, its wiring (subagents + the guard hook) and its section of agent-setup/prompt.md, so the
// three never disagree. Facts marked UNVERIFIED come from the agent's docs (2026-11) and are confirmed
// or corrected by the Phase 0 spike in docs/targets/<id>.md. `wait` is how a run waits for an escalation's answer, or
// null when no probe has shown the agent can, so a run there stops instead; set it only with a probe record in
// docs/targets/<id>.md that says `wait: background`. `skillsDir` is where the agent's skills are installed in the repo, or null
// when they live outside it: opencode's is measured (docs/targets/opencode.md); cursor's and grok's are UNVERIFIED, from the
// `skills` CLI 1.7.6 agents table.

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
    skillsDir: null,
    floorImport: 'read-first',
    delegate:
      'Ask for the named agent explicitly, for example "spawn the `sdlc-implementer` agent with this prompt: …". Custom agents are `.codex/agents/<name>.toml`. UNVERIFIED: that the main agent selects a custom agent by name; if it starts a generic one instead, stop and say so rather than running the loop without the agent\'s instructions.',
    wait: null,
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
    skillsDir: null,
    floorImport: 'read-first',
    delegate:
      'Delegate to the custom agent by name: in Copilot CLI the `task` tool with the agent `sdlc-implementer` (or ask "use the sdlc-implementer agent to …"); in VS Code, `runSubagent` with that agent. Agents are `.github/agents/<name>.agent.md`.',
    wait: null,
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
    skillsDir: null,
    floorImport: '@',
    delegate:
      'Each agent in `.gemini/agents/` is a tool of the same name: call the `sdlc-implementer` tool with the prompt. A subagent cannot start another one.',
    wait: null,
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
    skillsDir: '.agents/skills/',
    floorImport: 'read-first',
    delegate: 'Ask for the subagent by name ("use the sdlc-implementer subagent to …", or `/sdlc-implementer`). Agents are `.cursor/agents/<name>.md`.',
    wait: null,
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
    skillsDir: '.agents/skills/',
    floorImport: 'read-first',
    floorSetting: 'also add the ENGINEERING path to `instructions` in `opencode.json` (OpenCode does not follow `@` imports).',
    delegate: 'Use the `subagent` tool, with `agent` set to the agent name, for example `sdlc-implementer`, and the brief in its `prompt` (measured — docs/targets/opencode.md). Agents are `.opencode/agents/<name>.md` with `mode: subagent`.',
    // Rule a: the guard reads the agent from `event.agent`, which names the subagent on its own call
    // (measured — docs/targets/opencode.md, "Hook payloads"), so the marker is not needed here.
    marker: 'not used',
    wait:
      'Start `wait-answer.mjs` (run, "Wait, then carry on") with the shell tool in its background mode, as it is, with\n' +
      'nothing appended. UNVERIFIED: whether appending to the command changes the reported exit code was not tried\n' +
      'here. The turn ends with the command running; the session resumes by itself when it exits, on a notice that\n' +
      "carries the command's output and its exit code, so no turn is spent per check. Do not poll for the output or\n" +
      "sleep while it runs. When the notice comes, act on the exit code as run's table says. Exit 5 is a question,\n" +
      'not the end: answer\n' +
      'it, then start the wait again the same way, a new background command (`PROCESS.md`, "Questions to the human are\n' +
      'escalations"). If the session ends first, the run has stopped as at the deadline: the escalation stays, and\n' +
      're-invoking `run` resumes where there is work left to resume (run, "Land the task", step 5). `plan-project`\'s\n' +
      'developer interview starts and reads its waits the same way; re-invoking `plan-project` resumes it. Every other\n' +
      'skill that raises an escalation starts and reads its waits the same way (`PROCESS.md`, "Questions to the human\n' +
      'are escalations").',
    installed: '`npx skills list -a opencode`.',
    refresh: 'nothing to refresh: the update command fetches the latest.',
    update: `\`npx -y skills add ${REPO}/${SKILLS_PATH} -a opencode --yes\` again (measured: it copies the skills into \`./.agents/skills/\`; a \`tree/main/\` in the path exits 0 with "No skills found" and installs nothing — docs/targets/opencode.md).`,
    restart: 'no restart needed: the plugin reloads on save, and a new session picks up the skills and agent files.',
    commands: 'skills are invoked by name, for example "run the sync-repo skill".',
    install: [`\`npx -y skills add ${REPO}/${SKILLS_PATH} -a opencode --yes\``],
    after: 'Nothing to restart for the plugin: OpenCode 2.x reloads `.opencode/plugins/leeway-sdlc.js` on save (measured — docs/targets/opencode.md), and a new session picks up the skills and agent files.',
    wiring: (agents) => ({
      // OpenCode 2.x loads a plugin as `Plugin.define({ id, setup })` and delivers the guards `setup`
      // registers with `ctx.tool.hook("execute.before", …)`; a V1 function returning `tool.execute.before`
      // is rejected at load, so the guards would be silently absent (docs/targets/opencode.md, "Hook payloads").
      '.opencode/plugins/leeway-sdlc.js': `// The leeway-sdlc guards for OpenCode, which has no shell-command hooks: a plugin's
// execute.before hook throws to refuse a call. Judges with the same adapter as every other agent.
// Written by sdlc-install; synced by sync-repo. See .sdlc/kit/HARNESS.md, "Governed-agent marker".
import { Plugin } from '@opencode/plugin'
import { decide } from '../../.sdlc/kit/hooks/adapters/guard.mjs'

export default Plugin.define({
  id: 'leeway-sdlc',
  async setup(ctx) {
    await ctx.tool.hook('execute.before', (event) => {
      if (event?.tool !== 'shell') return
      const verdict = decide({ agent: event.agent, args: event.input, cwd: ctx.location.directory })
      if (verdict.block) throw new Error(verdict.message)
    })
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
    skillsDir: '.grok/skills/',
    floorImport: 'read-first',
    delegate: 'Delegate to the custom subagent by name ("use the sdlc-implementer subagent to …"). Agents are `.grok/agents/<name>.md`. UNVERIFIED: the delegation tool\'s name.',
    wait: null,
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

## Running the plugin's scripts

- **wait-answer:** \`node .sdlc/kit/scripts/wait-answer.mjs\`
- **session-tokens:** \`node .sdlc/kit/scripts/session-tokens.mjs\`
- **raise:** \`node .sdlc/kit/scripts/raise.mjs\`

## Delegating to a named agent

${t.delegate} Every delegation starts a **fresh** agent, and its final message is what you gate.

## Handing over to a skill

Hand a story to another skill, for example \`shape-project\`, by invoking that skill in this session with the story's ref: in ${t.name}, ${t.commands}
UNVERIFIED: no probe has shown in ${t.name} that the invoked skill takes over the session for that story, that a wait or another story's planning carries on during the hand-over, or that handing the story back resumes the first run (docs/targets/${t.id}.md).

## Governed-agent marker

${
  t.marker === 'not used'
    ? `governed-marker: not used

The guards identify this plugin's agents from the \`agent\` the event carries with each call, so a subagent's shell
call and yours are told apart without a marker. You never write one.`
    : `governed-marker: required

The guards cannot yet tell a subagent's shell call from yours in ${t.name} (docs/targets/${t.id}.md records what
its hooks send). So mark the window: immediately before each delegation, from the repo root,

    node .sdlc/kit/hooks/adapters/governed.mjs on <task-ref>

and as soon as the agent returns, **however it returns**,

    node .sdlc/kit/hooks/adapters/governed.mjs off <task-ref>

While the marker is live every shell call is judged as the subagent's, yours included, so never commit, push or
write to Leeway with it on. It expires on its own after two hours, so a crashed run cannot lock you out for longer.`
}

## Waiting for an answer

${
  t.wait
    ? `wait: background\n\n${t.wait} docs/targets/${t.id}.md records the probe.`
    : `wait: stop

A run in ${t.name} does not wait for an escalation's answer. UNVERIFIED: whether ${t.name} can run a long command
without spending a turn per check and resume the session when it exits; no probe has shown it (docs/targets/${t.id}.md).
Until one does, skip steps 2 and 3 of run's "Wait, then carry on" and act at once as its step 4 says for exit 2. A
wait that blocks nothing, such as a sub-issue run's debt proposal ("Land the task", step 5), carries on. Any other
posts what the path posts, says which escalation on which issue it stopped on, and stops the turn. The escalation and
any \`# Run status\` comment stay, and re-invoking \`run\` once it is answered resumes where there is work left to
resume (run, "Land the task", step 5). \`plan-project\`'s developer interview does not wait either: it stops the turn
the same way, and re-invoking \`plan-project\` once it is answered resumes it. Nor does any other skill that raises
one (\`PROCESS.md\`, "Questions to the human are escalations"): each stops the turn the same way. Nobody is listening
once a skill stops, so a question a person asks of the agent on its escalation is handed back to them after 30
minutes.`
}

## Counting tokens

tokens: none

A run in ${t.name} cannot count tokens: \`session-tokens.mjs\` reads Claude Code's transcripts, and no probe has shown
where ${t.name} keeps its own or in what shape. So every record leaves \`--tokens\` out (run, "Recording spend"): never
\`--tokens 0\`, never an estimate. Every total then reads \`tokensIncomplete\`, a floor, and the run carries on.

## Required reading

run pastes the *Required reading* rows into each brief; no hook injects them here.

## Instructions and local notes

- **instructions-file:** \`${t.instructionsFile}\`.
- **floor-import:** ${t.floorImport === '@' ? '`@` (the managed block imports the floor with an `@` line)' : 'read-first (this agent does not expand `@` imports: the block tells the agent to read the floor)'}${t.floorSetting ? `; ${t.floorSetting}` : ''}.
- **local-notes-file:** \`.sdlc/local.md\`, gitignored.
${t.skillsDir ? `- **skills-dir:** \`${t.skillsDir}\`, gitignored; \`skills-lock.json\` is committed.` : '- **skills-dir:** none (the skills are installed outside the repo).'}

## Wiring

sdlc-install writes these from \`kit/wiring/${t.id}/\`, and sync-repo keeps them current:
${Object.keys(t.wiring([{ name: 'sdlc-implementer', description: '', body: '' }]))
  .map((p) => `- \`${p.replace('sdlc-implementer', '<agent>')}\``)
  .join('\n')}

After writing them: ${t.after}

## Permissions for an unattended run

An unattended run uses ${t.name}'s own unattended or auto-approve mode, if it has one, which the person starts: the run
does not turn it on, and the plugin writes no rule and no setting for it. Without such a mode, a person approves each
prompt, and the run is attended; run ("Unattended prerequisites") says what else an unattended run needs.

UNVERIFIED: no mode has been tried here for ${t.name}, and none is named.

## Installed version, update and restart

- **installed:** ${t.installed}
- **refresh the source:** ${t.refresh}
- **update:** ${t.update}
- **restart:** ${t.restart}
- **commands:** ${t.commands}
`
