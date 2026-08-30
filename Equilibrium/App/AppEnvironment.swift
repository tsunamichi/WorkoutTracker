import Observation
import SwiftData
import Foundation

@MainActor @Observable
final class AppEnvironment {
    let container: ModelContainer
    let workoutRepository: any WorkoutRepository
    let exerciseRepository: any ExerciseRepository
    let exerciseHistoryRepository: any ExerciseHistoryRepository
    let backupRepository: any BackupRepository
    let settingsRepository: any SettingsRepository
    let progressionRepository: any ProgressionRepository
    let timerStore: any StandaloneTimerConfigurationStore
    let legacyImporter: RNLegacyImporter
    let persistenceStartupMode: PersistenceController.StartupMode
    init(container: ModelContainer, persistenceStartupMode: PersistenceController.StartupMode = .localFallback) {
        self.container = container
        self.persistenceStartupMode = persistenceStartupMode
        let repository = SwiftDataRepository(container: container)
        workoutRepository = repository; exerciseRepository = repository; exerciseHistoryRepository = repository; backupRepository = repository
        settingsRepository = repository; progressionRepository = repository
        timerStore = SwiftDataStandaloneTimerStore(repository: repository)
        legacyImporter = RNLegacyImporter(repository: repository)
    }
    static func live() throws -> AppEnvironment {
        // Unit-test hosts are intentionally unsigned and must never attempt to
        // bootstrap CloudKit merely because they launch the application target.
        if ProcessInfo.processInfo.environment["XCTestConfigurationFilePath"] != nil {
            return try AppEnvironment(container: PersistenceController.makeContainer())
        }
        let startup = try PersistenceController.makeLiveContainer()
        return AppEnvironment(container: startup.container, persistenceStartupMode: startup.mode)
    }
}
