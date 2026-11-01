// The leeway-sdlc guards for OpenCode, which has no shell-command hooks: a plugin's
// tool.execute.before throws to refuse a call. Judges with the same adapter as every other agent.
// Written by sdlc-install; synced by sync-repo. See .sdlc/kit/HARNESS.md, "Governed-agent marker".
import { decide } from '../../.sdlc/kit/hooks/adapters/guard.mjs'

export const LeewaySdlcGuard = async ({ directory } = {}) => ({
  'tool.execute.before': async (input, output) => {
    if (input?.tool !== 'bash') return
    const verdict = decide({ args: output?.args, cwd: directory })
    if (verdict.block) throw new Error(verdict.message)
  },
})
