#!/usr/bin/env python3
"""Validate that roadmap and architecture templates are referenced from foundational-docs/."""

from __future__ import annotations

import sys
from pathlib import Path


def _find_cmos_root() -> Path:
    """Find cmos/ directory from any working directory."""
    script_dir = Path(__file__).resolve().parent
    candidate = script_dir.parent
    if (candidate / "db" / "schema.sql").exists() and (candidate / "agents.md").exists():
        return candidate
    if (Path.cwd() / "cmos" / "db" / "schema.sql").exists():
        return Path.cwd() / "cmos"
    current = Path.cwd().resolve()
    for _ in range(5):
        if (current / "cmos" / "db" / "schema.sql").exists():
            return current / "cmos"
        if current.parent == current:
            break
        current = current.parent
    raise RuntimeError("Cannot find cmos/ directory. Please run from project root.")


CMOS_ROOT = _find_cmos_root()

# Each entry: file path -> required substrings, forbidden substrings
CHECKS = {
    Path("agents.md"): {
        "required": [
            "foundational-docs/roadmap_template.md",
            "foundational-docs/tech_arch_template.md",
        ],
        "forbidden": [
            "docs/roadmap.md",
            "docs/technical_architecture.md",
        ],
    },
    Path("README.md"): {
        "required": [
            "foundational-docs/roadmap_template.md",
            "foundational-docs/tech_arch_template.md",
        ],
        "forbidden": [
            "docs/roadmap.md",
            "docs/technical_architecture.md",
        ],
    },
    Path("context/MASTER_CONTEXT.json"): {
        "required": [
            "foundational-docs/roadmap_template.md",
            "foundational-docs/tech_arch_template.md",
        ],
        "forbidden": [
            "docs/roadmap.md",
            "docs/technical_architecture.md",
        ],
    },
}


def validate_file(path: Path, required: list[str], forbidden: list[str]) -> list[str]:
    errors: list[str] = []
    try:
        content = path.read_text(encoding="utf-8")
    except FileNotFoundError:
        errors.append(f"{path}: missing file")
        return errors

    for needle in required:
        if needle not in content:
            errors.append(f"{path}: missing required reference '{needle}'")
    for needle in forbidden:
        if needle in content:
            errors.append(f"{path}: contains forbidden reference '{needle}'")
    return errors


def main() -> int:
    failures: list[str] = []
    for relative_path, config in CHECKS.items():
        file_path = CMOS_ROOT / relative_path
        failures.extend(
            validate_file(
                file_path,
                config["required"],
                config["forbidden"],
            )
        )

    if failures:
        print("Foundational reference validation failed:", file=sys.stderr)
        for failure in failures:
            print(f"  - {failure}", file=sys.stderr)
        return 1

    print("Foundational reference validation succeeded.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
