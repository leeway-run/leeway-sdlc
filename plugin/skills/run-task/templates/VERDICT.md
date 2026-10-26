> Orchestrator: paste into the reviewer's prompt from the `#` heading below down to the `---` rule above
> `## Worked example`, and not one line more. The worked example is your reference, not part of the template: do not
> paste it, and do not copy it into a verdict.

# Review verdict: PASS | FAIL — <ref> · round <N>

- **Task:** <ref> — <title>
- **Iteration:** it.<N> · <the pushed head sha, 40 hex> (your prompt names it; anchors are lines of the files at this sha)
- **Review depth:** light | standard | adversarial, as your prompt names it.
- **Lanes run:** which, and why those. Name any you did not run and why not.
- **Red tests:** the freeze checked (`git diff <round-0 commit> -- <frozen paths>` shows removed skip markers
  and nothing else), or "no round 0 for this task" when your prompt says no red tests ran.
- **Verified:** yes, read directly | partially — say which findings were not confirmed by reading
- **Not examined:** paths not read, lanes not run, behaviour not reachable from here. **A review
  with no stated limits reads as exhaustive, and none of them are.**

## Test suite result

Verbatim summary lines, not paraphrase:

```
<output>
```

Known-red on this machine and unrelated to the diff: list them explicitly, or write "none". Your
prompt names the ones already known.

**Lane tally checked against the log:** a self-skipping test can exit 0. A lane that ran nothing has
not passed. Say that you looked, or say which lane you could not check.

## Red-test check

For each test the diff adds or changes: what you broke, and the verbatim failure you saw.

| Test | What I broke | Red output |
|---|---|---|
| `test-foo.ts` | reverted the guard at `foo.ts:31` | `FAIL  rejects load_file( — expected throw, got rows` |

**A test you could not make fail is a test that may cover nothing.** Say which, and why breaking it
was impractical. This check exists because a parity test once compared two empty lists under a
header claiming every statement matched, and passed for months.

Restore what you broke, byte for byte, and say that you did.

## Findings

Two tables, then one body block per finding. **Number every finding `F1`, `F2`, … across both tables.** The
orchestrator posts each body block as that finding's own comment, anchored where the table says, and then posts this
verdict naming them.

**Anchor** is `it.<N> · <path>:<start>-<end>`: new-side line numbers of the file as it is at the pushed sha (not
diff positions), at most 40 lines. A finding with no line to point at — a doc, process or missing-test finding —
has `—`, and is still posted. Its comment then has no anchor to show the location, so **the first line of its body
names the file and place it concerns** (`scripts/lint-docs.mjs, readCache`), or says it concerns no file.

### Test quality findings

| # | Severity | Issue | Anchor | Suggested fix | Source |
|---|---|---|---|---|---|
| F1 | BLOCKER/MAJOR/MINOR | | `it.N · file.ts:12-18` | | the testing doc, under "<heading>" |

Cover: is every new behaviour tested, at the right layer; does it assert something meaningful; were
tests skipped, disabled or deleted; **is a new test registered to actually run**; edge cases;
determinism.

### Code review findings

| # | Severity | Persona | Issue | Anchor | Suggested fix | Source |
|---|---|---|---|---|---|---|
| F2 | BLOCKER/MAJOR/MINOR | Security/Correctness/Performance/Maintainability | | `it.N · file.ts:40-52` | | the invariants doc, under "<heading>" |

Every persona is applied and every result stated, **including "nothing found"** — do not invent a
finding to fill a row. An earlier version of this template demanded one finding per persona and
produced four, of which three resolved to "do nothing". A cross-owner data leak is always BLOCKER.

**Cite the heading you read, quoted, not a section number.** If the rule is not written down
anywhere, say so *in the finding* — that is a gap worth closing now rather than at the end of the
story. If the doc you would cite is marked `stub` or `absent` in your doc map, the finding must say
**"no rule exists for this"** rather than cite a document that says nothing.

Findings are bounded by the diff and its blast radius. A pre-existing problem the diff does not
worsen goes under *Proposed follow-ups*. One the diff **widens** belongs here, and say which it is.

### Finding bodies

One block per finding, headed with its number. The block is the text of that finding's comment, and it must
stand alone for a reader who sees only that comment beside the lines it is anchored to: severity first, what is
wrong, why it matters, the fix, the source. Keep each under 20,000 characters (a comment's cap).

```
### F1 — <severity> · <short issue>
<the comment body>
```

## Contract docs this change falsified

Any sentence in the docs named in your doc map that this diff makes untrue, or "none". A count that
moved, a list that grew, a capability that now exists. Three docs elsewhere spent months claiming
CI did not run a lane that CI had been running the whole time. A finding here is also a numbered finding above.

## Proposed follow-ups

Anything not fixed by this task. These do not hold the task, and they are not findings: no comment is posted for
a row. Classify each — the orchestrator files on your class, and only `security` reaches Leeway without a
human saying yes.

| Class | Finding | Location | Consequence of leaving it |
|---|---|---|---|
| security/debt/nit | | `file.ts:12-18` | |

`nit` is the default. **If you cannot fill the consequence column, the row is a `nit`.**

## Evidence check

- Rung claimed, and whether it matches the change. Under-claiming is the usual way to skip proof.
- Environment named where the rung requires it.
- Output verbatim rather than summarised.
- The negative case present where a control is being proved.
- Anything the implementer said it did not test.

A missing proof is a finding, not a blocker, **unless** the rung is one your prompt names as
blocking.

## Needs live verification

What you could not check from here, why it matters, and what to look at.

## Summary

The verdict in two or three sentences. What is genuinely healthy, so this does not read as only a
list of complaints. Then what must change before this can pass.

## Round ledger

The orchestrator turns these lines into the review's flags. Your prompt lists the earlier findings still open,
as `cN`. Check each against the code at this sha.

- **Settles:** `c1, c3` — earlier findings you confirmed fixed at this sha, or `none`.
- **Disputes:** `c2` — earlier findings the brief says it addressed and you found not fixed, or `none`. One review
  cannot settle and dispute the same finding. A disputed finding is terminal, so each dispute **comes with a new
  finding** (its own `F<n>` above, in the findings tables) whose body cites the disputed `cN` and says what still
  has to change; the next round answers that one. Name in `Settles` and `Disputes` only the earlier findings your
  prompt lists (`open` or `addressed`): a `disputed` or `settled` one is refused (`fate_conflict`).
- **Raises:** this round's findings, `F1, F2, …`; the orchestrator replaces them with the `cN` they are posted as.
  Every finding above is raised; a follow-up row is not.
- **Escalates:** `none`, or a block when a dispute or a finding needs a human decision rather than another round.
  Write it as the human will read it, not as an instruction to the implementer:
  - **Concerns:** the `F<n>` it is about, or `the round as a whole`. The orchestrator ties the escalation to that
    finding's comment; a question about the whole round is tied to none.
  - **Question:** one sentence, at most 500 characters.
  - **Options:** 2 to 5, each a `label` (at most 60 characters) and its `argument` (at most 1,000).
  - **Meanwhile:** what stays blocked and what does not.

## Friction

A tooling, test-data, local-setup or process gap that cost this review time (the slow lane, the missing
fixture), one line each: what it cost and what would have saved it. Not a finding and not a follow-up row: you
only propose it, and the orchestrator files it on the friction collector only on a human yes. Write "none" when
there is none.

## Verification

The round is committed and pushed, so nothing should be staged and the tree should be clean. Verbatim:

```
$ git status --short
<output>

$ git rev-parse HEAD
<output>
```

---

## Worked example (round 2 of the invented task in `BRIEF.md`)

Round 1 put `c1` (brief), `c2` and `c3` (findings) and `c4` (verdict) on `LWY-12.3`. Round 2's brief is `c5`
(`it.2`, sha `ce84f32a32c79f634395275e24549a2a035b7255`), and it addressed `c2` and `c3`. The reviewer's reply, abridged to the parts the
commands are filled from:

````markdown
# Review verdict: FAIL — LWY-12.3 · round 2

- **Task:** LWY-12.3 — Skip unchanged files in the doc linter
- **Iteration:** it.2 · ce84f32a32c79f634395275e24549a2a035b7255
- **Review depth:** adversarial
- **Lanes run:** unit (docs-lint), typecheck. Not the integration lane: nothing under `src/server` changed.
- **Red tests:** no round 0 for this task
- **Verified:** yes, read directly
- **Not examined:** Windows path separators in the cache key.

## Test suite result

```
Test Files  1 passed (1)
     Tests  31 passed (31)
```

Known-red on this machine and unrelated to the diff: none.

## Findings

### Code review findings

| # | Severity | Persona | Issue | Anchor | Suggested fix | Source |
|---|---|---|---|---|---|---|
| F1 | MAJOR | Correctness | the cache is not invalidated when the linter's rules change | `it.2 · scripts/lint-docs.mjs:58-61` | add the rules version to the key | the invariants doc, under "Caches are keyed by what produced them" |
| F2 | MINOR | Maintainability | nothing says what a corrupt `doc-lint.json` does | — | state it in the brief's Claims and test it | no rule exists for this |
| F3 | MAJOR | Correctness | c3 is not fixed: `docs/TESTING.md` still omits the cache file | — | name `.cache/doc-lint.json` under the lint lane | the testing doc, under "Which lane does a change owe a test to" |

### Finding bodies

### F1 — MAJOR · the cache is not invalidated when the linter's rules change
A file that passed under the old rules is skipped under the new ones, so a rule change lints nothing. `58-61`
compares size and mtime only. Add the rules version to the cache key, and a test that bumps it. Source: the
invariants doc, under "Caches are keyed by what produced them".

### F2 — MINOR · nothing says what a corrupt `doc-lint.json` does
`scripts/lint-docs.mjs, readCache` (no anchor: a gap in the round, not a line). `readCache` is not exercised with
unparsable input, and the brief's Claims table is silent. No rule exists for this; worth adding to the testing doc.

### F3 — MAJOR · c3 is not fixed: `docs/TESTING.md` still omits the cache file
`docs/TESTING.md`, "Which lane does a change owe a test to" (no anchor). Re-raises c3, which this verdict disputes:
the brief says it is fixed, but the lane section does not name `.cache/doc-lint.json`. Name it there, and say that
deleting it forces a full lint. Source: the testing doc, under "Which lane does a change owe a test to".

## Round ledger

- **Settles:** c2
- **Disputes:** c3
- **Raises:** F1, F2, F3
- **Escalates:**
  - **Concerns:** F1
  - **Question:** Should the cache key include the linter's rules version?
  - **Options:**
    1. `Include the version` — a rule change invalidates every entry automatically; costs one full lint per upgrade.
    2. `Leave it out, document the manual clear` — keeps upgrades fast; a forgotten clear hides every new violation.
  - **Meanwhile:** LWY-12.3 stays `in_progress`; LWY-12.4 does not touch the linter and carries on.

## Friction

`npm test` took four minutes to reach the docs-lint lane; a `--only` filter would have saved three.

## Verification

```
$ git status --short

$ git rev-parse HEAD
ce84f32a32c79f634395275e24549a2a035b7255
```
````

The orchestrator posts, in order (alias `kestrel-b1`; `LWY-12.3`; `it.2`):

1. `leeway --as kestrel-b1/reviewer comment add LWY-12.3 --anchor '{"iteration":2,"path":"scripts/lint-docs.mjs","start":58,"end":61}' --stdin body` with the `F1` block on stdin; `--json` gives `comment.number` = 6, so `F1` is `c6`.
2. `leeway --as kestrel-b1/reviewer comment add LWY-12.3 --stdin body` with the `F2` block (no `--anchor`); `c7`.
3. `leeway --as kestrel-b1/reviewer comment add LWY-12.3 --stdin body` with the `F3` block (no `--anchor`): the finding that re-raises the disputed `c3`; `c8`.
4. `leeway --as kestrel-b1/reviewer comment add LWY-12.3 --kind review --iteration 2 --settles '["c2"]' --disputes '["c3"]' --raises '["c6","c7","c8"]' --stdin body`, with the verdict as the body: the finding-body blocks removed, `F1`/`F2`/`F3` in the tables rewritten as `c6`/`c7`/`c8`, and the ledger's `Raises:` line the same. `c9`.
5. `Escalates` is not `none` and concerns `F1`, so, as the role that raised it, tied to `F1`'s comment `c6` (never the verdict's `c9`): `leeway --as kestrel-b1/reviewer escalation raise LWY-12.3 --question "Should the cache key include the linter's rules version?" --options '[{"label":"Include the version","argument":"A rule change invalidates every entry automatically; costs one full lint per upgrade."},{"label":"Leave it out, document the manual clear","argument":"Keeps upgrades fast; a forgotten clear hides every new violation."}]' --meanwhile "LWY-12.3 stays in_progress; LWY-12.4 does not touch the linter and carries on." --comment c6`. Then the orchestrator stops and reports the escalation id and the issue. Round 3's brief addresses `c6`, `c7` and `c8`, not `c3`, which is `disputed` and cannot be addressed again.
