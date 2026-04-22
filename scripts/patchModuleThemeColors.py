#!/usr/bin/env python3
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def rel_getter(fpath: Path) -> str:
    if fpath.name == "App.tsx":
        return "./src/theme/getAppThemeFromStore"
    p = fpath.relative_to(ROOT).parts
    i = p.index("src")
    d = len(p) - 2 - i
    return ("../" * d) + "theme/getAppThemeFromStore"


def first_top_level_block(t: str) -> tuple[str, int, int] | None:
    m = re.search(
        r"(?m)^const (styles\w*)\s*=\s*StyleSheet\.create\s*\(\s*\{",
        t,
    )
    if not m:
        return None
    a = m.start()
    j = t.find("{", m.end() - 1) + 0
    d = 0
    for k in range(j, len(t)):
        c = t[k]
        if c == "{":
            d += 1
        elif c == "}":
            d -= 1
            if d == 0:
                end = t.find(");", k) + 2
                if end < 2:
                    return None
                return m.group(1), a, end
    return None


def process(fpath: Path) -> bool:
    t = fpath.read_text(encoding="utf-8")
    if "StyleSheet.create" not in t or "themeColors" not in t:
        return False
    if re.search(r"^const themeColors = getAppThemeFromStore\(\)\.colors;", t, re.M):
        return False
    fb = first_top_level_block(t)
    if not fb:
        return False
    _name, a, end = fb
    if "themeColors" not in t[a:end]:
        return False

    gp = rel_getter(fpath)
    if not re.search(
        r"import\s+\{\s*getAppThemeFromStore\s*\}\s*from\s*['\"]" + re.escape(gp) + "['\"]",
        t,
    ):
        lines = t.splitlines(keepends=True)
        ins = 0
        for i, ln in enumerate(lines):
            if ln.startswith("import "):
                ins = i + 1
        t = "".join(lines[:ins] + [f"import {{ getAppThemeFromStore }} from '{gp}';\n"] + lines[ins:])
        a = t.find("const " + _name + " =", 0)

    t = t[:a] + "const themeColors = getAppThemeFromStore().colors;\n" + t[a:]
    fpath.write_text(t, encoding="utf-8")
    return True


def main():
    n = 0
    for f in sorted([*Path(ROOT / "src").rglob("*.tsx")], key=str):
        if "node_modules" in f.parts:
            continue
        try:
            r = process(f)
            if r is True:
                n += 1
                print(f.relative_to(ROOT), file=sys.stderr)
        except Exception as e:  # noqa: BLE001
            print("ERR", f, e, file=sys.stderr)
    f = ROOT / "App.tsx"
    if f.exists() and not re.search(
        r"^const themeColors = getAppThemeFromStore\(\)\.colors;", f.read_text(), re.M
    ):
        try:
            r = process(f)
            if r is True:
                n += 1
                print("App.tsx", file=sys.stderr)
        except Exception as e:  # noqa: BLE001
            print("ERR App", e, file=sys.stderr)
    print("patched", n, file=sys.stderr)


if __name__ == "__main__":
    main()
