import Foundation
import Observation

struct WorkoutRestState: Equatable, Sendable {
    let exerciseID: WorkoutExerciseID
    let exerciseName: String
    let completesExercise: Bool
    let totalDuration: TimeInterval
    var remaining: TimeInterval
}

enum ExecutionForegroundState: Equatable, Sendable {
    case exercise
    case work
    case rest
}

struct WorkoutRestSession: Equatable, Sendable {
    let workoutID: WorkoutID
    let exerciseID: WorkoutExerciseID
    let completesExercise: Bool
    let totalDuration: TimeInterval
    let deadline: Date
}

@MainActor @Observable
final class WorkoutRestSessionStore {
    private(set) var activeSession: WorkoutRestSession?

    func begin(
        workoutID: WorkoutID,
        exerciseID: WorkoutExerciseID,
        completesExercise: Bool,
        duration: TimeInterval,
        at date: Date
    ) {
        guard duration.isFinite, duration > 0 else {
            clear(workoutID: workoutID)
            return
        }
        activeSession = WorkoutRestSession(
            workoutID: workoutID,
            exerciseID: exerciseID,
            completesExercise: completesExercise,
            totalDuration: duration,
            deadline: date.addingTimeInterval(duration)
        )
    }

    func session(for workoutID: WorkoutID) -> WorkoutRestSession? {
        guard activeSession?.workoutID == workoutID else { return nil }
        return activeSession
    }

    func clear(workoutID: WorkoutID, exerciseID: WorkoutExerciseID? = nil) {
        guard let activeSession, activeSession.workoutID == workoutID else { return }
        if let exerciseID, activeSession.exerciseID != exerciseID { return }
        self.activeSession = nil
    }
}

enum WorkoutWorkTimerPhase: Equatable, Sendable { case ready, firstSide, switchSides, secondSide }

struct WorkoutWorkTimerState: Equatable, Sendable {
    let exerciseID: WorkoutExerciseID
    let exerciseName: String
    let setNumber: Int
    let totalSets: Int
    let isTwoSided: Bool
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
    private let restSessionStore: WorkoutRestSessionStore
    private var defaultRestDuration: TimeInterval
    let timer: CountdownTimer
    private let haptics: any HapticsClient
    private let audio: any AudioFeedbackClient
    private let historyRepository: (any ExerciseHistoryRepository)?
    private let progressionRepository: (any ProgressionRepository)?
    private let exerciseRepository: (any ExerciseRepository)?
    private let settingsRepository: (any SettingsRepository)?

    private(set) var workout: Workout?
    private(set) var errorMessage: String?
    private(set) var suggestions: [ExerciseID: ProgressionSuggestion] = [:]
    private(set) var exerciseRestDurations: [ExerciseID: TimeInterval] = [:]
    private(set) var isActivated = false
    private(set) var didAutoComplete = false
    var focusedExerciseID: WorkoutExerciseID?
    var selectedSetIndex = 0
    private(set) var completedExerciseAwaitingSelectionID: WorkoutExerciseID?
    private(set) var restingExercise: (id: WorkoutExerciseID, name: String)?
    private(set) var workTimerPhase: WorkoutWorkTimerPhase?
    private var pendingTimedSet: (exerciseID: WorkoutExerciseID, prescriptionID: SetID, input: SetLogInput, duration: TimeInterval, twoSided: Bool, exerciseName: String, setNumber: Int, totalSets: Int)?
    private var isFinishingTimedSet = false
    @ObservationIgnored private var restTask: Task<Void, Never>?
    let weightUnit: WeightUnit

    init(workoutID: WorkoutID, initialWorkout: Workout? = nil, repository: any WorkoutRepository, historyRepository: (any ExerciseHistoryRepository)? = nil, progressionRepository: (any ProgressionRepository)? = nil, exerciseRepository: (any ExerciseRepository)? = nil, settingsRepository: (any SettingsRepository)? = nil, weightUnit: WeightUnit = .pounds, defaultRestDuration: TimeInterval = 90, now: @escaping () -> Date = Date.init, timer: CountdownTimer? = nil, restSessionStore: WorkoutRestSessionStore? = nil, haptics: (any HapticsClient)? = nil, audio: (any AudioFeedbackClient)? = nil, didPersist: @escaping (Workout) -> Void = { _ in }) {
        self.workoutID = workoutID
        workout = initialWorkout?.id == workoutID ? initialWorkout : nil
        self.repository = repository
        self.weightUnit = weightUnit
        self.now = now
        self.didPersist = didPersist
        self.restSessionStore = restSessionStore ?? WorkoutRestSessionStore()
        self.defaultRestDuration = defaultRestDuration
        self.timer = timer ?? CountdownTimer(now: { now().timeIntervalSinceReferenceDate })
        self.haptics = haptics ?? NoopHapticsClient(); self.audio = audio ?? NoopAudioFeedbackClient()
        self.historyRepository = historyRepository
        self.progressionRepository = progressionRepository
        self.exerciseRepository = exerciseRepository
        self.settingsRepository = settingsRepository ?? (repository as? any SettingsRepository)
    }
    var restState: WorkoutRestState? {
        guard let restingExercise, timer.state == .running || timer.state == .paused || timer.state == .completed else { return nil }
        return .init(
            exerciseID: restingExercise.id,
            exerciseName: restingExercise.name,
            completesExercise: completedExerciseAwaitingSelectionID == restingExercise.id,
            totalDuration: timer.configuredDuration,
            remaining: timer.remainingDuration
        )
    }
    var foregroundState: ExecutionForegroundState {
        if restState != nil { return .rest }
        if workTimerState != nil { return .work }
        return .exercise
    }
    var workTimerState: WorkoutWorkTimerState? {
        guard let pendingTimedSet, let workTimerPhase,
              timer.state == .running || timer.state == .paused || timer.state == .completed else { return nil }
        return .init(
            exerciseID: pendingTimedSet.exerciseID,
            exerciseName: pendingTimedSet.exerciseName,
            setNumber: pendingTimedSet.setNumber,
            totalSets: pendingTimedSet.totalSets,
            isTwoSided: pendingTimedSet.twoSided,
            phase: workTimerPhase,
            totalDuration: timer.configuredDuration,
            remaining: timer.remainingDuration
        )
    }

    var isReadOnly: Bool { workout?.status == .completed }
    var showsExecutionOptions: Bool { workout?.status == .inProgress && !isReadOnly }
    var progress: WorkoutProgress { workout.map(WorkoutExecutionQuery.progress) ?? .init(completedSetCount: 0, requiredSetCount: 0) }
    var states: [WorkoutExerciseID: ExerciseState] { workout.map { WorkoutExecutionQuery.states(in: $0, focusedExerciseID: focusedExerciseID) } ?? [:] }
    var canComplete: Bool { workout.map { $0.status == .inProgress && WorkoutExecutionQuery.canComplete($0) } ?? false }
    var awaitsExerciseSelection: Bool { completedExerciseAwaitingSelectionID != nil && restState == nil }
    var completedExercises: [WorkoutExercise] { workout?.exercises.filter { $0.skippedAt == nil && WorkoutExecutionQuery.isComplete($0) } ?? [] }
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
    var canEditRestDuration: Bool { settingsRepository != nil && showsExecutionOptions }
    var shareText: String? { workout.map { WorkoutShareText.build(workout: $0, unit: weightUnit) } }
    var globalRestDuration: TimeInterval { defaultRestDuration }
    var configuredRestDuration: TimeInterval { defaultRestDuration }

    func effectiveRestDuration(for exerciseID: WorkoutExerciseID) -> TimeInterval {
        guard let stableID = exercise(id: exerciseID)?.exerciseID else { return defaultRestDuration }
        return exerciseRestDurations[stableID] ?? defaultRestDuration
    }

    func exerciseRestDurationOverride(for exerciseID: WorkoutExerciseID) -> TimeInterval? {
        guard let stableID = exercise(id: exerciseID)?.exerciseID else { return nil }
        return exerciseRestDurations[stableID]
    }

    func exercise(id: WorkoutExerciseID) -> WorkoutExercise? {
        workout?.exercises.first { $0.id == id }
    }

    func activate() async {
        guard !isActivated else { return }
        isActivated = true
        do {
            guard let loaded = try await repository.workout(id: workoutID) else {
                restSessionStore.clear(workoutID: workoutID)
                throw RepositoryError.notFound
            }
            var activeWorkout = loaded
            workout = loaded
            if loaded.status == .ready {
                // Yield keeps the Home source card alive through destination activation.
                await Task.yield()
                let started = try await repository.startWorkout(id: workoutID, at: now())
                accept(started)
                activeWorkout = started
            }
            selectFirstIncompleteSet()
            restoreRestSessionIfAvailable(in: activeWorkout)
            try await loadRestPreferences(for: activeWorkout)
            await loadSuggestions(for: activeWorkout)
            errorMessage = nil
        } catch { errorMessage = message(for: error) }
    }

    func refreshFromPersistence() async {
        let preservedFocusedExerciseID = focusedExerciseID
        let preservedCurrentExerciseID = currentExercise?.id
        let preservedPrescriptionID = currentPrescription?.id
        do {
            guard let loaded = try await repository.workout(id: workoutID) else {
                stopTimer(); throw RepositoryError.notFound
            }
            accept(loaded)
            reconcileSelection(
                focusedExerciseID: preservedFocusedExerciseID,
                currentExerciseID: preservedCurrentExerciseID,
                prescriptionID: preservedPrescriptionID
            )
            reconcileCompletionPresentation(in: loaded)
            invalidateRestIfNeeded(for: loaded)
            try await loadRestPreferences(for: loaded)
            await loadSuggestions(for: loaded); errorMessage = nil
        } catch { errorMessage = message(for: error) }
    }

    func refreshRestPreferences() async {
        guard let workout else { return }
        do {
            try await loadRestPreferences(for: workout)
            errorMessage = nil
        } catch { errorMessage = message(for: error) }
    }

    func suggestion(for exercise: WorkoutExercise) -> ProgressionSuggestion? {
        guard exercise.skippedAt == nil,
              exercise.prescriptions.contains(where: { if case .repetitions = $0.target { true } else { false } }) else { return nil }
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
            if WorkoutExecutionQuery.canComplete(updated), await autoCompleteIfEligible(updated) { return }
            guard let loggedExercise = updated.exercises.first(where: { $0.id == exerciseID }) else { return }
            let exerciseCompleted = WorkoutExecutionQuery.isComplete(loggedExercise)
            let exerciseJustCompleted = !wasComplete && exerciseCompleted
            let beganRest = !wasComplete && beginRestIfAppropriate(
                after: loggedExercise,
                in: updated,
                completesExercise: exerciseJustCompleted
            )
            if exerciseJustCompleted {
                completedExerciseAwaitingSelectionID = exerciseID
                focusedExerciseID = nil
                selectFirstIncompleteSet()
            } else if exerciseCompleted {
                selectedSetIndex = loggedExercise.prescriptions.firstIndex(where: { $0.id == prescriptionID })
                    ?? selectedSetIndex
            } else if let index = loggedExercise.prescriptions.firstIndex(where: { !WorkoutExecutionQuery.completedPrescriptionIDs(in: loggedExercise).contains($0.id) }) {
                selectedSetIndex = index
            }
            if exerciseJustCompleted { haptics.perform(.exerciseCompleted) }
            else if beganRest { haptics.perform(.restTransition) }
            else { haptics.perform(.setLogged) }
            errorMessage = nil
        } catch { errorMessage = message(for: error) }
    }

    func logFirstSet(exerciseID: WorkoutExerciseID, input: SetLogInput) async {
        do {
            let appended = try await repository.appendSet(workoutID: workoutID, exerciseID: exerciseID, seed: input, at: now())
            guard let prescriptionID = appended.exercises.first(where: { $0.id == exerciseID })?.prescriptions.last?.id else { throw RepositoryError.prescriptionNotFound }
            let updated = try await repository.logSet(workoutID: workoutID, exerciseID: exerciseID, prescriptionID: prescriptionID, input: input, completed: true, at: now())
            accept(updated)
            if WorkoutExecutionQuery.canComplete(updated), await autoCompleteIfEligible(updated) { return }
            if let loggedExercise = updated.exercises.first(where: { $0.id == exerciseID }) {
                let exerciseCompleted = WorkoutExecutionQuery.isComplete(loggedExercise)
                let beganRest = beginRestIfAppropriate(
                    after: loggedExercise,
                    in: updated,
                    completesExercise: exerciseCompleted
                )
                if exerciseCompleted {
                    completedExerciseAwaitingSelectionID = exerciseID
                    focusedExerciseID = nil
                    selectFirstIncompleteSet()
                }
                if exerciseCompleted { haptics.perform(.exerciseCompleted) }
                else if beganRest { haptics.perform(.restTransition) }
                else { haptics.perform(.setLogged) }
            }
            errorMessage = nil
        } catch { errorMessage = message(for: error) }
    }
    func startFirstWorkTimer(exerciseID: WorkoutExerciseID, input: SetLogInput) async {
        do {
            let appended = try await repository.appendSet(workoutID: workoutID, exerciseID: exerciseID, seed: input, at: now())
            accept(appended)
            guard let prescriptionID = appended.exercises.first(where: { $0.id == exerciseID })?.prescriptions.last?.id else { throw RepositoryError.prescriptionNotFound }
            completedExerciseAwaitingSelectionID = nil
            focusedExerciseID = exerciseID
            selectedSetIndex = max(0, (appended.exercises.first { $0.id == exerciseID }?.prescriptions.count ?? 1) - 1)
            startWorkTimer(exerciseID: exerciseID, prescriptionID: prescriptionID, input: input)
            errorMessage = nil
        } catch { errorMessage = message(for: error) }
    }

    func addSet(exerciseID: WorkoutExerciseID) async {
        do {
            let updated = try await repository.appendSet(workoutID: workoutID, exerciseID: exerciseID, seed: nil, at: now())
            accept(updated); completedExerciseAwaitingSelectionID = nil; focusedExerciseID = exerciseID
            errorMessage = nil
        } catch { errorMessage = message(for: error) }
    }

    func updateSetCount(exerciseID: WorkoutExerciseID, count: Int) async -> Bool {
        guard (1...20).contains(count), workTimerState == nil, restState == nil,
              let originalExercise = workout?.exercises.first(where: { $0.id == exerciseID }),
              originalExercise.skippedAt == nil else { return false }
        let completedIDs = Set(originalExercise.loggedSets.filter { $0.completedAt != nil }.compactMap(\.prescriptionID))
        guard count >= completedIDs.count else {
            errorMessage = "Keep at least \(completedIDs.count) completed \(completedIDs.count == 1 ? "set" : "sets")."
            return false
        }
        let activePrescriptionID = focusedExerciseID == exerciseID ? currentPrescription?.id : nil
        let originalIndex = selectedSetIndex
        do {
            guard var updated = try await repository.workout(id: workoutID) else { throw RepositoryError.notFound }
            guard let loadedExercise = updated.exercises.first(where: { $0.id == exerciseID }) else { throw RepositoryError.notFound }
            let loadedCompletedCount = Set(loadedExercise.loggedSets.filter { $0.completedAt != nil }.compactMap(\.prescriptionID)).count
            guard count >= loadedCompletedCount else {
                errorMessage = "Keep at least \(loadedCompletedCount) completed \(loadedCompletedCount == 1 ? "set" : "sets")."
                return false
            }
            while let exercise = updated.exercises.first(where: { $0.id == exerciseID }), exercise.prescriptions.count < count {
                let seed: SetLogInput? = exercise.prescriptions.isEmpty
                    ? (exercise.isTimeBased ? .duration(weight: nil, seconds: 30) : .repetitions(weight: nil, repetitions: 1))
                    : nil
                updated = try await repository.appendSet(workoutID: workoutID, exerciseID: exerciseID, seed: seed, at: now())
            }
            while let exercise = updated.exercises.first(where: { $0.id == exerciseID }), exercise.prescriptions.count > count {
                let completed = Set(exercise.loggedSets.filter { $0.completedAt != nil }.compactMap(\.prescriptionID))
                guard let removable = exercise.prescriptions.reversed().first(where: { !completed.contains($0.id) }) else {
                    errorMessage = "Completed sets cannot be removed."
                    return false
                }
                updated = try await repository.removeSet(workoutID: workoutID, exerciseID: exerciseID, prescriptionID: removable.id, at: now())
            }
            accept(updated)
            completedExerciseAwaitingSelectionID = nil
            focusedExerciseID = exerciseID
            if let activePrescriptionID,
               let exercise = updated.exercises.first(where: { $0.id == exerciseID }),
               let activeIndex = exercise.prescriptions.firstIndex(where: { $0.id == activePrescriptionID }) {
                selectedSetIndex = activeIndex
            } else {
                selectedSetIndex = max(0, min(originalIndex, count - 1))
            }
            errorMessage = nil
            return true
        } catch {
            errorMessage = message(for: error)
            return false
        }
    }

    func removeCurrentSet(exerciseID: WorkoutExerciseID, prescriptionID: SetID) async {
        do { let updated = try await repository.removeSet(workoutID: workoutID, exerciseID: exerciseID, prescriptionID: prescriptionID, at: now()); accept(updated); completedExerciseAwaitingSelectionID = nil; selectFirstIncompleteSet(); errorMessage = nil }
        catch { errorMessage = message(for: error) }
    }

    func focus(_ id: WorkoutExerciseID) {
        guard let workout, workout.status == .inProgress,
              let exercise = workout.exercises.first(where: { $0.id == id }),
              exercise.skippedAt == nil else { return }
        completedExerciseAwaitingSelectionID = nil
        focusedExerciseID = id
        selectedSetIndex = exercise.prescriptions.firstIndex(where: { !WorkoutExecutionQuery.completedPrescriptionIDs(in: exercise).contains($0.id) })
            ?? max(0, exercise.prescriptions.count - 1)
    }

    func selectSet(at index: Int) {
        guard let exercise = currentExercise, exercise.prescriptions.indices.contains(index) else { return }
        selectedSetIndex = index
    }

    func skipRest() {
        guard restState != nil else { return }
        haptics.perform(.restSkipped)
        stopTimer()
    }

    func startWorkTimer(exerciseID: WorkoutExerciseID, prescriptionID: SetID, input: SetLogInput) {
        guard workTimerState == nil, restState == nil,
              let exercise = workout?.exercises.first(where: { $0.id == exerciseID }),
              exercise.skippedAt == nil,
              let index = exercise.prescriptions.firstIndex(where: { $0.id == prescriptionID }),
              case .duration(_, let seconds) = input, seconds > 0 else { return }
        pendingTimedSet = (exerciseID, prescriptionID, input, seconds, exercise.isTwoSided, exercise.nameSnapshot, index + 1, exercise.prescriptions.count)
        workTimerPhase = .ready
        startTimer(duration: WorkoutWorkTimerTiming.countdownDuration)
    }
    func toggleWorkTimerPause() {
        guard workTimerPhase != .ready else { return }
        if timer.state == .running {
            timer.pause()
            haptics.perform(.selection)
        } else if timer.state == .paused {
            timer.resume()
            haptics.perform(.selection)
        }
    }
    func skipWorkTimer() {
        guard pendingTimedSet != nil, !isFinishingTimedSet else { return }
        haptics.perform(.timerSkipped)
        if workTimerPhase == .switchSides { transitionToWork(.secondSide) }
        else { finishTimedSet() }
    }

    func refreshRest(at date: Date? = nil) {
        if restingExercise != nil,
           let session = restSessionStore.session(for: workoutID) {
            let instant = date ?? now()
            let startedAt = session.deadline.addingTimeInterval(-session.totalDuration)
            timer.start(
                duration: session.totalDuration,
                alreadyElapsed: max(0, instant.timeIntervalSince(startedAt))
            )
            if timer.state == .completed { resolveTimerCompletion() }
            return
        }
        guard timer.refresh() else { return }
        resolveTimerCompletion()
    }

    func resetWorkout() async -> Bool {
        do {
            let reset = try await repository.resetWorkout(id: workoutID, at: now())
            stopTimer(); completedExerciseAwaitingSelectionID = nil; focusedExerciseID = nil; selectedSetIndex = 0; accept(reset); selectFirstIncompleteSet(); errorMessage = nil
            return true
        } catch { errorMessage = message(for: error); return false }
    }

    func deleteWorkout() async -> Bool {
        do { try await repository.deleteWorkout(id: workoutID); stopTimer(); errorMessage = nil; return true }
        catch { errorMessage = message(for: error); return false }
    }

    func setGlobalRestDuration(_ seconds: TimeInterval) async -> Bool {
        guard let settingsRepository else { return false }
        do {
            try await settingsRepository.saveDefaultRestDuration(seconds)
            defaultRestDuration = seconds
            errorMessage = nil
            return true
        } catch { errorMessage = message(for: error); return false }
    }
    func setExerciseRestDuration(exerciseID: WorkoutExerciseID, seconds: TimeInterval?) async -> Bool {
        guard showsExecutionOptions,
              let exercise = exercise(id: exerciseID), exercise.skippedAt == nil,
              let settingsRepository else { return false }
        let stableID = exercise.exerciseID
        do {
            try await settingsRepository.saveExerciseRestDuration(seconds, for: stableID)
            exerciseRestDurations[stableID] = seconds
            errorMessage = nil
            return true
        }
        catch { errorMessage = message(for: error); return false }
    }
    func availableExercises() async -> [ExerciseDefinition] { (try? await exerciseRepository?.allExercises()) ?? [] }
    func progressionProfile(for exercise: WorkoutExercise) async -> AutoProgressionProfile { (try? await progressionRepository?.progressionConfiguration().assignments[exercise.exerciseID]) ?? .none }
    func updateExerciseSettings(
        exerciseID: WorkoutExerciseID,
        timeBased: Bool,
        twoSided: Bool,
        progression: AutoProgressionProfile
    ) async -> Bool {
        guard showsExecutionOptions, exercise(id: exerciseID)?.skippedAt == nil else { return false }
        guard var value = workout, let index = value.exercises.firstIndex(where: { $0.id == exerciseID }) else { return false }
        var occurrence = value.exercises[index]
        if occurrence.isTimeBased != timeBased {
            occurrence.prescriptions = occurrence.prescriptions.map { item in var result = item; switch (timeBased, item.target) { case (true, .repetitions(let range)): result.target = .duration(seconds: TimeInterval(range.lowerBound)); case (false, .duration(let seconds)): let reps = max(1, Int(seconds.rounded())); result.target = .repetitions(range: reps...reps); default: break }; return result }
            occurrence.loggedSets = []
        }
        occurrence.isTimeBased = timeBased; occurrence.isTwoSided = twoSided; value.exercises[index] = occurrence; value.updatedAt = now()
        do {
            try await repository.update(value)
            if var configuration = try await progressionRepository?.progressionConfiguration() {
                configuration.assign(progression, to: occurrence.exerciseID)
                try await progressionRepository?.saveProgressionConfiguration(configuration)
            }
            accept(value); errorMessage = nil; return true
        } catch { errorMessage = message(for: error); return false }
    }
    func swapExercise(occurrenceID: WorkoutExerciseID, with definition: ExerciseDefinition) async -> Bool {
        guard var value = workout,
              let index = value.exercises.firstIndex(where: { $0.id == occurrenceID }),
              value.exercises[index].skippedAt == nil else { return false }
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
            if restingExercise?.id == occurrenceID { stopTimer() }
            else { restSessionStore.clear(workoutID: workoutID, exerciseID: occurrenceID) }
            completedExerciseAwaitingSelectionID = nil
            focusedExerciseID = occurrenceID
            selectedSetIndex = 0
            suggestions[old.exerciseID] = nil
            if let settingsRepository {
                exerciseRestDurations[definition.id] = try? await settingsRepository.exerciseRestDuration(for: definition.id)
            }
            await loadSuggestions(for: value)
            errorMessage = nil
            return true
        } catch { errorMessage = message(for: error); return false }
    }
    func removeExercise(_ occurrenceID: WorkoutExerciseID) async -> Bool {
        guard workout?.exercises.contains(where: { $0.id == occurrenceID && $0.skippedAt == nil }) == true else { return false }
        do {
            let value = try await repository.removeExercise(workoutID: workoutID, exerciseID: occurrenceID, at: now())
            accept(value)
            if restingExercise?.id == occurrenceID { stopTimer() }
            else { restSessionStore.clear(workoutID: workoutID, exerciseID: occurrenceID) }
            if completedExerciseAwaitingSelectionID == occurrenceID {
                completedExerciseAwaitingSelectionID = nil
            }
            focusedExerciseID = nil; selectFirstIncompleteSet(); errorMessage = nil; return true
        } catch { errorMessage = message(for: error); return false }
    }

    func skipExercise(_ occurrenceID: WorkoutExerciseID) async -> Bool {
        guard let exercise = exercise(id: occurrenceID), exercise.skippedAt == nil else { return false }
        let wasFocused = focusedExerciseID == occurrenceID || currentExercise?.id == occurrenceID
        do {
            let value = try await repository.skipExercise(
                workoutID: workoutID,
                exerciseID: occurrenceID,
                at: now()
            )
            accept(value)
            suggestions[exercise.exerciseID] = nil
            if restingExercise?.id == occurrenceID { stopTimer() }
            else { restSessionStore.clear(workoutID: workoutID, exerciseID: occurrenceID) }
            if wasFocused {
                focusedExerciseID = nil
                selectedSetIndex = 0
                completedExerciseAwaitingSelectionID = occurrenceID
            }
            haptics.perform(.exerciseSkipped)
            errorMessage = nil
            return true
        } catch {
            errorMessage = message(for: error)
            return false
        }
    }

    func restoreExercise(_ occurrenceID: WorkoutExerciseID) async -> Bool {
        guard let exercise = exercise(id: occurrenceID), exercise.skippedAt != nil else { return false }
        do {
            let value = try await repository.restoreExercise(
                workoutID: workoutID,
                exerciseID: occurrenceID,
                at: now()
            )
            accept(value)
            if focusedExerciseID == occurrenceID { focusedExerciseID = nil }
            if completedExerciseAwaitingSelectionID == occurrenceID {
                completedExerciseAwaitingSelectionID = nil
            }
            await loadSuggestions(for: value)
            haptics.perform(.exerciseRestored)
            errorMessage = nil
            return true
        } catch {
            errorMessage = message(for: error)
            return false
        }
    }

    private func accept(_ value: Workout) { workout = value; didPersist(value) }
    private func autoCompleteIfEligible(_ value: Workout) async -> Bool {
        guard value.status == .inProgress, WorkoutExecutionQuery.canComplete(value) else { return false }
        do {
            let completed = try await repository.completeWorkout(id: workoutID, at: now())
            stopTimer()
            accept(completed)
            completedExerciseAwaitingSelectionID = nil
            focusedExerciseID = nil
            selectedSetIndex = 0
            didAutoComplete = true
            haptics.perform(.workoutCompleted)
            errorMessage = nil
            return true
        } catch { errorMessage = message(for: error); return false }
    }
    private func loadSuggestions(for workout: Workout) async {
        guard let historyRepository, let progressionRepository,
              let configuration = try? await progressionRepository.progressionConfiguration(), configuration.isEnabled else { return }
        for exercise in workout.exercises {
            guard exercise.skippedAt == nil,
                  exercise.prescriptions.contains(where: { if case .repetitions = $0.target { true } else { false } }),
                  let rule = ProgressionRuleResolver.resolve(exerciseID: exercise.exerciseID, configuration: configuration),
                  let log = try? await historyRepository.latestExerciseLog(exerciseID: exercise.exerciseID) else { continue }
            suggestions[exercise.exerciseID] = ProgressionEngine.calculate(exerciseID: exercise.exerciseID, parameters: rule.parameters, sets: log.sets)
        }
    }
    private func loadRestPreferences(for workout: Workout) async throws {
        guard let settingsRepository else { return }
        defaultRestDuration = try await settingsRepository.settings().defaultRestDuration
        var loaded: [ExerciseID: TimeInterval] = [:]
        for exerciseID in Set(workout.exercises.map(\.exerciseID)) {
            loaded[exerciseID] = try await settingsRepository.exerciseRestDuration(for: exerciseID)
        }
        exerciseRestDurations = loaded
    }
    private func selectFirstIncompleteSet() {
        guard let exercise = currentExercise else { selectedSetIndex = 0; return }
        selectedSetIndex = exercise.prescriptions.firstIndex(where: { !WorkoutExecutionQuery.completedPrescriptionIDs(in: exercise).contains($0.id) }) ?? 0
    }
    private func reconcileSelection(
        focusedExerciseID: WorkoutExerciseID?,
        currentExerciseID: WorkoutExerciseID?,
        prescriptionID: SetID?
    ) {
        guard let workout, workout.status == .inProgress else {
            self.focusedExerciseID = nil
            selectedSetIndex = 0
            return
        }
        if let focusedExerciseID,
           let exercise = workout.exercises.first(where: { $0.id == focusedExerciseID }) {
            self.focusedExerciseID = focusedExerciseID
            restoreSelectedSet(in: exercise, prescriptionID: prescriptionID)
            return
        }
        self.focusedExerciseID = nil
        guard let exercise = currentExercise, exercise.id == currentExerciseID else {
            selectFirstIncompleteSet()
            return
        }
        restoreSelectedSet(in: exercise, prescriptionID: prescriptionID)
    }
    private func restoreSelectedSet(in exercise: WorkoutExercise, prescriptionID: SetID?) {
        if let prescriptionID,
           let index = exercise.prescriptions.firstIndex(where: { $0.id == prescriptionID }) {
            selectedSetIndex = index
        } else {
            selectedSetIndex = exercise.prescriptions.firstIndex(where: {
                !WorkoutExecutionQuery.completedPrescriptionIDs(in: exercise).contains($0.id)
            }) ?? max(0, exercise.prescriptions.count - 1)
        }
    }
    private func reconcileCompletionPresentation(in workout: Workout) {
        guard let completedExerciseAwaitingSelectionID else { return }
        guard workout.status == .inProgress,
              let exercise = workout.exercises.first(where: { $0.id == completedExerciseAwaitingSelectionID }),
              WorkoutExecutionQuery.isComplete(exercise) else {
            self.completedExerciseAwaitingSelectionID = nil
            return
        }
        focusedExerciseID = nil
    }
    private func startTimer(duration: TimeInterval, alreadyElapsed: TimeInterval = 0) {
        restTask?.cancel()
        timer.start(duration: duration, alreadyElapsed: alreadyElapsed)
        restTask = Task { [weak self] in
            while !Task.isCancelled {
                let remaining = self?.timer.currentRemainingDuration ?? 1
                let refreshInterval = min(max(remaining, 0.05), 1)
                try? await Task.sleep(for: .seconds(refreshInterval))
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
        case .ready:
            haptics.perform(.timerStarted)
            transitionToWork(.firstSide, alreadyElapsed: timer.completionOverrun)
        case .firstSide:
            haptics.perform(.timerCompleted); audio.timerCompleted()
            pendingTimedSet.twoSided ? transitionToWork(.switchSides, alreadyElapsed: timer.completionOverrun) : finishTimedSet()
        case .switchSides:
            haptics.perform(.timerCompleted); transitionToWork(.secondSide, alreadyElapsed: timer.completionOverrun)
        case .secondSide:
            haptics.perform(.timerCompleted); audio.timerCompleted(); finishTimedSet()
        }
    }
    private func finishTimedSet() {
        guard let pending = pendingTimedSet, !isFinishingTimedSet else { return }
        isFinishingTimedSet = true
        restTask?.cancel()
        restTask = nil

        // Keep the work presentation alive while the set is persisted. Clearing it here
        // creates an observable `.exercise` frame between work and rest, which makes the
        // timer disappear and both cards expand before the rest state exists.
        if timer.state != .completed {
            timer.start(duration: max(timer.configuredDuration, 1), alreadyElapsed: max(timer.configuredDuration, 1))
        }

        Task { [weak self] in
            guard let self else { return }
            await self.log(exerciseID: pending.exerciseID, prescriptionID: pending.prescriptionID, input: pending.input)
            self.finishTimedSetHandoff()
        }
    }

    private func finishTimedSetHandoff() {
        workTimerPhase = nil
        pendingTimedSet = nil
        isFinishingTimedSet = false
        if restingExercise == nil, timer.state == .completed {
            timer.cancel()
        }
    }
    @discardableResult private func beginRestIfAppropriate(
        after exercise: WorkoutExercise,
        in workout: Workout,
        completesExercise: Bool
    ) -> Bool {
        guard !WorkoutExecutionQuery.canComplete(workout) else { return false }
        let duration = exerciseRestDurations[exercise.exerciseID] ?? defaultRestDuration
        guard duration > 0 else { return false }
        restingExercise = (exercise.id, exercise.nameSnapshot)
        restSessionStore.begin(
            workoutID: workoutID,
            exerciseID: exercise.id,
            completesExercise: completesExercise,
            duration: duration,
            at: now()
        )
        startTimer(duration: duration)
        return true
    }
    private func restoreRestSessionIfAvailable(in workout: Workout) {
        guard let session = restSessionStore.session(for: workoutID) else { return }
        guard workout.status == .inProgress,
              !WorkoutExecutionQuery.canComplete(workout),
              let exercise = workout.exercises.first(where: { $0.id == session.exerciseID }),
              session.totalDuration.isFinite, session.totalDuration > 0 else {
            restSessionStore.clear(workoutID: workoutID)
            return
        }
        if session.completesExercise {
            completedExerciseAwaitingSelectionID = exercise.id
        }
        restingExercise = (exercise.id, exercise.nameSnapshot)
        let remaining = session.deadline.timeIntervalSince(now())
        let alreadyElapsed = max(0, session.totalDuration - min(session.totalDuration, remaining))
        startTimer(duration: session.totalDuration, alreadyElapsed: alreadyElapsed)
        if timer.state == .completed { resolveTimerCompletion() }
    }
    private func invalidateRestIfNeeded(for workout: Workout) {
        guard let session = restSessionStore.session(for: workoutID) else { return }
        guard workout.status == .inProgress,
              !WorkoutExecutionQuery.canComplete(workout),
              workout.exercises.contains(where: { $0.id == session.exerciseID }) else {
            if restingExercise != nil { stopTimer() }
            else { restSessionStore.clear(workoutID: workoutID) }
            return
        }
    }
    private func resolveTimerCompletion() {
        if restingExercise != nil {
            haptics.perform(.timerCompleted); audio.timerCompleted(); stopTimer(clearTimer: false)
        } else if workTimerPhase != nil { advanceWorkTimer() }
    }
    private func stopTimer(clearTimer: Bool = true) {
        restTask?.cancel(); restTask = nil; restingExercise = nil; workTimerPhase = nil; pendingTimedSet = nil; isFinishingTimedSet = false
        restSessionStore.clear(workoutID: workoutID)
        if clearTimer { timer.cancel() }
    }
    private func message(for error: Error) -> String {
        switch error as? RepositoryError {
        case .incompleteWorkout: return "Complete every required set before finishing."
        case .immutableCompletedWorkout: return "Completed workouts are read-only."
        case .exerciseSkipped: return "Restore this exercise before logging or editing sets."
        case .invalidSetInput: return "Enter a valid set value."
        case .invalidRestDuration, .invalidSettings: return "Choose a rest duration from 15 seconds to 5 minutes."
            default: return "The workout could not be updated."
        }
    }
}
