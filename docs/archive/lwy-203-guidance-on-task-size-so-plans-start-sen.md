# LWY-203: guidance on task size

Story: LWY-203, "Guidance on task size, so plans start sensibly sized and the reviewer stops asking per task". The
story's body is the source of the AC-n and TC-n; this doc says how they are built.

## Decisions

The interview raised no escalation: each open question for dev was settled from the code (LWY-203, `# Interview
closed`). The shaping answers that bind the design are LWY-203 e1 (a size finding is a NOTE), e2 (a repo switches
points off by name and adds its own), e3 (guidance, not the four strict rules, and no line estimate; the guidance is
the PO's comment c5) and e4 (tasks only).

## Where the text lives

**One source, two readers**, as `skills/shape-project/references/gap-checklist.md` already is for shaping and the
product check:

- `plugin/skills/plan-project/references/task-size.md` holds the guidance: the default (a thin slice of one behaviour
  end to end, the one-field example), the test (one reviewer, one round), and the split points, each with a short
  name so a repo can switch it off: `pure-logic`, `removal`, `large-screen`, `isolation-or-auth`.
- `plan-project` step 4 reads it before cutting tasks.
- The divergence reviewer never reads the file itself. `plan-project`, "Delegate to the divergence reviewer", pastes
  the **effective** guidance into the reviewer's prompt, the way it already pastes the doc map: the file's text with
  the repo's switched-off points removed and its added points appended. The reviewer's check judges against what its
  prompt carries, so a repo's adjustment reaches it with no second copy and no path to resolve.

Why not the reviewer's agent file: then plan-project would read an agent definition as its guidance, and the
repo's adjustment would still have to be pasted. Why not `PROCESS.md`: it is the contract, read in full by every
skill; a planning heuristic adds to every reader's load for one step's benefit.

## The repo's adjustment

`.sdlc/CONFIG.md` gains a `## Task size` section (scaffold: `skills/sdlc-install/scaffold/CONFIG.md.tmpl`), an
empty table by default:

| Point | Off or added | Text |
|---|---|---|

A row `| removal | off | |` switches the plugin's `removal` point off; a row `| migrations | added | <text> |` adds
one. **No section, or an empty table, is the plugin's guidance as written**, so a repo installed before this needs
no sync. A row naming a point the plugin does not have is not dropped silently: plan-project says so in the session
and ignores the row. The file's header comment ("Repo facts only") gains one clause naming this section.

## The reviewer

`agents/sdlc-divergence-reviewer.md`:

- "Tasks too big for one review round" is rewritten to judge against the task-size guidance in its prompt, with no
  layer count and no line estimate of its own.
- The Findings table moves "a task you judge too big" from the QUESTION row's typical list to the NOTE row, worded
  as a task the guidance suggests splitting, naming the point it strains.
- Nothing about size can make a BLOCKER or a QUESTION, so a plan whose only findings are size NOTEs can PASS.

## Other agents

`scripts/build-targets.mjs` copies skill reference files and the agents into `targets/agents/`. Regenerate;
`node scripts/build-targets.mjs --check` proves it.

## Breakdown

One task, by the guidance itself: four text files, one test file and a regeneration, one behaviour, one reviewer
can hold it in a round. Nothing in it is big or risky on its own.

## Hazard register

| Hazard | Owning task | The check that proves it closed | Rung |
|---|---|---|---|
| The reviewer still raises size as a QUESTION from a line the rewrite missed (the check list, the Findings table, the verdict rules) | LWY-203.1 | test: no QUESTION or BLOCKER row of the reviewer mentions task size; the NOTE row does | R1 |
| A second copy of the split points drifts (restated in the reviewer or in step 4) | LWY-203.1 | test: each backticked point name, searched under `plugin/skills/` and `plugin/agents/`, is only in `task-size.md`; the test file is not searched | R1 |
| The reviewer gets no guidance (an older caller) and invents a size test | LWY-203.1 | test: the reviewer text says no guidance means no size finding | R1 |
| A repo without the `## Task size` section gets no guidance, or an error | LWY-203.1 | test: plan-project's text says an absent section or empty table means the plugin's guidance as written | R1 |
| The strict rules or the line estimate survive somewhere | LWY-203.1 | test: "many hundreds of lines" and "stays in one layer" absent from the reviewer, plan-project and `task-size.md` | R1 |
| `targets/` not regenerated | LWY-203.1 | `node scripts/build-targets.mjs --check` | R1 |

## Sequencing

Branches from the plan branch `feat/p_20860e30-leeway-sdlc-0-3-1`. LWY-200, LWY-201 and LWY-202 edit the same two
files (plan-project's review loop and the reviewer); whichever lands second merges, nothing more.
