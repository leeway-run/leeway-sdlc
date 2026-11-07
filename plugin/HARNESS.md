# Harness: Claude Code

The skills and `PROCESS.md` describe the loop in terms any coding agent can follow. This file supplies what depends on
the agent running it. Each target ships its own `HARNESS.md`; this is the Claude Code one. Read it alongside
`PROCESS.md`, and where the two disagree on a mechanism, this file wins.

version: 0.3.0
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

## Waiting for an answer

wait: background

Start `wait-answer.mjs` (run, "Wait, then carry on") with the Bash tool and `run_in_background: true`, as it is,
with nothing appended: an `; echo` after it would become the exit code the harness reports. The harness runs it
detached and wakes the session when it exits, naming its exit code and its output file, so no turn is spent per
check. Do not poll the output file or sleep while it runs. When the notification comes, read the output file and act
on the exit code as run's table says. If the session ends first, the run has stopped as at the deadline: the
escalation stays, and re-invoking `run` resumes where there is work left to resume (run, "Land the task", step 5).
`plan-project`'s developer interview starts and reads its waits the same way; re-invoking `plan-project` resumes it.
docs/targets/claude.md records the probe.

## Counting tokens

tokens: transcripts

Claude Code writes each agent's transcript under `${CLAUDE_CONFIG_DIR:-$HOME/.claude}/projects/`, and the Bash tool's
environment names the session in `CLAUDE_CODE_SESSION_ID`. Run `session-tokens.mjs` (run, "Recording spend") with the
Bash tool, on one of these:

- **A subagent:** `${CLAUDE_CONFIG_DIR:-$HOME/.claude}/projects/*/$CLAUDE_CODE_SESSION_ID/subagents/agent-<agent id>.jsonl`.
  The Agent tool's result says `agentId: <agent id>`, and a background agent's completion notice says
  `<task-id><agent id></task-id>`: keep it from the delegation until its record.
- **Your session:** `${CLAUDE_CONFIG_DIR:-$HOME/.claude}/projects/*/$CLAUDE_CODE_SESSION_ID.jsonl`.

The `*` is the project directory, named after where the session started, not where you are now. An empty variable or
a transcript that is not there makes the script exit non-zero, so that record leaves `--tokens` out, as it does when
a subagent's agent id is lost. Never take `subagent_tokens` from the completion notice instead: it is the agent's
final context size.

Stamp a span's end in one tool call and run the script in a later one, never the same call or the same parallel batch.
A call's lines reach the transcript after its command starts, so a count from inside that call misses it. They are
timed before the command runs, so the stamp, to the millisecond, takes in the call that took it.
docs/targets/claude.md records the probe.

## Required reading

`required-reading` (SubagentStart) also injects the *Required reading* rows into the implementer and the reviewer.
The brief carries them as well (run, "Delegate to the implementer"), so the hook is only reinforcement.

## Instructions and local notes

- **instructions-file:** `CLAUDE.md`. The managed block imports the floor with an `@` line.
- **local-notes-file:** `CLAUDE.local.md`, which is gitignored.

## Permissions for an unattended run

run's allow-list goes in the repo's `.claude/settings.json` (`permissions.allow`), or in
`.claude/settings.local.json` for one person.

## Installed version, update and restart

- **installed:** `claude plugin list --json`, entry `leeway-sdlc@<marketplace>`.
- **refresh the source:** `claude plugin marketplace update <marketplace>`, then read the version from
  `<installLocation>/plugin/HARNESS.md`.
- **update:** `claude plugin update leeway-sdlc@<marketplace>`.
- **restart:** restart Claude Code. Until then the session keeps the old skills, agents and hooks.
- **commands:** skills are invoked as `/leeway-sdlc:<skill>`, for example `/leeway-sdlc:sync-repo`.
