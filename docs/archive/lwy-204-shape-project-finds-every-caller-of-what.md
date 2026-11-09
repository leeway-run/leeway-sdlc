# LWY-204: shaping finds every way in to what a story removes

Story: LWY-204. Shaping answer: e1 (removes or replaces only). Interview: closed with no question.

## What changes
- `shape-project` step 2: when a story removes or replaces a capability, search the code for every caller and entry point to it (a function or component's callers, routes, UI controls that open it, commands, links). Each one the story does not already cover goes into the round's escalations: cover it in a criterion, or under *Out of scope*. Entry points one answer would settle together are merged, by the existing round rule. A story that only changes behaviour is shaped as today.
- `shape-project/references/gap-checklist.md`, *Hidden scope*: a story that removes or replaces a capability names every entry point to it, in a criterion or under *Out of scope*.
- `plan-project` step 1's **hidden scope** gap row: also an entry point to a removed or replaced capability that the body does not name. The checklist is read by both, so planning catches what shaping missed.

## Breakdown
One task, LWY-204.1.

## Hazard register
| Hazard | Owning task | The check that proves it closed | Rung |
|---|---|---|---|
| Every story gets the search (behaviour changes too), and shaping asks far more | LWY-204.1 | pin: the trigger is removes or replaces only, and behaviour-only stories are named as unchanged | R1 |
| plan-project's product check does not flag a missed entry point | LWY-204.1 | pin on step 1's hidden-scope row | R1 |
| An uncovered entry point is dropped without asking the PO | LWY-204.1 | pin: step 2 puts each into the round as a criterion or *Out of scope* | R1 |
| The checklist says nothing, so planning's check has no source | LWY-204.1 | pin on the checklist's *Hidden scope* paragraph | R1 |
