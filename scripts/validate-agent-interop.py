#!/usr/bin/env python3
"""Validate shared skill interoperability across project and global targets."""

from __future__ import annotations

import json
import os
from pathlib import Path


HOME = Path.home()
REPO_ROOT = Path(__file__).resolve().parent.parent

PROJECT_SOURCE = REPO_ROOT / ".skillshare" / "skills"
PROJECT_TARGETS = {
    "claude_project": REPO_ROOT / ".claude" / "skills",
    "codex_project": REPO_ROOT / ".codex" / "skills",
}

GLOBAL_SOURCE = HOME / ".config" / "skillshare" / "skills"
GLOBAL_TARGETS = {
    "claude_global": HOME / ".claude" / "skills",
    "codex_global": HOME / ".codex" / "skills",
    "universal_global": HOME / ".agents" / "skills",
}

KEY_SKILLS = [
    "research",
    "quick-fix",
    "orchestra",
    "verify-ui",
    "create-pr",
    "merge-pr",
    "agent-deep-links",
    "ai-slop-cleaner",
    "analyze",
    "ask-gemini",
    "ui-ux-pro-max",
    "trace",
    "note",
    "ralph",
]


def skill_names(root: Path) -> set[str]:
    if not root.exists():
        return set()
    return {p.name for p in root.iterdir() if p.is_dir()}


def symlink_target(path: Path) -> str | None:
    if not path.exists() or not path.is_symlink():
        return None
    return os.readlink(path)


def check_layer(source: Path, targets: dict[str, Path]) -> dict:
    source_skills = skill_names(source)
    layer = {
        "source": str(source),
        "source_count": len(source_skills),
        "targets": {},
    }
    for name, root in targets.items():
        target_skills = skill_names(root)
        missing = sorted(source_skills - target_skills)
        shared = sorted(source_skills & target_skills)
        non_symlink = []
        wrong_link = []
        for skill in shared:
            skill_path = root / skill
            link = symlink_target(skill_path)
            if link is None:
                non_symlink.append(skill)
                continue
            resolved = skill_path.resolve()
            expected = (source / skill).resolve()
            if resolved != expected:
                wrong_link.append(
                    {"skill": skill, "points_to": str(resolved), "expected": str(expected)}
                )
        layer["targets"][name] = {
            "path": str(root),
            "count": len(target_skills),
            "shared_from_source": len(shared),
            "local_only": len(target_skills - source_skills),
            "missing_from_target": missing,
            "non_symlink_shared_skills": non_symlink,
            "wrong_symlink_targets": wrong_link,
        }
    return layer


def check_key_skills() -> dict[str, dict[str, bool]]:
    checks: dict[str, dict[str, bool]] = {}
    roots = {
        "claude_global": HOME / ".claude" / "skills",
        "codex_global": HOME / ".codex" / "skills",
        "universal_global": HOME / ".agents" / "skills",
    }
    for skill in KEY_SKILLS:
        checks[skill] = {name: (root / skill).exists() for name, root in roots.items()}
    return checks


def overall_pass(report: dict) -> bool:
    for layer_name in ("project", "global"):
        layer = report[layer_name]
        for target in layer["targets"].values():
            if target["missing_from_target"]:
                return False
            if target["non_symlink_shared_skills"]:
                return False
            if target["wrong_symlink_targets"]:
                return False
    for presence in report["key_skill_presence"].values():
        if not all(presence.values()):
            return False
    return True


def main() -> None:
    report = {
        "project": check_layer(PROJECT_SOURCE, PROJECT_TARGETS),
        "global": check_layer(GLOBAL_SOURCE, GLOBAL_TARGETS),
        "key_skill_presence": check_key_skills(),
    }
    report["pass"] = overall_pass(report)
    print(json.dumps(report, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
