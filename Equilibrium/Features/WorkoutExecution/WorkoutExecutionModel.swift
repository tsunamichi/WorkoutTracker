import Foundation
import Observation

struct WorkoutRestState: Equatable, Sendable {
    let exerciseID: WorkoutExerciseID
    let exerciseName: String
    let totalDuration: TimeInterval
    var remaining: TimeInterval
}

enum WorkoutWorkTimerPhase: Equatable, Sendable { case ready, firstSide, switchSides, secondSide }
struct WorkoutWorkTimerState: Equatable, Sendable {
    let exerciseName: String
    let setNumber: Int
    let totalSets: Int
    let phase: WorkoutWorkTimerPhase
    let totalDuration: TimeInterval
    var remaining: TimeInterval
}

@MainActor @Observable
final class WorkoutExecutionModel {
    let workoutID: WorkoutID
    private let repository: any WorkoutRepository
    private let now: () -> Date
    private let didPersist: (Workout) -> Void
    private var defaultRestDuration: TimeInterval
    let timer: CountdownTimer
    private let haptics: any HapticsClient
    private let audio: any AudioFeedbackClient
    private let historyRepository: (any ExerciseHistoryRepository)?
    private let progressionRepository: (any ProgressionRepository)?
    private let exerciseRepository: (any ExerciseRepository)?

    private(set) var workout: Workout?
    private(set) var errorMessage: String?
    private(set) var suggestions: [ExerciseID: ProgressionSuggestion] = [:]
    private(set) var isActivated = false
    private(set) var didAutoComplete = false
    var focusedExerciseID: WorkoutExerciseID?
    var selectedSetIndex = 0
    private(set) var restingExercise: (id: WorkoutExerciseID, name: String)?
    private(set) var workTimerPhase: WorkoutWorkTimerPhase?
    private var pendingTimedSet: (exerciseID: WorkoutExerciseID, prescriptionID: SetID, input: SetLogInput, duration: TimeInterval, twoSided: Bool, exerciseName: String, setNumber: Int, totalSets: Int)?
    @ObservationIgnored private var restTask: Task<Void, Never>?
    let weightUnit: WeightUnit

    init(workoutID: WorkoutID, repository: any WorkoutRepository, historyRepository: (any ExerciseHistoryRepository)? = nil, progressionRepository: (any ProgressionRepository)? = nil, exerciseRepository: (any ExerciseRepository)? = nil, weightUnit: WeightUnit = .pounds, defaultRestDuration: TimeInterval = 90, now: @escaping () -> Date = Date.init, timer: CountdownTimer? = nil, haptics: (any HapticsClient)? = nil, audio: (any AudioFeedbackClient)? = nil, didPersist: @escaping (Workout) -> Void = { _ in }) {
        self.workoutID = workoutID
        self.repository = repository
        self.weightUnit = weightUnit
        self.now = now
        self.didPersist = didPersist
        self.defaultRestDuration = defaultRestDuration
        self.timer = timer ?? CountdownTimer(now: { now().timeIntervalSinceReferenceDate })
        self.haptics = haptics ?? NoopHapticsClient(); self.audio = audio ?? NoopAudioFeedbackClient()
        self.historyRepository = historyRepository
        self.progressionRepository = progressionRepository
        self.exerciseRepository = exerciseRepository
    }
    var restState: WorkoutRestState? {
        guard let restingExercise, timer.state == .running || timer.state == .paused || timer.state == .completed else { return nil }
        return .init(exerciseID: restingExercise.id, exerciseName: restingExercise.name, totalDuration: timer.configuredDuration, remaining: timer.remainingDuration)
    }
    var workTimerState: WorkoutWorkTimerState? {
        guard let pendingTimedSet, let workTimerPhase,
              timer.state == .running || timer.state == .paused || timer.state == .completed else { return nil }
        return .init(exerciseName: pendingTimedSet.exerciseName, setNumber: pendingTimedSet.setNumber, totalSets: pendingTimedSet.totalSets, phase: workTimerPhase, totalDuration: timer.configuredDuration, remaining: timer.remainingDuration)
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
            await loadSuggestions(for: loaded)
            errorMessage = nil
        } catch { errorMessage = message(for: error) }
    }

    func refreshFromPersistence() async {
        do {
            guard let loaded = try await repository.workout(id: workoutID) else { throw RepositoryError.notFound }
            accept(loaded); await loadSuggestions(for: loaded); errorMessage = nil
        } catch { errorMessage = message(for: error) }
    }

    func suggestion(for exercise: WorkoutExercise) -> ProgressionSuggestion? {
        guard exercise.prescriptions.contains(where: { if case .repetitions = $0.target { true } else { false } }) else { return nil }
        return suggestions[exercise.exerciseID]
    }
    func progressionIdentity(for exercise: WorkoutExercise) -> String {
        guard let suggestion = suggestion(for: exercise) else { return "none" }
        return "\(suggestion.rationale.rawValue)-\(suggestion.suggestedWeight?.pounds ?? -1)-\(suggestion.targetRepetitions?.lowerBound ?? -1)"
    }

    func log(exerciseID: WorkoutExerciseID, prescriptionID: SetID, input: SetLogInput) async {
        do {
            let wasComplete = workout?.exercises.first(where: { $0.id == exerciseID })?.loggedSets.contains(where: { $0.prescriptionID == prescriptionID && $0.completedAt != nil }) == true
            let updated = try await repository.logSet(workoutID: workoutID, exerciseID: exerciseID, prescriptionID: prescriptionID, input: input, completed: true, at: now())
            accept(updated)
            if await autoCompleteIfEligible(updated) { return }
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
            accept(updated)
            if await autoCompleteIfEligible(updated) { return }
            focusedExerciseID = nil; selectFirstIncompleteSet()
            if let loggedExercise = updated.exercises.first(where: { $0.id == exerciseID }) { beginRestIfAppropriate(after: loggedExercise, in: updated) }
            errorMessage = nil
        } catch { errorMessage = message(for: error) }
    }
    func startFirstWorkTimer(exerciseID: WorkoutExerciseID, input: SetLogInput) async {
        do {
            let appended = try await repository.appendSet(workoutID: workoutID, exerciseID: exerciseID, seed: input, at: now())
            accept(appended)
            guard let prescriptionID = appended.exercises.first(where: { $0.id == exerciseID })?.prescriptions.last?.id else { throw RepositoryError.prescriptionNotFound }
            focusedExerciseID = exerciseID
            selectedSetIndex = max(0, (appended.exercises.first { $0.id == exerciseID }?.prescriptions.count ?? 1) - 1)
            startWorkTimer(exerciseID: exerciseID, prescriptionID: prescriptionID, input: input)
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

    func skipRest() { stopTimer() }

    func startWorkTimer(exerciseID: WorkoutExerciseID, prescriptionID: SetID, input: SetLogInput) {
        guard workTimerState == nil, restState == nil,
              let exercise = workout?.exercises.first(where: { $0.id == exerciseID }),
              let index = exercise.prescriptions.firstIndex(where: { $0.id == prescriptionID }),
              case .duration(_, let seconds) = input, seconds > 0 else { return }
        pendingTimedSet = (exerciseID, prescriptionID, input, seconds, exercise.isTwoSided, exercise.nameSnapshot, index + 1, exercise.prescriptions.count)
        workTimerPhase = .ready
        startTimer(duration: 5)
    }
    func toggleWorkTimerPause() {
        guard workTimerPhase != .ready else { return }
        if timer.state == .running { timer.pause() }
        else if timer.state == .paused { timer.resume() }
    }
    func skipWorkTimer() {
        guard pendingTimedSet != nil else { return }
        if workTimerPhase == .switchSides { transitionToWork(.secondSide) }
        else { finishTimedSet() }
    }

    func refreshRest(at date: Date? = nil) {
        guard timer.refresh() else { return }
        if restingExercise != nil {
            haptics.timerCompleted(); audio.timerCompleted(); stopTimer(clearTimer: false)
        } else if workTimerPhase != nil { advanceWorkTimer() }
    }

    func resetWorkout() async -> Bool {
        do {
            let reset = try await repository.resetWorkout(id: workoutID, at: now())
            stopTimer(); focusedExerciseID = nil; selectedSetIndex = 0; accept(reset); selectFirstIncompleteSet(); errorMessage = nil
            return true
        } catch { errorMessage = message(for: error); return false }
    }

    func deleteWorkout() async -> Bool {
        do { try await repository.deleteWorkout(id: workoutID); stopTimer(); errorMessage = nil; return true }
        catch { errorMessage = message(for: error); return false }
    }

    func setRestDuration(_ seconds: TimeInterval) async -> Bool {
        guard let exerciseID = restEditableExercise?.id else { return false }
        do { accept(try await repository.setRestDuration(workoutID: workoutID, exerciseID: exerciseID, seconds: seconds, at: now())); errorMessage = nil; return true }
        catch { errorMessage = message(for: error); return false }
    }
    func availableExercises() async -> [ExerciseDefinition] { (try? await exerciseRepository?.allExercises()) ?? [] }
    func progressionProfile(for exercise: WorkoutExercise) async -> AutoProgressionProfile { (try? await progressionRepository?.progressionConfiguration().assignments[exercise.exerciseID]) ?? .none }
    func updateExerciseSettings(exerciseID: WorkoutExerciseID, timeBased: Bool, twoSided: Bool, progression: AutoProgressionProfile) async -> Bool {
        guard var value = workout, let index = value.exercises.firstIndex(where: { $0.id == exerciseID }) else { return false }
        var occurrence = value.exercises[index]
        if occurrence.isTimeBased != timeBased {
            occurrence.prescriptions = occurrence.prescriptions.map { item in var result = item; switch (timeBased, item.target) { case (true, .repetitions(let range)): result.target = .duration(seconds: TimeInterval(range.lowerBound)); case (false, .duration(let seconds)): let reps = max(1, Int(seconds.rounded())); result.target = .repetitions(range: reps...reps); default: break }; return result }
            occurrence.loggedSets = []
        }
        occurrence.isTimeBased = timeBased; occurrence.isTwoSided = twoSided; value.exercises[index] = occurrence; value.updatedAt = now()
        do { try await repository.update(value); if var configuration = try await progressionRepository?.progressionConfiguration() { configuration.assign(progression, to: occurrence.exerciseID); try await progressionRepository?.saveProgressionConfiguration(configuration) }; accept(value); errorMessage = nil; return true } catch { errorMessage = message(for: error); return false }
    }
    func swapExercise(occurrenceID: WorkoutExerciseID, with definition: ExerciseDefinition) async -> Bool {
        guard var value = workout, let index = value.exercises.firstIndex(where: { $0.id == occurrenceID }) else { return false }
        let old = value.exercises[index]
        let history = try? await historyRepository?.latestExerciseLog(exerciseID: definition.id)
        let inherited = history?.sets.map { set -> SetPrescription in
            if let duration = set.duration { return .init(id: .new(), target: .duration(seconds: duration), suggestedWeight: set.weight) }
            let repetitions = max(1, set.repetitions ?? 1)
            return .init(id: .new(), target: .repetitions(range: repetitions...repetitions), suggestedWeight: set.weight)
        } ?? []
        let inheritedTimeBased = inherited.first.map { if case .duration = $0.target { true } else { false } } ?? old.isTimeBased
        value.exercises[index] = WorkoutExercise(id: old.id, exerciseID: definition.id, nameSnapshot: definition.name, prescriptions: inherited, loggedSets: [], restDuration: old.restDuration, skippedAt: nil, isTimeBased: inheritedTimeBased, isTwoSided: old.isTwoSided); value.updatedAt = now()
        do {
            try await repository.update(value)
            accept(value)
            focusedExerciseID = occurrenceID
            selectedSetIndex = 0
            suggestions[old.exerciseID] = nil
            await loadSuggestions(for: value)
            errorMessage = nil
            return true
        } catch { errorMessage = message(for: error); return false }
    }
    func removeExercise(_ occurrenceID: WorkoutExerciseID) async -> Bool {
        guard var value = workout, value.exercises.contains(where: { $0.id == occurrenceID }) else { return false }
        value.exercises.removeAll { $0.id == occurrenceID }; value.updatedAt = now()
        do { try await repository.update(value); accept(value); focusedExerciseID = nil; selectFirstIncompleteSet(); errorMessage = nil; return true } catch { errorMessage = message(for: error); return false }
    }

    private func accept(_ value: Workout) { workout = value; didPersist(value) }
    private func autoCompleteIfEligible(_ value: Workout) async -> Bool {
        guard value.status == .inProgress, WorkoutExecutionQuery.canComplete(value) else { return false }
        do {
            let completed = try await repository.completeWorkout(id: workoutID, at: now())
            stopTimer(); accept(completed); didAutoComplete = true; haptics.timerCompleted(); errorMessage = nil
            return true
        } catch { errorMessage = message(for: error); return false }
    }
    private func loadSuggestions(for workout: Workout) async {
        guard let historyRepository, let progressionRepository,
              let configuration = try? await progressionRepository.progressionConfiguration(), configuration.isEnabled else { return }
        for exercise in workout.exercises {
            guard exercise.prescriptions.contains(where: { if case .repetitions = $0.target { true } else { false } }),
                  let rule = ProgressionRuleResolver.resolve(exerciseID: exercise.exerciseID, configuration: configuration),
                  let log = try? await historyRepository.latestExerciseLog(exerciseID: exercise.exerciseID) else { continue }
            suggestions[exercise.exerciseID] = ProgressionEngine.calculate(exerciseID: exercise.exerciseID, parameters: rule.parameters, sets: log.sets)
        }
    }
    private func selectFirstIncompleteSet() {
        guard let exercise = currentExercise else { selectedSetIndex = 0; return }
        selectedSetIndex = exercise.prescriptions.firstIndex(where: { !WorkoutExecutionQuery.completedPrescriptionIDs(in: exercise).contains($0.id) }) ?? 0
    }
    private func startTimer(duration: TimeInterval, alreadyElapsed: TimeInterval = 0) {
        restTask?.cancel()
        timer.start(duration: duration, alreadyElapsed: alreadyElapsed)
        restTask = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(1))
                guard !Task.isCancelled else { return }
                self?.refreshRest()
                if self?.restState == nil && self?.workTimerState == nil { return }
            }
        }
    }
    private func transitionToWork(_ phase: WorkoutWorkTimerPhase, alreadyElapsed: TimeInterval = 0) {
        guard let pendingTimedSet else { return }
        workTimerPhase = phase
        startTimer(duration: phase == .switchSides ? 10 : pendingTimedSet.duration, alreadyElapsed: alreadyElapsed)
        if timer.state == .completed { advanceWorkTimer() }
    }
    private func advanceWorkTimer() {
        guard let pendingTimedSet, let workTimerPhase else { return }
        switch workTimerPhase {
        case .ready: transitionToWork(.firstSide, alreadyElapsed: timer.completionOverrun)
        case .firstSide:
            haptics.timerCompleted(); audio.timerCompleted()
            pendingTimedSet.twoSided ? transitionToWork(.switchSides, alreadyElapsed: timer.completionOverrun) : finishTimedSet()
        case .switchSides:
            haptics.timerCompleted(); transitionToWork(.secondSide, alreadyElapsed: timer.completionOverrun)
        case .secondSide:
            haptics.timerCompleted(); audio.timerCompleted(); finishTimedSet()
        }
    }
    private func finishTimedSet() {
        guard let pending = pendingTimedSet else { return }
        restTask?.cancel(); restTask = nil; timer.cancel(); workTimerPhase = nil; pendingTimedSet = nil
        Task { await log(exerciseID: pending.exerciseID, prescriptionID: pending.prescriptionID, input: pending.input) }
    }
    private func beginRestIfAppropriate(after exercise: WorkoutExercise, in workout: Workout) {
        guard !WorkoutExecutionQuery.canComplete(workout) else { return }
        let duration = exercise.restDuration ?? defaultRestDuration
        guard duration > 0 else { return }
        restingExercise = (exercise.id, exercise.nameSnapshot)
        startTimer(duration: duration)
    }
    private func stopTimer(clearTimer: Bool = true) {
        restTask?.cancel(); restTask = nil; restingExercise = nil; workTimerPhase = nil; pendingTimedSet = nil
        if clearTimer { timer.cancel() }
    }
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
