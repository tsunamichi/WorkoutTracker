import Foundation

public enum ProgressionValidator {
    public static func isValid(_ configuration: ProgressionConfiguration) -> Bool {
        guard isValid(configuration.defaults) else { return false }
        let groupIDs = configuration.groups.map(\.id)
        let overrideIDs = configuration.overrides.map(\.exerciseID)
        guard Set(groupIDs).count == groupIDs.count, Set(overrideIDs).count == overrideIDs.count, configuration.assignments.keys.allSatisfy(valid) else { return false }
        return configuration.groups.allSatisfy {
            !$0.id.rawValue.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
            !$0.name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
            isValid($0.parameters) && $0.exerciseIDs.allSatisfy(valid)
        } && configuration.overrides.allSatisfy { valid($0.exerciseID) && isValid($0.parameters) }
    }

    public static func isValid(_ parameters: ProgressionParameters) -> Bool {
        parameters.repetitionRange.lowerBound > 0 &&
        parameters.repetitionRange.upperBound >= parameters.repetitionRange.lowerBound &&
        parameters.weightIncrement.pounds.isFinite && parameters.weightIncrement.pounds >= 0
    }

    private static func valid(_ id: ExerciseID) -> Bool { !id.rawValue.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
}

public enum ProgressionRuleSource: Equatable, Sendable { case exerciseOverride, group(ProgressionRuleID), defaults }
public struct ResolvedProgressionRule: Equatable, Sendable {
    public let parameters: ProgressionParameters
    public let source: ProgressionRuleSource
}

public enum ProgressionRuleResolver {
    public static func resolve(exerciseID: ExerciseID, configuration: ProgressionConfiguration) -> ResolvedProgressionRule? {
        guard configuration.isEnabled else { return nil }
        guard let parameters = (configuration.assignments[exerciseID] ?? .none).parameters else { return nil }
        return .init(parameters: parameters, source: .exerciseOverride)
    }
}

public struct ProgressionSuggestion: Equatable, Sendable {
    public enum Rationale: String, Equatable, Sendable { case increaseWeight, addRepetitions, repeatLast }
    public let exerciseID: ExerciseID
    public let suggestedWeight: Weight?
    public let targetRepetitions: ClosedRange<Int>?
    public let rationale: Rationale
}

public enum ProgressionEngine {
    public static func suggestion(exerciseID: ExerciseID, configuration: ProgressionConfiguration, workouts: [Workout]) -> ProgressionSuggestion? {
        guard let rule = ProgressionRuleResolver.resolve(exerciseID: exerciseID, configuration: configuration) else { return nil }
        let completed = WorkoutHistoryQuery.completed(workouts)
        guard let occurrence = completed.lazy.flatMap(\.exercises).first(where: { $0.exerciseID == exerciseID }) else { return nil }
        guard occurrence.prescriptions.contains(where: { if case .repetitions = $0.target { true } else { false } }) else { return nil }
        let valid = occurrence.loggedSets.filter { $0.completedAt != nil && ($0.repetitions ?? 0) > 0 }
        guard !valid.isEmpty else { return nil }
        return calculate(exerciseID: exerciseID, parameters: rule.parameters, sets: valid)
    }

    public static func calculate(exerciseID: ExerciseID, parameters: ProgressionParameters, sets: [LoggedSet]) -> ProgressionSuggestion? {
        guard ProgressionValidator.isValid(parameters) else { return nil }
        let valid = sets.filter { $0.completedAt != nil && ($0.repetitions ?? 0) > 0 }
        guard !valid.isEmpty, let weakest = valid.compactMap(\.repetitions).min() else { return nil }
        let range = parameters.repetitionRange
        let referenceWeight = valid.first?.weight
        switch parameters.mode {
        case .disabled: return nil
        case .doubleProgression:
            if valid.allSatisfy({ ($0.repetitions ?? 0) >= range.upperBound }) {
                // Missing external load stays missing; bodyweight is never manufactured as zero pounds.
                let increased = referenceWeight.map { Weight(pounds: $0.pounds + parameters.weightIncrement.pounds) }
                return .init(exerciseID: exerciseID, suggestedWeight: increased, targetRepetitions: range, rationale: increased == nil ? .repeatLast : .increaseWeight)
            }
            let target = min(weakest + 1, range.upperBound)
            return .init(exerciseID: exerciseID, suggestedWeight: referenceWeight, targetRepetitions: target...range.upperBound, rationale: target > weakest ? .addRepetitions : .repeatLast)
        case .weightOnly:
            guard let referenceWeight else {
                return .init(exerciseID: exerciseID, suggestedWeight: nil, targetRepetitions: range, rationale: .repeatLast)
            }
            return .init(exerciseID: exerciseID, suggestedWeight: Weight(pounds: referenceWeight.pounds + parameters.weightIncrement.pounds), targetRepetitions: range, rationale: .increaseWeight)
        case .repetitionsOnly:
            let target = min(weakest + 1, range.upperBound)
            return .init(exerciseID: exerciseID, suggestedWeight: referenceWeight, targetRepetitions: target...range.upperBound, rationale: target > weakest ? .addRepetitions : .repeatLast)
        }
    }
}
