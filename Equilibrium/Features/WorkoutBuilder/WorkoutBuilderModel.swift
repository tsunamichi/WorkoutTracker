import Foundation
import Observation

struct WorkoutDraft: Hashable, Sendable {
    var name = ""
    var exercises: [DraftExercise] = []
    var isMeaningful: Bool { !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || !exercises.isEmpty }
}

struct DraftExercise: Identifiable, Hashable, Sendable {
    let id: UUID
    var exerciseID: ExerciseID?
    var name: String
    var prescriptions: [DraftSet]
    var restDuration: TimeInterval?
    init(id: UUID = UUID(), exerciseID: ExerciseID?, name: String, prescriptions: [DraftSet] = [], restDuration: TimeInterval? = nil) {
        self.id = id; self.exerciseID = exerciseID; self.name = name; self.prescriptions = prescriptions; self.restDuration = restDuration
    }
}

struct DraftSet: Identifiable, Hashable, Sendable {
    enum Target: Hashable, Sendable { case repetitions(lower: Int, upper: Int), duration(seconds: Int) }
    let id: UUID
    var target: Target
    var suggestedPounds: Double?
    static func repetitions() -> Self { .init(id: UUID(), target: .repetitions(lower: 8, upper: 12), suggestedPounds: nil) }
    static func duration() -> Self { .init(id: UUID(), target: .duration(seconds: 30), suggestedPounds: nil) }
}

@MainActor @Observable
final class WorkoutBuilderModel {
    var draft: WorkoutDraft
    private(set) var errorMessage: String?
    private(set) var isSaving = false
    private let exercises: any ExerciseRepository
    private let workouts: any WorkoutRepository
    private let history: any ExerciseHistoryRepository

    init(draft: WorkoutDraft = .init(), exercises: any ExerciseRepository, workouts: any WorkoutRepository, history: any ExerciseHistoryRepository) {
        self.draft = draft; self.exercises = exercises; self.workouts = workouts; self.history = history
    }
    var canCommit: Bool { !draft.name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !draft.exercises.isEmpty }
    func add(_ exercise: ExerciseDefinition) { draft.exercises.append(.init(exerciseID: exercise.id, name: exercise.name)) }
    func remove(at offsets: IndexSet) { draft.exercises.remove(atOffsets: offsets) }
    func move(from offsets: IndexSet, to destination: Int) { draft.exercises.move(fromOffsets: offsets, toOffset: destination) }
    func moveExercise(id: UUID, direction: Int) {
        guard let old = draft.exercises.firstIndex(where: { $0.id == id }) else { return }; let new = old + direction
        guard draft.exercises.indices.contains(new) else { return }; draft.exercises.swapAt(old, new)
    }
    func addSet(to exerciseID: UUID, target: DraftSet.Target? = nil) {
        guard let index = draft.exercises.firstIndex(where: { $0.id == exerciseID }) else { return }
        let previous = draft.exercises[index].prescriptions.last
        draft.exercises[index].prescriptions.append(.init(id: UUID(), target: target ?? previous?.target ?? .repetitions(lower: 8, upper: 12), suggestedPounds: previous?.suggestedPounds))
    }
    func removeSet(_ setID: UUID, from exerciseID: UUID) {
        guard let index = draft.exercises.firstIndex(where: { $0.id == exerciseID }), draft.exercises[index].prescriptions.count > 1 else { return }
        draft.exercises[index].prescriptions.removeAll { $0.id == setID }
    }
    func create(now: Date = .now) async -> Workout? {
        guard canCommit else { errorMessage = "Add a workout name and exercise."; return nil }
        isSaving = true; defer { isSaving = false }
        do {
            let value = try await makeWorkout(now: now)
            try await workouts.create(value)
            errorMessage = nil; return value
        } catch { errorMessage = "The workout could not be added." }
        return nil
    }
    func makeWorkout(now: Date = .now) async throws -> Workout {
        var workoutExercises: [WorkoutExercise] = []
        for draftExercise in draft.exercises {
            let definition: ExerciseDefinition
            if let id = draftExercise.exerciseID, let existing = try await exercises.exercise(id: id) { definition = existing }
            else {
                let clean = draftExercise.name.trimmingCharacters(in: .whitespacesAndNewlines)
                if let existing = try await exercises.searchExercises(clean).first(where: { $0.normalizedName == SwiftDataRepository.normalizeExerciseName(clean) }) { definition = existing }
                else {
                    definition = .init(id: .new(), name: clean, normalizedName: SwiftDataRepository.normalizeExerciseName(clean), aliases: [], equipment: nil, category: nil, isCustom: true, archivedAt: nil)
                    try await exercises.saveExercise(definition)
                }
            }
            let prescriptions: [SetPrescription]
            if draftExercise.prescriptions.isEmpty {
                let latest = try await history.latestExerciseLog(exerciseID: definition.id)
                prescriptions = latest?.sets.map(Self.inheritedPrescription) ?? []
            } else {
                prescriptions = draftExercise.prescriptions.map(Self.prescription)
            }
            workoutExercises.append(.init(id: .new(), exerciseID: definition.id, nameSnapshot: definition.name, prescriptions: prescriptions, loggedSets: [], restDuration: draftExercise.restDuration, skippedAt: nil))
        }
        return .init(id: .new(), titleSnapshot: draft.name.trimmingCharacters(in: .whitespacesAndNewlines), exercises: workoutExercises, status: .ready, startedAt: nil, completedAt: nil, createdAt: now, updatedAt: now)
    }
    private static func inheritedPrescription(_ set: LoggedSet) -> SetPrescription {
        if let duration = set.duration { return .init(id: .new(), target: .duration(seconds: duration), suggestedWeight: nil) }
        let reps = max(1, set.repetitions ?? 1)
        return .init(id: .new(), target: .repetitions(range: reps...reps), suggestedWeight: set.weight)
    }
    private static func prescription(_ set: DraftSet) -> SetPrescription {
        let target: SetTarget
        switch set.target { case .repetitions(let lower, let upper): target = .repetitions(range: min(lower, upper)...max(lower, upper)); case .duration(let seconds): target = .duration(seconds: Double(max(1, seconds))) }
        return .init(id: .new(), target: target, suggestedWeight: set.suggestedPounds.map(Weight.init(pounds:)))
    }
}

extension WorkoutDraft {
    init(recent workout: Workout) {
        name = workout.titleSnapshot
        exercises = workout.exercises.map { .init(exerciseID: $0.exerciseID, name: $0.nameSnapshot, prescriptions: $0.prescriptions.map(DraftSet.init), restDuration: $0.restDuration) }
    }
}
private extension DraftSet {
    init(_ prescription: SetPrescription) {
        id = UUID(); suggestedPounds = prescription.suggestedWeight?.pounds
        switch prescription.target { case .repetitions(let range): target = .repetitions(lower: range.lowerBound, upper: range.upperBound); case .duration(let seconds): target = .duration(seconds: max(1, Int(seconds.rounded()))) }
    }
}
