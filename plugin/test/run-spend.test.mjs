import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const plugin = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(plugin, path), 'utf8').replace(/\r\n/g, '\n');
const flat = (text) => text.replace(/\s+/g, ' ');

const skill = read('skills/run/SKILL.md');
const contract = read('PROCESS.md');
const brief = read('skills/run/templates/BRIEF.md');
const implementer = read('agents/sdlc-implementer.md');
const row = (doc, lead) => {
  const rows = doc.split('\n').filter((line) => line.startsWith(lead));
  assert.equal(rows.length, 1, `one row starting "${lead}"`);
  return rows[0];
};

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

const spend = () => under(skill, 'Recording spend');

test('every round records its spend, and Leeway, not prose, holds the totals', () => {
  assert.equal(
    from(spend(), '**Every round records', '- **Time is measured'),
    "**Every round records what it cost on its iteration, and the run's own time goes on the story.** Leeway sums them: " +
      "`totals` in `leeway --json issue get <ref>`, a story's over its own records and its sub-issues'. Nothing reads a " +
      'total back from prose. ',
  );
});

test('a token is a new token, the same unit for a subagent and the orchestrator, and never the harness count', () => {
  assert.equal(
    from(spend(), '- **A token is a new token', '- **`session-tokens.mjs` counts them**'),
    '- **A token is a new token: `input_tokens + cache_creation_input_tokens + output_tokens`, summed over every model ' +
      'call of the agent in the span; `cache_read_input_tokens` is never counted.** It is the same unit for a subagent ' +
      "and for you. A harness's own count for a subagent is not it: Claude Code's `subagent_tokens` is the agent's " +
      'final context size, not a sum, and no record carries it. ',
  );
  assert.equal(
    from(spend(), '- **`session-tokens.mjs` counts them**', '- **What cannot be counted'),
    "- **`session-tokens.mjs` counts them**, in `scripts/` under `HARNESS.md`'s `plugin-files:`, one call per span, as " +
      '`HARNESS.md`, "Counting tokens", says. It only reads, and prints one whole number: ' +
      '```sh node <plugin-files>/scripts/session-tokens.mjs --subagent <its transcript> ' +
      'node <plugin-files>/scripts/session-tokens.mjs --session <your transcript> --from <start> --to <end> ``` ' +
      "`<start>` and `<end>` are the span's two stamps, in milliseconds. Count a subagent once it has returned, and a " +
      'span of yours in a tool call after the one that stamped its end, never in that call: the running call is not ' +
      'yet in the transcript. A call belongs to the span holding its first line, so two spans that share a stamp count ' +
      'it once. ',
  );
  for (const doc of [skill, contract, brief]) {
    assert.doesNotMatch(flat(doc), /as the harness report|harness reported|harness did not report|subagent tokens|subagents' counts/);
  }
});

test('what cannot be counted is left out, never sent as 0', () => {
  assert.equal(
    from(spend(), '- **What cannot be counted', '- **The round**'),
    '- **What cannot be counted is left out: never `--tokens 0` in its place, never an estimate.** That is every record ' +
      'in a harness whose "Counting tokens" says it cannot, a span whose start or subagent this session did not see, ' +
      'and any exit of the script but 0: then it prints no number. Leeway marks the total incomplete ' +
      '(`tokensIncomplete`), and every readout of it says so: the token total is a floor, and the run carries on (stop ' +
      '9). A 0 the script prints means it found no model call, and it says so on stderr. Pass it only if that is true, ' +
      'as for a subagent that ended before its first call; a span in which you made calls has the wrong window or ' +
      'file, so leave `--tokens` out. ',
  );
  const record = from(under(skill, '2. Gate, commit, push, record'), '4. **Record the iteration**', '`iteration.number` is `N`');
  assert.equal(
    from(record, '`--addresses` is', '```sh'),
    "`--addresses` is the brief's `Addresses:` as a JSON list, omitted when `none`; the round's spend is as \"Recording " +
      'spend" says, `--tokens` left out when it cannot be counted, never `0`: ',
  );
  assert.match(
    record,
    /iteration record <ref> <sha> --tests "<lane line>" \[--passed\] \[--addresses '\["c1","c3"\]'\] \[--tokens <N>\] \[--minutes <N>\] \[--testMinutes <N>\] --note "<note>"/,
  );
  for (const doc of [skill, contract, brief]) {
    assert.doesNotMatch(doc.replace(/never `--tokens 0`/g, ''), /--tokens[ =]+0\b/, 'a command sends --tokens 0');
  }
});

test('the round, its review, a round with no iteration and the run\'s own time each say where they are recorded', () => {
  assert.equal(
    from(spend(), '- **The round**', '- **Its review**'),
    '- **The round**, on its iteration ("Gate, commit, push, record", step 4): `--minutes` from delegating to the ' +
      "implementer to the iteration record; `--tokens` the implementer's, from its transcript; `--testMinutes` the brief's *Test minutes*, " +
      'left out when it says `unknown` and never more than `--minutes` (pass the smaller); `--note` what the round did, ' +
      'in a few words ("round 0: 4 red tests", "addresses c6, c7"). ',
  );
  assert.equal(
    from(spend(), '- **Its review**', "- **A round's orchestration**"),
    '- **Its review**, on the same sub-issue once the verdict is posted, because a recorded iteration is never edited: ' +
      '`leeway --as <alias>/reviewer --json spend record <ref> <minutes> [--tokens <N>] --note "review of it.N"`, the ' +
      "minutes from delegating to the reviewer to the verdict posted, `--tokens` the reviewer's, from its transcript. ",
  );
  assert.equal(
    from(spend(), "- **A round's orchestration**", '- **A round that records no iteration**'),
    "- **A round's orchestration**, the tokens you spent on it, on the same sub-issue after that record: `leeway --as " +
      '<alias>/agent --json spend record <ref> 0 [--tokens <N>] --note "orchestrating it.N"`, `--tokens` from your ' +
      'transcript, from delegating to the implementer to the verdict posted. Its minutes are 0 because that time is ' +
      "already in the round's and the review's. ",
  );
  assert.equal(
    from(spend(), '- **A round that records no iteration**', '- **The run\'s own time**'),
    '- **A round that records no iteration** (a stalled round, a BLOCKED brief with nothing staged) still cost what it ' +
      'cost: `leeway --as <alias>/agent --json spend record <ref> <minutes> [--tokens <N>] --note "<stalled round | ' +
      'BLOCKED, nothing staged>"`, before its escalation, `--tokens` the implementer\'s, from its transcript. Its ' +
      'orchestration follows it as above, its span ending at that record. ',
  );
  assert.equal(
    from(spend(), '- **The run\'s own time**'),
    "- **The run's own time**, on the story: `leeway --as <alias>/agent --json spend record <story> <minutes> [--tokens " +
      '<N>] --note "<what>"`, `--tokens` from your transcript over the span, one record per span: the baseline ("Story start", step 3), landing each task (from "Land ' +
      'the task", step 1, through the lanes run after it lands), and the story gate (from its step 1 to the story read ' +
      'back at its step 5, adding the count from the transcript of a reviewer pass at its step 3, and leaving `--tokens` ' +
      'out if either cannot be counted). The moments between spans, posting ' +
      'records and reading Leeway, are not recorded. ',
  );
});

test('time is measured, and a wait is never in a record', () => {
  assert.equal(
    from(spend(), '- **Time is measured', '- **A token is a new token'),
    "- **Time is measured, never estimated.** Take `node -e 'console.log(Date.now())'` when a span starts and again when it ends; " +
      'its minutes are the difference in whole minutes, rounded to the nearest (`$(( (end - start + 30000) / 60000 ))`). **A wait ends a ' +
      'span**: record what came before it, and start a new span once the answer arrives. Time waiting on a person is ' +
      'never in a record; Leeway counts it from the escalations. A round whose start this session did not see (resumed ' +
      'from an earlier session) has no minutes: its iteration leaves `--minutes` and `--testMinutes` out, and Leeway ' +
      'marks the total incomplete (`minutesIncomplete`). ',
  );
});

test('the budget is summed from Leeway; a continuation run never re-parses the Spend line', () => {
  const start = from(under(skill, 'Story start'), '4. **Start the budget**');
  assert.equal(
    from(start, 'It is per story, across runs'),
    'It is per story, across runs, and every dimension is summed by Leeway: `totals` in `leeway --json issue get ' +
      "<story>`, over the story's own records and its sub-issues' (\"Recording spend\"). **Rounds** are " +
      '`totals.rounds`, round-0 attempts included; **tokens** are `totals.tokens`, and **wall-clock** is ' +
      '`totals.minutes`. A continuation run reads them there, never from the `Spend` line of a `# Run status` comment. ' +
      'Time spent in a wait ("Wait, then carry on") does not count toward wall-clock. ',
  );
  assert.doesNotMatch(flat(skill), /continue from the `Spend` line/);
  assert.equal(
    from(under(skill, 'The end'), 'The end posts one', 'No escalation, except'),
    'The end posts one `# Run status — <story ref> · finished` comment on the story, with *Landed* (every task), the ' +
      "story's new step or status, the *Spend* line and the friction proposal, so the next reader has the spend. A " +
      'continuation run reads it from Leeway ("Start the budget"), never from that line. ',
  );
});

test('the Spend line stays, as a readout that says when a total is incomplete', () => {
  const stop = under(skill, 'On a stop');
  assert.match(
    stop,
    /- \*\*Spend:\*\* <rounds> of <budget> rounds · <tokens> of <budget> tokens · <elapsed> of <budget> wall-clock\./,
  );
  assert.equal(
    from(stop, 'The *Spend* line is a readout', '5. **Raise'),
    "The *Spend* line is a readout of the story's `totals`: `<tokens>` reads `at least <totals.tokens>, incomplete` " +
      'when `tokensIncomplete` is true, and `<elapsed>` likewise when `minutesIncomplete` is. Each `<budget>` is that ' +
      "dimension of the build step's `budget`, the wall-clock in hours (`4 h`); a dimension it leaves out drops its " +
      '`of <budget>` (`7 rounds`). ',
  );
});

test('stop 9: a round with unreported tokens never counts as free', () => {
  assert.equal(
    from(under(skill, 'Hard stop conditions'), '- **9: check at round boundaries', '- **10:'),
    '- **9: check at round boundaries, never mid-subagent.** Killing a subagent loses a round that may have been ' +
      "real. Read the story's `totals` at each boundary (\"Start the budget\"). Tokens are new tokens, counted from " +
      'the transcripts where the harness can ("Recording spend"). Stop when `totals.tokens` reaches the token ' +
      'budget; while `tokensIncomplete` is true and that floor is under the budget, carry on, and every readout of it ' +
      '(the status comment, the report to the user) says `at least <totals.tokens>, incomplete`. Rounds include ' +
      'round-0 attempts. ',
  );
  assert.doesNotMatch(flat(skill), /that dimension is not enforced/);
  assert.equal(
    from(under(skill, 'What is lost'), 'The budget is checked at round boundaries', ' A span the session ends inside'),
    'The budget is checked at round boundaries, so one long round can overshoot it, and a token count that cannot ' +
      'be made leaves the token total a floor, not a count.',
  );
});

test('a round with no iteration points at its spend record, before its escalation', () => {
  assert.equal(
    from(flat(skill), 'A stalled round **records no iteration**', ', leaves the sub-issue where it is'),
    'A stalled round **records no iteration** (its spend still goes on the sub-issue, "Recording spend")',
  );
  const blocked = under(skill, 'A BLOCKED brief');
  assert.equal(
    from(blocked, '1. If it staged work', '2. Post the brief'),
    '1. If it staged work, commit, push and record the iteration as above; if it staged nothing, do not (no ' +
      'iteration): record its spend on the sub-issue instead, now, before the escalation at step 3 ("Recording ' +
      'spend"). ',
  );
});

test('the round records, the contract and the brief carry the spend fields', () => {
  const writes = under(skill, 'The writes of one round, in order');
  assert.match(writes, /\| 4 \| iteration \| `--as <alias>\/implementer iteration record <ref> <sha> --tests "…" \[--passed\] \[--addresses '\[…\]'\] \[--tokens N\] \[--minutes N\] \[--testMinutes N\] --note "…"` \|/);
  assert.match(writes, /then `--as <alias>\/reviewer spend record <ref> <minutes> \[--tokens N\] --note "review of it\.X"` and `--as <alias>\/agent spend record <ref> 0 \[--tokens N\] --note "orchestrating it\.X"` \|/);
  assert.equal(
    row(contract, '| round |'),
    '| round | commit and push the task branch, then `iteration record <ref> <sha> --tests "<lane line>" [--passed] ' +
      "--addresses '[\"c1\",\"c2\"]' [--tokens N] [--minutes N] [--testMinutes N] --note \"…\" --as <impl>/implementer` " +
      '(`--passed` is a valueless flag: a lane that failed omits it and starts `--tests` with `FAILED:`; `--tokens` is ' +
      "new tokens, input + cache writes + output summed over the agent's model calls and never cache reads, counted by " +
      '`scripts/session-tokens.mjs` as `HARNESS.md`, "Counting tokens", says, and left out when they cannot be counted, never `0`); the round count is the iterations; round-0 attempts ' +
      'are those before the `step_set {to: implementing}` entry |',
  );
  assert.equal(
    row(contract, '| spend outside a round |'),
    '| spend outside a round | `spend record <ref> <minutes> [--tokens N] --note "…"`: a round\'s review, its orchestration, or a round ' +
      "that records no iteration, on its sub-issue, and the run's own time (the baseline, landing a task, the story " +
      'gate) on the story; totals are read back from `issue get <ref>` (`totals`), never from a comment |',
  );
  assert.equal(
    from(flat(brief), '- **Test minutes:** the whole', ' - **Addresses:**'),
    '- **Test minutes:** the whole minutes this round spent running the lanes, timed (`date +%s` before and after ' +
      'each run), or `unknown` when you did not time them. Never an estimate.',
  );
  assert.equal(
    row(brief, '| Head sha, Lane line, Passed, Addresses, Test minutes |'),
    '| Head sha, Lane line, Passed, Addresses, Test minutes | `leeway --as kestrel-b1/implementer iteration record ' +
      'LWY-12.3 ce84f32a32c79f634395275e24549a2a035b7255 --tests "unit 31/31 green (docs-lint); typecheck n/a" ' +
      "--passed --addresses '[\"c2\",\"c3\"]' --tokens 48210 --minutes 9 --testMinutes 2 --note \"addresses c2, c3\"` " +
      '(`Passed: no` or `n/a` omits `--passed`; `--tokens` is the implementer\'s new tokens, counted from its transcript, left ' +
      "out when they cannot be counted, and `--minutes` is the orchestrator's own timing: `run`, \"Recording spend\") |",
  );
  assert.equal(
    from(flat(implementer), '*Test minutes* is', ' **Addresses.**'),
    '*Test minutes* is the whole minutes you spent running lanes, timed with `date +%s` around each run, or ' +
      '`unknown`; never an estimate.',
  );
});
