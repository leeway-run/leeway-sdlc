# Task size

How big a task should be when the plan is cut. `plan-project` step 4 reads it before cutting tasks, and the
divergence reviewer judges the tasks against the same text, pasted into its prompt. One source, two readers: edit it
here. A repo adjusts it in `.sdlc/CONFIG.md`, under `## Task size`.

**This is guidance the planner weighs, not a rule.** There is no line-count estimate to hit, and a task may cross as
many layers as the behaviour needs.

## The default

A task is a thin slice of one behaviour, end to end. Adding a database field, returning it from an endpoint and
showing it in the UI is one task, not three: each part alone proves nothing a person can see.

## The test

Can one reviewer hold the task in one review round? Size is decided by that, not by how many layers the task
touches. A task that fits one reviewer's attention is the right size, whatever it crosses.

## When to split

Split when one part is big or risky on its own. These are examples, not a closed list; each has a short name so a
repo can switch it off or the reviewer can name the one a task strains.

- `pure-logic`: a sizeable piece of pure logic with its own tests.
- `removal`: removing something many places still call.
- `large-screen`: a large new screen.
- `isolation-or-auth`: a change to isolation or auth that needs its own proof.
