# How we change code

<!-- ai-sdlc · copied into your repo by the installer. Edit the repo's own floor instead. -->

These bias toward caution over speed. For a one-line fix, use judgment.

**Think before coding.** State assumptions rather than picking silently. If the request has two
readings, give both instead of choosing one quietly. If a simpler approach exists, say so, and push
back when it is warranted. If something is genuinely unclear, stop and name what is confusing.

**Simplicity first.** The minimum that solves the problem, nothing speculative. No features beyond
what was asked, no abstraction for a single use, no configurability nobody requested, no error
handling for states that cannot occur. If it came out at 200 lines and 50 would do, rewrite it.

**Surgical changes.** Every changed line should trace to the request. Do not improve adjacent code,
reformat, or refactor what is not broken; match the surrounding style even where you would choose
differently. Remove the orphans *your* change created — imports, variables, functions — and leave
pre-existing dead code alone, mentioning it rather than deleting it. An extraction the plan decided
is part of the request, not a refactor of adjacent code.

**Goal-driven execution.** Turn the task into something verifiable before starting. "Add validation"
becomes "write tests for the invalid inputs, then make them pass"; "fix the bug" becomes "write the
test that reproduces it, then make it pass". For multi-step work, give each step its own check.
Strong criteria let you finish without asking; "make it work" guarantees you cannot.

**A claim about runtime behaviour is settled by running something, not by reading.** A driver
default, whether a regex fires, what an error code arrives as, a timeout's unit. Reading the source
or the manual is not enough: a claim checked the same way it was written keeps its mistake, through
every reviewer who checks it that way. If it can be run, run it, and say so.
<!-- Why: a comment written straight from a database vendor's manual claimed an error was not
     reproducible on a given version. Both clauses were false, and it survived four review rounds
     because every reviewer checked it against the same manual. -->

**And then read what it left behind.** Running something is necessary and not sufficient: an
account of a run, your own included, can get the outcome right and the mechanism wrong and sound
just as sure. Settle it from the log and the files on disk, not from the account.
<!-- Why: building this framework, three experiments in a row reported the outcome correctly and
     the mechanism wrongly; one explained a hook result by inspecting a directory unrelated to
     hooks. The log and the files settled each one. -->

**Comments.** Few, and only where needed. A comment clarifies non-obvious behaviour for
the reader; it does not justify a decision. Prefer a clear name, and delete any comment the code
already makes obvious.

**Prose for humans** (docs, READMEs, UI copy): accuracy first, never at the cost of a precise claim.
If this repo has a house voice, its floor says so and names where it is written down.
