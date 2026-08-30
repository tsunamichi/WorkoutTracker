import XCTest
@testable import Equilibrium

@MainActor
final class HomeQueueTests: XCTestCase {
    func testLoadFailureKeepsVisibleWorkoutsAndSuccessfulRetryClearsError() async {
        var attempts = 0
        let retained = EquilibriumFixtures.ready(id: "visible")
        let refreshed = EquilibriumFixtures.ready(id: "refreshed")
        let model = HomeModel(loadActive: {
            attempts += 1
            if attempts == 2 { throw RepositoryError.notFound }
            return attempts == 1 ? [retained] : [refreshed]
        })
        await model.load(); XCTAssertEqual(model.workouts, [retained]); XCTAssertNil(model.errorMessage)
        await model.load(); XCTAssertEqual(model.workouts, [retained]); XCTAssertEqual(model.errorMessage, "Home could not be loaded.")
        await model.load(); XCTAssertEqual(model.workouts, [refreshed]); XCTAssertNil(model.errorMessage)
    }

    func testHomeContainsEveryIncompleteWorkoutInStableCreationOrder() async throws {
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        var a = EquilibriumFixtures.ready(id: "a"); a.createdAt = .init(timeIntervalSince1970: 1)
        var b = EquilibriumFixtures.inProgress(id: "b"); b.createdAt = .init(timeIntervalSince1970: 2)
        var completed = EquilibriumFixtures.completed(id: "completed"); completed.createdAt = .init(timeIntervalSince1970: 0)
        try await repository.materializeAtomically([b, completed, a])
        let model = HomeModel(repository: repository); await model.load()
        XCTAssertEqual(model.workouts.map(\.id), [a.id, b.id])
    }

    func testCompletionImmediatelyRemovesCardWithoutReorderingRemainingCards() async throws {
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        var a = EquilibriumFixtures.ready(id: "a"); a.createdAt = .init(timeIntervalSince1970: 1)
        var b = EquilibriumFixtures.completed(id: "b"); b.status = .inProgress; b.completedAt = nil; b.createdAt = .init(timeIntervalSince1970: 2)
        var c = EquilibriumFixtures.ready(id: "c"); c.createdAt = .init(timeIntervalSince1970: 3)
        try await repository.materializeAtomically([a, b, c])
        let model = HomeModel(repository: repository); await model.load()
        let completed = try await repository.completeWorkout(id: b.id, at: EquilibriumFixtures.timestamp.addingTimeInterval(20)); model.applyPersistedWorkout(completed)
        XCTAssertEqual(model.workouts.map(\.id), [a.id, c.id])
        let persisted = try await repository.workout(id: b.id)
        let historyIDs = try await repository.completedWorkouts().map(\.id)
        XCTAssertNotNil(persisted); XCTAssertEqual(historyIDs, [b.id])
    }

    func testReadyWorkoutSurvivesRepositoryRecreationWithoutMutation() async throws {
        let url = TestSupport.temporaryStoreURL(); let original = EquilibriumFixtures.ready(id: "indefinite-ready")
        do { let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(storageURL: url)); try await repository.create(original) }
        let reopened = SwiftDataRepository(container: try PersistenceController.makeContainer(storageURL: url))
        let active = try await reopened.activeWorkouts()
        XCTAssertEqual(active, [original])
        let started = try await reopened.startWorkout(id: original.id, at: EquilibriumFixtures.timestamp.addingTimeInterval(9_999_999))
        XCTAssertEqual(started.status, .inProgress)
    }

    func testInProgressWorkoutSurvivesRecreationAndCanResumeAndCompleteMuchLater() async throws {
        let url = TestSupport.temporaryStoreURL()
        let original = EquilibriumFixtures.inProgress(id: "indefinite-progress")
        do {
            let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(storageURL: url))
            try await repository.create(original)
        }
        let reopened = SwiftDataRepository(container: try PersistenceController.makeContainer(storageURL: url))
        let active = try await reopened.activeWorkouts()
        XCTAssertEqual(active, [original])
        let persisted = try await reopened.workout(id: original.id)
        var resumed = try XCTUnwrap(persisted)
        XCTAssertEqual(resumed.exercises[0].loggedSets.first?.repetitions, 8)
        let muchLater = EquilibriumFixtures.timestamp.addingTimeInterval(99_999_999)
        for prescription in resumed.exercises[0].prescriptions where !resumed.exercises[0].loggedSets.contains(where: { $0.prescriptionID == prescription.id }) {
            resumed = try await reopened.logSet(workoutID: resumed.id, exerciseID: resumed.exercises[0].id, prescriptionID: prescription.id, input: .repetitions(weight: .init(pounds: 135), repetitions: 8), completed: true, at: muchLater)
        }
        let completed = try await reopened.completeWorkout(id: resumed.id, at: muchLater.addingTimeInterval(1))
        XCTAssertEqual(completed.status, .completed)
        let remaining = try await reopened.activeWorkouts()
        XCTAssertTrue(remaining.isEmpty)
    }

    func testStableIDTieBreakAndStatusMutationDoNotReorder() async throws {
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true)); let instant = Date(timeIntervalSince1970: 10)
        var b = EquilibriumFixtures.ready(id: "b"); b.createdAt = instant
        var a = EquilibriumFixtures.ready(id: "a"); a.createdAt = instant
        try await repository.materializeAtomically([b, a])
        let initialIDs = try await repository.activeWorkouts().map(\.id)
        XCTAssertEqual(initialIDs, [a.id, b.id])
        _ = try await repository.startWorkout(id: b.id, at: .init(timeIntervalSince1970: 20))
        let updatedIDs = try await repository.activeWorkouts().map(\.id)
        XCTAssertEqual(updatedIDs, [a.id, b.id])
    }

    func testCardMappingAndStableRouteIdentity() {
        XCTAssertEqual(HomeCardPresentation(status: .ready).action, .start); XCTAssertEqual(HomeCardPresentation(status: .completed).action, .view)
        XCTAssertEqual(HomeRoute.workout(.init(rawValue: "stable")), HomeRoute.workout(.init(rawValue: "stable")))
    }
}
