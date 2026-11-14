// Copies the current worktree's index (every tracked file, as staged) into a scratch directory, so a
// reviewer can mutate files and run the lanes there without touching the task worktree.
//
//   cd <worktree> && node scripts/scratch-copy.mjs <dest>
//
// <dest> is created if missing and used if empty (relative paths resolve against the caller's cwd);
// one that exists and is not empty is refused and nothing is written. Unstaged edits and untracked
// files do not appear in the copy. Removing the copy is the caller's job.
//
// No dependencies.

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

const USAGE = 'usage: node scripts/scratch-copy.mjs <dest>   (run from the worktree to copy)'
const args = process.argv.slice(2)

if (args.includes('--help') || args.includes('-h')) {
  console.log(`${USAGE}

Writes the worktree's index (tracked files as staged) into <dest>, a new or empty directory,
for mutation checks that must not touch the worktree. Unstaged edits and untracked files are not copied.`)
  process.exit(0)
}
if (args.length !== 1) {
  console.error(USAGE)
  process.exit(2)
}

const dest = resolve(args[0])
if (existsSync(dest) && (!statSync(dest).isDirectory() || readdirSync(dest).length > 0)) {
  console.error(`scratch-copy: ${dest} exists and is not an empty directory`)
  process.exit(1)
}
mkdirSync(dest, { recursive: true })
execFileSync('git', ['checkout-index', '-a', `--prefix=${join(dest, '/')}`], { stdio: 'inherit' })
console.log(dest)
