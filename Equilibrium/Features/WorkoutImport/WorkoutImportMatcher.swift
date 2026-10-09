import Foundation

enum WorkoutPasteMaterializationError: LocalizedError {
    case workout(name: String, underlying: any Error)
    case persistence(underlying: any Error)

    var errorDescription: String? {
        switch self {
        case .workout(let name, let underlying):
            return "Couldn’t add \u{201c}\(name)\u{201d}. \(Self.detail(for: underlying))"
        case .persistence(let underlying):
            return "The workout was prepared but couldn’t be saved. \(Self.detail(for: underlying))"
        }
    }

    private static func detail(for error: any Error) -> String {
        guard let repositoryError = error as? RepositoryError else {
            return "No changes were saved. Try again."
        }
        switch repositoryError {
        case .duplicateExerciseName:
            return "One of its exercise names conflicts with an exercise already in your library."
        case .duplicateExerciseInWorkout:
            return "The same exercise appears more than once."
        case .invalidExerciseName:
            return "One of its exercises needs a valid name."
        case .invalidSetInput:
            return "One of its set prescriptions is invalid."
        default:
            return "No changes were saved. Try again."
        }
    }
}

enum WorkoutImportDraftConverter {
    static func lightweightDraft(from workout: ParsedWorkout, catalog: [ExerciseDefinition]) -> WorkoutDraft {
        .init(name: workout.name, exercises: workout.exercises.map { parsed in
            let sets = parsed.prescriptions.map(draftSet)
            if let definition = exactMatch(name: parsed.name, catalog: catalog) {
                return .init(exerciseID: definition.id, name: definition.name, prescriptions: sets, restDuration: parsed.restDuration)
            }
            return .init(exerciseID: nil, name: parsed.name.trimmingCharacters(in: .whitespacesAndNewlines), prescriptions: sets, restDuration: parsed.restDuration)
        })
    }

    private static func draftSet(_ parsed: ParsedSetPrescription) -> DraftSet {
        let target: DraftSet.Target
        switch parsed.target {
        case .repetitions(let range): target = .repetitions(lower: range.lowerBound, upper: range.upperBound)
        case .duration(let seconds): target = .duration(seconds: seconds)
        }
        return .init(id: UUID(), target: target, suggestedPounds: parsed.suggestedPounds)
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
            do {
                values.append(try await model.makeWorkout(
                    now: now.addingTimeInterval(Double(index) / 1_000),
                    // Paste is already an explicit request to use each entered exercise name.
                    // There is no interactive ambiguity confirmation in this flow, so a
                    // plausible-but-not-confident match remains a distinct custom exercise.
                    createAmbiguousExercises: true
                ))
            } catch {
                throw WorkoutPasteMaterializationError.workout(
                    name: parsedWorkout.name.isEmpty ? "Untitled Workout" : parsedWorkout.name,
                    underlying: error
                )
            }
        }
        do {
            try await workouts.materializeAtomically(values)
        } catch {
            throw WorkoutPasteMaterializationError.persistence(underlying: error)
        }
        return values
    }
}
