# Harness: any agent other than Claude Code

> **Claude Code and OpenCode 2.x are verified; the other agents are a preview.** Support for the other agents is built in but has not been verified yet. If you run into an issue, let us know: https://github.com/leeway-run/leeway-sdlc/issues

version: 0.3.1
agent: any
plugin-files: .sdlc/kit/

## Running the plugin's scripts

- **wait-answer:** `node .sdlc/kit/scripts/wait-answer.mjs`
- **session-tokens:** `node .sdlc/kit/scripts/session-tokens.mjs`
- **raise:** `node .sdlc/kit/scripts/raise.mjs`

This is the package's own harness file. The repo's is `.sdlc/kit/HARNESS.md`, which `sdlc-install` writes from
`kit/harness/<agent>.md` for the agent you use. Until then, run `sdlc-install`.

## Handing over to a skill

Hand a story to another skill, for example `shape-project`, by invoking that skill in this session with the story's ref, the way
your agent invokes skills (`.sdlc/kit/HARNESS.md` says how for yours). UNVERIFIED: no probe has shown in any agent but Claude
Code that the invoked skill takes over the session for that story, that a wait or another story's planning carries on
during the hand-over, or that handing the story back resumes the first run.

## Waiting for an answer

wait: stop

How a run waits depends on the agent, and `.sdlc/kit/HARNESS.md` says so for yours. Without it, a run does not
wait: it acts at once as run's "Wait, then carry on" step 4 says for exit 2. A wait that blocks nothing carries on;
any other stops the turn, and re-invoking `run` once it is answered resumes where there is work left to resume
(run, "Land the task", step 5). `plan-project`'s developer interview stops the same way, and re-invoking
`plan-project` resumes it. Every other skill that raises an escalation stops the same way. Nobody is listening once a
skill stops, so a question a person asks of the agent on its escalation is handed back to them after 30 minutes.

## Counting tokens

tokens: none

How a run counts tokens depends on the agent, and `.sdlc/kit/HARNESS.md` says so for yours. Without it, a run
cannot count them: every record leaves `--tokens` out (run, "Recording spend"), never `--tokens 0`, never an
estimate. Every total then reads `tokensIncomplete`, a floor, and the run carries on.
