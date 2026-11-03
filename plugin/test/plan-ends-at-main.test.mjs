import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const plugin = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(plugin, path), 'utf8').replace(/\r\n/g, '\n');
const flat = (text) => text.replace(/\s+/g, ' ');

const run = read('skills/run/SKILL.md');
const plan = read('skills/plan-project/SKILL.md');
const contract = read('PROCESS.md');

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

const gate = () => under(run, 'The story gate');
const lastStory = () => from(gate(), '6. **Afterwards: the plan\'s last story.**', '**A red gate is not a task FAIL.**');
const withPlanBranch = () => from(lastStory(), '**With a plan branch**', '**With no plan branch**');
const merges = () => under(run, 'When the plan merges into `main`');

test('plan-project links the plan branch on the project when it cuts it, in each repository', () => {
  const step = from(flat(plan), '8. **The plan branch: cut it, and link it on the project when you cut it.**', '## 6.');
  assert.match(step, /In each repository the plan changes \(the `issue\.repository\.fullName` of its stories\)/);
  assert.match(step, /cut the plan branch .* and push it\. Then link it on the project/);
  assert.match(step, /<cli> --server <server> --as <alias>\/planner project link <KEY> <projectId> --branch <plan branch> --repository <owner\/repo>/);
  assert.match(step, /<cli> --server <server> --json project get <KEY> <projectId> # project\.links/);
  assert.match(step, /with `none` the stories branch from the integration branch and there is nothing to cut/);
  assert.match(flat(plan), /## Done when .*cut and linked on the project in each repository the plan changes/);
});

test('run links a plan branch it cuts itself', () => {
  const cut = from(flat(run), '**A plan branch that does not exist yet**', '`.worktrees/` must be ignored');
  assert.match(cut, /Link it on the project when you cut it/);
  assert.match(cut, /leeway --as <alias>\/agent project link <KEY> <project> --branch <plan branch> --repository <owner\/repo>/);
});

test('run opens the draft pull request to main at the last story and links it when it opens it', () => {
  const step = withPlanBranch();
  assert.match(step, /\*\*Open the draft pull request to `main`\*\*.*link it on the project when you open it/);
  assert.match(step, /gh pr create --draft --base <integration branch> --head <plan branch>/);
  assert.match(step, /leeway --as <alias>\/agent project link <KEY> <project> --branch <plan branch> --repository <owner\/repo> --number <PR>/);
  assert.match(step, /leeway --json project get <KEY> <project> # project\.links: .*pr\.state open/);
  assert.match(step, /Where it is not, the person opens it: raise an escalation .*wait \("Wait, then carry on"\)/);
});

test('at the last story the Plan record waits in review, never done', () => {
  const step = withPlanBranch();
  assert.match(lastStory(), /the plan is \*\*not done\*\*: a plan is done once it has merged into `main`/);
  assert.match(step, /\*\*Set the collector `--status in_review`, never `done`\.\*\*/);
  assert.doesNotMatch(step, /--status done/, 'the last story closes the Plan record at a merge into the plan branch');
  assert.doesNotMatch(step, /gh pr merge/, 'the last story merges the plan into main');
});

test('the ending says the project reads "in review" and names the pull request', () => {
  assert.match(withPlanBranch(), /\*\*End by saying\*\* that the project reads "in review" and naming each pull request \(its number and URL\) that waits on the person's test/);
  assert.match(withPlanBranch(), /Where they test it is theirs to choose/);
  assert.match(under(run, 'The end'), /say that the project reads "in review" and name the pull request/);
  assert.match(under(run, 'Run a project'), /When an issue's story gate ended the plan \(its step 6\), say last that the project reads "in review" and name the pull request/);
});

test('the plan merges into main only on the person\'s word, and closes only once it reads merged', () => {
  const section = merges();
  assert.match(section, /\*\*The plan merges into `main` on the person's word; no run merges it by itself\.\*\*/);
  assert.match(section, /A green gate, a passing CI or an approved review is not that word/);
  const merged = section.indexOf("`pr.state` must read `merged`");
  const done = section.indexOf('issue update <collector> --status done');
  assert.ok(merged >= 0 && done > merged, 'the Plan record closes before the pull request reads merged');
  assert.match(section, /if it already reads `done`, leave it/);
});

test('nothing outside that section merges the plan\'s pull request', () => {
  const rest = flat(run).replace(merges(), '');
  assert.doesNotMatch(rest, /gh pr merge/);
});

test('the Plan record is set done only where the plan has merged into main', () => {
  const allowed = [merges(), from(lastStory(), '**With no plan branch**')];
  const closes = run
    .split('\n')
    .filter((line) => line.includes('--status done') && !/<(ref|story)> --status done/.test(line))
    .map((line) => flat(line).trim());
  assert.equal(closes.length, 2);
  for (const line of closes) {
    assert.ok(allowed.some((text) => text.includes(line)), `the Plan record closes outside a merge into main: ${line}`);
  }
});

test('PROCESS.md says a plan is done once it has merged into main', () => {
  const done = under(contract, 'Definition of done');
  assert.match(done, /A plan is done once it has merged into `main`, on the person's word/);
  assert.match(done, /the Plan record goes `in_review`, .* `done` only once that pull request reads `merged`/);
});
