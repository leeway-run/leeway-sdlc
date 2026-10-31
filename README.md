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

## Status

The manifests, `plugin/PROCESS.md`, the craft doc, the hooks, the agents, the templates and the skills (including
`/leeway-sdlc:sdlc-install`, used above) are in the plugin. The `0.1.0` tag is made by the release task.

## Versioning

The rule: a **minor** when the loop would judge the same task differently, or a repo must refresh a
file it copied from the plugin; a **patch** otherwise. `main` is always a released state. What changed,
what a repo must do to upgrade and how it was checked are in [RELEASE_NOTES.md](RELEASE_NOTES.md).

## License

MIT, see [LICENSE](LICENSE).
