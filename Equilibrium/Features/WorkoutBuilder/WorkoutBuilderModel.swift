import Foundation
import Observation

struct WorkoutDraft: Hashable, Sendable {
    var name = ""
    var exercises: [DraftExercise] = []
    var sourceTemplateID: WorkoutTemplateID?
    var isMeaningful: Bool { !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || !exercises.isEmpty }
}

struct DraftExercise: Identifiable, Hashable, Sendable {
    let id: UUID
    let exerciseID: ExerciseID
    var name: String
    var prescriptions: [DraftSet]
    var restDuration: TimeInterval?
    init(id: UUID = UUID(), exerciseID: ExerciseID, name: String, prescriptions: [DraftSet] = [.repetitions()], restDuration: TimeInterval? = nil) {
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
    let day: LocalDay
    private let templates: any WorkoutTemplateRepository
    private let workouts: any ScheduledWorkoutRepository

    init(day: LocalDay, draft: WorkoutDraft = .init(), templates: any WorkoutTemplateRepository, workouts: any ScheduledWorkoutRepository) {
        self.day = day; self.draft = draft; self.templates = templates; self.workouts = workouts
    }
    var canCommit: Bool { !draft.name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !draft.exercises.isEmpty && draft.exercises.allSatisfy { !$0.prescriptions.isEmpty } }
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
    func saveTemplate(now: Date = .now) async -> WorkoutTemplate? {
        guard canCommit else { errorMessage = "Add a workout name, exercise, and set."; return nil }
        isSaving = true; defer { isSaving = false }
        do {
            let existing: WorkoutTemplate?
            if let id = draft.sourceTemplateID { existing = try await templates.template(id: id) } else { existing = nil }
            let value = makeTemplate(id: existing?.id ?? .new(), createdAt: existing?.createdAt ?? now, now: now)
            try await templates.saveTemplate(value); draft.sourceTemplateID = value.id; errorMessage = nil; return value
        } catch { errorMessage = "The reusable workout could not be saved."; return nil }
    }
    func schedule(now: Date = .now) async -> ScheduledWorkout? {
        guard canCommit else { errorMessage = "Add a workout name, exercise, and set."; return nil }
        let value = makeScheduled(now: now)
        do {
            try await workouts.schedule(value)
            errorMessage = nil; return value
        } catch { errorMessage = "The workout could not be added." }
        return nil
    }
    func makeScheduled(now: Date = .now) -> ScheduledWorkout {
        .init(id: .new(), day: day, titleSnapshot: draft.name.trimmingCharacters(in: .whitespacesAndNewlines), templateID: draft.sourceTemplateID, planID: nil, source: .manual, exercises: draft.exercises.map { exercise in
            .init(id: .new(), exerciseID: exercise.exerciseID, nameSnapshot: exercise.name, prescriptions: exercise.prescriptions.map(Self.prescription), loggedSets: [], restDuration: exercise.restDuration, skippedAt: nil)
        }, status: .planned, startedAt: nil, completedAt: nil, createdAt: now, updatedAt: now)
    }
    private func makeTemplate(id: WorkoutTemplateID, createdAt: Date, now: Date) -> WorkoutTemplate {
        .init(id: id, name: draft.name.trimmingCharacters(in: .whitespacesAndNewlines), exercises: draft.exercises.map { exercise in
            .init(id: .new(), exerciseID: exercise.exerciseID, exerciseNameSnapshot: exercise.name, prescriptions: exercise.prescriptions.map(Self.prescription), restDuration: exercise.restDuration, progressionRuleID: nil)
        }, createdAt: createdAt, updatedAt: now, archivedAt: nil)
    }
    private static func prescription(_ set: DraftSet) -> SetPrescription {
        let target: SetTarget
        switch set.target { case .repetitions(let lower, let upper): target = .repetitions(range: min(lower, upper)...max(lower, upper)); case .duration(let seconds): target = .duration(seconds: Double(max(1, seconds))) }
        return .init(id: .new(), target: target, suggestedWeight: set.suggestedPounds.map(Weight.init(pounds:)))
    }
}

extension WorkoutDraft {
    init(template: WorkoutTemplate) {
        name = template.name; sourceTemplateID = template.id
        exercises = template.exercises.map { .init(exerciseID: $0.exerciseID, name: $0.exerciseNameSnapshot, prescriptions: $0.prescriptions.map(DraftSet.init), restDuration: $0.restDuration) }
    }
    init(recent workout: ScheduledWorkout) {
        name = workout.titleSnapshot; sourceTemplateID = nil
        exercises = workout.exercises.map { .init(exerciseID: $0.exerciseID, name: $0.nameSnapshot, prescriptions: $0.prescriptions.map(DraftSet.init), restDuration: $0.restDuration) }
    }
}
private extension DraftSet {
    init(_ prescription: SetPrescription) {
        id = UUID(); suggestedPounds = prescription.suggestedWeight?.pounds
        switch prescription.target { case .repetitions(let range): target = .repetitions(lower: range.lowerBound, upper: range.upperBound); case .duration(let seconds): target = .duration(seconds: max(1, Int(seconds.rounded()))) }
    }
}
