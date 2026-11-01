# Harness: any agent other than Claude Code

> **Tested with Claude Code only.** Support for other agents is built in but has not been verified yet. Verified support will come later. If you run into an issue, let us know: https://github.com/leeway-run/leeway-sdlc/issues

version: 0.2.0
agent: any
plugin-files: .sdlc/kit/

This is the package's own harness file. The repo's is `.sdlc/kit/HARNESS.md`, which `sdlc-install` writes from
`kit/harness/<agent>.md` for the agent you use. Until then, run `sdlc-install`.
