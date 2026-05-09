# skillshare Project Sharing

This project now uses `skillshare` as the shared source of truth for project-level AI skills.

## Shared Source

- Edit shared skills in `.skillshare/skills/`
- Sync changes to both Claude and Codex with:

```bash
skillshare sync -p
```

Or use the project shortcuts:

```bash
npm run skills:status
npm run skills:sync
npm run skills:sync:dry
npm run skills:doctor
```

## Current Targets

- `claude` -> `.claude/skills`
- `xcode-codex` -> `.codex/skills`

Both targets use `merge` mode, so `skillshare` manages the shared skills while preserving unrelated local-only entries if you add any later.

## Imported Skills

The current shared source includes:

- Arduino project guidance (`arduino-uno-r4-vibecoding`)
- Generated repo exploration skills (`cluster-*`, `components`, `hooks`, `include`, `pages`, `scripts`, `server`, `services`, `state`, `tour`, `views`, `competition`, `motor-test`)
- Project-local GitNexus helper skills

## Safety / Rollback

Original project-local skill folders were moved to:

```text
.skillshare/backups/20260507-skillshare-import/
```

If you ever want to inspect or restore the pre-skillshare layout, use that backup first instead of editing the symlinked target entries directly.

## Next Phase

This setup shares skills only. Hooks, MCP wiring, approval policy, and agent-specific runtime behavior should be reviewed separately before attempting cross-tool sync.

Project guidance and current interop boundaries are documented in:

```text
AGENTS.md
docs/AGENT_INTEROP.md
```

## Auto Sync Hooks

Repo-local git hooks are included in `.githooks/`.

Install them with:

```bash
npm run skills:hooks:install
```

After installation, `skillshare sync -p` runs automatically after:

- `git checkout`
- `git merge`
- history rewrites that trigger `post-rewrite`
