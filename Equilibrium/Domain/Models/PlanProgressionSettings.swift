import Foundation

public enum Weekday: Int, Codable, CaseIterable, Sendable { case sunday = 1, monday, tuesday, wednesday, thursday, friday, saturday }
public struct PlanDay: Identifiable, Codable, Hashable, Sendable { public var id: Weekday { weekday }; public let weekday: Weekday; public let workoutTemplateID: WorkoutTemplateID }
public enum PlanStatus: String, Codable, Sendable { case draft, active, paused, ended, completed }
public struct CyclePlan: Identifiable, Codable, Hashable, Sendable {
    public let id: PlanID; public var name: String; public var startDay: LocalDay; public var numberOfWeeks: Int; public var days: [PlanDay]
    public var status: PlanStatus; public var pausedUntil: LocalDay?; public var endedOn: LocalDay?; public var createdAt: Date; public var updatedAt: Date
}
public enum ProgressionMode: String, Codable, Sendable { case doubleProgression, weightOnly, repetitionsOnly, disabled }
public struct ProgressionParameters: Codable, Hashable, Sendable { public var repetitionRange: ClosedRange<Int>; public var weightIncrement: Weight; public var mode: ProgressionMode }
public struct ProgressionGroup: Identifiable, Codable, Hashable, Sendable { public let id: ProgressionRuleID; public var name: String; public var parameters: ProgressionParameters; public var exerciseIDs: Set<ExerciseID> }
public struct ExerciseProgressionOverride: Identifiable, Codable, Hashable, Sendable { public var id: ExerciseID { exerciseID }; public let exerciseID: ExerciseID; public var parameters: ProgressionParameters }
public struct ProgressionConfiguration: Codable, Hashable, Sendable { public var isEnabled: Bool; public var defaults: ProgressionParameters; public var groups: [ProgressionGroup]; public var overrides: [ExerciseProgressionOverride] }
public struct AppSettings: Codable, Hashable, Sendable { public var weightUnit: WeightUnit; public var defaultRestDuration: TimeInterval }
public struct EquilibriumBackupV1: Codable, Sendable {
    public let schemaVersion: Int; public let exportedAt: Date; public let sourceDeviceID: String
    public let exercises: [ExerciseDefinition]; public let workoutTemplates: [WorkoutTemplate]; public let scheduledWorkouts: [ScheduledWorkout]
    public let cyclePlans: [CyclePlan]; public let settings: AppSettings; public let progression: ProgressionConfiguration
    public init(schemaVersion: Int = 1, exportedAt: Date, sourceDeviceID: String, exercises: [ExerciseDefinition], workoutTemplates: [WorkoutTemplate], scheduledWorkouts: [ScheduledWorkout], cyclePlans: [CyclePlan], settings: AppSettings, progression: ProgressionConfiguration) throws {
        guard schemaVersion == 1 else { throw BackupError.unsupportedSchemaVersion(schemaVersion) }
        self.schemaVersion = schemaVersion; self.exportedAt = exportedAt; self.sourceDeviceID = sourceDeviceID; self.exercises = exercises
        self.workoutTemplates = workoutTemplates; self.scheduledWorkouts = scheduledWorkouts; self.cyclePlans = cyclePlans; self.settings = settings; self.progression = progression
    }
}
public enum BackupError: Error, Equatable { case unsupportedSchemaVersion(Int), invalidPayload }
