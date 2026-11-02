# Harness: any agent other than Claude Code

> **Tested with Claude Code only.** Support for other agents is built in but has not been verified yet. Verified support will come later. If you run into an issue, let us know: https://github.com/leeway-run/leeway-sdlc/issues

version: 0.3.0
agent: any
plugin-files: .sdlc/kit/

This is the package's own harness file. The repo's is `.sdlc/kit/HARNESS.md`, which `sdlc-install` writes from
`kit/harness/<agent>.md` for the agent you use. Until then, run `sdlc-install`.

## Waiting for an answer

wait: stop

How a run waits depends on the agent, and `.sdlc/kit/HARNESS.md` says so for yours. Without it, a run does not
wait: it acts at once as run's "Wait, then carry on" step 4 says for exit 2. A wait that blocks nothing carries on;
any other stops the turn, and re-invoking `run` once it is answered resumes where there is work left to resume
(run, "Land the task", step 5).
