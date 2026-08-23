import Foundation

public enum ProgressionMode: String, Codable, CaseIterable, Sendable { case doubleProgression, weightOnly, repetitionsOnly, disabled }
public enum AutoProgressionProfile: String, Codable, CaseIterable, Hashable, Sendable {
    case none, upper, lower, accessories
    public var parameters: ProgressionParameters? {
        switch self {
        case .none: nil
        case .upper: .init(repetitionRange: 5...8, weightIncrement: .init(pounds: 2.5), mode: .doubleProgression)
        case .lower: .init(repetitionRange: 5...8, weightIncrement: .init(pounds: 5), mode: .doubleProgression)
        case .accessories: .init(repetitionRange: 10...20, weightIncrement: .init(pounds: 2.5), mode: .doubleProgression)
        }
    }
    public var title: String { rawValue.prefix(1).uppercased() + rawValue.dropFirst() }
}
public struct ProgressionParameters: Codable, Hashable, Sendable {
    public var repetitionRange: ClosedRange<Int>; public var weightIncrement: Weight; public var mode: ProgressionMode
    public init(repetitionRange: ClosedRange<Int>, weightIncrement: Weight, mode: ProgressionMode) { self.repetitionRange = repetitionRange; self.weightIncrement = weightIncrement; self.mode = mode }
}
public struct ProgressionGroup: Identifiable, Codable, Hashable, Sendable {
    public let id: ProgressionRuleID; public var name: String; public var parameters: ProgressionParameters; public var exerciseIDs: Set<ExerciseID>
    public init(id: ProgressionRuleID, name: String, parameters: ProgressionParameters, exerciseIDs: Set<ExerciseID>) { self.id = id; self.name = name; self.parameters = parameters; self.exerciseIDs = exerciseIDs }
}
public struct ExerciseProgressionOverride: Identifiable, Codable, Hashable, Sendable {
    public var id: ExerciseID { exerciseID }; public let exerciseID: ExerciseID; public var parameters: ProgressionParameters
    public init(exerciseID: ExerciseID, parameters: ProgressionParameters) { self.exerciseID = exerciseID; self.parameters = parameters }
}
public struct ProgressionConfiguration: Codable, Hashable, Sendable {
    public var isEnabled: Bool; public var defaults: ProgressionParameters; public var groups: [ProgressionGroup]; public var overrides: [ExerciseProgressionOverride]
    public var assignments: [ExerciseID: AutoProgressionProfile]
    public init(isEnabled: Bool, defaults: ProgressionParameters, groups: [ProgressionGroup], overrides: [ExerciseProgressionOverride], assignments: [ExerciseID: AutoProgressionProfile] = [:]) { self.isEnabled = isEnabled; self.defaults = defaults; self.groups = groups; self.overrides = overrides; self.assignments = assignments }
    public mutating func assign(_ profile: AutoProgressionProfile, to exerciseID: ExerciseID) { assignments[exerciseID] = profile }
    private enum CodingKeys: String, CodingKey { case isEnabled, defaults, groups, overrides, assignments }
    public init(from decoder: Decoder) throws {
        let box = try decoder.container(keyedBy: CodingKeys.self)
        isEnabled = try box.decode(Bool.self, forKey: .isEnabled)
        defaults = try box.decode(ProgressionParameters.self, forKey: .defaults)
        groups = try box.decodeIfPresent([ProgressionGroup].self, forKey: .groups) ?? []
        overrides = try box.decodeIfPresent([ExerciseProgressionOverride].self, forKey: .overrides) ?? []
        assignments = try box.decodeIfPresent([ExerciseID: AutoProgressionProfile].self, forKey: .assignments) ?? [:]
    }
}
public struct AppSettings: Codable, Hashable, Sendable {
    public var weightUnit: WeightUnit; public var defaultRestDuration: TimeInterval
    public init(weightUnit: WeightUnit, defaultRestDuration: TimeInterval) { self.weightUnit = weightUnit; self.defaultRestDuration = defaultRestDuration }
}
public struct EquilibriumBackupV2: Codable, Sendable {
    public let schemaVersion: Int; public let exportedAt: Date; public let sourceDeviceID: String
    public let exercises: [ExerciseDefinition]; public let workouts: [Workout]
    public let settings: AppSettings; public let progression: ProgressionConfiguration
    public init(schemaVersion: Int = 2, exportedAt: Date, sourceDeviceID: String, exercises: [ExerciseDefinition], workouts: [Workout], settings: AppSettings, progression: ProgressionConfiguration) throws {
        guard schemaVersion == 2 else { throw BackupError.unsupportedSchemaVersion(schemaVersion) }
        self.schemaVersion = schemaVersion; self.exportedAt = exportedAt; self.sourceDeviceID = sourceDeviceID; self.exercises = exercises
        self.workouts = workouts; self.settings = settings; self.progression = progression
    }
}
public enum BackupError: Error, Equatable { case unsupportedSchemaVersion(Int), invalidPayload }
