---
name: run
description: Run a Leeway ref through the implement-review loop, driven by the build step of its type. A sub-issue - red tests first when the process asks, then rounds of implementer and reviewer until PASS or the round cap, each round committed, pushed and recorded as an iteration, a brief, anchored findings and a verdict, then squash-merged into its parent issue's worktree. An issue - unattended, every sub-issue in the order of its blocking relations, ending at the issue's merge gate; a human is involved only when one of ten hard stops fires, through one status comment and one escalation. A project - its issues as issue runs in that order, stopping at the first that stops. Refuses a type with no build step, the Plan record, a done or cancelled ref and another product's ref. Use when a sub-issue is ready to build, an issue's plan gate has passed, or a project's issues are. A question for the human becomes a Leeway escalation, never a terminal question. Invoking this opts the session into the delegated-work contract.
---

# Run

**Read `PROCESS.md` and `HARNESS.md` in this plugin first.** `HARNESS.md` says how this agent delegates, whether
you write the governed-agent marker, and where the plugin's files are. Of `PROCESS.md`: "The cast", "How the plugin reaches Leeway", "The process, read at
runtime", "The loop", "Questions to the human are escalations", "Records" and "Where a finding goes". It is the
contract this skill executes, and invoking this skill is what opts the session into it. Read the
craft doc (`craft/HOW-WE-CHANGE-CODE.md`) too: it binds you as it binds everyone.

Then the repo's own wiring:

- **The version.** If the `Synced to` row under `## Repo copies` in `.sdlc/CONFIG.md` is older than `HARNESS.md`'s
  `version:`, say once that the repo's copies are behind and the sync-repo skill brings them up (Claude Code says
  this at session start; other agents may not). Carry on: it is a notice, not a stop.

- **`.sdlc/leeway.md`**: `server:`, `product:` (the key, `<KEY>` below), `cli:` and the *Nit collectors* table
  (project id to collector ref) and `friction-project:` (or, in a legacy binding, `friction-collector:`: see
  "Land the task").
- **`.sdlc/CONFIG.md`**: the doc map (with each doc's `real` / `stub` / `absent` state), *Required reading*, the
  lanes and the **gate command**, *Known-red*, and the topology (integration branch, plan branch, per-worktree
  setup, evidence directory).

In every command below, `leeway` means `<cli> --server <server>` from `.sdlc/leeway.md`, `<ref>` is the
sub-issue in hand (`DRY-2.1`), `<story>` its parent issue (`DRY-2`) and `<project>` the project's id. No token and
no credential is written to a file, a prompt or a brief: `leeway login` keeps the sign-in on the machine.

## What the ref is

`run` takes one ref and runs it by what it is. Find out first, and write nothing until you have:

1. **A ref of another product is refused.** An issue ref is `<KEY>-<n>` or `<KEY>-<n>.<m>`; one whose key is not
   `product:` in `.sdlc/leeway.md` belongs to another product. Say which product the binding names, and stop.
2. **Read it.** An issue ref: `leeway --json issue get <ref>`. Anything else is taken as a project id: `leeway
   --json project get <KEY> <project>`. `not_found` from either means it is not an issue or a project of this
   product: say so, and stop.
3. **Refuse what is not work**, saying why and writing nothing:
   - **the Plan record**: the issue is the nit collector the *Nit collectors* table in `.sdlc/leeway.md` names for
     its `project.id`. It is a container for comments, not work, and nothing runs it;
   - **an issue or sub-issue whose `issue.status` is `done` or `cancelled`**: there is nothing left to run.
4. **Then run it as what it is:**

   | The read says | It is | Run |
   |---|---|---|
   | `issue get`, `issue.parentRef` set | a sub-issue, one task | "Run a sub-issue" |
   | `issue get`, `issue.parentRef` null | an issue, a story (its sub-issues are `subIssues`) | "Run an issue" |
   | `project get` answers | a project | "Run a project" |

   An issue run is a sub-issue run per sub-issue with what a whole story needs on top, and a project run is an
   issue run per issue: the loop, the verification gate and the round records are "Run a sub-issue"'s, written once.

## Who writes, and as whom

You are the orchestrator. **You are the single writer to git and to Leeway.** The implementer stages and the
reviewer reads; neither commits, and neither writes to Leeway.

**The alias.** Every write carries `--as <alias>/<role>`. You choose the alias when the session starts and keep it:
`<word>-<two hex digits>` (for example `kestrel-b1`; it must match `^[a-z][a-z0-9-]{1,23}$`), never one already
visible on the issue. Roles are `implementer`, `reviewer`, `planner` and `agent`. Your own words (a status, a stalled
round, a cap, a merge) are `<alias>/agent`. Your subagents never write, so their entries are yours under their role:
the iteration and the brief `<alias>/implementer`, the findings and the verdict `<alias>/reviewer`. A task resumed in
a later session carries that session's alias, and the thread shows the handover. Reads carry no `--as`.

**Git is enforced by a hook, Leeway by a hook and by prose.** `git-guard` blocks a governed agent's git writes and
`leeway-guard` blocks its `leeway` call whose verb is outside `get|list|whoami|help|version`. Which calls count as a
governed agent's depends on the harness: `HARNESS.md`, "Governed-agent marker". Where it says `governed-marker:
required`, run its `on` command immediately before every delegation in this skill and its `off` command as soon as
the agent returns, **including when it fails or returns BLOCKED**: while the marker is live the guards treat every
shell call as the subagent's, yours included, so never commit, push or write to Leeway with it on. The hook is the mechanism and the prose is the rule: it does not see a raw HTTP
call, a script the agent wrote and then runs, or another plugin's agent. So every subagent prompt carries the
read-only paragraph in "Delegate to the implementer", you give a subagent no `--as`, no token and no server
override, and you never paste a credential into a prompt. Hold the line yourself and know that you are.

**A question for the human is never a terminal question.** It is a Leeway escalation on the sub-issue in hand, and
then you stop the turn ("Questions to the human are escalations"). Nowhere in this skill do you ask the user.

**Statuses and steps are set, never inferred.** The only calls that move a sub-issue or a story are `issue update
<ref> --step <id>` and `--status <status>`. No iteration, comment, verdict or escalation moves anything; a stalled
round leaves the status exactly where it was.

**How the CLI clears a step: it cannot send null.** `leeway issue update <ref> --step null` sends the four-letter
string `null`, and the server answers `invalid_step` (`--owner null` the same: `invalid_owner`); `--branch` is typed the
same way. This was run against `leeway` 0.2.0, whose help says "or null to clear it" regardless; a later CLI may
accept a literal `null`, and `--status` then still works. The CLI types a field that may be null as a plain
string and has no flag for a JSON null. The one way a step is cleared is a `--status` that is not the step's own
status, which clears the step in the same write. This is why `--status in_review` takes a task out of
`implementing`, and why a step is never cleared on purpose: set the next one. A CLI change is a nit on the Leeway
repo, not on this plugin.

**One task at a time.** Do not batch several into one implementer run and do not defer review to the end. Two
tasks may run concurrently only when they share no file, checked before starting; say so in both briefs. An issue
run never does ("The task order").

**The tracker is not optional.** If a Leeway call fails, stop and say so (an expired sign-in is the usual cause:
`leeway login`). Do not proceed on a branch name alone: work with no record is indistinguishable afterwards from
work nobody reviewed.

## Why it is shaped this way

Separate implementer and reviewer contexts, because an author reviewing their own diff rationalises it. Tests
before code review, because reviewing a diff whose tests are red wastes the expensive pass. Per task, not per
story, because a whole story in one run produces a diff nobody reviews properly. The verification gate, because
delegation is only as trustworthy as your ability to check it. The round cap, because rounds that have not
converged mean the task is mis-specified, and that is a human decision.

## Run a sub-issue

`run` on a sub-issue runs that one task. An issue run ("Run an issue") runs this once per sub-issue, from
"0. Locate, read the process, set up" through "Land the task", and every section here is its procedure too.

### 0. Locate, read the process, set up

1. **Read the task and its story.**

   ```sh
   leeway --json issue get <ref>
   leeway --json issue get <story>
   leeway --json process get <KEY>
   ```

   From the task: `issue.description`, `issue.status`, `issue.branch`, `issue.base`, `issue.parentRef`,
   `issue.blockedBy`, `iterations`, `comments`, `escalations`, `thread`. From the story: `issue.type`,
   `issue.step`, `issue.base`, `issue.description` (and, when its *Technical criteria* points to one, the latest
   comment opening `# Technical criteria`), `project.id`.

2. **Find the type's `build` step.** The sub-issue has no type; its story's `issue.type` names one in the process.
   Take that type's step whose `kind` is `build`.
   - **None → say so and stop.** `run` does not run that type. Change nothing and create nothing.
   - Otherwise read its `params` and keep them: `redTests`, `round0Cap`, `roundCap`, `review` (`light`,
     `standard` or `adversarial`), `blockingRungs`, `unattended`. A value the process does not carry is not
     yours to invent: stop and say which one.
   - Say what this task will do before doing it: "type `feature`: red tests first (cap 2 attempts), up to 3 code
     rounds, adversarial review, blocking rungs R4 and R5".

3. **Check whether it is blocked.** `issue.blockedBy` lists `{ref, title, status}`; a blocker counts only while its
   `status` is neither `done` nor `cancelled`. A blocked task does not start: name the blockers and stop.

4. **Round 0, or straight to implementing.** Read the task's rung from its `## Evidence` section, against the evidence
   doc in the doc map.

   | `redTests` | The task's rung | So |
   |---|---|---|
   | true | R1 or above | **round 0**, below, before any production code: `--step red-tests` |
   | true | R0 (docs, comments, renames, test-only edits) | no round 0: `--step implementing` |
   | true | none named | **not R0.** Round 0, and add the rung to the description (`issue update <ref> --stdin description`, the old text with the rung added) so the next reader is not guessing |
   | false | any | no round 0: `--step implementing` |

5. **The branch.** If `issue.branch` is set, use it verbatim. Otherwise derive `<branchPrefix>/<ref lower>-<slug>`
   from the type's `branchPrefix` (the slug of the title, at most 40 characters), write it back and **read it back**:

   ```sh
   leeway --as <alias>/agent issue update <ref> --branch <branch>
   leeway --json issue get <ref>   # use issue.branch verbatim from here on
   ```

   A refusal of `repository_required` or `invalid_repository` means the story has no repository, or one that is not
   connected: stop and say so.

6. **Worktrees: mandatory, and yours alone.** Never work in the primary checkout. A human works there, and a
   subagent's staged files would mix with theirs.

   | Worktree | Path | Cut from | Created | Removed |
   |---|---|---|---|---|
   | story | `.worktrees/<story branch>` | the branch the story's `issue.base` names (the plan branch or the integration branch in `.sdlc/CONFIG.md`) | once, when the story's first task starts | at the story gate |
   | task | `.worktrees/<task branch>` | the story branch | when the task starts | when the task is done |

   `.worktrees/` must be ignored by git; check once per repo. Run every git command of your own as `git -C
   <absolute path>`, and **pass the absolute task-worktree path in every subagent prompt**: a subagent starts in
   the primary checkout, so a relative path lands where every concurrent session reads and writes the same
   files. If `.sdlc/CONFIG.md` names a per-worktree setup command, run it in each new worktree: a worktree isolates
   files, not databases or ports. **Two concurrent stories must agree a migration number, or any other monotonic
   counter, before either generates one.**

7. **Start.** Read the state first and write only what is not there yet (in an issue run most of it is).

   ```sh
   leeway --as <alias>/agent issue update <story> --step build     # skip when issue.step.id is already build
   leeway --as <alias>/agent issue update <ref> --step red-tests   # or --step implementing, per step 4
   ```

   A step brings its status with it (`in_progress`), so no `--status` goes with either. The story stays at `build`
   for as long as its tasks run; it is not moved per round. **Resuming a task:** the thread says where it stopped.
   The stage is the `to` of the last `step` entry that is not null (a task `in_review` or `blocked` has had its
   step cleared); the iterations and comments say which of the round's records are already written. Carry on from
   the first thing not done, and write nothing twice.

#### Counting rounds

**The round count is the number of iterations on the sub-issue, read from Leeway, never from text and never from
the story.** The round-0 attempts are the iterations recorded **before** the `step` entry in the thread whose `to` is
`implementing`; every later iteration is a code round.

```sh
leeway --json issue get <ref> | node -e 'const j=JSON.parse(require("fs").readFileSync(0));const e=j.thread.find(t=>t.kind==="step"&&t.data.to==="implementing");const r0=j.iterations.filter(i=>!e||i.createdAt<e.at).length;console.log("iterations",j.iterations.length,"round 0 attempts",r0,"code rounds",j.iterations.length-r0)'
```

The caps: `round0Cap` bounds the round-0 attempts and `roundCap` the code rounds, so a round-0 attempt never spends
the code rounds. Separately, the server refuses a 51st iteration on one issue (`iteration_limit`): a task that
reaches it is mis-specified whatever its caps say, and is escalated like any cap.

### Round 0: red tests first

Only when step 0.4 said so. Before any code, the implementer writes the tests that state the story's criteria, the
`AC-n` and `TC-n` alike, and a reviewer checks them against those criteria. They are then frozen and the code has to
meet them.

**Where the criteria are.** The `AC-n` are in the story body. The `TC-n` are in its *Technical criteria* section or,
when that section says so, in the latest story comment opening `# Technical criteria`. Paste both from wherever
they are. A pointer with no such comment is a stop: tell the developer, and run no round 0 against half the
criteria.

Round 0 runs "Delegate to the implementer" to "Gate again, record, act" below, with these differences.

- **The prompt says this is round 0.** The implementer's definition forbids skipping a test and makes its one
  exception on that word. It writes only the failing tests the task's `## Serves` criteria call for and the
  `## Negative case`, each **skipped with a reason that names its criterion** (`it.skip("AC-2: …")`, a
  `red-test-AC-2` reason, or the repo's own idiom with the same reason), so the suite stays green. It stages the
  tests alone, plus, where a test needs a type that does not exist yet, the smallest stub that compiles (a signature
  that throws), every stub listed in the brief. Its brief's *Red tests* table carries, per test, the verbatim failure
  from running it un-skipped.
- **The gate also checks** that the staged set is tests plus listed stubs and nothing else, that every new test
  carries a skip marker naming an `AC-n` or `TC-n`, and that each pasted failure is the **right** one: the behaviour
  is absent, not the harness broken. A compile error elsewhere, a missing fixture or a refused connection proves
  nothing about the criterion.
- **The reviewer reviews tests against criteria, not code.** Its prompt says this is round 0 and carries the
  story's *Acceptance criteria* and *Technical criteria* verbatim and `redTests` as "red tests are running".
- **The headings** of the brief and the verdict still carry the iteration number as `round <N>`, with `(round 0)`
  after it, for example `# Handoff brief — DRY-2.1 · round 1 (round 0)`.
- **Round 0 follows the same statuses as a code round.** After the gate the task goes `--status in_review` (the
  step clears), so the board shows the reviewer has it. The thread's `step` entry with `to: implementing` still
  comes once, at the round-0 PASS, so it remains the one mark that closes round 0 and the counting one-liner is
  unaffected by the `in_review` writes.
- **PASS** → the round is already committed and pushed: that sha is the **round-0 commit**. Set `--step
  implementing` (the entry that closes round 0), and the freeze below begins. **FAIL** → set `--step red-tests`
  again (the status goes back to `in_progress`), the full verdict goes back to the implementer in the same
  worktree, and the next attempt is a new commit on top.
- **The cap.** After a FAIL, if the round-0 attempts have reached `round0Cap`: stop. Two failed attempts mean the
  criteria are ambiguous, which is a question about the story for its owner, not another round. Leave the task at
  `red-tests` (set again after the FAIL) and raise one escalation on the sub-issue as `<alias>/agent` that names the outstanding findings
  (`cN`) and the owner (the product owner for an `AC-n`, the developer for a `TC-n`), with options such as
  "Clarify the criterion", "Split the story" and "Allow one more attempt", each with its argument.

#### The freeze

From the round-0 commit on those tests are **frozen**: later rounds turn them green by changing production code and
removing the skip marker, nothing else.

- **Every later implementer prompt carries the frozen list**: paths, test names and the round-0 commit sha, and the
  rule.
- **The gate checks it.** `git -C <task worktree> diff --cached <round-0 commit> -- <frozen paths>` shows removed
  skip markers and nothing else. Against the round-0 commit, not `HEAD`, so a change an earlier round committed is
  still caught. Anything more stops the round before it reaches the record.
- **Every later reviewer prompt says** that red tests ran, lists the frozen tests and the round-0 commit, and that
  any diff to one beyond un-skipping is a BLOCKER unless the prompt carries a human's approval for it. A task that
  ran no round 0 says "no red tests ran", and the reviewer raises no freeze finding.
- **A frozen test that is wrong is a spec amendment.** Stop. Show the criterion's owner the test, the criterion,
  and why one of them is wrong: **the product owner for an `AC-n`, the developer for a `TC-n`**. That is an
  escalation on the sub-issue; their decision goes into the thread before the implementer may touch the test, and
  the reviewer prompt then carries it. A changed `AC-n` is the product owner's through `shape-project`, a changed
  `TC-n` the developer's through `plan-project`. **The implementer never weakens or deletes an assertion to reach
  green.**
- **At the PASS that closes the task no `red-test-` skip marker remains** in the frozen files. A test still skipped
  is a criterion nobody delivered.

### 1. Delegate to the implementer

Delegate to the **sdlc-implementer** agent, fresh, as `HARNESS.md` ("Delegating to a named agent") describes, with
the marker on if it is required. Pass, in the prompt:

- The **full user instruction**, the task ref, and the **absolute task-worktree path**.
- The **verbatim descriptions of the task and the story**, and the *Technical criteria* comment if there is one.
- The **doc map** from `.sdlc/CONFIG.md`, with each doc's state.
- The **brief template**: `templates/BRIEF.md` in this skill's directory, from its `# Handoff brief` heading down
  to the `---` rule above `## Worked example`, and not one line more. The worked example is your reference, not
  part of the template.
- The **lane commands** to run, and the failures already known to be red here (CONFIG's *Known-red*).
- The **Required reading** rows from `.sdlc/CONFIG.md` whose paths the task touches, verbatim, with: "open each
  listed file before you change anything under its paths, and name each under *Rules read* in your brief". Paste
  them even where a hook injects them too: not every harness has that hook.
- **Round 0 / the freeze**: "this is round 0" or the frozen list (above).
- On a round after a FAIL: the **full verdict**, and the `cN` of every **live finding** it must answer, so its
  `Addresses:` line can name them. A finding is live while its `fate` is `open` or `addressed`; a `disputed` or
  `settled` one is terminal (`--addresses` on it is refused, `fate_conflict`), so it is not listed. Pick them with
  the filter in "Delegate to the reviewer".
- **How it reaches Leeway**, in these words or the equivalent:

  > You may **read** Leeway through the CLI, with no actor and no `--as`: `<cli> --server <server> --json issue
  > get <ref>`, `... review get <ref>`, `... escalation list <KEY>`. Read the story, the siblings and earlier rounds
  > when the code points at them. You **never write** to Leeway: no `issue create` or `update`, no `comment add`,
  > `iteration record`, `escalation raise` or `answer`, `dependency`, `pr link`, `project` or `process` write, no
  > `login`. A hook (`leeway-guard`) denies the write verbs for you, but the rule is yours to keep without it. You
  > hold no token of your own: do not look for one, print it, copy it or pass it on. The orchestrator is the only
  > writer. You do not commit or push; you `git add`. Your brief's `Head sha` stays `pending`: the orchestrator
  > commits your staged work and writes the sha.
  >
  > **You never ask the user a question in the terminal.** If a decision is the human's, stop implementing the part
  > that depends on it and return `Status: BLOCKED` with a `## Question` section: the question (one sentence), 2 to
  > 5 options each with its argument, and the meanwhile.

> **Embed critical inputs; do not reference them.** A prompt carrying its own content survives a failed tool call;
> an agent whose first call fails silently fabricates everything downstream. Reading Leeway is how a subagent
> follows a reference it *finds*, not how it receives its instructions.

> **Verify every specific factual claim before putting it in the prompt.** A helper, a schema detail, a path. Open
> it and confirm. The implementer trusts the brief over the codebase, so a wrong claim gets written into a permanent
> code comment. If you cannot verify it, write "verify this yourself".

### 2. Gate, commit, push, record

**Run the verification gate before anything reaches Leeway.** The brief must have arrived as the agent's final
message and carry a `## Verification` section with verbatim `git status --short` and `git diff --cached --stat`.
**Then run both yourself, in the task worktree, and compare.** That comparison is what catches a round that never
happened. Where `.sdlc/CONFIG.md` has *Required reading* rows owed by the staged paths, also check that the brief's
*Rules read* section names each owed file; a missing one sends the brief back.

If the brief is `Status: BLOCKED`, go to "A BLOCKED brief" instead of the rest of this section. Otherwise, in order;
a step that fails stops the round.

1. **Commit the round on the task branch**, one commit per round, squashed away on PASS. The message follows the
   repo's floor ("Branches and commits"): a subject that says what changed and why, a body explaining the cause when
   it is a fix, and the `Co-Authored-By:` trailer your session's attribution names.

   ```sh
   git -C <task worktree> commit
   git -C <task worktree> rev-parse HEAD     # the round's sha
   ```

2. **Stalled-round check.** Read `iterations[].sha` (`leeway --json issue get <ref>`). The round is **stalled** if
   there was nothing staged to commit, or if `rev-parse HEAD` equals the `sha` of any recorded iteration (the server
   refuses every repeat: `sha_repeated`). A stalled round **records nothing**, leaves the sub-issue where it is,
   raises an escalation on it and stops. It is never counted and never retried silently, and you do not force a
   commit to get past it:

   ```sh
   leeway --as <alias>/agent escalation raise <ref> --question "Round N produced no new commit on <branch>: how should it go on?" --options '[{"label":"Re-run the implementer","argument":"The prompt was at fault; a sharper one may produce the change."},{"label":"Take it inline","argument":"The task is smaller than a round; the orchestrator does it and says the workflow degraded."},{"label":"Re-scope or cancel","argument":"The task is already satisfied or mis-specified; no more rounds buy anything."}]' --meanwhile "The sub-issue keeps its status and nothing is merged."
   ```

   Then stop, and report the escalation id and the issue.

3. **Push the task branch**, then confirm the remote has the sha you will record:

   ```sh
   git -C <task worktree> push -u origin <branch>
   git -C <task worktree> ls-remote origin refs/heads/<branch>     # the first column equals the sha
   ```

4. **Record the iteration**, as the implementer. `--tests` is the brief's lane line (at most 200 characters);
   `--passed` is present only when the brief says `Passed: yes` (for `no` or `n/a` omit it; a failed lane is already
   in the text as `FAILED: …`); `--addresses` is the brief's `Addresses:` as a JSON list, omitted when `none`:

   ```sh
   leeway --as <alias>/implementer --json iteration record <ref> <sha> --tests "<lane line>" [--passed] [--addresses '["c1","c3"]']
   ```

   `iteration.number` is `N`, this round's `it.N`. **No push, no iteration.**

5. **Post the brief**, as the implementer, whole: replace its `Head sha: pending` with the sha and post it from a
   quoted heredoc or a file by absolute path in the session scratch directory, never in the repo:

   ```sh
   leeway --as <alias>/implementer --json comment add <ref> --stdin body <brief.md
   ```

   `comment.number` is the brief's `cN`. A comment body is at most 20,000 characters: a longer brief goes in whole
   across the comment and a reply (the rest as `comment add <ref> --parent cN --stdin body`), never cut.

6. **Hand over to review.** In a code round: `leeway --as <alias>/agent issue update <ref> --status in_review`
   (the step clears with it, see "How the CLI clears a step"). Round 0 is the same: `--status in_review`, then
   the reviewer.

**One iteration and one brief per round; the verdict answers that same round, joined by `--iteration N`; the next
round opens a new one. Rounds never interleave.** The brief opens `# Handoff brief — <ref> · round <N>` with `N`
the iteration number, and the verdict is not a reply to the brief (the server refuses review flags on a reply,
`invalid_parent`).

#### A BLOCKED brief

An implementer that returns `Status: BLOCKED` has stopped on a decision for the human. After the gate:

1. If it staged work, commit, push and record the iteration as above; if it staged nothing, do not (no iteration).
2. Post the brief as a comment (step 5), so there is a `cN` to point at. With nothing committed write its `Head sha`
   line as `none (BLOCKED, nothing committed)`.
3. Raise its `## Question` block **unedited**, as the implementer, tied to the brief:
   `leeway --as <alias>/implementer escalation raise <ref> --question "…" --options '[…]' --meanwhile "…" --comment cN`.
4. Set the sub-issue blocked: `leeway --as <alias>/agent issue update <ref> --status blocked` (the step clears).
5. **Stop.** Report the escalation id and the issue. Do not delegate to the reviewer.

On resume, read the answer (`escalations[].answer`), set the step back to the stage the thread shows
(`--step red-tests` or `--step implementing`), and run the next round with the answer pasted into the prompt.

### 3. Delegate to the reviewer

Immediately. Delegate to the **sdlc-reviewer** agent, fresh, as `HARNESS.md` describes (marker on if required),
with the same doc map, the Required reading rows, the **verdict template** (`templates/VERDICT.md`,
from its `# Review verdict` heading down to the `---` rule above `## Worked example`), the implementer's full brief,
the lane commands and the known-red list, and:

- **The depth and the rungs**: the line `review: <depth>` exactly as the process sets it, and the rungs in
  `blockingRungs` (an unproven claim at one of them is a BLOCKER; at any other it is a finding, never a BLOCKER).
- **The freeze, or its absence**: the frozen list and round-0 commit, or "no red tests ran" (see "The freeze"); and
  "this is round 0" when it is.
- **The round's commit.** Nothing is staged: the reviewer's definition speaks of the working state, and this prompt
  names the sha. The round's diff is `git diff <base>..<sha>`, where `<base>` is the previous iteration's sha or,
  for the first, `git merge-base <story branch> <sha>`.
- **The anchor rule.** A finding anchors to **new-side lines of the file as it is at `<sha>`** (lines of the file,
  not diff positions), at most 40 lines (`end - start < 40`), written `it.N · path:start-end`. A finding with no line
  to point at gets `—` and is still posted.
- **The earlier findings still live**, as `cN` with their text: from `leeway --json issue get <ref>`, the entries of
  `comments` (top level) with `kind` `comment`, `by.actor.role` `reviewer` and `fate` `open` or `addressed`. The
  `kind` and `role` filters matter: every top-level comment starts `open`, so the briefs and the verdicts would
  otherwise match (`review get <ref>` shows verdicts as `open` for ever). Do not filter on `anchor`. It decides, for
  each, `Settles` or `Disputes`, and names only these.
- **How it reaches Leeway**: the implementer's read-only paragraph minus its git and brief sentences, and that it
  never asks the user: a decision for the human goes in the verdict's `Escalates:` block.

### 4. Gate again, record, act

Gate the reviewer the same way: the verdict arrived as its final message, its test output is verbatim, and the tree
still matches what you saw (`git status --short` empty and `rev-parse HEAD` still the recorded sha: the reviewer may
break a test to watch it fail and restores it; you check that it did). Check its *Rules read* against CONFIG's
*Required reading* as for the brief. Check that every `Disputes` entry has a finding citing it.

Then record the **full findings**, in this order, all as the reviewer. "Four MINORs, no majors" is not
sufficient: the verdict exists nowhere else.

1. **Each finding, one comment each**, from its body block in the verdict. Anchored:

   ```sh
   leeway --as <alias>/reviewer --json comment add <ref> --anchor '{"iteration":N,"path":"src/x.ts","start":12,"end":20}' --stdin body <finding.md
   ```

   A finding whose anchor is `—` omits `--anchor`. Each `comment.number` is that finding's `cN`; keep the map `F1 →
   c6`, … **A dispute is a finding too**: a disputed `cN` is terminal, so the verdict that disputes it carries a
   new finding citing it, and the next round answers that one.
2. **The verdict**, a review comment on this round's iteration: the verdict with its finding-body blocks removed and
   each `F<n>` rewritten as its `cN`. This is how a verdict over 20,000 characters shrinks: each finding is its own
   comment and the verdict names them; a verdict that is still over goes in whole across the comment and a reply, the
   flags on the first. `Settles` and `Disputes` name only live findings; `--raises` is the `cN` of the findings just
   posted. Leave out a list that is empty (each is at most 50 entries):

   ```sh
   leeway --as <alias>/reviewer --json comment add <ref> --kind review --iteration N --settles '["c1"]' --disputes '["c2"]' --raises '["c6","c7"]' --stdin body <verdict.md
   ```

   One review cannot settle and dispute the same finding, and a finding raised by one review cannot be raised by
   another (`fate_conflict`, `invalid_review`). The verdict opens `# Review verdict: PASS — <ref> · round <N>` or
   `# Review verdict: FAIL — <ref> · round <N>`.
3. **A dispute or a finding that needs a human** (`Escalates:` is not `none`) becomes an escalation on the
   sub-issue, as the reviewer, and you stop:

   ```sh
   leeway --as <alias>/reviewer escalation raise <ref> --question "…" --options '[{"label":"…","argument":"…"},{"label":"…","argument":"…"}]' --meanwhile "…" [--comment cN]
   ```

   `--comment cN` ties it to the **finding it concerns** (the `Escalates:` block says which `F<n>`). It is never the
   verdict's `cN`: the server accepts only a top-level `kind=comment` there and answers `unknown_comment` for a
   review. A question about the round as a whole omits it. Report the escalation id and the issue, and do not go to
   PASS or FAIL handling until it is answered. Leave the sub-issue `in_review`, in round 0 too.

#### What a deferred finding becomes

A finding accepted at PASS but left unaddressed is **already recorded**, in full, in the round you just posted.
Filing decides whether a human has to look at it. Sort the verdict's *Proposed follow-ups* (they have no comment of
their own) by `PROCESS.md`, "Where a finding goes":

| The follow-up is | What you do |
|---|---|
| Security, isolation or data exposure, any severity; or a correctness bug reachable in production | **File its own issue now**, no approval: `leeway --as <alias>/agent issue create <KEY> --projectId <project.id> --title "…" --summary "<at most 280 characters>" --status backlog --stdin description <desc.md`, in the task's project |
| Technical debt: the fix is a design decision | **Ask, and file only on a yes**: an escalation on the sub-issue with options "File it" and "Keep it a nit", each with its argument, raised as `<alias>/agent`, `--meanwhile` saying, standalone, that the loop carries on because nothing in hand waits on it, and in an issue run that the run stops here (its stop 4). On a yes, `issue create` as above, quoting the answer's `option` and `note`; on a no it stays a nit |
| Anything else | **One line, as a comment on the project's nit collector**, no issue: the collector is the ref in `.sdlc/leeway.md`'s *Nit collectors* table for `project.id`: `leeway --as <alias>/agent comment add <collector> --stdin body <nit.md` |

**If you cannot name the consequence of leaving it, it is a nit.** A nit is a comment on the collector, never an
edit to its body.

#### Then

- **PASS** → "Land the task". You may override a PASS: if a finding is under-rated and you can say why, send it
  back and record the reason as a comment from `<alias>/agent`. The override spends a round. A PASS that carries a
  missing proof at a rung in `blockingRungs` contradicts itself: send it back.
- **FAIL** → set the step back: `leeway --as <alias>/agent issue update <ref> --step implementing` (it sets
  `in_progress`; after a round-0 FAIL it is `--step red-tests` instead, which sets `in_progress` too). Hand the **full
  verdict** and the `cN` of each live finding (including the new one a dispute brought) to the implementer, and
  repeat from "Delegate to the implementer". **Nothing is merged on a FAIL.** The next round's commit sits on the
  same task branch, on top of this one.

**The caps.** Count with the one-liner under "Counting rounds". A verdict of FAIL with the code rounds at `roundCap`
(or round-0 attempts at `round0Cap`, see Round 0) is a stop: leave the sub-issue as it is and raise an escalation
on it as `<alias>/agent` whose question names the outstanding findings (`cN`) and whose options are the human's real
choices (for example "Re-scope the task", "Allow one more round", "Cancel it"), each with its argument. **You may
not override the cap.** Overriding a PASS and the cap together is the pattern the cap exists to prevent.

**Spend rounds on the risk, not on the artifact.** A round that only polishes a fix that was already correct buys
nothing. Notice when you are spending one on it.

### Land the task

On a PASS of a code round.

1. **Check the freeze closed**: no `red-test-` skip marker remains in the frozen files.
2. **Squash-merge task → story**, in the story worktree, as one commit that follows the repo's commit convention
   (the round commits on the task branch are squashed away):

   ```sh
   git -C <story worktree> merge --squash <task branch>
   git -C <story worktree> commit
   ```

3. **Set the task done**, and read it back: `leeway --as <alias>/agent issue update <ref> --status done`, then
   `issue get <ref>` shows `done`.
4. **Remove the task worktree** and delete the local task branch.
5. **Friction, only when `run` was invoked on the sub-issue itself** (an issue run harvests the whole story once,
   at the end). Collect every *Friction* line from this task's briefs and verdicts, round 0 included; drop `none`; dedupe
   against each other and against the open issues of the friction project (`friction-project:` in
   `.sdlc/leeway.md`; `leeway --json issue list <KEY> <friction project>` is one page, and the dedupe reads its
   open issues only, not the `done` or `cancelled` ones). Propose what is left as **one escalation** on the
   sub-issue, as `<alias>/agent` (options "File them" and "File none", the lines in the question's context
   comment), `--meanwhile` saying nothing waits. Only on a yes, file each accepted line as its own issue, the line
   with its task and round as the description: `leeway --as <alias>/agent issue create <KEY> --projectId <friction
   project> --type chore --title "…" --summary "<at most 280 characters>" --status backlog --stdin description
   <desc.md`. `n/a` there: the proposal is still made, nothing is filed.
   **Legacy binding**, `friction-collector:` (a ref, or `n/a`) and no `friction-project:` (installed before
   0.3.0): dedupe against the comments on that issue and file each accepted line as a comment on it, as before;
   with `n/a` the proposal is still made and nothing is filed. Say once, in the escalation's context comment, that
   sync-repo migrates the line to a friction project.
6. **Was it the story's last task?** Every sub-issue of the story `done` or `cancelled` → "The story gate".
   Otherwise the story stays at `build`; nothing is written. The nit collector is an issue of the project, not a
   task: it never counts.

### The story gate

When the story's last task has landed, in the **story worktree**. The order is fixed: the story branch is merged into
its base (step 5) before the story's next step is written, so a `manual` next step never skips the merge.

1. **Merge the story's base into the story branch** (fetched fresh), and resolve conflicts **yourself**. A conflict
   in a file a human wrote that is not mechanical (a lockfile the package manager regenerates is) is a stop: abort the
   merge so the worktree is at the commit before it, and escalate. Migrations or other ordered generated files are
   not merged textually: use the recipe the recipes doc in the doc map names, or stop and escalate if it names none.
2. Run the **gate command** from `.sdlc/CONFIG.md`, plus any lane the story's changes touched that the gate does not
   cover.
3. Only if the tasks interact in a way no single task's tests cover (a shared migration, a changed contract) delegate
   one reviewer pass over the combined diff. Skip it when they are independent; this is a gate against integration
   risk, not a re-review.
4. **Durable evidence.** At or above the rung the repo's evidence doc names for committed proof (and, where it names
   none, the lowest rung in `blockingRungs`), commit the record under the evidence directory in `.sdlc/CONFIG.md`.
   The round records keep the working copy; the repo keeps the one that survives.
5. **Push the story branch and merge it, then close the story by the process.** Merge the story branch into its
   base before any next step is written, so a `manual` stop cannot skip the merge: push the base as the
   orchestrator when it is a plan or story branch; the integration branch is reached only as the repo's convention
   says (the pre-push guard in "Unattended prerequisites" enforces it). Remove the story worktree. Then read the type's steps: the step
   after `build`.
   - **A next step** → `leeway --as <alias>/agent issue update <story> --step <next>`. If its kind is `manual`
     ("verify on dev"), say what it is waiting for and **stop**: the plugin never does a manual step and never moves
     the story past it.
   - **No next step** → `leeway --as <alias>/agent issue update <story> --status done`.

   Read the story back (`issue get <story>`) and check the step or status reads as written. Nothing else moves it.
6. **Afterwards.** If the story went `done` and was the
   project's last open story (`leeway --json issue list <KEY> <project.id>`: everything else `done` or `cancelled`,
   the collector aside), post the project's status update as a comment on the nit collector
   (`comment add <collector> --stdin body`, as `<alias>/agent`) and set the collector `--status done`: it is an
   issue of the project, and would hold the project's progress short while it sits open.

**A red gate is not a task FAIL.** The tasks passed; the assembled state did not. Open work for what broke and run
it through the loop. **A story with open findings is not a story with no findings:** check the deferred ones exist
where you filed them, and say in the status update which are still open.

### The verification gate

There is a known failure where a subagent emits text that *looks* like a tool call without invoking anything,
producing a confident brief about work that never happened. Both agent definitions require a proof-of-life call whose
verbatim output opens their response. **You verify independently.**

| | Symptom | Response |
|---|---|---|
| **Hallucination** | the staged set is empty or contradicts the reported work | re-spawn with an explicit prefix: *"You hallucinated tool calls in your previous run. Use real tool invocations only."* A second failure: do the work inline and **say in your final message that the workflow degraded**. Never silently do it yourself |
| **Truncated handoff** | the staged diff is real and matches, but the final message is cut short | the tools *did* run. Do not re-spawn or discard the work: ask for the missing sections, or reconstruct them from the staged diff and say in the posted brief that you did |

**Nothing reaches Leeway before the gate passes**: a hallucinated round is permanent, wrongly attributed and
indistinguishable from a real one. The final message *is* the brief; it is never handed over through a file.

### The writes of one round, in order

`X` is the iteration number. Every status in this table is set by an explicit `--step` or `--status`; no other row
moves an issue.

| # | Step | Write |
|---|---|---|
| 1 | start (once) | `issue update <story> --step build`; `issue update <ref> --step red-tests` or `--step implementing` (branch written back first) |
| 2 | implementer | none |
| 3 | gate, commit, stalled check, push | none (a stalled round: `escalation raise`, stop) |
| 4 | iteration | `--as <alias>/implementer iteration record <ref> <sha> --tests "…" [--passed] [--addresses '[…]']` |
| 5 | brief | `--as <alias>/implementer comment add <ref> --stdin body` |
| 6 | hand over | `issue update <ref> --status in_review`, in round 0 too |
| 7 | reviewer | none |
| 8 | findings | `--as <alias>/reviewer comment add <ref> [--anchor '{…}'] --stdin body`, one each |
| 9 | verdict | `--as <alias>/reviewer comment add <ref> --kind review --iteration X --settles … --disputes … --raises … --stdin body` |
| 10 | a human is needed | `--as <alias>/reviewer escalation raise <ref> … [--comment <the finding's cN>]` (never the verdict's), then stop |
| 11 | nits, follow-ups | comment on the nit collector; `issue create` for a security follow-up; an escalation for a debt proposal |
| 12 | outcome | round-0 PASS: `issue update <ref> --step implementing`. Code-round PASS: merge, `issue update <ref> --status done`. FAIL: `issue update <ref> --step implementing` (round-0 FAIL: `--step red-tests`) |

## Run an issue

`run` on an issue runs every task of that story. **It runs "Run a sub-issue" once per sub-issue** and adds only what a
whole story needs on top: the preconditions, the order, the stop conditions, the budget and the status comment. **It
does not restate "Run a sub-issue".** Where a step below names a section of it, that section is the procedure, word
for word, and nothing here relaxes it.

You are the orchestrator for the whole story. **One issue run, one story.** It ends in one of two places:

- **the end**: every task has landed, the story gate has run and the story has moved to the step after `build`, or
  to done;
- **a stop**: a hard stop condition fired, one `# Run status` comment and one escalation are on the story, and
  nothing more happens until a human acts.

There is no third ending. A run that drifts off without either has left the next human to work out what happened
from the branches.

| The sub-issue run owns | The issue run owns |
|---|---|
| the worktrees, the rung, round 0 and the freeze, every round, the verification gate, the round records, landing a task, the story gate | the preconditions, the story's build step, the task order, the stop conditions, the budget, the status comment, the friction harvest |

### Preconditions: all of them, or do not start

A refusal here writes nothing: say in the session which precondition failed and stop.

1. **The type is unattended.** `leeway --json issue get <story>` gives `issue.type`; `leeway --json process get
   <KEY>` gives that type's `build` step. **No `build` step, or `params.unattended` not true → say so and stop.**
   Such a story is run one sub-issue at a time, `run` on each, where a person is in the session. The process is what
   decides this, not a flag you pass.
2. **The plan gate is recorded**, when the type has a `gate` step: a coverage report comment on the story by
   `<div>/reviewer` (`<div>` is the divergence reviewer's alias, so `<div>/reviewer` is that reviewer's alias and role), and an escalation on it answered PASS or PASS WITH DECISIONS (`escalations[].answer`, with an
   answer to every QUESTION in the note). A gate that only existed in a conversation did not happen. A type without
   `gate` needs only that the story has tasks (`subIssues`) and is planned.
3. **The story is not blocked** (`issue.blockedBy`, a blocker counting while neither `done` nor `cancelled`).
4. **Leeway answers.** Read the story and its children; a failed call, or an empty result where something must
   exist, is stop 10 below, not an empty story.
5. **A previous run is answered.** If the story carries a comment opening `# Run status`, read the latest. The escalation it
   names must be answered, or the change it asked for recorded. Not recorded → the condition still holds; say so
   and do not start.
6. **The unattended prerequisites are in place** (below), or a human is watching and says so. A run that will stop at
   a permission prompt is attended whether anyone planned it that way or not.

### Story start

1. **Set the story to its build step**, after reading its state: `leeway --as <alias>/agent issue update <story> --step
   build`. Write nothing if `issue.step.id` is already `build`; a continuation run finds it there, and a second write
   is a second mover in the history.
2. **Create or reuse the story worktree** per "0. Locate, read the process, set up": cut from the branch
   the story's `issue.base` names the first time, reused as it stands on a continuation run. Run the per-worktree
   setup command in a new one.
3. **Take the baseline.** Run the gate command and every lane in `.sdlc/CONFIG.md` in the story worktree, and note
   which are green. A lane red here that is not in *Known-red* is stop 6 before the first task: building on a red
   branch hides whatever the tasks break.
4. **Start the budget** from `.sdlc/CONFIG.md`, *Per-story budget*. It reads as up to three dimensions, whichever is
   hit first (for example "2,000,000 subagent tokens · 15 rounds · 4 h wall-clock"), and `none` for a dimension
   means it is not enforced. It is per story, across runs: **rounds** are the iterations on the story's sub-issues
   (read them from Leeway, round-0 attempts included), and **tokens** and **wall-clock** continue from the `Spend`
   line of the latest `# Run status` comment.

### The task order

Read the story's children (`subIssues`, then `issue get` on each) and order them:

1. **Skip every task `done` or `cancelled`.** That is how a continuation run picks up where the last stopped.
2. **Never run the nit collector.** It is an issue of the project, a container for comments, not work.
3. **Order by the blocking relation** (`blockedBy`): every blocker before what it blocks.
4. **Break ties by plan order**: the order of the breakdown in the design doc, else the sub-issues' `position`.
5. **Refuse a task whose blockers are not done**, including a blocker outside this story. Skip it and take the next
   runnable one. If tasks remain and none is runnable, stop: the remaining work is blocked, and that is the human's
   to unblock. Post a `# Run status` comment and raise one escalation on the story naming the blockers ("On a stop"). A cycle
   in the relation is a planning bug: stop the same way.

**Re-read the children before each task.** A human may have closed, added or re-linked one while the last task ran,
and Leeway, not this session's memory, says what is left. **One task at a time:** a sub-issue run allows two concurrent
tasks that share no file; that trade is a person's to take when they run sub-issues themselves, never an issue run's.

### Each task: the sub-issue run, end to end

For the next task, run "Run a sub-issue" from "0. Locate, read the process, set up" through "Land the task": the task
worktree, round 0 where the rung calls for it, every round, the verification gate, the records, landing. Then check
the stop conditions, then take the next task. **Skip the per-task friction step of "Land the task"**: the issue run
harvests the whole story once, at the end.

**Fresh subagents per task.** Never carry an implementer or reviewer from one task into the next, and keep nothing
of theirs but the round records: once a task lands, the next task's prompts are built from Leeway, the records and
the code, not from what this session remembers a subagent saying.

What you keep, for the status comment and nothing else, is a **ledger**: per task its ref, its round count, its
round-0 attempts, its gate failures and where it landed (the story-branch commit sha); plus the baseline and the
spend. Every line can be rebuilt from Leeway, which is what makes it safe to lose.

**After each task lands**, in the story worktree, run the gate command and every baseline-green lane whose *Owns which
changes* row the task's diff touched. The reviewer ran the lanes on the task branch; the squash on the story branch
is normally the same tree, and this run is what makes "normally" a fact.

Where the sub-issue run asks a person for something (a debt proposal, a spec amendment, a cap), there is no one in the
session. That is what the stop conditions are.

### Hard stop conditions

**Only a human overrides these. The agent never does**, not with a reason, not once. A human overrides one by
answering the escalation; a later run reads it there (precondition 5). Each stop ends in **one escalation**: where
the sub-issue run already raises one, that is the stop's, and the issue run adds none (a second would be two questions
for one stop); otherwise the issue run raises it on the story.

| # | Condition | Detected | The stop's one escalation |
|---|---|---|---|
| 1 | **The round cap is hit** on any task: the verdict is FAIL and the code rounds (iterations on the sub-issue minus the round-0 attempts) are at `roundCap` | "The caps" | the sub-issue run's, on the sub-issue |
| 2 | **The round-0 cap is hit**: the attempts are at `round0Cap` and the last is a FAIL | "Round 0" | the sub-issue run's, on the sub-issue |
| 3 | **A verdict carries a `security` follow-up** | "What a deferred finding becomes" | the issue run's, on the story |
| 4 | **A `debt` follow-up needs a human yes** | the same | the sub-issue run's debt proposal, on the sub-issue |
| 5 | **A second verification-gate hallucination on the same task** | "The verification gate" | the issue run's, on the story |
| 6 | **A lane green at baseline is red on the story branch**, after a task lands or at the story gate | after each task | the issue run's, on the story |
| 7 | **A merge conflict with the base that is not mechanical**: any conflict in a file a person wrote | "The story gate" | the issue run's, on the story |
| 8 | **A frozen test needs a spec amendment**; the owner is the product owner for an `AC-n`, the developer for a `TC-n` | "The freeze" | the sub-issue run's, on the sub-issue |
| 9 | **The per-story budget is exceeded**: tokens, rounds or wall-clock, whichever first | at every round boundary | the issue run's, on the story |
| 10 | **Leeway is unreachable**: a call fails, or an empty result where something must exist (an expired sign-in is the usual cause) | any call | none can be raised: see the note |

**And every place the sub-issue run itself says stop**: a stalled round, a BLOCKED brief, a dispute or finding the reviewer
sends to a human, a pointer to technical criteria with no such comment, a migration recipe the doc map does not
name. They are stops here too, and each already raises its own escalation.

Notes on the ones that need them:

- **3 and 4: finish landing the task first.** A follow-up is by definition not this task's diff, and the task lands on
  the story branch, which reaches nobody until the story gate. So a PASS is landed through "Land the task",
  and then the run stops. A `security` follow-up is filed first, as "What a deferred finding becomes" says, with no delay; the stop is so a
  person decides whether the story should go on being built on top of it (options "Continue the story" and "Hold the
  story"). A `debt` follow-up is filed by nobody: the proposal is the escalation, and the person answers it.
- **5 replaces the sub-issue run's fallback.** A sub-issue run does a twice-hallucinated round inline and tells the user the
  workflow degraded. Unattended there is nobody to tell while it matters, and a degraded round nobody noticed is
  indistinguishable afterwards from a normal one. Stop instead.
- **6: a red gate is still not a task FAIL**, and it is not this run's to diagnose either: the story branch now
  differs from what every reviewer saw.
- **7: mechanical means regenerated, never hand-merged.** A lockfile the package manager rebuilds. A conflict in
  anything a person wrote stops the run: abort the merge, so the story worktree is left at the commit before it, and
  put the conflicting paths in the status comment.
- **9: check at round boundaries, never mid-subagent.** Killing a subagent loses a round that may have been real.
  Tokens are the subagents' counts as the harness reports them when each returns; if it reports none, that dimension
  is not enforced, and the status comment and the report to the user say so. Rounds include round-0 attempts.
- **10: no comment and no escalation can be written.** Put the status comment, word for word, in the session output,
  and post it once Leeway answers again, with the stop's escalation. Never retry in a loop.

### On a stop

Do these, in this order, and nothing else:

1. **Leave the write in flight complete and the next one unstarted.** A round with a brief has its verdict recorded;
   a task being landed is landed or, if landing is what failed, stays as it is. Never start the next task, the next
   round or the story gate.
2. **Leave every worktree and branch intact.** The story worktree, the task worktree and the task branch. The human
   resumes from them; a cleaned-up stop is a stop with its evidence removed.
3. **Move no story or task status.** The stop is recorded by the comment and the escalation, not by a `--step` or
   `--status`. (A BLOCKED brief or the sub-issue run's own stops have set what the sub-issue run sets; that is its own.)
4. **Post one `# Run status` comment on the story**, one per stop, however many conditions fired; each goes in it.
   Write the body to a file by absolute path in the session scratch directory or pass it as a quoted heredoc:
   `leeway --as <alias>/agent --json comment add <story> --stdin body <status.md`.

   ```markdown
   # Run status — <story ref> · stopped: <condition, by its name in "Hard stop conditions">

   - **Landed:** <task ref> <title>, commit <sha>; one per line, or "nothing yet".
   - **Stopped on:** <task ref> <title>: what fired and why, in one or two sentences, and the `cN` or escalation id that shows it.
   - **Not started:** <task refs, in the order they would have run>.
   - **Next human action:** <one action, imperative, saying where the answer goes>. Then invoke <`run`, as `HARNESS.md`'s **commands** spells it> on <story ref> again.
   - **Left in place:** <story worktree path>, <task worktree path>, <branch names>.
   - **Spend:** <rounds> of <budget> rounds · <tokens> of <budget> subagent tokens · <elapsed> of <budget> wall-clock.
   - **Friction so far:** <one line each, with task and round, harvested per "The friction harvest">; or "none".
   ```

5. **Raise the stop's one escalation** (the last column of "Hard stop conditions"). One the issue run raises is on the story, as
   `<alias>/agent`, tied to the status comment (`--comment cN`, its `comment.number`), with the human's real
   choices as options (2 to 5, each with its argument) and `--meanwhile` saying what stays blocked and what does not.
   Where the sub-issue run raised it, add its id to the status comment, not a second escalation.
6. **Tell the user the same thing** in the session, with the comment's `cN` and the escalation id, and stop the turn.

**The next human action is one action, and it is exact.** "Answer the escalation e2 on DRY-2.1, then invoke
`/leeway-sdlc:run` on DRY-2 again", not "review the findings". A stop whose next step the human has to work out costs
them the investigation the run already did. The skill is named as `HARNESS.md`'s **commands** spells it
(`/leeway-sdlc:run` in Claude Code), or as leeway-sdlc's `run` skill where it names skills in words: a bare `run`
can reach another skill of that name. For a `debt` stop the proposals follow the template, one line each.

### The end

When the last task lands, the sub-issue run hands on to "The story gate", and the issue run runs it unchanged, except that its
failures are stops here: a red gate is condition 6, a conflict condition 7, a missing migration recipe one of
the sub-issue run's own. The gate ends with the story set to the step after `build` or to `done`; a `manual` next step is
where the run ends ("verify on dev"), with the story waiting for a person.

The end posts one `# Run status — <story ref> · finished` comment on the story, with *Landed* (every task), the
story's new step or status, the *Spend* line and the friction proposal, so the next reader and a continuation run
have the spend. No escalation, except the friction proposal below.

#### The friction harvest

Every task paid some cost the next one will pay again unless someone builds the tool. The round records are where
that was written down; this is where it leaves them.

1. **Collect** every *Friction* line from the story's briefs and verdicts, every task, round 0 included. Read them
   from Leeway, not from memory: the ledger does not carry them, and the records do.
2. **Drop** `none`.
3. **Dedupe** the lines against each other (two tasks missing the same seed is one line naming both) and against the
   open issues of the friction project (`friction-project:` in `.sdlc/leeway.md`; `leeway --json issue list <KEY>
   <friction project>` is one page, and the dedupe reads its open issues only, not the `done` or `cancelled` ones).
4. **Propose** what is left as one escalation on the story, as `<alias>/agent`, options "File them" and "File none",
   the lines (each with its task and round) in the question's context comment. The proposal never waits: the story
   has ended.
5. **File only on a human yes**, each accepted line as its own issue, the line with its task and round as the
   description: `leeway --as <alias>/agent issue create <KEY> --projectId <friction project> --type chore --title "…"
   --summary "<at most 280 characters>" --status backlog --stdin description <desc.md`. Nothing is filed on silence.
   With `n/a` in `.sdlc/leeway.md` the proposal is still made and nothing is filed.
6. **Legacy binding**, `friction-collector:` (a ref, or `n/a`) and no `friction-project:` (installed before
   0.3.0): dedupe against the comments on that issue and file each accepted line as a comment on it, as before;
   with `n/a` the proposal is still made and nothing is filed. Say once, in the finished status comment, that
   sync-repo migrates the line to a friction project.

### Unattended prerequisites

A run is only unattended if nothing in it waits for a keypress. That needs four things, set up before the first run.

- **A permission allow-list**, where `HARNESS.md` ("Permissions for an unattended run") says this agent keeps it, covering at least the following and every command the skill names: the lane and
  setup commands `.sdlc/CONFIG.md` names; `git add`, `commit`, `push`, `fetch`, `merge`, `switch`, `worktree`,
  `branch -d`, `ls-remote`, `rev-parse` and `diff --cached`; `node -e` for the counting one-liner;
  and the `leeway` CLI's write verbs for the orchestrator. A subagent is stopped from those by the plugin's
  `leeway-guard` hook, not by the allow-list, and the hook is not a vault (`PROCESS.md`, "The cast").
- **A pre-push guard that refuses the integration branch and a force push.** It lives in the target repo, not in this
  plugin, and this skill only states the requirement. It runs on every push from any process, refuses an update to
  the integration branch named in `.sdlc/CONFIG.md` and refuses a force push to any ref: an allow-listed `git push`
  is one wrong argument away from the integration branch, and the plugin's git guard governs subagents, never the
  orchestrator. **Until the guard exists, leave `git push` off the allow-list** and let each push prompt: that run is
  attended, and should say so.
- **A per-worktree setup command** in `.sdlc/CONFIG.md` that runs without a prompt and gives each worktree its own
  scratch database and ports. A setup that asks a question stops the run at the first new worktree.
- **A session allowed to run long.** A story is hours, not minutes: no idle timeout on the session or the machine,
  and a Leeway sign-in that outlives the run (a lapsed one is condition 10). The
  orchestrator's own context grows with every task; fresh subagents and the ledger keep it bounded, and the ledger
  can be rebuilt from Leeway if the session compacts.

### Parallel stories

**Allowed only in separate story worktrees with separate scratch databases, one orchestrator session per story.**
Never two sessions on one story, and never two stories at once in one session (a project run takes them one after
another). **One writer to git means one writer per
worktree:** two orchestrators in one worktree are two writers to one index, and the verification gate then passes or
fails on someone else's work. The two stories still agree any migration number or other monotonic counter before
either generates one.

### What is lost

The human sees the story at the end, not per task. The round records are all there, but nobody reads them as they
happen, so a task that passed review on a misread criterion is found at the story gate, after later tasks were built
on top of it; the plan gate and the round-0 freeze make that rare, not impossible. A `debt` follow-up stops the run
rather than waiting in a queue, so a debt-heavy codebase stops often; the alternative is filing tickets nobody
approved. The budget is checked at round boundaries, so one long round can overshoot it, and a token count the
harness does not report is not enforced at all. And dropping each task's subagent context means a pattern noticed in
task 2 reaches task 5 only if a round record wrote it down.

## Run a project

`run` on a project runs its issues one after another, **each as an issue run** ("Run an issue"), in the order
their blocking relations allow, skips an issue its issue run refuses, and stops at the first issue that stops. It
adds only the order, the skip and that stop; each issue's run is "Run an issue", word for word, and nothing here
relaxes it.

1. **Read the project and its issues.**

   ```sh
   leeway --json project get <KEY> <project>
   leeway --json issue list <KEY> <project>
   ```

   `issue list` gives every issue in display order, each followed by its sub-issues; the project's issues are the
   entries whose `parentRef` is null. A failed call, or an empty result where something must exist, is stop 10 of
   "Hard stop conditions": say so in the session, and stop.
2. **Order them** as "The task order" orders sub-issues:
   - **Skip every issue `done` or `cancelled`.** That is how a run invoked on the project again picks up where the
     last stopped. An issue whose `issue.step` is a step after `build` (a `manual` one, "verify on dev") has been run
     and waits for a person: skip it too.
   - **Never run the Plan record**, the project's nit collector (*Nit collectors* in `.sdlc/leeway.md`).
   - **Order by the blocking relation** (`blockedBy`), every blocker before what it blocks, and break ties by the
     order of the breakdown in the design doc, else `position`.
   - **Refuse an issue whose blockers are not done**, including a blocker outside the project: skip it and take the
     next runnable one. If issues remain and none is runnable, or the relation has a cycle, stop and say so in the
     session, naming the blockers.
   - **Skip an issue its issue run refuses**: one that a precondition of "Run an issue" refuses, which writes nothing
     (its type is not unattended, it is not planned, an earlier `# Run status` is unanswered, or any other). Say in
     the session which issue and which precondition, and take the next runnable issue. It is skipped as an issue
     whose blockers are not done is: the issues it blocks stay unrunnable, and are skipped as blocked. A failed
     Leeway call is not a refusal: it is stop 10. When nothing runnable is left, the run ends there, and step 5
     reports what it ran and what it skipped.
   - **Nothing left** (every issue `done` or `cancelled`, the Plan record aside): say so, and stop.
3. **Run the next issue**, as "Run an issue" from its preconditions to its end or its stop, with fresh subagents.
   **Re-read the list before each issue**: Leeway, not this session's memory, says what is left.
4. **Stop at the first issue that stops**: a hard stop or a stop of the sub-issue run (each with its own `# Run
   status` comment and one escalation, as the issue run raises them). Start no further issue. A precondition it
   refuses is not a stop: step 2 skips that issue and the run goes on. An issue whose story gate ends at a `manual`
   next step has ended, not stopped: go on with the next runnable issue, and the issues it blocks wait until a
   person moves it. In a project run, the stop's `# Run status` comment names the project in its *Next human
   action*: "Then invoke <`run`, as `HARNESS.md`'s **commands** spells it> on project <project id> again", in place
   of the story ref, so the human who answers it goes on with the project, not only that issue.
5. **Say so in the session**: per issue, where it ended (its new step or status) or why it stopped (its `# Run
   status` comment's `cN` and the escalation id), every issue it skipped and why (the precondition that refused it,
   or the blockers not done), and the issues not started, in the order they would have run.

**Bounds.** The per-story budget (*Per-story budget* in `.sdlc/CONFIG.md`) applies to each issue as it does to an
issue run on its own. **There is no project-level budget**, and the project run writes nothing of its own to Leeway:
the records, the status comments and the escalations are its issue runs'. **Re-invoking it is the human's**: once the
stopped issue's escalation is answered, `run` on the project again goes on from there. A project run has no
unattended mode of its own: an issue whose type does not say unattended is refused by its precondition 1, and the
project run skips it and goes on. A skipped issue costs nothing: it runs no round and spends none of any budget.

## Done when

**On an issue:** either every task of the story has landed, the story gate has run and the story has moved to the step after `build`
(or to `done`) with a `# Run status — … · finished` comment, or the run stopped and the story carries one `# Run
status` comment naming the condition, what landed and the exact next human action, with one escalation, and every
worktree and branch where the run left it.

**On a project:** every issue other than the Plan record is `done`, `cancelled`, waiting at a `manual` step or on a
blocker, or skipped because its issue run refused it, or the run stopped at the first issue that stopped, and the
session says which, where each issue ended, what it skipped and why, and what was not started.
