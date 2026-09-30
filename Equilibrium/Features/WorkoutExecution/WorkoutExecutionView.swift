import SwiftUI
import UIKit
import Observation

enum ExecutionWalletPresentationMode: Equatable {
    case focusedExercise
    case exerciseOverview
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
}

private struct ExecutionPrimaryAction {
    let title: String
    let accessibilityHint: String
    let perform: () -> Void
}

private struct ExecutionPrimaryActionPreferenceKey: PreferenceKey {
    static let defaultValue: ExecutionPrimaryAction? = nil

    static func reduce(value: inout ExecutionPrimaryAction?, nextValue: () -> ExecutionPrimaryAction?) {
        if let nextAction = nextValue() {
            value = nextAction
        }
    }
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
    static func overlap(keyboardFrame: CGRect) -> CGFloat {
        guard !keyboardFrame.isNull else { return 0 }
        return max(0, keyboardFrame.height)
    }

    static func walletOffset(overlap: CGFloat) -> CGFloat {
        -max(0, overlap)
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
        return String(format: "%d:%02d", seconds / 60, seconds % 60)
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

private struct ExecutionPerformancePresentation: Identifiable {
    let id: WorkoutExerciseID
    let exerciseID: ExerciseID
    let exerciseName: String
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
        let exitArrival = min(max((walletTransitionProgress - 0.78) / 0.18, 0), 1)
        return min(min(max(entryProgress, 0), 1), exitArrival)
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

private extension EnvironmentValues {
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

    private func setMode(_ newMode: ExecutionWalletPresentationMode) -> Bool {
        guard mode != newMode else { return false }
        mode = newMode
        return true
    }
}

@MainActor @Observable
final class ExerciseSettingsPresentation {
    private(set) var exerciseID: WorkoutExerciseID?

    var isPresented: Bool { exerciseID != nil }

    func present(exerciseID: WorkoutExerciseID) { self.exerciseID = exerciseID }
    func dismiss() { exerciseID = nil }
}

struct WorkoutExecutionView: View {
    @State private var model: WorkoutExecutionModel
    @Environment(\.dismiss) private var dismiss
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.homeExecutionTransitionProgress) private var homeTransitionProgress
    @State private var confirmsReset = false
    @State private var confirmsDelete = false
    @State private var editsRestDuration = false
    @State private var setCountEditorExerciseID: WorkoutExerciseID?
    @State private var restoresExercise: WorkoutExercise?
    @State private var exerciseSettingsPresentation = ExerciseSettingsPresentation()
    @State private var performancePresentation: ExecutionPerformancePresentation?
    @State private var walletPresentation = ExecutionWalletPresentation(initialMode: .exerciseOverview)
    @State private var foregroundFocusProgress: CGFloat = 0
    @State private var restExerciseListExpansionProgress: CGFloat = 0
    @State private var timerVisibilityProgress: CGFloat = 0
    @State private var foregroundPresenceProgress: CGFloat = 0
    @State private var displayedForeground: ExecutionForegroundSnapshot?
    @State private var displayedTimerPresentation: ExecutionTimerRegionPresentation = .hidden
    @State private var keyboardFrame: CGRect = .null
    private let historyRepository: (any ExerciseHistoryRepository)?
    private let onExit: (() -> Void)?
    private let usesObjectSurface: Bool
    private let transitionSourceFrame: CGRect?
    private let reportWalletFrame: ((CGRect) -> Void)?
    private let haptics: any HapticsClient

    init(id: WorkoutID, initialWorkout: Workout? = nil, repository: any WorkoutRepository, historyRepository: (any ExerciseHistoryRepository)? = nil, progressionRepository: (any ProgressionRepository)? = nil, exerciseRepository: (any ExerciseRepository)? = nil, settingsRepository: (any SettingsRepository)? = nil, weightUnit: WeightUnit = .pounds, defaultRestDuration: TimeInterval = 90, restSessionStore: WorkoutRestSessionStore? = nil, transitionSourceFrame: CGRect? = nil, reportWalletFrame: ((CGRect) -> Void)? = nil, haptics: (any HapticsClient)? = nil, didPersist: @escaping (Workout) -> Void = { _ in }, onExit: (() -> Void)? = nil, usesObjectSurface: Bool = false) {
        let resolvedHaptics = haptics ?? SystemHapticsClient()
        self.historyRepository = historyRepository ?? (repository as? SwiftDataRepository)
        self.onExit = onExit
        self.usesObjectSurface = usesObjectSurface
        self.transitionSourceFrame = transitionSourceFrame
        self.reportWalletFrame = reportWalletFrame
        self.haptics = resolvedHaptics
        _model = State(initialValue: WorkoutExecutionModel(workoutID: id, initialWorkout: initialWorkout, repository: repository, historyRepository: historyRepository ?? (repository as? SwiftDataRepository), progressionRepository: progressionRepository ?? (repository as? SwiftDataRepository), exerciseRepository: exerciseRepository ?? (repository as? SwiftDataRepository), settingsRepository: settingsRepository ?? (repository as? SwiftDataRepository), weightUnit: weightUnit, defaultRestDuration: defaultRestDuration, restSessionStore: restSessionStore, haptics: resolvedHaptics, audio: SystemAudioFeedbackClient(), didPersist: didPersist))
    }

    var body: some View {
        ZStack {
            if !usesObjectSurface || model.restState != nil {
                executionCanvas.ignoresSafeArea()
            }
            if let workout = model.workout {
                content(workout)
            } else if let error = model.errorMessage {
                ContentUnavailableView("Workout unavailable", systemImage: "exclamationmark.triangle", description: Text(error))
            } else {
                ProgressView("Loading workout")
            }
        }
        .ignoresSafeArea(.keyboard, edges: .bottom)
        .foregroundStyle(EQColor.Execution.primaryText)
        .navigationBarBackButtonHidden()
        .task { await model.activate() }
        .onReceive(NotificationCenter.default.publisher(for: .equilibriumRepositoryDidChange)) { _ in Task { await model.refreshFromPersistence() } }
        .onReceive(NotificationCenter.default.publisher(for: .equilibriumSettingsDidChange)) { _ in Task { await model.refreshRestPreferences() } }
        .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillChangeFrameNotification)) {
            updateKeyboardFrame(from: $0)
        }
        .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillHideNotification)) {
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
        .sheet(item: $setCountEditorExerciseID) { exerciseID in
            if let exercise = model.exercise(id: exerciseID) {
                SetCountEditor(
                    exerciseName: exercise.nameSnapshot,
                    initialCount: exercise.prescriptions.count,
                    minimumCount: max(1, Set(exercise.loggedSets.filter { $0.completedAt != nil }.compactMap(\.prescriptionID)).count)
                ) { count in
                    await model.updateSetCount(exerciseID: exerciseID, count: count)
                }
            }
        }
        .sheet(item: exerciseSettingsDestination, onDismiss: exerciseSettingsPresentation.dismiss) { exerciseID in
            ExerciseSettingsView(exerciseID: exerciseID, model: model)
        }
        .sheet(item: $performancePresentation) { presentation in
            if let historyRepository {
                NavigationStack {
                    ExercisePerformanceView(
                        exerciseID: presentation.exerciseID,
                        fallbackName: presentation.exerciseName,
                        repository: historyRepository,
                        weightUnit: model.weightUnit
                    )
                    .toolbar {
                        ToolbarItem(placement: .cancellationAction) {
                            Button("Done") { performancePresentation = nil }
                        }
                    }
                }
                .tint(EQColor.Execution.foregroundText)
                .presentationBackground(EQColor.Execution.foregroundSurface)
                .environment(\.colorScheme, .dark)
            }
        }
    }

    private func workoutHeader(_ workout: Workout) -> some View {
        HStack(spacing: EQLayout.controlGap) {
            Button(action: requestExit) {
                HStack(spacing: EQSpacing.xs) {
                    Image(systemName: "chevron.left")
                        .opacity(executionChromeProgress)
                        .offset(y: executionHeaderOffset)
                    Text(workout.titleSnapshot)
                        .eqTextStyle(.navigationTitle)
                        .lineLimit(1)
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
                Menu {
                    if model.canEditRestDuration {
                        Button("Rest duration", systemImage: "timer") { editsRestDuration = true }
                    }
                    if let shareText = model.shareText {
                        ShareLink(item: shareText, subject: Text(model.workout?.titleSnapshot ?? "Workout")) {
                            Label("Share workout", systemImage: "square.and.arrow.up")
                        }
                    }
                    Button("Reset workout", systemImage: "arrow.counterclockwise", role: .destructive) { confirmsReset = true }
                    Button("Delete workout", systemImage: "trash", role: .destructive) { confirmsDelete = true }
                } label: {
                    EQSettingsGlyph(color: EQColor.Execution.secondaryText)
                        .frame(width: EQLayout.minimumTouch, height: EQLayout.minimumTouch, alignment: .trailing)
                        .contentShape(Rectangle())
                }
                .accessibilityLabel("Workout options")
                .accessibilityHint("Contains available workout actions")
                .opacity(executionChromeProgress)
                .offset(y: executionHeaderOffset)
            }
        }
        .padding(.horizontal, EQLayout.screenGutter)
        .frame(maxWidth: .infinity, minHeight: EQLayout.minimumTouch + EQSpacing.sm)
        .allowsHitTesting(homeTransitionProgress > 0.99)
    }

    private func requestExit() {
        if let onExit { onExit() }
        else { dismiss() }
    }

    private func content(_ workout: Workout) -> some View {
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
        return VStack(spacing: 0) {
            workoutHeader(workout)
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

                VStack(spacing: 0) {
                    ExecutionTimerRegion(
                        presentation: visualTimerPresentation,
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
                        reduceMotion: reduceMotion,
                        transitionSourceFrame: transitionSourceFrame,
                        reportFrame: reportWalletFrame,
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
                        footerControls: { exercise in footerSetCountControls(for: exercise) }
                    )
                    .frame(height: walletHeight)
                    .offset(y: ExecutionKeyboardLayout.walletOffset(overlap: keyboardOverlap))
                    .modifier(ForegroundFocusTransitionModifier(progress: foregroundFocusProgress))
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
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
        EQLayout.WorkoutExecution.restCardHeight + EQLayout.minimumTouch + EQSpacing.md
    }

    private var keyboardOverlap: CGFloat {
        ExecutionKeyboardLayout.overlap(keyboardFrame: keyboardFrame)
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
        let duration = notification.userInfo?[UIResponder.keyboardAnimationDurationUserInfoKey] as? Double ?? 0.25
        withAnimation(.easeOut(duration: duration)) {
            keyboardFrame = targetFrame
        }
    }

    private var executionCanvas: Color {
        model.restState == nil ? EQColor.Execution.canvas : EQColor.Execution.restCanvas
    }

    @ViewBuilder
    private func footerSetCountControls(for exercise: WorkoutExercise) -> some View {
        if model.currentPrescription != nil {
            Menu {
                ForEach(exercise.prescriptions.indices, id: \.self) { index in
                    let done = exercise.loggedSets.contains {
                        $0.prescriptionID == exercise.prescriptions[index].id && $0.completedAt != nil
                    }
                    Button { model.selectSet(at: index) } label: {
                        Text("Set \(index + 1)\(done ? " · Completed" : "")")
                    }
                }
            } label: {
                Text("\(model.selectedSetIndex + 1)/\(exercise.prescriptions.count)")
                    .eqTextStyle(.caption)
                    .monospacedDigit()
                    .frame(minWidth: EQLayout.minimumTouch, minHeight: EQLayout.minimumTouch, alignment: .trailing)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Set \(model.selectedSetIndex + 1) of \(exercise.prescriptions.count)")
            .accessibilityHint("Choose a set")
        } else {
            Text("\(exercise.loggedSets.count) sets")
                .eqTextStyle(.caption)
                .frame(minWidth: EQLayout.minimumTouch, minHeight: EQLayout.minimumTouch, alignment: .trailing)
        }

        if model.workTimerState == nil && model.restState == nil {
            EQIconButton(systemImage: "pencil") {
                setCountEditorExerciseID = exercise.id
            }
            .accessibilityLabel("Edit number of sets")
            .accessibilityHint("Adjusts the number of working sets for \(exercise.nameSnapshot)")
        }
    }

    private var executionChromeProgress: Double {
        Double(HomeExecutionReveal.progress(homeTransitionProgress, from: 0.55, through: 0.80))
    }

    private var executionHeaderOffset: CGFloat {
        ExecutionMotionPolicy.offset(
            distance: -EQSpacing.md,
            progress: CGFloat(executionChromeProgress),
            reduceMotion: reduceMotion
        )
    }

    @ViewBuilder private func foregroundExerciseHeader(focusProgress: CGFloat) -> some View {
        let isResting = model.restState != nil
        let isWorking = model.workTimerState != nil
        let isTiming = isResting || isWorking
        let progress = min(max(focusProgress, 0), 1)
        let secondaryProgress = min(max((progress - 0.18) / 0.82, 0), 1)
        let headerControlsOpacity = isTiming ? 0 : Double(secondaryProgress)
        Text("IN PROGRESS")
            .eqTextStyle(.sectionLabel)
            .frame(maxWidth: .infinity, minHeight: EQLayout.minimumTouch, alignment: .leading)
            .accessibilityIdentifier("execution-current-state-label-\(model.workoutID.rawValue)")
            .overlay(alignment: .trailing) {
                ZStack(alignment: .trailing) {
                    Image(systemName: "chevron.up")
                        .foregroundStyle(EQColor.Execution.foregroundText)
                        .accessibilityHidden(true)
                        .opacity(isTiming ? 0 : 1 - secondaryProgress)
                    HStack(spacing: 0) {
                        if let exercise = foregroundExercise, historyRepository != nil {
                            EQIconButton(systemImage: "chart.xyaxis.line") {
                                performancePresentation = .init(
                                    id: exercise.id,
                                    exerciseID: exercise.exerciseID,
                                    exerciseName: exercise.nameSnapshot
                                )
                            }
                            .accessibilityLabel("Previous performance")
                            .accessibilityHint("Shows completed working sets, trend, and personal record")
                        }
                        if let exercise = foregroundExercise, !model.isReadOnly {
                            EQIconButton(systemImage: "slider.horizontal.3", alignment: .trailing) {
                                presentExerciseSettings(for: exercise)
                            }
                            .accessibilityLabel("Exercise Settings")
                            .accessibilityHint("Opens settings for \(exercise.nameSnapshot) without leaving the workout")
                        }
                    }
                    .opacity(headerControlsOpacity)
                    .allowsHitTesting(!isTiming && secondaryProgress > 0.99)
                    .accessibilityHidden(isTiming || secondaryProgress < 0.99)
                }
            }
    }

    @ViewBuilder private func foregroundExerciseContent() -> some View {
        if let exerciseName = foregroundExerciseName {
            Text(exerciseName)
                .eqTextStyle(.screenTitle)
                .lineLimit(2)
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
        VStack(alignment: .leading, spacing: EQSpacing.md) {
            if let exercise = model.currentExercise, let prescription = model.currentPrescription {
                FocusedSetView(
                    exercise: exercise,
                    prescription: prescription,
                    progression: model.suggestion(for: exercise),
                    selectedIndex: model.selectedSetIndex,
                    isReadOnly: model.isReadOnly,
                    weightUnit: model.weightUnit,
                    log: { input in await model.log(exerciseID: exercise.id, prescriptionID: prescription.id, input: input) },
                    startTimed: { input in model.startWorkTimer(exerciseID: exercise.id, prescriptionID: prescription.id, input: input) }
                )
                .id("\(exercise.id.rawValue)-\(prescription.id.rawValue)-\(model.progressionIdentity(for: exercise))")
            } else if let exercise = model.currentExercise, !model.isReadOnly {
                FirstSetView(
                    exercise: exercise,
                    progression: model.suggestion(for: exercise),
                    weightUnit: model.weightUnit,
                    log: { input in
                        if exercise.isTimeBased { await model.startFirstWorkTimer(exerciseID: exercise.id, input: input) }
                        else { await model.logFirstSet(exerciseID: exercise.id, input: input) }
                    }
                )
            } else {
                Text("Every required set is logged.").eqTextStyle(.sectionTitle)
            }
        }
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

    private var exerciseSettingsDestination: Binding<WorkoutExerciseID?> {
        Binding(
            get: { exerciseSettingsPresentation.exerciseID },
            set: { exerciseID in
                if let exerciseID { exerciseSettingsPresentation.present(exerciseID: exerciseID) }
                else { exerciseSettingsPresentation.dismiss() }
            }
        )
    }

    private func presentExerciseSettings(for exercise: WorkoutExercise) {
        guard model.foregroundState == .exercise, model.showsExecutionOptions,
              model.exercise(id: exercise.id)?.skippedAt == nil else { return }
        exerciseSettingsPresentation.present(exerciseID: exercise.id)
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

        guard !reduceMotion, homeTransitionProgress > 0.99 else {
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

private struct ExecutionWallet<ListRow: View, ForegroundHeader: View, ForegroundContent: View, ForegroundValues: View, FooterControls: View>: View {
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @Environment(\.homeExecutionTransitionProgress) private var homeTransitionProgress
    @Environment(\.foregroundFocusProgress) private var focusProgress
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
    let reduceMotion: Bool
    let transitionSourceFrame: CGRect?
    let reportFrame: ((CGRect) -> Void)?
    let listRow: (WorkoutExercise, ExerciseState) -> ListRow
    let selectExercise: (WorkoutExercise) -> Void
    let showOverview: () -> Void
    let completedSectionToggled: () -> Void
    let showSettings: (WorkoutExercise) -> Void
    let showFocused: () -> Void
    let skipRest: () -> Void
    let skipWork: () -> Void
    let pauseResumeWork: () -> Void
    let foregroundHeader: (CGFloat) -> ForegroundHeader
    let foregroundContent: () -> ForegroundContent
    let foregroundValues: () -> ForegroundValues
    let footerControls: (WorkoutExercise) -> FooterControls

    var body: some View {
        GeometryReader { proxy in
            let headerHeight = dynamicTypeSize.isAccessibilitySize
                ? EQLayout.minimumTouch + (EQSpacing.xl * 2)
                : EQLayout.minimumTouch + EQSpacing.md
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
            let walletWidth = max(0, currentFrame.width)
            let walletHeight = max(0, currentFrame.height)
            let focusedTop = max(0, headerHeight - EQLayout.WorkoutExecution.walletEdgeInset)
            let compactHeight = visualState == .focusedRest
                ? max(
                    defaultCompactHeight,
                    EQLayout.WorkoutExecution.restCardHeight
                        + EQLayout.minimumTouch
                        + EQSpacing.md
                        - focusedTop
                )
                : defaultCompactHeight
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
            let compactEntranceOffset = (1 - compactArrival) * (compactHeight + EQSpacing.md)
            let presence = min(max(foregroundPresenceProgress, 0), 1)
            let foregroundDismissalOffset = ExecutionMotionPolicy.offset(
                distance: compactHeight + EQSpacing.md,
                progress: presence,
                reduceMotion: reduceMotion
            )
            ZStack(alignment: .topLeading) {
                ZStack(alignment: .top) {
                    exerciseListCard(compactHeight: compactHeight)
                        .frame(width: walletWidth, height: walletHeight)
                        .background {
                            walletSurface.accessibilityHidden(true)
                        }
                        .accessibilityIdentifier("execution-exercise-list-card-\(workout.id.rawValue)")

                    if showsForegroundExercise {
                        foregroundCard(progress: progress)
                            .frame(width: walletWidth, height: foregroundLayout.height, alignment: .top)
                            .background(foregroundBackground)
                            .modifier(ExecutionWalletShapeModifier(drawsBorder: true))
                            .contentShape(RoundedRectangle(cornerRadius: EQRadius.walletSurface, style: .continuous))
                            .offset(y: foregroundLayout.top + compactEntranceOffset + foregroundDismissalOffset)
                            .accessibilityHidden(compactArrival < 0.99)
                            .zIndex(1)
                            .accessibilityIdentifier("execution-current-exercise-card-\(workout.id.rawValue)")
                    }
                }
                .frame(width: walletWidth, height: walletHeight)
                .overlayPreferenceValue(ExecutionPrimaryActionPreferenceKey.self) { primaryAction in
                    unifiedActionControls(primaryAction)
                }
                .modifier(ExecutionWalletShapeModifier())
                .position(x: currentFrame.midX, y: currentFrame.midY)
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

    private var overviewSurfaceColor: Color {
        visualState == .focusedRest
            ? EQColor.Execution.restOverviewSurface
            : EQColor.Execution.overviewSurface
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
                            .foregroundStyle(EQColor.Execution.overviewText)
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
        .foregroundStyle(EQColor.Execution.overviewText)
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
        return Button {
            if canShowOverview { showOverview() }
        } label: {
            exerciseListHeaderLabel
        }
        .buttonStyle(.plain)
        .allowsHitTesting(canShowOverview)
        .accessibilityHint(
            canShowOverview
                ? (presentation.mode == .focusedExercise ? "Shows the full exercise list" : "Exercise list is already visible")
                : (workout.status == .completed ? "Completed workout exercise overview" : "Exercise overview is unavailable during rest")
        )
    }

    private var exerciseListHeaderLabel: some View {
        EQSectionHeader(title: "EXERCISES", color: EQColor.Execution.overviewText) {
            if presentation.mode == .exerciseOverview {
                Text(model.progress.fraction, format: .percent.precision(.fractionLength(0)))
                    .eqTextStyle(.sectionLabel)
                    .monospacedDigit()
            }
            exerciseProgressCircle
        }
        .contentShape(Rectangle())
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Exercises")
        .accessibilityValue(Text(model.progress.fraction, format: .percent.precision(.fractionLength(0))))
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
                color: EQColor.Execution.overviewSecondaryText,
                animation: reduceMotion
                    ? nil
                    : ExecutionCompletedSectionMotion.animation(
                        expanding: completedSectionPresentation.isExpanded
                    )
            )
        }
        .buttonStyle(.plain)
        .accessibilityLabel(ExecutionCompletedSectionPresentation.title(completedCount: completedExercises.count))
        .accessibilityValue(completedSectionPresentation.isExpanded ? "Expanded" : "Collapsed")
        .accessibilityHint(completedSectionPresentation.isExpanded ? "Collapses completed exercises" : "Expands completed exercises")
    }

    private var exerciseProgressCircle: some View {
        EQCircularProgressIndicator(
            progress: model.progress.fraction,
            tint: EQColor.Execution.progressAccent,
            track: EQColor.Execution.overviewText.opacity(0.18)
        )
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
    }

    private func foregroundCard(progress: CGFloat) -> some View {
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
        let footerProgress: CGFloat = showsActionFooter ? (isTiming ? 1 : progress) : 0
        let footerHeight = actionFooterHeight * footerProgress
        let accessibilityHeaderPadding = dynamicTypeSize.isAccessibilitySize ? EQSpacing.xl : 0
        let headerHeight = EQLayout.minimumTouch + EQSpacing.xxs + (accessibilityHeaderPadding * 2)

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
                foregroundHeader(progress)
                    .frame(maxWidth: .infinity, minHeight: EQLayout.minimumTouch, alignment: .leading)
                    .padding(.horizontal, EQLayout.WorkoutExecution.walletInset)
                    .padding(.top, EQSpacing.xxs)
                    .padding(.vertical, accessibilityHeaderPadding)
                    .background(EQColor.Execution.foregroundSurface)
                    .zIndex(2)

                ScrollView {
                    foregroundContent()
                        .padding(.horizontal, EQLayout.WorkoutExecution.walletInset)
                        .padding(.top, EQSpacing.xxs)
                        .frame(maxWidth: .infinity, alignment: .topLeading)
                }
                .frame(height: contentViewportHeight, alignment: .top)
                .scrollDisabled(!isFocused)
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
            .frame(width: proxy.size.width, height: proxy.size.height, alignment: .topLeading)
            .overlay(alignment: .topLeading) {
                if hasExerciseAction, !isTiming {
                    let revealProgress = min(max((progress - 0.18) / 0.82, 0), 1)
                    let valuesTopInset = anchors.contentTop + EQSpacing.md
                    let valuesBottomInset = max(0, proxy.size.height - anchors.contentBottom) + EQSpacing.md
                    foregroundValues()
                        .frame(
                            width: max(0, proxy.size.width - (EQLayout.WorkoutExecution.walletInset * 2)),
                            height: max(0, proxy.size.height - valuesTopInset - valuesBottomInset),
                            alignment: .bottomLeading
                        )
                        .padding(.horizontal, EQLayout.WorkoutExecution.walletInset)
                        .padding(.top, valuesTopInset)
                        .padding(.bottom, valuesBottomInset)
                        .frame(width: proxy.size.width, height: proxy.size.height, alignment: .topLeading)
                        .clipped()
                        .opacity(Double(revealProgress))
                        .allowsHitTesting(revealProgress > 0.99)
                        .accessibilityHidden(revealProgress < 0.99)
                }
            }
            .contentShape(Rectangle())
            .simultaneousGesture(
                TapGesture().onEnded { showFocused() },
                including: !isFocused && !isTiming ? .all : .none
            )
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .foregroundStyle(EQColor.Execution.foregroundText)
    }

    private func unifiedActionControls(_ primaryAction: ExecutionPrimaryAction?) -> some View {
        let isResting = visualState == .focusedRest
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
        let revealProgress: CGFloat = switch phase {
        case .work, .rest: 1
        case .exercise: primaryAction == nil ? 0 : focusedReveal
        case .hidden: 0
        }
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
        let timerWidth: CGFloat? = phase == .work || phase == .rest
            ? EQLayout.WorkoutExecution.primaryActionTimerWidth
            : nil
        let phaseAnimation: Animation? = reduceMotion ? nil : EQMotion.objectTransformation
        let footerHeight = ExecutionPrimaryActionLayout.footerHeight(
            isVisible: true,
            controlHeight: EQLayout.WorkoutExecution.primaryActionHeight,
            topInset: EQLayout.WorkoutExecution.primaryActionTopInset,
            bottomInset: EQLayout.WorkoutExecution.primaryActionBottomInset,
            trailingControlHeight: EQLayout.minimumTouch
        )

        return HStack(spacing: EQLayout.controlGap) {
            Button {
                switch phase {
                case .hidden: break
                case .exercise: primaryAction?.perform()
                case .work: skipWork()
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
                tint: EQColor.Execution.primaryAction,
                foreground: EQColor.Execution.foregroundSurface,
                variant: isResting ? .outlined : .filled
            )
            .accessibilityHint(hint)
            .accessibilityIdentifier(ExecutionPrimaryActionIdentity(workoutID: workout.id).accessibilityIdentifier)
            .id(ExecutionPrimaryActionIdentity(workoutID: workout.id))

            if phase.showsPauseControl {
                Button(action: pauseResumeWork) {
                    Text(model.timer.state == .paused ? "Resume" : "Pause")
                        .contentTransition(reduceMotion ? .identity : .interpolate)
                        .lineLimit(1)
                        .fixedSize(horizontal: true, vertical: false)
                        .padding(.horizontal, EQLayout.WorkoutExecution.primaryActionHorizontalPadding)
                        .frame(minWidth: EQLayout.minimumTouch)
                        .frame(height: EQLayout.WorkoutExecution.primaryActionHeight)
                }
                .eqPrimaryCTA(
                    tint: EQColor.Execution.foregroundText,
                    foreground: EQColor.Execution.foregroundSurface,
                    variant: .outlined
                )
                .disabled(model.workTimerState?.phase == .ready)
                .accessibilityHint(model.timer.state == .paused ? "Resumes the work timer" : "Pauses the work timer")
                .transition(reduceMotion ? .identity : .move(edge: .trailing))
            }

            if phase == .exercise, hasExerciseAction, let exercise = model.currentExercise {
                Spacer(minLength: EQSpacing.xs)
                footerControls(exercise)
            }
        }
        .animation(phaseAnimation, value: phase)
        .allowsHitTesting(isInteractive)
        .accessibilityHidden(!isInteractive)
        .padding(.horizontal, EQLayout.WorkoutExecution.walletInset)
        .padding(.top, EQLayout.WorkoutExecution.primaryActionTopInset)
        .padding(.bottom, EQLayout.WorkoutExecution.primaryActionBottomInset)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomLeading)
        .offset(y: footerHeight * (1 - revealProgress))
        .foregroundStyle(EQColor.Execution.foregroundText)
    }

    private var foregroundBackground: some View {
        EQSurface(color: EQColor.Execution.foregroundSurface, radius: EQRadius.walletSurface)
    }

}

private struct ExecutionWalletShapeModifier: ViewModifier {
    var drawsBorder = false

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
                        shape.stroke(
                            EQColor.Execution.walletBorder,
                            lineWidth: EQLayout.WorkoutExecution.walletBorderWidth
                        )
                    }
                }
        } else {
            let shape = RoundedRectangle(cornerRadius: EQRadius.walletSurface, style: .continuous)
            content
                .clipShape(shape)
                .overlay {
                    if drawsBorder {
                        shape.stroke(
                            EQColor.Execution.walletBorder,
                            lineWidth: EQLayout.WorkoutExecution.walletBorderWidth
                        )
                    }
                }
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
        _seconds = State(initialValue: min(300, max(15, (initialSeconds / 5).rounded() * 5)))
        self.guidance = guidance
        self.save = save
    }
    var body: some View {
        NavigationStack {
            Form {
                Section("Rest time") {
                    Text(durationText).eqTextStyle(.largeMetric).monospacedDigit()
                    Slider(value: $seconds, in: 15...300, step: 5).accessibilityValue(durationText)
                }
                .listRowBackground(EQColor.Execution.foregroundSurface)
                Section { Text(guidance).eqTextStyle(.caption).foregroundStyle(EQColor.Execution.foregroundSecondaryText) }
                    .listRowBackground(EQColor.Execution.foregroundSurface)
            }
            .scrollContentBackground(.hidden)
            .background(EQColor.Execution.foregroundSurface)
            .foregroundStyle(EQColor.Execution.foregroundText)
            .tint(EQColor.Execution.foregroundText)
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
    private var durationText: String { String(format: "%d:%02d", Int(seconds) / 60, Int(seconds) % 60) }
}

private struct SetCountEditor: View {
    @Environment(\.dismiss) private var dismiss
    @State private var count: Int
    @State private var isSaving = false
    let exerciseName: String
    let minimumCount: Int
    let save: (Int) async -> Bool

    init(exerciseName: String, initialCount: Int, minimumCount: Int, save: @escaping (Int) async -> Bool) {
        self.exerciseName = exerciseName
        self.minimumCount = minimumCount
        self.save = save
        _count = State(initialValue: min(20, max(minimumCount, initialCount)))
    }

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: EQLayout.sectionGap) {
                Text(exerciseName)
                    .eqTextStyle(.sectionTitle)
                    .lineLimit(2)
                Text("\(count)")
                    .eqTextStyle(.largeMetric)
                    .monospacedDigit()
                    .contentTransition(.numericText())
                    .accessibilityHidden(true)
                Stepper(value: $count, in: minimumCount...20) {
                    Text(count == 1 ? "1 set" : "\(count) sets")
                        .eqTextStyle(.body)
                }
                if minimumCount > 1 {
                    Text("\(minimumCount) completed sets will be kept.")
                        .eqTextStyle(.caption)
                        .foregroundStyle(EQColor.Execution.foregroundSecondaryText)
                }
                Spacer(minLength: 0)
            }
            .padding(EQLayout.screenGutter)
            .foregroundStyle(EQColor.Execution.foregroundText)
            .background(EQColor.Execution.foregroundSurface)
            .navigationTitle("Number of sets")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .disabled(isSaving)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        isSaving = true
                        Task {
                            if await save(count) { dismiss() }
                            else { isSaving = false }
                        }
                    }
                    .disabled(isSaving)
                }
            }
        }
        .presentationDetents([.height(320)])
        .presentationBackground(EQColor.Execution.foregroundSurface)
        .presentationCornerRadius(EQRadius.sheet)
        .environment(\.colorScheme, .dark)
        .interactiveDismissDisabled(isSaving)
    }
}

private struct FirstSetView: View {
    let exercise: WorkoutExercise; let progression: ProgressionSuggestion?; let weightUnit: WeightUnit; let log: (SetLogInput) async -> Void
    @State private var weight: String
    @State private var repetitions: String
    @FocusState private var fieldFocused: Bool

    init(exercise: WorkoutExercise, progression: ProgressionSuggestion?, weightUnit: WeightUnit, log: @escaping (SetLogInput) async -> Void) {
        self.exercise = exercise
        self.progression = progression
        self.weightUnit = weightUnit
        self.log = log
        _weight = State(initialValue: WeightText.value(progression?.suggestedWeight, unit: weightUnit))
        _repetitions = State(initialValue: progression?.targetRepetitions.map { String($0.lowerBound) } ?? "")
    }
    var body: some View {
        VStack(alignment: .leading, spacing: EQLayout.sectionGap) {
            Text("No previous working sets").eqTextStyle(.caption).foregroundStyle(EQColor.Execution.foregroundSecondaryText)
            VStack(alignment: .leading, spacing: EQSpacing.md) {
                EQMetricInput(value: $weight, label: (weightUnit == .pounds ? "lb" : "kg") + (progression?.rationale == .increaseWeight ? " ↑" : ""), accessibilityLabel: "Weight", keyboard: .decimalPad, valueColor: EQColor.Execution.primaryAction, unitColor: EQColor.Execution.foregroundSecondaryText).focused($fieldFocused)
                EQMetricInput(value: $repetitions, label: exercise.isTimeBased ? "seconds" : "reps" + (progression?.rationale == .addRepetitions ? " ↑" : ""), accessibilityLabel: exercise.isTimeBased ? "Seconds" : "Repetitions", keyboard: .numberPad, valueColor: EQColor.Execution.primaryAction, unitColor: EQColor.Execution.foregroundSecondaryText).focused($fieldFocused)
            }
        }
        .preference(
            key: ExecutionPrimaryActionPreferenceKey.self,
            value: ExecutionPrimaryAction(
                title: exercise.isTimeBased ? "Start Timer" : "Log first set",
                accessibilityHint: "Saves this set immediately",
                perform: commit
            )
        )
    }

    private func commit() {
        fieldFocused = false
        guard let value = Int(repetitions), value > 0 else { return }
        Task {
            await log(exercise.isTimeBased
                ? .duration(weight: WeightText.weight(from: weight, unit: weightUnit), seconds: TimeInterval(value))
                : .repetitions(weight: WeightText.weight(from: weight, unit: weightUnit), repetitions: value))
        }
    }

}

private struct ExerciseListRow: View {
    let exercise: WorkoutExercise
    let state: ExerciseState
    let weightUnit: WeightUnit

    var body: some View {
        let presentation = ExerciseListRowPresentation.resolve(state: state)
        VStack(alignment: .leading, spacing: EQLayout.WorkoutExecution.titleToSetsSpacing) {
            HStack {
                Text(exercise.nameSnapshot)
                    .eqTextStyle(.listItemTitle)
                    .strikethrough(presentation.strikethrough)
                    .foregroundStyle(presentation.emphasis == .reduced ? EQColor.Execution.overviewSecondaryText : EQColor.Execution.overviewText)
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
                        .foregroundStyle(EQColor.Execution.overviewSecondaryText)
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
    @State private var weightText: String
    @State private var valueText: String
    @FocusState private var focusedField: Field?
    private enum Field { case weight, value }

    init(exercise: WorkoutExercise, prescription: SetPrescription, progression: ProgressionSuggestion?, selectedIndex: Int, isReadOnly: Bool, weightUnit: WeightUnit, log: @escaping (SetLogInput) async -> Void, startTimed: @escaping (SetLogInput) -> Void) {
        self.exercise = exercise; self.prescription = prescription; self.progression = progression; self.selectedIndex = selectedIndex; self.isReadOnly = isReadOnly; self.weightUnit = weightUnit; self.log = log; self.startTimed = startTimed
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
                EQMetricInput(value: $weightText, label: weightLabel, accessibilityLabel: "\(exercise.nameSnapshot), set \(selectedIndex + 1), weight", keyboard: .decimalPad, valueColor: EQColor.Execution.primaryAction, unitColor: EQColor.Execution.foregroundSecondaryText)
                    .focused($focusedField, equals: .weight)
                EQMetricInput(value: $valueText, label: progressedValueLabel, accessibilityLabel: "\(exercise.nameSnapshot), set \(selectedIndex + 1), \(valueLabel)", keyboard: .numberPad, valueColor: EQColor.Execution.primaryAction, unitColor: EQColor.Execution.foregroundSecondaryText)
                    .focused($focusedField, equals: .value)
            }
        }
        .preference(
            key: ExecutionPrimaryActionPreferenceKey.self,
            value: isReadOnly ? nil : ExecutionPrimaryAction(
                title: isLogged ? "Update set" : submission.buttonTitle,
                accessibilityHint: "Saves this set immediately",
                perform: commit
            )
        )
        .accessibilityElement(children: .contain)
    }

    private var isLogged: Bool { exercise.loggedSets.contains { $0.prescriptionID == prescription.id && $0.completedAt != nil } }
    private var valueLabel: String { if case .duration = prescription.target { return "seconds" }; return "reps" }
    private var weightLabel: String { (weightUnit == .pounds ? "lb" : "kg") + (progression?.rationale == .increaseWeight ? " ↑" : "") }
    private var progressedValueLabel: String { valueLabel + (progression?.rationale == .addRepetitions ? " ↑" : "") }
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

private struct ExerciseSettingsView: View {
    let exerciseID: WorkoutExerciseID
    let model: WorkoutExecutionModel
    @Environment(\.dismiss) private var dismiss
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @State private var timeBased: Bool
    @State private var twoSided: Bool
    @State private var editsRestDuration = false
    @State private var profile: AutoProgressionProfile = .none
    @State private var choices: [ExerciseDefinition] = []
    @State private var confirmsSkip = false
    @State private var confirmsRemove = false
    @State private var selectedDetent: PresentationDetent = .medium

    init(exerciseID: WorkoutExerciseID, model: WorkoutExecutionModel) {
        self.exerciseID = exerciseID
        self.model = model
        let exercise = model.exercise(id: exerciseID)
        _timeBased = State(initialValue: exercise?.isTimeBased ?? false)
        _twoSided = State(initialValue: exercise?.isTwoSided ?? false)
    }

    private var exercise: WorkoutExercise? { model.exercise(id: exerciseID) }

    var body: some View {
        NavigationStack {
            Group {
                if let exercise {
                    Form {
                        settingsHeader(exercise)
                        exerciseTypeSection
                        restDurationSection
                        progressionSection
                        replacementAndSkipSection(exercise)
                    }
                    .scrollContentBackground(.hidden)
                    .background(EQColor.Execution.foregroundSurface)
                    .foregroundStyle(EQColor.Execution.foregroundText)
                    .tint(EQColor.Execution.foregroundText)
                } else {
                    ContentUnavailableView("Exercise unavailable", systemImage: "exclamationmark.triangle")
                }
            }
            .navigationTitle(exercise == nil ? "Exercise Settings" : "")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        Task {
                            if await model.updateExerciseSettings(
                                exerciseID: exerciseID,
                                timeBased: timeBased,
                                twoSided: twoSided,
                                progression: profile
                            ) { dismiss() }
                        }
                    }
                    .disabled(exercise == nil)
                }
            }
        }
        .tint(EQColor.Execution.foregroundText)
        .presentationDetents([.medium, .large], selection: $selectedDetent)
        .presentationDragIndicator(.visible)
        .presentationBackground(EQColor.Execution.foregroundSurface)
        .presentationCornerRadius(EQRadius.sheet)
        .presentationCompactAdaptation(.sheet)
        .environment(\.colorScheme, .dark)
        .sheet(isPresented: $editsRestDuration) {
            RestDurationEditor(
                initialSeconds: model.effectiveRestDuration(for: exerciseID),
                guidance: "This custom duration applies to every set and future workout occurrence of this exercise. An active countdown is unchanged."
            ) { seconds in await model.setExerciseRestDuration(exerciseID: exerciseID, seconds: seconds) }
        }
        .accessibilityIdentifier("exercise-settings-sheet-\(exerciseID.rawValue)")
        .task(id: exercise?.exerciseID) {
            choices = await model.availableExercises()
            if let exercise { profile = await model.progressionProfile(for: exercise) }
        }
        .onAppear { expandForVeryLargeTypeIfNeeded() }
        .onChange(of: dynamicTypeSize) { _, _ in expandForVeryLargeTypeIfNeeded() }
        .alert("Skip exercise?", isPresented: $confirmsSkip) {
            Button("Cancel", role: .cancel) {}
            Button("Skip Exercise", role: .destructive) {
                Task { if await model.skipExercise(exerciseID) { dismiss() } }
            }
        } message: {
            Text("This exercise stays in the workout and history as skipped. It will not contribute to progression or personal records.")
        }
        .alert("Remove exercise?", isPresented: $confirmsRemove) {
            Button("Cancel", role: .cancel) {}
            Button("This workout only", role: .destructive) {
                Task { if await model.removeExercise(exerciseID) { dismiss() } }
            }
        } message: { Text("Remove this exercise from the current workout? Completed workout history is never changed.") }
    }

    private var exerciseTypeSection: some View {
        Section("Exercise Settings") {
            Toggle("Time-based exercise", isOn: $timeBased)
            Toggle("Two-sides exercise", isOn: $twoSided)
        }
        .listRowBackground(EQColor.Execution.foregroundSurface)
    }

    private func settingsHeader(_ exercise: WorkoutExercise) -> some View {
        Section {
            HStack(spacing: EQLayout.controlGap) {
                Text(exercise.nameSnapshot)
                    .eqTextStyle(.exerciseTitle)
                    .lineLimit(2)
                Spacer()
                Image(systemName: "chevron.down")
                    .eqTextStyle(.icon)
                    .accessibilityHidden(true)
            }
            .padding(.vertical, EQSpacing.xs)
        }
        .listRowBackground(EQColor.Execution.foregroundSurface)
    }

    private var restDurationSection: some View {
        Section {
            Button { editsRestDuration = true } label: {
                LabeledContent("Rest duration", value: restDurationValueText)
            }
            if model.exerciseRestDurationOverride(for: exerciseID) != nil {
                Button("Use default · \(globalRestDurationText)") {
                    Task { _ = await model.setExerciseRestDuration(exerciseID: exerciseID, seconds: nil) }
                }
            }
        } footer: {
            Text("Custom rest duration follows this exercise into future workouts and applies to all sets. Changes begin with the next rest.")
        }
        .listRowBackground(EQColor.Execution.foregroundSurface)
    }

    private var progressionSection: some View {
        Section("Auto Progression") {
            Picker("Auto Progression", selection: $profile) {
                ForEach(AutoProgressionProfile.allCases, id: \.self) { Text($0.title).tag($0) }
            }
        }
        .listRowBackground(EQColor.Execution.foregroundSurface)
    }

    private func replacementAndSkipSection(_ exercise: WorkoutExercise) -> some View {
        Section {
            Button("Skip Exercise", role: .destructive) { confirmsSkip = true }
                .foregroundStyle(EQColor.Execution.destructive)
                .accessibilityHint("Marks this occurrence skipped and returns to Exercise Overview")

            HStack(spacing: EQLayout.controlGap) {
                Menu {
                    ForEach(choices.filter { $0.id != exercise.exerciseID }) { definition in
                        Button(definition.name) {
                            Task { if await model.swapExercise(occurrenceID: exerciseID, with: definition) { dismiss() } }
                        }
                    }
                } label: {
                    Text("Swap")
                        .eqOutlinedControl(tint: EQColor.Execution.foregroundText)
                }
                .frame(maxWidth: .infinity)
                .accessibilityHint("Replaces this exercise in the current workout")

                Button { confirmsRemove = true } label: {
                    Text("Remove")
                        .eqOutlinedControl(tint: EQColor.Execution.foregroundText)
                }
                .buttonStyle(.plain)
                .frame(maxWidth: .infinity)
                .accessibilityHint("Permanently removes this occurrence from the current workout")
            }
        }
        .listRowBackground(EQColor.Execution.foregroundSurface)
    }

    private var restDurationValueText: String {
        guard let value = model.exerciseRestDurationOverride(for: exerciseID) else {
            return "Default · \(globalRestDurationText)"
        }
        return Self.durationText(value)
    }

    private var globalRestDurationText: String {
        Self.durationText(model.globalRestDuration)
    }

    private static func durationText(_ seconds: TimeInterval) -> String {
        String(format: "%d:%02d", Int(seconds) / 60, Int(seconds) % 60)
    }

    private func expandForVeryLargeTypeIfNeeded() {
        if dynamicTypeSize == .accessibility3 || dynamicTypeSize == .accessibility4 || dynamicTypeSize == .accessibility5 {
            selectedDetent = .large
        }
    }
}

private struct ExecutionTimerRegion: View {
    @Environment(\.timerVisibilityProgress) private var visibilityProgress
    let presentation: ExecutionTimerRegionPresentation
    let nextAction: String?
    let reduceMotion: Bool

    var body: some View {
        Group {
            if presentation.isVisible {
                GeometryReader { proxy in
                    let compactProgress = ExecutionTimerResponsiveLayout.compactProgress(
                        for: proxy.size.height
                    )
                    ExecutionTimerResponsiveLayout(
                        compactProgress: compactProgress,
                        hasPrimaryContext: primaryContext != nil,
                        hasSecondaryContext: secondaryContext != nil
                    ) {
                        HStack(spacing: EQLayout.controlGap) {
                            Text(title)
                                .eqTextStyle(.sectionLabel)
                                .foregroundStyle(tint)
                            if let sideIndicator {
                                Text(sideIndicator)
                                    .eqTextStyle(.sectionLabel)
                                    .foregroundStyle(tint)
                                    .padding(.horizontal, EQSpacing.sm * (1 - compactProgress))
                                    .padding(.vertical, EQSpacing.xxs * (1 - compactProgress))
                                    .background(
                                        tint.opacity(0.14 * Double(1 - compactProgress)),
                                        in: Capsule()
                                    )
                                    .accessibilityLabel(sideIndicator.lowercased())
                            }
                        }

                        Text(durationText)
                            .eqTextStyle(.timerMetric(size: timerMetricSize(compactProgress: compactProgress)))
                            .monospacedDigit()
                            .contentTransition(reduceMotion ? .opacity : .numericText())
                            .lineLimit(1)
                            .minimumScaleFactor(0.6)
                            .accessibilityLabel("\(title) time remaining, \(durationText)")

                        Text(primaryContext ?? "")
                            .eqTextStyle(.body)
                            .foregroundStyle(timerText.opacity(0.65))
                            .lineLimit(2)
                            .opacity(primaryContext == nil ? 0 : 1)
                            .accessibilityHidden(primaryContext == nil)

                        Text(secondaryContext ?? "")
                            .eqTextStyle(.caption)
                            .foregroundStyle(timerText.opacity(0.65))
                            .lineLimit(2)
                            .opacity(secondaryContext == nil ? 0 : Double(1 - compactProgress))
                            .accessibilityHidden(secondaryContext == nil || compactProgress > 0.5)

                        ProgressView(value: totalDuration - remaining, total: totalDuration)
                            .tint(tint)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                }
                .transition(.identity)
            } else {
                Color.clear
                    .frame(height: 0)
                    .transition(.identity)
            }
        }
        .foregroundStyle(timerText)
        .background(timerBackground)
        .allowsHitTesting(visibilityProgress > 0.99)
        .accessibilityHidden(visibilityProgress < 0.99)
        .accessibilityIdentifier("execution-timer-region")
    }

    private var title: String {
        switch presentation {
        case .hidden: return ""
        case .work(let state, _): return workPhaseLabel(state.phase)
        case .rest: return "REST"
        }
    }

    private var primaryContext: String? {
        switch presentation {
        case .hidden: return nil
        case .work(let state, _): return state.exerciseName
        case .rest: return nextAction.map { "Up next · \($0)" }
        }
    }

    private var secondaryContext: String? {
        switch presentation {
        case .hidden: return nil
        case .work(let state, _): return "Set \(state.setNumber) of \(state.totalSets)"
        case .rest: return nil
        }
    }

    private var sideIndicator: String? {
        guard case .work(let state, _) = presentation, state.isTwoSided else { return nil }
        switch state.phase {
        case .ready: return "2 SIDES"
        case .firstSide: return "SIDE 1 OF 2"
        case .switchSides: return "NEXT · SIDE 2"
        case .secondSide: return "SIDE 2 OF 2"
        }
    }

    private var tint: Color {
        switch presentation {
        case .hidden: return EQColor.Execution.progressAccent
        case .work(let state, _): return state.phase == .switchSides ? EQColor.Execution.primaryAction : EQColor.Execution.progressAccent
        case .rest: return EQColor.Execution.timerText
        }
    }

    private var timerText: Color {
        EQColor.Execution.timerText
    }

    private var timerBackground: Color {
        if case .rest = presentation { return EQColor.Execution.restCanvas }
        return EQColor.Execution.canvas
    }

    private var totalDuration: TimeInterval {
        switch presentation {
        case .hidden: return 1
        case .work(let state, _): return state.totalDuration
        case .rest(let state): return state.totalDuration
        }
    }

    private var remaining: TimeInterval {
        switch presentation {
        case .hidden: return 0
        case .work(let state, _): return state.remaining
        case .rest(let state): return state.remaining
        }
    }

    private func timerMetricSize(compactProgress: CGFloat) -> CGFloat {
        let compact = EQLayout.WorkoutExecution.compactTimerMetricSize
        let expanded = EQLayout.WorkoutExecution.expandedTimerMetricSize
        return expanded + ((compact - expanded) * compactProgress)
    }

    // Phase 6B can layer the recovery visual around this shared timer region.
    private var durationText: String { ExecutionTimerFormatting.durationText(for: remaining) }

    private func workPhaseLabel(_ phase: WorkoutWorkTimerPhase) -> String {
        switch phase {
        case .ready: return "GET READY"
        case .firstSide: return "WORK"
        case .switchSides: return "SWITCH SIDES"
        case .secondSide: return "WORK"
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
