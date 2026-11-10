# LWY-220: an OpenCode install commits each kit file up to six times

Story: LWY-220, "An OpenCode install commits each kit file up to six times" (type `debt`). The story's body is the source
of the TC-n; this doc says how they are built.

## The problem, measured

In leeway-run/leeway PR #39 (the OpenCode install, LWY-218), 87 of the 156 added files are byte-identical copies of another
file in the same PR: about 741 KB of the ~1.5 MB added. The copies come from three places:

- `.agents/skills/` is committed: the `skills` CLI's install of `targets/agents/skills/`, which holds `sdlc-install/kit/`
  in full (86 files).
- `sdlc-install` copies that `kit/` to `.sdlc/kit/` whole (`plugin/skills/sdlc-install/SKILL.md`, the `plugin-files:
  .sdlc/kit/` paragraph), so `.sdlc/kit/` repeats `.agents/skills/sdlc-install/kit/` file for file.
- The kit carries `harness/` and `wiring/` for all six agents. The chosen agent's wiring is also written to its repo
  paths, so OpenCode's plugin and agent files appear three times.

The source is single: `plugin/`, built by `scripts/build-targets.mjs` and checked by `--check` in `release.yml`. This is
review noise in every adopting repo, on every release, not drift.

## Decisions

The interview's three answers (LWY-220, `# Interview closed`, c4):

- **LWY-220 e1: gitignore the skills directory, keep `skills-lock.json`.** The skills are a per-person install, like
  `node_modules`. The docs name `npx skills add …` to install them; `npx skills experimental_install` restores from the
  lock, but it is experimental and, with `--frozen-lockfile` (its CI default), fails once the plugin's `main` no longer
  matches the lock's hash, so nothing here relies on it.
- **LWY-220 e2: `.sdlc/kit/` holds no `harness/` and no `wiring/`; it keeps `skills/`.** Nothing at runtime reads
  `.sdlc/kit/harness/` or `.sdlc/kit/wiring/`: the guard runs from `.sdlc/kit/hooks/`, `HARNESS.md` is already the
  chosen agent's, and `sync-repo` compares the placed wiring with the installed skill's `kit/wiring/<agent>/`. The
  `skills/` mirror stays, because "in this plugin" resolves there (plan-project's ticket-template fallback,
  shape-project's gap checklist) and it gives every agent one fixed path.
- **LWY-220 e3: the project's plan branch, from `main`.** `feat/p_d18bfea4-leeway-sdlc-on-opencode-v2` was fast-forwarded
  to `main` (`38735a8`) for this story. It ships in the release after 0.3.1; the 0.3.1 release branch changes
  `sdlc-install`, `sync-repo` and `targets.mjs` in other paragraphs, and whichever merges second resolves them.

## What changes

**Each agent names its skills directory.** `scripts/targets.mjs` gets a `skillsDir` per target, rendered into the
harness under "Instructions and local notes" as a `skills-dir:` line:

| Target | `skillsDir` | Source |
|---|---|---|
| opencode | `.agents/skills/` | measured (docs/targets/opencode.md: `npx skills add … -a opencode` copies into `./.agents/skills/`) |
| cursor | `.agents/skills/` | the `skills` CLI 1.7.6 agents table; UNVERIFIED |
| grok | `.grok/skills/` | the same table; UNVERIFIED |
| gemini, codex, copilot | none | they install through their own CLI or as a plugin, outside the repo or not measured |

Claude Code's `plugin/HARNESS.md` says `skills-dir: none`: its skills live in the plugin cache.

**`sdlc-install`** adds the `skills-dir:` path to `.gitignore` with its other lines, only if absent, and never ignores
or deletes `skills-lock.json`. It copies the skill's `kit/` to `.sdlc/kit/` **except `harness/` and `wiring/`**, then
writes `kit/harness/<agent>.md` as `.sdlc/kit/HARNESS.md` and each `kit/wiring/<agent>/` file to its repo path, as
today.

**`sync-repo`** compares `.sdlc/kit/` with the skill's `kit/` minus `harness/`, `wiring/` and `HARNESS.md`, and
`.sdlc/kit/HARNESS.md` with `kit/harness/<agent>.md`. A repo installed before this release still has
`.sdlc/kit/harness/` and `.sdlc/kit/wiring/`: they are "only in `.sdlc/kit/`", which the skill already removes on Take.
The `skills-dir:` path joins its `.gitignore` lines; where `git ls-files` lists files under it, the sync's commit
untracks them with `git rm -r --cached`, so the files stay on disk for the person who installed them.

**What does not change.** `scripts/build-targets.mjs` still builds `kit/harness/` and `kit/wiring/` for every agent,
because the installed skill is the source `sdlc-install` and `sync-repo` read. The package layout comment in
`build-targets.mjs` and the generated header that says what `.sdlc/kit/` holds are updated to match.

## Breakdown

- **LWY-220.1: the skills directory.** `skillsDir` in `targets.mjs`, the `skills-dir:` line in every harness,
  `sdlc-install`'s `.gitignore` line, regenerated targets, tests. (TC-1, TC-5, TC-6.)
- **LWY-220.2: the shared kit.** `sdlc-install` copies `kit/` without `harness/` and `wiring/`; the texts that describe
  `.sdlc/kit/` follow; regenerated targets, tests. (TC-3, TC-5, TC-6.)
- **LWY-220.3: sync-repo.** The trimmed compare, the removal of an old repo's `harness/` and `wiring/`, the skills
  directory's `.gitignore` line and untracking; regenerated targets, tests, the release-notes entry. (TC-2, TC-4,
  TC-6, TC-7.) Blocked by .1 and .2.
- **LWY-220.4: the proof.** An install into a scratch repo and a sync of a copy of the app repo's PR #39 tree, each
  followed by the duplicate count. (TC-8.) Blocked by .3.

## Hazard register

| Hazard | Owning task | The check that proves it closed | Rung |
|---|---|---|---|
| The sync untracks the skills directory with `git rm -r` (no `--cached`) and deletes the person's installed skills | LWY-220.3 | test: sync-repo's text names `git rm -r --cached` and no bare `git rm`; live in .4: the files are still on disk after the sync | R1 |
| The ignore line takes `skills-lock.json` with it (`.agents/` rather than `.agents/skills/`) | LWY-220.1 | test: the line is exactly the `skills-dir:` path; live in .4: `git check-ignore -q skills-lock.json` exits 1 | R1 |
| An agent whose skills live outside the repo gets an ignore line for a directory nobody writes | LWY-220.1 | test: codex, copilot and gemini harnesses say `skills-dir: none`, and sdlc-install writes no line for `none` | R1 |
| `sync-repo` reports the absent `harness/` and `wiring/` as "only in the plugin" and offers them back on every sync | LWY-220.3 | test: the compare excludes `harness/`, `wiring/` and `HARNESS.md`; live in .4: a second sync finds the kit the same | R1 |
| A skill still resolves a path under `.sdlc/kit/harness/` or `.sdlc/kit/wiring/`, which no longer exists | LWY-220.2 | test: no file under `plugin/` or `targets/agents/` names `.sdlc/kit/harness` or `.sdlc/kit/wiring` | R1 |
| Generated `targets/agents/` not regenerated after a change to `plugin/` or `targets.mjs` | every task | `node scripts/build-targets.mjs --check` passes in each task's lanes | R0 |
