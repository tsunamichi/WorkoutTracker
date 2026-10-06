import SwiftUI

// MARK: - Themes

/// A complete set of semantic colour roles. Views never reference raw hex values;
/// they read roles through `EQColor`, which resolves against the active theme.
struct EQTheme: Identifiable, Equatable {
    enum ID: String, CaseIterable, Identifiable {
        case grove
        case dusk
        case orchid
        var id: String { rawValue }
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

    var canvas: Color
    var surface: Color
    var elevatedSurface: Color
    var cardFill: Color
    var primaryText: Color
    var secondaryText: Color
    var separator: Color
    var accent: Color
    var success: Color
    var warning: Color
    var rest: Color
    var overlayDim: Color
    var ctaSurface: Color
    var ctaLabel: Color
    var ctaDisabledSurface: Color
    var ctaDisabledLabel: Color
    var chartLine: Color
    var chartPoint: Color
    var home: HomeRoles
    var execution: ExecutionRoles

    static let all: [EQTheme] = [.grove, .dusk, .orchid]
    static let `default` = EQTheme.grove

    static func theme(for id: ID) -> EQTheme {
        all.first { $0.id == id } ?? .default
    }
}

extension EQTheme {
    private enum GrovePalette {
        static let canvas = EQColor.rgb(0xFAFAFA)
        static let lime = EQColor.rgb(0xE0FB60)
        static let forest = EQColor.rgb(0x133011)
        static let orange = EQColor.rgb(0xFFA424)
        static let orangeDeep = EQColor.rgb(0xEA9000)
        static let ink = EQColor.rgb(0x1F1F1F)
        static let graphite = EQColor.rgb(0x717171)
    }

    /// The original Equilibrium palette: lime and forest green on a light canvas.
    static let grove: EQTheme = {
        typealias P = GrovePalette
        return EQTheme(
            id: .grove,
            name: "Grove",
            colorScheme: .light,
            swatches: [P.canvas, P.lime, P.forest, P.orange],
            canvas: P.canvas,
            surface: .white,
            elevatedSurface: EQColor.rgb(0xF1F1F1),
            cardFill: Color.black.opacity(0.04),
            primaryText: P.ink,
            secondaryText: P.graphite,
            separator: P.ink.opacity(0.12),
            accent: P.forest,
            success: P.forest,
            warning: P.orange,
            rest: P.orange,
            overlayDim: Color.black.opacity(0.06),
            ctaSurface: P.forest,
            ctaLabel: P.orange,
            ctaDisabledSurface: Color.black.opacity(0.04),
            ctaDisabledLabel: P.graphite,
            chartLine: P.forest,
            chartPoint: P.orange,
            home: HomeRoles(
                canvas: P.canvas,
                cardSurface: P.lime,
                cardText: P.ink,
                primaryText: P.ink,
                secondaryText: P.graphite,
                cardSecondaryText: P.forest,
                accent: P.forest,
                completedText: P.forest,
                indexText: P.forest.opacity(0.96),
                timerAffordance: P.graphite
            ),
            execution: ExecutionRoles(
                canvas: P.canvas,
                overviewSurface: P.lime,
                overviewDimmedSurface: P.lime,
                foregroundSurface: P.forest,
                restCanvas: P.canvas,
                restOverviewSurface: P.canvas.mix(with: .black, by: 0.04),
                restForegroundSurface: P.canvas.mix(with: P.ink, by: 0.10),
                restCardText: P.graphite,
                restTimerText: P.ink,
                primaryText: P.ink,
                secondaryText: P.graphite,
                overviewText: P.forest,
                overviewSecondaryText: P.forest.opacity(0.56),
                foregroundText: P.lime,
                foregroundSecondaryText: P.lime.opacity(0.30),
                timerText: P.forest,
                separator: P.forest.opacity(0.22),
                walletBorder: P.canvas,
                progressAccent: P.forest,
                success: P.forest,
                warning: P.orange,
                primaryAction: P.orange,
                metricUnit: P.orange,
                settingsScrim: Color.black.opacity(0.4),
                restAccent: P.orange,
                destructive: P.orange
            )
        )
    }()

    /// Palette for the dark lime-on-canvas family of themes. Only the base hues
    /// vary between themes; the role mapping in `darkLimeTheme` is shared.
    private struct DarkLimePalette {
        var canvas: Color
        var elevated: Color
        var lavender: Color
        var lavenderMuted: Color
        var lavenderDim: Color
        /// IN PROGRESS surface while resting.
        var restSurface: Color
        var lime = EQColor.rgb(0xE1FF7D)
        var olive = EQColor.rgb(0xA6BE53)
        var orange = EQColor.rgb(0xFFA424)
        var orangeDeep = EQColor.rgb(0xEA9000)
    }

    private static func darkLimeTheme(id: ID, name: String, palette P: DarkLimePalette) -> EQTheme {
        EQTheme(
            id: id,
            name: name,
            colorScheme: .dark,
            swatches: [P.canvas, P.lime, P.olive, P.lavender],
            canvas: P.canvas,
            surface: P.elevated,
            elevatedSurface: P.elevated,
            cardFill: Color.white.opacity(0.06),
            primaryText: P.lavender,
            secondaryText: P.lavenderDim,
            separator: P.lavender.opacity(0.14),
            accent: P.lime,
            success: P.lime,
            warning: P.orange,
            rest: P.orange,
            overlayDim: Color.black.opacity(0.16),
            ctaSurface: P.lime,
            ctaLabel: P.canvas,
            ctaDisabledSurface: Color.white.opacity(0.06),
            ctaDisabledLabel: P.lavenderDim,
            chartLine: P.lime,
            chartPoint: P.orange,
            home: HomeRoles(
                canvas: P.canvas,
                cardSurface: P.lime,
                cardText: P.canvas,
                primaryText: P.lavender,
                secondaryText: P.lavenderMuted,
                cardSecondaryText: P.canvas,
                accent: P.lime,
                completedText: P.canvas,
                indexText: P.canvas,
                timerAffordance: P.lime
            ),
            execution: ExecutionRoles(
                canvas: P.canvas,
                overviewSurface: P.lime,
                overviewDimmedSurface: P.olive,
                foregroundSurface: P.lime,
                restCanvas: P.canvas,
                restOverviewSurface: P.canvas.mix(with: .white, by: 0.06),
                restForegroundSurface: P.restSurface,
                restCardText: P.lavenderMuted,
                restTimerText: P.lavender,
                primaryText: P.lavenderMuted,
                secondaryText: P.lavenderMuted,
                overviewText: P.canvas,
                overviewSecondaryText: P.canvas.opacity(0.56),
                foregroundText: P.canvas,
                foregroundSecondaryText: P.canvas.opacity(0.40),
                timerText: P.canvas,
                separator: P.canvas.opacity(0.22),
                walletBorder: P.canvas,
                progressAccent: P.canvas,
                success: P.canvas,
                warning: P.orange,
                primaryAction: P.canvas,
                metricUnit: P.canvas,
                settingsScrim: Color.black.opacity(0.4),
                restAccent: P.orange,
                destructive: P.orange
            )
        )
    }

    /// Lime and olive surfaces on a deep purple canvas.
    static let dusk = darkLimeTheme(
        id: .dusk,
        name: "Dusk",
        palette: DarkLimePalette(
            canvas: EQColor.rgb(0x332C49),
            elevated: EQColor.rgb(0x3E3657),
            lavender: EQColor.rgb(0xE4E1EB),
            lavenderMuted: EQColor.rgb(0xC3BED3),
            lavenderDim: EQColor.rgb(0xA39DB5),
            restSurface: EQColor.rgb(0x57476B)
        )
    )

    /// Dusk's lime surfaces on a warmer plum canvas with pink-tinted text.
    static let orchid = darkLimeTheme(
        id: .orchid,
        name: "Orchid",
        palette: DarkLimePalette(
            canvas: EQColor.rgb(0x462C49),
            elevated: EQColor.rgb(0x513657),
            lavender: EQColor.rgb(0xF4E4F3),
            lavenderMuted: EQColor.rgb(0xD3BED2),
            lavenderDim: EQColor.rgb(0xB39DB4),
            restSurface: EQColor.rgb(0x6A476B)
        )
    )
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
        let stored = defaults.string(forKey: Self.storageKey).flatMap(EQTheme.ID.init(rawValue:))
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
        /// Dims the execution screen behind the exercise settings sheet.
        static var settingsScrim: Color { roles.settingsScrim }
        static var restAccent: Color { roles.restAccent }
        static var destructive: Color { roles.destructive }
    }

    // General application roles. Feature contexts refine these where surfaces carry
    // stronger meaning, such as Workout Execution's wallet.
    static var colorScheme: ColorScheme { theme.colorScheme }
    static var canvas: Color { theme.canvas }
    static var surface: Color { theme.surface }
    static var elevatedSurface: Color { theme.elevatedSurface }
    /// Fill for grouped content cards that sit directly on the canvas.
    static var cardFill: Color { theme.cardFill }
    static var primaryText: Color { theme.primaryText }
    static var secondaryText: Color { theme.secondaryText }
    static var separator: Color { theme.separator }
    static var accent: Color { theme.accent }
    static var success: Color { theme.success }
    static var warning: Color { theme.warning }
    static var rest: Color { theme.rest }
    /// Dims a surface that sits behind a presented overlay.
    static var overlayDim: Color { theme.overlayDim }
    static var ctaSurface: Color { theme.ctaSurface }
    static var ctaLabel: Color { theme.ctaLabel }
    static var ctaDisabledSurface: Color { theme.ctaDisabledSurface }
    static var ctaDisabledLabel: Color { theme.ctaDisabledLabel }
    static var chartLine: Color { theme.chartLine }
    static var chartPoint: Color { theme.chartPoint }

    static func rgb(_ value: UInt32, opacity: Double = 1) -> Color {
        Color(
            .sRGB,
            red: Double((value >> 16) & 0xFF) / 255,
            green: Double((value >> 8) & 0xFF) / 255,
            blue: Double(value & 0xFF) / 255,
            opacity: opacity
        )
    }
}

struct EQTextStyle {
    let size: CGFloat
    let weight: Font.Weight
    let design: Font.Design
    let tracking: CGFloat
    let lineSpacing: CGFloat

    init(
        size: CGFloat,
        weight: Font.Weight = .regular,
        design: Font.Design = .default,
        tracking: CGFloat = 0,
        lineSpacing: CGFloat = 0
    ) {
        self.size = size
        self.weight = weight
        self.design = design
        self.tracking = tracking
        self.lineSpacing = lineSpacing
    }

    var font: Font {
        .system(size: size, weight: weight, design: design)
    }

    static let display = EQTextStyle(size: 56)
    static let screenTitle = EQTextStyle(size: 24, weight: .medium)
    static let sectionTitle = EQTextStyle(size: 28)
    static let exerciseTitle = EQTextStyle(size: 30)
    static let largeMetric = EQTextStyle(size: 72)
    static let metricUnit = EQTextStyle(size: 72, weight: .thin)
    static let body = EQTextStyle(size: 17)
    static let secondaryBody = EQTextStyle(size: 15)
    static let sectionLabel = EQTextStyle(size: 12)
    static let caption = EQTextStyle(size: 15)
    static let captionEmphasized = EQTextStyle(size: 15, weight: .bold)
    static let legal = EQTextStyle(size: 10)
    static let navigationTitle = EQTextStyle(size: 20)
    static let cardHero = EQTextStyle(size: 28, weight: .medium)
    static let listItemTitle = EQTextStyle(size: 16)
    static let icon = EQTextStyle(size: 20)
    static let carouselIndex = EQTextStyle(size: 300, weight: .black)
    static let transitionDestinationTitle = EQTextStyle(size: 28)

    static func timerMetric(size: CGFloat) -> EQTextStyle {
        EQTextStyle(size: size, design: .rounded)
    }
}

private struct EQTextStyleModifier: ViewModifier {
    let style: EQTextStyle

    func body(content: Content) -> some View {
        content
            .font(style.font)
            .tracking(style.tracking)
            .lineSpacing(style.lineSpacing)
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
        /// Shifts trailing icons inside the wallet so they share the header settings
        /// icon's column (screen gutter), ignoring their larger tap targets.
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
        static let addWorkoutActionIconSize: CGFloat = 20
        static let addWorkoutActionCardHeight: CGFloat = 120
        static let addWorkoutSheetTopSpacing: CGFloat = 40
        static let addWorkoutTitleToCardsSpacing: CGFloat = 40
        static let addWorkoutSheetBottomSpacing: CGFloat = 40
        static let addWorkoutSheetHeight: CGFloat = 269
        static let overlayBackgroundScale: CGFloat = 0.96
    }

    enum OverlayPage {
        static let titleToContentSpacing = EQSpacing.xxl
    }

    enum Settings {
        static let sectionSpacing = EQSpacing.xxl
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
    var color = EQColor.primaryText
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
    var color = EQColor.secondaryText
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
    var track = EQColor.secondaryText.opacity(0.3)
    var size = EQLayout.ProgressIndicator.compactSize
    var lineWidth = EQLayout.ProgressIndicator.lineWidth

    var body: some View {
        let fraction = min(max(progress, 0), 1)
        ZStack {
            if fraction == 0 {
                Circle().stroke(tint.opacity(0.42), lineWidth: lineWidth)
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
    var color = EQColor.secondaryText

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
            .foregroundStyle(EQColor.primaryText)
            .accessibilityLabel("Back to Home")
            .padding(.horizontal, EQLayout.screenGutter)

            Text(title)
                .eqTextStyle(.screenTitle)
                .foregroundStyle(EQColor.primaryText)
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
    var valueColor = EQColor.primaryText
    var unitColor = EQColor.secondaryText
    /// Marks an auto-progressed value with a superscript arrow on the unit.
    var progressed = false
    /// Shown above the value only while the row is held; a tap still edits the value.
    var holdLegend: String?
    var legendColor = EQColor.secondaryText
    @State private var isHolding = false

    /// Cap height of the unit text, so the arrow's top lines up with the top of the label like an exponent.
    private static let unitCapHeight = UIFont.systemFont(ofSize: EQTextStyle.metricUnit.size, weight: .thin).capHeight

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: EQSpacing.xs) {
            TextField(text: $value, prompt: Text("0").foregroundStyle(valueColor.opacity(0.2))) { EmptyView() }
                .keyboardType(keyboard)
                .eqTextStyle(.largeMetric)
                .fontWeight(EQTextStyle.largeMetric.weight)
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
                // The app root sets `.fontWeight(.regular)`, which overrides the style's weight.
                .fontWeight(EQTextStyle.metricUnit.weight)
                .foregroundStyle(unitColor)
            if progressed {
                Image(systemName: "arrow.up")
                    .font(.system(size: 18, weight: .regular))
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
                    .animation(.easeOut(duration: 0.18), value: isHolding)
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
            .foregroundStyle(text ?? EQColor.primaryText)
            .background(
                surface ?? (elevated ? EQColor.elevatedSurface : EQColor.surface),
                in: RoundedRectangle(cornerRadius: EQRadius.card, style: .continuous)
            )
            .overlay {
                RoundedRectangle(cornerRadius: EQRadius.card, style: .continuous)
                    .stroke(border ?? EQColor.separator)
            }
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

    func eqPrimaryCTA(
        tint: Color,
        foreground: Color = EQColor.primaryText,
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
                    .stroke(tint, lineWidth: 1)
            }
    }
}
