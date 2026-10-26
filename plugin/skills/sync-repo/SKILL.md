---
name: sync-repo
description: Bring this repo's leeway-sdlc copies up to the plugin version this session runs - the ticket templates, the craft floor, the managed contract block in CLAUDE.md, and the gitignore lines - one diff and one question per copy, then one branch and one pull request, with the decisions recorded in .sdlc/CONFIG.md. Run once per release per repo, by one person, after /leeway-sdlc:update. Use when the session notice or update reports the repo's copies are behind, or the user asks to sync the repo with a new leeway-sdlc release.
---

# Sync the repo with this release

The installer copied some plugin files into the repo, and `/leeway-sdlc:update` never touches them:
it runs once per developer, and a repo change offered to everyone gets made twice. This skill is the
repo's half, **run once per release, by one person**. It changes the repo only through one pull
request, and only with an answer per copy.

**Where a question goes.** Each "ask" below is one question per copy. Where the repo's contract says
questions go to Leeway, raise it as one escalation on the issue for this sync (the one the user
named; none named: stop and say there is nowhere to put it), with 2 to 5 options (take, keep, merge,
each with its argument) and the diff in a comment first, then stop the turn until it is answered
(`PROCESS.md`, "Questions to the human are escalations"). Elsewhere, ask in the terminal. Never write
a copy on an unanswered question.

## 0. Before anything

- **Not in the middle of a run.** If a `run-story` or `run-task` is in progress in this session,
  stop: a new template or floor between rounds reviews a task under rules it was not built under.
- **This repo has `.sdlc/CONFIG.md`.** Without it there is nothing to sync; point at
  `/leeway-sdlc:sdlc-install` and stop.
- **The version is this plugin's own**: `version` in `.claude-plugin/plugin.json` in this plugin.
  If `claude plugin list --json` shows a newer `leeway-sdlc` installed, this session has not
  restarted since `/leeway-sdlc:update`: say so and stop, or you would sync to the old release.
- **Nobody is doing it already.** The Leeway CLI cannot list pull requests, so look in git:
  `git ls-remote --heads origin` for a branch whose name carries `sync`, and, where `gh` is
  installed (it is optional), `gh pr list --search "chore: sync leeway-sdlc"`. One exists: link it
  and stop. No `gh` and no matching branch is not proof; say that you could not check the PR list.
- **The working tree is clean** (`git status --short`), so the branch carries only the sync.

## 1. Read the record

`## Repo copies` in `.sdlc/CONFIG.md`: the `Synced to` row, and one `Kept` row per copy the team
decided to keep. No such section: treat every copy as never synced, and add the section in step 4.

## 2. Compare each copy

**At most the copies in this table. There is no scan of the repo for others.**

| Copy | Repo path from | Plugin copy, in this plugin |
|---|---|---|
| `STORY.md`, `TASK.md` | the *Ticket templates* row of `.sdlc/CONFIG.md` | `skills/sdlc-install/scaffold/templates/STORY.md.tmpl`, `TASK.md.tmpl` |
| the craft floor | the `@` import of `HOW-WE-CHANGE-CODE.md` in `ENGINEERING.md` | `craft/HOW-WE-CHANGE-CODE.md` |
| the contract block | the text between the `leeway-sdlc:begin` and `leeway-sdlc:end` markers (HTML comments) in `CLAUDE.md` | `skills/sdlc-install/scaffold/CLAUDE-BLOCK.md.tmpl`, with `{{ENGINEERING_PATH}}` replaced by the path the block's own `@` import uses |
| the `.gitignore` lines | `git check-ignore -q .worktrees/` and `git check-ignore -q CLAUDE.local.md`, one at a time | a `.worktrees/` line and a `CLAUDE.local.md` line in `.gitignore` |

Compare with `diff -u <repo copy> <plugin copy>`, or the filled-in block for the contract block. Each
copy is one of:

- **the same** → nothing to do;
- **different, and a `Kept` row matches**: its recorded hash equals the first 12 characters of
  `git hash-object <plugin copy>` now → the team already decided, and the plugin's copy has not
  changed since. Report it as kept, with the reason, and do not ask;
- **different otherwise** → ask in step 3. A `Kept` row whose hash no longer matches means the plugin
  changed that file again: show the new diff, and say what the team kept last time and why.

The diff alone does not tell you whether the release changed the plugin's copy or the team edited
its own. Say which you think it is, from `RELEASE_NOTES.md`, but let the answer decide.

**Never synced, never compared, never opened for writing:**

- `.sdlc/leeway.md`. It is the binding (server, product key, `cli:`, friction collector, the project
  to nit-collector table), not a copy, and a template change never reaches it.
- `.sdlc/CONFIG.md`, except its `## Repo copies` section (step 4).
- The contract docs under the doc map (`VISION.md`, `TESTING.md` and the rest): they belong to the
  repo from the moment they are generated. If a release needs a change there, its notes say so.

## 3. Ask, copy by copy

Show each diff and ask: **take the release's copy, keep the repo's, or merge by hand.**

- **Take** → write the plugin's copy over the repo's; for the contract block, replace only the text
  between the markers.
- **Keep** → ask for the reason in one line. It goes in a `Kept` row with today's 12-character
  `git hash-object <plugin copy>`, so the next sync does not ask again until the plugin's copy changes.
- **Merge** → the user edits; you write their result. Record a `Kept` row too, since the repo copy
  now differs on purpose.
- **A `.gitignore` line missing** → offer the line. This is not a style choice: without
  `CLAUDE.local.md`, account ids and local paths the contract block sends there get committed; without
  `.worktrees/`, a worktree is staged by accident. Declined → record it as `Kept` with the reason, and
  say so in the summary.

One question per differing copy and per missing line, no more. A copy that is the same, or kept with
a matching hash, is not asked.

## 4. One branch, one pull request

Everything goes on **one branch**, named by the repo's convention, and **one pull request** titled
`chore: sync leeway-sdlc <version>` (opened with `gh` where it is installed, otherwise committed for
the human to push). In the same change, update `## Repo copies`:

```markdown
## Repo copies

| | |
|---|---|
| Synced to | <version> |

| Kept | Plugin copy hash | Why | Decided |
|---|---|---|---|
| <copy> | <git hash-object, 12 chars> | <the reason given> | <who>, <date> |
```

The `Synced to` row is the stamp the session notice reads. Drop a `Kept` row whose copy was taken
this time. Write nothing to the repo without the answer for that copy, and nothing outside the branch.

## Done when

Every copy in step 2 is the same, taken, or kept with a reason and a hash; `Synced to` names this
version; `.sdlc/leeway.md` is byte-identical to before; and the pull request is open, or the user said
why not. End with one line: the version synced to, and each copy as taken, kept or unchanged.
