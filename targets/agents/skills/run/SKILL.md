---
name: run
description: Run a Leeway ref through the implement-review loop, driven by the build step of its type. A sub-issue - red tests first when the process asks, then rounds of implementer and reviewer until PASS or the round cap, each round committed, pushed and recorded as an iteration, a brief, anchored findings and a verdict, then squash-merged into its parent issue's worktree. An issue - unattended, every sub-issue in the order of its blocking relations, ending at the issue's merge gate; a human is involved only when one of ten hard stops fires, through one status comment and its escalations. A project - its issues as issue runs in that order, stopping at the first that stops. Refuses a type with no build step, the Plan record, a done or cancelled ref and another product's ref. Use when a sub-issue is ready to build, an issue's plan gate has passed, or a project's issues are. A question for the human becomes a Leeway escalation, never a terminal question. Invoking this opts the session into the delegated-work contract.
---

> **leeway-sdlc for agents other than Claude Code.** This plugin's files (`PROCESS.md`, `HARNESS.md`, `craft/`,
> `agents/`, `hooks/`, `scripts/` and the skills' own files) are in **`.sdlc/kit/`** at the repo root once `sdlc-install` has
> run: "in this plugin" below means there, except that `skills/<name>/SKILL.md` is the `<name>` skill itself
> (load it as a skill; its other files are in `.sdlc/kit/skills/<name>/`). Read `.sdlc/kit/HARNESS.md` for how this agent delegates, marks a
> subagent's run and updates. With no `.sdlc/kit/` yet, run `sdlc-install` first; it reads them from its own `kit/`.

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

**Every call is printed verb first**, with `--as` and `--json` after the verb:
`leeway spend record <ref> 3 --as <alias>/agent --json`. The CLI takes those flags on either side, but a permission
rule matches the text before its first `*` as written, so this is the only order the allow-list ("Unattended
prerequisites") matches. Write each call as it is printed here, `--server` included.

## What the ref is

`run` takes one ref and runs it by what it is. Find out first, and write nothing until you have:

1. **A ref of another product is refused.** An issue ref is `<KEY>-<n>` or `<KEY>-<n>.<m>`; one whose key is not
   `product:` in `.sdlc/leeway.md` belongs to another product. Say which product the binding names, and stop.
2. **Read it.** An issue ref: `leeway issue get <ref> --json`. Anything else is taken as a project id: `leeway project get <KEY> <project> --json`. `not_found` from either means it is not an issue or a project of this
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
an adjective and a bird, lowercase and hyphenated (`quiet-wren`; it must match `^[a-z][a-z0-9-]{1,23}$`), picked as
`PROCESS.md`, "The cast", says: at random from its lists, and not in the project's `activeAgents` (`leeway project get <KEY> <project.id> --json`) or the issue's `agents`, adding `-2`, `-3` when the pair is taken. Roles are `implementer`, `reviewer`, `planner` and `agent`. Your own words (a status, a stalled
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

**Where `run`'s own files go.** A brief, a finding, a verdict, a status comment, a commit message or a pull request body goes
in `.worktrees/.run/` of the primary checkout, named after the ref and passed by absolute path. `.worktrees/` is ignored by
git, and it is inside the working directory, so a redirect from it (`--stdin body <file`) does not prompt, where one from the
system's temp directory does. Create the directory by writing the first file there with the `Write` tool: `mkdir` is not on the
allow-list, and `Write` makes the directories it needs. No branch can be called `.run`, so it never meets a worktree. A quoted heredoc also works
while the whole command stays short (Claude Code prompts for any command over 10,000 characters, which a brief can be).
Nothing cleans the directory, and it is safe to delete between runs.

**A question for the human is never a terminal question.** It is a Leeway escalation on the sub-issue in hand, and
then you wait for its answer ("Wait, then carry on"). Nowhere in this skill do you ask the user.

**The recommended option comes first on every escalation this skill raises**, its argument opening `Recommended:` and
saying why (`PROCESS.md`, "Questions to the human are escalations"). The options a path below names are the choices,
not their order. Where you truly have no pick, invent none: the first argument opens `No recommendation:` and says why.
An implementer's `## Question` and a reviewer's `Escalates:` block already carry theirs: raise them unedited, in the block's order.

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

## Wait, then carry on

**Every escalation this skill raises is followed by a wait, not by the end of the turn**, in a sub-issue, issue or
project run. Where a path below says to raise an escalation and wait, do this:

1. **Post what the path posts**, unchanged: the context comment, the escalation and, on an issue run's stop, the
   `# Run status` comment. Raise with `--json`: `escalation.escalation` in the answer (`e1`) is the `eN` you wait on.
2. **Say once in the session** what you wait on and until when: "Waiting for the answer to e2 on DRY-2.1, until
   <the time 16 hours from now>." Once, not per check.
3. **Wait on `wait-answer.mjs`**, by the command `HARNESS.md`, "Running the plugin's scripts", names (`<wait-answer>`
   below), started as `HARNESS.md`, "Waiting for an answer", says:

   ```sh
   <wait-answer> --server <server> <ref> <eN> -- <cli>
   ```

   `<ref>` is the issue the escalation is on, and `<server>` and `<cli>` are those of `.sdlc/leeway.md`. It only
   reads: it checks about a minute after it starts, then less and less often, never more than 15 minutes apart, and
   gives up after 16 hours. Do not poll the issue yourself, and do no other work of this run while it waits.
4. **Act on how it exits, as the table says**, with one exception: a wait on something that blocks nothing, such
   as a sub-issue run's debt proposal after its task is `done` ("Land the task", step 5), carries on instead of
   stopping when it ends without an answer (exit 2, 3 or 4).

   | Exit | It means | So |
   |---|---|---|
   | 0 | answered; `{"label","note","by"}` on stdout | carry on (step 5) |
   | 2 | no answer by the deadline | stop the turn: the escalation and any `# Run status` comment stay, and re-invoking `run` resumes (for a wait in "The plan's end", `run` on the project) |
   | 4 | the CLI asked for `leeway login` | a blocker outside Leeway: stop the turn, and name the action, `leeway login --server <server>`, after which re-invoking `run` resumes |
   | 3 | Leeway did not answer | stop the turn and say so, as stop 10 ("Hard stop conditions") does |
   | 1 | the call was wrong, or `<ref>` has no `eN` | a bug in this run: stop the turn and say so |
   | 5 | a question is waiting; `{"clarification","question","askedAt"}` on stdout | not an answer and not an end: answer it and wait again on the same escalation, as `PROCESS.md`, "Questions to the human are escalations", says. Carry on only on exit 0 |
   | any other | the wait never ran (126 or 127: the script is not executable, or not on the `PATH` because the plugin is disabled or the agent too old for it) | stop the turn and say so, naming the exit code |

5. **On an answer, carry on exactly as a re-invoke of `run` would.** Read the issue again (`leeway issue get <ref> --json`): `escalations[].answer` is the answer a re-invoke reads, and its `label` and `note` reach the work as that
   path's own resume says (the next prompt, the decision in the thread). Carry on from the first thing not done, as
   "Resuming a task" in step 0.7 does; in an issue run, from where "On a stop" left it.
   - **Nothing is written twice.** The stop's escalations, their context comments, its `# Run status` comment, the
     round's iteration and brief are already in Leeway: no second escalation, comment or iteration for the stop you
     waited on.
   - **An answer that ends the work** (for example "Cancel it") is followed: stop there and say so. Say too that any
     other escalation of the round stays open, because nothing can withdraw it, and must be answered before a re-invoke.
   - **An answer that needs a person to act first** is put to them as a new escalation, saying what to do and to
     answer it once done, and waited on the same way. Stop and name the action only when it is outside Leeway, such
     as a login on the machine.
6. **Only the answer is an answer.** A comment, a status change, an edited description or another escalation's
   answer is not, and a run never proceeds on an unanswered escalation.

A later escalation in the same run waits the same way, with a deadline of its own: each wait starts its 16 hours
fresh.

**Check the round before raising more than one** (`PROCESS.md`, "Questions to the human are escalations"): where one answer would settle or change
another question, merge them into one, or hold the dependent one for the next round. Independent ones are raised
together, not rationed behind a wait, and waited on one after another. **Work held on a round carries on only when every escalation of the round is
answered, with all the answers reaching it**: one answer of two is not yet step 5's answer, except one that ends the
work, which is followed at once. A later round drops what an answer settled.

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
   leeway issue get <ref> --json
   leeway issue get <story> --json
   leeway process get <KEY> --json
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
   leeway issue update <ref> --as <alias>/agent --branch <branch>
   leeway issue get <ref> --json   # use issue.branch verbatim from here on
   ```

   A refusal of `repository_required` or `invalid_repository` means the story has no repository, or one that is not
   connected: stop and say so.

6. **Worktrees: mandatory, and yours alone.** Never work in the primary checkout. A human works there, and a
   subagent's staged files would mix with theirs.

   | Worktree | Path | Cut from | Created | Removed |
   |---|---|---|---|---|
   | story | `.worktrees/<story branch>` | the branch the story's `issue.base` names (the plan branch or the integration branch in `.sdlc/CONFIG.md`) | once, when the story's first task starts | at the story gate |
   | task | `.worktrees/<task branch>` | the story branch | when the task starts | when the task is done |

   **A plan branch that does not exist yet** (a plan planned before `plan-project` cut it, or in a repository it had
   no checkout of) is yours to cut, from the integration branch, fetched fresh, and push. Link it on the project when
   you cut it, as `plan-project` does (its step 5.8, "The plan branch: cut it, and link it on the project when you
   cut it"), leaving a repository linked with another branch as it is (name it in the ending), and read it back
   under `project.links`:

   ```sh
   git -C <primary> fetch origin <integration branch>
   git -C <primary> worktree add -b <plan branch> <primary>/.worktrees/<plan branch> origin/<integration branch>
   git -C <primary>/.worktrees/<plan branch> push -u origin <plan branch>
   git -C <primary> worktree remove <primary>/.worktrees/<plan branch>
   leeway project link <KEY> <project> --as <alias>/agent --branch <plan branch> --repository <owner/repo>
   leeway project get <KEY> <project> --json   # project.links: per repository, the branch, and pr null
   ```

   The story and task worktrees are made the same way, `<primary>` being the primary checkout's absolute path:

   ```sh
   git -C <primary> fetch origin <base>
   git -C <primary> worktree add -b <story branch> <story worktree> origin/<base>
   git -C <primary> worktree add -b <task branch> <task worktree> <story branch>
   ```

   A branch that already exists, on a resume, is added without `-b`.

   `.worktrees/` must be ignored by git; check once per repo, by reading `.gitignore`. Run every git command of your own as `git -C
   <absolute path>`, and **pass the absolute task-worktree path in every subagent prompt**: a subagent starts in
   the primary checkout, so a relative path lands where every concurrent session reads and writes the same
   files. If `.sdlc/CONFIG.md` names a per-worktree setup command, run it in each new worktree, as `cd <worktree> && <setup command>`: a worktree isolates
   files, not databases or ports. The merge and plan-cut worktrees take no setup, and a repo whose hooks need one there must say so
   under *Per-worktree setup* in `.sdlc/CONFIG.md`. **Two concurrent stories must agree a migration number, or any other monotonic
   counter, before either generates one.**

7. **Start.** Read the state first and write only what is not there yet (in an issue run most of it is).

   ```sh
   leeway issue update <story> --as <alias>/agent --step build     # skip when issue.step.id is already build
   leeway issue update <ref> --as <alias>/agent --step red-tests   # or --step implementing, per step 4
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
leeway issue get <ref> --json | node -e 'const j=JSON.parse(require("fs").readFileSync(0));const e=j.thread.find(t=>t.kind==="step"&&t.data.to==="implementing");const r0=j.iterations.filter(i=>!e||i.createdAt<e.at).length;console.log("iterations",j.iterations.length,"round 0 attempts",r0,"code rounds",j.iterations.length-r0)'
```

The caps: `round0Cap` bounds the round-0 attempts and `roundCap` the code rounds, so a round-0 attempt never spends
the code rounds. Separately, the server refuses a 51st iteration on one issue (`iteration_limit`): a task that
reaches it is mis-specified whatever its caps say, and is escalated like any cap.

#### Recording spend

**Every round records what it cost on its iteration, and the run's own time goes on the story.** Leeway sums them:
`totals` in `leeway issue get <ref> --json`, a story's over its own records and its sub-issues'. Nothing reads a total
back from prose.

- **Time is measured, never estimated.** Take `node -e 'console.log(Date.now())'` when a span starts and again when
  it ends; its minutes are the difference in whole minutes, rounded to the nearest
  (`$(( (end - start + 30000) / 60000 ))`). **A wait ends a span**: record what came before it, and start a new span
  once the answer arrives. Time waiting on a person is never in a
  record; Leeway counts it from the escalations. A round whose start this session did not see (resumed from an
  earlier session) has no minutes: its iteration leaves `--minutes` and `--testMinutes` out, and Leeway marks the
  total incomplete (`minutesIncomplete`).
- **A token is a new token: `input_tokens + cache_creation_input_tokens + output_tokens`, summed over every model
  call of the agent in the span; `cache_read_input_tokens` is never counted.** It is the same unit for a subagent and
  for you. A harness's own count for a subagent is not it: Claude Code's `subagent_tokens` is the agent's final context
  size, not a sum, and no record carries it.
- **`session-tokens.mjs` counts them**, by the command `HARNESS.md`, "Running the plugin's scripts", names
  (`<session-tokens>` below), one call per span, as `HARNESS.md`, "Counting tokens", says. It only reads, and prints one whole number:

  ```sh
  <session-tokens> --subagent <its transcript>
  <session-tokens> --session <your transcript> --from <start> --to <end>
  ```

  `<start>` and `<end>` are the span's two stamps, in milliseconds. Count a subagent once it has returned, and a span
  of yours in a tool call after the one that stamped its end, never in that call: the running call is not yet in the
  transcript. A call belongs to the span holding its first line, so two spans that only share a stamp count it once.
- **What cannot be counted is left out: never `--tokens 0` in its place, never an estimate.** That is every record in
  a harness whose "Counting tokens" says it cannot, a span whose start or subagent this session did not see, and any
  exit of the script but 0: then it prints no number. Leeway marks the total incomplete (`tokensIncomplete`), and
  every readout of it says so: the token total is a floor, and the run carries on (stop 9). A 0 the script prints
  means it found no model call, and it says so on stderr. Pass it only if that is true, as for a subagent that ended
  before its first call; a span in which you made calls has the wrong window or file, so leave `--tokens` out.
- **Spans of yours that overlap leave `--tokens` out, on both.** When two concurrent tasks make a span of yours (a
  round's orchestration, landing a task) overlap another that is counted from your transcript, every call in the
  overlap would be on both, so neither carries a count: never split, never estimated, and `tokensIncomplete` is then
  true, because those calls were not attributed. A subagent's count is unaffected, because its transcript is counted
  whole and belongs to one agent, and an issue run never hits this, because it never runs tasks concurrently.
- **The round**, on its iteration ("Gate, commit, push, record", step 4): `--minutes` from delegating to the
  implementer to the iteration record; `--tokens` the implementer's, from its transcript; `--testMinutes` the brief's *Test minutes*, left
  out when it says `unknown` and never more than `--minutes` (pass the smaller); `--note` what the round did, in a
  few words ("round 0: 4 red tests", "addresses c6, c7").
- **Its review**, on the same sub-issue once the verdict is posted, because a recorded iteration is never edited:
  `leeway spend record <ref> <minutes> --as <alias>/reviewer --json [--tokens <N>] --note "review of it.N"`, the
  minutes from delegating to the reviewer to the verdict posted, `--tokens` the reviewer's, from its transcript.
- **A round's orchestration**, the tokens you spent on it, on the same sub-issue after that record: `leeway spend record <ref> 0 --as <alias>/agent --json [--tokens <N>] --note "orchestrating it.N"`, `--tokens` from your
  transcript, from delegating to the implementer to the verdict posted. Its minutes are 0 because that time is
  already in the round's and the review's.
- **A round that records no iteration** (a stalled round, a BLOCKED brief with nothing staged) still cost what it
  cost: `leeway spend record <ref> <minutes> --as <alias>/agent --json [--tokens <N>] --note "<stalled round |
  BLOCKED, nothing staged>"`, before its escalation, `--tokens` the implementer's, from its transcript. Its
  orchestration follows it as above, its span ending at that record.
- **The run's own time**, on the story: `leeway spend record <story> <minutes> --as <alias>/agent --json [--tokens
  <N>] --note "<what>"`, `--tokens` from your transcript over the span, one record per span: the baseline ("Story start", step 3), landing each task (from "Land the
  task", step 1, through the lanes run after it lands), and the story gate (from its step 1 to the story read back at
  its step 5, adding the count from the transcript of a reviewer pass at its step 3, and leaving `--tokens` out if
  either cannot be counted). The moments between spans, posting records and
  reading Leeway, are not recorded.

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
  "Clarify the criterion", "Split the story" and "Allow one more attempt", each with its argument. Then wait on it
  ("Wait, then carry on").

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
  escalation on the sub-issue, and you wait on it ("Wait, then carry on"); their decision goes into the thread before
  the implementer may touch the test, and the reviewer prompt then carries it. A changed `AC-n` is the product
  owner's through `shape-project`, a changed `TC-n` the developer's through `plan-project`. **The implementer never
  weakens or deletes an assertion to reach green.**
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

  > You may **read** Leeway through the CLI, with no actor and no `--as`: `<cli> --server <server> issue
  > get <ref> --json`, `... review get <ref> --json`, `... escalation list <KEY> --json`, verb first and with the server as
  > printed here. Run git as `git -C <the worktree's absolute path>`, with at least one argument after the verb, never `cd <path> && git`, which prompts. Run a lane as `cd <worktree> && <lane>`. Read the story, the siblings and earlier rounds
  > when the code points at them. You **never write** to Leeway: no `issue create` or `update`, no `comment add`,
  > `iteration record`, `escalation raise` or `answer`, `dependency`, `pr link`, `project` or `process` write, no
  > `login`. A hook (`leeway-guard`) denies the write verbs for you, but the rule is yours to keep without it. You
  > hold no token of your own: do not look for one, print it, copy it or pass it on. The orchestrator is the only
  > writer. You do not commit or push; you `git -C <worktree> add`. Your brief's `Head sha` stays `pending`: the orchestrator
  > commits your staged work and writes the sha.
  >
  > **You never ask the user a question in the terminal.** If a decision is the human's, stop implementing the part
  > that depends on it and return `Status: BLOCKED` with a `## Question` section: the question (one sentence), 2 to
  > 5 options each with its argument, the recommended one first (or `No recommendation:` and why), and the meanwhile.

> **Embed critical inputs; do not reference them.** A prompt carrying its own content survives a failed tool call;
> an agent whose first call fails silently fabricates everything downstream. Reading Leeway is how a subagent
> follows a reference it *finds*, not how it receives its instructions.

> **Verify every specific factual claim before putting it in the prompt.** A helper, a schema detail, a path. Open
> it and confirm. The implementer trusts the brief over the codebase, so a wrong claim gets written into a permanent
> code comment. If you cannot verify it, write "verify this yourself".

### 2. Gate, commit, push, record

**Run the verification gate before anything reaches Leeway.** The brief must have arrived as the agent's final
message and carry a `## Verification` section with verbatim `git -C <task worktree> status --short` and `git -C <task worktree> diff --cached --stat`.
**Then run both yourself, in the task worktree (`git -C <task worktree> status --short`, `git -C <task worktree> diff --cached --stat`), and compare.** That comparison is what catches a round that never
happened. Where `.sdlc/CONFIG.md` has *Required reading* rows owed by the staged paths, also check that the brief's
*Rules read* section names each owed file; a missing one sends the brief back.

If the brief is `Status: BLOCKED`, go to "A BLOCKED brief" instead of the rest of this section. Otherwise, in order;
a step that fails stops the round.

1. **Commit the round on the task branch**, one commit per round, squashed away on PASS. The message follows the
   repo's floor ("Branches and commits"): a subject that says what changed and why, a body explaining the cause when
   it is a fix, and the `Co-Authored-By:` trailer your session's attribution names.

   ```sh
   git -C <task worktree> commit -F <message file>
   git -C <task worktree> rev-parse HEAD     # the round's sha
   ```

2. **Stalled-round check.** Read `iterations[].sha` (`leeway issue get <ref> --json`). The round is **stalled** if
   there was nothing staged to commit, or if `rev-parse HEAD` equals the `sha` of any recorded iteration (the server
   refuses every repeat: `sha_repeated`). A stalled round **records no iteration** (its spend still goes on the
   sub-issue, "Recording spend"), leaves the sub-issue where it is, raises an escalation on it and waits. It is
   never counted and never retried silently, and you do not force a commit to get past it:

   ```sh
   leeway escalation raise <ref> --as <alias>/agent --question "Round N produced no new commit on <branch>: how should it go on?" --options '[{"label":"Re-run the implementer","argument":"The prompt was at fault; a sharper one may produce the change."},{"label":"Take it inline","argument":"The task is smaller than a round; the orchestrator does it and says the workflow degraded."},{"label":"Re-scope or cancel","argument":"The task is already satisfied or mis-specified; no more rounds buy anything."}]' --meanwhile "The sub-issue keeps its status and nothing is merged."
   ```

   This order is not a pick: put first the option this round's evidence recommends, and open its argument `Recommended:`, or `No recommendation:` and why where the evidence does not choose.

   Then report the escalation id and the issue, and wait on it ("Wait, then carry on").

3. **Push the task branch**, then confirm the remote has the sha you will record:

   ```sh
   git -C <task worktree> push -u origin <branch>
   git -C <task worktree> ls-remote origin refs/heads/<branch>     # the first column equals the sha
   ```

4. **Record the iteration**, as the implementer. `--tests` is the brief's lane line (at most 200 characters);
   `--passed` is present only when the brief says `Passed: yes` (for `no` or `n/a` omit it; a failed lane is already
   in the text as `FAILED: …`); `--addresses` is the brief's `Addresses:` as a JSON list, omitted when `none`; the
   round's spend is as "Recording spend" says, `--tokens` left out when it cannot be counted, never `0`:

   ```sh
   leeway iteration record <ref> <sha> --as <alias>/implementer --json --tests "<lane line>" [--passed] [--addresses '["c1","c3"]'] [--tokens <N>] [--minutes <N>] [--testMinutes <N>] --note "<note>"
   ```

   `iteration.number` is `N`, this round's `it.N`. **No push, no iteration.**

5. **Post the brief**, as the implementer, whole: replace its `Head sha: pending` with the sha, and post it from a file
   ("Where `run`'s own files go"):

   ```sh
   leeway comment add <ref> --as <alias>/implementer --json --stdin body <brief.md
   ```

   `comment.number` is the brief's `cN`. A comment body is at most 20,000 characters: a longer brief goes in whole
   across the comment and a reply (the rest as `comment add <ref> --parent cN --stdin body`), never cut.

6. **Hand over to review.** In a code round: `leeway issue update <ref> --as <alias>/agent --status in_review`
   (the step clears with it, see "How the CLI clears a step"). Round 0 is the same: `--status in_review`, then
   the reviewer.

**One iteration and one brief per round; the verdict answers that same round, joined by `--iteration N`; the next
round opens a new one. Rounds never interleave.** The brief opens `# Handoff brief — <ref> · round <N>` with `N`
the iteration number, and the verdict is not a reply to the brief (the server refuses review flags on a reply,
`invalid_parent`).

#### A BLOCKED brief

An implementer that returns `Status: BLOCKED` has stopped on a decision for the human. After the gate:

1. If it staged work, commit, push and record the iteration as above; if it staged nothing, do not (no iteration):
   record its spend on the sub-issue instead, now, before the escalation at step 3 ("Recording spend").
2. Post the brief as a comment (step 5), so there is a `cN` to point at. With nothing committed write its `Head sha`
   line as `none (BLOCKED, nothing committed)`.
3. Raise its `## Question` block **unedited**, as the implementer, tied to the brief:
   `leeway escalation raise <ref> --as <alias>/implementer --question "…" --options '[…]' --meanwhile "…" --comment cN`.
   A brief with a second block raises it in the same round: a comment holds one open escalation, so post that block
   as a comment of its own and tie its escalation to that.
4. Set the sub-issue blocked: `leeway issue update <ref> --as <alias>/agent --status blocked` (the step clears).
5. **Wait.** Report each escalation id and the issue, and wait on it ("Wait, then carry on"), on each in turn when
   there are two. Do not delegate to the
   reviewer.

On resume, whether the wait answered or `run` was invoked again, read each escalation the brief raised (`escalations[].answer`). One still
open and no answer ended the work: wait on it, and start no round. All answered: set the
step back to the stage the thread shows (`--step red-tests` or `--step implementing`), and run the next round with
all the answers pasted into the prompt.

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
  names the sha. The round's diff is `git -C <task worktree> diff <base>..<sha>`, where `<base>` is the previous iteration's sha or,
  for the first, `git -C <task worktree> merge-base <story branch> <sha>`.
- **The anchor rule.** A finding anchors to **new-side lines of the file as it is at `<sha>`** (lines of the file,
  not diff positions), at most 40 lines (`end - start < 40`), written `it.N · path:start-end`. A finding with no line
  to point at gets `—` and is still posted.
- **The earlier findings still live**, as `cN` with their text: from `leeway issue get <ref> --json`, the entries of
  `comments` (top level) with `kind` `comment`, `by.actor.role` `reviewer` and `fate` `open` or `addressed`. The
  `kind` and `role` filters matter: every top-level comment starts `open`, so the briefs and the verdicts would
  otherwise match (`review get <ref>` shows verdicts as `open` for ever). Do not filter on `anchor`. It decides, for
  each, `Settles` or `Disputes`, and names only these.
- **How it reaches Leeway**: the implementer's read-only paragraph minus its git and brief sentences, and that it
  never asks the user: a decision for the human goes in the verdict's `Escalates:` block.

### 4. Gate again, record, act

Gate the reviewer the same way: the verdict arrived as its final message, its test output is verbatim, and the tree
still matches what you saw (`git -C <task worktree> status --short` empty and `git -C <task worktree> rev-parse HEAD` still the recorded sha: the reviewer may
break a test to watch it fail and restores it; you check that it did). Check its *Rules read* against CONFIG's
*Required reading* as for the brief. Check that every `Disputes` entry has a finding citing it.

Then record the **full findings**, in this order, all as the reviewer. "Four MINORs, no majors" is not
sufficient: the verdict exists nowhere else.

1. **Each finding, one comment each**, from its body block in the verdict. Anchored:

   ```sh
   leeway comment add <ref> --as <alias>/reviewer --json --anchor '{"iteration":N,"path":"src/x.ts","start":12,"end":20}' --stdin body <finding.md
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
   leeway comment add <ref> --as <alias>/reviewer --json --kind review --iteration N --settles '["c1"]' --disputes '["c2"]' --raises '["c6","c7"]' --stdin body <verdict.md
   ```

   One review cannot settle and dispute the same finding, and a finding raised by one review cannot be raised by
   another (`fate_conflict`, `invalid_review`). The verdict opens `# Review verdict: PASS — <ref> · round <N>` or
   `# Review verdict: FAIL — <ref> · round <N>`.
3. **A dispute or a finding that needs a human** (`Escalates:` is not `none`) becomes an escalation on the
   sub-issue, as the reviewer, and you wait on it ("Wait, then carry on"):

   ```sh
   leeway escalation raise <ref> --as <alias>/reviewer --question "…" --options '[{"label":"…","argument":"…"},{"label":"…","argument":"…"}]' --meanwhile "…" [--comment cN]
   ```

   `--comment cN` ties it to the **finding it concerns** (the `Escalates:` block says which `F<n>`). It is never the
   verdict's `cN`: the server accepts only a top-level `kind=comment` there and answers `unknown_comment` for a
   review. A question about the round as a whole omits it. A verdict with more than one `Escalates:` block raises
   them all in this round; a second block on one finding gets a comment of its own, naming the finding, and its
   escalation is tied to that, since a comment holds one open escalation. Report each escalation id and the issue, wait
   on each in turn, and do not go to
   PASS or FAIL handling until every one is answered. Leave the sub-issue `in_review`, in round 0 too.

#### What a deferred finding becomes

A finding accepted at PASS but left unaddressed is **already recorded**, in full, in the round you just posted.
Filing decides whether a human has to look at it. Sort the verdict's *Proposed follow-ups* (they have no comment of
their own) by `PROCESS.md`, "Where a finding goes":

| The follow-up is | What you do |
|---|---|
| Security, isolation or data exposure, any severity; or a correctness bug reachable in production | **File its own issue now**, no approval: `leeway issue create <KEY> --as <alias>/agent --projectId <project.id> --title "…" --summary "<at most 280 characters>" --status backlog --stdin description <desc.md`, in the task's project |
| Technical debt: the fix is a design decision | **Ask, and file only on a yes**: an escalation on the sub-issue with options "File it" and "Keep it a nit", each with its argument, raised as `<alias>/agent`, `--meanwhile` saying, standalone, that the loop carries on because nothing in hand waits on it, and in an issue run that the run waits here for the answer (its stop 4). In a sub-issue run the loop does carry on: the task lands, and the run waits on the proposal ("Wait, then carry on") before it ends ("Land the task", step 5). On a yes, `issue create` as above, quoting the answer's `label` and `note`; on a no it stays a nit |
| Anything else | **One line, as a comment on the project's nit collector**, no issue: the collector is the ref in `.sdlc/leeway.md`'s *Nit collectors* table for `project.id`: `leeway comment add <collector> --as <alias>/agent --stdin body <nit.md` |

**Debt proposals from one verdict are one round**: raised together, with those one answer would settle merged into
one. They come after every `Escalates:` block of the verdict is answered, because that answer can change which findings stay
deferred.

**If you cannot name the consequence of leaving it, it is a nit.** A nit is a comment on the collector, never an
edit to its body.

#### Then

- **PASS** → "Land the task". You may override a PASS: if a finding is under-rated and you can say why, send it
  back and record the reason as a comment from `<alias>/agent`. The override spends a round. A PASS that carries a
  missing proof at a rung in `blockingRungs` contradicts itself: send it back.
- **FAIL** → set the step back: `leeway issue update <ref> --as <alias>/agent --step implementing` (it sets
  `in_progress`; after a round-0 FAIL it is `--step red-tests` instead, which sets `in_progress` too). Hand the **full
  verdict** and the `cN` of each live finding (including the new one a dispute brought) to the implementer, and
  repeat from "Delegate to the implementer". **Nothing is merged on a FAIL.** The next round's commit sits on the
  same task branch, on top of this one.

**The caps.** Count with the one-liner under "Counting rounds". A verdict of FAIL with the code rounds at `roundCap`
(or round-0 attempts at `round0Cap`, see Round 0) is a stop: leave the sub-issue as it is and raise an escalation
on it as `<alias>/agent` whose question names the outstanding findings (`cN`) and whose options are the human's real
choices (for example "Re-scope the task", "Allow one more round", "Cancel it"), each with its argument, and wait on
it ("Wait, then carry on"). **You may not override the cap.** Overriding a PASS and the cap together is the
pattern the cap exists to prevent.

**Spend rounds on the risk, not on the artifact.** A round that only polishes a fix that was already correct buys
nothing. Notice when you are spending one on it.

### Land the task

On a PASS of a code round.

1. **Check the freeze closed**: no `red-test-` skip marker remains in the frozen files.
2. **Squash-merge task → story**, in the story worktree, as one commit that follows the repo's commit convention
   (the round commits on the task branch are squashed away):

   ```sh
   git -C <story worktree> merge --squash <task branch>
   git -C <story worktree> commit -F <message file>
   ```

3. **Set the task done**, and read it back: `leeway issue update <ref> --as <alias>/agent --status done`, then
   `issue get <ref>` shows `done`.
4. **Remove the task worktree** and delete the local task branch: `git -C <primary> worktree remove <task worktree>`, then
   `git -C <primary> branch -d <task branch>`, which accepts a squashed branch because its pushed upstream holds it.
5. **Wait on each debt proposal, only when `run` was invoked on the sub-issue itself** (an issue run has already
   waited on it, as its stop 4). Step 6's friction proposal depends on no answer here, so where there is a wait to
   do, do step 6's collecting and raise its proposal first, in the same round, and do not raise it again at step 6.
   For each escalation "What a deferred finding becomes" raised for a `debt` follow-up
   of this task, wait on it ("Wait, then carry on"), one after another. On a yes, file the issue as that row says; on
   a no, the finding stays a nit. **A wait here that ends without an answer (exit 2, 3 or 4) does not end the run**:
   the proposal blocks nothing and the task is already `done`, so there is nothing a re-invoke could resume. Leave
   the escalation open, say once that the finding stays unfiled until someone answers it and files it, and go on to
   step 6.
6. **Friction, only when `run` was invoked on the sub-issue itself** (an issue run harvests the whole story once,
   at the end). Collect every *Friction* line from this task's briefs and verdicts, round 0 included; drop `none`; dedupe
   against each other and against the open issues of the friction project (`friction-project:` in
   `.sdlc/leeway.md`; `leeway issue list <KEY> <friction project> --json` is one page, and the dedupe reads its
   open issues only, not the `done` or `cancelled` ones). Propose what is left as **one escalation** on the
   sub-issue, as `<alias>/agent` (options "File them" and "File none", the lines in the question's context
   comment), `--meanwhile` saying nothing waits. Only on a yes, file each accepted line as its own issue, the line
   with its task and round as the description: `leeway issue create <KEY> --as <alias>/agent --projectId <friction
   project> --type chore --title "…" --summary "<at most 280 characters>" --status backlog --stdin description
   <desc.md`. `n/a` there: the proposal is still made, nothing is filed.
   **Legacy binding**, `friction-collector:` (a ref, or `n/a`) and no `friction-project:` (installed before
   0.3.0): dedupe against the comments on that issue and file each accepted line as a comment on it, as before;
   with `n/a` the proposal is still made and nothing is filed. Say once, in the escalation's context comment, that
   sync-repo migrates the line to a friction project.
7. **Was it the story's last task?** Every sub-issue of the story `done` or `cancelled` → "The story gate".
   Otherwise the story stays at `build`; nothing is written. The nit collector is an issue of the project, not a
   task: it never counts.

### The story gate

When the story's last task has landed, in the **story worktree**. The order is fixed: the story branch is merged into
its base (step 5) before the story's next step is written, so a `manual` next step never skips the merge.

1. **Merge the story's base into the story branch** (fetched fresh: `git -C <story worktree> fetch origin <base>`, then
   `git -C <story worktree> merge --no-edit origin/<base>`), and resolve conflicts **yourself**. A conflict
   in a file a human wrote that is not mechanical (a lockfile the package manager regenerates is) is a stop: abort the
   merge (`git -C <story worktree> merge --abort`) so the worktree is at the commit before it, escalate and wait ("Wait, then carry on"). Migrations or other
   ordered generated files are not merged textually: use the recipe the recipes doc in the doc map names, or escalate
   and wait if it names none.
2. Run the **gate command** from `.sdlc/CONFIG.md` (`cd <story worktree> && <gate command>`), plus any lane the story's changes touched that the gate does not
   cover.
3. Only if the tasks interact in a way no single task's tests cover (a shared migration, a changed contract) delegate
   one reviewer pass over the combined diff. Skip it when they are independent; this is a gate against integration
   risk, not a re-review.
4. **Durable evidence.** At or above the rung the repo's evidence doc names for committed proof (and, where it names
   none, the lowest rung in `blockingRungs`), commit the record under the evidence directory in `.sdlc/CONFIG.md`.
   The round records keep the working copy; the repo keeps the one that survives.
5. **Push the story branch and merge it, then close the story by the process.** Merge the story branch into its
   base before any next step is written, so a `manual` stop cannot skip the merge. When the base is a plan or story
   branch, push the base as the orchestrator:

   ```sh
   git -C <story worktree> push -u origin <story branch>
   git -C <primary> fetch origin <base>
   git -C <primary> worktree add --detach <primary>/.worktrees/merge-<story> origin/<base>
   git -C <primary>/.worktrees/merge-<story> merge-base --is-ancestor HEAD <story branch>
   git -C <primary>/.worktrees/merge-<story> merge --no-ff -F <message file> <story branch>
   git -C <primary>/.worktrees/merge-<story> push origin HEAD:<base>
   git -C <primary> worktree remove <primary>/.worktrees/merge-<story>
   git -C <primary> worktree remove <story worktree>
   ```

   The worktree is detached because the base may already be checked out, in the primary checkout where a person works or
   in another worktree, and `worktree add` refuses a branch that is ("is already used by worktree"). A detached one never
   meets that, and it leaves that checkout as it was: its local `<base>` stays behind `origin/<base>` until its owner pulls,
   and nothing here reads the local one.

   **The base may have moved since step 1, and what step 2 gated is the story with the base as it was then.** A non-zero
   exit from `merge-base --is-ancestor` means the base moved: remove this worktree and go back to step 1, before any merge,
   even one that would be clean, so nothing reaches the base ungated. The check reads the merge worktree's detached `HEAD`,
   which only this worktree changes, because worktrees share `origin/<base>` and a parallel session's fetch moves it. With
   that exit 0 the story already holds `HEAD`, so the merge cannot conflict. If the merge fails all the same, a hook refused it:
   `git -C <primary> worktree remove --force <primary>/.worktrees/merge-<story>`, stop and say what git printed.

   **If the merge push of `HEAD:<base>` fails,** whatever git printed, run `git -C <primary> fetch origin <base>` and
   `git -C <primary> merge-base --is-ancestor origin/<base> <story branch>`. Non-zero: the base moved, so remove this
   worktree and go back to step 1. Exit 0: it did not, so remove this worktree, stop and say what git printed.

   **If the push of the story branch fails,** stop and say what git printed: nothing has merged, and step 1 merges only the
   base, so going back to it would not help.

   If `worktree add` finds the path left by a stopped run, `git -C <primary> worktree remove --force
   <primary>/.worktrees/merge-<story>` and add it again.

   The integration branch is reached only as the repo's convention says (the pre-push guard in "Unattended prerequisites"
   enforces it): only the first and last of those lines run, and in between comes that convention, such as
   `gh pr create --base <integration branch> --head <story branch> --title "<story title>" --body-file <body.md>`.

   Then read the type's steps: the step after `build`.
   - **A next step** → `leeway issue update <story> --as <alias>/agent --step <next>`. If its kind is `manual`
     ("verify on dev"), say what it is waiting for and **stop**: the plugin never does a manual step and moves
     the story past it only when the person asks (`PROCESS.md`, "The cast").
   - **No next step** → `leeway issue update <story> --as <alias>/agent --status done`.

   Read the story back (`issue get <story>`) and check the step or status reads as written. Nothing else moves it.
6. **Afterwards: the plan's last story.** If the story went `done` and was the
   project's last open story (`leeway issue list <KEY> <project.id> --json`: everything else `done` or `cancelled`,
   the collector aside), the plan is **not done**: a plan is done once it has merged into `main` (the integration
   branch in `.sdlc/CONFIG.md`), and that waits for the person's word. Go on with "The plan's end", in the same
   session.

**A red gate is not a task FAIL.** The tasks passed; the assembled state did not. Open work for what broke and run
it through the loop. **A story with open findings is not a story with no findings:** check the deferred ones exist
where you filed them, and say in the status update which are still open.

### The plan's end

Reached from the story gate's step 6, and from a project run that finds nothing left while the Plan record is not
`done` ("Run a project", step 2, "Nothing left"). That second way in is how a plan's end is picked up again when a
wait below ended without an answer, the session ended before it, or the last story reached `done` outside the gate
(a person moved it past a `manual` step): `run` refuses a `done` story and the Plan record, so re-invoking `run` **on
the project** is the way back. Each step reads before it writes, so running it again writes only what is missing. By
you, as `<alias>/agent`:

- **With a plan branch**, in each repository the plan changes (its stories' `issue.repository.fullName`):
  1. **Set the collector `--status in_review`, never `done`**, unless it reads `in_review` already. It is an issue of
     the project, so it counts in the project's progress: in `backlog` it holds the project short, and `done` would
     read the plan as finished while its pull request is open. It goes first, so a wait below that ends without an
     answer leaves the Plan record reading `in_review`.
  2. **Open the draft pull request to `main`**, unless one from the plan branch is open or merged, and link it on the
     project when you open it (one not yet in `project.links` is linked the same way; a merged one goes on to "When
     the plan merges into `main`", step 2). Open it with
     `gh pr create --draft --base <integration branch> --head <plan branch> --title "<project name>" --body-file <body.md>`
     where `gh` is installed, with a body naming the project and its stories; without `--title` and a body, `gh`
     exits 1 in a shell with no terminal. Where `gh` is not installed, or `gh pr create` fails, the person opens it.
     Read the collector's escalations first (`leeway issue get <collector> --json`, `escalations[]`): wait on an open
     one that asks for it, and take the number from an answered one's note. Only with neither, raise an escalation on
     the nit collector asking them to open it as a draft (naming the `gh` error, if any) and to answer with its number
     in the note, and wait ("Wait, then carry on"). A wait that ends without an answer stops the turn, and re-invoking
     `run` on the project resumes here.

     ```sh
     leeway project link <KEY> <project> --as <alias>/agent --branch <plan branch> --repository <owner/repo> --number <PR>
     leeway project get <KEY> <project> --json   # project.links: the branch, and pr.number with pr.state open
     ```

     `github_unavailable` means try again; any other refusal (`pr_not_found`, `github_access_lost`,
     `github_not_configured`) leaves the pull request unlinked: name it in the ending.
  3. **Post the plan's status update** as a comment on the nit collector (`comment add <collector> --stdin body`),
     naming each pull request that waits for the person's test, unless the collector's latest comment is already one
     naming the same pull requests.
  4. **End by saying** that the project reads "in review" and naming each pull request (its number and URL) that
     waits on the person's test, where it is linked and open (a pull request that had already merged ends as "When
     the plan merges into `main`" does). Otherwise name the pull request that is not linked (a refused link), or
     say none is open yet, and say the project reads "in review" only once one is linked and open. Where they test it is theirs to
     choose: locally, on a dev server, anywhere.
     Nothing merges it into `main` until they say so ("When the plan merges into `main`").
- **With no plan branch** (*Plan branch* `none`), each story was merged into the integration branch at step 5 as the
  repo's convention says, which may be a pull request that waits for the person. So **read back that every `done`
  story of the project is in `main`** before anything closes (a cancelled one has nothing to merge): its pull
  request reads `MERGED` (`gh pr view <story branch> --json number,state,url`), or, with no pull request or no `gh`,
  its branch head is in the fetched integration branch (`git -C <story worktree> merge-base --is-ancestor <story head> origin/<integration
  branch>` exits 0).
  - **Every story reads merged:** post the plan's final status update on the nit collector and set the collector
    `--status done`. End by saying that the plan has merged into `main` and the Plan record reads `done`.
  - **Any story does not:** set the collector `--status in_review` unless it reads `in_review` already, post the
    status update naming each story's pull request (or branch) not yet in `main` unless the collector's latest
    comment is already one naming the same ones, and end by saying that the Plan record reads `in_review` and naming
    each of them (number and URL, or branch) as waiting on the person. "When the plan merges into `main`" goes on
    from there.

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
| 3 | gate, commit, stalled check, push | none (a stalled round: `escalation raise`, wait) |
| 4 | iteration | `iteration record <ref> <sha> --as <alias>/implementer --tests "…" [--passed] [--addresses '[…]'] [--tokens N] [--minutes N] [--testMinutes N] --note "…"` |
| 5 | brief | `comment add <ref> --as <alias>/implementer --stdin body` |
| 6 | hand over | `issue update <ref> --status in_review`, in round 0 too |
| 7 | reviewer | none |
| 8 | findings | `comment add <ref> --as <alias>/reviewer [--anchor '{…}'] --stdin body`, one each |
| 9 | verdict | `comment add <ref> --as <alias>/reviewer --kind review --iteration X --settles … --disputes … --raises … --stdin body`, then `spend record <ref> <minutes> --as <alias>/reviewer [--tokens N] --note "review of it.X"` and `spend record <ref> 0 --as <alias>/agent [--tokens N] --note "orchestrating it.X"` |
| 10 | a human is needed | `escalation raise <ref> --as <alias>/reviewer … [--comment <the finding's cN>]` (never the verdict's), then wait |
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
- **a stop**: a hard stop condition fired, one `# Run status` comment on the story names each of the stop's escalations, and a
  wait on one ended without an answer, or an answer ended the work ("Wait, then carry on"); nothing more happens
  until a human acts. A stop whose every answer arrives while the run waits is not an ending: the run carries on.

There is no third ending. A run that drifts off without either has left the next human to work out what happened
from the branches.

| The sub-issue run owns | The issue run owns |
|---|---|
| the worktrees, the rung, round 0 and the freeze, every round, the verification gate, the round records, landing a task, the story gate | the preconditions, the story's build step, the task order, the stop conditions, the budget, the status comment, the friction harvest |

### Preconditions: all of them, or do not start

A refusal here writes nothing: say in the session which precondition failed and stop.

1. **The type is unattended.** `leeway issue get <story> --json` gives `issue.type`; `leeway process get <KEY> --json` gives that type's `build` step. **No `build` step, or `params.unattended` not true → say so and stop.**
   Such a story is run one sub-issue at a time, `run` on each, where a person is in the session. The process is what
   decides this, not a flag you pass.
2. **The plan gate is passed**, when the type has one: its first step of kind `gate` after its `plan` step, found
   in `process get` by kind and position, never by id (a `gate` before `plan` is the shaped step, not this one).
   It is passed when all of these hold, and each one that fails is a stop: say which and stop.
   - **The story has tasks** (`subIssues`).
   - **The gate is recorded**: a coverage report comment on the story by `<div>/reviewer` (`<div>` is the divergence
     reviewer's alias), opening `# Plan coverage:`. A gate that only existed in a conversation did not happen: with
     no report, the story was not gated.
   - **It has left the plan gate for `ready` or later**: `issue.status` is `ready`, `in_progress` or `in_review`,
     and `issue.step` is not the plan gate or a step before it. A person passing the gate is that move. **A story
     still at the plan gate waits on the gate.** One at a step before it is not planned.
   - **The latest report's QUESTIONs are answered and applied**: every escalation on a comment opening
     `# QUESTION … of c<report>`, where `c<report>` is that report's first comment, has an answer
     (`escalations[].answer`), and the report has a reply opening `# QUESTIONs applied`. Each
     QUESTION needs a human answer before any task starts. One open waits on that answer; answered and not applied
     waits on `plan-project`, which applies them. A report with no QUESTION needs no reply.

   A type without a plan gate needs only that the story has tasks (`subIssues`) and is planned.
3. **The story is not blocked** (`issue.blockedBy`, a blocker counting while neither `done` nor `cancelled`).
4. **Leeway answers.** Read the story and its children; a failed call, or an empty result where something must
   exist, is stop 10 below, not an empty story.
5. **A previous run is answered.** If the story carries a comment opening `# Run status`, read the latest. Every escalation it
   names must be answered, or the change it asked for recorded. One open and that change not recorded → the condition still holds; say so
   and do not start.
6. **The unattended prerequisites are in place** (below), or a human is watching and says so. A run that will stop at
   a permission prompt is attended whether anyone planned it that way or not.

### Story start

1. **Set the story to its build step**, after reading its state: `leeway issue update <story> --as <alias>/agent --step
   build`. Write nothing if `issue.step.id` is already `build`; a continuation run finds it there, and a second write
   is a second mover in the history.
2. **Create or reuse the story worktree** per "0. Locate, read the process, set up": cut from the branch
   the story's `issue.base` names the first time, reused as it stands on a continuation run. Run the per-worktree
   setup command in a new one.
3. **Take the baseline.** Run the gate command and every lane in `.sdlc/CONFIG.md` in the story worktree, and note
   which are green. A lane red here that is not in *Known-red* is stop 6 before the first task: building on a red
   branch hides whatever the tasks break.
4. **Start the budget** from the process: `params.budget` on the story's build step (precondition 1), never from
   `.sdlc/CONFIG.md`. It has up to three dimensions, whichever is hit first: `tokens`, `rounds` and `hours`, the
   wall-clock in whole hours, checked against `totals.minutes`. A dimension it leaves out is not limited, and a build
   step with no `budget` limits none, so stop 9 never fires; say so in the session when the run starts. A *Per-story
   budget* row still in `.sdlc/CONFIG.md` is not read: say that `sync-repo` moves it into the process. Read the
   budget again with the totals at each round boundary, so one a person changed while the run waited is the one
   checked. It is per story, across runs, and every dimension is summed by Leeway: `totals` in
   `leeway issue get <story> --json`, over the story's own records and its sub-issues' ("Recording spend").
   **Rounds** are `totals.rounds`, round-0 attempts included; **tokens** are `totals.tokens`, and **wall-clock** is
   `totals.minutes`. A continuation run reads them there, never from the `Spend` line of a `# Run status` comment.
   Time spent in a wait ("Wait, then carry on") does not count toward wall-clock.

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
answering the escalation; the run waiting on it reads it there ("Wait, then carry on"), or a later run does
(precondition 5). Each stop ends in **one escalation**, or in one per independent question where the sub-issue run raised a round of
them (a brief's second `## Question`, a verdict's second `Escalates:` block, a verdict's debt proposals): where
the sub-issue run already raises it or them, those are the stop's, and the issue run adds none (one more would be a
further question for one stop); otherwise the issue run raises it on the story.

| # | Condition | Detected | The stop's escalation |
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

**And every place the sub-issue run itself says stop or wait**: a stalled round, a BLOCKED brief, a dispute or finding the reviewer
sends to a human, a pointer to technical criteria with no such comment, a migration recipe the doc map does not
name. They are stops here too, and each already raises its own escalation. Its wait is step 7 of "On a stop", after
the status comment, not a second one before it.

Notes on the ones that need them:

- **3 and 4: finish landing the task first.** A follow-up is by definition not this task's diff, and the task lands on
  the story branch, which reaches nobody until the story gate. So a PASS is landed through "Land the task",
  and then the run stops. A `security` follow-up is filed first, as "What a deferred finding becomes" says, with no delay; the stop is so a
  person decides whether the story should go on being built on top of it (options "Continue the story" and "Hold the
  story"). A `debt` follow-up is the proposal's escalation: on a yes the run files the issue as "What a deferred
  finding becomes" says, and on a no the finding stays a nit.
- **5 replaces the sub-issue run's fallback.** A sub-issue run does a twice-hallucinated round inline and tells the user the
  workflow degraded. Unattended there is nobody to tell while it matters, and a degraded round nobody noticed is
  indistinguishable afterwards from a normal one. Stop instead.
- **6: a red gate is still not a task FAIL**, and it is not this run's to diagnose either: the story branch now
  differs from what every reviewer saw.
- **7: mechanical means regenerated, never hand-merged.** A lockfile the package manager rebuilds. A conflict in
  anything a person wrote stops the run: abort the merge, so the story worktree is left at the commit before it, and
  put the conflicting paths in the status comment.
- **9: check at round boundaries, never mid-subagent.** Killing a subagent loses a round that may have been real.
  Read the story's `totals` at each boundary ("Start the budget"). Tokens are new tokens, counted from the transcripts
  where the harness can ("Recording spend"). Stop when `totals.tokens` reaches the token budget; while
  `tokensIncomplete` is true and that floor is under the budget, carry on, and every readout of it (the status
  comment, the report to the user) says `at least <totals.tokens>, incomplete`. Rounds include round-0 attempts.
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
   Write the body to a file ("Where `run`'s own files go"):
   `leeway comment add <story> --as <alias>/agent --json --stdin body <status.md`.

   ```markdown
   # Run status — <story ref> · stopped: <condition, by its name in "Hard stop conditions">

   - **Landed:** <task ref> <title>, commit <sha>; one per line, or "nothing yet".
   - **Stopped on:** <task ref> <title>: what fired and why, in one or two sentences, and the `cN` or each escalation id that shows it.
   - **Not started:** <task refs, in the order they would have run>.
   - **Next human action:** <one action, imperative, saying where each answer goes>. Then invoke <`run`, as `HARNESS.md`'s **commands** spells it> on <story ref> again.
   - **Left in place:** <story worktree path>, <task worktree path>, <branch names>.
   - **Spend:** <rounds> of <budget> rounds · <tokens> of <budget> tokens · <elapsed> of <budget> wall-clock.
   - **Friction so far:** <one line each, with task and round, harvested per "The friction harvest">; or "none".
   ```

   The *Spend* line is a readout of the story's `totals`: `<tokens>` reads `at least <totals.tokens>, incomplete`
   when `tokensIncomplete` is true, and `<elapsed>` likewise when `minutesIncomplete` is. Each `<budget>` is that
   dimension of the build step's `budget`, the wall-clock in hours (`4 h`); a dimension it leaves out drops its
   `of <budget>` (`7 rounds`).

5. **Raise the stop's escalation** (the last column of "Hard stop conditions"). One the issue run raises is on the story, as
   `<alias>/agent`, tied to the status comment (`--comment cN`, its `comment.number`), with the human's real
   choices as options (2 to 5, each with its argument) and `--meanwhile` saying what stays blocked and what does not.
   Where the sub-issue run raised it or them, add each id to the status comment, and raise no other.
6. **Tell the user the same thing** in the session, with the comment's `cN` and each escalation id.
7. **Wait on each of the stop's escalations** ("Wait, then carry on"), one after another. Once every one is answered the run carries on from where step 1
   left it, the condition overridden by those answers, and writes none of steps 4 and 5 again. Only when a wait ends
   without an answer, or an answer ends the work, stop the turn. Stop 10 has no escalation to wait on: stop the
   turn.

**The next human action is one action, and it is exact.** "Answer the escalation e2 on DRY-2.1, then invoke
`/leeway-sdlc:run` on DRY-2 again", not "review the findings". Two escalations are still one action: "Answer e2 and e3 on DRY-2.1, then invoke…". A stop whose next step the human has to work out costs
them the investigation the run already did. The skill is named as `HARNESS.md`'s **commands** spells it
(`/leeway-sdlc:run` in Claude Code), or as leeway-sdlc's `run` skill where it names skills in words: a bare `run`
can reach another skill of that name. For a `debt` stop the proposals follow the template, one line each.

### The end

When the last task lands, the sub-issue run hands on to "The story gate", and the issue run runs it unchanged, except that its
failures are stops here: a red gate is condition 6, a conflict condition 7, a missing migration recipe one of
the sub-issue run's own. The gate ends with the story set to the step after `build` or to `done`; a `manual` next step is
where the run ends ("verify on dev"), with the story waiting for a person.

The end posts one `# Run status — <story ref> · finished` comment on the story, with *Landed* (every task), the
story's new step or status, the *Spend* line and the friction proposal, so the next reader has the spend. A
continuation run reads it from Leeway ("Start the budget"), never from that line. No escalation, except the
friction proposal below and, where `gh` is not installed or fails, the ask for the plan's pull request ("The plan's end"). When the story was the plan's last, the comment and the session's last words say what "The plan's end" left the
Plan record reading, as its ending does: "in review" and the pull request that waits on the person's test, or the
plan merged into `main` once it reads `done`.

#### The friction harvest

Every task paid some cost the next one will pay again unless someone builds the tool. The round records are where
that was written down; this is where it leaves them.

1. **Collect** every *Friction* line from the story's briefs and verdicts, every task, round 0 included. Read them
   from Leeway, not from memory: the ledger does not carry them, and the records do.
2. **Drop** `none`.
3. **Dedupe** the lines against each other (two tasks missing the same seed is one line naming both) and against the
   open issues of the friction project (`friction-project:` in `.sdlc/leeway.md`; `leeway issue list <KEY> <friction project> --json` is one page, and the dedupe reads its open issues only, not the `done` or `cancelled` ones).
4. **Propose** what is left as one escalation on the story, as `<alias>/agent`, options "File them" and "File none",
   the lines (each with its task and round) in the question's context comment. The proposal never waits: the story
   has ended.
5. **File only on a human yes**, each accepted line as its own issue, the line with its task and round as the
   description: `leeway issue create <KEY> --as <alias>/agent --projectId <friction project> --type chore --title "…"
   --summary "<at most 280 characters>" --status backlog --stdin description <desc.md`. Nothing is filed on silence.
   With `n/a` in `.sdlc/leeway.md` the proposal is still made and nothing is filed.
6. **Legacy binding**, `friction-collector:` (a ref, or `n/a`) and no `friction-project:` (installed before
   0.3.0): dedupe against the comments on that issue and file each accepted line as a comment on it, as before;
   with `n/a` the proposal is still made and nothing is filed. Say once, in the finished status comment, that
   sync-repo migrates the line to a friction project.

### Unattended prerequisites

A run is only unattended if nothing in it waits for a keypress. That needs four things, set up before the first run.

- **A permission allow-list**, where `HARNESS.md` ("Permissions for an unattended run") says this agent keeps it and in
  the form it gives, naming what a run calls and nothing more:
  - **Leeway verbs:** `issue get`, `issue list`, `issue update`, `issue create`, `comment add`, `iteration record`,
    `spend record`, `escalation raise`, `escalation list`, `clarification answer`, `clarification list`, `review get`,
    `project get`, `project link`, `process get`.
    Any other verb prompts: `escalation answer`, `issue delete`, `product delete`, `process update`, and any verb a later
    CLI adds. A run calls none of them. A subagent is stopped from the write verbs by the plugin's
    `leeway-guard` hook, not by the allow-list, and the hook is not a vault (`PROCESS.md`, "The cast").
  - **git verbs,** each as `git -C <absolute path> <verb>` and at least one argument: `add`, `commit`, `push`, `fetch`, `merge`, `merge-base`,
    `worktree`, `branch -d`, `ls-remote`, `rev-parse`, `diff`, `status`, `show`, `log`, `blame`.
  - **The rest:** the lane and setup commands `.sdlc/CONFIG.md` names; `node -e` for the counting one-liner, the time
    stamps, and an agent's delete, rename or test mutation; `gh pr create` and `gh pr view`; the two scripts, `<wait-answer>` and `<session-tokens>`;
    file edits under `.worktrees/`, for the implementer's work and `run`'s own files ("Where `run`'s own files go"); and reads of
    this plugin's own files.
  **What the list cannot promise.** An improvised command, one an agent makes up that is not on the list, still prompts,
  so no list alone can promise no prompt: agents stay on these calls. Nor is it a boundary: `node -e` and the lane
  commands can run anything, including `leeway escalation answer`, and `leeway-guard` does not govern the orchestrator.
  A rule stops the call an agent ordinarily writes, not a determined one. **You never answer your own escalation:** an answer
  is the person's ("Only the answer is an answer"). What holds you to that is this rule, not the list.
  **`gh pr merge` stays off the allow-list**, always: it merges into `main` through GitHub, not by a push, so the
  pre-push guard does not cover it, and its prompt is where the person's yes is their word ("When the plan merges
  into `main`").
- **A pre-push guard that refuses the integration branch and a force push.** It lives in the target repo, not in this
  plugin, and this skill only states the requirement; `sdlc-install` offers to write it (question 16). It refuses an update to the integration branch named in
  `.sdlc/CONFIG.md` and a force push to any ref, deciding from the refs git passes on its stdin, so it refuses
  `HEAD:<integration branch>` from a detached HEAD, which is how the story gate pushes. It does so on a push from any
  process that does not skip it: `--no-verify` and
  `-c core.hooksPath` skip it, and the allow-list's push rule approves both, so it stops the push an agent ordinarily
  writes, not a determined one. Never pass either. An allow-listed push is one wrong argument away from the integration
  branch, and the plugin's git guard governs subagents, never the orchestrator. **Until the guard exists, leave the
  `push` verb off the allow-list** and let each push prompt: that run is attended, and should say so.
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
on top of it; the plan gate and the round-0 freeze make that rare, not impossible. A `debt` follow-up holds the run on
its answer rather than waiting in a queue, so a debt-heavy codebase waits often; the alternative is filing tickets nobody
approved. The budget is checked at round boundaries, so one long round can overshoot it, and a token count that
cannot be made leaves the token total a floor, not a count. A span the session ends inside, before its
record is written, is not recorded at all. And dropping each task's subagent context means a pattern noticed in
task 2 reaches task 5 only if a round record wrote it down.

## Run a project

`run` on a project runs its issues one after another, **each as an issue run** ("Run an issue"), in the order
their blocking relations allow, skips an issue its issue run refuses, and stops at the first issue that stops. It
adds only the order, the skip and that stop; each issue's run is "Run an issue", word for word, and nothing here
relaxes it.

1. **Read the project and its issues.**

   ```sh
   leeway project get <KEY> <project> --json
   leeway issue list <KEY> <project> --json
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
     next runnable one.
   - **Skip an issue its issue run refuses**: one that a precondition of "Run an issue" refuses, which writes nothing
     (its type is not unattended, it is not planned, an earlier `# Run status` is unanswered, or any other). Say in
     the session which issue and which precondition, and take the next runnable issue. It is skipped as an issue
     whose blockers are not done is: the issues it blocks stay unrunnable, and are skipped as blocked. It stays
     skipped for the rest of this run (step 3). A failed Leeway call is not a refusal: it is stop 10.
   - **Nothing runnable left** (issues remain and none is runnable: each is blocked, in a blocking cycle, waiting at a
     step after `build`, or already skipped in this run; the Plan record aside): the run ends there, and step 5
     reports what it ran, what it skipped and why, naming the blockers.
   - **Nothing left** (every issue `done` or `cancelled`, the Plan record aside): say so. If the Plan record is not
     `done`, run "The plan's end", which writes only what is missing: it picks up a plan's end that a wait, a lost
     session or a last story moved to `done` outside the gate left half done, and moves nothing to `done` that has
     not merged into `main`. Then stop, and end as "The plan's end" ends: "in review" and its pull request
     (`project.links`) while the Plan record reads `in_review`, or the plan merged into `main` once it reads `done`;
     once the person says merge, "When the plan merges into `main`" goes on from there.
3. **Run the next issue**, as "Run an issue" from its preconditions to its end or its stop, with fresh subagents.
   **Re-read the list before each issue**: Leeway, not this session's memory, says what is left, except the issues
   this run has already skipped because their issue run refused them. Those stay skipped for the rest of this run:
   they are the one thing the session keeps besides Leeway.
4. **Stop at the first issue that stops**: a hard stop or a stop of the sub-issue run (each with its own `# Run
   status` comment and its escalations, as the issue run raises them), once a wait has ended without an answer or
   an answer ended the work. Start no further issue. An issue whose stop is wholly answered while its run waits has not
   stopped: its run carries on, and so does the project run. A precondition it
   refuses is not a stop: step 2 skips that issue and the run goes on. An issue whose story gate ends at a `manual`
   next step has ended, not stopped: go on with the next runnable issue, and the issues it blocks wait until a
   person moves it. In a project run, the stop's `# Run status` comment names the project in its *Next human
   action*: "Then invoke <`run`, as `HARNESS.md`'s **commands** spells it> on project <project id> again", in place
   of the story ref, so the human who answers it goes on with the project, not only that issue.
5. **Say so in the session**: per issue, where it ended (its new step or status) or why it stopped (its `# Run
   status` comment's `cN` and each escalation id), every issue it skipped and why (the precondition that refused it,
   or the blockers not done), and the issues not started, in the order they would have run. When an issue's story
   gate, or "Nothing left", ran "The plan's end", say last what it left the Plan record reading, as its ending does.

**Bounds.** The per-story budget (the `budget` of each issue's build step, "Start the budget") applies to each issue
as it does to an issue run on its own. **There is no project-level budget**, and the project run writes nothing of its own to Leeway
except what "The plan's end" writes when "Nothing left" runs it: the records, the status comments and the escalations
of each issue are its issue run's. **Re-invoking it is the human's**: once a
stopped issue's every escalation is answered after its wait ended, `run` on the project again goes on from there. A project run has no
unattended mode of its own: an issue whose type does not say unattended is refused by its precondition 1, and the
project run skips it and goes on. A skipped issue costs nothing: it runs no round and spends none of any budget.

## When the plan merges into `main`

**The plan merges into `main` on the person's word; no run merges it by itself.** A green gate, a passing CI or an
approved review is not that word, and neither is the end of a run. Once the person says merge, in the session:

1. **Merge the pull request** as the repo's convention says: `gh pr merge <PR>` where `gh` is installed, or the person
   merges it. With no plan branch, that is each story's pull request "The plan's end" named as not yet in `main`.
   Never push the integration branch yourself (the pre-push guard in "Unattended prerequisites").
2. **Read it back:** `leeway project get <KEY> <project> --json`, which refreshes a stale open pull request's state.
   Every link's `pr.state` must read `merged`. A link with no pull request, or one that reads `open` or `closed`,
   has not merged into `main`: say so, and leave the Plan record as it is. With no plan branch, the read-back is "The
   plan's end"'s, for every `done` story, and the same holds for a story that does not read merged.
3. **Only then close the Plan record:** post the plan's final status update on the nit collector and move it to
   `done`. End by saying that the plan has merged into `main` and the Plan record reads `done`.

   ```sh
   leeway comment add <collector> --as <alias>/agent --stdin body <status.md
   leeway issue update <collector> --as <alias>/agent --status done
   ```

The person may close the Plan record themselves; if it already reads `done`, leave it.

## Done when

**On an issue:** either every task of the story has landed, the story gate has run and the story has moved to the step after `build`
(or to `done`) with a `# Run status — … · finished` comment, or the run stopped and the story carries one `# Run
status` comment naming the condition, what landed and the exact next human action, with the stop's escalations, and every
worktree and branch where the run left it.

**On a project:** every issue other than the Plan record is `done`, `cancelled`, waiting at a `manual` step or on a
blocker, or skipped because its issue run refused it, or the run stopped at the first issue that stopped, and the
session says which, where each issue ended, what it skipped and why, and what was not started.

**At the plan's end:** after its last story, the Plan record is `in_review` with the pull request to `main` linked on
the project, and the ending says the project reads "in review" and names it; it is `done` only once that pull request
has merged into `main` on the person's word, or, with no plan branch, once every `done` story reads merged into `main`,
and the ending then says the plan has merged into `main`. With no plan branch, while a story does not, the ending says
the Plan record reads `in_review` and names each story's pull request not yet in `main`.
