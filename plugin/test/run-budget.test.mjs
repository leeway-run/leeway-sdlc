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
});

test('sdlc-install writes no budget, and says which types have none', () => {
  assert.equal(
    from(install, '**Never written: a per-story budget.**', ' ## Step 5'),
    "**Never written: a per-story budget.** It lives in the process, as `params.budget` on a type's `build` step, and " +
      "no preset sets one, so a new product's runs have none until a person sets it (`sdlc-tune`, or the product's " +
      'Process section). Nothing goes in `CONFIG.md` for it. Step 7 says so.',
  );
  assert.match(
    install,
    /which types' `build` steps have no per-story budget in the process read back \(a run of them is limited only by the round caps, and a person sets one with `sdlc-tune`\), and what follows/,
  );
  assert.doesNotMatch(install, /2,000,000/);
});

test('sync-repo offers the move once, as a question asked with the copies', () => {
  assert.equal(
    from(sync, '- **Otherwise** offer the move once', ' **Converting the row.**'),
    '- **Otherwise** offer the move once, as one question asked with the copies in step 3 (its escalation\'s question ' +
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
    '**On "Move it"**, in this order, each only once the one before it holds: 1. **Write.** Read the definition ' +
      '(`<cli> process get <KEY> --json`), set `params.budget` on every `build` step to the budget (or remove it, ' +
      'when the row became no `budget`), change nothing else, and send the whole definition back as sdlc-tune\'s ' +
      'Step 4 does, `--as <alias>/agent`. When every `build` step already carries it, skip the write. 2. **Read ' +
      "back.** `<cli> process get <KEY> --json`: every `build` step's `params.budget` equals the budget (is absent, " +
      'when the row became no `budget`). 3. **Only then remove the row** from `.sdlc/CONFIG.md`, on the sync branch, ' +
      'with the `<!-- Per-story budget: … -->` comment that describes it, where there is one, and nothing else. A ' +
      'write the server refuses, or a read-back that does not carry the budget, removes nothing: the row stays, say ' +
      'which and why in the summary, and the next release asks again. Like the new flow, a no gets no `Kept` row.',
  );
  const order = ['1. **Write.**', '2. **Read back.**', '3. **Only then remove the row**'].map((s) => move.indexOf(s));
  assert.deepEqual([...order].sort((a, b) => a - b), order);
  assert.match(sync, /a `Per-story budget` row is removed only after the process read back carries it;/);
});

// A model of "Converting the row", so the prose's own example is checked against the rule it states.
const BOUNDS = { tokens: 1_000_000_000, rounds: 500, hours: 720 };
function convert(row) {
  const parts = row.replace(/, whichever comes first$/, '').split(' · ');
  const shapes = [
    ['tokens', /^([\d,]+) subagent tokens$/],
    ['rounds', /^([\d,]+) rounds$/],
    ['hours', /^([\d.]+) h wall-clock$/],
  ];
  if (parts.length !== 3) return undefined;
  const budget = {};
  for (const [i, [key, shape]] of shapes.entries()) {
    if (parts[i] === 'none') continue;
    const m = shape.exec(parts[i]);
    if (!m) return undefined;
    const n = Math.ceil(Number(m[1].replace(/,/g, '')));
    if (!(n >= 1 && n <= BOUNDS[key])) return undefined;
    budget[key] = n;
  }
  return Object.keys(budget).length ? budget : null;
}

test('converting the row: the prose example, none, rounding up, and what does not convert', () => {
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
  assert.deepEqual(convert(example), JSON.parse(json));
  assert.deepEqual(convert(`${example}, whichever comes first`), JSON.parse(json));
  assert.deepEqual(convert('none · 15 rounds · none'), { rounds: 15 });
  assert.equal(convert('none · none · none'), null);
  assert.deepEqual(convert('none · none · 2.5 h wall-clock'), { hours: 3 });
  assert.equal(convert('none · 501 rounds · none'), undefined);
  assert.equal(convert('2M tokens · 15 rounds · 4 h wall-clock'), undefined);
});
