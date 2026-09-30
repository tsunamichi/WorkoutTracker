import SwiftUI

// MARK: - Semantic tokens

enum EQColor {
    static let productCanvas = rgb(0xFAFAFA)
    static let primaryActionSurface = rgb(0xE0FB60)
    static let deepExecutionSurface = rgb(0x133011)
    static let restActionAccent = rgb(0xFFA424)
    static let textPrimary = rgb(0x1F1F1F)
    static let textSecondary = rgb(0x717171)

    enum Home {
        static let canvas = EQColor.productCanvas
        static let cardSurface = EQColor.primaryActionSurface
        static let primaryText = EQColor.textPrimary
        static let secondaryText = EQColor.textSecondary
        static let cardSecondaryText = EQColor.deepExecutionSurface
        static let accent = EQColor.deepExecutionSurface
        static let completedText = EQColor.deepExecutionSurface
        static let indexText = EQColor.deepExecutionSurface.opacity(0.96)
    }

    enum Execution {
        static let canvas = EQColor.productCanvas
        static let overviewSurface = EQColor.primaryActionSurface
        static let foregroundSurface = EQColor.deepExecutionSurface
        static let restCanvas = EQColor.restActionAccent
        static let restOverviewSurface = EQColor.rgb(0xEA9000)

        static let primaryText = EQColor.textPrimary
        static let secondaryText = EQColor.textSecondary
        static let overviewText = EQColor.deepExecutionSurface
        static let overviewSecondaryText = EQColor.deepExecutionSurface.opacity(0.56)
        static let foregroundText = EQColor.primaryActionSurface
        static let foregroundSecondaryText = EQColor.primaryActionSurface.opacity(0.30)
        static let timerText = EQColor.deepExecutionSurface
        static let separator = EQColor.deepExecutionSurface.opacity(0.22)
        static let walletBorder = EQColor.productCanvas
        static let progressAccent = EQColor.deepExecutionSurface
        static let success = EQColor.deepExecutionSurface
        static let warning = EQColor.restActionAccent
        static let primaryAction = EQColor.restActionAccent
        static let metricUnit = EQColor.restActionAccent.opacity(0.24)
        static let restAccent = EQColor.restActionAccent
        static let destructive = EQColor.restActionAccent
    }

    // General application roles. Feature contexts refine these where surfaces carry
    // stronger meaning, such as Workout Execution's lime and deep-green wallet.
    static let canvas = productCanvas
    static let surface = Color.white
    static let elevatedSurface = rgb(0xF1F1F1)
    static let primaryText = textPrimary
    static let secondaryText = textSecondary
    static let separator = textPrimary.opacity(0.12)
    static let accent = deepExecutionSurface
    static let success = deepExecutionSurface
    static let warning = restActionAccent
    static let rest = restActionAccent

    private static func rgb(_ value: UInt32, opacity: Double = 1) -> Color {
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
    static let largeMetric = EQTextStyle(size: 68)
    static let metricUnit = EQTextStyle(size: 68)
    static let body = EQTextStyle(size: 17)
    static let secondaryBody = EQTextStyle(size: 15)
    static let sectionLabel = EQTextStyle(size: 12)
    static let caption = EQTextStyle(size: 15)
    static let captionEmphasized = EQTextStyle(size: 15, weight: .bold)
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
        static let headerWalletSpacing: CGFloat = 40
        static let overviewHeaderBottomInset = EQSpacing.xs
        static let overviewContentTopInset = EQSpacing.md
        static let exerciseCompactCardHeight: CGFloat = 104
        static let restCardHeight: CGFloat = 180
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
        static let addWorkoutActionIconSize: CGFloat = 40
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
    /// Immediate control acknowledgement and small content changes.
    static let responsive = Animation.easeOut(duration: 0.16)
    /// Persistent objects changing size or position, without spring overshoot.
    static let objectTransformation = Animation.timingCurve(0.22, 0.78, 0.22, 1, duration: 0.34)
    /// Peer surfaces entering or leaving the viewport.
    static let surfaceReveal = Animation.timingCurve(0.33, 0, 0.2, 1, duration: 0.28)
    /// Content changing inside an object that remains in place.
    static let contentTransition = Animation.easeInOut(duration: 0.22)
    /// Preserves state-change legibility without large spatial motion.
    static let reducedContentTransition = Animation.easeOut(duration: 0.12)
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

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: EQSpacing.xs) {
            TextField("0", text: $value)
                .keyboardType(keyboard)
                .eqTextStyle(.largeMetric)
                .monospacedDigit()
                .textFieldStyle(.plain)
                .foregroundStyle(valueColor)
                .fixedSize(horizontal: true, vertical: false)
                .frame(minWidth: EQLayout.minimumTouch, alignment: .leading)
                .accessibilityLabel(accessibilityLabel)
            Text(label.lowercased())
                .eqTextStyle(.metricUnit)
                .foregroundStyle(unitColor)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

enum EQPrimaryCTAVariant {
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
        foreground: Color = EQColor.textPrimary,
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
