---
name: sync-repo
description: Bring this repo's leeway-sdlc copies up to the plugin version this session runs - the ticket templates, the craft floor, the managed contract block in the agent's instructions file, the gitignore lines, and for agents other than Claude Code the kit in .sdlc/kit and the agent and hook files - one diff and one question per copy, then one branch and one pull request, with the decisions recorded in .sdlc/CONFIG.md. Run once per release per repo, by one person, after the update skill. Use when the session notice or update reports the repo's copies are behind, or the user asks to sync the repo with a new leeway-sdlc release.
---

> **leeway-sdlc for agents other than Claude Code.** This plugin's files (`PROCESS.md`, `HARNESS.md`, `craft/`,
> `agents/`, `hooks/` and the skills' own files) are in **`.sdlc/kit/`** at the repo root once `sdlc-install` has
> run: "in this plugin" below means there, except that `skills/<name>/SKILL.md` is the `<name>` skill itself
> (load it as a skill; its other files are in `.sdlc/kit/skills/<name>/`). Read `.sdlc/kit/HARNESS.md` for how this agent delegates, marks a
> subagent's run and updates. With no `.sdlc/kit/` yet, run `sdlc-install` first; it reads them from its own `kit/`.

# Sync the repo with this release

The installer copied some plugin files into the repo, and the update skill never touches them:
it runs once per developer, and a repo change offered to everyone gets made twice. This skill is the
repo's half, **run once per release, by one person**. It changes the repo only through one pull
request, and only with an answer per copy.

**Where a question goes.** Each "ask" below is one question per copy. The test is whether the repo has
`.sdlc/leeway.md` (the binding the installer writes):

- **Without it**, ask in the terminal, copy by copy.
- **With it**, a question is a Leeway escalation, raised on the issue the user named when invoking this
  skill. None named: stop and say there is nowhere to put it. Read the CLI command from `cli:` in
  `.sdlc/leeway.md`. Every write carries `--as <alias>/agent`: the alias is `<word>-<two hex digits>`,
  chosen once for this session and kept (the CLI's roles are `implementer`, `reviewer`, `planner` and
  `agent`; a skill acting for the orchestrator writes as `agent`).

Raising, all together, once steps 0 to 2 have found which copies need an answer:

1. Per differing copy, `comment add <issue> --stdin body` with the diff and your guess at who changed it,
   then `escalation raise <issue> --comment cN` with a question that **begins with the copy's name**
   (for example `Sync .sdlc/templates/TASK.md to 0.1.0:`), 2 to 5 options (take, keep, merge, each with its
   argument), and `--meanwhile` saying nothing is written.
2. Raise every one of them in the same turn, then stop the turn, naming the issue and the escalations
   (`PROCESS.md`, "Questions to the human are escalations").

**On resume**, run steps 0 to 2 again, then `issue get <issue> --json` and match each escalation's
`question` to its copy by the full prefix `Sync <copy> to <this version>:`, version included. An escalation whose prefix names another version is from an earlier release: ignore it, even if answered. An answered one is acted on in step 3. An open one with no
answer is not: do not write that copy. A copy with no escalation yet gets one now; stop again if any
remain open. Never write a copy on an unanswered question. The `filing-work:` question is the exception:
step 1 reads its escalation itself, before step 2, and never raises it twice. The legacy friction migration
(step 1) is matched like a copy, by the prefix `Sync friction-project: to <this version>:`.

## 0. Before anything

- **Not in the middle of a run.** If a `run-story` or `run-task` is in progress in this session,
  stop: a new template or floor between rounds reviews a task under rules it was not built under.
- **This repo has `.sdlc/CONFIG.md`.** Without it there is nothing to sync; point at
  the sdlc-install skill and stop.
- **The version is this plugin's own**: the `version:` line of `HARNESS.md` in this plugin. If the
  **installed** command in `HARNESS.md` shows a newer `leeway-sdlc` installed, this session has not
  restarted since the update: say so and stop, or you would sync to the old release. (Where
  `HARNESS.md` says the plugin files are `.sdlc/kit/`, "this plugin" is the freshly installed
  `sdlc-install` skill's `kit/` directory, and `.sdlc/kit/` is a copy being synced.)
- **Nobody is doing it already.** The Leeway CLI cannot list pull requests, so look in git:
  `git ls-remote --heads origin` for a branch named exactly as in step 4, and, where `gh` is
  installed (it is optional), `gh pr list --search "chore: sync leeway-sdlc"`. A branch whose
  `## Repo copies` already reads `Synced to <version>` and has an open PR is someone else's finished
  sync: link it and stop. The same branch with open escalations of this version on the named issue is
  this repo's own sync in progress: check it out and resume. No `gh` and no matching branch is not proof; say that you could not check the PR list.
- **The working tree is clean** (`git status --short`), so the branch carries only the sync.
- **Then be on the sync branch** (step 4 names it): create it, or on a resume check out the one that
  exists. Nothing below is written anywhere else.

## 1. Read the record

`## Repo copies` in `.sdlc/CONFIG.md`: the `Synced to` row, and one `Kept` row per copy the team
decided to keep. No such section: treat every copy as never synced, and add the section in step 4.

Then the `filing-work:` line of `.sdlc/leeway.md`, which step 2 needs to fill the contract block:

- **The line is there** → it is settled; never ask it again.
- **No `.sdlc/leeway.md` at all** → use `manual` and ask nothing: a repo with no binding files no work
  in Leeway, and the `manual` fill is the block as it was before 0.3.0. Nothing is written.
- **The file lacks the line** (a repo installed before 0.3.0) → the answer to sdlc-install's question 11,
  `plan-work` (pre-filled) or `manual`. In the terminal, ask it. In escalation mode, first look on the
  named issue (`issue get <issue> --json`) for an escalation whose question begins `Sync filing-work: to
  <this version>:`. Answered → use its answer. Open → stop the turn. None → raise it, then stop the turn.

This is the one question raised before the others, because the block cannot be compared without its
answer; the copies are compared, and their questions raised, once it is answered. The answer fills the
block in step 2 and is written in step 4.

Then the friction line of `.sdlc/leeway.md`:

- **`friction-project:` is there, or there is no `.sdlc/leeway.md`** → nothing to ask.
- **A legacy binding with `friction-collector: n/a` and no `friction-project:`** → nothing to ask: the team
  already chose to file no friction. Step 4 replaces the legacy line with `friction-project: n/a` and the same
  reason.
- **A legacy binding with `friction-collector: <ref>` and no `friction-project:`** (installed before 0.3.0) →
  offer the migration once, as one question asked with the copies in step 3 (its escalation's question begins
  `Sync friction-project: to <this version>:`): the project friction is filed into from now on, as
  sdlc-install's question 12 proposes it (an existing project whose name says developer experience or
  friction, or create "Developer experience", or `n/a` and why). Before creating, read `project list <KEY>`
  again: a "Developer experience" project already there (a sync interrupted after the create) is used, not
  made twice. A project is created only on that answer, as sdlc-install's `{{FRICTION_PROJECT}}` says, and
  its id is read back from Leeway; never invent one. The answer replaces the legacy line in step 4. The old
  issue is left as it is: nothing is written to it, and it is not closed.

## 2. Compare each copy

**At most the copies in this table. There is no scan of the repo for others.**

| Copy | Repo path from | Plugin copy, in this plugin |
|---|---|---|
| `STORY.md`, `TASK.md` | the *Ticket templates* row of `.sdlc/CONFIG.md` | `skills/sdlc-install/scaffold/templates/STORY.md.tmpl`, `TASK.md.tmpl` |
| the craft floor | the `@` import of `HOW-WE-CHANGE-CODE.md` in `ENGINEERING.md` | `craft/HOW-WE-CHANGE-CODE.md` |
| the contract block | in the **instructions-file** `HARNESS.md` names (`CLAUDE.md`, `AGENTS.md` or `GEMINI.md`), from the line carrying `leeway-sdlc:begin` through the line carrying `leeway-sdlc:end`, **both marker lines included** | `skills/sdlc-install/scaffold/AGENT-BLOCK.md.tmpl`, the whole file, marker lines and their text included, filled in as sdlc-install fills it for this harness (`HARNESS.md`, "Instructions and local notes"), `{{FILING_WORK_RULE}}` from the `filing-work:` line of `.sdlc/leeway.md`, and `{{IMPORT_FLOOR}}` as the read-first line when the instructions file already imports the floor outside the markers (sdlc-install, "Placeholders to fill with care") |
| the `.gitignore` lines | `git check-ignore -q` on `.worktrees/`, on the **local-notes-file** `HARNESS.md` names, and on `.sdlc/.governed/`, one at a time | one line each in `.gitignore` |
| the kit | `.sdlc/kit/`, only where `HARNESS.md` says `plugin-files: .sdlc/kit/` | the `kit/` directory of the `sdlc-install` skill; compare with `diff -ru --strip-trailing-cr`, and treat the kit as **one** copy (one question) |
| the agent and hook files | each file under the kit's `wiring/<agent>/`, at the same path from the repo root, only where `HARNESS.md` names that wiring | the kit's `wiring/<agent>/` file; a JSON settings file (`.gemini/settings.json`, `.cursor/hooks.json`) is compared on the `leeway-sdlc` entries only |

Compare with `diff -u --strip-trailing-cr <repo copy> <plugin copy>`, so a CRLF checkout does not show every
line changed; for the contract block, the repo's span (`sed -n '/leeway-sdlc:begin/,/leeway-sdlc:end/p' <instructions-file>`)
against the filled-in template. Each copy is one of:

- **the same** → nothing to do;
- **different, and a `Kept` row matches**: its recorded hash equals the **Kept hash** of the plugin
  copy now (below) → the team already decided, and the plugin's copy has not
  changed since. Report it as kept, with the reason, and do not ask;
- **different otherwise** → ask in step 3. A `Kept` row whose hash no longer matches means the plugin
  changed that file again: show the new diff, and say what the team kept last time and why.

**The Kept hash** is the first 12 characters of `tr -d '\r' < <file> | git hash-object --stdin`: the
file with CRs stripped, so a CRLF and an LF checkout of one release give the same hash. `<file>` is the
plugin copy; for the contract block it is the template file (`AGENT-BLOCK.md.tmpl`, unfilled); for the kit,
`git hash-object` of the sorted list of its files' hashes; a
`.gitignore` line has no plugin file, so its `Kept` row carries `-`, and is kept until the line is added.

The diff alone does not tell you whether the release changed the plugin's copy or the team edited
its own. Say which you think it is, from `RELEASE_NOTES.md`, but let the answer decide.

**Never synced, never compared, never opened for writing:**

- `.sdlc/leeway.md`. It is the binding (server, product key, `cli:`, `friction-project:`, `filing-work:`,
  the project to nit-collector table), not a copy, and a template change never reaches it. **One narrow
  exception:** a binding key the file lacks (`filing-work:` or `friction-project:`, step 1) is asked for once
  (a legacy friction `n/a` is carried over without asking), and its answer written as one `<key>: <answer>`
  line in the key block at the top of the file. `filing-work:` is added directly after the friction line,
  whichever of the two keys it carries. `friction-project:`
  replaces the legacy `friction-collector:` line in place: that one key is renamed and given the new value.
  Nothing else in the file is touched.
- `.sdlc/CONFIG.md`, except its `## Repo copies` section (step 4).
- The contract docs under the doc map (`VISION.md`, `TESTING.md` and the rest): they belong to the
  repo from the moment they are generated. If a release needs a change there, its notes say so.

## 3. Ask, copy by copy

Show each diff and ask: **take the release's copy, keep the repo's, or merge by hand.**

- **Take** → write the plugin's copy over the repo's. For the contract block, replace the span from the
  begin marker line through the end marker line, inclusive, with the filled-in template, whole; text
  outside the span is untouched. A second compare then says "the same".
- **Keep** → ask for the reason in one line (in escalation mode the reason is the answer's note; an empty note is recorded as "kept, no reason given"). It goes in a `Kept` row with today's Kept hash, so the next sync does not ask again until the plugin's copy changes.
- **Merge** → the user edits; you write their result (in escalation mode the answer's note carries the merged text, or names a comment on the issue that does, `cN`; with neither, treat Merge as unanswered, say so, and raise one follow-up escalation for that copy). Record a `Kept` row too, since the repo copy
  now differs on purpose.
- **A `.gitignore` line missing** → offer the line. This is not a style choice: without
  the local-notes file, account ids and local paths the contract block sends there get committed; without
  `.worktrees/`, a worktree is staged by accident; without `.sdlc/.governed/`, a live marker is committed and
  governs every clone. Declined → record it as `Kept` with the reason, and
  say so in the summary.

One question per differing copy and per missing line, step 1's `filing-work:` question when the
binding lacks the line, and step 1's friction migration for a legacy binding with a ref, no more. A copy
that is the same, or kept with a matching hash, is not asked.

## 4. One branch, one pull request

Everything goes on **one branch**, named `chore/sync-leeway-sdlc-<version>` (the repo's convention is `<type>/<slug>`; a repo may prefix it per its own convention, but the slug `sync-leeway-sdlc-<version>` stays), and **one pull request** titled
`chore: sync leeway-sdlc <version>` (opened with `gh` where it is installed, otherwise committed for
the human to push). In the same change, update `## Repo copies`:

```markdown
## Repo copies

| | |
|---|---|
| Synced to | <version> |

| Kept | Plugin copy hash | Why | Decided |
|---|---|---|---|
| <copy> | <Kept hash, or - for a .gitignore line> | <the reason given> | <who>, <date> |
```

The `Synced to` row is the stamp the session notice reads. Drop a `Kept` row whose copy was taken
this time. A `filing-work:` or `friction-project:` answer from step 1 goes into `.sdlc/leeway.md` on this
branch, as the exception in step 2 describes. Write nothing to the repo without the answer for that copy, and nothing
outside the branch.

## Done when

Every copy in step 2 is the same, taken, or kept with a reason and a hash; `Synced to` names this
version; `.sdlc/leeway.md` is byte-identical to before, but for a `filing-work:` line added when it had
none and a legacy friction line replaced by `friction-project:`; and the pull request is open, or the
user said why not. End with one line: the version synced to, and each copy as taken, kept or unchanged.
