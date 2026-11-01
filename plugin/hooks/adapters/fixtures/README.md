Captured hook payloads, one file per agent: `<agent>.json` = `{ "rule": "a"|"b"|"c", "main": {...}, "subagent": {...} }`.
Each payload is the agent's real pre-command hook input from the Phase 0 spike (docs/targets/README.md),
redacted. guard.test.mjs checks every file here: the command must be readable from both, the main
session's call must not count as governed, and (for rule a agents) the subagent's must.
