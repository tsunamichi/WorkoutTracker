import XCTest
@testable import Equilibrium

final class DomainFoundationTests: XCTestCase {
    func testStronglyTypedIDCodableAndInvalidDecode() throws {
        let id = ExerciseID(rawValue: "exercise-1")
        let data = try JSONEncoder().encode(id)
        XCTAssertEqual(try JSONDecoder().decode(ExerciseID.self, from: data), id)
        XCTAssertThrowsError(try JSONDecoder().decode(ExerciseID.self, from: Data("\" \"".utf8)))
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
        try DomainValidator.validate(EquilibriumFixtures.ready())
        try DomainValidator.validate(EquilibriumFixtures.mixed())
        try DomainValidator.validate(EquilibriumFixtures.inProgress())
        try DomainValidator.validate(EquilibriumFixtures.completed())
        var invalid = EquilibriumFixtures.inProgress(); invalid.status = .ready
        XCTAssertThrowsError(try DomainValidator.validate(invalid))
        let bad = LoggedSet(id: .init(rawValue: "bad"), prescriptionID: .init(rawValue: "p"), weight: nil, repetitions: nil, duration: 10, completedAt: EquilibriumFixtures.timestamp)
        XCTAssertThrowsError(try DomainValidator.validateCompleted(bad, target: .repetitions(range: 8...12)))
        XCTAssertNoThrow(try DomainValidator.validateCompleted(bad, target: .duration(seconds: 10)))
    }

    func testWorkoutSnapshotCodableRoundTripAndFixtureValidity() throws {
        for workout in [EquilibriumFixtures.ready(), EquilibriumFixtures.mixed(), EquilibriumFixtures.inProgress(), EquilibriumFixtures.completed()] {
            let decoded = try JSONDecoder().decode(Workout.self, from: JSONEncoder().encode(workout))
            XCTAssertEqual(decoded, workout); try DomainValidator.validate(decoded)
        }
        XCTAssertTrue(EquilibriumFixtures.empty().isEmpty)
    }
}
