import SwiftUI
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

enum ExecutionPrimaryActionLayout {
    static func footerHeight(
        isVisible: Bool,
        controlHeight: CGFloat,
        bottomInset: CGFloat
    ) -> CGFloat {
        guard isVisible else { return 0 }
        return controlHeight + bottomInset
    }

    static func scrollViewportHeight(cardHeight: CGFloat, headerHeight: CGFloat, footerHeight: CGFloat) -> CGFloat {
        max(0, cardHeight - headerHeight - footerHeight)
    }
}

enum ExecutionActionButtonMetrics {
    static let height: CGFloat = 48
    static let horizontalPadding = EQSpacing.lg
    static let minimumWidth = EQDimension.minimumTouch
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
        let focusedHeight = max(EQDimension.minimumTouch, walletHeight - focusedTop)
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

private struct ExecutionMotionTarget: Equatable {
    let foregroundState: ExecutionForegroundState
    let timerVisible: Bool
    let awaitsExerciseSelection: Bool
}

private struct ExecutionPerformancePresentation: Identifiable {
    let id: WorkoutExerciseID
    let exerciseID: ExerciseID
    let exerciseName: String
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
        foregroundState == .exercise ? mode : .focusedExercise
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
        foregroundState == .exercise ? false : showFocusedExercise()
    }
    @discardableResult func synchronize(
        with foregroundState: ExecutionForegroundState,
        awaitsExerciseSelection: Bool
    ) -> Bool {
        if foregroundState != .exercise { return showFocusedExercise() }
        return awaitsExerciseSelection ? showExerciseOverview() : false
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
    @State private var exerciseSettingsPresentation = ExerciseSettingsPresentation()
    @State private var performancePresentation: ExecutionPerformancePresentation?
    @State private var walletPresentation = ExecutionWalletPresentation(initialMode: .exerciseOverview)
    @State private var foregroundFocusProgress: CGFloat = 0
    @State private var timerVisibilityProgress: CGFloat = 0
    @State private var displayedTimerPresentation: ExecutionTimerRegionPresentation = .hidden
    private let historyRepository: (any ExerciseHistoryRepository)?
    private let onExit: (() -> Void)?
    private let usesObjectSurface: Bool
    private let transitionSourceFrame: CGRect?
    private let reportWalletFrame: ((CGRect) -> Void)?
    private let haptics: any HapticsClient

    init(id: WorkoutID, initialWorkout: Workout? = nil, repository: any WorkoutRepository, historyRepository: (any ExerciseHistoryRepository)? = nil, progressionRepository: (any ProgressionRepository)? = nil, exerciseRepository: (any ExerciseRepository)? = nil, weightUnit: WeightUnit = .pounds, defaultRestDuration: TimeInterval = 90, restSessionStore: WorkoutRestSessionStore? = nil, transitionSourceFrame: CGRect? = nil, reportWalletFrame: ((CGRect) -> Void)? = nil, haptics: (any HapticsClient)? = nil, didPersist: @escaping (Workout) -> Void = { _ in }, onExit: (() -> Void)? = nil, usesObjectSurface: Bool = false) {
        let resolvedHaptics = haptics ?? SystemHapticsClient()
        self.historyRepository = historyRepository ?? (repository as? SwiftDataRepository)
        self.onExit = onExit
        self.usesObjectSurface = usesObjectSurface
        self.transitionSourceFrame = transitionSourceFrame
        self.reportWalletFrame = reportWalletFrame
        self.haptics = resolvedHaptics
        _model = State(initialValue: WorkoutExecutionModel(workoutID: id, initialWorkout: initialWorkout, repository: repository, historyRepository: historyRepository ?? (repository as? SwiftDataRepository), progressionRepository: progressionRepository ?? (repository as? SwiftDataRepository), exerciseRepository: exerciseRepository ?? (repository as? SwiftDataRepository), weightUnit: weightUnit, defaultRestDuration: defaultRestDuration, restSessionStore: restSessionStore, haptics: resolvedHaptics, audio: SystemAudioFeedbackClient(), didPersist: didPersist))
    }

    var body: some View {
        ZStack {
            if !usesObjectSurface { EQColor.canvas.ignoresSafeArea() }
            if let workout = model.workout {
                content(workout)
            } else if let error = model.errorMessage {
                ContentUnavailableView("Workout unavailable", systemImage: "exclamationmark.triangle", description: Text(error))
            } else {
                ProgressView("Loading workout")
            }
        }
        .foregroundStyle(EQColor.primaryText)
        .navigationBarBackButtonHidden()
        .task { await model.activate() }
        .onReceive(NotificationCenter.default.publisher(for: .equilibriumRepositoryDidChange)) { _ in Task { await model.refreshFromPersistence() } }
        .onChange(of: scenePhase) { _, phase in if phase == .active { model.refreshRest() } }
        .onChange(of: executionMotionTarget) { _, target in
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
        .sheet(isPresented: $editsRestDuration) {
            RestDurationEditor(initialSeconds: model.configuredRestDuration) { seconds in await model.setRestDuration(seconds) }
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
            }
        }
    }

    private func workoutHeader(_ workout: Workout) -> some View {
        HStack(spacing: EQSpacing.sm) {
            Button(action: requestExit) {
                HStack(spacing: EQSpacing.xs) {
                    Image(systemName: "chevron.left")
                        .opacity(executionChromeProgress)
                        .offset(y: executionHeaderOffset)
                    Text(workout.titleSnapshot)
                        .font(EQTypography.cardTitle)
                        .lineLimit(1)
                        .hidden()
                        .anchorPreference(key: HomeWorkoutTitleAnchorKey.self, value: .bounds) {
                            [.destination(workout.id): $0]
                        }
                }
                .frame(minHeight: EQDimension.minimumTouch)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("execution-back-\(workout.id.rawValue)")
            .accessibilityLabel("Back to Home, \(workout.titleSnapshot)")
            .accessibilityHint("Returns this workout to its card on Home")

            Spacer(minLength: EQSpacing.sm)

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
                    Image(systemName: "ellipsis")
                        .frame(width: EQDimension.minimumTouch, height: EQDimension.minimumTouch, alignment: .trailing)
                        .contentShape(Rectangle())
                }
                .accessibilityLabel("Workout options")
                .accessibilityHint("Contains available workout actions")
                .opacity(executionChromeProgress)
                .offset(y: executionHeaderOffset)
            }
        }
        .padding(.horizontal, EQSpacing.lg)
        .frame(maxWidth: .infinity, minHeight: EQDimension.minimumTouch + EQSpacing.sm)
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
                    .font(EQTypography.caption)
                    .foregroundStyle(EQColor.warning)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, EQSpacing.md)
                    .padding(.vertical, EQSpacing.xs)
                    .background(EQColor.canvas)
                    .transition(.opacity)
            }
            GeometryReader { proxy in
                let timerProgress = min(max(timerVisibilityProgress, 0), 1)
                let compactWalletHeight = min(timerWalletHeight, proxy.size.height)
                let walletHeight = proxy.size.height
                    + ((compactWalletHeight - proxy.size.height) * timerProgress)
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
                        showsForegroundExercise: surfacePresentation.showsForegroundExercise && model.currentExercise != nil,
                        reduceMotion: reduceMotion,
                        transitionSourceFrame: transitionSourceFrame,
                        reportFrame: reportWalletFrame,
                        listRow: { exercise, state in
                            ExerciseListRow(exercise: exercise, state: state, weightUnit: model.weightUnit)
                        },
                        selectExercise: { exercise in
                            guard workout.status == .inProgress else { return }
                            if performWalletTransition({
                                let changed = walletPresentation.selectExercise(exercise.id, focus: model.focus)
                                foregroundFocusProgress = 1
                                return changed
                            }) {
                                haptics.perform(.selection)
                            }
                        },
                        showOverview: showExerciseOverview,
                        showSettings: { presentExerciseSettings(for: $0) },
                        showFocused: showFocusedExercise,
                        skipRest: model.skipRest,
                        skipWork: model.skipWorkTimer,
                        pauseResumeWork: model.toggleWorkTimerPause,
                        foregroundHeader: foregroundExerciseHeader,
                        foregroundContent: foregroundExerciseContent
                    )
                    .frame(height: walletHeight)
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
        EQDimension.restCardHeight + EQDimension.minimumTouch
    }

    private var executionChromeProgress: Double {
        Double(HomeExecutionReveal.progress(homeTransitionProgress, from: 0.55, through: 0.80))
    }

    private var executionHeaderOffset: CGFloat {
        guard !reduceMotion else { return 0 }
        return -(1 - CGFloat(executionChromeProgress)) * EQSpacing.md
    }

    @ViewBuilder private func foregroundExerciseHeader(focusProgress: CGFloat) -> some View {
        let isResting = model.restState != nil
        let isWorking = model.workTimerState != nil
        let isTiming = isResting || isWorking
        let progress = min(max(focusProgress, 0), 1)
        let secondaryProgress = min(max((progress - 0.18) / 0.82, 0), 1)
        let headerControlsOpacity = isTiming ? 0 : Double(secondaryProgress)
        Text("IN PROGRESS")
            .font(EQTypography.caption.weight(.bold))
            .frame(maxWidth: .infinity, minHeight: EQDimension.minimumTouch, alignment: .leading)
            .accessibilityIdentifier("execution-current-state-label-\(model.workoutID.rawValue)")
            .overlay(alignment: .trailing) {
                ZStack(alignment: .trailing) {
                    Image(systemName: "chevron.up")
                        .foregroundStyle(EQColor.accent)
                        .accessibilityHidden(true)
                        .opacity(isTiming ? 0 : 1 - secondaryProgress)
                    HStack(spacing: 0) {
                        if let exercise = foregroundExercise, historyRepository != nil {
                            Button {
                                performancePresentation = .init(
                                    id: exercise.id,
                                    exerciseID: exercise.exerciseID,
                                    exerciseName: exercise.nameSnapshot
                                )
                            } label: {
                                Image(systemName: "chart.xyaxis.line")
                                    .frame(width: EQDimension.minimumTouch, height: EQDimension.minimumTouch)
                                    .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel("Previous performance")
                            .accessibilityHint("Shows completed working sets, trend, and personal record")
                        }
                        if let exercise = foregroundExercise, !model.isReadOnly {
                            Button { presentExerciseSettings(for: exercise) } label: {
                                Image(systemName: "gearshape")
                                    .frame(width: EQDimension.minimumTouch, height: EQDimension.minimumTouch, alignment: .trailing)
                                    .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
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

    @ViewBuilder private func foregroundExerciseContent(focusProgress: CGFloat) -> some View {
        let isTiming = model.restState != nil || model.workTimerState != nil
        let progress = min(max(focusProgress, 0), 1)
        let secondaryProgress = min(max((progress - 0.18) / 0.82, 0), 1)
        let contentSpacing = isTiming
            ? EQSpacing.xs
            : EQSpacing.xs + ((EQSpacing.md - EQSpacing.xs) * progress)
        VStack(alignment: .leading, spacing: contentSpacing) {
            if let exerciseName = foregroundExerciseName {
                Text(exerciseName)
                    .font(EQTypography.exerciseTitle)
                    .lineLimit(2)
                    .contentTransition(.identity)
                    .accessibilityIdentifier("execution-current-exercise-name-\(foregroundExerciseID?.rawValue ?? model.workoutID.rawValue)")

                if !isTiming && !model.awaitsExerciseSelection {
                    Spacer(minLength: EQSpacing.lg)
                    expandedExerciseControls
                        .opacity(Double(secondaryProgress))
                        .allowsHitTesting(secondaryProgress > 0.99)
                        .accessibilityHidden(secondaryProgress < 0.99)
                        .transition(.identity)
                }
            } else {
                Text("No active exercise")
                    .font(EQTypography.exerciseTitle)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
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
        model.restState?.exerciseName ?? model.workTimerState?.exerciseName ?? model.currentExercise?.nameSnapshot
    }

    private var foregroundExerciseID: WorkoutExerciseID? {
        model.restState?.exerciseID ?? model.workTimerState?.exerciseID ?? model.currentExercise?.id
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
                    select: model.selectSet,
                    log: { input in await model.log(exerciseID: exercise.id, prescriptionID: prescription.id, input: input) },
                    startTimed: { input in model.startWorkTimer(exerciseID: exercise.id, prescriptionID: prescription.id, input: input) },
                    canEditSetCount: model.workTimerState == nil && model.restState == nil,
                    editSetCount: { setCountEditorExerciseID = exercise.id }
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
                    },
                    canEditSetCount: model.workTimerState == nil && model.restState == nil,
                    editSetCount: { setCountEditorExerciseID = exercise.id }
                )
            } else {
                Text("Every required set is logged.").font(EQTypography.sectionTitle)
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
              model.exercise(id: exercise.id) != nil else { return }
        exerciseSettingsPresentation.present(exerciseID: exercise.id)
    }

    private func showExerciseOverview() {
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
            awaitsExerciseSelection: model.awaitsExerciseSelection
        )
    }

    private func synchronizeMotion(to target: ExecutionMotionTarget) {
        _ = performWalletTransition {
            let modeChanged = walletPresentation.synchronize(
                with: target.foregroundState,
                awaitsExerciseSelection: target.awaitsExerciseSelection
            )
            let focusTarget: CGFloat = walletPresentation.resolvedMode(for: target.foregroundState) == .focusedExercise ? 1 : 0
            let timerTarget: CGFloat = target.timerVisible ? 1 : 0
            let progressChanged = foregroundFocusProgress != focusTarget || timerVisibilityProgress != timerTarget
            foregroundFocusProgress = focusTarget
            timerVisibilityProgress = timerTarget
            return modeChanged || progressChanged
        }
    }

    @discardableResult private func performWalletTransition(_ change: () -> Bool) -> Bool {
        guard !reduceMotion else { return change() }
        var changed = false
        withAnimation(EQMotion.objectTransformation) { changed = change() }
        return changed
    }

}

private struct ExecutionWallet<ListRow: View, ForegroundHeader: View, ForegroundContent: View>: View {
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @Environment(\.homeExecutionTransitionProgress) private var homeTransitionProgress
    @Environment(\.foregroundFocusProgress) private var focusProgress
    let workout: Workout
    let model: WorkoutExecutionModel
    let presentation: ExecutionWalletPresentation
    let visualState: ExecutionWalletVisualState
    let foregroundState: ExecutionForegroundState
    let showsForegroundExercise: Bool
    let reduceMotion: Bool
    let transitionSourceFrame: CGRect?
    let reportFrame: ((CGRect) -> Void)?
    let listRow: (WorkoutExercise, ExerciseState) -> ListRow
    let selectExercise: (WorkoutExercise) -> Void
    let showOverview: () -> Void
    let showSettings: (WorkoutExercise) -> Void
    let showFocused: () -> Void
    let skipRest: () -> Void
    let skipWork: () -> Void
    let pauseResumeWork: () -> Void
    let foregroundHeader: (CGFloat) -> ForegroundHeader
    let foregroundContent: (CGFloat) -> ForegroundContent

    var body: some View {
        GeometryReader { proxy in
            let headerHeight = dynamicTypeSize.isAccessibilitySize
                ? EQDimension.minimumTouch + (EQSpacing.xl * 2)
                : EQDimension.minimumTouch + EQSpacing.md
            let compactHeight = dynamicTypeSize.isAccessibilitySize ? EQDimension.restCardHeight : EQDimension.exerciseCompactCardHeight
            let destinationHeight = max(0, proxy.size.height - EQSpacing.xs)
            let destinationWidth = max(0, proxy.size.width - (EQSpacing.xs * 2))
            let containerFrame = proxy.frame(in: .global)
            let measuredDestinationFrame = CGRect(
                x: containerFrame.minX + EQSpacing.xs,
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
            let focusedTop = max(0, headerHeight - EQSpacing.xs)
            let progress = showsForegroundExercise ? min(max(focusProgress, 0), 1) : 0
            let foregroundLayout = ExecutionWalletSurfaceLayout.resolve(
                walletHeight: walletHeight,
                focusedTop: focusedTop,
                compactHeight: compactHeight,
                focusProgress: progress
            )
            let compactArrival = HomeExecutionReveal.progress(homeTransitionProgress, from: 0.78, through: 0.96)
            let compactEntranceOffset = (1 - compactArrival) * (compactHeight + EQSpacing.md)
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
                            .contentShape(RoundedRectangle(cornerRadius: EQRadius.transformingCard, style: .continuous))
                            .offset(y: foregroundLayout.top + compactEntranceOffset)
                            .zIndex(1)
                            .accessibilityIdentifier("execution-current-exercise-card-\(workout.id.rawValue)")
                    }
                }
                .frame(width: walletWidth, height: walletHeight)
                .modifier(ExecutionWalletShapeModifier())
                .position(x: currentFrame.midX, y: currentFrame.midY)
            }
            .frame(width: proxy.size.width, height: proxy.size.height, alignment: .topLeading)
        }
        .onGeometryChange(for: CGRect.self) { proxy in
            let frame = proxy.frame(in: .global)
            return CGRect(
                x: frame.minX + EQSpacing.xs,
                y: frame.minY,
                width: max(0, frame.width - (EQSpacing.xs * 2)),
                height: max(0, frame.height - EQSpacing.xs)
            )
        } action: { frame in
            reportFrame?(frame)
        }
        .id("execution-wallet-\(workout.id.rawValue)")
        .allowsHitTesting(homeTransitionProgress > 0.99)
    }

    private var walletSurface: some View {
        let shape = RoundedRectangle(cornerRadius: EQRadius.transformingCard, style: .continuous)
        return shape
            .fill(EQColor.surface)
    }

    private func exerciseListCard(compactHeight: CGFloat) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            exerciseListHeader
                .accessibilityIdentifier("execution-exercises-header-\(workout.id.rawValue)")
                .padding(.horizontal, EQSpacing.lg)
                .padding(.top, EQSpacing.xxs)
                .padding(.bottom, EQSpacing.lg)
                .background(EQColor.surface)
                .opacity(headerRevealOpacity)
                .offset(y: revealOffset(for: headerRevealProgress))
                .zIndex(2)

            ScrollView {
                LazyVStack(alignment: .leading, spacing: EQSpacing.lg) {
                    if model.isReadOnly {
                        Text("Completed · Read-only")
                            .font(EQTypography.caption)
                            .foregroundStyle(EQColor.success)
                            .modifier(WalletRevealModifier(progress: rowRevealProgress(index: 0)))
                    }
                    ForEach(Array(remainingExercises.enumerated()), id: \.element.id) { index, exercise in
                        exerciseButton(exercise)
                            .modifier(WalletRevealModifier(progress: rowRevealProgress(index: index)))
                    }
                    if !completedExercises.isEmpty {
                        if workout.status != .completed {
                            HStack(spacing: EQSpacing.sm) {
                                Text("COMPLETED")
                                    .font(EQTypography.caption.weight(.bold))
                                    .foregroundStyle(EQColor.secondaryText)
                                Rectangle().fill(EQColor.separator).frame(height: 1)
                            }
                            .padding(.top, remainingExercises.isEmpty ? 0 : 40 - EQSpacing.lg)
                            .modifier(WalletRevealModifier(progress: completedSectionRevealProgress))
                        }
                        ForEach(Array(completedExercises.enumerated()), id: \.element.id) { index, exercise in
                            exerciseButton(exercise)
                                .modifier(WalletRevealModifier(progress: completedRowRevealProgress(index: index)))
                        }
                    }
                }
                .padding(EQSpacing.lg)
                .padding(.bottom, showsForegroundExercise ? compactHeight + EQSpacing.lg : EQSpacing.lg)
            }
            .scrollIndicators(.hidden)
            .scrollDisabled(showsForegroundExercise && focusProgress > 0.01)
            .clipped()
            .accessibilityHidden(visualState != .exerciseOverview || focusProgress > 0.01)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
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

    private func revealOffset(for progress: CGFloat) -> CGFloat {
        reduceMotion ? 0 : (1 - progress) * EQSpacing.sm
    }

    private var exerciseListHeader: some View {
        let canShowOverview = showsForegroundExercise
            && (visualState == .focusedExercise || visualState == .exerciseOverview)
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
        HStack(spacing: EQSpacing.sm) {
            Text("EXERCISES").font(EQTypography.caption.weight(.bold))
            Spacer()
            if presentation.mode == .exerciseOverview {
                Text(model.progress.fraction, format: .percent.precision(.fractionLength(0)))
                    .font(EQTypography.caption.weight(.bold))
                    .monospacedDigit()
            }
            exerciseProgressCircle
        }
        .frame(maxWidth: .infinity, minHeight: EQDimension.minimumTouch, alignment: .leading)
        .contentShape(Rectangle())
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Exercises")
        .accessibilityValue(Text(model.progress.fraction, format: .percent.precision(.fractionLength(0))))
    }

    private var exerciseProgressCircle: some View {
        let fraction = min(max(model.progress.fraction, 0), 1)
        return ZStack {
            Circle()
                .stroke(EQColor.secondaryText.opacity(0.3), lineWidth: 3)
            Circle()
                .trim(from: 0, to: fraction)
                .stroke(EQColor.accent, style: StrokeStyle(lineWidth: 3, lineCap: .round))
                .rotationEffect(.degrees(-90))
        }
        .frame(width: 16, height: 16)
        .accessibilityHidden(true)
    }

    private var remainingExercises: [WorkoutExercise] {
        workout.exercises.filter { !WorkoutExecutionQuery.isComplete($0) }
    }

    private var completedExercises: [WorkoutExercise] {
        workout.exercises.filter(WorkoutExecutionQuery.isComplete)
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
                .accessibilityHint("Makes this the active exercise without changing workout order")
                .contextMenu {
                    Button("Exercise Settings", systemImage: "gearshape") { showSettings(exercise) }
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
        let actionHeight = ExecutionActionButtonMetrics.height
        let actionFooterHeight = ExecutionPrimaryActionLayout.footerHeight(
            isVisible: true,
            controlHeight: actionHeight,
            bottomInset: EQSpacing.sm
        )
        let hasExerciseAction = foregroundState == .exercise
            && !model.isReadOnly
            && !model.awaitsExerciseSelection
        let naturalFooterHeight = isTiming || hasExerciseAction ? actionFooterHeight : 0
        let footerHeight = naturalFooterHeight * (isTiming ? 1 : progress)
        let headerHeight = EQSpacing.xxs + EQDimension.minimumTouch

        return GeometryReader { proxy in
            let contentHeight = ExecutionPrimaryActionLayout.scrollViewportHeight(
                cardHeight: proxy.size.height,
                headerHeight: headerHeight,
                footerHeight: footerHeight
            )
            VStack(alignment: .leading, spacing: 0) {
                foregroundHeader(progress)
                    .padding(.horizontal, EQSpacing.lg)
                    .padding(.top, EQSpacing.xxs)
                    .background(EQColor.surface)
                    .zIndex(2)

                ScrollView {
                    foregroundContent(progress)
                        .padding(.horizontal, EQSpacing.lg)
                        .padding(.top, EQSpacing.xxs)
                        .padding(.bottom, EQSpacing.lg)
                        .frame(minHeight: contentHeight, alignment: .top)
                        .opacity(compactContentRevealOpacity)
                        .offset(y: revealOffset(for: compactContentRevealProgress))
                }
                .frame(height: contentHeight)
                .scrollDisabled(!isFocused)
                .scrollDismissesKeyboard(.interactively)
                .scrollIndicators(.hidden)
                .accessibilityElement(children: .contain)
                .accessibilityLabel("Current exercise")
                .accessibilityHint(isFocused ? "Focused exercise controls" : "Expands the current exercise")
                .accessibilityAddTraits(isFocused ? [] : .isButton)
                .accessibilityAction(named: "Expand current exercise") {
                    if !isFocused { showFocused() }
                }
                .onTapGesture {
                    if !isFocused { showFocused() }
                }
                .clipped()
            }
            .frame(width: proxy.size.width, height: proxy.size.height, alignment: .topLeading)
            .overlayPreferenceValue(ExecutionPrimaryActionPreferenceKey.self) { primaryAction in
                pinnedPrimaryAction(
                    primaryAction,
                    progress: progress,
                    isTiming: isTiming,
                    isWorking: isWorking,
                    footerHeight: footerHeight,
                    actionHeight: actionHeight
                )
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomLeading)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    private func pinnedPrimaryAction(
        _ primaryAction: ExecutionPrimaryAction?,
        progress: CGFloat,
        isTiming: Bool,
        isWorking: Bool,
        footerHeight: CGFloat,
        actionHeight: CGFloat
    ) -> some View {
        let isResting = visualState == .focusedRest
        let isAvailable = isTiming || primaryAction != nil
        let focusedReveal = min(max((progress - 0.18) / 0.82, 0), 1)
        let isInteractive = isAvailable && (isTiming || focusedReveal > 0.99)
        let title = isResting ? "Skip Rest" : (isWorking ? "Skip" : (primaryAction?.title ?? ""))
        let hint = isResting
            ? "Ends the current rest"
            : (isWorking ? "Skips the current work interval" : (primaryAction?.accessibilityHint ?? ""))

        return HStack(spacing: EQSpacing.sm) {
            Button {
                if isResting { skipRest() }
                else if isWorking { skipWork() }
                else { primaryAction?.perform() }
            } label: {
                Text(title)
                    .contentTransition(.opacity)
                    .lineLimit(1)
                    .fixedSize(horizontal: true, vertical: false)
                    .padding(.horizontal, ExecutionActionButtonMetrics.horizontalPadding)
                    .frame(minWidth: ExecutionActionButtonMetrics.minimumWidth)
                    .frame(height: actionHeight)
            }
            .buttonStyle(.borderedProminent)
            .buttonBorderShape(.roundedRectangle(radius: EQRadius.control))
            .tint(isResting ? EQColor.rest : EQColor.accent)
            .disabled(!isInteractive)
            .accessibilityHint(hint)
            .accessibilityIdentifier(ExecutionPrimaryActionIdentity(workoutID: workout.id).accessibilityIdentifier)
            .id(ExecutionPrimaryActionIdentity(workoutID: workout.id))

            if isWorking {
                Button(action: pauseResumeWork) {
                    Text(model.timer.state == .paused ? "Resume" : "Pause")
                        .contentTransition(.opacity)
                        .lineLimit(1)
                        .fixedSize(horizontal: true, vertical: false)
                        .padding(.horizontal, ExecutionActionButtonMetrics.horizontalPadding)
                        .frame(minWidth: ExecutionActionButtonMetrics.minimumWidth)
                        .frame(height: actionHeight)
                }
                .buttonStyle(.bordered)
                .buttonBorderShape(.roundedRectangle(radius: EQRadius.control))
                .tint(EQColor.accent)
                .disabled(model.workTimerState?.phase == .ready || !isInteractive)
                .accessibilityHint(model.timer.state == .paused ? "Resumes the work timer" : "Pauses the work timer")
            }
        }
        .opacity(isAvailable ? (isTiming ? 1 : Double(focusedReveal)) : 0)
        .allowsHitTesting(isInteractive)
        .accessibilityHidden(!isInteractive)
        .padding(.horizontal, EQSpacing.lg)
        .padding(.bottom, EQSpacing.sm)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomLeading)
        .frame(height: footerHeight, alignment: .bottomLeading)
    }

    private var foregroundBackground: some View {
        RoundedRectangle(cornerRadius: EQRadius.transformingCard, style: .continuous)
            .fill(EQColor.surface)
    }

    private var compactContentRevealProgress: CGFloat {
        HomeExecutionReveal.progress(homeTransitionProgress, from: 0.88, through: 1)
    }

    private var compactContentRevealOpacity: Double { Double(compactContentRevealProgress) }
}

private struct ExecutionWalletShapeModifier: ViewModifier {
    var drawsBorder = false

    @ViewBuilder func body(content: Content) -> some View {
        if #available(iOS 26.0, *) {
            let shape = ConcentricRectangle(
                uniformTopCorners: .fixed(EQRadius.transformingCard),
                uniformBottomCorners: .concentric(minimum: .fixed(EQRadius.transformingCard))
            )
            content
                .clipShape(shape)
                .overlay {
                    if drawsBorder {
                        shape.stroke(EQColor.canvas, lineWidth: 2)
                    }
                }
        } else {
            let shape = RoundedRectangle(cornerRadius: EQRadius.transformingCard, style: .continuous)
            content
                .clipShape(shape)
                .overlay {
                    if drawsBorder {
                        shape.stroke(EQColor.canvas, lineWidth: 2)
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
            .offset(y: reduceMotion ? 0 : (1 - progress) * EQSpacing.sm)
    }
}

private struct RestDurationEditor: View {
    @Environment(\.dismiss) private var dismiss
    @State private var seconds: Double
    let save: (TimeInterval) async -> Bool
    init(initialSeconds: TimeInterval, save: @escaping (TimeInterval) async -> Bool) {
        _seconds = State(initialValue: min(300, max(15, (initialSeconds / 5).rounded() * 5))); self.save = save
    }
    var body: some View {
        NavigationStack {
            Form {
                Section("Rest time") {
                    Text(durationText).font(EQTypography.metric).monospacedDigit()
                    Slider(value: $seconds, in: 15...300, step: 5).accessibilityValue(durationText)
                }
                Section { Text("Applies to subsequent rests for the active exercise. An active countdown is unchanged.").font(EQTypography.caption).foregroundStyle(EQColor.secondaryText) }
            }
            .scrollContentBackground(.hidden).background(EQColor.canvas).navigationTitle("Rest duration").navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) { Button("Save") { Task { if await save(seconds) { dismiss() } } } }
            }
        }.presentationDetents([.medium])
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
            VStack(alignment: .leading, spacing: EQSpacing.lg) {
                Text(exerciseName)
                    .font(EQTypography.sectionTitle)
                    .lineLimit(2)
                Text("\(count)")
                    .font(EQTypography.metric)
                    .monospacedDigit()
                    .contentTransition(.numericText())
                    .accessibilityHidden(true)
                Stepper(value: $count, in: minimumCount...20) {
                    Text(count == 1 ? "1 set" : "\(count) sets")
                        .font(EQTypography.body.weight(.semibold))
                }
                if minimumCount > 1 {
                    Text("\(minimumCount) completed sets will be kept.")
                        .font(EQTypography.caption)
                        .foregroundStyle(EQColor.secondaryText)
                }
                Spacer(minLength: 0)
            }
            .padding(EQSpacing.lg)
            .background(EQColor.canvas)
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
        .interactiveDismissDisabled(isSaving)
    }
}

private struct FirstSetView: View {
    let exercise: WorkoutExercise; let progression: ProgressionSuggestion?; let weightUnit: WeightUnit; let log: (SetLogInput) async -> Void; let canEditSetCount: Bool; let editSetCount: () -> Void
    @State private var weight: String
    @State private var repetitions: String
    @FocusState private var fieldFocused: Bool

    init(exercise: WorkoutExercise, progression: ProgressionSuggestion?, weightUnit: WeightUnit, log: @escaping (SetLogInput) async -> Void, canEditSetCount: Bool, editSetCount: @escaping () -> Void) {
        self.exercise = exercise
        self.progression = progression
        self.weightUnit = weightUnit
        self.log = log
        self.canEditSetCount = canEditSetCount
        self.editSetCount = editSetCount
        _weight = State(initialValue: WeightText.value(progression?.suggestedWeight, unit: weightUnit))
        _repetitions = State(initialValue: progression?.targetRepetitions.map { String($0.lowerBound) } ?? "")
    }
    var body: some View {
        VStack(alignment: .leading, spacing: EQSpacing.lg) {
            Text("No previous working sets").font(EQTypography.caption).foregroundStyle(EQColor.secondaryText)
            VStack(alignment: .leading, spacing: EQSpacing.md) {
                HeroValueField(value: $weight, label: (weightUnit == .pounds ? "lb" : "kg") + (progression?.rationale == .increaseWeight ? " ↑" : ""), accessibilityLabel: "Weight", keyboard: .decimalPad).focused($fieldFocused)
                HeroValueField(value: $repetitions, label: exercise.isTimeBased ? "seconds" : "reps" + (progression?.rationale == .addRepetitions ? " ↑" : ""), accessibilityLabel: exercise.isTimeBased ? "Seconds" : "Repetitions", keyboard: .numberPad).focused($fieldFocused)
            }
            HStack(spacing: EQSpacing.sm) {
                Spacer(minLength: 0)
                if canEditSetCount { setCountEditButton }
                Text("0 sets")
                    .font(EQTypography.caption.weight(.bold))
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
        .toolbar { ToolbarItemGroup(placement: .keyboard) { Spacer(); Button("Done") { fieldFocused = false } } }
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

    private var setCountEditButton: some View {
        Button(action: editSetCount) {
            Image(systemName: "pencil")
                .font(.system(size: 16, weight: .semibold))
                .frame(width: 16, height: 16)
                .frame(width: EQDimension.minimumTouch, height: EQDimension.minimumTouch)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Edit number of sets")
        .accessibilityHint("Adjusts the number of working sets for \(exercise.nameSnapshot)")
    }
}

private struct ExerciseListRow: View {
    let exercise: WorkoutExercise
    let state: ExerciseState
    let weightUnit: WeightUnit

    var body: some View {
        VStack(alignment: .leading, spacing: completedSets.isEmpty ? 0 : EQSpacing.md) {
            HStack {
                Text(exercise.nameSnapshot).font(EQTypography.cardTitle)
                Spacer()
                if state == .current {
                    Circle()
                        .fill(EQColor.accent)
                        .frame(width: EQSpacing.xs, height: EQSpacing.xs)
                        .accessibilityHidden(true)
                }
            }
            .frame(minHeight: completedSets.isEmpty ? EQDimension.minimumTouch : nil)

            if !completedSets.isEmpty {
                VStack(alignment: .leading, spacing: EQSpacing.xxs) {
                    ForEach(completedSets) { set in
                        HStack(alignment: .firstTextBaseline, spacing: EQSpacing.xs) {
                            Text("\(setNumber(for: set))")
                                .frame(width: EQSpacing.lg, alignment: .leading)
                            Text(summary(set))
                        }
                        .font(.system(size: 14))
                        .foregroundStyle(EQColor.secondaryText)
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .contentShape(Rectangle())
        .accessibilityValue(state == .current ? "In progress" : "")
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
    let select: (Int) -> Void
    let log: (SetLogInput) async -> Void
    let startTimed: (SetLogInput) -> Void
    let canEditSetCount: Bool
    let editSetCount: () -> Void
    @State private var weightText: String
    @State private var valueText: String
    @FocusState private var focusedField: Field?
    private enum Field { case weight, value }

    init(exercise: WorkoutExercise, prescription: SetPrescription, progression: ProgressionSuggestion?, selectedIndex: Int, isReadOnly: Bool, weightUnit: WeightUnit, select: @escaping (Int) -> Void, log: @escaping (SetLogInput) async -> Void, startTimed: @escaping (SetLogInput) -> Void, canEditSetCount: Bool, editSetCount: @escaping () -> Void) {
        self.exercise = exercise; self.prescription = prescription; self.progression = progression; self.selectedIndex = selectedIndex; self.isReadOnly = isReadOnly; self.weightUnit = weightUnit; self.select = select; self.log = log; self.startTimed = startTimed; self.canEditSetCount = canEditSetCount; self.editSetCount = editSetCount
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
        VStack(alignment: .leading, spacing: EQSpacing.lg) {
            VStack(alignment: .leading, spacing: EQSpacing.md) {
                HeroValueField(value: $weightText, label: weightLabel, accessibilityLabel: "\(exercise.nameSnapshot), set \(selectedIndex + 1), weight", keyboard: .decimalPad)
                    .focused($focusedField, equals: .weight)
                HeroValueField(value: $valueText, label: progressedValueLabel, accessibilityLabel: "\(exercise.nameSnapshot), set \(selectedIndex + 1), \(valueLabel)", keyboard: .numberPad)
                    .focused($focusedField, equals: .value)
            }
            if !isReadOnly {
                HStack(spacing: EQSpacing.sm) {
                    Spacer(minLength: 0)
                    if canEditSetCount { setCountEditButton }
                    setCounter
                }
            } else {
                setCounter
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
        .toolbar { ToolbarItemGroup(placement: .keyboard) { Spacer(); Button("Done") { focusedField = nil } } }
    }

    private var setCounter: some View {
        Menu {
            ForEach(exercise.prescriptions.indices, id: \.self) { index in
                let done = exercise.loggedSets.contains { $0.prescriptionID == exercise.prescriptions[index].id && $0.completedAt != nil }
                Button { select(index) } label: {
                    Text("Set \(index + 1)\(done ? " · Completed" : "")")
                }
            }
        } label: {
            Text("\(selectedIndex + 1)/\(exercise.prescriptions.count)")
                .font(EQTypography.caption.weight(.bold))
                .monospacedDigit()
                .frame(minWidth: EQDimension.minimumTouch, minHeight: EQDimension.minimumTouch, alignment: .trailing)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Set \(selectedIndex + 1) of \(exercise.prescriptions.count)")
        .accessibilityHint("Choose a set")
    }

    private var setCountEditButton: some View {
        Button(action: editSetCount) {
            Image(systemName: "pencil")
                .font(.system(size: 16, weight: .semibold))
                .frame(width: 16, height: 16)
                .frame(width: EQDimension.minimumTouch, height: EQDimension.minimumTouch)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Edit number of sets")
        .accessibilityHint("Adjusts the number of working sets for \(exercise.nameSnapshot)")
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
    @State private var profile: AutoProgressionProfile = .none
    @State private var choices: [ExerciseDefinition] = []
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
                        Section("Exercise Settings") {
                            Toggle("Time-based exercise", isOn: $timeBased)
                            Toggle("Two-sides exercise", isOn: $twoSided)
                        }
                        Section("Auto Progression") {
                            Picker("Auto Progression", selection: $profile) {
                                ForEach(AutoProgressionProfile.allCases, id: \.self) { Text($0.title).tag($0) }
                            }
                        }
                        Section {
                            Menu("Swap exercise") {
                                ForEach(choices.filter { $0.id != exercise.exerciseID }) { definition in
                                    Button(definition.name) {
                                        Task { if await model.swapExercise(occurrenceID: exerciseID, with: definition) { dismiss() } }
                                    }
                                }
                            }
                            .accessibilityHint("Replaces this exercise in the current workout")
                            Button("Remove exercise", role: .destructive) { confirmsRemove = true }
                                .accessibilityHint("Requires confirmation before removing this exercise")
                        }
                    }
                } else {
                    ContentUnavailableView("Exercise unavailable", systemImage: "exclamationmark.triangle")
                }
            }
            .navigationTitle(exercise?.nameSnapshot ?? "Exercise Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        Task {
                            if await model.updateExerciseSettings(exerciseID: exerciseID, timeBased: timeBased, twoSided: twoSided, progression: profile) { dismiss() }
                        }
                    }
                    .disabled(exercise == nil)
                }
            }
        }
        .presentationDetents([.medium, .large], selection: $selectedDetent)
        .presentationDragIndicator(.visible)
        .presentationCompactAdaptation(.sheet)
        .accessibilityIdentifier("exercise-settings-sheet-\(exerciseID.rawValue)")
        .task(id: exercise?.exerciseID) {
            choices = await model.availableExercises()
            if let exercise { profile = await model.progressionProfile(for: exercise) }
        }
        .onAppear { expandForVeryLargeTypeIfNeeded() }
        .onChange(of: dynamicTypeSize) { _, _ in expandForVeryLargeTypeIfNeeded() }
        .alert("Remove exercise?", isPresented: $confirmsRemove) {
            Button("Cancel", role: .cancel) {}
            Button("Remove", role: .destructive) {
                Task { if await model.removeExercise(exerciseID) { dismiss() } }
            }
        } message: { Text("Remove this exercise from this workout?") }
    }

    private func expandForVeryLargeTypeIfNeeded() {
        if dynamicTypeSize == .accessibility3 || dynamicTypeSize == .accessibility4 || dynamicTypeSize == .accessibility5 {
            selectedDetent = .large
        }
    }
}

private struct HeroValueField: View {
    @Binding var value: String
    let label: String
    let accessibilityLabel: String
    let keyboard: UIKeyboardType
    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: EQSpacing.xs) {
            TextField("0", text: $value).keyboardType(keyboard).font(EQTypography.metric).monospacedDigit()
                .textFieldStyle(.plain)
                .fixedSize(horizontal: true, vertical: false)
                .frame(minWidth: EQDimension.minimumTouch, alignment: .leading)
                .accessibilityLabel(accessibilityLabel)
            Text(label.lowercased())
                .font(EQTypography.metric)
                .foregroundStyle(EQColor.secondaryText)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
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
                immersiveContent
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                    .transition(.identity)
            } else {
                Color.clear
                    .frame(height: 0)
                    .transition(.identity)
            }
        }
        .background(EQColor.canvas)
        .overlay(alignment: .bottom) { Divider().overlay(EQColor.separator) }
        .opacity(visibilityProgress)
        .allowsHitTesting(visibilityProgress > 0.99)
        .accessibilityHidden(visibilityProgress < 0.99)
        .accessibilityIdentifier("execution-timer-region")
    }

    private var immersiveContent: some View {
        VStack(alignment: .leading, spacing: EQSpacing.md) {
            HStack(spacing: EQSpacing.sm) {
                Text(title)
                    .font(EQTypography.caption.weight(.bold))
                    .foregroundStyle(tint)
                    .contentTransition(.opacity)
                if let sideIndicator {
                    Text(sideIndicator)
                        .font(EQTypography.caption.weight(.bold))
                        .foregroundStyle(tint)
                        .padding(.horizontal, EQSpacing.sm)
                        .padding(.vertical, EQSpacing.xxs)
                        .background(tint.opacity(0.14), in: Capsule())
                        .contentTransition(.opacity)
                        .accessibilityLabel(sideIndicator.lowercased())
            }
                Spacer(minLength: 0)
            }
            Spacer(minLength: EQSpacing.lg)
            Text(durationText)
                .font(.system(size: 84, weight: .bold, design: .rounded))
                .monospacedDigit()
                .contentTransition(reduceMotion ? .opacity : .numericText())
                .lineLimit(1)
                .minimumScaleFactor(0.6)
                .accessibilityLabel("\(title) time remaining, \(durationText)")
            Spacer(minLength: EQSpacing.lg)
            VStack(alignment: .leading, spacing: EQSpacing.xxs) {
                if let primaryContext {
                    Text(primaryContext)
                        .font(EQTypography.body.weight(.semibold))
                        .foregroundStyle(EQColor.secondaryText)
                        .lineLimit(2)
                        .contentTransition(.opacity)
                }
                if let secondaryContext {
                    Text(secondaryContext)
                        .font(EQTypography.caption)
                        .foregroundStyle(EQColor.secondaryText)
                        .lineLimit(2)
                        .contentTransition(.opacity)
                }
            }
            ProgressView(value: totalDuration - remaining, total: totalDuration)
                .tint(tint)
        }
        .padding(.horizontal, EQSpacing.lg)
        .padding(.vertical, EQSpacing.xl)
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
        case .hidden: return EQColor.accent
        case .work(let state, _): return state.phase == .switchSides ? EQColor.rest : EQColor.accent
        case .rest: return EQColor.rest
        }
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
