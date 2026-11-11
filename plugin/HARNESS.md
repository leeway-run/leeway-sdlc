# Harness: Claude Code

The skills and `PROCESS.md` describe the loop in terms any coding agent can follow. This file supplies what depends on
the agent running it. Each target ships its own `HARNESS.md`; this is the Claude Code one. Read it alongside
`PROCESS.md`, and where the two disagree on a mechanism, this file wins.

version: 0.3.1
agent: claude
plugin-files: the plugin root (this file's directory)

## Running the plugin's scripts

- **wait-answer:** `leeway-sdlc-wait-answer`
- **session-tokens:** `leeway-sdlc-session-tokens`
- **raise:** `leeway-sdlc-raise`

All three are in the plugin's `bin/`, which Claude Code 2.1.91 and later puts on the Bash tool's `PATH` while the plugin is enabled, so a call
reads the same for every person and every version. **The limit:** claude.ai and Cowork don't install a plugin
with a top-level `bin/`, so this plugin installs in Claude Code only. Other agents have no `bin/`: their harness names `node .sdlc/kit/scripts/<script>.mjs`.

## Delegating to a named agent

Start a subagent with the Agent tool, `subagent_type` set to the agent's namespaced name:
`leeway-sdlc:sdlc-implementer`, `leeway-sdlc:sdlc-reviewer` or `leeway-sdlc:sdlc-divergence-reviewer`. Every
delegation starts a **fresh** agent. Its final message comes back to you as the tool result.

## Handing over to a skill

Invoke the Skill tool with the skill's namespaced name, `leeway-sdlc:<skill>`, for example `leeway-sdlc:shape-project`,
and the story's ref as its argument. The invoked skill takes over the session for that story. It keeps the session's
alias when its text says to use it. A background wait started after the hand-over wakes the session when it exits.
Another story's planning carries on during the hand-over: its interview wait, open when the hand-over started, was acted
on when it exited. Invoking the first skill again on the hand-back resumes the first run when its text says to continue an
earlier run.

All of this is what `docs/targets/claude.md`, "Handing over to a skill", records, from throwaway stand-in skills in a
headless session. Not shown: the plugin's own `shape-project` or `plan-project`, an interactive session, a skill whose
text says nothing of the alias, and a caller whose text says nothing of continuing its run.

## Governed-agent marker

governed-marker: not used

The hooks identify this plugin's agents from the `agent_type` the harness sends with each call. You never write a
marker.

## Waiting for an answer

wait: background

Where a round has several open escalations, start one background wait per open escalation of the round, all together.
Start each `wait-answer.mjs` (run, "Wait, then carry on") with the Bash tool and `run_in_background: true`, as it is,
with nothing appended: an `; echo` after it would become the exit code the harness reports. The harness runs it
detached and wakes the session when it exits, naming its exit code and its output file, so no turn is spent per
check. Do not poll the output file or sleep while it runs. When the notification comes, read the output file and act
on the exit code as run's table says. Exit 5 is a question, not the end: answer it, then start the wait again the same
way, a new background command (`PROCESS.md`, "Questions to the human are escalations"). If the session ends first, the run has stopped as at the deadline: the
escalation stays, and re-invoking `run` resumes where there is work left to resume (run, "Land the task", step 5).
`plan-project`'s developer interview starts and reads its waits the same way; re-invoking `plan-project` resumes it.
Every other skill that raises an escalation starts and reads its waits the same way (`PROCESS.md`, "Questions to
the human are escalations").
docs/targets/claude.md records the probe.

## Counting tokens

tokens: transcripts

Claude Code writes each agent's transcript under `${CLAUDE_CONFIG_DIR:-$HOME/.claude}/projects/`, and the Bash tool's
environment names the session in `CLAUDE_CODE_SESSION_ID`. Run `session-tokens.mjs` (run, "Recording spend") with the
Bash tool, in one of these forms, in place of run's `--subagent <its transcript>` and `--session <your transcript>`. The
script finds the file itself, because a command with a variable in braces prompts when a person approves each call:

- **A subagent:** `leeway-sdlc-session-tokens --subagent-id <agent id>`, which reads
  `projects/*/<session>/subagents/agent-<agent id>.jsonl`. The Agent tool's result says `agentId: <agent id>`, and a
  background agent's completion notice says `<task-id><agent id></task-id>`: keep it from the delegation until its record.
- **Your session:** `leeway-sdlc-session-tokens --this-session --from <start> --to <end>`, which reads
  `projects/*/<session>.jsonl`.

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
- **skills-dir:** none (the skills are installed outside the repo).

## Permissions for an unattended run

An unattended run uses Claude Code's auto mode, which the person starts: the run does not turn it on, and the plugin
writes no allow rule and no permission setting for it. Without auto mode, a person approves each prompt, and the run is
attended; `run` ("Unattended prerequisites") says what else an unattended run needs.

**What a probe of auto mode showed** (`docs/targets/claude.md`, "Unattended in auto mode"): in Claude Code 2.1.319,
started as `claude -p --permission-mode auto` in a scratch repo with nothing in any settings file it read that allows or
denies a call, 13 of the 14 calls of a run round went through in one session, with no prompt and no refusal in the
transcript. Its pushes went to a local bare remote only. The limits of an unattended run, one per sentence:

- Auto mode's classifier refuses `git -c core.fsmonitor status`, a git status with a `core.fsmonitor` script set, with
  "denied by the Claude Code auto mode classifier", and the script did not execute.
- The probe ran with `-p`, where nobody can answer a prompt, so a call that would prompt in a terminal may look like that
  refusal, and the record does not show which it would be.
- Not shown: a push to a real remote or to a protected `main`, `gh pr merge`, a subagent following the session's mode,
  and the same calls with auto mode off.
- A write under `.claude/` in a worktree and one under `.git/worktrees/` in the main repo went through in auto mode;
  whether Claude Code's own protection of `.git` and `.claude` asks about those writes without auto mode was not tried.

**How calls are written.** Every call is printed verb first, with `--server` on a Leeway call and `git -C <path>` for git, one
call per verb. Write each as it is printed: `cd <path> && git` is not the same call, and a harness that asks about calls
may stop at it, at a flag placed before the verb or at a call with no `--server`. A git verb takes at least one argument:
`git -C <path> status --short`, `git -C <path> diff HEAD`, `git -C <path> show HEAD`, `git -C <path> fetch origin` and
`git -C <path> log -5` are the forms. Start the session at the repo root, as the probe did: whether edits under `.worktrees/`
are judged against the directory the session started in is not shown, and `run` ("Where `run`'s own files go") relies
on the session starting there. A lane runs in a worktree as
`cd <worktree> && <lane>`. A compound lane is run part by part when a harness asks about each part, and a lane that
needs a leading variable (`FOO=1 npm test`) goes in a script.

Deleting, renaming or copying: an agent does these through `node -e`, as the agent definitions print, and the `Write` tool
makes the directories it needs.

## Installed version, update and restart

- **installed:** `claude plugin list --json`, entry `leeway-sdlc@<marketplace>`.
- **refresh the source:** `claude plugin marketplace update <marketplace>`, then read the version from
  `<installLocation>/plugin/HARNESS.md`.
- **update:** `claude plugin update leeway-sdlc@<marketplace>`.
- **restart:** restart Claude Code. Until then the session keeps the old skills, agents and hooks.
- **commands:** skills are invoked as `/leeway-sdlc:<skill>`, for example `/leeway-sdlc:sync-repo`.
