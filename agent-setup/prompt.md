# Leeway agent setup

You are setting up the user's coding agent to work with Leeway (https://leeway.run). Follow the steps in order.
Run commands from the root of the repo the user wants to set up. **Never ask for, read, print or write a Leeway
token.** Where a step says ASK, ask the user and wait for the answer.

leeway-sdlc has been tested with Claude Code only. If you are another agent, tell the user before step 3 that
support for their agent is built in but has not been verified yet, that verified support will come later, and
that issues go to https://github.com/leeway-run/leeway-sdlc/issues. Then carry on.

The snippet that sent you here may name a `server` and a `product`. Keep them for step 4.

## 1. The leeway CLI

If `leeway --version` works, skip this step. Otherwise ASK: install it globally
(`npm i -g @leeway-run/cli`), or run it through npx in this repo only (`npx -y @leeway-run/cli`, recorded as the `cli:` in step 4)?
Do what the user chooses. If `node` is missing, stop and tell the user Node.js is required.

## 2. Sign in

Run `leeway whoami`. If it is not signed in, tell the user to run `leeway login` themselves, adding
`--server <url>` if the snippet named a server other than https://app.leeway.run. In agents with a shell escape the
command is `! leeway login`. Wait, then run `leeway whoami` again.

## 3. Install leeway-sdlc for your agent

Use the section for the agent you are. Run the commands as written. Do not copy files by hand.

### Claude Code
```
claude plugin marketplace add leeway-run/leeway-sdlc
claude plugin install leeway-sdlc@leeway --scope project
```
Tell the user to run `/reload-plugins`.

### OpenAI Codex CLI
- `codex plugin marketplace add leeway-run/leeway-sdlc`
- In Codex, open `/plugins` and install **leeway-sdlc-agents**.

After step 4: Open `/hooks` and trust the leeway-sdlc hook in `.codex/hooks.json`: Codex does not run a project hook until you do.

### GitHub Copilot (CLI and VS Code agent mode)
- Copilot CLI: `copilot plugin install leeway-run/leeway-sdlc:targets/agents`
- VS Code: Command Palette → **Chat: Install Plugin from Source** → `https://github.com/leeway-run/leeway-sdlc`, path `targets/agents`.

After step 4: Nothing to trust: Copilot runs `.github/hooks/*.json` from the repo. The Copilot cloud coding agent is not supported by this version.

### Google Gemini CLI
- `gemini skills install https://github.com/leeway-run/leeway-sdlc --path targets/agents/skills --scope workspace --consent`

After step 4: Nothing to trust. If your account was moved to Antigravity CLI, this setup is UNVERIFIED there.

### Cursor (agent and CLI)
- `npx -y skills add leeway-run/leeway-sdlc/tree/main/targets/agents/skills -a cursor --yes`

After step 4: Nothing to trust: Cursor runs `.cursor/hooks.json` from the repo.

### OpenCode
- `npx -y skills add leeway-run/leeway-sdlc/tree/main/targets/agents/skills -a opencode --yes`

After step 4: Restart OpenCode so it loads `.opencode/plugins/leeway-sdlc.js`.

### xAI Grok Build
- `npx -y skills add leeway-run/leeway-sdlc/tree/main/targets/agents/skills -a grok --yes`

After step 4: Run `/hooks-trust` in Grok so it runs `.grok/hooks/leeway-sdlc.json`. Grok hooks fail open: a crashed or timed-out guard lets the command run.

### Any other agent
leeway-sdlc does not support it yet. Tell the user which agents it does support, and stop after step 2.

## 4. Bind the repo

Run the `sdlc-install` skill (Claude Code: `/leeway-sdlc:sdlc-install`). Give it the server and product from the
snippet, if it named them. It asks the rest, shows its plan, and writes nothing before the user agrees.

## Done

Show:

```
Leeway agent setup complete
  ✓ leeway CLI        <leeway --version>
  ✓ signed in         <account from leeway whoami>
  ✓ leeway-sdlc       0.2.0 for <agent>
  ✓ repo bound to     <product key>
```

Then list anything the user still has to do: the trust or restart step for the agent, from step 3. For any agent
other than Claude Code, end with: "leeway-sdlc is tested with Claude Code only so far. If something doesn't work,
please report it at https://github.com/leeway-run/leeway-sdlc/issues".
