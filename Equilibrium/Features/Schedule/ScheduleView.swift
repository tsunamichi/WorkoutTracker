import SwiftUI

struct HomeView: View {
    @State private var model: HomeModel
    private let repository: any ScheduledWorkoutRepository
    private let exerciseRepository: any ExerciseRepository
    private let historyRepository: any ExerciseHistoryRepository
    @Namespace private var workoutTransition
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.scenePhase) private var scenePhase
    @AppStorage(EQPreferenceKey.weightUnit) private var weightUnitRaw = WeightUnit.pounds.rawValue

    init(repository: any ScheduledWorkoutRepository, exerciseRepository: (any ExerciseRepository)? = nil, historyRepository: (any ExerciseHistoryRepository)? = nil) {
        self.repository = repository
        guard let shared = repository as? SwiftDataRepository else {
            precondition(exerciseRepository != nil && historyRepository != nil, "Creation repositories are required")
            self.exerciseRepository = exerciseRepository!; self.historyRepository = historyRepository!
            _model = State(initialValue: HomeModel(repository: repository)); return
        }
        self.exerciseRepository = exerciseRepository ?? shared; self.historyRepository = historyRepository ?? shared
        _model = State(initialValue: HomeModel(repository: repository))
    }

    var body: some View {
        NavigationStack {
            ZStack {
                EQColor.canvas.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: EQSpacing.lg) { header; carousel; timer }
                        .padding(.vertical, EQSpacing.sm)
                }.scrollIndicators(.hidden)
            }
            .toolbar(.hidden, for: .navigationBar)
            .navigationDestination(for: HomeRoute.self) { destination($0) }
            .sheet(item: $model.creationRoute) { route in
                AddWorkoutSheet(initialRoute: route, day: model.today, exercises: exerciseRepository, workouts: repository, history: historyRepository) {
                    model.applyPersistedWorkouts($0)
                }
            }
            .sheet(isPresented: $model.isTimerPresented) { StandaloneTimerPlaceholder() }
            .task { await model.load() }
            .onChange(of: scenePhase) { _, phase in if phase == .active { Task { await model.appBecameActive() } } }
        }.tint(EQColor.accent)
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: EQSpacing.sm) {
            Text("Workout of the day").font(EQTypography.title)
            Text(model.calendar.fullDate(model.today)).font(EQTypography.body).foregroundStyle(EQColor.secondaryText)
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
        .accessibilityLabel("Today's workouts")
    }

    private var timer: some View {
        Button { model.isTimerPresented = true } label: {
            HStack { Image(systemName: "timer"); Text("Timer"); Spacer(); Image(systemName: "chevron.up") }
                .frame(minHeight: EQDimension.minimumTouch)
        }.buttonStyle(.plain).padding(.horizontal, EQSpacing.lg).accessibilityHint("Opens the standalone timer placeholder")
    }

    @ViewBuilder private func destination(_ route: HomeRoute) -> some View {
        switch route {
        case .workout(let id):
            WorkoutExecutionView(id: id, repository: repository, historyRepository: historyRepository, weightUnit: WeightUnit(rawValue: weightUnitRaw) ?? .pounds) { model.applyPersistedWorkout($0) }
                .onDisappear { Task { await model.load() } }
                .modifier(HomeZoomModifier(id: id.rawValue, namespace: workoutTransition, reduceMotion: reduceMotion))
        case .settings: SettingsShellView()
        case .history: WorkoutHistoryView(repository: repository, historyRepository: historyRepository)
        }
    }
}

enum HomeRoute: Hashable { case workout(ScheduledWorkoutID), settings, history }

private struct WorkoutCard: View {
    let workout: ScheduledWorkout; let sequence: Int
    private var presentation: HomeCardPresentation { .init(status: workout.status) }
    var body: some View {
        VStack(alignment: .leading, spacing: EQSpacing.md) {
            HStack {
                Text(String(format: "%02d", sequence)).font(EQTypography.caption).foregroundStyle(EQColor.secondaryText)
                Spacer()
                Label(presentation.stateLabel, systemImage: workout.status == .completed ? "checkmark.circle.fill" : workout.status == .inProgress ? "play.circle.fill" : "calendar")
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
                Button("Create from scratch") { select(.builder(.init())) }
                Button("Paste workout") { select(.pasteWorkout) }
                Button("Use recent workout") { select(.recent) }
            }.font(EQTypography.body).buttonStyle(.plain).foregroundStyle(EQColor.secondaryText)
        }.foregroundStyle(EQColor.primaryText).padding(EQSpacing.lg)
            .frame(maxWidth: .infinity, minHeight: EQDimension.workoutCardHeight, alignment: .topLeading)
            .background(EQColor.surface, in: RoundedRectangle(cornerRadius: EQRadius.hero, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: EQRadius.hero, style: .continuous).stroke(EQColor.separator))
    }
}

private struct StandaloneTimerPlaceholder: View {
    @Environment(\.dismiss) private var dismiss
    var body: some View { NavigationStack { ContentUnavailableView("Timer", systemImage: "timer", description: Text("The standalone timer arrives in a later migration phase.")).toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } } }.presentationDetents([.medium]) }
}

private struct HomeZoomModifier: ViewModifier {
    let id: String; let namespace: Namespace.ID; let reduceMotion: Bool
    @ViewBuilder func body(content: Content) -> some View { if reduceMotion { content } else { content.navigationTransition(.zoom(sourceID: id, in: namespace)) } }
}

#if DEBUG
@MainActor private func homePreview(_ workouts: [ScheduledWorkout] = []) -> some View {
    let container = try! PersistenceController.makeContainer(inMemory: true)
    workouts.forEach { container.mainContext.insert(WorkoutMapper.record(from: $0)) }; try! container.mainContext.save()
    return HomeView(repository: SwiftDataRepository(container: container)).modelContainer(container)
}
#Preview("Multiple workouts") { homePreview([EquilibriumFixtures.planned(), EquilibriumFixtures.inProgress(id: "preview-progress"), EquilibriumFixtures.completed(id: "preview-complete")]) }
#Preview("Add workout only") { homePreview() }
#endif
