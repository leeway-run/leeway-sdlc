---
name: update
description: Update the leeway-sdlc plugin on this machine to the latest released version - refresh the marketplace, show the release notes since the installed version, update the plugin, and report in one line whether this repo's copies are behind. Never changes the repo; that is /leeway-sdlc:sync-repo, run once per release per repo. Use when the user asks to update leeway-sdlc, upgrade the plugin, or pick up a new release.
---

# Update leeway-sdlc

You are updating the tool on this machine, not the repo. **Change only the plugin, and nothing in
the repo.** Every developer runs this; the repo's copies are synced once per release, by one
person, with `/leeway-sdlc:sync-repo`.

## 0. Not in the middle of a run

If a `run-story` or `run-task` is in progress in this session, stop and say so. A new version
changes the agents and templates between one round and the next, so a task would be reviewed under
rules it was not built under. Finish the run, or stop it, first.

## 1. What is installed

```sh
claude plugin list --json
```

Find the entry whose `id` starts with `leeway-sdlc@`. Note its `version`, and the marketplace: the
part after `@` (`leeway` for the published plugin). **Use that name from here on; do not assume
it.** No such entry means leeway-sdlc is not installed: point at the README's *Install* and stop.

If `claude` is not on `PATH`, give the user the commands of steps 2 and 4 to run themselves, with the
marketplace name filled in, and stop.

## 2. Refresh the marketplace, and read the new version

```sh
claude plugin marketplace update <marketplace>
claude plugin marketplace list --json
```

Take that marketplace's `installLocation`. The new version is `version` in
`<installLocation>/plugin/.claude-plugin/plugin.json`. **Read it from the file**, never from memory
or from this skill: this session is still running the old one.

Same version as installed: say "leeway-sdlc <version> is the latest", and go to step 5 anyway. A repo
can lag behind a plugin that is already current.

## 3. What changed

Read `<installLocation>/RELEASE_NOTES.md` and show every `## <version>` section newer than the
installed version, newest first. Show them as written; do not summarise a *Known limits* list away.
No file, or no section for a version: say so; every release is meant to add one.

## 4. Update the plugin

```sh
claude plugin update leeway-sdlc@<marketplace>
claude plugin list --json
```

**The update happened when the list says so**, not when the command exits 0: confirm the
`leeway-sdlc` entry now shows the new version. If it does not, show both outputs and stop. The usual
cause is a change released without a version bump: Claude Code caches a plugin per version, so it is
never picked up.

## 5. Is this repo behind?

One line, and no diffs. Find `.sdlc/CONFIG.md` as the session notice does: the nearest one at or above
the current directory. None found: go to step 6.

Read the `Synced to` row under `## Repo copies` in `.sdlc/CONFIG.md`, and compare it with the new
version, numerically by major, minor, patch:

- **The same** → "this repo's copies are at <version>".
- **Older, or no such row** → "this repo's copies are at <version, or unrecorded>, the plugin is at
  <new>; one person runs `/leeway-sdlc:sync-repo` for this release". The session notice that points
  at the same command reads the same row.

This line is a statement, not a question, so it is the same wherever the repo's contract sends
questions.

**Never diff, offer or write a repo file here.** When everyone who updates is offered the same
diffs, two people open the same PR, and a copy the team decided to keep is asked about at every
release.

## 6. Restart

Tell the user to **restart Claude Code**. Until then this session keeps the old skills, agents and
hooks, and any subagent it starts runs the old version.

End with one line: the version before, the version after, and the step 5 line.
