import Observation
import SwiftData

@MainActor @Observable
final class AppEnvironment {
    let container: ModelContainer
    let workoutRepository: any ScheduledWorkoutRepository
    let exerciseRepository: any ExerciseRepository
    let templateRepository: any WorkoutTemplateRepository
    let backupRepository: any BackupRepository
    init(container: ModelContainer) {
        self.container = container
        let catalog = (try? container.mainContext.fetch(FetchDescriptor<ExerciseDefinitionRecord>())) ?? []
        if catalog.isEmpty {
            for exercise in EquilibriumFixtures.exercises { container.mainContext.insert(DefinitionMapper.record(from: exercise)) }
            try? container.mainContext.save()
        }
        let repository = SwiftDataRepository(container: container)
        workoutRepository = repository; exerciseRepository = repository; templateRepository = repository; backupRepository = repository
    }
    static func live() throws -> AppEnvironment { try AppEnvironment(container: PersistenceController.makeContainer()) }
}
