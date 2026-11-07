import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const plugin = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(plugin, path), 'utf8').replace(/\r\n/g, '\n');
const oneLine = (text) => text.replace(/\s+/g, ' ');
const install = oneLine(read('skills/sdlc-install/SKILL.md'));
const tune = oneLine(read('skills/sdlc-tune/SKILL.md'));
const sync = oneLine(read('skills/sync-repo/SKILL.md'));
const update = oneLine(read('skills/update/SKILL.md'));

const build = { id: 'build', kind: 'build', status: 'in_progress', params: { redTests: true, round0Cap: 3, roundCap: 5, review: 'adversarial', blockingRungs: ['R4', 'R5'], unattended: true } };
const verify = { id: 'verify-on-dev', kind: 'manual', label: 'verify on dev', status: 'in_review' };
// The `maintained` feature as LWY-125 stores it.
const NEW = [
  { id: 'shape', kind: 'shape', label: 'shaping', status: 'backlog' },
  { id: 'shaped', kind: 'gate', label: 'shaped', status: 'backlog' },
  { id: 'plan', kind: 'plan', label: 'planning', status: 'backlog', params: { designDoc: true } },
  { id: 'gate', kind: 'gate', label: 'planned', status: 'backlog' },
  { ...build, label: 'building' },
  verify,
];
const OLD = [
  { id: 'shape', kind: 'shape', label: 'shape', status: 'backlog' },
  { id: 'plan', kind: 'plan', label: 'plan', status: 'backlog', params: { designDoc: true } },
  { id: 'gate', kind: 'gate', label: 'gate', status: 'backlog' },
  { ...build, label: 'build' },
  verify,
];
const relabel = (steps, labels) => steps.map((s) => (s.id in labels ? { ...s, label: labels[s.id] } : s));
const LABELS_ONLY = relabel(NEW, { shape: 'shape', plan: 'plan', gate: 'gate', build: 'build' });
const MVP = [{ id: 'plan', kind: 'plan', label: 'plan', status: 'backlog', params: { designDoc: false } }, { ...build, label: 'build' }];

const paragraph = (text, start) => {
  const at = text.indexOf(start);
  assert.ok(at >= 0, `no ${JSON.stringify(start)}`);
  return text.slice(at, text.indexOf(' - **', at + start.length) >>> 0);
};
const oldFlowRule = paragraph(tune, '**The old flow.**');
const newFlowEdit = paragraph(tune, '- **The new flow**');

// sdlc-tune's condition, as its "The old flow" paragraph states it.
const onOldFlow = (steps) => {
  const shape = steps.findIndex((s) => s.kind === 'shape');
  const plan = steps.findIndex((s) => s.kind === 'plan');
  return shape >= 0 && !steps.slice(shape + 1, plan < 0 ? undefined : plan).some((s) => s.kind === 'gate');
};

// sdlc-tune's edit, read from its "The new flow" line.
function toNewFlow(steps) {
  const inserted = JSON.parse(/`(\{"id": "shaped"[^`]*\})`/.exec(newFlowEdit)[1]);
  const [shaping, planning, planned, building] = [...newFlowEdit.matchAll(/"([a-z]+)"/g)].map((m) => m[1]).slice(-4);
  const shape = steps.findIndex((s) => s.kind === 'shape');
  const out = [...steps.slice(0, shape + 1), { ...inserted, status: steps[shape].status }, ...steps.slice(shape + 1)];
  const plan = out.findIndex((s) => s.kind === 'plan');
  const gate = out.findIndex((s, i) => i > plan && s.kind === 'gate');
  return out.map((s, i) => {
    if (s.kind === 'shape') return { ...s, label: shaping };
    if (i === plan) return { ...s, label: planning };
    if (plan >= 0 && i === gate) return { ...s, label: planned };
    if (s.kind === 'build') return { ...s, label: building };
    return s;
  });
}

// sdlc-tune's Step 2 rules on a type's steps, read from its text: the kind counts and the step bound.
const kindRule = /each non-`manual` kind at most once per type, except `([a-z]+)`, at most twice/.exec(tune);
const stepBound = Number(/\*\*(\d+) steps per type\*\*/.exec(tune)?.[1]);
const breaksRule = (steps) => {
  const count = (kind) => steps.filter((s) => s.kind === kind).length;
  if (new Set(steps.map((s) => s.id)).size !== steps.length) return 'step ids unique per type';
  if (['shape', 'plan', 'gate', 'build'].some((kind) => count(kind) > (kind === kindRule?.[1] ? 2 : 1))) return 'kind count';
  if (steps.length > stepBound) return 'steps per type';
  return null;
};
const offered = (steps) => onOldFlow(steps) && breaksRule(toNewFlow(steps)) === null;

test('sdlc-tune states the old-flow condition the server presets are told apart by', () => {
  assert.match(oldFlowRule, /has a `shape` step and no shaped step, "the type's first `gate` step after `shape` with no `plan` step between them" \(`PROCESS\.md`, "Before the plan: shaping"\)/);
  assert.match(oldFlowRule, /no `gate` after `shape` before its `plan` step, or after `shape` at all when it has no `plan`/);
  assert.match(oldFlowRule, /no `shape` step[^.]*is not on the old flow/);
  assert.match(oldFlowRule, /differs from the new flow only in its labels; neither is offered it/);
  assert.equal(onOldFlow(OLD), true);
  for (const [name, steps] of [['new', NEW], ['labels only', LABELS_ONLY], ['mvp', MVP]]) assert.equal(onOldFlow(steps), false, name);
});

test('the new flow, applied to the old one, is the maintained feature, and is not offered again', () => {
  assert.deepEqual(toNewFlow(OLD), NEW);
  assert.equal(onOldFlow(toNewFlow(OLD)), false);
  assert.match(newFlowEdit, /inserted directly after `shape`, at the `shape` step's status/);
  assert.match(newFlowEdit, /Nothing else on the type changes/);
});

test("tune's Step 2 rules accept the new flow's two gates, and a result that breaks one is not offered", () => {
  assert.ok(kindRule, 'no kind-count rule in sdlc-tune Step 2');
  assert.equal(kindRule[1], 'gate');
  assert.match(tune, /except `gate`, at most twice \(in the presets, the shaped step and the plan gate\)/);
  assert.equal(stepBound, 12);
  assert.equal(breaksRule(toNewFlow(OLD)), null);
  assert.equal(offered(OLD), true);
  assert.match(newFlowEdit, /A type whose result would break a rule below \(a step id `shaped` already in it, a third `gate`, more than 12 steps\) is shown, naming the rule it breaks, and not offered/);
  const manualShaped = { id: 'shaped', kind: 'manual', label: 'shaped', status: 'backlog' };
  const twoGatesAfterPlan = [...OLD.slice(0, 3), { id: 'gate-2', kind: 'gate', label: 'gate 2', status: 'backlog' }, ...OLD.slice(3)];
  const twelve = [...OLD, ...Array.from({ length: 7 }, (_, i) => ({ id: `check-${i}`, kind: 'manual', label: `check ${i}`, status: 'in_review' }))];
  for (const [name, steps, rule] of [
    ['a step id shaped', [...OLD, { ...manualShaped, status: 'in_review' }], 'step ids unique per type'],
    ['two gates after plan', twoGatesAfterPlan, 'kind count'],
    ['12 steps', twelve, 'steps per type'],
  ]) {
    assert.equal(onOldFlow(steps), true, name);
    assert.equal(breaksRule(toNewFlow(steps)), rule, name);
    assert.equal(offered(steps), false, name);
  }
  assert.match(sync, /A type whose result would break a rule \(sdlc-tune, Step 2, "The new flow"\) is shown, naming the rule it breaks, and not offered/);
  assert.match(sync, /step 1's new flow when a type is offered it \(one or more left\), no more/);
});

test('tune offers the new flow once per run, and a no goes on to the request', () => {
  assert.match(oldFlowRule, /Offer it once per run\. On a yes, a request is turned into an edit afterwards, from a fresh Step 1 read; on a no, leave it and go on to the request/);
});

// The human, on LWY-126: "We're very much still in the beta phase, so we can break some things, and we need to push
// for a good version." So a no to sync's offer is asked again at the next release, and gets no `Kept` row.
test('sync names its two options, and a no is asked again at the next release, as the question says', () => {
  assert.match(sync, /Two options, each with its argument: "Move to the new flow" first \([^)]+\), then "Leave it" \([^)]+\)/);
  assert.match(sync, /The question says that a no is asked again at the next release/);
  assert.match(sync, /a no gets no `Kept` row, so the next release asks again/);
});

test('tune and sync offer the new flow, and write it only on a yes', () => {
  assert.match(tune, /Ask once: "Change `<types>` as shown, and write it to `<KEY>`\?"[^.]*\. On no, change nothing/);
  assert.match(sync, /\*\*No type on the old flow\*\* \(sdlc-tune, Step 1, "The old flow"\) → nothing to offer/);
  assert.match(sync, /On "Move to the new flow", write it as sdlc-tune's Step 4 does[^.]*\. On any other answer nothing is written/);
  assert.match(sync, /matched like a copy, by the prefix `Sync friction-project: to <this version>:`, and so is the new flow \(step 1\), by `Sync process: to <this version>:`/);
  assert.match(update, /for a product's process on the old flow: sync-repo asks, once, and this skill never does/);
});

const meaning = (text) => /`version` is the revision counter\. (`0`.*? that a person set it\.)/.exec(text)?.[1];

test('install and tune state what `version` means in the same words, and nothing says the old meaning', () => {
  assert.ok(meaning(install), 'sdlc-install states no meaning of version');
  assert.equal(meaning(tune), meaning(install));
  assert.match(meaning(install), /`product create` stores at version 1/);
  const files = ['PROCESS.md', ...readdirSync(join(plugin, 'skills')).map((name) => `skills/${name}/SKILL.md`)];
  for (const file of files) {
    assert.doesNotMatch(oneLine(read(file)), /never set a process|a person or an earlier install set it/, file);
  }
});

test('a product the install just created is pre-filled from detection, never with keep', () => {
  assert.match(install, /\*\*When the product existed before this install and step 3\.4 found a stored process \(`version` of 1 or more\), the pre-filled answer is \(d\) keep what is there\*\*/);
  assert.match(install, /\*\*A product this install created in step 3\.3 is never pre-filled with \(d\)\*\*[^.]*\. For it, and for a product at `version` 0, pre-fill \(a\)/);
  assert.match(install, /\(b\) a maintained system people depend on: a feature goes shaping → shaped → planning → planned → building → verify on dev/);
});
