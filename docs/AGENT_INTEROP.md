# Agent Interop Status

This document records what is already shared between Claude Code and Codex in this repository, and what still remains tool-specific.

## Shared Today

- Project-local skills are managed from `.skillshare/skills/`
- Global shared skills are managed from `~/.config/skillshare/skills/`
- Shared cross-project agent guidance can be managed from `~/.config/skillshare/agent-guides/`
- Shared skills are synced into:
  - `.claude/skills/`
  - `.codex/skills/`
- Global shared skills are synced into:
  - `~/.claude/skills/`
  - `~/.codex/skills/`
  - `~/.agents/skills/`
- Project guidance now exists for both tools:
  - `CLAUDE.md`
  - `AGENTS.md`
- Project guide adapters are generated from:
  - `docs/SHARED_AGENT_CORE.md`
  - `docs/CLAUDE_APPENDIX.md`
  - `docs/AGENTS_APPENDIX.md`
- Git automation for skill sync is enabled through repo-local hooks in `.githooks/`

## Shared Workflow Commands

```bash
npm run skills:status
npm run skills:sync
npm run skills:sync:dry
npm run skills:doctor
npm run skills:global:status
npm run skills:global:sync
npm run skills:global:sync:dry
npm run skills:global:doctor
npm run agent-guides:sync
```

## Shared Guide Strategy

- Keep the shared project rules short and high-signal.
- Keep `CLAUDE.md` and `AGENTS.md` as thin adapters, not giant duplicated manuals.
- Put only tool-specific behavior in the appendix docs.
- Treat this as an efficiency optimization for both agents, not just a maintenance trick.

## Reuse In Other Repositories

Bootstrap the same structure into another repository with:

```bash
python3 ~/.config/skillshare/agent-guides/bootstrap-project-agent-guides.py /path/to/repo
```

That installs:

- `docs/SHARED_AGENT_CORE.md`
- `docs/CLAUDE_APPENDIX.md`
- `docs/AGENTS_APPENDIX.md`
- `scripts/sync-agent-guides.py`
- `.githooks/pre-commit`

## Current Tool-Specific Layer

### Claude-only

- `CLAUDE.md`
- `.claude/settings.local.json`

Current Claude project permissions allow:

- selected `git` commands
- `WebSearch`
- selected `gitnexus` MCP calls
- one local `chmod` path

### Codex-only

- `AGENTS.md`
- project behavior inherited from user/global Codex config
- `.githooks/*` repo automation

## Hooks Status

### Implemented

- `post-checkout` -> runs `skillshare sync -p`
- `post-merge` -> runs `skillshare sync -p`
- `post-rewrite` -> runs `skillshare sync -p`

These hooks are repo-local automation hooks, not Claude/Codex runtime hooks.

### Not Yet Unified

- Claude runtime hook/event model
- Codex runtime hook/event model
- approval policy mapping
- MCP server/project override mapping

These should not be blindly mirrored because the tools use different schemas and different control surfaces.

## Recommended Next Step For Runtime Hooks

If we continue, the safest path is:

1. Inventory actual recurring behaviors we want from hooks.
2. Classify each behavior as:
   - shared shell automation
   - Claude-only runtime hook
   - Codex-only runtime hook
3. Implement only behavior-equivalent hooks, not file-format mirroring.

## Rollback

Pre-skillshare project-local skill folders were moved to:

```text
.skillshare/backups/20260507-skillshare-import/
```

## Operating Rule

Treat `skillshare` as the source of truth for shared project skills.
Treat `docs/SHARED_AGENT_CORE.md` as the source of truth for shared project agent guidance.
Treat runtime hooks, MCP, and approval policies as adapter layers unless proven equivalent.
