# Release notes

## 0.3.0

The skills now use Leeway's words, and shaping and planning end at a step a person moves the story on from, instead
of an approval question. A run now waits for the answer to its escalation and carries on, a plan ends at merged into
`main`, and a run's spend and its per-story budget live in Leeway. **0.3.0 needs a Leeway server with the process
model that allows two `gate` steps in a type, project links and spend records. dev.leeway.run, the Leeway team's own
deployment, has them, and it is the only server checked. As of 2026-11-07, `app.leeway.run`, where the install docs'
`leeway login` signs in on a fresh machine, has no DNS record from the machine that checked, and the app's
`docs/ARCHITECTURE.md` says it is not deployed, so that login cannot succeed while this holds. Use `leeway login
--server <url>`, for a server you run or were given** (see *Known limits*).

- **New names (LWY-114).** `shape-work` is now `shape-project`, and `plan-work` is now `plan-project`. `run-task`
  and `run-story` are one skill, `run`, which takes any ref. On a sub-issue it runs one task; on an issue it runs
  every sub-issue unattended, as `run-story` did; on a project it runs the issues one after another. Invoke it as
  `HARNESS.md`'s **commands** spells it (`/leeway-sdlc:run` in Claude Code), because a bare `run` can reach another
  skill of that name. Where a person reads them, the skills and templates say project, issue and sub-issue.
- **A project run (LWY-114).** `run` on a project runs each issue as an issue run, in the order the blocking
  relations allow, and stops at the first issue that stops. It skips an issue that its issue run refuses (not
  unattended, not planned, an unanswered `# Run status`, and the like) and goes on. When nothing runnable is
  left, it reports what it ran, what it skipped and why, and the blockers. It has no budget of its own: each issue
  keeps the per-story budget.
- **Shaping ends at the shaped step (LWY-126).** Once every question is answered, `shape-project` writes the body,
  posts one comment listing what it inferred, moves the story to the shaped step and stops. It no longer asks
  *Write this body?*. Two kinds of story still get that question: one already planned, and one whose type has no
  shaped step.
- **Planning ends at the plan gate (LWY-126).** Moving a story from shaped to planning is the approval of its body.
  `plan-project` starts only there; on a story still at shaped, it says the story waits and stops. Planning ends at
  the plan gate ("planned"), with the coverage report. There is no PASS / PASS WITH DECISIONS / RETURN escalation
  any more. You pass the gate by moving the story to `ready`, and return it by moving it back to planning.
- **QUESTIONs (LWY-126).** Each QUESTION in a coverage report is now a comment of its own, with its own escalation.
  The order is: answer the QUESTIONs, run `plan-project` to apply the answers (it replies `# QUESTIONs applied` to
  the report), then move the story. `run` refuses a story with no coverage report, one still at the plan gate, and
  one with a QUESTION that is open, or answered but not yet applied.
- **Moves on request (LWY-126).** Any skill makes any move the person asks for in the session, as
  `<alias>/agent`. It then says which move it made and what it leaves unmet. No skill moves a story out of the
  shaped step or the plan gate on its own.
- **Install, tune and sync use the new flow (LWY-126).** `sdlc-install` describes the `maintained` preset as the
  new flow. It does not treat the `maintained` process Leeway stores for a new product as one a person chose.
  `sdlc-tune` offers the new flow to a type still on the old one (a `shape` step and no shaped step): a `shaped`
  gate step after `shape`, and the labels shaping, planning, planned and building. `sync-repo` offers the same
  change once per release.
- **Filing work is planning (LWY-113).** `sdlc-install` asks whether filing work in Leeway pushes for
  `plan-project` (the default) or leaves it a manual opt-in. The answer goes into `.sdlc/leeway.md` as
  `filing-work:`. With `plan-project`, the managed block says to invoke `plan-project` before filing an issue with
  sub-issues, more than one issue, or anything touching the schema, auth, a product rule or an ownership boundary,
  even while pairing. `plan-project`'s description now opens with those triggers.
- **Friction is a project (LWY-115).** Friction the human accepts is filed as one `chore` issue per item in the
  product's friction project, not as comments on one issue. `.sdlc/leeway.md` names the project as
  `friction-project:`. `sdlc-install` proposes an existing developer-experience project, or creates
  "Developer experience".
- **The install asks instead of reporting (LWY-116).** A divergence the install can see is now a question during
  the install: branch prefixes, blocking rungs in an existing evidence doc, sections and a floor import that the
  managed block repeats, and a missing allow-list for unattended runs. There are at most sixteen questions, and
  questions 13 to 16 are asked only when detection finds their divergence. The install looks for an existing
  import of the floor on every run, a re-run included, so the floor is never imported twice. The closing report
  keeps only facts, in plain words.
- **A summary on every issue (LWY-119).** Every `issue create` the plugin runs passes `--summary`. A skill that
  adopts an issue with an empty summary fills one in. `PROCESS.md`, under "Records", says so.
- **A run waits for the answer (LWY-131).** An escalation no longer ends a run. `run` raises it, says once what it
  waits on and until when, and waits on `scripts/wait-answer.mjs`, which only reads Leeway: a first check after about
  a minute, then less and less often, never more than 15 minutes apart, for up to 16 hours per escalation. On an
  answer it carries on as a re-invoke would, writing nothing twice, and only the answer counts: a comment or a status
  change does not. With no answer by the deadline it stops the turn, the escalation stays, and re-invoking `run`
  resumes. It also stops the turn when Leeway stops answering or the CLI asks for `leeway login`. A wait on something
  that blocks nothing, such as a sub-issue run's debt proposal, carries on instead. Every other skill still stops the
  turn at its escalation.
  - **Claude Code** waits in the background (`wait: background` in `HARNESS.md`): the harness wakes the session when
    the script exits, so no turn is spent per check. If the session ends first, the run has stopped as at the
    deadline.
  - **The six other agents** do not wait (`wait: stop`), because no probe has shown that they can run a long command
    without a turn per check and resume the session. `run` posts what it posts, says which escalation it stopped on
    and stops the turn; re-invoke it once the escalation is answered.
- **No description length (LWY-137).** The skills, `PROCESS.md` and the ticket templates state no length for a
  description. Agents no longer count a description's characters, and `plan-project` keeps *Technical criteria* in
  the body instead of moving them to a comment. A story planned before that keeps them in a `# Technical criteria`
  comment is still read, and a re-plan moves them back into the body.
- **A plan ends at merged into `main` (LWY-138).** `plan-project` cuts the plan branch, where `.sdlc/CONFIG.md` asks
  for one, and links it on the project (`project link`, read back under `project.links`), and `run` does the same for
  a plan branch that does not exist yet. After the last story the Plan record reads `in_review`, not `done`: the
  draft pull request to `main` is open (by `gh`, or by the person, through an escalation) and linked on the project,
  and the run ends by naming it. The plan merges only on the person's word, and `gh pr merge` stays off the
  allow-list so that its prompt is that word. The Plan record goes `done` only once `project get` reads every link's
  pull request as `merged`. With no plan branch, it goes `done` once every `done` story reads merged into `main`.
  `run` on the project picks up a plan's end left half done.
- **Spend is recorded in Leeway (LWY-139).** Each round records its minutes, test minutes and tokens on its
  iteration. The review, the orchestration and the run's own time are `spend record`s, and time waiting on a person
  is never in a record: Leeway counts it from the escalations, and it does not count toward the budget's wall-clock.
  `run` reads every sum from `totals` in `issue get`, no longer from the `Spend` line of a `# Run status` comment.
  Time is measured from stamps in milliseconds, never estimated. The implementer's brief now reports timed *Test
  minutes*. What cannot be counted is left out, never written as 0: Leeway marks the total incomplete, every readout
  says so, the total is a floor, and the run carries on.
- **The token unit changed (LWY-139).** `--tokens` is now new tokens: input + cache writes + output, summed over
  every model call, cache reads never. `scripts/session-tokens.mjs` counts them from the transcripts, for subagents
  and the orchestrator alike, on Claude Code; other agents record none (`tokens: none` in `HARNESS.md`), so their
  totals read incomplete. Counts recorded before this release, in a `Spend` line or on a record, are final context
  sizes. They stay as recorded, so old and new totals do not compare. The `Spend` line now says "tokens", not
  "subagent tokens".
- **The budget moved (LWY-139).** The per-story budget now lives in the process, as `params.budget` on `build` steps,
  and `run` no longer reads `.sdlc/CONFIG.md` for it. A run on a `build` step with no budget is limited only by the
  round caps. `sdlc-tune` changes it. `sdlc-install` writes the old default (2,000,000 tokens, 15 rounds, 4 h) on the
  preset path, and only when the preset applied; a refused preset, or a process the person keeps, gets no budget.
- **In Leeway (LWY-129, LWY-125, LWY-132, LWY-133, LWY-134).** The steps these skills rely on come from stories in
  the Leeway app. LWY-129 adds the product process, an issue's `type` and `step`, `process get`, and `--type` and
  `--step`. LWY-125 names every stage as a step in the default presets and allows two `gate` steps per type. A new
  product gets `maintained`, stored at version 1, and a product with no stored process reads `mvp` at version 0.
  LWY-132 is the server's half of LWY-137, LWY-133 of LWY-138 (`project link`) and LWY-134 of LWY-139
  (`spend record`, `spend get`, `iteration record` with tokens). All five are on the app's `main`.

### Upgrading a repo

A minor release. Update the plugin with the update skill, then one person runs the sync-repo skill. **Before
upgrading:**

- **Check the server the repo uses** (`server:` in `.sdlc/leeway.md`). Logged in, `leeway --server <url> --help`
  lists that server's commands: 0.3.0 needs `process get`, `project link` and `spend record`. `leeway --server <url>
  --json issue get <ref>` must answer `totals`, and `leeway --server <url> process get <KEY> --withPresets --json`
  must show two steps of `kind` `gate` in a type of `presets.maintained`. If any of these is missing, stay on 0.2.x
  until the server has it (see *Known limits*).
- **Finish or restart any story that is mid-shaping under 0.2.0.** Its rounds carry no `Description at this round:`
  quote, so a UI edit made after the 0.2.0 approval was answered is not guarded.
- **Decide every plan gate still open under 0.2.0.** Answer its PASS / PASS WITH DECISIONS / RETURN escalation and
  let `plan-work` act on the answer before you upgrade, the QUESTIONs a PASS WITH DECISIONS raises included. 0.3.0
  does not read that escalation, and the QUESTIONs inside a 0.2.0 report were never raised on their own. After the
  upgrade, answering it moves nothing, and a story you move to `ready` yourself starts with those QUESTIONs not
  checked.
- **Make sure every QUESTION on a story gated under 0.2.0 is answered and applied.** 0.3.0's `run` does not see
  QUESTIONs raised the 0.2.0 way. It counts only escalations on `# QUESTION … of c<report>` comments, and a report
  with no such comment needs no reply. So a story gated under 0.2.0 passes without its QUESTIONs being checked.

**Then:**

- **The old skill names are gone.** `/leeway-sdlc:shape-work`, `/leeway-sdlc:plan-work`, `/leeway-sdlc:run-task`
  and `/leeway-sdlc:run-story` no longer exist. Use `shape-project`, `plan-project` and `run`. Until sync-repo runs,
  a 0.2.0 managed block still says to invoke `plan-work`, `run-task` or `run-story`.
- **The contract block** has changed (`{{RUN_SKILL}}`, sub-issue wording, the filing-work paragraph), so sync-repo
  shows it as changed once. `STORY.md` and `TASK.md` have changed too. A `Kept` row on any of them no longer matches
  its hash, so sync-repo asks about it once more.
- **New binding lines.** When `.sdlc/leeway.md` has no `filing-work:` line, sync-repo asks for it once, before the
  copies, because the block depends on it. A binding with `friction-collector: <ref>` is offered a move to a
  friction project; until then, `run` keeps filing friction as comments on that issue. `friction-collector: n/a`
  becomes `friction-project: n/a` without a question. Each answer is one line in `.sdlc/leeway.md`, and nothing
  else in that file changes.
- **The product's process.** When a type is still on the old flow, sync-repo offers the new flow as one question.
  It is a write to Leeway, not to the repo, and a no is asked again at the next release. `sdlc-tune` offers it as
  well.
- **The per-story budget.** A `Per-story budget` row in `.sdlc/CONFIG.md` is no longer read, so until it moves, a run
  of that repo is limited only by the round caps, unless the process already has a budget. sync-repo offers the move
  once, showing the row, the budget it becomes and every `build` step's budget before and after. "Move it" writes the
  budget on every type's `build` step and removes the row only after the process reads back; a write the server
  refuses removes nothing. "Leave it" writes nothing, the row stays unread, and the next release asks again. A row
  that does not convert is shown and not offered. **A row with every dimension `none` becomes no budget at all: "Move
  it" on it removes a budget a person set in the process**, and only the before and after shows that. **The same
  number is reached sooner:** a moved `2,000,000 subagent tokens` becomes 2,000,000 new tokens, which also cover the
  orchestrator's spans (see *Known limits*).
- **A story part-built under 0.2.x.** Its rounds carry over, because they are iterations. Its tokens and wall-clock
  were only in the `Spend` line, which is no longer read, so they count from the first round under 0.3.0. Its total
  reads incomplete.
- **A plan still open under 0.2.x.** Its plan branch stays unlinked until its end. Once its stories are done, `run`
  on the project opens and links the draft pull request, or links the one already open, and sets the Plan record
  `in_review`. The record goes `done` only once the pull request has merged into `main`.
- **The unattended allow-list, by hand.** sync-repo does not touch it. `run` needs every command it names but
  `gh pr merge`. Beyond what 0.2.0's `run-task` and `run-story` named, that is `leeway project get`, `project link`
  and `spend record`, `gh pr create` and `gh pr view`, and `node <plugin-files>/scripts/wait-answer.mjs` and
  `session-tokens.mjs`.
  - **The `leeway` calls.** In `run`, `leeway` means `<cli> --server <server>`, and a call puts
    `--as <alias>/<role>`, `--json` or both before the verb (`leeway --as <alias>/agent --json spend record …`), so
    an entry must cover that form. `sdlc-install` writes Claude Code's entries as `Bash(<command>:*)`. Whether an
    entry like `Bash(leeway spend record:*)` matches a call with flags before the verb is not verified: no run has
    tried it. A command that still prompts in a real run is not covered.
  - **The two scripts.** Expand `<plugin-files>` to what `plugin-files:` in `HARNESS.md` gives. `wait-answer.mjs`
    applies only where `HARNESS.md` says `wait: background`, and `session-tokens.mjs` only where it says `tokens:
    transcripts`. Today that is Claude Code alone.
  - **`gh pr merge`.** Keep it off, and mind that a prefix entry such as `gh pr:*` covers it.
- **The kit**, where `HARNESS.md` says `plugin-files: .sdlc/kit/`. Taking it now also removes what is only in
  `.sdlc/kit/`, such as `skills/shape-work/` and `skills/run-task/`. The kit diff includes the changed
  `CONFIG.md.tmpl` and `EVIDENCE-STANDARD.md.tmpl`, the new `scripts/wait-answer.mjs` and
  `scripts/session-tokens.mjs`, and each `HARNESS.md`'s new "Waiting for an answer" and "Counting tokens". A 0.2.0
  kit `Kept` row is asked about again.
- **The subagent files in the agent's own directory**, for an agent other than Claude Code: `sdlc-implementer`,
  `sdlc-reviewer` and `sdlc-divergence-reviewer` under `.codex/agents/`, `.github/agents/`, `.cursor/agents/`,
  `.gemini/agents/`, `.grok/agents/` or `.opencode/agents/`. The release changed all three: the implementer and the
  reviewer name the friction project, the implementer times *Test minutes*, and the divergence reviewer names
  `plan-project`. sync-repo asks about each one on its own, and a `Kept` row on one is asked about again.
- **By hand, if you want the new words.** sync-repo never compares the installed `.sdlc/CONFIG.md` (outside
  `## Repo copies`, and apart from the budget row its move removes) or the contract docs. A 0.2.x `.sdlc/CONFIG.md`
  still names `run-task` and `run-story` and says "before a story merges", and `EVIDENCE-STANDARD.md` still says
  "task". Edit them to `run`, "an issue" and "sub-issue" if you want them to match.

### How it was checked

- The three CI lanes, on the release branch on this machine's Node v26.13.0, not on CI's Node 22: `node --test
  "plugin/hooks/*.test.mjs" "plugin/hooks/adapters/*.test.mjs" "plugin/test/*.test.mjs" "scripts/*.test.mjs"` passes
  402 of 402; `node scripts/build-targets.mjs --check` prints "generated files are up to date"; `node
  .github/scripts/check-manifests.mjs` prints "manifests ok: leeway-sdlc and leeway-sdlc-agents 0.3.0".
- Each story is pinned by tests over the skill text in `plugin/test/`: `filing-work`, `plan-project-description`
  (LWY-113); `friction-project` (LWY-115); `install-questions` (LWY-116); `issue-summary` (LWY-119); `skill-names`,
  `skill-descriptions`, `run-skill-fill`, `run-refusals`, `run-project-skips` (LWY-114); `shape-ends-at-shaped`,
  `plan-ends-at-planned`, `moves-when-asked`, `new-flow` (LWY-126); `wait-answer`, `run-waits` (LWY-131);
  `description-length` (LWY-137); `plan-ends-at-main` (LWY-138); `run-spend`, `run-budget`, `session-tokens`
  (LWY-139). `scripts/build-targets.test.mjs` pins what every `HARNESS.md` says about waiting and counting tokens.
- Run live on dev.leeway.run, each piece on its own:
  - **The budget (LWY-139.2):** on a throwaway product, deleted afterwards, the CLI calls of sync-repo's "Move it":
    the budget on every `build` step with the rest byte-identical, a row that became no budget, a partial budget, and
    a refused write that left the version where it was. No row was removed from a real repo's `.sdlc/CONFIG.md`.
  - **The tokens (LWY-139.3):** three real rounds recorded with `session-tokens.mjs`'s counts for the subagents and
    the orchestrator's spans, in Claude Code on Linux. Those rounds were run by following `run` by hand with
    general-purpose agents, because the plugin was not installed in that repo, so its hooks and named agents did not
    run. The same holds for the budget check above and for LWY-123.2's rounds. How the earlier rounds of LWY-139.1
    and LWY-139.2 ran is not known.
  - **The description (LWY-137.1):** a 6,000-character description written and read back whole. Nothing far above
    that.
  - **The project link (LWY-138.1):** a plan branch linked with `project link` and read back through `project get`,
    with another repository's link untouched. Not run live: `gh pr create` from a pushed plan branch, `gh pr view` on
    a deleted story branch, and `project get` refreshing a linked pull request to merged.
- The wait was probed in a live Claude Code session against a fake `leeway` (`docs/targets/claude.md`), for seconds
  and with no server. Not shown: a wait of hours, a wait started by the main session, and what happens to the command
  when the session ends.
- Not checked: a live end-to-end run of `shape-project`, `plan-project`, `sdlc-install`, `sdlc-tune` or `sync-repo`;
  the `run` skill as an installed plugin; a real concurrent run under the overlap rule; `/clear`, `--resume` and a
  compaction's call; macOS. Not checked either: a live install in a fresh repo, a new agent session choosing
  `plan-project` on its own, and any agent other than Claude Code.

### Known limits

- **0.3.0 needs a server that has these, and only dev.leeway.run was checked.** The skills set and read steps, link
  branches and pull requests on a project, and record spend, so they need `process get`, two `gate` steps per type,
  `project link`, `spend record`, `totals` on `issue get` and `iteration record` with tokens. dev.leeway.run, the
  Leeway team's own deployment, serves them; the last of them reached the app's `main` in app PR #22, merged on
  2026-11-03. **As of 2026-11-07, `app.leeway.run`, the CLI's default server, has no DNS record from the machine that
  checked, and the app's `docs/ARCHITECTURE.md` on `main` says it is not deployed. While that holds, the `leeway
  login` in `README.md`, `agent-setup/prompt.md` and `sdlc-install` cannot succeed on a fresh machine, where it signs
  in there. Use `leeway login --server <url>`, for a server you run or were given.** `leeway --server
  https://app.leeway.run --help` says to log in there, not that the host is missing. No workflow in the app repo
  deploys the app (dev.leeway.run is deployed by hand with `wrangler deploy --env dev`), so a merge there says
  nothing about what another server runs. A server that allows one `gate` refuses the new-flow edit from sdlc-tune
  and sync-repo. Nothing was run against a server without the others.
- **The default budget is reached sooner.** Its 2,000,000 tokens now also cover the orchestrator's spans, in the new
  unit. The one real reading so far: story LWY-139 recorded 2,341,236 tokens over 8 rounds, marked incomplete and
  mixing both units. That is a data point, not a recommendation.
- **A token total can read low.** Orchestrator calls between spans (composing a brief, posting records after a
  verdict) are never counted, while the total can still read complete; that debt question is open on LWY-139.3. Spans
  of two concurrent tasks that overlap leave their tokens out, and the budget is checked at round boundaries, so one
  long round can overshoot it.
- **Comments keep a stated length.** LWY-137 covers descriptions. The plugin still states one for comments, and `run`
  still splits long briefs and verdicts on it; that debt question is open on LWY-137.1.
- **With no plan branch**, a story's merge into `main` at its gate is not tied to the person's word, because
  `gh pr merge` by the orchestrator is not a push and the pre-push guard does not stop it. That debt question is open
  on LWY-138.1.
- **Old skills outside Claude Code.** It is not verified whether re-running `npx skills add` or `gemini skills
  install` leaves `shape-work`, `plan-work`, `run-task` and `run-story` installed beside the new skills. If they
  are still listed, remove them by hand from where that agent installed them.
- **0.2.0's limits for other agents still hold**: what is unmeasured, the marker, and the trust steps.

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
