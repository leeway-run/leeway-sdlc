# LWY-201: a re-review checks the earlier findings and the changes

Story: LWY-201. Shaping answers: e1 (full only after reshaping or when asked), e2 (unchanged-text problems reported, marked "missed earlier"). Interview: e3 (a fingerprint per item in the read log).

## What changes

**The fingerprint (e3).** `sdlc-divergence-reviewer`'s read log gains a `Fingerprint` column: the first 12 hex characters of the SHA-256 of the item's description exactly as `leeway --json issue get <ref>` returns it (`issue.description`), computed with a `node -e` one-liner the agent text names; for a `# Technical criteria` comment row, of that comment's body. Leeway keeps no history of a description, so this is how a later round knows what changed, per item.

**A re-review.** plan-project's delegation for a second or later report on the same story passes the previous report's `cN` and the mode, `re-review` or `full`. The reviewer reads that report itself from Leeway: it is its own role's output, not the planner's account. It never reads the planner's replies to a report (`# QUESTIONs applied`, LWY-200's `# BLOCKERs fixed`), and is told so. In a re-review it:
- recomputes every fingerprint; an item whose fingerprint changed is reread in full and traced as today;
- lists every finding of the previous report under a new `## Earlier findings` section, closed or not closed, with why;
- on an unchanged item checks only the earlier findings; anything new it still sees there is reported marked `missed earlier`, keeping its tag (e2).

**Per story (e5).** Reports are one comment per story, so the previous report's `cN` is passed per story; an item absent from that report's read log counts as changed and is read in full.

**Full or re-review (e1, e4).** Full, as today, when the previous report has no `Fingerprint` column (written before this change), or when the thread shows a `step` entry into `shape` after the previous report's `createdAt` (the story went back through shaping), or when the person asks in the session. Otherwise a re-review, even when only TCs changed. The line "spawns a **fresh** reviewer — never the same one with a note about what changed" stays true: still a fresh agent, now given the previous report's `cN`.

## Breakdown
One task, LWY-201.1: the reviewer's text and plan-project's delegation, one behaviour.

## Hazard register
| Hazard | Owning task | The check that proves it closed | Rung |
|---|---|---|---|
| The reviewer gets the planner's account through the previous round (its replies) | LWY-201.1 | pin: the reviewer text says not to read `# QUESTIONs applied` or `# BLOCKERs fixed` replies | R1 |
| Fingerprints differ for the same text (whitespace, trailing newline, a different field) | LWY-201.1 | the one-liner named in the text, run on a known string in the test, matches a fixed expected value | R1 |
| A full review never happens after reshaping | LWY-201.1 | pin: the thread `step` into `shape` after the report makes it full | R1 |
| An earlier finding silently disappears | LWY-201.1 | pin: `## Earlier findings` lists every finding of the previous report | R1 |
