import Observation
import SwiftData

@MainActor @Observable
final class AppEnvironment {
    let container: ModelContainer
    let workoutRepository: any WorkoutRepository
    let exerciseRepository: any ExerciseRepository
    let exerciseHistoryRepository: any ExerciseHistoryRepository
    let backupRepository: any BackupRepository
    let settingsRepository: any SettingsRepository
    let progressionRepository: any ProgressionRepository
    init(container: ModelContainer) {
        self.container = container
        let repository = SwiftDataRepository(container: container)
        workoutRepository = repository; exerciseRepository = repository; exerciseHistoryRepository = repository; backupRepository = repository
        settingsRepository = repository; progressionRepository = repository
    }
    static func live() throws -> AppEnvironment { try AppEnvironment(container: PersistenceController.makeContainer()) }
}
