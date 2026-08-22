import Foundation

public enum WeightUnit: String, Codable, Sendable { case pounds, kilograms }

public struct Weight: Codable, Hashable, Sendable {
    public var pounds: Double
    public init(pounds: Double) { self.pounds = pounds }
    public init(_ value: Double, unit: WeightUnit) { pounds = unit == .pounds ? value : value * 2.2046226218 }
    public func value(in unit: WeightUnit) -> Double { unit == .pounds ? pounds : pounds / 2.2046226218 }
}

public struct ExerciseDefinition: Identifiable, Codable, Hashable, Sendable {
    public let id: ExerciseID; public var name: String; public var normalizedName: String; public var aliases: [String]
    public var equipment: String?; public var category: String?; public var isCustom: Bool; public var archivedAt: Date?
}

public enum SetTarget: Codable, Hashable, Sendable {
    case repetitions(range: ClosedRange<Int>)
    case duration(seconds: TimeInterval)
}

public struct SetPrescription: Identifiable, Codable, Hashable, Sendable {
    public let id: SetID; public var target: SetTarget; public var suggestedWeight: Weight?
}

public struct WorkoutExerciseDefinition: Identifiable, Codable, Hashable, Sendable {
    public let id: WorkoutExerciseID; public let exerciseID: ExerciseID; public var exerciseNameSnapshot: String
    public var prescriptions: [SetPrescription]; public var restDuration: TimeInterval?; public var progressionRuleID: ProgressionRuleID?
}

public struct WorkoutTemplate: Identifiable, Codable, Hashable, Sendable {
    public let id: WorkoutTemplateID; public var name: String; public var exercises: [WorkoutExerciseDefinition]
    public var createdAt: Date; public var updatedAt: Date; public var archivedAt: Date?
}

public struct LoggedSet: Identifiable, Codable, Hashable, Sendable {
    public let id: SetID; public let prescriptionID: SetID?; public var weight: Weight?; public var repetitions: Int?
    public var duration: TimeInterval?; public var completedAt: Date?
}

public struct ScheduledExercise: Identifiable, Codable, Hashable, Sendable {
    public let id: ScheduledExerciseID; public let exerciseID: ExerciseID; public var nameSnapshot: String
    public var prescriptions: [SetPrescription]; public var loggedSets: [LoggedSet]; public var restDuration: TimeInterval?; public var skippedAt: Date?
}

public enum WorkoutSource: String, Codable, Sendable { case manual, plan }
public enum WorkoutStatus: String, Codable, Sendable { case planned, inProgress, completed }

public struct ScheduledWorkout: Identifiable, Codable, Hashable, Sendable {
    public let id: ScheduledWorkoutID; public var day: LocalDay; public var titleSnapshot: String
    public var templateID: WorkoutTemplateID?; public var planID: PlanID?; public var source: WorkoutSource
    public var exercises: [ScheduledExercise]; public var status: WorkoutStatus; public var startedAt: Date?; public var completedAt: Date?
    public var createdAt: Date; public var updatedAt: Date
}
