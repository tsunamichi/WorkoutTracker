import Foundation
import Observation

@MainActor @Observable
final class HomeModel {
    private let loadWorkouts: () async throws -> [Workout]
    private let now: () -> Date
    private let calendar: Calendar
    private(set) var workouts: [Workout] = []
    private(set) var errorMessage: String?
    private(set) var hasReusableWorkouts = false
    var primarySurface: HomePrimarySurface = .home
    private(set) var expandedWorkoutID: WorkoutID?
    var isAddWorkoutDrawerPresented = false
    private var pendingCreationRoute: CreationRoute?
    var creationRoute: CreationRoute?
    init(repository: any WorkoutRepository, now: @escaping () -> Date = { .now }, calendar: Calendar = .autoupdatingCurrent) {
        loadWorkouts = { try await repository.allWorkouts() }
        self.now = now
        self.calendar = calendar
    }
    init(loadWorkouts: @escaping () async throws -> [Workout], now: @escaping () -> Date = { .now }, calendar: Calendar = .autoupdatingCurrent) {
        self.loadWorkouts = loadWorkouts
        self.now = now
        self.calendar = calendar
    }

    func load() async {
        do {
            let values = try await loadWorkouts()
            workouts = HomeWorkoutQuery.visibleWorkouts(in: values, now: now(), calendar: calendar)
            hasReusableWorkouts = values.contains { $0.status == .completed }
            errorMessage = nil
        } catch { errorMessage = "Home could not be loaded." }
    }

    func applyPersistedWorkout(_ workout: Workout) {
        if workout.status == .completed { hasReusableWorkouts = true }
        guard HomeWorkoutQuery.includes(workout, now: now(), calendar: calendar) else {
            workouts.removeAll { $0.id == workout.id }
            if expandedWorkoutID == workout.id { expandedWorkoutID = nil }
            return
        }
        if let index = workouts.firstIndex(where: { $0.id == workout.id }) { workouts[index] = workout }
        else { workouts.append(workout); workouts.sort(by: Self.carouselOrder) }
    }

    func applyPersistedWorkouts(_ values: [Workout]) { values.forEach(applyPersistedWorkout) }

    func beginExecution(for workoutID: WorkoutID) {
        expandedWorkoutID = workoutID
    }

    func endExecution() {
        expandedWorkoutID = nil
    }

    func selectCreationRoute(_ route: CreationRoute) {
        pendingCreationRoute = route
        isAddWorkoutDrawerPresented = false
    }

    func presentPendingCreationRoute() {
        guard let pendingCreationRoute else { return }
        self.pendingCreationRoute = nil
        creationRoute = pendingCreationRoute
    }

    func nextLocalDayRefreshDelay() -> Duration {
        let current = now()
        let start = calendar.startOfDay(for: current)
        let next = calendar.date(byAdding: .day, value: 1, to: start) ?? current.addingTimeInterval(24 * 60 * 60)
        return .seconds(max(1, next.timeIntervalSince(current)))
    }

    private static func carouselOrder(_ lhs: Workout, _ rhs: Workout) -> Bool {
        lhs.createdAt == rhs.createdAt ? lhs.id.rawValue < rhs.id.rawValue : lhs.createdAt < rhs.createdAt
    }
}

enum HomePrimarySurface: Equatable { case home, timer }

enum HomeWorkoutQuery {
    static func visibleWorkouts(in values: [Workout], now: Date, calendar: Calendar) -> [Workout] {
        values.filter { includes($0, now: now, calendar: calendar) }
            .sorted(by: carouselOrder)
    }

    static func includes(_ workout: Workout, now: Date, calendar: Calendar) -> Bool {
        guard workout.status == .completed else { return true }
        guard let completedAt = workout.completedAt else { return false }
        return calendar.isDate(completedAt, inSameDayAs: now)
    }

    private static func carouselOrder(_ lhs: Workout, _ rhs: Workout) -> Bool {
        lhs.createdAt == rhs.createdAt ? lhs.id.rawValue < rhs.id.rawValue : lhs.createdAt < rhs.createdAt
    }
}

enum HomeCardAction: Equatable { case start, resume, view }

struct HomeCardPresentation: Equatable {
    let stateLabel: String; let actionLabel: String; let action: HomeCardAction
    init(status: WorkoutStatus) {
        switch status {
        case .ready: stateLabel = "Ready"; actionLabel = "Start workout"; action = .start
        case .inProgress: stateLabel = "In progress"; actionLabel = "Resume workout"; action = .resume
        case .completed: stateLabel = "Completed"; actionLabel = "View workout"; action = .view
        }
    }
}
