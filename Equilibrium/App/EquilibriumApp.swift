import SwiftUI
import SwiftData

@main
struct EquilibriumApp: App {
    private let environment: AppEnvironment
    init() {
        do {
#if DEBUG
            let arguments = ProcessInfo.processInfo.arguments
            if let flag = arguments.firstIndex(of: "-scheduleFixture"), arguments.indices.contains(flag + 1) {
                let container = try PersistenceController.makeContainer(inMemory: true)
                let calendar = Calendar.autoupdatingCurrent
                let day = try LocalDay(date: .now, calendar: calendar).iso8601
                let workouts: [ScheduledWorkout]
                switch arguments[flag + 1] {
                case "planned": workouts = [EquilibriumFixtures.planned(day: day, id: "launch-planned")]
                case "inProgress": workouts = [EquilibriumFixtures.inProgress(day: day, id: "launch-progress")]
                case "completed": workouts = [EquilibriumFixtures.completed(day: day, id: "launch-completed")]
                case "carousel":
                    var a = EquilibriumFixtures.planned(day: day, id: "launch-a")
                    var b = EquilibriumFixtures.inProgress(day: day, id: "launch-b")
                    var c = EquilibriumFixtures.completed(day: day, id: "launch-c")
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
        WindowGroup { HomeView(repository: environment.workoutRepository, exerciseRepository: environment.exerciseRepository, historyRepository: environment.exerciseHistoryRepository).environment(environment).preferredColorScheme(.dark) }
            .modelContainer(environment.container)
    }
}
