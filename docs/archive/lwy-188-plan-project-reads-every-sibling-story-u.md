# LWY-188: plan-project filters the sibling read at the call

Debt LWY-188. Interview: closed with no question.

## What is left
The description's first item is already done on the plan branch: `PROCESS.md` no longer has the interview-wait sentence it names, and `plan-project`, "Wait, then read", already says the entry's own `ref` is "the story, the Plan record or a sibling story" (pinned in `plugin/test/developer-interview.test.mjs`).

The second remains. `plan-project`, "What is asked", reads each sibling story with `issue get` and keeps "only its own `escalations[]`" but gives no way to: unfiltered it was 563 KB against 47.5 KB on one project. The CLI has no field selector, so the text names the filter at the call:

`<cli> --server <server> --json issue get <ref> | node -e "<keep only escalations whose ref is <ref>, each with its answer>"`

with the exact `node -e` body in the skill, and a pin on it.

## Breakdown
One task, LWY-188.1.

## Hazard register
| Hazard | Owning task | The check that proves it closed | Rung |
|---|---|---|---|
| The filter keeps a sub-issue's escalations (numbers collide, step 0) | LWY-188.1 | the test runs the filter on a fixture with a sub-issue escalation and gets only the story's | R1 |
| The filter drops the answers the interview needs | LWY-188.1 | same fixture: each kept escalation still has `answer` | R1 |
