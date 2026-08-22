import Foundation
import Observation

@MainActor @Observable
final class WorkoutExecutionModel {
    let workoutID: ScheduledWorkoutID
    private let repository: any ScheduledWorkoutRepository
    private let now: () -> Date
    private let didPersist: (ScheduledWorkout) -> Void

    private(set) var workout: ScheduledWorkout?
    private(set) var errorMessage: String?
    private(set) var isActivated = false
    private(set) var showsCompletion = false
    var focusedExerciseID: ScheduledExerciseID?
    let weightUnit: WeightUnit

    init(workoutID: ScheduledWorkoutID, repository: any ScheduledWorkoutRepository, weightUnit: WeightUnit = .pounds, now: @escaping () -> Date = Date.init, didPersist: @escaping (ScheduledWorkout) -> Void = { _ in }) {
        self.workoutID = workoutID
        self.repository = repository
        self.weightUnit = weightUnit
        self.now = now
        self.didPersist = didPersist
    }

    var isReadOnly: Bool { workout?.status == .completed }
    var progress: WorkoutProgress { workout.map(WorkoutExecutionQuery.progress) ?? .init(completedSetCount: 0, requiredSetCount: 0) }
    var states: [ScheduledExerciseID: ExerciseState] { workout.map { WorkoutExecutionQuery.states(in: $0, focusedExerciseID: focusedExerciseID) } ?? [:] }
    var canComplete: Bool { workout.map { $0.status == .inProgress && WorkoutExecutionQuery.canComplete($0) } ?? false }

    func activate() async {
        guard !isActivated else { return }
        isActivated = true
        do {
            guard let loaded = try await repository.workout(id: workoutID) else { throw RepositoryError.notFound }
            workout = loaded
            if loaded.status == .planned {
                // Yield keeps the Schedule source card alive through destination activation.
                await Task.yield()
                let started = try await repository.startWorkout(id: workoutID, at: now())
                accept(started)
            }
            errorMessage = nil
        } catch { errorMessage = message(for: error) }
    }

    func log(exerciseID: ScheduledExerciseID, prescriptionID: SetID, input: SetLogInput) async {
        do {
            let updated = try await repository.logSet(workoutID: workoutID, exerciseID: exerciseID, prescriptionID: prescriptionID, input: input, completed: true, at: now())
            accept(updated)
            if WorkoutExecutionQuery.isComplete(updated.exercises.first(where: { $0.id == exerciseID })!) { focusedExerciseID = nil }
            errorMessage = nil
        } catch { errorMessage = message(for: error) }
    }

    func focus(_ id: ScheduledExerciseID) { guard workout?.status == .inProgress else { return }; focusedExerciseID = id }

    func complete() async {
        do {
            let completed = try await repository.completeWorkout(id: workoutID, at: now())
            accept(completed)
            showsCompletion = true
            errorMessage = nil
        } catch { errorMessage = message(for: error) }
    }

    private func accept(_ value: ScheduledWorkout) { workout = value; didPersist(value) }
    private func message(for error: Error) -> String {
        switch error as? RepositoryError {
        case .incompleteWorkout: return "Complete every required set before finishing."
        case .immutableCompletedWorkout: return "Completed workouts are read-only."
        case .invalidSetInput: return "Enter a valid set value."
        default: return "The workout could not be updated."
        }
    }
}
