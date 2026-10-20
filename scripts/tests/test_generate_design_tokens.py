import copy
import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
MODULE_PATH = ROOT / "scripts" / "generate_design_tokens.py"
SPEC = importlib.util.spec_from_file_location("generate_design_tokens", MODULE_PATH)
assert SPEC and SPEC.loader
generator = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = generator
SPEC.loader.exec_module(generator)


class DesignTokenGeneratorTests(unittest.TestCase):
    def setUp(self):
        source = ROOT / "DesignSystem" / "Tokens" / "design.tokens.json"
        self.document = json.loads(source.read_text())

    def render(self, document):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "tokens.json"
            source.write_text(json.dumps(document, ensure_ascii=False))
            return generator.render(source)

    def test_generates_every_exported_semantic_and_typography_token(self):
        swift = self.render(self.document)
        self.assertIn("static let mint", swift)
        self.assertIn("static let lotso", swift)
        self.assertIn("static let pink", swift)
        self.assertIn("let surfaceHighlightDark: EQGeneratedRGBA", swift)
        self.assertIn("let surfaceInput: EQGeneratedRGBA", swift)
        self.assertIn("static let displayPr", swift)
        self.assertIn("static let displayTimer", swift)
        self.assertIn("static let labelOverline", swift)
        self.assertIn("static let semanticColorCount = 13", swift)
        self.assertIn("static let typographyStyleCount = 13", swift)

    def test_preserves_exported_alpha_bytes(self):
        swift = self.render(self.document)
        self.assertIn("blackAlpha40 = EQGeneratedRGBA(red: 0, green: 0, blue: 0, alpha: 102)", swift)
        self.assertIn("blackAlpha24 = EQGeneratedRGBA(red: 0, green: 0, blue: 0, alpha: 61)", swift)
        self.assertIn("whiteWhite04 = EQGeneratedRGBA(red: 255, green: 255, blue: 255, alpha: 10)", swift)

    def test_rejects_a_dangling_alias(self):
        document = copy.deepcopy(self.document)
        document["Semantic Colors"]["accent"]["$value"] = "{Primitives.lime.missing}"
        with self.assertRaisesRegex(generator.TokenValidationError, "missing primitive"):
            self.render(document)

    def test_rejects_incomplete_theme_modes(self):
        document = copy.deepcopy(self.document)
        del document["Semantic Colors"]["surface"]["$extensions"]["mode"]["Pink"]
        with self.assertRaisesRegex(generator.TokenValidationError, "mode names/order"):
            self.render(document)

    def test_rejects_unsupported_typography_units(self):
        document = copy.deepcopy(self.document)
        document["Typography-styles"]["body"]["default"]["$value"]["fontSize"]["unit"] = "rem"
        with self.assertRaisesRegex(generator.TokenValidationError, "must use px units"):
            self.render(document)

    def test_preserves_automatic_line_height_and_percentage_tracking(self):
        swift = self.render(self.document)
        self.assertIn("static let displayPr", swift)
        self.assertIn("usesAutomaticLineHeight: true", swift)

    def test_rejects_unsupported_percentage_tracking(self):
        document = copy.deepcopy(self.document)
        document["Typography-styles"]["display"]["pr"]["$value"]["letterSpacing"] = "wide"
        with self.assertRaisesRegex(generator.TokenValidationError, "must use px units"):
            self.render(document)

    def test_theme_names_with_spaces_and_punctuation_form_stable_identifiers(self):
        self.assertEqual(generator.swift_identifier("Mint"), "mint")
        self.assertEqual(generator.swift_identifier("Lotso"), "lotso")


if __name__ == "__main__":
    unittest.main()
