# Equilibrium design system

`Tokens/design.tokens.json` is the authoritative Figma export for reusable color and typography decisions. Its contents are preserved verbatim. Production views do not parse it at runtime.

The data flow is:

```text
Figma export
  → DesignSystem/Tokens/design.tokens.json
  → scripts/generate_design_tokens.py
  → Equilibrium/DesignSystem/GeneratedDesignTokens.swift
  → EQTheme / EQColor / EQTypography / EQTextStyle
  → views and shared components
```

`GeneratedDesignTokens.swift` is checked in so builds are deterministic and do not require Python. It must never be edited by hand.

## Regenerating tokens

1. Export DTCG JSON from Figma.
2. Replace `DesignSystem/Tokens/design.tokens.json` without editing its values or descriptions.
3. Run:

   ```sh
   python3 scripts/generate_design_tokens.py
   python3 scripts/generate_design_tokens.py --check
   python3 -m unittest discover -s scripts/tests -v
   python3 scripts/audit_design_system.py
   ```

4. Build and run the XCTest suite.
5. Compare Home, active workout, Rest, history, exercise selection, overlays, and Settings at normal and accessibility Dynamic Type sizes.

The generator validates DTCG metadata, color encoding, primitive aliases, complete mode mappings, required semantic roles, typography families/weights/units, and stable Swift identifiers. Invalid input fails with a targeted message. `--check` fails if generated Swift is stale.

## Colors and themes

Primitives are generated as exact RGBA bytes. Semantic palettes retain references to generated primitives rather than copying hex values. Views use semantic roles such as `EQColor.background`, `surface`, `surfaceEmphasis`, `accent`, `contentPrimary`, and `contentOnAccent`. The contextual `EQColor.Home` and `EQColor.Execution` namespaces are mappings of those same semantic tokens; they are not separate palettes.

`EQThemeStore` is the single selection and persistence mechanism. It is available in the SwiftUI environment and persists the stable generated theme ID under `eq.theme`. Mint, Lotso, and Pink are complete generated modes and are selectable in Settings. Mint is the fallback for a new install, a missing preference, or an obsolete theme ID. A stored supported ID is preserved.

The generated modes resolve semantic aliases to primitives at generation time. Feature code never knows whether, for example, `content-on-accent` maps to electric, navy, or Lotso. Sheets and overlays read the same observable store as their presenting screens, so a selection updates the whole hierarchy.

### Export inconsistencies retained intentionally

- `lime.400` is `#D6FF8B`, although its description references `#D8FF66`.
- `lime.600` is `#B3D96D`, although its description references `#9FBF3C`.
- `overlay` resolves to `black.alpha-40` (`#00000066`, 40%) in every mode, although its description says 4%. The value and mode mapping are authoritative. `disabled-text` remains 24% black and `surface-highlight-dark` remains 4% black; these roles are not interchangeable.
- `display/value` has weight 400 but its description repeats the copy for the thin unit style. The generated specification follows the value.

The JSON is never modified to hide these source inconsistencies.

## Typography

`EQGeneratedTypography` stores every exported family, weight, size, line height, and letter spacing value, including `display/pr`. The generator preserves the export's `auto` line-height intent and accepts DTCG pixel values or percentage tracking. `EQTypography` converts those specifications into native SwiftUI styles using the system San Francisco fonts. Text color remains independent.

Reading and interface styles scale through Dynamic Type. Oversized timer styles have bounded scaling, and the 300pt display index is intentionally fixed to protect the workout-card geometry. `EQTextStyle` compatibility names resolve to generated styles so existing views and matched-geometry transitions keep stable identities while using the centralized source.

Component-intrinsic symbol sizing and geometry may remain local. Examples include an SF Symbol's point size or the curved duration wheel's 52pt numeral geometry. These are not reusable text styles and should still be expressed through `EQTextStyle`, not a raw `.font(.system(...))` in feature code.

## Spacing, radii, and motion

The Figma file does not define these categories. Existing `EQSpacing`, `EQRadius`, `EQLayout`, and `EQMotion` remain the centralized foundation because they encode the shipped geometry and transition behavior. Add only recurring visual decisions. A value unique to one drawing or interaction should stay next to that component rather than becoming an arbitrary global scale entry.

## Current semantic limitations

The export contains no independent warning, destructive, success, separator, rest, or chart palette. Existing compatibility roles therefore map to the supplied semantic colors:

- success, warning, rest, and primary action → `accent` or `content-on-accent`, depending on surface;
- destructive content on the lime exercise card → `content-on-accent`;
- grouped highlights → `surface-highlight-light` or `surface-highlight-dark`;
- chart line/point → `accent` and `accent-muted`;
- exercise-settings scrim → `overlay`.

No orange or other legacy color is retained outside the token source. If a distinct status color is required, add a semantic token in Figma first, export it, regenerate, and then update the contextual mapping.

## Development rule

All new reusable colors and typography must come from the centralized token system. Do not add hex, RGB, raw named palette colors, or reusable `.font(.system(...))` specifications to feature views. Introduce a new semantic token in Figma first, then export and regenerate. Run `scripts/audit_design_system.py` before review.

Exceptions are limited to transparent system integration (`Color.clear`/`UIColor.clear`), data-driven opacity used for animation, and genuinely unique drawing geometry. Document any new exception beside the code.
