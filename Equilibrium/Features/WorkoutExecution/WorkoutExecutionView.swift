import Foundation
import SwiftUI
import UIKit
import Observation

enum ExecutionWalletPresentationMode: Equatable {
    case focusedExercise
    case exerciseOverview
}

enum ExerciseCardPresentationMode: Equatable {
    case execution
    case settings
}

/// Geometry captured from the live execution card before focused Settings changes
/// any presentation state. It is intentionally immutable for the complete open /
/// close lifecycle so preference updates cannot move the transition's origin.
private struct ExerciseSettingsTransitionSnapshot: Equatable {
    let exerciseID: WorkoutExerciseID
    let cardFrame: CGRect
    let titleFrame: CGRect
    let destinationFrame: CGRect
}

enum ExerciseFocusedExpansionLayout {
    static let edgeInset = EQLayout.WorkoutExecution.walletEdgeInset
    static let titleScale = EQTextStyle.secondaryBody.size / EQTextStyle.screenTitle.size

    static func destinationFrame(
        containerFrame: CGRect,
        safeAreaInsets: EdgeInsets
    ) -> CGRect {
        // The execution GeometryReader can already begin below the status-bar safe
        // area when it is hosted by Home. Use whichever boundary is lower on screen
        // so that inset is never applied twice.
        // Resolve the status-bar boundary in the common global space. The root
        // GeometryReader may already begin below the safe area, so adding its inset
        // again leaves the workout header exposed.
        let top = max(containerFrame.minY, safeAreaInsets.top)
        let bottom = containerFrame.maxY - edgeInset
        return CGRect(
            x: containerFrame.minX + edgeInset,
            y: top,
            width: max(0, containerFrame.width - (edgeInset * 2)),
            height: max(0, bottom - top)
        )
    }

    static func frame(from source: CGRect, to destination: CGRect, progress: CGFloat) -> CGRect {
        source.walletInterpolated(to: destination, progress: progress)
    }

    /// The visible in-progress object includes the action region that is composited at
    /// the bottom of the wallet. The measured content card stops above that region, so
    /// extend the transition source to the focused surface's fixed bottom edge. This
    /// keeps the object bottom-anchored and prevents the old action region from reading
    /// as a second card during expansion.
    static func bottomAnchoredSourceFrame(
        measuredSource: CGRect,
        destination: CGRect
    ) -> CGRect {
        CGRect(
            x: measuredSource.minX,
            y: measuredSource.minY,
            width: measuredSource.width,
            height: max(measuredSource.height, destination.maxY - measuredSource.minY)
        )
    }

    /// The exact space reserved by `FocusedExerciseSettingsSurface.header` while the
    /// transition renderer owns the exercise name.
    static func settingsEyebrowSlot(surfaceFrame: CGRect) -> CGRect {
        CGRect(
            x: surfaceFrame.minX + EQLayout.WorkoutExecution.walletInset,
            y: surfaceFrame.minY + EQSpacing.lg,
            width: max(0, surfaceFrame.width - (EQLayout.WorkoutExecution.walletInset * 2)),
            height: EQTextStyle.secondaryBody.lineHeight
        )
    }

    static func titleDestinationFrame(surfaceFrame: CGRect, sourceTitleFrame: CGRect) -> CGRect {
        let eyebrowSlot = settingsEyebrowSlot(surfaceFrame: surfaceFrame)
        let titleSize = CGSize(
            width: sourceTitleFrame.width * titleScale,
            height: sourceTitleFrame.height * titleScale
        )

        return CGRect(
            x: eyebrowSlot.minX,
            y: eyebrowSlot.midY - (titleSize.height / 2),
            width: titleSize.width,
            height: titleSize.height
        )
    }
}

enum ExerciseFocusedExpansionMotion {
    // The two content systems make a strict, reversible midpoint handoff. The
    // shared title and upper-right anchor are the only continuous elements.
    static let contentRevealStart: CGFloat = 0.5

    static func focusedContentVisibility(_ progress: CGFloat) -> CGFloat {
        normalized(progress, from: contentRevealStart, through: 1)
    }

    static func titleProgress(_ progress: CGFloat) -> CGFloat {
        min(max(progress, 0), 1)
    }

    private static func normalized(_ value: CGFloat, from start: CGFloat, through end: CGFloat) -> CGFloat {
        guard end > start else { return value >= end ? 1 : 0 }
        return min(max((value - start) / (end - start), 0), 1)
    }
}

private enum ExecutionContextualMenu: Equatable {
    case workout
    case sets(WorkoutExerciseID)

    var triggerID: String {
        switch self {
        case .workout: "execution-workout-options"
        case .sets: "execution-set-options"
        }
    }
}

private struct ExecutionContextualMenuPresentation: Equatable {
    var context: ExecutionContextualMenu = .workout
    var isPresented = false

    mutating func toggle(_ requestedContext: ExecutionContextualMenu) -> Bool {
        if isPresented, context == requestedContext {
            isPresented = false
            return false
        }
        context = requestedContext
        isPresented = true
        return true
    }

    mutating func dismiss() {
        isPresented = false
    }

    func presents(_ requestedContext: ExecutionContextualMenu) -> Bool {
        isPresented && context == requestedContext
    }
}

enum ExerciseCardModeMotion {
    static let contentOffset = EQSpacing.sm
    static let nestedOffset = EQSpacing.md
    static let outgoingEnd: CGFloat = 0.5
    static let incomingStart: CGFloat = 0.5

    static func executionVisibility(_ progress: CGFloat) -> CGFloat {
        1 - normalized(progress, from: 0, through: outgoingEnd)
    }

    static func settingsVisibility(_ progress: CGFloat) -> CGFloat {
        normalized(progress, from: incomingStart, through: 1)
    }

    static func settingsOffset(_ progress: CGFloat) -> CGFloat { 0 }

    private static func normalized(_ value: CGFloat, from start: CGFloat, through end: CGFloat) -> CGFloat {
        guard end > start else { return value >= end ? 1 : 0 }
        return min(max((value - start) / (end - start), 0), 1)
    }
}

/// SwiftUI stores the settings progress state at its endpoints, then interpolates
/// animatable modifier data for each presentation frame. Keeping the piecewise
/// handoff here (rather than in ordinary `View.opacity` arguments) ensures the
/// 50/50 contract is recalculated from that interpolated progress each frame.
private struct ExerciseSettingsContentVisibilityModifier: AnimatableModifier {
    enum Group {
        case execution
        case settings
    }

    var progress: CGFloat
    let group: Group

    var animatableData: CGFloat {
        get { progress }
        set { progress = newValue }
    }

    func body(content: Content) -> some View {
        let opacity: CGFloat = switch group {
        case .execution: ExerciseCardModeMotion.executionVisibility(progress)
        case .settings: ExerciseCardModeMotion.settingsVisibility(progress)
        }
        content.opacity(opacity)
    }
}

enum ExecutionWalletVisualState: Equatable {
    case focusedExercise
    case focusedWork
    case focusedRest
    case exerciseOverview

    var mode: ExecutionWalletPresentationMode {
        switch self {
        case .exerciseOverview: .exerciseOverview
        case .focusedExercise, .focusedWork, .focusedRest: .focusedExercise
        }
    }

}

enum ExerciseOverviewAction: Equatable {
    case openExecution
    case exerciseSettings
    case restoreExercise
}

enum ExerciseOverviewInteraction {
    static func actions(for exercise: WorkoutExercise) -> [ExerciseOverviewAction] {
        exercise.skippedAt == nil ? [.openExecution, .exerciseSettings] : [.restoreExercise]
    }
}

struct ExerciseListRowPresentation: Equatable {
    enum Emphasis: Equatable { case standard, reduced }

    let strikethrough: Bool
    let emphasis: Emphasis
    let showsLoggedSets: Bool

    static func resolve(state: ExerciseState) -> Self {
        switch state {
        case .skipped:
            .init(strikethrough: true, emphasis: .reduced, showsLoggedSets: false)
        case .completed:
            .init(strikethrough: false, emphasis: .standard, showsLoggedSets: true)
        case .current, .upcoming:
            .init(strikethrough: false, emphasis: .standard, showsLoggedSets: false)
        }
    }
}

enum ExecutionContentPresentation: Equatable {
    case activeWorkout
    case completedOverview
}

enum ExecutionTimerRegionPresentation: Equatable {
    case hidden
    case work(WorkoutWorkTimerState, CountdownTimerState)
    case rest(WorkoutRestState)

    var isVisible: Bool { self != .hidden }
    var isRest: Bool {
        if case .rest = self { return true }
        return false
    }
    var isWork: Bool {
        if case .work = self { return true }
        return false
    }
}

struct ExecutionSurfacePresentation: Equatable {
    let content: ExecutionContentPresentation
    let timerRegion: ExecutionTimerRegionPresentation

    var showsForegroundExercise: Bool { content == .activeWorkout }

    static func derive(
        workoutStatus: WorkoutStatus,
        workTimerState: WorkoutWorkTimerState?,
        restState: WorkoutRestState?,
        timerState: CountdownTimerState
    ) -> Self {
        guard workoutStatus != .completed else {
            return .init(content: .completedOverview, timerRegion: .hidden)
        }
        let timerRegion: ExecutionTimerRegionPresentation
        if let restState { timerRegion = .rest(restState) }
        else if let workTimerState { timerRegion = .work(workTimerState, timerState) }
        else { timerRegion = .hidden }
        return .init(content: .activeWorkout, timerRegion: timerRegion)
    }
}

enum FocusedSetSubmission: Equatable {
    case log
    case startTimer

    static func resolve(target: SetTarget, isLogged: Bool) -> Self {
        guard !isLogged, case .duration = target else { return .log }
        return .startTimer
    }

    var buttonTitle: String {
        switch self {
        case .log: return "Log set"
        case .startTimer: return "Start Timer"
        }
    }
}

struct ExecutionPrimaryActionIdentity: Hashable {
    let workoutID: WorkoutID

    var accessibilityIdentifier: String {
        "execution-primary-action-\(workoutID.rawValue)"
    }
}

enum ExecutionPrimaryActionPhase: Equatable {
    case hidden
    case exercise
    case work
    case rest

    static func resolve(
        foregroundState: ExecutionForegroundState,
        hasExerciseAction: Bool
    ) -> Self {
        switch foregroundState {
        case .work: .work
        case .rest: .rest
        case .exercise: hasExerciseAction ? .exercise : .hidden
        }
    }

    var showsPauseControl: Bool { self == .work }

    var timerControlWidth: CGFloat? {
        self == .work || self == .rest
            ? EQLayout.WorkoutExecution.primaryActionTimerWidth
            : nil
    }

    var primaryActionVariant: EQPrimaryCTAVariant {
        self == .rest ? .outlined : .filled
    }
}

private struct ExecutionPrimaryAction {
    let title: String
    let accessibilityHint: String
    let perform: () -> Void
}

private struct ExecutionForegroundTitleHeightPreferenceKey: PreferenceKey {
    static let defaultValue: CGFloat = 0

    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
        value = max(value, nextValue())
    }
}

enum ExecutionPrimaryActionLayout {
    static func footerHeight(
        isVisible: Bool,
        controlHeight: CGFloat,
        topInset: CGFloat = 0,
        bottomInset: CGFloat,
        trailingControlHeight: CGFloat = 0
    ) -> CGFloat {
        guard isVisible else { return 0 }
        return topInset + max(controlHeight, trailingControlHeight) + bottomInset
    }

    static func scrollViewportHeight(cardHeight: CGFloat, headerHeight: CGFloat, footerHeight: CGFloat) -> CGFloat {
        max(0, cardHeight - headerHeight - footerHeight)
    }

    static func foregroundAnchors(cardHeight: CGFloat, headerHeight: CGFloat, footerHeight: CGFloat) -> ExecutionForegroundCardAnchors {
        let footerTop = max(headerHeight, cardHeight - footerHeight)
        return .init(
            contentTop: headerHeight,
            contentBottom: footerTop,
            footerTop: footerTop,
            footerBottom: cardHeight
        )
    }

    static func titleOnlyViewportHeight(
        titleHeight: CGFloat,
        availableHeight: CGFloat,
        minimumTitleHeight: CGFloat,
        topInset: CGFloat
    ) -> CGFloat {
        min(availableHeight, max(titleHeight, minimumTitleHeight) + topInset)
    }
}

struct ExecutionForegroundCardAnchors: Equatable {
    let contentTop: CGFloat
    let contentBottom: CGFloat
    let footerTop: CGFloat
    let footerBottom: CGFloat

    var contentHeight: CGFloat { max(0, contentBottom - contentTop) }
}

enum ExecutionTimerWalletLayout {
    static let maximumExpandedTimerFraction: CGFloat = 0.25

    static func focusedCardTop(isAccessibilitySize: Bool) -> CGFloat {
        let headerHeight = isAccessibilitySize
            ? EQLayout.minimumTouch + (EQSpacing.xl * 2)
            : EQLayout.minimumTouch + EQSpacing.md
        return max(0, headerHeight - EQLayout.WorkoutExecution.walletEdgeInset)
    }

    /// Smallest foreground card that shows the IN PROGRESS header, the full exercise
    /// title and the timer action footer without clipping the title.
    static func minimumTimingCardHeight(titleHeight: CGFloat) -> CGFloat {
        let header = EQLayout.minimumTouch + EQSpacing.xxs
        // UIKit measurement is required for matched-geometry placement; the size still comes from the token style.
        let titleLine = UIFont.systemFont(ofSize: EQTextStyle.screenTitle.size).lineHeight.rounded(.up)
        let footer = ExecutionPrimaryActionLayout.footerHeight(
            isVisible: true,
            controlHeight: EQLayout.WorkoutExecution.primaryActionHeight,
            topInset: EQLayout.WorkoutExecution.primaryActionTopInset,
            bottomInset: EQLayout.WorkoutExecution.primaryActionBottomInset,
            trailingControlHeight: EQLayout.minimumTouch
        )
        return header + EQSpacing.xxs + max(titleHeight, titleLine) + footer
    }

    static func walletHeight(
        containerHeight: CGFloat,
        compactWalletHeight: CGFloat,
        timerVisibilityProgress: CGFloat,
        restExpansionProgress: CGFloat
    ) -> CGFloat {
        let timerProgress = min(max(timerVisibilityProgress, 0), 1)
        let expansionProgress = min(max(restExpansionProgress, 0), 1)
        let compactHeight = min(max(compactWalletHeight, 0), containerHeight)
        let expandedHeight = max(
            compactHeight,
            containerHeight * (1 - maximumExpandedTimerFraction)
        )
        let visibleTimerTarget = compactHeight + ((expandedHeight - compactHeight) * expansionProgress)
        return containerHeight + ((visibleTimerTarget - containerHeight) * timerProgress)
    }
}

enum ExecutionKeyboardLayout {
    /// Tracks UIKit's keyboard spring (curve 7). Fitted from frame captures and slightly faster than
    /// the keyboard to absorb SwiftUI's render latency, so the card never slips behind the keyboard.
    static let animation = Animation.spring(response: 0.2, dampingFraction: 1)

    static func overlap(keyboardFrame: CGRect) -> CGFloat {
        guard !keyboardFrame.isNull else { return 0 }
        return max(0, keyboardFrame.height)
    }

    /// The wallet keeps its top edge and shrinks so its bottom sits on the keyboard.
    static func walletHeight(base: CGFloat, overlap: CGFloat, minimum: CGFloat) -> CGFloat {
        guard overlap > 0 else { return base }
        return max(min(base, minimum), base - overlap)
    }
}

struct ExecutionTimerResponsiveLayout: Layout {
    static let compactTransitionLowerBound: CGFloat = 220
    static let compactTransitionUpperBound: CGFloat = 320

    var compactProgress: CGFloat
    let hasPrimaryContext: Bool
    let hasSecondaryContext: Bool

    var animatableData: CGFloat {
        get { compactProgress }
        set { compactProgress = newValue }
    }

    static func compactProgress(for height: CGFloat) -> CGFloat {
        let transitionDistance = compactTransitionUpperBound - compactTransitionLowerBound
        guard transitionDistance > 0 else {
            return height <= compactTransitionLowerBound ? 1 : 0
        }
        return min(max((compactTransitionUpperBound - height) / transitionDistance, 0), 1)
    }

    func sizeThatFits(
        proposal: ProposedViewSize,
        subviews: Subviews,
        cache: inout ()
    ) -> CGSize {
        proposal.replacingUnspecifiedDimensions()
    }

    func placeSubviews(
        in bounds: CGRect,
        proposal: ProposedViewSize,
        subviews: Subviews,
        cache: inout ()
    ) {
        guard subviews.count == 5 else { return }

        let progress = min(max(compactProgress, 0), 1)
        let horizontalInset = EQLayout.WorkoutExecution.walletInset
        let contentWidth = max(0, bounds.width - (horizontalInset * 2))
        let unconstrained = ProposedViewSize(width: contentWidth, height: nil)
        let header = subviews[0].dimensions(in: unconstrained)
        let duration = subviews[1].dimensions(in: unconstrained)
        let primary = subviews[2].dimensions(in: unconstrained)
        let secondary = subviews[3].dimensions(in: unconstrained)
        let progressBar = subviews[4].dimensions(in: unconstrained)

        let compactTop = bounds.minY + EQSpacing.md
        let compactDurationX = bounds.maxX - horizontalInset - duration.width
        let compactHeaderY = compactTop
            + duration[VerticalAlignment.firstTextBaseline]
            - header[VerticalAlignment.firstTextBaseline]
        let compactRowBottom = max(
            compactTop + duration.height,
            compactHeaderY + header.height
        )
        let compactPrimaryY = compactRowBottom + EQSpacing.md
        let compactProgressY = (hasPrimaryContext
            ? compactPrimaryY + primary.height
            : compactRowBottom) + EQSpacing.md

        let immersiveHeaderY = bounds.minY + EQSpacing.xl
        let immersiveProgressY = bounds.maxY - EQSpacing.xl - progressBar.height
        let immersiveContextBottom = immersiveProgressY - EQSpacing.md
        let immersiveSecondaryY = immersiveContextBottom - secondary.height
        let immersivePrimaryBottom = hasSecondaryContext
            ? immersiveSecondaryY - EQSpacing.xxs
            : immersiveContextBottom
        let immersivePrimaryY = immersivePrimaryBottom - primary.height
        let immersiveDurationLowerBound = immersiveHeaderY + header.height + EQLayout.cardInset
        let immersiveDurationUpperBound = (hasPrimaryContext
            ? immersivePrimaryY
            : immersiveProgressY) - EQLayout.cardInset
        let immersiveDurationY = max(
            immersiveDurationLowerBound,
            immersiveDurationLowerBound
                + max(0, immersiveDurationUpperBound - immersiveDurationLowerBound - duration.height) / 2
        )

        func interpolate(_ immersive: CGFloat, _ compact: CGFloat) -> CGFloat {
            immersive + ((compact - immersive) * progress)
        }

        subviews[0].place(
            at: CGPoint(
                x: bounds.minX + horizontalInset,
                y: interpolate(immersiveHeaderY, compactHeaderY)
            ),
            anchor: .topLeading,
            proposal: unconstrained
        )
        subviews[1].place(
            at: CGPoint(
                x: interpolate(bounds.minX + horizontalInset, compactDurationX),
                y: interpolate(immersiveDurationY, compactTop)
            ),
            anchor: .topLeading,
            proposal: unconstrained
        )
        subviews[2].place(
            at: CGPoint(
                x: bounds.minX + horizontalInset,
                y: interpolate(immersivePrimaryY, compactPrimaryY)
            ),
            anchor: .topLeading,
            proposal: unconstrained
        )
        subviews[3].place(
            at: CGPoint(
                x: bounds.minX + horizontalInset,
                y: interpolate(immersiveSecondaryY, compactPrimaryY)
            ),
            anchor: .topLeading,
            proposal: unconstrained
        )
        subviews[4].place(
            at: CGPoint(
                x: bounds.minX + horizontalInset,
                y: interpolate(immersiveProgressY, compactProgressY)
            ),
            anchor: .topLeading,
            proposal: ProposedViewSize(width: contentWidth, height: progressBar.height)
        )
    }
}

struct ExecutionCompletedSectionPresentation: Equatable {
    private(set) var isExpanded = false

    static func title(completedCount: Int) -> String {
        "COMPLETED [\(completedCount)]"
    }

    mutating func toggle() {
        isExpanded.toggle()
    }
}

enum ExecutionCompletedSectionMotion {
    static let insertionOffset: CGFloat = 18
    static let expansionStagger: TimeInterval = 0.055
    static let collapseStagger: TimeInterval = 0.035
    static let expansionResponse: TimeInterval = 0.40
    static let expansionDampingFraction = 0.78
    static let collapseResponse: TimeInterval = 0.30
    static let collapseDampingFraction = 0.84

    static func stepDelay(reduceMotion: Bool, expanding: Bool) -> TimeInterval {
        guard !reduceMotion else { return 0 }
        return expanding ? expansionStagger : collapseStagger
    }

    static func animation(expanding: Bool) -> Animation {
        if expanding {
            .spring(
                response: expansionResponse,
                dampingFraction: expansionDampingFraction
            )
        } else {
            .spring(
                response: collapseResponse,
                dampingFraction: collapseDampingFraction
            )
        }
    }
}

struct ExecutionWalletSurfaceLayout: Equatable {
    let top: CGFloat
    let height: CGFloat

    static func resolve(
        walletHeight: CGFloat,
        focusedTop: CGFloat,
        compactHeight: CGFloat,
        focusProgress: CGFloat
    ) -> Self {
        let progress = min(max(focusProgress, 0), 1)
        let focusedHeight = max(EQLayout.minimumTouch, walletHeight - focusedTop)
        let overviewTop = max(focusedTop, walletHeight - compactHeight)
        return .init(
            top: overviewTop + ((focusedTop - overviewTop) * progress),
            height: compactHeight + ((focusedHeight - compactHeight) * progress)
        )
    }
}

enum ExecutionTimerFormatting {
    static func durationText(for remaining: TimeInterval) -> String {
        let seconds = max(0, Int(ceil(remaining)))
        return String(format: "%02d:%02d", seconds / 60, seconds % 60)
    }
}

enum ExecutionMotionPolicy {
    static func offset(
        distance: CGFloat,
        progress: CGFloat,
        reduceMotion: Bool
    ) -> CGFloat {
        guard !reduceMotion else { return 0 }
        return (1 - min(max(progress, 0), 1)) * distance
    }
}

private struct ExecutionMotionTarget: Equatable {
    let foregroundState: ExecutionForegroundState
    let timerVisible: Bool
    let awaitsExerciseSelection: Bool
    let foreground: ExecutionForegroundSnapshot?
}

private struct ExecutionForegroundSnapshot: Equatable {
    let id: WorkoutExerciseID
    let name: String
}

private enum ExecutionOverviewListItem: Identifiable {
    case exercise(WorkoutExercise)
    case completedDisclosure

    var id: String {
        switch self {
        case .exercise(let exercise): "exercise-\(exercise.id.rawValue)"
        case .completedDisclosure: "completed-disclosure"
        }
    }
}

/// Sequences the minimized foreground card after the Home → wallet transition:
/// the wallet reaches full size, holds briefly, then the card slides in.
/// On exit the card rides the wallet transition back out.
enum ExecutionForegroundEntry {
    static let delay: TimeInterval = 0.03

    static func walletIsFullSize(_ walletTransitionProgress: CGFloat) -> Bool {
        walletTransitionProgress >= 0.999
    }

    static func animation(reduceMotion: Bool) -> Animation {
        (reduceMotion ? EQMotion.reducedContentTransition : EQMotion.objectTransformation).delay(delay)
    }

    static func arrival(walletTransitionProgress: CGFloat, entryProgress: CGFloat) -> CGFloat {
        // On Home return, the minimized card starts travelling as soon as the
        // wallet begins shrinking and is fully below the wallet before the Home
        // content/wallet handoff begins at 0.78. Home → execution is unchanged
        // because `entryProgress` remains zero until the wallet reaches full size.
        let exitArrival: CGFloat = walletTransitionProgress >= 0.999
            ? 1
            : min(max((walletTransitionProgress - 0.78) / 0.22, 0), 1)
        return min(min(max(entryProgress, 0), 1), exitArrival)
    }

    /// Distance that fully clears the card (and its footer) below the wallet's bottom
    /// edge from wherever it currently sits, so an expanded card leaves as one sheet.
    static func slideDistance(walletHeight: CGFloat, cardTop: CGFloat, gap: CGFloat) -> CGFloat {
        max(0, walletHeight - cardTop) + gap
    }
}

/// Evaluates the foreground card's Home-return exit from SwiftUI's interpolated
/// presentation value.  Keeping this calculation in an `AnimatableModifier`
/// prevents SwiftUI from interpolating a pair of already-resolved offsets over
/// the full Home transition, which would bypass the intentional 0.78 exit
/// completion threshold.
private struct ExecutionForegroundExitTranslationModifier: ViewModifier, Animatable {
    var homeTransitionProgress: CGFloat
    let entryProgress: CGFloat
    let walletHeight: CGFloat
    let cardTop: CGFloat
    let gap: CGFloat

    var animatableData: CGFloat {
        get { homeTransitionProgress }
        set { homeTransitionProgress = newValue }
    }

    static func offset(
        homeTransitionProgress: CGFloat,
        entryProgress: CGFloat,
        walletHeight: CGFloat,
        cardTop: CGFloat,
        gap: CGFloat
    ) -> CGFloat {
        let arrival = ExecutionForegroundEntry.arrival(
            walletTransitionProgress: homeTransitionProgress,
            entryProgress: entryProgress
        )
        return (1 - arrival) * ExecutionForegroundEntry.slideDistance(
            walletHeight: walletHeight,
            cardTop: cardTop,
            gap: gap
        )
    }

    func body(content: Content) -> some View {
        content.offset(
            y: Self.offset(
                homeTransitionProgress: homeTransitionProgress,
                entryProgress: entryProgress,
                walletHeight: walletHeight,
                cardTop: cardTop,
                gap: gap
            )
        )
    }
}

/// Keeps the foreground clip on the same presentation-frame timeline as the
/// foreground exit. The execution wallet's ordinary body is intentionally not
/// guaranteed to be evaluated for every frame of Home's animatable progress.
/// Without this modifier, the card can use a frame-correct exit while its mask
/// still presents an older, larger wallet rectangle.
/// DEBUG-only instrumentation for identifying which execution surface remains
/// visible during the Home return. It is enabled only by the explicit launch
/// argument and never participates in production layout or animation.
private enum ExecutionWalletExitDiagnostics {
    static let samplesKey = "debug.walletExitReturnSamples"

    static var isEnabled: Bool {
        #if DEBUG
        ProcessInfo.processInfo.arguments.contains("-debugWalletExitSurfaces")
        #else
        false
        #endif
    }

    static func resetReturnSamples() {
        UserDefaults.standard.set(
            ["build=\(buildIdentity()) args=\(ProcessInfo.processInfo.arguments)"],
            forKey: samplesKey
        )
    }

    static func append(_ sample: String) {
        var samples = UserDefaults.standard.stringArray(forKey: samplesKey) ?? []
        samples.append(sample)
        UserDefaults.standard.set(samples, forKey: samplesKey)
    }

    private static func buildIdentity() -> String {
        let bundle = Bundle.main
        return "\(bundle.bundleIdentifier ?? "unknown") "
            + "\(bundle.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "?") "
            + "(\(bundle.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "?"))"
    }
}

/// DEBUG-only evidence for the Settings-dismissal footer regression.  It records
/// the *rendered* footer bounds together with the state that determines its
/// reveal, rather than inferring visibility from the Settings recording.
private enum ExecutionFooterDismissalDiagnostics {
    static let samplesKey = "debug.executionFooterDismissalSamples"

    static var isEnabled: Bool {
        #if DEBUG
        ProcessInfo.processInfo.arguments.contains("-debugExecutionFooterDismissal")
        #else
        false
        #endif
    }

    static func append(_ sample: String) {
        guard isEnabled else { return }
        var samples = UserDefaults.standard.stringArray(forKey: samplesKey) ?? []
        samples.append(sample)
        UserDefaults.standard.set(samples, forKey: samplesKey)
        print("[ExecutionFooterProbe] \(sample)")
    }

    static func reset() {
        guard isEnabled else { return }
        UserDefaults.standard.set([], forKey: samplesKey)
    }
}

private struct ExecutionFooterDismissalProbe: ViewModifier {
    let settingsPresented: Bool
    let settingsProgress: CGFloat
    let focusProgress: CGFloat
    let hasPrimaryAction: Bool
    let showsExerciseFooter: Bool
    let revealProgress: CGFloat
    let phase: ExecutionPrimaryActionPhase

    @State private var frame: CGRect = .zero

    private func describe(_ value: CGFloat) -> String {
        String(format: "%.3f", Double(value))
    }

    private func record(_ reason: String) {
        guard ExecutionFooterDismissalDiagnostics.isEnabled else { return }
        ExecutionFooterDismissalDiagnostics.append(
            "reason=\(reason) settings=\(settingsPresented) settingsP=\(describe(settingsProgress)) "
                + "focusP=\(describe(focusProgress)) action=\(hasPrimaryAction) "
                + "showsFooter=\(showsExerciseFooter) reveal=\(describe(revealProgress)) "
                + "phase=\(String(describing: phase)) frame=(x:\(describe(frame.minX)),y:\(describe(frame.minY)),w:\(describe(frame.width)),h:\(describe(frame.height)))"
        )
    }

    func body(content: Content) -> some View {
        content
            .onGeometryChange(for: CGRect.self) { proxy in
                proxy.frame(in: .global)
            } action: { newFrame in
                frame = newFrame
                record("geometry")
            }
            .onChange(of: settingsPresented, initial: true) { _, _ in record("settings") }
            .onChange(of: settingsPresented) { _, presented in
                if presented { ExecutionFooterDismissalDiagnostics.reset() }
            }
            .onChange(of: settingsProgress) { _, _ in record("settings-progress") }
            .onChange(of: focusProgress) { _, _ in record("focus-progress") }
            .onChange(of: hasPrimaryAction) { _, _ in record("primary-action") }
            .onChange(of: showsExerciseFooter) { _, _ in record("footer-mode") }
    }
}

private struct ExecutionWalletExitProbe: View {
    let progress: CGFloat
    let walletFrame: CGRect
    let foregroundFrame: CGRect
    let foregroundMounted: Bool
    let settingsPresented: Bool

    @State private var isCapturingReturn = false
    @State private var reportedReturnBuckets: Set<Int> = []

    private var bucket: Int? {
        let samples: [CGFloat] = [1, 0.8, 0.6, 0.4, 0.2, 0]
        guard let nearest = samples.enumerated().min(by: {
            abs($0.element - progress) < abs($1.element - progress)
        }), abs(nearest.element - progress) <= 0.025 else {
            return nil
        }
        return nearest.offset
    }

    private var intersection: CGRect {
        walletFrame.intersection(foregroundFrame)
    }

    private func frameDescription(_ frame: CGRect) -> String {
        String(
            format: "(x:%.2f,y:%.2f,w:%.2f,h:%.2f)",
            Double(frame.minX), Double(frame.minY), Double(frame.width), Double(frame.height)
        )
    }

    private func record(bucket: Int, label: String) {
        let expectedVisible = foregroundMounted
            && !settingsPresented
            && !intersection.isNull
            && intersection.width > 0
            && intersection.height > 0
        let sample = "[WalletExitProbe] label=\(label) bucket=\(bucket) "
            + "p=\(String(format: "%.4f", Double(progress))) "
            + "wallet=\(frameDescription(walletFrame)) "
            + "foreground=\(frameDescription(foregroundFrame)) "
            + "mask=\(frameDescription(walletFrame)) "
            + "intersection=\(frameDescription(intersection)) "
            + "foregroundMounted=\(foregroundMounted) settings=\(settingsPresented) "
            + "expectedVisibleAfterMask=\(expectedVisible)"
        ExecutionWalletExitDiagnostics.append(sample)
        print(sample)
    }

    var body: some View {
        Color.clear
            .frame(width: 1, height: 1)
            .onChange(of: progress, initial: true) { oldProgress, newProgress in
                guard ExecutionWalletExitDiagnostics.isEnabled else { return }

                // Home → execution increases progress. Arm only after that endpoint,
                // then reset and sample the first genuinely descending frame.
                if newProgress >= 0.999 {
                    isCapturingReturn = false
                    reportedReturnBuckets.removeAll()
                    return
                }
                guard oldProgress > newProgress else { return }

                if !isCapturingReturn {
                    isCapturingReturn = true
                    reportedReturnBuckets.removeAll()
                    ExecutionWalletExitDiagnostics.resetReturnSamples()
                }
                guard let bucket, !reportedReturnBuckets.contains(bucket) else { return }
                reportedReturnBuckets.insert(bucket)
                record(
                    bucket: bucket,
                    label: newProgress <= 0.025 ? "immediately-before-teardown" : "return"
                )
            }
            .allowsHitTesting(false)
            .accessibilityHidden(true)
    }
}

private enum HomeExecutionReveal {
    static func progress(
        _ masterProgress: CGFloat,
        from start: CGFloat,
        through end: CGFloat
    ) -> CGFloat {
        guard end > start else { return masterProgress >= end ? 1 : 0 }
        return min(max((masterProgress - start) / (end - start), 0), 1)
    }
}

private struct ForegroundFocusProgressKey: EnvironmentKey {
    static let defaultValue: CGFloat = 1
}

private struct TimerVisibilityProgressKey: EnvironmentKey {
    static let defaultValue: CGFloat = 0
}

private struct ExecutionRestTintKey: EnvironmentKey {
    static let defaultValue: Double = 0
}

private struct ExecutionWorkHeaderTintKey: EnvironmentKey {
    static let defaultValue: Double = 0
}

/// How far the page header has blended toward the IN PROGRESS card colour during a work interval.
/// Home reads it to tint the shared workout title, which it draws above the execution page.
struct ExecutionWorkHeaderTintPreferenceKey: PreferenceKey {
    static let defaultValue: Double = 0
    static func reduce(value: inout Double, nextValue: () -> Double) { value = max(value, nextValue()) }
}

struct ExecutionContextualMenuPresentedPreferenceKey: PreferenceKey {
    static let defaultValue = false
    static func reduce(value: inout Bool, nextValue: () -> Bool) {
        value = value || nextValue()
    }
}

/// Animates the header tint with the timer reveal so it changes in step with the page canvas.
private struct ExecutionWorkHeaderTintModifier: ViewModifier, Animatable {
    var progress: CGFloat
    var animatableData: CGFloat {
        get { progress }
        set { progress = newValue }
    }
    func body(content: Content) -> some View {
        let tint = Double(min(max(progress, 0), 1))
        content
            .foregroundStyle(EQColor.Execution.primaryText.mix(with: EQColor.Execution.restForegroundSurface, by: tint))
            .environment(\.executionWorkHeaderTint, tint)
            .preference(key: ExecutionWorkHeaderTintPreferenceKey.self, value: tint)
    }
}

private struct ExecutionHeaderSettingsGlyph: View {
    @Environment(\.executionWorkHeaderTint) private var tint
    var body: some View {
        EQSettingsGlyph(color: EQColor.Execution.secondaryText.mix(with: EQColor.Execution.restForegroundSurface, by: tint))
    }
}

private extension EnvironmentValues {
    var executionWorkHeaderTint: Double {
        get { self[ExecutionWorkHeaderTintKey.self] }
        set { self[ExecutionWorkHeaderTintKey.self] = newValue }
    }

    /// How far overview rows have blended toward the rest card text colour.
    var executionRestTint: Double {
        get { self[ExecutionRestTintKey.self] }
        set { self[ExecutionRestTintKey.self] = newValue }
    }

    var foregroundFocusProgress: CGFloat {
        get { self[ForegroundFocusProgressKey.self] }
        set { self[ForegroundFocusProgressKey.self] = newValue }
    }

    var timerVisibilityProgress: CGFloat {
        get { self[TimerVisibilityProgressKey.self] }
        set { self[TimerVisibilityProgressKey.self] = newValue }
    }
}

private struct ForegroundFocusTransitionModifier: ViewModifier, Animatable {
    var progress: CGFloat
    var animatableData: CGFloat {
        get { progress }
        set { progress = newValue }
    }
    func body(content: Content) -> some View {
        content.environment(\.foregroundFocusProgress, min(max(progress, 0), 1))
    }
}

/// The rest colour belongs to the page, so it fades with the timer collapse instead of
/// leaving a shrinking coloured block behind.
private struct ExecutionPageCanvas: View, Animatable {
    var restProgress: CGFloat
    var workProgress: CGFloat = 0
    let drawsBaseCanvas: Bool
    var animatableData: AnimatablePair<CGFloat, CGFloat> {
        get { AnimatablePair(restProgress, workProgress) }
        set { restProgress = newValue.first; workProgress = newValue.second }
    }
    var body: some View {
        ZStack {
            if drawsBaseCanvas { EQColor.Execution.canvas }
            EQColor.Execution.restCanvas.opacity(Double(min(max(restProgress, 0), 1)))
            EQColor.Execution.foregroundSurface.opacity(Double(min(max(workProgress, 0), 1)))
        }
    }
}

private struct TimerVisibilityTransitionModifier: ViewModifier, Animatable {
    var progress: CGFloat
    var animatableData: CGFloat {
        get { progress }
        set { progress = newValue }
    }
    func body(content: Content) -> some View {
        content.environment(\.timerVisibilityProgress, min(max(progress, 0), 1))
    }
}

@MainActor @Observable
final class ExecutionWalletPresentation {
    private(set) var mode: ExecutionWalletPresentationMode

    init(initialMode: ExecutionWalletPresentationMode = .focusedExercise) {
        mode = initialMode
    }

    @discardableResult func showFocusedExercise() -> Bool { setMode(.focusedExercise) }
    @discardableResult func showExerciseOverview() -> Bool { setMode(.exerciseOverview) }
    @discardableResult func selectExercise(_ id: WorkoutExerciseID, focus: (WorkoutExerciseID) -> Void) -> Bool {
        focus(id)
        return showFocusedExercise()
    }
    func resolvedMode(for foregroundState: ExecutionForegroundState) -> ExecutionWalletPresentationMode {
        switch foregroundState {
        case .exercise: mode
        case .work: .focusedExercise
        case .rest: .exerciseOverview
        }
    }
    func resolvedState(
        for foregroundState: ExecutionForegroundState,
        awaitsExerciseSelection: Bool = false
    ) -> ExecutionWalletVisualState {
        switch foregroundState {
        case .work: .focusedWork
        case .rest: .focusedRest
        case .exercise:
            awaitsExerciseSelection || mode == .exerciseOverview
                ? .exerciseOverview
                : .focusedExercise
        }
    }
    @discardableResult func synchronize(with foregroundState: ExecutionForegroundState) -> Bool {
        switch foregroundState {
        case .exercise: return false
        case .work: return showFocusedExercise()
        case .rest: return showFocusedExercise()
        }
    }
    @discardableResult func synchronize(
        with foregroundState: ExecutionForegroundState,
        awaitsExerciseSelection: Bool
    ) -> Bool {
        switch foregroundState {
        case .work: return showFocusedExercise()
        case .rest: return showFocusedExercise()
        case .exercise: return awaitsExerciseSelection ? showExerciseOverview() : false
        }
    }

    func showsActionFooter(
        for foregroundState: ExecutionForegroundState,
        awaitsExerciseSelection: Bool = false,
        isReadOnly: Bool = false
    ) -> Bool {
        guard !isReadOnly else { return false }
        switch foregroundState {
        case .work, .rest: return true
        case .exercise: return !awaitsExerciseSelection && mode == .focusedExercise
        }
    }

    /// Overview actions must not receive taps while the foreground card is expanded or
    /// while either card is still moving between its expanded and overview positions.
    func allowsAddExercise(for foregroundState: ExecutionForegroundState, focusProgress: CGFloat) -> Bool {
        resolvedMode(for: foregroundState) == .exerciseOverview
            && min(max(focusProgress, 0), 1) <= 0.001
    }

    private func setMode(_ newMode: ExecutionWalletPresentationMode) -> Bool {
        guard mode != newMode else { return false }
        mode = newMode
        return true
    }
}

enum ExerciseOptionsRoute: Hashable {
    case performance
    case autoProgression
    case restDuration

    var title: String {
        switch self {
        case .performance: "Performance"
        case .autoProgression: "Auto Progression"
        case .restDuration: "Rest Duration"
        }
    }
}

enum ExerciseOptionsNavigationDirection: Equatable {
    case forward
    case backward
}

@MainActor @Observable
final class ExerciseCardPresentation {
    private(set) var mode: ExerciseCardPresentationMode = .execution
    private(set) var exerciseID: WorkoutExerciseID?
    private(set) var path: [ExerciseOptionsRoute] = []
    private(set) var navigationDirection: ExerciseOptionsNavigationDirection = .forward

    var showsSettings: Bool { mode == .settings && exerciseID != nil }

    func present(exerciseID: WorkoutExerciseID) {
        mode = .settings
        self.exerciseID = exerciseID
        navigationDirection = .forward
        path.removeAll()
    }

    func setPath(_ path: [ExerciseOptionsRoute]) {
        guard showsSettings else { return }
        navigationDirection = path.count < self.path.count ? .backward : .forward
        self.path = path
    }

    func show(_ route: ExerciseOptionsRoute) {
        guard showsSettings else { return }
        navigationDirection = .forward
        path.append(route)
    }

    func pop() {
        guard showsSettings, !path.isEmpty else { return }
        navigationDirection = .backward
        path.removeLast()
    }

    func showRoot() {
        navigationDirection = .backward
        path.removeAll()
    }

    func dismiss() {
        mode = .execution
        exerciseID = nil
        path.removeAll()
    }
}

struct WorkoutExecutionView: View {
    @State private var model: WorkoutExecutionModel
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.homeExecutionTransitionIsSettled) private var homeTransitionIsSettled
    @State private var dismissRequest = 0
    @State private var timingTitleHeight: CGFloat = 0
    @State private var confirmsReset = false
    @State private var confirmsDelete = false
    @State private var renamesWorkout = false
    @State private var workoutName = ""
    @State private var editsRestDuration = false
    @State private var contextualMenu = ExecutionContextualMenuPresentation()
    @State private var sharePayload: WorkoutSharePayload?
    @State private var addsExercise = false
    @State private var swapsExercise = false
    @State private var exerciseSettingsEndedByExternalAction = false
    @State private var pendingAddedExerciseSettingsID: WorkoutExerciseID?
    @State private var setSwipeEdge: Edge = .trailing
    @State private var executionPrimaryAction: ExecutionPrimaryAction?
    @State private var restoresExercise: WorkoutExercise?
    @State private var exerciseCardPresentation = ExerciseCardPresentation()
    @State private var exerciseSettingsTransitionProgress: CGFloat = 0
    @State private var exerciseSettingsTargetIsPresented = false
    @State private var exerciseSettingsTransitionGeneration = 0
    @State private var exerciseSettingsTransitionSnapshot: ExerciseSettingsTransitionSnapshot?
    @State private var exerciseSettingsMeasuredSourceFrame: CGRect = .zero
    @State private var exerciseSettingsSourceFrame: CGRect = .zero
    @State private var exerciseSettingsMeasuredTitleFrame: CGRect = .zero
    @State private var exerciseSettingsSourceTitleFrame: CGRect = .zero
    @State private var exerciseSettingsDestinationFrame: CGRect = .zero
    @State private var walletPresentation = ExecutionWalletPresentation(initialMode: .exerciseOverview)
    @State private var foregroundFocusProgress: CGFloat = 0
    @State private var restExerciseListExpansionProgress: CGFloat = 0
    @State private var timerVisibilityProgress: CGFloat = 0
    @State private var foregroundPresenceProgress: CGFloat = 0
    @State private var displayedForeground: ExecutionForegroundSnapshot?
    @State private var displayedTimerPresentation: ExecutionTimerRegionPresentation = .hidden
    @State private var keyboardFrame: CGRect = .null
    private let historyRepository: (any ExerciseHistoryRepository)?
    private let exerciseRepository: (any ExerciseRepository)?
    private let onExit: (() -> Void)?
    private let usesObjectSurface: Bool
    private let homeExecutionProgress: CGFloat
    private let transitionSourceFrame: CGRect?
    private let reportWalletFrame: ((CGRect) -> Void)?
    private let haptics: any HapticsClient

    init(id: WorkoutID, initialWorkout: Workout? = nil, repository: any WorkoutRepository, historyRepository: (any ExerciseHistoryRepository)? = nil, progressionRepository: (any ProgressionRepository)? = nil, exerciseRepository: (any ExerciseRepository)? = nil, settingsRepository: (any SettingsRepository)? = nil, weightUnit: WeightUnit = .pounds, defaultRestDuration: TimeInterval = 90, restSessionStore: WorkoutRestSessionStore? = nil, homeExecutionProgress: CGFloat = 1, transitionSourceFrame: CGRect? = nil, reportWalletFrame: ((CGRect) -> Void)? = nil, haptics: (any HapticsClient)? = nil, didPersist: @escaping (Workout) -> Void = { _ in }, onExit: (() -> Void)? = nil, usesObjectSurface: Bool = false) {
        let resolvedHaptics = haptics ?? SystemHapticsClient()
        let resolvedExerciseRepository = exerciseRepository ?? (repository as? SwiftDataRepository)
        self.historyRepository = historyRepository ?? (repository as? SwiftDataRepository)
        self.exerciseRepository = resolvedExerciseRepository
        self.onExit = onExit
        self.usesObjectSurface = usesObjectSurface
        self.homeExecutionProgress = homeExecutionProgress
        self.transitionSourceFrame = transitionSourceFrame
        self.reportWalletFrame = reportWalletFrame
        self.haptics = resolvedHaptics
        _model = State(initialValue: WorkoutExecutionModel(workoutID: id, initialWorkout: initialWorkout, repository: repository, historyRepository: historyRepository ?? (repository as? SwiftDataRepository), progressionRepository: progressionRepository ?? (repository as? SwiftDataRepository), exerciseRepository: resolvedExerciseRepository, settingsRepository: settingsRepository ?? (repository as? SwiftDataRepository), weightUnit: weightUnit, defaultRestDuration: defaultRestDuration, restSessionStore: restSessionStore, haptics: resolvedHaptics, audio: SystemAudioFeedbackClient(), didPersist: didPersist))
    }

    var body: some View {
        ContextualActionMenu(
            isPresented: contextualMenuIsPresented,
            actions: contextualMenuActions,
            configuration: contextualMenuConfiguration,
            triggerID: contextualMenuTriggerID
        ) {
            executionSurface
        }
        .preference(
            key: ExecutionContextualMenuPresentedPreferenceKey.self,
            value: contextualMenu.isPresented
        )
    }

    private var executionSurface: some View {
        GeometryReader { sceneProxy in
            let sceneFrame = sceneProxy.frame(in: .global)
            let fullSceneHeight = sceneProxy.size.height
                + sceneProxy.safeAreaInsets.top
                + sceneProxy.safeAreaInsets.bottom
            let fullSceneTargetY = sceneFrame.minY
                - sceneProxy.safeAreaInsets.top
                + (fullSceneHeight * TimerVisualMotion.countdownLaunchHeightScreenRatio)

            ZStack {
                ExecutionPageCanvas(
                    restProgress: displayedTimerPresentation.isRest ? timerVisibilityProgress : 0,
                    workProgress: displayedTimerPresentation.isWork ? timerVisibilityProgress : 0,
                    drawsBaseCanvas: !usesObjectSurface
                )
                .ignoresSafeArea()
                if let workout = model.workout {
                    content(
                        workout,
                        fullSceneCenterY: fullSceneTargetY,
                        sceneFrame: sceneFrame,
                        safeAreaInsets: sceneProxy.safeAreaInsets
                    )
                } else if let error = model.errorMessage {
                    ContentUnavailableView("Workout unavailable", systemImage: "exclamationmark.triangle", description: Text(error))
                } else {
                    ProgressView("Loading workout")
                }

                // The foreground card stays owned by ExecutionWallet for its entire
                // lifetime. Focused Settings is rendered by that same owner rather
                // than by a second scene-level card or title overlay.
            }
        }
        .ignoresSafeArea(.keyboard, edges: .bottom)
        .foregroundStyle(EQColor.Execution.primaryText)
        .navigationBarBackButtonHidden()
        .modifier(ExecutionDismissOnRequest(request: dismissRequest))
        .task { await model.activate() }
        .onReceive(NotificationCenter.default.publisher(for: .equilibriumRepositoryDidChange)) { notification in
            // The model already applied its own saves; reloading here would block the main thread mid-transition.
            guard RepositoryChangeOrigin.of(notification) == .external else { return }
            Task { await model.refreshFromPersistence() }
        }
        .onReceive(NotificationCenter.default.publisher(for: .equilibriumSettingsDidChange)) { _ in Task { await model.refreshRestPreferences() } }
        .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillChangeFrameNotification)) {
            guard !presentsKeyboardInChildSheet else { return }
            updateKeyboardFrame(from: $0)
        }
        .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillHideNotification)) {
            guard !presentsKeyboardInChildSheet else { return }
            updateKeyboardFrame(from: $0, forceHidden: true)
        }
        .onChange(of: scenePhase) { _, phase in if phase == .active { model.refreshRest() } }
        .onChange(of: executionMotionTarget, initial: true) { _, target in
            synchronizeMotion(to: target)
        }
        .onChange(of: model.didAutoComplete) { _, completed in
            if completed { requestExit() }
        }
        .alert("Reset workout?", isPresented: $confirmsReset) {
            Button("Cancel", role: .cancel) {}
            Button("Reset", role: .destructive) { Task { _ = await model.resetWorkout() } }
        } message: { Text("Clear all logged progress for this workout? This cannot be undone.") }
        .alert("Delete workout?", isPresented: $confirmsDelete) {
            Button("Cancel", role: .cancel) {}
            Button("Delete", role: .destructive) { Task { if await model.deleteWorkout() { requestExit() } } }
        } message: { Text("Remove this workout? Your personal exercise definitions are not affected.") }
        .alert("Rename workout", isPresented: $renamesWorkout) {
            TextField("Workout name", text: $workoutName)
            Button("Cancel", role: .cancel) {}
            Button("Rename") {
                let name = workoutName
                Task { _ = await model.renameWorkout(to: name) }
            }
            .disabled(workoutName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
        } message: {
            Text("This renames every past and future appearance of this workout.")
        }
        .confirmationDialog(
            "Skipped exercise",
            isPresented: Binding(
                get: { restoresExercise != nil },
                set: { if !$0 { restoresExercise = nil } }
            ),
            titleVisibility: .visible
        ) {
            if let exercise = restoresExercise {
                Button("Restore exercise") {
                    restoresExercise = nil
                    Task { _ = await model.restoreExercise(exercise.id) }
                }
            }
            Button("Cancel", role: .cancel) { restoresExercise = nil }
        } message: {
            if let exercise = restoresExercise {
                Text("Restore \(exercise.nameSnapshot) to this workout?")
            }
        }
        .sheet(isPresented: $editsRestDuration) {
            RestDurationEditor(
                initialSeconds: model.globalRestDuration,
                guidance: "This is the app default for exercises without a custom rest duration. An active countdown is unchanged."
            ) { seconds in await model.setGlobalRestDuration(seconds) }
        }
        .sheet(item: $sharePayload) { payload in
            WorkoutShareSheet(payload: payload)
        }
        .sheet(isPresented: $addsExercise) {
            if let exerciseRepository {
                ExercisePickerView(
                    repository: exerciseRepository,
                    history: historyRepository,
                    mode: .add(existingExerciseIDs: Set(model.workout?.exercises.map(\.exerciseID) ?? [])),
                    style: .execution
                ) { exercise in
                    addExercise(exercise)
                }
            }
        }
        .sheet(isPresented: $swapsExercise) {
            if let exercise = exerciseCardPresentation.exerciseID.flatMap({ model.exercise(id: $0) }),
               let exerciseRepository {
                ExercisePickerView(
                    repository: exerciseRepository,
                    history: historyRepository,
                    mode: .swap(
                        existingExerciseIDs: Set(model.workout?.exercises.map(\.exerciseID) ?? []),
                        replacing: exercise.exerciseID
                    ),
                    style: .execution
                ) { definition in
                    Task {
                        exerciseSettingsEndedByExternalAction = true
                        if await model.swapExercise(occurrenceID: exercise.id, with: definition) {
                            swapsExercise = false
                            dismissExerciseSettings()
                        } else {
                            exerciseSettingsEndedByExternalAction = false
                        }
                    }
                }
            }
        }
        .onChange(of: addsExercise) { _, isPresented in
            if !isPresented { presentPendingAddedExerciseSettingsIfReady() }
        }
        .onChange(of: model.currentExercise?.id) { _, currentExerciseID in
            if contextualMenu.isPresented,
               case .sets(let presentedExerciseID) = contextualMenu.context,
               presentedExerciseID != currentExerciseID {
                contextualMenu.dismiss()
            }
            guard exerciseSettingsTargetIsPresented else { return }
            guard let currentExerciseID else {
                dismissExerciseSettings()
                return
            }
            if exerciseCardPresentation.exerciseID != currentExerciseID {
                exerciseCardPresentation.present(exerciseID: currentExerciseID)
            }
        }
    }

    private var contextualMenuIsPresented: Binding<Bool> {
        Binding(
            get: { contextualMenu.isPresented },
            set: { isPresented in
                if !isPresented { contextualMenu.dismiss() }
            }
        )
    }

    private var contextualMenuTriggerID: String {
        contextualMenu.context.triggerID
    }

    private var contextualMenuConfiguration: ContextualActionMenuConfiguration {
        switch contextualMenu.context {
        case .sets:
            ContextualActionMenuConfiguration(
                direction: .upward,
                alignment: .trailing,
                actionSpacing: EQSpacing.xs,
                actionGroupSpacing: EQSpacing.lg
            )
        case .workout:
            ContextualActionMenuConfiguration(
                direction: .downward,
                alignment: .trailing,
                actionSpacing: EQSpacing.xs,
                actionGroupSpacing: EQSpacing.lg
            )
        }
    }

    private var contextualMenuActions: [ContextualActionMenuAction] {
        switch contextualMenu.context {
        case .sets(let exerciseID):
            guard let exercise = model.exercise(id: exerciseID) else { return [] }
            return setContextualMenuActions(for: exercise)
        case .workout:
            return workoutContextualMenuActions
        }
    }

    private var workoutContextualMenuActions: [ContextualActionMenuAction] {
        var actions = [
            ContextualActionMenuAction(
                id: "rename-workout",
                title: "Rename",
                groupID: "workout-editing",
                accessibilityHint: "Renames every appearance of this workout"
            ) {
                workoutName = model.workout?.titleSnapshot ?? ""
                renamesWorkout = true
            }
        ]
        if model.canEditRestDuration {
            actions.append(
                ContextualActionMenuAction(
                    id: "workout-rest-duration",
                    title: "Rest Duration",
                    groupID: "workout-editing",
                    accessibilityHint: "Changes the workout rest duration"
                ) { editsRestDuration = true }
            )
        }
        if let shareText = model.shareText {
            actions.append(
                ContextualActionMenuAction(
                    id: "share-workout",
                    title: "Share",
                    groupID: "workout-editing",
                    accessibilityHint: "Shares this workout"
                ) {
                    sharePayload = WorkoutSharePayload(
                        text: shareText,
                        subject: model.workout?.titleSnapshot ?? "Workout"
                    )
                }
            )
        }
        actions.append(contentsOf: [
            ContextualActionMenuAction(
                id: "reset-workout",
                title: "Reset",
                groupID: "workout-destruction",
                accessibilityHint: "Clears logged progress from this workout",
                role: .destructive
            ) { confirmsReset = true },
            ContextualActionMenuAction(
                id: "delete-workout",
                title: "Delete",
                groupID: "workout-destruction",
                accessibilityHint: "Deletes this workout",
                role: .destructive
            ) { confirmsDelete = true }
        ])
        return actions
    }

    private func setContextualMenuActions(for exercise: WorkoutExercise) -> [ContextualActionMenuAction] {
        let count = exercise.prescriptions.count
        let hasSelection = model.currentPrescription != nil
        let editsCount = model.workTimerState == nil && model.restState == nil && !model.isReadOnly
        let completedCount = Set(
            exercise.loggedSets
                .filter { $0.completedAt != nil }
                .compactMap(\.prescriptionID)
        ).count
        var actions: [ContextualActionMenuAction] = []

        if editsCount {
            actions.append(
                ContextualActionMenuAction(
                    id: "remove-last-set",
                    title: "Remove Last Set",
                    groupID: "set-count",
                    accessibilityHint: "Removes the final uncompleted set",
                    isEnabled: count > max(1, completedCount),
                    role: .destructive
                ) {
                    Task { await model.updateSetCount(exerciseID: exercise.id, count: count - 1) }
                }
            )
            actions.append(
                ContextualActionMenuAction(
                    id: "add-set",
                    title: "Add Set",
                    groupID: "set-count",
                    accessibilityHint: "Adds a set to this exercise",
                    isEnabled: count < 20
                ) {
                    Task { await model.updateSetCount(exerciseID: exercise.id, count: count + 1) }
                }
            )
        }

        if hasSelection {
            for index in exercise.prescriptions.indices.reversed() {
                let done = exercise.loggedSets.contains {
                    $0.prescriptionID == exercise.prescriptions[index].id && $0.completedAt != nil
                }
                actions.append(
                    ContextualActionMenuAction(
                        id: "select-set-\(index)",
                        title: "Set \(index + 1)\(done ? " · Completed" : "")",
                        groupID: "set-selection",
                        accessibilityHint: "Selects set \(index + 1)"
                    ) { selectSet(at: index) }
                )
            }
        }
        return actions
    }

    private func toggleContextualMenu(_ menu: ExecutionContextualMenu) {
        if contextualMenu.toggle(menu) {
            haptics.perform(.lightImpact)
        }
    }

    private func workoutHeader(_ workout: Workout) -> some View {
        HStack(spacing: EQLayout.controlGap) {
            Button(action: requestExit) {
                HStack(spacing: EQSpacing.xs) {
                    Image(systemName: "chevron.left")
                        .modifier(executionChromeRevealEffect)
                    Text(workout.titleSnapshot)
                        .eqTextStyle(.navigationTitle)
                        .lineLimit(1)
                        // This remains the stable layout anchor for Home's travelling
                        // title. The title itself stays owned by the Home transition
                        // layer throughout focused settings; the expanding opaque card
                        // naturally occludes it instead of handing visual ownership to
                        // a second header label.
                        .hidden()
                        .anchorPreference(key: HomeWorkoutTitleAnchorKey.self, value: .bounds) {
                            [.destination(workout.id): $0]
                        }
                }
                .frame(minHeight: EQLayout.minimumTouch)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("execution-back-\(workout.id.rawValue)")
            .accessibilityLabel("Back to Home, \(workout.titleSnapshot)")
            .accessibilityHint("Returns this workout to its card on Home")

            Spacer(minLength: EQLayout.controlGap)

            if model.showsExecutionOptions {
                ContextualActionMenuTrigger(
                    isPresented: contextualMenu.presents(.workout),
                    anchorID: ExecutionContextualMenu.workout.triggerID,
                    accessibilityLabel: "Workout options",
                    accessibilityHint: "Contains available workout actions",
                    toggle: { toggleContextualMenu(.workout) }
                ) {
                    ExecutionHeaderSettingsGlyph()
                        .frame(width: EQLayout.minimumTouch, height: EQLayout.minimumTouch, alignment: .center)
                        .contentShape(Rectangle())
                }
                .modifier(executionChromeRevealEffect)
            }
        }
        .padding(.horizontal, EQLayout.screenGutter)
        .frame(maxWidth: .infinity, minHeight: EQLayout.minimumTouch + EQSpacing.sm)
        .allowsHitTesting(homeTransitionIsSettled)
    }

    private func requestExit() {
        if let onExit { onExit() }
        else { dismissRequest += 1 }
    }

    private func content(
        _ workout: Workout,
        fullSceneCenterY: CGFloat,
        sceneFrame: CGRect,
        safeAreaInsets: EdgeInsets
    ) -> some View {
        let surfacePresentation = ExecutionSurfacePresentation.derive(
            workoutStatus: workout.status,
            workTimerState: model.workTimerState,
            restState: model.restState,
            timerState: model.timer.state
        )
        let visualTimerPresentation = surfacePresentation.timerRegion.isVisible
            ? surfacePresentation.timerRegion
            : displayedTimerPresentation
        let visualState = walletPresentation.resolvedState(
            for: model.foregroundState,
            awaitsExerciseSelection: model.awaitsExerciseSelection
        )
        let showsExerciseSettings = exerciseCardPresentation.exerciseID != nil
            && exerciseCardPresentation.exerciseID == foregroundExerciseID
        return VStack(spacing: 0) {
            VStack(spacing: 0) {
                workoutHeader(workout)
                    .modifier(ExecutionWorkHeaderTintModifier(
                        progress: displayedTimerPresentation.isWork ? timerVisibilityProgress : 0
                    ))
                if let error = model.errorMessage {
                    Label(error, systemImage: "exclamationmark.triangle")
                        .eqTextStyle(.caption)
                        .foregroundStyle(EQColor.Execution.warning)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, EQSpacing.md)
                        .padding(.vertical, EQSpacing.xs)
                        .background(executionCanvas)
                        .transition(.opacity)
                }
                Spacer()
                    .frame(height: EQLayout.WorkoutExecution.headerWalletSpacing)
            }
            GeometryReader { proxy in
                let timerProgress = min(max(timerVisibilityProgress, 0), 1)
                let compactWalletHeight = min(timerWalletHeight, proxy.size.height)
                let restExpansionProgress = visualState == .focusedRest
                    ? min(max(restExerciseListExpansionProgress, 0), 1)
                    : 0
                let walletHeight = ExecutionTimerWalletLayout.walletHeight(
                    containerHeight: proxy.size.height,
                    compactWalletHeight: compactWalletHeight,
                    timerVisibilityProgress: timerProgress,
                    restExpansionProgress: restExpansionProgress
                )
                let timerHeight = max(0, proxy.size.height - walletHeight)
                let globalFrame = proxy.frame(in: .global)
                let sceneCenterY = max(0, fullSceneCenterY - globalFrame.minY)

                ZStack(alignment: .top) {
                    WorkoutTimerVisualLayer(
                        activePresentation: surfacePresentation.timerRegion,
                        timer: model.timer,
                        walletTop: timerHeight + ExecutionTimerWalletLayout.focusedCardTop(
                            isAccessibilitySize: dynamicTypeSize.isAccessibilitySize
                        ),
                        sceneCenterY: sceneCenterY,
                        walletCollapseProgress: timerProgress,
                        reduceMotion: reduceMotion
                    )

                    VStack(spacing: 0) {
                        ExecutionTimerRegion(
                            presentation: visualTimerPresentation,
                            timer: model.timer,
                            nextAction: restNextAction,
                            reduceMotion: reduceMotion
                        )
                        .frame(height: timerHeight)
                        .clipped()

                        ExecutionWallet(
                            workout: workout,
                            model: model,
                            presentation: walletPresentation,
                            visualState: visualState,
                            foregroundState: model.foregroundState,
                            showsForegroundExercise: displayedForeground != nil,
                            foregroundPresenceProgress: foregroundPresenceProgress,
                            settingsPresented: showsExerciseSettings,
                            settingsTransitionProgress: exerciseSettingsTransitionProgress,
                            settingsSnapshot: exerciseSettingsTransitionSnapshot,
                            settingsDestinationFrame: exerciseSettingsTransitionSnapshot?.destinationFrame
                                ?? ExerciseFocusedExpansionLayout.destinationFrame(
                                    containerFrame: sceneFrame,
                                    safeAreaInsets: safeAreaInsets
                                ),
                            reduceMotion: reduceMotion,
                            homeTransitionProgress: homeExecutionProgress,
                            transitionSourceFrame: transitionSourceFrame,
                            reportFrame: reportWalletFrame,
                            reportForegroundFrame: { frame in
                                guard !exerciseSettingsTargetIsPresented else { return }
                                exerciseSettingsMeasuredSourceFrame = frame
                                updateExerciseSettingsSourceTitleFrame()
                            },
                            reportForegroundVisualFrame: { frame in
                                guard !exerciseSettingsTargetIsPresented else { return }
                                exerciseSettingsSourceFrame = frame
                                updateExerciseSettingsSourceTitleFrame()
                            },
                            listRow: { exercise, state in
                                ExerciseListRow(exercise: exercise, state: state, weightUnit: model.weightUnit)
                            },
                            selectExercise: { exercise in
                                guard workout.status == .inProgress else { return }
                                if ExerciseOverviewInteraction.actions(for: exercise) == [.restoreExercise] {
                                    restoresExercise = exercise
                                    haptics.perform(.selection)
                                    return
                                }
                                if performWalletTransition({
                                    let changed = walletPresentation.selectExercise(exercise.id, focus: model.focus)
                                    foregroundFocusProgress = 1
                                    return changed
                                }) {
                                    haptics.perform(.selection)
                                }
                            },
                            addExercise: { addsExercise = true },
                            showOverview: showExerciseOverview,
                            completedSectionToggled: { haptics.perform(.selection) },
                            showSettings: { presentExerciseSettings(for: $0) },
                            showFocused: showFocusedExercise,
                            skipRest: model.skipRest,
                            skipWork: model.skipWorkTimer,
                            pauseResumeWork: model.toggleWorkTimerPause,
                            foregroundHeader: foregroundExerciseHeader,
                            foregroundContent: foregroundExerciseContent,
                            foregroundValues: { expandedExerciseControls },
                            primaryAction: executionPrimaryAction,
                            footerControls: { exercise in footerSetCountControls(for: exercise) },
                            settingsContent: { exercise, exerciseID in
                                FocusedExerciseSettingsSurface(
                                    exerciseName: exercise.nameSnapshot,
                                    reservesTransitionedExerciseName: true,
                                    route: exerciseCardPresentation.path.last,
                                    path: Binding(
                                        get: { exerciseCardPresentation.path },
                                        set: { exerciseCardPresentation.setPath($0) }
                                    ),
                                    navigationDirection: exerciseCardPresentation.navigationDirection,
                                    exerciseID: exerciseID,
                                    model: model,
                                    exerciseRepository: exerciseRepository,
                                    historyRepository: historyRepository,
                                    onBack: {
                                        withAnimation(nestedSettingsAnimation) {
                                            exerciseCardPresentation.pop()
                                        }
                                    },
                                    onClose: dismissExerciseSettings,
                                    onSwap: { swapsExercise = true },
                                    durationStepFeedback: { haptics.perform(.selection) },
                                    allowsSaving: !exerciseSettingsEndedByExternalAction,
                                    showsCloseControl: false
                                )
                            },
                            dismissSettings: dismissExerciseSettings,
                            keyboardVisible: keyboardOverlap > 0,
                            showsRestTint: visualTimerPresentation.isRest,
                            showsWorkTint: visualTimerPresentation.isWork
                        )
                        .frame(height: ExecutionKeyboardLayout.walletHeight(
                            base: walletHeight,
                            overlap: keyboardOverlap,
                            minimum: compactWalletHeight
                        ))
                        .frame(height: walletHeight, alignment: .top)
                        .onPreferenceChange(ExecutionForegroundTitleHeightPreferenceKey.self) {
                            timingTitleHeight = $0
                        }
                        .modifier(ForegroundFocusTransitionModifier(progress: foregroundFocusProgress))
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .onAppear {
            guard !exerciseSettingsTargetIsPresented else { return }
            exerciseSettingsDestinationFrame = ExerciseFocusedExpansionLayout.destinationFrame(
                containerFrame: sceneFrame,
                safeAreaInsets: safeAreaInsets
            )
        }
        .onChange(of: sceneFrame) { _, frame in
            guard !exerciseSettingsTargetIsPresented else { return }
            exerciseSettingsDestinationFrame = ExerciseFocusedExpansionLayout.destinationFrame(
                containerFrame: frame,
                safeAreaInsets: safeAreaInsets
            )
        }
        .modifier(TimerVisibilityTransitionModifier(progress: timerVisibilityProgress))
        .onAppear {
            if surfacePresentation.timerRegion.isVisible {
                displayedTimerPresentation = surfacePresentation.timerRegion
            }
        }
        .onChange(of: surfacePresentation.timerRegion) { _, timerPresentation in
            if timerPresentation.isVisible {
                displayedTimerPresentation = timerPresentation
            }
        }
    }

    private var timerWalletHeight: CGFloat {
        max(
            EQLayout.WorkoutExecution.restCardHeight + EQLayout.minimumTouch + EQSpacing.md,
            EQLayout.minimumTouch + EQSpacing.md
                + ExecutionTimerWalletLayout.minimumTimingCardHeight(titleHeight: timingTitleHeight)
        )
    }

    private var keyboardOverlap: CGFloat {
        ExecutionKeyboardLayout.overlap(keyboardFrame: keyboardFrame)
    }

    /// Child sheets own their keyboard geometry. Re-laying out the full workout wallet
    /// for the picker's search field makes first focus visibly lag behind the tap.
    private var presentsKeyboardInChildSheet: Bool {
        addsExercise || swapsExercise || editsRestDuration || renamesWorkout
    }

    private func updateKeyboardFrame(from notification: Notification, forceHidden: Bool = false) {
        let targetFrame: CGRect
        if forceHidden {
            targetFrame = .null
        } else if let value = notification.userInfo?[UIResponder.keyboardFrameEndUserInfoKey] as? NSValue {
            targetFrame = value.cgRectValue
        } else {
            return
        }

        guard !reduceMotion else {
            keyboardFrame = targetFrame
            return
        }
        // UIKit reports a zero duration for some dismissals even though the keyboard still slides,
        // so the wallet always follows with the keyboard-matched spring.
        withAnimation(ExecutionKeyboardLayout.animation) {
            keyboardFrame = targetFrame
        }
    }

    private var executionCanvas: Color {
        model.restState == nil ? EQColor.Execution.canvas : EQColor.Execution.restCanvas
    }

    /// Single entry point for choosing a set and changing how many sets the exercise has.
    private func footerSetCountControls(for exercise: WorkoutExercise) -> some View {
        let count = exercise.prescriptions.count
        let availableCount = max(1, count)
        let completedCount = WorkoutExecutionQuery.completedPrescriptionIDs(in: exercise)
            .intersection(Set(exercise.prescriptions.map(\.id)))
            .count
        // An unconfigured exercise has one editable first-set slot, represented by
        // FirstSetView without manufacturing a prescription or historical result.
        let hasSelection = model.currentPrescription != nil || count == 0
        let selectedSetNumber = model.currentPrescription == nil ? 1 : model.selectedSetIndex + 1
        let editsCount = model.workTimerState == nil && model.restState == nil && !model.isReadOnly
        return ContextualActionMenuTrigger(
            isPresented: contextualMenu.presents(.sets(exercise.id)),
            anchorID: ExecutionContextualMenu.sets(exercise.id).triggerID,
            accessibilityLabel: hasSelection
                ? "Set \(selectedSetNumber) of \(availableCount)"
                : "\(completedCount) completed, \(availableCount) available set\(availableCount == 1 ? "" : "s")",
            accessibilityHint: editsCount ? "Choose a set, or add or remove sets" : "Choose a set",
            toggle: { toggleContextualMenu(.sets(exercise.id)) }
        ) {
            Text(hasSelection ? "\(selectedSetNumber)/\(availableCount)" : "\(availableCount) available")
                .eqTextStyle(.sectionLabel)
                .monospacedDigit()
                .frame(minWidth: EQLayout.minimumTouch, minHeight: EQLayout.minimumTouch, alignment: .center)
                .contentShape(Rectangle())
        }
        .disabled(!hasSelection && !editsCount)
    }

    /// Selects a set, sliding the values in from the side of travel.
    private func selectSet(at index: Int) {
        guard index != model.selectedSetIndex else { return }
        setSwipeEdge = index > model.selectedSetIndex ? .trailing : .leading
        withAnimation(reduceMotion ? EQMotion.reducedContentTransition : EQMotion.contentTransition) {
            model.selectSet(at: index)
        }
    }

    private var setSwipeGesture: some Gesture {
        DragGesture(minimumDistance: 24)
            .onEnded { value in
                let dx = value.translation.width, dy = value.translation.height
                guard abs(dx) > abs(dy) * 1.5, abs(value.predictedEndTranslation.width) > 60,
                      model.workTimerState == nil,
                      let count = model.currentExercise?.prescriptions.count else { return }
                let target = model.selectedSetIndex + (dx < 0 ? 1 : -1)
                guard (0..<count).contains(target) else { return }
                selectSet(at: target)
            }
    }

    private var executionChromeRevealEffect: HomeExecutionProgressEffect {
        let reduceMotion = reduceMotion
        return HomeExecutionProgressEffect { homeProgress in
            let progress = HomeExecutionReveal.progress(homeProgress, from: 0.55, through: 0.80)
            let offset = ExecutionMotionPolicy.offset(
                distance: -EQSpacing.md,
                progress: progress,
                reduceMotion: reduceMotion
            )
            return (CGSize(width: 0, height: offset), Double(progress))
        }
    }

    @ViewBuilder private func foregroundExerciseHeader(focusProgress: CGFloat, restProgress: CGFloat) -> some View {
        let isResting = model.restState != nil
        let isWorking = model.workTimerState != nil
        let isTiming = isResting || isWorking
        let progress = min(max(focusProgress, 0), 1)
        // Leaving rest expands straight to the focused card, so the overview chevron never shows.
        let secondaryProgress = max(min(max((progress - 0.18) / 0.82, 0), 1), min(max(restProgress, 0), 1))
        let headerControlsOpacity = isTiming ? 0 : Double(secondaryProgress)
        executionCardHeader(
            isTiming: isTiming,
            secondaryProgress: secondaryProgress,
            controlsOpacity: headerControlsOpacity
        )
        .frame(maxWidth: .infinity, minHeight: EQLayout.minimumTouch, alignment: .leading)
    }

    private func executionCardHeader(
        isTiming: Bool,
        secondaryProgress: CGFloat,
        controlsOpacity: Double
    ) -> some View {
        Text("IN PROGRESS")
            .eqTextStyle(.sectionLabel)
            .frame(maxWidth: .infinity, minHeight: EQLayout.minimumTouch, alignment: .leading)
            .accessibilityIdentifier("execution-current-state-label-\(model.workoutID.rawValue)")
            .overlay(alignment: .trailing) {
                ZStack(alignment: .trailing) {
                    Image(systemName: "chevron.up")
                        .foregroundStyle(EQColor.Execution.foregroundText)
                        .frame(width: EQLayout.iconSize)
                        .accessibilityHidden(true)
                        .opacity(isTiming ? 0 : 1 - secondaryProgress)
                    Group {
                        if let exercise = foregroundExercise, !model.isReadOnly {
                            EQIconButton(systemImage: "slider.horizontal.3", alignment: .trailing) {
                                presentExerciseSettings(for: exercise)
                            }
                            .accessibilityLabel("Exercise settings")
                            .accessibilityHint("Shows performance, settings, and actions for \(exercise.nameSnapshot)")
                        }
                    }
                    .opacity(controlsOpacity)
                    .allowsHitTesting(!isTiming && secondaryProgress > 0.99)
                    .accessibilityHidden(isTiming || secondaryProgress < 0.99)
                }
                .offset(x: EQLayout.WorkoutExecution.trailingIconOutset)
            }
    }

    private var nestedSettingsAnimation: Animation? {
        reduceMotion ? EQMotion.reducedContentTransition : EQMotion.surfaceReveal
    }

    @ViewBuilder private func foregroundExerciseContent() -> some View {
        if let exerciseName = foregroundExerciseName {
            Text(exerciseName)
                .eqTextStyle(.screenTitle)
                .lineLimit(2)
                // Keep the real source title fully laid out while the focused surface
                // is requested. The opaque surface covers it, while the scene-level
                // shared title begins from this exact measured geometry above it.
                // This avoids a source-layout mutation in the progress-zero frame.
                .contentTransition(.identity)
                .accessibilityIdentifier("execution-current-exercise-name-\(foregroundExerciseID?.rawValue ?? model.workoutID.rawValue)")
                .background {
                    GeometryReader { proxy in
                        Color.clear.preference(
                            key: ExecutionForegroundTitleHeightPreferenceKey.self,
                            value: proxy.size.height
                        )
                    }
                }
                .onGeometryChange(for: CGRect.self) { proxy in
                    proxy.frame(in: .global)
                } action: { frame in
                    guard !exerciseSettingsTargetIsPresented else { return }
                    exerciseSettingsMeasuredTitleFrame = frame
                    updateExerciseSettingsSourceTitleFrame()
                }
        } else {
            Text("No active exercise")
                .eqTextStyle(.screenTitle)
        }
    }

    private var foregroundExercise: WorkoutExercise? {
        if let rest = model.restState {
            return model.exercise(id: rest.exerciseID)
        }
        if let work = model.workTimerState {
            return model.exercise(id: work.exerciseID)
        }
        return model.currentExercise
    }

    /// Capture the normal production title after SwiftUI has applied its complete
    /// execution-card layout. The focused title takes over from this exact global
    /// rectangle, so it must not be reconstructed through a separate card frame.
    private func updateExerciseSettingsSourceTitleFrame() {
        guard exerciseSettingsMeasuredTitleFrame.width > 0,
              exerciseSettingsMeasuredTitleFrame.height > 0 else { return }

        exerciseSettingsSourceTitleFrame = exerciseSettingsMeasuredTitleFrame

        #if DEBUG
        guard exerciseSettingsMeasuredSourceFrame.width > 0,
              exerciseSettingsMeasuredSourceFrame.height > 0,
              exerciseSettingsSourceFrame.width > 0,
              exerciseSettingsSourceFrame.height > 0 else { return }

        let legacyProjectedFrame = CGRect(
            x: exerciseSettingsSourceFrame.minX
                + (exerciseSettingsMeasuredTitleFrame.minX - exerciseSettingsMeasuredSourceFrame.minX),
            y: exerciseSettingsSourceFrame.minY
                + (exerciseSettingsMeasuredTitleFrame.minY - exerciseSettingsMeasuredSourceFrame.minY),
            width: exerciseSettingsMeasuredTitleFrame.width,
            height: exerciseSettingsMeasuredTitleFrame.height
        )
        let delta = CGPoint(
            x: exerciseSettingsMeasuredTitleFrame.minX - legacyProjectedFrame.minX,
            y: exerciseSettingsMeasuredTitleFrame.minY - legacyProjectedFrame.minY
        )
        print("[SettingsTitleGeometry] direct source=\(exerciseSettingsMeasuredTitleFrame); legacy projected=\(legacyProjectedFrame); delta=\(delta)")
        #endif
    }

    private var foregroundExerciseName: String? {
        liveForegroundSnapshot?.name ?? displayedForeground?.name
    }

    private var foregroundExerciseID: WorkoutExerciseID? {
        liveForegroundSnapshot?.id ?? displayedForeground?.id
    }

    private var liveForegroundSnapshot: ExecutionForegroundSnapshot? {
        guard model.workout?.status != .completed, !model.awaitsExerciseSelection else { return nil }
        if let rest = model.restState {
            return .init(id: rest.exerciseID, name: rest.exerciseName)
        }
        if let work = model.workTimerState {
            return .init(id: work.exerciseID, name: work.exerciseName)
        }
        guard let exercise = model.currentExercise else { return nil }
        return .init(id: exercise.id, name: exercise.nameSnapshot)
    }

    @ViewBuilder private var expandedExerciseControls: some View {
        ScrollView {
            executionSetControls
                .padding(.horizontal, EQLayout.WorkoutExecution.walletInset)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .defaultScrollAnchor(.bottom, for: .alignment)
        .defaultScrollAnchor(.bottom, for: .initialOffset)
        .scrollBounceBehavior(.basedOnSize)
        .scrollIndicators(.hidden)
        .scrollDismissesKeyboard(.interactively)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    @ViewBuilder private var executionSetControls: some View {
        // ZStack so the outgoing and incoming sets overlap while sliding.
        ZStack(alignment: .bottomLeading) {
            if let exercise = model.currentExercise, let prescription = model.currentPrescription {
                FocusedSetView(
                    exercise: exercise,
                    prescription: prescription,
                    progression: model.suggestion(for: exercise),
                    selectedIndex: model.selectedSetIndex,
                    isReadOnly: model.isReadOnly,
                    weightUnit: model.weightUnit,
                    log: { input in await model.log(exerciseID: exercise.id, prescriptionID: prescription.id, input: input) },
                    startTimed: { input in model.startWorkTimer(exerciseID: exercise.id, prescriptionID: prescription.id, input: input) },
                    reportPrimaryAction: updateExecutionPrimaryAction
                )
                .id("\(exercise.id.rawValue)-\(prescription.id.rawValue)-\(model.progressionIdentity(for: exercise))")
                .transition(reduceMotion ? .opacity : .asymmetric(
                    insertion: .move(edge: setSwipeEdge).combined(with: .opacity),
                    removal: .move(edge: setSwipeEdge == .trailing ? .leading : .trailing).combined(with: .opacity)
                ))
            } else if let exercise = model.currentExercise, !model.isReadOnly {
                FirstSetView(
                    exercise: exercise,
                    progression: model.suggestion(for: exercise),
                    weightUnit: model.weightUnit,
                    log: { input in
                        if exercise.isTimeBased { await model.startFirstWorkTimer(exerciseID: exercise.id, input: input) }
                        else { await model.logFirstSet(exerciseID: exercise.id, input: input) }
                    },
                    reportPrimaryAction: updateExecutionPrimaryAction
                )
            } else {
                Text("Every required set is logged.").eqTextStyle(.sectionTitle)
                    .onAppear { updateExecutionPrimaryAction(nil) }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .contentShape(Rectangle())
        .simultaneousGesture(setSwipeGesture)
    }

    private func updateExecutionPrimaryAction(_ action: ExecutionPrimaryAction?) {
        executionPrimaryAction = action
    }

    private var restNextAction: String? {
        guard let rest = model.restState, let exercise = model.currentExercise else { return nil }
        let set = exercise.prescriptions.isEmpty ? nil : min(model.selectedSetIndex + 1, exercise.prescriptions.count)
        if exercise.id == rest.exerciseID, let set {
            return "Set \(set) of \(exercise.prescriptions.count)"
        }
        if let set { return "\(exercise.nameSnapshot) · Set \(set) of \(exercise.prescriptions.count)" }
        return exercise.nameSnapshot
    }

    private func presentExerciseSettings(for exercise: WorkoutExercise) {
        guard model.foregroundState == .exercise, model.showsExecutionOptions,
              model.exercise(id: exercise.id)?.skippedAt == nil,
              !exerciseSettingsTargetIsPresented else { return }

        guard exerciseSettingsSourceFrame.width > 0,
              exerciseSettingsSourceFrame.height > 0,
              exerciseSettingsSourceTitleFrame.width > 0,
              exerciseSettingsSourceTitleFrame.height > 0,
              exerciseSettingsDestinationFrame.width > 0,
              exerciseSettingsDestinationFrame.height > 0 else {
            return
        }

        exerciseSettingsTransitionGeneration += 1
        let generation = exerciseSettingsTransitionGeneration
        exerciseSettingsEndedByExternalAction = false

        // The sliders control belongs to the visible in-progress card. Do not
        // re-select or force-focus that card here: doing so recalculates its source
        // layout before the focused transition has a chance to interpolate from it.
        // A non-current exercise still follows the existing selection path first.
        if foregroundExerciseID != exercise.id {
            _ = walletPresentation.selectExercise(exercise.id, focus: model.focus)
            foregroundFocusProgress = 1
        }

        exerciseSettingsTransitionSnapshot = .init(
            exerciseID: exercise.id,
            cardFrame: exerciseSettingsSourceFrame,
            titleFrame: exerciseSettingsSourceTitleFrame,
            destinationFrame: exerciseSettingsDestinationFrame
        )

        #if DEBUG
        let eyebrowSlot = ExerciseFocusedExpansionLayout.settingsEyebrowSlot(
            surfaceFrame: exerciseSettingsDestinationFrame
        )
        let destinationTitleFrame = ExerciseFocusedExpansionLayout.titleDestinationFrame(
            surfaceFrame: exerciseSettingsDestinationFrame,
            sourceTitleFrame: exerciseSettingsSourceTitleFrame
        )
        print(
            "[SettingsTitleGeometry] opening normal=\(exerciseSettingsMeasuredTitleFrame); "
                + "frozen=\(exerciseSettingsSourceTitleFrame); renderer@0=\(exerciseSettingsSourceTitleFrame); "
                + "eyebrow slot=\(eyebrowSlot); renderer@1=\(destinationTitleFrame)"
        )
        #endif

        // Source frames are frozen before presentation state creates the focused
        // shell. At progress zero the new shell and its shared title therefore occupy
        // precisely the same geometry as the currently rendered execution card.
        exerciseSettingsTargetIsPresented = true
        exerciseCardPresentation.present(exerciseID: exercise.id)

        if reduceMotion {
            exerciseSettingsTransitionProgress = 1
        } else {
            exerciseSettingsTransitionProgress = 0
            Task { @MainActor in
                await Task.yield()
                guard exerciseSettingsTransitionGeneration == generation,
                      exerciseSettingsTargetIsPresented else { return }
                withAnimation(EQMotion.objectTransformation) {
                    exerciseSettingsTransitionProgress = 1
                }
            }
        }
    }

    private func dismissExerciseSettings() {
        guard exerciseCardPresentation.exerciseID != nil else { return }
        exerciseSettingsTransitionGeneration += 1
        let generation = exerciseSettingsTransitionGeneration

        #if DEBUG
        if let snapshot = exerciseSettingsTransitionSnapshot {
            print(
                "[SettingsTitleGeometry] closing renderer before handoff target=\(snapshot.titleFrame); "
                    + "normal measured source=\(exerciseSettingsMeasuredTitleFrame)"
            )
        }
        #endif

        if reduceMotion {
            exerciseSettingsTransitionProgress = 0
            exerciseCardPresentation.dismiss()
            exerciseSettingsTransitionSnapshot = nil
            exerciseSettingsTargetIsPresented = false
        } else {
            withAnimation(EQMotion.objectTransformation) {
                exerciseSettingsTransitionProgress = 0
            } completion: {
                guard exerciseSettingsTransitionGeneration == generation,
                      exerciseSettingsTransitionProgress <= 0.001 else { return }
                exerciseCardPresentation.dismiss()
                exerciseSettingsTransitionSnapshot = nil
                exerciseSettingsTargetIsPresented = false
            }
        }
    }

    private func addExercise(_ exercise: ExerciseDefinition) {
        Task {
            guard let occurrenceID = await model.addExercise(exercise) else { return }
            pendingAddedExerciseSettingsID = occurrenceID
            presentPendingAddedExerciseSettingsIfReady()
        }
    }

    private func presentPendingAddedExerciseSettingsIfReady() {
        guard !addsExercise, let occurrenceID = pendingAddedExerciseSettingsID else { return }
        pendingAddedExerciseSettingsID = nil
        guard let exercise = model.exercise(id: occurrenceID) else { return }
        presentExerciseSettings(for: exercise)
    }

    private func showExerciseOverview() {
        if model.restState != nil {
            if performWalletTransition({
                restExerciseListExpansionProgress = restExerciseListExpansionProgress > 0.5 ? 0 : 1
                return true
            }) { haptics.perform(.selection) }
            return
        }
        if performWalletTransition({
            let changed = walletPresentation.showExerciseOverview()
            foregroundFocusProgress = 0
            return changed
        }) { haptics.perform(.selection) }
    }

    private func showFocusedExercise() {
        if performWalletTransition({
            if model.awaitsExerciseSelection, let exercise = model.currentExercise {
                model.focus(exercise.id)
            }
            let changed = walletPresentation.showFocusedExercise()
            foregroundFocusProgress = 1
            return changed
        }) { haptics.perform(.selection) }
    }

    private var executionMotionTarget: ExecutionMotionTarget {
        .init(
            foregroundState: model.foregroundState,
            timerVisible: model.workTimerState != nil || model.restState != nil,
            awaitsExerciseSelection: model.awaitsExerciseSelection,
            foreground: liveForegroundSnapshot
        )
    }

    private func synchronizeMotion(to target: ExecutionMotionTarget) {
        if let foreground = target.foreground {
            displayedForeground = foreground
        }

        let applyTarget = {
            _ = walletPresentation.synchronize(
                with: target.foregroundState,
                awaitsExerciseSelection: target.awaitsExerciseSelection
            )
            let focusTarget: CGFloat = walletPresentation.resolvedMode(for: target.foregroundState) == .focusedExercise ? 1 : 0
            let timerTarget: CGFloat = target.timerVisible ? 1 : 0
            let restExpansionTarget = target.foregroundState == .rest ? restExerciseListExpansionProgress : 0
            foregroundFocusProgress = focusTarget
            timerVisibilityProgress = timerTarget
            restExerciseListExpansionProgress = restExpansionTarget
            foregroundPresenceProgress = target.foreground == nil ? 0 : 1
        }

        guard !reduceMotion, homeTransitionIsSettled else {
            applyTarget()
            if target.foreground == nil { displayedForeground = nil }
            return
        }

        withAnimation(EQMotion.objectTransformation) {
            applyTarget()
        } completion: {
            if executionMotionTarget.foreground == nil {
                displayedForeground = nil
            }
        }
    }

    @discardableResult private func performWalletTransition(_ change: () -> Bool) -> Bool {
        guard !reduceMotion else { return change() }
        var changed = false
        withAnimation(EQMotion.objectTransformation) { changed = change() }
        return changed
    }

}

private struct WorkoutSharePayload: Identifiable {
    let id = UUID()
    let text: String
    let subject: String
}

private final class WorkoutShareItemSource: NSObject, UIActivityItemSource {
    let payload: WorkoutSharePayload

    init(payload: WorkoutSharePayload) {
        self.payload = payload
    }

    func activityViewControllerPlaceholderItem(_ activityViewController: UIActivityViewController) -> Any {
        payload.text
    }

    func activityViewController(
        _ activityViewController: UIActivityViewController,
        itemForActivityType activityType: UIActivity.ActivityType?
    ) -> Any? {
        payload.text
    }

    func activityViewController(
        _ activityViewController: UIActivityViewController,
        subjectForActivityType activityType: UIActivity.ActivityType?
    ) -> String {
        payload.subject
    }
}

private struct WorkoutShareSheet: UIViewControllerRepresentable {
    let payload: WorkoutSharePayload

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(
            activityItems: [WorkoutShareItemSource(payload: payload)],
            applicationActivities: nil
        )
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}

/// Holds `dismiss` outside `WorkoutExecutionView`. `DismissAction` is recreated on every
/// environment update, so reading it in the screen rebuilt the whole execution tree on
/// every frame of the Home → wallet transition.
private struct ExecutionDismissOnRequest: ViewModifier {
    @Environment(\.dismiss) private var dismiss
    let request: Int

    func body(content: Content) -> some View {
        content.onChange(of: request) { _, _ in dismiss() }
    }
}

private struct ExecutionWallet<ListRow: View, ForegroundHeader: View, ForegroundContent: View, ForegroundValues: View, FooterControls: View, SettingsContent: View>: View {
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @Environment(\.foregroundFocusProgress) private var focusProgress
    @Environment(\.timerVisibilityProgress) private var timerVisibilityProgress
    @State private var foregroundTitleHeight: CGFloat = 0
    @State private var completedSectionPresentation = ExecutionCompletedSectionPresentation()
    @State private var revealedCompletedExerciseIDs: Set<WorkoutExerciseID> = []
    @State private var completedSectionAnimationTask: Task<Void, Never>?
    @State private var foregroundEntryProgress: CGFloat = 0
    let workout: Workout
    let model: WorkoutExecutionModel
    let presentation: ExecutionWalletPresentation
    let visualState: ExecutionWalletVisualState
    let foregroundState: ExecutionForegroundState
    let showsForegroundExercise: Bool
    let foregroundPresenceProgress: CGFloat
    let settingsPresented: Bool
    let settingsTransitionProgress: CGFloat
    let settingsSnapshot: ExerciseSettingsTransitionSnapshot?
    let settingsDestinationFrame: CGRect
    let reduceMotion: Bool
    let homeTransitionProgress: CGFloat
    let transitionSourceFrame: CGRect?
    let reportFrame: ((CGRect) -> Void)?
    let reportForegroundFrame: (CGRect) -> Void
    let reportForegroundVisualFrame: (CGRect) -> Void
    let listRow: (WorkoutExercise, ExerciseState) -> ListRow
    let selectExercise: (WorkoutExercise) -> Void
    let addExercise: () -> Void
    let showOverview: () -> Void
    let completedSectionToggled: () -> Void
    let showSettings: (WorkoutExercise) -> Void
    let showFocused: () -> Void
    let skipRest: () -> Void
    let skipWork: () -> Void
    let pauseResumeWork: () -> Void
    let foregroundHeader: (CGFloat, CGFloat) -> ForegroundHeader
    let foregroundContent: () -> ForegroundContent
    let foregroundValues: () -> ForegroundValues
    let primaryAction: ExecutionPrimaryAction?
    let footerControls: (WorkoutExercise) -> FooterControls
    let settingsContent: (WorkoutExercise, WorkoutExerciseID) -> SettingsContent
    let dismissSettings: () -> Void
    /// While typing, the foreground card claims the whole wallet so the inputs fit above the keyboard.
    var keyboardVisible = false
    /// True while the timer region shows rest, including while it collapses away.
    var showsRestTint = false
    /// True while the timer region shows a work interval, including while it collapses away.
    var showsWorkTint = false

    private var workTint: Double {
        showsWorkTint ? Double(min(max(timerVisibilityProgress, 0), 1)) : 0
    }

    /// Follows the same animated progress as the page's rest canvas so wallet colours change in step.
    private var restTint: Double {
        showsRestTint ? Double(min(max(timerVisibilityProgress, 0), 1)) : 0
    }

    /// While the card leaves rest it is already committed to the focused layout, so its
    /// footer and header controls hold their focused positions instead of re-revealing.
    private var isLeavingRest: Bool { visualState == .focusedExercise && restTint > 0.001 }

    private func restBlend(_ color: Color, _ rest: Color) -> Color { color.mix(with: rest, by: restTint) }
    private var overviewTextColor: Color { restBlend(EQColor.Execution.overviewText, EQColor.Execution.restCardText) }
    private var foregroundTextColor: Color {
        EQColor.Execution.foregroundText.mix(with: EQColor.Execution.restCardText, by: restTint)
    }
    private var foregroundSurfaceColor: Color {
        EQColor.Execution.foregroundSurface.mix(with: EQColor.Execution.restForegroundSurface, by: restTint)
    }
    private var canAddExerciseFromOverview: Bool {
        presentation.allowsAddExercise(for: foregroundState, focusProgress: focusProgress)
    }

    var body: some View {
        GeometryReader { proxy in
            let defaultCompactHeight = dynamicTypeSize.isAccessibilitySize
                ? EQLayout.WorkoutExecution.restCardHeight
                : EQLayout.WorkoutExecution.exerciseCompactCardHeight
            let destinationHeight = max(0, proxy.size.height - EQLayout.WorkoutExecution.walletEdgeInset)
            let destinationWidth = max(0, proxy.size.width - (EQLayout.WorkoutExecution.walletEdgeInset * 2))
            let containerFrame = proxy.frame(in: .global)
            let measuredDestinationFrame = CGRect(
                x: containerFrame.minX + EQLayout.WorkoutExecution.walletEdgeInset,
                y: containerFrame.minY,
                width: destinationWidth,
                height: destinationHeight
            )
            let destinationFrame = measuredDestinationFrame
            let sourceFrame = transitionSourceFrame ?? measuredDestinationFrame
            let currentGlobalFrame = sourceFrame.walletInterpolated(
                to: destinationFrame,
                progress: homeTransitionProgress
            )
            let currentFrame = currentGlobalFrame.offsetBy(
                dx: -containerFrame.minX,
                dy: -containerFrame.minY
            )
            let destinationLocalFrame = destinationFrame.offsetBy(
                dx: -containerFrame.minX,
                dy: -containerFrame.minY
            )
            let walletWidth = max(0, currentFrame.width)
            let walletHeight = max(0, currentFrame.height)
            let focusedTop = keyboardVisible ? 0 : ExecutionTimerWalletLayout.focusedCardTop(
                isAccessibilitySize: dynamicTypeSize.isAccessibilitySize
            )
            let restCompactHeight = max(
                defaultCompactHeight,
                EQLayout.WorkoutExecution.restCardHeight
                    + EQLayout.minimumTouch
                    + EQSpacing.md
                    - focusedTop,
                ExecutionTimerWalletLayout.minimumTimingCardHeight(titleHeight: foregroundTitleHeight)
            )
            // Blend with the rest timer's progress so leaving rest grows from the rest card's
            // geometry instead of snapping to the shorter overview card first.
            // Collapsed cards trim the space beneath their content, with or without an action.
            let compactHeight = (visualState == .focusedRest
                ? restCompactHeight
                : defaultCompactHeight + (restCompactHeight - defaultCompactHeight) * CGFloat(restTint))
                - EQSpacing.xs
            let progress = showsForegroundExercise ? min(max(focusProgress, 0), 1) : 0
            let foregroundLayout = ExecutionWalletSurfaceLayout.resolve(
                walletHeight: walletHeight,
                focusedTop: focusedTop,
                compactHeight: compactHeight,
                focusProgress: progress
            )
            let compactArrival = ExecutionForegroundEntry.arrival(
                walletTransitionProgress: homeTransitionProgress,
                entryProgress: foregroundEntryProgress
            )
            let foregroundExitTranslation = ExecutionForegroundExitTranslationModifier(
                homeTransitionProgress: homeTransitionProgress,
                entryProgress: foregroundEntryProgress,
                walletHeight: walletHeight,
                cardTop: foregroundLayout.top,
                gap: EQSpacing.md
            )
            // Retained for DEBUG frame reporting only. The rendered offset is
            // evaluated by `foregroundExitTranslation` from its animatable
            // presentation value, rather than by this ordinary view body.
            let compactEntranceOffset = ExecutionForegroundExitTranslationModifier.offset(
                homeTransitionProgress: homeTransitionProgress,
                entryProgress: foregroundEntryProgress,
                walletHeight: walletHeight,
                cardTop: foregroundLayout.top,
                gap: EQSpacing.md
            )
            let presence = min(max(foregroundPresenceProgress, 0), 1)
            let executionSettingsVisibility = ExerciseCardModeMotion.executionVisibility(
                settingsTransitionProgress
            )
            let foregroundDismissalOffset = ExecutionMotionPolicy.offset(
                distance: compactHeight + EQSpacing.md,
                progress: presence,
                reduceMotion: reduceMotion
            )
            let baseForegroundFrame = CGRect(
                x: currentGlobalFrame.minX,
                y: currentGlobalFrame.minY
                    + foregroundLayout.top
                    + foregroundDismissalOffset,
                width: walletWidth,
                height: foregroundLayout.height
            )
            let renderedForegroundFrame = baseForegroundFrame.offsetBy(
                dx: 0,
                dy: compactEntranceOffset
            )
            ZStack(alignment: .topLeading) {
                if settingsPresented {
                    walletSurfaceContent(
                        compactHeight: compactHeight,
                        walletWidth: walletWidth,
                        walletHeight: walletHeight,
                        foregroundLayout: foregroundLayout
                    )
                    .modifier(ExecutionWalletShapeModifier())
                    .position(x: currentFrame.midX, y: currentFrame.midY)

                    foregroundPresentation(
                        proxy: proxy,
                        progress: progress,
                        walletWidth: walletWidth,
                        walletHeight: walletHeight,
                        walletOriginX: currentFrame.minX,
                        walletOriginY: currentFrame.minY,
                        foregroundLayout: foregroundLayout,
                        compactArrival: compactArrival,
                        foregroundExitTranslation: foregroundExitTranslation,
                        foregroundDismissalOffset: foregroundDismissalOffset,
                        executionSettingsVisibility: executionSettingsVisibility,
                        baseForegroundFrame: baseForegroundFrame
                    )
                } else {
                    // Home ↔ execution uses one animatable renderer. It owns the
                    // wallet viewport, the foreground-only exit translation, and
                    // the final clip in one presentation-frame evaluation.
                    let stableWalletWidth = max(0, destinationLocalFrame.width)
                    let stableWalletHeight = max(0, destinationLocalFrame.height)
                    let stableForegroundLayout = ExecutionWalletSurfaceLayout.resolve(
                        walletHeight: stableWalletHeight,
                        focusedTop: focusedTop,
                        compactHeight: compactHeight,
                        focusProgress: progress
                    )
                    let rendererInput = HomeExecutionPresentationGeometry.Input(
                        homeWalletFrame: sourceFrame.offsetBy(
                            dx: -containerFrame.minX,
                            dy: -containerFrame.minY
                        ),
                        executionWalletFrame: destinationLocalFrame,
                        foregroundTop: stableForegroundLayout.top,
                        foregroundSize: CGSize(width: stableWalletWidth, height: stableForegroundLayout.height),
                        foregroundClearance: EQSpacing.md
                    )

                    UnifiedHomeExecutionRenderer(
                        progress: homeTransitionProgress,
                        input: rendererInput,
                        canvasSize: CGSize(width: stableWalletWidth, height: stableWalletHeight),
                        cornerRadius: EQRadius.walletSurface,
                        borderColor: EQColor.Execution.walletBorder
                            .mix(with: EQColor.Execution.restCanvas, by: restTint)
                            .mix(with: EQColor.Execution.primaryAction, by: workTint),
                        borderWidth: EQLayout.WorkoutExecution.walletBorderWidth * 2,
                        surface: { canvasSize in
                            walletSurfaceContent(
                                compactHeight: compactHeight,
                                walletWidth: canvasSize.width,
                                walletHeight: canvasSize.height,
                                foregroundLayout: stableForegroundLayout
                            )
                        },
                        foreground: { geometry in
                            normalForegroundPresentation(
                                proxy: proxy,
                                progress: progress,
                                walletWidth: stableWalletWidth,
                                walletHeight: stableWalletHeight,
                                foregroundLayout: stableForegroundLayout,
                                compactArrival: geometry.foregroundArrival,
                                foregroundDismissalOffset: foregroundDismissalOffset,
                                executionSettingsVisibility: executionSettingsVisibility
                            )
                        }
                    )
                }

                if ExecutionWalletExitDiagnostics.isEnabled {
                    walletForegroundPresentationOutline(walletFrame: currentFrame)
                        .allowsHitTesting(false)
                        .accessibilityHidden(true)
                        .zIndex(100)
                }

                if ExecutionWalletExitDiagnostics.isEnabled {
                    ExecutionWalletExitProbe(
                        progress: homeTransitionProgress,
                        walletFrame: currentGlobalFrame,
                        foregroundFrame: renderedForegroundFrame,
                        foregroundMounted: showsForegroundExercise,
                        settingsPresented: settingsPresented
                    )
                }

            }
            .frame(width: proxy.size.width, height: proxy.size.height, alignment: .topLeading)
        }
        .onGeometryChange(for: CGRect.self) { proxy in
            let frame = proxy.frame(in: .global)
            return CGRect(
                x: frame.minX + EQLayout.WorkoutExecution.walletEdgeInset,
                y: frame.minY,
                width: max(0, frame.width - (EQLayout.WorkoutExecution.walletEdgeInset * 2)),
                height: max(0, frame.height - EQLayout.WorkoutExecution.walletEdgeInset)
            )
        } action: { frame in
            reportFrame?(frame)
        }
        .id("execution-wallet-\(workout.id.rawValue)")
        .onAppear {
            if ExecutionForegroundEntry.walletIsFullSize(homeTransitionProgress) {
                foregroundEntryProgress = 1
            }
        }
        .onChange(of: ExecutionForegroundEntry.walletIsFullSize(homeTransitionProgress)) { _, isFullSize in
            if isFullSize {
                withAnimation(ExecutionForegroundEntry.animation(reduceMotion: reduceMotion)) {
                    foregroundEntryProgress = 1
                }
            } else if homeTransitionProgress <= 0.001 {
                foregroundEntryProgress = 0
            }
        }
        .allowsHitTesting(homeTransitionProgress > 0.99)
    }

    private var walletSurface: some View {
        EQSurface(color: overviewSurfaceColor, radius: EQRadius.walletSurface)
    }

    @ViewBuilder
    private func walletSurfaceContent(
        compactHeight: CGFloat,
        walletWidth: CGFloat,
        walletHeight: CGFloat,
        foregroundLayout: ExecutionWalletSurfaceLayout
    ) -> some View {
        exerciseListCard(compactHeight: compactHeight)
            .frame(width: walletWidth, height: walletHeight)
            .background {
                walletSurface.accessibilityHidden(true)
            }
            // During a work interval the list tucks down behind the IN PROGRESS card.
            .offset(y: showsForegroundExercise ? (foregroundLayout.top + EQSpacing.lg) * CGFloat(workTint) : 0)
            .accessibilityIdentifier("execution-exercise-list-card-\(workout.id.rawValue)")
            .overlay {
                if ExecutionWalletExitDiagnostics.isEnabled {
                    RoundedRectangle(cornerRadius: EQRadius.walletSurface, style: .continuous)
                        .stroke(.cyan, lineWidth: 2)
                        .allowsHitTesting(false)
                }
            }
    }

    @ViewBuilder
    private func foregroundPresentation(
        proxy: GeometryProxy,
        progress: CGFloat,
        walletWidth: CGFloat,
        walletHeight: CGFloat,
        walletOriginX: CGFloat,
        walletOriginY: CGFloat,
        foregroundLayout: ExecutionWalletSurfaceLayout,
        compactArrival: CGFloat,
        foregroundExitTranslation: ExecutionForegroundExitTranslationModifier,
        foregroundDismissalOffset: CGFloat,
        executionSettingsVisibility: CGFloat,
        baseForegroundFrame: CGRect
    ) -> some View {
        ZStack(alignment: .topLeading) {
            persistentForegroundCardHost(
                proxy: proxy,
                progress: progress,
                walletWidth: walletWidth,
                walletOriginX: walletOriginX,
                foregroundLayout: foregroundLayout,
                compactArrival: compactArrival,
                foregroundExitTranslation: foregroundExitTranslation,
                foregroundDismissalOffset: foregroundDismissalOffset,
                executionSettingsVisibility: executionSettingsVisibility,
                baseForegroundFrame: baseForegroundFrame
            )

            stationaryExecutionValuesViewport(
                cardWidth: walletWidth,
                cardHeight: foregroundLayout.height,
                cardTop: foregroundLayout.top + foregroundDismissalOffset,
                focusProgress: progress
            )
            .offset(x: walletOriginX, y: walletOriginY)
            .modifier(foregroundExitTranslation)
            .zIndex(2)

            Color.clear
                .frame(width: walletWidth, height: walletHeight)
                .overlay {
                    unifiedActionControls(primaryAction)
                        .opacity(keyboardVisible ? 0 : 1)
                        .modifier(ExerciseSettingsContentVisibilityModifier(
                            progress: settingsTransitionProgress,
                            group: .execution
                        ))
                        .allowsHitTesting(!keyboardVisible && !settingsPresented && executionSettingsVisibility > 0.99)
                        .accessibilityHidden(keyboardVisible || settingsPresented || executionSettingsVisibility < 0.01)
                        .offset(y: showsForegroundExercise ? foregroundDismissalOffset : 0)
                        .modifier(foregroundExitTranslation)
                }
                .position(x: walletOriginX + (walletWidth / 2), y: walletOriginY + (walletHeight / 2))
        }
        .frame(width: proxy.size.width, height: proxy.size.height, alignment: .topLeading)
    }

    /// The normal, clipped Home ↔ execution foreground region. All stateful
    /// production subtrees remain mounted exactly once; the unified renderer
    /// above applies their shared exit translation after this region is composed.
    @ViewBuilder
    private func normalForegroundPresentation(
        proxy: GeometryProxy,
        progress: CGFloat,
        walletWidth: CGFloat,
        walletHeight: CGFloat,
        foregroundLayout: ExecutionWalletSurfaceLayout,
        compactArrival: CGFloat,
        foregroundDismissalOffset: CGFloat,
        executionSettingsVisibility: CGFloat
    ) -> some View {
        ZStack(alignment: .topLeading) {
            if showsForegroundExercise {
                compactForegroundCardShell(
                    foregroundCard(
                        progress: progress,
                        hidesTransitionedHeader: true,
                        showsValues: false
                    ),
                    width: walletWidth,
                    height: foregroundLayout.height
                )
                .offset(y: foregroundLayout.top + foregroundDismissalOffset)
                .opacity(executionSettingsVisibility)
                .accessibilityHidden(compactArrival < 0.99)
                .onGeometryChange(for: CGRect.self) { geometry in
                    geometry.frame(in: .global)
                } action: { frame in
                    reportForegroundFrame(frame)
                    reportForegroundVisualFrame(frame)
                }
                .zIndex(1)
                .accessibilityIdentifier("execution-current-exercise-card-\(workout.id.rawValue)")
            }

            stationaryExecutionValuesViewport(
                cardWidth: walletWidth,
                cardHeight: foregroundLayout.height,
                cardTop: foregroundLayout.top + foregroundDismissalOffset,
                focusProgress: progress
            )
            .zIndex(2)

            if showsForegroundExercise {
                let headerWidth = max(0, walletWidth - (EQLayout.WorkoutExecution.walletInset * 2))
                foregroundHeader(progress, isLeavingRest ? 1 : 0)
                    .foregroundStyle(foregroundTextColor)
                    .tint(foregroundTextColor)
                    .frame(width: headerWidth, height: EQLayout.minimumTouch, alignment: .leading)
                    .position(
                        x: EQLayout.WorkoutExecution.walletInset + (headerWidth / 2),
                        y: foregroundLayout.top + foregroundDismissalOffset + EQSpacing.xxs + (EQLayout.minimumTouch / 2)
                    )
                    .modifier(ExerciseSettingsContentVisibilityModifier(
                        progress: settingsTransitionProgress,
                        group: .execution
                    ))
                    .allowsHitTesting(executionSettingsVisibility > 0.99)
                    .accessibilityHidden(executionSettingsVisibility < 0.01)
                    .zIndex(22)
            }

            Color.clear
                .frame(width: walletWidth, height: walletHeight)
                .overlay {
                    unifiedActionControls(primaryAction)
                        .opacity(keyboardVisible ? 0 : 1)
                        .modifier(ExerciseSettingsContentVisibilityModifier(
                            progress: settingsTransitionProgress,
                            group: .execution
                        ))
                        .allowsHitTesting(!keyboardVisible && executionSettingsVisibility > 0.99)
                        .accessibilityHidden(keyboardVisible || executionSettingsVisibility < 0.01)
                        .offset(y: showsForegroundExercise ? foregroundDismissalOffset : 0)
                }
                // The focused card and values view deliberately use z-indices 1 and 2.
                // Keep the one unified footer above that opaque card so its bottom
                // action remains visible after Settings returns to this renderer.
                .zIndex(3)
        }
        .frame(width: walletWidth, height: walletHeight, alignment: .topLeading)
    }

    @ViewBuilder
    private func walletForegroundPresentationOutline(walletFrame: CGRect) -> some View {
        if #available(iOS 26.0, *) {
            ConcentricRectangle(
                uniformTopCorners: .fixed(EQRadius.walletSurface),
                uniformBottomCorners: .concentric(minimum: .fixed(EQRadius.walletSurface))
            )
            .stroke(.yellow, lineWidth: 2)
            .frame(width: walletFrame.width, height: walletFrame.height)
            .position(x: walletFrame.midX, y: walletFrame.midY)
        } else {
            RoundedRectangle(cornerRadius: EQRadius.walletSurface, style: .continuous)
                .stroke(.yellow, lineWidth: 2)
                .frame(width: walletFrame.width, height: walletFrame.height)
                .position(x: walletFrame.midX, y: walletFrame.midY)
        }
    }

    /// The normal execution card's permanent owner. It remains mounted while the
    /// legacy focused Settings host is active, so Settings presentation no longer
    /// removes or recreates the compact card subtree.
    @ViewBuilder
    private func persistentForegroundCardHost(
        proxy: GeometryProxy,
        progress: CGFloat,
        walletWidth: CGFloat,
        walletOriginX: CGFloat,
        foregroundLayout: ExecutionWalletSurfaceLayout,
        compactArrival: CGFloat,
        foregroundExitTranslation: ExecutionForegroundExitTranslationModifier,
        foregroundDismissalOffset: CGFloat,
        executionSettingsVisibility: CGFloat,
        baseForegroundFrame: CGRect
    ) -> some View {
        ZStack(alignment: .topLeading) {
            if showsForegroundExercise {
                compactForegroundCardShell(
                foregroundCard(
                    progress: progress,
                    hidesTransitionedHeader: true,
                    showsValues: false
                ),
                width: walletWidth,
                height: foregroundLayout.height
            )
                .offset(
                    x: walletOriginX,
                    y: foregroundLayout.top + foregroundDismissalOffset
                )
                .modifier(foregroundExitTranslation)
                .opacity(settingsPresented ? 0 : executionSettingsVisibility)
                .overlay {
                    if ExecutionWalletExitDiagnostics.isEnabled {
                        RoundedRectangle(cornerRadius: EQRadius.walletSurface, style: .continuous)
                            .stroke(.pink, lineWidth: 3)
                            .allowsHitTesting(false)
                    }
                }
                .accessibilityHidden(compactArrival < 0.99)
                .onGeometryChange(for: CGRect.self) { geometry in
                    geometry.frame(in: .global)
                } action: { frame in
                    reportForegroundFrame(frame)
                    reportForegroundVisualFrame(frame)
                }
                .zIndex(1)
                    .accessibilityIdentifier("execution-current-exercise-card-\(workout.id.rawValue)")
            }
            focusedForegroundHost(proxy: proxy, focusedProgress: progress)

            persistentExecutionHeader(
                proxy: proxy,
                focusedProgress: progress,
                baseForegroundFrame: baseForegroundFrame,
                foregroundExitTranslation: foregroundExitTranslation
            )
            .zIndex(22)

            persistentExerciseTitle(proxy: proxy)
                .zIndex(21)
        }
        .frame(width: proxy.size.width, height: proxy.size.height, alignment: .topLeading)
    }

    /// A title-only transition renderer. The compact and expanded execution states
    /// retain their established title layout; this renderer takes visual ownership
    /// only for the measured execution-to-Settings transformation.
    @ViewBuilder
    private func persistentExerciseTitle(proxy: GeometryProxy) -> some View {
        if settingsPresented,
           let snapshot = settingsSnapshot,
           let titleName = model.exercise(id: snapshot.exerciseID)?.nameSnapshot,
           snapshot.titleFrame.width > 0,
           snapshot.titleFrame.height > 0 {
            let sourceFrame = snapshot.titleFrame
            let destinationFrame = ExerciseFocusedExpansionLayout.titleDestinationFrame(
                surfaceFrame: settingsDestinationFrame,
                sourceTitleFrame: sourceFrame
            )
            let globalFrame = ExerciseFocusedExpansionLayout.frame(
                from: sourceFrame,
                to: destinationFrame,
                progress: settingsTransitionProgress
            )
            let containerFrame = proxy.frame(in: .global)
            let localFrame = globalFrame.offsetBy(dx: -containerFrame.minX, dy: -containerFrame.minY)
            let scale = 1 + ((ExerciseFocusedExpansionLayout.titleScale - 1) * settingsTransitionProgress)
            // `globalFrame` describes the title's visible, scaled bounds. The text
            // itself retains the execution title's unscaled layout size and scales
            // from its leading/top edge, so position that unscaled layout from the
            // interpolated visible origin instead of the scaled frame's midpoint.
            // This keeps both ownership handoff endpoints pixel-aligned.
            let layoutCenter = CGPoint(
                x: localFrame.minX + (sourceFrame.width / 2),
                y: localFrame.minY + (sourceFrame.height / 2)
            )

            Text(titleName)
                .eqTextStyle(.screenTitle)
                .lineLimit(2)
                .frame(width: sourceFrame.width, height: sourceFrame.height, alignment: .topLeading)
                .scaleEffect(scale, anchor: .topLeading)
                // The exercise name is shared transition chrome, not Settings
                // secondary content. It retains the production execution colour for
                // the full trajectory.
                .foregroundStyle(EQColor.Execution.foregroundText)
                .position(x: layoutCenter.x, y: layoutCenter.y)
                .accessibilityHidden(true)
        }
    }

    /// The execution header stays mounted in the wallet's common coordinate space.
    /// It follows the focused shell's top edge when Settings expands, while its
    /// visibility is driven by the same frame-interpolated progress as values and
    /// the independent footer.
    @ViewBuilder
    private func persistentExecutionHeader(
        proxy: GeometryProxy,
        focusedProgress: CGFloat,
        baseForegroundFrame: CGRect,
        foregroundExitTranslation: ExecutionForegroundExitTranslationModifier
    ) -> some View {
        if showsForegroundExercise {
            let globalFrame = executionHeaderFrame(baseForegroundFrame: baseForegroundFrame)
            let containerFrame = proxy.frame(in: .global)
            let localFrame = globalFrame.offsetBy(dx: -containerFrame.minX, dy: -containerFrame.minY)
            let executionVisibility = ExerciseCardModeMotion.executionVisibility(settingsTransitionProgress)
            let headerWidth = max(0, localFrame.width - (EQLayout.WorkoutExecution.walletInset * 2))

            foregroundHeader(focusedProgress, isLeavingRest ? 1 : 0)
                // This header now lives beside `foregroundCard`, so it no longer
                // inherits the compact card's execution foreground environment.
                // Reapply that existing theme-aware treatment without changing
                // its shared transition visibility.
                .foregroundStyle(foregroundTextColor)
                .tint(foregroundTextColor)
                .frame(
                    width: headerWidth,
                    height: EQLayout.minimumTouch,
                    alignment: .leading
                )
                .position(
                    x: localFrame.minX + EQLayout.WorkoutExecution.walletInset + (headerWidth / 2),
                    y: localFrame.minY + EQSpacing.xxs + (EQLayout.minimumTouch / 2)
                )
                .modifier(ExerciseSettingsContentVisibilityModifier(
                    progress: settingsTransitionProgress,
                    group: .execution
                ))
                .modifier(foregroundExitTranslation)
                .allowsHitTesting(!settingsPresented && executionVisibility > 0.99)
                .accessibilityHidden(settingsPresented || executionVisibility < 0.01)
        } else {
            EmptyView()
        }
    }

    private func executionHeaderFrame(baseForegroundFrame: CGRect) -> CGRect {
        guard settingsPresented,
              let snapshot = settingsSnapshot,
              settingsDestinationFrame.width > 0 else {
            return baseForegroundFrame
        }

        let sourceFrame = ExerciseFocusedExpansionLayout.bottomAnchoredSourceFrame(
            measuredSource: snapshot.cardFrame,
            destination: settingsDestinationFrame
        )
        return ExerciseFocusedExpansionLayout.frame(
            from: sourceFrame,
            to: settingsDestinationFrame,
            progress: settingsTransitionProgress
        )
    }

    /// The compact card's opaque surface. The caller supplies only its existing
    /// compact frame; the independent execution footer is intentionally excluded.
    private func compactForegroundCardShell<Content: View>(
        _ content: Content,
        width: CGFloat,
        height: CGFloat
    ) -> some View {
        content
            .frame(width: width, height: height, alignment: .top)
            .background(foregroundBackground)
            .modifier(ExecutionWalletShapeModifier(
                drawsBorder: true,
                borderColor: EQColor.Execution.walletBorder
                    .mix(with: EQColor.Execution.restCanvas, by: restTint)
                    .mix(with: EQColor.Execution.primaryAction, by: workTint),
                externalTopGapColor: EQColor.Execution.foregroundSurface,
                externalTopGap: EQLayout.WorkoutExecution.workCardExternalTopGap
                    * CGFloat(workTint)
            ))
            .contentShape(RoundedRectangle(cornerRadius: EQRadius.walletSurface, style: .continuous))
    }

    /// The foreground card's focused representation lives beside the wallet's
    /// structural placeholder, in the wallet's own coordinate space.  Keeping this
    /// host here avoids the old scene-level card/title handoff: one owner renders the
    /// opaque surface, the execution representation, the settings destination, and
    /// the shared title for the complete focused lifecycle.
    @ViewBuilder
    private func focusedForegroundHost(
        proxy: GeometryProxy,
        focusedProgress: CGFloat
    ) -> some View {
        if settingsPresented,
           let snapshot = settingsSnapshot,
           snapshot.exerciseID == model.currentExercise?.id,
           let exercise = model.exercise(id: snapshot.exerciseID),
           snapshot.cardFrame.width > 0,
           snapshot.titleFrame.width > 0,
           settingsDestinationFrame.width > 0 {

        let sourceFrame = ExerciseFocusedExpansionLayout.bottomAnchoredSourceFrame(
            measuredSource: snapshot.cardFrame,
            destination: settingsDestinationFrame
        )
        let globalFrame = ExerciseFocusedExpansionLayout.frame(
            from: sourceFrame,
            to: settingsDestinationFrame,
            progress: settingsTransitionProgress
        )
        let containerFrame = proxy.frame(in: .global)
        let localFrame = globalFrame.offsetBy(dx: -containerFrame.minX, dy: -containerFrame.minY)
        let localDestinationFrame = settingsDestinationFrame.offsetBy(
            dx: -containerFrame.minX,
            dy: -containerFrame.minY
        )
        let settingsVisibility = ExerciseCardModeMotion.settingsVisibility(settingsTransitionProgress)
        let executionVisibility = ExerciseCardModeMotion.executionVisibility(settingsTransitionProgress)

        ZStack {
            EQColor.Execution.foregroundSurface

            // The persistent execution header owns IN PROGRESS and the sliders
            // glyph. This focused host retains only the incoming close control.
            Button(action: dismissSettings) {
                Image(systemName: "xmark")
                    .eqTextStyle(.icon)
                    .frame(width: EQLayout.minimumTouch, height: EQLayout.minimumTouch, alignment: .trailing)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Close exercise settings")
            .modifier(ExerciseSettingsContentVisibilityModifier(
                progress: settingsTransitionProgress,
                group: .settings
            ))
            .allowsHitTesting(settingsVisibility > 0.99)
            .accessibilityHidden(settingsVisibility < 0.01)
            .foregroundStyle(foregroundTextColor)
            .frame(width: EQLayout.minimumTouch, height: EQLayout.minimumTouch, alignment: .trailing)
            .position(
                x: localFrame.width - EQLayout.WorkoutExecution.walletInset - (EQLayout.minimumTouch / 2),
                y: EQSpacing.xxs + (EQLayout.minimumTouch / 2)
            )
            .accessibilityHidden(settingsVisibility < 0.01 && executionVisibility < 0.01)

            settingsContent(exercise, snapshot.exerciseID)
                .frame(width: localDestinationFrame.width, height: localDestinationFrame.height)
                .offset(
                    x: localDestinationFrame.midX - localFrame.midX,
                    y: localDestinationFrame.midY - localFrame.midY
                )
                .allowsHitTesting(settingsVisibility > 0.99)
                .accessibilityHidden(settingsVisibility < 0.99)
                .modifier(ExerciseSettingsContentVisibilityModifier(
                    progress: settingsTransitionProgress,
                    group: .settings
                ))

        }
        .frame(width: localFrame.width, height: localFrame.height)
        .modifier(ExecutionWalletShapeModifier(
            drawsBorder: true,
            borderColor: EQColor.Execution.walletBorder
        ))
        .contentShape(RoundedRectangle(cornerRadius: EQRadius.walletSurface, style: .continuous))
        .position(x: localFrame.midX, y: localFrame.midY)
        .zIndex(20)
        .anchorPreference(key: HomeWorkoutTitleAnchorKey.self, value: .bounds) {
            [.focusedExerciseSettingsSurface: $0]
        }
        .accessibilityIdentifier("execution-focused-exercise-settings-\(snapshot.exerciseID.rawValue)")
        }
    }

    private var overviewSurfaceColor: Color {
        let dim = showsForegroundExercise ? Double(min(max(focusProgress, 0), 1)) : 0
        let surface = EQColor.Execution.overviewSurface
            .mix(with: EQColor.Execution.overviewDimmedSurface, by: dim)
            .mix(with: EQColor.Execution.restOverviewSurface, by: restTint)
        // Completed workouts leave Home on the neutral card fill, so blend from it as the wallet grows.
        guard model.isReadOnly else { return surface }
        return HomeCardColors(status: .completed).surface
            .mix(with: surface, by: Double(min(max(homeTransitionProgress, 0), 1)))
    }

    private func exerciseListCard(compactHeight: CGFloat) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            exerciseListHeader
                .accessibilityIdentifier("execution-exercises-header-\(workout.id.rawValue)")
                .padding(.horizontal, EQLayout.WorkoutExecution.walletInset)
                .padding(.top, EQSpacing.xxs)
                .padding(.bottom, EQLayout.WorkoutExecution.overviewHeaderBottomInset)
                .background(overviewSurfaceColor)
                .opacity(headerRevealOpacity)
                .offset(y: revealOffset(for: headerRevealProgress))
                .zIndex(2)

            ScrollView {
                LazyVStack(alignment: .leading, spacing: 0) {
                    if model.isReadOnly {
                        Text("Completed · Read-only")
                            .eqTextStyle(.caption)
                            .foregroundStyle(overviewTextColor)
                            .modifier(WalletRevealModifier(progress: rowRevealProgress(index: 0)))
                    }
                    LazyVStack(alignment: .leading, spacing: EQLayout.exerciseBlockGap) {
                        ForEach(Array(overviewListItems.enumerated()), id: \.element.id) { index, item in
                            switch item {
                            case .exercise(let exercise):
                                exerciseButton(exercise)
                                    .modifier(WalletRevealModifier(progress: exerciseRevealProgress(exercise, index: index)))
                                    .transition(completedExerciseTransition(for: exercise))
                            case .completedDisclosure:
                                completedDisclosureRow
                                    .padding(
                                        .top,
                                        remainingExercises.isEmpty
                                            ? 0
                                            : EQLayout.WorkoutExecution.completedSectionTopSpacing
                                                - EQLayout.exerciseBlockGap
                                    )
                                    .modifier(WalletRevealModifier(progress: completedSectionRevealProgress))
                            }
                        }
                    }
                    .animation(
                        reduceMotion ? nil : EQMotion.contentTransition,
                        value: exerciseListMotionIdentity
                    )
                }
                .padding(.horizontal, EQLayout.WorkoutExecution.walletInset)
                .padding(.top, EQLayout.WorkoutExecution.overviewContentTopInset)
                .padding(
                    .bottom,
                    EQLayout.WorkoutExecution.walletInset
                        + (compactHeight * min(max(foregroundPresenceProgress, 0), 1))
                )
            }
            .scrollIndicators(.hidden)
            .scrollDisabled(showsForegroundExercise && focusProgress > 0.01)
            .clipped()
            .accessibilityHidden(visualState != .exerciseOverview || focusProgress > 0.01)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .foregroundStyle(overviewTextColor)
        .onChange(of: completedExerciseIDs) { _, ids in
            revealedCompletedExerciseIDs.formIntersection(ids)
            if completedSectionPresentation.isExpanded {
                animateCompletedSection(expanding: true)
            }
        }
        .onChange(of: reduceMotion) { _, isReduceMotionEnabled in
            guard isReduceMotionEnabled else { return }
            completedSectionAnimationTask?.cancel()
            revealedCompletedExerciseIDs = completedSectionPresentation.isExpanded
                ? Set(completedExerciseIDs)
                : []
        }
        .onDisappear {
            completedSectionAnimationTask?.cancel()
        }
    }

    private var headerRevealProgress: CGFloat {
        HomeExecutionReveal.progress(homeTransitionProgress, from: 0.78, through: 0.88)
    }

    private var headerRevealOpacity: Double { Double(headerRevealProgress) }

    private func rowRevealProgress(index: Int) -> CGFloat {
        let start = min(0.90, 0.82 + (CGFloat(min(index, 4)) * 0.018))
        return HomeExecutionReveal.progress(homeTransitionProgress, from: start, through: min(1, start + 0.10))
    }

    private var completedSectionRevealProgress: CGFloat {
        HomeExecutionReveal.progress(homeTransitionProgress, from: 0.87, through: 0.97)
    }

    private func completedRowRevealProgress(index: Int) -> CGFloat {
        let start = min(0.94, 0.89 + (CGFloat(min(index, 3)) * 0.018))
        return HomeExecutionReveal.progress(homeTransitionProgress, from: start, through: 1)
    }

    private func exerciseRevealProgress(_ exercise: WorkoutExercise, index: Int) -> CGFloat {
        if let completedIndex = completedExercises.firstIndex(where: { $0.id == exercise.id }) {
            return completedRowRevealProgress(index: completedIndex)
        }
        return rowRevealProgress(index: index)
    }

    private func revealOffset(for progress: CGFloat) -> CGFloat {
        ExecutionMotionPolicy.offset(
            distance: EQSpacing.sm,
            progress: progress,
            reduceMotion: reduceMotion
        )
    }

    private var exerciseListHeader: some View {
        let canShowOverview = showsForegroundExercise
            && (visualState == .focusedExercise || visualState == .exerciseOverview || visualState == .focusedRest)
        return HStack(spacing: EQLayout.controlGap) {
            Button {
                if canShowOverview { showOverview() }
            } label: {
                Text("EXERCISES")
                    .eqTextStyle(.sectionLabel)
                    .foregroundStyle(overviewTextColor)
                    .frame(maxWidth: .infinity, minHeight: EQLayout.minimumTouch, alignment: .leading)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .allowsHitTesting(canShowOverview)
            .accessibilityLabel("Exercises")
            .accessibilityHint(
                canShowOverview
                    ? (presentation.mode == .focusedExercise ? "Shows the full exercise list" : "Exercise list is already visible")
                    : (workout.status == .completed ? "Completed workout exercise overview" : "Exercise overview is unavailable during rest")
            )

            if model.showsExecutionOptions {
                EQIconButton(systemImage: "plus", alignment: .trailing) {
                    guard canAddExerciseFromOverview else { return }
                    addExercise()
                }
                .foregroundStyle(overviewTextColor)
                .offset(x: EQLayout.WorkoutExecution.trailingIconOutset)
                .disabled(!canAddExerciseFromOverview)
                .allowsHitTesting(canAddExerciseFromOverview)
                .accessibilityHidden(!canAddExerciseFromOverview)
                .accessibilityLabel("Add exercise")
                .accessibilityHint("Opens the exercise picker")
            }
        }
    }

    private var completedDisclosureRow: some View {
        Button {
            completedSectionPresentation.toggle()
            animateCompletedSection(expanding: completedSectionPresentation.isExpanded)
            completedSectionToggled()
        } label: {
            EQDisclosureRow(
                title: ExecutionCompletedSectionPresentation.title(completedCount: completedExercises.count),
                isExpanded: completedSectionPresentation.isExpanded,
                color: restBlend(EQColor.Execution.overviewSecondaryText, EQColor.Execution.restCardText),
                animation: reduceMotion
                    ? nil
                    : ExecutionCompletedSectionMotion.animation(
                        expanding: completedSectionPresentation.isExpanded
                    ),
                iconTrailingOffset: EQLayout.WorkoutExecution.trailingIconOutset
            )
        }
        .buttonStyle(.plain)
        .accessibilityLabel(ExecutionCompletedSectionPresentation.title(completedCount: completedExercises.count))
        .accessibilityValue(completedSectionPresentation.isExpanded ? "Expanded" : "Collapsed")
        .accessibilityHint(completedSectionPresentation.isExpanded ? "Collapses completed exercises" : "Expands completed exercises")
    }

    private var remainingExercises: [WorkoutExercise] {
        workout.exercises.filter { $0.skippedAt != nil || !WorkoutExecutionQuery.isComplete($0) }
    }

    private var completedExercises: [WorkoutExercise] {
        workout.exercises.filter { $0.skippedAt == nil && WorkoutExecutionQuery.isComplete($0) }
    }

    private var completedExerciseIDs: [WorkoutExerciseID] {
        completedExercises.map(\.id)
    }

    private var overviewListItems: [ExecutionOverviewListItem] {
        var items = remainingExercises.map(ExecutionOverviewListItem.exercise)
        guard !completedExercises.isEmpty else { return items }
        items.append(.completedDisclosure)
        items.append(
            contentsOf: completedExercises
                .filter { revealedCompletedExerciseIDs.contains($0.id) }
                .map(ExecutionOverviewListItem.exercise)
        )
        return items
    }

    private var exerciseListMotionIdentity: String {
        let exercises = remainingExercises + completedExercises
        let exerciseIdentity = exercises.map { exercise in
            let state = model.states[exercise.id]?.rawValue ?? "upcoming"
            let completedSets = WorkoutExecutionQuery.completedPrescriptionIDs(in: exercise).count
            return "\(exercise.id.rawValue):\(state):\(completedSets)"
        }.joined(separator: "|")
        return exerciseIdentity
    }

    private func completedExerciseTransition(for exercise: WorkoutExercise) -> AnyTransition {
        guard !reduceMotion, completedExerciseIDs.contains(exercise.id) else { return .identity }
        return AnyTransition
            .offset(y: ExecutionCompletedSectionMotion.insertionOffset)
            .combined(with: .opacity)
    }

    private func animateCompletedSection(expanding: Bool) {
        completedSectionAnimationTask?.cancel()

        guard !reduceMotion else {
            revealedCompletedExerciseIDs = expanding ? Set(completedExerciseIDs) : []
            return
        }

        let orderedIDs = expanding
            ? completedExerciseIDs.filter { !revealedCompletedExerciseIDs.contains($0) }
            : completedExerciseIDs.reversed().filter { revealedCompletedExerciseIDs.contains($0) }
        let stepDelay = ExecutionCompletedSectionMotion.stepDelay(
            reduceMotion: false,
            expanding: expanding
        )

        completedSectionAnimationTask = Task { @MainActor in
            for (index, id) in orderedIDs.enumerated() {
                guard !Task.isCancelled else { return }
                if index > 0 {
                    try? await Task.sleep(nanoseconds: UInt64(stepDelay * 1_000_000_000))
                    guard !Task.isCancelled else { return }
                }
                withAnimation(ExecutionCompletedSectionMotion.animation(expanding: expanding)) {
                    if expanding {
                        revealedCompletedExerciseIDs.insert(id)
                    } else {
                        revealedCompletedExerciseIDs.remove(id)
                    }
                }
            }
        }
    }

    @ViewBuilder private func exerciseButton(_ exercise: WorkoutExercise) -> some View {
        let state = model.states[exercise.id] ?? .upcoming
        Group {
            if workout.status == .completed {
                listRow(exercise, state)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .accessibilityElement(children: .combine)
                    .accessibilityHint("Completed workout is read-only")
            } else {
                Button { selectExercise(exercise) } label: {
                    listRow(exercise, state)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityHint(
                    exercise.skippedAt == nil
                        ? "Makes this the active exercise without changing workout order"
                        : "Offers to restore this skipped exercise"
                )
                .contextMenu {
                    if ExerciseOverviewInteraction.actions(for: exercise).contains(.exerciseSettings) {
                        Button("Exercise Settings", systemImage: "gearshape") { showSettings(exercise) }
                    }
                }
            }
        }
        .accessibilityIdentifier("execution-exercise-row-\(exercise.id.rawValue)")
        .frame(maxWidth: .infinity, alignment: .leading)
        .environment(\.executionRestTint, restTint)
    }

    private func foregroundCard(
        progress: CGFloat,
        hidesTransitionedHeader: Bool = false,
        showsValues: Bool = true
    ) -> some View {
        let isFocused = progress > 0.99
        let isWorking = visualState == .focusedWork
        let isTiming = isWorking || visualState == .focusedRest
        let actionHeight = EQLayout.WorkoutExecution.primaryActionHeight
        let actionFooterHeight = ExecutionPrimaryActionLayout.footerHeight(
            isVisible: true,
            controlHeight: actionHeight,
            topInset: EQLayout.WorkoutExecution.primaryActionTopInset,
            bottomInset: EQLayout.WorkoutExecution.primaryActionBottomInset,
            trailingControlHeight: EQLayout.minimumTouch
        )
        let hasExerciseAction = foregroundState == .exercise
            && !model.isReadOnly
            && !model.awaitsExerciseSelection
        let showsActionFooter = presentation.showsActionFooter(
            for: foregroundState,
            awaitsExerciseSelection: model.awaitsExerciseSelection,
            isReadOnly: model.isReadOnly
        )
        let footerProgress: CGFloat = keyboardVisible
            ? 0
            : (showsActionFooter ? (isTiming || isLeavingRest ? 1 : progress) : 0)
        let footerHeight = actionFooterHeight * footerProgress
        let accessibilityHeaderPadding = dynamicTypeSize.isAccessibilitySize ? EQSpacing.xl : 0
        let executionSettingsHasTakenOwnership = settingsPresented
            && ExerciseCardModeMotion.executionVisibility(settingsTransitionProgress) <= 0.001
        // The collapsed card tucks the title closer to IN PROGRESS; the gap opens as it expands.
        let collapsedTitleLift = EQSpacing.md * max(1 - min(max(progress, 0), 1), CGFloat(workTint))
        let headerHeight = EQLayout.minimumTouch + EQSpacing.xxs + (accessibilityHeaderPadding * 2) - collapsedTitleLift

        return GeometryReader { proxy in
            let anchors = ExecutionPrimaryActionLayout.foregroundAnchors(
                cardHeight: proxy.size.height,
                headerHeight: headerHeight,
                footerHeight: footerHeight
            )
            let isOverview = presentation.resolvedMode(for: foregroundState) == .exerciseOverview
            let contentViewportHeight = isOverview
                ? ExecutionPrimaryActionLayout.titleOnlyViewportHeight(
                    titleHeight: foregroundTitleHeight,
                    availableHeight: anchors.contentHeight,
                    minimumTitleHeight: EQLayout.minimumTouch,
                    topInset: EQSpacing.xxs
                )
                : anchors.contentHeight
            VStack(alignment: .leading, spacing: 0) {
                executionCardHeader(progress: progress, isLeavingRest: isLeavingRest, accessibilityHeaderPadding: accessibilityHeaderPadding, collapsedTitleLift: collapsedTitleLift, hidesTransitionedChrome: hidesTransitionedHeader)
                executionCardContentViewport(height: contentViewportHeight, isFocused: isFocused, settingsHasTakenOwnership: executionSettingsHasTakenOwnership, hidesTransitionedChrome: false)
            }
            .frame(width: proxy.size.width, height: proxy.size.height, alignment: .topLeading)
            .overlay(alignment: .topLeading) {
                if showsValues, hasExerciseAction, !isTiming {
                    let revealProgress = min(max((progress - 0.18) / 0.82, 0), 1)
                    // Values scroll in their own viewport beneath the exercise title.
                    let valuesTopInset = anchors.contentTop + EQSpacing.xxs + foregroundTitleHeight + EQSpacing.xs
                    let valuesBottomInset = max(0, proxy.size.height - anchors.contentBottom)
                        + (executionSettingsHasTakenOwnership ? 0 : EQSpacing.md)
                    executionValuesViewport(width: proxy.size.width, height: max(0, proxy.size.height - valuesTopInset - valuesBottomInset), topInset: valuesTopInset, revealProgress: revealProgress)
                }
            }
            .contentShape(Rectangle())
            .simultaneousGesture(
                TapGesture().onEnded { showFocused() },
                including: !isFocused && !isTiming ? .all : .none
            )
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .foregroundStyle(foregroundTextColor)
    }

    /// The one stateful execution-values subtree. It remains in wallet coordinates
    /// while the shell transforms, preserving FocusedSetView's local draft/focus state.
    @ViewBuilder
    private func stationaryExecutionValuesViewport(
        cardWidth: CGFloat,
        cardHeight: CGFloat,
        cardTop: CGFloat,
        focusProgress: CGFloat
    ) -> some View {
        let isTiming = visualState == .focusedWork || visualState == .focusedRest
        let hasExerciseAction = foregroundState == .exercise && !model.isReadOnly && !model.awaitsExerciseSelection
        let actionFooterHeight = ExecutionPrimaryActionLayout.footerHeight(
            isVisible: true,
            controlHeight: EQLayout.WorkoutExecution.primaryActionHeight,
            topInset: EQLayout.WorkoutExecution.primaryActionTopInset,
            bottomInset: EQLayout.WorkoutExecution.primaryActionBottomInset,
            trailingControlHeight: EQLayout.minimumTouch
        )
        let showsActionFooter = presentation.showsActionFooter(
            for: foregroundState,
            awaitsExerciseSelection: model.awaitsExerciseSelection,
            isReadOnly: model.isReadOnly
        )
        let footerHeight = actionFooterHeight * (keyboardVisible ? 0 : (showsActionFooter ? focusProgress : 0))
        let headerPadding = dynamicTypeSize.isAccessibilitySize ? EQSpacing.xl : 0
        let titleLift = EQSpacing.md * max(1 - min(max(focusProgress, 0), 1), CGFloat(workTint))
        let headerHeight = EQLayout.minimumTouch + EQSpacing.xxs + (headerPadding * 2) - titleLift
        let anchors = ExecutionPrimaryActionLayout.foregroundAnchors(cardHeight: cardHeight, headerHeight: headerHeight, footerHeight: footerHeight)
        let revealProgress = min(max((focusProgress - 0.18) / 0.82, 0), 1)
        let topInset = anchors.contentTop + EQSpacing.xxs + foregroundTitleHeight + EQSpacing.xs
        let bottomInset = max(0, cardHeight - anchors.contentBottom) + EQSpacing.md

        if hasExerciseAction, !isTiming {
            executionValuesViewport(
                width: cardWidth,
                height: max(0, cardHeight - topInset - bottomInset),
                topInset: cardTop + topInset,
                revealProgress: revealProgress
            )
            .modifier(ExerciseSettingsContentVisibilityModifier(
                progress: settingsTransitionProgress,
                group: .execution
            ))
            .allowsHitTesting(!settingsPresented && revealProgress > 0.99)
            .accessibilityHidden(settingsPresented || revealProgress < 0.99)
        }
    }

    /// The compact card's header/title/control region. Its frame is defined by
    /// the foreground card's own layout, not the independent footer region.
    @ViewBuilder
    private func executionCardHeader(
        progress: CGFloat,
        isLeavingRest: Bool,
        accessibilityHeaderPadding: CGFloat,
        collapsedTitleLift: CGFloat,
        hidesTransitionedChrome: Bool
    ) -> some View {
        foregroundHeader(progress, isLeavingRest ? 1 : 0)
            .frame(maxWidth: .infinity, minHeight: EQLayout.minimumTouch, alignment: .leading)
            .padding(.horizontal, EQLayout.WorkoutExecution.walletInset)
            .padding(.top, EQSpacing.xxs)
            .padding(.vertical, accessibilityHeaderPadding)
            .padding(.bottom, -collapsedTitleLift)
            .background(foregroundSurfaceColor)
            .zIndex(2)
            .opacity(hidesTransitionedChrome ? 0 : 1)
    }

    /// The production title/content viewport. It preserves the existing title-height
    /// preference and scroll identity for later composition by the persistent host.
    private func executionCardContentViewport(
        height: CGFloat,
        isFocused: Bool,
        settingsHasTakenOwnership: Bool,
        hidesTransitionedChrome: Bool
    ) -> some View {
        ScrollView {
            foregroundContent()
                .padding(.horizontal, EQLayout.WorkoutExecution.walletInset)
                .padding(.top, EQSpacing.xxs)
                .frame(maxWidth: .infinity, alignment: .topLeading)
                .opacity(hidesTransitionedChrome ? 0 : 1)
        }
        .frame(height: height, alignment: .top)
        .scrollDisabled(settingsHasTakenOwnership || !isFocused)
        .scrollDismissesKeyboard(.interactively)
        .scrollIndicators(.hidden)
        .onPreferenceChange(ExecutionForegroundTitleHeightPreferenceKey.self) {
            foregroundTitleHeight = $0
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Current exercise")
        .accessibilityHint(isFocused ? "Focused exercise controls" : "Expands the current exercise")
        .accessibilityAddTraits(isFocused ? [] : .isButton)
        .accessibilityAction(named: "Expand current exercise") {
            if !isFocused { showFocused() }
        }
        .clipped()
    }

    /// The editable metrics/control viewport. It uses the unchanged FocusedSetView
    /// bindings supplied by `foregroundValues`, with independently specified bounds.
    private func executionValuesViewport(
        width: CGFloat,
        height: CGFloat,
        topInset: CGFloat,
        revealProgress: CGFloat
    ) -> some View {
        foregroundValues()
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .frame(width: width, height: height, alignment: .bottomLeading)
            .clipped()
            .offset(y: topInset)
            .opacity(Double(revealProgress))
            .allowsHitTesting(revealProgress > 0.99)
            .accessibilityHidden(revealProgress < 0.99)
    }

    private func unifiedActionControls(_ primaryAction: ExecutionPrimaryAction?) -> some View {
        let hasExerciseAction = foregroundState == .exercise
            && !model.isReadOnly
            && !model.awaitsExerciseSelection
        let phase = ExecutionPrimaryActionPhase.resolve(
            foregroundState: foregroundState,
            hasExerciseAction: hasExerciseAction
        )
        let showsExerciseFooter = presentation.showsActionFooter(
            for: foregroundState,
            awaitsExerciseSelection: model.awaitsExerciseSelection,
            isReadOnly: model.isReadOnly
        )
        let focusedReveal = min(max((focusProgress - 0.18) / 0.82, 0), 1)
        let baseRevealProgress: CGFloat = switch phase {
        case .work, .rest: 1
        case .exercise: primaryAction == nil ? 0 : (isLeavingRest ? 1 : focusedReveal)
        case .hidden: 0
        }
        // The parent owns the outgoing fade during focused settings. Keeping this
        // footer at full layout visibility here prevents its own height/offset from
        // changing before it disappears.
        let executionVisibility: CGFloat = 1
        let revealProgress = baseRevealProgress
        let isAvailable = phase == .work || phase == .rest || primaryAction != nil
        let isInteractive = isAvailable && revealProgress > 0.99
            && (phase != .exercise || showsExerciseFooter)
        let title: String = switch phase {
        case .hidden: ""
        case .exercise: primaryAction?.title ?? ""
        case .work: "Skip"
        case .rest: "Skip Rest"
        }
        let hint: String = switch phase {
        case .hidden: ""
        case .exercise: primaryAction?.accessibilityHint ?? ""
        case .work: "Skips the current work interval"
        case .rest: "Ends the current rest"
        }
        let timerWidth = phase.timerControlWidth
        let actionTint = EQColor.Execution.primaryAction
            .mix(with: EQColor.Execution.restCardText, by: restTint)
        let phaseAnimation: Animation? = reduceMotion ? nil : EQMotion.objectTransformation
        let footerHeight = ExecutionPrimaryActionLayout.footerHeight(
            isVisible: true,
            controlHeight: EQLayout.WorkoutExecution.primaryActionHeight,
            topInset: EQLayout.WorkoutExecution.primaryActionTopInset,
            bottomInset: EQLayout.WorkoutExecution.primaryActionBottomInset,
            trailingControlHeight: EQLayout.minimumTouch
        )

        return ExecutionPrimaryActionFooter(
            isInteractive: isInteractive,
            footerHeight: footerHeight,
            revealProgress: revealProgress,
            foregroundColor: foregroundTextColor
        ) {
            HStack(spacing: EQLayout.controlGap) {
            if phase.showsPauseControl {
                Button(action: pauseResumeWork) {
                    Text(model.timer.state == .paused ? "Resume" : "Pause")
                        .contentTransition(reduceMotion ? .identity : .interpolate)
                        .lineLimit(1)
                        .fixedSize(horizontal: true, vertical: false)
                        .frame(minWidth: EQLayout.minimumTouch)
                        .frame(
                            width: timerWidth,
                            height: EQLayout.WorkoutExecution.primaryActionHeight
                        )
                }
                .eqPrimaryCTA(
                    tint: actionTint,
                    foreground: foregroundSurfaceColor,
                    variant: .filled
                )
                .disabled(model.workTimerState?.phase == .ready)
                .accessibilityHint(model.timer.state == .paused ? "Resumes the work timer" : "Pauses the work timer")
                .accessibilityIdentifier(ExecutionPrimaryActionIdentity(workoutID: workout.id).accessibilityIdentifier)
                .id(ExecutionPrimaryActionIdentity(workoutID: workout.id))

                Button(action: skipWork) {
                    Text("Skip")
                        .contentTransition(reduceMotion ? .identity : .interpolate)
                        .lineLimit(1)
                        .fixedSize(horizontal: true, vertical: false)
                        .frame(minWidth: EQLayout.minimumTouch)
                        .frame(
                            width: timerWidth,
                            height: EQLayout.WorkoutExecution.primaryActionHeight
                        )
                }
                .eqPrimaryCTA(
                    tint: actionTint,
                    foreground: foregroundSurfaceColor,
                    variant: .outlined
                )
                .accessibilityHint("Skips the current work interval")
                .transition(reduceMotion ? .identity : .move(edge: .trailing))
            } else {
                Button {
                    switch phase {
                    case .hidden, .work: break
                    case .exercise: primaryAction?.perform()
                    case .rest: skipRest()
                    }
                } label: {
                    Text(title)
                        .contentTransition(reduceMotion ? .identity : .interpolate)
                        .lineLimit(1)
                        .fixedSize(horizontal: true, vertical: false)
                        .padding(.horizontal, timerWidth == nil ? EQLayout.WorkoutExecution.primaryActionHorizontalPadding : 0)
                        .frame(minWidth: EQLayout.minimumTouch)
                        .frame(width: timerWidth, height: EQLayout.WorkoutExecution.primaryActionHeight)
                }
                .eqPrimaryCTA(
                    tint: actionTint,
                    foreground: foregroundSurfaceColor,
                    variant: phase.primaryActionVariant
                )
                .accessibilityHint(hint)
                .accessibilityIdentifier(ExecutionPrimaryActionIdentity(workoutID: workout.id).accessibilityIdentifier)
                .id(ExecutionPrimaryActionIdentity(workoutID: workout.id))
            }

            if phase == .exercise, hasExerciseAction, let exercise = model.currentExercise {
                Spacer(minLength: EQSpacing.xs)
                footerControls(exercise)
                    .offset(x: EQLayout.WorkoutExecution.trailingIconOutset)
            }
            }
            .animation(phaseAnimation, value: phase)
            .opacity(Double(executionVisibility))
        }
        .modifier(ExecutionFooterDismissalProbe(
            settingsPresented: settingsPresented,
            settingsProgress: settingsTransitionProgress,
            focusProgress: focusProgress,
            hasPrimaryAction: primaryAction != nil,
            showsExerciseFooter: showsExerciseFooter,
            revealProgress: revealProgress,
            phase: phase
        ))
    }

    private var foregroundBackground: some View {
        EQSurface(color: foregroundSurfaceColor, radius: EQRadius.walletSurface)
    }

}

private struct ExecutionPrimaryActionFooter<Content: View>: View {
    let isInteractive: Bool
    let footerHeight: CGFloat
    let revealProgress: CGFloat
    let foregroundColor: Color
    @ViewBuilder let content: Content

    var body: some View {
        content
            .allowsHitTesting(isInteractive)
            .accessibilityHidden(!isInteractive)
            .padding(.horizontal, EQLayout.WorkoutExecution.walletInset)
            .padding(.top, EQLayout.WorkoutExecution.primaryActionTopInset)
            .padding(.bottom, EQLayout.WorkoutExecution.primaryActionBottomInset)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomLeading)
            .offset(y: footerHeight * (1 - revealProgress))
            .foregroundStyle(foregroundColor)
    }
}

struct ExecutionWalletShapeModifier: ViewModifier {
    var drawsBorder = false
    var borderColor: Color = EQColor.Execution.walletBorder
    var externalTopGapColor: Color = .clear
    var externalTopGap: CGFloat = 0

    @ViewBuilder func body(content: Content) -> some View {
        if #available(iOS 26.0, *) {
            let shape = ConcentricRectangle(
                uniformTopCorners: .fixed(EQRadius.walletSurface),
                uniformBottomCorners: .concentric(minimum: .fixed(EQRadius.walletSurface))
            )
            content
                .clipShape(shape)
                .overlay {
                    if drawsBorder {
                        insetBorder(for: shape)
                    }
                }
                .overlay(alignment: .top) {
                    externalTopGapStrip
                }
        } else {
            let shape = RoundedRectangle(cornerRadius: EQRadius.walletSurface, style: .continuous)
            content
                .clipShape(shape)
                .overlay {
                    if drawsBorder {
                        insetBorder(for: shape)
                    }
                }
                .overlay(alignment: .top) {
                    externalTopGapStrip
                }
        }
    }

    private func insetBorder<S: Shape>(for shape: S) -> some View {
        shape
            .stroke(
                borderColor,
                lineWidth: EQLayout.WorkoutExecution.walletBorderWidth * 2
            )
            .mask(shape)
    }

    @ViewBuilder
    private var externalTopGapStrip: some View {
        if externalTopGap > 0 {
            Rectangle()
                .fill(externalTopGapColor)
                .frame(height: externalTopGap)
                // The card border is inset, so this strip can end flush at the card's
                // outer boundary while preserving the full requested gap above it.
                .offset(y: -externalTopGap)
                .allowsHitTesting(false)
        }
    }
}

private extension CGRect {
    func walletInterpolated(to destination: CGRect, progress: CGFloat) -> CGRect {
        let value = min(max(progress, 0), 1)
        return CGRect(
            x: minX + ((destination.minX - minX) * value),
            y: minY + ((destination.minY - minY) * value),
            width: width + ((destination.width - width) * value),
            height: height + ((destination.height - height) * value)
        )
    }
}

private struct WalletRevealModifier: ViewModifier {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    let progress: CGFloat

    func body(content: Content) -> some View {
        content
            .opacity(Double(progress))
            .offset(y: ExecutionMotionPolicy.offset(
                distance: EQSpacing.sm,
                progress: progress,
                reduceMotion: reduceMotion
            ))
    }
}

private struct RestDurationEditor: View {
    @Environment(\.dismiss) private var dismiss
    @State private var seconds: Double
    let guidance: String
    let save: (TimeInterval) async -> Bool
    init(initialSeconds: TimeInterval, guidance: String, save: @escaping (TimeInterval) async -> Bool) {
        _seconds = State(initialValue: RestDurationScale.snapped(initialSeconds))
        self.guidance = guidance
        self.save = save
    }
    var body: some View {
        NavigationStack {
            RestDurationControls(seconds: $seconds, guidance: guidance)
            .navigationTitle("Rest duration")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) { Button("Save") { Task { if await save(seconds) { dismiss() } } } }
            }
        }
        .presentationDetents([.medium])
        .presentationBackground(EQColor.Execution.foregroundSurface)
        .presentationCornerRadius(EQRadius.sheet)
        .environment(\.colorScheme, .dark)
    }
}

private struct RestDurationControls: View {
    @Binding var seconds: Double
    let guidance: String

    var body: some View {
        Form {
            Section("Rest time") {
                RestDurationValueControls(seconds: $seconds)
            }
            .listRowBackground(EQColor.Execution.foregroundSurface)
            Section {
                Text(guidance)
                    .eqTextStyle(.caption)
                    .foregroundStyle(EQColor.Execution.foregroundSecondaryText)
            }
            .listRowBackground(EQColor.Execution.foregroundSurface)
        }
        .scrollContentBackground(.hidden)
        .background(EQColor.Execution.foregroundSurface)
        .foregroundStyle(EQColor.Execution.foregroundText)
        .tint(EQColor.Execution.foregroundText)
    }
}

private struct RestDurationValueControls: View {
    @Binding var seconds: Double

    var body: some View {
        VStack(alignment: .leading, spacing: EQSpacing.md) {
            Text(durationText)
                .eqTextStyle(.largeMetric)
                .monospacedDigit()
            Slider(
                value: $seconds,
                in: RestDurationScale.minimum...RestDurationScale.maximum,
                step: RestDurationScale.step
            )
                .accessibilityValue(durationText)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var durationText: String {
        String(format: "%d:%02d", Int(seconds) / 60, Int(seconds) % 60)
    }
}

enum SetInputField: CaseIterable {
    case weight, value

    var previous: SetInputField? { self == .value ? .weight : nil }
    var next: SetInputField? { self == .weight ? .value : nil }
}

/// Native keyboard accessory bar: previous/next field and Done.
private struct SetInputKeyboardBar: ViewModifier {
    var focusedField: FocusState<SetInputField?>.Binding

    func body(content: Content) -> some View {
        content.toolbar {
            ToolbarItemGroup(placement: .keyboard) {
                Group {
                Button { focusedField.wrappedValue = focusedField.wrappedValue?.previous } label: {
                    Image(systemName: "chevron.up")
                }
                .disabled(focusedField.wrappedValue?.previous == nil)
                .accessibilityLabel("Previous field")
                Button { focusedField.wrappedValue = focusedField.wrappedValue?.next } label: {
                    Image(systemName: "chevron.down")
                }
                .disabled(focusedField.wrappedValue?.next == nil)
                .accessibilityLabel("Next field")
                Spacer()
                Button("Done") { focusedField.wrappedValue = nil }
                    .eqTextStyle(EQTypography.labelAction)
                }
                .tint(EQColor.contentPrimary)
                .foregroundStyle(EQColor.contentPrimary)
            }
        }
    }

}

private struct FirstSetView: View {
    let exercise: WorkoutExercise; let progression: ProgressionSuggestion?; let weightUnit: WeightUnit; let log: (SetLogInput) async -> Void
    let reportPrimaryAction: (ExecutionPrimaryAction?) -> Void
    @State private var weight: String
    @State private var repetitions: String
    @FocusState private var focusedField: SetInputField?

    init(exercise: WorkoutExercise, progression: ProgressionSuggestion?, weightUnit: WeightUnit, log: @escaping (SetLogInput) async -> Void, reportPrimaryAction: @escaping (ExecutionPrimaryAction?) -> Void) {
        self.exercise = exercise
        self.progression = progression
        self.weightUnit = weightUnit
        self.log = log
        self.reportPrimaryAction = reportPrimaryAction
        _weight = State(initialValue: WeightText.value(progression?.suggestedWeight, unit: weightUnit))
        _repetitions = State(initialValue: progression?.targetRepetitions.map { String($0.lowerBound) } ?? "")
    }
    var body: some View {
        VStack(alignment: .leading, spacing: EQLayout.sectionGap) {
            Text("No previous working sets").eqTextStyle(.caption).foregroundStyle(EQColor.Execution.foregroundSecondaryText)
            VStack(alignment: .leading, spacing: EQSpacing.md) {
                EQMetricInput(value: $weight, label: weightUnit == .pounds ? "lb" : "kg", accessibilityLabel: "Weight", keyboard: .decimalPad, valueColor: EQColor.Execution.primaryAction, unitColor: EQColor.Execution.metricUnit, progressed: progression?.rationale == .increaseWeight, holdLegend: BarbellLoad.legend(weight, unit: weightUnit), legendColor: EQColor.Execution.metricUnit).focused($focusedField, equals: .weight)
                EQMetricInput(value: $repetitions, label: exercise.isTimeBased ? "secs" : "reps", accessibilityLabel: exercise.isTimeBased ? "Seconds" : "Repetitions", keyboard: .numberPad, valueColor: EQColor.Execution.primaryAction, unitColor: EQColor.Execution.metricUnit, progressed: !exercise.isTimeBased && progression?.rationale == .addRepetitions).focused($focusedField, equals: .value)
            }
        }
        .modifier(SetInputKeyboardBar(focusedField: $focusedField))
        .onAppear(perform: reportAction)
        .onChange(of: exercise.id) { _, _ in reportAction() }
    }

    private func reportAction() {
        reportPrimaryAction(
            ExecutionPrimaryAction(
                title: exercise.isTimeBased ? "Start Timer" : "Log first set",
                accessibilityHint: "Saves this set immediately",
                perform: commit
            )
        )
    }

    private func commit() {
        focusedField = nil
        guard let value = Int(repetitions), value > 0 else { return }
        Task {
            await log(exercise.isTimeBased
                ? .duration(weight: WeightText.weight(from: weight, unit: weightUnit), seconds: TimeInterval(value))
                : .repetitions(weight: WeightText.weight(from: weight, unit: weightUnit), repetitions: value))
        }
    }

}

private struct ExerciseListRow: View {
    @Environment(\.executionRestTint) private var restTint
    let exercise: WorkoutExercise
    let state: ExerciseState
    let weightUnit: WeightUnit

    private func restBlend(_ color: Color) -> Color { color.mix(with: EQColor.Execution.restCardText, by: restTint) }

    var body: some View {
        let presentation = ExerciseListRowPresentation.resolve(state: state)
        VStack(alignment: .leading, spacing: EQLayout.WorkoutExecution.titleToSetsSpacing) {
            HStack {
                Text(exercise.nameSnapshot)
                    .eqTextStyle(.listItemTitle)
                    .strikethrough(presentation.strikethrough)
                    .foregroundStyle(restBlend(presentation.emphasis == .reduced ? EQColor.Execution.overviewSecondaryText : EQColor.Execution.overviewText))
                Spacer()
                if state == .current {
                    Circle()
                        .fill(EQColor.Execution.progressAccent)
                        .frame(
                            width: EQLayout.WorkoutExecution.currentIndicatorSize,
                            height: EQLayout.WorkoutExecution.currentIndicatorSize
                        )
                        .accessibilityHidden(true)
                }
            }
            if presentation.showsLoggedSets, !completedSets.isEmpty {
                VStack(alignment: .leading, spacing: EQLayout.WorkoutExecution.loggedSetSpacing) {
                    ForEach(completedSets) { set in
                        HStack(alignment: .firstTextBaseline, spacing: EQSpacing.xs) {
                            Text("\(setNumber(for: set))")
                                .frame(
                                    width: EQLayout.WorkoutExecution.loggedSetIndexWidth,
                                    alignment: .leading
                                )
                            Text(summary(set))
                        }
                        .eqTextStyle(.secondaryBody)
                        .foregroundStyle(restBlend(EQColor.Execution.overviewSecondaryText))
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .contentShape(Rectangle())
        .accessibilityValue(accessibilityState)
    }

    private var accessibilityState: String {
        switch state {
        case .current: "In progress"
        case .skipped: "Skipped"
        case .upcoming, .completed: ""
        }
    }

    private var completedSets: [LoggedSet] {
        ExercisePerformanceQuery.validCompletedSets(in: exercise)
    }

    private func setNumber(for set: LoggedSet) -> Int {
        guard let prescriptionID = set.prescriptionID,
              let index = exercise.prescriptions.firstIndex(where: { $0.id == prescriptionID }) else { return 1 }
        return index + 1
    }

    private func summary(_ set: LoggedSet) -> String {
        let weight = set.weight.map {
            " · \(WeightText.value($0, unit: weightUnit)) \(weightUnit == .pounds ? "lb" : "kg")"
        } ?? ""
        if let duration = set.duration {
            let seconds = Int(duration.rounded())
            return "\(seconds) \(seconds == 1 ? "second" : "seconds")\(weight)"
        }
        let repetitions = set.repetitions ?? 0
        return "\(repetitions) \(repetitions == 1 ? "rep" : "reps")\(weight)"
    }
}

private struct FocusedSetView: View {
    let exercise: WorkoutExercise
    let prescription: SetPrescription
    let progression: ProgressionSuggestion?
    let selectedIndex: Int
    let isReadOnly: Bool
    let weightUnit: WeightUnit
    let log: (SetLogInput) async -> Void
    let startTimed: (SetLogInput) -> Void
    let reportPrimaryAction: (ExecutionPrimaryAction?) -> Void
    @State private var weightText: String
    @State private var valueText: String
    @FocusState private var focusedField: SetInputField?

    init(exercise: WorkoutExercise, prescription: SetPrescription, progression: ProgressionSuggestion?, selectedIndex: Int, isReadOnly: Bool, weightUnit: WeightUnit, log: @escaping (SetLogInput) async -> Void, startTimed: @escaping (SetLogInput) -> Void, reportPrimaryAction: @escaping (ExecutionPrimaryAction?) -> Void) {
        self.exercise = exercise; self.prescription = prescription; self.progression = progression; self.selectedIndex = selectedIndex; self.isReadOnly = isReadOnly; self.weightUnit = weightUnit; self.log = log; self.startTimed = startTimed; self.reportPrimaryAction = reportPrimaryAction
        let logged = exercise.loggedSets.first { $0.prescriptionID == prescription.id }
        let hasLoggedPredecessor = exercise.prescriptions.prefix(selectedIndex).contains { preceding in exercise.loggedSets.contains { $0.prescriptionID == preceding.id && $0.completedAt != nil } }
        let startingWeight = logged?.weight ?? (hasLoggedPredecessor ? prescription.suggestedWeight : progression?.suggestedWeight ?? prescription.suggestedWeight)
        _weightText = State(initialValue: WeightText.value(startingWeight, unit: weightUnit))
        switch prescription.target {
        case .repetitions(let range): _valueText = State(initialValue: logged?.repetitions.map(String.init) ?? (hasLoggedPredecessor ? String(range.lowerBound) : progression?.targetRepetitions.map { String($0.lowerBound) } ?? String(range.lowerBound)))
        case .duration(let seconds): _valueText = State(initialValue: logged?.duration.map { String(Int($0)) } ?? String(Int(seconds)))
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: EQLayout.sectionGap) {
            VStack(alignment: .leading, spacing: EQSpacing.md) {
                EQMetricInput(value: $weightText, label: weightLabel, accessibilityLabel: "\(exercise.nameSnapshot), set \(selectedIndex + 1), weight", keyboard: .decimalPad, valueColor: EQColor.Execution.primaryAction, unitColor: EQColor.Execution.metricUnit, progressed: progression?.rationale == .increaseWeight, holdLegend: BarbellLoad.legend(weightText, unit: weightUnit), legendColor: EQColor.Execution.metricUnit)
                    .focused($focusedField, equals: .weight)
                EQMetricInput(value: $valueText, label: valueLabel, accessibilityLabel: "\(exercise.nameSnapshot), set \(selectedIndex + 1), \(valueAccessibilityLabel)", keyboard: .numberPad, valueColor: EQColor.Execution.primaryAction, unitColor: EQColor.Execution.metricUnit, progressed: progression?.rationale == .addRepetitions)
                    .focused($focusedField, equals: .value)
            }
        }
        .modifier(SetInputKeyboardBar(focusedField: $focusedField))
        .onAppear(perform: reportAction)
        .onChange(of: actionTitle) { _, _ in reportAction() }
        .onChange(of: isReadOnly) { _, _ in reportAction() }
        .accessibilityElement(children: .contain)
    }

    private var isLogged: Bool { exercise.loggedSets.contains { $0.prescriptionID == prescription.id && $0.completedAt != nil } }
    private var valueLabel: String { if case .duration = prescription.target { return "secs" }; return "reps" }
    private var valueAccessibilityLabel: String { if case .duration = prescription.target { return "seconds" }; return "reps" }
    private var weightLabel: String { weightUnit == .pounds ? "lb" : "kg" }
    private var actionTitle: String { isLogged ? "Update set" : submission.buttonTitle }
    private func reportAction() {
        reportPrimaryAction(
            isReadOnly ? nil : ExecutionPrimaryAction(
                title: actionTitle,
                accessibilityHint: "Saves this set immediately",
                perform: commit
            )
        )
    }
    private func commit() {
        focusedField = nil
        guard let value = Int(valueText), value > 0 else { return }
        let input: SetLogInput
        switch prescription.target {
        case .repetitions: input = .repetitions(weight: WeightText.weight(from: weightText, unit: weightUnit), repetitions: value)
        case .duration: input = .duration(weight: WeightText.weight(from: weightText, unit: weightUnit), seconds: TimeInterval(value))
        }
        switch submission {
        case .startTimer: startTimed(input)
        case .log: Task { await log(input) }
        }
    }

    private var submission: FocusedSetSubmission {
        .resolve(target: prescription.target, isLogged: isLogged)
    }
}

private struct FocusedExerciseSettingsSurface: View {
    let exerciseName: String
    let reservesTransitionedExerciseName: Bool
    let route: ExerciseOptionsRoute?
    @Binding var path: [ExerciseOptionsRoute]
    let navigationDirection: ExerciseOptionsNavigationDirection
    let exerciseID: WorkoutExerciseID
    let model: WorkoutExecutionModel
    let exerciseRepository: (any ExerciseRepository)?
    let historyRepository: (any ExerciseHistoryRepository)?
    let onBack: () -> Void
    let onClose: () -> Void
    let onSwap: () -> Void
    let durationStepFeedback: () -> Void
    let allowsSaving: Bool
    /// The persistent transforming host owns the root close affordance. Nested
    /// navigation retains its back affordance in this production header.
    let showsCloseControl: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            header

            ExerciseOptionsCardContent(
                exerciseID: exerciseID,
                model: model,
                exerciseRepository: exerciseRepository,
                historyRepository: historyRepository,
                path: $path,
                navigationDirection: navigationDirection,
                onSwap: onSwap,
                durationStepFeedback: durationStepFeedback,
                allowsSaving: allowsSaving,
                onDismiss: onClose
            )
            .id(exerciseID)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
        .foregroundStyle(EQColor.Execution.foregroundText)
        .tint(EQColor.Execution.foregroundText)
        .accessibilityAction(.escape) { onClose() }
    }

    private var header: some View {
        HStack(alignment: .top, spacing: EQLayout.controlGap) {
            VStack(alignment: .leading, spacing: EQSpacing.xxs) {
                if reservesTransitionedExerciseName {
                    Color.clear
                        .frame(height: EQTextStyle.secondaryBody.lineHeight)
                        .accessibilityHidden(true)
                } else {
                    Text(exerciseName)
                        .eqTextStyle(.secondaryBody)
                        .lineLimit(2)
                        .foregroundStyle(EQColor.Execution.foregroundSecondaryText)
                }

                Text(route?.title ?? "Settings")
                    .eqTextStyle(.screenTitle)
                    .lineLimit(2)
                    .accessibilityAddTraits(.isHeader)
                    .id(route)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .accessibilityElement(children: .combine)
            .accessibilityLabel("\(exerciseName), \(route?.title ?? "Settings")")

            HStack(spacing: EQSpacing.xs) {
                if route != nil {
                    EQIconButton(systemImage: "chevron.left", alignment: .trailing, action: onBack)
                        .accessibilityLabel("Back to exercise settings")
                }

                if showsCloseControl {
                    EQIconButton(systemImage: "xmark", alignment: .trailing, action: onClose)
                        .accessibilityLabel("Close exercise settings")
                }
            }
        }
        .padding(.horizontal, EQLayout.WorkoutExecution.walletInset)
        .padding(.top, EQSpacing.lg)
        .frame(maxWidth: .infinity, alignment: .topLeading)
        .accessibilityIdentifier("execution-exercise-settings-header-\(model.workoutID.rawValue)")
    }
}

private struct ExerciseOptionsCardContent: View {
    let exerciseID: WorkoutExerciseID
    let model: WorkoutExecutionModel
    let exerciseRepository: (any ExerciseRepository)?
    let historyRepository: (any ExerciseHistoryRepository)?
    @Binding var path: [ExerciseOptionsRoute]
    let navigationDirection: ExerciseOptionsNavigationDirection
    let onSwap: () -> Void
    let durationStepFeedback: () -> Void
    let allowsSaving: Bool
    let onDismiss: () -> Void
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var timeBased: Bool
    @State private var twoSided: Bool
    @State private var profile: AutoProgressionProfile = .none
    @State private var loadedProfile: AutoProgressionProfile?
    @State private var confirmsSkip = false
    @State private var confirmsRemove = false
    @State private var endedByAction = false
    private let initialTimeBased: Bool
    private let initialTwoSided: Bool

    init(
        exerciseID: WorkoutExerciseID,
        model: WorkoutExecutionModel,
        exerciseRepository: (any ExerciseRepository)?,
        historyRepository: (any ExerciseHistoryRepository)?,
        path: Binding<[ExerciseOptionsRoute]>,
        navigationDirection: ExerciseOptionsNavigationDirection,
        onSwap: @escaping () -> Void,
        durationStepFeedback: @escaping () -> Void,
        allowsSaving: Bool,
        onDismiss: @escaping () -> Void
    ) {
        self.exerciseID = exerciseID
        self.model = model
        self.exerciseRepository = exerciseRepository
        self.historyRepository = historyRepository
        _path = path
        self.navigationDirection = navigationDirection
        self.onSwap = onSwap
        self.durationStepFeedback = durationStepFeedback
        self.allowsSaving = allowsSaving
        self.onDismiss = onDismiss
        let exercise = model.exercise(id: exerciseID)
        initialTimeBased = exercise?.isTimeBased ?? false
        initialTwoSided = exercise?.isTwoSided ?? false
        _timeBased = State(initialValue: initialTimeBased)
        _twoSided = State(initialValue: initialTwoSided)
    }

    private var exercise: WorkoutExercise? { model.exercise(id: exerciseID) }

    var body: some View {
        ZStack(alignment: .topLeading) {
            navigationContent
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                .id(path.last)
                .transition(navigationTransition)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .clipped()
        .foregroundStyle(EQColor.Execution.foregroundText)
        .tint(EQColor.Execution.foregroundText)
        .accessibilityAction(.escape) { onDismiss() }
        .accessibilityIdentifier("exercise-settings-content-\(exerciseID.rawValue)")
        .task(id: exercise?.exerciseID) {
            if let exercise {
                let value = await model.progressionProfile(for: exercise)
                profile = value
                loadedProfile = value
            }
        }
        .onChange(of: timeBased) { _, isOn in
            if !isOn { twoSided = false }
        }
        .onDisappear(perform: saveIfChanged)
        .alert("Skip exercise?", isPresented: $confirmsSkip) {
            Button("Cancel", role: .cancel) {}
            Button("Skip Exercise", role: .destructive) {
                endedByAction = true
                Task { if await model.skipExercise(exerciseID) { onDismiss() } }
            }
        } message: {
            Text("This exercise stays in the workout and history as skipped. It will not contribute to progression or personal records.")
        }
        .alert("Remove exercise?", isPresented: $confirmsRemove) {
            Button("Cancel", role: .cancel) {}
            Button("This workout only", role: .destructive) {
                removeExercise(scope: .currentWorkout)
            }
            Button("This & future workouts", role: .destructive) {
                removeExercise(scope: .currentAndFutureWorkouts)
            }
        } message: {
            Text("Remove this exercise only from this workout, or from this and all saved future workouts in the same routine? Completed workout history is never changed.")
        }
    }

    @ViewBuilder
    private var navigationContent: some View {
        if let route = path.last {
            destination(route)
        } else if let exercise {
            rootContent(exercise)
        } else {
            ContentUnavailableView("Exercise unavailable", systemImage: "exclamationmark.triangle")
        }
    }

    private var navigationTransition: AnyTransition {
        guard !reduceMotion else { return .opacity }
        let distance = ExerciseCardModeMotion.nestedOffset
        switch navigationDirection {
        case .forward:
            return .asymmetric(
                insertion: .offset(x: distance).combined(with: .opacity),
                removal: .offset(x: -distance).combined(with: .opacity)
            )
        case .backward:
            return .asymmetric(
                insertion: .offset(x: -distance).combined(with: .opacity),
                removal: .offset(x: distance).combined(with: .opacity)
            )
        }
    }

    private func rootContent(_ exercise: WorkoutExercise) -> some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    settingsGroup {
                        navigationRow(
                            title: "Performance",
                            systemImage: "chart.xyaxis.line",
                            route: .performance
                        )
                    }
                    .disabled(historyRepository == nil)

                    sectionLabel("SETTINGS")
                        .padding(.top, EQLayout.labeledGroupGap)
                        .padding(.bottom, EQSpacing.sm)
                    VStack(alignment: .leading, spacing: EQLayout.groupedCardGap) {
                        settingsGroup {
                            Toggle("Time-based", isOn: $timeBased)
                                .toggleStyle(ExerciseSettingsToggleStyle())
                            if timeBased {
                                Toggle("Two-sides", isOn: $twoSided)
                                    .toggleStyle(ExerciseSettingsToggleStyle())
                                    .transition(.opacity)
                            }
                        }
                        settingsGroup { progressionRow }
                        settingsGroup { restDurationRow }
                    }
                    .eqTextStyle(.listItemTitle)
                    .disabled(loadedProfile == nil)
                }
                .padding(.horizontal, EQLayout.WorkoutExecution.walletInset)
                .padding(.top, contentTopSpacing)
                .padding(.bottom, EQLayout.ExerciseOptions.actionsTopSpacing)
                .contentShape(Rectangle())
                .animation(EQMotion.contentTransition, value: timeBased)
            }
            .scrollBounceBehavior(.basedOnSize)
            .scrollIndicators(.hidden)

            actionButtons(exercise)
                .padding(.horizontal, EQLayout.WorkoutExecution.walletInset)
                .padding(.bottom, EQLayout.ExerciseOptions.bottomInset)
        }
    }

    /// Changes commit when Settings closes, so flipping Time-based back and forth
    /// before closing never clears logged sets.
    private func saveIfChanged() {
        guard allowsSaving, !endedByAction, let loadedProfile else { return }
        guard timeBased != initialTimeBased || twoSided != initialTwoSided || profile != loadedProfile else { return }
        let timeBased = timeBased, twoSided = twoSided, profile = profile
        Task {
            _ = await model.updateExerciseSettings(
                exerciseID: exerciseID,
                timeBased: timeBased,
                twoSided: twoSided,
                progression: profile
            )
        }
    }

    private func sectionLabel(_ title: String) -> some View {
        Text(title)
            .eqTextStyle(.sectionLabel)
            .foregroundStyle(EQColor.Execution.foregroundSecondaryText)
            .accessibilityAddTraits(.isHeader)
    }

    /// The wallet positions this viewport one small spacing token below the persistent
    /// exercise title. Subtract it here so the title-to-first-control distance remains
    /// identical to the former Exercise Options presentation.
    private var contentTopSpacing: CGFloat {
        max(0, EQLayout.ExerciseOptions.headerToContentSpacing - EQSpacing.xs)
    }

    private func settingsGroup<Content: View>(@ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 0) { content() }
            .frame(maxWidth: .infinity, alignment: .leading)
            .eqGroupedCard(fill: EQColor.surfaceHighlightDark)
    }

    private var progressionRow: some View {
        Button { pushDestination(.autoProgression) } label: {
            HStack(spacing: EQLayout.controlGap) {
                Text("Auto Progression")
                Spacer()
                HStack(spacing: EQSpacing.sm) {
                    Text(profile.title)
                    Image(systemName: "chevron.right")
                        .frame(width: EQLayout.iconSize)
                }
            }
            .frame(minHeight: EQLayout.minimumTouch)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityHint("Opens Auto Progression options")
    }

    private var restDurationRow: some View {
        Button { pushDestination(.restDuration) } label: {
            HStack(spacing: EQLayout.controlGap) {
                Text("Rest duration")
                Spacer()
                HStack(spacing: EQSpacing.sm) {
                    Text(restDurationValueText)
                    Image(systemName: "chevron.right")
                        .frame(width: EQLayout.iconSize)
                }
            }
            .frame(minHeight: EQLayout.minimumTouch)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityHint("Opens the rest duration override for this exercise")
    }

    private func actionButtons(_ exercise: WorkoutExercise) -> some View {
        HStack(spacing: EQLayout.controlGap) {
            Button(action: onSwap) {
                Text("Swap")
                    .eqOutlinedControl(tint: EQColor.Execution.foregroundText)
                    .eqTextStyle(.listItemTitle)
            }
            .buttonStyle(.plain)
            .disabled(exerciseRepository == nil)
            .frame(maxWidth: .infinity)
            .accessibilityHint("Replaces this exercise in the current workout")

            Button { confirmsSkip = true } label: {
                Text("Skip")
                    .eqOutlinedControl(tint: EQColor.Execution.foregroundText)
                    .eqTextStyle(.listItemTitle)
            }
            .buttonStyle(.plain)
            .frame(maxWidth: .infinity)
            .accessibilityLabel("Skip Exercise")
            .accessibilityHint("Marks this occurrence skipped and returns to Exercise Overview")

            Button { confirmsRemove = true } label: {
                Image(systemName: "trash")
                    .eqTextStyle(.icon)
                    .foregroundStyle(EQColor.Execution.foregroundText)
                    .frame(
                        width: EQLayout.minimumTouch,
                        height: EQLayout.WorkoutExecution.primaryActionHeight,
                        alignment: .trailing
                    )
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .frame(width: EQLayout.minimumTouch, alignment: .trailing)
            .accessibilityLabel("Remove Exercise")
            .accessibilityHint("Offers removal from this workout only or from this and future workouts")
        }
        .lineLimit(1)
        .minimumScaleFactor(0.8)
    }

    private var restDurationValueText: String {
        guard let value = model.exerciseRestDurationOverride(for: exerciseID) else {
            return "Default · \(globalRestDurationText)"
        }
        return Self.durationText(value)
    }

    private func removeExercise(scope: WorkoutExerciseRemovalScope) {
        endedByAction = true
        Task {
            if await model.removeExercise(exerciseID, scope: scope) {
                onDismiss()
            }
        }
    }

    private var globalRestDurationText: String {
        Self.durationText(model.globalRestDuration)
    }

    private static func durationText(_ seconds: TimeInterval) -> String {
        String(format: "%d:%02d", Int(seconds) / 60, Int(seconds) % 60)
    }

    private func navigationRow(
        title: String,
        systemImage: String,
        route: ExerciseOptionsRoute
    ) -> some View {
        Button { pushDestination(route) } label: {
            HStack(spacing: EQLayout.controlGap) {
                Label(title, systemImage: systemImage)
                    .eqTextStyle(.listItemTitle)
                Spacer()
                Image(systemName: "chevron.right")
                    .frame(width: EQLayout.iconSize)
            }
            .frame(minHeight: EQLayout.minimumTouch)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityHint("Opens \(title)")
    }

    @ViewBuilder
    private func destination(_ route: ExerciseOptionsRoute) -> some View {
        switch route {
        case .performance:
            if let exercise, let historyRepository {
                ExercisePerformanceContent(
                    exerciseID: exercise.exerciseID,
                    repository: historyRepository,
                    weightUnit: model.weightUnit,
                    style: .exerciseOptions
                )
                .padding(.horizontal, EQLayout.WorkoutExecution.walletInset)
                .padding(.top, contentTopSpacing)
            } else {
                unavailableDestination
            }
        case .autoProgression:
            ScrollView {
                AutoProgressionOptionsContent(selection: $profile)
                    .padding(.horizontal, EQLayout.WorkoutExecution.walletInset)
                    .padding(.top, contentTopSpacing)
                    .padding(.bottom, EQLayout.ExerciseOptions.bottomInset)
            }
            .scrollBounceBehavior(.basedOnSize)
            .scrollIndicators(.hidden)
        case .restDuration:
            ExerciseRestDurationOptionsContent(
                initialOverride: model.exerciseRestDurationOverride(for: exerciseID),
                workoutDefaultSeconds: model.globalRestDuration,
                save: { seconds in
                    await model.setExerciseRestDuration(exerciseID: exerciseID, seconds: seconds)
                },
                selectionFeedback: durationStepFeedback
            )
            .padding(.top, contentTopSpacing)
        }
    }

    private var unavailableDestination: some View {
        ContentUnavailableView("Unavailable", systemImage: "exclamationmark.triangle")
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
    }

    private func popDestination() {
        guard !path.isEmpty else { return }
        withAnimation(navigationAnimation) {
            _ = path.removeLast()
        }
    }

    private func pushDestination(_ route: ExerciseOptionsRoute) {
        withAnimation(navigationAnimation) {
            path.append(route)
        }
    }

    private var navigationAnimation: Animation? {
        reduceMotion ? EQMotion.reducedContentTransition : EQMotion.surfaceReveal
    }
}

private struct AutoProgressionOptionsContent: View {
    @Binding var selection: AutoProgressionProfile

    var body: some View {
        VStack(spacing: 0) {
            ForEach(AutoProgressionProfile.allCases, id: \.self) { profile in
                Button { selection = profile } label: {
                    HStack(spacing: EQLayout.controlGap) {
                        Text(profile.title)
                        Spacer()
                        Image(systemName: "checkmark")
                            .opacity(selection == profile ? 1 : 0)
                            .accessibilityHidden(true)
                    }
                    .frame(maxWidth: .infinity, minHeight: EQLayout.minimumTouch, alignment: .leading)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(selection == profile ? .isSelected : [])
            }
        }
        .eqTextStyle(.listItemTitle)
        .eqGroupedCard(fill: EQColor.surfaceHighlightDark)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
    }
}

private struct ExerciseRestDurationOptionsContent: View {
    @State private var seconds: Double
    @State private var hasOverride: Bool
    @State private var hasUncommittedInteraction = false
    @State private var persistenceTask: Task<Void, Never>?
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    let workoutDefaultSeconds: TimeInterval
    let save: (TimeInterval?) async -> Bool
    let selectionFeedback: () -> Void

    init(
        initialOverride: TimeInterval?,
        workoutDefaultSeconds: TimeInterval,
        save: @escaping (TimeInterval?) async -> Bool,
        selectionFeedback: @escaping () -> Void
    ) {
        _seconds = State(
            initialValue: RestDurationScale.snapped(
                initialOverride ?? workoutDefaultSeconds
            )
        )
        _hasOverride = State(initialValue: initialOverride != nil)
        self.workoutDefaultSeconds = workoutDefaultSeconds
        self.save = save
        self.selectionFeedback = selectionFeedback
    }

    var body: some View {
        GeometryReader { proxy in
            VStack(spacing: 0) {
                DualWheelDurationPicker(
                    value: seconds,
                    onChange: { value in
                        seconds = value
                        hasUncommittedInteraction = true
                    },
                    onCommit: persistOverride,
                    selectionFeedback: selectionFeedback
                )
                .frame(height: pickerHeight(for: proxy.size.height))

                Spacer(minLength: EQSpacing.md)

                resetAction
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .padding(.bottom, EQLayout.ExerciseOptions.bottomInset)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .animation(reduceMotion ? EQMotion.reducedContentTransition : EQMotion.contentTransition, value: hasOverride)
        .onChange(of: workoutDefaultSeconds) { _, newDefault in
            guard !hasOverride, !hasUncommittedInteraction else { return }
            let updated = RestDurationScale.snapped(newDefault)
            if reduceMotion {
                seconds = updated
            } else {
                withAnimation(EQMotion.contentTransition) { seconds = updated }
            }
        }
        .onDisappear {
            guard hasUncommittedInteraction else { return }
            persistOverride(seconds)
        }
    }

    private func persistOverride(_ value: TimeInterval) {
        let value = RestDurationScale.snapped(value)
        seconds = value
        hasOverride = true
        hasUncommittedInteraction = false
        enqueueSave(value)
    }

    private func resetToWorkoutDefault() {
        hasUncommittedInteraction = false
        hasOverride = false
        let inheritedValue = RestDurationScale.snapped(workoutDefaultSeconds)
        if reduceMotion {
            seconds = inheritedValue
        } else {
            withAnimation(EQMotion.contentTransition) { seconds = inheritedValue }
        }
        enqueueSave(nil)
    }

    private func enqueueSave(_ value: TimeInterval?) {
        let previousTask = persistenceTask
        persistenceTask = Task {
            _ = await previousTask?.value
            _ = await save(value)
        }
    }

    private func durationText(_ value: TimeInterval) -> String {
        let seconds = Int(value.rounded())
        return String(format: "%d:%02d", seconds / 60, seconds % 60)
    }

    @ViewBuilder
    private var resetAction: some View {
        if hasOverride {
            Button("Use workout default (\(durationText(workoutDefaultSeconds)))") {
                resetToWorkoutDefault()
            }
            .buttonStyle(.plain)
            .eqTextStyle(.secondaryBody)
            .foregroundStyle(EQColor.Execution.foregroundSecondaryText)
            .frame(minHeight: EQLayout.minimumTouch)
            .padding(.horizontal, EQLayout.WorkoutExecution.walletInset)
            .transition(.opacity)
            .accessibilityLabel("Use workout default, \(durationText(workoutDefaultSeconds))")
            .accessibilityHint("Removes the exercise override so future workout default changes apply")
        } else {
            Color.clear
                .frame(height: EQLayout.minimumTouch)
                .accessibilityHidden(true)
        }
    }

    private func pickerHeight(for availableHeight: CGFloat) -> CGFloat {
        min(
            440,
            max(
                300,
                availableHeight
                    - EQLayout.minimumTouch
                    - EQSpacing.md
                    - EQLayout.ExerciseOptions.bottomInset
            )
        )
    }
}

enum RestDurationScale {
    static let minimum: TimeInterval = 15
    static let maximum: TimeInterval = 300
    static let step: TimeInterval = 5

    static func snapped(_ value: TimeInterval) -> TimeInterval {
        let stepped = (value / step).rounded() * step
        return min(max(stepped, minimum), maximum)
    }

    static func components(for value: TimeInterval) -> (minutes: Int, seconds: Int) {
        let totalSeconds = Int(snapped(value).rounded())
        return (totalSeconds / 60, totalSeconds % 60)
    }

    static func duration(minutes: Int, seconds: Int) -> TimeInterval? {
        guard (0..<60).contains(seconds), seconds.isMultiple(of: Int(step)) else {
            return nil
        }
        let duration = TimeInterval((minutes * 60) + seconds)
        guard duration >= minimum, duration <= maximum else { return nil }
        return duration
    }

    static func minuteValues(forSeconds seconds: Int) -> [Int] {
        let maximumMinutes = Int(maximum) / 60
        return Array(0...maximumMinutes).filter {
            duration(minutes: $0, seconds: seconds) != nil
        }
    }

    static func secondValues(forMinutes minutes: Int) -> [Int] {
        stride(from: 0, through: 55, by: Int(step)).filter {
            duration(minutes: minutes, seconds: $0) != nil
        }
    }
}

enum DurationWheelMotion {
    static let stepDistance: CGFloat = 64
    static let momentumContribution: CGFloat = 0.3

    static func index(
        startingAt startIndex: Int,
        translation: CGFloat,
        count: Int
    ) -> Int {
        guard count > 0 else { return 0 }
        let stepDelta = Int((-translation / stepDistance).rounded())
        return min(max(startIndex + stepDelta, 0), count - 1)
    }

    static func projectedIndex(
        startingAt startIndex: Int,
        translation: CGFloat,
        predictedTranslation: CGFloat,
        count: Int
    ) -> Int {
        let projection = translation
            + ((predictedTranslation - translation) * momentumContribution)
        return index(startingAt: startIndex, translation: projection, count: count)
    }
}

private struct DualWheelDurationPicker: View {
    let value: TimeInterval
    let onChange: (TimeInterval) -> Void
    let onCommit: (TimeInterval) -> Void
    let selectionFeedback: () -> Void

    var body: some View {
        let components = RestDurationScale.components(for: value)
        let minuteValues = RestDurationScale.minuteValues(forSeconds: components.seconds)
        let secondValues = RestDurationScale.secondValues(forMinutes: components.minutes)

        GeometryReader { proxy in
            HStack(spacing: 0) {
                CurvedDurationWheel(
                    side: .left,
                    values: minuteValues,
                    selection: components.minutes,
                    displayText: { String($0) },
                    accessibilityLabel: "Minutes",
                    accessibilityValue: minuteAccessibilityValue(components.minutes),
                    onChange: { minutes in
                        update(minutes: minutes, seconds: components.seconds, commit: false)
                    },
                    onCommit: { minutes in
                        update(minutes: minutes, seconds: components.seconds, commit: true)
                    },
                    selectionFeedback: selectionFeedback
                )
                .frame(width: proxy.size.width / 2, height: proxy.size.height)

                CurvedDurationWheel(
                    side: .right,
                    values: secondValues,
                    selection: components.seconds,
                    displayText: { String(format: "%02d", $0) },
                    accessibilityLabel: "Seconds",
                    accessibilityValue: secondAccessibilityValue(components.seconds),
                    onChange: { seconds in
                        update(minutes: components.minutes, seconds: seconds, commit: false)
                    },
                    onCommit: { seconds in
                        update(minutes: components.minutes, seconds: seconds, commit: true)
                    },
                    selectionFeedback: selectionFeedback
                )
                .frame(width: proxy.size.width / 2, height: proxy.size.height)
            }

            Text(":")
                .eqTextStyle(EQTextStyle(size: 52, weight: .medium))
                .monospacedDigit()
                .foregroundStyle(EQColor.Execution.foregroundText)
                .position(x: proxy.size.width / 2, y: proxy.size.height / 2)
                .accessibilityHidden(true)
        }
        .clipped()
    }

    private func update(minutes: Int, seconds: Int, commit: Bool) {
        guard let duration = RestDurationScale.duration(minutes: minutes, seconds: seconds) else {
            return
        }
        if commit {
            onCommit(duration)
        } else if duration != value {
            onChange(duration)
        }
    }

    private func minuteAccessibilityValue(_ minutes: Int) -> String {
        "\(minutes) \(minutes == 1 ? "minute" : "minutes")"
    }

    private func secondAccessibilityValue(_ seconds: Int) -> String {
        "\(seconds) \(seconds == 1 ? "second" : "seconds")"
    }
}

private struct CurvedDurationWheel: View {
    enum Side {
        case left
        case right
    }

    let side: Side
    let values: [Int]
    let selection: Int
    let displayText: (Int) -> String
    let accessibilityLabel: String
    let accessibilityValue: String
    let onChange: (Int) -> Void
    let onCommit: (Int) -> Void
    let selectionFeedback: () -> Void
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var dragStartIndex: Int?
    @State private var lastReportedIndex: Int?
    @State private var residualOffset: CGFloat = 0
    @State private var changedDuringDrag = false

    var body: some View {
        GeometryReader { proxy in
            // The wheels remain much wider than their half-card viewports, but fit
            // vertically so their circular silhouette never ends in a flat crop.
            let radius = max(1, (proxy.size.height / 2) - 2)
            let centerGap: CGFloat = min(30, proxy.size.width * 0.15)
            let centerX = side == .left
                ? proxy.size.width - centerGap - radius
                : centerGap + radius
            let center = CGPoint(x: centerX, y: proxy.size.height / 2)
            let numberRadius = radius - min(52, radius * 0.18)

            ZStack {
                Circle()
                    .fill(EQColor.surfaceHighlightDark)
                    .overlay {
                        Circle()
                            .stroke(
                                EQColor.disabledText,
                                lineWidth: 1
                            )
                    }
                    .frame(width: radius * 2, height: radius * 2)
                    .position(center)
                    .accessibilityHidden(true)

                ForEach(Array(values.enumerated()), id: \.element) { index, wheelValue in
                    let selectedIndex = values.firstIndex(of: selection) ?? 0
                    let arcDistance = CGFloat(index - selectedIndex)
                        * DurationWheelMotion.stepDistance
                        + residualOffset
                    let angle = arcDistance / numberRadius
                    let horizontalDistance = numberRadius * cos(angle)
                    let verticalDistance = numberRadius * sin(angle)
                    let x = side == .left
                        ? center.x + horizontalDistance
                        : center.x - horizontalDistance
                    let emphasis = emphasis(for: arcDistance)
                    let arcVisibility = arcVisibility(for: angle)

                    Text(displayText(wheelValue))
                        .eqTextStyle(EQTextStyle(size: 52, weight: .medium))
                        .monospacedDigit()
                        .foregroundStyle(
                            EQColor.Execution.foregroundText.opacity(
                                emphasis.opacity * arcVisibility
                            )
                        )
                        .scaleEffect(emphasis.scale)
                        .position(x: x, y: center.y + verticalDistance)
                        .accessibilityHidden(true)
                }
            }
            .contentShape(Rectangle())
            .gesture(dragGesture)
        }
        .clipped()
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(accessibilityLabel)
        .accessibilityValue(accessibilityValue)
        .accessibilityHint("Swipe up or down to adjust")
        .accessibilityAdjustableAction { direction in
            adjustAccessibilitySelection(direction)
        }
    }

    private var selectedIndex: Int {
        values.firstIndex(of: selection) ?? 0
    }

    private var dragGesture: some Gesture {
        DragGesture(minimumDistance: 4)
            .onChanged { gesture in
                if dragStartIndex == nil {
                    dragStartIndex = selectedIndex
                    lastReportedIndex = selectedIndex
                    changedDuringDrag = false
                }
                guard let dragStartIndex else { return }
                let newIndex = DurationWheelMotion.index(
                    startingAt: dragStartIndex,
                    translation: gesture.translation.height,
                    count: values.count
                )
                let newSelection = values[newIndex]
                if newIndex != lastReportedIndex {
                    onChange(newSelection)
                    selectionFeedback()
                    lastReportedIndex = newIndex
                    changedDuringDrag = true
                }

                let consumedDistance = CGFloat(newIndex - dragStartIndex)
                    * DurationWheelMotion.stepDistance
                let rawOffset = gesture.translation.height + consumedDistance
                let maximumOffset = DurationWheelMotion.stepDistance * 0.48
                residualOffset = min(max(rawOffset, -maximumOffset), maximumOffset)
            }
            .onEnded { gesture in
                guard let dragStartIndex else { return }
                let finalIndex = DurationWheelMotion.projectedIndex(
                    startingAt: dragStartIndex,
                    translation: gesture.translation.height,
                    predictedTranslation: gesture.predictedEndTranslation.height,
                    count: values.count
                )
                let finalSelection = values[finalIndex]
                if finalIndex != lastReportedIndex {
                    onChange(finalSelection)
                    selectionFeedback()
                    lastReportedIndex = finalIndex
                    changedDuringDrag = true
                }

                if reduceMotion {
                    residualOffset = 0
                } else {
                    withAnimation(EQMotion.microTransition) {
                        residualOffset = 0
                    }
                }
                self.dragStartIndex = nil
                lastReportedIndex = nil
                if changedDuringDrag {
                    onCommit(finalSelection)
                }
                changedDuringDrag = false
            }
    }

    private func emphasis(for distance: CGFloat) -> (opacity: Double, scale: CGFloat) {
        let steps = min(abs(distance) / DurationWheelMotion.stepDistance, 4)
        return (
            opacity: max(0.14, 1 - (Double(steps) * 0.22)),
            scale: max(0.62, 1 - (steps * 0.11))
        )
    }

    private func arcVisibility(for angle: CGFloat) -> Double {
        let absoluteAngle = abs(angle)
        let fadeStart = CGFloat.pi * 0.4
        let fadeEnd = CGFloat.pi / 2
        guard absoluteAngle > fadeStart else { return 1 }
        guard absoluteAngle < fadeEnd else { return 0 }
        return Double(1 - ((absoluteAngle - fadeStart) / (fadeEnd - fadeStart)))
    }

    private func adjustAccessibilitySelection(_ direction: AccessibilityAdjustmentDirection) {
        let delta: Int
        switch direction {
        case .increment:
            delta = 1
        case .decrement:
            delta = -1
        @unknown default:
            return
        }
        let newIndex = min(max(selectedIndex + delta, 0), values.count - 1)
        guard newIndex != selectedIndex else { return }
        let newSelection = values[newIndex]
        onCommit(newSelection)
        selectionFeedback()
    }
}

private struct ExerciseSettingsToggleStyle: ToggleStyle {
    func makeBody(configuration: Configuration) -> some View {
        let tint = configuration.isOn
            ? EQColor.Execution.foregroundText
            : EQColor.disabledText
        return Button { configuration.isOn.toggle() } label: {
            HStack(spacing: EQLayout.controlGap) {
                configuration.label
                Spacer()
                Capsule()
                    .stroke(tint, lineWidth: 1.5)
                    .frame(width: 40, height: 24)
                    .overlay(alignment: configuration.isOn ? .trailing : .leading) {
                        Circle()
                            .fill(tint)
                            .frame(width: 16, height: 16)
                            .padding(.horizontal, EQSpacing.xxs)
                    }
                    .animation(EQMotion.contentTransition, value: configuration.isOn)
            }
            .frame(minHeight: EQLayout.minimumTouch)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityRepresentation { Toggle(isOn: configuration.$isOn) { configuration.label } }
    }
}

private struct ExecutionTimerRegion: View {
    @Environment(\.timerVisibilityProgress) private var visibilityProgress
    let presentation: ExecutionTimerRegionPresentation
    let timer: CountdownTimer
    let nextAction: String?
    let reduceMotion: Bool

    var body: some View {
        Group {
            if presentation.isVisible {
                Color.clear
                    .overlay(alignment: .top) {
                        Group {
                            if isWorkCountdown {
                                TimelineView(.animation(
                                    minimumInterval: 1.0 / 30.0,
                                    paused: timer.state != .running
                                )) { _ in
                                    let number = TimerVisualMotion.countdownNumber(
                                        timerProgress: timer.normalizedProgress
                                    )
                                    EQRollingTimerText(
                                        value: number.formatted(),
                                        reduceMotion: reduceMotion
                                    )
                                    .eqTextStyle(.largeMetric)
                                    .accessibilityLabel("Work countdown")
                                    .accessibilityValue("\(countdownSeconds)")
                                }
                            } else {
                                EQRollingTimerText(
                                    value: durationText,
                                    reduceMotion: reduceMotion
                                )
                                    .eqTextStyle(.largeMetric)
                                    .accessibilityLabel("\(title) time remaining, \(durationText)")
                            }
                        }
                        .lineLimit(1)
                        .fixedSize()
                        .foregroundStyle(timerColor)
                        // Grows in place as the wallet uncovers it, and shrinks back under it when the timer ends.
                        .scaleEffect(reduceMotion ? 1 : 0.4 + (0.6 * visibilityProgress), anchor: .center)
                        .padding(.top, EQSpacing.lg)
                        .padding(.horizontal, EQLayout.WorkoutExecution.walletInset)
                    }
                    .transition(.identity)
            } else {
                Color.clear
                    .frame(height: 0)
                    .transition(.identity)
            }
        }
        .allowsHitTesting(visibilityProgress > 0.99)
        .accessibilityHidden(visibilityProgress < 0.99)
        .accessibilityIdentifier("execution-timer-region")
    }

    private var title: String {
        switch presentation {
        case .hidden: return ""
        case .work(let state, _): return workPhaseLabel(state.phase)
        case .rest: return "Rest"
        }
    }

    private var timerColor: Color {
        ExecutionTimerVisualStyle.color(for: presentation)
    }

    private var isWorkCountdown: Bool {
        guard case .work(let state, _) = presentation else { return false }
        return state.phase == .ready
    }

    private var countdownSeconds: Int {
        TimerVisualMotion.countdownNumber(timerProgress: timer.normalizedProgress)
    }

    private var remaining: TimeInterval {
        switch presentation {
        case .hidden: return 0
        case .work(let state, _): return state.remaining
        case .rest(let state): return state.remaining
        }
    }

    private var durationText: String { ExecutionTimerFormatting.durationText(for: remaining) }

    private var isTwoSided: Bool {
        if case .work(let state, _) = presentation { return state.isTwoSided }
        return false
    }

    private func workPhaseLabel(_ phase: WorkoutWorkTimerPhase) -> String {
        switch phase {
        case .ready: return "Work countdown"
        case .firstSide: return isTwoSided ? "Work, side 1 of 2" : "Work"
        case .switchSides: return "Switch sides"
        case .secondSide: return "Work, side 2 of 2"
        }
    }
}

#if DEBUG
@MainActor private func executionPreview(_ workout: Workout, size: DynamicTypeSize = .large) -> some View {
    let container = try! PersistenceController.makeContainer(inMemory: true)
    container.mainContext.insert(WorkoutMapper.record(from: workout)); try! container.mainContext.save()
    return NavigationStack { WorkoutExecutionView(id: workout.id, repository: SwiftDataRepository(container: container)) }
        .modelContainer(container).preferredColorScheme(.dark).dynamicTypeSize(size)
}
#Preview("Ready workout") { executionPreview(EquilibriumFixtures.ready()) }
#Preview("Mid-workout") { executionPreview(EquilibriumFixtures.midWorkout()) }
#Preview("Duration") { executionPreview(EquilibriumFixtures.mixed()) }
#Preview("Completed read-only") { executionPreview(EquilibriumFixtures.completed()) }
#Preview("Accessibility XXL") { executionPreview(EquilibriumFixtures.midWorkout(id: "preview-xxl"), size: .accessibility3) }
#endif
