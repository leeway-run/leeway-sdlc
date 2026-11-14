# leeway-sdlc

An agent SDLC for Claude Code, built on [Leeway](https://leeway.run): five roles, a plan gate, an
adversarial implement-review loop, a verification gate, and a risk-based evidence ladder. The process
itself (issue types, their steps, the round cap, the review depth) is not fixed in this plugin: it is
read from Leeway at runtime with `leeway process get`. The plugin reaches Leeway through the `leeway`
CLI; it ships no `.mcp.json` and no token is written to any repo file. `plugin/PROCESS.md` is the
contract the skills execute.

## Install on a fresh machine

Requires Claude Code, `node` on `PATH` (the hooks are Node) and the `leeway` CLI.

```sh
npm i -g @leeway-run/cli    # the `leeway` CLI
leeway login                # signs in to https://app.leeway.run
claude plugin marketplace add leeway-run/leeway-sdlc
claude plugin install leeway-sdlc@leeway --scope project
```

Then, in the repo, run `/leeway-sdlc:sdlc-install` and answer its questions. It records the server and the CLI
command in `.sdlc/leeway.md` (`server:` and `cli:`). For a server other than `app.leeway.run`, log in with
`leeway login --server <url>`.

The plugin ships commands in a top-level `bin/`, so it installs in Claude Code only, version 2.1.91 or later (the changelog
entry that added `bin/`; it has been tried on 2.1.319 and on nothing older): claude.ai and Cowork don't install a plugin that has one.

## Other agents

Codex, GitHub Copilot (CLI and VS Code), Gemini CLI, Cursor, OpenCode and Grok Build install
`targets/agents/`, a package generated from `plugin/` by `node scripts/build-targets.mjs`. It contains the same
skills, plus a kit. `sdlc-install` copies the kit into the repo as `.sdlc/kit/`, together with that agent's
subagents and a hook that runs the git and Leeway guards. For OpenCode that is **2.x**, the version it is verified
against; 1.x is not offered and keeps whatever wiring it has. The per-agent install commands are in
[agent-setup/prompt.md](agent-setup/prompt.md), which is also the page the onboarding snippet points an agent at:

```
Fetch and execute the instructions to set me up for Leeway from
https://leeway.run/agent-setup/prompt.md
```

What differs per agent (how it delegates, how the guards tell a subagent's call from the orchestrator's, where
its instructions live, how it updates) is in that agent's `HARNESS.md`. Claude Code's is
[plugin/HARNESS.md](plugin/HARNESS.md). The rest are generated from [scripts/targets.mjs](scripts/targets.mjs).
> **OpenCode 2.x is verified; the other agents are a preview.** OpenCode was tested from a real OpenCode 2.2.6
> session, recorded in [docs/targets/opencode.md](docs/targets/opencode.md). Support for Codex, GitHub Copilot, Gemini
> CLI, Cursor and Grok Build is built in but has not been verified yet. Verified support for them will come later.
> Until then, some details come from each agent's docs and have not been measured. If you run into an issue, let us know:
> [GitHub issues](https://github.com/leeway-run/leeway-sdlc/issues).
>
> [docs/targets/](docs/targets/README.md) is the check we will run for each agent before calling it verified.

## Developing

The lanes are CI's (`.github/workflows/release.yml`), run from the repo root:

```sh
node --test --test-reporter=tap "plugin/hooks/*.test.mjs" "plugin/hooks/adapters/*.test.mjs" "plugin/test/*.test.mjs" "scripts/*.test.mjs"
node scripts/build-targets.mjs --check
node .github/scripts/check-manifests.mjs
```

The tap reporter is what makes piped output greppable: off a terminal, `node --test` does not print `ok` / `not ok`
lines by default, so `| grep '^not ok'` finds nothing without it.

## Status

The manifests, `plugin/PROCESS.md`, the craft doc, the hooks, the agents, the templates and the skills (including
`/leeway-sdlc:sdlc-install`, used above) are in the plugin. Support for other agents is a preview from 0.2.0
(see *Other agents*).

## Versioning

The rule: a **minor** when the loop would judge the same sub-issue differently, or a repo must refresh a
file it copied from the plugin; a **patch** otherwise. `main` is always a released state. What changed,
what a repo must do to upgrade and how it was checked are in [RELEASE_NOTES.md](RELEASE_NOTES.md).

## License

MIT, see [LICENSE](LICENSE).
