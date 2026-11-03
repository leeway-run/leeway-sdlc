import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const plugin = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(plugin, path), 'utf8').replace(/\r\n/g, '\n');
const flat = (text) => text.replace(/\s+/g, ' ');

const run = read('skills/run/SKILL.md');
const sync = flat(read('skills/sync-repo/SKILL.md'));
const install = flat(read('skills/sdlc-install/SKILL.md'));
const tune = flat(read('skills/sdlc-tune/SKILL.md'));
const template = read('skills/sdlc-install/scaffold/CONFIG.md.tmpl');

// The text under `heading` (any level), up to the next heading of the same or a higher level, on one line.
function under(doc, heading) {
  const m = doc.match(new RegExp(`\\n(#+) ${heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\n`));
  assert.ok(m, `no "${heading}" heading`);
  const start = m.index + 1;
  const next = new RegExp(`\\n#{1,${m[1].length}} `, 'g');
  next.lastIndex = start + 1;
  const end = next.exec(doc);
  return flat(doc.slice(start, end ? end.index : undefined));
}

// The sentence-run starting at `lead` and ending before `until`, on one line.
function from(text, lead, until) {
  const at = text.indexOf(lead);
  assert.ok(at >= 0, `no "${lead}"`);
  const end = until ? text.indexOf(until, at + lead.length) : -1;
  assert.ok(!until || end >= 0, `no "${until}" after "${lead}"`);
  return text.slice(at, until ? end : undefined);
}

test('run reads the budget from the story\'s build step in the process, never from CONFIG', () => {
  assert.equal(
    from(under(run, 'Story start'), '4. **Start the budget**', 'It is per story, across runs'),
    '4. **Start the budget** from the process: `params.budget` on the story\'s build step (precondition 1), never from ' +
      '`.sdlc/CONFIG.md`. It has up to three dimensions, whichever is hit first: `tokens`, `rounds` and `hours`, the ' +
      'wall-clock in whole hours, checked against `totals.minutes`. A dimension it leaves out is not limited, and a ' +
      'build step with no `budget` limits none, so stop 9 never fires; say so in the session when the run starts. A ' +
      '*Per-story budget* row still in `.sdlc/CONFIG.md` is not read: say that `sync-repo` moves it into the process. ' +
      'Read the budget again with the totals at each round boundary, so one a person changed while the run waited is ' +
      'the one checked. ',
  );
  assert.equal(
    from(under(run, 'Run a project'), '**Bounds.** The per-story budget', ' **There is no project-level budget**'),
    '**Bounds.** The per-story budget (the `budget` of each issue\'s build step, "Start the budget") applies to each ' +
      'issue as it does to an issue run on its own.',
  );
});

test('no skill, agent or contract reads or writes a budget in .sdlc/CONFIG.md', () => {
  const files = [
    'PROCESS.md',
    ...readdirSync(join(plugin, 'agents')).map((name) => `agents/${name}`),
    ...readdirSync(join(plugin, 'skills')).map((name) => `skills/${name}/SKILL.md`),
    'skills/sdlc-install/scaffold/CONFIG.md.tmpl',
  ];
  const naming = files.filter((file) => /Per-story budget/.test(flat(read(file))));
  assert.deepEqual(naming, ['skills/run/SKILL.md', 'skills/sync-repo/SKILL.md']);
  assert.equal(flat(run).match(/Per-story budget/g).length, 1, "run names the CONFIG row only to say it is not read");
  for (const file of files) {
    assert.doesNotMatch(read(file), /PER_STORY_BUDGET/, file);
  }
  assert.doesNotMatch(template, /budget/i);
  const near = files.flatMap((file) =>
    flat(read(file)).split(/(?<=\.) /).filter((s) => /budget/i.test(s) && /CONFIG/.test(s)).map((s) => `${file}: ${s}`),
  );
  assert.deepEqual(near, [
    'skills/run/SKILL.md: **Start the budget** from the process: `params.budget` on the story\'s build step ' +
      '(precondition 1), never from `.sdlc/CONFIG.md`.',
    'skills/run/SKILL.md: A *Per-story budget* row still in `.sdlc/CONFIG.md` is not read: say that `sync-repo` moves ' +
      'it into the process.',
    'skills/sync-repo/SKILL.md: --- name: sync-repo description: Bring this repo\'s leeway-sdlc copies up to the plugin ' +
      'version this session runs - the ticket templates, the craft floor, the managed contract block in the agent\'s ' +
      'instructions file, the gitignore lines, and for agents other than Claude Code the kit in .sdlc/kit and the agent ' +
      'and hook files - one diff and one question per copy, the new shaping and planning flow offered to a product ' +
      'process still on the old one, and a run budget left in .sdlc/CONFIG.md offered a move into the process, then one ' +
      'branch and one pull request, with the decisions recorded in .sdlc/CONFIG.md.',
    'skills/sync-repo/SKILL.md: Then the per-story budget, which `run` reads from the process and no longer from ' +
      '`.sdlc/CONFIG.md`: - **No `Per-story budget` row in `.sdlc/CONFIG.md`** → nothing to offer.',
    'skills/sync-repo/SKILL.md: Two options, each with its argument: "Move it" first (the budget goes on every type\'s ' +
      '`build` step, where `run` reads it, and the row leaves `.sdlc/CONFIG.md`), then "Leave it" (nothing is written; ' +
      'the row stays, and no skill reads it).',
    'skills/sync-repo/SKILL.md: **Only then remove the row** from `.sdlc/CONFIG.md`, on the sync branch, with the ' +
      '`<!-- Per-story budget: … -->` comment that describes it, where there is one, and nothing else.',
    'skills/sync-repo/SKILL.md: - `.sdlc/CONFIG.md`, except its `## Repo copies` section (step 4) and a `Per-story ' +
      'budget` row, with its comment, that the budget move removes (step 1).',
  ]);
});

test('sdlc-tune sets the budget within the bounds the process accepts', () => {
  assert.equal(
    from(tune, '`budget`, optional,', ' The `plan` step'),
    '`budget`, optional, `{tokens, rounds, hours}`, each optional, `tokens` an integer 1 to 1,000,000,000, `rounds` 1 ' +
      'to 500, `hours` 1 to 720, and a dimension left out is not limited.',
  );
});

test('sdlc-install writes the old default budget on the preset path only, and says where it went', () => {
  assert.equal(
    from(install, '**Written without asking, with a preset only: the per-story budget**', ' ## Step 5'),
    '**Written without asking, with a preset only: the per-story budget** `{"tokens": 2000000, "rounds": 15, ' +
      '"hours": 4}` (2,000,000 subagent tokens · 15 rounds · 4 h wall-clock, whichever comes first), as ' +
      '`params.budget` on each `build` step that has none (step 5). No preset sets one, so the install does, as a ' +
      'default the human did not choose but can see in the process and change with `sdlc-tune`. With question 2 (d) ' +
      'the process is the human\'s and no budget is written. Step 7 says which `build` steps have one.',
  );
  const step5 = from(install, '## Step 5 — set the process', ' ## Step 6');
  assert.equal(
    from(step5, 'When question 2 was (d)', ' 1. `<cli> process update'),
    'When question 2 was (d), skip the preset (1) and make no change for questions 3 to 5: ask 14 and 15 against the ' +
      'process step 3.4 read, make only the change their answers ask for (3), write no budget (skip 4), and read it ' +
      'back (5). Otherwise, and only after the human has answered 2 to 5:',
  );
  assert.equal(
    from(step5, '4. **The default budget**', ' 5. **Read it back**'),
    '4. **The default budget**, only when the preset write (1) succeeded: a refused preset, `process_in_use` ' +
      'included, writes no budget. Read the stored definition (`<cli> process get <KEY> --json`), set ' +
      '`params.budget` to `{"tokens": 2000000, "rounds": 15, "hours": 4}` on each `build` step that has no ' +
      '`budget`, change nothing else, and send the whole definition back as in 3. Every `build` step already ' +
      'carrying one → skip the write.',
  );
  const order = ['1. `<cli> process update', '3. **Adjustments**', '4. **The default budget**', '5. **Read it back**'];
  const at = order.map((s) => step5.indexOf(s));
  assert.ok(at.every((n) => n >= 0), 'every step 5 item is there');
  assert.deepEqual([...at].sort((a, b) => a - b), at);
  assert.match(
    install,
    /cast"\), from the process read back which types' `build` steps got the default per-story budget in step 5 and which have none \(a run of those is limited only by the round caps\), and that `sdlc-tune` changes either, a preset the server refused in step 5 \(the refs it named, and that neither the preset nor the default budget was applied\), and what follows/,
  );
  assert.doesNotMatch(install, /Process section/);
});

test('sync-repo offers the move once, as a question asked with the copies', () => {
  assert.equal(
    from(sync, 'Then the per-story budget, which', ' **Converting the row.**'),
    'Then the per-story budget, which `run` reads from the process and no longer from `.sdlc/CONFIG.md`: - **No ' +
      '`Per-story budget` row in `.sdlc/CONFIG.md`** → nothing to offer. - **A row, and no `.sdlc/leeway.md`** → ' +
      'nothing to offer: there is no product to move it into. The row stays, and no skill reads it; say so in the ' +
      'summary. - **A row that does not convert** (below) → show it, naming what does not fit, and do not offer it. ' +
      'The row stays. - **Otherwise** offer the move once, as one question asked with the copies in step 3 (its escalation\'s question ' +
      'begins `Sync budget: to <this version>:`), showing the row, the budget it becomes, and every type with a ' +
      '`build` step, that step\'s `params.budget` before → after. Two options, each with its argument: "Move it" ' +
      'first (the budget goes on every type\'s `build` step, where `run` reads it, and the row leaves ' +
      '`.sdlc/CONFIG.md`), then "Leave it" (nothing is written; the row stays, and no skill reads it). The question ' +
      'says that a no is asked again at the next release.',
  );
  assert.match(sync, /and so is the budget move \(step 1\), by `Sync budget: to <this version>:`\./);
  assert.match(sync, /step 1's budget move when a row is offered it, and step 1's new flow/);
  assert.match(
    sync,
    /- `\.sdlc\/CONFIG\.md`, except its `## Repo copies` section \(step 4\) and a `Per-story budget` row, with its comment, that the budget move removes \(step 1\)\. -/,
  );
});

// The negative case: the row is never removed before the process read back carries the budget.
test('the row is removed only after the process read back carries the budget', () => {
  const move = from(sync, '**On "Move it"**', ' ## 2. Compare each copy');
  assert.equal(
    move,
    '**On "Move it"**, after the new flow of this sync is settled (not offered, answered no, refused, or written ' +
      'and read back; while its `Sync process:` question is open, the move waits), because each write sends the ' +
      "whole definition and one built from an earlier read would drop the other's change. Then, in this order, each " +
      'only once the one before it holds: 1. **Write.** Read the definition ' +
      '(`<cli> process get <KEY> --json`), set `params.budget` on every `build` step to the budget (or remove it, ' +
      'when the row became no `budget`), change nothing else, and send the whole definition back as sdlc-tune\'s ' +
      'Step 4 does, `--as <alias>/agent`. When every `build` step already carries it, skip the write. ' +
      '`process_in_use` → name the refs, leave the process as it was, and point at sdlc-tune. 2. **Read back** as ' +
      "sdlc-tune's Step 6 does: `<cli> process get <KEY> --json`, every `build` step's `params.budget` equals the " +
      'budget (is absent, when the row became no `budget`), and everything else is byte-identical to the definition ' +
      'this move\'s own Write (1, just above) read, not the one "1. Read the record" read before the new flow. It is ' +
      'the last process read before the row is removed, and no process write of this sync comes after it. ' +
      '3. **Only then remove the row** from `.sdlc/CONFIG.md`, on the sync branch, ' +
      'with the `<!-- Per-story budget: … -->` comment that describes it, where there is one, and nothing else. A ' +
      'write the server refuses, or a read-back that does not carry the budget, removes nothing: the row stays, say ' +
      'which and why in the summary, and the next release asks again. Like the new flow, a no gets no `Kept` row.',
  );
  const order = ['after the new flow of this sync is settled', '1. **Write.**', '2. **Read back**', '3. **Only then remove the row**'].map((s) => move.indexOf(s));
  assert.ok(order.every((n) => n >= 0));
  assert.deepEqual([...order].sort((a, b) => a - b), order);
  assert.match(sync, /a `Per-story budget` row is removed only after the process read back carries it;/);
});

test('converting the row: the rule, and its own example read the way it says', () => {
  const rule = from(sync, '**Converting the row.**', ' **On "Move it"**');
  assert.equal(
    rule,
    '**Converting the row.** Each dimension of `<n> subagent tokens · <n> rounds · <n> h wall-clock` becomes ' +
      '`tokens`, `rounds` and `hours`, with the thousands separators dropped (`2,000,000 subagent tokens · 15 rounds · ' +
      '4 h wall-clock` is `{"tokens": 2000000, "rounds": 15, "hours": 4}`), and a trailing `, whichever comes first` ' +
      'is dropped too. A dimension written `none` is left out, and a row with every dimension `none` becomes no ' +
      '`budget` at all. A wall-clock not in whole hours is rounded up to the next one, and the question says so. A ' +
      "row that does not read this way, or a value outside the process's bounds (`tokens` 1 to 1,000,000,000, " +
      '`rounds` 1 to 500, `hours` 1 to 720), does not convert.',
  );
  const [, example, json] = /\(`([^`]+)` is `([^`]+)`\)/.exec(rule);
  const [tokens, rounds, hours] = example.split(' · ').map((part) => Number(part.split(' ')[0].replace(/,/g, '')));
  assert.deepEqual({ tokens, rounds, hours }, JSON.parse(json));
});
