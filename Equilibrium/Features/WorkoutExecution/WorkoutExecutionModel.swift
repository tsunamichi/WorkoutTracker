import Foundation
import Observation

enum ExecutionPanel: String, Equatable, Sendable { case completed, upNext, current }

struct WorkoutRestState: Equatable, Sendable {
    let exerciseID: ScheduledExerciseID
    let exerciseName: String
    let endsAt: Date
    let totalDuration: TimeInterval
    var remaining: TimeInterval
}

@MainActor @Observable
final class WorkoutExecutionModel {
    let workoutID: ScheduledWorkoutID
    private let repository: any ScheduledWorkoutRepository
    private let now: () -> Date
    private let currentDayProvider: any CurrentDayProviding
    private let didPersist: (ScheduledWorkout) -> Void

    private(set) var workout: ScheduledWorkout?
    private(set) var errorMessage: String?
    private(set) var isActivated = false
    private(set) var showsCompletion = false
    var focusedExerciseID: ScheduledExerciseID?
    var expandedPanel: ExecutionPanel = .current
    var selectedSetIndex = 0
    private(set) var restState: WorkoutRestState?
    @ObservationIgnored private var restTask: Task<Void, Never>?
    let weightUnit: WeightUnit

    init(workoutID: ScheduledWorkoutID, repository: any ScheduledWorkoutRepository, weightUnit: WeightUnit = .pounds, now: @escaping () -> Date = Date.init, currentDayProvider: any CurrentDayProviding = SystemCurrentDayProvider(), didPersist: @escaping (ScheduledWorkout) -> Void = { _ in }) {
        self.workoutID = workoutID
        self.repository = repository
        self.weightUnit = weightUnit
        self.now = now
        self.currentDayProvider = currentDayProvider
        self.didPersist = didPersist
    }

    var isReadOnly: Bool { workout.map { $0.status == .completed || (try? currentDayProvider.currentDay()) != $0.day } ?? true }
    var progress: WorkoutProgress { workout.map(WorkoutExecutionQuery.progress) ?? .init(completedSetCount: 0, requiredSetCount: 0) }
    var states: [ScheduledExerciseID: ExerciseState] { workout.map { WorkoutExecutionQuery.states(in: $0, focusedExerciseID: focusedExerciseID) } ?? [:] }
    var canComplete: Bool { workout.map { $0.status == .inProgress && WorkoutExecutionQuery.canComplete($0) } ?? false }
    var completedExercises: [ScheduledExercise] { workout?.exercises.filter(WorkoutExecutionQuery.isComplete) ?? [] }
    var upNextExercises: [ScheduledExercise] {
        guard let workout else { return [] }
        let currentID = currentExercise?.id
        return workout.exercises.filter { !WorkoutExecutionQuery.isComplete($0) && $0.id != currentID }
    }
    var currentExercise: ScheduledExercise? {
        guard let workout else { return nil }
        return workout.exercises.first { states[$0.id] == .current }
    }
    var currentPrescription: SetPrescription? {
        guard let exercise = currentExercise, exercise.prescriptions.indices.contains(selectedSetIndex) else { return nil }
        return exercise.prescriptions[selectedSetIndex]
    }

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
            expandedPanel = loaded.status == .completed ? .completed : .current
            selectFirstIncompleteSet()
            errorMessage = nil
        } catch { errorMessage = message(for: error) }
    }

    func log(exerciseID: ScheduledExerciseID, prescriptionID: SetID, input: SetLogInput) async {
        do {
            let updated = try await repository.logSet(workoutID: workoutID, exerciseID: exerciseID, prescriptionID: prescriptionID, input: input, completed: true, at: now())
            accept(updated)
            guard let loggedExercise = updated.exercises.first(where: { $0.id == exerciseID }) else { return }
            let duration = loggedExercise.restDuration ?? 0
            if WorkoutExecutionQuery.isComplete(loggedExercise) {
                focusedExerciseID = nil
                selectFirstIncompleteSet()
            } else if let index = loggedExercise.prescriptions.firstIndex(where: { !WorkoutExecutionQuery.completedPrescriptionIDs(in: loggedExercise).contains($0.id) }) {
                selectedSetIndex = index
            }
            if duration > 0 && !WorkoutExecutionQuery.canComplete(updated) { startRest(for: loggedExercise, duration: duration) }
            errorMessage = nil
        } catch { errorMessage = message(for: error) }
    }

    func logFirstSet(exerciseID: ScheduledExerciseID, input: SetLogInput) async {
        do {
            let appended = try await repository.appendSet(workoutID: workoutID, exerciseID: exerciseID, seed: input, at: now())
            guard let prescriptionID = appended.exercises.first(where: { $0.id == exerciseID })?.prescriptions.last?.id else { throw RepositoryError.prescriptionNotFound }
            let updated = try await repository.logSet(workoutID: workoutID, exerciseID: exerciseID, prescriptionID: prescriptionID, input: input, completed: true, at: now())
            accept(updated); focusedExerciseID = nil; selectFirstIncompleteSet(); errorMessage = nil
        } catch { errorMessage = message(for: error) }
    }

    func addSet(exerciseID: ScheduledExerciseID) async {
        do {
            let updated = try await repository.appendSet(workoutID: workoutID, exerciseID: exerciseID, seed: nil, at: now())
            accept(updated); focusedExerciseID = exerciseID
            selectedSetIndex = max(0, (updated.exercises.first { $0.id == exerciseID }?.prescriptions.count ?? 1) - 1)
            errorMessage = nil
        } catch { errorMessage = message(for: error) }
    }

    func removeCurrentSet(exerciseID: ScheduledExerciseID, prescriptionID: SetID) async {
        do { let updated = try await repository.removeSet(workoutID: workoutID, exerciseID: exerciseID, prescriptionID: prescriptionID, at: now()); accept(updated); selectFirstIncompleteSet(); errorMessage = nil }
        catch { errorMessage = message(for: error) }
    }

    func focus(_ id: ScheduledExerciseID) {
        guard let workout, workout.status == .inProgress, let exercise = workout.exercises.first(where: { $0.id == id }) else { return }
        focusedExerciseID = id
        selectedSetIndex = exercise.prescriptions.firstIndex(where: { !WorkoutExecutionQuery.completedPrescriptionIDs(in: exercise).contains($0.id) })
            ?? max(0, exercise.prescriptions.count - 1)
        expandedPanel = .current
    }

    func expand(_ panel: ExecutionPanel) { expandedPanel = panel }

    func selectSet(at index: Int) {
        guard let exercise = currentExercise, exercise.prescriptions.indices.contains(index) else { return }
        selectedSetIndex = index
    }

    func skipRest() { stopRest() }

    func refreshRest(at date: Date? = nil) {
        guard var state = restState else { return }
        state.remaining = max(0, state.endsAt.timeIntervalSince(date ?? now()))
        if state.remaining <= 0 { stopRest() } else { restState = state }
    }

    func complete() async {
        do {
            let completed = try await repository.completeWorkout(id: workoutID, at: now())
            accept(completed)
            showsCompletion = true
            errorMessage = nil
        } catch { errorMessage = message(for: error) }
    }

    private func accept(_ value: ScheduledWorkout) { workout = value; didPersist(value) }
    private func selectFirstIncompleteSet() {
        guard let exercise = currentExercise else { selectedSetIndex = 0; return }
        selectedSetIndex = exercise.prescriptions.firstIndex(where: { !WorkoutExecutionQuery.completedPrescriptionIDs(in: exercise).contains($0.id) }) ?? 0
    }
    private func startRest(for exercise: ScheduledExercise, duration: TimeInterval) {
        restTask?.cancel()
        let end = now().addingTimeInterval(duration)
        restState = .init(exerciseID: exercise.id, exerciseName: exercise.nameSnapshot, endsAt: end, totalDuration: duration, remaining: duration)
        restTask = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(1))
                guard !Task.isCancelled else { return }
                self?.refreshRest()
                if self?.restState == nil { return }
            }
        }
    }
    private func stopRest() { restTask?.cancel(); restTask = nil; restState = nil }
    private func message(for error: Error) -> String {
        switch error as? RepositoryError {
        case .incompleteWorkout: return "Complete every required set before finishing."
        case .immutableCompletedWorkout: return "Completed workouts are read-only."
        case .workoutNotCurrentDay: return "Only today's workout can be updated."
        case .invalidSetInput: return "Enter a valid set value."
        default: return "The workout could not be updated."
        }
    }
}
