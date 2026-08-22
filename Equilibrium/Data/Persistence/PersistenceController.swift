import SwiftData

import Foundation

public enum PersistenceController {
    public static func makeContainer(inMemory: Bool = false, storageURL: URL? = nil) throws -> ModelContainer {
        let schema = Schema([ScheduledWorkoutRecord.self, ScheduledExerciseRecord.self, PrescriptionRecord.self, LoggedSetRecord.self, BackupCollectionRecord.self])
        let configuration: ModelConfiguration
        if let storageURL { configuration = ModelConfiguration("Equilibrium", schema: schema, url: storageURL, cloudKitDatabase: .none) }
        else { configuration = ModelConfiguration("Equilibrium", schema: schema, isStoredInMemoryOnly: inMemory, cloudKitDatabase: .none) }
        return try ModelContainer(for: schema, configurations: configuration)
    }
}
