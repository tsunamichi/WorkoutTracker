import XCTest
@testable import Equilibrium

@MainActor
final class WorkoutHistoryPagingTests: XCTestCase {
    func testHistoryRevealsTwoWeeksAtATime() async throws {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "UTC")!
        let now = calendar.date(from: DateComponents(year: 2026, month: 9, day: 30, hour: 12))!
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        for (index, daysAgo) in [1, 10, 20, 40].enumerated() {
            var workout = EquilibriumFixtures.completed(id: "w\(index)")
            let completedAt = calendar.date(byAdding: .day, value: -daysAgo, to: now)!
            workout.createdAt = completedAt; workout.completedAt = completedAt; workout.updatedAt = completedAt
            try await repository.create(workout)
        }
        let model = WorkoutHistoryModel(repository: repository, now: { now }, calendar: calendar)
        await model.load()
        func visibleIDs() -> [String] { model.months.flatMap(\.workouts).map(\.id.rawValue) }
        XCTAssertEqual(visibleIDs(), ["w0", "w1"])
        XCTAssertTrue(model.hasOlderWorkouts)
        model.loadMore()
        XCTAssertEqual(model.visibleWeeks, 4)
        XCTAssertEqual(visibleIDs(), ["w0", "w1", "w2"])
        XCTAssertTrue(model.hasOlderWorkouts)
        model.loadMore(); model.loadMore()
        XCTAssertEqual(visibleIDs(), ["w0", "w1", "w2", "w3"])
        XCTAssertFalse(model.hasOlderWorkouts)
        XCTAssertTrue(model.hasAnyWorkouts)
    }
}
