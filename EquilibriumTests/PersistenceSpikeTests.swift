import XCTest
import SwiftData
@testable import Equilibrium

@MainActor
final class PersistenceSpikeTests: XCTestCase {
    func testOrderedWorkoutPersistenceAndSnapshots() async throws {
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        let fixture = EquilibriumFixtures.mixed()
        try await repository.create(fixture)
        let persisted = try await repository.workout(id: fixture.id)
        let loaded = try XCTUnwrap(persisted)
        XCTAssertEqual(loaded, fixture)
        XCTAssertEqual(loaded.exercises.map(\.nameSnapshot), ["Back Squat", "Plank"])
    }

    func testSeveralIndependentWorkoutsRemainDistinctAndOrdered() async throws {
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        let first = EquilibriumFixtures.ready()
        try await repository.create(first)
        var second = EquilibriumFixtures.mixed(); second.createdAt = first.createdAt.addingTimeInterval(1)
        try await repository.create(second)
        let active = try await repository.activeWorkouts()
        XCTAssertEqual(active.map(\.id), [first.id, second.id])
    }

    func testBatchCreationRemainsAtomicForDuplicateIdentity() async throws {
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        try await repository.create(EquilibriumFixtures.ready(id: "occupied"))
        let incoming = [EquilibriumFixtures.ready(id: "incoming-1"), EquilibriumFixtures.ready(id: "occupied")]
        do { try await repository.materializeAtomically(incoming); XCTFail("Expected duplicate") } catch { XCTAssertEqual(error as? RepositoryError, .duplicateIdentifier) }
        let identifiers = try await repository.allWorkouts().map(\.id.rawValue)
        XCTAssertEqual(identifiers, ["occupied"])
    }

    func testInProgressSetSurvivesContainerRecreation() async throws {
        let url = TestSupport.temporaryStoreURL()
        var container: SwiftData.ModelContainer? = try PersistenceController.makeContainer(storageURL: url)
        var repository: SwiftDataRepository? = SwiftDataRepository(container: container!)
        let fixture = EquilibriumFixtures.inProgress()
        try await repository!.create(fixture)
        repository = nil; container = nil
        let reopened = try PersistenceController.makeContainer(storageURL: url)
        let result = try await SwiftDataRepository(container: reopened).workout(id: fixture.id)
        let loaded = try XCTUnwrap(result)
        XCTAssertEqual(loaded.exercises[0].loggedSets[0].repetitions, 8)
        XCTAssertEqual(loaded.exercises[0].loggedSets[0].weight?.pounds, 135)
    }

    func testUpdateInProgressWorkoutPersistsNewSet() async throws {
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        var workout = EquilibriumFixtures.ready(); workout.status = .inProgress; workout.startedAt = EquilibriumFixtures.timestamp
        try await repository.create(workout)
        let prescription = workout.exercises[0].prescriptions[0]
        workout.exercises[0].loggedSets = [.init(id: .init(rawValue: "new-log"), prescriptionID: prescription.id, weight: .init(pounds: 155), repetitions: 9, duration: nil, completedAt: EquilibriumFixtures.timestamp)]
        try await repository.update(workout)
        let repetitions = try await repository.workout(id: workout.id)?.exercises[0].loggedSets.first?.repetitions
        XCTAssertEqual(repetitions, 9)
    }
}
