import Foundation
import Observation

struct WorkoutRestState: Equatable, Sendable {
    let exerciseID: WorkoutExerciseID
    let exerciseName: String
    let endsAt: Date
    let totalDuration: TimeInterval
    var remaining: TimeInterval
}

@MainActor @Observable
final class WorkoutExecutionModel {
    let workoutID: WorkoutID
    private let repository: any WorkoutRepository
    private let now: () -> Date
    private let didPersist: (Workout) -> Void
    private let defaultRestDuration: TimeInterval

    private(set) var workout: Workout?
    private(set) var errorMessage: String?
    private(set) var isActivated = false
    private(set) var showsCompletion = false
    var focusedExerciseID: WorkoutExerciseID?
    var selectedSetIndex = 0
    private(set) var restState: WorkoutRestState?
    @ObservationIgnored private var restTask: Task<Void, Never>?
    let weightUnit: WeightUnit

    init(workoutID: WorkoutID, repository: any WorkoutRepository, weightUnit: WeightUnit = .pounds, defaultRestDuration: TimeInterval = 90, now: @escaping () -> Date = Date.init, didPersist: @escaping (Workout) -> Void = { _ in }) {
        self.workoutID = workoutID
        self.repository = repository
        self.weightUnit = weightUnit
        self.now = now
        self.didPersist = didPersist
        self.defaultRestDuration = defaultRestDuration
    }

    var isReadOnly: Bool { workout?.status == .completed }
    var showsExecutionOptions: Bool { workout?.status == .inProgress && !isReadOnly }
    var progress: WorkoutProgress { workout.map(WorkoutExecutionQuery.progress) ?? .init(completedSetCount: 0, requiredSetCount: 0) }
    var states: [WorkoutExerciseID: ExerciseState] { workout.map { WorkoutExecutionQuery.states(in: $0, focusedExerciseID: focusedExerciseID) } ?? [:] }
    var canComplete: Bool { workout.map { $0.status == .inProgress && WorkoutExecutionQuery.canComplete($0) } ?? false }
    var completedExercises: [WorkoutExercise] { workout?.exercises.filter(WorkoutExecutionQuery.isComplete) ?? [] }
    var upNextExercises: [WorkoutExercise] {
        guard let workout else { return [] }
        let currentID = currentExercise?.id
        return workout.exercises.filter { !WorkoutExecutionQuery.isComplete($0) && $0.id != currentID }
    }
    var currentExercise: WorkoutExercise? {
        guard let workout else { return nil }
        return workout.exercises.first { states[$0.id] == .current }
    }
    var currentPrescription: SetPrescription? {
        guard let exercise = currentExercise, exercise.prescriptions.indices.contains(selectedSetIndex) else { return nil }
        return exercise.prescriptions[selectedSetIndex]
    }
    var performanceExercise: WorkoutExercise? { restState == nil ? currentExercise : nil }
    var restEditableExercise: WorkoutExercise? { restState == nil ? currentExercise : nil }
    var canEditRestDuration: Bool { restEditableExercise != nil && showsExecutionOptions }
    var shareText: String? { workout.map { WorkoutShareText.build(workout: $0, unit: weightUnit) } }
    var configuredRestDuration: TimeInterval {
        restEditableExercise?.restDuration ?? defaultRestDuration
    }

    func activate() async {
        guard !isActivated else { return }
        isActivated = true
        do {
            guard let loaded = try await repository.workout(id: workoutID) else { throw RepositoryError.notFound }
            workout = loaded
            if loaded.status == .ready {
                // Yield keeps the Home source card alive through destination activation.
                await Task.yield()
                let started = try await repository.startWorkout(id: workoutID, at: now())
                accept(started)
            }
            selectFirstIncompleteSet()
            errorMessage = nil
        } catch { errorMessage = message(for: error) }
    }

    func log(exerciseID: WorkoutExerciseID, prescriptionID: SetID, input: SetLogInput) async {
        do {
            let wasComplete = workout?.exercises.first(where: { $0.id == exerciseID })?.loggedSets.contains(where: { $0.prescriptionID == prescriptionID && $0.completedAt != nil }) == true
            let updated = try await repository.logSet(workoutID: workoutID, exerciseID: exerciseID, prescriptionID: prescriptionID, input: input, completed: true, at: now())
            accept(updated)
            guard let loggedExercise = updated.exercises.first(where: { $0.id == exerciseID }) else { return }
            if WorkoutExecutionQuery.isComplete(loggedExercise) {
                focusedExerciseID = nil
                selectFirstIncompleteSet()
            } else if let index = loggedExercise.prescriptions.firstIndex(where: { !WorkoutExecutionQuery.completedPrescriptionIDs(in: loggedExercise).contains($0.id) }) {
                selectedSetIndex = index
            }
            if !wasComplete { beginRestIfAppropriate(after: loggedExercise, in: updated) }
            errorMessage = nil
        } catch { errorMessage = message(for: error) }
    }

    func logFirstSet(exerciseID: WorkoutExerciseID, input: SetLogInput) async {
        do {
            let appended = try await repository.appendSet(workoutID: workoutID, exerciseID: exerciseID, seed: input, at: now())
            guard let prescriptionID = appended.exercises.first(where: { $0.id == exerciseID })?.prescriptions.last?.id else { throw RepositoryError.prescriptionNotFound }
            let updated = try await repository.logSet(workoutID: workoutID, exerciseID: exerciseID, prescriptionID: prescriptionID, input: input, completed: true, at: now())
            accept(updated); focusedExerciseID = nil; selectFirstIncompleteSet()
            if let loggedExercise = updated.exercises.first(where: { $0.id == exerciseID }) { beginRestIfAppropriate(after: loggedExercise, in: updated) }
            errorMessage = nil
        } catch { errorMessage = message(for: error) }
    }

    func addSet(exerciseID: WorkoutExerciseID) async {
        do {
            let updated = try await repository.appendSet(workoutID: workoutID, exerciseID: exerciseID, seed: nil, at: now())
            accept(updated); focusedExerciseID = exerciseID
            selectedSetIndex = max(0, (updated.exercises.first { $0.id == exerciseID }?.prescriptions.count ?? 1) - 1)
            errorMessage = nil
        } catch { errorMessage = message(for: error) }
    }

    func removeCurrentSet(exerciseID: WorkoutExerciseID, prescriptionID: SetID) async {
        do { let updated = try await repository.removeSet(workoutID: workoutID, exerciseID: exerciseID, prescriptionID: prescriptionID, at: now()); accept(updated); selectFirstIncompleteSet(); errorMessage = nil }
        catch { errorMessage = message(for: error) }
    }

    func focus(_ id: WorkoutExerciseID) {
        guard let workout, workout.status == .inProgress, let exercise = workout.exercises.first(where: { $0.id == id }) else { return }
        focusedExerciseID = id
        selectedSetIndex = exercise.prescriptions.firstIndex(where: { !WorkoutExecutionQuery.completedPrescriptionIDs(in: exercise).contains($0.id) })
            ?? max(0, exercise.prescriptions.count - 1)
    }

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

    func resetWorkout() async -> Bool {
        do {
            let reset = try await repository.resetWorkout(id: workoutID, at: now())
            stopRest(); focusedExerciseID = nil; selectedSetIndex = 0; accept(reset); selectFirstIncompleteSet(); errorMessage = nil
            return true
        } catch { errorMessage = message(for: error); return false }
    }

    func deleteWorkout() async -> Bool {
        do { try await repository.deleteWorkout(id: workoutID); stopRest(); errorMessage = nil; return true }
        catch { errorMessage = message(for: error); return false }
    }

    func setRestDuration(_ seconds: TimeInterval) async -> Bool {
        guard let exerciseID = restEditableExercise?.id else { return false }
        do { accept(try await repository.setRestDuration(workoutID: workoutID, exerciseID: exerciseID, seconds: seconds, at: now())); errorMessage = nil; return true }
        catch { errorMessage = message(for: error); return false }
    }

    private func accept(_ value: Workout) { workout = value; didPersist(value) }
    private func selectFirstIncompleteSet() {
        guard let exercise = currentExercise else { selectedSetIndex = 0; return }
        selectedSetIndex = exercise.prescriptions.firstIndex(where: { !WorkoutExecutionQuery.completedPrescriptionIDs(in: exercise).contains($0.id) }) ?? 0
    }
    private func startRest(for exercise: WorkoutExercise, duration: TimeInterval) {
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
    private func beginRestIfAppropriate(after exercise: WorkoutExercise, in workout: Workout) {
        guard !WorkoutExecutionQuery.canComplete(workout) else { return }
        let duration = exercise.restDuration ?? defaultRestDuration
        guard duration > 0 else { return }
        startRest(for: exercise, duration: duration)
    }
    private func stopRest() { restTask?.cancel(); restTask = nil; restState = nil }
    private func message(for error: Error) -> String {
        switch error as? RepositoryError {
        case .incompleteWorkout: return "Complete every required set before finishing."
        case .immutableCompletedWorkout: return "Completed workouts are read-only."
        case .invalidSetInput: return "Enter a valid set value."
        case .invalidRestDuration: return "Choose a rest duration from 15 seconds to 5 minutes."
        default: return "The workout could not be updated."
        }
    }
}
