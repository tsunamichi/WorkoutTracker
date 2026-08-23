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

public struct LoggedSet: Identifiable, Codable, Hashable, Sendable {
    public let id: SetID; public let prescriptionID: SetID?; public var weight: Weight?; public var repetitions: Int?
    public var duration: TimeInterval?; public var completedAt: Date?
}

public struct WorkoutExercise: Identifiable, Codable, Hashable, Sendable {
    public let id: WorkoutExerciseID; public let exerciseID: ExerciseID; public var nameSnapshot: String
    public var prescriptions: [SetPrescription]; public var loggedSets: [LoggedSet]; public var restDuration: TimeInterval?; public var skippedAt: Date?
    public var isTimeBased: Bool; public var isTwoSided: Bool
    public init(id: WorkoutExerciseID, exerciseID: ExerciseID, nameSnapshot: String, prescriptions: [SetPrescription], loggedSets: [LoggedSet], restDuration: TimeInterval?, skippedAt: Date?, isTimeBased: Bool? = nil, isTwoSided: Bool = false) {
        self.id = id; self.exerciseID = exerciseID; self.nameSnapshot = nameSnapshot; self.prescriptions = prescriptions; self.loggedSets = loggedSets; self.restDuration = restDuration; self.skippedAt = skippedAt
        self.isTimeBased = isTimeBased ?? prescriptions.contains { if case .duration = $0.target { true } else { false } }; self.isTwoSided = isTwoSided
    }
    private enum CodingKeys: String, CodingKey { case id, exerciseID, nameSnapshot, prescriptions, loggedSets, restDuration, skippedAt, isTimeBased, isTwoSided }
    public init(from decoder: Decoder) throws {
        let box = try decoder.container(keyedBy: CodingKeys.self)
        id = try box.decode(WorkoutExerciseID.self, forKey: .id); exerciseID = try box.decode(ExerciseID.self, forKey: .exerciseID); nameSnapshot = try box.decode(String.self, forKey: .nameSnapshot)
        prescriptions = try box.decode([SetPrescription].self, forKey: .prescriptions); loggedSets = try box.decode([LoggedSet].self, forKey: .loggedSets); restDuration = try box.decodeIfPresent(TimeInterval.self, forKey: .restDuration); skippedAt = try box.decodeIfPresent(Date.self, forKey: .skippedAt)
        isTimeBased = try box.decodeIfPresent(Bool.self, forKey: .isTimeBased) ?? prescriptions.contains { if case .duration = $0.target { true } else { false } }; isTwoSided = try box.decodeIfPresent(Bool.self, forKey: .isTwoSided) ?? false
    }
}

public enum WorkoutStatus: String, Codable, Sendable { case ready, inProgress, completed }

public struct Workout: Identifiable, Codable, Hashable, Sendable {
    public let id: WorkoutID; public var titleSnapshot: String
    public var exercises: [WorkoutExercise]; public var status: WorkoutStatus; public var startedAt: Date?; public var completedAt: Date?
    public var createdAt: Date; public var updatedAt: Date
}
