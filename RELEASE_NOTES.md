# Release notes

## 0.2.0

leeway-sdlc now runs in agents other than Claude Code: OpenAI Codex CLI, GitHub Copilot (CLI and VS Code agent
mode), Google Gemini CLI, Cursor, OpenCode and xAI Grok Build. **It has been tested with Claude Code only.** Support
for the other agents is built in but not yet verified. Verified support will come later, and issues are welcome at
https://github.com/leeway-run/leeway-sdlc/issues (see *Known limits*). Claude Code behaves as before.

- **One source, a generated package.** `plugin/` is still the only source and the Claude Code plugin.
  `node scripts/build-targets.mjs` generates `targets/agents/` from it. That package holds the same skills, plus a
  kit that `sdlc-install` copies into the repo as `.sdlc/kit/`. The kit contains `PROCESS.md`, the craft doc, the
  agents, the guards, one `HARNESS.md` per agent, and each agent's wiring: its subagent files and a hook that runs
  the guards. CI fails when the committed package differs from a fresh build.
- **`HARNESS.md`.** Every mechanism that depends on the agent now lives in this file:
  - how to delegate to a named agent;
  - how the guards recognise a subagent's call;
  - the instructions file and the local-notes file;
  - where an unattended run's allow-list goes;
  - how to update and restart.

  The skills read it instead of naming Claude Code. Claude Code's is `plugin/HARNESS.md`.
- **The guards for other agents.** `git-guard` and `leeway-guard` now export `judge(command)`.
  `hooks/adapters/guard.mjs` reads each agent's hook payload and asks the same two cores, so no judging is
  duplicated. In agents whose hooks do not say which agent made a call, the orchestrator marks the subagent's run
  with `hooks/adapters/governed.mjs on|off`. Every shell call in that window is judged as the subagent's. The
  marker expires after two hours.
- **Required reading travels in the brief.** run-task pastes the *Required reading* rows into every implementer
  and reviewer prompt. The Claude Code SubagentStart hook still injects them as well.
- **The contract block** template is now `AGENT-BLOCK.md.tmpl`, renamed from `CLAUDE-BLOCK.md.tmpl`. It goes into
  the agent's instructions file: `CLAUDE.md`, `AGENTS.md` or `GEMINI.md`. For Claude Code, the filled-in block is
  the same as in 0.1.x.
- **Onboarding page.** `agent-setup/prompt.md` is generated with the package. It is the page the "Fetch and execute
  the instructions to set me up for Leeway" snippet points an agent at.

### Upgrading a repo

A minor release: a repo refreshes copies it took from the plugin. One person runs the sync-repo skill.

- **The contract block** compares against the renamed template. The filled-in text is unchanged for Claude Code,
  so expect "the same". A `Kept` row recorded against `CLAUDE-BLOCK.md.tmpl` no longer matches a hash and is asked
  about once more.
- **A new `.gitignore` line**, `.sdlc/.governed/`, is offered.
- **A repo that is also worked in another agent** runs that agent's `sdlc-install` once. The run adds `.sdlc/kit/`
  and that agent's wiring, and the Claude Code setup is left as it was.

### How it was checked

- E2 hooks: `node --test plugin/hooks/*.test.mjs plugin/hooks/adapters/*.test.mjs plugin/test/*.test.mjs`
  passes. The Claude Code cases are unchanged. The new adapter cases cover one payload shape per agent, identity,
  `--governed`, the marker, its expiry and the marker directory being off limits.
- E2 package: `node --test scripts/build-targets.test.mjs` builds the package and lays it into a temporary repo
  the way `sdlc-install` does. It then runs each agent's guard hook exactly as wired: the orchestrator is allowed,
  a commit or a Leeway write is blocked under the marker, a read is allowed. It also checks Copilot's agent-level
  hook, and loads and calls the OpenCode plugin.
- Not checked: any of the six agents themselves. None was installed where this was built.

### Known limits

- **Unmeasured.** Payload shapes, delegation by name and the install commands come from each agent's docs (2026-11).
  `docs/targets/README.md` is the spike that measures them. The items it names are:
  - whether Codex selects a custom agent by name;
  - the shape of Copilot's agent-level `hooks:`;
  - the `npx skills add …/tree/main/targets/agents/skills` subpath form;
  - Gemini under Antigravity CLI;
  - the name of Grok's delegation tool.
- **The marker is weaker than Claude Code's attribution.** While it is live, the orchestrator is judged too, and
  a determined subagent can run `governed.mjs off`. Where a spike shows a payload that names the agent, that agent
  moves to identity-based scoping.
- **Trust steps.** Codex and Grok run a project hook only after the user trusts it. Grok's hooks fail open.
- **Not supported:** the Copilot cloud coding agent, and the community `grok-dev` CLI.

## 0.1.2

The `leeway` CLI is published to npm as `@leeway-run/cli` and signs in to `https://app.leeway.run` by default. The
README's install is now `npm i -g @leeway-run/cli` and `leeway login`, in place of building the CLI from the Leeway
repository. `sdlc-install` offers the npm install when `leeway` is not on the `PATH`, and tells the human to run
`<cli> login`, with `--server <url>` only for another server. `PROCESS.md` notes that `server:` in `.sdlc/leeway.md`
is still passed on every call.

### Upgrading a repo

Nothing a repo copied from the plugin changed. The version notice will point at `/leeway-sdlc:sync-repo`, which only
moves the `Synced to` row to 0.1.2. A repo whose `cli:` is a path to a local build keeps working; to switch, install
the package and set `cli: leeway`.

### How it was checked

- E2 hooks: `node --test plugin/hooks/*.test.mjs` passes (no hook changed).

## 0.1.1

The repositories moved to the `leeway-run` GitHub organization, and the `leeway` CLI's npm name is `@leeway-run/cli`. `leeway-guard` now recognises `npx @leeway-run/cli` and `npx @leeway-run/cli@<version>` as the CLI, so a governed agent's write through the package is denied as it is through `leeway`; `@leeway/cli` still counts. The marketplace is added as `leeway-run/leeway-sdlc`, and the manifests' URLs point at the organization.

### Upgrading a repo

Nothing a repo copied from the plugin changed. The version notice will point at `/leeway-sdlc:sync-repo`, which only moves the `Synced to` row to 0.1.1. A marketplace added as `shinyventures/leeway-sdlc` keeps working through GitHub's redirect; re-add it as `leeway-run/leeway-sdlc` to drop the redirect.

### How it was checked

- E2 hooks: `node --test plugin/hooks/*.test.mjs` passes, with new cases for `npx @leeway-run/cli` (a write denied, a read and an install allowed).

## 0.1.0

The first release of `leeway-sdlc`: an agent SDLC for repos whose work lives in Leeway. It has one binding, Leeway, and reads the process (types, steps, the gates) from Leeway at runtime instead of copying it into the repo. It ships eight skills (`sdlc-install`, `sdlc-tune`, `shape-work`, `plan-work`, `run-task`, `run-story`, `sync-repo` and `update`), three agents, four hooks (including `leeway-guard`, which denies writes to Leeway by a governed agent, and the version notice) and the templates `sdlc-install` renders into a repo. The `leeway` CLI it drives comes from the Leeway repo build for now.

### Upgrading a repo

None: this is the first release. A repo adopts the plugin by running `/leeway-sdlc:sdlc-install`, which writes `.sdlc/` and the repo docs it renders.

### How it was checked

- F1 `sdlc-install` dry run, 2026-10-26, rendered by a stand-in script, not a skill-driven session (so the interview and escalations were not exercised), against a local Leeway (`wrangler dev --local`, migrations 0001-0014) with a scratch repo (`node --test`, one GitHub workflow, no commits): created product `DRY`, set `--preset maintained`, then adjusted through `--stdin process` (bug without `plan`, a `spike` type by analogy, debt not unattended), version 2 read back; wrote `.sdlc/` and the seven docs; no `{{`, each doc role once, and no `Bearer <value>` or `lw_<8+ chars>` in what was written; every doc-map path exists; the configured `cli:` path is honoured; `version-notice.mjs` is quiet at `Synced to 0.1.0`; a second bind found version 2 and offered "keep what is there" before any `process update`.
- F2 `sdlc-tune` dry run, 2026-10-26, steps rendered by scripts, not a skill-driven session, against a local Leeway (`wrangler dev --local`) on product `TUNE`: "bugs skip the plan gate" on `maintained` changed only `bug` (feature, hotfix, experiment, chore, debt byte-identical, revision 1 to 2); "features skip plan" with one open feature on `plan` was refused `process_in_use`, the listed ref matched, after `issue update --step gate` the retry took (revision 3); a 13th type, a 13th step and an oversize body were refused before any write.
- F3 `shape-work` and `plan-work` dry run, 2026-10-26, steps executed by hand from the skill text, not by a skill-driven session (so no subagent was spawned: the coverage report was written by hand), against the same local Leeway and product `DRY` (process version 2) with a scratch repo: a `feature` story shaped (`--step shape`, a gap escalation and a write escalation answered) and planned (`--step plan`, design doc, 12 TC-n whose body would be 7,917 characters: the write was refused as `invalid_description`, the `# Technical criteria` comment holds all 12 and the description read back is 1,551), the project adopted, the Plan record DRY-4 with its row appended to `.sdlc/leeway.md`, an `experiment` story created with `--type`, three sub-issues with `--parent`, a `dependency add` read back in `blockedBy`, branches (`feat/dry-2-…`, `exp/dry-5-…`) written and read back, a floor escalation per story, the gate report `--as <alias>/reviewer` and an escalation with PASS / PASS WITH DECISIONS / RETURN answered PASS then `--status ready` (no step); a `bug` story (no `plan` step) created nothing. Round 2 re-checks: the shape-work start rule read DRY-2 (ready, no step, tasks, TC comment) as planned and left it unchanged, and set `shape` on a fresh story; the count and slug one-liners run on real inputs. Not exercised: the product-check gap path and RETURN.
- F4 `run-task` and `run-story` dry run, 2026-10-26, steps executed by hand from the skill text (the commits, the worktrees and the merge were walked on paper, the shas are stand-ins), against the same local Leeway and product `DRY`: DRY-2.1 through round 0 (red-tests, one attempt), two code rounds (a FAIL with two anchored findings raised, then a PASS settling both) to done, the thread's `step` and `status` entries in the order the skill sets them, none inferred from an iteration or a verdict; a repeated sha refused (`sha_repeated`) and escalated; `--step null` and `--owner null` refused (`invalid_step`, `invalid_owner`: the CLI sends the text); a planted `comment add` and `escalation raise` by a governed agent denied by `leeway-guard` (exit 2), a read allowed (exit 0). Not exercised: a subagent-driven round, the worktrees, `run-story` itself.
- E1 hooks and agents: `claude plugin validate` passes and a grep for the company plugin's text finds none of it.
- E2 hooks: 149 hook tests pass, including the denial of a governed agent's write to Leeway and the bound on the eval chain.
- E3: a test that no unfilled template markers remain in what `sdlc-install` renders.
- F5 walk, 2026-10-26: the version notice fires at 0.0.9, the per-copy questions are asked, and `leeway.md` is byte-identical afterwards.
- Story gates: 155/155 tests pass, both manifests validate, and the planted write is denied.
- Release check (run after this commit, linked on LWY-100.1): a throwaway tag `v9.9.9-test` on the release branch fails the version check before any release is created.
- Release check (transcript on LWY-100.1): a clean user profile adds the marketplace, installs the plugin and lists `/leeway-sdlc:sdlc-install`, `run-task` and `sdlc-tune`.

### Known limits

- The guard is not a sandbox: it lists its gaps and denies only what it recognises.
- The dry runs were hand-walked from the skill text, not skill-driven sessions, so the interview paths and subagent rounds were not exercised end to end.
- The generic CLI cannot send a JSON null, so a step is cleared by a status, not by `--step null`.
