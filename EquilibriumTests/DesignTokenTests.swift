import XCTest
@testable import Equilibrium

final class DesignTokenIntegrityTests: XCTestCase {
    func testGeneratedTokenCountsMatchTheExport() {
        XCTAssertEqual(EQGeneratedTokenMetadata.semanticColorCount, 13)
        XCTAssertEqual(EQGeneratedTokenMetadata.typographyStyleCount, 13)
        XCTAssertEqual(EQGeneratedThemes.all.count, 3)
        XCTAssertEqual(Set(EQGeneratedThemes.selectable.map(\.displayName)), Set(["Mint", "Lotso", "Pink"]))
    }

    func testGeneratedAlphaChannelsPreserveTheExport() {
        XCTAssertEqual(EQGeneratedColorPrimitives.blackAlpha40.alpha, 102)
        XCTAssertEqual(EQGeneratedColorPrimitives.blackAlpha24.alpha, 61)
        XCTAssertEqual(EQGeneratedColorPrimitives.blackAlpha04.alpha, 10)
        XCTAssertEqual(EQGeneratedColorPrimitives.whiteWhite04.alpha, 10)
        XCTAssertEqual(EQGeneratedColorPrimitives.whiteWhite24.alpha, 61)
    }

    func testMintSemanticAliasesResolveToExpectedPrimitives() {
        let colors = EQGeneratedThemes.mint.colors
        XCTAssertEqual(colors.background, EQGeneratedColorPrimitives.electric900)
        XCTAssertEqual(colors.surface, EQGeneratedColorPrimitives.electric800)
        XCTAssertEqual(colors.surfaceEmphasis, EQGeneratedColorPrimitives.electric700)
        XCTAssertEqual(colors.accent, EQGeneratedColorPrimitives.mint400)
        XCTAssertEqual(colors.accentMuted, EQGeneratedColorPrimitives.mint600)
        XCTAssertEqual(colors.contentPrimary, EQGeneratedColorPrimitives.electric50)
        XCTAssertEqual(colors.contentSecondary, EQGeneratedColorPrimitives.electric200)
        XCTAssertEqual(colors.contentOnAccent, EQGeneratedColorPrimitives.electric900)
        XCTAssertEqual(colors.overlay, EQGeneratedColorPrimitives.blackAlpha40)
        XCTAssertEqual(colors.disabledText, EQGeneratedColorPrimitives.blackAlpha24)
        XCTAssertEqual(colors.surfaceHighlightLight, EQGeneratedColorPrimitives.whiteWhite04)
        XCTAssertEqual(colors.surfaceHighlightDark, EQGeneratedColorPrimitives.blackAlpha04)
        XCTAssertEqual(colors.surfaceInput, EQGeneratedColorPrimitives.whiteWhite24)
    }

    func testLotsoAndPinkUseTheirExportedPalettes() {
        let lotso = EQGeneratedThemes.lotso.colors
        XCTAssertEqual(lotso.background, EQGeneratedColorPrimitives.lotso900)
        XCTAssertEqual(lotso.surface, EQGeneratedColorPrimitives.lotso800)
        XCTAssertEqual(lotso.surfaceEmphasis, EQGeneratedColorPrimitives.lotso700)
        XCTAssertEqual(lotso.accent, EQGeneratedColorPrimitives.lime400)
        XCTAssertEqual(lotso.accentMuted, EQGeneratedColorPrimitives.lime600)
        XCTAssertEqual(lotso.contentPrimary, EQGeneratedColorPrimitives.lotso50)
        XCTAssertEqual(lotso.contentSecondary, EQGeneratedColorPrimitives.lotso200)
        XCTAssertEqual(lotso.contentOnAccent, EQGeneratedColorPrimitives.lotso900)
        assertSharedSemantics(lotso)

        let pink = EQGeneratedThemes.pink.colors
        XCTAssertEqual(pink.background, EQGeneratedColorPrimitives.navy900)
        XCTAssertEqual(pink.surface, EQGeneratedColorPrimitives.navy800)
        XCTAssertEqual(pink.surfaceEmphasis, EQGeneratedColorPrimitives.navy700)
        XCTAssertEqual(pink.accent, EQGeneratedColorPrimitives.pink400)
        XCTAssertEqual(pink.accentMuted, EQGeneratedColorPrimitives.pink600)
        XCTAssertEqual(pink.contentPrimary, EQGeneratedColorPrimitives.navy50)
        XCTAssertEqual(pink.contentSecondary, EQGeneratedColorPrimitives.navy200)
        XCTAssertEqual(pink.contentOnAccent, EQGeneratedColorPrimitives.navy900)
        assertSharedSemantics(pink)
    }

    func testEveryExportedTypographyStyleHasItsExactSpecification() {
        XCTAssertEqual(EQGeneratedTypography.displayPr.size, 40)
        XCTAssertEqual(EQGeneratedTypography.displayPr.weight, 400)
        XCTAssertTrue(EQGeneratedTypography.displayPr.usesAutomaticLineHeight)
        XCTAssertEqual(EQGeneratedTypography.displayTimer.size, 72)
        XCTAssertEqual(EQGeneratedTypography.displayTimer.lineHeight, 80)
        XCTAssertEqual(EQGeneratedTypography.displayIndex.weight, 500)
        XCTAssertEqual(EQGeneratedTypography.displayIndex.size, 300)
        XCTAssertEqual(EQGeneratedTypography.displayUnit.weight, 100)
        XCTAssertEqual(EQGeneratedTypography.headingPage.size, 24)
        XCTAssertEqual(EQGeneratedTypography.headingCard.size, 28)
        XCTAssertEqual(EQGeneratedTypography.headingSection.size, 20)
        XCTAssertEqual(EQGeneratedTypography.bodyLarge.size, 20)
        XCTAssertEqual(EQGeneratedTypography.bodyDefault.size, 16)
        XCTAssertEqual(EQGeneratedTypography.bodySmall.size, 14)
        XCTAssertEqual(EQGeneratedTypography.labelAction.weight, 500)
        XCTAssertEqual(EQGeneratedTypography.labelOverline.size, 11)
        XCTAssertEqual(EQTypography.displayPR.size, 40)
        XCTAssertTrue(EQTypography.displayPR.usesAutomaticLineHeight)
    }

    private func assertSharedSemantics(
        _ colors: EQGeneratedSemanticColors,
        file: StaticString = #filePath,
        line: UInt = #line
    ) {
        XCTAssertEqual(colors.overlay, EQGeneratedColorPrimitives.blackAlpha40, file: file, line: line)
        XCTAssertEqual(colors.disabledText, EQGeneratedColorPrimitives.blackAlpha24, file: file, line: line)
        XCTAssertEqual(colors.surfaceHighlightLight, EQGeneratedColorPrimitives.whiteWhite04, file: file, line: line)
        XCTAssertEqual(colors.surfaceHighlightDark, EQGeneratedColorPrimitives.blackAlpha04, file: file, line: line)
        XCTAssertEqual(colors.surfaceInput, EQGeneratedColorPrimitives.whiteWhite24, file: file, line: line)
    }
}
