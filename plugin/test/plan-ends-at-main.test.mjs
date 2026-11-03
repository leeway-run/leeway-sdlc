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

const lastStory = () => from(under(run, 'The story gate'), '6. **Afterwards: the plan\'s last story.**', '**A red gate is not a task FAIL.**');
const planEnd = () => under(run, 'The plan\'s end');
const withPlanBranch = () => from(planEnd(), '**With a plan branch**', '**With no plan branch**');
const noPlanBranch = () => from(planEnd(), '**With no plan branch**');
const nothingLeft = () => from(under(run, 'Run a project'), '**Nothing left**', '3. **Run the next issue**');
const merges = () => under(run, 'When the plan merges into `main`');

// Wording that closes the Plan record or merges the plan, which only "When the plan merges into `main`" may hold.
const CLOSES = /--status done|to `?done`?|Plan record[^.]*\bdone\b/i;
const MERGES = /gh pr merge|\bmerge (the|its|each|that|this)\b[^.]*pull request/i;
// The same, where no story branch is merged either.
const MERGES_HERE = /gh pr merge|\bmerge (the|its|each|that|this|it)\b/i;

test('plan-project links the plan branch on the project when it cuts it, in each repository', () => {
  const step = from(flat(plan), '8. **The plan branch: cut it, and link it on the project when you cut it.**', '## 6.');
  assert.match(step, /In each repository the plan changes \(the `issue\.repository\.fullName` of its stories\)/);
  assert.match(step, /cut the plan branch .* and push it\. Then link it on the project/);
  assert.match(step, /<cli> --server <server> --as <alias>\/planner project link <KEY> <projectId> --branch <plan branch> --repository <owner\/repo>/);
  assert.match(step, /<cli> --server <server> --json project get <KEY> <projectId> # project\.links/);
  assert.match(step, /with `none` the stories branch from the integration branch and there is nothing to cut/);
  assert.match(flat(plan), /## Done when .*cut and linked on the project in each repository the plan changes/);
});

test('a repository linked with another branch is left as it is, not relinked without its pull request', () => {
  const step = from(flat(plan), '8. **The plan branch: cut it, and link it on the project when you cut it.**', '## 6.');
  assert.match(step, /A repository linked with another branch .* is left as it is too, because linking it again would drop its pull request: name it in the ending/);
  const cut = from(flat(run), '**A plan branch that does not exist yet**', '`.worktrees/` must be ignored');
  assert.match(cut, /leaving a repository linked with another branch as it is \(name it in the ending\)/);
});

test('run links a plan branch it cuts itself, and reads it back', () => {
  const cut = from(flat(run), '**A plan branch that does not exist yet**', '`.worktrees/` must be ignored');
  assert.match(cut, /Link it on the project when you cut it/);
  assert.match(cut, /leeway --as <alias>\/agent project link <KEY> <project> --branch <plan branch> --repository <owner\/repo>/);
  assert.match(cut, /leeway --json project get <KEY> <project> # project\.links/);
});

test('the last story hands over to the plan\'s end, and neither closes nor merges anything itself', () => {
  const step = lastStory();
  assert.match(step, /the plan is \*\*not done\*\*: a plan is done once it has merged into `main`/);
  assert.match(step, /Go on with "The plan's end", in the same session/);
  assert.doesNotMatch(step, CLOSES, 'the last story closes the Plan record');
  assert.doesNotMatch(step, MERGES_HERE, 'the last story merges the plan');
});

test('the plan\'s end opens the draft pull request to main and links it when it opens it', () => {
  const step = withPlanBranch();
  assert.match(step, /\*\*Open the draft pull request to `main`\*\*.*link it on the project when you open it/);
  assert.match(step, /gh pr create --draft --base <integration branch> --head <plan branch>/);
  assert.match(step, /leeway --as <alias>\/agent project link <KEY> <project> --branch <plan branch> --repository <owner\/repo> --number <PR>/);
  assert.match(step, /leeway --json project get <KEY> <project> # project\.links: .*pr\.state open/);
  assert.match(step, /Where it is not, the person opens it: raise an escalation .*wait \("Wait, then carry on"\)/);
});

test('with a plan branch the Plan record waits in review, never done, and nothing merges', () => {
  const step = withPlanBranch();
  assert.match(step, /\*\*Set the collector `--status in_review`, never `done`\*\*/);
  const rest = step
    .replace('never `done`', '')
    .replace('and `done` would read the plan as finished', '')
    .replace(/"When the plan merges into `main`"/g, '')
    .replace('Nothing merges it into `main` until they say so', '');
  assert.doesNotMatch(rest, /\bdone\b/i, 'the Plan record closes at a merge into the plan branch');
  assert.doesNotMatch(rest, MERGES_HERE, 'the plan\'s end merges the plan into main');
  assert.doesNotMatch(rest, /\bmerges?\b/i, 'the plan\'s end merges the plan into main');
});

test('the Plan record reads in review before any wait for the pull request', () => {
  const step = withPlanBranch();
  const review = step.indexOf('`--status in_review`');
  const ask = step.indexOf('raise an escalation');
  assert.ok(review >= 0 && ask > review, 'a wait that times out leaves the Plan record in backlog');
  assert.match(step, /It goes first, so a wait below that ends without an answer leaves the project reading "in review"/);
});

test('a plan\'s end left half done is picked up again by run on the project', () => {
  assert.match(planEnd(), /Reached from the story gate's step 6, and from a project run that finds nothing left while the Plan record is not `done`/);
  assert.match(planEnd(), /re-invoking `run` \*\*on the project\*\* is the way back/);
  assert.match(planEnd(), /running it again writes only what is missing/);
  assert.match(nothingLeft(), /If the Plan record is not `done`, run "The plan's end"/);
  const left = nothingLeft()
    .replace('If the Plan record is not `done`', '')
    .replace('a last story moved to `done` outside the gate', '')
    .replace('moves nothing to `done` that has not merged into `main`', '');
  assert.doesNotMatch(left, CLOSES, '"Nothing left" closes the Plan record');
  assert.doesNotMatch(nothingLeft(), MERGES_HERE, '"Nothing left" merges the plan');
  assert.match(under(run, 'Wait, then carry on'), /re-invoking `run` resumes \(for a wait in "The plan's end", `run` on the project\)/);
});

test('with no plan branch the Plan record closes only once every story reads merged into main', () => {
  const step = noPlanBranch();
  assert.match(step, /\*\*read back that every story of the project is in `main`\*\* before anything closes/);
  assert.match(step, /gh pr view <story branch> --json number,state,url/);
  assert.match(step, /git merge-base --is-ancestor <story head> origin\/<integration branch>` exits 0/);
  const merged = step.indexOf('**Every story reads merged:**');
  const done = step.indexOf('`--status done`');
  const notMerged = step.indexOf('**Any story does not:** set the collector `--status in_review`');
  assert.ok(merged >= 0 && done > merged && notMerged > done, 'the Plan record closes before the read-back');
  assert.doesNotMatch(from(step, '**Any story does not:**'), CLOSES, 'a story not in main closes the Plan record');
});

test('the ending says the project reads "in review" and names the pull request', () => {
  assert.match(withPlanBranch(), /\*\*End by saying\*\* that the project reads "in review" and naming each pull request \(its number and URL\) that waits on the person's test/);
  assert.match(withPlanBranch(), /Where they test it is theirs to choose/);
  assert.match(under(run, 'The end'), /say that the project reads "in review" and name the pull request/);
  assert.match(under(run, 'Run a project'), /ran "The plan's end", say last that the project reads "in review" and name the pull request/);
});

test('the plan merges into main only on the person\'s word, and closes only once it reads merged', () => {
  const section = merges();
  assert.match(section, /\*\*The plan merges into `main` on the person's word; no run merges it by itself\.\*\*/);
  assert.match(section, /A green gate, a passing CI or an approved review is not that word/);
  assert.match(section, /Once the person says merge, in the session: 1\. \*\*Merge the pull request\*\*/);
  assert.match(section, /Every link's `pr\.state` must read `merged`\. A link with no pull request, or one that reads `open` or `closed`, has not merged into `main`: say so, and leave the Plan record as it is\./);
  assert.match(section, /3\. \*\*Only then close the Plan record:\*\*/);
  const merged = section.indexOf("`pr.state` must read `merged`");
  const done = section.indexOf('issue update <collector> --status done');
  assert.ok(merged >= 0 && done > merged, 'the Plan record closes before the pull request reads merged');
  assert.doesNotMatch(section, /without waiting|once CI is green|\banyway\b/i);
  assert.match(section, /if it already reads `done`, leave it/);
});

test('nothing outside that section merges the plan\'s pull request', () => {
  const rest = flat(run).replace(merges(), '');
  assert.doesNotMatch(rest, MERGES);
});

test('the Plan record is set done only where the plan has merged into main', () => {
  const allowed = [merges(), from(noPlanBranch(), '**Every story reads merged:**', '**Any story does not:**')];
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
  assert.match(done, /With no plan branch, .* the Plan record goes `done` only once every story reads merged into `main`/);
});
