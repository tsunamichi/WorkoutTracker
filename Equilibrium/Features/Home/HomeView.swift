import SwiftUI

struct HomeView: View {
    @State private var model: HomeModel
    private let repository: any WorkoutRepository
    private let exerciseRepository: any ExerciseRepository
    private let historyRepository: any ExerciseHistoryRepository
    private let settingsRepository: any SettingsRepository
    private let progressionRepository: any ProgressionRepository
    @State private var appSettings = AppSettings(weightUnit: .pounds, defaultRestDuration: 90)
    @State private var timerPath: [TimerRoute] = []
    @State private var presentedHomeOverlay: HomeOverlayDestination?
    @State private var homeOverlayTransitionIsActive = false
    @State private var restSessionStore = WorkoutRestSessionStore()
    @State private var homeExecutionProgress: CGFloat = 0
    @State private var transitioningWorkoutID: WorkoutID?
    @State private var executionHeaderWorkTint: Double = 0
    @State private var workoutCardFrames: [WorkoutID: CGRect] = [:]
    @State private var transitionSourceFrame: CGRect?
    @State private var transitionDestinationFrame: CGRect?
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
        HomeTimerContainer(
            primarySurface: $model.primarySurface,
            reduceMotion: reduceMotion,
            clipsToBounds: transitioningWorkoutID == nil && !homeOverlayOwnsSurface,
            allowsSurfacePull: transitioningWorkoutID == nil
                && model.expandedWorkoutID == nil
                && timerPath.isEmpty
                && !homeOverlayOwnsSurface
        ) {
            GeometryReader { proxy in
                ZStack {
                    ZStack {
                        NavigationStack {
                            HomeScene(
                                model: model,
                                reduceMotion: reduceMotion,
                                transitioningWorkoutID: transitioningWorkoutID,
                                reportWorkoutFrame: reportWorkoutFrame,
                                selectWorkout: beginExecution,
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
                                transitionSourceFrame: transitionSourceFrame,
                                reportWalletFrame: reportWalletFrame,
                                didPersist: model.applyPersistedWorkout,
                                exit: endExecution
                            )
                            .ignoresSafeArea(.container, edges: .bottom)
                            .zIndex(1)
                        }
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .onPreferenceChange(ExecutionWorkHeaderTintPreferenceKey.self) { executionHeaderWorkTint = $0 }
                    .overlayPreferenceValue(HomeWorkoutTitleAnchorKey.self) { anchors in
                        HomeWorkoutTitleLayer(
                            workouts: model.workouts,
                            transitioningWorkoutID: transitioningWorkoutID,
                            anchors: anchors,
                            executionWorkTint: executionHeaderWorkTint
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
                        EQColor.overlayDim
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
            NavigationStack(path: $timerPath) {
                StandaloneTimerView(store: timerStore, path: $timerPath) { model.primarySurface = .home }
                    .navigationDestination(for: TimerRoute.self) { timerDestination($0) }
            }
        }
        .sheet(isPresented: $model.isAddWorkoutDrawerPresented, onDismiss: model.presentPendingCreationRoute) {
            AddWorkoutDrawer(hasReusableWorkouts: model.hasReusableWorkouts, select: model.selectCreationRoute)
        }
        .sheet(item: $model.creationRoute) { route in
            AddWorkoutSheet(initialRoute: route, exercises: exerciseRepository, workouts: repository, history: historyRepository) { created in
                model.applyPersistedWorkouts(created)
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
        .tint(EQColor.Home.accent)
    }

    private var homeOverlayIsPresented: Bool {
        presentedHomeOverlay != nil
    }

    private var homeOverlayOwnsSurface: Bool {
        homeOverlayIsPresented || homeOverlayTransitionIsActive
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
            StandaloneTimerFormView(store: timerStore) { created in
                timerPath = StandaloneTimerNavigationPolicy.replacingCreation(in: timerPath, withRunID: created.id)
            }
        case .edit(let id):
            if let configuration = timerStore.configurations().first(where: { $0.id == id }) {
                StandaloneTimerFormView(store: timerStore, configuration: configuration) { _ in
                    if !timerPath.isEmpty { timerPath.removeLast() }
                }
            } else { ContentUnavailableView("Timer unavailable", systemImage: "timer") }
        case .run(let id):
            if let configuration = timerStore.configurations().first(where: { $0.id == id }) {
                StandaloneTimerRunView(configuration: configuration)
            } else { ContentUnavailableView("Timer unavailable", systemImage: "timer") }
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
        SystemHapticsClient().perform(.lightImpact)
        transitionSourceFrame = workoutCardFrames[workoutID]
        transitionDestinationFrame = nil
        homeExecutionProgress = 0
        transitioningWorkoutID = workoutID
        model.beginExecution(for: workoutID)
    }

    private func presentHomeOverlay(_ destination: HomeOverlayDestination) {
        guard presentedHomeOverlay == nil, !homeOverlayTransitionIsActive else { return }
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

    private func endExecution() {
        withAnimation(
            reduceMotion ? EQMotion.reducedContentTransition : EQMotion.objectTransformation,
            completionCriteria: .logicallyComplete
        ) {
            homeExecutionProgress = 0
        } completion: {
            guard homeExecutionProgress == 0 else { return }
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

private struct HomeWorkoutTitleLayer: View {
    @Environment(\.homeExecutionTransitionProgress) private var progress
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    let workouts: [Workout]
    let transitioningWorkoutID: WorkoutID?
    let anchors: [HomeWorkoutTitleAnchor: Anchor<CGRect>]
    /// Matches the execution header while a work timer tints it.
    var executionWorkTint: Double = 0

    var body: some View {
        GeometryReader { proxy in
            ForEach(workouts) { workout in
                if let source = anchors[.source(workout.id)] {
                    let sourceFrame = proxy[source]
                    let destinationFrame = anchors[.destination(workout.id)].map { proxy[$0] } ?? sourceFrame
                    let titleProgress = workout.id == transitioningWorkoutID ? progress : 0
                    let frame = sourceFrame.interpolated(to: destinationFrame, progress: titleProgress)
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
                        .scaleEffect(1 - (0.39 * titleProgress), anchor: .center)
                        // This layer floats above the execution page, so other cards' titles must not
                        // show through once the page covers the carousel.
                        .opacity(transitioningWorkoutID == nil || workout.id == transitioningWorkoutID ? 1 : 1 - min(max(progress, 0), 1))
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

enum HomeAddWorkoutVisibility {
    static func showsCarouselDestination(isAtAddWorkoutCard: Bool, scrollIsIdle: Bool) -> Bool {
        isAtAddWorkoutCard && scrollIsIdle
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
        .background(EQColor.Home.canvas)
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
    }

    let title: String
    let systemImage: String
    var iconPlacement: IconPlacement = .bottom
    let accessibilityHint: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: EQSpacing.xxs) {
                if iconPlacement == .top {
                    Image(systemName: systemImage).eqTextStyle(.captionEmphasized)
                }
                Text(title).eqTextStyle(.listItemTitle)
                if iconPlacement == .bottom {
                    Image(systemName: systemImage).eqTextStyle(.captionEmphasized)
                }
            }
            .foregroundStyle(EQColor.Home.timerAffordance)
            .frame(maxWidth: .infinity, minHeight: EQDimension.minimumTouch)
        }
        .buttonStyle(.plain)
        .padding(.horizontal, EQSpacing.lg)
        .padding(.vertical, EQSpacing.sm)
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
    case addWorkout
}

private struct HomeScene: View {
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @Environment(\.homeSurfacePullBlocksInteraction) private var surfacePullBlocksInteraction
    @Namespace private var addWorkoutTransition
    @State private var carouselPosition: HomeCarouselPosition?
    @State private var addWorkoutCardIsVisible = false
    @State private var carouselIsIdle = true
    @State private var homeChromeFrame: CGRect = .zero
    @Bindable var model: HomeModel
    let reduceMotion: Bool
    let transitioningWorkoutID: WorkoutID?
    let reportWorkoutFrame: (WorkoutID, CGRect) -> Void
    let selectWorkout: (WorkoutID) -> Void
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
                addWorkout
                    .modifier(departingHomeEffect(distance: lowerHomeContentDistance))
            }
            .padding(.vertical, EQSpacing.sm)
            Spacer(minLength: 0)
            timerAffordance
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
            Text("Workout of the day").eqTextStyle(.screenTitle)
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
                        addWorkoutCarouselCard(width: geometry.cardWidth)
                    }
                    .scrollTargetLayout()
                }
                .contentMargins(.horizontal, geometry.horizontalGutter, for: .scrollContent)
                .scrollTargetBehavior(.viewAligned(limitBehavior: .always))
                .scrollPosition(id: $carouselPosition, anchor: .center)
                .scrollIndicators(.hidden)
                .scrollClipDisabled()
                .accessibilityLabel("Home workouts")
                .onScrollPhaseChange { _, phase in
                    carouselIsIdle = phase == .idle
                    if carouselIsIdle { synchronizeAddWorkoutTransition() }
                }
                .onChange(of: carouselPosition) { _, _ in
                    if carouselIsIdle { synchronizeAddWorkoutTransition() }
                }
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

    private func addWorkoutCarouselCard(width: CGFloat) -> some View {
        AddWorkoutCarouselCard(
            hasReusableWorkouts: model.hasReusableWorkouts,
            isVisible: addWorkoutCardIsVisible,
            transition: addWorkoutTransition,
            select: { model.creationRoute = $0 }
        )
        .frame(width: width)
        .id(HomeCarouselPosition.addWorkout)
        .scrollTransition(.interactive, axis: .horizontal) { content, phase in
            content.scaleEffect(
                1 - (abs(CGFloat(phase.value)) * 0.1),
                anchor: phase.value < 0 ? .trailing : phase.value > 0 ? .leading : .center
            )
        }
    }

    private func synchronizeAddWorkoutTransition() {
        let showsDestination = HomeAddWorkoutVisibility.showsCarouselDestination(
            isAtAddWorkoutCard: carouselPosition == .addWorkout,
            scrollIsIdle: carouselIsIdle
        )
        guard showsDestination != addWorkoutCardIsVisible else { return }
        withAnimation(reduceMotion ? EQMotion.reducedContentTransition : EQMotion.objectTransformation) {
            addWorkoutCardIsVisible = showsDestination
        }
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


    private var addWorkout: some View {
        HomeAddActionButton(
            accessibilityHint: "Shows options to create, paste, or reuse a workout"
        ) {
            model.isAddWorkoutDrawerPresented = true
        } label: {
            ZStack {
                if !addWorkoutCardIsVisible {
                    HomeAddWorkoutLabel()
                        .matchedGeometryEffect(
                            id: "add-workout-label",
                            in: addWorkoutTransition,
                            properties: .position,
                            anchor: .center
                        )
                }
            }
        }
        .allowsHitTesting(!addWorkoutCardIsVisible)
        .accessibilityHidden(addWorkoutCardIsVisible)
    }

    private var timerAffordance: some View {
        HomeTimerSurfaceButton(
            title: "Timer",
            systemImage: "chevron.down",
            accessibilityHint: "Moves to the standalone timer"
        ) {
            model.primarySurface = .timer
        }
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

private struct AddWorkoutCarouselCard: View {
    let hasReusableWorkouts: Bool
    let isVisible: Bool
    let transition: Namespace.ID
    let select: (CreationRoute) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: EQSpacing.sm) {
            ZStack {
                if isVisible {
                    HomeAddWorkoutLabel()
                        .matchedGeometryEffect(
                            id: "add-workout-label",
                            in: transition,
                            properties: .position,
                            anchor: .center
                        )
                }
            }
            .frame(maxWidth: .infinity, minHeight: EQDimension.minimumTouch, alignment: .center)

            Spacer().frame(height: EQSpacing.xs)

            VStack(alignment: .leading, spacing: EQSpacing.sm) {
                cardAction("Create workout", systemImage: "plus.circle.fill", hint: "Opens the workout builder") {
                    select(.builder(.init()))
                }
                cardAction("Paste/import", systemImage: "doc.on.clipboard", hint: "Imports a workout from text") {
                    select(.pasteWorkout)
                }
                if hasReusableWorkouts {
                    cardAction("Reuse", systemImage: "clock.arrow.circlepath", hint: "Creates a workout from a completed workout") {
                        select(.recent)
                    }
                }
            }
            .opacity(isVisible ? 1 : 0)
            .allowsHitTesting(isVisible)
            .accessibilityHidden(!isVisible)
            Spacer(minLength: 0)
        }
        .padding(EQSpacing.lg)
        .foregroundStyle(EQColor.Home.primaryText)
        .frame(maxWidth: .infinity, minHeight: EQDimension.workoutCardHeight, alignment: .topLeading)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Add Workout")
    }

    private func cardAction(_ title: String, systemImage: String, hint: String, action: @escaping () -> Void) -> some View {
        HomeAddActionButton(accessibilityHint: hint, horizontalPadding: 0, alignment: .leading, action: action) {
            HStack(spacing: EQSpacing.xs) {
                Image(systemName: systemImage)
                Text(title)
            }
        }
    }
}

private struct HomeAddWorkoutLabel: View {
    var body: some View {
        HStack(spacing: EQSpacing.xs) {
            Image(systemName: "plus.circle.fill")
            Text("Add Workout")
        }
        .eqTextStyle(.listItemTitle)
        .foregroundStyle(EQColor.Home.accent)
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
    let transitionSourceFrame: CGRect?
    let reportWalletFrame: (CGRect) -> Void
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
            transitionSourceFrame: transitionSourceFrame,
            reportWalletFrame: reportWalletFrame,
            didPersist: didPersist,
            onExit: exit,
            usesObjectSurface: true
        )
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

private struct AddWorkoutDrawer: View {
    let hasReusableWorkouts: Bool
    let select: (CreationRoute) -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Add Workout").eqTextStyle(.screenTitle)
            LazyVGrid(columns: columns, spacing: EQSpacing.sm) {
                drawerAction("Create", systemImage: "plus", hint: "Opens the workout builder") {
                    choose(.builder(.init()))
                }
                drawerAction("Import", systemImage: "doc.on.doc", hint: "Imports a workout from text") {
                    choose(.pasteWorkout)
                }
                if hasReusableWorkouts {
                    drawerAction("Reuse", systemImage: "clock.arrow.circlepath", hint: "Creates a workout from a completed workout") {
                        choose(.recent)
                    }
                }
            }
            .padding(.top, EQLayout.Home.addWorkoutTitleToCardsSpacing)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, EQSpacing.lg)
        .padding(.top, EQLayout.Home.addWorkoutSheetTopSpacing)
        .padding(.bottom, EQLayout.Home.addWorkoutSheetBottomSpacing)
        .presentationDetents([.height(EQLayout.Home.addWorkoutSheetHeight)])
        .presentationDragIndicator(.visible)
        .presentationBackground(EQColor.elevatedSurface)
    }

    private var columns: [GridItem] {
        Array(
            repeating: GridItem(.flexible(), spacing: EQSpacing.sm),
            count: HomeAddWorkoutDrawerLayout.columnCount(hasReusableWorkouts: hasReusableWorkouts)
        )
    }

    private func drawerAction(_ title: String, systemImage: String, hint: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: EQSpacing.sm) {
                Image(systemName: systemImage)
                    .resizable()
                    .scaledToFit()
                    .fontWeight(.regular)
                    .frame(
                        width: EQLayout.Home.addWorkoutActionIconSize,
                        height: EQLayout.Home.addWorkoutActionIconSize
                    )
                Text(title)
                    .eqTextStyle(.listItemTitle)
            }
            .frame(
                maxWidth: .infinity,
                minHeight: EQLayout.Home.addWorkoutActionCardHeight
            )
            .foregroundStyle(EQColor.Home.accent)
            .background(
                EQColor.cardFill,
                in: RoundedRectangle(cornerRadius: EQRadius.card, style: .continuous)
            )
        }
        .buttonStyle(.plain)
        .accessibilityHint(hint)
    }

    private func choose(_ route: CreationRoute) {
        select(route)
        dismiss()
    }
}

enum HomeAddWorkoutDrawerLayout {
    static func columnCount(hasReusableWorkouts: Bool) -> Int {
        hasReusableWorkouts ? 3 : 2
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
                    .hidden()
            }
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
            surface = EQColor.cardFill
            text = EQColor.primaryText
            secondaryText = EQColor.secondaryText
            statusText = EQColor.secondaryText
            indexText = EQColor.primaryText
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
