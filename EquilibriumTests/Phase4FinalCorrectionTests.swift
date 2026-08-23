import SwiftData
import XCTest
@testable import Equilibrium

@MainActor
final class Phase4FinalCorrectionTests: XCTestCase {
    private var now: Date { EquilibriumFixtures.timestamp }

    func testOptionsAndPerformanceEligibilityAcrossRestTransition() async throws {
        let repository = makeRepository()
        let workout = EquilibriumFixtures.mixed(id: "rest-performance")
        try await repository.create(workout)
        let model = WorkoutExecutionModel(workoutID: workout.id, repository: repository, now: { self.now })
        await model.activate()
        XCTAssertTrue(model.showsExecutionOptions)
        XCTAssertFalse(model.canComplete)
        XCTAssertEqual(model.performanceExercise?.exerciseID, workout.exercises[0].exerciseID)
        for prescription in workout.exercises[0].prescriptions {
            await model.log(exerciseID: workout.exercises[0].id, prescriptionID: prescription.id, input: .repetitions(weight: .init(pounds: 100), repetitions: 8))
            if prescription != workout.exercises[0].prescriptions.last { model.skipRest() }
        }
        XCTAssertNotNil(model.restState)
        XCTAssertEqual(model.currentExercise?.exerciseID, workout.exercises[1].exerciseID)
        XCTAssertNil(model.performanceExercise)
        XCTAssertNil(model.restEditableExercise)
        XCTAssertFalse(model.canEditRestDuration)
        let editedDuringRest = await model.setRestDuration(80)
        XCTAssertFalse(editedDuringRest)
        model.skipRest()
        XCTAssertEqual(model.performanceExercise?.exerciseID, workout.exercises[1].exerciseID)
        XCTAssertEqual(model.restEditableExercise?.exerciseID, workout.exercises[1].exerciseID)
        XCTAssertTrue(model.canEditRestDuration)
        XCTAssertEqual(model.workout?.exercises.map(\.id), workout.exercises.map(\.id))
    }

    func testRestEditingUnavailableWithNoCurrentExerciseAwaitingCompletion() async throws {
        let repository = makeRepository()
        var awaitingCompletion = EquilibriumFixtures.completed(id: "awaiting-completion")
        awaitingCompletion.status = .inProgress
        awaitingCompletion.completedAt = nil
        try await repository.create(awaitingCompletion)
        let model = WorkoutExecutionModel(workoutID: awaitingCompletion.id, repository: repository, now: { self.now })
        await model.activate()
        XCTAssertTrue(model.showsExecutionOptions)
        XCTAssertTrue(model.canComplete)
        XCTAssertNil(model.currentExercise)
        XCTAssertNil(model.restEditableExercise)
        XCTAssertFalse(model.canEditRestDuration)
    }

    func testConfiguredRestDurationUsesCurrentOverrideOrDefaultWithoutFirstExerciseFallback() async throws {
        let repository = makeRepository()
        var workout = EquilibriumFixtures.mixed(id: "rest-default")
        workout.exercises[0].restDuration = nil
        workout.exercises[1].restDuration = 240
        try await repository.create(workout)
        let model = WorkoutExecutionModel(workoutID: workout.id, repository: repository, defaultRestDuration: 90, now: { self.now })
        await model.activate()
        XCTAssertEqual(model.restEditableExercise?.id, workout.exercises[0].id)
        XCTAssertEqual(model.configuredRestDuration, 90)
    }

    func testCompletedWorkoutHasNoActiveExecutionOptions() async throws {
        let repository = makeRepository()
        let completed = EquilibriumFixtures.completed(id: "completed-options")
        try await repository.create(completed)
        let model = WorkoutExecutionModel(workoutID: completed.id, repository: repository, now: { self.now })
        await model.activate()
        XCTAssertFalse(model.showsExecutionOptions)
    }

    func testResetClearsOnlyCanonicalProgressAndPersistsAcrossRecreation() async throws {
        let url = TestSupport.temporaryStoreURL()
        var container: ModelContainer? = try PersistenceController.makeContainer(storageURL: url)
        var repository: SwiftDataRepository? = SwiftDataRepository(container: container!)
        let target = EquilibriumFixtures.inProgress(id: "reset-target")
        let unrelated = EquilibriumFixtures.completed(id: "reset-unrelated")
        try await repository!.materializeAtomically([target, unrelated])
        let reset = try await repository!.resetWorkout(id: target.id, at: now.addingTimeInterval(10))
        XCTAssertTrue(reset.exercises.flatMap(\.loggedSets).isEmpty)
        XCTAssertEqual(reset.status, .inProgress)
        let unrelatedBeforeRelaunch = try await repository!.workout(id: unrelated.id)
        XCTAssertEqual(unrelatedBeforeRelaunch, unrelated)
        repository = nil; container = nil
        let reopened = SwiftDataRepository(container: try PersistenceController.makeContainer(storageURL: url))
        let persistedValue = try await reopened.workout(id: target.id)
        let persisted = try XCTUnwrap(persistedValue)
        XCTAssertTrue(persisted.exercises.flatMap(\.loggedSets).isEmpty)
        let unrelatedAfterRelaunch = try await reopened.workout(id: unrelated.id)
        XCTAssertEqual(unrelatedAfterRelaunch, unrelated)
    }

    func testDeleteRemovesOnlyTargetAndRejectsCompletedWorkout() async throws {
        let repository = makeRepository()
        let target = EquilibriumFixtures.inProgress(id: "delete-target")
        let unrelated = EquilibriumFixtures.ready(id: "delete-unrelated")
        let completed = EquilibriumFixtures.completed(id: "delete-completed")
        try await repository.materializeAtomically([target, unrelated, completed])
        let model = WorkoutExecutionModel(workoutID: target.id, repository: repository, now: { self.now })
        await model.activate()
        let shouldDismiss = await model.deleteWorkout()
        XCTAssertTrue(shouldDismiss)
        let deleted = try await repository.workout(id: target.id)
        let retained = try await repository.workout(id: unrelated.id)
        XCTAssertNil(deleted)
        XCTAssertNotNil(retained)
        do { try await repository.deleteWorkout(id: completed.id); XCTFail("Expected immutable completed workout") }
        catch { XCTAssertEqual(error as? RepositoryError, .immutableCompletedWorkout) }
    }

    func testRestEditPersistsOnlyActiveExerciseAndDrivesSubsequentRest() async throws {
        let url = TestSupport.temporaryStoreURL()
        var container: ModelContainer? = try PersistenceController.makeContainer(storageURL: url)
        var repository: SwiftDataRepository? = SwiftDataRepository(container: container!)
        let workout = EquilibriumFixtures.mixed(id: "rest-edit")
        try await repository!.create(workout)
        let model = WorkoutExecutionModel(workoutID: workout.id, repository: repository!, now: { self.now })
        await model.activate()
        let saved = await model.setRestDuration(75)
        XCTAssertTrue(saved)
        XCTAssertEqual(model.workout?.exercises[0].restDuration, 75)
        XCTAssertEqual(model.workout?.exercises[1].restDuration, workout.exercises[1].restDuration)
        await model.log(exerciseID: workout.exercises[0].id, prescriptionID: workout.exercises[0].prescriptions[0].id, input: .repetitions(weight: nil, repetitions: 8))
        XCTAssertEqual(model.restState?.totalDuration, 75)
        repository = nil; container = nil
        let recreated = SwiftDataRepository(container: try PersistenceController.makeContainer(storageURL: url))
        let recreatedWorkout = try await recreated.workout(id: workout.id)
        XCTAssertEqual(recreatedWorkout?.exercises[0].restDuration, 75)
    }

    func testRestDurationRepositoryRequiresFiveSecondIncrements() async throws {
        let repository = makeRepository()
        let workout = EquilibriumFixtures.inProgress(id: "rest-increments")
        try await repository.create(workout)
        let valid = try await repository.setRestDuration(workoutID: workout.id, exerciseID: workout.exercises[0].id, seconds: 80, at: now)
        XCTAssertEqual(valid.exercises[0].restDuration, 80)
        for invalid in [16.0, 74.0] {
            do {
                _ = try await repository.setRestDuration(workoutID: workout.id, exerciseID: workout.exercises[0].id, seconds: invalid, at: now)
                XCTFail("Expected invalid rest duration")
            } catch { XCTAssertEqual(error as? RepositoryError, .invalidRestDuration) }
        }
        let persisted = try await repository.workout(id: workout.id)
        XCTAssertEqual(persisted?.exercises[0].restDuration, 80)
    }

    func testSharePayloadUsesSnapshotAndHasNoPersistenceSideEffects() async throws {
        let repository = makeRepository()
        let workout = EquilibriumFixtures.inProgress(id: "share")
        try await repository.create(workout)
        let before = try await repository.workout(id: workout.id)
        let text = WorkoutShareText.build(workout: workout, unit: .pounds)
        XCTAssertTrue(text.contains(workout.titleSnapshot))
        XCTAssertTrue(text.contains(workout.exercises[0].nameSnapshot))
        XCTAssertTrue(text.contains("135 lb × 8"))
        let after = try await repository.workout(id: workout.id)
        XCTAssertEqual(after, before)
    }

    private func makeRepository() -> SwiftDataRepository {
        SwiftDataRepository(container: try! PersistenceController.makeContainer(inMemory: true))
    }


}
