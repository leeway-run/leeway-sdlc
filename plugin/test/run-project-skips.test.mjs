import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const skill = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'skills', 'run', 'SKILL.md'), 'utf8')
  .replace(/\r\n/g, '\n');

// A `## ` section of run/SKILL.md, joined onto one line.
function section(heading) {
  const start = skill.indexOf(`\n## ${heading}\n`);
  assert.ok(start >= 0, `run/SKILL.md has no "${heading}" section`);
  const end = skill.indexOf('\n## ', start + 1);
  return skill.slice(start, end < 0 ? undefined : end).replace(/\s+/g, ' ');
}

const project = section('Run a project');

// The numbered step of "Run a project" whose bold lead starts with `lead`.
function step(lead) {
  const found = project.split(/ (?=\d+\. \*\*)/).find((s) => new RegExp(`^\\d+\\. \\*\\*${lead}`).test(s));
  assert.ok(found, `"Run a project" has no step "${lead}"`);
  return found;
}

// The bullet of step 2 whose bold lead starts with `lead`.
function bullet(lead) {
  const found = step('Order them').split(/ - (?=\*\*)/).find((b) => b.startsWith(`**${lead}`));
  assert.ok(found, `step 2 of "Run a project" has no bullet "${lead}"`);
  return found;
}

test('a project run skips an issue its issue run refuses, says why, and goes on', () => {
  const skip = bullet('Skip an issue its issue run refuses');
  assert.match(skip, /a precondition of "Run an issue" refuses, which writes nothing/);
  assert.match(skip, /its type is not unattended, it is not planned, an earlier `# Run status` is unanswered/);
  assert.match(skip, /Say in the session which issue and which precondition, and take the next runnable issue\./);

  const stop = step('Stop at the first issue that stops');
  assert.doesNotMatch(stop, /a precondition it refuses \(that writes nothing\)/);
  assert.match(stop, /A precondition it refuses is not a stop: step 2 skips that issue and the run goes on\./);

  const bounds = project.slice(project.indexOf('**Bounds.**'));
  assert.doesNotMatch(bounds, /the project run stops there/);
  assert.match(bounds, /refused by its precondition 1, and the project run skips it and goes on\./);
  assert.match(bounds, /A skipped issue costs nothing/);
});

test("a refused issue's dependants are never run", () => {
  assert.match(bullet('Skip an issue its issue run refuses'),
    /the issues it blocks stay unrunnable, and are skipped as blocked\./);
  assert.match(bullet('Refuse an issue whose blockers are not done'), /skip it and take the next runnable one\./);
});

test("a project run still stops on an issue run's real stop", () => {
  const stop = step('Stop at the first issue that stops');
  assert.match(stop, /a hard stop or a stop of the sub-issue run/);
  assert.match(stop, /Start no further issue\./);
  assert.match(bullet('Skip an issue its issue run refuses'), /A failed Leeway call is not a refusal: it is stop 10\./);
});

test('a refused issue stays skipped for the rest of the run, past the re-read', () => {
  assert.match(bullet('Skip an issue its issue run refuses'), /It stays skipped for the rest of this run \(step 3\)\./);
  assert.match(step('Run the next issue'),
    /Leeway, not this session's memory, says what is left, except the issues this run has already skipped because their issue run refused them\. Those stay skipped for the rest of this run/);
  assert.match(bullet('Nothing runnable left'),
    /each is blocked, in a blocking cycle, waiting at a step after `build`, or already skipped in this run;/);
});

test('an issue waiting at a step after `build`, and the Plan record, leave nothing runnable', () => {
  const nothingRunnable = bullet('Nothing runnable left');
  assert.match(nothingRunnable, /issues remain and none is runnable: /);
  assert.match(nothingRunnable, /waiting at a step after `build`/);
  assert.match(nothingRunnable, /; the Plan record aside\)/);
  assert.match(bullet('Skip every issue `done` or `cancelled`'), /a step after `build`.*waits for a person: skip it too\./);
  assert.match(bullet('Nothing left'), /the Plan record aside/);
});

test('when nothing runnable is left, the run ends and reports what it ran and what it skipped', () => {
  assert.match(bullet('Nothing runnable left'),
    /the run ends there, and step 5 reports what it ran, what it skipped and why, naming the blockers\./);
  assert.doesNotMatch(bullet('Refuse an issue whose blockers are not done'), /none is runnable|stop and say so/);
  assert.doesNotMatch(bullet('Skip an issue its issue run refuses'), /When nothing runnable is left/);
  assert.match(step('Say so in the session'), /every issue it skipped and why \(the precondition that refused it/);
  const done = section('Done when');
  const onProject = done.slice(done.indexOf('**On a project:**'));
  assert.match(onProject, /skipped because its issue run refused it/);
  assert.match(onProject, /what it skipped and why/);
});
