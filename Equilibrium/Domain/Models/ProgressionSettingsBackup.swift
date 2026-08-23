import Foundation

public enum ProgressionMode: String, Codable, CaseIterable, Sendable { case doubleProgression, weightOnly, repetitionsOnly, disabled }
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
    public init(isEnabled: Bool, defaults: ProgressionParameters, groups: [ProgressionGroup], overrides: [ExerciseProgressionOverride]) { self.isEnabled = isEnabled; self.defaults = defaults; self.groups = groups; self.overrides = overrides }
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
