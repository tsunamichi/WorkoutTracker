#!/usr/bin/env python3
"""Validate Equilibrium's DTCG export and generate deterministic Swift tokens.

Usage:
    python3 scripts/generate_design_tokens.py
    python3 scripts/generate_design_tokens.py --check
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any


REPOSITORY_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_SOURCE = REPOSITORY_ROOT / "DesignSystem" / "Tokens" / "design.tokens.json"
DEFAULT_OUTPUT = REPOSITORY_ROOT / "Equilibrium" / "DesignSystem" / "GeneratedDesignTokens.swift"

REQUIRED_SEMANTIC_COLORS = (
    "background",
    "surface",
    "surface-emphasis",
    "accent",
    "accent-muted",
    "content-primary",
    "content-secondary",
    "content-on-accent",
    "overlay",
    "disabled-text",
    "surface-highlight-light",
    "surface-highlight-dark",
    "surface-input",
)

REQUIRED_TYPOGRAPHY = (
    "display/pr",
    "display/timer",
    "display/index",
    "display/unit",
    "display/value",
    "heading/page",
    "heading/card",
    "heading/section",
    "body/large",
    "body/default",
    "body/small",
    "label/action",
    "label/overline",
)


class TokenValidationError(ValueError):
    """Raised when the Figma export cannot be safely generated."""


@dataclass(frozen=True)
class ColorToken:
    path: str
    swift_name: str
    red: int
    green: int
    blue: int
    alpha: int


@dataclass(frozen=True)
class TypographyToken:
    path: str
    swift_name: str
    family: str
    weight: int
    size: float
    line_height: float
    uses_automatic_line_height: bool
    letter_spacing: float


def swift_identifier(value: str, *, upper_camel: bool = False) -> str:
    parts = [part for part in re.split(r"[^A-Za-z0-9]+", value) if part]
    if not parts:
        raise TokenValidationError(f"Cannot form a Swift identifier from {value!r}")
    first = parts[0]
    if upper_camel:
        identifier = "".join(part[:1].upper() + part[1:] for part in parts)
    else:
        identifier = first[:1].lower() + first[1:] + "".join(
            part[:1].upper() + part[1:] for part in parts[1:]
        )
    if identifier[0].isdigit():
        identifier = "token" + identifier[:1].upper() + identifier[1:]
    return identifier


def swift_string(value: str) -> str:
    return json.dumps(value, ensure_ascii=False)


def number(value: float) -> str:
    return str(int(value)) if value.is_integer() else repr(value)


def parse_hex_color(path: str, value: Any) -> tuple[int, int, int, int]:
    if not isinstance(value, str) or not re.fullmatch(r"#[0-9A-Fa-f]{6}(?:[0-9A-Fa-f]{2})?", value):
        raise TokenValidationError(
            f"{path} must be a #RRGGBB or #RRGGBBAA color, found {value!r}"
        )
    raw = value[1:]
    if len(raw) == 6:
        raw += "FF"
    return tuple(int(raw[index:index + 2], 16) for index in range(0, 8, 2))  # type: ignore[return-value]


def collect_color_primitives(document: dict[str, Any]) -> dict[str, ColorToken]:
    root = document.get("Primitives")
    if not isinstance(root, dict):
        raise TokenValidationError("Missing object at Primitives")
    result: dict[str, ColorToken] = {}

    def visit(node: Any, segments: list[str]) -> None:
        if not isinstance(node, dict):
            raise TokenValidationError(f"Primitives.{'.'.join(segments)} must be an object")
        if "$value" in node:
            path = "Primitives." + ".".join(segments)
            if node.get("$type") != "color":
                raise TokenValidationError(f"{path} must have $type color")
            rgba = parse_hex_color(path, node["$value"])
            swift_name = swift_identifier("-".join(segments))
            if any(token.swift_name == swift_name for token in result.values()):
                raise TokenValidationError(f"Primitive Swift identifier collision at {path}")
            result[path] = ColorToken(path, swift_name, *rgba)
            return
        for key in sorted(node):
            if key.startswith("$"):
                continue
            visit(node[key], segments + [key])

    for key in sorted(root):
        visit(root[key], [key])
    if not result:
        raise TokenValidationError("No color primitives were found")
    return result


def alias_path(owner: str, value: Any, primitives: dict[str, ColorToken]) -> str:
    if not isinstance(value, str) or not re.fullmatch(r"\{[^{}]+\}", value):
        raise TokenValidationError(f"{owner} must alias a primitive, found {value!r}")
    path = value[1:-1]
    if path not in primitives:
        raise TokenValidationError(f"{owner} references missing primitive {path}")
    return path


def collect_semantics(
    document: dict[str, Any], primitives: dict[str, ColorToken]
) -> tuple[list[str], list[str], dict[str, dict[str, str]]]:
    root = document.get("Semantic Colors")
    if not isinstance(root, dict):
        raise TokenValidationError("Missing object at Semantic Colors")
    missing = sorted(set(REQUIRED_SEMANTIC_COLORS) - set(root))
    if missing:
        raise TokenValidationError("Missing required semantic colors: " + ", ".join(missing))

    semantic_names = list(root)
    mode_names: list[str] | None = None
    semantics: dict[str, dict[str, str]] = {}
    for name in semantic_names:
        token = root[name]
        owner = f"Semantic Colors.{name}"
        if not isinstance(token, dict) or token.get("$type") != "color":
            raise TokenValidationError(f"{owner} must have $type color")
        default_alias = alias_path(owner + ".$value", token.get("$value"), primitives)
        modes = token.get("$extensions", {}).get("mode")
        if not isinstance(modes, dict) or not modes:
            raise TokenValidationError(f"{owner} must define non-empty $extensions.mode")
        names = list(modes)
        if mode_names is None:
            mode_names = names
        elif names != mode_names:
            raise TokenValidationError(
                f"{owner} mode names/order do not match the other semantic tokens"
            )
        resolved = {
            mode: alias_path(f"{owner} mode {mode!r}", value, primitives)
            for mode, value in modes.items()
        }
        if mode_names and resolved[mode_names[0]] != default_alias:
            raise TokenValidationError(
                f"{owner} default alias does not match its first mode mapping"
            )
        semantics[name] = resolved
    return semantic_names, mode_names or [], semantics


def px_value(owner: str, value: Any) -> float:
    if not isinstance(value, dict) or value.get("unit") != "px":
        raise TokenValidationError(f"{owner} must use px units")
    number_value = value.get("value")
    if not isinstance(number_value, (int, float)):
        raise TokenValidationError(f"{owner}.value must be numeric")
    return float(number_value)


def line_height_value(owner: str, value: Any, font_size: float) -> tuple[float, bool]:
    if value == "auto":
        return font_size, True
    return px_value(owner, value), False


def letter_spacing_value(owner: str, value: Any, font_size: float) -> float:
    if isinstance(value, str) and re.fullmatch(r"-?(?:\d+(?:\.\d+)?|\.\d+)%", value):
        return font_size * float(value[:-1]) / 100
    return px_value(owner, value)


def collect_typography(document: dict[str, Any]) -> list[TypographyToken]:
    root = document.get("Typography-styles")
    if not isinstance(root, dict):
        raise TokenValidationError("Missing object at Typography-styles")
    available: dict[str, Any] = {}
    for group_name, group in root.items():
        if not isinstance(group, dict):
            raise TokenValidationError(f"Typography-styles.{group_name} must be an object")
        for token_name, token in group.items():
            if token_name.startswith("$"):
                continue
            available[f"{group_name}/{token_name}"] = token
    missing = sorted(set(REQUIRED_TYPOGRAPHY) - set(available))
    if missing:
        raise TokenValidationError("Missing required typography tokens: " + ", ".join(missing))

    result: list[TypographyToken] = []
    for path in sorted(available):
        group_name, token_name = path.split("/", 1)
        token = available[path]
        owner = f"Typography-styles.{group_name}.{token_name}"
        if not isinstance(token, dict):
            raise TokenValidationError(f"Missing required typography token {path}")
        if token.get("$type") != "typography":
            raise TokenValidationError(f"{owner} must have $type typography")
        value = token.get("$value")
        if not isinstance(value, dict):
            raise TokenValidationError(f"{owner}.$value must be an object")
        family = value.get("fontFamily")
        if family not in ("SF Pro Display", "SF Pro Text"):
            raise TokenValidationError(f"{owner} has unsupported font family {family!r}")
        weight = value.get("fontWeight")
        if not isinstance(weight, int) or weight < 100 or weight > 900 or weight % 100:
            raise TokenValidationError(f"{owner} has unsupported font weight {weight!r}")
        if value.get("fontStyle") != "normal":
            raise TokenValidationError(f"{owner} has unsupported fontStyle")
        if value.get("textDecoration") != "NONE" or value.get("textCase") != "ORIGINAL":
            raise TokenValidationError(f"{owner} has unsupported decoration or case transform")
        font_size = px_value(owner + ".fontSize", value.get("fontSize"))
        line_height, uses_automatic_line_height = line_height_value(
            owner + ".lineHeight", value.get("lineHeight"), font_size
        )
        result.append(
            TypographyToken(
                path=path,
                swift_name=swift_identifier(group_name + "-" + token_name),
                family=family,
                weight=weight,
                size=font_size,
                line_height=line_height,
                uses_automatic_line_height=uses_automatic_line_height,
                letter_spacing=letter_spacing_value(
                    owner + ".letterSpacing", value.get("letterSpacing"), font_size
                ),
            )
        )
    return result


def validate_metadata(document: dict[str, Any]) -> None:
    metadata = document.get("$extensions", {}).get("tokens-bruecke-meta")
    if not isinstance(metadata, dict) or metadata.get("useDTCG") is not True:
        raise TokenValidationError("$extensions.tokens-bruecke-meta.useDTCG must be true")


def render(source: Path) -> str:
    try:
        source_bytes = source.read_bytes()
        document = json.loads(source_bytes)
    except FileNotFoundError as error:
        raise TokenValidationError(f"Token source does not exist: {source}") from error
    except json.JSONDecodeError as error:
        raise TokenValidationError(f"Malformed JSON at {error.lineno}:{error.colno}: {error.msg}") from error
    if not isinstance(document, dict):
        raise TokenValidationError("Token source root must be an object")

    validate_metadata(document)
    primitives = collect_color_primitives(document)
    semantic_names, mode_names, semantics = collect_semantics(document, primitives)
    typography = collect_typography(document)
    digest = hashlib.sha256(source_bytes).hexdigest()

    lines = [
        "// Generated by scripts/generate_design_tokens.py. DO NOT EDIT.",
        f"// Source SHA-256: {digest}",
        "",
        "import SwiftUI",
        "",
        "struct EQGeneratedRGBA: Equatable, Sendable {",
        "    let red: UInt8",
        "    let green: UInt8",
        "    let blue: UInt8",
        "    let alpha: UInt8",
        "",
        "    var color: Color {",
        "        Color(",
        "            .sRGB,",
        "            red: Double(red) / 255,",
        "            green: Double(green) / 255,",
        "            blue: Double(blue) / 255,",
        "            opacity: Double(alpha) / 255",
        "        )",
        "    }",
        "}",
        "",
        "enum EQGeneratedColorPrimitives {",
    ]
    for primitive in primitives.values():
        lines.append(
            f"    static let {primitive.swift_name} = EQGeneratedRGBA(red: {primitive.red}, green: {primitive.green}, blue: {primitive.blue}, alpha: {primitive.alpha})"
        )
    lines += ["}", "", "struct EQGeneratedSemanticColors: Equatable, Sendable {"]
    for name in semantic_names:
        lines.append(f"    let {swift_identifier(name)}: EQGeneratedRGBA")
    lines += ["}", "", "struct EQGeneratedThemeMode: Identifiable, Equatable, Sendable {"]
    lines += [
        "    let id: String",
        "    let displayName: String",
        "    let isSelectable: Bool",
        "    let colors: EQGeneratedSemanticColors",
        "}",
        "",
        "enum EQGeneratedThemes {",
    ]
    mode_constants: list[str] = []
    for mode in mode_names:
        identifier = swift_identifier(mode)
        mode_constants.append(identifier)
        selectable = "Pending" not in mode
        lines.append(f"    static let {identifier} = EQGeneratedThemeMode(")
        lines.append(f"        id: {swift_string(identifier)},")
        lines.append(f"        displayName: {swift_string(mode)},")
        lines.append(f"        isSelectable: {str(selectable).lower()},")
        lines.append("        colors: EQGeneratedSemanticColors(")
        for index, name in enumerate(semantic_names):
            primitive = primitives[semantics[name][mode]]
            comma = "," if index < len(semantic_names) - 1 else ""
            lines.append(
                f"            {swift_identifier(name)}: EQGeneratedColorPrimitives.{primitive.swift_name}{comma}"
            )
        lines += ["        )", "    )", ""]
    joined = ", ".join(mode_constants)
    lines.append(f"    static let all: [EQGeneratedThemeMode] = [{joined}]")
    lines.append(r"    static let selectable = all.filter(\.isSelectable)")
    lines += ["}", "", "enum EQGeneratedFontFamily: String, Sendable {"]
    lines += [
        '    case display = "SF Pro Display"',
        '    case text = "SF Pro Text"',
        "}",
        "",
        "struct EQGeneratedTypographyToken: Equatable, Sendable {",
        "    let family: EQGeneratedFontFamily",
        "    let weight: Int",
        "    let size: CGFloat",
        "    let lineHeight: CGFloat",
        "    let usesAutomaticLineHeight: Bool",
        "    let letterSpacing: CGFloat",
        "}",
        "",
        "enum EQGeneratedTypography {",
    ]
    for token in typography:
        family = "display" if token.family == "SF Pro Display" else "text"
        lines += [
            f"    static let {token.swift_name} = EQGeneratedTypographyToken(",
            f"        family: .{family},",
            f"        weight: {token.weight},",
            f"        size: {number(token.size)},",
            f"        lineHeight: {number(token.line_height)},",
            f"        usesAutomaticLineHeight: {str(token.uses_automatic_line_height).lower()},",
            f"        letterSpacing: {number(token.letter_spacing)}",
            "    )",
        ]
    lines += ["}", "", "enum EQGeneratedTokenMetadata {"]
    lines.append(f"    static let sourceSHA256 = {swift_string(digest)}")
    lines.append(f"    static let semanticColorCount = {len(semantic_names)}")
    lines.append(f"    static let typographyStyleCount = {len(typography)}")
    lines += ["}", ""]
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--check", action="store_true", help="fail if generated output is stale")
    arguments = parser.parse_args(argv)
    try:
        generated = render(arguments.source)
        if arguments.check:
            if not arguments.output.exists() or arguments.output.read_text() != generated:
                print(
                    f"Generated design tokens are stale. Run: {Path(__file__).relative_to(REPOSITORY_ROOT)}",
                    file=sys.stderr,
                )
                return 1
            print("Generated design tokens are up to date.")
            return 0
        arguments.output.parent.mkdir(parents=True, exist_ok=True)
        arguments.output.write_text(generated)
        print(f"Generated {arguments.output.relative_to(REPOSITORY_ROOT)}")
        return 0
    except TokenValidationError as error:
        print(f"Design token validation failed: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
