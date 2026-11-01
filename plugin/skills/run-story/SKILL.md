---
name: run-story
description: Run every task of one story through run-task, unattended - check the plan gate, set the story to its build step, order its tasks by their blocking relations, run each end to end, and end at the story gate. A human is involved only when one of ten hard stop conditions fires, and then through one status comment and one escalation. Runs only for a type whose build step says unattended. Use when a story's plan gate has passed and its tasks are ready to build. Invoking this opts the session into the delegated-work contract.
---

# Run a story

**Read `PROCESS.md` and `HARNESS.md` in this plugin first, then `skills/run-task/SKILL.md`.** This skill runs `run-task` once per task
and adds only what a whole story needs on top: the preconditions, the order, the stop conditions, the budget and the
status comment. **It does not restate `run-task`.** Where a step below names a section of `run-task`, that section is
the procedure, word for word, and nothing here relaxes it. Read the binding and the wiring as `run-task` does:
`.sdlc/leeway.md` and `.sdlc/CONFIG.md`. `leeway` means `<cli> --server <server>`, and every write carries
`--as <alias>/<role>`: your own words are `<alias>/agent`.

You are the orchestrator for the whole story. **One invocation, one story.** It ends in one of two places:

- **the end**: every task has landed, the story gate has run and the story has moved to the step after `build`, or
  to done;
- **a stop**: a hard stop condition fired, one `# Run status` comment and one escalation are on the story, and
  nothing more happens until a human acts.

There is no third ending. A run that drifts off without either has left the next human to work out what happened
from the branches.

| `run-task` owns | `run-story` owns |
|---|---|
| the worktrees, the rung, round 0 and the freeze, every round, the verification gate, the round records, landing a task, the story gate | the preconditions, the story's build step, the task order, the stop conditions, the budget, the status comment, the friction harvest |

## 0. Preconditions: all of them, or do not start

A refusal here writes nothing: say in the session which precondition failed and stop.

1. **The type is unattended.** `leeway --json issue get <story>` gives `issue.type`; `leeway --json process get
   <KEY>` gives that type's `build` step. **No `build` step, or `params.unattended` not true → say so and stop.**
   Such a story is run one task at a time with `run-task`, where a person is in the session. The process is what
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

## 1. Story start

1. **Set the story to its build step**, after reading its state: `leeway --as <alias>/agent issue update <story> --step
   build`. Write nothing if `issue.step.id` is already `build`; a continuation run finds it there, and a second write
   is a second mover in the history.
2. **Create or reuse the story worktree** per `run-task`, "0. Locate, read the process, set up": cut from the branch
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

## 2. The task order

Read the story's children (`subIssues`, then `issue get` on each) and order them:

1. **Skip every task `done` or `cancelled`.** That is how a continuation run picks up where the last stopped.
2. **Never run the nit collector.** It is an issue of the project, a container for comments, not work.
3. **Order by the blocking relation** (`blockedBy`): every blocker before what it blocks.
4. **Break ties by plan order**: the order of the breakdown in the design doc, else the sub-issues' `position`.
5. **Refuse a task whose blockers are not done**, including a blocker outside this story. Skip it and take the next
   runnable one. If tasks remain and none is runnable, stop: the remaining work is blocked, and that is the human's
   to unblock. Post a `# Run status` comment and raise one escalation on the story naming the blockers (section 5). A cycle
   in the relation is a planning bug: stop the same way.

**Re-read the children before each task.** A human may have closed, added or re-linked one while the last task ran,
and Leeway, not this session's memory, says what is left. **One task at a time:** `run-task` allows two concurrent
tasks that share no file; that trade is a person's to take in a `run-task` session, never this skill's.

## 3. Each task: run-task, end to end

For the next task, run `run-task` from "0. Locate, read the process, set up" through "Land the task": the task
worktree, round 0 where the rung calls for it, every round, the verification gate, the records, landing. Then check
the stop conditions, then take the next task. **Skip the per-task friction step of "Land the task"**: this skill
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

Where `run-task` asks a person for something (a debt proposal, a spec amendment, a cap), there is no one in the
session. That is what the stop conditions are.

## 4. Hard stop conditions

**Only a human overrides these. The agent never does**, not with a reason, not once. A human overrides one by
answering the escalation; a later run reads it there (precondition 5). Each stop ends in **one escalation**: where
`run-task` already raises one, that is the stop's, and `run-story` adds none (a second would be two questions for one
stop); otherwise `run-story` raises it on the story.

| # | Condition | Detected | The stop's one escalation |
|---|---|---|---|
| 1 | **The round cap is hit** on any task: the verdict is FAIL and the code rounds (iterations on the sub-issue minus the round-0 attempts) are at `roundCap` | `run-task`, "The caps" | `run-task`'s, on the sub-issue |
| 2 | **The round-0 cap is hit**: the attempts are at `round0Cap` and the last is a FAIL | `run-task`, "Round 0" | `run-task`'s, on the sub-issue |
| 3 | **A verdict carries a `security` follow-up** | `run-task`, "What a deferred finding becomes" | `run-story`'s, on the story |
| 4 | **A `debt` follow-up needs a human yes** | the same | `run-task`'s debt proposal, on the sub-issue |
| 5 | **A second verification-gate hallucination on the same task** | `run-task`, "The verification gate" | `run-story`'s, on the story |
| 6 | **A lane green at baseline is red on the story branch**, after a task lands or at the story gate | after each task | `run-story`'s, on the story |
| 7 | **A merge conflict with the base that is not mechanical**: any conflict in a file a person wrote | `run-task`, "The story gate" | `run-story`'s, on the story |
| 8 | **A frozen test needs a spec amendment**; the owner is the product owner for an `AC-n`, the developer for a `TC-n` | `run-task`, "The freeze" | `run-task`'s, on the sub-issue |
| 9 | **The per-story budget is exceeded**: tokens, rounds or wall-clock, whichever first | at every round boundary | `run-story`'s, on the story |
| 10 | **Leeway is unreachable**: a call fails, or an empty result where something must exist (an expired sign-in is the usual cause) | any call | none can be raised: see the note |

**And every place `run-task` itself says stop**: a stalled round, a BLOCKED brief, a dispute or finding the reviewer
sends to a human, a pointer to technical criteria with no such comment, a migration recipe the doc map does not
name. They are stops here too, and each already raises its own escalation.

Notes on the ones that need them:

- **3 and 4: finish landing the task first.** A follow-up is by definition not this task's diff, and the task lands on
  the story branch, which reaches nobody until the story gate. So a PASS is landed through `run-task`, "Land the task",
  and then the run stops. A `security` follow-up is filed first, as `run-task` says, with no delay; the stop is so a
  person decides whether the story should go on being built on top of it (options "Continue the story" and "Hold the
  story"). A `debt` follow-up is filed by nobody: the proposal is the escalation, and the person answers it.
- **5 replaces `run-task`'s fallback.** `run-task` does a twice-hallucinated round inline and tells the user the
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

## 5. On a stop

Do these, in this order, and nothing else:

1. **Leave the write in flight complete and the next one unstarted.** A round with a brief has its verdict recorded;
   a task being landed is landed or, if landing is what failed, stays as it is. Never start the next task, the next
   round or the story gate.
2. **Leave every worktree and branch intact.** The story worktree, the task worktree and the task branch. The human
   resumes from them; a cleaned-up stop is a stop with its evidence removed.
3. **Move no story or task status.** The stop is recorded by the comment and the escalation, not by a `--step` or
   `--status`. (A BLOCKED brief or `run-task`'s own stops have set what `run-task` sets; that is `run-task`'s.)
4. **Post one `# Run status` comment on the story**, one per stop, however many conditions fired; each goes in it.
   Write the body to a file by absolute path in the session scratch directory or pass it as a quoted heredoc:
   `leeway --as <alias>/agent --json comment add <story> --stdin body <status.md`.

   ```markdown
   # Run status — <story ref> · stopped: <condition, by its name in section 4>

   - **Landed:** <task ref> <title>, commit <sha>; one per line, or "nothing yet".
   - **Stopped on:** <task ref> <title>: what fired and why, in one or two sentences, and the `cN` or escalation id that shows it.
   - **Not started:** <task refs, in the order they would have run>.
   - **Next human action:** <one action, imperative, saying where the answer goes>. Then run run-story on <story ref> again.
   - **Left in place:** <story worktree path>, <task worktree path>, <branch names>.
   - **Spend:** <rounds> of <budget> rounds · <tokens> of <budget> subagent tokens · <elapsed> of <budget> wall-clock.
   - **Friction so far:** <one line each, with task and round, harvested per section 6>; or "none".
   ```

5. **Raise the stop's one escalation** (section 4's last column). One `run-story` raises is on the story, as
   `<alias>/agent`, tied to the status comment (`--comment cN`, its `comment.number`), with the human's real
   choices as options (2 to 5, each with its argument) and `--meanwhile` saying what stays blocked and what does not.
   Where `run-task` raised it, add its id to the status comment, not a second escalation.
6. **Tell the user the same thing** in the session, with the comment's `cN` and the escalation id, and stop the turn.

**The next human action is one action, and it is exact.** "Answer the escalation e2 on DRY-2.1, then run run-story on
DRY-2 again", not "review the findings". A stop whose next step the human has to work out costs them the
investigation the run already did. For a `debt` stop the proposals follow the template, one line each.

## 6. The end

When the last task lands, `run-task` hands on to "The story gate", and `run-story` runs it unchanged, except that its
failures are stops here: a red gate is condition 6, a conflict condition 7, a missing migration recipe one of
`run-task`'s own. The gate ends with the story set to the step after `build` or to `done`; a `manual` next step is
where the run ends ("verify on dev"), with the story waiting for a person.

The end posts one `# Run status — <story ref> · finished` comment on the story, with *Landed* (every task), the
story's new step or status, the *Spend* line and the friction proposal, so the next reader and a continuation run
have the spend. No escalation, except the friction proposal below.

### The friction harvest

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

## Unattended prerequisites

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

## Parallel stories

**Allowed only in separate story worktrees with separate scratch databases, one orchestrator session per story.**
Never two sessions on one story, and never two stories in one session. **One writer to git means one writer per
worktree:** two orchestrators in one worktree are two writers to one index, and the verification gate then passes or
fails on someone else's work. The two stories still agree any migration number or other monotonic counter before
either generates one.

## What is lost

The human sees the story at the end, not per task. The round records are all there, but nobody reads them as they
happen, so a task that passed review on a misread criterion is found at the story gate, after later tasks were built
on top of it; the plan gate and the round-0 freeze make that rare, not impossible. A `debt` follow-up stops the run
rather than waiting in a queue, so a debt-heavy codebase stops often; the alternative is filing tickets nobody
approved. The budget is checked at round boundaries, so one long round can overshoot it, and a token count the
harness does not report is not enforced at all. And dropping each task's subagent context means a pattern noticed in
task 2 reaches task 5 only if a round record wrote it down.

## Done when

Either every task of the story has landed, the story gate has run and the story has moved to the step after `build`
(or to `done`) with a `# Run status — … · finished` comment, or the run stopped and the story carries one `# Run
status` comment naming the condition, what landed and the exact next human action, with one escalation, and every
worktree and branch where the run left it.
