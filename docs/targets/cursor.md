# Cursor (agent and CLI) — spike results

- **Version tested:** not run
- **Date:** 2026-11-02
- **Tested by:** nobody yet; the LWY-131.3 implementer recorded that it could not be run

## Hook payloads
Not run yet (README.md, "The run, per agent").

## Waiting for an answer
Not probed: `cursor-agent` is not installed on the machine this was checked on (`which cursor-agent` printed nothing).
Until the probe in README.md, "Waiting for an answer, per agent", shows that Cursor (agent and CLI) resumes the session on its own
when a background command exits, a run here stops after an escalation, and so does every other skill that raises one.
Nobody is listening once it stops, so a question a person asks of the agent on such an escalation is handed back
to them after 30 minutes.

wait: stop
