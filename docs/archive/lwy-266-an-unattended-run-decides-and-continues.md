# LWY-266: an unattended run decides and continues, and planning sweeps for what stopped the organisations run

Story: LWY-266. Shaping answers: e1 to e4, e6, e7. Interview: e9 to e12. Evidence: the post-mortem
`docs/archive/2026-11-17-1350-run-escalations-postmortem.md` in leeway-run/leeway. Process changes already made with
sdlc-tune in the same session: no budget on LWY's types (e5, process version 10), code-round caps doubled (e8, version 11).

## The cause

LWY-244 made `run` decide what the criteria decide. Everything else still stops the run:

- **Every undecided block waits.** "A BLOCKED brief" step 3 and verdict step 3 raise an implementer's `## Question` or
  a reviewer's `Escalates:` block and wait on it; `PROCESS.md` says every escalation "holds the work that depends on it
  until it is answered". 10 of 12 such answers in the organisations run matched the run's pick.
- **The budget is a hard stop** (stop 9), sized per type, not per story.
- **A debt proposal is a hard stop** in an issue run (stop 4).
- **Planning does not look** for the read paths of a new rule, what the change breaks around it, or the plan contents
  the repo already requires, so the run meets them.
- **The plan branch drifts from main**, and **"blocked by" waits for a person's manual step** on the blocker story.

## Where it is built (e9, e12)

- **leeway-run/leeway-sdlc, this story:** `run`, `plan-project`, `sdlc-tune`, `sdlc-install`, `PROCESS.md`, the
  implementer, reviewer and divergence-reviewer definitions, the brief and verdict templates. Branches from the 0.3.1
  plan branch `feat/p_20860e30-leeway-sdlc-0-3-1`.
- **leeway-run/leeway, a chore in the same project (e9):** the presets' caps doubled, Leeway's round-0 limit raised
  from 5 to 10, `docs/VISION.md`'s R6 reworded (e2), then LWY's round-0 cap set to 8 with sdlc-tune. It is taken as
  written; this story's plugin text names the new limit (TC-11).

## What changes

### Stop, or decide and continue (AC-1, AC-2)

A new subsection of `run`, **"Stop, or decide and continue"**, after "Before raising a block: do the criteria decide
it?". The order for every implementer `## Question` and reviewer `Escalates:` block is:

1. **The triage (LWY-244)**, unchanged. Decided → its path, as today. A spec amendment never reaches either (TC-2).
2. **The stop list.** A block is a stop when going on would touch production, a merge into main or real data; involve
   a secret; take the wider of two access options; or when it marks no option `(suggested)` (no sensible pick), or
   reports an action the permission check refused. When the orchestrator cannot tell, it is a stop. A stop is raised
   and waited on exactly as today: fields unedited, the block's own type.
3. **Decide and continue**, everything else. In order:
   1. **File the follow-up** in the story's project, `backlog`, its type chosen as the Plan record's is
      (`plan-project` step 5.2: `chore` when the process has it with no `shape`, `plan` or `gate` step). Title
      `Follow-up: <the question, shortened>`; description: the task, the round, the options, the pick taken and what
      building another answer would change.
   2. **Post `# Decided and continued — <ref> · round <N>`** on the sub-issue as `<alias>/agent`: the block as written,
      the pick taken and why (the stricter where access is involved), and the follow-up's ref.
   3. **Raise the escalation** tied to that comment, as the role of the block (implementer or reviewer), its fields
      unedited except two: `"type": "clarification"`, and `"meanwhile"` saying the run carried on with the pick, the
      follow-up's ref, and that an answer matching the pick closes it.
   4. **Name the escalation on the follow-up** (e10): its title becomes `Follow-up: <ref> eN — <the question,
      shortened>`, and `Escalation: <ref> eN` is added to its description. The title carries it because `issue list`
      returns titles and no descriptions, and the reading below finds follow-ups by it (c18 finding 1).
   5. **Carry on** as LWY-244's decided path does: a `## Question`'s pick goes into the next round's prompt; an
      `Escalates:` block's pick is a live finding for the next round, and a PASS with one runs one more round within
      `roundCap`. The sub-issue is not set `blocked`, and no wait starts.

`PROCESS.md`, "Questions to the human are escalations": "Either kind holds the work that depends on it until it is
answered" becomes: a stop holds it; anything else is decided and continued (`run`). The always-raised list from LWY-244
stays the list the triage never decides; such a block is now raised unedited and, off the stop list, not waited on.

**Hard stops** (TC-5): row 4 stays as `4 (removed: a debt proposal no longer stops the run, LWY-266)`; row 9 changes to
twice the budget (below); a new row 11, *A block on the stop list*, detected at the raise paths, its escalation the
sub-issue run's. "And every place the sub-issue run itself says stop" loses "a raised `## Question`" and "a raised
`Escalates:` block" in favour of row 11.

### Reading the answers behind (AC-3, AC-2's debt, e11)

A new `run` subsection, **"Reading the answers behind"**, run at three points: every round boundary (before the next
implementer round and before the next task), the story gate (before step 1's merge), and the plan's end (before its
status update).

- **The index is the project's issue titles** (c18 finding 1): `issue list` returns titles and no descriptions, and
  `escalation list` cannot list answered escalations from the CLI (its `--open` cannot be false, LWY-164). So: one
  `issue list <KEY> <project>`; each issue neither `done` nor `cancelled` whose title starts `Follow-up: <ref> eN` is a
  follow-up, and one `issue get <ref>` reads that escalation's answer.
- **Matching answer** (its `label` is the pick's): post `# Pick stood — <ref> eN` on the follow-up and set it `done`.
- **Differing answer**: post `# Answer differs — <ref> eN` on the follow-up, quoting the label and note, once; it stays
  `backlog` to be built.
- **Debt proposals** (no longer stop 4, and in a sub-issue run no longer waited on at "Land the task" step 5): each
  `debt` escalation the run raised is read from `issue get <story>`, whose `escalations[]` carries its sub-issues':
  the story in hand at a round boundary and the story gate, every story of the project at the plan's end. On "File it",
  the debt issue is filed as "What a deferred finding becomes" says, its title ending `(<ref> eN)` and its description
  carrying `Escalation: <ref> eN`.
- **Each action checks its marker first**, so a second reading writes nothing (TC-4): a follow-up already `done`, or
  already carrying `# Answer differs — <ref> eN`; a debt issue whose title in the same `issue list` already ends
  `(<ref> eN)`.
- **The plan's end** lists, in its status update on the Plan record and in its ending, every follow-up whose escalation
  is unanswered and every one whose answer differs and is not `done` (AC-3, must not happen). Re-running `run` on the
  project reaches the plan's end again ("Run a project", "Nothing left") and reads anything answered since.

### Decide it yourself (AC-4)

- **`PROCESS.md`** gets a section **"Decide it yourself"**: the four items of AC-4; anything else changing product
  behaviour the criteria do not cover is decided and continued; only the stop list stops. A test-plumbing fix to a frozen
  test is LWY-244.1's `## Frozen test fix`, which already requires every assertion unchanged and the reviewer's
  judgement; a non-frozen helper is ordinary code (settled from the code, below).
- **Implementer:** the same list. A question off the stop list is not `BLOCKED`: the implementer builds its pick and
  reports the block in a new brief section **`## Decided and continued`** (the `## Question` fields, its pick marked).
  `BLOCKED` is for the stop list. The orchestrator classifies a `BLOCKED` `## Question` anyway (backstop), and raises a
  brief's `## Decided and continued` block through step 3 above, with no next round needed for it.
- **Reviewer:** the same list. Its `Escalates:` block gains a **Test** line: the test that would pin its suggested
  answer. The orchestrator's continued path hands it to the next implementer round as the live finding; the reviewer
  still never edits code.
- **Templates:** `BRIEF.md` gets `## Decided and continued` (`none` when empty); `VERDICT.md`'s *Escalates* gets *Test*.

### The budget is a notice (AC-5, e4)

`run`, "Start the budget" and stop 9: at a round boundary where a dimension has reached its budget, post
`# Budget reached — <story> · <dimension>` once per dimension (checked before posting) and carry on; at twice the budget
in any dimension, stop 9. No `budget` on the build step: no notice and no stop, as today. The *Spend* line is unchanged.
`sdlc-tune` and `sdlc-install` give `round0Cap` as 1 to 10, Leeway's new limit (TC-11).

### Planning sweeps (AC-6)

- **`plan-project` step 4** gets **"The three sweeps"**: read paths, blast radius and completeness, as AC-6 words them,
  recorded under `## Sweeps` in the design doc, or, for a type whose plan step writes none, in a story comment opening
  `# Sweeps`. Each read-path item names its `TC-n` or hazard row and its test; each blast-radius item its owning task
  or "unaffected, because"; completeness names each screen's phone frame where the floor asks for one and each dropping
  migration's rollout order, and states that `run` keeps the plan branch current and reads "blocked by" as merged
  (below).
- **The divergence reviewer** (step 6, "Look for what is missing") gets a bullet: a missing sweep, a read-path item with
  no criterion or test, or a blast-radius item with no owner or reason is a BLOCKER. `plan-project` step 8 passes it
  where the sweeps are.

### The plan branch stays current, and "blocked by" means merged (AC-6)

- **`run`, "Story start":** when the story's base is a plan branch, merge the integration branch into it before the
  baseline, the way the story gate's step 5 merges (detached merge worktree, push the base). A conflict that is not
  mechanical is stop 7 (TC-8).
- **"Blocked by":** a blocker story counts as cleared when `done` or at a step after its `build` step (its build has
  merged it into the plan branch); a blocker task still counts only when `done`. In precondition 3, "The task order"
  step 5 and "Run a project" (TC-9).

## Not changed

The triage's rules, the freeze, round 0, the round caps' meaning, the escalation fields, the server and the CLI. Shaping
is untouched. The manual step after build still waits for a person; only what it blocks changes.

## Settled from the code

- **Test plumbing (body's open question 2):** LWY-244.1's `## Frozen test fix` covers a frozen test's plumbing with all
  assertions unchanged; the organisations stop (LWY-246.3 e1) was the permission check refusing the edit, which is on
  the stop list. Nothing new is built for it.
- **Two repositories (open question 3):** e9.
- **The escalation–issue link (open question 1):** e10, as text.
- **Who reads late answers (open question 4):** e11.
- `targets/agents/` is generated by `scripts/build-targets.mjs`; every task regenerates it and CI runs `--check`.
- The tests pin doc text (`plugin/test/*.test.mjs`); no test executes `run`.

## Sweeps

### Read paths

No rule restricts data a Leeway op returns: the story changes plugin text and process values only. The one new read is
`run`'s reading of the project's issues and escalations, bounded by the project's `issue list` (one reply, no
pagination), one `issue get` per open follow-up, and one `issue get` per story (the story in hand, or every story at the
plan's end) for debt proposals (TC-4).

### Blast radius

- **Pins on the words this story changes**: `criteria-triage.test.mjs` ("Always raised, unedited"),
  `run-budget.test.mjs` (stop 9), `run-waits.test.mjs` and `skills-wait.test.mjs` (every raise waits; its `RAISE_AT`
  rule, LWY-242), `escalation-recommends.test.mjs`, `developer-interview.test.mjs` and `plan-ends-at-planned.test.mjs`;
  also `escalation-rounds.test.mjs` and `wait-answer.test.mjs` (LWY-266.1, .2), `run-spend.test.mjs` (LWY-266.4),
  `plan-ends-at-main.test.mjs` (LWY-266.2) and `run-project-skips.test.mjs` (LWY-266.6) (c18 note 3).
  Each task that changes their words rewrites the pin to the same strength (TC-10). Owned by the task that changes the
  words.
- **Generated copies** `targets/agents/`: every task (TC-10).
- **Leeway's round-0 limit**: the chore; until it ships, `sdlc-tune` offering 8 is refused by the server as
  `invalid_process`, which is the backstop it already documents. Unaffected otherwise.
- **Rate limits, caps, migrations, evidence scripts**: unaffected; no app code in this story.

### Completeness

- Phone frames: none, no screen.
- Migrations that drop something: none.
- The plan branch is current with main, and "blocked by" means merged into it: built by LWY-266.6, from then on done by
  `run` for every story.

## Breakdown

Six tasks, in order. Each edits shared files (`run`, `PROCESS.md`, `RELEASE_NOTES.md`) and regenerates
`targets/agents/`, so each is blocked by the one before.

1. **LWY-266.1, stop or decide and continue:** the subsection, both raise paths, the follow-up and the
   `# Decided and continued` record, the raise table, hard stops 4, 11 and the sub-issue-run list, `PROCESS.md`'s
   escalation rule. AC-1, AC-2, TC-1, TC-2, TC-3, TC-5, TC-10.
2. **LWY-266.2, read the answers behind:** the subsection and its three call points, debt proposals not waited on, the
   plan's end listing. AC-2 (debt), AC-3, TC-4, TC-10.
3. **LWY-266.3, decide it yourself:** `PROCESS.md` section, implementer and reviewer definitions, brief and verdict
   templates, run's prompt lines and the brief's block handling. AC-4, TC-10.
4. **LWY-266.4, the budget is a notice:** "Start the budget", stop 9, `sdlc-tune` and `sdlc-install` bounds. AC-5,
   TC-6, TC-10, TC-11.
5. **LWY-266.5, the planning sweeps:** `plan-project` step 4 and step 8's prompt, the divergence reviewer. AC-6,
   TC-7, TC-10.
6. **LWY-266.6, the plan branch stays current and "blocked by" means merged:** "Story start", precondition 3, "The task
   order", "Run a project". AC-6, TC-8, TC-9, TC-10.

The hand test is LWY-212.10. The Leeway half is its own chore (e9).

## Hazard register

| Hazard | Owning task | The check that proves it closed | Rung |
|---|---|---|---|
| A stop-list block is continued (production, main, real data, secret, wider access, no pick, refused permission) | LWY-266.1 | pin: each of the seven conditions appears in run's stop list and in PROCESS.md, word for word the same items, and "when the orchestrator cannot tell, it is a stop" | R1 |
| A spec amendment or a `freeze` BLOCKER is decided and continued | LWY-266.1 | pin: the new subsection says a spec amendment never reaches it, and hard stop 8 is unchanged | R1 |
| A continued block is silent: no record, no escalation, or a `blocker` type that reads as held | LWY-266.1 | pin: the five steps in order, the comment heading, `"type": "clarification"`, the meanwhile naming the pick and follow-up | R1 |
| A continued `Escalates:` block on a PASS is lost because PASS ends the task | LWY-266.1 | pin: a PASS with a continued block runs one more round within `roundCap`, as LWY-244's decided block does | R1 |
| A continued block's extra round passes `roundCap` | LWY-266.1 | pin: hard stop 1 still fires at the cap, naming the block | R1 |
| A second reading files a second debt issue or closes a follow-up twice | LWY-266.2 | pin: each action checks its marker before writing | R1 |
| A differing answer is closed as if it matched | LWY-266.2 | pin: `done` only when the answer's label is the pick's; a differing one stays `backlog` with `# Answer differs` | R1 |
| The plan merges into main with picks unanswered and nobody told | LWY-266.2 | pin: the plan's end status update and ending list unanswered and differing follow-ups | R1 |
| A debt proposal still stops an issue run or holds "Land the task" | LWY-266.2 | pin: row 4 removed, and Land step 5 no longer waits | R1 |
| The implementer returns `BLOCKED` for a question it should decide, or builds a stop-list pick | LWY-266.3 | pin: the implementer's list, `## Decided and continued` for off-list questions, `BLOCKED` for the stop list | R1 |
| The reviewer is told to write the test of its suggested answer (cast broken) | LWY-266.3 | pin: the *Test* line names a test for the next round; the reviewer still never edits code | R1 |
| The budget notice is posted every round | LWY-266.4 | pin: once per dimension per story, checked before posting | R1 |
| A run with no budget gets a notice or a stop | LWY-266.4 | pin: no `budget` means no notice and no stop | R1 |
| A plan with a sweep missing passes the gate | LWY-266.5 | pin: the divergence reviewer's BLOCKER bullet names all three sweeps | R1 |
| Merging main into the plan branch at story start hand-merges a person's file | LWY-266.6 | pin: a non-mechanical conflict is stop 7, the merge aborted | R1 |
| A blocker task (not story) counts as cleared before `done` | LWY-266.6 | pin: only a story is cleared at a step after `build`; a task only at `done` | R1 |
| Docs disagree | every task | pins read PROCESS.md, run and the agents for the same rule | R1 |
| `targets/agents/` stale | every task | `node scripts/build-targets.mjs --check` | R1 |
| An existing pin breaks or stops testing anything | every task | the release lanes green, each rewritten pin keeping its assertion's strength | R1 |

Every check is a text pin under `plugin/test/` plus the lanes, as `release.yml` runs them: `node --test
"plugin/hooks/*.test.mjs" "plugin/hooks/adapters/*.test.mjs" "plugin/test/*.test.mjs" "scripts/*.test.mjs"` and `node
scripts/build-targets.mjs --check`. The live behaviour is checked by hand in LWY-212.10 once the story merges.
