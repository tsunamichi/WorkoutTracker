import Foundation
import Observation

@MainActor @Observable
final class HomeModel {
    private let loadActive: () async throws -> [Workout]
    private(set) var workouts: [Workout] = []
    private(set) var errorMessage: String?
    var creationRoute: CreationRoute?
    var isTimerPresented = false
    init(repository: any WorkoutRepository) { loadActive = { try await repository.activeWorkouts() } }
    init(loadActive: @escaping () async throws -> [Workout]) { self.loadActive = loadActive }

    func load() async {
        do {
            workouts = try await loadActive()
            errorMessage = nil
        } catch { errorMessage = "Home could not be loaded." }
    }

    func applyPersistedWorkout(_ workout: Workout) {
        if workout.status == .completed { workouts.removeAll { $0.id == workout.id }; return }
        if let index = workouts.firstIndex(where: { $0.id == workout.id }) { workouts[index] = workout }
        else { workouts.append(workout); workouts.sort(by: Self.carouselOrder) }
    }

    func applyPersistedWorkouts(_ values: [Workout]) { values.forEach(applyPersistedWorkout) }

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
