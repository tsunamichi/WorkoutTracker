import Foundation
import SwiftData

@Model final class ExerciseDefinitionRecord {
    @Attribute(.unique) var id: String
    var name: String; var normalizedName: String; var aliases: [String]
    var equipment: String?; var category: String?; var isCustom: Bool; var archivedAt: Date?
    init(id: String, name: String, normalizedName: String, aliases: [String], equipment: String?, category: String?, isCustom: Bool, archivedAt: Date?) {
        self.id = id; self.name = name; self.normalizedName = normalizedName; self.aliases = aliases
        self.equipment = equipment; self.category = category; self.isCustom = isCustom; self.archivedAt = archivedAt
    }
}

@Model final class WorkoutRecord {
    @Attribute(.unique) var id: String
    var titleSnapshot: String; var statusRaw: String
    var startedAt: Date?; var completedAt: Date?; var createdAt: Date; var updatedAt: Date
    @Relationship(deleteRule: .cascade, inverse: \WorkoutExerciseRecord.workout) var exercises: [WorkoutExerciseRecord]
    init(id: String, titleSnapshot: String, statusRaw: String, startedAt: Date?, completedAt: Date?, createdAt: Date, updatedAt: Date, exercises: [WorkoutExerciseRecord]) {
        self.id = id; self.titleSnapshot = titleSnapshot; self.statusRaw = statusRaw; self.startedAt = startedAt; self.completedAt = completedAt
        self.createdAt = createdAt; self.updatedAt = updatedAt; self.exercises = exercises
    }
}

@Model final class WorkoutExerciseRecord {
    @Attribute(.unique) var id: String
    var exerciseID: String; var nameSnapshot: String; var position: Int; var restDuration: Double?; var skippedAt: Date?
    var workout: WorkoutRecord?
    @Relationship(deleteRule: .cascade, inverse: \PrescriptionRecord.exercise) var prescriptions: [PrescriptionRecord]
    @Relationship(deleteRule: .cascade, inverse: \LoggedSetRecord.exercise) var loggedSets: [LoggedSetRecord]
    init(id: String, exerciseID: String, nameSnapshot: String, position: Int, restDuration: Double?, skippedAt: Date?, prescriptions: [PrescriptionRecord], loggedSets: [LoggedSetRecord]) {
        self.id = id; self.exerciseID = exerciseID; self.nameSnapshot = nameSnapshot; self.position = position; self.restDuration = restDuration; self.skippedAt = skippedAt
        self.prescriptions = prescriptions; self.loggedSets = loggedSets
    }
}

@Model final class PrescriptionRecord {
    @Attribute(.unique) var id: String
    var position: Int; var targetKind: String; var lowerRepetitions: Int?; var upperRepetitions: Int?; var duration: Double?; var suggestedPounds: Double?
    var exercise: WorkoutExerciseRecord?
    init(id: String, position: Int, targetKind: String, lowerRepetitions: Int?, upperRepetitions: Int?, duration: Double?, suggestedPounds: Double?) {
        self.id = id; self.position = position; self.targetKind = targetKind; self.lowerRepetitions = lowerRepetitions; self.upperRepetitions = upperRepetitions; self.duration = duration; self.suggestedPounds = suggestedPounds
    }
}

@Model final class LoggedSetRecord {
    @Attribute(.unique) var id: String
    var prescriptionID: String?; var position: Int; var pounds: Double?; var repetitions: Int?; var duration: Double?; var completedAt: Date?
    var exercise: WorkoutExerciseRecord?
    init(id: String, prescriptionID: String?, position: Int, pounds: Double?, repetitions: Int?, duration: Double?, completedAt: Date?) {
        self.id = id; self.prescriptionID = prescriptionID; self.position = position; self.pounds = pounds; self.repetitions = repetitions; self.duration = duration; self.completedAt = completedAt
    }
}

@Model final class BackupCollectionRecord {
    @Attribute(.unique) var key: String
    var payload: Data
    init(key: String = "canonical-v1", payload: Data) { self.key = key; self.payload = payload }
}
