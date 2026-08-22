import Foundation
import SwiftData

@Model final class ScheduledWorkoutRecord {
    @Attribute(.unique) var id: String
    @Attribute(.unique) var localDay: String
    var titleSnapshot: String; var templateID: String?; var planID: String?; var sourceRaw: String; var statusRaw: String
    var startedAt: Date?; var completedAt: Date?; var createdAt: Date; var updatedAt: Date
    @Relationship(deleteRule: .cascade, inverse: \ScheduledExerciseRecord.workout) var exercises: [ScheduledExerciseRecord]
    init(id: String, localDay: String, titleSnapshot: String, templateID: String?, planID: String?, sourceRaw: String, statusRaw: String, startedAt: Date?, completedAt: Date?, createdAt: Date, updatedAt: Date, exercises: [ScheduledExerciseRecord]) {
        self.id = id; self.localDay = localDay; self.titleSnapshot = titleSnapshot; self.templateID = templateID; self.planID = planID
        self.sourceRaw = sourceRaw; self.statusRaw = statusRaw; self.startedAt = startedAt; self.completedAt = completedAt
        self.createdAt = createdAt; self.updatedAt = updatedAt; self.exercises = exercises
    }
}

@Model final class ScheduledExerciseRecord {
    @Attribute(.unique) var id: String
    var exerciseID: String; var nameSnapshot: String; var position: Int; var restDuration: Double?; var skippedAt: Date?
    var workout: ScheduledWorkoutRecord?
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
    var exercise: ScheduledExerciseRecord?
    init(id: String, position: Int, targetKind: String, lowerRepetitions: Int?, upperRepetitions: Int?, duration: Double?, suggestedPounds: Double?) {
        self.id = id; self.position = position; self.targetKind = targetKind; self.lowerRepetitions = lowerRepetitions; self.upperRepetitions = upperRepetitions; self.duration = duration; self.suggestedPounds = suggestedPounds
    }
}

@Model final class LoggedSetRecord {
    @Attribute(.unique) var id: String
    var prescriptionID: String?; var position: Int; var pounds: Double?; var repetitions: Int?; var duration: Double?; var completedAt: Date?
    var exercise: ScheduledExerciseRecord?
    init(id: String, prescriptionID: String?, position: Int, pounds: Double?, repetitions: Int?, duration: Double?, completedAt: Date?) {
        self.id = id; self.prescriptionID = prescriptionID; self.position = position; self.pounds = pounds; self.repetitions = repetitions; self.duration = duration; self.completedAt = completedAt
    }
}

@Model final class BackupCollectionRecord {
    @Attribute(.unique) var key: String
    var payload: Data
    init(key: String = "canonical-v1", payload: Data) { self.key = key; self.payload = payload }
}
