---
name: plan-project
description: Use whenever work is filed in Leeway - an issue with sub-issues, more than one issue, or anything touching the schema, auth, a product rule or an ownership boundary - in a new project or an existing one, including requests worded "file issues", "write this up", "break it down", "park it for later" or "turn this feedback into tickets", unless `.sdlc/leeway.md` sets `filing-work` to `manual`. Plans the work before any code is written - checks each issue's product side and sends its gaps back to the PO (when its type has a shape step), interviews the developer on what the code leaves open, writes the design doc and each issue's technical criteria, creates the Leeway project, its issues, their sub-issues and the dependencies, reads back the branch names, and ends at the plan gate (when the type has one) - an independent coverage review, then a person passes it by moving the issue to ready. Runs only for an issue whose type has a plan step. Skip it for a one-file fix with an obvious test.
---

# Plan a project

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
2. **Who writes.** `--as <alias>/planner` on every write, the alias this session's: an adjective and a bird
   (`quiet-wren`), one per session, chosen as `PROCESS.md`, "The cast", says, against the `activeAgents` of the story's
   project (`project.id`, from `issue get` in the next item) and the story's `agents`. Planning into a project this
   session is about to create, there is no project to read: a pair at random. The gate's coverage
   report is the one write made `--as <alias>/reviewer`. Reads carry no `--as`.
3. **The process, and the story's type.** `<cli> --json process get <KEY>`, then `<cli> --json issue get <story>`:
   `issue.type`, `issue.step` (an object: `issue.step.id`, or null), `issue.description`, `comments`, `escalations`. **In this skill an issue's escalations are only the entries whose
   `ref` is that issue:** a story's list also carries its sub-issues', with numbers that collide. A sub-issue's open one, on
   a re-plan, is `run`'s and holds nothing here: name it in the session, and do not wait on it. From the type's steps decide, and
   say, what this plan does:

   | The type has | So |
   |---|---|
   | no `plan` step | **Say so and stop.** Create no project, issue, comment or step; point at `run` for a type with `build`. Never plan a type the process does not plan |
   | a `shape` step | step 1, the product check, runs |
   | a `plan` step | "The developer interview" runs, before step 3 |
   | a `plan` step with `params.designDoc: true` | step 3 writes the design doc |
   | a `gate` step after `plan` | step 8 ends planning at the plan gate |

   **The plan step** is the type's step of kind `plan`. **The plan gate** is the type's first step of kind `gate`
   after its `plan` step (`gate` "planned" in the presets). A `gate` step before `plan` is the shaped step, where
   shaping ends: it is not the plan gate. Find each in `process get` by kind and position, never by id.
   The type's `branchPrefix` names its branches (step 6). A sub-issue takes its story's type.
4. **Start where shaping ends.** Read `issue.step.id` and `issue.status` against the type's steps; the first row
   that fits decides:

   | The story is at | So |
   |---|---|
   | the plan step | carry on |
   | `shape`, or no step at `backlog`, on a type with `shape` but no shaped step | with a body and no open escalation: `<cli> --as <alias>/planner issue update <story> --step <the plan step's id>`, then carry on. Shaping ends at `shape` there, and the PO's yes to shape-project's approval escalation was the approval. With no body, or an escalation still open: **say shaping is not finished, and stop.** Write nothing |
   | no step at `backlog`, on a type with no `shape` step | `<cli> --as <alias>/planner issue update <story> --step <the plan step's id>`, then carry on |
   | the shaped step | **say the story waits on the PO, and stop.** Moving it to the plan step is their approval of the body. Write nothing, and do not move it unless the person asks (step 7) |
   | the plan gate, or `ready` with no step, with the latest report's QUESTIONs answered and not applied (step 8, "The QUESTIONs") | carry on at step 8, "The QUESTIONs": apply them, and move nothing unless the person asks (step 7) |
   | the plan gate, or `ready` with no step, with a QUESTION of the latest report open (step 8, "The QUESTIONs") | carry on at step 8, "The QUESTIONs": wait on every open one at once ("Wait, then read"), raise a held one as it says, and apply them once every one is answered. Move nothing unless the person asks (step 7) |
   | the plan gate | **say it waits on the gate, and stop**: a person passes it by moving the story to `ready`, or returns it by moving it to the plan step. Write nothing, and do not move it unless the person asks (step 7) |
   | anywhere else (`shape` or no step on a type with a shaped step, a step after the plan gate, `ready` or later) | **say which step or status it is at and that planning starts when a person moves it to the plan step, and stop.** Write nothing |

   A story at the plan step that already has tasks or technical criteria is a re-plan: read step 1's note on it.
   Count its coverage reports (comments opening `# Plan coverage:`, step 8) posted since the latest of four marks:
   - its last move to `ready`: the latest `thread` entry of kind `status` whose `data.to` is `ready`;
   - its last move into the plan step from `shape` or the shaped step. The thread records no step move, so read it
     from the latest comment that sent the story back to `shape`, the one whose closing sentence begins *"Answer
     these with `shape-project` on `<ref>`"* (step 1's gaps, or step 8's "Three RETURNs"): the story came back to
     planning after it;
   - on a type with no `shape`, the latest "Three RETURNs" escalation answered *Re-plan once more* (step 8): count
     only the reports after the one it is tied to (`escalations[].comment`);
   - the latest comment opening `# Re-plan requested`, posted when a person asks to plan a stopped story again
     (step 8): count only the reports after it.

   With no mark, count all of them. None in the window: plan it afresh; the latest report before the window, if
   there is one, says what the last plan missed. One or two: it was returned from the gate. Read the latest report
   and the comments since it, fix what its BLOCKERs name, and gate it again (step 8). Three or more: do not re-plan;
   step 8, "Three RETURNs".
5. **Where the human is asked.** This repo has a `.sdlc/leeway.md`, so a question for the human is never a
   terminal question: it is a Leeway escalation on the story, and then you wait for its answer; one that stories share goes on their Plan record. Post the context first
   (`comment add <ref> --stdin body`), then write the escalation's fields as JSON to a file outside the repo, by
   absolute path, and raise it with `<raise> --server <server> --as <alias>/planner <ref> <fields file> -- <cli>`,
   `<raise>` being the command `HARNESS.md`, "Running the plugin's scripts", names. No field goes on a command line
   (`PROCESS.md`, "Questions to the human are escalations"):

   ```json
   {"type":"<type>","question":"<at most 1,000 characters>","context":"<the specific thing behind the question, in plain lines>","tradeoff":"<what each way costs>","advice":"<your pick and why, or no pick and why>","options":[{"label":"<at most 60>","argument":"<what happens if it is picked, at most 1,000>","suggested":true},{"label":"<at most 60>","argument":"<what happens if it is picked, at most 1,000>"}],"meanwhile":"<what continues, or nothing>","comment":"cN"}
   ```

   2 to 5 options, each with its argument, one open escalation per comment. **Each raise carries its fields** (`PROCESS.md`, "Questions to
   the human are escalations"). The type is `clarification` for every question this skill asks (the product gaps,
   the interview, the floor and repository questions, the plan gate's QUESTIONs) and `blocker` for "Three RETURNs",
   where planning the story has stopped. The context is the specific thing behind the question, in plain lines from
   the comment it is tied to: for a QUESTION, the QUESTION itself and the findings it rests on; for the product gaps,
   each gap in a line of its own; never only "see cN". **Your pick comes first and is marked `"suggested": true`**,
   and Advice says why. The options a step below names are the choices, not their order. Where you truly have no
   pick, invent none: no option is suggested, and Advice says there is no pick and why. **Every escalation this skill raises is waited on**, as "Wait,
   then read" (under "The developer interview") says, with its exits and the answer to a question asked of you. The
   interview's questions and step 5's floor and repository questions are waited on where they are raised, since the
   work after them depends on them, and so are step 8's QUESTIONs and its "Three RETURNs" escalation; step 1's
   product gaps once the rest of the plan is done (step 8, "The last wait"), since the stories that pass go on without them. **On an answer, and on resume**, read the
   answers with `issue get` (`escalations[].answer`) and the story's step and comments, and carry on from the first
   thing not done, writing nothing twice: the step that raised it says where its answer leads. An open escalation
   with no answer means do not proceed. **No answer moves a story out of the shaped step or the plan gate**: those
   moves are a person's (step 7). With no `.sdlc/leeway.md` there is no binding and this skill cannot run.

   **Check the round before raising it** (`PROCESS.md`, "Questions to the human are escalations"): where one answer would settle or change another
   question, merge them into one, or hold the dependent one for the next round. Independent questions go out
   together, not rationed, and a later round drops what an answer settled.

## Does this need planning at all?

**Yes** if it spans more than one task, or touches a stated rule in the intent doc, the schema, auth, or an
ownership boundary. **No** for a one-file fix with an obvious test — create the sub-issue (step 5) and run
`run` on it. The trigger is the shape of the work, not its size in lines: a two-line change to an isolation
predicate needs a plan; a 200-line UI component usually does not. A story this section sends to `run` skips the
interview with the rest of this skill; one it sends here is never too small for it ("The developer interview").

## 1. Product check, every story, every time (only when the type has `shape`)

**Before planning a story, check that it says what the work is for and what counts as done.** Whether it was
shaped with `shape-project`, written by hand, or shaped months ago and gone stale, the check is the same. A type
without `shape` skips this step: its issue is taken as written.

**This step writes nothing to the story body and answers no product question.** The PO's part is theirs, through
`shape-project`. Yours is the *Technical criteria* at its end, written in step 3 once this check passes.

**On a story planned before**, it already has *Technical criteria* — in the body, or in the latest `# Technical
criteria` comment — or tasks. Check the PO's part as usual, then read the comments since the *planned by* date: an
`AC-n` the PO changed since makes every `TC-n` and task that serves it stale, and step 3 rechecks them.

**No body yet** (an empty description) → nothing to check. Stop and point the developer at `shape-project` with the
PO. You do not write criteria.

### Read the story against its template

The story template: `STORY.md` in the directory *Ticket templates* names (`.sdlc/templates/`); without that row,
`skills/sdlc-install/scaffold/templates/STORY.md.tmpl` in this plugin. The gap checklist:
`skills/shape-project/references/gap-checklist.md` in this plugin. **Read both now — this skill repeats neither.**
Read the description and every comment, the intent doc, and the surfaces the story touches in the code.

### List the gaps

| Gap | What it looks like |
|---|---|
| **missing** | no numbered acceptance criteria; a heading of the PO's part that is absent or empty. `n/a: <why>` is an answer |
| **hollow** | "TBD", "standard error handling", "as usual", the title restated as a criterion |
| **open** | any `OPEN:` line |
| **no negative** | a story the checklist's *What must not happen* applies to — data scope, roles, permissions or isolation; or data it moves, copies, deletes or replaces — without the rule it requires |
| **stale** | a criterion that contradicts the intent doc, or what the code does today. If the Status line has a date, `git log --since=<date>` on the intent doc shows what changed since shaping |
| **hidden scope** | a capability the story assumes and the code shows is not there, **when it needs a scope decision**: build it here, a fallback, or out of scope. One the criterion obviously needs and you just build is a task, not a gap. Also an entry point to a removed or replaced capability that the body does not name, in a criterion or under *Out of scope* |
| **too big** | the story should be two. Name the split you would suggest; the PO decides it |

A checklist row the story leaves open is **missing** only when it applies, by its *Applies when*. **Not gaps:**
*Open questions for dev*, which are your input for the interview and step 3, and a missing Status line.

### No gaps → plan it

Carry on. **Do not re-ask anything the body answers**, and do not re-litigate a decision the body records.

### Gaps → back to the PO

Post the gap list as **one comment on the story**, addressed to the PO: each gap with the heading it belongs to
and the question the PO has to answer, in product terms; hidden scope with your rough size of each option. Where a
technical finding has a consequence the user will see, say what it is and **propose wording for the criterion**,
marked as a proposal. End with: *"Answer these with `shape-project` on `<ref>`; moving it to planning hands it back
to plan-project."* On a type with no shaped step, where shaping ends at `shape`, end with *"Answer these with
`shape-project` on `<ref>`, then re-run plan-project."* instead. Re-read the
latest such comment first: if the gaps are the same, do not post them again.

Then set the story back to the PO's step, `issue update <story> --step shape`, and raise one escalation, *"`<ref>`
has N product gaps: how do we proceed?"*, with the options, your pick first, *Hold; the PO answers with shape-project*, *Split the story
as proposed* (only for **too big**) and *Accept the gaps as written* (the answer's note says why, and the gaps go
into the body as `OPEN:` lines by the PO's hand). **A held story gets no tasks.** Then wait on it once the rest of
the plan is done, as step 8's "The last wait" says: at once, when this session plans no other story. The answer has
to reach the body before planning: planning on a comment makes a second source that drifts from the first. So
whatever the answer, this session does not plan the story again: it says the answer in the session and that the
story waits at `shape` for the PO, and the other gap waits keep running; with none still open, it stops. The
next `plan-project` takes it from step 0 once the body carries the answer.

**Several stories:** the ones that pass go on; the held ones wait. Name the held ones to the divergence reviewer in
step 8.

## 2. Read before designing

The **intent doc** first, from the doc map. If the design cuts against a rule, the plan says **which rule and
why** — an intentional tension stated out loud is a decision, an unstated one is a defect nobody catches. A doc
marked `stub` or `absent` is skipped, never cited. **A product rule the story cuts against, undecided in the
story, is not yours to decide:** it is a step 1 gap.

Then the **architecture doc** for how the pieces fit and what its known limitations already rule out, and the
**recipes doc** if the work is one of the recurring types it covers.

Then **the surfaces the story touches in the code**: a type without `shape` has not read them yet, and the interview
asks only what they leave open.

## The developer interview

**After the product check and step 2, before step 3, on every story this skill plans**, with a design doc or without
one. The technical choices a story leaves open go to the developer now, as escalations (step 0, "Where the human is
asked"), never in the terminal. Several stories share one round.

**Each question lives on one issue, and each story closes only itself.** A question that binds one story goes on that
story. One that binds several goes on their project's Plan record, naming them, and no other story gets a mark. The
Plan record's ref ends the project's description (`project get`: `Plan record: <ref>`), or, if a crash left that out, it
is the issue titled `Plan record` in `issue list`. With neither and such a question to raise, run step 5.1 and step 5.2
now.

**A story step 1 held gets no interview until it passes.** Step 1 runs first, so a product gap and an interview
question are never in one round: the gap's escalation is for the PO, and this round is for the developer.

**A story that does not exist yet is created first, so a question can name it.** Only a type with a `plan` step and no
`shape` gets here, checked in `process get` before anything is created; with `shape` it is a step 1 gap. First look in
`project list` and that project's `issue list` for what a crash left. Then step 5.1, since `issue update` has no project
field, and step 5.3's command, with its body and type and no tasks. Take it through step 0 and interview it like any
other: step 5 adopts both. One found only at step 4 or 5 is the same: nothing is written for it until a `# Interview
closed` names it.

### Where it stands, from Leeway alone

Every invocation starts here, after step 2, and takes nothing from an earlier session. `issue get` on each story, on
its Plan record and on any `<ref>` a `Held on` names holds it all: `comments` and `escalations[]`, each issue's own (step 0).

A question is **its own top-level comment**, its body opening `# Interview question <n>, round <r>: <refs>`, the stories
it binds, with its escalation's `"comment"` set to that comment's `cN`. A comment's own escalation is
`comments[].escalation`, `{number, open}` or null. A question's comment holding `Held on <ref> eN`, with none on it, has
not been raised. **A story's question comments** are these and any `# Floor question: <refs>`, on it or on the Plan record
naming it. Its interview ends at a comment on it opening `# Interview closed`, and "after" goes by `createdAt`. The first
row that fits decides:

| The story has | So |
|---|---|
| a question comment after its latest `# Interview closed`, if any, with no escalation and no `Held on` | a session ended between the two calls: raise it now, with no second comment, unless an answer settled it, which `# Interview closed` then names. Go on down this table |
| a question comment on the Plan record, with none on it, no open escalation on it and no `# Interview closed` | a shared question is not its first round: its own decisions go out now as "The first round", beside any shared one still open, and the next row does not hold them. Go on down this table |
| an open escalation: its own, on one of its question comments, or one a `Held on` names | do not proceed and raise nothing new: wait (below). This holds for any open escalation of the story, not only the interview's |
| a question comment after its latest `# Interview closed`, if any | read the answers: "The next round" |
| a `# Interview closed` | it is finished: carry on at step 3. The answers stand on a re-plan. Where a BLOCKER or a changed `AC-n` opens a decision nobody was asked, its question goes out as the next round, naming what opened it |
| none of these | it has not started: "The first round" |

### What is asked

**An open decision** is one the story, the code and the docs leave open, with more than one reasonable answer, that
would change the plan's shape or be costly to change later: a data model, a boundary, a dependency, a sequence, what a
`TC-n` would bind. A local choice nobody would want a say in is yours, and goes in the design doc. Each *Open question for dev*
is either settled from the code or asked.

**Do not ask what is already settled.** Read the code first (step 2). Then read the project's questions: its open
escalations (`escalation list <KEY> --projectId <id>`) and the answers on its other stories (`issue get` on each in
`issue list`). That is one call a story, sub-issues skipped, and from each you keep only its own `escalations[]` (step 0), none
of its comments. It has no cap: a story left unread is how one decision gets two answers. Nothing the code, the docs, the body, a comment or
an earlier answer settles is asked, and an earlier answer is any `escalations[].answer` on this story, the Plan record or a sibling story:
the PO's, a QUESTION's (step 8), or an earlier round's. A sibling's open question that binds this story is not asked again: this story's comment holds on it, with `Held on <ref> eN`.

The call, per story, with the filter that keeps only its own `escalations[]`, each entry whole (the filter reads the ref from the input's `issue.ref`, takes no argument, and has no `"` in its body):

```
<cli> --server <server> issue get <ref> --json | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8'));console.log(JSON.stringify(d.escalations.filter(e=>e.ref===d.issue.ref)))"
```

**A product question is not asked here.** What the user gets, an `AC-n`, a scope call: it stays a product gap for the PO.
Go to step 1, "Gaps → back to the PO", even with a round open, raise nothing more for the interview, and wait as that
step says. Nothing can withdraw an
open escalation, so the gap comment names any still open: step 0 reads one as shaping unfinished on a type with no
shaped step, and they must be answered too. On a type without `shape` there
is no PO: decide it with the human by escalation, as step 3 says, in this round, and say in its comment that it is a
product decision.

### The first round

**Every open decision that depends on no other answer goes out together**, so one sitting answers them, and the ones
that shape the plan most are among them. Check the round first (step 0): where one answer would settle or change
another question, merge them, or hold the dependent one. For each, post its comment, the context and what the code
shows, then raise it with `<raise>` as step 0 says, `"type": "clarification"`, on `<ref>`, the issue it is on
(`escalation.escalation` in what it prints is the `eN`), with `"comment"` its comment's `cN`, the fields step 0 names,
2 to 5 options, your pick first, and `"meanwhile": "Nothing: no design doc, criteria or tasks until the interview
closes."`. A decision with more than 5 options is cut to the real ones.

Post the held ones' comments last, each holding `Held on <ref> eN`, the escalations it waits on, so a re-invoke finds them.

**Step 5's floor questions and its repository question go out with this round**, when `product get` and `git remote`
show the second will be asked. They are not interview questions, and are raised as step 5 says, each comment opening
`# Floor question: <refs>`.

**Nothing open is the only way past the interview, and size is not one.** A one-file fix with an obvious test never gets
here ("Does this need planning at all?"); a story that does get here has its trigger, however few its lines. With no
decision open, no floor question left to raise and no shared question naming it, post `# Interview closed` saying why, raise nothing, and carry on at
step 3.

### Wait, then read

Say once what you wait on and until when. Then wait on the round as `run` does: start one background wait per open escalation of the round, all together (`run`, "Wait, then
carry on"), each started as `HARNESS.md`, "Waiting for an answer", says, polling nothing and doing no other work of this
plan. `<ref>` is the entry's own `ref`, the story, the Plan record or a sibling story:

```sh
node <plugin-files>/scripts/wait-answer.mjs --server <server> <ref> <eN> -- <cli>
```

| Exit | It means | So |
|---|---|---|
| 0 | answered | read every story this session plans again. Another still open: its wait keeps running, with its `ref` and 16 hours of its own, and this carries on only when every escalation of the round is answered. None: the table above, or, for a wait outside the interview, the step that raised it. A held story's step 1 gap escalation is not one of these: it is waited on last, in step 8's "The last wait", never in the middle of another story's interview, and a held story's interview escalation is not waited on at all ("The last wait") |
| 2 | no answer by the deadline | stop the turn, naming the escalations and the story: they stay, and re-invoking `plan-project` resumes from step 0 and the table above |
| 4 | the CLI asked for `leeway login` | stop the turn and name the action, `leeway login --server <server>`; re-invoking resumes |
| 3 | Leeway did not answer | stop the turn and say so; re-invoking resumes |
| 1 | the call was wrong, or `<ref>` has no `eN` | a bug in this run: stop the turn and say so |
| 5 | a question is waiting | not an answer: answer it and wait again on the same escalation, as `PROCESS.md`, "Questions to the human are escalations", says. Nothing else moves |

Where `HARNESS.md` says `wait: stop`, skip the wait and act at once as for exit 2. A person can answer at once or days
later: the answer is read the same way, and a re-invoke with one still open waits on it again, with no second comment or
escalation. **A partly answered round is still open:** one answer of two starts nothing. Only the answer is an answer: a comment, a status change or an edited description is not.

**An answer that settles a question still open** does not close it: nothing can withdraw an escalation, and you do not
answer one yourself. Say in the session that eN is settled by eM and only needs its answer, raise nothing about it, and
keep waiting. An answer that ends the work is followed: stop there and say so, and that any other stays open.

### The next round

With every escalation answered, read each `label` and `note`, then re-read what they touch. A round holds **only what an
answer opened**, its comment naming the `<ref> eN` that opened it, and each held question that is still undecided: its
comment's `Held on` escalations all answered, and raised on that comment. **Drop what an answer settled:** it is not
asked again, and it is not raised for confirmation. Raise it and wait as above, its round one higher.

A first-round decision a crash or a miss left out is not decided alone in the design doc: it goes out here, its
comment saying it was missed.

### Close it

With nothing open for the story and nothing left to raise for it, post one comment on it opening `# Interview
closed`: one line per escalation (`<ref> eN`, and which question), and one per question an answer settled and which. It
restates no answer. Another story of the round gets its own when its own table reaches this. Then carry on at step 3. A
QUESTION from the divergence review (step 8) is not this interview: it comes after the design doc, on comments of its own, and it reopens nothing here.

## 3. Write the design doc, then the technical criteria

**Not while the interview is open.** Read each story and its Plan record again now: an open escalation (its own, on one of
its question comments, or one a `Held on` names), a question comment after its latest `# Interview closed`, or no `# Interview closed` at all goes back
to "The developer interview". Nothing from here on is written first: no design doc, no `TC-n`, no task, and no project or Plan record
beyond what the interview needed.

**The design doc, when the type's `plan` step has `params.designDoc: true`.** In the repo, versioned with the
code, at *Plans directory* in `.sdlc/CONFIG.md`: `<dir>/<story ref lower>-<slug>.md`. Cover: data model, layer
boundaries, sequencing, tradeoffs, and the interview's decisions: **it links their escalations (`<ref> eN`) rather than
restating them**, with a line on what each means for the design. Nothing in it is left open. Then link it from the project description (step 5). **Write it,
or record why you did not**: without it no task can see the constraints of its siblings. When the step's
`designDoc` is false or absent, write none, and say in the project description that the story and task
descriptions are the source of truth, each carrying the interview's answers that bind it and citing their `<ref> eN`. If the repo has a house-voice rule, run it over the prose.

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

### A story whose criteria are in a comment

A story planned before may keep its *Technical criteria* in a story comment whose body opens with the heading
`# Technical criteria`, with the body's `## Technical criteria` heading holding one line: *"In the latest
`# Technical criteria` comment on this story."* The latest such comment is in force; never edit an earlier one.

Your `TC-n` go in the body, in full. On a re-plan of such a story, post a final `# Technical criteria` comment
first, whose body is the heading and one line, *"Moved to the story description; this comment list is closed."*,
then write the description with the section in full, so the older comment is never the latest. Never truncate.

Write the description with `issue update <story> --stdin description` from a file outside the repo by absolute
path or a quoted heredoc. Then read it back: it is the body you wrote, with every `TC-n` the plan has.

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
`project.id` for a project, `issue.ref` for an issue. A title is at most 200 characters. Every issue gets a
`--summary` of at most 280 characters: what it is and why, in plain words.

1. **The project: adopt, or create.** A story that is already in a project (`issue get`: `project.id`) is
   planned in that project; adopt it, never duplicate it. Otherwise:

   ```sh
   <cli> --server <server> --as <alias>/planner --json project create <KEY> --name "<plan name>" --summary "<at most 280 characters>" --stdin description <plan.md
   ```

   The description links the design doc, names the plan branch if *Plan branch* in `CONFIG.md`
   asks for one (`feat/p_<first 8 hex of project id>-<slug of the name, at most 40>`; `none` means stories branch
   from the integration branch and there is nothing to name), and carries the first status line. A project has no
   settable status: its status updates are comments on the Plan record.

2. **The Plan record, now, once, in the project:**

   ```sh
   <cli> --server <server> --as <alias>/planner --json issue create <KEY> --projectId <projectId> --type <type> --title "Plan record" --summary "<at most 280 characters>" --status backlog --stdin description <record.md
   ```

   `<type>` is `chore` when the process has it and it has no `shape`, `plan` or `gate` step; else the first type in
   `process get` with none of the three (a bug counts on the board as a defect, so `chore` is preferred); else the
   process's default type, so the record is not plannable work; the record's description says which type
   it took and why.

   Its description says what it is: one comment per nit and per status update, and any interview question that binds
   several stories, never an edit to its body. It stays
   `backlog` while the plan runs: it is not work anyone picks up. Create it **with the plan**, not when the first
   nit arrives: a container invented mid-flight gets invented differently every time. Then:
   - **write its ref into the project description** (`project update <KEY> <projectId> --stdin description`,
     now ending `Plan record: <ref>`) and read it back with `project get`: re-read the description first, since
     the resend replaces it;
   - **append `| <projectId> | <ref> |` to the *Nit collectors* table in `.sdlc/leeway.md`**, unless a row for
     that project id is already there. **This is the one repo file this skill edits.** It is a binding file, so
     it holds an id and a ref and nothing else; stage it for the orchestrator's commit;
   - post the plan's first status line: `comment add <ref> --stdin body`.

   Adopting a project that already has a Plan record (a row there, or the interview made it): use that collector, and
   create nothing, adding a missing row and a missing `Plan record: <ref>` line; when its `issue.summary` is empty, fill one in the same way as an adopted
   story's (step 3). **A project or record made before the design doc existed** gets the design doc link and the plan
   branch's name now, in one more resend of its description, re-read first.

3. **The stories**, in the project, one issue each. A story that exists is adopted; when its `issue.summary` is
   empty, fill one in with `issue update <story> --summary "<at most 280 characters>"`, naming only that field (an
   update replaces the fields it names). One the work needs and nobody wrote is created with this command before its interview, only for a
   type with a `plan` step and no `shape`; for a type with `shape` it is a step 1 gap (`shape-project` creates it). Pass the type explicitly:

   ```sh
   <cli> --server <server> --as <alias>/planner --json issue create <KEY> --projectId <projectId> --type <type> --title "<story>" --summary "<at most 280 characters>" --status backlog --stdin description <story.md
   ```

   The body is the story template from the rule down (the "Notes for the writer" block above it is never
   written). The **repository** is the one connected to the product: `product get <KEY> --json` shows
   `repositoryCount`. With one, a `--branch` alone uses it; with more than one, or on a `repository_required` or
   `invalid_repository` refusal, take `owner/repo` from `git remote get-url origin`, and where there is none, ask
   once by escalation, in one round with step 4's floor questions, since neither depends on the other, unless the interview's first round already did. Then `issue update <story> --repository <owner/repo>`, once, on the story; its sub-issues
   inherit it.

4. **Floor questions, per story, before its tasks.** Read the repo's floor (`ENGINEERING.md`) and the intent doc
   for a rule that asks for a decision on each user-facing story before it is built (for example whether a
   feature belongs on every surface a person uses). **User-facing** means a story whose acceptance criteria name
   something a person does through a surface. A question already raised (a comment opening `# Floor question`, on the story or on the Plan record naming it, with an escalation on it) is not raised again: read its answer. For each other such story post the context as a comment, opening `# Floor question: <refs>` and quoting the
   rule's own sentence, and raise that rule's question as an escalation. Its options, your pick first, are the alternatives the
   rule states; where it states none, one option per surface the rule names (a "yes" for that surface) plus *Not
   on any surface*, so leaving it out is a decision. **All of it is one round:** stories one answer would settle
   together share one comment and one escalation, naming each, on the Plan record, and a story whose question another answer would
   change is held for the next round; the rest go out together. **Wait** on them (step 0), report the escalation ids,
   and create no tasks for a story whose question is open or held. A held question goes out once the answer it waits on is in, unless that answer settled it, and is waited on the same way. On an answer, or on resume, write each answer into every task of each
   story it names, under *What to build*. A story that builds nothing a user does, or a repo whose floor asks nothing,
   skips this step; say which.

5. **The tasks**, each under its story, with `--parent` **set explicitly on every one**, never relying on
   inheritance; a sub-issue has no children. A task that exists (a re-plan keeps it) is not created again; when
   its `issue.summary` is empty, fill one in with `issue update <ref> --summary "<at most 280 characters>"`, naming
   only that field:

   ```sh
   <cli> --server <server> --as <alias>/planner --json issue create <KEY> --parent <story> --title "<task>" --summary "<at most 280 characters>" --status backlog --stdin description <task.md
   ```

   At most 100 sub-issues per issue: a plan that wants more is two stories.

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

8. **The plan branch: cut it, and link it on the project when you cut it.** Only when *Plan branch* in `CONFIG.md`
   asks for one; with `none` the stories branch from the integration branch and there is nothing to cut. In each
   repository the plan changes (the `issue.repository.fullName` of its stories), cut the plan branch the project
   description names from that repository's integration branch, fetched fresh, unless it is there already, and push
   it. Then link it on the project, so the project shows it rather than only naming it:

   ```sh
   <cli> --server <server> --as <alias>/planner project link <KEY> <projectId> --branch <plan branch> --repository <owner/repo>
   <cli> --server <server> --json project get <KEY> <projectId>   # project.links: per repository, the branch, and pr null
   ```

   One link per repository per project. Linking a repository again replaces its branch and its pull request, and a
   link without `--number` has none, so a repository already in `project.links` with this branch is left as it is.
   A repository linked with another branch (a renamed plan, a link a person made) is left as it is too, because
   linking it again would drop its pull request: name it in the ending, for the person to relink or unlink it.
   Nothing changes on GitHub. A refusal of `repository_required` or `invalid_repository` is step 3's. A repository
   the plan changes that this session has no checkout of is cut and linked by `run` when its first story starts
   (`run`, "Worktrees: mandatory, and yours alone"): say which in the ending.

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
escalation and no iteration moves a story. Setting a step sets the step's status in the same write. Step 0 may set
the plan step (a type with no `shape`, or no shaped step); step 1 may set `shape`; step 8 sets the plan gate, or `--status ready` on a
type without one. **The moves out of the shaped step and out of the plan gate are a person's**: this skill
never makes them on its own initiative. When the person asks in the session for one, or for any other move, make it
as `<alias>/agent` and say which move you made (`PROCESS.md`, "The cast"). When that move put the story at the plan
step, read the story again and start again at step 0. After any other move, say where the story now is and stop:
make no further move of your own.

## 8. The plan gate

The last step, once the whole hierarchy exists. **No task starts before it.**

**A type without a plan gate** goes from plan to ready with no gate: `issue update <story> --status ready` (no
step), story by story. Once every story of the plan is at `ready`, and not after each one, wait on the held stories'
gaps ("The last wait", below), and the skill ends.

**A type with one**: `issue update <story> --step <the plan gate's id>`. You wrote the plan, so you are the one
reader who cannot check it: an artifact cannot audit itself. So a fresh context does, and a person decides by
moving the story on.

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

### Post the full report, then stop at the gate

Post the **full report** as a comment on each story it covers, **`--as <alias>/reviewer`**: every row of that
story's coverage table, every finding. Not a summary: the report reaches you as the agent's final message and is
written nowhere else. A report over the 20,000-character comment cap goes across the comment and a reply
(`comment add <ref> --parent cN --stdin body`), never cut.

**Planning ends here, with the story at the plan gate.** No escalation asks for the gate decision: the decision is
the person's move. The verdict is the reviewer's recommendation; the decision is not the reviewer's and not yours.
Say in the session, per story, the report's `cN`, its verdict and what each move means:

- **Passing the gate** is a person moving the story from the plan gate to `ready`. No step: `run` sets the build
  step when it starts, so a story is never `in_progress` with nobody on it. **No task starts before that move.**
- **Returning it** is a person moving it back to the plan step. The next `plan-project` fixes the items the
  BLOCKERs name (step 0) and spawns a **fresh** reviewer — never the same one with a note about what changed. The
  next round posts its own report comment.

Raise the QUESTIONs, when the report has any (below), wait on them and apply their answers. Then, with QUESTIONs
or none, wait on the held stories' gaps ("The last wait", below), and **stop**, with the story where it is.

### The QUESTIONs

A verdict of PASS WITH DECISIONS has QUESTIONs only a human can answer. Post each QUESTION as **its own top-level
comment** on the story, as `<alias>/planner` (`comment add <story> --stdin body`), with a body opening
`# QUESTION <n> of c<report>`, where `c<report>` is the report's first comment. Then raise its escalation with
`"comment"` set to that QUESTION comment's `cN` (the options the report gives, 2 to 5, your pick first; the context
the QUESTION and the findings it rests on, in plain lines, so a person decides it from the escalation alone). A comment holds one open
escalation, and a reply has no `cN`, so each QUESTION needs a top-level comment of its own. They are questions about
the plan, not the gate decision.

**Check the round before raising it.** QUESTIONs where one answer would settle or change another are merged into
one, under the lowest number, its comment naming the numbers it stands for. Where the merge would need more than 5 options, hold the dependent
QUESTION for the next round instead, and withhold the `# QUESTIONs applied` reply until it is answered or an answer
settled it: `run` counts only the escalations on these comments, so a QUESTION not yet raised holds the story through
that reply alone. Every other QUESTION goes out now, together.

**A report's QUESTIONs are the escalations on the comments opening
`# QUESTION … of c<report>`**; an escalation on no comment, or on the report itself, is not one. Say in the session,
in this order: answer every QUESTION; this session applies the answers as they come (if it has ended, run
plan-project to apply them); then move the story to `ready`. `run` refuses the story until they are applied.

Wait on every QUESTION's escalation at once (step 0, "Wait, then read"). On an answer, or on resume, raise a held QUESTION (one the
report has with no comment yet), unless an answer settled it, and wait on it the same way. When every one is
answered, change what an answer changes in a description or a task, then **reply to the report** (`comment add
<story> --parent cN --stdin body`) with a body opening `# QUESTIONs applied`: one line per escalation, its answer
and what it changed, or that it changed nothing, and one line per held QUESTION an answer settled. That reply is
what makes them applied. Say so, and move nothing, so the story stays where it was, at the plan gate or at
`ready`. Then wait on the held stories' gaps ("The last wait", below), and stop.

**Applying a QUESTION's answer is not the gate decision.** It changes a description or a task and posts `# QUESTIONs
applied`, and it never moves the story, whatever the answer says, even one that reads as a pass. Only a person's move
takes the story from the plan gate to `ready` or back to the plan step, and this skill makes that move only when the
person asks for it in the session (step 7).

**A person may pass the gate over a BLOCKER, and you may not.** You never downgrade a finding to get the plan
moving.

**Three RETURNs mean the story is wrong, not the plan.** Step 0 counts them, before any re-planning: three or more
coverage reports in its window. Then stop re-planning. When the type has `shape`, set `--step shape` and post what
the rounds could not trace as a step 1 comment to the PO, with step 1's ending. When it has no `shape`, **raise one
escalation on the story**, tied to the latest report with `"comment"` its `cN`, asking the person how to go on:
*"`<ref>` has three or more coverage reports and none passed: how do we go on?"* The reviewer is tracing a story that
does not say what anyone means by it. Wait on it (step 0). Give two options, each naming what plan-project does next:
- *Re-plan once more*: plan-project re-plans it, this session on the answer or the next one. The answer starts a
  fresh window (step 0), so the count starts again.
- *Stop planning it*: plan-project says the story is stopped and stops, this session on the answer or the next one,
  writing and raising nothing. To plan it again, the person rewrites the story if they want to, then asks
  plan-project to plan it again. To drop it, they close it.

The order above is not a pick: put first and mark the one you pick, or mark none and say so in Advice, as step 0
says. The context gives what the rounds could not trace, one line per unresolved BLOCKER of the latest reports.

The same escalation is not raised twice. After a *Re-plan once more* answer, three more reports raise a new one on
the latest report. When the latest is answered *Stop planning it*, say so and stop, unless the person asks in this
session to plan the story again. Then post a comment on the story opening `# Re-plan requested`, saying it was
posted because the person asked and naming who asked, and carry on from step 0: the reports after that comment
start a fresh window.

### The last wait

**Before the plan ends, wait on every step 1 gap escalation of this session still open**: at the plan gate, with
QUESTIONs or none; at `ready` on a type with no plan gate; and in a session whose every story step 1 held, where
nothing else is planned. A gap escalation is waited on nowhere else, since the stories that pass go on without it.
A held story's interview escalations still open, where a product question held it in the middle of its interview
("The developer interview", "What is asked"), are not waited on in this session: they hold no work in it,
since the story gets no tasks, and they stay open until a person answers them, as its gap comment says.
Say which held stories it waits on, and which interview escalations stay open without a wait, then wait on every open gap escalation at once as "Wait, then read" says, answering a question
asked of you. On an answer, say it as step 1 says; the other waits keep running. With none still open, stop. Its answer goes
to the PO, not to this plan, so the wait holds no work here: where it ends without an answer (exit 2, 3 or 4, or
`wait: stop`), say once which escalations stay open and that the PO answers them with `shape-project`, and stop. A
re-invoke does not wait on them again: step 0 stops on a story at `shape`.

**What is lost.** The gate checks that the plan traces to the story, not that the story is right or the design is
good. A criterion nobody wrote down cannot be found missing.

## Done when

There is a project (adopted or created) with its design doc linked from it where the type asks for one and its
plan branch named where `CONFIG.md` asks for one, and cut and linked on the project in each repository the plan
changes (read back under `project.links`) or named in the ending as left to `run`, a hierarchy in dependency order under it, the Plan record with
its ref in the project description and a row in `.sdlc/leeway.md`, branch names read back, and a first task
someone could pick up from its description alone.

Plus: **every hazard names an owning task**, or the doc says which one does not and why. Every task's done-when
names at least one thing that must be proven false. Every story passed the product check — or its gaps went back
to the PO as one comment and it has no tasks. Every planned story, a new one too, has a `# Interview closed`, posted before its
design doc, and no escalation of its interview open. Every planned story has its *Technical criteria* in the body (or, on
a story planned before and not re-planned, pointed to from it, in the latest `# Technical criteria` comment), and a
*planned by* half on its Status line. Every story and task, and the Plan record, has a summary.
And, for a type with a plan gate, the report is posted, every QUESTION in it is a comment of its own with an
escalation on it, or held for the next round as "The QUESTIONs" says, and the story waits
at the plan gate for a person to move it; for a type without one, the story is `--status ready`.
