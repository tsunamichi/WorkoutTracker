#!/usr/bin/env python3
"""COLORS. -> themeColors. + useAppTheme — run: python3 scripts/migrate_colors_to_theme.py"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

SKIP = {
    "appTheme.ts",
    "basePalette.ts",
    "getAppThemeFromStore.ts",
    "useAppTheme.ts",
    "colorUtils.ts",
}


def theme_import_path(fpath: Path) -> str:
    if fpath.name == "App.tsx":
        return "./src/theme/useAppTheme"
    rel = fpath.resolve().relative_to(ROOT)
    parts = rel.parts
    if "src" in parts:
        i = parts.index("src")
        depth = len(parts) - 1 - (i + 1)
        return f"{'../' * depth}theme/useAppTheme"
    raise ValueError(fpath)


def strip_colors_from_imports(text: str) -> str:
    lines_out = []
    for line in text.splitlines():
        if "COLORS" in line and ("from '" in line or "from " in line) and "constants" in line and line.strip().startswith("import "):
            s = re.sub(r"\{\s*COLORS\s*,\s*", "{ ", line)
            s = re.sub(r",\s*COLORS\s*}", " }", s)
            s = re.sub(r",\s*COLORS\s*,", ",", s)
            s = re.sub(r"\{\s*COLORS\s*}", "{}", s)
            if re.match(r"^\s*import\s+\{\s*\}\s*from", s) or s.strip() == "import { }" or s.strip() == "import {  } from '../constants';":
                continue
            lines_out.append(s)
        else:
            lines_out.append(line)
    return "\n".join(lines_out)


def has_theme_colors(text: str) -> bool:
    if re.search(r"const\s+\{\s*[^}]*\bcolors:\s*themeColors", text):
        return True
    if re.search(r"const\s+themeColors\s*=\s*appTheme\.colors", text):
        return True
    return False


def ensure_use_app_import(text: str, tpath: str) -> str:
    if re.search(r"import\s+\{[^}]*\buseAppTheme\b", text):
        return text
    imp = f"import {{ useAppTheme }} from '{tpath}';"
    lines = text.splitlines(keepends=True)
    ins = 0
    for i, ln in enumerate(lines):
        if ln.startswith("import "):
            ins = i + 1
    lines.insert(ins, imp + "\n")
    return "".join(lines)


def add_app_theme_line(text: str) -> str:
    if has_theme_colors(text) or "themeColors." not in text:
        return text
    if re.search(r"const\s+appTheme\s*=\s*useAppTheme\s*\(\s*\)\s*;", text):
        return re.sub(
            r"(const\s+appTheme\s*=\s*useAppTheme\s*\(\s*\)\s*;)\n",
            r"\1\n  const themeColors = appTheme.colors;\n",
            text,
            count=1,
        )
    m = re.search(
        r"(^export (?:default )?function (?:[A-Z]\w*)\s*(?:<[^>]+>\s*)?\([^{]*\)\s*\{)\n",
        text,
        re.M,
    )
    hook = "  const { colors: themeColors } = useAppTheme();"
    if m:
        return text.replace(m.group(0), m.group(0) + hook + "\n", 1)
    m = re.search(r"(^export default function[^{]*\{)\n", text, re.M)
    if m:
        return text.replace(m.group(0), m.group(0) + hook + "\n", 1)
    return text


def add_react_memo_for_styles(text: str) -> str:
    if "  const styles = useMemo" in text or " const styles = useMemo" in text:
        return text
    if "const styles = StyleSheet.create" not in text or "useMemo" not in text or "from 'react'" not in text:
        return text
    m = re.search(r"^import (React,?\s*)?(\{[^}]*\})\s*from 'react';", text, re.M)
    if not m or "useMemo" in m.group(0):
        return text
    inner = m.group(2)
    new = inner[:-1] + ", useMemo" + "}"
    return text.replace(m.group(0), m.group(0).replace(inner, new), 1)


def process_file(fpath: Path) -> bool:
    if fpath.suffix not in (".ts", ".tsx") or fpath.name in SKIP or "node_modules" in fpath.parts:
        return False
    if fpath == ROOT / "src" / "constants" / "index.ts":
        return False

    text = fpath.read_text(encoding="utf-8")
    if "COLORS" not in text and ", COLORS" not in text and "COLORS," not in text:
        return False

    orig = text
    tpath = theme_import_path(fpath)
    text = strip_colors_from_imports(text)
    text = re.sub(
        r"^\s*import\s+\{\s*\}\s*from\s+['\"]([^'\"]+)['\"];?\s*$",
        "",
        text,
        flags=re.M,
    )
    text = re.sub(
        r"^\s*import\s+\{\s*}\s*from\s+['\"]([^'\"]+)['\"];?\s*$",
        "",
        text,
        flags=re.M,
    )

    text = re.sub(r"\bCOLORS\.", "themeColors.", text)

    if fpath.suffix == ".tsx" or fpath.name == "App.tsx":
        text = ensure_use_app_import(text, tpath)
        text = add_react_memo_for_styles(text)
        text = add_app_theme_line(text)

    fpath.write_text(text, encoding="utf-8")
    return text != orig


def main():
    n = 0
    for p in sorted(
        {ROOT / "App.tsx", *Path(ROOT / "src").rglob("*.ts"), *Path(ROOT / "src").rglob("*.tsx")},
        key=str,
    ):
        if p.name in SKIP or "scripts" in p.parts and "migrate" in p.name:
            continue
        try:
            if process_file(p):
                n += 1
                print(p.relative_to(ROOT), file=sys.stderr)
        except Exception as e:  # noqa: BLE001
            print("ERR", p, e, file=sys.stderr)
    print(f"updated {n} files", file=sys.stderr)


if __name__ == "__main__":
    main()
