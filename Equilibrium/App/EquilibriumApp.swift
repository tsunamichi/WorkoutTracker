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
                let workout: ScheduledWorkout?
                switch arguments[flag + 1] {
                case "planned": workout = EquilibriumFixtures.planned(day: day, id: "launch-planned")
                case "inProgress": workout = EquilibriumFixtures.inProgress(day: day, id: "launch-progress")
                case "completed": workout = EquilibriumFixtures.completed(day: day, id: "launch-completed")
                default: workout = nil
                }
                if let workout { container.mainContext.insert(WorkoutMapper.record(from: workout)); try container.mainContext.save() }
                environment = AppEnvironment(container: container)
                return
            }
#endif
            environment = try AppEnvironment.live()
        }
        catch { fatalError("Unable to initialize Equilibrium persistence: \(error)") }
    }
    var body: some Scene {
        WindowGroup { ScheduleView(repository: environment.workoutRepository, exerciseRepository: environment.exerciseRepository, templateRepository: environment.templateRepository).environment(environment).preferredColorScheme(.dark) }
            .modelContainer(environment.container)
    }
}
