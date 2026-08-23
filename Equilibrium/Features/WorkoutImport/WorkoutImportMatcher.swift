import Foundation

enum ExerciseMatch: Hashable, Sendable {
    case matched(ExerciseDefinition)
    case unmatched
    case ambiguous([ExerciseDefinition])
}

struct WorkoutExerciseMatcher: Sendable {
    func match(name: String, catalog: [ExerciseDefinition]) -> ExerciseMatch {
        let needle = SwiftDataRepository.normalizeExerciseName(name)
        let canonical = catalog.filter { SwiftDataRepository.normalizeExerciseName($0.name) == needle }
        if canonical.count == 1 { return .matched(canonical[0]) }
        if canonical.count > 1 { return .ambiguous(canonical) }
        let aliases = catalog.filter { exercise in exercise.aliases.contains { SwiftDataRepository.normalizeExerciseName($0) == needle } }
        if aliases.count == 1 { return .matched(aliases[0]) }
        if aliases.count > 1 { return .ambiguous(aliases) }
        let compactNeedle = needle.replacingOccurrences(of: " ", with: "")
        let compact = catalog.filter { exercise in
            SwiftDataRepository.normalizeExerciseName(exercise.name).replacingOccurrences(of: " ", with: "") == compactNeedle ||
            exercise.aliases.contains { SwiftDataRepository.normalizeExerciseName($0).replacingOccurrences(of: " ", with: "") == compactNeedle }
        }
        return compact.count == 1 ? .matched(compact[0]) : compact.count > 1 ? .ambiguous(compact) : .unmatched
    }
}

struct ResolvedParsedExercise: Hashable, Sendable {
    var parsed: ParsedExercise
    var match: ExerciseMatch
}

struct ResolvedParsedWorkout: Identifiable, Hashable, Sendable {
    let id: UUID
    var name: String
    var exercises: [ResolvedParsedExercise]
}

enum WorkoutImportDraftConverter {
    static func lightweightDraft(from workout: ParsedWorkout, catalog: [ExerciseDefinition]) -> WorkoutDraft {
        let matcher = WorkoutExerciseMatcher()
        return .init(name: workout.name, exercises: workout.exercises.map { parsed in
            if case .matched(let definition) = matcher.match(name: parsed.name, catalog: catalog) {
                return .init(exerciseID: definition.id, name: definition.name)
            }
            return .init(exerciseID: nil, name: parsed.name.trimmingCharacters(in: .whitespacesAndNewlines))
        })
    }
    static func draft(from workout: ResolvedParsedWorkout) -> WorkoutDraft? {
        var exercises: [DraftExercise] = []
        for value in workout.exercises {
            guard case .matched(let definition) = value.match else { return nil }
            exercises.append(.init(
                exerciseID: definition.id,
                name: definition.name,
                prescriptions: value.parsed.prescriptions.map { prescription in
                    let target: DraftSet.Target
                    switch prescription.target {
                    case .repetitions(let range): target = .repetitions(lower: range.lowerBound, upper: range.upperBound)
                    case .duration(let seconds): target = .duration(seconds: seconds)
                    }
                    return .init(id: UUID(), target: target, suggestedPounds: prescription.suggestedPounds)
                },
                restDuration: value.parsed.restDuration
            ))
        }
        return .init(name: workout.name, exercises: exercises)
    }
}
