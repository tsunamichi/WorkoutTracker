import SwiftData

import Foundation

public enum PersistenceController {
    public static func makeContainer(inMemory: Bool = false, storageURL: URL? = nil) throws -> ModelContainer {
        let schema = Schema([ExerciseDefinitionRecord.self, WorkoutRecord.self, WorkoutExerciseRecord.self, PrescriptionRecord.self, LoggedSetRecord.self, BackupCollectionRecord.self, AppConfigurationRecord.self, SettingValueRecord.self, ProgressionAssignmentRecord.self, StandaloneTimerConfigurationRecord.self, LegacyImportReceiptRecord.self])
        let configuration: ModelConfiguration
        // Pre-release correction: the configuration intentionally recreates development storage.
        if let storageURL { configuration = ModelConfiguration("EquilibriumProgressionTimer", schema: schema, url: storageURL, cloudKitDatabase: .none) }
        else { configuration = ModelConfiguration("EquilibriumProgressionTimer", schema: schema, isStoredInMemoryOnly: inMemory, cloudKitDatabase: .none) }
        return try ModelContainer(for: schema, configurations: configuration)
    }
}
