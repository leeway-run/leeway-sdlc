# The contract for delegated work

**Status at this version.** `0.2.0` holds everything this file names: the hooks (`git-guard`, `leeway-guard`,
`version-notice`, and the adapters that run the guards in other agents), the three agents, the templates and the
skills (`sdlc-install`, `sdlc-tune`, `shape-project`, `plan-project`, `run-task`, `run-story`, `update`, `sync-repo`).

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
| Implementer | `sdlc-implementer` subagent | code, tests, `git add`, the handoff brief | commit, merge, push, write to Leeway |
| Reviewer | `sdlc-reviewer` subagent | running the lanes, the diff review at the depth the process sets, the verdict | fix code, commit, write to Leeway |

The human is not a role the loop plays. The human decides what only a human can, and is reached by an
escalation.

**The alias and the role.** The orchestrator chooses an alias per session of the form `<word>-<two hex digits>` (for
example `kestrel-b1`, matching `^[a-z][a-z0-9-]{1,23}$`), never one already visible on the issue. Every write carries
`--as <alias>/<role>`, the role being `implementer`, `reviewer`, `planner` or `agent` (the CLI's four). The
orchestrator's own words, and a skill acting for it, write as `<alias>/agent` (planning as `<alias>/planner`, the plan
gate's report as `<alias>/reviewer`); subagents never write, so their entries are the orchestrator's under their role.

**Two invariants make it work.**

- **One writer to Leeway, all readers.** Only the orchestrator writes: `issue create` and `update`,
  `comment add`, `iteration record`, `escalation raise`, `dependency`, `project` and `process` writes.
  Every write is attributed (`--as <alias>/<role>`), and a second writer makes the history unreadable.
  Reading touches none of that, so subagents read freely and are expected to: a ref in a code comment,
  a sibling task, an earlier round is context the next person to touch it needs.
- **One writer to git.** The orchestrator. Subagents may only `git add`.

**Both are enforced for this plugin's own agents, by hooks.** `git-guard` blocks a governed agent's
git writes; `leeway-guard` blocks a governed agent's `leeway` call whose verb is outside
`get|list|whoami|help|version`. In Claude Code a governed agent is one whose type carries the `leeway-sdlc:`
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
- Long bodies go in through `--stdin <field>`, so a brief or a verdict is not squeezed through a shell
  argument.
- **Size limits.** A comment body is 1 to 20,000 characters, a description at most 5,000, a title at most
  200, `--tests` at most 200, and `--stdin` is capped at 64 KiB. A brief over the comment cap goes in whole
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
| `plan` | The planner works the issue into tasks (sub-issues) with `dependency add` between them, writes the design doc when the step's `designDoc` param is true, and adds technical criteria (`TC-n`) to the story. When the type also has `shape`, a product check comes first: it reads the product owner's part, writes nothing to it and sends any gap back as one comment |
| `gate` | The plan gate (below). A type without `gate` goes from plan to ready with no gate |
| `build` | The loop (below), run by `run-task` for each sub-issue and by `run-story` for a whole story. Its params set the rest: `redTests`, `round0Cap`, `roundCap`, `review`, `blockingRungs`, `unattended` |
| `manual` | A human step: "try it", "verify on dev", "keep or drop". The plugin sets the step, says what it is waiting for and stops. It never does the work, and it never moves the issue past it |

**A type without a `build` step is one the plugin does not run.** `run-task` says so and stops.

**Statuses and steps are set, never inferred.** The plugin moves an issue only with an explicit
`issue update <ref> --step <id>` or `--status <status>`. Setting a step also sets its status in the same
write. No iteration, escalation or comment moves an issue; a lasting state is something a person or the
orchestrator chose. After a gate passes the orchestrator sets `--status ready`; `run-task` sets the build
step when it starts, so an issue is never `in_progress` with nobody on it. Each sub-issue has two steps of
its own, `red-tests` and `implementing`, and is `in_review` while the reviewer has it.

## Before the plan: shaping

A story is shaped before it is planned, and by someone else, when its type has a `shape` step. The
**product owner** runs `shape-project` and writes the story body: scope, acceptance criteria, design link,
out of scope, and the questions left for a developer. A developer then runs `plan-project`, whose first
step is a **product check**. A story that passes gets its **technical criteria** (`TC-n`) from the
developer, at the end of the same body, unless the change is small or trivial: the `AC-n` say what the
user gets, the `TC-n` what the build must hold to. Together they are final, and the tasks, the red tests
and the plan gate all work from both. An issue description holds at most 5,000 characters; where the
technical criteria would not fit, they move to one comment that opens `# Technical criteria`, the latest
one wins, and every reader reads it with the body.

| Part of the story | Owner | Written through |
|---|---|---|
| The body down to *Open questions for dev*: scope, `AC-n`, `OPEN:` lines | the product owner | `shape-project`, or by hand in the same shape |
| *Technical criteria* (`TC-n`) | the planner | `plan-project`, after the product check; the overflow comment when the body would not fit |
| The design doc, the tasks, the dependencies | the planner | `plan-project` |
| A change to a frozen test | the criterion's owner: the product owner for an `AC-n`, the planner for a `TC-n` | the round record, then the body |

**This does not break single-writer.** Shaping is not delegated work: no subagent runs. From the first
planned task on, the orchestrator is the one writer.

## The plan gate

For a type that has a `gate` step, planned work passes one gate before any code exists.

1. The divergence reviewer gets the **refs and the doc map, never the planner's summary**, and reads the
   plan, the stories and the tasks itself.
2. It returns a coverage table, findings tagged BLOCKER / QUESTION / NOTE, and a recommended verdict:
   PASS, PASS WITH DECISIONS, or RETURN. The orchestrator gates the reply like any other.
3. The orchestrator posts the **full** report as a comment on the story, then raises one escalation so a
   human decides, with the options PASS / PASS WITH DECISIONS / RETURN. RETURN goes back to planning. PASS
   WITH DECISIONS needs a human answer to every QUESTION. **No task starts before PASS.** The answer moves
   the story: `--step <next>` or `--status ready`.

**Why.** An artifact cannot audit itself. The planner reads its own breakdown with the story it had in
mind, not the story as written, and fills every gap from memory without seeing one. A fresh context with
no memory of the decisions reads only what is on the items, which is all an implementer will ever see.
The gap it finds costs one edit to a description; the same gap found in diff review costs a round, and
found after release costs a story. The decision stays with a human because the reviewer only measures
divergence: whether a divergence is a defect or a choice is a judgement about intent. **What is lost:**
it checks the plan against the story, not the story against what anyone wanted. A criterion never
written down cannot be found missing.

## The loop

One task at a time, each through the full loop, in a worktree of its own. Do not batch several into one
implementer run, and do not defer review to the end. `run-task` runs one task through it; `run-story`
runs every task of a story through it in turn, unattended, and only for a type whose `build` step says
`unattended`; it stops for a human only where one of its stop conditions fires, each ending in one
escalation.

A task at evidence rung R1 or above, in a type whose `build` params say `redTests`, first runs
**round 0**: the implementer writes only the failing tests its criteria call for, `AC-n` and `TC-n`
alike, skipped with the criterion named, and a reviewer checks them against the criteria. Round 0 is
capped by `round0Cap`. On a PASS the tests are **frozen**: later rounds turn them green by changing
production code, and changing a frozen test is a spec amendment only the criterion's owner can make. A
task whose type says `redTests: false` goes straight to implementing.

1. Delegate to the implementer. **Embed critical inputs; do not reference them.** A prompt carrying its
   own content survives a failed tool call; an agent whose first call fails silently fabricates
   everything downstream.
2. **Gate.** Independently run `git status --short` and `git diff --cached --stat` and compare against
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
not another loop: one escalation, and the work stops. **You may override a PASS, and you may not override
the cap.** If a finding is under-rated and you can say why, send it back and record the reason. An
override spends a round; the cap is what stops you spending them forever.

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

```sh
leeway --as <alias>/<role> escalation raise <ref> --question "…" --options '[{"label":"…","argument":"…"}]' --meanwhile "…"
```

- **2 to 5 options**, each with its argument. A question with one option is an instruction; a question
  with six has not been thought through.
- **`--meanwhile`** says what continues while the question is open, or that nothing does.
- **Longer context goes in a comment first**, then `--comment cN` ties the escalation to it.
- **Then stop the turn**, naming the escalation and the issue. Do not continue the work that depends on
  the answer, and do not ask again somewhere else.
- **On resume**, read the answer on the issue (`leeway --json issue get <ref>`). An open escalation with
  no answer means do not proceed.

An implementer that returns `BLOCKED` carries a `## Question` section. The orchestrator does not
paraphrase it: it runs the gate on the brief, posts the brief as a comment, raises the escalation from the
block, and stops. **An escalation never moves an issue**; a status changes only by `--step` or `--status`.

## Records

Every artifact of the loop is a Leeway record. The orchestrator writes each one.

**An issue the agent files always has a summary**: every `issue create` passes `--summary`, at most 280 characters
saying what the issue is and why, in plain words. An issue a skill adopts with an empty summary gets one with
`issue update <ref> --summary "…"`, naming only that field.

| Loop artefact | Record |
|---|---|
| plan / story / task | project / issue (its type from the process) / sub-issue |
| branch | `issue update <ref> --branch <prefix>/<ref lower>-<slug40> --repository owner/repo`, read back |
| round | commit and push the task branch, then `iteration record <ref> <sha> --tests "<lane line>" [--passed] --addresses '["c1","c2"]' --as <impl>/implementer` (`--passed` is a valueless flag: a lane that failed omits it and starts `--tests` with `FAILED:`); the round count is the iterations; round-0 attempts are those before the `step_set {to: implementing}` entry |
| brief / finding / verdict | `comment add --stdin body --as <impl>/implementer` (opens `# Handoff brief — <ref> · round <N>`) / `comment add --anchor '{"iteration":N,"path":…,"start":s,"end":e}' --as <rev>/reviewer` / `comment add --kind review --iteration N --settles … --disputes … --raises … --as <rev>/reviewer` (opens `# Review verdict: PASS — <ref> · round <N>` or `# Review verdict: FAIL — <ref> · round <N>`) |
| dispute needing a human; `run-story` hard stop | `escalation raise <ref> --question … --options '[…]' --meanwhile …` (Needs you is the one interrupt) |
| plan gate | the coverage report as a comment per story by `<div>/reviewer` (`<div>` is the divergence reviewer's alias); the human decision as an escalation with options PASS / PASS WITH DECISIONS / RETURN; the answer moves the story with `--step <next>` or `--status ready` |
| technical criteria overflow (description cap 5,000) | one comment opening `# Technical criteria`, latest wins |
| nits / friction | comments on the project's nit collector / one issue of type chore per item in the product's friction project (`friction-project:` in `.sdlc/leeway.md`) |
| status | always `issue update --step` or `--status`; never by iteration or escalation |

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
