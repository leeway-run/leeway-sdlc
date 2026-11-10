# OpenCode — spike results

- **Version tested:** 2.2.6 (`opencode --version`; binary `/home/nick/.opencode/bin/opencode`)
- **Date:** 2026-11-09
- **Tested by:** the LWY-214.1 implementer (an OpenCode session driving `opencode run` from the shell), on Linux, in a
  scratch git repo at `/tmp/opencode/lwy-214.1/scratch`. The probe sessions ran on `azure/deepseek-v4.1-flash`.
- **Tested by:** the LWY-214.5 implementer, running the whole loop end to end on the **generated** wiring — the kit and
  wiring `node scripts/build-targets.mjs` produces and `sdlc-install` lays out, not the probe's — in a scratch git repo
  at `/tmp/opencode/lwy-214.5/scratch`, on Linux, on `azure/deepseek-v4.1-flash`. Raw outputs are under
  `/tmp/opencode/lwy-214.5/` (`01-skills-add.out` … `13-debug-agents.out`, including `06b-orchestrator-commit-allowed.out`,
  `11-wait-notices.out` and `12-skills-replaced.out`). A fake `leeway` was first on `PATH`; no real Leeway server was
  reached and no remote was written.

## Hook payloads

The probe of README.md, "The run, per agent", run against a real session. OpenCode 2.x has no shell-command hooks: the
probe is a plugin, `.opencode/plugins/probe.js`, logging one JSON line per hook event to `.sdlc-probe/opencode.jsonl` (read
in full before anything was copied out — no environment value is in it). The snippet on README.md's OpenCode
section is a V1 plugin (`export const Probe = async (ctx) => ({ 'tool.execute.before': … })`); run as-is, 2.2.6 logs
`failed to load plugin … Plugin must export a default definition with an id and an effect or setup function` and
nothing fires. The run used the V2 API: `Plugin.define({ id, setup })` with
`ctx.tool.hook("execute.before", (event) => …)`.

The V2 hook receives **one event object**, not a separate `input`/`output` pair. A main-session shell call and a
`sdlc-implementer` subagent's shell call, as received (`at` names the `.jsonl` entry):

| | Main session | Subagent |
|---|---|---|
| Event name | `execute.before`, registered as `ctx.tool.hook("execute.before", …)` — `2026-11-09T21:39:06.498Z` (setup), `21:39:11.631Z` (call) | the same hook — `21:39:15.335Z` |
| Shell tool name | `shell` — `21:39:11.631Z` | `shell` — `21:39:15.335Z` |
| Where the command is (field path) | `event.input.command`; there is no separate args/output — `21:39:11.631Z` | `event.input.command` — `21:39:15.335Z` |
| `cwd` field | Not in the event; the plugin's own `ctx.location.directory` is the location — `21:39:06.498Z`. A call that sets a workdir carries it in the input: `{"command":"pwd","workdir":"/tmp"}` — `21:32:19.755Z` | Not in the event — `21:39:15.335Z` |
| Identity field (name: value), if any | `agent: "build"` — `21:39:11.631Z` | `agent: "sdlc-implementer"`; the call's `sessionID` is a **child session** (`ses_e3dbfbcb6ffe5vq0iT9ZqC0P1I`), not the parent's (`ses_lwy2141runA2`) — `21:39:15.335Z` |

An event's fields are `tool`, `sessionID`, `agent`, `messageID`, `id`, `input`; `input` is the tool's arguments, and the
hook sees every tool, not just `shell`. The main session's raw entry (`21:39:11.631Z`) and the subagent's
(`21:39:15.335Z`) are the two payloads in the fixture.

Not shown: tools other than `shell`, `subagent` and `skill`; whether `messageID`/`id` are stable across a retried
call; a session driven through `opencode serve` + the API rather than `opencode run`.

## Answers

- **Governed-agent rule: a. Why:** the payload names the calling agent, `event.agent` — `"build"` for the main session
  and `"sdlc-implementer"` for the subagent (`21:39:11.631Z`, `21:39:15.335Z`) — and `guard.mjs`'s identity fields
  already read `agent`. The fixture's subagent payload is refused and the main payload is allowed by `decide` itself.
  Rule b was not tried: 2.x agent files have no hooks field (hooks are plugins: docs, "Agents" options and "Plugins").
  The governed marker (rule c) is not needed for this agent.
- **Deny:** exit 2 with stderr is the shell-hook contract other agents use; 2.x hooks are in-process and its deny is a
  thrown Error. Measured: a probe plugin that threw on `git commit --allow-empty -m probe` (`21:33:31.326Z`) stopped
  the call — the commit did not run (`git log --oneline` still one commit) — and the reason reached the model: the
  tool call's state was `{"status":"error","error":{"type":"unknown","message":"Blocked by …"}}`, which the model
  quoted before ending its turn. The real
  guard core's message arrives the same way: the fixture test shows `decide` refusing the subagent payload with the
  `git commit` message.
- **Hooks fail open or closed** (timeout, crash):
  - a hook that **throws** blocks the call (the deny above) — closed;
  - a hook that **never resolves** holds the call with no timeout: `PROBE_HANG=1 touch hang-marker.txt`
    (`21:34:50.502Z`) never ran, the client was still waiting after 100 s and the marker file was absent — closed, and
    it stalls the session for as long as the hook runs;
  - a plugin whose **setup throws** fails to load: the server logs
    `WARN … failed to load plugin plugin.id=lwy2141.setupcrash cause=…`, and the session ran anyway (`touch
    loadcrash-marker.txt && git rev-parse --short HEAD` executed normally) — open. A reload that fails is the same:
    the V1 file above failed to load, and the previous loaded instance kept judging calls (the next call,
    `21:53:01.189Z`, still came from `probe4` v6).
- **SessionStart fires:** no — 2.x has no SessionStart hook to declare; session lifecycle is `ctx.event.subscribe()`.
  Its output is shown to the agent: not applicable. A plugin adds context at model-request time instead:
  `ctx.session.hook("context", …)` pushed a line and the model quoted
  `LWY2141-MARKER: probe context injection works.`
- **SubagentStart fires:** no — no such hook in 2.x. Can it add context: not applicable. The child is visible two ways:
  the parent's `subagent` tool call (`21:39:13.864Z`) and the child's own calls on the same hook (`21:39:15.335Z`).
- **Subagent declaration accepted:** `.opencode/agents/sdlc-implementer.md` with frontmatter `description` and
  `mode: subagent` is discovered (`opencode debug agents` lists `sdlc-implementer`, mode `subagent`). The legacy
  declaration the wiring emits today, `permission:\n  edit: deny`, still applies in 2.2.6 — `opencode debug agents`
  adds `{"action":"edit","resource":"*","effect":"deny"}`; V2's own field is `permissions:` (a list).
- **Delegation by name:** yes — the main agent called the `subagent` tool with
  `{"agent":"sdlc-implementer","description":"Run git log command","prompt":"…"}` (`21:39:13.864Z`); the child ran the
  command (`21:39:15.335Z`), in a child session, and its final message came back to the parent.
- **Install from git:** the command that worked:
  `npx -y skills add leeway-run/leeway-sdlc/targets/agents/skills -a opencode --yes` — 7 skills, copied into
  `./.agents/skills/<name>/` (project scope) plus `skills-lock.json`; `npx skills list -a opencode` then lists them.
  The plain form, `leeway-run/leeway-sdlc/targets/agents/skills`, is what `scripts/targets.mjs` now ships for
  OpenCode's `install` and `update`; the `tree/main` form it used to carry,
  `leeway-run/leeway-sdlc/tree/main/targets/agents/skills`, exits 0 printing "No skills found" and installs nothing.
  OpenCode discovers the skills: the `skill` tool loaded `sync-repo` from
  `.agents/skills/` (`21:43:27.038Z`) and `lwy-probe-skill` from `.opencode/skills/` (`21:43:16.746Z`), and the model
  quoted each body. The plugin and agents are not installed from git; `sdlc-install` writes them.
- **Trust step the user must take:** none — `.opencode/plugins/*.js` loads automatically (no `opencode.json` entry, no
  prompt on the first session), the skills install ran with `--yes`, and a run **without** `--auto` ran a shell
  command with no prompt (`21:48:48.477Z`).
- **Plugin load (reload on save or restart):** reload on save — editing `.opencode/plugins/probe.js` while the server
  ran put the new code in force for the next session, no restart (`pluginVersion` 1 → 2 across `21:31:21.014Z` →
  `21:32:16.042Z`, then 3 and 6 in later sessions), and the server log shows `loading plugin` for the same file at
  each save.
- **Local plugin and `@opencode/plugin`:** a direct `.opencode/plugins/<name>.js` loads, and it can
  `import { Plugin } from "@opencode/plugin"`; `Plugin.define` was a function (`typeof` logged `"function"` at setup,
  `21:39:06.498Z`) and its `setup` and hooks ran.

## Fixtures

`plugin/hooks/adapters/fixtures/opencode.json` holds `{ "rule": "a", "main": …, "subagent": … }`: the two payloads
above as the probe logged their `guardView` — the event's `tool`, `sessionID` and `agent`, the tool arguments under
`args` (the field `guard.mjs`'s `commandOf` reads for OpenCode), and `cwd`, the plugin's `ctx.location.directory`.
`guard.test.mjs` reads it: both commands are readable, the main payload (agent
`build`) is allowed and the subagent's (agent `sdlc-implementer`) is refused once both carry a `git commit`.

## Waiting for an answer

The probe in README.md, "Waiting for an answer, per agent", in a live session against a fake `leeway` (no Leeway server
was called; the fake logged every check):

- **How it ran:** the shell tool with `background: true`:
  `node <repo>/plugin/scripts/wait-answer.mjs --server https://probe.test PRB-1 e1 --first 5 --cap 5 --deadline 60 -- <fake leeway>`.
  The tool returned at once — "Command moved to the background (shell ID: sh_…)" — and told the model the completion
  would notify it ("DO NOT poll for completion … you will be resumed automatically"); the model ended its turn.
- **Exit 0:** started 21:45:53Z. The fake logged two checks, 21:45:58Z (unanswered) and 21:46:03Z (answered). The
  session resumed by itself with a synthetic message whose metadata was
  `{"source":"shell","state":"completed","truncated":false,"exit":0}` and whose text held the wait's stdout line, which
  the model read and replied with: `{"label":"Go ahead","note":"probe","by":{}}`.
- **Exit 2:** the same with a fake that never answers, `--first 2 --cap 2 --deadline 6`. Three checks
  (21:47:12Z–21:47:16Z); the notice carried `exit:2` and `wait-answer: no answer to PRB-1 e1 by …`, and the model read
  the exit code and the line.
- **Exit 5:** a fake whose escalation carried an unanswered clarification (`answer: null`). The wait exited 5 in ~2 s;
  the notice (`exit:5`) held `{"clarification":"q1","question":"Which way?","askedAt":1794260000000}`. The resumed
  session answered it (a stand-in for the CLI answer), started **the same wait command again** with nothing changed,
  and the second wait (the fake now answered) exited 0 with `{"label":"Go ahead",…}`, which the session read.
- **Not shown:** a wait of hours (every probe ran in seconds); a wait started by a subagent's session rather than the
  main session; what a server restart does to a running background command; whether appending to the command changes
  the reported code (the Claude Code page's `; echo $?` caveat was not tried here).

wait: background

## Live end-to-end run (LWY-214.5)

The whole loop, once, on the **generated** wiring rather than the probe's: a scratch repo at
`/tmp/opencode/lwy-214.5/scratch` (one commit, no remote), a fake `leeway` first on `PATH`, and `opencode run --auto
--model azure/deepseek-v4.1-flash`. One exception to that model: the step-7 guard check inside `sdlc-install` ran
`opencode run --auto` with **no** `--model`, so it used the default model `iceman-free` (`02-install-run.out`, whose
transcript reads `build · iceman-free`); every other session ran on `deepseek-v4.1-flash`. Raw outputs:
`/tmp/opencode/lwy-214.5/01-skills-add.out` … `13-debug-agents.out`.

- **Install.** The measured command is `npx -y skills add
  leeway-run/leeway-sdlc/targets/agents/skills -a opencode --yes`; it printed "Found 7 skills" and copied them to
  `./.agents/skills/` (`01-skills-add.out`). **The fetched copy is stale V1** — `origin/main` still carries the V1
  wiring, whose plugin is `export const LeewaySdlcGuard = async ({ directory }) => ({ 'tool.execute.before': … })`
  checking `input?.tool !== 'bash'` — so the fetched skills were **replaced** by the worktree's generated ones
  (`node scripts/build-targets.mjs`) before the install ran; the scratch's `.agents/skills/sdlc-install/kit` is
  byte-identical to the worktree's `targets/agents/skills/sdlc-install/kit` (`12-skills-replaced.out`). The install ran
  from that copy, so what this page certifies is the **generated** kit, not the V1 one `npx skills add` fetches today.
  `sdlc-install` then ran end to end in the repo (invoked by name in the scratch session) and wrote `.sdlc/kit/`
  (whole), `.opencode/plugins/leeway-sdlc.js`, `.opencode/agents/sdlc-*.md`, the seven contract docs, `ENGINEERING.md`,
  `.sdlc/CONFIG.md` and the `AGENTS.md` block. The written plugin is the V2 shape and the kit's `guard.mjs` is
  byte-identical to `plugin/hooks/adapters/guard.mjs` (`02-install-run.out`, `12-skills-replaced.out`). **Its step-7
  guard check passed live**, in a `cp -R` scratch copy with the governed marker live and no `--model` (so on
  `iceman-free`): a governed `git commit --allow-empty -m check` came back `Blocked: \`git commit\` is not available to
  this subagent …` and no commit was made. The server log shows `msg="loading plugin"
  id=…/scratch/.opencode/plugins/leeway-sdlc.js` with no `failed to load plugin` for it (`10-plugin-load.log`), and
  `opencode debug agents` lists all three `sdlc-*` subagents — `sdlc-implementer`, `sdlc-reviewer` and
  `sdlc-divergence-reviewer`, each `mode: subagent`, the read-only two carrying the legacy
  `{"action":"edit","resource":"*","effect":"deny"}` (`13-debug-agents.out`).
- **Delegate.** Asked to have `sdlc-implementer` run `git log -1`, the orchestrator called the `subagent` tool with
  `agent: "sdlc-implementer"` (the transcript's `✓ Run git log -1  Sdlc-Implementer Agent`); the fresh agent ran the
  command and its final message — the `git log -1` block — came back to the orchestrator (`03-delegate.out`).
- **Guards.** A governed `git commit --allow-empty -m probe`, delegated to `sdlc-implementer`, was **refused** with the
  guard's reason returned to the orchestrator verbatim
  (`{"error":{"type":"unknown","message":"Blocked: \`git commit\` is not available to this subagent …"}}`), and
  `git log --oneline -1` still showed the one commit (`04-guard-commit.out`). A governed `leeway` write,
  `printf 'probe body' | leeway --server https://fake.test comment add PRB-1 --stdin --as probe/agent`, was **refused**
  the same way (`Blocked: \`comment add\` writes, and the orchestrator is the only writer to Leeway.`), and the fake
  `leeway` logged **no** `comment add` call: nothing reached even the fake, so nothing reached a server
  (`05-guard-leeway-write.out`, `09-fake-calls.log`). **The orchestrator's own `git commit --allow-empty -m allowed`,
  run directly in the same scratch repo with no delegation and the marker off, was not refused** — it ran and made the
  commit (`[main 615f826] allowed`, `git log --oneline -1` → `615f826 allowed`); that is the *same attack* as the
  governed leg above, allowed when it does not come from the subagent (`06b-orchestrator-commit-allowed.out`). The
  scratch was then reset to its one commit (`ed08ad4 initial`). This settles the story's hazard "the guards are
  silently absent on 2.x": the plugin 2.x loads refuses a governed call, the reason reaches the agent, and the same
  call from the orchestrator still goes through.
- **Wait.** The README's fake-`leeway` wait probe, run by the main session as a background shell command. **Exit 0:**
  the model started the wait in the background, ended its turn, and the session **resumed on its own** with a
  "Background command finished. Output:" notice holding the wait's stdout `{"label":"Go ahead","note":"probe","by":{}}`
  (`07-wait-exit0.out`). **Exit 2:** with a fake that never answers (`--first 3 --cap 3 --deadline 9`), the resumed
  session was handed `wait-answer: no answer to PRB-1 e1 by …` and **exit code 2**, which the model read
  (`08-wait-exit2.out`). The exit code reached the session in the notice's own metadata, which is what refutes the
  story's hazard that "the wait's exit code never reaches the session": both synthetic `shell` notices in the session
  DB (`~/.local/share/opencode/opencode.db`, `session_message` table) carry it — `"metadata":
  {"source":"shell",…,"state":"completed","truncated":false,"exit":0}` for the exit-0 wait and `…"exit":2` for the
  exit-2 one, with the text repeating `Exited with code 2` (`11-wait-notices.out`). The fake logged each check with its
  time in both runs (`09-fake-calls.log`).

- **Not shown here:** an exit-5 wait (measured on this page from LWY-214.1, not re-run in LWY-214.5); a wait of hours;
  the governed-marker *tamper* refusal (rule c, not used for OpenCode — rule a identifies the caller, so no marker is
  written).

## Surprises

- The shell tool is `shell`, not `bash`; the V1 plugin the wiring generated until LWY-214.2 checks `input.tool !== 'bash'`,
  which can never match, and 2.x rejects that plugin at load anyway.
- The V1 plugin does not merely fail to fire: the file is *rejected* at load (`Plugin must export a default definition
  with an id and an effect or setup function`), and the previously loaded instance keeps serving.
- `ctx.skill.list()` (the plugin API) listed only two built-in skills (`opencode`, `report`) in every session, even
  with seven installed under `.agents/skills/`, while the `skill` tool loaded those skills fine. An install check
  cannot use `ctx.skill.list()` to prove the skills landed.
- `npx -y skills add …/tree/main/targets/agents/skills -a opencode --yes` exits 0 with "No skills found" and installs
  nothing; dropping `tree/main` installs into `./.agents/skills/`.
- The completion notice's exit code lives in the synthetic message's metadata (`exit`), and the text repeats it as
  `Exited with code N`.