# <Agent> — spike results

- **Version tested:**
- **Date:**
- **Tested by:**

## Hook payloads
| | Main session | Subagent |
|---|---|---|
| Event name | | |
| Shell tool name | | |
| Where the command is (field path) | | |
| `cwd` field | | |
| Identity field (name: value), if any | | |

## Answers
- **Governed-agent rule:** a / b / c. Why:
- **Deny:** does exit 2 with stderr block the call? Does the agent see the reason?
- **Hooks fail open or closed** (timeout, crash):
- **SessionStart fires:** yes / no. **Its output is shown to the agent:** yes / no.
- **SubagentStart fires:** yes / no. **Can it add context:** yes / no.
- **Delegation by name:** does "delegate to sdlc-implementer" reach that agent?
- **Install from git:** the exact command that worked:
- **Trust step the user must take:**

## Fixtures
Paste redacted payloads into `plugin/hooks/adapters/fixtures/<agent>.json` as
`{ "rule": "a"|"b"|"c", "main": {...}, "subagent": {...} }`.

## Waiting for an answer
How the probe in README.md, "Waiting for an answer, per agent", went: the command, how the agent ran it in the
background, whether the session resumed on its own with the exit code, for exit 0 and exit 2.

wait: background / stop

## Surprises
