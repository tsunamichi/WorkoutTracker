import XCTest
import SwiftData
@testable import Equilibrium

final class ScheduleCalendarTests: XCTestCase {
    private func calendar(timeZone: String = "America/New_York") throws -> ScheduleCalendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = try XCTUnwrap(TimeZone(identifier: timeZone))
        return ScheduleCalendar(calendar: calendar)
    }

    func testWeekCrossesMonthAndRetainsMondayStart() throws {
        XCTAssertEqual(try calendar().week(containing: LocalDay("2026-08-31")).map(\.iso8601),
                       ["2026-08-31", "2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04", "2026-09-05", "2026-09-06"])
    }

    func testWeekCrossesYearBoundary() throws {
        XCTAssertEqual(try calendar().week(containing: LocalDay("2026-12-31")).map(\.iso8601),
                       ["2026-12-28", "2026-12-29", "2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02", "2027-01-03"])
    }

    func testLeapYearAndWeekMovement() throws {
        let leap = try LocalDay("2024-02-29")
        XCTAssertTrue(try calendar().week(containing: leap).contains(leap))
        XCTAssertEqual(try calendar().moving(leap, byWeeks: 1), try LocalDay("2024-03-07"))
        XCTAssertEqual(try calendar().moving(leap, byDays: 1), try LocalDay("2024-03-01"))
    }

    func testDSTAndTimeZoneUseCalendarLocalDay() throws {
        for zone in ["America/New_York", "Europe/London", "Asia/Tokyo"] {
            let value = try calendar(timeZone: zone)
            for day in [try LocalDay("2026-03-08"), try LocalDay("2026-11-01")] {
                XCTAssertEqual(try value.week(containing: day).count, 7)
                XCTAssertEqual(try value.moving(value.moving(day, byWeeks: 1), byWeeks: -1), day)
            }
        }
    }

    func testTodayUsesInjectedInstantAndDeviceTimeZone() throws {
        let instant = Date(timeIntervalSince1970: 1_777_770_000)
        let newYork = try calendar(timeZone: "America/New_York")
        let tokyo = try calendar(timeZone: "Asia/Tokyo")
        XCTAssertEqual(try newYork.today(now: instant), try LocalDay(date: instant, calendar: newYork.calendar))
        XCTAssertEqual(try tokyo.today(now: instant), try LocalDay(date: instant, calendar: tokyo.calendar))
    }
}

@MainActor
final class ScheduleFeatureTests: XCTestCase {
    func testVisibleDateRepositoryQueryIsInclusiveAndOrdered() async throws {
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        try await repository.schedule(EquilibriumFixtures.planned(day: "2026-08-31", id: "range-a"))
        try await repository.schedule(EquilibriumFixtures.mixed(day: "2026-09-02", id: "range-b"))
        try await repository.schedule(EquilibriumFixtures.planned(day: "2026-09-07", id: "outside"))
        let result = try await repository.workouts(from: LocalDay("2026-08-31"), through: LocalDay("2026-09-06"))
        XCTAssertEqual(result.map(\.id.rawValue), ["range-a", "range-b"])
    }

    func testSelectedDayAndRestAndAddWorkoutPresentationState() async throws {
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        let now = try XCTUnwrap(try LocalDay("2026-08-22").date(in: Calendar(identifier: .gregorian)))
        let model = ScheduleModel(repository: repository, calendar: ScheduleCalendar(calendar: Calendar(identifier: .gregorian)), now: now)
        let rest = try LocalDay("2026-08-23")
        model.select(rest)
        XCTAssertEqual(model.selectedDay, rest)
        XCTAssertNil(model.selectedWorkout)
        XCTAssertFalse(model.isAddWorkoutPresented)
        model.isAddWorkoutPresented = true
        XCTAssertTrue(model.isAddWorkoutPresented)
        XCTAssertFalse(model.isTimerPresented)
        model.isTimerPresented = true
        XCTAssertTrue(model.isTimerPresented)
    }

    func testDayNavigationIsLocalDaySafeAndLoadsWorkoutFirstState() async throws {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = try XCTUnwrap(TimeZone(identifier: "America/New_York"))
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        let workout = EquilibriumFixtures.planned(day: "2026-03-08", id: "dst-workout")
        try await repository.schedule(workout)
        let now = try XCTUnwrap(try LocalDay("2026-03-07").date(in: calendar))
        let model = ScheduleModel(repository: repository, calendar: ScheduleCalendar(calendar: calendar), now: now)
        await model.load()
        XCTAssertNil(model.selectedWorkout)
        await model.moveDay(1)
        XCTAssertEqual(model.selectedDay, try LocalDay("2026-03-08"))
        XCTAssertEqual(model.selectedWorkout?.id, workout.id)
        await model.moveDay(-1)
        XCTAssertNil(model.selectedWorkout)
    }

    func testOneWorkoutPerLocalDayRemainsCanonical() async throws {
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        try await repository.schedule(EquilibriumFixtures.planned(day: "2026-08-22", id: "one"))
        do {
            try await repository.schedule(EquilibriumFixtures.mixed(day: "2026-08-22", id: "two"))
            XCTFail("Expected LocalDay conflict")
        } catch { XCTAssertEqual(error as? RepositoryError, .workoutDayConflict(try LocalDay("2026-08-22"))) }
    }

    func testPlannedInProgressCompletedMappingAndCompletedCannotStartOrResume() {
        XCTAssertEqual(ScheduleCardPresentation(status: .planned).action, .start)
        XCTAssertEqual(ScheduleCardPresentation(status: .inProgress).action, .resume)
        XCTAssertEqual(ScheduleCardPresentation(status: .completed).action, .view)
        XCTAssertEqual(ScheduleCardPresentation(status: .completed).actionLabel, "View workout")
    }

    func testStableCardIdentityAndRouteGeneration() {
        let workout = EquilibriumFixtures.planned(id: "stable-workout")
        XCTAssertEqual(workout.id.rawValue, "stable-workout")
        XCTAssertEqual(ScheduleRoute.workout(workout.id), ScheduleRoute.workout(.init(rawValue: "stable-workout")))
        XCTAssertNotEqual(ScheduleRoute.workout(workout.id), .history)
    }
}
