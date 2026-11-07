// The release workflow's job graph: both Node versions test before anything is released, and a failure on either stops
// it. It reads the file as text, because the repo has no YAML parser. Run: `node --test scripts/release-workflow.test.mjs`.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const workflow = readFileSync(new URL('../.github/workflows/release.yml', import.meta.url), 'utf8').replace(/\r\n/g, '\n')

// Each job's block under `jobs:`, by name.
const jobs = Object.fromEntries(
  workflow
    .slice(workflow.indexOf('\njobs:\n') + '\njobs:\n'.length)
    .split(/^(?=  [\w-]+:$)/m)
    .map((block) => [block.match(/^  ([\w-]+):$/m)[1], block]),
)

test('verify and release are the only jobs, so nothing publishes around the tests', () => {
  assert.deepEqual(Object.keys(jobs), ['verify', 'release'])
})

test('verify runs on Node 22 and 26, and its setup-node takes the version from the matrix', () => {
  assert.match(jobs.verify, /^ {6}matrix:\n {8}node: \[22, 26\]$/m)
  assert.match(jobs.verify, /^ {10}node-version: \$\{\{ matrix\.node \}\}$/m)
})

test('every check runs in the job with the matrix, so each runs on both versions', () => {
  for (const check of ['node --test ', 'node scripts/build-targets.mjs --check', 'node .github/scripts/check-manifests.mjs', 'node .github/scripts/check-tag.mjs']) {
    assert.ok(jobs.verify.includes(check), check)
    assert.ok(!jobs.release.includes(check), check)
  }
})

test('release waits for verify, and only a tag push reaches it', () => {
  assert.match(jobs.release, /^ {4}needs: verify$/m)
  assert.match(jobs.release, /^ {4}if: github\.event_name == 'push'$/m)
  assert.match(workflow, /^ {2}push:\n {4}tags: \["v\*"\]\n {2}workflow_dispatch:\n/m)
})

test('a failed version cannot pass as a success or be skipped past', () => {
  assert.doesNotMatch(workflow, /continue-on-error|always\(\)|failure\(\)|cancelled\(\)/)
})

test('release is one job on one version, and only it can write', () => {
  assert.doesNotMatch(jobs.release, /matrix/)
  assert.equal(jobs.release.match(/^ {10}node-version: .*$/gm).length, 1)
  assert.match(jobs.release, /^ {10}node-version: 22$/m)
  assert.equal(workflow.match(/contents: write/g).length, 1)
  assert.match(jobs.release, /contents: write/)
})
