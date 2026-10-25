import SwiftUI

// MARK: - Themes

/// A complete set of semantic colour roles. Views never reference raw hex values;
/// they read roles through `EQColor`, which resolves against the active theme.
struct EQTheme: Identifiable, Equatable {
    struct ID: RawRepresentable, Hashable, Identifiable {
        let rawValue: String
        var id: String { rawValue }

        init(rawValue: String) {
            self.rawValue = rawValue
        }

        static let mint = Self(rawValue: EQGeneratedThemes.mint.id)
        static let lotso = Self(rawValue: EQGeneratedThemes.lotso.id)
        static let pink = Self(rawValue: EQGeneratedThemes.pink.id)
    }

    struct HomeRoles: Equatable {
        var canvas: Color
        var cardSurface: Color
        /// Workout title on a card; morphs into `Execution.primaryText` on open.
        var cardText: Color
        var primaryText: Color
        var secondaryText: Color
        var cardSecondaryText: Color
        var accent: Color
        var completedText: Color
        var indexText: Color
        var timerAffordance: Color
    }

    struct ExecutionRoles: Equatable {
        var canvas: Color
        /// EXERCISES surface when it is the open, front-most drawer.
        var overviewSurface: Color
        /// EXERCISES surface dimmed behind the expanded IN PROGRESS card.
        var overviewDimmedSurface: Color
        var foregroundSurface: Color
        var restCanvas: Color
        /// EXERCISES surface during rest; matches the Settings group fill, made opaque.
        var restOverviewSurface: Color
        /// IN PROGRESS surface during rest.
        var restForegroundSurface: Color
        /// Text on both wallet cards during rest; matches the Home date.
        var restCardText: Color
        /// Rest countdown; matches the Home "Workout of the day" title.
        var restTimerText: Color
        var primaryText: Color
        var secondaryText: Color
        var overviewText: Color
        var overviewSecondaryText: Color
        var foregroundText: Color
        var foregroundSecondaryText: Color
        var timerText: Color
        var separator: Color
        var walletBorder: Color
        var progressAccent: Color
        var success: Color
        var warning: Color
        var primaryAction: Color
        var metricUnit: Color
        var settingsScrim: Color
        var restAccent: Color
        var destructive: Color
    }

    let id: ID
    let name: String
    let colorScheme: ColorScheme
    /// Representative colours shown in the theme picker.
    let swatches: [Color]

    var background: Color
    var surface: Color
    var surfaceEmphasis: Color
    var accent: Color
    var accentMuted: Color
    var contentPrimary: Color
    var contentSecondary: Color
    var contentOnAccent: Color
    var overlay: Color
    var disabledText: Color
    var surfaceHighlightLight: Color
    var surfaceHighlightDark: Color
    var surfaceInput: Color
    var home: HomeRoles
    var execution: ExecutionRoles

    static let all: [EQTheme] = EQGeneratedThemes.selectable.map { mode in
        EQTheme.generated(id: ID(rawValue: mode.id), mode: mode)
    }
    static let `default` = EQTheme.mint

    static func theme(for id: ID) -> EQTheme {
        all.first(where: { $0.id == id }) ?? .default
    }
}

extension EQTheme {
    static let mint = generated(id: .mint, mode: EQGeneratedThemes.mint)
    static let lotso = generated(id: .lotso, mode: EQGeneratedThemes.lotso)
    static let pink = generated(id: .pink, mode: EQGeneratedThemes.pink)

    private static func generated(id: ID, mode: EQGeneratedThemeMode) -> EQTheme {
        let colors = mode.colors
        let background = colors.background.color
        let surface = colors.surface.color
        let surfaceEmphasis = colors.surfaceEmphasis.color
        let accent = colors.accent.color
        let accentMuted = colors.accentMuted.color
        let contentPrimary = colors.contentPrimary.color
        let contentSecondary = colors.contentSecondary.color
        let contentOnAccent = colors.contentOnAccent.color
        let overlay = colors.overlay.color
        let disabledText = colors.disabledText.color
        let highlightLight = colors.surfaceHighlightLight.color
        let highlightDark = colors.surfaceHighlightDark.color
        let surfaceInput = colors.surfaceInput.color

        return EQTheme(
            id: id,
            name: mode.displayName,
            colorScheme: .dark,
            swatches: [background, accent, accentMuted, contentPrimary],
            background: background,
            surface: surface,
            surfaceEmphasis: surfaceEmphasis,
            accent: accent,
            accentMuted: accentMuted,
            contentPrimary: contentPrimary,
            contentSecondary: contentSecondary,
            contentOnAccent: contentOnAccent,
            overlay: overlay,
            disabledText: disabledText,
            surfaceHighlightLight: highlightLight,
            surfaceHighlightDark: highlightDark,
            surfaceInput: surfaceInput,
            home: HomeRoles(
                canvas: background,
                cardSurface: accent,
                cardText: contentOnAccent,
                primaryText: contentPrimary,
                secondaryText: contentSecondary,
                cardSecondaryText: contentOnAccent,
                accent: accent,
                completedText: contentOnAccent,
                indexText: contentOnAccent,
                timerAffordance: accent
            ),
            execution: ExecutionRoles(
                canvas: background,
                overviewSurface: accent,
                overviewDimmedSurface: accentMuted,
                foregroundSurface: accent,
                restCanvas: background,
                restOverviewSurface: surface,
                restForegroundSurface: surfaceEmphasis,
                restCardText: contentSecondary,
                restTimerText: contentPrimary,
                primaryText: contentPrimary,
                secondaryText: contentSecondary,
                overviewText: contentOnAccent,
                overviewSecondaryText: disabledText,
                foregroundText: contentOnAccent,
                foregroundSecondaryText: disabledText,
                timerText: contentOnAccent,
                separator: highlightDark,
                walletBorder: background,
                progressAccent: contentOnAccent,
                success: contentOnAccent,
                warning: contentOnAccent,
                primaryAction: contentOnAccent,
                metricUnit: contentOnAccent,
                settingsScrim: overlay,
                restAccent: accent,
                destructive: contentOnAccent
            )
        )
    }
}

/// Owns the active theme. `EQColor` reads through this observable store, so any
/// view body that resolves a colour re-renders when the theme changes.
@Observable
final class EQThemeStore {
    static let shared = EQThemeStore()
    static let storageKey = "eq.theme"

    private let defaults: UserDefaults

    var theme: EQTheme {
        didSet { defaults.set(theme.id.rawValue, forKey: Self.storageKey) }
    }

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        let stored = defaults.string(forKey: Self.storageKey).map(EQTheme.ID.init(rawValue:))
        theme = EQTheme.theme(for: stored ?? EQTheme.default.id)
    }

    func select(_ id: EQTheme.ID) {
        guard theme.id != id else { return }
        theme = EQTheme.theme(for: id)
    }
}

// MARK: - Semantic tokens

enum EQColor {
    static var theme: EQTheme { EQThemeStore.shared.theme }

    /// Design-token semantic roles. Feature views should prefer these names;
    /// contextual Home/Execution roles below are mappings, not extra palettes.
    static var background: Color { theme.background }
    static var surface: Color { theme.surface }
    static var surfaceEmphasis: Color { theme.surfaceEmphasis }
    static var accent: Color { theme.accent }
    static var accentMuted: Color { theme.accentMuted }
    static var contentPrimary: Color { theme.contentPrimary }
    static var contentSecondary: Color { theme.contentSecondary }
    static var contentOnAccent: Color { theme.contentOnAccent }
    static var overlay: Color { theme.overlay }
    static var disabledText: Color { theme.disabledText }
    static var surfaceHighlightLight: Color { theme.surfaceHighlightLight }
    static var surfaceHighlightDark: Color { theme.surfaceHighlightDark }
    static var surfaceInput: Color { theme.surfaceInput }

    enum Home {
        private static var roles: EQTheme.HomeRoles { EQColor.theme.home }
        static var canvas: Color { roles.canvas }
        static var cardSurface: Color { roles.cardSurface }
        static var cardText: Color { roles.cardText }
        static var timerAffordance: Color { roles.timerAffordance }
        static var primaryText: Color { roles.primaryText }
        static var secondaryText: Color { roles.secondaryText }
        static var cardSecondaryText: Color { roles.cardSecondaryText }
        static var accent: Color { roles.accent }
        static var completedText: Color { roles.completedText }
        static var indexText: Color { roles.indexText }
    }

    enum Execution {
        private static var roles: EQTheme.ExecutionRoles { EQColor.theme.execution }
        static var canvas: Color { roles.canvas }
        static var overviewSurface: Color { roles.overviewSurface }
        static var overviewDimmedSurface: Color { roles.overviewDimmedSurface }
        static var foregroundSurface: Color { roles.foregroundSurface }
        static var restCanvas: Color { roles.restCanvas }
        static var restOverviewSurface: Color { roles.restOverviewSurface }
        static var restForegroundSurface: Color { roles.restForegroundSurface }
        static var restCardText: Color { roles.restCardText }
        static var restTimerText: Color { roles.restTimerText }

        static var primaryText: Color { roles.primaryText }
        static var secondaryText: Color { roles.secondaryText }
        static var overviewText: Color { roles.overviewText }
        static var overviewSecondaryText: Color { roles.overviewSecondaryText }
        static var foregroundText: Color { roles.foregroundText }
        static var foregroundSecondaryText: Color { roles.foregroundSecondaryText }
        static var timerText: Color { roles.timerText }
        static var separator: Color { roles.separator }
        static var walletBorder: Color { roles.walletBorder }
        static var progressAccent: Color { roles.progressAccent }
        static var success: Color { roles.success }
        static var warning: Color { roles.warning }
        static var primaryAction: Color { roles.primaryAction }
        static var metricUnit: Color { roles.metricUnit }
        /// Dims execution content behind the in-progress card while it shows Settings.
        static var settingsScrim: Color { roles.settingsScrim }
        static var restAccent: Color { roles.restAccent }
        static var destructive: Color { roles.destructive }
    }

    // Contextual component roles derived exclusively from the semantic tokens above.
    static var colorScheme: ColorScheme { theme.colorScheme }
    static var success: Color { accent }
    static var warning: Color { accent }
    static var ctaSurface: Color { accent }
    static var ctaLabel: Color { contentOnAccent }
    static var ctaDisabledSurface: Color { surfaceHighlightLight }
    static var ctaDisabledLabel: Color { contentSecondary }

}

enum EQTypographyScaling {
    case fixed
    case dynamic(relativeTo: Font.TextStyle, maximumScale: CGFloat)
}

struct EQTextStyle {
    let size: CGFloat
    let lineHeight: CGFloat
    let weight: Font.Weight
    let design: Font.Design
    let tracking: CGFloat
    let usesAutomaticLineHeight: Bool
    let scaling: EQTypographyScaling

    init(
        size: CGFloat,
        lineHeight: CGFloat? = nil,
        weight: Font.Weight = .regular,
        design: Font.Design = .default,
        tracking: CGFloat = 0,
        usesAutomaticLineHeight: Bool = false,
        scaling: EQTypographyScaling = .fixed
    ) {
        self.size = size
        self.lineHeight = lineHeight ?? size
        self.weight = weight
        self.design = design
        self.tracking = tracking
        self.usesAutomaticLineHeight = usesAutomaticLineHeight
        self.scaling = scaling
    }

    init(
        token: EQGeneratedTypographyToken,
        relativeTo textStyle: Font.TextStyle,
        maximumScale: CGFloat
    ) {
        size = token.size
        lineHeight = token.lineHeight
        weight = Self.fontWeight(token.weight)
        design = .default
        tracking = token.letterSpacing
        usesAutomaticLineHeight = token.usesAutomaticLineHeight
        scaling = .dynamic(relativeTo: textStyle, maximumScale: maximumScale)
    }

    var font: Font {
        .system(size: size, weight: weight, design: design)
    }

    private static func fontWeight(_ value: Int) -> Font.Weight {
        switch value {
        case 100: .ultraLight
        case 200: .thin
        case 300: .light
        case 500: .medium
        case 600: .semibold
        case 700: .bold
        case 800: .heavy
        case 900: .black
        default: .regular
        }
    }

    // Compatibility aliases keep feature code source-stable while all reusable
    // specifications resolve to generated Figma tokens.
    static let display = EQTypography.displayTimer
    static let screenTitle = EQTypography.headingPage
    static let sectionTitle = EQTypography.headingCard
    static let exerciseTitle = EQTypography.headingCard
    static let largeMetric = EQTypography.displayValue
    static let metricUnit = EQTypography.displayUnit
    static let body = EQTypography.bodyDefault
    static let secondaryBody = EQTypography.bodySmall
    static let sectionLabel = EQTypography.labelOverline
    static let caption = EQTypography.bodySmall
    static let captionEmphasized = EQTypography.labelAction
    static let legal = EQTypography.labelOverline
    static let navigationTitle = EQTypography.headingSection
    /// The settled title rendered by the Home-to-Execution transition layer.
    static let executionNavigationTitle = EQTypography.bodyDefault
    static let cardHero = EQTypography.headingCard
    static let listItemTitle = EQTypography.bodyDefault
    /// SF Symbol sizing is component geometry rather than text typography.
    static let icon = EQTextStyle(size: EQGeneratedTypography.headingSection.size)
    static let carouselIndex = EQTypography.displayIndex
    static let transitionDestinationTitle = EQTypography.headingCard

    static func timerMetric(size: CGFloat) -> EQTextStyle {
        EQTextStyle(
            size: size,
            lineHeight: size * EQGeneratedTypography.displayTimer.lineHeight / EQGeneratedTypography.displayTimer.size,
            design: .rounded,
            scaling: .dynamic(relativeTo: .largeTitle, maximumScale: 1.25)
        )
    }
}

enum EQTypography {
    static let displayPR = EQTextStyle(token: EQGeneratedTypography.displayPr, relativeTo: .largeTitle, maximumScale: 1.5)
    static let displayTimer = EQTextStyle(token: EQGeneratedTypography.displayTimer, relativeTo: .largeTitle, maximumScale: 1.25)
    static let displayIndex = EQTextStyle(token: EQGeneratedTypography.displayIndex, relativeTo: .largeTitle, maximumScale: 1)
    static let displayUnit = EQTextStyle(token: EQGeneratedTypography.displayUnit, relativeTo: .largeTitle, maximumScale: 1.25)
    static let displayValue = EQTextStyle(token: EQGeneratedTypography.displayValue, relativeTo: .largeTitle, maximumScale: 1.25)
    static let headingPage = EQTextStyle(token: EQGeneratedTypography.headingPage, relativeTo: .title2, maximumScale: 1.5)
    static let headingCard = EQTextStyle(token: EQGeneratedTypography.headingCard, relativeTo: .title, maximumScale: 1.7)
    static let headingSection = EQTextStyle(token: EQGeneratedTypography.headingSection, relativeTo: .title3, maximumScale: 2)
    static let bodyLarge = EQTextStyle(token: EQGeneratedTypography.bodyLarge, relativeTo: .title3, maximumScale: 2.2)
    static let bodyDefault = EQTextStyle(token: EQGeneratedTypography.bodyDefault, relativeTo: .body, maximumScale: 3)
    static let bodySmall = EQTextStyle(token: EQGeneratedTypography.bodySmall, relativeTo: .subheadline, maximumScale: 3)
    static let labelAction = EQTextStyle(token: EQGeneratedTypography.labelAction, relativeTo: .body, maximumScale: 2.5)
    static let labelOverline = EQTextStyle(token: EQGeneratedTypography.labelOverline, relativeTo: .caption2, maximumScale: 2)
}

private struct EQTextStyleModifier: ViewModifier {
    let style: EQTextStyle
    @ScaledMetric private var scaledSize: CGFloat

    init(style: EQTextStyle) {
        self.style = style
        switch style.scaling {
        case .fixed:
            _scaledSize = ScaledMetric(wrappedValue: style.size)
        case .dynamic(let textStyle, _):
            _scaledSize = ScaledMetric(wrappedValue: style.size, relativeTo: textStyle)
        }
    }

    func body(content: Content) -> some View {
        let maximumScale: CGFloat = switch style.scaling {
        case .fixed: 1
        case .dynamic(_, let maximumScale): maximumScale
        }
        let effectiveSize = min(scaledSize, style.size * maximumScale)
        let scale = effectiveSize / style.size
        content
            .font(.system(size: effectiveSize, weight: style.weight, design: style.design))
            .tracking(style.tracking * scale)
            .lineSpacing(style.usesAutomaticLineHeight ? 0 : max(0, (style.lineHeight - style.size) * scale))
    }
}

extension View {
    func eqTextStyle(_ style: EQTextStyle) -> some View {
        modifier(EQTextStyleModifier(style: style))
    }
}

/// App-wide date presentation: "October 2nd" with a raised ordinal suffix, optionally followed by the year.
enum EQDateText {
    static func ordinalSuffix(_ day: Int) -> String {
        switch day {
        case 11...13: "th"
        default:
            switch day % 10 {
            case 1: "st"
            case 2: "nd"
            case 3: "rd"
            default: "th"
            }
        }
    }

    static func string(_ date: Date, includeYear: Bool = true) -> String {
        let calendar = Calendar.current
        let day = calendar.component(.day, from: date)
        let base = "\(date.formatted(.dateTime.month(.wide))) \(day)\(ordinalSuffix(day))"
        return includeYear ? "\(base), \(calendar.component(.year, from: date))" : base
    }

    static func text(_ date: Date, style: EQTextStyle, includeYear: Bool = true) -> Text {
        let year = includeYear ? ", \(Calendar.current.component(.year, from: date))" : ""
        return ordinal(date, prefix: date.formatted(.dateTime.month(.wide)), style: style, trailing: year)
    }

    /// Weekday and day of month, e.g. "Saturday 27th", for lists already grouped by month.
    static func dayText(_ date: Date, style: EQTextStyle) -> Text {
        ordinal(date, prefix: date.formatted(.dateTime.weekday(.wide)), style: style, trailing: "")
    }

    static func dayString(_ date: Date) -> String {
        let day = Calendar.current.component(.day, from: date)
        return "\(date.formatted(.dateTime.weekday(.wide))) \(day)\(ordinalSuffix(day))"
    }

    private static func ordinal(_ date: Date, prefix: String, style: EQTextStyle, trailing: String) -> Text {
        let day = Calendar.current.component(.day, from: date)
        let suffix = Text(ordinalSuffix(day))
            .font(.system(size: (style.size * 15 / 28).rounded(), weight: style.weight, design: style.design))
            .baselineOffset((style.size / 4).rounded())
        return Text("\(prefix) \(day)\(suffix)\(trailing)").font(style.font)
    }
}

enum EQSpacing {
    static let xxs: CGFloat = 4
    static let xs: CGFloat = 8
    static let sm: CGFloat = 12
    static let md: CGFloat = 16
    static let lg: CGFloat = 24
    static let xl: CGFloat = 32
    static let xxl: CGFloat = 40
    static let xxxl: CGFloat = 48
}

enum EQRadius {
    static let compact: CGFloat = 8
    static let walletSurface: CGFloat = 16
    static let button: CGFloat = 14
    static let card: CGFloat = 16
    static let largeSurface: CGFloat = 32
    static let sheet: CGFloat = 32

    // Compatibility aliases.
    static let transformingCard = walletSurface
    static let control = button
    static let hero = largeSurface
}

enum EQLayout {
    static let screenGutter = EQSpacing.lg
    static let cardInset = EQSpacing.lg
    static let sectionGap = EQSpacing.lg
    static let exerciseBlockGap = EQSpacing.lg
    static let groupedCardGap = EQSpacing.md
    /// Vertical separation before a new eyebrow-labeled group across app surfaces.
    static let labeledGroupGap = EQSpacing.xl
    static let controlGap = EQSpacing.sm
    static let minimumTouch: CGFloat = 44
    static let inputHeight: CGFloat = 48
    static let iconSize: CGFloat = 24

    enum ProgressIndicator {
        static let compactSize: CGFloat = 16
        static let lineWidth: CGFloat = 3
    }

    enum WorkoutExecution {
        static let walletInset = EQSpacing.lg
        static let walletEdgeInset = EQSpacing.xs
        /// Shifts trailing controls into the wallet's shared visual-control column,
        /// ignoring their larger tap targets.
        static let trailingIconOutset = walletEdgeInset + walletInset - EQLayout.screenGutter
        static let walletBorderWidth: CGFloat = 2
        static let workCardExternalTopGap: CGFloat = 2
        static let headerWalletSpacing: CGFloat = 40
        static let overviewHeaderBottomInset = EQSpacing.xs
        static let overviewContentTopInset = EQSpacing.md
        static let exerciseCompactCardHeight: CGFloat = 104
        static let restCardHeight: CGFloat = 180
        static let standaloneTimerCardHeight: CGFloat = 200
        static let completedSectionTopSpacing: CGFloat = 48
        static let titleToSetsSpacing = EQSpacing.xs
        static let loggedSetSpacing = EQSpacing.xxs
        static let loggedSetIndexWidth = EQSpacing.lg
        static let currentIndicatorSize = EQSpacing.xs

        static let primaryActionHeight: CGFloat = 56
        static let primaryActionTimerWidth: CGFloat = 152
        static let primaryActionTopInset = EQSpacing.lg
        static let primaryActionBottomInset = EQSpacing.lg
        static let primaryActionHorizontalPadding = EQSpacing.lg

        static let compactTimerMetricSize: CGFloat = 48
        static let expandedTimerMetricSize: CGFloat = 64
    }

    enum Home {
        static let workoutCardHeight: CGFloat = 345
        static let cardTopInset: CGFloat = 20
        static let heroTitleDateSpacing: CGFloat = 2
        static let headerIconSize: CGFloat = 20
        static let headerControlSize: CGFloat = 32
        static let carouselIndexParallax = EQSpacing.xxxl
        static let carouselIndexOverflowFraction: CGFloat = 0.20
        static let carouselIndexVerticalOffset: CGFloat = 20
        static let contextualMenuTriggerSize: CGFloat = 56
        static let contextualMenuOverswipeThreshold: CGFloat = 64
        static let overlayBackgroundScale: CGFloat = 0.96
    }

    enum ExerciseOptions {
        /// Content rhythm inside the persistent in-progress exercise card.
        static let headerToContentSpacing = EQSpacing.xxxl
        static let actionsTopSpacing: CGFloat = 56
        static let bottomInset = EQSpacing.lg
    }

    enum OverlayPage {
        static let titleToContentSpacing = EQSpacing.xxl
    }

    enum Settings {
        static let sectionSpacing = EQLayout.labeledGroupGap
        static let sheetTopSpacing = EQSpacing.xxl
        static let sheetTitleToContentSpacing = EQSpacing.lg
    }

    enum Performance {
        static let chartHeight: CGFloat = 180
    }
}

enum EQDimension {
    static let minimumTouch = EQLayout.minimumTouch
    static let inputHeight = EQLayout.inputHeight
    static let workoutCardHeight = EQLayout.Home.workoutCardHeight
    static let exerciseCompactCardHeight = EQLayout.WorkoutExecution.exerciseCompactCardHeight
    static let restCardHeight = EQLayout.WorkoutExecution.restCardHeight
}

enum EQMotion {
    static let objectTransformationDuration: TimeInterval = 0.34
    static let reducedContentTransitionDuration: TimeInterval = 0.12
    static let timerDigitRollDuration: TimeInterval = 0.42
    /// Immediate control acknowledgement and small content changes.
    static let responsive = Animation.easeOut(duration: 0.16)
    static let microTransition = Animation.easeOut(duration: 0.18)
    static let selectionFeedback = Animation.easeOut(duration: 0.08)
    static let themeChange = Animation.easeInOut(duration: 0.25)
    /// Persistent objects changing size or position, without spring overshoot.
    static let objectTransformation = Animation.timingCurve(
        0.22,
        0.78,
        0.22,
        1,
        duration: objectTransformationDuration
    )
    /// Peer surfaces entering or leaving the viewport.
    static let surfaceReveal = Animation.timingCurve(0.33, 0, 0.2, 1, duration: 0.28)
    /// Content changing inside an object that remains in place.
    static let contentTransition = Animation.easeInOut(duration: 0.22)
    /// A controlled mechanical roll for deadline-driven countdown digits.
    static let timerDigitRoll = Animation.easeInOut(duration: timerDigitRollDuration)
    /// Preserves state-change legibility without large spatial motion.
    static let reducedContentTransition = Animation.easeOut(duration: reducedContentTransitionDuration)
}

// MARK: - Reusable primitives

struct EQSurface: View {
    var color = EQColor.surface
    var radius = EQRadius.card

    var body: some View {
        RoundedRectangle(cornerRadius: radius, style: .continuous)
            .fill(color)
    }
}

/// Stable, deadline-reactive timer text. Native numeric transitions animate only
/// changed columns and keep punctuation and unchanged digits fixed in place.
struct EQRollingTimerText: View {
    let value: String
    let reduceMotion: Bool

    var body: some View {
        Text(value)
            .monospacedDigit()
            .contentTransition(
                reduceMotion
                    ? .identity
                    : .numericText(countsDown: true)
            )
            .animation(
                reduceMotion ? nil : EQMotion.timerDigitRoll,
                value: value
            )
    }
}

struct EQSectionHeader<Trailing: View>: View {
    let title: String
    var color = EQColor.contentPrimary
    @ViewBuilder let trailing: () -> Trailing

    var body: some View {
        HStack(spacing: EQLayout.controlGap) {
            Text(title)
                .eqTextStyle(.sectionLabel)
                .foregroundStyle(color)
            Spacer()
            trailing()
        }
        .frame(maxWidth: .infinity, minHeight: EQLayout.minimumTouch, alignment: .leading)
    }
}

struct EQDisclosureRow: View {
    let title: String
    let isExpanded: Bool
    var color = EQColor.contentSecondary
    var animation: Animation?
    var iconTrailingOffset: CGFloat = 0

    var body: some View {
        HStack(spacing: EQLayout.controlGap) {
            Text(title)
                .eqTextStyle(.sectionLabel)
                .foregroundStyle(color)
            Spacer()
            Image(systemName: "chevron.down")
                .eqTextStyle(.sectionLabel)
                .foregroundStyle(color)
                .rotationEffect(.degrees(isExpanded ? 180 : 0))
                .animation(animation, value: isExpanded)
                .frame(width: EQLayout.iconSize)
                .offset(x: iconTrailingOffset)
                .accessibilityHidden(true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .contentShape(Rectangle())
    }
}

struct EQCircularProgressIndicator: View {
    let progress: Double
    var tint = EQColor.accent
    var track = EQColor.surface
    var size = EQLayout.ProgressIndicator.compactSize
    var lineWidth = EQLayout.ProgressIndicator.lineWidth

    var body: some View {
        let fraction = min(max(progress, 0), 1)
        ZStack {
            if fraction == 0 {
                Circle().stroke(EQColor.accentMuted, lineWidth: lineWidth)
            } else {
                Circle().fill(track)
                EQProgressSector(progress: fraction)
                    .fill(tint)
                    .rotationEffect(.degrees(-90))
            }
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}

private struct EQProgressSector: Shape {
    var progress: Double

    var animatableData: Double {
        get { progress }
        set { progress = newValue }
    }

    func path(in rect: CGRect) -> Path {
        let fraction = min(max(progress, 0), 1)
        guard fraction > 0 else { return Path() }
        let center = CGPoint(x: rect.midX, y: rect.midY)
        let radius = min(rect.width, rect.height) / 2
        var path = Path()
        path.move(to: center)
        path.addArc(
            center: center,
            radius: radius,
            startAngle: .degrees(0),
            endAngle: .degrees(360 * fraction),
            clockwise: false
        )
        path.closeSubpath()
        return path
    }
}

struct EQSettingsGlyph: View {
    var color = EQColor.contentSecondary

    var body: some View {
        ZStack {
            Image(systemName: "hexagon")
            Circle()
                .stroke(lineWidth: 1.5)
                .frame(width: EQSpacing.xs, height: EQSpacing.xs)
        }
        .eqTextStyle(.icon)
        .foregroundStyle(color)
        .frame(width: EQLayout.iconSize, height: EQLayout.iconSize)
        .accessibilityHidden(true)
    }
}

struct EQOverlayPageHeader: View {
    let title: String
    let dismiss: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Button(action: dismiss) {
                Image(systemName: "chevron.left")
                    .eqTextStyle(.icon)
                    .frame(
                        width: EQLayout.minimumTouch,
                        height: EQLayout.minimumTouch,
                        alignment: .leading
                    )
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .foregroundStyle(EQColor.contentPrimary)
            .accessibilityLabel("Back to Home")
            .padding(.horizontal, EQLayout.screenGutter)

            Text(title)
                .eqTextStyle(.screenTitle)
                .foregroundStyle(EQColor.contentPrimary)
                .padding(.horizontal, EQLayout.screenGutter)
                .padding(.top, EQSpacing.lg)
                .padding(.bottom, EQLayout.OverlayPage.titleToContentSpacing)
        }
    }
}

struct EQIconButton: View {
    let systemImage: String
    var alignment: Alignment = .center
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: systemImage)
                .eqTextStyle(.icon)
                .frame(width: EQLayout.iconSize, height: EQLayout.iconSize)
                .frame(
                    width: EQLayout.minimumTouch,
                    height: EQLayout.minimumTouch,
                    alignment: alignment
                )
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

struct EQMetricInput: View {
    @Binding var value: String
    let label: String
    let accessibilityLabel: String
    let keyboard: UIKeyboardType
    var valueColor = EQColor.contentPrimary
    var unitColor = EQColor.contentSecondary
    /// Marks an auto-progressed value with a superscript arrow on the unit.
    var progressed = false
    /// Shown above the value only while the row is held; a tap still edits the value.
    var holdLegend: String?
    var legendColor = EQColor.contentSecondary
    @State private var isHolding = false

    /// Cap height of the unit text, so the arrow's top lines up with the top of the label like an exponent.
    private static let unitCapHeight = UIFont.systemFont(ofSize: EQTextStyle.metricUnit.size, weight: .thin).capHeight

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: EQSpacing.xs) {
            TextField(text: $value, prompt: Text("0").foregroundStyle(unitColor)) { EmptyView() }
                .keyboardType(keyboard)
                .eqTextStyle(.largeMetric)
                .monospacedDigit()
                .textFieldStyle(.plain)
                .foregroundStyle(valueColor)
                .fixedSize(horizontal: true, vertical: false)
                .frame(minWidth: EQLayout.minimumTouch, alignment: .leading)
                .accessibilityLabel(accessibilityLabel)
                .tint(valueColor)
                .background(EQNumberPadInstaller(allowsDecimal: keyboard == .decimalPad))
                .onReceive(NotificationCenter.default.publisher(for: UITextField.textDidBeginEditingNotification)) { note in
                    guard let field = note.object as? UITextField,
                          field.keyboardType == keyboard,
                          (field.text ?? "") == value else { return }
                    if !(field.inputView is EQNumberPadInputView) {
                        field.inputView = EQNumberPadInputView(
                            field: field,
                            allowsDecimal: keyboard == .decimalPad
                        )
                        field.reloadInputViews()
                    }
                    guard !value.isEmpty else { return }
                    // Selection must be applied after UIKit finishes placing the caret.
                    Task { @MainActor in field.selectAll(nil) }
                }
            Text(label.lowercased())
                .eqTextStyle(.metricUnit)
                .foregroundStyle(unitColor)
            if progressed {
                Image(systemName: "arrow.up")
                    .eqTextStyle(EQTypography.headingSection)
                    .foregroundStyle(unitColor)
                    .alignmentGuide(.firstTextBaseline) { _ in Self.unitCapHeight }
                    .padding(.leading, -EQSpacing.xxs)
                    .accessibilityLabel("Progressed")
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .overlay {
            if holdLegend != nil {
                EQHoldSurface(isHolding: $isHolding)
            }
        }
        .overlay(alignment: .topLeading) {
            if let holdLegend {
                legendText(holdLegend)
                    .foregroundStyle(legendColor)
                    .fixedSize()
                    .opacity(isHolding ? 1 : 0)
                    .offset(y: -Self.legendLift + (isHolding ? 0 : EQSpacing.xxs))
                    .animation(EQMotion.microTransition, value: isHolding)
                    .allowsHitTesting(false)
                    .accessibilityHidden(true)
            }
        }
        .onChange(of: holdLegend == nil) { _, hidden in if hidden { isHolding = false } }
        .accessibilityHint(holdLegend ?? "")
    }

    private static let legendLift: CGFloat = 34

    // The number matches the exercise title; the unit suffix is thin, like the metric unit.
    private func legendText(_ legend: String) -> Text {
        let parts = legend.split(separator: " ", maxSplits: 1).map(String.init)
        let style = EQTextStyle.exerciseTitle
        let number = Text(parts[0]).font(.system(size: style.size)).fontWeight(style.weight).monospacedDigit()
        guard parts.count > 1 else { return number }
        return number + Text(" " + parts[1]).font(.system(size: style.size)).fontWeight(.thin)
    }
}

enum EQPrimaryCTAVariant: Equatable {
    case filled
    case outlined
}

private struct EQPrimaryCTAButtonStyle: ButtonStyle {
    let tint: Color
    let foreground: Color
    let variant: EQPrimaryCTAVariant

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .eqTextStyle(.listItemTitle)
            .foregroundStyle(variant == .filled ? foreground : tint)
            .background {
                RoundedRectangle(cornerRadius: EQRadius.button, style: .continuous)
                    .fill(variant == .filled ? tint : Color.clear)
            }
            .overlay {
                RoundedRectangle(cornerRadius: EQRadius.button, style: .continuous)
                    .stroke(variant == .outlined ? tint : Color.clear, lineWidth: 1)
            }
            // Outlined buttons have a clear fill, so define the hit area as the whole shape.
            .contentShape(RoundedRectangle(cornerRadius: EQRadius.button, style: .continuous))
            .opacity(configuration.isPressed ? 0.72 : 1)
    }
}

struct EQCardModifier: ViewModifier {
    var elevated = false
    var surface: Color?
    var text: Color?
    var border: Color?

    func body(content: Content) -> some View {
        content
            .padding(EQSpacing.md)
            .foregroundStyle(text ?? EQColor.contentPrimary)
            .background(
                surface ?? (elevated ? EQColor.surfaceEmphasis : EQColor.surface),
                in: RoundedRectangle(cornerRadius: EQRadius.card, style: .continuous)
            )
            .overlay {
                RoundedRectangle(cornerRadius: EQRadius.card, style: .continuous)
                    .stroke(border ?? EQColor.surfaceHighlightLight)
            }
    }
}

struct EQGroupedCardModifier: ViewModifier {
    let verticalPadding: CGFloat
    let fill: Color

    func body(content: Content) -> some View {
        content
            .padding(.horizontal, EQSpacing.md)
            .padding(.vertical, verticalPadding)
            .background(
                fill,
                in: RoundedRectangle(cornerRadius: EQRadius.card, style: .continuous)
            )
    }
}

extension View {
    func eqCard(
        elevated: Bool = false,
        surface: Color? = nil,
        text: Color? = nil,
        border: Color? = nil
    ) -> some View {
        modifier(EQCardModifier(elevated: elevated, surface: surface, text: text, border: border))
    }

    /// A grouped content surface used by Settings and similarly structured lists.
    func eqGroupedCard(
        verticalPadding: CGFloat = EQSpacing.xs,
        fill: Color = EQColor.surfaceHighlightLight
    ) -> some View {
        modifier(EQGroupedCardModifier(verticalPadding: verticalPadding, fill: fill))
    }

    func eqPrimaryCTA(
        tint: Color,
        foreground: Color = EQColor.contentPrimary,
        variant: EQPrimaryCTAVariant = .filled
    ) -> some View {
        buttonStyle(EQPrimaryCTAButtonStyle(tint: tint, foreground: foreground, variant: variant))
    }

    func eqOutlinedControl(tint: Color) -> some View {
        eqTextStyle(.body)
            .foregroundStyle(tint)
            .frame(maxWidth: .infinity, minHeight: EQLayout.WorkoutExecution.primaryActionHeight)
            .contentShape(RoundedRectangle(cornerRadius: EQRadius.button, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: EQRadius.button, style: .continuous)
                    .strokeBorder(tint, lineWidth: 1)
            }
    }
}
