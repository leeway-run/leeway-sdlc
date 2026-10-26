# Release notes

## 0.1.0

Not yet tagged: the tag waits for the hooks, agents, templates and skills.

### Upgrading a repo

### How it was checked
- F1 `sdlc-install` dry run, 2026-10-26, against a local Leeway (`wrangler dev --local`, migrations 0001-0014) with a scratch repo (`node --test`, one GitHub workflow, no commits): created product `DRY`, set `--preset maintained`, then adjusted through `--stdin process` (bug without `plan`, a `spike` type by analogy, debt not unattended), version 2 read back; wrote `.sdlc/` and the seven docs; no `{{` and no `token`, `Bearer` or `lw_` in what was written; every doc-map path exists; the configured `cli:` path is honoured; `version-notice.mjs` is quiet at `Synced to 0.1.0`; a second bind found version 2 and offered "keep what is there" before any `process update`.
