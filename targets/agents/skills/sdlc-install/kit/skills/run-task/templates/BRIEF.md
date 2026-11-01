> Orchestrator: paste into the implementer's prompt from the `#` heading below down to the `---` rule above
> `## Worked example`, and not one line more. The worked example is your reference, not part of the template: do not
> paste it, and do not copy it into a brief.

# Handoff brief — <ref> · round <N>

- **Task:** <ref> — <title>
- **Story:** <story ref> — <title>
- **Status:** DONE | BLOCKED
- **Branch:** <task branch>

## Iteration

What the orchestrator turns into `iteration record`. You do not commit or push, so you do not know the sha:
leave it `pending` and the orchestrator writes `git rev-parse HEAD` here after committing the round, before it
posts this brief.

- **Head sha:** pending (a BLOCKED round with nothing staged has no sha; the orchestrator writes
  `none (BLOCKED, nothing committed)`)
- **Lane line:** one line, at most 200 characters, of what you ran and the result, for example
  `typecheck, unit 412/412 green`. A lane that failed goes here too, starting `FAILED:`.
- **Passed:** yes | no | n/a (no lane owns this change)
- **Addresses:** `c1, c3` — the earlier findings (`cN`, from the reviewer's last verdict) this round fixed, or
  `none`. The first round of a task is always `none`. Name only the `cN` your prompt lists as live (`open` or `addressed`): a
  `disputed` or `settled` finding cannot be addressed again, and the verdict re-raises a disputed one as a new
  finding, whose `cN` is the one to name.

## What I built

What changed and where, in the order a reader should follow it. Name files. Not a diff summary — a
reader should understand the shape without opening the diff.

## Key decisions and tradeoffs

Each as: what I chose, what I chose against, and why. If a decision cuts against the intent doc in
your doc map, name the rule and say why here.

## Which project docs I followed

**Quote the heading you read, not a section number.** Section numbers differ between repos and go
stale inside one; heading text is stable and quoting it proves you opened the file. For example:
*"the invariants doc, under 'Every control-plane query is scoped by owner'"*.

If a doc in your map is marked `stub` or `absent`, it is a place to write a finding into, **not a
source to cite**. If a doc was silent where you needed it, say so — that is a gap worth closing.

## Rules read

Only when your prompt carries a *Required reading* table. Each file you opened under it, with the heading you
applied, or "none owed". The orchestrator compares this with the paths you staged.

## Tests

- **Lane:** which, and why that one.
- **Added:** file, and the behaviour it pins.
- **Registered to run:** yes / no / not applicable. If this repo names its tests in a runner array
  rather than discovering them, a test that no runner names never executes.
- **Modified:** what and why.
- **Disabled or removed:** what and the justification. Blank is the expected answer.

## Red tests

Only in round 0, and in the rounds after it. **Round 0:** one row per test, each skipped with a reason naming
its criterion (`red-test-AC-2`); un-skip it locally, run it, paste the failure, re-skip it, stage it. **Later
rounds:** each frozen test you un-skipped, and nothing else changed in it. Write "none" when the task runs no
red tests.

| Test | Criterion | Skip marker | Failure when un-skipped (verbatim) |
|---|---|---|---|

## Claims

Every non-obvious behavioural claim this diff asserts — in a code comment, a doc line, a test name,
or an error message — and how it was settled. A claim about a file is settled by reading it. **A
claim about runtime behaviour is settled only by running something, and then by reading what it
left behind.**

| Claim | Where it is asserted | Settled by | Command / file |
|---|---|---|---|
| e.g. the driver returns 64-bit ints as floats | `db.ts:214` comment | ran | `node -e "…"` → `9223372036854776000` |
| e.g. `\bload\b` does not fire before `_` | `test-guard.ts:31` | ran | `node -e "/\bload\b/.test('load_file(')"` → `false` |
| e.g. `loadOwned` exists and takes an owner id | `sources.ts:88` | read | `src/lib/ownership.ts:12` |
| e.g. a pinned timeout throws rather than warns | `db.ts:468` comment | **assumed** | nothing available to pin it — see Uncertainties |

An `assumed` row is not a failure; writing it as fact in a permanent comment is. **Every `assumed`
row must also appear under *Uncertainties*.**

## Assumptions

Things I took as true without being able to confirm them.

## Uncertainties and cut corners

**Be honest. The reviewer reads this first, and it is what makes the loop work.** Where you are
unsure, where you took a shortcut, where a second reading of the task would change the answer.

You have no user to ask, and you never ask one in the terminal. A doubt you can work around goes here. A
decision only the human can make goes under *Question* below, with `Status: BLOCKED`.

## Question

Only when `Status: BLOCKED`. The orchestrator raises this, unedited, as a Leeway escalation, so write it as the
human will read it:

- **Question:** one sentence, at most 500 characters. Longer context goes above, under *Uncertainties*.
- **Options:** 2 to 5, each a `label` (at most 60 characters) with its `argument` (why pick it, at most 1,000).
  1. `<label>` — <argument>
  2. `<label>` — <argument>
- **Meanwhile:** what you did before stopping, and what stays untouched until the answer. You stop implementing
  the blocked part; you do not guess.

## Friction

A tooling, test-data, local-setup or process gap that cost this round time, one line each: what it cost and what
would have saved it. You only propose it; the orchestrator files it on the friction collector, and only on a
human yes. Write "none" when there is none.

## Verification

Verbatim, not summarised. You stage; the orchestrator commits afterwards, so this is the staged state:

```
$ git status --short
<output>

$ git diff --cached --stat
<output>
```

## Evidence

The rung from the evidence ladder, and the proof it requires. Name the environment. Paste output
verbatim rather than describing it. For a control that refuses, include the negative case — a
refusal alone proves the request failed, not that your control is why.

## Response to review round <N-1>

Only on a FAIL round. Every BLOCKER and MAJOR, with how it was addressed. Disagreement goes under
Uncertainties, not here.

---

## Worked example (round 2 of an invented task)

This is what a filled brief looks like once the orchestrator has written the sha, and which fields feed which
`run-task` command. Round 1 of this invented task put `c1` (brief), `c2` and `c3` (findings) and `c4`
(verdict) on `LWY-12.3`; this is round 2, so the brief becomes `c5`.

````markdown
# Handoff brief — LWY-12.3 · round 2

- **Task:** LWY-12.3 — Skip unchanged files in the doc linter
- **Story:** LWY-12 — Faster doc lint
- **Status:** DONE
- **Branch:** feat/lwy-12.3-skip-unchanged-files-in-the-doc-linter

## Iteration

- **Head sha:** ce84f32a32c79f634395275e24549a2a035b7255
- **Lane line:** unit 31/31 green (docs-lint); typecheck n/a
- **Passed:** yes
- **Addresses:** c2, c3

## What I built

`scripts/lint-docs.mjs` now reads `.cache/doc-lint.json` and skips a file whose size and mtime match (c2).
`docs/TESTING.md` names the cache file (c3).

## Key decisions and tradeoffs

Key on size and mtime, not a content hash: a hash needs the read the cache exists to avoid.

## Which project docs I followed

The testing doc, under "Which lane does a change owe a test to".

## Tests

- **Lane:** unit (`scripts/lint-docs.test.mjs`).
- **Added:** `skips a file whose size and mtime match`.
- **Registered to run:** yes, discovered by the runner glob.
- **Disabled or removed:** none.

## Claims

| Claim | Where it is asserted | Settled by | Command / file |
|---|---|---|---|
| a touched file with the same size is not skipped | `scripts/lint-docs.mjs:44` comment | ran | `node scripts/lint-docs.mjs` after `touch` → `linted 1` |

## Assumptions

None.

## Uncertainties and cut corners

None.

## Friction

none

## Verification

```
$ git status --short
M  docs/TESTING.md
M  scripts/lint-docs.mjs
M  scripts/lint-docs.test.mjs

$ git diff --cached --stat
 docs/TESTING.md            |  2 +-
 scripts/lint-docs.mjs      | 21 ++++++++++++++++++---
 scripts/lint-docs.test.mjs | 14 ++++++++++++++
 3 files changed, 33 insertions(+), 4 deletions(-)
```

## Evidence

R1: the test run above.

## Response to review round 1

c2 (MAJOR): fixed, `scripts/lint-docs.mjs:40-52`. c3 (MINOR): fixed in `docs/TESTING.md`.
````

The orchestrator fills the round's commands from it (alias `kestrel-b1`, this session's):

| Field | Becomes |
|---|---|
| Head sha, Lane line, Passed, Addresses | `leeway --as kestrel-b1/implementer iteration record LWY-12.3 ce84f32a32c79f634395275e24549a2a035b7255 --tests "unit 31/31 green (docs-lint); typecheck n/a" --passed --addresses '["c2","c3"]'` (`Passed: no` or `n/a` omits `--passed`) |
| the whole brief, sha filled in | `leeway --as kestrel-b1/implementer comment add LWY-12.3 --stdin body <brief.md`; `--json` gives `comment.number` = 5, so `c5` |
| `Status: DONE` | `leeway --as kestrel-b1/agent issue update LWY-12.3 --status in_review` (and `LWY-12`) |
| `Status: BLOCKED` and `## Question` | the escalation described in the plugin's `PROCESS.md`, "Questions to the human are escalations" |
