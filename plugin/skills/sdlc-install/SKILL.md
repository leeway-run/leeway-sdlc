---
name: sdlc-install
description: Set up this repo to use the leeway-sdlc loop - detect what is already here, bind it to a Leeway product, ask only what cannot be inferred, set the product's process, then generate the floor, the seven contract docs and the Leeway binding. Use when adopting leeway-sdlc into an existing repo or starting a new project with it. Run it again to reconfigure.
---

# Install leeway-sdlc into this repo

You are configuring a repo and a Leeway product, not writing the repo's code. **Detect first, bind
second, ask third, write last**, and show the whole plan before writing any file.

Read `PROCESS.md` in this plugin before you start ("The cast", "How the plugin reaches Leeway", "The
process, read at runtime"), and `HARNESS.md`.

**Which agent this is.** `HARNESS.md` says `agent: claude` in the Claude Code plugin: that settles it. In the
package for other agents it says `agent: any`, and this skill's `kit/harness/` has one `<agent>.md` per agent
it supports (`codex`, `copilot`, `gemini`, `cursor`, `opencode`, `grok`). Then ask, pre-filled with the agent
you are running in: "This repo will be worked in `<agent>`. Right?" (Another agent later is another install
run: the wiring of each is additive.) From here on, **`HARNESS.md` means `kit/harness/<agent>.md`**: it gives
the instructions file, the local-notes file, how the floor is imported, and the wiring to write. A repo used
from Claude Code and another agent gets both: the plugin for Claude Code, this kit for the other. You are about to make claims in `.sdlc/CONFIG.md` that the loop will trust
absolutely.

**Everything goes through the `leeway` CLI**, never an MCP server and never a hand-made HTTP call. Below,
`<cli>` is the command the repo is configured with (step 3 settles it), and `<server>` the server URL. Pass
`--server <server>` on every call. Writes carry `--as <alias>/agent`, the alias being this session's, chosen as
`PROCESS.md` ("The cast") describes (`<word>-<two hex digits>`, for example `kestrel-b1`); the CLI's roles are
`implementer`, `reviewer`, `planner` and `agent`, and a skill acting for the orchestrator is `agent`. **No token, no credential, no
server secret is written to any file, and none is shown in the transcript.**

**Where the human is asked.** Every question below is a question to the human. In a repo whose
`.sdlc/PROCESS.md` or contract says that questions go to the human as Leeway escalations (the Leeway repo
does), do not prompt in the terminal: raise each interview question as an escalation on the install's issue
(the ref the human gave when invoking this skill; with none, stop and say that an issue is needed), with the
pre-filled answer as the first option and 2 to 5 options in all, and stop the turn until it is answered.
Every option is `{label, argument}`: the label at most 60 characters, the argument (why this option, in a
sentence or two) at most 1,000, and the question at most 500.

- **Yes/no questions** (6, 7, 8, 10, 11 and any "Right?"): two options, the pre-filled one first.
- **Question 1** with more than five candidate products: the top four by match, plus "Another, named in the
  note" as the fifth.
- **Question 9** is a batch of yes/no lines: raise one escalation per ambiguous mapping, or post the batch as
  a comment first (`comment add <ref> --stdin body`) and raise one escalation on it with `--comment cN`
  (one open escalation per comment).
Anywhere else, ask in the terminal, one question at a time, pre-filled.

## Step 1 — decide which mode this is

```sh
git rev-parse --is-inside-work-tree && git log --oneline -1 2>/dev/null | wc -l
ls -A | head -30
```

**Existing repo** — there is code, history or at least files, and probably conventions. The job is to
**write down what is already true**. Detection carries most of the work and the interview is short. A repo
with files but no commits yet counts: detection reads the files.

**New project** — little or no code. The job is to **help decide** things nobody has decided yet: the
lanes, what counts as done. Detection finds almost nothing, so the questions are about decisions, not
confirmations.

**Say which mode you are in, and why, before going further.** Getting this wrong produces either an
interrogation about a repo you could have read, or confident documents describing a codebase that does not
exist.

## Step 2 — detect

Work `references/detection.md`. **Never ask for anything on that list without looking first.** Report what
you found as a short table before asking anything: a user who sees that you already know the package
manager, the lanes and the CI coverage will trust the questions you do ask.

In new-project mode most rows come back empty. That is a finding, not a failure: report it as "not yet
decided", not "not detected".

## Step 3 — bind to Leeway

1. **The command.** `command -v leeway`. On the PATH: `cli: leeway`. Otherwise **ask for the command**,
   pre-filled with installing the CLI from npm (`npm i -g @leeway-run/cli`, which the human runs, then `cli:
   leeway`); a path such as `node /path/to/apps/cli/dist/leeway.js` is the other answer. Run `<command>
   --version` to prove it runs, and write it as `cli:`. An existing `.sdlc/leeway.md` already names it: use it.
2. **Who and where.** `<cli> whoami`. It names the account and the server. Not signed in: stop and tell the
   human to run `<cli> login` themselves (it signs in to `https://app.leeway.run`; `--server <url>` for
   another server), then re-run. **Never ask for, read, print or write a
   token.** The server in `whoami`'s answer is `<server>`.
3. **The product.** `<cli> product list`. Pick the one that matches this repo (the human's answer to question
   1 below), or create it: `<cli> product create --name "<name>" --key <2 to 5 uppercase letters> --color
   <one of #e0994f #6fbf95 #9184d9 #6f9bbf #d98a8a #c9b45e #8f8f9e>`. A product is created only on the
   human's yes.
4. **The process already there.** `<cli> process get <KEY> --json` answers `{process, version, updatedAt}`.
   `version` is the revision counter: `0` and `updatedAt: null` mean the product never set a process (the
   answer is the `mvp` preset, not a stored one); `1` or more means a person or an earlier install set it.
   Hold that fact for question 2.

## Step 4 — the interview

**At most twelve questions, in this order, each pre-filled from detection or from what the product
already holds.** Confirm-or-correct, never open-ended. A question whose answer detection settled is shown as
a finding and not asked.

1. **Product.** "This repo is bound to `<KEY>` (`<name>`) on `<server>`. Right, or pick another or create
   one?" Pre-fill with the only product, or the one whose key or name matches the repo.
2. **What are we building here?**
   - (a) a quick MVP or prototype: speed first, light review, no red tests (`--preset mvp`);
   - (b) a maintained system people depend on: shaping, a plan gate, red tests, adversarial review
     (`--preset maintained`);
   - (c) start from (b) and relax it per type (`maintained`, then the adjustments below).

   **When step 3.4 found a process (`version` of 1 or more), the pre-filled answer is (d) keep what is
   there**, and the question says so: "`<KEY>` already has a process (version N): `<one line per type>`. Keep
   it, or replace it with (a), (b) or (c)?" On (d) make **no** `process update` call and skip questions 3 to 5.
   **A process is never overwritten without this answer**; on a re-run, never replace it by default.
   Without a stored process, pre-fill (a) for a new project and a repo with no CI and no tests, and (b) when
   detection found CI that runs tests.
3. **Types.** "The types are `<labels>`. Keep them all, drop any, or add one by naming it and the type it
   behaves like?" A type added by analogy copies that type's steps under a new id, label and branch prefix.
   Skipped on (d).
4. **Steps, per type kept.** "A `<type>` goes `<step labels joined with →>`. Keep, or change?" ("An" before a vowel:
   "An experiment".) State it in words, not JSON, one type per line. A change is a step removed (bugs skip the plan), added, or reordered.
   Skipped on (d).
5. **Unattended.** "`run-story` may run these types without a person between tasks: `<types whose build step
   is unattended>`. Right?" Only types with a `build` step can be unattended. Skipped on (d).
6. **The gate.** "The command that must pass before a story merges: `<command>`. Right?" Propose the
   commands CI runs; if its steps live in a template you could not read, say so.
7. **Lanes CI lacks.** "These lanes need something CI does not have, so the gate does not run them: `<lanes>`.
   Right?" Show each lane's measured duration. Skip when there is no such lane.
8. **Evidence directory.** Only when non-obvious, or when the directory is gitignored: "Proof that outlives a
   task is committed under `<dir>`. Right?"
9. **Ambiguous doc mappings.** Batched, one line each: "`<file>` plays the role of `<doc>`. Yes?" **Never
   ask about an exact-name match, and never ask when nothing plausible exists**: generate the stub and say
   so.
10. **The contract file.** "Patch `<instructions-file>` with the managed block, or hand the block over to
    paste?" The file is `HARNESS.md`'s **instructions-file** (`CLAUDE.md`, `AGENTS.md` or `GEMINI.md`).
    Default to patch when it exists without the block, and to create it when there is none.
11. **Filing work.** "Filing work in Leeway (a story with tasks, several issues, anything touching the schema,
    auth, a product rule or an ownership boundary) counts as planning: the agent invokes plan-work for it,
    even while pairing. Or plan-work stays a manual opt-in?" Pre-filled `plan-work`, or with the
    `filing-work:` line of an existing `.sdlc/leeway.md`. The answer is `plan-work` or `manual`.
12. **Friction project.** "Friction (a tooling, test-data, local-setup or process gap that cost time) is
    filed as one `chore` issue per item in a project of the product. Use `<project>`, or create one?" Propose
    an existing project whose name says developer experience or friction (`<cli> project list <KEY>`);
    otherwise offer to create the project "Developer experience". No "Friction" issue is created. None
    wanted: `n/a` and why.

**Never asked, in either mode:** the ladder's structure, the filing bar, the roles, the templates (story and
task shapes included). Those are the framework. Making them configurable is how a framework becomes a
config format nobody tunes correctly.

**Written without asking, as framework defaults:** the per-story budget `2,000,000 subagent tokens · 15
rounds · 4 h wall-clock`, whichever comes first (a harness fact, so it lives in `CONFIG.md`, not in Leeway).
A human edits `CONFIG.md` to change it.

## Step 5 — set the process

Skipped when question 2 was (d). Otherwise, and only after the human has answered 2 to 5:

1. `<cli> process update <KEY> --preset mvp` (or `maintained`: the answer to question 2).
2. **Adjustments**, when questions 3 to 5 changed anything. Read the stored definition
   (`<cli> process get <KEY> --json`), edit only its `process` value, and send the whole definition back:
   `<cli> process update <KEY> --stdin process < <file outside the repo>`.
   - The definition is `{version: 1, defaultType, types: [{id, label, branchPrefix, steps}]}`. Step kinds are
     `shape | plan | gate | build | manual`; statuses `backlog | ready | in_progress | in_review`. A `build`
     step carries `params {redTests, round0Cap, roundCap, review: light|standard|adversarial, blockingRungs,
     unattended}`; a `plan` step `params {designDoc}`.
   - Question 3 adds or drops types (the `defaultType` stays a kept type). Question 4 adds, removes or
     reorders steps. Question 5 sets `unattended` on `build` steps. Change nothing else.
   - **The body stays under 16384 bytes** (`wc -c <file>`); the server refuses more as `invalid_process`.
   - `process_in_use` (an open issue would be stranded) is not an install problem: say which refs it names,
     and leave the process as it was.
3. **Read it back**: `<cli> process get <KEY> --json`, and show the human the version and one line per type
   (labels joined with →). The files you write next describe this, so never write them from the answers.

## Step 6 — show the plan, then write

Print every path with `create`, `map` or `patch` and **ask once**. `patch` is only ever the instructions file,
`.gitignore`, and an agent settings file the wiring merges into (`.gemini/settings.json`, `.cursor/hooks.json`,
`opencode.json`), always as a marked block, appended lines or added entries, always shown as a diff first.

**Never rewrite a doc that already exists.** A mapping is a row in `CONFIG.md`, not an edit.

### Generate all seven contract docs, always

Even the ones that will be empty. A missing file gives a reader nothing to discover, so nobody learns it was
meant to exist. The doc names (`docs/VISION.md`, `ARCHITECTURE.md`, `CODEBASE-INVARIANTS.md`, `TESTING.md`,
`EVIDENCE-STANDARD.md`, `GOTCHAS.md`, `RECIPES.md`) come from `scaffold/docs/`; an existing doc, or a
near-synonym the human confirmed in question 9, is mapped instead.

**But an empty file is never silent about being empty.** Every stub states that it is a stub, that this is
correct for now, and — the part that matters — **what event should produce its first entry**:

| Doc | First entry when |
|---|---|
| gotchas | somebody loses an hour to something that made no sense |
| recipes | you do the same kind of change for the **second** time |
| invariants | you explain, twice, a decision a neighbouring file would not have shown |

Those three ship as stubs. The others are filled from detection:

- **testing** — the real lane table and the **real CI coverage, parsed from the workflow or pipeline**.
  Coverage that lives in a template you could not read is written as unverified, not as yes. Omit the
  `{{RUNNER_ARRAY_SECTION}}` entirely when tests are auto-discovered.
- **architecture** — a generated annotated tree, plus a *Known limitations* that says why it must not stay
  empty.
- **evidence** — the ladder verbatim; only the instrument column is yours, proposed from detection's
  *Evidence instruments*. **Remove rungs that cannot apply here** rather than leaving them. Which rungs
  block is the process's `blockingRungs`, not this doc's.
- **vision** — prompts in an existing repo; genuinely written in a new one, where it is the first document
  and everything else cites it.

**A stub contains a trigger or a detected fact. Never a heading with nothing under it.**

### Then write the wiring

- `.sdlc/CONFIG.md` from `scaffold/CONFIG.md.tmpl`, trimmed to repo facts. No `{{...}}` survives; a row that
  does not apply says `n/a` and why.
- `.sdlc/leeway.md` from `scaffold/leeway.md.tmpl`: `server:`, `product:`, `cli:`, `friction-project:`
  (question 12), `filing-work:` (question 11) and an empty nit-collector table that `plan-work` appends to. **Never a token, a password or a credential
  file path.**
- `ENGINEERING.md` from `scaffold/ENGINEERING.md.tmpl` (the floor), unless one exists: then map it.
- The managed block from `scaffold/AGENT-BLOCK.md.tmpl` into the instructions file, between `leeway-sdlc:begin`
  and `leeway-sdlc:end`, `{{FILING_WORK_RULE}}` filled from the `filing-work:` just written. If the block is already there, show the diff and replace only the text between the
  markers; if the human chose to paste (question 10), print it and write nothing.
- `.gitignore` lines `.worktrees/`, the local-notes file and `.sdlc/.governed/`, each only if absent.
- **Where `HARNESS.md` says `plugin-files: .sdlc/kit/`** (every agent but Claude Code): copy this skill's `kit/`
  directory to `.sdlc/kit/` whole, then copy `kit/harness/<agent>.md` over `.sdlc/kit/HARNESS.md`, so every
  other skill finds the plugin's files and this harness there. **It is committed**: a teammate who installs
  the skills gets the loop from the repo. Then write the agent's **wiring**: every file under
  `kit/wiring/<agent>/` to the same path from the repo root (the subagents and the hook that runs
  `.sdlc/kit/hooks/adapters/guard.mjs`). A wiring file that already exists is a merge, never an overwrite: for
  JSON, add the `leeway-sdlc` entries and keep the rest; for anything else, show the diff and ask.
  `HARNESS.md`, "Wiring", lists anything the agent needs the human to do after (trusting hooks, a restart).
- `.sdlc/templates/STORY.md` and `.sdlc/templates/TASK.md`, a byte copy of each checked-out file in
  `scaffold/templates/` (drop the `.tmpl`). The block above the rule, "Notes for the writer", is copied as
  is and is never written to Leeway: `plan-work` strips it. The checked-out files may be CRLF where git stores
  LF; copy them as they are, since `sync-repo` normalises line endings in its compare. **If the
  directory exists, leave it alone** and show its diff against the plugin's copy: a team that edited its
  templates made a decision.
- The craft doc: `craft/HOW-WE-CHANGE-CODE.md` **byte-copied** (same line-ending rule) into the repo's docs directory (for example
  `docs/engineering/HOW-WE-CHANGE-CODE.md`); that path is `{{CRAFT_PATH}}`. An `@` import cannot reach the
  plugin cache, so the import needs a file in the repo. **If it exists, leave it alone** and show its diff.

**Stamp** `Generated <date> by leeway-sdlc <version>.` near the top of `CONFIG.md` and `leeway.md`, and the
row `| Synced to | <version> |` under `## Repo copies` in `CONFIG.md`. `<version>` is this plugin's
`version:` line in `HARNESS.md`. The session-start notice reads that row. A copy you left alone
because it differs gets a *Kept* row with the human's reason and `git hash-object` of the plugin's copy, so
`sync-repo` does not ask about it again until that copy changes.

**Placeholders to fill with care:**

- **`{{REQUIRED_READING_ROWS}}`** — one row per area whose conventions live in a skill or rule file, as
  `` | `<glob>` | `<file>`, `<file>` | <why> | ``. Find them; never invent one: a contract-file line that
  routes an area to skills, every `.claude/rules/*.md` with a `paths:` frontmatter, every
  `.github/instructions/*.instructions.md` with an `applyTo:`, every `.cursor/rules/*.mdc` with `globs:`, and
  every `.grok/rules/*.md`. None found → delete
  the placeholder line, leave the table with no rows, and say so.
- **`{{PLANS_DIR}}`** — an existing design-docs directory, else `docs/plans/`.
- **`{{PLAN_BRANCH}}`** — `none: stories branch from <integration branch>`, unless detection found a plan-branch
  convention in the history; `plan-work` reads this row.
- **`{{FRICTION_PROJECT}}`** — a project id you have read back from Leeway (`<cli> project list <KEY>
  --json`). **Never invent one.** Creation is one write, only on the human's yes: `<cli> project create <KEY> --name
  "Developer experience" --as <alias>/agent`, then read its id back. No issue is created in it.
- **`{{FILING_WORK}}`** — `plan-work` or `manual`, the answer to question 11.
- **`{{FILING_WORK_RULE}}`** — from `filing-work:` in `.sdlc/leeway.md`. For `plan-work`, the placeholder
  is replaced by this paragraph, exactly as written here, without the indent:

  ```markdown
  **Filing work in Leeway is planning, even while pairing.** Before creating a story with tasks, more than
  one issue, or anything touching the schema, auth, a product rule or an ownership boundary, invoke
  `plan-work`. That includes adding to an existing project, and requests worded "file issues", "write this
  up", "break it down", "park it for later" or "turn this feedback into tickets". Only a single sub-issue for
  a one-file fix goes in directly. Running the loop (`run-task`, the reviewers, the merge gates) stays opt-in.
  ```

  For `manual`, delete the placeholder's line and the blank line after it, so the opt-in paragraph is
  followed by one blank line and the next paragraph. `sync-repo` fills it the same way when it compares the
  block.
- **`{{CLI_COMMAND}}`** — exactly the command step 3 proved.
- **`{{IMPORT_FLOOR}}`** — where `HARNESS.md` says `floor-import: @`, the line `@<ENGINEERING path>`; otherwise
  the line ``Read `<ENGINEERING path>` before you change anything: it is the floor, and it binds every change.``
  (these agents do not expand `@` imports). Where it also names a settings entry (OpenCode's `instructions`
  in `opencode.json`), add the path there too.
- **`{{LOCAL_NOTES_FILE}}`** — `HARNESS.md`'s **local-notes-file**. Run `git check-ignore -q <it> && echo
  ignored || echo NOT ignored` after the `.gitignore` write and print the answer. Never claim it is ignored
  when it is not.

## Step 7 — verify, and say what you did not do

- **Read back every path in the doc map and in `## Repo copies`, and confirm it exists.** A map pointing at a
  file that is not there is the one failure that breaks every subsequent round. The same for every file in
  the *Required reading* table and the craft path.
- **Grep every file you wrote for `{{`.** A surviving placeholder is a value the loop will read as real.
- **Each doc role appears once** in the doc map, and each path in it once.
- **Grep them for secret shapes**: `grep -rnE "Bearer [A-Za-z0-9]|lw_[A-Za-z0-9]{8,}"`, and for any value
  held in the CLI's credentials file (compare without printing it). A hit is a possible credential: **stop and
  show the human the line**, and let them decide. Never remove it automatically; the word "token" alone is
  legitimate text (a Secrets section, the per-story budget) and is not a hit.
- `<cli> process get <KEY> --json` once more: its outer `version` (the revision) is what you set, and the types are what you
  told the human.
- Confirm the instructions file loads the floor (the `@` line, or the read-first line, names an existing file).
- Where you wrote wiring, confirm the hook works: pipe a governed payload through it and expect exit 2,
  `echo '{"tool_input":{"command":"git commit -m x"}}' | node .sdlc/kit/hooks/adapters/guard.mjs <agent> --governed; echo $?`,
  and say plainly that the guard's scoping in this agent is as `HARNESS.md`, "Governed-agent marker", describes.
- If the evidence directory is gitignored, say that evidence has nowhere durable to live and let the human
  decide.
- Print what to do next: `shape-work` for a product owner to shape a story (when the type has `shape`),
  `plan-work` for work spanning more than one task, `run-task` for a single task, `run-story` to run every
  task of a planned story unattended, `sdlc-tune` to change the process later.

**Then state what this install did not settle.** Which docs are stubs, which CI claims are unverified, the
local-notes-file answer, the trust or restart steps `HARNESS.md` left to the human, whether single-writer is prose (it is, for a raw HTTP call; `PROCESS.md`, "The
cast") and anything the human declined. That list is the honest starting position, and it is more useful
than a success message.
