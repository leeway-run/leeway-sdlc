# LWY-244: an unattended run stops only for a decision the criteria leave open

Story: LWY-244. Shaping answers: e1 to e5. Interview: e6. Evidence: LWY-229.1 e1 and LWY-229.4 e1 (project "Logos
and animations").

## The cause

Three places in `run` turn a question nobody needs to answer into an escalation that holds a task for up to 16 hours:

- **The freeze** (`plugin/skills/run/SKILL.md`, "The freeze"; `agents/sdlc-reviewer.md`, the freeze row and "After a
  round 0, check the freeze"; `agents/sdlc-implementer.md`, "Frozen tests"). Any diff to a frozen test beyond its skip
  marker is a spec amendment. A fixture that makes a test unable to observe the behaviour it names is treated the same as
  a weakened assertion.
- **Round 0** ("Round 0: red tests first"). The tests only run against absent code, where they fail for any reason, so
  a test that can never pass is frozen as if it were sound (LWY-229.1).
- **Raising blocks unedited** (run's raise table and "A BLOCKED brief" step 3; verdict handling step 3; `PROCESS.md`,
  "Questions to the human are escalations"). A reviewer's `Escalates:` block or an implementer's `## Question` goes to
  a person even when the criteria leave one answer (LWY-229.4).

## What changes

### A mechanical fix to a frozen test (AC-1, AC-2, e6)

- **Implementer** ("Frozen tests"): the exception and its three conditions, in the story's words. A fix goes in the
  brief's new `## Frozen test fix` section, one entry per frozen file changed beyond its skip marker: the file, the
  criterion it serves, its diff against the round-0 commit verbatim, and why each condition holds. "Never edit, weaken
  or delete an assertion" stays.
- **Brief template** (`skills/run/templates/BRIEF.md`): the `## Frozen test fix` section, after *Red tests*, "none"
  when nothing frozen changed beyond a skip marker.
- **The gate** ("The freeze"): `git diff --cached <round-0 commit> -- <frozen paths>` as today. Every frozen file whose
  diff goes beyond removed skip markers must be named in the section (e6). A file changed and not named stops the round
  before the record, as today: hard stop 8, the spec amendment, unchanged. The gate does not judge the conditions.
- **The record**: the brief is posted whole, so the section is in the thread. The iteration's `--note` also names the
  fix (`frozen test fix: <paths>`), so the thread's iteration row shows it without opening the brief.
- **The reviewer** (prompt line in run step 3; reviewer definition): when the brief carries the section, the prompt
  says a frozen test was changed and lists the files; the reviewer judges each against the three conditions. One unmet
  condition is a BLOCKER tagged `freeze` in the verdict. The freeze row's "unless your prompt carries a human's approval"
  gains "or the brief's `## Frozen test fix` names it and all three conditions hold".
- **A `freeze` BLOCKER** is hard stop 8: the orchestrator raises the spec amendment as "The freeze" says today (owner
  by criterion, `"type": "blocker"`), not as an `Escalates:` block. So the triage below never sees it (TC-2).

### Round 0 proves its tests can pass (AC-3, e2)

- **Implementer** (round-0 exception): after pasting each failure, write a temporary stand-in that makes the tests
  pass, run each un-skipped against it, paste the passing output, then delete the stand-in and re-skip before staging.
  Where no stand-in can be written for a test, say why for that test.
- **Brief template**: the *Red tests* table gains a column, *Passes against the stand-in (verbatim), or why none*.
- **The round-0 gate**: each row has a passing run or a reason. The staged-set check (tests plus listed stubs and
  nothing else) already refuses a stand-in left staged; the doc says so, so nobody adds a second check.
- **Reviewer** (round-0 review, and the verdict template's *Red tests* line): checks each passing run against the
  test it names, and judges each "why none" (a reason it accepts, or a finding). It still never edits code.

### Triage before raising (AC-4, AC-5, e3, e4)

One new subsection in run, **"Before raising a block: do the criteria decide it?"**, used by "A BLOCKED brief" step 3
and by verdict step 3, and the raise table's row points to it:

- **Decided** when one option follows from the story's `AC-n` and `TC-n` and every other leaves one unmet or
  contradicts one. Adding a field to an existing op's response that a criterion needs counts as decided (e3).
- **Always raised, unedited, as today** (AC-5): the criteria allow more than one answer; a product or scope choice; a
  new op or whether something is an op; removing or renaming a response field; the schema; auth; an ownership
  boundary; a rule in the intent doc. A spec amendment never comes here (above).
- **On decided**: raise nothing. Post one comment as `<alias>/agent` opening `# Decided from the criteria — <ref> ·
  round <N>`: the block as written, the criterion that decides it, the option taken (TC-5). Then:
  - for a `## Question`, run the next round with the decision in the prompt, as on an answered escalation (set the step
    back as "A BLOCKED brief" says on resume; the sub-issue is not set `blocked`);
  - for an `Escalates:` block, the decision is a live finding the next round answers: its `F<n>` comment exists
    already; on a block about the round as a whole, the decision comment is that finding. A PASS verdict with a decided
    block runs one more round for it, as a FAIL would, and counts against `roundCap` like any round.
- **Prompts** (reviewer definition, run step 3's prompt line, the verdict template's *Escalates* line; implementer
  definition and its prompt paragraph, the brief's *Question* section): a gap the criteria decide is reported as a
  finding with its fix (reviewer) or under *Uncertainties* with the criterion that decides it and built that way
  (implementer), not as an `Escalates:` block or `BLOCKED`. The orchestrator's triage is the backstop when they do not.
- `PROCESS.md`, "Questions to the human are escalations": "passes its fields through unchanged" becomes "after the
  triage (run, ...), passes the rest through unchanged".

**VISION R6** (leeway/app's intent doc: an agent out of its depth escalates) is kept, not cut against: a question the
criteria decide is not one the agent is out of its depth on, and AC-5's list is exactly where it would be.

## Not changed

The hard-stop table's numbers (8 still means a spec amendment), the round caps, the escalation fields, the server and
the CLI. Shape-project and plan-project are untouched: an `AC-n` change still goes through `shape-project`.

## Settled from the code (c8)

- `targets/agents/` is generated by `scripts/build-targets.mjs` and CI runs `--check`: each task regenerates it.
- The tests pin doc text (`plugin/test/*.test.mjs`) and do not execute `run`, so the LWY-229 cases are not fixtures.

## Breakdown

Three tasks, in order. All three edit `skills/run/SKILL.md` and the two agent definitions, so each is blocked by the
one before. Each adds its line to `RELEASE_NOTES.md` under *Unreleased* and regenerates `targets/agents/`.

1. **LWY-244.1, a frozen-test fix stays in the run:** implementer "Frozen tests", brief section, the gate, the iteration
   note, reviewer freeze row and prompt line, `freeze` BLOCKER to hard stop 8. AC-1, AC-2, AC-6, TC-1, TC-3, TC-4.
2. **LWY-244.2, round 0 runs its tests against a stand-in:** implementer round-0 exception, the *Red tests* column, the
   round-0 gate line, reviewer round-0 review and verdict template. AC-3, AC-6, TC-3, TC-4.
3. **LWY-244.3, decide what the criteria decide:** the triage subsection, both raise paths, the raise table, PROCESS.md,
   reviewer and implementer prompts and templates. AC-4, AC-5, AC-6, TC-2, TC-3, TC-4, TC-5.

The hand test is a sub-issue of LWY-212 (e5).

## Hazard register

| Hazard | Owning task | The check that proves it closed | Rung |
|---|---|---|---|
| A frozen file changed but not named in the section slips through the gate | LWY-244.1 | pin: the gate names "every frozen file whose diff goes beyond removed skip markers" and stops on one not in the section | R1 |
| A weakened assertion passes because the gate now lets diffs through | LWY-244.1 | pin: reviewer freeze row keeps BLOCKER for any unmet condition, and "never weaken or delete an assertion" stays in the implementer | R1 |
| A `freeze` BLOCKER is triaged away as "decided" | LWY-244.3 | pin: the triage subsection says a spec amendment never reaches it, and the freeze BLOCKER goes to hard stop 8 | R1 |
| The stand-in reaches the round-0 commit | LWY-244.2 | pin: the implementer deletes it before staging, and the round-0 gate's staged-set rule is cited as the check | R1 |
| The reviewer is told to write the stand-in (cast broken) | LWY-244.2 | pin: the reviewer's round-0 text checks the run and says it still never edits code | R1 |
| A decided block on a PASS verdict is lost because PASS ends the task | LWY-244.3 | pin: a PASS with a decided block runs one more round | R1 |
| An AC-5 kind of question is decided by the orchestrator | LWY-244.3 | pin: the always-raised list appears in run and PROCESS.md, word for word the same items | R1 |
| Docs disagree (AC-6) | every task | pins read PROCESS.md, run, both agents and both templates for the same rule | R1 |
| `targets/agents/` stale after an edit | every task | `node scripts/build-targets.mjs --check` | R1 |
| An existing pin on "unedited" or the freeze row breaks or stops testing anything | every task | the release lanes green, and any pin rewritten keeps its assertion's strength | R1 |

Every check is a text pin under `plugin/test/` plus the lanes, as `release.yml` runs them: `node --test
"plugin/hooks/*.test.mjs" "plugin/hooks/adapters/*.test.mjs" "plugin/test/*.test.mjs" "scripts/*.test.mjs"` and `node
scripts/build-targets.mjs --check`. The live behaviour is checked by hand in LWY-212's sub-issue once the story merges.
