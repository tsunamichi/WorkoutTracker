#!/usr/bin/env python3
"""Fail when feature Swift files bypass generated color or typography APIs."""

from __future__ import annotations

import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
SWIFT_ROOT = ROOT / "Equilibrium"
CENTRAL_FILES = {
    SWIFT_ROOT / "DesignSystem" / "DesignTokens.swift",
    SWIFT_ROOT / "DesignSystem" / "GeneratedDesignTokens.swift",
}

CHECKS = {
    "raw RGB color": re.compile(r"(?:Color|UIColor)\s*\([^\n]*(?:red:|\.sRGB)|EQColor\.rgb\s*\("),
    "raw named palette color": re.compile(
        r"\b(?:Color|UIColor)\.(?:black|white|red|orange|yellow|green|blue|purple|gray)\b"
    ),
    "raw named SwiftUI color": re.compile(
        r"\.(?:foregroundStyle|foregroundColor|background|fill|tint)\s*\(\s*"
        r"\.(?:black|white|red|orange|yellow|green|blue|purple|gray)\b"
    ),
    "direct system font": re.compile(r"(?:\.font\s*\(\s*\.system\s*\(|Font\.system|UIFont\.systemFont)"),
}

ALLOWED_EXCEPTIONS = {
    (
        Path("Equilibrium/Features/WorkoutExecution/WorkoutExecutionView.swift"),
        "UIFont.systemFont(ofSize: EQTextStyle.screenTitle.size)",
    ),
}


def main() -> int:
    violations: list[str] = []
    for path in sorted(SWIFT_ROOT.rglob("*.swift")):
        if path in CENTRAL_FILES:
            continue
        for line_number, line in enumerate(path.read_text().splitlines(), 1):
            for label, expression in CHECKS.items():
                if expression.search(line):
                    relative_path = path.relative_to(ROOT)
                    if any(
                        relative_path == allowed_path and allowed_text in line
                        for allowed_path, allowed_text in ALLOWED_EXCEPTIONS
                    ):
                        continue
                    violations.append(
                        f"{relative_path}:{line_number}: {label}: {line.strip()}"
                    )
    if violations:
        print("Design-system audit failed:", file=sys.stderr)
        print("\n".join(violations), file=sys.stderr)
        return 1
    print("Design-system audit passed: no feature-level raw colors or system fonts.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
