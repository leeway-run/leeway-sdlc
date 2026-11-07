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
  shell; the orchestrator's own shell is checked by the first real round.
- **Finding a subagent:** `agentId: <id>` in the Agent tool's result matched a transcript `agent-<id>.jsonl` in 344 of
  344 results, and `<task-id>` in the completion notice in 696 of 696.
- **The unit:** `session-tokens.mjs --subagent` gave the four "sum over all calls" figures of LWY-139.3 c1 exactly.
- **The shape:** every usage line is `type: "assistant"`, with a `message.id`, a `timestamp` and a boolean
  `isSidechain`; true in every subagent's entries and in no session's. One line in 80,476 did not parse, and none was a
  file's last.
- **Timing:** a command's own call was already in the transcript when the command ran.

tokens: transcripts

## Surprises
None beyond the appended-command one above.
