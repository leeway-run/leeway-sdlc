# LWY-183: every escalation of a round is heard at once

Debt LWY-183. Interview: e1 (one background wait per escalation, all at once).

## What changes
**Waiting.** Where a skill waits on a round's escalations it starts one `wait-answer` per open escalation of the round together, each in the background (`HARNESS.md`, "Waiting for an answer", `wait: background`), instead of one after another. On each exit:
- 0: read the issue; carry on only when every escalation of the round is answered (the existing "Work held on a round carries on only when every escalation of the round is answered" stays);
- 5: answer the question, then restart only that escalation's wait;
- 2, 3, 4, 1 or another: as today for that exit; the other waits are left running, and a re-invoke reads what they found.

Harnesses with `wait: stop` are unchanged: they do not wait. `wait-answer.mjs` is unchanged.

Sites, all "in turn" or "one after another": `run` ("Wait, then carry on" and its round paragraph, the stop's escalations, the debt-proposal rows), `plan-project` (step 0's table row, "Wait, then read", "The QUESTIONs", "The last wait"), `shape-project`, `sdlc-install`, `sync-repo`, `sdlc-tune`, `PROCESS.md` ("Then wait for the answer") and `HARNESS.md` ("Waiting for an answer").

**The two nits.** An escalation whose `by.actor.role` is null is answered as `<alias>/agent` (PROCESS.md, "A question asked of the agent", item 2). An answer the CLI refuses with `invalid_clarification_answer` (over 1,000 characters) is shortened and written once more, not treated as an outage.

## Breakdown
One task, LWY-183.1: text in the skills, PROCESS and HARNESS.

## Hazard register
| Hazard | Owning task | The check that proves it closed | Rung |
|---|---|---|---|
| One site still waits in turn | LWY-183.1 | pin: no "in turn" or "one after another" about waiting in any skill, PROCESS or HARNESS | R1 |
| A skill carries on after one answer of several | LWY-183.1 | pin: the "every escalation of the round is answered" rule kept | R1 |
| `wait: stop` harnesses start waits | LWY-183.1 | `build-targets --check`; the harness template's `wait: stop` text unchanged | R1 |
| The script is changed after all | LWY-183.1 | `plugin/scripts/wait-answer.mjs` has no diff | R1 |
| Exit 5 or a stop exit is handled for the whole round instead of one wait | LWY-183.1 | pins 4 and 5 on run's "Wait, then carry on" | R1 |
| The two nits stay unfixed | LWY-183.1 | pins 6 and 7 on PROCESS.md (`<alias>/agent`; `invalid_clarification_answer` shortened and retried once) | R1 |
