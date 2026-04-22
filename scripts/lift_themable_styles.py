#!/usr/bin/env python3
"""
Move `const <name> = StyleSheet.create({` from module level into the preceding
`export function` / `export default function` when the stylesheet references `themeColors`.
Run from project root: python3 scripts/lift_themable_styles.py
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def find_brace_block(s: str, start_open_brace: int) -> int | None:
    """Index after closing `}` that matches the `{` at start_open_brace, or None."""
    if start_open_brace < 0 or s[start_open_brace] != "{":
        return None
    depth = 0
    i = start_open_brace
    while i < len(s):
        c = s[i]
        if c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                return i + 1
        i += 1
    return None


def find_stylesheet_end(text: str, from_idx: int) -> int | None:
    """From `const styles = StyleSheet.create(`, return index after `});` (semicolon)."""
    m = re.search(r"StyleSheet\.create\s*\(\s*\{", text[from_idx:], re.S)
    if not m:
        return None
    j = from_idx + m.end() - 1  # points at `{` of the object
    end_brace = find_brace_block(text, j)
    if end_brace is None:
        return None
    rest = text[end_brace:].lstrip()
    if rest.startswith(")"):
        paren_end = end_brace + 1
        for k in range(end_brace, len(text)):
            if text[k:].startswith(")"):
                paren_end = k + 1
                break
    else:
        return None
    paren_end = end_brace
    while paren_end < len(text) and text[paren_end] in " \n\t)":
        paren_end += 1
    # expect );
    p = text.find(");", end_brace)
    if p == -1:
        p = text.find(")", end_brace)
        if p == -1:
            return None
    last = text.find(");", from_idx)
    if last == -1:
        last = text.rfind(")", from_idx) + 1
        if last and text[last] == "":
            pass
    m2 = re.search(
        r"const\s+(\w+)\s*=\s*StyleSheet\.create\s*(\(.*?)\);",
        text[from_idx:],
        re.S,
    )
    # simpler: from StyleSheet.create( to );
    paren = text.find("StyleSheet.create", from_idx)
    if paren == -1:
        return None
    openp = text.find("(", paren) + 1
    if openp < 1:
        return None
    obj = text[openp:].find("{")
    if obj < 0:
        return None
    obj_abs = openp + obj
    e = find_brace_block(text, obj_abs)
    if e is None:
        return None
    e2 = text.find(");", e)
    if e2 == -1:
        e2 = text.find(");", e - 1)
    if e2 == -1:
        return e
    return e2 + 2


def find_export_fn_open(text: str) -> int | None:
    m = re.search(
        r"^export (?:default )?function \w+",
        text,
        re.M,
    )
    if not m:
        return None
    open_brace = text.find("{", m.end())
    return open_brace


def process_file(path: Path) -> bool:
    t = path.read_text(encoding="utf-8")
    if "StyleSheet.create" not in t or "themeColors" not in t:
        return False
    m_const = re.search(
        r"^const (styles\w*)\s*=\s*StyleSheet\.create\s*\(",
        t,
        re.M,
    )
    if not m_const:
        return False
    name = m_const.group(1)
    cstart = m_const.start()
    # if indented (inside function), skip
    if t[cstart - 1] not in "\n":
        if not (cstart == 0 or t[cstart - 1] == "\n"):
            return False
    if cstart > 0 and t[:cstart].rstrip().endswith(")"):
        # might be inside another block
        pass
    if re.search(
        r"^const (styles\w*)\s*=\s*StyleSheet\.create",
        t,
        re.M,
    ) and cstart and t.rfind("export", 0, cstart) == -1:
        return False
    cstart_line = t[:cstart].count("\n")
    for ln in t[:cstart].splitlines():
        if ln.startswith("const " + name) and not ln.startswith("const " + name + " = useMemo"):
            if "\t" in ln[:1] or (ln and ln[0] in " \t") and cstart < len(t):
                pass
    if not t[cstart:].strip().startswith("const " + name) or t[cstart] not in "c\n":
        pass
    if cstart > 0:
        pre = t[max(0, t.rfind("\n", 0, cstart) + 1) : cstart]
        if pre and pre.strip() and not pre.startswith("const"):
            # leading whitespace on line before
            line0 = t.rfind("\n", 0, cstart) + 1
            if line0 and t[line0:cstart].strip() == "" and t[cstart:].startswith("const "):
                pass
            elif t[line0:cstart].strip() and not t[line0:].lstrip().startswith("const " + name):
                return False

    # strict: at column 0, line starts with const
    line_br = t.rfind("\n", 0, cstart) + 1
    if t[line_br:cstart].strip() != "" and line_br > 0:
        return False

    rel_block = t[cstart:]
    paren = rel_block.find("StyleSheet.create")
    o = rel_block.find("(", paren) + 1
    bopen = o + rel_block[o:].find("{")
    end = find_brace_block(rel_block, bopen)
    if end is None:
        return False
    semi = rel_block.find(");", end)
    if semi == -1:
        return False
    end_full = cstart + semi + 2
    body = t[cstart:end_full]
    inner = body.split("StyleSheet.create", 1)[1]
    p2 = inner.find("(") + 1
    b2 = p2 + inner[p2:].find("{")
    bclose = find_brace_block(inner, b2)
    if bclose is None:
        return False
    create_obj = inner[b2 : bclose + 0]
    if "themeColors" not in t[cstart:end_full]:
        return False

    fn_open = find_export_fn_open(t)
    if fn_open is None or fn_open > cstart:
        return False
    if "useAppTheme" not in t and path.name != "App.tsx":
        return False
    if "import { useMemo" not in t and "import React, { useMemo" not in t and "useMemo" not in t.split("from 'react'")[0]:
        t = t.replace("import React from 'react'", "import React, { useMemo } from 'react'", 1)
        t = t.replace("import React, {", "import React, { useMemo,", 1) if t.startswith("import React, {") else t
    if "useMemo" not in t and "import React" in t:
        t2 = t.replace("import React, {", "import React, { useMemo, ", 1) if "import React, {" in t else t.replace("import React from 'react';", "import React, { useMemo } from 'react';", 1)
        t = t2

    hook = "  const { colors: themeColors } = useAppTheme();"
    insert_after = t.find("\n", fn_open)  # first line in fn is often not hook
    first_line_end = t.find("\n", fn_open + 1) + 1
    if hook.strip() in t[fn_open:cstart]:
        hook = ""
    if "const { colors: themeColors }" not in t[fn_open:cstart] and "themeColors" in t[fn_open:cstart]:
        pass
    after_brace = fn_open + 1
    if hook and hook not in t[fn_open : fn_open + 200]:
        t = t[:after_brace] + "\n" + hook + t[after_brace:]

    wrap = f"  const {name} = useMemo(\n    () =>\n      StyleSheet.create" + t[cstart + body.index("StyleSheet.create") + len("StyleSheet.create") : cstart] 
    return False