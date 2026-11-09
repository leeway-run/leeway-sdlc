# LWY-214: leeway-sdlc runs on OpenCode V2

Story: LWY-214, "leeway-sdlc runs on OpenCode V2, verified end to end". The story's body is the source of the AC-n and TC-n; this doc says how they are built.

## Decisions

The interview raised no escalation: every open question for dev was settled from the code or by measurement (LWY-214, `# Interview closed`). The shaping answers that bind the design are LWY-214 e1 — the target supports OpenCode 2.x only; 1.x keeps whatever wiring it has — and e2 — OpenCode 2.x is called verified while the other five agents stay preview. The answer-wait is in scope on the direction given in the session on 2026-11-09 (AC-4), and its mechanism was measured the same day (LWY-214 c4): in OpenCode 2.2.6 a background shell command runs after the turn ends, the completion resumes the session, and the notice carries the output and the exit code.

## What changes

**The wiring becomes V2.** OpenCode 2 does not run V1 plugin implementations, so the generated `.opencode/plugins/leeway-sdlc.js` — a function returning `tool.execute.before` — never runs and the guards are silently absent. `scripts/targets.mjs`'s opencode row emits a V2 plugin (`Plugin.define({ id, setup })`, the guard on `ctx.tool.hook("execute.before", …)`, throwing the verdict message), scoped by what the spike measures: an identity field if the payload carries one, the governed marker otherwise — and either way the judging stays in `.sdlc/kit/hooks/adapters/guard.mjs`'s `decide`.

**The subagents and the install follow.** The agent files (`.opencode/agents/<name>.md`) move to the declaration 2.x reads (measured), and `sdlc-install`'s end-of-install check on OpenCode exercises the plugin as OpenCode loads it — today it pipes through the adapter only (step 7), which passes while the plugin never loads. `sync-repo` keeps the wiring current; a repo that already has the V1 file gets the normal diff-and-ask, never a silent overwrite.

**The wait.** The opencode row's `wait` moves from `null` (`wait: stop`) to the background text (`wait: background`, modeled on the Claude Code harness's section), because the mechanism is measured; the install and reload wording follows the measured behaviour of 2.x.

**The promise.** README and `agent-setup` name OpenCode 2.x verified; the other five stay preview; 2.x is the supported version (e1, e2).

## Where the truth lives

`docs/targets/opencode.md`, filled per `docs/targets/README.md` ("The run, per agent" and "Waiting for an answer, per agent") from a real session: the payload table, the answers (governed-agent rule a/b/c, deny, fail open or closed, delegation by name, install from git, trust step), one redacted main and one subagent payload into `plugin/hooks/adapters/fixtures/opencode.json` (`{ "rule", "main", "subagent" }`), and the wait probe for exit 0 and exit 2. The page ends `wait: background` only when the probe shows it; until then it keeps `wait: stop`, and the harness says so.

## Breakdown

- **LWY-214.1 — measure.** The probe, the page, the fixtures, the wait probe. (AC-4 bullet 3, AC-5 bullet 2; TC-3.)
- **LWY-214.2 — the V2 wiring.** The opencode row's plugin and agent files, the E2 test against the fixtures, regeneration. (AC-2, AC-3; TC-1, TC-2, TC-3.)
- **LWY-214.3 — the install.** sdlc-install's write and its check that can fail, sync-repo, the install/update/reload fields. (AC-1; TC-1.)
- **LWY-214.4 — the texts.** The wait and mechanism text in the row, README, agent-setup, regeneration. (AC-4, AC-5; TC-4.)
- **LWY-214.5 — end to end.** A live 2.x run: install, delegation by name, the guards refusing with the reason, a wait resuming. (AC-1–AC-4; AC-5's proof.)

## Hazard register

| Hazard | Owning task | The check that proves it closed | Rung |
|---|---|---|---|
| The V2 shape is right by the docs but the plugin still never loads: the guards silently absent again | LWY-214.5 | live: a governed `git commit` is refused with the reason, in a real 2.x session | R4 |
| sdlc-install's check keeps passing on a plugin OpenCode never loaded | LWY-214.3 | the check run with `.opencode/plugins/leeway-sdlc.js` absent does not pass | R1 |
| The payload carries an identity field and the orchestrator's own call is refused | LWY-214.2 | fixture: an orchestrator payload is allowed, one condition differing | R1 |
| The payload carries an identity field and a governed call slips through | LWY-214.2 | fixture: a governed payload is refused, one condition differing | R1 |
| The wait claims background resume but the exit code does not reach the session | LWY-214.1 | the probe records exit 2 as well as exit 0 (README, "Waiting for an answer") | R4 |
| A text promise outruns the measurement ("verified" before the page is filled) | LWY-214.4 | pin: README's verified line cites docs/targets/opencode.md, whose header names 2.2.6 before the line lands | R1 |
| `plugin/` and `targets/agents/` drift | LWY-214.2, .3, .4 | `node scripts/build-targets.mjs --check` | R1 |
| A kit script forks per agent (wait-answer copied or changed for OpenCode) | LWY-214.4 | pin: the OpenCode harness runs `.sdlc/kit/scripts/wait-answer.mjs`; no second wait script exists | R1 |

## Sequencing

Branches from the plan branch `feat/p_d18bfea4-leeway-sdlc-on-opencode-v2` (cut from `main` at `8e7895b`, v0.3.0). LWY-214.2 owns the opencode row's wiring and the generator tests; LWY-214.3 owns the install texts; LWY-214.4 owns the row's wait/delegate fields and README. .2 before .3; .4 after .1 and .2; .5 last, after .2, .3 and .4. .2 and .4 both edit the opencode row of `scripts/targets.mjs`: whichever lands second merges, nothing more.