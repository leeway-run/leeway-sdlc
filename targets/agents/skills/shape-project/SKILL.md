---
name: shape-project
description: Shape an issue with the product owner before anyone plans it - read the intent doc, the issue and its comments, check what exists today, walk the gap checklist with the PO, and write the issue body in its template with a Status line and an OPEN line for every undecided answer. Asks only product questions; technical ones go under Open questions for dev. Runs only for an issue whose type has a shape step. Use when a PO is writing a new issue, or answering the gaps plan-project sent back. Never creates sub-issues, branches or a design doc.
---

> **leeway-sdlc for agents other than Claude Code.** This plugin's files (`PROCESS.md`, `HARNESS.md`, `craft/`,
> `agents/`, `hooks/` and the skills' own files) are in **`.sdlc/kit/`** at the repo root once `sdlc-install` has
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

This is not delegated work: spawn no subagents. Of `PROCESS.md` in this plugin, read "Before the plan:
shaping", "How the plugin reaches Leeway" and "Questions to the human are escalations".

## 0. Where you are, and whether this runs

1. **The binding.** Read `.sdlc/leeway.md`: `server:`, `product:` (the key, `<KEY>` below) and `cli:`.
   `<cli>` below is that command; pass `--server <server>` on every call. Read `.sdlc/CONFIG.md` for the doc
   map and the *Ticket templates* row. No token and no credential is written to a file or shown.
2. **Who writes.** Every write carries `--as <alias>/agent`, the alias this session's, chosen as `PROCESS.md`
   ("The cast") describes (`<word>-<two hex digits>`, for example `kestrel-b1`). Reads carry no `--as`.
3. **The process.** `<cli> --json process get <KEY>`: the types and their steps. Then the issue
   (`<cli> --json issue get <ref>`): `issue.type`, `issue.step` (an object: `issue.step.id`, or null), `issue.description`, `comments`, `escalations`.
4. **Does the type shape?** Only when the issue's type has a step of kind `shape`. A type without one (a bug,
   a chore) is taken as written by `plan-project` or `run`: **say so, change nothing, and stop.**
5. **Start.** Decide from content and status, not from the step alone, whether the story is *unplanned*: it has
   no sub-issues (`subIssues` empty), no comment opening `# Technical criteria`, its `issue.status` is `backlog`,
   and `issue.step.id` is empty or names the type's `plan` step or a step before it (`shape`, `shaped` or `plan` in
   the presets; a story `plan-project` sent back lands on `shape`).
   - **Unplanned:** run `<cli> --as <alias>/agent issue update <ref> --step shape`; the step's status comes with it.
   - **Done or cancelled:** say so and stop. Change nothing.
   - **Anything else** (tasks, a technical-criteria comment, a step past `plan`, or a status other than `backlog`,
     for example a planned story at `ready` with no step): keep its step and status, and tell the PO what state it
     is in and that changing its criteria changes what its tasks were built against. This is the amendment path:
     write the body only on their yes (step 5, "When the approval round stays"), and do not set `--step shape`.

**Where the human is asked.** This repo has a `.sdlc/leeway.md`, so a question to the PO is never a terminal
question: it is a Leeway escalation on the story, and then you stop the turn (`PROCESS.md`, "Questions to the
human are escalations"). Post the context first as a comment (`comment add <ref> --stdin body`), then
`escalation raise <ref> --question "<at most 500 characters>" --options '[{"label":"<at most 60>","argument":"<at most 1,000>"}]' --meanwhile "<what continues, or nothing>" --comment cN`:
2 to 5 options, the likeliest answer first, and one of them is always *Leave it OPEN* where the question is a
gap. The PO's answer and note are in `escalations[].answer` on the next `issue get`; an open escalation with no
answer means do not proceed. With no `.sdlc/leeway.md` there is no binding and this skill cannot run: stop and
say so.

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
  tension with one is a product decision: name the rule to the PO and write down what they decide.
  Marked `stub` or `absent` → skip it.
- **The issue, if it exists**: the description and every comment. A comment from `plan-project` addressed to the
  PO lists the gaps a developer sent back. **The latest one is this round's agenda**: start there, and do not
  reopen what the body already answers. Where it proposes wording for a criterion, that is a suggestion: show
  it to the PO, who accepts it, changes it or rejects it. It goes in the body only in the PO's version.
- **The story template**: `STORY.md` in the directory the *Ticket templates* row names (`.sdlc/templates/`).
  Without that row, read `skills/sdlc-install/scaffold/templates/STORY.md.tmpl` in this plugin. **Read it now —
  this skill does not repeat it.** The block above its `---` rule ("Notes for the writer") is never written to
  Leeway; the body starts after the rule.
- **The gap checklist**: `references/gap-checklist.md` next to this skill.

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

You change nothing in the repo. This session writes only to Leeway.

## 3. Walk the gaps with the PO

First decide which checklist rows apply to this story, by their *Applies when*. Then go through
those rows, the *What must not happen* rule and hidden scope, **one area at a time, and only the
ones the story leaves open**. Never ask a row that does not apply. Say what exists today, then ask. Take the PO's
answer as given; where they are unsure, it is an `OPEN:` line, not a nudge toward an answer.

Each area is one comment (what exists today) and one escalation (the question, the likely answers as options).
Raise the ones that do not depend on each other together, so the PO answers in one sitting, then stop. The round's
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

**The description holds at most 5,000 characters** (UTF-16 code units of the trimmed text, as the server counts; `plan-project` gives the one-liner), and the developer adds
*Technical criteria* to the same body, so leave room. A body over the cap is first cut — verbose rules, restated
context, anything a pointer can carry — and only then, if it still does not fit, a story that should be two:
say so to the PO and let them split it. Never truncate.

## 5. Write the body, then stop at the shaped step

**Write once every escalation on the story is answered and no answer leaves something new unclear.** An answer
that does is a follow-up: raise it as in step 3 and stop. No escalation asks whether to write the body: the PO's
answers are the approval, and moving the story on from the shaped step is theirs. The two exceptions are under
"When the approval round stays" below.

**The shaped step** is the type's first step of kind `gate` after its `shape` step, with no `plan` step between
them (`shaped` in the presets). Find it in `process get` by kind and position, never by id.

**Re-read the issue first and stop if `issue.description` is not the baseline**: the one quoted under `Description
at this round:` in the latest round's first comment, or the one step 0 read when nothing was asked; replacing a
description silently clobbers an edit made in the UI in between. Take the edit into the body instead: rebuild the
body on the version just read (step 4), keeping the edit, and list in the inference comment what the edit changed
and how the body keeps it. Where the edit contradicts an answer, that is something new unclear: raise it as in
step 3 and stop. Otherwise the version just read is the baseline now: start this step again.

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

Read it back with `issue get` and check that `issue.description` is the body and at most 5,000 characters.
**Acceptance criteria live in the body, never in a separate field.** It is the one place the implementer, the
reviewer and the divergence reviewer all read.

Then post **one** comment on the story: what the body says beyond the PO's answers (each thing you inferred,
worded or left out, one line each), what is still `OPEN:`, and the summary if you wrote one. Set the shaped step,
`<cli> --server <server> --as <alias>/agent issue update <ref> --step <the shaped step's id>`, and stop. The story
waits there for the PO.

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
*Write it with the changes in my note* and *Do not write*, and stop. **Write nothing without the PO's yes.**

On a yes, write the description (and an empty summary) and read it back as above, but check the description
against the one the proposal comment showed (on a mismatch, show the new version in a new proposal comment and ask
again), the Status line's name is this escalation's answerer, and set no
step. On an already-planned story, after writing, post one comment for the developer: which `AC-n` changed. Once a
person moves the story back to the plan step, `plan-project` rechecks the technical criteria and the tasks that
serve it.

### A reply to the gaps sent back

If this round answered gaps a developer sent back, **reply to that comment** (`comment add <ref> --parent cN
--stdin body`) with one line per gap: answered in the body, or still `OPEN:`. The story goes back to `plan-project`
when the PO moves it from the shaped step to the plan step, or, on a type with no shaped step, when the developer
re-runs it; the reply tells them whether that is worth doing yet.

## 6. A new story, or several

A story is created in a project, with a type that has a shape step:

```sh
<cli> --server <server> --as <alias>/agent --json issue create <KEY> --projectId <id> --type <type> --title "<title>" --summary "<at most 280 characters>" --status backlog --stdin description <body
```

An issue cannot be created outside a project, a title is at most 200 characters, and the summary at most 280: what
the story is and why, in plain words. For several stories, find or create the project that holds them (`project
list <KEY>`; `project create <KEY> --name "<the PO's title>" --summary "<at most 280 characters>" --stdin
description`, the description at most 5,000 characters); `plan-project` adopts it and adds what planning needs. Each story
body goes through steps 3 to 5.

**You never create tasks, branches or a design doc**, and the only steps you set are `shape`, in step 0, and the shaped step, in step 5, and
only for an unplanned story. A status
is set by `--step` or `--status` and nothing else: no comment and no escalation moves a story.

## Done when

Every story body is in the template's shape, every heading filled or `n/a: <why>`, at least one rule
says what must not happen where the gap checklist requires one, every undecided answer is an
`OPEN:` line, the Status line names the PO and today's date, and the description read back is at most 5,000
characters. The PO has the inference comment (on the approval round, saw the body before it was written), and an
unplanned story sits at the shaped step (at `shape` where its type has no shaped step; a planned one keeps
the step and status it had).
