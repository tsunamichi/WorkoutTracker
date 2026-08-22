import XCTest
import SwiftData
@testable import Equilibrium

@MainActor
final class PersistenceSpikeTests: XCTestCase {
    func testOrderedWorkoutPersistenceAndSnapshots() async throws {
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        let fixture = EquilibriumFixtures.mixed()
        try await repository.schedule(fixture)
        let result = try await repository.workout(on: fixture.day)
        let loaded = try XCTUnwrap(result)
        XCTAssertEqual(loaded, fixture)
        XCTAssertEqual(loaded.exercises.map(\.nameSnapshot), ["Back Squat", "Plank"])
    }

    func testOneWorkoutPerDayReturnsDomainConflict() async throws {
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        let first = EquilibriumFixtures.planned()
        try await repository.schedule(first)
        do { try await repository.schedule(EquilibriumFixtures.mixed(day: first.day.iso8601)); XCTFail("Expected conflict") }
        catch { XCTAssertEqual(error as? RepositoryError, .workoutDayConflict(first.day)) }
        let count = try await repository.allWorkouts().count
        XCTAssertEqual(count, 1)
    }

    func testPlanMaterializationIsAtomicWhenAnyDayConflicts() async throws {
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        try await repository.schedule(EquilibriumFixtures.planned(day: "2025-02-03", id: "occupied"))
        let incoming = [EquilibriumFixtures.planned(day: "2025-02-04", id: "incoming-1"), EquilibriumFixtures.planned(day: "2025-02-03", id: "incoming-2")]
        do { try await repository.materializeAtomically(incoming); XCTFail("Expected conflict") } catch { }
        let identifiers = try await repository.allWorkouts().map(\.id.rawValue)
        XCTAssertEqual(identifiers, ["occupied"])
    }

    func testInProgressSetSurvivesContainerRecreation() async throws {
        let url = TestSupport.temporaryStoreURL()
        var container: SwiftData.ModelContainer? = try PersistenceController.makeContainer(storageURL: url)
        var repository: SwiftDataRepository? = SwiftDataRepository(container: container!)
        let fixture = EquilibriumFixtures.inProgress()
        try await repository!.schedule(fixture)
        repository = nil; container = nil
        let reopened = try PersistenceController.makeContainer(storageURL: url)
        let result = try await SwiftDataRepository(container: reopened).workout(id: fixture.id)
        let loaded = try XCTUnwrap(result)
        XCTAssertEqual(loaded.exercises[0].loggedSets[0].repetitions, 8)
        XCTAssertEqual(loaded.exercises[0].loggedSets[0].weight?.pounds, 135)
    }

    func testUpdateInProgressWorkoutPersistsNewSet() async throws {
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        var workout = EquilibriumFixtures.planned(); workout.status = .inProgress; workout.startedAt = EquilibriumFixtures.timestamp
        try await repository.schedule(workout)
        let prescription = workout.exercises[0].prescriptions[0]
        workout.exercises[0].loggedSets = [.init(id: .init(rawValue: "new-log"), prescriptionID: prescription.id, weight: .init(pounds: 155), repetitions: 9, duration: nil, completedAt: EquilibriumFixtures.timestamp)]
        try await repository.update(workout)
        let repetitions = try await repository.workout(id: workout.id)?.exercises[0].loggedSets.first?.repetitions
        XCTAssertEqual(repetitions, 9)
    }
}
