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

    func testLegacyTerminalWorkoutReconcilesCompletedAndPreservesTerminalTimestamp() async throws {
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        let completedAt = Date(timeIntervalSince1970: 1_000)
        let skippedAt = Date(timeIntervalSince1970: 1_100)
        let legacy = legacyWorkout(id: "legacy-terminal", completedAt: completedAt, skippedAt: skippedAt)
        try await repository.create(legacy)

        let stored = try await repository.workout(id: legacy.id)
        let repaired = try XCTUnwrap(stored)
        XCTAssertEqual(repaired.status, .completed)
        XCTAssertEqual(repaired.completedAt, skippedAt)
        XCTAssertEqual(repaired.exercises[0].loggedSets.count, 1)
        XCTAssertEqual(repaired.exercises[1].skippedAt, skippedAt)
        let active = try await repository.activeWorkouts()
        XCTAssertTrue(active.isEmpty)

        // A second read is a no-op and does not create another occurrence.
        let repeatedStored = try await repository.workout(id: legacy.id)
        let repeated = try XCTUnwrap(repeatedStored)
        XCTAssertEqual(repeated, repaired)
        let all = try await repository.allWorkouts()
        XCTAssertEqual(all.map(\.id), [legacy.id])
    }

    func testLegacyIncompleteWorkoutIsNotAutoCompleted() async throws {
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        let legacy = legacyWorkout(id: "legacy-incomplete", completedAt: Date(timeIntervalSince1970: 1_000), skippedAt: nil)
        try await repository.create(legacy)

        let stored = try await repository.workout(id: legacy.id)
        let loaded = try XCTUnwrap(stored)
        XCTAssertEqual(loaded.status, .inProgress)
        XCTAssertNil(loaded.completedAt)
        let active = try await repository.activeWorkouts()
        XCTAssertEqual(active.map(\.id), [legacy.id])
    }

    func testLegacyCompletionRepairSurvivesRelaunchAndHonorsHomeCompletionDate() async throws {
        let url = TestSupport.temporaryStoreURL()
        let completion = Date(timeIntervalSince1970: 1_000)
        let legacy = legacyWorkout(id: "legacy-relaunch", completedAt: completion, skippedAt: completion)
        do {
            let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(storageURL: url))
            try await repository.create(legacy)
            _ = try await repository.homeWorkouts(completedSince: completion)
        }

        let reopened = SwiftDataRepository(container: try PersistenceController.makeContainer(storageURL: url))
        let stored = try await reopened.workout(id: legacy.id)
        let repaired = try XCTUnwrap(stored)
        XCTAssertEqual(repaired.status, .completed)
        XCTAssertEqual(repaired.completedAt, completion)
        let laterHome = try await reopened.homeWorkouts(completedSince: completion.addingTimeInterval(1))
        XCTAssertTrue(laterHome.workouts.isEmpty)
    }

    private func legacyWorkout(id: String, completedAt: Date, skippedAt: Date?) -> Workout {
        let firstPrescription = SetPrescription(id: .init(rawValue: "\(id)-first-set"), target: .repetitions(range: 8...8), suggestedWeight: nil)
        let secondPrescription = SetPrescription(id: .init(rawValue: "\(id)-second-set"), target: .repetitions(range: 8...8), suggestedWeight: nil)
        let first = WorkoutExercise(
            id: .init(rawValue: "\(id)-first"), exerciseID: .init(rawValue: "\(id)-first-definition"), nameSnapshot: "Completed",
            prescriptions: [firstPrescription],
            loggedSets: [.init(id: .init(rawValue: "\(id)-log"), prescriptionID: firstPrescription.id, weight: nil, repetitions: 8, duration: nil, completedAt: completedAt)],
            restDuration: nil,
            skippedAt: nil
        )
        let second = WorkoutExercise(
            id: .init(rawValue: "\(id)-second"), exerciseID: .init(rawValue: "\(id)-second-definition"), nameSnapshot: "Skipped",
            prescriptions: [secondPrescription], loggedSets: [], restDuration: nil, skippedAt: skippedAt
        )
        return Workout(
            id: .init(rawValue: id), titleSnapshot: "Full Upper Body", exercises: [first, second], status: .inProgress,
            startedAt: completedAt.addingTimeInterval(-60), completedAt: nil,
            createdAt: completedAt.addingTimeInterval(-120), updatedAt: completedAt
        )
    }
}
