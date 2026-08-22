import Observation
import SwiftData

@MainActor @Observable
final class AppEnvironment {
    let container: ModelContainer
    let workoutRepository: any ScheduledWorkoutRepository
    let backupRepository: any BackupRepository
    init(container: ModelContainer) {
        self.container = container
        let repository = SwiftDataRepository(container: container)
        workoutRepository = repository; backupRepository = repository
    }
    static func live() throws -> AppEnvironment { try AppEnvironment(container: PersistenceController.makeContainer()) }
}
