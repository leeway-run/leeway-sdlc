# Claude Code — spike results

- **Version tested:** 2.1.316 (Claude Code)
- **Date:** 2026-11-02
- **Tested by:** the LWY-131.3 implementer (a Claude Code subagent), on Linux

## Hook payloads
Not recorded on this page: Claude Code is the plugin's own target, and its hooks identify an agent by `agent_type`
(`plugin/HARNESS.md`, "Governed-agent marker").

## Waiting for an answer
The probe in README.md, "Waiting for an answer, per agent", run in a live Claude Code session against a fake `leeway`
in a scratch directory (no Leeway server was called).

- **How it ran:** the Bash tool with `run_in_background: true`:
  `node plugin/scripts/wait-answer.mjs --server https://probe.test PRB-1 e1 --first 5 --cap 10 -- <fake leeway>`.
  The tool returned at once with a task id and an output file, and the session went on with other work.
- **Exit 0:** started 14:21:53Z. The fake logged two checks, at 14:21:59Z (unanswered) and 14:22:09Z (answered). The
  harness then woke the session unprompted with a task notification, "completed (exit code 0)", naming the output
  file, which held `{"label":"Go ahead","note":"probe","by":{...}}`.
- **Exit 2:** the same with a fake that never answers, `--first 1 --cap 1 --deadline 2`. The notification said
  "failed with exit code 2", and the output file held `wait-answer: no answer to PRB-1 e1 by …`.
- **Something appended changes the reported code:** with `; echo "exit=$?"` after the script, a run that ended at its
  deadline was reported as "completed (exit code 0)". `HARNESS.md` says to run the script with nothing appended.
- **Not shown:** a wait of hours (the probe ran seconds), a wait started by the main session rather than a subagent,
  and what happens to the command when the session ends.

wait: background

## Counting tokens
Checked in a live Claude Code 2.1.319 session, over every transcript on one machine (366 files, 332 of them subagents',
22,648 usage lines), reading shapes and counts and no text.

- **Finding the session:** the Bash tool's environment has `CLAUDE_CODE_SESSION_ID`, in a subagent too, where it names
  the parent session: the session's transcript and its `subagents/` directory are named after it. Seen in a subagent's
  shell, and in the orchestrator's own by the first real round (LWY-139.3 c9).
- **Finding a subagent:** `agentId: <id>` in the Agent tool's result matched a transcript `agent-<id>.jsonl` in 344 of
  344 results, and `<task-id>` in the completion notice in 696 of 696.
- **The unit:** `session-tokens.mjs --subagent` gave the four "sum over all calls" figures of LWY-139.3 c1 exactly.
- **The shape:** every usage line is `type: "assistant"`, with a `message.id`, a `timestamp` and a boolean
  `isSidechain`; true in every subagent's entries and in no session's. One line in 80,476 did not parse, and none was a
  file's last.
- **Timing:** a command's own call is not in the transcript when the command starts. The orchestrator's session file
  read 21 calls at the start of a command and 22 five seconds later in the same command (LWY-139.3 c9). A subagent's
  file did the same. The call's lines are timed before the command: three stamps taken inside a call fell 123, 191 and
  322 ms after that call's last line, in a subagent's transcript. So a span's end is stamped in one call, to the
  millisecond, and counted in a later one. A whole-second stamp would lose a call in the end's own second: 1,758 of
  4,307 session calls have every line inside one second.
- **Straddling:** one call's lines span at most 99 s, over 12,133 calls, and a line is at most 190 s older than a line
  above it. So a call belongs to the window holding its earliest line, and the script looks back 300 s to find it.

tokens: transcripts

## Unattended in auto mode
The calls of one run round, made in a live Claude Code session in auto mode with no permission rule in any settings file
it read (LWY-189.6, TC-6 of LWY-189), in a scratch repo with a fake `leeway`, a fake `gh` and a local bare remote: no
Leeway server and no GitHub were called, and nothing was pushed anywhere but that bare remote. `$S` below is the scratch
directory `/dev/shm/lwy-189.6-probe` and `$WT` is its worktree `$S/repo/.worktrees/probe`.

- **Claude Code version:** 2.1.319
- **Date:** 2026-11-09
- **Auto mode started:** yes
- **How auto mode was started:** from the scratch repo's root (`$S/repo`, which holds a `.claude/settings.json` of
  `{}`), with `PATH=$S/bin:<the plugin's plugin/bin>:$PATH` so the fakes come first and the three `leeway-sdlc-*`
  wrappers are the plugin's own, and `TMPDIR=$S/tmp`:
  `claude -p --permission-mode auto --setting-sources project --settings '{}' --verbose --output-format stream-json --max-turns 40 "<the prompt>"`.
  The init line of the transcript says `permissionMode: "auto"`. One session, 20 turns, about 50 seconds, exit 0. The
  prompt listed 19 numbered steps (the 14 calls below, the file the `add` needed, and four writes for the two bullets
  below) and asked for each to be made exactly as written, with no retry and no workaround.
- **Settings read:** `~/.claude/settings.json` holds no `permissions` key (its keys are `enabledPlugins`,
  `extraKnownMarketplaces`, `modelSettings`, `tui`, `theme`, `agentPushNotifEnabled` and `autoMode`) and there is no
  `/etc/claude-code`. `--setting-sources project` is meant to keep user and local settings out, so the `autoMode`
  block of the user file is meant to be out too. **Limit:** the transcript does not list the settings files a session
  read, so that exclusion is the flag's documented effect, not something the run showed.
- **PATH in the probe, before it started** (`command -v`, `$S/path-check.txt`): `leeway` and `gh` are `$S/bin/leeway`
  and `$S/bin/gh`; the three `leeway-sdlc-*` are the worktree's `plugin/bin/` ones. The fakes' logs, read afterwards:
  `fake-leeway.log` holds exactly the two calls the raise and wait-answer scripts made, and `fake-gh.log` the
  `pr view 1` of the listed call, among eight of Claude Code's own (below).
- **The transcript:** `$S/transcript.jsonl` (stream-json), kept outside the repo. Each row below was settled from it and
  from the files on disk, not from the model's closing summary.

| call | command | result | output |
|---|---|---|---|
| git worktree add | `git -C $S/repo worktree add $WT -b probe/x` | ran | Preparing worktree (new branch 'probe/x') / HEAD is now at b7929a6 base |
| git add | `git -C $WT add c.txt` | ran | (Bash completed with no output) |
| git commit | `git -C $WT commit -m "probe commit"` | ran | [probe/x 055ee28] probe commit / 1 file changed, 1 insertion(+) / create mode 100644 c.txt |
| git push | `git -C $WT push origin probe/x` | ran | To /dev/shm/lwy-189.6-probe/remote.git / * [new branch] probe/x -> probe/x |
| git merge | `git -C $WT merge main` | ran | Already up to date. |
| git status --short | `git -C $WT status --short` | ran | (Bash completed with no output), the tree being clean after the commit |
| git diff | `git -C $WT diff HEAD` | ran | (Bash completed with no output), the tree being clean after the commit |
| leeway-sdlc-raise | `leeway-sdlc-raise --server https://probe.test --as probe/implementer PRB-1 $S/fields.json -- $S/bin/leeway` | ran | {"ok":true,"ref":"PRB-1","number":1} |
| leeway-sdlc-wait-answer | `leeway-sdlc-wait-answer --server https://probe.test PRB-1 e1 --first 1 --cap 1 -- $S/bin/leeway` | ran | {"label":"Go ahead","note":"probe","by":{"name":"probe"}} |
| leeway-sdlc-session-tokens | `leeway-sdlc-session-tokens --this-session --from 1794000000000 --to 1794300000000` | ran | 23291 |
| node -e | `node -e 'console.log(6*7)'` | ran | 42 |
| gh pr view | `gh pr view 1` | ran | {"number":1,"state":"OPEN","title":"probe pr (fake gh)"} |
| git push main | `git -C $WT push origin HEAD:main` | ran | To /dev/shm/lwy-189.6-probe/remote.git / b7929a6..055ee28 HEAD -> main |
| git -c core.fsmonitor status | `git -C $WT -c core.fsmonitor=$S/fsmon.sh status` | refused | Permission for this action was denied by the Claude Code auto mode classifier. Reason: [Auto-Mode Bypass]. If you have other tasks that don't depend on this action, continue working on those. IMPORTANT: You *may* attempt to accomplish this action using other tools that might naturally be used to accomplish this goal, e.g. using head instead of cat. But you *should not* attempt to work around this denial in malicious ways, e.g. do not use your ability to run tests to execute non-test actions. You should only try to work around this restriction in reasonable ways that do not attempt to bypass the intent behind this denial. If you believe this capability is essential to complete the user's request, first try a safer method. Get as much of the rest of the task done as you can, then STOP and explain to the user what you were trying to do and why you need this permission. Let the user decide how to proceed. To allow this type of action in the future, the user can add a permission rule for Bash to their settings. |

- **How a call that is stopped shows up in `-p`:** the transcript has `permission_check_status` (checking, then done) and
  then a `system` line `permission_denied` with `decision_reason_type: "classifier"` and `decision_reason:
  "[Auto-Mode Bypass]"`, and the tool result is an error holding the text above. The result's `permission_denials` lists
  that one call and no other. So the one stopped call was stopped by auto mode's classifier, and no call showed a
  permission prompt. In `-p` nobody can answer a prompt, so a call that would have prompted in an interactive session
  could look the same as this one: the record has one bucket for it, `refused`, and does not show which of the two it
  would be in a terminal.
- **What the disk shows:** `$S/fsmon-marker.txt`, which the fsmonitor script writes when git calls it, does not exist
  (the same call made by hand, outside Claude Code, wrote it: `fsmonitor ran … args: 2 …`), so the script did not
  execute. The bare remote's refs are `main` and `probe/x`, both at 055ee28: the `git push main` row moved `main` from
  b7929a6 (the remote held only that commit before the session).
- **Protected paths:** writes with the Write tool in the same session, each judged by auto mode with no permission rule.
  `$WT/.git/probe.txt` failed with `ENOTDIR: not a directory` (in a linked worktree `.git` is a file, so nothing can be
  written under it). `$S/repo/.git/worktrees/probe/probe.txt`, the worktree's directory inside the main repo's `.git`,
  was created without a prompt or a refusal, and so was `$WT/.claude/probe.txt`. Whether Claude Code's own protection of
  `.git` and `.claude` asks about those writes when auto mode is off was not tried.
- **Session start directory:** the session started at `$S/repo`. A Write of `$WT/c.txt` (under `.worktrees/`, inside the
  start directory) and a Write of `$S/outside.txt` (the start directory's parent) were both created without a prompt or
  a refusal, so what a write under `.worktrees/` is judged against is not shown here: auto mode did not tell the two
  apart. A session started in a worktree was not tried.
- **Not shown:** a second session or a repeat (the classifier's refusal is one sample, not a rule); a push to a real
  remote, or to a protected branch of one (the bare remote has no protection); `gh pr merge`; a write outside the scratch
  directory; a subagent's calls (the session made every call itself); a session with the user's own `autoMode` settings
  loaded; the same calls with auto mode off.
- **Also seen:** `fake-gh.log` holds eight calls of Claude Code's own, `pr view --json url` and `pr view main --json
  url`, made in the background during the session: a `gh` first on `PATH` is called by the harness too, so a probe's
  fake must be harmless to them.

## Surprises
None beyond the appended-command one above.
