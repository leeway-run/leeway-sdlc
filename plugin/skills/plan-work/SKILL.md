---
name: plan-work
description: Plan a piece of work before any code is written - check each story's product side and send its gaps back to the PO (when its type has a shape step), write the design doc and the story's technical criteria, create the Leeway project, its stories, their tasks and the dependencies, read back the branch names, and pass the plan gate (when the type has one) - an independent coverage review and a human decision. Runs only for an issue whose type has a plan step. Use when work spans more than one task, or touches a stated product rule, the schema, auth or ownership boundaries. Skip it for a one-file fix with an obvious test.
---

# Plan work

**Read `PROCESS.md` and `HARNESS.md` in this plugin first** (`HARNESS.md`: how this agent delegates, and whether
you write the governed-agent marker around it). Of `PROCESS.md`: "The cast", "How the plugin reaches Leeway", "The process, read at
runtime", "Before the plan: shaping", "The plan gate", "Questions to the human are escalations" and "Records". It is
the contract this skill executes, and invoking this skill is what opts the session into it.

You are the orchestrator wearing the planner hat. **You are the single writer to Leeway**: the hierarchy you
build is the one the subagents will read, and they are told to read only.

**Create the breakdown before any code exists.** Planning after the fact is not planning, it is documentation of
whatever happened.

## 0. Orient: the binding, the process, the type

1. **The binding.** Read `.sdlc/leeway.md`: `server:`, `product:` (the key, `<KEY>` below), `cli:` (`<cli>` below
   is that command) and the *Nit collectors* table. Read `.sdlc/CONFIG.md`: the doc map, *Plans directory*,
   *Plan branch*, *Ticket templates*. Pass `--server <server>` on every call. No token and no credential is
   written to a file or shown.
2. **Who writes.** `--as <alias>/planner` on every write, the alias this session's (`<word>-<two hex digits>`,
   for example `kestrel-b1`; one per session, never one already visible on the issues). The gate's coverage
   report is the one write made `--as <alias>/reviewer`. Reads carry no `--as`.
3. **The process, and the story's type.** `<cli> --json process get <KEY>`, then `<cli> --json issue get <story>`:
   `issue.type`, `issue.step` (an object: `issue.step.id`, or null), `issue.description`, `comments`, `escalations`. From the type's steps decide, and
   say, what this plan does:

   | The type has | So |
   |---|---|
   | no `plan` step | **Say so and stop.** Create no project, issue, comment or step; point at `run-task` for a type with `build`. Never plan a type the process does not plan |
   | a `shape` step | step 1, the product check, runs |
   | a `plan` step with `params.designDoc: true` | step 3 writes the design doc |
   | a `gate` step | step 8 runs the plan gate |

   The type's `branchPrefix` names its branches (step 6). A sub-issue takes its story's type.
4. **Start.** `<cli> --as <alias>/planner issue update <story> --step plan`. Skip it when `issue.step.id` is already
   `plan`. A story that already has tasks or technical criteria is a re-plan: read step 1's note on it.
5. **Where the human is asked.** This repo has a `.sdlc/leeway.md`, so a question for the human is never a
   terminal question: it is a Leeway escalation on the story, and then you stop the turn. Post the context first
   (`comment add <ref> --stdin body`), then `escalation raise <ref> --question "<at most 500 characters>" --options
   '[{"label":"<at most 60>","argument":"<at most 1,000>"}]' --meanwhile "<what continues, or nothing>" --comment cN`:
   2 to 5 options, each with its argument, one open escalation per comment. **On resume**, read the answers with
   `issue get` (`escalations[].answer`) and the story's step and comments, and carry on from the first thing not
   done; an open escalation with no answer means do not proceed. With no `.sdlc/leeway.md` there is no binding and
   this skill cannot run.

## Does this need planning at all?

**Yes** if it spans more than one task, or touches a stated rule in the intent doc, the schema, auth, or an
ownership boundary. **No** for a one-file fix with an obvious test — create the sub-issue (step 5) and run
`run-task`. The trigger is the shape of the work, not its size in lines: a two-line change to an isolation
predicate needs a plan; a 200-line UI component usually does not.

## 1. Product check, every story, every time (only when the type has `shape`)

**Before planning a story, check that it says what the work is for and what counts as done.** Whether it was
shaped with `shape-work`, written by hand, or shaped months ago and gone stale, the check is the same. A type
without `shape` skips this step: its issue is taken as written.

**This step writes nothing to the story body and answers no product question.** The PO's part is theirs, through
`shape-work`. Yours is the *Technical criteria* at its end, written in step 3 once this check passes.

**On a story planned before**, it already has *Technical criteria* — in the body, or in the latest `# Technical
criteria` comment — or tasks. Check the PO's part as usual, then read the comments since the *planned by* date: an
`AC-n` the PO changed since makes every `TC-n` and task that serves it stale, and step 3 rechecks them.

**No body yet** (an empty description) → nothing to check. Stop and point the developer at `shape-work` with the
PO. You do not write criteria.

### Read the story against its template

The story template: `STORY.md` in the directory *Ticket templates* names (`.sdlc/templates/`); without that row,
`skills/sdlc-install/scaffold/templates/STORY.md.tmpl` in this plugin. The gap checklist:
`skills/shape-work/references/gap-checklist.md` in this plugin. **Read both now — this skill repeats neither.**
Read the description and every comment, the intent doc, and the surfaces the story touches in the code.

### List the gaps

| Gap | What it looks like |
|---|---|
| **missing** | no numbered acceptance criteria; a heading of the PO's part that is absent or empty. `n/a: <why>` is an answer |
| **hollow** | "TBD", "standard error handling", "as usual", the title restated as a criterion |
| **open** | any `OPEN:` line |
| **no negative** | a story the checklist's *What must not happen* applies to — data scope, roles, permissions or isolation; or data it moves, copies, deletes or replaces — without the rule it requires |
| **stale** | a criterion that contradicts the intent doc, or what the code does today. If the Status line has a date, `git log --since=<date>` on the intent doc shows what changed since shaping |
| **hidden scope** | a capability the story assumes and the code shows is not there, **when it needs a scope decision**: build it here, a fallback, or out of scope. One the criterion obviously needs and you just build is a task, not a gap |
| **too big** | the story should be two, or its part alone passes the 5,000-character description cap. Name the split you would suggest; the PO decides it |

A checklist row the story leaves open is **missing** only when it applies, by its *Applies when*. **Not gaps:**
*Open questions for dev*, which are your input for step 3, and a missing Status line.

### No gaps → plan it

Carry on. **Do not re-ask anything the body answers**, and do not re-litigate a decision the body records.

### Gaps → back to the PO

Post the gap list as **one comment on the story**, addressed to the PO: each gap with the heading it belongs to
and the question the PO has to answer, in product terms; hidden scope with your rough size of each option. Where a
technical finding has a consequence the user will see, say what it is and **propose wording for the criterion**,
marked as a proposal. End with: *"Answer these with `shape-work` on `<ref>`, then re-run plan-work."* Re-read the
latest such comment first: if the gaps are the same, do not post them again.

Then set the story back to the PO's step, `issue update <story> --step shape`, and raise one escalation, *"`<ref>`
has N product gaps: how do we proceed?"*, with the options *Hold; the PO answers with shape-work*, *Split the story
as proposed* (only for **too big**) and *Accept the gaps as written* (the answer's note says why, and the gaps go
into the body as `OPEN:` lines by the PO's hand). **A held story gets no tasks.** Then stop. The answer has to
reach the body before planning: planning on a comment makes a second source that drifts from the first.

**Several stories:** the ones that pass go on; the held ones wait. Name the held ones to the divergence reviewer in
step 8.

## 2. Read before designing

The **intent doc** first, from the doc map. If the design cuts against a rule, the plan says **which rule and
why** — an intentional tension stated out loud is a decision, an unstated one is a defect nobody catches. A doc
marked `stub` or `absent` is skipped, never cited. **A product rule the story cuts against, undecided in the
story, is not yours to decide:** it is a step 1 gap.

Then the **architecture doc** for how the pieces fit and what its known limitations already rule out, and the
**recipes doc** if the work is one of the recurring types it covers.

## 3. Write the design doc, then the technical criteria

**The design doc, when the type's `plan` step has `params.designDoc: true`.** In the repo, versioned with the
code, at *Plans directory* in `.sdlc/CONFIG.md`: `<dir>/<story ref lower>-<slug>.md`. Cover: data model, layer
boundaries, sequencing, tradeoffs, open questions. Then link it from the project description (step 5). **Write it,
or record why you did not**: without it no task can see the constraints of its siblings. When the step's
`designDoc` is false or absent, write none, and say in the project description that the story and task
descriptions are the source of truth. If the repo has a house-voice rule, run it over the prose.

### The technical criteria

**The story's criteria are final when this is written:** the PO's `AC-n` say what the user gets, and your `TC-n`
say what the build must hold to that the user does not see. Both are what the tasks serve, what round 0 writes red
tests for, and what the divergence reviewer traces.

Write a `TC-n` for each constraint **a reviewer would fail the work for ignoring**: a bound (a page size, a
timeout, a pool ceiling), a contract or schema that must not change, a sibling to match, an answer to an *Open
question for dev* that constrains the build, hidden scope you are building. A design choice nobody would fail the
work over stays in the design doc. **A small change or a trivial implementation has none: leave the section out.**

- **The same writing rules as an AC:** a short name with its rules under it, no Gherkin, a rule a check could fail.
  "Performant" is not a criterion; "one query per page" is.
- **Short, and by reference.** A TC states the rule and points at where the detail lives; the rationale goes in
  the design doc.
- **A `TC-n` never changes what the user gets.** If a technical finding does, it is a step 1 gap with your
  proposed wording, not a TC. On a type without `shape` there is no PO: decide it with the human by escalation.
- **Numbers are stable**, as for ACs: a new one at the end, a dropped one as `TC-n (removed: <why>)`.
- **On a re-plan**, for each `AC-n` the PO changed, recheck every `TC-n` that serves it and every task — change,
  drop or keep each, and say which.

**Write only your section.** The body is the PO's part **byte for byte as you read it**, your *Technical
criteria* after *Open questions for dev*, and the Status line's second half: `· planned by <developer> on
<today>`. Re-read the description immediately before writing and stop if it changed since you read it. The
developer's yes is not asked here; the plan gate (step 8) is the human's look at the TCs, and a type without a
gate is watched by the developer in this session.

### The 5,000-character cap, and the overflow

An issue description holds at most 5,000 characters, counted by the server as UTF-16 code units of the trimmed
text. Count the full body you are about to write the same way, from the file you will send (`wc -m` depends on
the locale and can count bytes):

```sh
node -e "process.stdout.write(String(require('fs').readFileSync(0,'utf8').trim().length))" <body
```

**Treat 4,800 as the line**: a body over it overflows, which leaves room for the pointer line and a late edit.

1. **Cut your section first** — verbose rules, restated detail a pointer can carry. Never shorten the PO's part.
2. **Still over → overflow to a comment.** The whole *Technical criteria* section moves to **one story comment
   whose body opens with the heading `# Technical criteria`** (`comment add <story> --stdin body`, at most 20,000
   characters), the `TC-n` in full. In the description, the `## Technical criteria` heading stays with one line
   under it: *"In the latest `# Technical criteria` comment on this story."* Never split the TCs between the two,
   and never truncate.
3. **A revision posts a new comment with the full list**, numbers unchanged. The latest such comment is in force;
   never edit an earlier one.
4. **Criteria that move back into the body** (a re-plan whose TCs now fit under the line) leave the older comment
   as the latest, and so in force. Post a final `# Technical criteria` comment first, whose body is the heading
   and one line, *"Moved to the story description; this comment list is closed."*, then write the description with
   the section in full.
5. **A `# Technical criteria` comment over 20,000 characters** is not cut and not split: the story should be two.
   Say so and stop, as for the PO's part.
6. **The PO's part alone over the cap** is a story that should be two: a step 1 gap.

Whoever reads the criteria reads the body **and** the latest `# Technical criteria` comment when the body points
to one. Post the comment first, then write the description with `issue update <story> --stdin description` from a
file outside the repo by absolute path or a quoted heredoc, so a pointer never exists without its comment. Then read
it back: its length (counted as above) is at most 5,000 and, when it overflowed, the
comment exists and holds every `TC-n` (count them: the list is as long as the plan's).

## 4. Two lists, and never one

A plan has a **work breakdown** and a **hazard register**. They are different objects, and the tasks come from the
first one.

**The breakdown is made of surfaces.** The files, layers and boundaries the change has to touch, sliced into
pieces someone can finish. Where the recipes doc already covers this change type, it *is* the breakdown. Start
from that, not from a blank page.

**The hazard register is made of dangers.** The things that break silently, the traps a neighbour already fell
into, the invariant this change could violate. Each entry names:

| Hazard | Owning task | The check that proves it closed | Rung |
|---|---|---|---|
| the quoting helper doubles backslashes; the engine treats them literally | `<task>` | `test-display-ident` row `backslash: a\b` | R1 |
| schema mode falls through the isolation check reporting ok | `<task>` | two credentials, two verdicts, live | R4 |

**A hazard that no task owns is the planning bug.** Say so in the doc rather than folding it into whichever task
is nearest.

**A rule made of conditions gets one row per condition.** When a criterion depends on a rule built from N
conditions — an access gate, a status filter, an eligibility check — list the conditions from the code, not from
the story, and give each its own row, proven by a check in which **only that condition fails**. A fixture that
fails two conditions proves neither.

**Do not turn the hazard list into the task list.** Tasks cut from hazards come out wildly uneven in size, hazards
folded into one task lose criteria of their own, and the real tasks no hazard names get specified thinnest.

## 5. Create the hierarchy

A **project** (the plan) holding **issues** (the stories), each holding **sub-issues** (the tasks), plus the
**Plan record** issue (the nit collector). Bodies go in with `--stdin <field>` from a file by absolute path
outside the repo, or a quoted heredoc; one `--stdin` per call. Read each new id from the `--json` output:
`project.id` for a project, `issue.ref` for an issue. A title is at most 200 characters.

1. **The project: adopt, or create.** A story that is already in a project (`issue get`: `project.id`) is
   planned in that project; adopt it, never duplicate it. Otherwise:

   ```sh
   <cli> --server <server> --as <alias>/planner --json project create <KEY> --name "<plan name>" --summary "<at most 280 characters>" --stdin description <plan.md
   ```

   The description (at most 5,000) links the design doc, names the plan branch if *Plan branch* in `CONFIG.md`
   asks for one (`feat/p_<first 8 hex of project id>-<slug of the name, at most 40>`; `none` means stories branch
   from the integration branch and there is nothing to name), and carries the first status line. A project has no
   settable status: its status updates are comments on the Plan record.

2. **The Plan record, now, once, in the project:**

   ```sh
   <cli> --server <server> --as <alias>/planner --json issue create <KEY> --projectId <projectId> --type <type> --title "Plan record" --status backlog --stdin description <record.md
   ```

   `<type>` is `chore` when the process has it and it has no `shape`, `plan` or `gate` step; else the first type in
   `process get` with none of the three (a bug counts on the board as a defect, so `chore` is preferred); else the
   process's default type, so the record is not plannable work; the record's description says which type
   it took and why.

   Its description says what it is: one comment per nit and per status update, never an edit to its body. It stays
   `backlog` while the plan runs: it is not work anyone picks up. Create it **with the plan**, not when the first
   nit arrives: a container invented mid-flight gets invented differently every time. Then:
   - **write its ref into the project description** (`project update <KEY> <projectId> --stdin description`,
     now ending `Plan record: <ref>`) and read it back with `project get`: re-read the description first, since
     the resend replaces it;
   - **append `| <projectId> | <ref> |` to the *Nit collectors* table in `.sdlc/leeway.md`**, unless a row for
     that project id is already there. **This is the one repo file this skill edits.** It is a binding file, so
     it holds an id and a ref and nothing else; stage it for the orchestrator's commit;
   - post the plan's first status line: `comment add <ref> --stdin body`.

   Adopting a project that already has a row there: use that collector, and create nothing.

3. **The stories**, in the project, one issue each. A story that exists is adopted. One the work needs and nobody
   wrote is created here only for a type without `shape`; for a type with `shape` it is a step 1 gap (`shape-work`
   creates it). Pass the type explicitly:

   ```sh
   <cli> --server <server> --as <alias>/planner --json issue create <KEY> --projectId <projectId> --type <type> --title "<story>" --status backlog --stdin description <story.md
   ```

   The body is the story template from the rule down (the "Notes for the writer" block above it is never
   written). The **repository** is the one connected to the product: `product get <KEY> --json` shows
   `repositoryCount`. With one, a `--branch` alone uses it; with more than one, or on a `repository_required` or
   `invalid_repository` refusal, take `owner/repo` from `git remote get-url origin`, and where there is none, ask
   once by escalation. Then `issue update <story> --repository <owner/repo>`, once, on the story; its sub-issues
   inherit it.

4. **Floor questions, per story, before its tasks.** Read the repo's floor (`ENGINEERING.md`) and the intent doc
   for a rule that asks for a decision on each user-facing story before it is built (for example whether a
   feature belongs on every surface a person uses). **User-facing** means a story whose acceptance criteria name
   something a person does through a surface. For each such story post the context as a comment, quoting the
   rule's own sentence, and raise that rule's question as an escalation. Its options are the alternatives the
   rule states; where it states none, one option per surface the rule names (a "yes" for that surface) plus *Not
   on any surface*, so leaving it out is a decision. **Stop**, report the escalation ids,
   and create no tasks for a story whose question is open. On resume write each answer into every task of that
   story under *What to build*. A story that builds nothing a user does, or a repo whose floor asks nothing,
   skips this step; say which.

5. **The tasks**, each under its story, with `--parent` **set explicitly on every one**, never relying on
   inheritance; a sub-issue has no children:

   ```sh
   <cli> --server <server> --as <alias>/planner --json issue create <KEY> --parent <story> --title "<task>" --status backlog --stdin description <task.md
   ```

   At most 100 sub-issues per issue: a plan that wants more is two stories. The description is at most 5,000
   characters; a task that needs more puts the rest in its first comment (`comment add <ref> --stdin body`), and
   the description says so.

6. **Order is the blocking relation**, task by task, after all exist: `dependency add <ref> <blockedBy ref>`. Read
   it back on `issue get <ref>`: `issue.blockedBy`.

7. **Branch names: derive, write back, read back.** The server stores a branch and does not generate one. For the
   story and each task derive `<prefix>/<ref lower>-<slug>`, `<prefix>` being the `branchPrefix` of the story's type (`feat` for a
   feature: `feat/dry-4.1-schema-table` for `DRY-4.1` titled "Schema table"). The slug is the title lower-cased,
   every run of characters outside `[a-z0-9]` replaced by one `-`, leading and trailing `-` trimmed, cut at 40
   characters, trailing `-` trimmed again:

   ```sh
   printf '%s' "<title>" | node -e "process.stdout.write(require('fs').readFileSync(0,'utf8').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+\$/g,'').slice(0,40).replace(/-+\$/g,''))"
   ```

   Do the story before its tasks. Write it back, read it back, and **use it verbatim for the rest
   of the loop** — the embedded ref is what ties a branch to its item:

   ```sh
   <cli> --server <server> --as <alias>/planner issue update <ref> --branch <prefix>/<ref lower>-<slug>
   <cli> --server <server> --json issue get <ref>      # issue.branch
   ```

   A sub-issue gets `--branch` only: it takes its story's repository.

## 6. What a task description contains

**Title:** short imperative, around 60 characters, reads well on a card.

**Description:** the meaty part. A reader must be able to pick up the task from the description alone. The shape
is `TASK.md` in the ticket templates, with `skills/sdlc-install/scaffold/templates/TASK.md.tmpl` in this plugin as
the fallback. **Read it before writing the first task**, fill every heading, and write the description from the
`## What to build` line down: the "Notes for the writer" block above its rule is never written to Leeway. No HTML
comment. "Nothing unbounded here" is an answer; a missing *Bounds* is not.

Four of those headings each name something review otherwise has to supply from scratch: **Bounds**,
**Parity**, **Negative case** and **Out of scope**. *Serves* names the `AC-n` and `TC-n` the task delivers, by
number and story. **A *Parity* source that does the same job gets an extract-or-copy decision**, made here, not in
review; an extraction widens the task's files, so the human decides it at the gate when it changes the scope.

**A done-when made only of things that pass is half a specification.** Name the thing that must be refused,
denied, or absent. If a round-1 review shows the description itself instructed the defect, **fix the description
before round 2** and say so inline (send the whole corrected text, after re-reading it).

## 7. A status moves only by --step or --status

A status or a step is set by `issue update --step <id>` or `--status <status>` and by nothing else: no comment, no
escalation and no iteration moves a story. Setting a step sets the step's status in the same write. Step 0 set
`plan`; step 1 may set `shape`; step 8 sets `gate`, and `--status ready` when the gate passes.

## 8. The plan gate

The last step, once the whole hierarchy exists. **No task starts before it.**

**A type without a `gate` step** goes from plan to ready with no gate: `issue update <story> --status ready` (no
step), the end of this skill.

**A type with one**: `issue update <story> --step gate`. You wrote the plan, so you are the one reader who cannot
check it: an artifact cannot audit itself. So a fresh context does, and a human decides.

### Delegate to the divergence reviewer with ids, not a story

Delegate to the **sdlc-divergence-reviewer** agent, fresh, as `HARNESS.md` describes; where it says
`governed-marker: required`, run its `on` command first and its `off` command as soon as the agent returns,
however it returns. Pass:

- The **project id** and the story refs of the plan, or the story ref when the work has no project of its own.
- The refs of any stories **held at step 1**, named as held, so it lists them rather than tracing them.
- The **path to the design doc**, or that there is none.
- The **doc map** from `.sdlc/CONFIG.md`, with each doc's `real` / `stub` / `absent` state.
- Whether it can read Leeway, and how: the real `<cli>`, `--server <server>`, read verbs only. **If it cannot,
  paste the verbatim description of every project, story and task, and the latest `# Technical criteria` comment
  of every story whose body points to one.**

**Never your summary.** Not which task covers which criterion, not why the plan is right, not what you were
worried about: the critical input is the items as written, and your account of them is the thing being checked.

### Gate the reply

- The report arrived as the agent's **final message**, opening with the proof-of-life output and a read log.
- **Run `git status --short` yourself**; it must be what it was before the spawn. A read-only reviewer that changed
  the tree did something it was not allowed to.
- **The read log matches what you created.** Every project, story and task ref you made is in it, with the title
  as Leeway holds it, and the `# Technical criteria` comment is a row of its own when a body points to one.

| | Symptom | Response |
|---|---|---|
| **Hallucination** | read log missing, refs or titles that do not match Leeway, a tree that changed | re-spawn with the prefix *"You hallucinated tool calls in your previous run. Use real tool invocations only."* Second failure → **do not run the review yourself.** Tell the human the gate degraded and put the hierarchy in front of them to trace by hand |
| **Truncated report** | the read log matches, the report is cut short | re-spawn: there is no staged work to lose |

### Post the full report, then ask

Post the **full report** as a comment on each story it covers, **`--as <alias>/reviewer`**: every row of that
story's coverage table, every finding. Not a summary: the report reaches you as the agent's final message and is
written nowhere else. A report over the 20,000-character comment cap goes across the comment and a reply
(`comment add <ref> --parent cN --stdin body`), never cut.

**Then raise the human's decision as one escalation on the story**, as `<alias>/planner`, tied to the report with
`--comment cN`. The verdict is the reviewer's recommendation; the decision is not the reviewer's and not yours.

```sh
<cli> --server <server> --as <alias>/planner escalation raise <story> --question "Plan coverage for <story>: <verdict>, N questions. Gate decision?" --options '[{"label":"PASS","argument":"..."},{"label":"PASS WITH DECISIONS","argument":"..."},{"label":"RETURN","argument":"..."}]' --meanwhile "No task starts." --comment cN
```

Each option's argument says what it does and, from the report, why: *PASS* opens the gate; *PASS WITH DECISIONS*
needs a written answer to every QUESTION; *RETURN* names the BLOCKERs. Then **stop**, naming the escalation and the
story.

### The answer moves the story

On resume, read the answer on the story:

- **PASS** → `issue update <story> --status ready`. No step: `run-task` sets the build step when it starts, so a
  story is never `in_progress` with nobody on it.
- **PASS WITH DECISIONS** → raise one escalation per QUESTION (the options the report gives, 2 to 5), and stop.
  When every one is answered, change what an answer changes in a description or a task, then `--status ready`.
  An unanswered QUESTION is a closed gate.
- **RETURN** → `issue update <story> --step plan`, fix the items the BLOCKERs name, and spawn a **fresh**
  reviewer — never the same one with a note about what changed. The next round posts its own report comment.

**A human may overrule a BLOCKER, and you may not.** They answer it in the escalation's note, with the reason. You
never downgrade a finding to get the plan moving.

**Three RETURNs mean the story is wrong, not the plan.** When the type has `shape`, stop re-planning: set
`--step shape` and post what the three rounds could not trace as a step 1 comment to the PO. The reviewer is
tracing a story that does not say what anyone means by it.

**What is lost.** The gate checks that the plan traces to the story, not that the story is right or the design is
good. A criterion nobody wrote down cannot be found missing.

## Done when

There is a project (adopted or created) with its design doc linked from it where the type asks for one and its
plan branch named where `CONFIG.md` asks for one, a hierarchy in dependency order under it, the Plan record with
its ref in the project description and a row in `.sdlc/leeway.md`, branch names read back, and a first task
someone could pick up from its description alone.

Plus: **every hazard names an owning task**, or the doc says which one does not and why. Every task's done-when
names at least one thing that must be proven false. Every story passed the product check — or its gaps went back
to the PO as one comment and it has no tasks. Every planned story's description is at most 5,000 characters, with
its *Technical criteria* in the body or, pointed to from it, in the `# Technical criteria` comment, and a *planned
by* half on its Status line. And, for a type with a gate, the report is posted and a human's PASS — or their
answer to every QUESTION — is on the story, and the story is `--status ready`.
