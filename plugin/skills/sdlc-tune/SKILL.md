---
name: sdlc-tune
description: Change the process of this repo's Leeway product in the human's words ("my bugs should skip the plan gate", "features need a design doc", "add a type spike that behaves like experiment") - show before and after for each affected type and the open issues it would touch, write it through process update, read it back. Use any time after sdlc-install, when the way work flows should change.
---

# Tune the product's process

You change **one thing: the product's process in Leeway**. You never edit a repo file: not `.sdlc/*`, not
`CLAUDE.md`, not `CONFIG.md`. The loop reads the process at runtime (`PROCESS.md`, "The process, read at
runtime"), so a change in Leeway is a change everywhere, and nothing in the repo needs to follow.

**Everything goes through the `leeway` CLI**, never an MCP server and never a hand-made HTTP call.
`<cli>` is `cli:` in `.sdlc/leeway.md`, `<KEY>` its `product:`, `<server>` its `server:`. Pass `--server
<server>` on every call. Writes carry `--as <alias>/agent` (the alias is this session's, `<word>-<two hex
digits>`, chosen as `PROCESS.md`, "The cast", describes). **No token, credential or server secret is shown or
written anywhere.** Without `.sdlc/leeway.md` the repo was never installed: ask for the command and the
product key, or point to `sdlc-install`; write neither down.

## Where the human is asked

The test is whether `.sdlc/leeway.md` exists in the repo you run in.

- **With it** (the Leeway repo, and any repo set up by `sdlc-install`), questions go to the human as Leeway
  escalations, not the terminal. Each confirmation below is: the before and after posted first as a comment
  (`comment add <ref> --stdin body`) on the issue the human named when invoking this skill (no ref given:
  stop and say an issue is needed), then one escalation on it with `--comment cN`, 2 to 5 options
  `{label, argument}` (label at most 60 characters, argument at most 1,000, question at most 500), the
  pre-filled option first. Then **stop the turn**. On resume read the answer (`<cli> issue get <ref> --json`,
  `escalations[].answer`) and write only on a yes.
- **Without it**, ask in the terminal, one question at a time.

## Step 1 - read what is there

```sh
<cli> process get <KEY> --json > <file outside the repo>/before.json
```

The answer is `{process, version, updatedAt}`. `version` is the revision (`0` and `updatedAt: null`: the
product never set a process, and `process` is the `mvp` preset, not a stored one). `process.version` is the
schema version, `1`.

**State each type in one line**, in the words `sdlc-install` uses for its questions 3 and 4: "A `<type>` goes
`<step labels joined with →>`." ("An" before a vowel.) Add what its question 5 shows: whether the type's
`build` step is `unattended`. A type with no `build` step is one the plugin does not run; say so in its line.
Then ask what the human wants to change, unless the invocation already said.

## Step 2 - turn the request into an edit

Take the request in the human's words. It is one or more of these, and nothing else is touched:

- **A step removed, added or reordered on a type** ("bugs skip the plan gate"; "features need a design doc"
  is the `plan` step's `designDoc: true`). Name the type; a request that names none applies to none, so ask
  which.
- **A type dropped**, or **added by analogy** ("a type spike that behaves like experiment"): copy that type's
  steps under a new `id`, `label` and `branchPrefix`, and say so. The `defaultType` is never the dropped one.
- **Unattended** ("run chores without me") sets `unattended` on that type's `build` step.
- **A build parameter** (red tests, review depth, caps, blocking rungs) on that type's `build` step.

Edit only the named types in the `process` value of `before.json`, into `after.json` (a short `node` script
is enough). Every other type, and every field not asked about, stays **byte-identical**. The edit keeps the
rules the server enforces:

- ids `^[a-z][a-z0-9-]{0,23}$`, labels 1 to 40 characters, `branchPrefix` `^[a-z][a-z0-9-]{0,15}$`;
- type ids unique and `defaultType` one of them; step ids unique per type; each non-`manual` kind at most
  once per type;
- step kinds `shape | plan | gate | build | manual`; statuses `backlog | ready | in_progress | in_review`,
  non-decreasing along a type's steps; a `build` step has status `in_progress`.

**The bounds.** At most **12 types**, **12 steps per type**, and the definition at most **16384 bytes**
(`wc -c after.json`, the body you will send). A request that would exceed any of them is **refused before any
write**: say which bound, the count it would reach, and what the human could drop instead. The server refuses
the same as `invalid_process`; that is the backstop, not the check.

## Step 3 - show before and after, and what it touches

For **each affected type only**, show it before → after in the Step 1 words (and the changed fields, if the
change is not a step list). Then the open issues it would affect:

```sh
<cli> project list <KEY>
<cli> issue list <KEY> <projectId> --json      # every project of the product
```

An issue is **open** when its status is not `done` or `cancelled` (those keep their strings). It is
**affected** when its type is removed, or its `step` is not a step of its type in the new definition at the
issue's status. List the refs, or say none.

## Step 4 - confirm, then write

Ask once: "Change `<types>` as shown, and write it to `<KEY>`?" Two options, "Write it" first, then "Leave it".
On no, change nothing. On yes:

```sh
<cli> process update <KEY> --stdin process --as <alias>/agent < <file outside the repo>/after.json
```

`--stdin process` takes the whole definition, `{version, defaultType, types}`, not the
`{process, version, updatedAt}` envelope. A preset is not a tune: `--preset` replaces the whole definition and
belongs to `sdlc-install`; never use it here.

## Step 5 - if the server answers `process_in_use`

An open issue would be stranded and **nothing was written**. Do not force it. The error does not name the
issues, so read `issue list` for every project of the product as in Step 3 and list the offending refs with
their type, status and step. For each, offer a move the human can pick:

- `<cli> issue update <ref> --step <step> --as <alias>/agent`: onto a step the new definition has; it also sets
  that step's status.
- `<cli> issue update <ref> --status <status> --as <alias>/agent`: a status that is **not** the issue's
  current step's status clears the step (the same status keeps it, so it moves nothing). `--type <id>` moves
  it to a type that exists. `--step null` does not clear a step from the CLI: it is sent as the text "null"
  and refused as `invalid_step`.
- or **leave the process as it was** and finish the issue first.

This is a second question to the human (escalation mode: a second escalation, with the refs and the moves in
a comment first, one option per plan of moves and one for "Leave it"). Make no move without the answer. After
it, make the moves, **retry the write once**, and if it is refused again report the refs that remain and stop.

## Step 6 - read it back

```sh
<cli> process get <KEY> --json
```

Show the new `version` and the Step 1 line for every type, and say which types changed and that the others
did not: compare each type you were not asked to touch with `before.json`, byte for byte, not by eye. A
difference there is a bug in this run; say so plainly.

Then state what this run did not do: no repo file was written, and no issue was moved except those the human
chose.
