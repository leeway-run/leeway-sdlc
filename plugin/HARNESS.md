# Harness: Claude Code

The skills and `PROCESS.md` describe the loop in terms any coding agent can follow. This file supplies what depends on
the agent running it. Each target ships its own `HARNESS.md`; this is the Claude Code one. Read it alongside
`PROCESS.md`, and where the two disagree on a mechanism, this file wins.

version: 0.2.0
agent: claude
plugin-files: the plugin root (this file's directory)

## Delegating to a named agent

Start a subagent with the Agent tool, `subagent_type` set to the agent's namespaced name:
`leeway-sdlc:sdlc-implementer`, `leeway-sdlc:sdlc-reviewer` or `leeway-sdlc:sdlc-divergence-reviewer`. Every
delegation starts a **fresh** agent. Its final message comes back to you as the tool result.

## Governed-agent marker

governed-marker: not used

The hooks identify this plugin's agents from the `agent_type` the harness sends with each call. You never write a
marker.

## Required reading

`required-reading` (SubagentStart) also injects the *Required reading* rows into the implementer and the reviewer.
The brief carries them as well (run-task, "Delegate to the implementer"), so the hook is only reinforcement.

## Instructions and local notes

- **instructions-file:** `CLAUDE.md`. The managed block imports the floor with an `@` line.
- **local-notes-file:** `CLAUDE.local.md`, which is gitignored.

## Permissions for an unattended run

run-story's allow-list goes in the repo's `.claude/settings.json` (`permissions.allow`), or in
`.claude/settings.local.json` for one person.

## Installed version, update and restart

- **installed:** `claude plugin list --json`, entry `leeway-sdlc@<marketplace>`.
- **refresh the source:** `claude plugin marketplace update <marketplace>`, then read the version from
  `<installLocation>/plugin/HARNESS.md`.
- **update:** `claude plugin update leeway-sdlc@<marketplace>`.
- **restart:** restart Claude Code. Until then the session keeps the old skills, agents and hooks.
- **commands:** skills are invoked as `/leeway-sdlc:<skill>`, for example `/leeway-sdlc:sync-repo`.
