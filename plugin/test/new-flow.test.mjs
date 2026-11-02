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

const build = { id: 'build', kind: 'build', status: 'in_progress', params: { redTests: true, round0Cap: 3, roundCap: 3, review: 'adversarial', blockingRungs: ['R4', 'R5'], unattended: true } };
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

test('sdlc-tune states the old-flow condition the server presets are told apart by', () => {
  assert.match(oldFlowRule, /has a `shape` step and no `gate` step between `shape` and its `plan` step/);
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

test('tune and sync offer the new flow, and write it only on a yes', () => {
  assert.match(tune, /Ask once: "Change `<types>` as shown, and write it to `<KEY>`\?"[^.]*\. On no, change nothing/);
  assert.match(sync, /\*\*No type on the old flow\*\* \(sdlc-tune, Step 1, "The old flow"\) → nothing to offer/);
  assert.match(sync, /On the yes, write it as sdlc-tune's Step 4 does[^.]*\. On any other answer nothing is written/);
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
