// LWY-266.4: the per-story budget is a notice at the budget and a stop at twice it ("The budget is a notice").
// Text pins on plugin/skills/run/SKILL.md ("Start the budget", hard stop 9 and its note), plugin/skills/sdlc-tune/SKILL.md,
// plugin/skills/sdlc-install/SKILL.md and plugin/PROCESS.md. Round 0: each test is skipped with the criterion it serves.
// The design doc is docs/archive/lwy-266-an-unattended-run-decides-and-continues.md, "The budget is a notice (AC-5, e4)".
//
// How these pins are built (LWY-266.3's round 0 took five attempts to learn it): no word lists and no judging of meaning.
// Every required form is a fixed phrase, and the code round writes those phrases word for word.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const plugin = process.env.PLUGIN_DIR || join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(plugin, path), 'utf8').replace(/\r\n/g, '\n');
const flat = (text) => text.replace(/\s+/g, ' ').trim();

const has = (text, phrase) => assert.ok(text.includes(phrase), `missing: ${phrase}`);
const red = (criterion, name, fn) => test(`${criterion}: ${name}`, { skip: `red-test-${criterion}` }, fn);

const run = read('skills/run/SKILL.md');
const tune = flat(read('skills/sdlc-tune/SKILL.md'));
const install = flat(read('skills/sdlc-install/SKILL.md'));

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

// The run of text starting at `lead` and ending before `until`, on one line.
function from(text, lead, until) {
  const at = text.indexOf(lead);
  assert.ok(at >= 0, `no "${lead}"`);
  const end = until ? text.indexOf(until, at + lead.length) : -1;
  assert.ok(!until || end >= 0, `no "${until}" after "${lead}"`);
  return text.slice(at, until ? end : undefined);
}

const startTheBudget = () => from(under(run, 'Story start'), '4. **Start the budget**');
const stop9Note = () => from(under(run, 'Hard stop conditions'), '- **9: check at round boundaries', '- **10:');
const stop9Row = () => from(under(run, 'Hard stop conditions'), '| 9 |', '| 10 |');

const HEADING = '`# Budget reached — <story> · <dimension>`';

red('AC-5', 'a build step with no `budget` has no notice and no stop', () => {
  has(startTheBudget(), (
      'A dimension it leaves out is not limited, and a build step with no `budget` has no notice and no stop; say so in ' +
        'the session when the run starts.'
    ),
  );
  assert.doesNotMatch(startTheBudget(), /so stop 9 never fires/);
});

red('AC-5', 'reaching a dimension\'s budget is a notice on the story, and the run carries on', () => {
  has(startTheBudget(), (
      `At a round boundary where a dimension has reached its budget, that is a notice, not a stop: post ${HEADING} as a ` +
        'comment on the story, `<dimension>` being `tokens`, `rounds` or `hours`, and carry on.'
    ),
  );
});

red('TC-6', 'the notice is posted once per dimension per story, checked before posting', () => {
  has(startTheBudget(), (
      `Post it unless the story already has a comment that opens ${HEADING} for that dimension, read from \`leeway issue ` +
        'get <story> --json` before posting: at most three notices a story, one per dimension.'
    ),
  );
});

red('TC-6', 'the run stops only at twice the budget, and the notice and the stop read the same totals', () => {
  has(startTheBudget(), ('The run stops only at twice the budget in any dimension (stop 9).'));
  has(startTheBudget(), (
      'The notice and the stop read the same `totals` the same way: `tokensIncomplete` included.'
    ),
  );
});

red('TC-6', 'hard stop 9\'s row is the budget reached twice over', () => {
  assert.equal(
    stop9Row(),
    "| 9 | **The per-story budget is reached twice over**: tokens, rounds or wall-clock reaches twice its budget, whichever first | at every round boundary | the issue run's, on the story | ",
  );
});

red('TC-6', 'stop 9\'s note stops at twice the budget in each dimension and keeps the tokensIncomplete rule', () => {
  const note = stop9Note();
  has(note, (
      'Stop when a dimension reaches twice its budget: `totals.tokens` twice `tokens`, `totals.rounds` twice `rounds`, ' +
        '`totals.minutes` twice `hours` × 60; while `tokensIncomplete` is true and that floor is under twice the ' +
        'budget, carry on, and every readout of it (the status comment, the report to the user) says `at least ' +
        '<totals.tokens>, incomplete`.'
    ),
  );
  has(note, ('A dimension that has only reached its budget is the notice of "Start the budget", not this stop.'));
  assert.doesNotMatch(note, /reaches the token budget/);
  has(note, ('Rounds include round-0 attempts.'));
});

red('TC-10', 'the words stop 9 and the Spend line keep, unchanged', () => {
  assert.ok(stop9Note().startsWith("- **9: check at round boundaries, never mid-subagent.** Killing a subagent loses a round that may have been real. Read the story's `totals` at each boundary (\"Start the budget\"). Tokens are new tokens, counted from the transcripts where the harness can (\"Recording spend\")."));
  has(under(run, 'What is lost'), (
      'The budget is checked at round boundaries, so one long round can overshoot it, and a token count that cannot be made leaves the token total a floor, not a count.'
    ),
  );
  has(flat(run), ('- **Spend:** <rounds> of <budget> rounds · <tokens> of <budget> tokens · <elapsed> of <budget> wall-clock.'));
});

red('TC-11', 'sdlc-tune and sdlc-install give round0Cap as an integer 1 to 10', () => {
  has(tune, ('`redTests` boolean; `round0Cap` an integer 1 to 10; `roundCap` an integer 1 to 10;'));
  assert.doesNotMatch(tune, /round0Cap` an integer 1 to 5/);
  const step5 = from(install, '## Step 5 — set the process', ' ## Step 6');
  has(step5, ('`round0Cap` and `roundCap` are each an integer 1 to 10.'));
  assert.doesNotMatch(install, /round0Cap`?[^.]{0,40}1 to 5/);
});

// A guard that holds today and must keep holding: PROCESS.md never describes the budget as a stop (not red, so not skipped).
test('PROCESS.md\'s build row and "The round cap" do not describe the budget as a stop', () => {
  const process_ = read('PROCESS.md');
  const buildRow = flat(process_.split('\n').find((l) => l.startsWith('| `build` |')));
  has(buildRow, ('and the optional per-story `budget`'));
  assert.doesNotMatch(buildRow, /stop/i);
  assert.doesNotMatch(from(flat(process_), '**The round cap.**', '**Why it is shaped this way**'), /budget/i);
});
