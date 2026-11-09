# LWY-200: plan-project fixes wording-only BLOCKERs and moves stories on

Story: LWY-200. Shaping answers: e1 (running plan-project approves a shaped body), e2 (a PASS, or PASS WITH DECISIONS once its QUESTIONs are applied, moves to ready), e3 (the planner judges which BLOCKERs are wording-only and lists each fix), e4 (automatic rounds do not count toward three RETURNs). Interview: closed with no question (`# Interview closed` on LWY-200). Folds in LWY-169 and LWY-170.

## What changes

**The rule.** Today the moves out of the shaped step and out of the plan gate are a person's, written in `PROCESS.md` ("The cast", "Before the plan: shaping", "The plan gate"), `plan-project` (step 0's table, step 0.5's "No answer moves a story out of the shaped step or the plan gate", step 7, step 8) and pinned by `plugin/test/moves-when-asked.test.mjs` and `plugin/test/plan-ends-at-planned.test.mjs`. After this story:

- **Shaped to plan:** plan-project run on a story at the shaped step moves it to the plan step itself (e1) and posts `# Planning started`, saying the run was the approval. A story still at `shape`, or with a shaping escalation open, is refused as today.
- **Gate to ready:** after posting a PASS report, plan-project moves the story to `ready` (`--status ready`, no step) and says so in a comment. After PASS WITH DECISIONS it does so in the same `# QUESTIONs applied` step, once every QUESTION is answered and applied (e2). A RETURN stops at the gate, unless the wording loop below takes it.
- **Who may still move it by hand:** a person, any time, as today ("A move the person asks for").

**The wording loop (AC-2).** On a RETURN, plan-project reads each BLOCKER. When it judges every one a fix to existing items that opens no decision (e3): a description, a test, a blocking relation between existing tasks or a hazard owner, never a new task (QUESTION e6), it edits the items, replies to the report with `# BLOCKERs fixed` (one line per BLOCKER: its number, the item, what changed), applies any answered QUESTIONs, and spawns a fresh reviewer: the re-review LWY-201 defines. At most 2 such rounds after the gate's first report; then the story stops at the gate with the latest report. A PASS from any round moves the story to `ready` like a first-report PASS (QUESTION e5). A BLOCKER that needs a decision, or a QUESTION still open, stops the loop at the gate.

**Counting three RETURNs (e4).** Step 0's window counts coverage reports; a report that has a `# BLOCKERs fixed` reply belongs to an automatic round and is not counted.

**run.** Its gate check (`run`, "The plan gate is passed") is unchanged in what it refuses: no report, a QUESTION open or unapplied, a story still at the gate. It simply sees more stories already at `ready`.

## Breakdown
- LWY-200.1: the two automatic moves (AC-1, AC-3).
- LWY-200.2: the wording loop and the count (AC-2), after LWY-200.1, and after LWY-201.1, whose re-review it spawns.

## Hazard register
| Hazard | Owning task | The check that proves it closed | Rung |
|---|---|---|---|
| An old "a person's move" sentence survives in one of the files and contradicts the new rule | LWY-200.1 | pins on the rewritten sentences in each file named above; `moves-when-asked.test.mjs` rewritten, not deleted | R1 |
| plan-project moves a story whose shaping is unfinished | LWY-200.1 | pin: the step 0 row still refuses `shape` and an open shaping escalation | R1 |
| A RETURN, or an open QUESTION, moves to ready | LWY-200.1 | pin: the move is only on PASS, or after `# QUESTIONs applied` | R1 |
| The loop runs forever or past 2 rounds | LWY-200.2 | pin: "at most 2" and the stop at the gate after them | R1 |
| A BLOCKER that needs a decision is fixed silently | LWY-200.2 | pin: such a BLOCKER stops the loop; `# BLOCKERs fixed` lists every fix | R1 |
| Automatic reports trip three RETURNs | LWY-200.2 | pin: step 0 excludes a report with a `# BLOCKERs fixed` reply | R1 |
| run starts a story still at the gate | LWY-200.1 | `run-refusals.test.mjs` stays green unchanged | R1 |
