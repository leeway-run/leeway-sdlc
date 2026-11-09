import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// LWY-189.3, TC-5: sync-repo offers to remove the rules a 0.3.0 install wrote, and exactly those.
// The rules are read from test/fixtures/0.3.0-allow-list.md, a verbatim excerpt of v0.3.0, because CI's checkout
// is shallow and has no tags. Where the tag exists, a test checks the excerpt against it.

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (path) => readFileSync(join(root, path), 'utf8').replace(/\r\n/g, '\n');
const flat = (text) => text.replace(/\s+/g, ' ');
const spans = (text) => [...text.matchAll(/`([^`]+)`/g)].map((m) => m[1]);

const fixture = read('plugin/test/fixtures/0.3.0-allow-list.md');
const skill = read('plugin/skills/sync-repo/SKILL.md');

const between = (text, from, to) => {
  const start = text.indexOf(from);
  const end = to === null ? text.length : text.indexOf(to, start);
  assert.ok(start !== -1 && end !== -1, `the excerpt has no "${from}" ... "${to}"`);
  return flat(text.slice(start, end));
};

// 0.3.0's rule forms, read from the table: one per verb for the two verb rows, every span of the others.
// <cli>, <server> and <command> stay as the table prints them, and a form is matched as that literal text.
function forms() {
  const rows = fixture.split('\n').filter((l) => /^\| /.test(l)).slice(1).map((l) => l.split('|')[2]);
  assert.ok(rows.length >= 8, 'no table in the excerpt');
  const leeway = spans(between(fixture, '**Leeway verbs:**', 'Any other verb prompts'));
  const git = spans(between(fixture, 'at least one argument:', null));
  const out = [];
  for (const cell of rows) {
    const all = spans(cell);
    const template = all.find((s) => s.includes('<verb>'));
    if (!template) out.push(...all.filter((s) => /^(Bash|Edit|Read)\(/.test(s)));
    else if (template.includes('<cli>')) out.push(...leeway.map((v) => template.replace('<verb>', v)));
    else out.push(...git.map((v) => template.replace('<verb>', v)));
  }
  return out;
}
const FORMS = forms();

// The text from the new copy's row through the end of step 3, where its list, diff, question and Kept row are.
const NAME = "run's 0.3.0 allow-list";
const block = () => {
  const start = skill.indexOf(NAME);
  assert.ok(start !== -1, `sync-repo names no "${NAME}"`);
  return flat(skill.slice(start, skill.indexOf('\n## 4.', start)));
};
const hit = (re, why) => assert.match(block(), re, why);

const tagExists = (() => {
  try {
    execFileSync('git', ['-C', root, 'rev-parse', '--verify', '-q', 'v0.3.0^{commit}'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

test('the excerpt of 0.3.0 holds the thirty-eight forms the story names', () => {
  assert.equal(FORMS.length, 38, FORMS.join('\n'));
  assert.equal(FORMS.filter((f) => f.startsWith('Bash(<cli> --server <server> ')).length, 14);
  assert.equal(FORMS.filter((f) => f.startsWith('Bash(git -C * ')).length, 15);
  for (const f of ['Bash(<command> *)', 'Bash(node -e *)', 'Bash(gh pr create *)', 'Bash(gh pr view *)', 'Edit(/.worktrees/**)', 'Read(~/.claude/plugins/cache/*/leeway-sdlc/**)', 'Bash(git -C * branch -d *)']) {
    assert.ok(FORMS.includes(f), `no ${f}`);
  }
});

test('the excerpt is what the v0.3.0 tag holds, where the tag is in the clone', { skip: !tagExists && 'no v0.3.0 tag in this clone (a shallow CI checkout)' }, () => {
  const tag = (path) => execFileSync('git', ['-C', root, 'show', `v0.3.0:${path}`], { encoding: 'utf8' }).replace(/\r\n/g, '\n').split('\n');
  const harness = tag('plugin/HARNESS.md');
  const run = tag('plugin/skills/run/SKILL.md');
  assert.ok(fixture.includes(harness.slice(86, 100).join('\n')), 'the table is not the tag\'s');
  assert.ok(fixture.includes(run.slice(1187, 1195).join('\n')), 'the verbs are not the tag\'s');
});

test('step 2 lists "run\'s 0.3.0 allow-list" as a copy, with its two settings files', () => {
  const step2 = skill.slice(skill.indexOf('## 2. Compare each copy'), skill.indexOf('## 3. Ask'));
  const row = step2.split('\n').find((l) => l.startsWith(`| ${NAME} |`));
  assert.ok(row, `no table row starting "| ${NAME} |" in step 2`);
  assert.equal(row.split('|').length, 5, 'the row has the table\'s three cells');
  for (const place of ['.claude/settings.json', '.claude/settings.local.json', 'permissions.allow']) assert.ok(row.includes(place), `the row does not name ${place}`);
  assert.ok(/`cli:`/.test(row) && /`server:`/.test(row), 'the row does not say the rules are filled with the repo\'s `cli:` and `server:`');
});

test('every form of 0.3.0\'s table is in sync-repo\'s list', () => {
  const list = block();
  const missing = FORMS.filter((f) => !list.includes(`\`${f}\``));
  assert.deepEqual(missing, [], 'in 0.3.0\'s table and missing from sync-repo\'s list');
});

test('the list holds no rule that is not one of 0.3.0\'s forms, unless to say it is left alone', () => {
  const list = block();
  const named = (s) => /^(Bash|Edit|Read)\b/.test(s);
  const stray = spans(list).filter((s) => named(s) && !FORMS.includes(s));
  const unsafe = stray.filter((s) => {
    const sentence = flat(list).split(/(?<=[.!?])\s+/).find((x) => x.includes(`\`${s}\``)) ?? '';
    return !/\b(never|not|leave|left|keep|kept|untouched)\b/i.test(sentence);
  });
  assert.deepEqual(unsafe, [], 'offered for removal though not in 0.3.0\'s table');
  assert.ok(FORMS.length > 0 && list.includes('`Bash(git -C * add *)`'), 'the list names the git rules one by one');
  const loose = list.match(/\b(any|every|all)\b[^.]{0,40}\bBash\(git\b(?! -C \* )/gi) ?? [];
  assert.deepEqual(loose, [], 'a generic "any Bash(git" rule');
});

test('a yes removes only the 0.3.0 entries and leaves the file\'s other keys and entries as they were', () => {
  hit(/one diff[^.]*\bone question[^.]*\bpre-filled yes\b/i, 'one diff, one question, pre-filled yes');
  hit(/\b(a|on a|on) yes removes only those entries\b/i, 'a yes removes only those entries');
  hit(/\b(other keys|`hooks`).{0,150}?\b(as they were|untouched|byte-identical)\b/i, 'the other keys are left as they were');
  hit(/`hooks`/, 'the keys left alone are named: hooks');
  hit(/`enabledPlugins`/, 'the keys left alone are named: enabledPlugins');
  hit(/`permissions\.deny`/, 'the keys left alone are named: permissions.deny');
});

test('a repo with none of the rules is asked nothing', () => {
  hit(/\b(none|no such entries|no entries)\b[^.]*\b(nothing is asked|ask nothing|is not asked|no question)\b/i, 'with none there, nothing is asked');
});

test('a no is recorded as a Kept row with its reason, and carries "-" for the hash', () => {
  hit(/\ba no\b[^.]*`Kept` row[^.]*\breason\b/i, 'a no is a Kept row with its reason');
  const kept = flat(skill.slice(skill.indexOf('**The Kept hash**'), skill.indexOf('The diff alone does not tell you')));
  assert.match(kept, /allow-list[^.]*`-`/, 'The Kept hash paragraph does not say this copy carries "-", having no plugin file');
});

test('the lane rules are listed but are the person\'s call, and nothing else in the file is read as run\'s', () => {
  hit(/`Bash\(<command> \*\)`[^.]*\.sdlc\/CONFIG\.md/, 'the lane rule is tied to a lane named in .sdlc/CONFIG.md');
  hit(/\bperson's call\b/i, 'the lane rules are the person\'s call');
  hit(/\bmay be the repo's own\b/i, 'they may be the repo\'s own');
  hit(/\bnothing else\b[^.]*\bread as run's\b/i, 'nothing else in the settings file is read as run\'s');
});

test('the 0.3.0 upgrade paragraph is gone, and no live text points at question 16 for the old entries', () => {
  const text = flat(skill);
  assert.ok(!text.includes('An upgrade to 0.3.0 from an install whose allow-list predates it'), 'the paragraph is still there');
  assert.ok(!text.includes('whose question 16 adds the new ones'), 'the pointer at question 16 is still there');
  assert.ok(!text.includes('"An existing allow-list"'), 'the pointer at detection.md is still there');
});
