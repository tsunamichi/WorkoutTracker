import Foundation

enum RNLegacyImportError: Error, Equatable, LocalizedError {
    case invalidJSON, unsupportedPayload, duplicateSourceIdentifier(String), invalidWorkout(String), alreadyImported
    var errorDescription: String? {
        switch self {
        case .invalidJSON: "The selected file is not valid JSON."
        case .unsupportedPayload: "The file is not a supported Equilibrium React Native backup."
        case .duplicateSourceIdentifier(let id): "The legacy payload contains an ambiguous duplicate identifier: \(id)."
        case .invalidWorkout(let id): "A legacy workout could not be converted safely: \(id)."
        case .alreadyImported: "This exact legacy backup was already imported."
        }
    }
}

enum RNLegacyPayloadDecoder {
    static func decode(_ data: Data) throws -> RNLegacyPayload {
        guard let root = try JSONSerialization.jsonObject(with: data) as? [String: Any] else { throw RNLegacyImportError.invalidJSON }
        let values = (root["data"] as? [String: Any]) ?? root
        let recognized = values.keys.contains { $0.hasPrefix("@workout_tracker_") }
        guard recognized else { throw RNLegacyImportError.unsupportedPayload }
        return RNLegacyPayload(
            exercises: try decode(LossyArray<RNExerciseDTO>.self, key: "@workout_tracker_exercises", from: values)?.values ?? [],
            sessions: try decode(LossyArray<RNSessionDTO>.self, key: "@workout_tracker_sessions", from: values)?.values ?? [],
            scheduledWorkouts: try decode(LossyArray<RNScheduledWorkoutDTO>.self, key: "@workout_tracker_scheduled_workouts", from: values)?.values ?? [],
            detailedProgress: try decode([String: RNWorkoutProgressDTO].self, key: "@workout_tracker_detailed_progress", from: values) ?? [:],
            workoutTemplates: try decode(LossyArray<RNWorkoutTemplateDTO>.self, key: "@workout_tracker_workout_templates", from: values)?.values ?? [],
            settings: try decode(RNSettingsDTO.self, key: "@workout_tracker_settings", from: values),
            progressionGroups: try decode(LossyArray<RNProgressionGroupDTO>.self, key: "@workout_tracker_progression_groups", from: values)?.values ?? [],
            progressionRules: try decode(LossyArray<RNProgressionRuleDTO>.self, key: "@workout_tracker_progression_rules", from: values)?.values ?? [],
            progressionDefaults: try decode(RNProgressionDefaultsDTO.self, key: "@workout_tracker_progression_defaults", from: values),
            timers: try decode(LossyArray<RNTimerDTO>.self, key: "@workout_tracker_hiit_timers", from: values)?.values ?? []
        )
    }

    private static func decode<T: Decodable>(_ type: T.Type, key: String, from values: [String: Any]) throws -> T? {
        guard let raw = values[key], !(raw is NSNull) else { return nil }
        let data: Data
        if let string = raw as? String { guard let value = string.data(using: .utf8) else { throw RNLegacyImportError.invalidJSON }; data = value }
        else { data = try JSONSerialization.data(withJSONObject: raw) }
        do { return try JSONDecoder().decode(type, from: data) }
        catch { throw RNLegacyImportError.invalidJSON }
    }
}

private struct LossyArray<Element: Decodable>: Decodable {
    let values: [Element]
    init(from decoder: Decoder) throws {
        var container = try decoder.unkeyedContainer(); var result: [Element] = []
        while !container.isAtEnd {
            if let value = try? container.decode(Element.self) { result.append(value) }
            else { _ = try? container.decode(DiscardedJSON.self) }
        }
        values = result
    }
}

private struct DiscardedJSON: Decodable {}
