import SwiftData

import Foundation

public enum PersistenceController {
    public static func makeContainer(inMemory: Bool = false, storageURL: URL? = nil) throws -> ModelContainer {
        let schema = Schema([ExerciseDefinitionRecord.self, WorkoutTemplateRecord.self, TemplateExerciseRecord.self, TemplatePrescriptionRecord.self, ScheduledWorkoutRecord.self, ScheduledExerciseRecord.self, PrescriptionRecord.self, LoggedSetRecord.self, BackupCollectionRecord.self])
        let configuration: ModelConfiguration
        // Pre-release native schema correction: a new configuration name intentionally recreates
        // development data after removing the invalid unique-localDay constraint. RN data/backups are untouched.
        if let storageURL { configuration = ModelConfiguration("EquilibriumProductModelCorrection1", schema: schema, url: storageURL, cloudKitDatabase: .none) }
        else { configuration = ModelConfiguration("EquilibriumProductModelCorrection1", schema: schema, isStoredInMemoryOnly: inMemory, cloudKitDatabase: .none) }
        return try ModelContainer(for: schema, configurations: configuration)
    }
}
