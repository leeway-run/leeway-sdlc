# LWY-202: plan-project traces the plan itself before the first review

Story: LWY-202. Shaping answer: e1 (the check is not written; only the fixes land). Interview: closed with no question.

## What changes
`plan-project` step 8 opens with a self-check, before "Delegate to the divergence reviewer":
- every AC and TC rule, clause by clause, to the task that delivers it and the named test that fails without it;
- every field or capability one task uses to the task that builds it.

A gap is fixed in the task descriptions and the hazard register (in the design doc) before delegating. The mapping itself is written nowhere: no comment, no design doc table, nothing in the reviewer's prompt, which already must never carry "which task covers which criterion" (step 8, "Never your summary").

## Breakdown
One task, LWY-202.1.

## Hazard register
| Hazard | Owning task | The check that proves it closed | Rung |
|---|---|---|---|
| The self-check leaks into what the reviewer reads (a table in the design doc, a comment) | LWY-202.1 | pin: the text says the mapping is not written; "Never your summary" unchanged | R1 |
| The check sits after the delegation and does nothing | LWY-202.1 | pin: the self-check comes before "Delegate to the divergence reviewer" in step 8 | R1 |
