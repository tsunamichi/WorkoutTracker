import Foundation

public protocol ExerciseRepository: Sendable {
    func allExercises() async throws -> [ExerciseDefinition]
    func searchExercises(_ query: String) async throws -> [ExerciseDefinition]
    func exercise(id: ExerciseID) async throws -> ExerciseDefinition?
    func saveExercise(_ exercise: ExerciseDefinition) async throws
    func archiveExercise(id: ExerciseID, at date: Date) async throws
}
public protocol WorkoutRepository: Sendable {
    func activeWorkouts() async throws -> [Workout]
    func workout(id: WorkoutID) async throws -> Workout?
    func allWorkouts() async throws -> [Workout]
    func create(_ workout: Workout) async throws
    func update(_ workout: Workout) async throws
    func materializeAtomically(_ workouts: [Workout]) async throws
    func startWorkout(id: WorkoutID, at date: Date) async throws -> Workout
    func logSet(workoutID: WorkoutID, exerciseID: WorkoutExerciseID, prescriptionID: SetID, input: SetLogInput, completed: Bool, at date: Date) async throws -> Workout
    func appendSet(workoutID: WorkoutID, exerciseID: WorkoutExerciseID, seed: SetLogInput?, at date: Date) async throws -> Workout
    func removeSet(workoutID: WorkoutID, exerciseID: WorkoutExerciseID, prescriptionID: SetID, at date: Date) async throws -> Workout
    func completeWorkout(id: WorkoutID, at date: Date) async throws -> Workout
    func resetWorkout(id: WorkoutID, at date: Date) async throws -> Workout
    func deleteWorkout(id: WorkoutID) async throws
    func skipExercise(workoutID: WorkoutID, exerciseID: WorkoutExerciseID, at date: Date) async throws -> Workout
    func restoreExercise(workoutID: WorkoutID, exerciseID: WorkoutExerciseID, at date: Date) async throws -> Workout
    func removeExercise(workoutID: WorkoutID, exerciseID: WorkoutExerciseID, at date: Date) async throws -> Workout
    func appendExercise(workoutID: WorkoutID, exercise: WorkoutExercise, at date: Date) async throws -> Workout
    func editCompletedSet(workoutID: WorkoutID, exerciseID: WorkoutExerciseID, prescriptionID: SetID, input: SetLogInput, at date: Date) async throws -> Workout
    func recentCompletedWorkouts(limit: Int) async throws -> [Workout]
    func completedWorkouts() async throws -> [Workout]
    func completedWorkout(id: WorkoutID) async throws -> Workout?
    /// Workouts that are not completed plus those completed at or after `completedSince`, and whether any completed workout exists.
    func homeWorkouts(completedSince: Date) async throws -> (workouts: [Workout], hasCompletedWorkouts: Bool)
}
public struct LatestExerciseLog: Equatable, Sendable {
    public let exerciseID: ExerciseID
    public let workoutID: WorkoutID
    public let occurredAt: Date
    public let sets: [LoggedSet]
}

public protocol ExerciseHistoryRepository: Sendable {
    func latestExerciseLog(exerciseID: ExerciseID) async throws -> LatestExerciseLog?
    func exercisePerformance(exerciseID: ExerciseID) async throws -> ExercisePerformance
}
public protocol SettingsRepository: Sendable {
    func settings() async throws -> AppSettings
    func saveSettings(_ settings: AppSettings) async throws
    func saveWeightUnit(_ unit: WeightUnit) async throws
    func saveDefaultRestDuration(_ seconds: TimeInterval) async throws
    func exerciseRestDuration(for exerciseID: ExerciseID) async throws -> TimeInterval?
    func saveExerciseRestDuration(_ seconds: TimeInterval?, for exerciseID: ExerciseID) async throws
}
public protocol ProgressionRepository: Sendable {
    func progressionConfiguration() async throws -> ProgressionConfiguration
    func saveProgressionConfiguration(_ configuration: ProgressionConfiguration) async throws
    func saveProgressionEnabled(_ enabled: Bool) async throws
    func saveProgressionProfile(_ profile: AutoProgressionProfile, for exerciseID: ExerciseID) async throws
}

public extension SettingsRepository {
    func saveWeightUnit(_ unit: WeightUnit) async throws { var value = try await settings(); value.weightUnit = unit; try await saveSettings(value) }
    func saveDefaultRestDuration(_ seconds: TimeInterval) async throws { var value = try await settings(); value.defaultRestDuration = seconds; try await saveSettings(value) }
}

public extension ProgressionRepository {
    func saveProgressionEnabled(_ enabled: Bool) async throws { var value = try await progressionConfiguration(); value.isEnabled = enabled; try await saveProgressionConfiguration(value) }
    func saveProgressionProfile(_ profile: AutoProgressionProfile, for exerciseID: ExerciseID) async throws { var value = try await progressionConfiguration(); value.assign(profile, to: exerciseID); try await saveProgressionConfiguration(value) }
}
public protocol BackupRepository: Sendable {
    func exportBackup(exportedAt: Date, sourceDeviceID: String) async throws -> EquilibriumBackupV2
    func restoreBackup(_ backup: EquilibriumBackupV2) async throws
}
public enum RepositoryError: Error, Equatable { case notFound, immutableCompletedWorkout, workoutNotInProgress, exerciseSkipped, prescriptionNotFound, cannotRemoveCompletedSet, invalidSetInput, invalidRestDuration, invalidSettings, invalidProgressionConfiguration, incompleteWorkout, duplicateIdentifier, duplicateExerciseName, duplicateExerciseInWorkout, invalidExerciseName, invalidBackup }

public enum ExerciseResolution: Equatable, Sendable {
    case exactMatch(ExerciseDefinition)
    case highConfidenceMatch(ExerciseDefinition)
    case possibleMatches([ExerciseDefinition])
    case noMatch

    public var preferredMatch: ExerciseDefinition? {
        switch self {
        case .exactMatch(let exercise), .highConfidenceMatch(let exercise): exercise
        case .possibleMatches(let exercises): exercises.first
        case .noMatch: nil
        }
    }
}

public enum ExerciseCreationResolution: Equatable, Sendable {
    case existing(ExerciseDefinition)
    case confirmationRequired(name: String, matches: [ExerciseDefinition])
    case created(ExerciseDefinition)
}

/// Canonical exercise matching shared by search, creation, workout building, execution, and import.
public enum ExerciseResolver {
    private struct Candidate {
        let exercise: ExerciseDefinition
        let score: Double
        let exact: Bool
        let highConfidence: Bool
    }

    private static let expansions: [String: [String]] = [
        "db": ["dumbbell"], "dbs": ["dumbbell"], "dumbbells": ["dumbbell"],
        "bb": ["barbell"], "bbs": ["barbell"], "barbells": ["barbell"],
        "kb": ["kettlebell"], "kbs": ["kettlebell"], "kettlebells": ["kettlebell"],
        "ohp": ["overhead", "press"], "rdl": ["romanian", "deadlift"]
    ]

    /// These tokens change the exercise rather than merely restating its name.
    private static let meaningfulModifiers: Set<String> = [
        "incline", "decline", "flat", "seated", "standing", "singlearm", "singleleg",
        "cable", "smith", "machine", "barbell", "dumbbell", "kettlebell", "bodyweight",
        "assisted", "weighted", "overhead", "romanian", "sumo", "front", "back",
        "close", "wide", "neutral", "pronated", "supinated"
    ]

    public static func resolve(_ value: String, in catalog: [ExerciseDefinition]) -> ExerciseResolution {
        let clean = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !clean.isEmpty else { return .noMatch }
        let candidates = catalog.map { candidate(for: clean, exercise: $0) }
            .sorted { lhs, rhs in
                if lhs.score != rhs.score { return lhs.score > rhs.score }
                return lhs.exercise.name.localizedCaseInsensitiveCompare(rhs.exercise.name) == .orderedAscending
            }
        let exact = candidates.filter(\.exact)
        if exact.count == 1 { return .exactMatch(exact[0].exercise) }
        if exact.count > 1 { return .possibleMatches(exact.map(\.exercise)) }
        let high = candidates.filter(\.highConfidence)
        if high.count == 1 { return .highConfidenceMatch(high[0].exercise) }
        if high.count > 1 { return .possibleMatches(high.map(\.exercise)) }
        let possible = candidates.filter { $0.score >= 0.50 }.prefix(5).map(\.exercise)
        return possible.isEmpty ? .noMatch : .possibleMatches(Array(possible))
    }

    public static func search(_ query: String, in catalog: [ExerciseDefinition]) -> [ExerciseDefinition] {
        let clean = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !clean.isEmpty else { return catalog.sorted(by: exerciseSort) }
        let queryBasic = basicNormalized(clean)
        let queryTokens = comparisonTokens(clean)
        return catalog.compactMap { exercise -> (ExerciseDefinition, Double)? in
            let values = [exercise.name] + exercise.aliases
            let score = values.map { value -> Double in
                let basic = basicNormalized(value)
                if basic == queryBasic { return 3 }
                if basic.contains(queryBasic) { return 2.5 }
                let tokens = comparisonTokens(value)
                guard !queryTokens.isEmpty, !tokens.isEmpty else { return 0 }
                let coverage = queryTokens.reduce(0.0) { total, queryToken in
                    let best = tokens.map { searchTokenSimilarity(queryToken, $0) }.max() ?? 0
                    return total + best
                } / Double(queryTokens.count)
                return coverage
            }.max() ?? 0
            return score >= 0.68 ? (exercise, score) : nil
        }
        .sorted { lhs, rhs in lhs.1 == rhs.1 ? exerciseSort(lhs.0, rhs.0) : lhs.1 > rhs.1 }
        .map(\.0)
    }

    public static func normalizedName(_ value: String) -> String {
        normalizedTokens(value).joined(separator: " ")
    }

    private static func candidate(for query: String, exercise: ExerciseDefinition) -> Candidate {
        let queryBasic = basicNormalized(query)
        var bestScore = 0.0
        var isExact = false
        var isHigh = false
        for value in [exercise.name] + exercise.aliases {
            let valueBasic = basicNormalized(value)
            if queryBasic == valueBasic {
                isExact = true
                bestScore = 1
                continue
            }
            let lhs = comparisonTokens(query), rhs = comparisonTokens(value)
            guard !lhs.isEmpty, !rhs.isEmpty else { continue }
            let score = tokenSimilarity(lhs, rhs)
            let modifierCompatible = modifiers(in: lhs) == modifiers(in: rhs)
            let sameExpandedTokens = lhs.sorted() == rhs.sorted()
            bestScore = max(bestScore, score)
            if modifierCompatible && (sameExpandedTokens || score >= 0.84) { isHigh = true }
        }
        return Candidate(exercise: exercise, score: bestScore, exact: isExact, highConfidence: !isExact && isHigh)
    }

    private static func basicNormalized(_ value: String) -> String {
        value.folding(options: [.caseInsensitive, .diacriticInsensitive], locale: Locale(identifier: "en_US_POSIX"))
            .lowercased()
            .split(whereSeparator: { !$0.isLetter && !$0.isNumber })
            .joined(separator: " ")
    }

    private static func normalizedTokens(_ value: String) -> [String] {
        let source = basicNormalized(value).split(separator: " ").map(String.init)
        var expanded = source.flatMap { expansions[$0] ?? [$0] }
        var result: [String] = []
        while !expanded.isEmpty {
            if expanded.count >= 2, expanded[0] == "single", expanded[1] == "arm" {
                result.append("singlearm"); expanded.removeFirst(2)
            } else if expanded.count >= 2, expanded[0] == "single", expanded[1] == "leg" {
                result.append("singleleg"); expanded.removeFirst(2)
            } else {
                result.append(expanded.removeFirst())
            }
        }
        return result
    }

    private static func comparisonTokens(_ value: String) -> [String] {
        let tokens = normalizedTokens(value)
        let hasInclineOrDeclinePress = tokens.contains("press") && (tokens.contains("incline") || tokens.contains("decline"))
        return hasInclineOrDeclinePress ? tokens.filter { $0 != "bench" } : tokens
    }

    private static func modifiers(in tokens: [String]) -> Set<String> {
        Set(tokens.compactMap { token in
            if meaningfulModifiers.contains(token) { return token }
            return meaningfulModifiers.first { modifier in
                modifier.count >= 5 && editDistance(token, modifier) == 1
            }
        })
    }

    private static func tokenSimilarity(_ lhs: [String], _ rhs: [String]) -> Double {
        var remaining = rhs
        var total = 0.0
        for token in lhs {
            guard let best = remaining.indices.max(by: {
                fuzzyTokenSimilarity(token, remaining[$0]) < fuzzyTokenSimilarity(token, remaining[$1])
            }) else { continue }
            total += fuzzyTokenSimilarity(token, remaining[best])
            remaining.remove(at: best)
        }
        return total / Double(max(lhs.count, rhs.count))
    }

    private static func searchTokenSimilarity(_ query: String, _ candidate: String) -> Double {
        if candidate.hasPrefix(query) || query.hasPrefix(candidate) { return 1 }
        return fuzzyTokenSimilarity(query, candidate)
    }

    private static func fuzzyTokenSimilarity(_ lhs: String, _ rhs: String) -> Double {
        guard lhs != rhs else { return 1 }
        let maximum = max(lhs.count, rhs.count)
        guard maximum > 0 else { return 1 }
        return 1 - (Double(editDistance(lhs, rhs)) / Double(maximum))
    }

    private static func editDistance(_ lhs: String, _ rhs: String) -> Int {
        let left = Array(lhs), right = Array(rhs)
        guard !left.isEmpty else { return right.count }
        guard !right.isEmpty else { return left.count }
        var previous = Array(0...right.count)
        for (leftIndex, leftCharacter) in left.enumerated() {
            var current = [leftIndex + 1]
            for (rightIndex, rightCharacter) in right.enumerated() {
                current.append(min(
                    current[rightIndex] + 1,
                    previous[rightIndex + 1] + 1,
                    previous[rightIndex] + (leftCharacter == rightCharacter ? 0 : 1)
                ))
            }
            previous = current
        }
        return previous[right.count]
    }

    private static func exerciseSort(_ lhs: ExerciseDefinition, _ rhs: ExerciseDefinition) -> Bool {
        lhs.name.localizedCaseInsensitiveCompare(rhs.name) == .orderedAscending
    }
}

public extension ExerciseRepository {
    /// The only creation entry point used by product UI. Ambiguous matches require an explicit retry.
    func resolveCreationRequest(
        named rawName: String,
        createIfAmbiguous: Bool = false
    ) async throws -> ExerciseCreationResolution {
        let name = rawName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty else { throw RepositoryError.invalidExerciseName }
        let catalog = try await allExercises()
        switch ExerciseResolver.resolve(name, in: catalog) {
        case .exactMatch(let exercise), .highConfidenceMatch(let exercise):
            return .existing(try await learnAlias(name, for: exercise))
        case .possibleMatches(let matches) where !createIfAmbiguous:
            return .confirmationRequired(name: name, matches: matches)
        case .possibleMatches, .noMatch:
            let exercise = ExerciseDefinition(
                id: .new(),
                name: name,
                normalizedName: ExerciseResolver.normalizedName(name),
                aliases: [],
                equipment: nil,
                category: nil,
                isCustom: true,
                archivedAt: nil
            )
            try await saveExercise(exercise)
            return .created(exercise)
        }
    }

    func learnAlias(_ rawAlias: String, for exercise: ExerciseDefinition) async throws -> ExerciseDefinition {
        let alias = rawAlias.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !alias.isEmpty else { return exercise }
        let normalizedAlias = ExerciseResolver.normalizedName(alias)
        let knownNames = [exercise.name] + exercise.aliases
        guard !knownNames.contains(where: { ExerciseResolver.normalizedName($0) == normalizedAlias }) else { return exercise }
        var updated = exercise
        updated.aliases.append(alias)
        try await saveExercise(updated)
        return updated
    }
}

public extension WorkoutRepository {
    func homeWorkouts(completedSince: Date) async throws -> (workouts: [Workout], hasCompletedWorkouts: Bool) {
        let all = try await allWorkouts()
        return (all.filter { $0.status != .completed || ($0.completedAt.map { $0 >= completedSince } ?? false) }, all.contains { $0.status == .completed })
    }
    func completedWorkouts() async throws -> [Workout] {
        WorkoutHistoryQuery.completed(try await allWorkouts())
    }

    func completedWorkout(id: WorkoutID) async throws -> Workout? {
        guard let workout = try await workout(id: id), workout.status == .completed else { return nil }
        return workout
    }

    func recentCompletedWorkouts(limit: Int) async throws -> [Workout] {
        Array(WorkoutHistoryQuery.completed(try await allWorkouts()).prefix(limit))
    }
}
