# The contract for delegated work

**Status at this version.** `0.3.1` holds everything this file names: the hooks (`git-guard`, `leeway-guard`,
`version-notice`, and the adapters that run the guards in other agents), the three agents, the templates and the
skills (`sdlc-install`, `sdlc-tune`, `shape-project`, `plan-project`, `run`, `update`, `sync-repo`).

**This file is the same in every agent; `HARNESS.md` is not.** It sits beside this file and says how the agent
running the loop delegates to a named agent, how the guards know a subagent's call from the orchestrator's,
where the instructions and local notes live, and how the plugin is updated. Where this file says "a hook" or
"delegate", `HARNESS.md` says what that is here.

Your repo's own floor binds all work in it, paired or delegated. This sits on top and binds only
**delegated** work — work broken into tasks and handed to subagents. **Never quote it at someone
pairing turn by turn:** there the human in the loop is the review, and a subagent round buys
nothing. Pairing is a first-class way to work, not a shortcut around the process.

Before any Leeway call, read the binding at `.sdlc/leeway.md` (server, product key, the CLI command).
Then read the process: `leeway process get <KEY> --json`. Everything below that the process can change
(the types, their steps, the caps) comes from that answer, never from this file.

## The cast

Five roles, three of them subagents:

| Role | Who | Owns | Never does |
|---|---|---|---|
| Orchestrator | the main session | Leeway writes, branches and worktrees, commits, merges and pushes, delegation, the verification gate | writes feature code inline; skips the review; writes without `--as` |
| Planner | the orchestrator, before work starts | the design doc and the task breakdown | starts coding before the breakdown exists and the plan gate (if the type has one) has passed |
| Divergence reviewer | `sdlc-divergence-reviewer` subagent | the coverage report: each acceptance and technical criterion to the task that delivers it and the check that proves it, and a recommended verdict | edit anything, write to Leeway, approve its own gate |
| Implementer | `sdlc-implementer` subagent | code, tests, `git -C <worktree> add <paths>`, the handoff brief | commit, merge, push, write to Leeway |
| Reviewer | `sdlc-reviewer` subagent | running the lanes, the diff review at the depth the process sets, the verdict | fix code, commit, write to Leeway |

The human is not a role the loop plays. The human decides what only a human can, and is reached by an
escalation.

**The alias and the role.** Every write carries `--as <alias>/<role>`, the role being `implementer`, `reviewer`,
`planner` or `agent` (the CLI's four). The alias names the agent instance: the orchestrator chooses one when the
session starts, before its first write, and keeps it for the session: an adjective and a bird, two lowercase words
joined by a hyphen (`quiet-wren`), which Leeway displays as a two-word name (Quiet Wren). Pick each word at random, not
the first in the list, so two sessions rarely land on the same pair:

- **Adjectives:** amber, bold, brave, bright, calm, candid, clever, deft, eager, fair, frank, gentle, keen, lively,
  merry, nimble, patient, plain, quiet, rapid, steady, tidy, wise.
- **Birds:** crane, curlew, dunnock, egret, finch, grebe, heron, kestrel, lark, magpie, osprey, owl, petrel, plover,
  puffin, raven, robin, rook, starling, tern, thrush, warbler, wren.

Two sessions running at once, or two people's agents, must not share one. Before taking the pair, read the aliases
active in the project the work belongs to (`leeway project get <KEY> <projectId> --json`, with the project id from
`issue get`'s `project.id`; its `activeAgents` lists those that acted in the last 24 hours, at most 50) and the ones
already visible on the issue (`issue get`'s `agents`). If the pair is in either, add `-2`, then `-3` and so on, until
the alias is in neither (`quiet-wren-2`). A server that predates the field returns no `activeAgents`; then the issue's
aliases are the only check. Given a project and no issue, `activeAgents` is the only check. Every alias this produces
matches `^[a-z][a-z0-9-]{1,23}$`, the CLI's check: the longest pair with `-99` is 19 characters. Aliases already in a
thread (`kestrel-b1`) keep their old form and still display as themselves. A task resumed in a later session carries
that session's alias, a new one chosen the same way, and the thread shows the handover.

**With no project in hand** there is nothing to read, and no `project get` can run without a project id. A session
whose first write creates the project, or changes the product's process with no issue named, takes a pair at random
and checks it against nothing, not sweeping other projects for aliases. It keeps that alias if it reaches a project
later. A session with an issue named has a project: its `issue get` gives `project.id`.

The orchestrator's own words, and a skill acting for it, write as `<alias>/agent` (planning as `<alias>/planner`, the
plan gate's report as `<alias>/reviewer`); subagents never write, so their entries are the orchestrator's under their
role.

**A move the person asks for.** Any skill makes any move the person asks for in the session, from whatever step or
status the issue is at: `issue update <ref> --step <id>` or `--status <status>`, as `<alias>/agent`, and then says
which move it made, from where to where, and what it leaves unmet (an open or unapplied QUESTION, no coverage
report, no tasks). No skill tells the person to make a move in the UI because the skill may
not. Only `plan-project` moves a story out of the shaped step or the plan gate on its own, on the conditions "Before the
plan: shaping" and "The plan gate" give, and no other skill does: any other skill moves it only when a person asks.

**Two invariants make it work.**

- **One writer to Leeway, all readers.** Only the orchestrator writes: `issue create` and `update`,
  `comment add`, `iteration record`, `escalation raise`, `dependency`, `project` and `process` writes.
  Every write is attributed (`--as <alias>/<role>`), and a second writer makes the history unreadable.
  Reading touches none of that, so subagents read freely and are expected to: a ref in a code comment,
  a sibling task, an earlier round is context the next person to touch it needs.
- **One writer to git.** The orchestrator. Subagents may only `git -C <worktree> add <paths>`.

**Both are enforced for this plugin's own agents, by hooks.** `git-guard` blocks a governed agent's
git writes; `leeway-guard` blocks a governed agent's `leeway` call whose verb is outside
`get|list|whoami|help|version`, and any call it makes to the plugin's raise script. In Claude Code a governed agent is one whose type carries the `leeway-sdlc:`
prefix, so another plugin's agents are untouched. Other agents attribute calls differently, and some not at
all: there the orchestrator marks the window in which a subagent runs (`HARNESS.md`, "Governed-agent
marker"), and every shell call in it is judged as the subagent's. The hook is not a vault: a raw HTTP call to the MCP endpoint
is not seen by it, and for that the invariant stays prose. A framework that claims enforcement it does
not have is worse than one that admits the gap.

A subagent has no user to ask. Where a paired session would stop and ask, a subagent writes the doubt
under *Uncertainties* in its brief, or returns `BLOCKED` with a `## Question`. **Guessing silently is
the one failure that corrupts everything downstream.**

## How the plugin reaches Leeway

- **The `leeway` CLI**, not an MCP server. The plugin ships no `.mcp.json`. Attribution needs a different
  `--as <alias>/<role>` on each call (the brief as the implementer, the verdict as the reviewer), which
  one configured MCP connection cannot give.
- **The command is configurable.** `.sdlc/leeway.md` carries `cli: leeway` by default (the npm package
  `@leeway-run/cli`), or a path such as `node /path/to/leeway.js`. Its `server:` is passed as `--server` on every
  call; the CLI's own default, `https://app.leeway.run`, is only what `leeway login` uses without one.
- **No token in any repo file.** `leeway login` keeps it on the machine. A subagent is never handed a
  token, and `leeway-guard` stops its writes.
- **Verb first.** The plugin prints a call as `<cli> --server <server> <resource> <verb> <args> --as <alias>/<role> --json`,
  because a harness that asks about a call matches it as written (`HARNESS.md`, "Permissions for an unattended run"). The CLI
  takes the flags on either side, so an attended skill that still prints them before the verb works: it only prompts.
- Long bodies go in through `--stdin <field>`, so a brief or a verdict is not squeezed through a shell
  argument.
- **Size limits.** A comment body is 1 to 20,000 characters, a title at most 200, `--tests` at most 200,
  and `--stdin` is capped at 64 KiB. A brief over the comment cap goes in whole
  across the comment and a reply (`comment add <ref> --parent cN --stdin body`), never cut. A verdict that
  would exceed it shrinks: each finding is its own comment, posted before the verdict and anchored where it
  can be, and the verdict only names them by `cN`.
- Leeway's Markdown shows raw HTML as text, so no record, template or skill uses an HTML comment or any
  other marker that relies on it. A record opens with a heading instead (`# Handoff brief — <ref> · round <N>`).

## The process, read at runtime

`leeway process get <KEY> --json` returns the product's process: a list of **issue types** (feature, bug,
hotfix, experiment, chore, debt, or whatever the product defined), each with a branch prefix and an
ordered list of **steps**. Every step lives inside one of the statuses `backlog`, `ready`, `in_progress`
or `in_review`, and has one of five kinds. The plugin does for each kind what this table says, and
nothing else:

| Step kind | What the plugin does for it |
|---|---|
| `shape` | The product owner shapes the story: scope, acceptance criteria (`AC-n`), design link, out of scope, the questions left for a developer. `shape-project` writes the body into the issue description. Nothing is coded. A type without `shape` skips this and `plan-project` takes the issue as written |
| `plan` | The planner works the issue into tasks (sub-issues) with `dependency add` between them, writes the design doc when the step's `designDoc` param is true, and adds technical criteria (`TC-n`) to the story. When the type also has `shape`, a product check comes first: it reads the product owner's part, writes nothing to it and sends any gap back as one comment. Before the design doc it interviews the developer in rounds of escalations on the technical decisions the code leaves open (`plan-project`, "The developer interview") |
| `gate` | One of two, told apart by position, never by id. The **shaped step**, a `gate` between `shape` and `plan`: shaping ends there ("Before the plan: shaping"). The **plan gate**, the type's first `gate` after its `plan` step: planning ends there (below). A type without a plan gate goes from plan to ready with no gate |
| `build` | The loop (below), run by `run` for each sub-issue, for a whole story and for a project. Its params set the rest: `redTests`, `round0Cap`, `roundCap`, `review`, `blockingRungs`, `unattended`, and the optional per-story `budget` |
| `manual` | A human step: "try it", "verify on dev", "keep or drop". The plugin sets the step, says what it is waiting for and stops. It never does the work, and it moves the issue past it only when a person asks ("The cast") |

**A type without a `build` step is one the plugin does not run.** `run` says so and stops.

**Statuses and steps are set, never inferred.** The plugin moves an issue only with an explicit
`issue update <ref> --step <id>` or `--status <status>`. Setting a step also sets its status in the same
write. No iteration, escalation or comment moves an issue; a lasting state is something a person or the
orchestrator chose. `plan-project` moves a story from the plan gate to `ready` when its report passes; on a type without
a plan gate, it sets `--status ready`. `run` sets the build step when it starts, so an issue is never `in_progress` with nobody on it. Each sub-issue has two steps of
its own, `red-tests` and `implementing`, and is `in_review` while the reviewer has it.

## Before the plan: shaping

A story is shaped before it is planned, and by someone else, when its type has a `shape` step. The
**product owner** runs `shape-project` and writes the story body: scope, acceptance criteria, design link,
out of scope, and the questions left for a developer. A developer then runs `plan-project`, whose first
step is a **product check**. A story that passes gets its **technical criteria** (`TC-n`) from the
developer, at the end of the same body, unless the change is small or trivial: the `AC-n` say what the
user gets, the `TC-n` what the build must hold to. Together they are final, and the tasks, the red tests
and the plan gate all work from both. A story planned before may point from its body to the latest comment
that opens `# Technical criteria` instead; that comment holds its technical criteria, and every reader reads
it with the body.

**Shaping ends at the shaped step**, the type's first `gate` step after `shape` with no `plan` step between them
(`shaped` in the presets). Once every question is answered and no answer leaves something new unclear,
`shape-project` writes the body, posts one comment of what it inferred beyond the answers, sets that step and
stops. No escalation asks whether to write the body: the product owner's answers are the shaping, and the story
waits at the shaped step until `plan-project` runs on it. Two stories keep an approval escalation before the write: one
already planned, whose tasks were built against its criteria, and one whose type has no shaped step.

**Planning starts at the plan step.** Running `plan-project` on a story at the shaped step, with no shaping escalation
open, is the approval of the body: it moves the story to the plan step itself and posts `# Planning started`, saying
the run was the approval. Where shaping ends on a type with no shaped step, it starts from `shape` or from no step at
`backlog`, setting the plan step itself, since the approval escalation was the approval. A type with no `shape` starts
from no step at `backlog` the same way. On a type with a shaped step, a story at `shape`, or one at the shaped step
with a shaping escalation open, is not moved: `plan-project` says shaping is not finished and stops, writing nothing.
A story it sends gaps back on goes back to `shape`.

| Part of the story | Owner | Written through |
|---|---|---|
| The body down to *Open questions for dev*: scope, `AC-n`, `OPEN:` lines | the product owner | `shape-project`, or by hand in the same shape |
| *Technical criteria* (`TC-n`) | the planner | `plan-project`, after the product check |
| The design doc, the tasks, the dependencies | the planner | `plan-project` |
| A change to a frozen test | the criterion's owner: the product owner for an `AC-n`, the planner for a `TC-n` | the round record, then the body |

**This does not break single-writer.** Shaping is not delegated work: no subagent runs. From the first
planned task on, the orchestrator is the one writer.

## The plan gate

For a type that has a plan gate (a `gate` step after `plan`), planned work passes one gate before any code
exists.

1. The divergence reviewer gets the **refs and the doc map, never the planner's summary**, and reads the
   plan, the stories and the tasks itself. A re-review also gets the previous report (its `cN`): that is the reviewer's own
   output, so it is not the planner's summary, and the planner's replies to a report are never passed.
2. It returns a coverage table, findings tagged BLOCKER / QUESTION / NOTE, and a recommended verdict:
   PASS, PASS WITH DECISIONS, or RETURN. The orchestrator gates the reply like any other.
3. The orchestrator posts the **full** report as a comment on the story, posts each QUESTION as its own top-level
   comment opening `# QUESTION <n> of c<report>` (`c<report>` the report's first comment) with one escalation on it,
   and waits on them. A report's QUESTIONs are the escalations on those comments. A
   QUESTION held for the next round goes out then, or never where an answer settled it (`plan-project`, "The QUESTIONs"). No
   escalation asks for the gate decision: **the verdict decides, and `plan-project` makes the move, per story.**
   `plan-project` moves the story from the plan gate to `ready` on a PASS, with a `# Moved to ready` comment naming the
   report's `cN` and its verdict. A RETURN stays at the plan gate: moving it back to the plan step returns it to planning.
   On a RETURN where every BLOCKER is a fix to existing items, plan-project fixes it, replies `# BLOCKERs fixed` and runs a re-review at most 2 times before the story stops at the plan gate.
   **No task starts before the move to `ready`**, and an answer to a QUESTION is not that move. With QUESTIONs, the order
   is: answer them, and `plan-project` applies the answers (the session waiting on them does, or a re-invoke once it has
   ended; it replies `# QUESTIONs applied` to the report) and then moves the story to `ready` on PASS WITH DECISIONS,
   with the same comment. `run` reads the gate from the step and the record: it refuses a story with no coverage report, one still
   at the plan gate, and one whose latest report has a QUESTION open, or answered and not applied.

**Why.** An artifact cannot audit itself. The planner reads its own breakdown with the story it had in
mind, not the story as written, and fills every gap from memory without seeing one. A fresh context with
no memory of the decisions reads only what is on the items, which is all an implementer will ever see.
The gap it finds costs one edit to a description; the same gap found in diff review costs a round, and
found after release costs a story. A decision stays with a human because the reviewer only measures
divergence: whether a divergence is a defect or a choice is a judgement about intent, so a QUESTION or a BLOCKER that needs one goes to a person, and the story does not move until it is answered. **What is lost:**
it checks the plan against the story, not the story against what anyone wanted. A criterion never
written down cannot be found missing.

## The loop

One task at a time, each through the full loop, in a worktree of its own. Do not batch several into one
implementer run, and do not defer review to the end. `run` on a sub-issue runs one task through it; `run` on an
issue runs every task of a story through it in turn, unattended, and only for a type whose `build` step says
`unattended`; it waits for a human only where one of its stop conditions fires, each ending in one
escalation, or one per independent question where a round has more, that it waits on, carrying on when every answer has come ("Questions to the human are escalations"). `run`
on a project runs its issues that way, one after another, and stops at the first that stops. It skips an issue its
issue run refuses, and goes on.

A task at evidence rung R1 or above, in a type whose `build` params say `redTests`, first runs
**round 0**: the implementer writes only the failing tests its criteria call for, `AC-n` and `TC-n`
alike, skipped with the criterion named, and a reviewer checks them against the criteria. Round 0 is
capped by `round0Cap`. On a PASS the tests are **frozen**: later rounds turn them green by changing
production code, and changing a frozen test is a spec amendment only the criterion's owner can make. A
task whose type says `redTests: false` goes straight to implementing.

1. Delegate to the implementer. **Embed critical inputs; do not reference them.** A prompt carrying its
   own content survives a failed tool call; an agent whose first call fails silently fabricates
   everything downstream.
2. **Gate.** Independently run `git -C <worktree> status --short` and `git -C <worktree> diff --cached --stat` and compare against
   what the brief reported. That comparison is what catches a round that never happened.
3. Commit and push the task branch, then record the round (see the records table). Not a summary: the
   full brief, because nothing else keeps it.
4. Delegate to the reviewer, at the `review` depth the process sets (`light`, `standard` or
   `adversarial`). It runs the lanes first and stops at a red one without reviewing code.
5. Gate again, record the full verdict, then act on PASS or FAIL.

**The round, and counting it.** A round is one **iteration** (the commit, the lane line and whether it
passed), one **brief** (the implementer's handoff), the **findings** (the reviewer's anchored comments)
and one **verdict**. They are joined by the iteration number `N`: the brief opens `# Handoff brief — <ref> · round <N>`, the
verdict `# Review verdict: PASS | FAIL — <ref> · round <N>` (`round <N>` is the iteration number: the round and
the iteration are the same count), and each finding carries the anchor `iteration N`. **The round
count is the number of iterations on the sub-issue**, read from Leeway, never from text. Round-0
attempts are the iterations recorded before the `step_set` entry whose `to` is `implementing`.

**The round cap.** The `build` step's `roundCap` is the most adversarial rounds a task gets. If the cap is
reached without convergence the task is mis-specified, not mis-implemented. That is a human decision,
not another loop: one escalation, and the work waits on its answer ("Questions to the human are
escalations"). **You may override a PASS, and you may not override the cap.** If a finding is under-rated
and you can say why, send it back and record the reason. An override spends a round; the cap is what stops you
spending them forever.

**Why it is shaped this way**, worth thirty seconds before shortcutting it:

- **Separate implementer and reviewer contexts.** An author reviewing their own diff rationalises it. A
  fresh adversarial context with no memory of the decisions finds what the author cannot see.
- **Tests before code review.** Reviewing a diff whose tests are red wastes the expensive pass.
- **Per task, not per story.** Small diffs get real review. A whole story in one run produces a diff
  nobody reviews properly.
- **The verification gate.** Delegation is only as trustworthy as your ability to check it.

**Spend rounds on the risk, not on the artifact.** A round that only polishes a fix that was already
correct buys nothing. Sometimes the test watching the fix is worth the round; notice when you are
spending one on it.

## The evidence ladder

How much a change must prove depends on what it can break. **Rungs are cumulative**: a change at R4 also
owes R3's proof. Find the highest rung the change touches; when two apply, take the higher one.

| Rung | The change | What it must prove |
|---|---|---|
| R0 | Docs, comments, renames with no behaviour change, test-only edits | Nothing beyond the repo's gate |
| R1 | Internal logic: pure functions, sanitizers, mappers, parsers | The new test fails before the change and passes after |
| R2 | User-facing behaviour: a page, a form, a flow | The changed screen, and the action that produced it, checked as a user would meet it |
| R3 | Runtime surfaces with no visual output: an API, a tool, a job | A caller-side transcript of the call and its result against the running target |
| R4 | Auth, ownership, isolation, exposure, and any other security control | The refusal, and proof that this control is what refused: the same attack refused, then the same attack with the control disabled. For an isolation boundary, two principals, one query, and the negative case |
| R5 | Migrations, destructive scripts, anything touching a real deployment | The dry run, the target named, then the after-state read back |

A security control that is not an isolation boundary is still R4. A refusal alone proves the request
failed, not that the guard is why.

**Which rungs block comes from the process, not from this table.** The `build` step's `blockingRungs`
lists the rungs at which an unproven claim blocks the verdict rather than being noted as a finding
(the presets: `[R4, R5]` for a maintained product, `[]` for an mvp). **The instruments are the repo's own:**
its evidence standard (the `evidence` doc in its doc map) names the exact commands, viewports and
transcripts, and where it differs from the wording above, it wins. A repo may record where the proof is
committed durably in `.sdlc/CONFIG.md`. A claim about runtime behaviour is settled by running something,
and the result is read from what it left behind.

## Questions to the human are escalations

**No agent asks the human a question in the terminal.** A question for the human is a Leeway escalation,
because an escalation keeps the options that were put and the argument for each, and the human's answer,
as a decision record on the issue. This replaces "returns `BLOCKED`" for anything the human must decide;
an implementer still writes the doubt it can live with under *Uncertainties*.

Write the escalation's fields to a file, then raise it with the plugin's raise script, by the command `HARNESS.md`,
"Running the plugin's scripts", names (`<raise>` here):

```json
{"type":"<type>","question":"…","context":"…","tradeoff":"…","advice":"…","options":[{"label":"…","argument":"…","suggested":true},{"label":"…","argument":"…"}],"meanwhile":"…","comment":"cN"}
```

```sh
<raise> --server <server> --as <alias>/<role> <ref> <fields file> -- <cli>
```

**Every field goes in the file, never on a command line.** A question, a context, an argument or a piece of advice
is drawn from a report or the code, and holds backticks, `$` and apostrophes that a shell would run, expand or end a
quote on, so the text would arrive cut or changed. The script reads the file and runs the CLI's `escalation raise`
once, each field an argument of its own and none through a shell, so every field arrives as written. It prints what
the CLI prints, the raised escalation as JSON (`escalation.escalation` is its `eN`), and exits with the CLI's code;
for a file it cannot use (not JSON, a field missing or of the wrong kind, or one it does not know) it raises
nothing and exits 2, with a line starting `raise:`: fix the file and raise again. An exit of 126 or 127 means it never
ran (not executable, or not on the `PATH`): stop the turn and say so. Write the file as JSON with the `Write` tool: in `run`, where run's other bodies go (run, "Where `run`'s own files go"); in
any other skill, a file outside the repo, by absolute path. `"type"`, `"question"`, `"context"`, `"options"` and
`"meanwhile"` always; `"tradeoff"`, `"advice"` and `"comment"` where the asker has them. The CLI's own raise, with
the fields as flags, is not a call a run makes.

An escalation is decided from what it carries, so a person can make the decision from the escalation alone, without
opening the report behind it:

- **`"type"`, always, by what kind of question it is.** `blocker`: the work has stopped on a failure or a block,
  and cannot go on as planned until a person decides: a `BLOCKED` brief, a stalled round, a cap, a frozen test that
  needs a spec amendment, a stop of an issue run. `clarification`: a decision the plan or the operation needs from a
  person before the work it shapes, where nothing has failed: an op question, a plan-gate QUESTION, a shaping,
  interview or floor question, an install, sync or tune question. Either kind holds the work that depends on it until
  it is answered. `debt` for a debt proposal, `nit` for a friction proposal. Each skill names the type of each of its
  raises.
- **`"context"`: the specific thing behind the question, in plain lines**, taken from the report, the brief or the
  code: each blocker, finding or question summarised in one line of its own, with what it is about. **Never only a
  reference**: "See c12", a URL or a ref alone is no context, and the server refuses it (`invalid_context`). A `cN`
  may follow a line as where the detail is, never stand in for it.
- **`"tradeoff"`**: what the choice costs either way, where the asker can say it. **`"advice"`**: which option the
  asker picks and why, in a sentence or two, or that it has no pick and why. Left out where the asker has neither,
  as `shape-project` is.
- **2 to 5 options**, each a `label` and an `argument` that says what happens if it is picked: what the agent does
  next, and what it costs. A question with one option is an instruction; a question with six has not been thought
  through.
- **The pick comes first and is marked `"suggested": true`**, the only option so marked, and Advice says why. Where
  the agent truly has no pick it invents none: no option is suggested, and Advice says there is no pick and why. No
  argument repeats the pick: the recommendation is in Advice and on the option, nowhere else. An orchestrator
  raising an implementer's `## Question` or a reviewer's `Escalates` block passes its fields through unchanged and
  keeps its order and its pick. `shape-project` does not recommend: it puts the likeliest answer first, marks no
  option suggested, gives no Advice and takes the PO's answer as given.
- **At most 1,000 characters** each in the question, the context, the trade-off, the advice and each argument; a
  label at most 60 and `"meanwhile"` at most 500. A context that would not fit lists the worst items, then says how
  many more there are and where they are ("and 4 more MINOR findings, in c12").
- **`"meanwhile"`** says what continues while the question is open, or that nothing does.
- **Longer context goes in a comment first**, then `"comment": "cN"` ties the escalation to it. The comment holds the
  whole of it; `"context"` still carries the specific thing.
- **A raise the server refuses is not retried as it was.** The CLI's message names the code, `invalid_context` and
  the like. Fix the field in the file and raise once more:
  - `invalid_context` has two causes. A context that is only a reference: write the specific thing behind it, one
    plain line each. A context over 1,000 characters: cut it to the worst items, one line each, and end with how many
    more there are and where.
  - `invalid_question` (empty, or over 1,000 characters), `invalid_tradeoff` and `invalid_advice` (over 1,000),
    `invalid_meanwhile` (over 500) and `invalid_options` (not 2 to 5, a label empty, over 60 or repeated, an
    argument over 1,000, or more than one suggested): shorten or fix that field, keeping what decides the question.
  - **A second refusal stops the turn**: raise nothing more, and say which escalation on which issue was not raised
    and what the CLI printed. The work that would have waited on it does not go on.

  A raise the CLI refuses with `Unknown option '--type'` (or `--context`, `--tradeoff`, `--advice`) is a Leeway
  server older than LWY-159, which this plugin needs: raise nothing more and stop the turn, saying that the
  escalation was not raised because the server at `<server>` has no escalation type, context, trade-off or advice
  yet, and needs a Leeway with LWY-159.
- **Then wait for the answer, in every skill that raises**: `run`, `plan-project`, `shape-project`, `sync-repo`,
  `sdlc-install` and `sdlc-tune`. Say once what it waits on and until when, start one background wait per open escalation of the round, all together, on
  `scripts/wait-answer.mjs` (as `HARNESS.md`, "Waiting for an answer", says), act on each exit as run's "Wait, then carry on"
  does, and on an answer, once every escalation of the round is answered, carry on as a re-invoke of that skill would, writing nothing twice: each skill says where an answer takes it. An
  answer that needs a person to act first is put to them as an escalation and waited on too (run's "Wait, then carry
  on"). Where `HARNESS.md` says `wait: stop`, no wait starts: act at once as for exit 2. A wait that holds work stops
  the turn only when:
  - it ends without an answer (exit 2, about 16 hours; exit 3, Leeway unreachable), naming the escalation and the issue;
  - it ends on a blocker outside Leeway (exit 4, `leeway login`), naming the action;
  - it ends in a bug (exit 1) or never ran (any other exit), saying so;
  - the answer to a question asked of the agent is not written (the next point);
  - or the answer ends the work.

  A wait that blocks nothing (run's debt proposal once its task has landed, "Land the task", step 5) does not stop the
  turn on exit 2, 3 or 4, nor on an answer that is not written: it says once that the escalation stays unanswered and
  carries on. Either way, do not continue the work that depends on the answer, and do not ask again somewhere else.
  A question asked of the agent while it waits does not end the wait (the next point).
- **A question asked of the agent is answered, then the wait starts again.** A person can ask the agent about an open
  escalation before deciding it, and the wait exits 5 on the question, printing
  `{"clarification":"qN","question":"…","askedAt":<ms>}`. The orchestrator answers it, never a subagent:
  1. **Answer from what you know**, reading the code where that settles it, and the questions already answered on
     that escalation, so the answer agrees with them: `leeway clarification list <ref> <eN> --json`. At most 1,000
     characters. An answer that changes the options or the advice says so in its text; the escalation itself is not
     changed.
  2. **Write it as the role that raised the escalation**: `<role>` is `by.actor.role` of the escalation's entry in
     `escalations[]` of `leeway issue get <ref> --json` (the entry whose `ref` is `<ref>` and `number` is N; a null `by.actor.role` is answered as `<alias>/agent`), and
     `<ref>` and `<eN>` are those of the wait. The answer goes in from a file, never inline, since an answer drawn
     from the code can hold a backtick or a `$` the shell would run: in `run`, a file where run's other bodies go
     (run, "Where `run`'s own files go"); in any other skill, a file outside the repo, by absolute path.

     ```sh
     leeway clarification answer <ref> <eN> <qN> --as <alias>/<role> --stdin answer < <file>
     ```

  3. **Say once in the session** that qN on eN is answered, and until when the new wait runs: "Answered q1 on e2 of
     DRY-2.1; waiting again until <the time 16 hours from now>."
  4. **Wait again on the same escalation**, the same command, with 16 hours of its own.

  Nothing else is written: no second escalation and no comment for it. A question is not the answer: do no work
  that depends on the escalation, and carry on only on exit 0. A CLI refusal is not at once an outage: a refusal with `invalid_clarification_answer`
  (an answer over 1,000 characters) is shortened and written once more, not treated as an outage; an empty answer refused the same way is written again with its text. **If the answer is not
  written** (the CLI refuses it, Leeway does not answer, or it asks for `leeway login`), do not wait again, because the question still open
  would end the next wait at once: act as for exit 4 where the CLI asked for `leeway login`, and as for exit 3
  otherwise, naming the escalation and the question and saying what the CLI said. Where the wait holds work, that
  stops the turn, and a re-invoke waits again and meets the question again. Where it blocks nothing, say once in the
  session that qN on eN is unanswered, and carry on as on exit 3 or 4.
- **On resume**, read the answer on the issue (`leeway issue get <ref> --json`). An open escalation with
  no answer means do not proceed, and only its answer is one: a comment, a status change or an edited
  description is not.

**Escalations go out in rounds.** A round is the escalations raised together, for one person to answer in one
sitting. These hold for every skill, however few or many questions it has:

- **Check the round before raising it.** Would one answer settle or change another question? Merge them into
  one, or hold the dependent one for the next round.
- **Independent questions go out together.** Do not ration them: the first round covers as much ground as it
  can, and later rounds are follow-ups only.
- **A later round drops what an answer settled.** It is not asked again, and it is not raised for confirmation.

An implementer that returns `BLOCKED` carries a `## Question` section. The orchestrator does not
paraphrase it: it runs the gate on the brief, posts the brief as a comment, raises the escalation from the
block, and waits. **An escalation never moves an issue**; a status changes only by `--step` or `--status`.

## Records

Every artifact of the loop is a Leeway record. The orchestrator writes each one.

**An issue the agent files always has a summary**: every `issue create` passes `--summary`, at most 280 characters
saying what the issue is and why, in plain words. An issue a skill adopts with an empty summary gets one with
`issue update <ref> --summary "…"`, naming only that field.

| Loop artefact | Record |
|---|---|
| plan / story / task | project / issue (its type from the process) / sub-issue |
| branch | `issue update <ref> --branch <prefix>/<ref lower>-<slug40> --repository owner/repo`, read back |
| round | commit and push the task branch, then `iteration record <ref> <sha> --tests "<lane line>" [--passed] --addresses '["c1","c2"]' [--tokens N] [--minutes N] [--testMinutes N] --note "…" --as <impl>/implementer` (`--passed` is a valueless flag: a lane that failed omits it and starts `--tests` with `FAILED:`; `--tokens` is new tokens, input + cache writes + output summed over the agent's model calls and never cache reads, counted by `scripts/session-tokens.mjs` as `HARNESS.md`, "Counting tokens", says, and left out when they cannot be counted, never `0`); the round count is the iterations; round-0 attempts are those before the `step_set {to: implementing}` entry |
| spend outside a round | `spend record <ref> <minutes> [--tokens N] --note "…"`: a round's review, its orchestration, or a round that records no iteration, on its sub-issue, and the run's own time (the baseline, landing a task, the story gate) on the story; totals are read back from `issue get <ref>` (`totals`), never from a comment |
| brief / finding / verdict | `comment add --stdin body --as <impl>/implementer` (opens `# Handoff brief — <ref> · round <N>`) / `comment add --anchor '{"iteration":N,"path":…,"start":s,"end":e}' --as <rev>/reviewer` / `comment add --kind review --iteration N --settles … --disputes … --raises … --as <rev>/reviewer` (opens `# Review verdict: PASS — <ref> · round <N>` or `# Review verdict: FAIL — <ref> · round <N>`) |
| dispute needing a human; a hard stop of `run` on an issue | an escalation, raised by `<raise>` from a file of its fields: `type`, `question`, `context`, `tradeoff`, `advice`, `options`, `meanwhile` (Needs you is the one interrupt) |
| plan gate | the coverage report as a comment per story by `<div>/reviewer` (`<div>` is the divergence reviewer's alias); each QUESTION in it a top-level comment of its own opening `# QUESTION <n> of c<report>` (`c<report>` the report's first comment), with one escalation tied to that comment with `--comment cN`, and the answers applied as a reply to it opening `# QUESTIONs applied`; the story at the plan gate step, then `--status ready` by `plan-project` on a PASS (on PASS WITH DECISIONS after `# QUESTIONs applied`), with a comment opening `# Moved to ready` that names the report's `cN` and its verdict; a RETURN stays at the plan gate, and moving it back to the plan step returns it |
| shaped step to plan step | `plan-project`'s move of the story from the shaped step to the plan step, with a comment opening `# Planning started` saying running it was the approval of the body |
| technical criteria a story body points to | the comment opening `# Technical criteria`, latest wins |
| nits / friction | comments on the project's nit collector / one issue of type chore per item in the product's friction project (`friction-project:` in `.sdlc/leeway.md`) |
| status | always `issue update --step` or `--status`; never by iteration or escalation; a move the person asks for as `<alias>/agent`, named in the session ("The cast") |

## Where a finding goes

Not every finding is open work. **If you cannot name the consequence of leaving it, it is a nit.**

| The finding is | What you do |
|---|---|
| Security, isolation or data exposure — any severity. Or a correctness bug reachable in production | **File it now** as an issue. No approval, no delay |
| Technical debt — the fix is a design decision, not a chore | **Propose it, and file only on a human yes** |
| Anything else | **One line, as a comment on the nit collector.** No issue |
| Friction — a tooling, test-data, local-setup or process gap that cost the task time | **Propose it for the friction project, and file only on a human yes**, one issue per item |

Without this bar every finding becomes a ticket: most hang off no story, stay open, and some say in their
own description that nothing is broken. A ticket costs a human's attention; a nit costs a line. A finding
accepted at PASS but left unaddressed is **already recorded**, in full, in the round it came from.

## Definition of done

On top of what your repo's floor says every change owes:

- Evidence per the ladder, in the task's round record, and committed durably for a change at or above the
  rung `.sdlc/CONFIG.md` names.
- The round records carry the **full** brief and the **full** verdict, not a summary, within the size
  limits in "How the plugin reaches Leeway": over the comment cap, the brief spans a comment and a reply and
  the verdict names findings posted as their own comments. Both reach the
  orchestrator as the subagent's final message and are written to no file by the subagent, so the record
  in Leeway is the only lasting copy.
- A task lands deliberately: PASS, merge into the story's worktree, `--status done`. The story is closed at
  the story gate, by the orchestrator setting `--step` or `--status`, and nothing else moves it.
- A plan is done once it has merged into `main`, on the person's word. With a plan branch, at its last story
  the Plan record goes `in_review`, with the plan's pull request linked on the project, and it goes `done` only
  once that pull request reads `merged` (`run`, "When the plan merges into `main`"). With no plan branch, the
  stories merge into `main` one by one, and the Plan record goes `done` only once every `done` story reads merged
  into `main`, and `in_review` until then (`run`, "The plan's end").
