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
const RECORD = '(Plan record|collector|plan|project)';
const CLOSE = '(clos(e|es|ed|ing)|finish(es|ed|ing)?|complet(e|es|ed|ing)|resolv(e|es|ed|ing)|wrap(s|ped|ping)? up|end(s|ed|ing)?)';
const CLOSES = new RegExp([
  '--status[ =]*`?done',
  '\\bto `?done`?',
  '\\bas `?done`?',
  `\\b(Plan record|collector)\\b[^.]*\\b(done|closed|finished|complete|completed|resolved)\\b`,
  `\\b(done|closed|finished|complete|completed|resolved)\\b[^.]*\\b(Plan record|collector)\\b`,
  `\\b${CLOSE} (it|them|the ${RECORD})\\b`,
  `\\b(mark|set|move|put|flag|update)(s|ed|ting|ing)? (it|them|the ${RECORD})( as| to)? \`?(done|closed|finished|complete|completed|resolved)\\b`,
  `\\b${RECORD}\\b[^.]*\\b(is|are|goes|go|reads?|becomes?|gets?|was|marked|set|moved?)( to| as)? \`?(done|closed|finished|complete|completed|resolved)\\b`,
].join('|'), 'i');
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
  assert.match(cut, /leeway project link <KEY> <project> --as <alias>\/agent --branch <plan branch> --repository <owner\/repo>/);
  assert.match(cut, /leeway project get <KEY> <project> --json # project\.links/);
});

test('the last story hands over to the plan\'s end, and neither closes nor merges anything itself', () => {
  const step = lastStory();
  assert.match(step, /the plan is \*\*not done\*\*: a plan is done once it has merged into `main`/);
  assert.match(step, /Go on with "The plan's end", in the same session/);
  const rest = step
    .replace('everything else `done` or `cancelled`, the collector aside', '')
    .replace('the plan is **not done**: a plan is done once it has merged into `main`', '');
  assert.doesNotMatch(rest, CLOSES, 'the last story closes the Plan record');
  assert.doesNotMatch(step, MERGES_HERE, 'the last story merges the plan');
});

test('the plan\'s end opens the draft pull request to main and links it when it opens it', () => {
  const step = withPlanBranch();
  assert.match(step, /\*\*Open the draft pull request to `main`\*\*.*link it on the project when you open it/);
  assert.match(step, /gh pr create --draft --base <integration branch> --head <plan branch> --title "<project name>" --body-file <body\.md>/);
  assert.match(step, /Where `gh` is not installed, or `gh pr create` fails, the person opens it/);
  assert.match(step, /leeway project link <KEY> <project> --as <alias>\/agent --branch <plan branch> --repository <owner\/repo> --number <PR>/);
  assert.match(step, /leeway project get <KEY> <project> --json # project\.links: .*pr\.state open/);
  assert.match(step, /Only with neither, raise an escalation on the nit collector .*wait \("Wait, then carry on"\)/);
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
  assert.doesNotMatch(rest, CLOSES, 'the Plan record closes at a merge into the plan branch');
  assert.doesNotMatch(rest, MERGES_HERE, 'the plan\'s end merges the plan into main');
  assert.doesNotMatch(rest, /\bmerges?\b/i, 'the plan\'s end merges the plan into main');
});

test('a plan\'s end run twice with a plan branch writes neither the status nor the status update twice', () => {
  const step = withPlanBranch();
  assert.match(step, /1\. \*\*Set the collector `--status in_review`, never `done`\*\*, unless it reads `in_review` already\. /);
  assert.match(step, /3\. \*\*Post the plan's status update\*\* as a comment on the nit collector \(`comment add <collector> --stdin body`\), naming each pull request that waits for the person's test, unless the collector's latest comment is already one naming the same pull requests\. 4\. /);
});

test('the Plan record reads in review before any wait for the pull request', () => {
  const step = withPlanBranch();
  const review = step.indexOf('`--status in_review`');
  const ask = step.indexOf('raise an escalation');
  assert.ok(review >= 0 && ask > review, 'a wait that times out leaves the Plan record in backlog');
  assert.match(step, /It goes first, so a wait below that ends without an answer leaves the Plan record reading `in_review`\./);
});

test('the ask for the pull request reads the collector\'s escalations before it raises one', () => {
  const step = withPlanBranch();
  const read = step.indexOf("Read the collector's escalations first (`leeway issue get <collector> --json`, `escalations[]`)");
  const raise = step.indexOf('Only with neither, raise an escalation');
  assert.ok(read >= 0 && raise > read, 'a re-invoke raises the ask a second time');
  assert.match(step, /wait on an open one that asks for it, and take the number from an answered one's note/);
});

test('a plan\'s end left half done is picked up again by run on the project', () => {
  assert.match(planEnd(), /Reached from the story gate's step 6, and from a project run that finds nothing left while the Plan record is not `done`/);
  assert.match(planEnd(), /re-invoking `run` \*\*on the project\*\* is the way back/);
  assert.match(planEnd(), /running it again writes only what is missing/);
  assert.equal(
    nothingLeft(),
    "**Nothing left** (every issue `done` or `cancelled`, the Plan record aside): say so. If the Plan record is not `done`, run \"The plan's end\", which writes only what is missing: it picks up a plan's end that a wait, a lost session or a last story moved to `done` outside the gate left half done, and moves nothing to `done` that has not merged into `main`. Then stop, and end as \"The plan's end\" ends: \"in review\" and its pull request (`project.links`) while the Plan record reads `in_review`, or the plan merged into `main` once it reads `done`; once the person says merge, \"When the plan merges into `main`\" goes on from there. ",
    '"Nothing left" carries a condition, a close or a merge',
  );
  const left = nothingLeft()
    .replace('If the Plan record is not `done`', '')
    .replace('a last story moved to `done` outside the gate', '')
    .replace('moves nothing to `done` that has not merged into `main`', '')
    .replace('(every issue `done` or `cancelled`, the Plan record aside)', '')
    .replace('while the Plan record reads `in_review`, or the plan merged into `main` once it reads `done`', '');
  assert.doesNotMatch(left, CLOSES, '"Nothing left" closes the Plan record');
  assert.doesNotMatch(nothingLeft(), MERGES_HERE, '"Nothing left" merges the plan');
  assert.match(under(run, 'Wait, then carry on'), /re-invoking `run` resumes \(for a wait in "The plan's end", `run` on the project\)/);
});

test('with no plan branch the Plan record closes only once every story reads merged into main', () => {
  const step = noPlanBranch();
  assert.equal(
    from(step, 'So **read back', '- **Every story reads merged:**'),
    "So **read back that every `done` story of the project is in `main`** before anything closes (a cancelled one has nothing to merge): its pull request reads `MERGED` (`gh pr view <story branch> --json number,state,url`), or, with no pull request or no `gh`, its branch head is in the fetched integration branch (`git -C <story worktree> merge-base --is-ancestor <story head> origin/<integration branch>` exits 0). ",
    'the read-back carries another way to read merged',
  );
  assert.match(merges(), /With no plan branch, the read-back is "The plan's end"'s, for every `done` story/);
  assert.match(step, /gh pr view <story branch> --json number,state,url/);
  assert.match(step, /git -C <story worktree> merge-base --is-ancestor <story head> origin\/<integration branch>` exits 0/);
  const merged = step.indexOf('**Every story reads merged:**');
  const done = step.indexOf('`--status done`');
  const notMerged = step.indexOf('**Any story does not:** set the collector `--status in_review` unless it reads `in_review` already');
  assert.ok(merged >= 0 && done > merged && notMerged > done, 'the Plan record closes before the read-back');
  assert.doesNotMatch(from(step, '**Any story does not:**'), CLOSES, 'a story not in main closes the Plan record');
  assert.doesNotMatch(from(step, '**Any story does not:**'), MERGES_HERE, 'a story not in main is merged');
  assert.match(step, /post the status update naming each story's pull request \(or branch\) not yet in `main` unless the collector's latest comment is already one naming the same ones/);
});

test('each ending says what the Plan record reads: in review and the pull request, or merged into main', () => {
  assert.match(withPlanBranch(), /\*\*End by saying\*\* that the project reads "in review" and naming each pull request \(its number and URL\) that waits on the person's test, where it is linked and open \(a pull request that had already merged ends as "When the plan merges into `main`" does\)\. Otherwise name the pull request that is not linked \(a refused link\), or say none is open yet, and say the project reads "in review" only once one is linked and open\./);
  assert.match(withPlanBranch(), /Where they test it is theirs to choose/);
  assert.match(from(noPlanBranch(), '**Every story reads merged:**', '**Any story does not:**'), /End by saying that the plan has merged into `main` and the Plan record reads `done`/);
  assert.match(from(noPlanBranch(), '**Any story does not:**'), /end by saying that the Plan record reads `in_review` and naming each of them \(number and URL, or branch\) as waiting on the person/);
  assert.match(from(merges(), '3. **Only then close the Plan record:**'), /End by saying that the plan has merged into `main` and the Plan record reads `done`/);
  assert.match(under(run, 'The end'), /say what "The plan's end" left the Plan record reading, as its ending does: "in review" and the pull request that waits on the person's test, or the plan merged into `main` once it reads `done`/);
  assert.match(nothingLeft(), /end as "The plan's end" ends: "in review" and its pull request \(`project\.links`\) while the Plan record reads `in_review`, or the plan merged into `main` once it reads `done`/);
  assert.match(under(run, 'Run a project'), /ran "The plan's end", say last what it left the Plan record reading, as its ending does/);
  const doneWhen = under(run, 'Done when');
  assert.match(doneWhen, /once every `done` story reads merged into `main`, and the ending then says the plan has merged into `main`/);
  assert.match(doneWhen, /With no plan branch, while a story does not, the ending says the Plan record reads `in_review` and names each story's pull request not yet in `main`/);
});

test('the project run\'s bounds carve out what "The plan\'s end" writes', () => {
  const bounds = from(under(run, 'Run a project'), '**Bounds.**');
  assert.match(bounds, /the project run writes nothing of its own to Leeway except what "The plan's end" writes when "Nothing left" runs it/);
  assert.doesNotMatch(bounds, /writes nothing of its own to Leeway:/);
});

test('the plan merges into main only on the person\'s word, and closes only once it reads merged', () => {
  const section = merges();
  assert.equal(
    from(section, '**The plan merges', '1. **Merge the pull request**'),
    "**The plan merges into `main` on the person's word; no run merges it by itself.** A green gate, a passing CI or an approved review is not that word, and neither is the end of a run. Once the person says merge, in the session: ",
    'the person\'s word carries a condition or an exception',
  );
  const steps = from(section, '1. **Merge the pull request**', '3. **Only then close the Plan record:**');
  assert.equal(
    steps,
    "1. **Merge the pull request** as the repo's convention says: `gh pr merge <PR>` where `gh` is installed, or the person merges it. With no plan branch, that is each story's pull request \"The plan's end\" named as not yet in `main`. Never push the integration branch yourself (the pre-push guard in \"Unattended prerequisites\"). 2. **Read it back:** `leeway project get <KEY> <project> --json`, which refreshes a stale open pull request's state. Every link's `pr.state` must read `merged`. A link with no pull request, or one that reads `open` or `closed`, has not merged into `main`: say so, and leave the Plan record as it is. With no plan branch, the read-back is \"The plan's end\"'s, for every `done` story, and the same holds for a story that does not read merged. ",
    'merge steps 1 and 2 carry a condition or an exception',
  );
  assert.doesNotMatch(steps.replace('leave the Plan record as it is', ''), CLOSES, 'the Plan record closes before the read-back');
  assert.match(section, /Every link's `pr\.state` must read `merged`\. A link with no pull request, or one that reads `open` or `closed`, has not merged into `main`: say so, and leave the Plan record as it is\./);
  assert.match(section, /3\. \*\*Only then close the Plan record:\*\*/);
  const merged = section.indexOf("`pr.state` must read `merged`");
  const done = section.indexOf('issue update <collector> --as <alias>/agent --status done');
  assert.ok(merged >= 0 && done > merged, 'the Plan record closes before the pull request reads merged');
  assert.doesNotMatch(
    from(section, '1. **Merge the pull request**'),
    /without (waiting|their word|the person|an answer)|once (CI|the gate|the checks?|tests?)|\b(CI|the gate|checks?) (is|are|goes|go|turns?) green|\banyway\b|\bunless\b|\botherwise\b|\bno (answer|reply|word)\b|(do|does|did)(n't| not) (answer|reply|respond|say)|\bsilen(t|ce)\b|\b(away|unavailable|unreachable)\b|\b(hours?|days?|minutes?|deadline)\b|times? out|timed out|\bauto-?merge\b|--auto\b|\bby default\b|\bassum(e|es|ed|ing)\b|\bon (its|your|their) own\b/i,
    'a merge without the person\'s word',
  );
  assert.match(section, /if it already reads `done`, leave it/);
});

// LWY-189.2 owns this text in sdlc-install, which LWY-189.1 does not change.
test('sdlc-install says git push waits for the pre-push guard and gh pr merge stays off the list, because the guard does not cover a merge through GitHub', () => {
  const install = flat(read('skills/sdlc-install/SKILL.md'));
  assert.match(install, /`git push` is not added until the pre-push guard run names exists, and `gh pr merge` stays off it always \(the pre-push guard does not cover a merge through GitHub\)\./);
});

// The paragraph on `gh pr merge` in "Unattended prerequisites": from its last mention before the pre-push guard bullet.
const mergeParagraph = () => {
  const prereqs = under(run, 'Unattended prerequisites');
  const guardAt = prereqs.indexOf('- **A pre-push guard');
  const at = prereqs.lastIndexOf('`gh pr merge`', guardAt);
  return at < 0 ? '' : prereqs.slice(at, guardAt);
};

// A mention counts unless a negator stands directly before it ("no permission prompt", "writes no allow rule"): a "not"
// elsewhere in the sentence excuses nothing.
const NEGATED_BEFORE = /\b(no|not|never|without|none)\s+((write|writes|add|adds|keep|keeps|name|names|needs?)\s+)?((an?|the|any)\s+)?(permission\s+)?$/i;
const mentions = (text, term) => {
  const one = flat(text);
  return [...one.matchAll(term)].filter((m) => !NEGATED_BEFORE.test(one.slice(0, m.index))).map((m) => m[0]);
};
const sentencesOf = (text) => flat(text).split(/(?<=[.!?;])\s+/);

// Replaces the test that pinned "stays off the allow-list" and "its prompt is where the person's yes is their word".
test('gh pr merge is held by the person\'s word, and no allow-list or permission prompt is tied to it', () => {
  assert.match(merges(), /the plan merges into `main` on the person's word/i);
  const para = mergeParagraph();
  assert.ok(para.length > 0, 'no paragraph on `gh pr merge` in "Unattended prerequisites"');
  assert.match(para, /person's word/);
  assert.deepEqual(mentions(para, /allow[- ]?list|allow[- ]rules?|permission rules?/gi), [], 'a list is tied to the merge');
  assert.deepEqual(mentions(para, /\bprompts?\b/gi), [], 'a permission prompt is tied to the merge');
  const tied = sentencesOf(run).filter((s) => /merg/i.test(s) && mentions(s, /\bprompts?\b/gi).length > 0);
  assert.deepEqual(tied, [], 'a sentence in run ties a merge to a prompt');
});

test('nothing outside that paragraph and "When the plan merges into `main`" merges the plan\'s pull request', () => {
  const rest = flat(run)
    .replace(merges(), '')
    .replace(mergeParagraph(), '');
  assert.doesNotMatch(rest, MERGES);
});

test('the Plan record is set done only where the plan has merged into main', () => {
  const allowed = [merges(), from(noPlanBranch(), '**Every story reads merged:**', '**Any story does not:**')];
  const closes = run
    .split('\n')
    .filter((line) => line.includes('--status done') && !/<(ref|story)>( --as \S+)? --status done/.test(line))
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
  assert.match(done, /With no plan branch, .* the Plan record goes `done` only once every `done` story reads merged into `main`/);
});
