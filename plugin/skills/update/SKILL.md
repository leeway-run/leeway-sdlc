---
name: update
description: Update the leeway-sdlc plugin on this machine to the latest released version - refresh the marketplace, show the release notes since the installed version, update the plugin, and report in one line whether this repo's copies are behind. Never changes the repo; that is the sync-repo skill, run once per release per repo. Use when the user asks to update leeway-sdlc, upgrade the plugin, or pick up a new release.
---

# Update leeway-sdlc

You are updating the tool on this machine, not the repo. **Change only the plugin, and nothing in
the repo.** Every developer runs this; the repo's copies are synced once per release, by one
person, with the sync-repo skill.

**The commands are the harness's.** Read `HARNESS.md` in this plugin, "Installed version, update and
restart": it names the command that lists what is installed, the one that refreshes the source, the one
that updates, where the new version is read, and how to restart. The steps below say what each is for;
`HARNESS.md` says what to type. Where a line there says the agent has no such command (an agent that
installs skills with `npx skills`, for example), give the user its replacement from the same section.

## 0. Not in the middle of a run

If a `run-story` or `run-task` is in progress in this session, stop and say so. A new version
changes the agents and templates between one round and the next, so a task would be reviewed under
rules it was not built under. Finish the run, or stop it, first.

## 1. What is installed

Run the **installed** command from `HARNESS.md`. Note the installed version and, where the harness has
one, the marketplace or source name. **Use that name from here on; do not assume it.** Not installed:
point at the README's *Install* and stop.

If the agent's command is not on `PATH`, give the user the commands of steps 2 and 4 to run themselves,
filled in, and stop.

## 2. Refresh the marketplace, and read the new version

Run the **refresh the source** command from `HARNESS.md`. The new version is the `version:` line of the
`HARNESS.md` it names in the refreshed source. **Read it from the file**, never from memory or from this
skill: this session is still running the old one.

Same version as installed: say "leeway-sdlc <version> is the latest", and go to step 5 anyway. A repo
can lag behind a plugin that is already current.

## 3. What changed

Read `RELEASE_NOTES.md` at the root of the refreshed source and show every `## <version>` section newer than the
installed version, newest first. Show them as written; do not summarise a *Known limits* list away.
No file, or no section for a version: say so; every release is meant to add one.

## 4. Update the plugin

Run the **update** command from `HARNESS.md`, then the **installed** command again.

**The update happened when the installed version says so**, not when the command exits 0. If it does not
show the new version, show both outputs and stop. The usual cause is a change released without a version
bump: a harness that caches a plugin per version never picks it up.

## 5. Is this repo behind?

One line, and no diffs. Find `.sdlc/CONFIG.md` as the session notice does: the nearest one at or above
the current directory. None found: go to step 6.

Read the `Synced to` row under `## Repo copies` in `.sdlc/CONFIG.md`, and compare it with the new
version, numerically by major, minor, patch:

- **The same** → "this repo's copies are at <version>".
- **Older, or no such row** → "this repo's copies are at <version, or unrecorded>, the plugin is at
  <new>; one person runs the sync-repo skill for this release" (named as `HARNESS.md`, "commands",
  spells it). The session notice reads the same row.

This line is a statement, not a question, so it is the same wherever the repo's contract sends
questions.

**Never diff, offer or write a repo file here.** When everyone who updates is offered the same
diffs, two people open the same PR, and a copy the team decided to keep is asked about at every
release.

## 6. Restart

Tell the user the **restart** step from `HARNESS.md`. Until then this session keeps the old skills,
agents and hooks, and any subagent it starts runs the old version.

End with one line: the version before, the version after, and the step 5 line.
