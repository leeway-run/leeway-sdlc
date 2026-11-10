# LWY-222: when planning sends a story back to shaping, shaping runs next and planning resumes after it

Story: LWY-222. Shaping answers: e1 (*Hold* on "how do we proceed?" starts shaping, for every way back), e2 (a held
story's shaping questions go out straight away), e3 (either command picks a stopped round trip up), e4 (no limit on
round trips), e5 (shaping started from scratch is unchanged). Interview: e6 (hand over by invoking the other skill by name,
through the harness), e7 (a round trip is recognised by the gap comment's escalation answered *Hold*).

## What changes

**The round trip.** Today a story planning sends back to the PO stops the session: plan-project step 1 posts the gap
comment, sets `shape`, raises "how do we proceed?", waits on it last ("The last wait") and, whatever the answer, plans
the story no further. A person then runs shape-project, then plan-project. After this story:

1. plan-project raises "how do we proceed?" **tied to the gap comment** (`"comment"`: the gap comment's `cN`, e7) and
   waits on it **at once**, beside any other wait of the session (e2), not last.
2. On *Hold* it posts `# Shaping started` on the story (naming the gap comment and the escalation), says so in the
   session, and **hands over to shape-project** for that story, as `HARNESS.md`, "Handing over to a skill", says (e6).
   *Split* and *Accept* work as today and start nothing.
3. shape-project takes the gap comment as its agenda (as today), raises its round, waits, writes the body and sets the
   shaped step. In a round trip it then says so and **hands over to plan-project** for that story (AC-2), instead of
   stopping.
4. plan-project's step 0 moves the story from the shaped step to the plan step as today; in a round trip its
   `# Planning started` says the PO's answers to shaping were the approval of the body, not the run (AC-2).

**What a round trip is (e7, defined once in `PROCESS.md`, "Before the plan: shaping").** A story is in a round trip
when its latest gap comment (the comment whose closing sentence begins *"Answer these with `shape-project` on
`<ref>`"*) has its escalation (`comments[].escalation`) answered *Hold*, and the story is at `shape`, the shaped step or
the plan step. Its shaping half is done once a `# Planning started` follows that gap comment. Both skills read this one
definition; neither keeps a copy.

**Who acts on an answer.** One session can hold waits of both skills at once (AC-3: one story shaping while the
others are interviewed). Every escalation names its raiser's role: shape-project raises as `agent`, plan-project as
`planner`. An answer is acted on under the skill whose role raised it (`escalations[].by.actor.role`), for that story
only. One story's shaping never holds or moves another story (AC-3).

**Picking up a stopped round trip (AC-4, e3).**

| Run on a story in a round trip | plan-project | shape-project |
|---|---|---|
| at `shape`, gap escalation open | waits on it (step 0), then step 2 above | waits on it, then shapes on *Hold*; on *Split* or *Accept* it says so and stops |
| at `shape`, answered *Hold* | hands over to shape-project | shapes, as today |
| at the shaped step | moves it to plan, as today | hands over to plan-project |
| at the plan step | plans, as today | hands over to plan-project, and never sets `shape` |

A story not in a round trip goes through both skills exactly as today (AC-6, e5): shaping from scratch stops at the
shaped step, and running plan-project is the approval.

**Three RETURNs (AC-1).** On a type with `shape`, step 8's "Three RETURNs" stops posting a comment with no escalation.
It goes through step 1's "Gaps → back to the PO" instead: the gap comment of what the rounds could not trace, `shape`,
and the tied "how do we proceed?" escalation. Step 0's window marks stay as they are: the gap comment's closing sentence
is unchanged. A type with no `shape` keeps its own escalation (*Re-plan once more* / *Stop planning it*).

**No limit (AC-5, e4).** Nothing counts round trips. Three RETURNs and the wording loop (LWY-200) keep their own
limits.

**The hand-over line (e6).** `plugin/HARNESS.md` and every target's harness (`scripts/targets.mjs`, regenerated into
`targets/`) get a section **"Handing over to a skill"**: on Claude Code, the Skill tool with `leeway-sdlc:<skill>`; on
the other agents, the target's own invocation, built from its `commands` line, marked UNVERIFIED as their other
mechanisms are. Whether a skill invoked from inside a running skill takes over, keeps the session's alias and lets its
background waits wake the session is a runtime claim: it is probed on Claude Code and recorded in
`docs/targets/claude.md`, and the HARNESS line says only what the probe showed.

**Agents with `wait: stop`.** Their sessions end at every open escalation, so the round trip stops at each one. AC-4
is how it carries on there: either command, re-run once the answer is in.

## Breakdown

- LWY-222.1: the hand-over line in every harness, and the Claude Code probe.
- LWY-222.2: plan-project's half: step 1, "The last wait", step 0's rows, step 8's Three RETURNs, and `PROCESS.md`
  (the round-trip definition included). After LWY-222.1.
- LWY-222.3: shape-project's half: step 0's start and step 5's hand-over. After LWY-222.2, which owns `PROCESS.md` and
  the definition it cites.

## Hazard register

| Hazard | Owning task | The check that proves it closed | Rung |
|---|---|---|---|
| Invoking a skill from inside a running skill does not take over, drops the alias, or its waits do not wake the session | LWY-222.1 | the probe on Claude Code, recorded in `docs/targets/claude.md`; the HARNESS line claims nothing the record does not show | R3 |
| A target's harness is edited by hand and drifts from `scripts/targets.mjs` | LWY-222.1 | `node scripts/build-targets.mjs --check` | R1 |
| The gap escalation is not tied to the gap comment, so no skill can recognise the round trip | LWY-222.2 | pin: step 1's raise sets `"comment"` to the gap comment's `cN` | R1 |
| *Split* or *Accept* starts shaping | LWY-222.2 | two pins, one per answer: each starts nothing | R1 |
| The held story's gap escalation is still waited on last, delaying its shaping (AC-3) | LWY-222.2 | `skills-wait.test.mjs`'s last-wait pins rewritten to "at once, beside the other waits"; absent-phrase pin on "waited on last" | R1 |
| An answer is acted on under the wrong skill | LWY-222.2 | pin: the answer is acted on under the skill whose role raised it | R1 |
| Planning resumes while a shaping escalation is open | LWY-222.2 | the existing step 0 row ("the shaped step, with a shaping escalation open") stays, and its pin stays green | R1 |
| "whatever the answer, this session does not plan the story again" survives somewhere | LWY-222.2 | absent-phrase pin over `plan-project/SKILL.md` and `PROCESS.md` | R1 |
| Three RETURNs on a type with `shape` still posts a comment with no escalation | LWY-222.2 | pin: it goes through step 1's gap path; the no-`shape` escalation's pins stay green | R1 |
| shape-project sets `shape` on a round trip at the plan step, pulling it back | LWY-222.3 | pin on step 0's round-trip clause, and that the unplanned rule excludes it | R1 |
| Shaping from scratch goes into planning by itself (AC-6) | LWY-222.3 | pin: outside a round trip step 5 still ends at the shaped step and stops; `shape-ends-at-shaped.test.mjs` stays green | R1 |
| LWY-168 (ready) renames these skills: whichever lands second must rename the pins and the hand-over lines | none | no task owns it: it is a sequencing hazard between two stories, named here for the person who starts the second one | - |
