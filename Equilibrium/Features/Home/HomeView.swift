import SwiftUI

struct HomeView: View {
    @State private var model: HomeModel
    private let repository: any WorkoutRepository
    private let exerciseRepository: any ExerciseRepository
    private let historyRepository: any ExerciseHistoryRepository
    private let settingsRepository: any SettingsRepository
    private let progressionRepository: any ProgressionRepository
    @State private var appSettings = AppSettings(weightUnit: .pounds, defaultRestDuration: 90)
    @State private var path: [HomeRoute] = []
    private let timerStore: any StandaloneTimerConfigurationStore
    private let legacyImporter: RNLegacyImporter?
    @Namespace private var workoutTransition
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
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
        NavigationStack(path: $path) {
            ZStack {
                EQColor.canvas.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: EQSpacing.lg) {
                        header
                        if model.errorMessage != nil { loadError }
                        carousel
                        timer
                    }
                        .padding(.vertical, EQSpacing.sm)
                }.scrollIndicators(.hidden).refreshable { await model.load() }
            }
            .toolbar(.hidden, for: .navigationBar)
            .navigationDestination(for: HomeRoute.self) { destination($0) }
            .sheet(item: $model.creationRoute) { route in
                AddWorkoutSheet(initialRoute: route, exercises: exerciseRepository, workouts: repository, history: historyRepository) { created in
                    model.applyPersistedWorkouts(created)
                }
            }
            .task { await model.load(); if let settings = try? await settingsRepository.settings() { appSettings = settings } }
            .task {
                for await _ in NotificationCenter.default.notifications(named: .equilibriumSettingsDidChange) {
                    if let settings = try? await settingsRepository.settings() { appSettings = settings }
                }
            }
            .task {
                for await _ in NotificationCenter.default.notifications(named: .equilibriumRepositoryDidChange) {
                    await model.load()
                    if let settings = try? await settingsRepository.settings() { appSettings = settings }
                }
            }
        }.tint(EQColor.accent)
    }

    private var loadError: some View {
        HStack(alignment: .center, spacing: EQSpacing.sm) {
            Label("Workouts could not be loaded.", systemImage: "exclamationmark.triangle.fill")
                .font(EQTypography.body).foregroundStyle(EQColor.warning)
            Spacer(minLength: EQSpacing.sm)
            Button("Retry") { Task { await model.load() } }
                .buttonStyle(.bordered).frame(minHeight: EQDimension.minimumTouch)
                .accessibilityHint("Attempts to load active workouts again")
        }
        .padding(EQSpacing.md).background(EQColor.surface, in: RoundedRectangle(cornerRadius: EQRadius.card, style: .continuous))
        .padding(.horizontal, EQSpacing.lg)
        .accessibilityElement(children: .contain)
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: EQSpacing.sm) {
            Text("Workouts").font(EQTypography.title)
            HStack {
                NavigationLink("Workout history", value: HomeRoute.history).font(EQTypography.caption)
                Spacer()
                NavigationLink(value: HomeRoute.settings) { Label("Settings", systemImage: "gearshape") }
                    .font(EQTypography.caption)
            }.frame(minHeight: EQDimension.minimumTouch)
        }.padding(.horizontal, EQSpacing.lg)
    }

    private var carousel: some View {
        ScrollView(.horizontal) {
            LazyHStack(spacing: EQSpacing.md) {
                ForEach(Array(model.workouts.enumerated()), id: \.element.id) { index, workout in
                    NavigationLink(value: HomeRoute.workout(workout.id)) { WorkoutCard(workout: workout, sequence: index + 1) }
                        .buttonStyle(.plain)
                        .matchedTransitionSource(id: workout.id.rawValue, in: workoutTransition)
                        .containerRelativeFrame(.horizontal, count: 1, spacing: EQSpacing.md)
                }
                AddWorkoutCard { model.creationRoute = $0 }
                    .containerRelativeFrame(.horizontal, count: 1, spacing: EQSpacing.md)
            }.scrollTargetLayout().padding(.horizontal, EQSpacing.lg)
        }
        .scrollTargetBehavior(.viewAligned(limitBehavior: .always))
        .scrollIndicators(.hidden)
        .accessibilityLabel("Active workouts")
    }

    private var timer: some View {
        NavigationLink(value: HomeRoute.timer) {
            HStack { Image(systemName: "timer"); Text("Timer"); Spacer(); Image(systemName: "chevron.right") }
                .frame(minHeight: EQDimension.minimumTouch)
        }.buttonStyle(.plain).padding(.horizontal, EQSpacing.lg).accessibilityHint("Opens a standalone countdown timer")
    }

    @ViewBuilder private func destination(_ route: HomeRoute) -> some View {
        switch route {
        case .workout(let id):
            WorkoutExecutionView(id: id, repository: repository, historyRepository: historyRepository, progressionRepository: progressionRepository, exerciseRepository: exerciseRepository, weightUnit: appSettings.weightUnit, defaultRestDuration: appSettings.defaultRestDuration) { model.applyPersistedWorkout($0) }
                .onDisappear { Task { await model.load() } }
                .modifier(HomeZoomModifier(id: id.rawValue, namespace: workoutTransition, reduceMotion: reduceMotion))
        case .settings: SettingsShellView(settingsRepository: settingsRepository, progressionRepository: progressionRepository, exerciseRepository: exerciseRepository, legacyImporter: legacyImporter).onDisappear { Task { if let settings = try? await settingsRepository.settings() { appSettings = settings } } }
        case .history: WorkoutHistoryView(repository: repository, historyRepository: historyRepository, weightUnit: appSettings.weightUnit)
        case .timer: StandaloneTimerView(store: timerStore, path: $path)
        case .timerCreate:
            StandaloneTimerFormView(store: timerStore) { created in path = StandaloneTimerNavigationPolicy.replacingCreation(in: path, withRunID: created.id) }
        case .timerEdit(let id):
            if let configuration = timerStore.configurations().first(where: { $0.id == id }) {
                StandaloneTimerFormView(store: timerStore, configuration: configuration) { _ in if !path.isEmpty { path.removeLast() } }
            } else { ContentUnavailableView("Timer unavailable", systemImage: "timer") }
        case .timerRun(let id):
            if let configuration = timerStore.configurations().first(where: { $0.id == id }) {
                StandaloneTimerRunView(configuration: configuration)
            } else { ContentUnavailableView("Timer unavailable", systemImage: "timer") }
        }
    }
}

enum HomeRoute: Hashable { case workout(WorkoutID), settings, history, timer, timerCreate, timerEdit(String), timerRun(String) }

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

private struct AddWorkoutCard: View {
    let select: (CreationRoute) -> Void
    var body: some View {
        VStack(alignment: .leading, spacing: EQSpacing.md) {
            Image(systemName: "plus.circle.fill").font(.title).foregroundStyle(EQColor.accent)
            Text("ADD WORKOUT").font(EQTypography.cardHero)
            VStack(alignment: .leading, spacing: EQSpacing.xs) {
                Button("Create from scratch") { select(.builder(.init())) }.frame(minHeight: EQDimension.minimumTouch)
                Button("Paste workout") { select(.pasteWorkout) }.frame(minHeight: EQDimension.minimumTouch)
                Button("Use recent workout") { select(.recent) }.frame(minHeight: EQDimension.minimumTouch)
            }.font(EQTypography.body).buttonStyle(.plain).foregroundStyle(EQColor.secondaryText)
        }.foregroundStyle(EQColor.primaryText).padding(EQSpacing.lg)
            .frame(maxWidth: .infinity, minHeight: EQDimension.workoutCardHeight, alignment: .topLeading)
            .background(EQColor.surface, in: RoundedRectangle(cornerRadius: EQRadius.hero, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: EQRadius.hero, style: .continuous).stroke(EQColor.separator))
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
