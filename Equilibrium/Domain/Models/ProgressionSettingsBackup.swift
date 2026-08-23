import Foundation

public enum ProgressionMode: String, Codable, Sendable { case doubleProgression, weightOnly, repetitionsOnly, disabled }
public struct ProgressionParameters: Codable, Hashable, Sendable { public var repetitionRange: ClosedRange<Int>; public var weightIncrement: Weight; public var mode: ProgressionMode }
public struct ProgressionGroup: Identifiable, Codable, Hashable, Sendable { public let id: ProgressionRuleID; public var name: String; public var parameters: ProgressionParameters; public var exerciseIDs: Set<ExerciseID> }
public struct ExerciseProgressionOverride: Identifiable, Codable, Hashable, Sendable { public var id: ExerciseID { exerciseID }; public let exerciseID: ExerciseID; public var parameters: ProgressionParameters }
public struct ProgressionConfiguration: Codable, Hashable, Sendable { public var isEnabled: Bool; public var defaults: ProgressionParameters; public var groups: [ProgressionGroup]; public var overrides: [ExerciseProgressionOverride] }
public struct AppSettings: Codable, Hashable, Sendable { public var weightUnit: WeightUnit; public var defaultRestDuration: TimeInterval }
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
