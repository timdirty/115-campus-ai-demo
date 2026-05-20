#!/usr/bin/env python3
"""Generate thin CLAUDE.md and AGENTS.md adapters from shared project guidance."""

from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"


def read(name: str) -> str:
    return (DOCS / name).read_text().strip() + "\n"


def render(title: str, intro: str, appendix_name: str) -> str:
    shared = read("SHARED_AGENT_CORE.md")
    appendix = read(appendix_name)
    return (
        "<!-- AUTO-GENERATED: edit docs/SHARED_AGENT_CORE.md and the appendix docs, then run "
        "python3 scripts/sync-agent-guides.py -->\n\n"
        f"# {title}\n\n"
        f"{intro}\n\n"
        "Use this file as the compact entrypoint. Keep shared project guidance in "
        "`docs/SHARED_AGENT_CORE.md` and tool-specific guidance in the appendix docs.\n\n"
        f"{shared}\n"
        f"{appendix}"
    )


def main() -> None:
    claude = render(
        "CLAUDE.md",
        "This file provides guidance to Claude Code when working with this repository.",
        "CLAUDE_APPENDIX.md",
    )
    agents = render(
        "AGENTS.md",
        "This file provides guidance to Codex when working with this repository.",
        "AGENTS_APPENDIX.md",
    )
    (ROOT / "CLAUDE.md").write_text(claude)
    (ROOT / "AGENTS.md").write_text(agents)


if __name__ == "__main__":
    main()
