# LWY-239: shaping runs planning's product check

Story: LWY-239. Shaping answers: e1 to e6. Interview: e7 (ships in 0.3.1, this project). Evidence: c1, from the Logos
and animations project (LWY-227 to LWY-231).

## The cause

`plan-project` step 1 lists seven gap kinds (missing, hollow, open, no negative, stale, hidden scope, too big) in a
table that lives only in plan-project. `shape-project` walks the gap checklist's rows, *What must not happen* and
*Hidden scope*. That walk never covers **stale**, **hollow** or **too big**. Shaping also asks only the `OPEN:` lines of a body that is
already there. So bodies pass shaping and fail planning.

## What changes

**One check (AC-5, e5).** The seven-row gap table moves out of plan-project into
`plugin/skills/shape-project/references/gap-checklist.md` as a new section, `## The product check`, with the rule on
which checklist rows count as **missing** and what is not a gap. The file keeps its name: it already says "One source,
two readers", both skills already read it, and a rename would touch the OpenCode doc, the pins and the targets for no
gain. plan-project step 1's "List the gaps" keeps its heading and points to the section instead of carrying the table.
No repo copy: the check is plugin-only (e5), unlike the story template.

Two wording changes in the moved table, from the shaping answers:
- **open**: unchanged for planning. Every `OPEN:` line is still a gap planning sends back (e1).
- **stale**: a criterion that changes an intent-doc rule *and* says the intent doc is updated with the story's work is
  a decided change, not stale (e3).

**Shaping runs the check (AC-1, AC-3, AC-4).** In `shape-project`:
- Step 1 reads `## The product check` with the checklist.
- **Any body already there when shaping starts** (e4: whoever wrote it) is read line by line against the check
  at the start, and its gaps go into the first round. This replaces "do not reopen what the body already answers" for the first round only. A
  latest gap comment from planning is still that round's agenda, and later rounds still drop what an answer settled.
- **Every line under *Open questions for dev*** gets the "would the user see the answer?" test, the drafted ones
  included. One that passes the test is asked in the round and leaves that section.
- Step 3 walks the gap kinds as well as the checklist rows.
- Step 5 runs the check on the proposed body before writing. A gap other than an `OPEN:` line the PO chose to leave becomes a
  follow-up round, not a write. With `OPEN:` lines left, the inference comment and the session tell the PO that
  planning will send them back (e1).

**Intent-doc rules (AC-2, e3).** Step 2 searches the code for each rule the story could cut against, by its id (`R1`) and its words. The question then names the rule,
quotes it, and says where the code cites it. The options are *The rule holds, the story changes*, *The rule changes, and the story says so* and *Leave it OPEN*. With no
pick, as shaping's escalations always are. On *The rule changes*, the body gets a criterion that the intent doc is updated with the story's work.

**One question for stories that share a rule (AC-2, e2).** When stories in one round (step 6) cut against the same rule,
the question is raised once, on the first of them. Each other story gets a comment holding `Held on <ref> eN`, the form
plan-project's interview already uses for a question another issue holds. Shaping waits on that escalation for each of
those stories. Step 5's "every escalation on the story is answered" counts the escalations it holds on. The answer is
written into each story's body. Re-invoking shaping on a held story reads the `Held on` comment and the escalation it names.

## Not changed

The round-trip hand-over (LWY-222), the approval round, the developer interview, and the server: a shared question is
an ordinary escalation on one issue, and waiting on another issue's escalation is something `wait-answer` already does.

## Breakdown

Three tasks, in order, each its own reviewable diff:

1. **LWY-239.1, one product check:** the table moves to the checklist, plan-project points to it, the entry-points pin
   follows the hidden-scope row, targets regenerated. AC-5, TC-1 to TC-3.
2. **LWY-239.2, shaping runs it:** shape-project steps 1, 2, 3 and 5 and *Done when*. AC-1, AC-2 (all but the shared
   question), AC-3, AC-4, TC-2, TC-3, TC-5.
3. **LWY-239.3, one question for a shared rule:** shape-project's rounds, waits and step 5 over `Held on`. AC-2's last
   rule, TC-2, TC-4.

2 and 3 both edit `shape-project/SKILL.md`, so 3 is blocked by 2, and 2 by 1, which defines the section 2 points to.
Each task adds its own line to `RELEASE_NOTES.md` under *Unreleased*.

## Hazard register

| Hazard | Owning task | The check that proves it closed | Rung |
|---|---|---|---|
| The table ends up in both files, and the two copies drift | LWY-239.1 | pin: plan-project has no gap-kind table row (`\| **stale** \|`), and the checklist has all seven rows | R1 |
| A pin anchored on plan-project's table (entry-points pin 5) fails or silently stops testing anything | LWY-239.1 | pin 5 reads the checklist's **hidden scope** row, with the same assertion | R1 |
| `targets/agents/` left stale after a skill edit | every task | `node scripts/build-targets.mjs --check` | R1 |
| Shaping refuses to write while any `OPEN:` line is left, so a PO can't park a question (e1) | LWY-239.2 | pin: step 5 writes with `OPEN:` lines the PO chose to leave and tells the PO planning sends them back | R1 |
| The first-round line-by-line check reopens what a later round settled | LWY-239.2 | pin: the whole-body check is the first round's; a later round still drops what an answer settled | R1 |
| A rule-change answer leaves the body stale against the intent doc | LWY-239.2 | pin: the rule-change option adds a criterion that the intent doc is updated with the story's work | R1 |
| A shaping escalation gains a pick (advice or suggested) | LWY-239.2 | existing rule unchanged: pin that the rule question carries no advice and no suggested option | R1 |
| A held story writes its body before the shared question is answered | LWY-239.3 | pin: step 5 counts escalations held on through `Held on <ref> eN` | R1 |
| The shared question is raised again on every story | LWY-239.3 | pin: raised once on the first story; the others get a `Held on` comment only | R1 |

Every check is a text pin under `plugin/test/` plus the lanes: `node --test "plugin/hooks/*.test.mjs"
"plugin/hooks/adapters/*.test.mjs" "plugin/test/*.test.mjs" "scripts/*.test.mjs"` and `node scripts/build-targets.mjs
--check`, as `release.yml` runs them. The live behaviour is checked by hand in a sub-issue of LWY-212 once the story
merges.
