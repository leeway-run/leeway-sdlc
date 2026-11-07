# Harness: Claude Code

The skills and `PROCESS.md` describe the loop in terms any coding agent can follow. This file supplies what depends on
the agent running it. Each target ships its own `HARNESS.md`; this is the Claude Code one. Read it alongside
`PROCESS.md`, and where the two disagree on a mechanism, this file wins.

version: 0.3.0
agent: claude
plugin-files: the plugin root (this file's directory)

## Running the plugin's scripts

- **wait-answer:** `leeway-sdlc-wait-answer`
- **session-tokens:** `leeway-sdlc-session-tokens`

Both are in the plugin's `bin/`, which Claude Code 2.1.91 and later puts on the Bash tool's `PATH` while the plugin is enabled, so a call and
its allow rule read the same for every person and every version. **The limit:** claude.ai and Cowork don't install a plugin
with a top-level `bin/`, so this plugin installs in Claude Code only. Other agents have no `bin/`: their harness names `node .sdlc/kit/scripts/<script>.mjs`.

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
docs/targets/claude.md records the probe.

## Counting tokens

tokens: transcripts

Claude Code writes each agent's transcript under `${CLAUDE_CONFIG_DIR:-$HOME/.claude}/projects/`, and the Bash tool's
environment names the session in `CLAUDE_CODE_SESSION_ID`. Run `session-tokens.mjs` (run, "Recording spend") with the
Bash tool, in one of these forms, in place of run's `--subagent <its transcript>` and `--session <your transcript>`. The
script finds the file itself, because a command with a variable in braces prompts whatever the allow-list says:

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

## Permissions for an unattended run

run's allow-list goes in the repo's `.claude/settings.json` (`permissions.allow`), or in
`.claude/settings.local.json` for one person. Each entry of run's list ("Unattended prerequisites") is one rule, with
`<cli>` and `<server>` from `.sdlc/leeway.md`:

| run's list names | The rule |
|---|---|
| a Leeway verb | `Bash(<cli> --server <server> <verb> *)`, for example `Bash(leeway --server https://app.leeway.run spend record *)` |
| a git verb | `Bash(git -C * <verb> *)`, for example `Bash(git -C * commit *)` |
| a lane or setup command | `Bash(<command> *)`, one rule per part of a compound lane |
| `node -e` | `Bash(node -e *)` |
| `gh pr create`, `gh pr view` | `Bash(gh pr create *)`, `Bash(gh pr view *)` |
| the two scripts | `Bash(leeway-sdlc-wait-answer *)`, `Bash(leeway-sdlc-session-tokens *)` |
| file edits under `.worktrees/` | `Edit(/.worktrees/**)`, which also covers the `Write` tool |
| the plugin's own files | `Read(~/.claude/plugins/cache/*/leeway-sdlc/**)` |

How Claude Code reads them. A rule matches the text before its first `*` as written, so a call with flags before the verb,
or with no `--server`, misses and prompts. `Edit(/.worktrees/**)` anchors at the directory the session started in, so
start the session at the repo root. Writing in `.git` or `.claude`, even inside a worktree, still prompts. A subagent is
held to the same rules as the session. `.claude/settings.json`'s allow rules apply only once the folder is trusted, and
`claude -p` never asks: for a `claude -p` run, use `.claude/settings.local.json`, untracked, or the rules do not apply.

- **A git verb needs at least one argument to match.** A trailing `*` also matches nothing only when it is the rule's one
  wildcard, and these rules have two. So `git -C <path> status --short`, `git -C <path> diff HEAD`, `git -C <path> show HEAD`,
  `git -C <path> fetch origin` and `git -C <path> log -5` match, and the same verbs with nothing after them prompt.
- **A compound lane takes one rule per part,** because each part is matched on its own: `npm run lint && npm test` needs
  `Bash(npm run lint *)` and `Bash(npm test *)`. A rule holding `&&` never matches. An allow rule also stops at a leading
  variable Claude Code doesn't know as safe, so `FOO=1 npm test` prompts: name such a lane in a script.
- **A lane runs in a worktree as `cd <worktree> && <lane>`,** which is allowed where `cd <path> && git` is not.
- **The plugin's own files are outside the working directory,** so `run`'s first read, `PROCESS.md`, `HARNESS.md`, the craft
  doc and the templates all prompt without the `Read` rule, on an enabled plugin too. The first `*` is the marketplace and
  the `**` takes in every version. With `CLAUDE_CONFIG_DIR` set, the cache is under that directory, not `~/.claude`: write the
  rule as `Read(//<that directory, with no leading slash>/plugins/cache/*/leeway-sdlc/**)`, in `.claude/settings.local.json`,
  because the path is one person's. A plugin loaded with `--plugin-dir` is read from wherever that is, and no rule here covers it.
- **Deleting, renaming or copying prompts:** `rm`, `mv`, `cp`, `chmod`, `sed -i` and `mkdir` are on no rule. An agent does these
  through `node -e`, as the agent definitions print, and the `Write` tool makes the directories it needs.

**Say before the yes (sdlc-install, question 16).** The git rules are the price of `git -C`, which run uses because a
`cd <path> && git` prompts:

- Each `Bash(git -C * <verb> *)` shows a startup warning, "allows any option at its *": fifteen rows below the banner at
  every session start (fourteen while `git push` is off the list).
- The warning is true, and this is what a yes also approves: `git -C <path> -c core.fsmonitor=<script> status` matches, and
  `-c core.fsmonitor=<script>` runs a program. The verb is weak too: `git -C <path> push origin main -m commit z` matches
  the `commit` rule, because the word only has to appear later in the command.
- The pre-push guard does not close that. `git -C <path> push --no-verify origin <branch>` and
  `git -C <path> -c core.hooksPath=<dir> push origin <branch>` both skip it, and `Bash(git -C * push *)` approves both, so the
  guard stops the push an agent ordinarily writes, not a determined one. No `deny` rule is written for them: git also takes
  `--no-veri` and `core.hookspath`, which such a rule would miss, so it would read as a line it does not hold.
- The `Read` rule lets a session read this plugin's installed files, and nothing beside them.
- It adds little over what the list already allows: `node -e` and the lane commands can already run any program.

## Installed version, update and restart

- **installed:** `claude plugin list --json`, entry `leeway-sdlc@<marketplace>`.
- **refresh the source:** `claude plugin marketplace update <marketplace>`, then read the version from
  `<installLocation>/plugin/HARNESS.md`.
- **update:** `claude plugin update leeway-sdlc@<marketplace>`.
- **restart:** restart Claude Code. Until then the session keeps the old skills, agents and hooks.
- **commands:** skills are invoked as `/leeway-sdlc:<skill>`, for example `/leeway-sdlc:sync-repo`.
