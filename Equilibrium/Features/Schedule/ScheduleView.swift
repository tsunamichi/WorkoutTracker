import SwiftUI

struct ScheduleView: View {
    @State private var model: ScheduleModel
    private let repository: any ScheduledWorkoutRepository
    private let exerciseRepository: any ExerciseRepository
    private let templateRepository: any WorkoutTemplateRepository
    @Namespace private var workoutTransition
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @AppStorage(EQPreferenceKey.weightUnit) private var weightUnitRaw = WeightUnit.pounds.rawValue

    init(repository: any ScheduledWorkoutRepository, exerciseRepository: (any ExerciseRepository)? = nil, templateRepository: (any WorkoutTemplateRepository)? = nil) {
        self.repository = repository
        guard let shared = repository as? SwiftDataRepository else { precondition(exerciseRepository != nil && templateRepository != nil, "Creation repositories are required") ; self.exerciseRepository = exerciseRepository!; self.templateRepository = templateRepository!; _model = State(initialValue: ScheduleModel(repository: repository)); return }
        self.exerciseRepository = exerciseRepository ?? shared
        self.templateRepository = templateRepository ?? shared
        _model = State(initialValue: ScheduleModel(repository: repository))
    }

    var body: some View {
        NavigationStack {
            ZStack {
                EQColor.canvas.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: EQSpacing.lg) {
                        header
                        selectedDayContent
                    }
                    .padding(.horizontal, EQSpacing.lg)
                    .padding(.bottom, EQSpacing.xl)
                }
                .scrollIndicators(.hidden)
                .simultaneousGesture(DragGesture(minimumDistance: EQDimension.minimumTouch).onEnded { value in
                    guard abs(value.translation.width) > abs(value.translation.height), abs(value.translation.width) > EQDimension.minimumTouch else { return }
                    Task { await model.moveDay(value.translation.width < 0 ? 1 : -1) }
                })
            }
            .toolbar(.hidden, for: .navigationBar)
            .navigationDestination(for: ScheduleRoute.self) { route in destination(route) }
            .sheet(isPresented: $model.isAddWorkoutPresented) { AddWorkoutSheet(day: model.selectedDay, exercises: exerciseRepository, templates: templateRepository, workouts: repository) { model.applyPersistedWorkout($0) } }
            .sheet(isPresented: $model.isTimerPresented) { StandaloneTimerPlaceholder() }
            .task { await model.load() }
        }
        .tint(EQColor.accent)
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: EQSpacing.sm) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: EQSpacing.xxs) {
                    Text("Workout of the day").font(EQTypography.title)
                    Text(model.calendar.fullDate(model.selectedDay))
                        .font(EQTypography.body).foregroundStyle(EQColor.secondaryText)
                }
                Spacer()
                NavigationLink(value: ScheduleRoute.settings) { Image(systemName: "gearshape") }
                    .frame(width: EQDimension.minimumTouch, height: EQDimension.minimumTouch)
                    .accessibilityLabel("Settings")
            }
            HStack {
                NavigationLink("Workout history", value: ScheduleRoute.history)
                    .font(EQTypography.caption)
                Spacer()
                Button { Task { await model.moveDay(-1) } } label: { Image(systemName: "chevron.left") }
                    .accessibilityLabel("Previous day")
                if !model.isTodaySelected {
                    Button("Today") { Task { await model.selectToday() } }
                        .font(EQTypography.caption).accessibilityHint("Returns to the current date")
                }
                Button { Task { await model.moveDay(1) } } label: { Image(systemName: "chevron.right") }
                    .accessibilityLabel("Next day")
            }
            .frame(minHeight: EQDimension.minimumTouch)
        }
        .padding(.top, EQSpacing.sm)
    }

    @ViewBuilder private var selectedDayContent: some View {
        if let workout = model.selectedWorkout {
            NavigationLink(value: ScheduleRoute.workout(workout.id)) {
                WorkoutCard(workout: workout)
            }
            .buttonStyle(.plain)
            .matchedTransitionSource(id: workout.id.rawValue, in: workoutTransition)
        } else {
            RestDayCard(day: model.selectedDay) { model.isAddWorkoutPresented = true }
        }
        Button { model.isTimerPresented = true } label: {
            HStack { Image(systemName: "timer"); Text("Timer"); Spacer(); Image(systemName: "chevron.up") }
                .frame(minHeight: EQDimension.minimumTouch)
        }
        .buttonStyle(.plain)
        .accessibilityHint("Opens the standalone timer placeholder")
        if let message = model.errorMessage {
            Label(message, systemImage: "exclamationmark.triangle")
                .font(.caption).foregroundStyle(EQColor.warning)
        }
    }

    @ViewBuilder private func destination(_ route: ScheduleRoute) -> some View {
        switch route {
        case .workout(let id):
            WorkoutExecutionView(id: id, repository: repository, weightUnit: WeightUnit(rawValue: weightUnitRaw) ?? .pounds) { model.applyPersistedWorkout($0) }
                .onDisappear { Task { await model.load() } }
                .modifier(ScheduleZoomModifier(id: id.rawValue, namespace: workoutTransition, reduceMotion: reduceMotion))
        case .settings: SettingsShellView()
        case .history: HistoryShellView(workouts: Array(model.workoutsByDay.values))
        }
    }
}

enum ScheduleRoute: Hashable { case workout(ScheduledWorkoutID), settings, history }

private struct WorkoutCard: View {
    let workout: ScheduledWorkout
    private var presentation: ScheduleCardPresentation { .init(status: workout.status) }
    var body: some View {
        VStack(alignment: .leading, spacing: EQSpacing.md) {
            HStack {
                Label(presentation.stateLabel, systemImage: workout.status == .completed ? "checkmark.circle.fill" : workout.status == .inProgress ? "play.circle.fill" : "calendar")
                    .font(.caption.weight(.bold)).foregroundStyle(workout.status == .completed ? EQColor.success : EQColor.accent)
                Spacer()
                Image(systemName: "arrow.up.right")
            }
            Text(workout.titleSnapshot).font(EQTypography.cardHero).lineLimit(2)
            Text("\(workout.exercises.count) \(workout.exercises.count == 1 ? "exercise" : "exercises")")
                .font(.subheadline).foregroundStyle(EQColor.secondaryText)
            Divider().overlay(EQColor.separator)
            Text(presentation.actionLabel).font(.headline)
        }
        .foregroundStyle(EQColor.primaryText)
        .padding(EQSpacing.lg)
        .frame(maxWidth: .infinity, minHeight: EQDimension.workoutCardHeight, alignment: .topLeading)
        .background(EQColor.surface, in: RoundedRectangle(cornerRadius: EQRadius.hero, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: EQRadius.hero, style: .continuous).stroke(EQColor.separator))
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(workout.titleSnapshot), \(presentation.stateLabel), \(workout.exercises.count) exercises, \(presentation.actionLabel)")
    }
}

private struct RestDayCard: View {
    let day: LocalDay; let add: () -> Void
    var body: some View {
        VStack(alignment: .leading, spacing: EQSpacing.md) {
            Image(systemName: "moon.stars").font(.title).foregroundStyle(EQColor.secondaryText)
            Text("Rest day").font(EQTypography.cardHero)
            Text("Recovery is part of the work. This day is open if you want to train.").font(.body).foregroundStyle(EQColor.secondaryText)
            Button(action: add) { Label("Add workout", systemImage: "plus") }
                .buttonStyle(.borderedProminent).buttonBorderShape(.roundedRectangle(radius: EQRadius.control))
                .controlSize(.large).padding(.top, EQSpacing.sm)
        }
        .foregroundStyle(EQColor.primaryText).padding(EQSpacing.lg)
        .frame(maxWidth: .infinity, minHeight: EQDimension.restCardHeight, alignment: .topLeading)
        .background(EQColor.surface, in: RoundedRectangle(cornerRadius: EQRadius.hero, style: .continuous))
        .accessibilityElement(children: .contain)
    }
}

private struct StandaloneTimerPlaceholder: View {
    @Environment(\.dismiss) private var dismiss
    var body: some View {
        NavigationStack {
            ContentUnavailableView("Timer", systemImage: "timer", description: Text("The standalone timer arrives in a later migration phase."))
                .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
                .presentationDetents([.medium])
        }
    }
}

private struct ScheduleZoomModifier: ViewModifier {
    let id: String; let namespace: Namespace.ID; let reduceMotion: Bool
    @ViewBuilder func body(content: Content) -> some View {
        if reduceMotion { content } else { content.navigationTransition(.zoom(sourceID: id, in: namespace)) }
    }
}

#if DEBUG
@MainActor private func schedulePreview(_ workout: ScheduledWorkout? = nil, size: DynamicTypeSize = .large) -> some View {
    let container = try! PersistenceController.makeContainer(inMemory: true)
    if let workout {
        container.mainContext.insert(WorkoutMapper.record(from: workout))
        try! container.mainContext.save()
    }
    return ScheduleView(repository: SwiftDataRepository(container: container))
        .modelContainer(container)
        .dynamicTypeSize(size)
}

#Preview("Planned") { schedulePreview(EquilibriumFixtures.planned(day: LocalDayPreview.today)) }
#Preview("In progress") { schedulePreview(EquilibriumFixtures.inProgress(day: LocalDayPreview.today)) }
#Preview("Completed") { schedulePreview(EquilibriumFixtures.completed(day: LocalDayPreview.today)) }
#Preview("Rest day") { schedulePreview() }
#Preview("Future workout") { schedulePreview(EquilibriumFixtures.planned(day: LocalDayPreview.tomorrow, id: "preview-future")) }
#Preview("Past completed") { schedulePreview(EquilibriumFixtures.completed(day: LocalDayPreview.yesterday, id: "preview-past")) }
#Preview("Long title") {
    var workout = EquilibriumFixtures.planned(day: LocalDayPreview.today, id: "preview-long")
    workout.titleSnapshot = "Full Body Strength and Conditioning Session"
    return schedulePreview(workout)
}
#Preview("Accessibility XXL") { schedulePreview(EquilibriumFixtures.planned(day: LocalDayPreview.today, id: "preview-xxl"), size: .accessibility3) }

private enum LocalDayPreview {
    static var calendar: Calendar { var value = Calendar(identifier: .gregorian); value.timeZone = .autoupdatingCurrent; return value }
    static var todayDay: LocalDay { try! LocalDay(date: .now, calendar: calendar) }
    static var today: String { todayDay.iso8601 }
    static var tomorrow: String { try! LocalDay(date: calendar.date(byAdding: .day, value: 1, to: .now)!, calendar: calendar).iso8601 }
    static var yesterday: String { try! LocalDay(date: calendar.date(byAdding: .day, value: -1, to: .now)!, calendar: calendar).iso8601 }
}
#endif
