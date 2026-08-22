import Foundation
import Observation

@MainActor @Observable
final class HomeModel {
    private let repository: any ScheduledWorkoutRepository
    private let now: () -> Date
    private(set) var today: LocalDay
    private(set) var workouts: [ScheduledWorkout] = []
    private(set) var errorMessage: String?
    var creationRoute: CreationRoute?
    var isTimerPresented = false
    let calendar: ScheduleCalendar

    init(repository: any ScheduledWorkoutRepository, calendar: ScheduleCalendar = .init(), now: @escaping () -> Date = Date.init) {
        self.repository = repository; self.calendar = calendar; self.now = now
        today = (try? calendar.today(now: now())) ?? (try! LocalDay("2001-01-01"))
    }

    func load() async {
        do {
            today = try calendar.today(now: now())
            workouts = try await repository.workouts(on: today)
            errorMessage = nil
        } catch { errorMessage = "Home could not be loaded." }
    }

    func appBecameActive() async { await load() }

    func applyPersistedWorkout(_ workout: ScheduledWorkout) {
        guard workout.day == today else { return }
        if let index = workouts.firstIndex(where: { $0.id == workout.id }) { workouts[index] = workout }
        else { workouts.append(workout); workouts.sort(by: Self.carouselOrder) }
    }

    func applyPersistedWorkouts(_ values: [ScheduledWorkout]) { values.forEach(applyPersistedWorkout) }

    private static func carouselOrder(_ lhs: ScheduledWorkout, _ rhs: ScheduledWorkout) -> Bool {
        lhs.createdAt == rhs.createdAt ? lhs.id.rawValue < rhs.id.rawValue : lhs.createdAt < rhs.createdAt
    }
}

enum HomeCardAction: Equatable { case start, resume, view }

struct HomeCardPresentation: Equatable {
    let stateLabel: String; let actionLabel: String; let action: HomeCardAction
    init(status: WorkoutStatus) {
        switch status {
        case .planned: stateLabel = "Planned"; actionLabel = "Start workout"; action = .start
        case .inProgress: stateLabel = "In progress"; actionLabel = "Resume workout"; action = .resume
        case .completed: stateLabel = "Completed"; actionLabel = "View workout"; action = .view
        }
    }
}
