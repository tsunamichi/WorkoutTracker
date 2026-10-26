import Foundation
import SwiftUI
#if DEBUG
import OSLog

private let homeMenuDiagnostics = Logger(
    subsystem: "com.tsunamichi.equilibrium",
    category: "HomeActionMenu"
)
#endif

struct HomeView: View {
    @State private var model: HomeModel
    private let repository: any WorkoutRepository
    private let exerciseRepository: any ExerciseRepository
    private let historyRepository: any ExerciseHistoryRepository
    private let settingsRepository: any SettingsRepository
    private let progressionRepository: any ProgressionRepository
    @State private var appSettings = AppSettings(weightUnit: .pounds, defaultRestDuration: 90)
    @State private var timerPath: [TimerRoute] = []
    @State private var timerNavigationTransitionIsActive = false
    @State private var presentedHomeOverlay: HomeOverlayDestination?
    @State private var homeOverlayTransitionIsActive = false
    @State private var restSessionStore = WorkoutRestSessionStore()
    @State private var homeExecutionProgress: CGFloat = 0
    @State private var transitioningWorkoutID: WorkoutID?
    @State private var executionHeaderWorkTint: Double = 0
    @State private var executionContextualMenuIsPresented = false
    @State private var workoutCardFrames: [WorkoutID: CGRect] = [:]
    @State private var transitionSourceFrame: CGRect?
    @State private var transitionDestinationFrame: CGRect?
    @State private var homeActionMenuIsPresented = false
    @State private var executionSettingsBackdropProgress: CGFloat = 0
    @State private var executionSettingsPresentation = ExecutionSettingsPresentationBridge()
    private let timerStore: any StandaloneTimerConfigurationStore
    private let legacyImporter: RNLegacyImporter?
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.scenePhase) private var scenePhase

    init(repository: any WorkoutRepository, exerciseRepository: (any ExerciseRepository)? = nil, historyRepository: (any ExerciseHistoryRepository)? = nil, settingsRepository: (any SettingsRepository)? = nil, progressionRepository: (any ProgressionRepository)? = nil, timerStore: (any StandaloneTimerConfigurationStore)? = nil) {
        self.repository = repository
        self.timerStore = timerStore ?? (repository as? SwiftDataRepository).map { SwiftDataStandaloneTimerStore(repository: $0) } ?? UserDefaultsStandaloneTimerStore()
        self.legacyImporter = (repository as? SwiftDataRepository).map(RNLegacyImporter.init(repository:))
        guard let shared = repository as? SwiftDataRepository else {
            precondition(exerciseRepository != nil && historyRepository != nil && settingsRepository != nil && progressionRepository != nil, "Feature repositories are required")
            self.exerciseRepository = exerciseRepository!; self.historyRepository = historyRepository!
            self.settingsRepository = settingsRepository!; self.progressionRepository = progressionRepository!
            _model = State(initialValue: HomeModel(repository: repository)); return
        }
        self.exerciseRepository = exerciseRepository ?? shared; self.historyRepository = historyRepository ?? shared
        self.settingsRepository = settingsRepository ?? shared; self.progressionRepository = progressionRepository ?? shared
        _model = State(initialValue: HomeModel(repository: repository))
    }

    var body: some View {
        @Bindable var model = model
        ContextualActionMenu(
            isPresented: $homeActionMenuIsPresented,
            actions: homeActionMenuActions,
            configuration: ContextualActionMenuConfiguration(
                direction: .upward,
                alignment: .trailing,
                actionSpacing: EQSpacing.sm
            ),
            presentedTrigger: { isPresented in
                HomeAddWorkoutMenuTrigger(isMenuPresented: isPresented)
                    .accessibilityLabel("Close add workout menu")
                    .accessibilityHint("Closes the action menu")
            }
        ) {
            HomeTimerContainer(
                primarySurface: $model.primarySurface,
                reduceMotion: reduceMotion,
                clipsToBounds: transitioningWorkoutID == nil
                    && !homeOverlayOwnsSurface
                    && timerPath.isEmpty
                    && !timerNavigationTransitionIsActive,
                allowsSurfacePull: transitioningWorkoutID == nil
                    && model.expandedWorkoutID == nil
                    && timerPath.isEmpty
                    && !timerNavigationTransitionIsActive
                    && !homeOverlayOwnsSurface
                    && !homeActionMenuIsPresented
            ) {
                GeometryReader { proxy in
                    ZStack {
                        ZStack {
                            NavigationStack {
                                HomeScene(
                                    model: model,
                                    reduceMotion: reduceMotion,
                                    contextualMenuIsPresented: homeActionMenuIsPresented,
                                    transitioningWorkoutID: transitioningWorkoutID,
                                    reportWorkoutFrame: reportWorkoutFrame,
                                    selectWorkout: beginExecution,
                                    toggleAddWorkoutMenu: toggleHomeActionMenu,
                                    openAddWorkoutMenu: presentHomeActionMenu,
                                    openTimer: openTimer,
                                    showHistory: { presentHomeOverlay(.history) },
                                    showSettings: { presentHomeOverlay(.settings) }
                                )
                                .frame(maxWidth: .infinity, maxHeight: .infinity)
                                .toolbar(.hidden, for: .navigationBar)
                            }

                            if let workoutID = model.expandedWorkoutID,
                               let sourceWorkout = model.workouts.first(where: { $0.id == workoutID }) {
                                ExpandedWorkoutExecutionContainer(
                                    workoutID: workoutID,
                                    sourceWorkout: sourceWorkout,
                                    repository: repository,
                                    historyRepository: historyRepository,
                                    progressionRepository: progressionRepository,
                                    exerciseRepository: exerciseRepository,
                                    settingsRepository: settingsRepository,
                                    weightUnit: appSettings.weightUnit,
                                    defaultRestDuration: appSettings.defaultRestDuration,
                                    restSessionStore: restSessionStore,
                                    homeExecutionProgress: homeExecutionProgress,
                                    transitionSourceFrame: transitionSourceFrame,
                                    reportWalletFrame: reportWalletFrame,
                                    settingsPresentationBridge: executionSettingsPresentation,
                                    didPersist: model.applyPersistedWorkout,
                                    exit: endExecution
                                )
                                .ignoresSafeArea(.container, edges: .bottom)
                                .zIndex(1)
                            }
                        }
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .onPreferenceChange(ExecutionWorkHeaderTintPreferenceKey.self) { executionHeaderWorkTint = $0 }
                        .onPreferenceChange(ExecutionContextualMenuPresentedPreferenceKey.self) {
                            executionContextualMenuIsPresented = $0
                        }
                        .onPreferenceChange(ExecutionSettingsBackdropProgressPreferenceKey.self) {
                            executionSettingsBackdropProgress = $0
                            executionSettingsPresentation.progress = $0
                        }
                        .overlayPreferenceValue(HomeWorkoutTitleAnchorKey.self) { anchors in
                            HomeWorkoutTitleLayer(
                                workouts: model.workouts,
                                transitioningWorkoutID: transitioningWorkoutID,
                                anchors: anchors,
                                executionWorkTint: executionHeaderWorkTint
                            )
                            .opacity(
                                executionContextualMenuIsPresented
                                    ? ContextualActionMenuAppearance.coveredContentOpacity
                                    : 1
                            )
                            .animation(
                                reduceMotion
                                    ? EQMotion.reducedContentTransition
                                    : ContextualActionMenuMotion().backdropAnimation(
                                        isPresented: executionContextualMenuIsPresented
                                    ),
                                value: executionContextualMenuIsPresented
                            )
                        }
                        .overlay {
                            HomeExecutionSettingsBackdrop(
                                progress: executionSettingsBackdropProgress,
                                isPresented: executionSettingsPresentation.input != nil
                            )
                        }
                        .overlay {
                            HomeExerciseSettingsPresentationLayer(
                                bridge: executionSettingsPresentation
                            )
                        }
                        .scaleEffect(HomeOverlayPresentation.backgroundScale(
                            isPresented: homeOverlayIsPresented,
                            reduceMotion: reduceMotion
                        ))
                        .clipShape(HomeOverlayBackgroundClipShape(
                            cornerRadius: homeOverlayIsPresented ? EQRadius.largeSurface : 0,
                            bottomExtension: proxy.safeAreaInsets.bottom,
                            topExtension: model.expandedWorkoutID == nil ? 0 : proxy.safeAreaInsets.top
                        ))
                        .overlay {
                            EQColor.overlay
                                .opacity(homeOverlayIsPresented ? 1 : 0)
                                .allowsHitTesting(false)
                        }
                        .allowsHitTesting(!homeOverlayOwnsSurface)

                        settingsOverlay
                            .frame(width: proxy.size.width, height: proxy.size.height)
                            .offset(x: overlayOffset(for: .settings, width: proxy.size.width))
                            .opacity(overlayOpacity(for: .settings))
                            .allowsHitTesting(presentedHomeOverlay == .settings)
                            .accessibilityHidden(presentedHomeOverlay != .settings)
                            .zIndex(presentedHomeOverlay == .settings ? 3 : 2)

                        historyOverlay
                            .frame(width: proxy.size.width, height: proxy.size.height)
                            .offset(x: overlayOffset(for: .history, width: proxy.size.width))
                            .opacity(overlayOpacity(for: .history))
                            .allowsHitTesting(presentedHomeOverlay == .history)
                            .accessibilityHidden(presentedHomeOverlay != .history)
                            .zIndex(presentedHomeOverlay == .history ? 3 : 2)
                    }
                    .animation(
                        reduceMotion ? EQMotion.reducedContentTransition : EQMotion.surfaceReveal,
                        value: presentedHomeOverlay
                    )
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .modifier(HomeExecutionTransitionModifier(progress: homeExecutionProgress))
                }
            } timer: {
                GeometryReader { proxy in
                    ZStack {
                        TimerNavigationRoot(
                            isDestinationPresented: !timerPath.isEmpty,
                            reduceMotion: reduceMotion
                        ) {
                            StandaloneTimerView(store: timerStore, path: $timerPath) {
                                model.primarySurface = .home
                            }
                        }

                        if let route = timerPath.last {
                            timerDestination(route)
                                .id(route)
                                .frame(width: proxy.size.width, height: proxy.size.height)
                                .transition(reduceMotion ? .opacity : .move(edge: .trailing))
                                .zIndex(1)
                        }
                    }
                    .animation(
                        reduceMotion ? EQMotion.reducedContentTransition : EQMotion.surfaceReveal,
                        value: timerPath
                    )
                }
            }
        }
        .sheet(item: $model.creationRoute) { route in
            AddWorkoutSheet(initialRoute: route, exercises: exerciseRepository, workouts: repository, history: historyRepository) { created in
                model.applyPersistedWorkouts(created)
            }
            .onAppear {
                #if DEBUG
                homeMenuDiagnostics.notice("creation sheet rendered")
                #endif
            }
        }
        .task {
            SystemHapticsClient.prepare()
            await loadHomeAndSettings()
        }
        .task { await refreshAtLocalDayBoundary() }
        .task {
            for await _ in NotificationCenter.default.notifications(named: .equilibriumSettingsDidChange) {
                if let settings = try? await settingsRepository.settings() { appSettings = settings }
            }
        }
        .task {
            for await notification in NotificationCenter.default.notifications(named: .equilibriumRepositoryDidChange) {
                // Execution reports its saves through didPersist and Home reloads once execution ends.
                if RepositoryChangeOrigin.of(notification) == .local && (model.expandedWorkoutID != nil || transitioningWorkoutID != nil) { continue }
                await loadHomeAndSettings()
            }
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active { Task { await loadHomeAndSettings() } }
        }
        .onChange(of: model.primarySurface) { _, surface in
            if surface != .home { homeActionMenuIsPresented = false }
        }
        .tint(EQColor.Home.accent)
    }

    private var homeOverlayIsPresented: Bool {
        presentedHomeOverlay != nil
    }

    private var homeOverlayOwnsSurface: Bool {
        homeOverlayIsPresented || homeOverlayTransitionIsActive
    }

    private var homeActionMenuActions: [ContextualActionMenuAction] {
        var actions = [
            ContextualActionMenuAction(
                id: "create",
                title: "Create",
                accessibilityHint: "Opens the workout builder"
            ) { openCreationRoute(.builder(.init())) },
            ContextualActionMenuAction(
                id: "import",
                title: "Import",
                accessibilityHint: "Imports a workout from text"
            ) { openCreationRoute(.pasteWorkout) }
        ]
        if model.hasReusableWorkouts {
            actions.append(
                ContextualActionMenuAction(
                    id: "reuse",
                    title: "Reuse",
                    accessibilityHint: "Creates a workout from a completed workout"
                ) { openCreationRoute(.recent) }
            )
        }
        return actions
    }

    private var settingsOverlay: some View {
        NavigationStack {
            SettingsShellView(
                settingsRepository: settingsRepository,
                progressionRepository: progressionRepository,
                exerciseRepository: exerciseRepository,
                legacyImporter: legacyImporter,
                dismiss: dismissHomeOverlay
            )
        }
        .background(EQColor.Home.canvas)
    }

    private var historyOverlay: some View {
        NavigationStack {
            WorkoutHistoryView(
                repository: repository,
                historyRepository: historyRepository,
                weightUnit: appSettings.weightUnit,
                isActive: presentedHomeOverlay == .history,
                dismiss: dismissHomeOverlay
            )
        }
        .background(EQColor.Home.canvas)
    }

    private func overlayOffset(for destination: HomeOverlayDestination, width: CGFloat) -> CGFloat {
        reduceMotion || presentedHomeOverlay == destination ? 0 : width
    }

    private func overlayOpacity(for destination: HomeOverlayDestination) -> Double {
        reduceMotion && presentedHomeOverlay != destination ? 0 : 1
    }

    @ViewBuilder private func timerDestination(_ route: TimerRoute) -> some View {
        switch route {
        case .create:
            StandaloneTimerFormView(store: timerStore, onDismiss: popTimerRoute) { created in
                timerPath = StandaloneTimerNavigationPolicy.replacingCreation(in: timerPath, withRunID: created.id)
            }
        case .edit(let id):
            if let configuration = timerStore.configurations().first(where: { $0.id == id }) {
                StandaloneTimerFormView(
                    store: timerStore,
                    configuration: configuration,
                    onDismiss: popTimerRoute
                ) { _ in popTimerRoute() }
            } else { TimerUnavailableView(dismiss: popTimerRoute) }
        case .run(let id):
            if let configuration = timerStore.configurations().first(where: { $0.id == id }) {
                StandaloneTimerRunView(configuration: configuration, onDismiss: popTimerRoute)
            } else { TimerUnavailableView(dismiss: popTimerRoute) }
        }
    }

    private func popTimerRoute() {
        guard !timerPath.isEmpty else { return }
        timerNavigationTransitionIsActive = true
        withAnimation(
            reduceMotion ? EQMotion.reducedContentTransition : EQMotion.surfaceReveal,
            completionCriteria: .logicallyComplete
        ) {
            _ = timerPath.removeLast()
        } completion: {
            timerNavigationTransitionIsActive = false
        }
    }

    private func loadHomeAndSettings() async {
        await model.load()
        if let settings = try? await settingsRepository.settings() { appSettings = settings }
    }

    private func refreshAtLocalDayBoundary() async {
        while !Task.isCancelled {
            do { try await Task.sleep(for: model.nextLocalDayRefreshDelay()) }
            catch { return }
            await model.load()
        }
    }

    private func beginExecution(_ workoutID: WorkoutID) {
        guard model.expandedWorkoutID == nil else { return }
        homeActionMenuIsPresented = false
        SystemHapticsClient().perform(.lightImpact)
        transitionSourceFrame = workoutCardFrames[workoutID]
        transitionDestinationFrame = nil
        homeExecutionProgress = 0
        transitioningWorkoutID = workoutID
        model.beginExecution(for: workoutID)
    }

    private func presentHomeOverlay(_ destination: HomeOverlayDestination) {
        guard presentedHomeOverlay == nil, !homeOverlayTransitionIsActive else { return }
        homeActionMenuIsPresented = false
        SystemHapticsClient().perform(.selection)
        withAnimation(reduceMotion ? EQMotion.reducedContentTransition : EQMotion.surfaceReveal) {
            presentedHomeOverlay = destination
        }
    }

    private func dismissHomeOverlay() {
        let dismissedDestination = presentedHomeOverlay
        homeOverlayTransitionIsActive = true
        withAnimation(
            reduceMotion ? EQMotion.reducedContentTransition : EQMotion.surfaceReveal,
            completionCriteria: .logicallyComplete
        ) {
            presentedHomeOverlay = nil
        } completion: {
            guard presentedHomeOverlay == nil else { return }
            homeOverlayTransitionIsActive = false
        }
        if dismissedDestination == .settings { Task {
            if let settings = try? await settingsRepository.settings() {
                appSettings = settings
            }
        } }
    }

    private func presentHomeActionMenu() {
        guard !homeActionMenuIsPresented,
              model.primarySurface == .home,
              model.expandedWorkoutID == nil,
              transitioningWorkoutID == nil,
              !homeOverlayOwnsSurface else { return }
        SystemHapticsClient().perform(.lightImpact)
        homeActionMenuIsPresented = true
    }

    private func toggleHomeActionMenu() {
        if homeActionMenuIsPresented {
            homeActionMenuIsPresented = false
        } else {
            presentHomeActionMenu()
        }
    }

    private func openCreationRoute(_ route: CreationRoute) {
        #if DEBUG
        homeMenuDiagnostics.notice("Create action assigning creation route")
        #endif
        homeActionMenuIsPresented = false
        // The contextual menu owns the transaction that dismisses its overlay.
        // Present the native sheet in the next render transaction so UIKit receives
        // an unambiguous sheet presentation instead of coalescing it with the menu's
        // directional exit animation (which is especially noticeable on hardware).
        Task { @MainActor in
            await Task.yield()
            guard !homeActionMenuIsPresented else { return }
            model.creationRoute = route
            #if DEBUG
            homeMenuDiagnostics.notice("Create action assigned creation route")
            #endif
        }
    }

    private func openTimer() {
        homeActionMenuIsPresented = false
        model.primarySurface = .timer
    }

    private func endExecution() {
        guard let exitingWorkoutID = model.expandedWorkoutID else { return }
        withAnimation(
            reduceMotion ? EQMotion.reducedContentTransition : EQMotion.objectTransformation,
            completionCriteria: .logicallyComplete
        ) {
            homeExecutionProgress = 0
        } completion: {
            // `homeExecutionProgress` is rendered through an AnimatableModifier,
            // so comparing its presentation value here can leave Home's interaction
            // gate closed after a completed workout returns. The selected workout
            // identity is the stable lifecycle token for this specific exit.
            guard model.expandedWorkoutID == exitingWorkoutID else { return }
            model.endExecution()
            transitioningWorkoutID = nil
            transitionSourceFrame = nil
            transitionDestinationFrame = nil
            Task { await model.load() }
        }
    }

    private func reportWorkoutFrame(_ workoutID: WorkoutID, frame: CGRect) {
        guard frame.width > 0, frame.height > 0 else { return }
        workoutCardFrames[workoutID] = frame
    }

    private func reportWalletFrame(_ frame: CGRect) {
        guard transitioningWorkoutID != nil,
              transitionDestinationFrame == nil,
              frame.width > 0,
              frame.height > 0 else { return }
        transitionDestinationFrame = frame
        withAnimation(reduceMotion ? EQMotion.reducedContentTransition : EQMotion.objectTransformation) {
            homeExecutionProgress = 1
        }
    }
}

enum HomeOverlayDestination: Hashable {
    case history
    case settings
}

enum HomeOverlayPresentation {
    static func backgroundScale(isPresented: Bool, reduceMotion: Bool) -> CGFloat {
        isPresented && !reduceMotion ? EQLayout.Home.overlayBackgroundScale : 1
    }
}

private struct TimerNavigationRoot<Content: View>: View {
    let isDestinationPresented: Bool
    let reduceMotion: Bool
    @ViewBuilder let content: () -> Content

    var body: some View {
        GeometryReader { proxy in
            let topInset = proxy.safeAreaInsets.top
            let bottomInset = proxy.safeAreaInsets.bottom

            ZStack {
                // Keep the saved-timers canvas behind its scaled surface so a
                // destination cannot recolour the exposed safe-area edges.
                EQColor.background
                    .ignoresSafeArea()

                ZStack {
                    EQColor.background
                        .ignoresSafeArea()
                    content()
                }
                .frame(width: proxy.size.width, height: proxy.size.height)
                .scaleEffect(HomeOverlayPresentation.backgroundScale(
                    isPresented: isDestinationPresented,
                    reduceMotion: reduceMotion
                ))
                .clipShape(HomeOverlayBackgroundClipShape(
                    cornerRadius: isDestinationPresented ? EQRadius.largeSurface : 0,
                    bottomExtension: bottomInset,
                    topExtension: topInset
                ))
                .allowsHitTesting(!isDestinationPresented)
            }
            .animation(
                reduceMotion ? EQMotion.reducedContentTransition : EQMotion.surfaceReveal,
                value: isDestinationPresented
            )
        }
    }
}

private struct TimerUnavailableView: View {
    let dismiss: () -> Void

    var body: some View {
        VStack(spacing: 0) {
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
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, EQLayout.screenGutter)

            ContentUnavailableView("Timer unavailable", systemImage: "timer")
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .foregroundStyle(EQColor.contentPrimary)
        .background(EQColor.background.ignoresSafeArea())
    }
}

enum HomeWorkoutTransitionIdentity {
    static func surface(for id: WorkoutID) -> String { "home-workout-\(id.rawValue)" }
    static func title(for id: WorkoutID) -> String { "home-workout-title-\(id.rawValue)" }
}

enum HomeWorkoutTitleAnchor: Hashable {
    case source(WorkoutID)
    case destination(WorkoutID)
    case card(WorkoutID)
    case exerciseCount(WorkoutID)
    case status(WorkoutID)
    case sequence(WorkoutID)
    case focusedExerciseSettingsSurface
}

struct HomeWorkoutTitleAnchorKey: PreferenceKey {
    static var defaultValue: [HomeWorkoutTitleAnchor: Anchor<CGRect>] = [:]

    static func reduce(
        value: inout [HomeWorkoutTitleAnchor: Anchor<CGRect>],
        nextValue: () -> [HomeWorkoutTitleAnchor: Anchor<CGRect>]
    ) {
        value.merge(nextValue(), uniquingKeysWith: { _, latest in latest })
    }
}

/// Binary visibility for the floating workout-page title. Both frames are
/// resolved by `HomeWorkoutTitleLayer` from live anchors in the same coordinate
/// space, so the decision follows the Settings shell's presentation-frame top.
enum WorkoutPageTitleOcclusion {
    /// The Settings surface now remains inside the wallet, so this only prevents
    /// a single antialiased overlap frame when another covering surface actually
    /// reaches the floating title.
    static let overlapTolerance: CGFloat = 1

    static func isVisible(titleFrame: CGRect, coveringSurfaceFrame: CGRect?) -> Bool {
        guard titleFrame.width > 0,
              titleFrame.height > 0,
              let coveringSurfaceFrame,
              coveringSurfaceFrame.width > 0,
              coveringSurfaceFrame.height > 0,
              coveringSurfaceFrame.maxX > titleFrame.minX,
              coveringSurfaceFrame.minX < titleFrame.maxX else {
            return true
        }

        return coveringSurfaceFrame.minY > titleFrame.maxY + overlapTolerance
    }
}

/// Settings is presented by the scene-level layer that follows this backdrop.
/// Keeping the backdrop whole avoids mask-compositing seams and guarantees that
/// every part of the underlying Home/execution scene receives identical dimming.
private struct HomeExecutionSettingsBackdrop: View {
    let progress: CGFloat
    let isPresented: Bool

    var body: some View {
        let opacity = isPresented ? Double(min(max(progress, 0), 1)) : 0
        ZStack {
            ForEach(
                Array(ContextualActionMenuAppearance.backdropPassOpacities.enumerated()),
                id: \.offset
            ) { _, passOpacity in
                EQColor.overlay
                    .opacity(passOpacity * opacity)
            }
        }
        .ignoresSafeArea()
        .allowsHitTesting(isPresented)
        .accessibilityHidden(true)
    }
}

private struct HomeWorkoutTitleLayer: View {
    @Environment(\.homeExecutionTransitionProgress) private var progress
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    let workouts: [Workout]
    let transitioningWorkoutID: WorkoutID?
    let anchors: [HomeWorkoutTitleAnchor: Anchor<CGRect>]
    /// Matches the execution header while a work timer tints it.
    var executionWorkTint: Double = 0

    /// Launch-only diagnostic used to identify whether the floating base/tinted
    /// pair below is the renderer visible above focused exercise Settings.
    /// It is intentionally not connected to Settings state or release builds.
    private var debugHidesFloatingWorkoutTitle: Bool {
        #if DEBUG
        ProcessInfo.processInfo.arguments.contains("-debugHideFloatingWorkoutTitle")
        #else
        false
        #endif
    }

    var body: some View {
        GeometryReader { proxy in
            ZStack(alignment: .topLeading) {
                ForEach(workouts) { workout in
                    if HomeWorkoutTitleTransitionLayout.usesFloatingTitle(
                        workoutID: workout.id,
                        transitioningWorkoutID: transitioningWorkoutID
                    ),
                       let source = anchors[.source(workout.id)] {
                       let sourceFrame = proxy[source]
                       let destinationFrame = anchors[.destination(workout.id)].map { proxy[$0] } ?? sourceFrame
                       let titleProgress = workout.id == transitioningWorkoutID ? progress : 0
                       let frame = sourceFrame.interpolated(to: destinationFrame, progress: titleProgress)
                        let settingsSurfaceFrame = anchors[.focusedExerciseSettingsSurface].map { proxy[$0] }
                        let focusedSettingsTitleIsVisible = workout.id != transitioningWorkoutID
                            || WorkoutPageTitleOcclusion.isVisible(
                                titleFrame: frame,
                                coveringSurfaceFrame: settingsSurfaceFrame
                            )
                        let titleScale = HomeWorkoutTitleTransitionLayout.scale(progress: titleProgress)
                        let layoutSize = HomeWorkoutTitleTransitionLayout.unscaledSize(
                            for: frame.size,
                            scale: titleScale,
                            minimumHeight: sourceFrame.height
                        )
                        Text(workout.titleSnapshot)
                            .eqTextStyle(
                                workout.id == transitioningWorkoutID
                                    ? .transitionDestinationTitle
                                    : .cardHero
                            )
                            .lineLimit(2)
                            .foregroundStyle(HomeCardColors(status: workout.status).text)
                            .overlay {
                                // Cross-fades into the execution header colour as the title travels.
                                Text(workout.titleSnapshot)
                                    .eqTextStyle(
                                        workout.id == transitioningWorkoutID
                                            ? .transitionDestinationTitle
                                            : .cardHero
                                    )
                                    .lineLimit(2)
                                    .foregroundStyle(EQColor.Execution.primaryText.mix(
                                        with: EQColor.Execution.restForegroundSurface,
                                        by: workout.id == transitioningWorkoutID ? executionWorkTint : 0
                                    ))
                                    .opacity(min(max(titleProgress, 0), 1))
                            }
                            // The card anchor is the available title column, not the title's
                            // unconstrained intrinsic width. Dividing by the animated scale keeps
                            // that visible column stable while still giving the settled execution
                            // title enough pre-scale width to remain on one line when it fits.
                            .frame(
                                width: layoutSize.width,
                                height: layoutSize.height,
                                alignment: .leading
                            )
                            .clipped()
                            .scaleEffect(titleScale, anchor: .center)
                            // This layer floats above the execution page, so other cards' titles must not
                            // show through once the page covers the carousel.
                            .opacity(transitioningWorkoutID == nil || workout.id == transitioningWorkoutID ? 1 : 1 - min(max(progress, 0), 1))
                            // DEBUG diagnostic: hides only this known base/tinted title
                            // composition, leaving carousel metadata, the hidden execution
                            // layout anchor, and the Settings exercise title untouched.
                            .opacity(debugHidesFloatingWorkoutTitle ? 0 : 1)
                            // Keep the renderer mounted, but make this binary geometric
                            // decision immediate rather than inheriting Settings' animation.
                            .opacity(focusedSettingsTitleIsVisible ? 1 : 0)
                            .transaction { transaction in
                                transaction.animation = nil
                                transaction.disablesAnimations = true
                            }
                            .id(HomeWorkoutTransitionIdentity.title(for: workout.id))
                            .position(x: frame.midX, y: frame.midY)
                            .accessibilityHidden(true)
                    }
                }

                ForEach(Array(workouts.enumerated()), id: \.element.id) { index, workout in
                    if let cardAnchor = anchors[.card(workout.id)] {
                    let cardFrame = proxy[cardAnchor]
                    let metadataProgress = transitioningWorkoutID == nil ? 0 : min(max(progress, 0), 1)
                    let upperOffset = reduceMotion ? 0 : -(EQSpacing.sm * metadataProgress)
                    let lowerOffset = reduceMotion ? 0 : EQSpacing.sm * metadataProgress

                    ZStack(alignment: .topLeading) {
                        if let countAnchor = anchors[.exerciseCount(workout.id)] {
                            let frame = proxy[countAnchor]
                            Text("\(workout.exercises.count) \(workout.exercises.count == 1 ? "exercise" : "exercises")")
                                .eqTextStyle(.caption)
                                .foregroundStyle(HomeCardColors(status: workout.status).secondaryText)
                                .position(
                                    x: frame.midX - cardFrame.minX,
                                    y: frame.midY - cardFrame.minY
                                )
                                .offset(y: upperOffset)
                        }

                        if let statusAnchor = anchors[.status(workout.id)] {
                            let frame = proxy[statusAnchor]
                            Text(HomeCardPresentation(status: workout.status).stateLabel)
                                .eqTextStyle(.caption)
                                .foregroundStyle(HomeCardColors(status: workout.status).statusText)
                                .position(
                                    x: frame.midX - cardFrame.minX,
                                    y: frame.midY - cardFrame.minY
                                )
                                .offset(y: lowerOffset)
                        }

                        if let sequenceAnchor = anchors[.sequence(workout.id)] {
                            let frame = proxy[sequenceAnchor]
                            let parallaxOffset = HomeCarouselIndexParallax.offset(
                                cardMidX: cardFrame.midX,
                                viewportWidth: proxy.size.width,
                                cardWidth: cardFrame.width,
                                reduceMotion: reduceMotion
                            )
                            Text("\(index + 1)")
                                .eqTextStyle(.carouselIndex)
                                .foregroundStyle(HomeCardColors(status: workout.status).indexText)
                                .lineLimit(1)
                                .minimumScaleFactor(0.5)
                                .position(
                                    x: frame.midX - cardFrame.minX,
                                    y: frame.midY - cardFrame.minY
                                )
                                .offset(
                                    x: (frame.width * EQLayout.Home.carouselIndexOverflowFraction)
                                        + lowerOffset
                                        + parallaxOffset,
                                    y: (frame.height * EQLayout.Home.carouselIndexOverflowFraction)
                                        + EQLayout.Home.carouselIndexVerticalOffset
                                        + lowerOffset
                                )
                        }
                    }
                    .frame(width: cardFrame.width, height: cardFrame.height)
                    .clipShape(RoundedRectangle(cornerRadius: EQRadius.transformingCard, style: .continuous))
                    .opacity(Double(1 - metadataProgress))
                    .position(x: cardFrame.midX, y: cardFrame.midY)
                    .accessibilityHidden(true)
                    }
                }
            }
        }
        .allowsHitTesting(false)
    }
}

enum HomeCarouselIndexParallax {
    static func offset(
        cardMidX: CGFloat,
        viewportWidth: CGFloat,
        cardWidth: CGFloat,
        reduceMotion: Bool
    ) -> CGFloat {
        guard !reduceMotion, cardWidth > 0 else { return 0 }
        let phase = min(max((cardMidX - (viewportWidth / 2)) / cardWidth, -1), 1)
        return -(phase * EQLayout.Home.carouselIndexParallax)
    }
}

private extension CGRect {
    func interpolated(to destination: CGRect, progress: CGFloat) -> CGRect {
        let value = min(max(progress, 0), 1)
        return CGRect(
            x: minX + ((destination.minX - minX) * value),
            y: minY + ((destination.minY - minY) * value),
            width: width + ((destination.width - width) * value),
            height: height + ((destination.height - height) * value)
        )
    }
}

enum HomeWorkoutTitleTransitionLayout {
    static let settledScale: CGFloat = 0.61

    static func usesFloatingTitle(
        workoutID: WorkoutID,
        transitioningWorkoutID: WorkoutID?
    ) -> Bool {
        workoutID == transitioningWorkoutID
    }

    static func scale(progress: CGFloat) -> CGFloat {
        let value = min(max(progress, 0), 1)
        return 1 - ((1 - settledScale) * value)
    }

    static func unscaledSize(
        for visibleSize: CGSize,
        scale: CGFloat,
        minimumHeight: CGFloat = 0
    ) -> CGSize {
        let safeScale = max(scale, .leastNonzeroMagnitude)
        return CGSize(
            width: max(0, visibleSize.width) / safeScale,
            // Width follows the moving title column. Height keeps the card's two-line
            // capacity for the whole round trip so reverse navigation reflows directly
            // instead of briefly truncating before the source frame finishes expanding.
            height: max(max(0, visibleSize.height) / safeScale, max(0, minimumHeight))
        )
    }
}

private struct HomeExecutionTransitionModifier: ViewModifier, Animatable {
    var progress: CGFloat

    var animatableData: CGFloat {
        get { progress }
        set { progress = newValue }
    }

    func body(content: Content) -> some View {
        content
            .environment(\.homeExecutionTransitionProgress, progress)
            .environment(\.homeExecutionTransitionIsSettled, progress > 0.99)
    }
}

/// Applies Home → wallet transition progress to one view. Reading the per-frame
/// progress here, rather than in a screen's `body`, keeps whole screens from
/// re-evaluating on every animation frame.
struct HomeExecutionProgressEffect: ViewModifier {
    @Environment(\.homeExecutionTransitionProgress) private var progress
    let transform: (CGFloat) -> (offset: CGSize, opacity: Double)

    func body(content: Content) -> some View {
        let value = transform(progress)
        content
            .offset(value.offset)
            .opacity(value.opacity)
    }
}

private struct HomeExecutionTransitionProgressKey: EnvironmentKey {
    static let defaultValue: CGFloat = 1
}

private struct HomeExecutionTransitionIsSettledKey: EnvironmentKey {
    static let defaultValue = true
}

private struct HomeSurfacePullBlocksInteractionKey: EnvironmentKey {
    static let defaultValue = false
}

extension EnvironmentValues {
    var homeExecutionTransitionProgress: CGFloat {
        get { self[HomeExecutionTransitionProgressKey.self] }
        set { self[HomeExecutionTransitionProgressKey.self] = newValue }
    }

    /// Changes only when the transition lands, so views that just need to know
    /// whether it has finished don't depend on the per-frame progress.
    var homeExecutionTransitionIsSettled: Bool {
        get { self[HomeExecutionTransitionIsSettledKey.self] }
        set { self[HomeExecutionTransitionIsSettledKey.self] = newValue }
    }


    var homeSurfacePullBlocksInteraction: Bool {
        get { self[HomeSurfacePullBlocksInteractionKey.self] }
        set { self[HomeSurfacePullBlocksInteractionKey.self] = newValue }
    }
}

struct HomeCarouselGeometry: Equatable {
    let containerWidth: CGFloat
    let horizontalGutter: CGFloat

    init(containerWidth: CGFloat, horizontalGutter: CGFloat) {
        self.containerWidth = max(0, containerWidth)
        self.horizontalGutter = min(max(0, horizontalGutter), self.containerWidth / 2)
    }

    var cardWidth: CGFloat {
        containerWidth - (horizontalGutter * 2)
    }
}

enum HomeCarouselTrailingOverswipe {
    static func qualifies(
        beganAtFinalCard: Bool,
        translation: CGSize,
        layoutDirection: LayoutDirection,
        threshold: CGFloat = EQLayout.Home.contextualMenuOverswipeThreshold
    ) -> Bool {
        guard beganAtFinalCard else { return false }
        let trailingTranslation = layoutDirection == .leftToRight
            ? -translation.width
            : translation.width
        return trailingTranslation >= threshold
            && trailingTranslation > abs(translation.height)
    }
}

private struct HomeTimerContainer<HomeContent: View, TimerContent: View>: View {
    @Binding var primarySurface: HomePrimarySurface
    let reduceMotion: Bool
    let clipsToBounds: Bool
    let allowsSurfacePull: Bool
    let homeContent: HomeContent
    let timerContent: TimerContent
    @State private var interactiveProgress: CGFloat?
    @State private var surfacePullBlocksInteraction = false
    @State private var timerSystemBackground: StandaloneTimerSystemBackgroundStyle = .homeCanvas

    init(
        primarySurface: Binding<HomePrimarySurface>,
        reduceMotion: Bool,
        clipsToBounds: Bool,
        allowsSurfacePull: Bool,
        @ViewBuilder home: () -> HomeContent,
        @ViewBuilder timer: () -> TimerContent
    ) {
        _primarySurface = primarySurface
        self.reduceMotion = reduceMotion
        self.clipsToBounds = clipsToBounds
        self.allowsSurfacePull = allowsSurfacePull
        homeContent = home()
        timerContent = timer()
    }

    var body: some View {
        GeometryReader { proxy in
            let progress = interactiveProgress ?? HomeTimerSurfacePull.restingProgress(for: primarySurface)
            ZStack {
                homeContent
                    .frame(width: proxy.size.width, height: proxy.size.height)
                    .offset(y: reduceMotion ? 0 : -(proxy.size.height * progress))
                    .opacity(reduceMotion ? Double(1 - progress) : 1)
                    .environment(\.homeSurfacePullBlocksInteraction, surfacePullBlocksInteraction)
                    .allowsHitTesting(primarySurface == .home && !surfacePullBlocksInteraction)
                    .accessibilityHidden(primarySurface != .home)
                timerContent
                    .frame(width: proxy.size.width, height: proxy.size.height)
                    .offset(y: reduceMotion ? 0 : proxy.size.height * (1 - progress))
                    .opacity(timerOpacity(progress: progress))
                    .environment(\.homeSurfacePullBlocksInteraction, surfacePullBlocksInteraction)
                    .allowsHitTesting(primarySurface == .timer && !surfacePullBlocksInteraction)
                    .accessibilityHidden(primarySurface != .timer)
            }
            .modifier(HomeTimerClippingModifier(clipsToBounds: clipsToBounds))
            .animation(reduceMotion ? EQMotion.reducedContentTransition : EQMotion.surfaceReveal, value: primarySurface)
            .simultaneousGesture(surfacePullGesture(height: proxy.size.height))
        }
        .onPreferenceChange(StandaloneTimerSystemBackgroundPreferenceKey.self) {
            timerSystemBackground = $0
        }
        .background(timerSystemBackground.color.ignoresSafeArea())
    }

    private func timerOpacity(progress: CGFloat) -> Double {
        if reduceMotion { return Double(progress) }
        return clipsToBounds || progress == 1 ? 1 : 0
    }

    private func surfacePullGesture(height: CGFloat) -> some Gesture {
        DragGesture(minimumDistance: 8)
            .onChanged { value in
                guard allowsSurfacePull,
                      abs(value.translation.height) > abs(value.translation.width) else {
                    interactiveProgress = nil
                    return
                }
                surfacePullBlocksInteraction = true
                let progress = HomeTimerSurfacePull.progress(
                    from: primarySurface,
                    translation: value.translation.height,
                    height: height
                )
                guard progress != HomeTimerSurfacePull.restingProgress(for: primarySurface) else {
                    interactiveProgress = nil
                    return
                }
                interactiveProgress = progress
            }
            .onEnded { value in
                guard allowsSurfacePull, interactiveProgress != nil else {
                    interactiveProgress = nil
                    releaseSurfacePullInteractionLockAfterCancelledPull()
                    return
                }
                let destination = HomeTimerSurfacePull.destination(
                    from: primarySurface,
                    translation: value.translation.height,
                    predictedTranslation: value.predictedEndTranslation.height,
                    height: height
                )
                if destination != primarySurface {
                    SystemHapticsClient().perform(.lightImpact)
                }
                withAnimation(
                    reduceMotion ? EQMotion.reducedContentTransition : EQMotion.surfaceReveal,
                    completionCriteria: .logicallyComplete
                ) {
                    primarySurface = destination
                    interactiveProgress = nil
                } completion: {
                    surfacePullBlocksInteraction = false
                }
            }
    }

    private func releaseSurfacePullInteractionLockAfterCancelledPull() {
        guard surfacePullBlocksInteraction else { return }
        Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(100))
            guard interactiveProgress == nil else { return }
            surfacePullBlocksInteraction = false
        }
    }
}

enum HomeTimerSurfacePull {
    static let completionProgress: CGFloat = 0.18
    static let projectedCompletionProgress: CGFloat = 0.12

    static func restingProgress(for surface: HomePrimarySurface) -> CGFloat {
        surface == .home ? 0 : 1
    }

    static func progress(
        from surface: HomePrimarySurface,
        translation: CGFloat,
        height: CGFloat
    ) -> CGFloat {
        guard height > 0 else { return restingProgress(for: surface) }
        switch surface {
        case .home:
            return min(max(-translation / height, 0), 1)
        case .timer:
            return 1 - min(max(translation / height, 0), 1)
        }
    }

    static func destination(
        from surface: HomePrimarySurface,
        translation: CGFloat,
        predictedTranslation: CGFloat,
        height: CGFloat
    ) -> HomePrimarySurface {
        let current = progress(from: surface, translation: translation, height: height)
        let projected = progress(from: surface, translation: predictedTranslation, height: height)
        switch surface {
        case .home:
            return current >= completionProgress || projected >= projectedCompletionProgress
                ? .timer
                : .home
        case .timer:
            return current <= 1 - completionProgress || projected <= 1 - projectedCompletionProgress
                ? .home
                : .timer
        }
    }
}

/// Clips the Home background for overlay presentation while extending through the
/// bottom safe area, so full-bleed content (the execution wallet) reaches the device edge.
struct HomeOverlayBackgroundClipShape: Shape {
    var cornerRadius: CGFloat
    var bottomExtension: CGFloat
    /// Lets the open workout paint its canvas (e.g. the rest colour) behind the status bar.
    var topExtension: CGFloat = 0

    var animatableData: CGFloat {
        get { cornerRadius }
        set { cornerRadius = newValue }
    }

    func path(in rect: CGRect) -> Path {
        var extended = rect
        extended.origin.y -= max(0, topExtension)
        extended.size.height += max(0, bottomExtension) + max(0, topExtension)
        return RoundedRectangle(cornerRadius: cornerRadius, style: .continuous).path(in: extended)
    }
}

private struct HomeTimerClippingModifier: ViewModifier {
    let clipsToBounds: Bool

    func body(content: Content) -> some View {
        content.clipShape(HomeTimerClipShape(clipsToBounds: clipsToBounds))
    }
}

private struct HomeTimerClipShape: Shape {
    let clipsToBounds: Bool

    func path(in rect: CGRect) -> Path {
        let clipRect = clipsToBounds
            ? rect
            : rect.insetBy(dx: -rect.width, dy: -rect.height)
        return Path(clipRect)
    }
}

struct HomeTimerSurfaceButton: View {
    enum IconPlacement {
        case top
        case bottom
        case trailing
    }

    let title: String
    let systemImage: String
    var iconPlacement: IconPlacement = .bottom
    var expandsHorizontally = true
    var horizontalPadding = EQSpacing.lg
    var verticalPadding = EQSpacing.sm
    let accessibilityHint: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Group {
                if iconPlacement == .trailing {
                    HStack(spacing: EQSpacing.xs) {
                        Text(title).eqTextStyle(.listItemTitle)
                        Image(systemName: systemImage).eqTextStyle(.captionEmphasized)
                    }
                } else {
                    VStack(spacing: EQSpacing.xxs) {
                        if iconPlacement == .top {
                            Image(systemName: systemImage).eqTextStyle(.captionEmphasized)
                        }
                        Text(title).eqTextStyle(.listItemTitle)
                        if iconPlacement == .bottom {
                            Image(systemName: systemImage).eqTextStyle(.captionEmphasized)
                        }
                    }
                }
            }
            .foregroundStyle(EQColor.Home.timerAffordance)
            .frame(
                maxWidth: expandsHorizontally ? .infinity : nil,
                minHeight: EQDimension.minimumTouch
            )
        }
        .buttonStyle(.plain)
        .padding(.horizontal, horizontalPadding)
        .padding(.vertical, verticalPadding)
        .accessibilityHint(accessibilityHint)
    }
}

struct HomeAddActionButton<Label: View>: View {
    let accessibilityHint: String
    var horizontalPadding = EQSpacing.lg
    var alignment: Alignment = .center
    let action: () -> Void
    @ViewBuilder let label: () -> Label

    var body: some View {
        Button(action: action) {
            label()
                .eqTextStyle(.listItemTitle)
                .frame(maxWidth: .infinity, minHeight: EQDimension.minimumTouch, alignment: alignment)
        }
        .buttonStyle(.plain)
        .foregroundStyle(EQColor.Home.accent)
        .padding(.horizontal, horizontalPadding)
        .accessibilityHint(accessibilityHint)
    }
}

private enum HomeCarouselPosition: Hashable {
    case workout(WorkoutID)
}

private struct HomeAddWorkoutMenuTrigger: View {
    private static let openingRotationDuration: TimeInterval = 0.14
    private static let closingRotationDuration: TimeInterval = 0.10

    let isMenuPresented: Bool
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var rotation: Double = 0

    var body: some View {
        Image(systemName: "plus")
            .eqTextStyle(EQTypography.headingSection)
            .rotationEffect(.degrees(rotation))
            .frame(
                width: EQLayout.Home.contextualMenuTriggerSize,
                height: EQLayout.Home.contextualMenuTriggerSize
            )
            .foregroundStyle(EQColor.contentOnAccent)
            .background(
                EQColor.Home.cardSurface,
                in: RoundedRectangle(cornerRadius: EQRadius.button, style: .continuous)
            )
            .contentShape(RoundedRectangle(cornerRadius: EQRadius.button, style: .continuous))
            .onAppear { prepareInitialRotation() }
            .onChange(of: isMenuPresented) { _, isPresented in
                updateRotation(to: isPresented)
            }
    }

    private func prepareInitialRotation() {
        guard isMenuPresented, !reduceMotion else {
            rotation = isMenuPresented ? 45 : 0
            return
        }
        withAnimation(.easeOut(duration: Self.openingRotationDuration)) {
            rotation = 45
        }
    }

    private func updateRotation(to isPresented: Bool) {
        let target = isPresented ? 45.0 : 0.0
        guard !reduceMotion else {
            rotation = target
            return
        }
        let animation = isPresented
            ? Animation.easeOut(duration: Self.openingRotationDuration)
            : Animation.easeIn(duration: Self.closingRotationDuration)
        withAnimation(animation) {
            rotation = target
        }
    }
}

private struct HomeScene: View {
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @Environment(\.homeSurfacePullBlocksInteraction) private var surfacePullBlocksInteraction
    @Environment(\.layoutDirection) private var layoutDirection
    @State private var carouselPosition: HomeCarouselPosition?
    @State private var overswipeBeganAtFinalCard: Bool?
    @State private var overswipeTriggered = false
    @State private var homeChromeFrame: CGRect = .zero
    @Bindable var model: HomeModel
    let reduceMotion: Bool
    let contextualMenuIsPresented: Bool
    let transitioningWorkoutID: WorkoutID?
    let reportWorkoutFrame: (WorkoutID, CGRect) -> Void
    let selectWorkout: (WorkoutID) -> Void
    let toggleAddWorkoutMenu: () -> Void
    let openAddWorkoutMenu: () -> Void
    let openTimer: () -> Void
    let showHistory: () -> Void
    let showSettings: () -> Void

    private var isExecutionExpanded: Bool { transitioningWorkoutID != nil }

    private var homeChromeDistance: CGFloat {
        reduceMotion ? 0 : -homeChromeFrame.maxY
    }

    private var lowerHomeContentDistance: CGFloat {
        reduceMotion ? 0 : max(homeChromeFrame.height, EQDimension.workoutCardHeight)
    }

    private static func departingHomeOpacity(progress: CGFloat, reduceMotion: Bool) -> Double {
        let destinationOpacity: CGFloat = reduceMotion ? 0 : 0.18
        return Double(1 - ((1 - destinationOpacity) * progress))
    }

    private func departingHomeEffect(distance: CGFloat) -> HomeExecutionProgressEffect {
        let reduceMotion = reduceMotion
        return HomeExecutionProgressEffect { progress in
            (
                CGSize(width: 0, height: distance * progress),
                Self.departingHomeOpacity(progress: progress, reduceMotion: reduceMotion)
            )
        }
    }

    var body: some View {
        VStack(spacing: 0) {
            VStack(alignment: .leading, spacing: EQSpacing.lg) {
                VStack(alignment: .leading, spacing: EQSpacing.lg) {
                    header
                    if model.errorMessage != nil { loadError }
                    workoutOfTheDay
                }
                .onGeometryChange(for: CGRect.self) { proxy in
                    proxy.frame(in: .global)
                } action: { frame in
                    if !isExecutionExpanded, frame.width > 0, frame.height > 0 {
                        homeChromeFrame = frame
                    }
                }
                .modifier(departingHomeEffect(distance: homeChromeDistance))
                carousel
                    .padding(.top, EQSpacing.lg)
            }
            .padding(.vertical, EQSpacing.sm)
            .accessibilityHidden(contextualMenuIsPresented)
            Spacer(minLength: 0)
            bottomActionRow
                .modifier(departingHomeEffect(distance: lowerHomeContentDistance))
        }
        .background(EQColor.Home.canvas.ignoresSafeArea())
        .allowsHitTesting(!isExecutionExpanded)
    }

    private var header: some View {
        HStack(alignment: .center, spacing: EQSpacing.md) {
            Text("Home").eqTextStyle(.screenTitle).hidden()
            Spacer(minLength: EQSpacing.sm)
            HStack(spacing: EQSpacing.xs) {
                Button(action: showHistory) {
                    Image(systemName: "clock.arrow.circlepath")
                        .eqTextStyle(.icon)
                        .foregroundStyle(EQColor.Home.secondaryText)
                        .frame(width: EQLayout.Home.headerIconSize, height: EQLayout.Home.headerIconSize)
                        .frame(width: EQLayout.Home.headerControlSize, height: EQLayout.Home.headerControlSize)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Workout history")
                Button(action: showSettings) {
                    EQSettingsGlyph(color: EQColor.Home.secondaryText)
                        .frame(width: EQLayout.Home.headerControlSize, height: EQLayout.Home.headerControlSize)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Settings")
            }
        }
        .frame(minHeight: EQDimension.minimumTouch, alignment: .center)
        .padding(.horizontal, EQSpacing.lg)
    }

    private var workoutOfTheDay: some View {
        VStack(alignment: .leading, spacing: EQLayout.Home.heroTitleDateSpacing) {
            Text("Workout of the day")
                .eqTextStyle(.screenTitle)
                .lineLimit(2)
                .fixedSize(horizontal: false, vertical: true)
            homeDate
        }
        .padding(.horizontal, EQSpacing.lg)
    }

    private var homeDate: some View {
        EQDateText.text(.now, style: .screenTitle, includeYear: false)
            .foregroundStyle(EQColor.Home.secondaryText)
            .accessibilityLabel(EQDateText.string(.now, includeYear: false))
    }

    @ViewBuilder private var carousel: some View {
        if model.workouts.isEmpty {
            ContentUnavailableView("No workouts on Home", systemImage: "dumbbell", description: Text("Add a workout to get started."))
                .frame(maxWidth: .infinity, minHeight: EQDimension.workoutCardHeight)
                .padding(.horizontal, EQSpacing.lg)
        } else {
            GeometryReader { proxy in
                let geometry = HomeCarouselGeometry(containerWidth: proxy.size.width, horizontalGutter: EQSpacing.lg)
                ScrollView(.horizontal) {
                    LazyHStack(spacing: EQSpacing.sm) {
                        ForEach(Array(model.workouts.enumerated()), id: \.element.id) { index, workout in
                            carouselCard(
                                workout,
                                sequence: index + 1,
                                width: geometry.cardWidth,
                                dispersalWidth: max(proxy.size.width, proxy.size.height)
                            )
                        }
                    }
                    .scrollTargetLayout()
                }
                .contentMargins(.horizontal, geometry.horizontalGutter, for: .scrollContent)
                .scrollTargetBehavior(.viewAligned(limitBehavior: .always))
                .scrollPosition(id: $carouselPosition, anchor: .center)
                .scrollIndicators(.hidden)
                .scrollClipDisabled()
                .accessibilityLabel("Home workouts")
                .simultaneousGesture(trailingOverswipeGesture)
                .onAppear {
                    if carouselPosition == nil, let firstID = model.workouts.first?.id {
                        carouselPosition = .workout(firstID)
                    }
                }
            }
            .frame(height: dynamicTypeSize.isAccessibilitySize ? 380 : EQDimension.workoutCardHeight)
        }
    }

    private func carouselCard(_ workout: Workout, sequence: Int, width: CGFloat, dispersalWidth: CGFloat) -> some View {
        Button {
            guard !surfacePullBlocksInteraction else { return }
            carouselPosition = .workout(workout.id)
            selectWorkout(workout.id)
        } label: {
            WorkoutCard(
                workout: workout,
                sequence: sequence,
                isExpanded: model.expandedWorkoutID == workout.id,
                reportFrame: { reportWorkoutFrame(workout.id, $0) }
            )
        }
        .buttonStyle(.plain)
        .frame(width: width)
        .id(HomeCarouselPosition.workout(workout.id))
        .scrollTransition(.interactive, axis: .horizontal) { content, phase in
            content.scaleEffect(
                1 - (abs(CGFloat(phase.value)) * 0.1),
                anchor: phase.value < 0 ? .trailing : phase.value > 0 ? .leading : .center
            )
        }
        .modifier(siblingDispersalEffect(for: workout, width: dispersalWidth))
        .zIndex(model.expandedWorkoutID == workout.id ? 1 : 0)
    }

    private func siblingDispersalEffect(for workout: Workout, width: CGFloat) -> HomeExecutionProgressEffect {
        let distance = siblingDispersalDistance(for: workout, width: width)
        return HomeExecutionProgressEffect { progress in
            (CGSize(width: distance * progress, height: 0), 1)
        }
    }

    private func siblingDispersalDistance(for workout: Workout, width: CGFloat) -> CGFloat {
        guard !reduceMotion,
              let expandedWorkoutID = transitioningWorkoutID,
              let selectedIndex = model.workouts.firstIndex(where: { $0.id == expandedWorkoutID }),
              let index = model.workouts.firstIndex(where: { $0.id == workout.id }),
              index != selectedIndex else { return 0 }
        return index < selectedIndex ? -width : width
    }

    private var bottomActionRow: some View {
        HStack(alignment: .bottom, spacing: EQSpacing.md) {
            timerAffordance
            Spacer(minLength: EQSpacing.md)
            addWorkoutTrigger
        }
        .padding(.horizontal, EQLayout.screenGutter)
    }

    private var timerAffordance: some View {
        HomeTimerSurfaceButton(
            title: "Timer",
            systemImage: "chevron.down",
            iconPlacement: .trailing,
            expandsHorizontally: false,
            horizontalPadding: 0,
            verticalPadding: 0,
            accessibilityHint: "Moves to the standalone timer"
        ) { openTimer() }
        .accessibilityHidden(contextualMenuIsPresented)
    }

    private var addWorkoutTrigger: some View {
        ContextualActionMenuTrigger(
            isPresented: contextualMenuIsPresented,
            accessibilityLabel: "Add Workout",
            accessibilityHint: "Shows options to create, import, or reuse a workout",
            toggle: toggleAddWorkoutMenu
        ) {
            HomeAddWorkoutMenuTrigger(isMenuPresented: false)
        }
    }

    private var trailingOverswipeGesture: some Gesture {
        DragGesture(minimumDistance: EQSpacing.sm)
            .onChanged { value in
                guard !contextualMenuIsPresented, !surfacePullBlocksInteraction else { return }
                if overswipeBeganAtFinalCard == nil {
                    overswipeBeganAtFinalCard = isFinalWorkoutSelected
                    overswipeTriggered = false
                }
                guard !overswipeTriggered,
                      HomeCarouselTrailingOverswipe.qualifies(
                        beganAtFinalCard: overswipeBeganAtFinalCard == true,
                        translation: value.translation,
                        layoutDirection: layoutDirection
                      ) else { return }
                overswipeTriggered = true
                openAddWorkoutMenu()
            }
            .onEnded { _ in
                overswipeBeganAtFinalCard = nil
                overswipeTriggered = false
            }
    }

    private var isFinalWorkoutSelected: Bool {
        guard let finalID = model.workouts.last?.id else { return false }
        return carouselPosition == .workout(finalID)
    }

    private var loadError: some View {
        HStack(alignment: .center, spacing: EQSpacing.sm) {
            Label("Workouts could not be loaded.", systemImage: "exclamationmark.triangle.fill")
                .eqTextStyle(.body).foregroundStyle(EQColor.warning)
            Spacer(minLength: EQSpacing.sm)
            Button("Retry") { Task { await model.load() } }
                .buttonStyle(.bordered).frame(minHeight: EQDimension.minimumTouch)
                .accessibilityHint("Attempts to load Home workouts again")
        }
        .padding(EQSpacing.md).background(EQColor.surface, in: RoundedRectangle(cornerRadius: EQRadius.card, style: .continuous))
        .padding(.horizontal, EQSpacing.lg)
        .accessibilityElement(children: .contain)
    }
}

private struct ExpandedWorkoutExecutionContainer: View {
    let workoutID: WorkoutID
    let sourceWorkout: Workout
    let repository: any WorkoutRepository
    let historyRepository: any ExerciseHistoryRepository
    let progressionRepository: any ProgressionRepository
    let exerciseRepository: any ExerciseRepository
    let settingsRepository: any SettingsRepository
    let weightUnit: WeightUnit
    let defaultRestDuration: TimeInterval
    let restSessionStore: WorkoutRestSessionStore
    let homeExecutionProgress: CGFloat
    let transitionSourceFrame: CGRect?
    let reportWalletFrame: (CGRect) -> Void
    let settingsPresentationBridge: ExecutionSettingsPresentationBridge
    let didPersist: (Workout) -> Void
    let exit: () -> Void

    var body: some View {
        WorkoutExecutionView(
            id: workoutID,
            initialWorkout: sourceWorkout,
            repository: repository,
            historyRepository: historyRepository,
            progressionRepository: progressionRepository,
            exerciseRepository: exerciseRepository,
            settingsRepository: settingsRepository,
            weightUnit: weightUnit,
            defaultRestDuration: defaultRestDuration,
            restSessionStore: restSessionStore,
            homeExecutionProgress: homeExecutionProgress,
            transitionSourceFrame: transitionSourceFrame,
            reportWalletFrame: reportWalletFrame,
            settingsPresentationBridge: settingsPresentationBridge,
            didPersist: didPersist,
            onExit: exit,
            usesObjectSurface: true
        )
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

private struct WorkoutCard: View {
    let workout: Workout
    let sequence: Int
    var isExpanded = false
    let reportFrame: (CGRect) -> Void
    private var presentation: HomeCardPresentation { .init(status: workout.status) }

    var body: some View {
        VStack(alignment: .leading, spacing: EQSpacing.md) {
            ZStack(alignment: .leading) {
                Text(workout.titleSnapshot)
                    .eqTextStyle(.cardHero)
                    .lineLimit(2)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    // The card owns its title while browsing so scrollTransition scales
                    // the text and its layout together. The floating title layer takes over
                    // only while this card transforms into the execution surface.
                    .opacity(isExpanded ? 0 : 1)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .anchorPreference(key: HomeWorkoutTitleAnchorKey.self, value: .bounds) {
                [.source(workout.id): $0]
            }

            Text("\(workout.exercises.count) \(workout.exercises.count == 1 ? "exercise" : "exercises")")
                .eqTextStyle(.caption)
                .foregroundStyle(colors.secondaryText)
                .anchorPreference(key: HomeWorkoutTitleAnchorKey.self, value: .bounds) {
                    [.exerciseCount(workout.id): $0]
                }
                .hidden()
            Spacer()
            Text(presentation.stateLabel)
                .eqTextStyle(.caption)
                .foregroundStyle(statusColor)
                .anchorPreference(key: HomeWorkoutTitleAnchorKey.self, value: .bounds) {
                    [.status(workout.id): $0]
                }
                .hidden()
        }
        .padding(.horizontal, EQSpacing.lg)
        .padding(.bottom, EQSpacing.lg)
        .padding(.top, EQLayout.Home.cardTopInset)
        .foregroundStyle(colors.text)
        .frame(maxWidth: .infinity, minHeight: EQDimension.workoutCardHeight, alignment: .topLeading)
        .background(alignment: .bottomTrailing) {
            Text("\(sequence)")
                .eqTextStyle(.carouselIndex)
                .foregroundStyle(colors.indexText)
                .lineLimit(1)
                .minimumScaleFactor(0.5)
                .accessibilityHidden(true)
                .anchorPreference(key: HomeWorkoutTitleAnchorKey.self, value: .bounds) {
                    [.sequence(workout.id): $0]
                }
                .hidden()
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomTrailing)
        }
        .clipShape(RoundedRectangle(cornerRadius: EQRadius.transformingCard, style: .continuous))
        .background {
            Color.clear.anchorPreference(key: HomeWorkoutTitleAnchorKey.self, value: .bounds) {
                [.card(workout.id): $0]
            }
        }
        .onGeometryChange(for: CGRect.self) { proxy in
            proxy.frame(in: .global)
        } action: { frame in
            reportFrame(frame)
        }
        .background {
            if !isExpanded {
                RoundedRectangle(cornerRadius: EQRadius.transformingCard, style: .continuous)
                    .fill(colors.surface)
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(
            "\(workout.titleSnapshot), \(workout.exercises.count) \(workout.exercises.count == 1 ? "exercise" : "exercises"), \(presentation.stateLabel)"
        )
        .accessibilityHidden(isExpanded)
    }

    private var statusColor: Color { colors.statusText }
    private var colors: HomeCardColors { .init(status: workout.status) }
}

/// Completed workouts recede into the same neutral group styling as Settings.
struct HomeCardColors {
    let surface: Color
    let text: Color
    let secondaryText: Color
    let statusText: Color
    let indexText: Color

    init(status: WorkoutStatus) {
        if status == .completed {
            surface = EQColor.surfaceHighlightLight
            text = EQColor.contentPrimary
            secondaryText = EQColor.contentSecondary
            statusText = EQColor.contentSecondary
            indexText = EQColor.contentPrimary
        } else {
            surface = EQColor.Home.cardSurface
            text = EQColor.Home.cardText
            secondaryText = EQColor.Home.cardSecondaryText
            statusText = EQColor.Home.completedText
            indexText = EQColor.Home.indexText
        }
    }
}

#if DEBUG
@MainActor private func homePreview(_ workouts: [Workout] = []) -> some View {
    let container = try! PersistenceController.makeContainer(inMemory: true)
    workouts.forEach { container.mainContext.insert(WorkoutMapper.record(from: $0)) }; try! container.mainContext.save()
    return HomeView(repository: SwiftDataRepository(container: container)).modelContainer(container)
}
#Preview("Multiple workouts") { homePreview([EquilibriumFixtures.ready(), EquilibriumFixtures.inProgress(id: "preview-progress"), EquilibriumFixtures.completed(id: "preview-complete")]) }
#Preview("Add workout only") { homePreview() }
#endif
