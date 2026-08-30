import SwiftUI
import SwiftData

@main
struct EquilibriumApp: App {
    private let environment: AppEnvironment
    init() {
        do {
#if DEBUG
            let arguments = ProcessInfo.processInfo.arguments
            if let flag = arguments.firstIndex(of: "-workoutFixture"), arguments.indices.contains(flag + 1) {
                let container = try PersistenceController.makeContainer(inMemory: true)
                let workouts: [Workout]
                switch arguments[flag + 1] {
                case "ready": workouts = [EquilibriumFixtures.ready(id: "launch-ready")]
                case "inProgress": workouts = [EquilibriumFixtures.inProgress(id: "launch-progress")]
                case "completed": workouts = [EquilibriumFixtures.completed(id: "launch-completed")]
                case "carousel":
                    var a = EquilibriumFixtures.ready(id: "launch-a")
                    var b = EquilibriumFixtures.inProgress(id: "launch-b")
                    var c = EquilibriumFixtures.completed(id: "launch-c")
                    a.createdAt = .init(timeIntervalSince1970: 1); b.createdAt = .init(timeIntervalSince1970: 2); c.createdAt = .init(timeIntervalSince1970: 3)
                    workouts = [a, b, c]
                default: workouts = []
                }
                for workout in workouts { container.mainContext.insert(WorkoutMapper.record(from: workout)) }; try container.mainContext.save()
                environment = AppEnvironment(container: container)
                return
            }
#endif
            environment = try AppEnvironment.live()
        }
        catch { fatalError("Unable to initialize Equilibrium persistence: \(error)") }
    }
    var body: some Scene {
        WindowGroup { HomeView(repository: environment.workoutRepository, exerciseRepository: environment.exerciseRepository, historyRepository: environment.exerciseHistoryRepository, settingsRepository: environment.settingsRepository, progressionRepository: environment.progressionRepository, timerStore: environment.timerStore).environment(environment).preferredColorScheme(.dark) }
            .modelContainer(environment.container)
    }
}
