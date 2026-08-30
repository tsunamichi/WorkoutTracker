import SwiftData

import Foundation

public enum PersistenceController {
    public static let cloudKitContainerIdentifier = "iCloud.com.tsunamichi.equilibrium"

    public enum StartupMode: Equatable, Sendable {
        case managedCloudKit
        case localFallback
    }

    public struct StartupResult {
        public let container: ModelContainer
        public let mode: StartupMode
    }

    private static var schema: Schema {
        Schema([ExerciseDefinitionRecord.self, WorkoutRecord.self, WorkoutExerciseRecord.self, PrescriptionRecord.self, LoggedSetRecord.self, BackupCollectionRecord.self, AppConfigurationRecord.self, SettingValueRecord.self, ProgressionAssignmentRecord.self, StandaloneTimerConfigurationRecord.self, LegacyImportReceiptRecord.self])
    }

    public static func makeContainer(inMemory: Bool = false, storageURL: URL? = nil) throws -> ModelContainer {
        let configuration: ModelConfiguration
        // Pre-release correction: the configuration intentionally recreates development storage.
        if let storageURL { configuration = ModelConfiguration("EquilibriumProgressionTimer", schema: schema, url: storageURL, cloudKitDatabase: .none) }
        else { configuration = ModelConfiguration("EquilibriumProgressionTimer", schema: schema, isStoredInMemoryOnly: inMemory, cloudKitDatabase: .none) }
        return try ModelContainer(for: schema, configurations: configuration)
    }

    public static func makeCloudContainer(storageURL: URL? = nil) throws -> ModelContainer {
        let configuration: ModelConfiguration
        if let storageURL {
            configuration = ModelConfiguration("EquilibriumProgressionTimer", schema: schema, url: storageURL, cloudKitDatabase: .private(cloudKitContainerIdentifier))
        } else {
            configuration = ModelConfiguration("EquilibriumProgressionTimer", schema: schema, cloudKitDatabase: .private(cloudKitContainerIdentifier))
        }
        return try ModelContainer(for: schema, configurations: configuration)
    }

    /// Cloud initialization may fail because account or service state is unavailable.
    /// Falling back reopens the same named local store without deleting or recreating it.
    public static func makeLiveContainer() throws -> StartupResult {
        try resilientStartup(cloud: { try makeCloudContainer() }, local: { try makeContainer() })
    }

    static func resilientStartup(
        cloud: () throws -> ModelContainer,
        local: () throws -> ModelContainer
    ) throws -> StartupResult {
        do { return StartupResult(container: try cloud(), mode: .managedCloudKit) }
        catch { return StartupResult(container: try local(), mode: .localFallback) }
    }
}
