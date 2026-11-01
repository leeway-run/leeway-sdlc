# What to detect before asking

Work this list first. **Never ask for anything here without looking.** Every row you detect is a
question the user does not have to answer, and a signal that the ones you do ask are worth their
time.

Report findings as a table. In new-project mode most rows come back empty — report those as **"not
yet decided"**, not "not detected". The difference is the whole mode.

The stacks named below are examples of where to look, not cases the installer favours. Whatever the
repo uses, the questions are the same: what builds it, what tests it, what CI runs, where the docs are.

## Version control and topology

```sh
git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null        # default branch
git branch -a --format='%(refname:short)' | head -40          # existing branch-name prefixes
git rev-parse --show-superproject-working-tree                 # nested-repo trap
git remote get-url origin 2>/dev/null                          # the repository, owner/repo
ls .githooks 2>/dev/null                                       # hook activation
```

A repo with no commits and no remote has no default branch yet: ask for the integration branch name
(propose `main`) rather than reporting an error.

**The nested-repo trap is worth the one command.** A tool that grabs "the repo" can take the wrong
one when a repo sits inside another.

### Branch pattern

Branch names come from the process (each type's branch prefix), so the installer does not choose a
pattern. It reports what the repo already uses, so a mismatch with the process's prefixes is visible.
**Read a bounded slice:** the 200 most recently committed branch refs, local and remote, and the branches
named by the last 200 merge commits (pull-request and branch merges; a remote-tracking merge such as
`Merge remote-tracking branch 'origin/main'` names no branch of its own). Each branch name is counted once,
however many of the three places carry it:

```sh
{ git for-each-ref --sort=-committerdate --count=200 --format='%(refname)' refs/heads refs/remotes \
    | sed -E 's|^refs/heads/||; s|^refs/remotes/[^/]+/||'
  git log --merges -200 --format=%s | grep -v 'remote-tracking' \
    | grep -oE "^Merge pull request #[0-9]+ from [^/ ]+/[^ ]+|^Merge branch '[^']+'" \
    | sed -E "s|^Merge pull request #[0-9]+ from [^/]+/||; s|^Merge branch '||; s|'\$||"
} | grep / | sort -u | sed 's|/.*||' | sort | uniq -c | sort -rn
```

Then the floor (an existing `ENGINEERING.md`, or the file mapped as the floor): the branch names its
branches section prescribes, for example `feature/<story>-NN-<task>`.

**Map each prefix to a type** of the process: a prefix equal to a type's `branchPrefix`, `id` or `label`
(ignoring case), or a common synonym of one: `feature` or `feat`; `fix`, `bug` or `bugfix`; `hotfix`;
`chore`; `spike` or `exp` for an experiment; `refactor` for debt. A prefix that maps to no type (`docs`,
`release`, a person's name, `dependabot`, `renovate`) is reported in the findings table and asked about
nowhere.

**A branch-prefix divergence** is a type whose most used mapped prefix, counted on at least three branches
or prescribed by the floor, is not its `branchPrefix`. It is what sdlc-install's question 14 asks about, one
line per diverging type. Only the prefix is the process's to change: the rest of a branch name is always
`<ref lower>-<slug>`. No branches, no merges and no prescribing floor: no divergence. **Settled already**,
so not a divergence: a floor that carries the line question 14's process answer writes ("branches named
`<pattern>` before leeway-sdlc keep their names").

**Trunk on `main` with no long-lived second branch is a valid topology, not a gap.** Do not propose
git-flow to a repo that has never had a `develop` branch.

### Commit convention

```sh
git log -50 --format=%s | head -20                                  # the shape of a subject line
git log -50 --format=%B | grep -cE '[A-Z]+-[0-9]+'                  # a tracker key in the history
git log -50 --format=%B | grep -c '^Co-Authored-By'
```

Report what you see, for the floor's *Branches and commits* section. Do not invent a convention the
history does not show.

## Toolchain

Lockfile discriminates the package manager; do not ask. `pnpm-lock.yaml`, `package-lock.json`,
`yarn.lock`, `bun.lockb`, `uv.lock`, `poetry.lock`, `Cargo.lock`, `go.sum`, `Gemfile.lock`,
`composer.lock`, `packages.lock.json`.

Build files that name an entry point: `*.sln`, `pom.xml`, `build.gradle*`, `Makefile`, `justfile`,
`pyproject.toml`, `go.mod`, `Cargo.toml`, `Gemfile`.

Workspaces: `pnpm-workspace.yaml`, a `workspaces` key in `package.json`, `[workspace]` in
`Cargo.toml`, a `go.work`, several solution or project files.

A manifest need not be at the root:

```sh
find . -maxdepth 3 \( -name package.json -o -name pyproject.toml -o -name go.mod -o -name Cargo.toml -o -name pom.xml \) -not -path '*/node_modules/*' -not -path '*/target/*'
```

Each one found is its own toolchain: **its own lockfile picks its package manager, and its commands
run from its directory**, never from the root.

## Commands

In order of preference: `package.json` scripts matching `^(test|test:|lint|typecheck|check|build|gate)`,
then `Makefile` targets, `justfile` recipes, `pyproject.toml` scripts, `tox.ini`, `noxfile.py`,
`Cargo.toml` aliases. Where a stack has no scripts file (a bare `dotnet test`, `go test ./...`,
`mvn test`), the command is the stack's own, and the lanes come from its test projects or packages.

Group the test commands by name and by what they reach for. A lane that needs a database, a
container runtime, browsers or a running app is an infrastructure lane until CI proves otherwise.

**Time the lanes.** A cold install and build can run for minutes, and a tool call with a two-minute
default timeout reports that as a failure. Put the measured duration in the lane's *Needs* column so
the orchestrator sets a timeout, or runs the lane in the background, instead of retrying a build that
was never broken.

## CI reality — the highest-value detection on this list

Find the CI definition, whatever it is called: `.github/workflows/*.yml`, `.gitlab-ci.yml`,
`.circleci/config.yml`, `Jenkinsfile`, a pipelines YAML at the root, `bitbucket-pipelines.yml`,
`.buildkite/`, or a pipeline directory. Read its job names **and the actual command lines**, and work
out **which local commands CI genuinely executes**.

This is what lets the testing doc's CI section be generated *true* rather than asserted: a doc's
claim about what CI runs goes stale the moment the workflow changes, and nothing tells you it has.

Do not settle for the job names. Read the commands. A `|` block runs past the line grep shows you;
read the whole block.

**Many repos keep no steps of their own.** A definition that only includes a shared template runs
steps that live elsewhere. What this repo controls is the parameters it passes — read those. If you
cannot read the template, **write in `CONFIG.md` that CI's steps live in `<template>` and were not
verified**, and mark the lane's *In CI?* as unverified. A guessed `yes` there is the exact false claim
this section exists to prevent.

**A path filter is part of the answer.** A filter that excludes `*.md` means a docs-only diff merges
with no build at all, and the gate should say so. No CI definition found is a finding too: say so, and
the gate command is then only what a developer runs by hand.

## Test idiom

Runner from devDependencies and config files: vitest, jest, mocha, `node --test`, pytest, `go test`,
`cargo test`, rspec, phpunit, JUnit, playwright (`playwright.config.*`), `dotnet test`.

Then the question that actually matters: **are tests auto-discovered, or named in a hand-maintained
array?** Grep any runner script for a list of test filenames. If tests are discovered, the
runner-array section of the testing doc is **omitted entirely** — a rule for a hazard this repo does
not have is noise, and noise is what teaches people to skim.

Record the command that runs exactly one test, and run it once to prove it. Fail-before and
pass-after depend on it, and a filter that silently matches nothing reports green.

A browser-test runner needs browsers installed and a running app: an infrastructure lane unless CI
starts both.

## Existing contract docs

Case-insensitive, across `docs/`, `doc/`, the root, and `.github/`, for the seven names (vision,
architecture, codebase-invariants, testing, evidence-standard, gotchas, recipes). Then the
near-synonyms, which are where the real matches usually are:

| Found | Probably plays the role of |
|---|---|
| `CONTRIBUTING.md` | the floor |
| `adr/`, `decisions/`, `rfcs/` | invariants |
| `DESIGN.md`, `OVERVIEW.md` | architecture |
| `TROUBLESHOOTING.md`, `FAQ.md` | gotchas |
| `HACKING.md`, `DEVELOPMENT.md` | the floor, or recipes |

**An exact-name match is never a question.** Map it and move on.

**Blocking rungs in an existing evidence doc.** An evidence doc that exists (not one the install will
generate) may say which rungs block, for example "evidence blocks at R3 and above":

```sh
grep -niE 'block(s|ing)?( only)? (at|on|from)|R[1-5] and above' <evidence doc>
```

Read the line it finds and write the rungs it names as a set (`R3 and above` is `[R3, R4, R5]`). **A
blocking-rung divergence** is a type whose `build` step's `blockingRungs` differs from that set; it is what
sdlc-install's question 15 asks about, naming each such type and its set. No such line, a line that names no
rung, a line that defers to the process (the plugin's own template says "the rungs the `build` step ...
lists as `blockingRungs`"), no existing evidence doc, or an evidence row in `.sdlc/CONFIG.md` whose *Notes*
already says the line is superseded by the process: no divergence.

## Collisions

An existing contract file (the instructions file `HARNESS.md` names: `CLAUDE.md`, `AGENTS.md` or
`GEMINI.md`), and whether it already imports anything or already carries a `leeway-sdlc:begin` block. An
existing `ENGINEERING.md`. Existing agent definitions named `sdlc-implementer`, `sdlc-reviewer` or
`sdlc-divergence-reviewer` (in `.claude/agents`, `.codex/agents`, `.github/agents`, `.gemini/agents`,
`.cursor/agents`, `.opencode/agents` or `.grok/agents`), existing hook files the wiring would merge into, or
skills (`.claude/skills`, `.agents/skills`, `.github/skills`, `.gemini/skills`, `.opencode/skills`, `.grok/skills`) named
`shape-work`, `plan-work`, `run-task`, `run-story`, `update`, `sync-repo` or `sdlc-tune`: a repo-local
definition and a plugin-provided one with the same name is a confusion worth naming before it happens.
An existing `.sdlc/` directory: read `.sdlc/leeway.md` and `.sdlc/CONFIG.md` first, because this is a
re-run, and a re-run changes only what the human asks to change.

**What the managed block would repeat.** Read the instructions file, outside the markers, for:

- **an import of the floor**: an `@` line, or a "read it first" line, naming the floor's path. Look for it
  on every run, a re-run included: it decides `{{IMPORT_FLOOR}}` every time (sdlc-install, "Placeholders to
  fill with care"), after question 13's write;
- **sections the block repeats**: a heading that reads as one of the block's ("Two ways of working, one
  floor", "Where a new fact goes") or a near-synonym of one ("The floor", "Engineering rules", "Where facts
  go", "Where to write things down").

```sh
awk '/leeway-sdlc:begin/,/leeway-sdlc:end/ { next } /^@|^#+ / { print NR ":" $0 }' <instructions-file>
```

It prints the file's own line numbers and leaves out the managed block, marker lines included, so an `@` line
it prints is outside the markers. Record each by line number, and for each section the lines it carries that
the block does not (a repo rule, a path, a name): those are what question 13 must show before it offers
removal. With no block yet, either found is what sdlc-install's question 13 asks about; neither found, nothing
is asked. When the file already has a `leeway-sdlc:begin` block, an earlier install settled question 13, so
skip only its part: the repeated sections, what the block lacks, and the removal.

**An existing allow-list.** In the place `HARNESS.md`, "Permissions for an unattended run", names, which of
run-story's allow-list entries ("Unattended prerequisites") are already there. Question 16 offers only the
missing ones.

## Leeway

```sh
command -v leeway && leeway --version     # on the PATH?
```

`leeway` on the PATH becomes `cli: leeway`. Otherwise ask for the command (a path such as
`node /path/to/leeway.js`), run `<command> whoami` to prove it, and write it as `cli:`. A `.sdlc/leeway.md`
that already exists names the server, the product and the command: use them, and ask only what changed.

## Evidence path

```sh
git check-ignore -v docs/evidence 2>/dev/null
```

If the intended evidence directory is gitignored, evidence has nowhere durable to live (Leeway takes
no attachments). That is a real finding and the user has to decide it.

## Plans directory

```sh
ls -d docs/plans docs/design docs/designs docs/rfcs plans 2>/dev/null
```

An existing directory of design docs is the *Plans directory*; map it. None → propose `docs/plans/`.
`plan-work` writes each design doc as `<dir>/<ref lower>-<slug>.md`.

## Local instructions file

```sh
git check-ignore -q <local-notes-file> && echo ignored || echo NOT ignored
```

`<local-notes-file>` is `HARNESS.md`'s (`CLAUDE.local.md` for Claude Code, `.sdlc/local.md` otherwise). The
contract block tells people to put per-developer facts there. **If it is not
ignored, that is a finding**: the `.gitignore` lines in the plan cover it. Never write that it is
ignored when the check says it is not.

## Evidence instruments

These feed the instrument column of the evidence doc. Propose what the repo already has; a rung with
no instrument here is a rung to ask about, not one to fill with a wish.

| Rung | Instrument | Detected by |
|---|---|---|
| R1 | The one test, failed before and passed after, via the single-test command recorded above | Any test runner |
| R2 | A browser-test run with its screenshot or trace; else a screenshot of the running app and the steps | `playwright.config.*`, a dev server script |
| R3 | A request-file run, a collection run, or a `curl` transcript — request and response verbatim | `*.http`, `*.postman_collection.json`, an API server |
| R4 | The refusal, then the same attempt with the control disabled | Any auth or isolation code |
| R5 | The migration tool's dry run (a generated script, a plan), then the after-state query | A `migrations/` directory, a migration tool in the manifests |

A rung that cannot apply (a library has no R2) is removed from the evidence doc, not left to be ignored.

### Per-worktree setup

A worktree shares nothing but git. *Per-worktree setup* in `CONFIG.md` should say what a fresh worktree
needs before a lane runs (an install, a build, a copied environment file) and, where they exist:

- **A scratch database per worktree.** Two worktrees migrating one database each roll back the
  other's schema. Name it after the branch and point the connection at it through an environment
  variable, never a committed file.
- **Migration collisions.** Two worktrees that each add a migration collide on the number or on a
  generated snapshot; whichever merges second is regenerated on top of the first, not hand-merged.
- **Fixed ports.** A dev server pinned to one port cannot run twice. Say which ports are fixed.

## Runtime

`node --version`. The hooks are `.mjs` — **no Node is a hard stop**, and say so plainly rather than
installing anything. Where the repo pins a toolchain version (`.nvmrc`, `global.json`, `rust-toolchain`,
`.tool-versions`), the installed one must satisfy it; a mismatch is a finding, not something to install.
