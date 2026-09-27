import SwiftUI

struct HomeView: View {
    @State private var model: HomeModel
    private let repository: any WorkoutRepository
    private let exerciseRepository: any ExerciseRepository
    private let historyRepository: any ExerciseHistoryRepository
    private let settingsRepository: any SettingsRepository
    private let progressionRepository: any ProgressionRepository
    @State private var appSettings = AppSettings(weightUnit: .pounds, defaultRestDuration: 90)
    @State private var homePath: [HomeRoute] = []
    @State private var timerPath: [TimerRoute] = []
    @State private var restSessionStore = WorkoutRestSessionStore()
    @State private var homeExecutionProgress: CGFloat = 0
    @State private var transitioningWorkoutID: WorkoutID?
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
            clipsToBounds: transitioningWorkoutID == nil && homePath.isEmpty
        ) {
            ZStack {
                NavigationStack(path: $homePath) {
                    HomeScene(
                        model: model,
                        reduceMotion: reduceMotion,
                        transitioningWorkoutID: transitioningWorkoutID,
                        reportWorkoutFrame: reportWorkoutFrame,
                        selectWorkout: beginExecution
                    )
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .toolbar(.hidden, for: .navigationBar)
                    .navigationDestination(for: HomeRoute.self) { homeDestination($0) }
                }
                .ignoresSafeArea(.container, edges: homePath.isEmpty ? [] : .bottom)

                if let workoutID = model.expandedWorkoutID,
                   let sourceWorkout = model.workouts.first(where: { $0.id == workoutID }) {
                    ExpandedWorkoutExecutionContainer(
                        workoutID: workoutID,
                        sourceWorkout: sourceWorkout,
                        repository: repository,
                        historyRepository: historyRepository,
                        progressionRepository: progressionRepository,
                        exerciseRepository: exerciseRepository,
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
            .overlayPreferenceValue(HomeWorkoutTitleAnchorKey.self) { anchors in
                if homePath.isEmpty {
                    HomeWorkoutTitleLayer(
                        workouts: model.workouts,
                        transitioningWorkoutID: transitioningWorkoutID,
                        anchors: anchors
                    )
                }
            }
            .modifier(HomeExecutionTransitionModifier(progress: homeExecutionProgress))
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
        .task { await loadHomeAndSettings() }
        .task { await refreshAtLocalDayBoundary() }
        .task {
            for await _ in NotificationCenter.default.notifications(named: .equilibriumSettingsDidChange) {
                if let settings = try? await settingsRepository.settings() { appSettings = settings }
            }
        }
        .task {
            for await _ in NotificationCenter.default.notifications(named: .equilibriumRepositoryDidChange) {
                await loadHomeAndSettings()
            }
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active { Task { await loadHomeAndSettings() } }
        }
        .tint(EQColor.accent)
    }

    @ViewBuilder private func homeDestination(_ route: HomeRoute) -> some View {
        switch route {
        case .settings:
            SettingsShellView(settingsRepository: settingsRepository, progressionRepository: progressionRepository, exerciseRepository: exerciseRepository, legacyImporter: legacyImporter)
                .onDisappear { Task { if let settings = try? await settingsRepository.settings() { appSettings = settings } } }
        case .history:
            WorkoutHistoryView(repository: repository, historyRepository: historyRepository, weightUnit: appSettings.weightUnit)
        }
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

enum HomeRoute: Hashable { case settings, history }

enum HomeWorkoutTransitionIdentity {
    static func surface(for id: WorkoutID) -> String { "home-workout-\(id.rawValue)" }
    static func title(for id: WorkoutID) -> String { "home-workout-title-\(id.rawValue)" }
}

enum HomeWorkoutTitleAnchor: Hashable {
    case source(WorkoutID)
    case destination(WorkoutID)
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
    let workouts: [Workout]
    let transitioningWorkoutID: WorkoutID?
    let anchors: [HomeWorkoutTitleAnchor: Anchor<CGRect>]

    var body: some View {
        GeometryReader { proxy in
            ForEach(workouts) { workout in
                if let source = anchors[.source(workout.id)] {
                    let sourceFrame = proxy[source]
                    let destinationFrame = anchors[.destination(workout.id)].map { proxy[$0] } ?? sourceFrame
                    let titleProgress = workout.id == transitioningWorkoutID ? progress : 0
                    let frame = sourceFrame.interpolated(to: destinationFrame, progress: titleProgress)
                    Text(workout.titleSnapshot)
                        .font(EQTypography.cardHero)
                        .lineLimit(2)
                        .scaleEffect(1 - (0.39 * titleProgress), anchor: .center)
                        .id(HomeWorkoutTransitionIdentity.title(for: workout.id))
                        .position(x: frame.midX, y: frame.midY)
                        .accessibilityHidden(true)
                }
            }
        }
        .allowsHitTesting(false)
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
        content.environment(\.homeExecutionTransitionProgress, progress)
    }
}

private struct HomeExecutionTransitionProgressKey: EnvironmentKey {
    static let defaultValue: CGFloat = 1
}

extension EnvironmentValues {
    var homeExecutionTransitionProgress: CGFloat {
        get { self[HomeExecutionTransitionProgressKey.self] }
        set { self[HomeExecutionTransitionProgressKey.self] = newValue }
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

private struct HomeTimerContainer<HomeContent: View, TimerContent: View>: View {
    @Binding var primarySurface: HomePrimarySurface
    let reduceMotion: Bool
    let clipsToBounds: Bool
    let homeContent: HomeContent
    let timerContent: TimerContent

    init(
        primarySurface: Binding<HomePrimarySurface>,
        reduceMotion: Bool,
        clipsToBounds: Bool,
        @ViewBuilder home: () -> HomeContent,
        @ViewBuilder timer: () -> TimerContent
    ) {
        _primarySurface = primarySurface
        self.reduceMotion = reduceMotion
        self.clipsToBounds = clipsToBounds
        homeContent = home()
        timerContent = timer()
    }

    var body: some View {
        GeometryReader { proxy in
            ZStack {
                homeContent
                    .frame(width: proxy.size.width, height: proxy.size.height)
                    .offset(y: reduceMotion || primarySurface == .home ? 0 : -proxy.size.height)
                    .opacity(primarySurface == .home ? 1 : reduceMotion ? 0 : 1)
                    .allowsHitTesting(primarySurface == .home)
                    .accessibilityHidden(primarySurface != .home)
                timerContent
                    .frame(width: proxy.size.width, height: proxy.size.height)
                    .offset(y: reduceMotion || primarySurface == .timer ? 0 : proxy.size.height)
                    .opacity(primarySurface == .timer ? 1 : reduceMotion || !clipsToBounds ? 0 : 1)
                    .allowsHitTesting(primarySurface == .timer)
                    .accessibilityHidden(primarySurface != .timer)
            }
            .modifier(HomeTimerClippingModifier(clipsToBounds: clipsToBounds))
            .animation(reduceMotion ? EQMotion.reducedContentTransition : EQMotion.surfaceReveal, value: primarySurface)
        }
        .background(EQColor.canvas)
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

private enum HomeCarouselPosition: Hashable {
    case workout(WorkoutID)
    case addWorkout
}

private struct HomeScene: View {
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @Environment(\.homeExecutionTransitionProgress) private var executionProgress
    @Namespace private var addWorkoutTransition
    @State private var carouselPosition: HomeCarouselPosition?
    @State private var addWorkoutCardIsVisible = false
    @State private var homeChromeFrame: CGRect = .zero
    @Bindable var model: HomeModel
    let reduceMotion: Bool
    let transitioningWorkoutID: WorkoutID?
    let reportWorkoutFrame: (WorkoutID, CGRect) -> Void
    let selectWorkout: (WorkoutID) -> Void

    private var isExecutionExpanded: Bool { transitioningWorkoutID != nil }

    private var homeChromeOffset: CGFloat {
        guard !reduceMotion else { return 0 }
        return -homeChromeFrame.maxY * executionProgress
    }

    private var lowerHomeContentOffset: CGFloat {
        guard !reduceMotion else { return 0 }
        return max(homeChromeFrame.height, EQDimension.workoutCardHeight) * executionProgress
    }

    private var departingHomeOpacity: Double {
        let destinationOpacity: CGFloat = reduceMotion ? 0 : 0.18
        return Double(1 - ((1 - destinationOpacity) * executionProgress))
    }

    var body: some View {
        VStack(spacing: 0) {
            ScrollView {
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
                    .offset(y: homeChromeOffset)
                    .opacity(departingHomeOpacity)
                    carousel
                        .padding(.top, EQSpacing.lg)
                    addWorkout
                        .offset(y: lowerHomeContentOffset)
                        .opacity(departingHomeOpacity)
                }
                .padding(.vertical, EQSpacing.sm)
            }
            .scrollIndicators(.hidden)
            .scrollClipDisabled()
            .scrollDisabled(isExecutionExpanded)
            .refreshable { await model.load() }
            timerAffordance
                .offset(y: lowerHomeContentOffset)
                .opacity(departingHomeOpacity)
        }
        .background(EQColor.canvas.ignoresSafeArea())
        .allowsHitTesting(!isExecutionExpanded)
    }

    private var header: some View {
        HStack(alignment: .center, spacing: EQSpacing.md) {
            Text("Home").font(EQTypography.title).hidden()
            Spacer(minLength: EQSpacing.sm)
            HStack(spacing: EQSpacing.xs) {
                NavigationLink(value: HomeRoute.history) {
                    Image(systemName: "clock.arrow.circlepath")
                        .font(.system(size: 16))
                        .frame(width: 16, height: 16)
                        .frame(width: 32, height: 32)
                        .contentShape(Rectangle())
                }
                .accessibilityLabel("Workout history")
                NavigationLink(value: HomeRoute.settings) {
                    Image(systemName: "gearshape")
                        .font(.system(size: 16))
                        .frame(width: 16, height: 16)
                        .frame(width: 32, height: 32)
                        .contentShape(Rectangle())
                }
                .accessibilityLabel("Settings")
            }
        }
        .frame(minHeight: EQDimension.minimumTouch, alignment: .center)
        .padding(.horizontal, EQSpacing.lg)
    }

    private var workoutOfTheDay: some View {
        VStack(alignment: .leading, spacing: EQSpacing.xs) {
            Text("Workout of the day").font(EQTypography.sectionTitle)
            homeDate
        }
        .padding(.horizontal, EQSpacing.lg)
    }

    private var homeDate: some View {
        let date = Date.now
        let day = Calendar.current.component(.day, from: date)
        let month = date.formatted(.dateTime.month(.wide))
        let suffix: String = switch day {
        case 11...13: "th"
        default: switch day % 10 {
            case 1: "st"
            case 2: "nd"
            case 3: "rd"
            default: "th"
            }
        }

        return HStack(alignment: .firstTextBaseline, spacing: 0) {
            Text("\(month) \(day)")
                .font(EQTypography.sectionTitle)
            Text(suffix)
                .font(EQTypography.caption)
                .baselineOffset(7)
        }
        .foregroundStyle(EQColor.secondaryText)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(month) \(day)\(suffix)")
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
                                dispersalWidth: max(proxy.size.width, proxy.size.height),
                                viewportWidth: proxy.size.width
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
                .onAppear {
                    if carouselPosition == nil, let firstID = model.workouts.first?.id {
                        carouselPosition = .workout(firstID)
                    }
                }
            }
            .frame(height: dynamicTypeSize.isAccessibilitySize ? 380 : EQDimension.workoutCardHeight)
        }
    }

    private func carouselCard(_ workout: Workout, sequence: Int, width: CGFloat, dispersalWidth: CGFloat, viewportWidth: CGFloat) -> some View {
        Button {
            carouselPosition = .workout(workout.id)
            selectWorkout(workout.id)
        } label: {
            WorkoutCard(
                workout: workout,
                sequence: sequence,
                carouselViewportWidth: viewportWidth,
                isExpanded: model.expandedWorkoutID == workout.id,
                expansionProgress: workout.id == transitioningWorkoutID ? executionProgress : 0,
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
        .offset(x: siblingOffset(for: workout, width: dispersalWidth))
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
        .onScrollVisibilityChange(threshold: 0.2) { isVisible in
            withAnimation(reduceMotion ? EQMotion.reducedContentTransition : EQMotion.objectTransformation) {
                addWorkoutCardIsVisible = isVisible
            }
        }
    }

    private func siblingOffset(for workout: Workout, width: CGFloat) -> CGFloat {
        guard !reduceMotion,
              let expandedWorkoutID = transitioningWorkoutID,
              let selectedIndex = model.workouts.firstIndex(where: { $0.id == expandedWorkoutID }),
              let index = model.workouts.firstIndex(where: { $0.id == workout.id }),
              index != selectedIndex else { return 0 }
        return (index < selectedIndex ? -width : width) * executionProgress
    }


    private var addWorkout: some View {
        Button { model.isAddWorkoutDrawerPresented = true } label: {
            ZStack {
                if !addWorkoutCardIsVisible {
                    HStack(spacing: EQSpacing.xs) {
                        Image(systemName: "plus.circle.fill")
                        Text("Add Workout")
                            .matchedGeometryEffect(id: "add-workout-title", in: addWorkoutTransition)
                    }
                }
            }
            .font(EQTypography.cardTitle)
            .frame(maxWidth: .infinity, minHeight: EQDimension.minimumTouch)
        }
        .buttonStyle(.plain)
        .foregroundStyle(EQColor.accent)
        .padding(.horizontal, EQSpacing.lg)
        .allowsHitTesting(!addWorkoutCardIsVisible)
        .accessibilityHidden(addWorkoutCardIsVisible)
        .accessibilityHint("Shows options to create, paste, or reuse a workout")
    }

    private var timerAffordance: some View {
        Button { model.primarySurface = .timer } label: {
            VStack(spacing: EQSpacing.xxs) {
                Text("Timer").font(EQTypography.cardTitle)
                Image(systemName: "chevron.down").font(EQTypography.caption.weight(.bold))
            }
            .foregroundStyle(EQColor.secondaryText)
            .frame(maxWidth: .infinity, minHeight: EQDimension.minimumTouch)
        }
        .buttonStyle(.plain)
        .padding(.horizontal, EQSpacing.lg)
        .padding(.vertical, EQSpacing.sm)
        .accessibilityHint("Moves to the standalone timer")
    }

    private var loadError: some View {
        HStack(alignment: .center, spacing: EQSpacing.sm) {
            Label("Workouts could not be loaded.", systemImage: "exclamationmark.triangle.fill")
                .font(EQTypography.body).foregroundStyle(EQColor.warning)
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
            if isVisible {
                Text("ADD WORKOUT")
                    .font(EQTypography.caption.weight(.bold))
                    .foregroundStyle(EQColor.secondaryText)
                    .matchedGeometryEffect(id: "add-workout-title", in: transition)

                Spacer().frame(height: EQSpacing.xs)

                cardAction("Create workout", systemImage: "plus") {
                    select(.builder(.init()))
                }
                cardAction("Paste/import", systemImage: "doc.on.clipboard") {
                    select(.pasteWorkout)
                }
                if hasReusableWorkouts {
                    cardAction("Reuse", systemImage: "clock.arrow.circlepath") {
                        select(.recent)
                    }
                }
            } else {
                Color.clear
            }
            Spacer(minLength: 0)
        }
        .padding(EQSpacing.lg)
        .foregroundStyle(EQColor.primaryText)
        .frame(maxWidth: .infinity, minHeight: EQDimension.workoutCardHeight, alignment: .topLeading)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Add Workout")
    }

    private func cardAction(_ title: String, systemImage: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Label(title, systemImage: systemImage)
                .font(EQTypography.body)
                .frame(maxWidth: .infinity, minHeight: EQDimension.minimumTouch, alignment: .leading)
        }
        .buttonStyle(.plain)
    }
}

private struct ExpandedWorkoutExecutionContainer: View {
    let workoutID: WorkoutID
    let sourceWorkout: Workout
    let repository: any WorkoutRepository
    let historyRepository: any ExerciseHistoryRepository
    let progressionRepository: any ProgressionRepository
    let exerciseRepository: any ExerciseRepository
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
        VStack(alignment: .leading, spacing: EQSpacing.md) {
            Text("Add Workout").font(EQTypography.sectionTitle)
            drawerAction("Create workout", systemImage: "plus") { choose(.builder(.init())) }
            drawerAction("Paste/import", systemImage: "doc.on.clipboard") { choose(.pasteWorkout) }
            if hasReusableWorkouts {
                drawerAction("Reuse", systemImage: "clock.arrow.circlepath") { choose(.recent) }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(EQSpacing.lg)
        .presentationDetents([.height(hasReusableWorkouts ? 260 : 205)])
        .presentationDragIndicator(.visible)
        .presentationBackground(EQColor.elevatedSurface)
    }

    private func drawerAction(_ title: String, systemImage: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Label(title, systemImage: systemImage)
                .font(EQTypography.body)
                .frame(maxWidth: .infinity, minHeight: EQDimension.minimumTouch, alignment: .leading)
        }
        .buttonStyle(.plain)
        .foregroundStyle(EQColor.primaryText)
    }

    private func choose(_ route: CreationRoute) {
        select(route)
        dismiss()
    }
}

private struct WorkoutCard: View {
    let workout: Workout
    let sequence: Int
    let carouselViewportWidth: CGFloat
    var isExpanded = false
    var expansionProgress: CGFloat = 0
    let reportFrame: (CGRect) -> Void
    private var presentation: HomeCardPresentation { .init(status: workout.status) }
    private var selectedMetadataOpacity: Double {
        let clearingProgress = min(max(expansionProgress / 0.18, 0), 1)
        return Double(1 - clearingProgress)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: EQSpacing.md) {
            ZStack(alignment: .leading) {
                Text(workout.titleSnapshot)
                    .font(EQTypography.cardHero)
                    .lineLimit(2)
                    .hidden()
            }
            .anchorPreference(key: HomeWorkoutTitleAnchorKey.self, value: .bounds) {
                [.source(workout.id): $0]
            }

            Text("\(workout.exercises.count) \(workout.exercises.count == 1 ? "exercise" : "exercises")")
                .font(EQTypography.caption)
                .foregroundStyle(EQColor.secondaryText)
                .opacity(selectedMetadataOpacity)
            Spacer()
            Text(presentation.stateLabel)
                .font(EQTypography.caption)
                .foregroundStyle(statusColor)
                .opacity(selectedMetadataOpacity)
        }
        .padding(.horizontal, EQSpacing.lg)
        .padding(.bottom, EQSpacing.lg)
        .padding(.top, 20)
        .foregroundStyle(EQColor.primaryText)
        .frame(maxWidth: .infinity, minHeight: EQDimension.workoutCardHeight, alignment: .topLeading)
        .background(alignment: .bottomTrailing) {
            Text("\(sequence)")
                .font(.system(size: 180, weight: .bold, design: .rounded))
                .foregroundStyle(EQColor.primaryText.opacity(0.08))
                .lineLimit(1)
                .minimumScaleFactor(0.5)
                .offset(x: EQSpacing.xs, y: EQSpacing.xl)
                .opacity(selectedMetadataOpacity)
                .accessibilityHidden(true)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomTrailing)
            .visualEffect { content, proxy in
                let frame = proxy.frame(in: .scrollView(axis: .horizontal))
                let distance = frame.midX - (carouselViewportWidth / 2)
                let phase = min(max(distance / max(frame.width, 1), -1), 1)
                return content.offset(x: -(phase * EQSpacing.lg))
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: EQRadius.transformingCard, style: .continuous))
        .onGeometryChange(for: CGRect.self) { proxy in
            proxy.frame(in: .global)
        } action: { frame in
            reportFrame(frame)
        }
        .background {
            if !isExpanded {
                RoundedRectangle(cornerRadius: EQRadius.transformingCard, style: .continuous)
                    .fill(EQColor.surface)
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityHidden(isExpanded)
    }

    private var statusColor: Color { workout.status == .completed ? EQColor.success : EQColor.accent }
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
