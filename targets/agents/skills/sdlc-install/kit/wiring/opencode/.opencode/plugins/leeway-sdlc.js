// The leeway-sdlc guards for OpenCode, which has no shell-command hooks: a plugin's
// execute.before hook throws to refuse a call. Judges with the same adapter as every other agent.
// Written by sdlc-install; synced by sync-repo. See .sdlc/kit/HARNESS.md, "Governed-agent marker".
import { Plugin } from '@opencode/plugin'
import { decide } from '../../.sdlc/kit/hooks/adapters/guard.mjs'

export default Plugin.define({
  id: 'leeway-sdlc',
  async setup(ctx) {
    await ctx.tool.hook('execute.before', (event) => {
      if (event?.tool !== 'shell') return
      const verdict = decide({ agent: event.agent, args: event.input, cwd: ctx.location.directory })
      if (verdict.block) throw new Error(verdict.message)
    })
  },
})
