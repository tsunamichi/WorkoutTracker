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
    private let timerStore: any StandaloneTimerConfigurationStore
    private let legacyImporter: RNLegacyImporter?
    @Namespace private var workoutTransition
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
        HomeTimerContainer(primarySurface: $model.primarySurface, reduceMotion: reduceMotion) {
            NavigationStack(path: $homePath) {
                ZStack {
                    HomeScene(model: model, namespace: workoutTransition, reduceMotion: reduceMotion, selectWorkout: beginExecution)
                    if let workoutID = model.expandedWorkoutID {
                        ExpandedWorkoutExecutionContainer(
                            workoutID: workoutID,
                            repository: repository,
                            historyRepository: historyRepository,
                            progressionRepository: progressionRepository,
                            exerciseRepository: exerciseRepository,
                            weightUnit: appSettings.weightUnit,
                            defaultRestDuration: appSettings.defaultRestDuration,
                            namespace: workoutTransition,
                            reduceMotion: reduceMotion,
                            didPersist: model.applyPersistedWorkout,
                            exit: endExecution
                        )
                        .zIndex(1)
                    }
                }
                .toolbar(.hidden, for: .navigationBar)
                .navigationDestination(for: HomeRoute.self) { homeDestination($0) }
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
        if reduceMotion { model.beginExecution(for: workoutID) }
        else { withAnimation(.easeInOut(duration: EQMotion.standard)) { model.beginExecution(for: workoutID) } }
    }

    private func endExecution() {
        if reduceMotion { model.endExecution() }
        else { withAnimation(.easeInOut(duration: EQMotion.standard)) { model.endExecution() } }
        Task { await model.load() }
    }
}

enum HomeRoute: Hashable { case settings, history }

private enum HomeWorkoutObjectIdentity {
    static func value(for id: WorkoutID) -> String { "home-workout-\(id.rawValue)" }
}

private struct HomeTimerContainer<HomeContent: View, TimerContent: View>: View {
    @Binding var primarySurface: HomePrimarySurface
    let reduceMotion: Bool
    let homeContent: HomeContent
    let timerContent: TimerContent

    init(primarySurface: Binding<HomePrimarySurface>, reduceMotion: Bool, @ViewBuilder home: () -> HomeContent, @ViewBuilder timer: () -> TimerContent) {
        _primarySurface = primarySurface
        self.reduceMotion = reduceMotion
        homeContent = home()
        timerContent = timer()
    }

    var body: some View {
        GeometryReader { proxy in
            ZStack {
                homeContent
                    .frame(width: proxy.size.width, height: proxy.size.height)
                    .offset(y: primarySurface == .home ? 0 : -proxy.size.height)
                    .allowsHitTesting(primarySurface == .home)
                    .accessibilityHidden(primarySurface != .home)
                timerContent
                    .frame(width: proxy.size.width, height: proxy.size.height)
                    .offset(y: primarySurface == .timer ? 0 : proxy.size.height)
                    .allowsHitTesting(primarySurface == .timer)
                    .accessibilityHidden(primarySurface != .timer)
            }
            .clipped()
            .animation(reduceMotion ? nil : .easeInOut(duration: EQMotion.standard), value: primarySurface)
        }
        .background(EQColor.canvas)
    }
}

private struct HomeScene: View {
    @Bindable var model: HomeModel
    let namespace: Namespace.ID
    let reduceMotion: Bool
    let selectWorkout: (WorkoutID) -> Void

    private var isExecutionExpanded: Bool { model.expandedWorkoutID != nil }

    var body: some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: EQSpacing.lg) {
                    Group {
                        header
                        if model.errorMessage != nil { loadError }
                        workoutOfTheDay
                    }
                    .offset(y: isExecutionExpanded ? -EQDimension.workoutCardHeight : 0)
                    .opacity(isExecutionExpanded ? 0 : 1)
                    carousel
                    addWorkout
                        .offset(y: isExecutionExpanded ? EQDimension.workoutCardHeight : 0)
                        .opacity(isExecutionExpanded ? 0 : 1)
                }
                .padding(.vertical, EQSpacing.sm)
            }
            .scrollIndicators(.hidden)
            .scrollDisabled(isExecutionExpanded)
            .refreshable { await model.load() }
            timerAffordance
                .offset(y: isExecutionExpanded ? EQDimension.workoutCardHeight : 0)
                .opacity(isExecutionExpanded ? 0 : 1)
        }
        .background(EQColor.canvas.ignoresSafeArea())
        .allowsHitTesting(!isExecutionExpanded)
        .animation(reduceMotion ? nil : .easeInOut(duration: EQMotion.standard), value: model.expandedWorkoutID)
    }

    private var header: some View {
        HStack(alignment: .top, spacing: EQSpacing.md) {
            Text("Home").font(EQTypography.title)
            Spacer(minLength: EQSpacing.sm)
            HStack(spacing: EQSpacing.xs) {
                NavigationLink(value: HomeRoute.history) { Label("Workout history", systemImage: "clock.arrow.circlepath") }
                NavigationLink(value: HomeRoute.settings) { Label("Settings", systemImage: "gearshape") }
            }
            .font(EQTypography.caption)
            .labelStyle(.iconOnly)
        }
        .frame(minHeight: EQDimension.minimumTouch, alignment: .top)
        .padding(.horizontal, EQSpacing.lg)
    }

    private var workoutOfTheDay: some View {
        VStack(alignment: .leading, spacing: EQSpacing.xs) {
            Text("Workout of the day").font(EQTypography.sectionTitle)
            Text(Date.now, format: .dateTime.weekday(.wide).month(.wide).day())
                .font(EQTypography.caption).foregroundStyle(EQColor.secondaryText)
            Text(model.workouts.isEmpty ? "Build a workout for today, or keep an active workout going." : "Your active workouts and today’s completed workouts.")
                .font(EQTypography.body).foregroundStyle(EQColor.secondaryText)
        }
        .padding(.horizontal, EQSpacing.lg)
    }

    @ViewBuilder private var carousel: some View {
        if model.workouts.isEmpty {
            ContentUnavailableView("No workouts on Home", systemImage: "dumbbell", description: Text("Add a workout to get started."))
                .frame(maxWidth: .infinity, minHeight: EQDimension.workoutCardHeight)
                .padding(.horizontal, EQSpacing.lg)
        } else {
            GeometryReader { proxy in
                ScrollView(.horizontal) {
                    LazyHStack(spacing: EQSpacing.md) {
                        ForEach(Array(model.workouts.enumerated()), id: \.element.id) { index, workout in
                            Button { selectWorkout(workout.id) } label: { WorkoutCard(workout: workout, sequence: index + 1) }
                                .buttonStyle(.plain)
                                .matchedGeometryEffect(id: HomeWorkoutObjectIdentity.value(for: workout.id), in: namespace, isSource: model.expandedWorkoutID == workout.id)
                                .containerRelativeFrame(.horizontal, count: 1, spacing: EQSpacing.md)
                                .offset(x: siblingOffset(for: workout, width: max(proxy.size.width, proxy.size.height)))
                                .opacity(model.expandedWorkoutID == workout.id ? 0 : 1)
                        }
                    }
                    .scrollTargetLayout()
                    .padding(.horizontal, EQSpacing.lg)
                }
                .scrollTargetBehavior(.viewAligned(limitBehavior: .always))
                .scrollIndicators(.hidden)
                .accessibilityLabel("Home workouts")
            }
            .frame(height: EQDimension.workoutCardHeight)
        }
    }

    private func siblingOffset(for workout: Workout, width: CGFloat) -> CGFloat {
        guard let expandedWorkoutID = model.expandedWorkoutID,
              let selectedIndex = model.workouts.firstIndex(where: { $0.id == expandedWorkoutID }),
              let index = model.workouts.firstIndex(where: { $0.id == workout.id }),
              index != selectedIndex else { return 0 }
        return index < selectedIndex ? -width : width
    }


    private var addWorkout: some View {
        Button { model.isAddWorkoutDrawerPresented = true } label: {
            Label("Add Workout", systemImage: "plus.circle.fill")
                .font(EQTypography.cardTitle)
                .frame(maxWidth: .infinity, minHeight: EQDimension.minimumTouch)
        }
        .buttonStyle(.plain)
        .foregroundStyle(EQColor.accent)
        .padding(.horizontal, EQSpacing.lg)
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

private struct ExpandedWorkoutExecutionContainer: View {
    let workoutID: WorkoutID
    let repository: any WorkoutRepository
    let historyRepository: any ExerciseHistoryRepository
    let progressionRepository: any ProgressionRepository
    let exerciseRepository: any ExerciseRepository
    let weightUnit: WeightUnit
    let defaultRestDuration: TimeInterval
    let namespace: Namespace.ID
    let reduceMotion: Bool
    let didPersist: (Workout) -> Void
    let exit: () -> Void

    var body: some View {
        GeometryReader { proxy in
            ZStack {
                EQColor.surface
                WorkoutExecutionView(
                    id: workoutID,
                    repository: repository,
                    historyRepository: historyRepository,
                    progressionRepository: progressionRepository,
                    exerciseRepository: exerciseRepository,
                    weightUnit: weightUnit,
                    defaultRestDuration: defaultRestDuration,
                    didPersist: didPersist,
                    onExit: exit,
                    usesObjectSurface: true
                )
            }
            .frame(width: proxy.size.width, height: proxy.size.height)
            .clipShape(RoundedRectangle(cornerRadius: 0, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 0, style: .continuous).stroke(EQColor.separator))
            .matchedGeometryEffect(id: HomeWorkoutObjectIdentity.value(for: workoutID), in: namespace, isSource: false)
            .transition(reduceMotion ? .opacity : .identity)
        }
        .ignoresSafeArea()
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
    let workout: Workout; let sequence: Int
    private var presentation: HomeCardPresentation { .init(status: workout.status) }
    var body: some View {
        VStack(alignment: .leading, spacing: EQSpacing.md) {
            HStack {
                Text(String(format: "%02d", sequence)).font(EQTypography.caption).foregroundStyle(EQColor.secondaryText)
                Spacer()
                Label(presentation.stateLabel, systemImage: workout.status == .completed ? "checkmark.circle.fill" : workout.status == .inProgress ? "play.circle.fill" : "circle")
                    .font(EQTypography.caption).foregroundStyle(workout.status == .completed ? EQColor.success : EQColor.accent)
            }
            Text(workout.titleSnapshot).font(EQTypography.cardHero).lineLimit(2)
            Text("\(workout.exercises.count) \(workout.exercises.count == 1 ? "exercise" : "exercises")").font(EQTypography.caption).foregroundStyle(EQColor.secondaryText)
            Spacer(); Divider().overlay(EQColor.separator); Text(presentation.actionLabel).font(EQTypography.cardTitle)
        }
        .foregroundStyle(EQColor.primaryText).padding(EQSpacing.lg)
        .frame(maxWidth: .infinity, minHeight: EQDimension.workoutCardHeight, alignment: .topLeading)
        .background(EQColor.surface, in: RoundedRectangle(cornerRadius: EQRadius.hero, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: EQRadius.hero, style: .continuous).stroke(EQColor.separator))
        .accessibilityElement(children: .combine)
    }
}

private struct HomeZoomModifier: ViewModifier {
    let id: String; let namespace: Namespace.ID; let reduceMotion: Bool
    @ViewBuilder func body(content: Content) -> some View { if reduceMotion { content } else { content.navigationTransition(.zoom(sourceID: id, in: namespace)) } }
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
