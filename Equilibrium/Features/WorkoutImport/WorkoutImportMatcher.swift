import Foundation

enum WorkoutImportDraftConverter {
    static func lightweightDraft(from workout: ParsedWorkout, catalog: [ExerciseDefinition]) -> WorkoutDraft {
        .init(name: workout.name, exercises: workout.exercises.map { parsed in
            if let definition = exactMatch(name: parsed.name, catalog: catalog) {
                return .init(exerciseID: definition.id, name: definition.name)
            }
            return .init(exerciseID: nil, name: parsed.name.trimmingCharacters(in: .whitespacesAndNewlines))
        })
    }

    private static func exactMatch(name: String, catalog: [ExerciseDefinition]) -> ExerciseDefinition? {
        let needle = SwiftDataRepository.normalizeExerciseName(name)
        let canonical = catalog.filter { SwiftDataRepository.normalizeExerciseName($0.name) == needle }
        if canonical.count == 1 { return canonical[0] }
        if canonical.count > 1 { return nil }
        let aliases = catalog.filter { exercise in exercise.aliases.contains { SwiftDataRepository.normalizeExerciseName($0) == needle } }
        if aliases.count == 1 { return aliases[0] }
        if aliases.count > 1 { return nil }
        let compactNeedle = needle.replacingOccurrences(of: " ", with: "")
        let compact = catalog.filter { exercise in
            SwiftDataRepository.normalizeExerciseName(exercise.name).replacingOccurrences(of: " ", with: "") == compactNeedle ||
            exercise.aliases.contains { SwiftDataRepository.normalizeExerciseName($0).replacingOccurrences(of: " ", with: "") == compactNeedle }
        }
        return compact.count == 1 ? compact[0] : nil
    }
}

@MainActor
struct WorkoutPasteMaterializer {
    let exercises: any ExerciseRepository
    let workouts: any WorkoutRepository
    let history: any ExerciseHistoryRepository

    func materialize(_ parsed: [ParsedWorkout], now: Date = .now) async throws -> [Workout] {
        let catalog = try await exercises.allExercises()
        var values: [Workout] = []
        for (index, parsedWorkout) in parsed.enumerated() {
            let draft = WorkoutImportDraftConverter.lightweightDraft(from: parsedWorkout, catalog: catalog)
            let model = WorkoutBuilderModel(draft: draft, exercises: exercises, workouts: workouts, history: history)
            values.append(try await model.makeWorkout(now: now.addingTimeInterval(Double(index) / 1_000)))
        }
        try await workouts.materializeAtomically(values)
        return values
    }
}
