import Foundation

struct RNLegacyPayload: Sendable {
    let exercises: [RNExerciseDTO]
    let sessions: [RNSessionDTO]
    let scheduledWorkouts: [RNScheduledWorkoutDTO]
    let detailedProgress: [String: RNWorkoutProgressDTO]
    let workoutTemplates: [RNWorkoutTemplateDTO]
    let settings: RNSettingsDTO?
    let progressionGroups: [RNProgressionGroupDTO]
    let progressionRules: [RNProgressionRuleDTO]
    let progressionDefaults: RNProgressionDefaultsDTO?
    let timers: [RNTimerDTO]
}

struct RNExerciseDTO: Codable, Sendable {
    let id: String; let name: String
    let canonicalName: String?; let aliases: [String]?; let category: String?; let equipment: String?
    let isCustom: Bool?; let measurementType: String?; let defaultProgressionType: String?
    let createdAt: String?; let archivedAt: String?
}

struct RNSessionDTO: Codable, Sendable {
    let id: String; let workoutTemplateId: String?; let date: String; let startTime: String?; let endTime: String?; let sets: [RNSessionSetDTO]
}

struct RNSessionSetDTO: Codable, Sendable {
    let id: String?; let exerciseId: String; let setIndex: Int?; let weight: Double?; let reps: Int?; let isCompleted: Bool?
}

struct RNScheduledWorkoutDTO: Codable, Sendable {
    let id: String; let date: String; let templateId: String?; let titleSnapshot: String?
    let exercisesSnapshot: [RNTemplateExerciseDTO]?
    let status: String; let startedAt: String?; let completedAt: String?
}

struct RNWorkoutTemplateDTO: Codable, Sendable {
    let id: String; let name: String; let items: [RNTemplateExerciseDTO]?
}

struct RNTemplateExerciseDTO: Codable, Sendable {
    let id: String; let exerciseId: String; let nameSnapshot: String?
    let order: Int?; let sets: Int?; let reps: RNFlexibleReps?; let weight: Double?
    let isTimeBased: Bool?; let isPerSide: Bool?; let restSeconds: Double?; let progressionType: String?
}

enum RNFlexibleReps: Codable, Sendable {
    case number(Int), text(String)
    init(from decoder: Decoder) throws {
        let value = try decoder.singleValueContainer()
        if let number = try? value.decode(Int.self) { self = .number(number) }
        else { self = .text(try value.decode(String.self)) }
    }
    func encode(to encoder: Encoder) throws {
        var value = encoder.singleValueContainer()
        switch self { case .number(let number): try value.encode(number); case .text(let text): try value.encode(text) }
    }
}

struct RNWorkoutProgressDTO: Codable, Sendable {
    let workoutKey: String?; let exercises: [String: RNExerciseProgressDTO]; let lastUpdated: String?
}

struct RNExerciseProgressDTO: Codable, Sendable {
    let exerciseId: String; let sets: [RNSetProgressDTO]; let skipped: Bool?
}

struct RNSetProgressDTO: Codable, Sendable {
    let setNumber: Int?; let weight: Double?; let reps: Int?; let completed: Bool
}

struct RNSettingsDTO: Codable, Sendable {
    let useKg: Bool?; let restTimerDefaultSeconds: Double?; let progressionSuggestionsEnabled: Bool?
}

struct RNProgressionGroupDTO: Codable, Sendable {
    let id: String; let repRangeMin: Int; let repRangeMax: Int; let weightIncrement: Double; let progressionMode: String; let exerciseIds: [String]
}

struct RNProgressionRuleDTO: Codable, Sendable {
    let exerciseId: String; let groupId: String?; let repRangeMin: Int?; let repRangeMax: Int?; let weightIncrement: Double?; let progressionMode: String?
}

struct RNProgressionDefaultsDTO: Codable, Sendable {
    let repRangeMin: Int; let repRangeMax: Int; let weightIncrement: Double; let progressionMode: String
}

struct RNTimerDTO: Codable, Sendable {
    let id: String; let name: String; let work: Double; let workRest: Double; let sets: Int; let rounds: Int; let roundRest: Double; let createdAt: String?; let isTemplate: Bool?
}
