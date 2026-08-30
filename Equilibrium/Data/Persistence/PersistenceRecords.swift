import Foundation
import SwiftData

@Model final class ExerciseDefinitionRecord {
    var id: String = ""
    var name: String = ""; var normalizedName: String = ""; var aliases: [String] = []
    var equipment: String?; var category: String?; var isCustom: Bool = false; var archivedAt: Date?
    var updatedAt: Date = Foundation.Date(timeIntervalSince1970: 0)
    init(id: String, name: String, normalizedName: String, aliases: [String], equipment: String?, category: String?, isCustom: Bool, archivedAt: Date?, updatedAt: Date = .now) {
        self.id = id; self.name = name; self.normalizedName = normalizedName; self.aliases = aliases
        self.equipment = equipment; self.category = category; self.isCustom = isCustom; self.archivedAt = archivedAt; self.updatedAt = updatedAt
    }
}

@Model final class WorkoutRecord {
    var id: String = ""
    var titleSnapshot: String = ""; var statusRaw: String = ""
    var startedAt: Date?; var completedAt: Date?; var createdAt: Date = Foundation.Date(timeIntervalSince1970: 0); var updatedAt: Date = Foundation.Date(timeIntervalSince1970: 0)
    @Relationship(deleteRule: .cascade, inverse: \WorkoutExerciseRecord.workout) var exercises: [WorkoutExerciseRecord]?
    init(id: String, titleSnapshot: String, statusRaw: String, startedAt: Date?, completedAt: Date?, createdAt: Date, updatedAt: Date, exercises: [WorkoutExerciseRecord]?) {
        self.id = id; self.titleSnapshot = titleSnapshot; self.statusRaw = statusRaw; self.startedAt = startedAt; self.completedAt = completedAt
        self.createdAt = createdAt; self.updatedAt = updatedAt; self.exercises = exercises
    }
}

@Model final class WorkoutExerciseRecord {
    var id: String = ""
    var exerciseID: String = ""; var nameSnapshot: String = ""; var position: Int = 0; var restDuration: Double?; var skippedAt: Date?; var isTimeBased: Bool = false; var isTwoSided: Bool = false
    var updatedAt: Date = Foundation.Date(timeIntervalSince1970: 0)
    var workout: WorkoutRecord?
    @Relationship(deleteRule: .cascade, inverse: \PrescriptionRecord.exercise) var prescriptions: [PrescriptionRecord]?
    @Relationship(deleteRule: .cascade, inverse: \LoggedSetRecord.exercise) var loggedSets: [LoggedSetRecord]?
    init(id: String, exerciseID: String, nameSnapshot: String, position: Int, restDuration: Double?, skippedAt: Date?, isTimeBased: Bool = false, isTwoSided: Bool = false, updatedAt: Date = .now, prescriptions: [PrescriptionRecord]?, loggedSets: [LoggedSetRecord]?) {
        self.id = id; self.exerciseID = exerciseID; self.nameSnapshot = nameSnapshot; self.position = position; self.restDuration = restDuration; self.skippedAt = skippedAt; self.isTimeBased = isTimeBased; self.isTwoSided = isTwoSided; self.updatedAt = updatedAt
        self.prescriptions = prescriptions; self.loggedSets = loggedSets
    }
}

@Model final class PrescriptionRecord {
    var id: String = ""
    var position: Int = 0; var targetKind: String = ""; var lowerRepetitions: Int?; var upperRepetitions: Int?; var duration: Double?; var suggestedPounds: Double?
    var updatedAt: Date = Foundation.Date(timeIntervalSince1970: 0)
    var exercise: WorkoutExerciseRecord?
    init(id: String, position: Int, targetKind: String, lowerRepetitions: Int?, upperRepetitions: Int?, duration: Double?, suggestedPounds: Double?, updatedAt: Date = .now) {
        self.id = id; self.position = position; self.targetKind = targetKind; self.lowerRepetitions = lowerRepetitions; self.upperRepetitions = upperRepetitions; self.duration = duration; self.suggestedPounds = suggestedPounds; self.updatedAt = updatedAt
    }
}

@Model final class LoggedSetRecord {
    var id: String = ""
    var prescriptionID: String?; var position: Int = 0; var pounds: Double?; var repetitions: Int?; var duration: Double?; var completedAt: Date?
    var updatedAt: Date = Foundation.Date(timeIntervalSince1970: 0)
    var exercise: WorkoutExerciseRecord?
    init(id: String, prescriptionID: String?, position: Int, pounds: Double?, repetitions: Int?, duration: Double?, completedAt: Date?, updatedAt: Date = .now) {
        self.id = id; self.prescriptionID = prescriptionID; self.position = position; self.pounds = pounds; self.repetitions = repetitions; self.duration = duration; self.completedAt = completedAt; self.updatedAt = updatedAt
    }
}

@Model final class BackupCollectionRecord {
    var key: String = "canonical-v2"
    var payload: Data = Data()
    var updatedAt: Date = Foundation.Date(timeIntervalSince1970: 0)
    init(key: String = "canonical-v2", payload: Data, updatedAt: Date = .now) { self.key = key; self.payload = payload; self.updatedAt = updatedAt }
}

@Model final class SettingValueRecord {
    var key: String = ""
    var value: String = ""
    var updatedAt: Date = Foundation.Date(timeIntervalSince1970: 0)
    init(key: String, value: String, updatedAt: Date = .now) { self.key = key; self.value = value; self.updatedAt = updatedAt }
}

// Read-only compatibility bridge for pre-release stores. New configuration
// writes use granular SettingValueRecord and ProgressionAssignmentRecord rows.
@Model final class AppConfigurationRecord {
    var key: String = "app-configuration"
    var settingsPayload: Data = Data()
    var progressionPayload: Data = Data()
    init(key: String = "app-configuration", settingsPayload: Data, progressionPayload: Data) {
        self.key = key; self.settingsPayload = settingsPayload; self.progressionPayload = progressionPayload
    }
}

@Model final class ProgressionAssignmentRecord {
    var exerciseID: String = ""
    var profileRaw: String = ""
    var updatedAt: Date = Foundation.Date(timeIntervalSince1970: 0)
    init(exerciseID: String, profileRaw: String, updatedAt: Date = .now) { self.exerciseID = exerciseID; self.profileRaw = profileRaw; self.updatedAt = updatedAt }
}

@Model final class StandaloneTimerConfigurationRecord {
    var id: String = ""
    var name: String = ""
    var moveDuration: Double = 30; var exerciseRestDuration: Double = 30
    var exercisesPerRound: Int = 3; var rounds: Int = 1; var roundRestDuration: Double = 30
    var createdAt: Date = Foundation.Date(timeIntervalSince1970: 0); var updatedAt: Date = Foundation.Date(timeIntervalSince1970: 0)
    init(id: String, name: String, moveDuration: Double, exerciseRestDuration: Double, exercisesPerRound: Int, rounds: Int, roundRestDuration: Double, createdAt: Date, updatedAt: Date) {
        self.id = id; self.name = name; self.moveDuration = moveDuration; self.exerciseRestDuration = exerciseRestDuration
        self.exercisesPerRound = exercisesPerRound; self.rounds = rounds; self.roundRestDuration = roundRestDuration; self.createdAt = createdAt; self.updatedAt = updatedAt
    }
}

@Model final class LegacyImportReceiptRecord {
    var sourceKind: String = ""
    var sourceDigest: String = ""
    var importedAt: Date = Foundation.Date(timeIntervalSince1970: 0)
    var workoutCount: Int = 0; var exerciseCount: Int = 0; var timerCount: Int = 0
    init(sourceKind: String, sourceDigest: String, importedAt: Date = .now, workoutCount: Int, exerciseCount: Int, timerCount: Int) {
        self.sourceKind = sourceKind; self.sourceDigest = sourceDigest; self.importedAt = importedAt
        self.workoutCount = workoutCount; self.exerciseCount = exerciseCount; self.timerCount = timerCount
    }
}
