import XCTest
@testable import Equilibrium

final class ScheduleCalendarTests: XCTestCase {
    private func calendar(timeZone: String = "America/New_York") throws -> ScheduleCalendar {
        var value = Calendar(identifier: .gregorian); value.timeZone = try XCTUnwrap(TimeZone(identifier: timeZone)); return ScheduleCalendar(calendar: value)
    }
    func testLocalDayMovementAcrossDST() throws {
        let value = try calendar(); let day = try LocalDay("2026-03-08")
        XCTAssertEqual(try value.moving(day, byDays: 1), try LocalDay("2026-03-09"))
        XCTAssertEqual(try value.moving(value.moving(day, byWeeks: 1), byWeeks: -1), day)
    }
    func testTodayUsesInjectedInstantAndTimeZone() throws {
        let instant = Date(timeIntervalSince1970: 1_777_770_000); let value = try calendar(timeZone: "Asia/Tokyo")
        XCTAssertEqual(try value.today(now: instant), try LocalDay(date: instant, calendar: value.calendar))
    }
}

@MainActor
final class HomeFeatureTests: XCTestCase {
    private let day = try! LocalDay("2026-08-22")
    private var instant: Date { try! day.date(in: Calendar(identifier: .gregorian))! }

    func testHomeQueriesTodayOnlyAndSupportsMultipleCards() async throws {
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        var first = EquilibriumFixtures.planned(day: day.iso8601, id: "one"); first.createdAt = instant
        var second = EquilibriumFixtures.completed(day: day.iso8601, id: "two"); second.createdAt = instant.addingTimeInterval(1)
        try await repository.materializeAtomically([first, second, EquilibriumFixtures.planned(day: "2026-08-21", id: "yesterday")])
        let model = HomeModel(repository: repository, calendar: ScheduleCalendar(calendar: Calendar(identifier: .gregorian)), now: { self.instant })
        await model.load()
        XCTAssertEqual(model.workouts.map(\.id), [first.id, second.id]); XCTAssertEqual(model.workouts.last?.status, .completed)
    }

    func testRolloverReloadRemovesYesterdayWithoutDeletion() async throws {
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        try await repository.schedule(EquilibriumFixtures.planned(day: day.iso8601, id: "old"))
        var now = instant
        let model = HomeModel(repository: repository, calendar: ScheduleCalendar(calendar: Calendar(identifier: .gregorian)), now: { now })
        await model.load(); XCTAssertEqual(model.workouts.count, 1)
        now = Calendar(identifier: .gregorian).date(byAdding: .day, value: 1, to: now)!
        await model.appBecameActive(); XCTAssertTrue(model.workouts.isEmpty)
        let historical = try await repository.workout(id: .init(rawValue: "old")); XCTAssertNotNil(historical)
    }

    func testStableOrderingAndStatusMutation() async throws {
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        var a = EquilibriumFixtures.planned(day: day.iso8601, id: "a"); a.createdAt = instant
        var b = EquilibriumFixtures.planned(day: day.iso8601, id: "b"); b.createdAt = instant.addingTimeInterval(1)
        try await repository.materializeAtomically([b, a])
        var ordered = try await repository.workouts(on: day); XCTAssertEqual(ordered.map(\.id), [a.id, b.id])
        b.status = .inProgress; b.startedAt = instant; try await repository.update(b)
        ordered = try await repository.workouts(on: day); XCTAssertEqual(ordered.map(\.id), [a.id, b.id])
    }

    func testCardMappingAndStableRouteIdentity() {
        XCTAssertEqual(HomeCardPresentation(status: .planned).action, .start)
        XCTAssertEqual(HomeCardPresentation(status: .completed).action, .view)
        let id = ScheduledWorkoutID(rawValue: "stable")
        XCTAssertEqual(HomeRoute.workout(id), HomeRoute.workout(.init(rawValue: "stable")))
    }
}
