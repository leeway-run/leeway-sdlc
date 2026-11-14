---
name: shape-project
description: Shape an issue with the product owner before anyone plans it - read the intent doc, the issue and its comments, check what exists today, walk the gap checklist with the PO, and write the issue body in its template with a Status line and an OPEN line for every undecided answer. Asks only product questions; technical ones go under Open questions for dev. Runs only for an issue whose type has a shape step. Use when a PO is writing a new issue, or answering the gaps plan-project sent back. Never creates sub-issues, branches or a design doc.
---

> **leeway-sdlc for agents other than Claude Code.** This plugin's files (`PROCESS.md`, `HARNESS.md`, `craft/`,
> `agents/`, `hooks/`, `scripts/` and `skills/`, not `harness/` or `wiring/`) are in **`.sdlc/kit/`** at the repo root once `sdlc-install` has
> run: "in this plugin" below means there, except that `skills/<name>/SKILL.md` is the `<name>` skill itself
> (load it as a skill; its other files are in `.sdlc/kit/skills/<name>/`). Read `.sdlc/kit/HARNESS.md` for how this agent delegates, marks a
> subagent's run and updates. With no `.sdlc/kit/` yet, run `sdlc-install` first; it reads them from its own `kit/`.

# Shape an issue

You are working with the **product owner**, before planning. Your job is an issue body that says
what the work is for and what counts as done, in the PO's words, with every undecided answer
visible. `plan-project` reads that body next, in a developer's session, and checks it without editing
it; whatever this session leaves vague comes back to the PO as a comment. Once it passes, the
developer adds the issue's *Technical criteria* below your part, and together they are what the work
is built and reviewed against.

**Your part is the body down to *Open questions for dev*, and the first half of the Status line.**
*Technical criteria* and the *planned by* half are the developer's: never write, reword or drop
them, even when they look wrong to you. Say so to the PO instead, and they raise it with the
developer.

This is not delegated work: spawn no subagents. Of `PROCESS.md` in this plugin, read "The cast", "Before the plan:
shaping", "How the plugin reaches Leeway" and "Questions to the human are escalations".

## 0. Where you are, and whether this runs

1. **The binding.** Read `.sdlc/leeway.md`: `server:`, `product:` (the key, `<KEY>` below) and `cli:`.
   `<cli>` below is that command; pass `--server <server>` on every call. Read `.sdlc/CONFIG.md` for the doc
   map and the *Ticket templates* row. No token and no credential is written to a file or shown.
2. **Who writes.** Every write carries `--as <alias>/agent`, the alias this session's, chosen as `PROCESS.md`
   ("The cast") describes (an adjective and a bird, `quiet-wren`): against the `activeAgents` of the issue's project
   (`project.id`, from `issue get` in the next item) and the issue's `agents`. With no issue yet (step 6), read the
   project the new story goes in once the PO has named it, before `issue create`; a project this session creates has
   nothing to read, so take a pair at random. Reads carry no `--as`.
3. **The process.** `<cli> --json process get <KEY>`: the types and their steps. Then the issue
   (`<cli> --json issue get <ref>`): `issue.type`, `issue.step` (an object: `issue.step.id`, or null), `issue.description`, `comments`, `escalations`.
4. **Does the type shape?** Only when the issue's type has a step of kind `shape`. A type without one (a bug,
   a chore) is taken as written by `plan-project` or `run`: **say so, change nothing, and stop.**
5. **Start.** Decide from content and status, not from the step alone, whether the story is *unplanned*: it has
   no sub-issues (`subIssues` empty), no comment opening `# Technical criteria`, its `issue.status` is `backlog`,
   and `issue.step.id` is empty or names the type's `plan` step or a step before it (`shape`, `shaped` or `plan` in
   the presets; a story `plan-project` sent back lands on `shape`).
   - **A story in a round trip** (`PROCESS.md`, "Before the plan: shaping", says what that is): never set `--step shape` on it, which would pull a story at the plan step back. At the shaped step, or at the plan step with a `# Planning started` after the gap comment, its shaping half is done: hand over to `plan-project` for that story as `HARNESS.md`, "Handing over to a skill", says, and stop. At `shape`, with its latest gap comment's escalation open, wait on it ("Wait, then carry on"): on *Hold* shape it, and on *Split* or *Accept* say so and stop. At `shape` with *Hold* given, shape it as today.
   - **Unplanned, and not in a round trip:** run `<cli> --as <alias>/agent issue update <ref> --step shape`; the step's status comes with it.
   - **Done or cancelled:** say so and stop. Change nothing.
   - **Anything else** (tasks, a technical-criteria comment, a step past `plan`, or a status other than `backlog`,
     for example a planned story at `ready` with no step): keep its step and status, and tell the PO what state it
     is in and that changing its criteria changes what its tasks were built against. This is the amendment path:
     write the body only on their yes (step 5, "When the approval round stays"), and do not set `--step shape`.

**Where the human is asked.** This repo has a `.sdlc/leeway.md`, so a question to the PO is never a terminal
question: it is a Leeway escalation on the story, and then you wait for its answer (`PROCESS.md`, "Questions to the
human are escalations"). Post the context first as a comment (`comment add <ref> --stdin body`), then write the
escalation's fields as JSON to a file outside the repo, by absolute path, and raise it with `<raise> --server <server>
--as <alias>/agent <ref> <fields file> -- <cli>`, `<raise>` being the command `HARNESS.md`, "Running the plugin's
scripts", names. No field goes on a command line:

```json
{"type":"clarification","question":"<at most 1,000 characters>","context":"<what exists today in that area and what is unclear, in plain lines>","tradeoff":"<what each answer costs, where you can say it>","options":[{"label":"<at most 60>","argument":"<what happens if it is picked, at most 1,000>"},{"label":"<at most 60>","argument":"<what happens if it is picked, at most 1,000>"}],"meanwhile":"<what continues, or nothing>","comment":"cN"}
```

2 to 5 options, the likeliest answer first, and one of them is always *Leave it OPEN* where the question is a
gap. Every question here, the approval round's too, is a `clarification`. The context is the specific thing behind the question in plain lines, at most 1,000 characters: what exists
today in that area and what is unclear, never only "see cN". **No pick:** no `"advice"`, and no option is marked
`"suggested"`, since the answer is the PO's to give. The PO's answer and note are in `escalations[].answer` on the next `issue get`; an open escalation with no
answer means do not proceed. With no `.sdlc/leeway.md` there is no binding and this skill cannot run: stop and
say so.

**Wait, then carry on.** Raise each with `<raise>` (`escalation.escalation` in what it prints is the `eN`), then wait on the round
as `run` does: start one background wait per open escalation of the round, all together (`run`, "Wait, then carry on", with this skill in place of `run`):
say once what you wait on and until when, start the wait as `HARNESS.md`, "Waiting for an answer", says, answer a
question the PO asks of you and wait again (exit 5), and write nothing while one is open. On any exit but 0 and 5,
or where `HARNESS.md` says `wait: stop`, stop the turn as run's table says, naming the story and its open
escalations: re-invoking `shape-project` resumes from step 1, reading the answers that came. **On every answer of the round, carry on as a re-invoke would**,
writing nothing twice: step 1 reads the answers, a follow-up goes out as step 3 says and is waited on the same way,
and with none, steps 4 and 5 propose and write the body and set the shaped step; an answer to the approval
escalation is acted on as "When the approval round stays" says. No answer moves the story out of the shaped step:
running `plan-project` on it does, and is the approval of the body.

## The line you do not cross

**Ask only what the PO can answer.** Who it is for, what they can do, what they see, what must not
happen, what is left out. Never a data model, an endpoint, a library, an estimate or an approach,
and never propose an implementation. A technical question the PO raises, or one the code raises,
goes under *Open questions for dev* as one line, undecided. A developer answers it in planning —
**unless the user would see the answer**: then it is a product question, however technical it
sounds, and you ask it now (the gap checklist has the test).

**A gap the PO has not answered is not answered by you.** It stays under its heading as an `OPEN:`
line, or becomes a fallback the PO chose. An invented answer looks exactly like a decided one.

## 1. Read before asking

- **The intent doc** from the doc map, for the product rules this story could cut against. A
  tension with one is a product decision: step 2 asks it. Marked `stub` or `absent` → skip it.
- **The issue, if it exists**: the description and every comment. A comment from `plan-project` addressed to the
  PO lists the gaps a developer sent back. **The latest one is this round's agenda**: start there. **Any body
  already there when shaping starts**, whoever wrote it, is read line by line against the product check, and its
  gaps go into the first round. In later rounds, do not reopen what the body already answers. Where it proposes wording for a criterion, that is a suggestion: show
  it to the PO, who accepts it, changes it or rejects it. It goes in the body only in the PO's version.
- **The story template**: `STORY.md` in the directory the *Ticket templates* row names (`.sdlc/templates/`).
  Without that row, read `skills/sdlc-install/scaffold/templates/STORY.md.tmpl` in this plugin. **Read it now —
  this skill does not repeat it.** The block above its `---` rule ("Notes for the writer") is never written to
  Leeway; the body starts after the rule.
- **The gap checklist**: `references/gap-checklist.md` next to this skill, with its `## The product check`.
- **Every line under *Open questions for dev*, including one drafted before shaping**: would the user see the
  answer? One that passes the test is asked in the round and leaves that section.

## 2. Check what exists today, read-only

Read the surfaces the story touches **to tell the PO what is there now, in product terms**: "the
list already filters by status, not by owner"; "there is no empty state on that page today". Never
to design. A story written from the prose alone restates the prose; the gaps are where it meets what
is already there.

**Look for the rules the code already enforces there**: a feature toggle or setting that decides
where it is offered, a permission check, a scan, a size or format limit, a duplicate check, a
cleanup that deletes. Each is a product question for the PO — *"today import only works where
document import is switched on; should this follow the same switch?"* — because a story that is
silent about a rule the code enforces either breaks it or inherits it without anyone deciding.

**Look for every way in to what the story takes away.** When a story removes or replaces a capability, search the code for every caller and entry point to it: a function or component's callers, the routes, the UI controls that open it, the commands, the links. Each entry point the story does not already cover goes into the round as a choice: cover it in a criterion, or leave it under *Out of scope*. Raise it in step 3's round as the hidden scope it is, merged with any question one answer would settle (the round rule there). A story that only changes how something behaves, removing or replacing nothing, is shaped as today: this search does not run.

**Look for the intent-doc rules the story could cut against.** For each, search the code for its id (`R1`) and
its words. The question names the rule, quotes it, and says where the code cites it. Its options are *The rule
holds, the story changes*, *The rule changes, and the story says so* and *Leave it OPEN*. On *The rule changes*,
the body gets a criterion that the intent doc is updated with the story's work. No advice and no suggested option.

You change nothing in the repo. This session writes only to Leeway.

## 3. Walk the gaps with the PO

First decide which checklist rows apply to this story, by their *Applies when*. Then go through
those rows, the gap kinds of `## The product check`, the *What must not happen* rule and hidden scope, **area by area, and only the
ones the story leaves open**. Never ask a row that does not apply. Say what exists today, then ask. Take the PO's
answer as given; where they are unsure, it is an `OPEN:` line, not a nudge toward an answer.

Each area is one comment (what exists today) and one escalation (the question, the likely answers as options).
**Check the round before raising it** (`PROCESS.md`, "Questions to the human are escalations"): where one answer would settle or change another
question, merge them into one, or hold the dependent one for the next round. Every other question goes out now,
together, so the PO answers in one sitting and the first round covers as much ground as it can. Do not ration them.
Then wait on them ("Wait, then carry on", above). The round's
first comment also quotes the description as it is (or "none yet") under the line `Description at this round:`; the
latest round's quote is what step 5 checks before it writes.

Hidden scope the PO can decide becomes a criterion, a fallback, or a line under *Out of scope*.
Whether something exists in the code, or how to build it, is a line under *Open questions for dev*.

## 4. Propose the body

In exactly the template's shape, from the rule down.

- **Three to six criteria, grouped by behaviour.** Each is a small user story with its rules nested
  under it. Twelve one-line criteria are a test list; one criterion with twelve rules is the story
  again.
- **No Gherkin.** Given/When/Then multiplies near-identical scenarios and buries the rule each one
  is there to check. Scenarios belong in tests; the criterion states the rule.
- **Optional behaviour is a fallback, not a silence.** Write it as *"Fallback if not implemented in
  this story: ..."* so the gap is a decision someone made rather than one nobody saw.
- **`Design link missing` is written out**, not left blank. A blank reads as "no design needed".
- **Scope's context says what exists today; *Out of scope* says what the story leaves out.** Each
  thing is said once, in one of them.
- **Every heading is filled or reads `n/a: <why>`.** *Out of scope* and *Open questions for dev*
  are optional: delete either rather than leave it empty. Leave out *Technical criteria* on a new
  story; on an existing one, keep it exactly as it is.
- **Numbers are stable.** Tasks cite `AC-3` by number, so never renumber. A new criterion goes at
  the end; a dropped one stays as `AC-n (removed: <why>)`.
- **Undecided answers are `OPEN:` lines** under the heading they belong to, one question each.
- **No HTML comment and no other marker**: Leeway shows raw HTML as text.
- **The Status line is set last**: `**Status:** shaped by <PO's name> on <today>`, keeping any
  *planned by* half as it is. It records who shaped the body and when; the `OPEN:` lines record what
  is still open.

**Short, and by reference.** Say each thing once, in as few words as carry it. Context that can be
looked up — how a screen works today, a rule in the intent doc, an existing flow — is a pointer
(*"as the upload on the Documents page"*, *"VISION.md, Retention"*), not a retelling. The body is
what the work is checked against, not its background.

## 5. Write the body, then stop at the shaped step

**Write once every escalation on the story is answered and no answer leaves something new unclear.** An answer
that does is a follow-up: raise it as in step 3 and wait. Before writing, run the product check on the proposed
body. A gap other than an `OPEN:` line the PO chose to leave is a follow-up round, not a write. `OPEN:` lines
the PO chose to leave do not stop the write. A later round drops what an answer settled: it is not asked
again, and it is not raised for confirmation. No escalation asks whether to write the body: the PO's
answers are the shaping, and running `plan-project` on the story at the shaped step is the approval of the body. The two exceptions are under
"When the approval round stays" below.

**The shaped step** is the type's first step of kind `gate` after its `shape` step, with no `plan` step between
them (`shaped` in the presets). Find it in `process get` by kind and position, never by id.

**Re-read the issue first and stop if `issue.description` is not the baseline**: the one quoted under `Description
at this round:` in the latest round's first comment, or the one step 0 read when nothing was asked; replacing a
description silently clobbers an edit made in the UI in between. Take the edit into the body instead: rebuild the
body on the version just read (step 4), keeping the edit, and list in the inference comment what the edit changed
and how the body keeps it. Where the edit contradicts an answer, that is something new unclear: raise it as in
step 3 and wait. Otherwise the version just read is the baseline now: start this step again.

The Status line's name is the PO's: the answerer's name on the latest round's escalations
(`escalations[].answer.by.userName`). When shaping asked nothing, it is the name `<cli> whoami` shows, the person
signed in to this session; not signed in, no write can succeed, so stop and say so.
Then write the **description** and nothing else, from a file outside the repo by absolute path, or from a quoted
heredoc:

```sh
<cli> --server <server> --as <alias>/agent issue update <ref> --stdin description <file
```

The one exception is an empty summary: write one in its own call, naming only that field (an update replaces the
fields it names), at most 280 characters, what the story is and why, in plain words: `<cli> --server <server> --as <alias>/agent issue update <ref> --summary "<at most 280 characters>"`.

Read it back with `issue get` and check that `issue.description` is the body.
**Acceptance criteria live in the body, never in a separate field.** It is the one place the implementer, the
reviewer and the divergence reviewer all read.

Then post **one** comment on the story: what the body says beyond the PO's answers (each thing you inferred,
worded or left out, one line each), what is still `OPEN:`, and the summary if you wrote one. With `OPEN:` lines
left, the inference comment and the session tell the PO that planning will send them back. Set the shaped step,
`<cli> --server <server> --as <alias>/agent issue update <ref> --step <the shaped step's id>`, and stop. The story
waits there until `plan-project` is run on it, and running it approves the body: say so to the PO. **In a round trip** (`PROCESS.md`, "Before the plan: shaping"), the story does not wait there: say in the session, and in the inference comment, that the story goes back to planning, and once the shaped step is set hand over to `plan-project` for that story as `HARNESS.md`, "Handing over to a skill", says. It uses the session's alias: `plan-project` continues the earlier `plan-project` run, not a new run. Another story's wait that exits is acted on when it exits, whichever skill the session is in. Outside a round trip, shaping ends at the shaped step and stops, as above, and a story shaped from scratch (no gap comment, or one whose escalation was answered *Split* or *Accept*) hands nothing over.

### When the approval round stays

Two stories keep the approval round, and the PO is told why:

- **Already planned** (step 0's amendment path: sub-issues, *Technical criteria*, a `# Technical criteria`
  comment, or a step past `plan`): changing its criteria changes what its tasks were built against. Say so in the
  question.
- **No shaped step** (an old or tuned process, `shape → plan → gate` for example): there is no step for the body
  to wait at, so this escalation is the approval. Say so in the question.

Post one comment on the story with the current description (or "none yet"), the proposed body, and what is
still `OPEN:`; when `issue.summary` is empty, a proposed summary too. Then raise one escalation, *Write this body
to `<ref>`?* (*Write this body and summary to `<ref>`?* when a summary is proposed), with the options *Write it*,
*Write it with the changes in my note* and *Do not write*, and wait on it ("Wait, then carry on"). **Write nothing
without the PO's yes.** On *Do not write*, write nothing, say so and stop.

On a yes, write the description (and an empty summary) and read it back as above, but check the description
against the one the proposal comment showed (on a mismatch, show the new version in a new proposal comment and ask
again), the Status line's name is this escalation's answerer, and set no
step. On an already-planned story, after writing, post one comment for the developer: which `AC-n` changed. Once a
person moves the story back to the plan step, `plan-project` rechecks the technical criteria and the tasks that
serve it.

### A reply to the gaps sent back

If this round answered gaps a developer sent back, **reply to that comment** (`comment add <ref> --parent cN
--stdin body`) with one line per gap: answered in the body, or still `OPEN:`. The story goes back to `plan-project`
when it is run on the story at the shaped step, or, on a type with no shaped step, when the developer
re-runs it; the reply tells them whether that is worth doing yet. Running `plan-project` on the story approves the body. In a round trip planning resumes by itself once the body is written, so the reply is the PO's record only.

## 6. A new story, or several

A story is created in a project, with a type that has a shape step:

```sh
<cli> --server <server> --as <alias>/agent --json issue create <KEY> --projectId <id> --type <type> --title "<title>" --summary "<at most 280 characters>" --status backlog --stdin description <body
```

An issue cannot be created outside a project, a title is at most 200 characters, and the summary at most 280: what
the story is and why, in plain words. For several stories, find or create the project that holds them (`project
list <KEY>`; `project create <KEY> --name "<the PO's title>" --summary "<at most 280 characters>" --stdin
description`); `plan-project` adopts it and adds what planning needs. Each story
body goes through steps 3 to 5.

**You never create tasks, branches or a design doc**, and the only steps you set are `shape`, in step 0, and the shaped step, in step 5, and
only for an unplanned story, besides a move the person asks for in the session (`PROCESS.md`, "The cast"). A status
is set by `--step` or `--status` and nothing else: no comment and no escalation moves a story.

## Done when

Every story body is in the template's shape, every heading filled or `n/a: <why>`, at least one rule
says what must not happen where the gap checklist requires one, every undecided answer is an
`OPEN:` line, the product check found no gap except the PO's chosen `OPEN:` lines, the Status line names the PO and today's date, and the description read back is the body.
The PO has the inference comment (on the approval round, saw the body before it was written), and an
unplanned story sits at the shaped step (at `shape` where its type has no shaped step; a planned one keeps
the step and status it had).
