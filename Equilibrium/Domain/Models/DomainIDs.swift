import Foundation

public protocol DomainID: RawRepresentable, Hashable, Codable, Sendable where RawValue == String {
    init(rawValue: String)
}

public extension DomainID {
    static func new() -> Self { Self(rawValue: UUID().uuidString.lowercased()) }
    var isValid: Bool { !rawValue.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
    init(from decoder: Decoder) throws {
        let value = try decoder.singleValueContainer().decode(String.self)
        guard !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Domain ID cannot be empty"))
        }
        self.init(rawValue: value)
    }
    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        try container.encode(rawValue)
    }
}

public struct ExerciseID: DomainID, Identifiable { public let rawValue: String; public var id: String { rawValue }; public init(rawValue: String) { self.rawValue = rawValue } }
public struct WorkoutTemplateID: DomainID, Identifiable { public let rawValue: String; public var id: String { rawValue }; public init(rawValue: String) { self.rawValue = rawValue } }
public struct WorkoutExerciseID: DomainID, Identifiable { public let rawValue: String; public var id: String { rawValue }; public init(rawValue: String) { self.rawValue = rawValue } }
public struct ScheduledWorkoutID: DomainID, Identifiable { public let rawValue: String; public var id: String { rawValue }; public init(rawValue: String) { self.rawValue = rawValue } }
public struct ScheduledExerciseID: DomainID, Identifiable { public let rawValue: String; public var id: String { rawValue }; public init(rawValue: String) { self.rawValue = rawValue } }
public struct SetID: DomainID, Identifiable { public let rawValue: String; public var id: String { rawValue }; public init(rawValue: String) { self.rawValue = rawValue } }
public struct PlanID: DomainID, Identifiable { public let rawValue: String; public var id: String { rawValue }; public init(rawValue: String) { self.rawValue = rawValue } }
public struct ProgressionRuleID: DomainID, Identifiable { public let rawValue: String; public var id: String { rawValue }; public init(rawValue: String) { self.rawValue = rawValue } }
