// LWY-266.1 round 4: a continued block is never waited on, the reviewer's continued block ties to its own comment,
// and the order sentence is pinned. Text pins on plugin/skills/run/SKILL.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const plugin = process.env.PLUGIN_DIR || join(dirname(fileURLToPath(import.meta.url)), '..');
const run = readFileSync(join(plugin, 'skills/run/SKILL.md'), 'utf8').replace(/\r\n/g, '\n').replace(/\s+/g, ' ');

test('verdict step 3 waits on every stop only, and a continued block holds neither PASS nor FAIL handling', () => {
  assert.match(run, /wait on every stop at once \("Wait, then carry on"\), and do not go to PASS or FAIL handling until every stop is answered\. A continued block's escalation is not waited on and does not hold PASS or FAIL handling\./);
  assert.doesNotMatch(run, /wait on every one at once/);
});

test('"A BLOCKED brief" reads only each stop on resume', () => {
  assert.match(run, /read each stop the brief raised \(`escalations\[\]\.answer`\); a continued block's escalation is not read here and holds nothing\. A stop still open and no answer ended the work: wait on it, and start no round\./);
  assert.doesNotMatch(run, /read each escalation the brief raised/);
});

test('"Check the round", "Wait, then carry on" and "On a stop" step 7 leave a continued block out of the wait', () => {
  assert.match(run, /a continued block's escalation is raised without a wait and counts as none of "the round's escalations" below/);
  assert.match(run, /The exceptions are a continued block's escalation \("Stop, or decide and continue"\) and a debt proposal \("What a deferred finding becomes"\): each is raised and never waited on, and neither is an escalation of the round in the steps below\./);
  assert.match(run, /7\. \*\*Wait on each of the stop's escalations\*\* \("Wait, then carry on"\), all together; a continued block's escalation is not one of them\./);
});

test('a reviewer\'s continued block ties to its # Decided and continued comment, never the finding', () => {
  assert.match(run, /A continued block's `"comment"` is the `cN` of its `# Decided and continued` comment, never the finding's, which a stop on that finding may hold\./);
  assert.match(run, /A stop's `"comment": "cN"` ties it to the \*\*finding it concerns\*\*/);
});

test('the order sentence: the triage, then the stop list, then decide and continue', () => {
  assert.match(run, /send every block through this order: the triage, then the stop list, then decide and continue\./);
});

test('round 5: the cap and hard stop 1 name a continued block, and "then you wait" carries its exception', () => {
  assert.match(run, /A decided or continued block's extra round that would pass `roundCap` is not run/);
  assert.match(run, /\| 1 \| \*\*The round cap is hit\*\* on any task: the verdict is FAIL, or a PASS with a decided or continued block, or a `BLOCKED` brief whose `## Question` is decided or continued,/);
  assert.match(run, /then you wait for its answer \("Wait, then carry on"\), a continued block's escalation excepted \("Stop, or decide and continue"\)\. Nowhere in this skill do you ask the user\./);
  assert.match(run, /A raised stop waits as before, and the decisions go into the next round's prompt/);
});
