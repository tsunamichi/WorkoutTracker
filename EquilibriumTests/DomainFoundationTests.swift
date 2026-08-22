import XCTest
@testable import Equilibrium

final class DomainFoundationTests: XCTestCase {
    func testStronglyTypedIDCodableAndInvalidDecode() throws {
        let id = ExerciseID(rawValue: "exercise-1")
        let data = try JSONEncoder().encode(id)
        XCTAssertEqual(try JSONDecoder().decode(ExerciseID.self, from: data), id)
        XCTAssertThrowsError(try JSONDecoder().decode(ExerciseID.self, from: Data("\" \"".utf8)))
    }

    func testLocalDayValidationOrderingAndCodable() throws {
        XCTAssertEqual(try LocalDay("2024-02-29").iso8601, "2024-02-29")
        XCTAssertThrowsError(try LocalDay("2023-02-29")); XCTAssertThrowsError(try LocalDay("2024-2-09")); XCTAssertThrowsError(try LocalDay("2024-13-01"))
        XCTAssertLessThan(try LocalDay("2024-12-31"), try LocalDay("2025-01-01"))
        let encoded = try JSONEncoder().encode(LocalDay("2025-03-09"))
        XCTAssertEqual(String(decoding: encoded, as: UTF8.self), "\"2025-03-09\"")
        XCTAssertEqual(try JSONDecoder().decode(LocalDay.self, from: encoded), try LocalDay("2025-03-09"))
    }

    func testLocalDayAcrossDSTUsesExplicitCalendar() throws {
        var newYork = Calendar(identifier: .gregorian); newYork.timeZone = try XCTUnwrap(TimeZone(identifier: "America/New_York"))
        for value in ["2025-03-09", "2025-03-10", "2025-11-02", "2025-11-03"] {
            let day = try LocalDay(value); let date = try XCTUnwrap(day.date(in: newYork)); XCTAssertEqual(try LocalDay(date: date, calendar: newYork), day)
        }
        var tokyo = Calendar(identifier: .gregorian); tokyo.timeZone = try XCTUnwrap(TimeZone(identifier: "Asia/Tokyo"))
        let instant = try XCTUnwrap(try LocalDay("2025-03-09").date(in: newYork))
        XCTAssertNotEqual(try LocalDay(date: instant, calendar: tokyo), try LocalDay(date: instant, calendar: newYork))
    }

    func testWeightConversion() {
        let weight = Weight(100, unit: .kilograms)
        XCTAssertEqual(weight.pounds, 220.46226218, accuracy: 0.000001)
        XCTAssertEqual(weight.value(in: .kilograms), 100, accuracy: 0.000001)
    }

    func testSetTargetRoundTripsBothCases() throws {
        for target in [SetTarget.repetitions(range: 8...12), .duration(seconds: 45)] {
            XCTAssertEqual(try JSONDecoder().decode(SetTarget.self, from: JSONEncoder().encode(target)), target)
        }
    }

    func testWorkoutAndCompletedSetValidation() throws {
        try DomainValidator.validate(EquilibriumFixtures.planned())
        try DomainValidator.validate(EquilibriumFixtures.mixed())
        try DomainValidator.validate(EquilibriumFixtures.inProgress())
        try DomainValidator.validate(EquilibriumFixtures.completed())
        var invalid = EquilibriumFixtures.inProgress(); invalid.status = .planned
        XCTAssertThrowsError(try DomainValidator.validate(invalid))
        let bad = LoggedSet(id: .init(rawValue: "bad"), prescriptionID: .init(rawValue: "p"), weight: nil, repetitions: nil, duration: 10, completedAt: EquilibriumFixtures.timestamp)
        XCTAssertThrowsError(try DomainValidator.validateCompleted(bad, target: .repetitions(range: 8...12)))
        XCTAssertNoThrow(try DomainValidator.validateCompleted(bad, target: .duration(seconds: 10)))
    }

    func testCyclePlanValidationAndTemplateBoundary() throws {
        try DomainValidator.validate(EquilibriumFixtures.plan, availableTemplates: [EquilibriumFixtures.templateID])
        var invalid = EquilibriumFixtures.plan; invalid.numberOfWeeks = 0
        XCTAssertThrowsError(try DomainValidator.validate(invalid, availableTemplates: [EquilibriumFixtures.templateID]))
        XCTAssertThrowsError(try DomainValidator.validate(EquilibriumFixtures.plan, availableTemplates: []))
    }

    func testWorkoutSnapshotCodableRoundTripAndFixtureValidity() throws {
        for workout in [EquilibriumFixtures.planned(), EquilibriumFixtures.mixed(), EquilibriumFixtures.inProgress(), EquilibriumFixtures.completed()] {
            let decoded = try JSONDecoder().decode(ScheduledWorkout.self, from: JSONEncoder().encode(workout))
            XCTAssertEqual(decoded, workout); try DomainValidator.validate(decoded)
        }
        XCTAssertTrue(EquilibriumFixtures.empty().isEmpty)
    }
}
