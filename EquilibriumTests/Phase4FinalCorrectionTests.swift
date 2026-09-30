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
        XCTAssertTrue(model.canEditRestDuration)
        let editedDuringRest = await model.setGlobalRestDuration(80)
        XCTAssertTrue(editedDuringRest)
        XCTAssertEqual(model.restState?.totalDuration, 90)
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
        XCTAssertTrue(model.canEditRestDuration)
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

    func testWorkoutMenuRestEditPersistsCanonicalGlobalDefaultAndDrivesSubsequentRest() async throws {
        let url = TestSupport.temporaryStoreURL()
        var container: ModelContainer? = try PersistenceController.makeContainer(storageURL: url)
        var repository: SwiftDataRepository? = SwiftDataRepository(container: container!)
        let workout = EquilibriumFixtures.mixed(id: "rest-edit")
        try await repository!.create(workout)
        let model = WorkoutExecutionModel(workoutID: workout.id, repository: repository!, now: { self.now })
        await model.activate()
        let saved = await model.setGlobalRestDuration(75)
        XCTAssertTrue(saved)
        let savedSettings = try await repository!.settings()
        XCTAssertEqual(savedSettings.defaultRestDuration, 75)
        XCTAssertEqual(model.workout?.exercises[0].restDuration, workout.exercises[0].restDuration)
        await model.log(exerciseID: workout.exercises[0].id, prescriptionID: workout.exercises[0].prescriptions[0].id, input: .repetitions(weight: nil, repetitions: 8))
        XCTAssertEqual(model.restState?.totalDuration, 75)
        repository = nil; container = nil
        let recreated = SwiftDataRepository(container: try PersistenceController.makeContainer(storageURL: url))
        let recreatedSettings = try await recreated.settings()
        XCTAssertEqual(recreatedSettings.defaultRestDuration, 75)
    }

    func testRestDurationRepositoryRequiresFiveSecondIncrements() async throws {
        let repository = makeRepository()
        let workout = EquilibriumFixtures.inProgress(id: "rest-increments")
        try await repository.create(workout)
        let stableID = workout.exercises[0].exerciseID
        try await repository.saveExerciseRestDuration(80, for: stableID)
        let savedDuration = try await repository.exerciseRestDuration(for: stableID)
        XCTAssertEqual(savedDuration, 80)
        for invalid in [16.0, 74.0] {
            do {
                try await repository.saveExerciseRestDuration(invalid, for: stableID)
                XCTFail("Expected invalid rest duration")
            } catch { XCTAssertEqual(error as? RepositoryError, .invalidSettings) }
        }
        let retainedDuration = try await repository.exerciseRestDuration(for: stableID)
        XCTAssertEqual(retainedDuration, 80)
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

@MainActor
final class ExecutionRestPhase4Tests: XCTestCase {
    func testRestStartsOnlyAfterSuccessfulCanonicalSetPersistence() async throws {
        let repository = makeRepository()
        let workout = EquilibriumFixtures.mixed(id: "phase4-rest-after-persistence")
        try await repository.create(workout)
        let model = WorkoutExecutionModel(workoutID: workout.id, repository: repository)
        await model.activate()
        let exercise = workout.exercises[0]
        let prescription = exercise.prescriptions[0]

        await model.log(
            exerciseID: exercise.id,
            prescriptionID: prescription.id,
            input: .duration(weight: nil, seconds: 10)
        )

        XCTAssertNil(model.restState)
        XCTAssertTrue(model.workout?.exercises[0].loggedSets.isEmpty == true)

        await model.log(
            exerciseID: exercise.id,
            prescriptionID: prescription.id,
            input: .repetitions(weight: nil, repetitions: 8)
        )

        let persisted = try await repository.workout(id: workout.id)
        XCTAssertEqual(persisted?.exercises[0].loggedSets.count, 1)
        XCTAssertEqual(model.restState?.exerciseID, exercise.id)
        XCTAssertEqual(model.restState?.exerciseName, exercise.nameSnapshot)
    }

    func testFirstSetPersistenceUsesTheSameRestPath() async throws {
        let repository = makeRepository()
        let first = WorkoutExercise(
            id: .new(),
            exerciseID: .new(),
            nameSnapshot: "Unprescribed Exercise",
            prescriptions: [],
            loggedSets: [],
            restDuration: nil,
            skippedAt: nil
        )
        let next = EquilibriumFixtures.ready(id: "phase4-first-set-source").exercises[0]
        let workout = Workout(
            id: .init(rawValue: "phase4-first-set"),
            titleSnapshot: "First set",
            exercises: [first, next],
            status: .ready,
            startedAt: nil,
            completedAt: nil,
            createdAt: EquilibriumFixtures.timestamp,
            updatedAt: EquilibriumFixtures.timestamp
        )
        try await repository.create(workout)
        try await repository.saveDefaultRestDuration(95)
        let model = WorkoutExecutionModel(workoutID: workout.id, repository: repository, defaultRestDuration: 95)
        await model.activate()

        await model.logFirstSet(
            exerciseID: first.id,
            input: .repetitions(weight: nil, repetitions: 8)
        )

        let persisted = try await repository.workout(id: workout.id)
        XCTAssertEqual(persisted?.exercises[0].prescriptions.count, 1)
        XCTAssertEqual(persisted?.exercises[0].loggedSets.count, 1)
        XCTAssertEqual(model.restState?.totalDuration, 95)
        XCTAssertEqual(model.restState?.exerciseID, first.id)
    }

    func testRestDurationUsesExerciseOverrideOtherwiseGlobalDefault() async throws {
        let repository = makeRepository()
        var overridden = EquilibriumFixtures.mixed(id: "phase4-rest-override")
        overridden.exercises[0].restDuration = 75
        var defaulted = EquilibriumFixtures.mixed(id: "phase4-rest-default")
        defaulted.exercises[0].restDuration = nil
        try await repository.materializeAtomically([overridden, defaulted])
        try await repository.saveDefaultRestDuration(95)
        try await repository.saveExerciseRestDuration(75, for: overridden.exercises[0].exerciseID)

        let overrideModel = WorkoutExecutionModel(
            workoutID: overridden.id,
            repository: repository,
            defaultRestDuration: 95
        )
        await overrideModel.activate()
        await overrideModel.log(
            exerciseID: overridden.exercises[0].id,
            prescriptionID: overridden.exercises[0].prescriptions[0].id,
            input: .repetitions(weight: nil, repetitions: 8)
        )
        try await repository.saveExerciseRestDuration(nil, for: overridden.exercises[0].exerciseID)

        let defaultModel = WorkoutExecutionModel(
            workoutID: defaulted.id,
            repository: repository,
            defaultRestDuration: 95
        )
        await defaultModel.activate()
        await defaultModel.log(
            exerciseID: defaulted.exercises[0].id,
            prescriptionID: defaulted.exercises[0].prescriptions[0].id,
            input: .repetitions(weight: nil, repetitions: 8)
        )

        XCTAssertEqual(overrideModel.restState?.totalDuration, 75)
        XCTAssertEqual(defaultModel.restState?.totalDuration, 95)
    }

    func testSkippingRestReturnsToTheCanonicalNextSetWithoutPersistingAgain() async throws {
        let repository = makeRepository()
        let workout = EquilibriumFixtures.mixed(id: "phase4-rest-skip")
        let sessions = WorkoutRestSessionStore()
        try await repository.create(workout)
        let model = WorkoutExecutionModel(
            workoutID: workout.id,
            repository: repository,
            restSessionStore: sessions
        )
        await model.activate()

        await model.log(
            exerciseID: workout.exercises[0].id,
            prescriptionID: workout.exercises[0].prescriptions[0].id,
            input: .repetitions(weight: nil, repetitions: 8)
        )
        model.skipRest()

        let persisted = try await repository.workout(id: workout.id)
        XCTAssertNil(model.restState)
        XCTAssertNil(sessions.activeSession)
        XCTAssertEqual(model.currentExercise?.id, workout.exercises[0].id)
        XCTAssertEqual(model.currentPrescription?.id, workout.exercises[0].prescriptions[1].id)
        XCTAssertEqual(persisted?.exercises[0].loggedSets.count, 1)
    }

    func testNaturalRestCompletionReturnsToCanonicalStateAndClearsDeadline() async throws {
        let repository = makeRepository()
        let workout = EquilibriumFixtures.mixed(id: "phase4-rest-natural-completion")
        let sessions = WorkoutRestSessionStore()
        var wallClock = Date(timeIntervalSince1970: 10_000)
        try await repository.create(workout)
        let model = WorkoutExecutionModel(
            workoutID: workout.id,
            repository: repository,
            now: { wallClock },
            restSessionStore: sessions
        )
        await model.activate()
        await model.log(
            exerciseID: workout.exercises[0].id,
            prescriptionID: workout.exercises[0].prescriptions[0].id,
            input: .repetitions(weight: nil, repetitions: 8)
        )

        wallClock = wallClock.addingTimeInterval(121)
        model.refreshRest(at: wallClock)

        XCTAssertNil(model.restState)
        XCTAssertNil(sessions.activeSession)
        XCTAssertEqual(model.timer.state, .completed)
        XCTAssertEqual(model.currentExercise?.id, workout.exercises[0].id)
        XCTAssertEqual(model.currentPrescription?.id, workout.exercises[0].prescriptions[1].id)
    }

    func testEditingCompletedSetDoesNotRestartRest() async throws {
        let repository = makeRepository()
        let workout = EquilibriumFixtures.mixed(id: "phase4-rest-edit-completed")
        try await repository.create(workout)
        let model = WorkoutExecutionModel(workoutID: workout.id, repository: repository)
        await model.activate()
        let exercise = workout.exercises[0]
        let prescription = exercise.prescriptions[0]

        await model.log(
            exerciseID: exercise.id,
            prescriptionID: prescription.id,
            input: .repetitions(weight: nil, repetitions: 8)
        )
        model.skipRest()
        await model.log(
            exerciseID: exercise.id,
            prescriptionID: prescription.id,
            input: .repetitions(weight: nil, repetitions: 10)
        )

        let persisted = try await repository.workout(id: workout.id)
        XCTAssertNil(model.restState)
        XCTAssertEqual(persisted?.exercises[0].loggedSets.count, 1)
        XCTAssertEqual(persisted?.exercises[0].loggedSets[0].repetitions, 10)
    }

    func testFinalWorkoutSetSuppressesRestAndCompletesWorkout() async throws {
        let repository = makeRepository()
        let workout = EquilibriumFixtures.ready(id: "phase4-final-set")
        let sessions = WorkoutRestSessionStore()
        try await repository.create(workout)
        let model = WorkoutExecutionModel(
            workoutID: workout.id,
            repository: repository,
            restSessionStore: sessions
        )
        await model.activate()

        for (index, prescription) in workout.exercises[0].prescriptions.enumerated() {
            await model.log(
                exerciseID: workout.exercises[0].id,
                prescriptionID: prescription.id,
                input: .repetitions(weight: nil, repetitions: 8)
            )
            if index < workout.exercises[0].prescriptions.count - 1 { model.skipRest() }
        }

        XCTAssertEqual(model.workout?.status, .completed)
        XCTAssertTrue(model.didAutoComplete)
        XCTAssertNil(model.restState)
        XCTAssertNil(sessions.activeSession)
    }

    func testForegroundLifecycleReconcilesRestFromWallClockDeadline() async throws {
        let repository = makeRepository()
        let workout = EquilibriumFixtures.mixed(id: "phase4-rest-lifecycle")
        let sessions = WorkoutRestSessionStore()
        var wallClock = Date(timeIntervalSince1970: 20_000)
        let countdownClock: TimeInterval = 0
        let timer = CountdownTimer(now: { countdownClock })
        try await repository.create(workout)
        try await repository.saveExerciseRestDuration(120, for: workout.exercises[0].exerciseID)
        let model = WorkoutExecutionModel(
            workoutID: workout.id,
            repository: repository,
            now: { wallClock },
            timer: timer,
            restSessionStore: sessions
        )
        await model.activate()
        await model.log(
            exerciseID: workout.exercises[0].id,
            prescriptionID: workout.exercises[0].prescriptions[0].id,
            input: .repetitions(weight: nil, repetitions: 8)
        )

        wallClock = wallClock.addingTimeInterval(45)
        model.refreshRest(at: wallClock)
        XCTAssertEqual(try XCTUnwrap(model.restState?.remaining), 75, accuracy: 0.001)

        wallClock = wallClock.addingTimeInterval(76)
        model.refreshRest(at: wallClock)
        XCTAssertNil(model.restState)
        XCTAssertNil(sessions.activeSession)
        XCTAssertEqual(timer.state, .completed)
    }

    func testCanonicalRefreshSuppressesRetainedRestWhenWorkoutCanComplete() async throws {
        let repository = makeRepository()
        let workout = EquilibriumFixtures.mixed(id: "phase4-rest-canonical-completion")
        let sessions = WorkoutRestSessionStore()
        try await repository.create(workout)
        let model = WorkoutExecutionModel(
            workoutID: workout.id,
            repository: repository,
            restSessionStore: sessions
        )
        await model.activate()
        await model.log(
            exerciseID: workout.exercises[0].id,
            prescriptionID: workout.exercises[0].prescriptions[0].id,
            input: .repetitions(weight: nil, repetitions: 8)
        )
        XCTAssertNotNil(model.restState)

        for exercise in workout.exercises {
            let alreadyCompleted = Set(
                (try await repository.workout(id: workout.id))?
                    .exercises.first(where: { $0.id == exercise.id })?
                    .loggedSets.compactMap(\.prescriptionID) ?? []
            )
            for prescription in exercise.prescriptions where !alreadyCompleted.contains(prescription.id) {
                let input: SetLogInput
                switch prescription.target {
                case .repetitions: input = .repetitions(weight: nil, repetitions: 8)
                case .duration: input = .duration(weight: nil, seconds: 30)
                }
                _ = try await repository.logSet(
                    workoutID: workout.id,
                    exerciseID: exercise.id,
                    prescriptionID: prescription.id,
                    input: input,
                    completed: true,
                    at: .now
                )
            }
        }

        await model.refreshFromPersistence()

        XCTAssertTrue(model.canComplete)
        XCTAssertNil(model.restState)
        XCTAssertNil(sessions.activeSession)
    }

    func testPartialExerciseRestReturnsToSameFocusedExerciseAndNextSet() async throws {
        let repository = makeRepository()
        let workout = EquilibriumFixtures.mixed(id: "phase41-partial")
        try await repository.create(workout)
        let model = WorkoutExecutionModel(workoutID: workout.id, repository: repository)
        let presentation = ExecutionWalletPresentation(initialMode: .focusedExercise)
        await model.activate()

        await model.log(
            exerciseID: workout.exercises[0].id,
            prescriptionID: workout.exercises[0].prescriptions[0].id,
            input: .repetitions(weight: nil, repetitions: 8)
        )

        XCTAssertFalse(try XCTUnwrap(model.restState).completesExercise)
        XCTAssertFalse(model.awaitsExerciseSelection)
        XCTAssertFalse(presentation.synchronize(
            with: model.foregroundState,
            awaitsExerciseSelection: model.awaitsExerciseSelection
        ))
        model.skipRest()
        _ = presentation.synchronize(
            with: model.foregroundState,
            awaitsExerciseSelection: model.awaitsExerciseSelection
        )

        XCTAssertEqual(presentation.mode, .focusedExercise)
        XCTAssertEqual(model.currentExercise?.id, workout.exercises[0].id)
        XCTAssertEqual(model.currentPrescription?.id, workout.exercises[0].prescriptions[1].id)
    }

    func testFinalExerciseSetSkipRestMinimizesWithoutFocusingNextExercise() async throws {
        let repository = makeRepository()
        let workout = EquilibriumFixtures.mixed(id: "phase41-final-skip")
        try await repository.create(workout)
        let model = WorkoutExecutionModel(workoutID: workout.id, repository: repository)
        let presentation = ExecutionWalletPresentation(initialMode: .focusedExercise)
        await model.activate()

        for (index, prescription) in workout.exercises[0].prescriptions.enumerated() {
            await model.log(
                exerciseID: workout.exercises[0].id,
                prescriptionID: prescription.id,
                input: .repetitions(weight: nil, repetitions: 8)
            )
            if index < workout.exercises[0].prescriptions.count - 1 { model.skipRest() }
        }

        XCTAssertTrue(try XCTUnwrap(model.restState).completesExercise)
        XCTAssertFalse(model.awaitsExerciseSelection)
        _ = presentation.synchronize(
            with: model.foregroundState,
            awaitsExerciseSelection: model.awaitsExerciseSelection
        )
        model.skipRest()
        XCTAssertTrue(presentation.synchronize(
            with: model.foregroundState,
            awaitsExerciseSelection: model.awaitsExerciseSelection
        ))

        XCTAssertEqual(presentation.mode, .exerciseOverview)
        XCTAssertTrue(model.awaitsExerciseSelection)
        XCTAssertNil(model.focusedExerciseID)
        XCTAssertEqual(model.currentExercise?.id, workout.exercises[1].id)
        XCTAssertTrue(WorkoutExecutionQuery.isComplete(try XCTUnwrap(model.exercise(id: workout.exercises[0].id))))
    }

    func testFinalExerciseSetNaturalRestCompletionUsesSameMinimizationPath() async throws {
        let repository = makeRepository()
        let workout = EquilibriumFixtures.mixed(id: "phase41-final-natural")
        var wallClock = Date(timeIntervalSince1970: 30_000)
        try await repository.create(workout)
        let model = WorkoutExecutionModel(workoutID: workout.id, repository: repository, now: { wallClock })
        let presentation = ExecutionWalletPresentation(initialMode: .focusedExercise)
        await model.activate()

        for (index, prescription) in workout.exercises[0].prescriptions.enumerated() {
            await model.log(
                exerciseID: workout.exercises[0].id,
                prescriptionID: prescription.id,
                input: .repetitions(weight: nil, repetitions: 8)
            )
            if index < workout.exercises[0].prescriptions.count - 1 { model.skipRest() }
        }
        _ = presentation.synchronize(
            with: model.foregroundState,
            awaitsExerciseSelection: model.awaitsExerciseSelection
        )
        wallClock = wallClock.addingTimeInterval(121)
        model.refreshRest(at: wallClock)
        _ = presentation.synchronize(
            with: model.foregroundState,
            awaitsExerciseSelection: model.awaitsExerciseSelection
        )

        XCTAssertNil(model.restState)
        XCTAssertTrue(model.awaitsExerciseSelection)
        XCTAssertEqual(presentation.mode, .exerciseOverview)
        XCTAssertNil(model.focusedExerciseID)
    }

    func testFinalExerciseSetUsesGlobalRestBeforeShowingOverview() async throws {
        let repository = makeRepository()
        var workout = EquilibriumFixtures.mixed(id: "phase41-final-no-rest")
        workout.exercises[0].restDuration = nil
        try await repository.create(workout)
        let model = WorkoutExecutionModel(
            workoutID: workout.id,
            repository: repository,
            defaultRestDuration: 90
        )
        let presentation = ExecutionWalletPresentation(initialMode: .focusedExercise)
        await model.activate()

        for prescription in workout.exercises[0].prescriptions {
            await model.log(
                exerciseID: workout.exercises[0].id,
                prescriptionID: prescription.id,
                input: .repetitions(weight: nil, repetitions: 8)
            )
        }
        _ = presentation.synchronize(
            with: model.foregroundState,
            awaitsExerciseSelection: model.awaitsExerciseSelection
        )

        XCTAssertEqual(model.restState?.totalDuration, 90)
        XCTAssertFalse(model.awaitsExerciseSelection)
        XCTAssertEqual(presentation.mode, .focusedExercise)

        model.skipRest()
        _ = presentation.synchronize(
            with: model.foregroundState,
            awaitsExerciseSelection: model.awaitsExerciseSelection
        )
        XCTAssertTrue(model.awaitsExerciseSelection)
        XCTAssertEqual(presentation.mode, .exerciseOverview)
        XCTAssertNil(model.focusedExerciseID)
    }

    func testExplicitSelectionAfterExerciseCompletionCanChooseAnyRemainingExercise() async throws {
        let repository = makeRepository()
        let workout = EquilibriumFixtures.midWorkout(id: "phase41-explicit-selection")
        try await repository.create(workout)
        let model = WorkoutExecutionModel(workoutID: workout.id, repository: repository)
        let presentation = ExecutionWalletPresentation(initialMode: .focusedExercise)
        await model.activate()
        let completingExercise = workout.exercises[1]

        for prescription in completingExercise.prescriptions.dropFirst() {
            await model.log(
                exerciseID: completingExercise.id,
                prescriptionID: prescription.id,
                input: .repetitions(weight: nil, repetitions: 8)
            )
            if prescription != completingExercise.prescriptions.last { model.skipRest() }
        }
        model.skipRest()
        _ = presentation.synchronize(
            with: model.foregroundState,
            awaitsExerciseSelection: model.awaitsExerciseSelection
        )
        let chosen = workout.exercises[3]
        XCTAssertTrue(presentation.selectExercise(chosen.id, focus: model.focus))

        XCTAssertFalse(model.awaitsExerciseSelection)
        XCTAssertEqual(model.focusedExerciseID, chosen.id)
        XCTAssertEqual(model.currentExercise?.id, chosen.id)
        XCTAssertEqual(presentation.mode, .focusedExercise)
    }

    func testAwaitingSelectionAndCanonicalProgressSurviveRepositoryRefresh() async throws {
        let repository = makeRepository()
        let workout = EquilibriumFixtures.mixed(id: "phase41-refresh")
        try await repository.create(workout)
        let model = WorkoutExecutionModel(workoutID: workout.id, repository: repository)
        await model.activate()

        for (index, prescription) in workout.exercises[0].prescriptions.enumerated() {
            await model.log(
                exerciseID: workout.exercises[0].id,
                prescriptionID: prescription.id,
                input: .repetitions(weight: nil, repetitions: 8)
            )
            if index < workout.exercises[0].prescriptions.count - 1 { model.skipRest() }
        }
        model.skipRest()
        let progressBeforeRefresh = model.progress

        await model.refreshFromPersistence()

        XCTAssertEqual(model.progress, progressBeforeRefresh)
        XCTAssertTrue(model.awaitsExerciseSelection)
        XCTAssertNil(model.focusedExerciseID)
        XCTAssertEqual(model.exercise(id: workout.exercises[0].id)?.loggedSets.count, 3)
        XCTAssertEqual(model.currentExercise?.id, workout.exercises[1].id)
    }

    private func makeRepository() -> SwiftDataRepository {
        SwiftDataRepository(container: try! PersistenceController.makeContainer(inMemory: true))
    }
}

@MainActor
final class ExecutionWalletMotionPhase42Tests: XCTestCase {
    func testTimedSequenceKeepsOneFocusedCardAcrossReadyWorkAndRest() {
        let presentation = ExecutionWalletPresentation(initialMode: .focusedExercise)

        XCTAssertEqual(
            presentation.resolvedState(for: .exercise),
            .focusedExercise
        )

        XCTAssertFalse(presentation.synchronize(with: .work, awaitsExerciseSelection: false))
        XCTAssertEqual(
            presentation.resolvedState(for: .work),
            .focusedWork
        )

        XCTAssertFalse(presentation.synchronize(with: .rest, awaitsExerciseSelection: false))
        XCTAssertEqual(
            presentation.resolvedState(for: .rest),
            .focusedRest
        )
        XCTAssertEqual(presentation.mode, .focusedExercise)
    }

    func testPartialRestCompletionReturnsToFocusedExercisePresentation() {
        let presentation = ExecutionWalletPresentation(initialMode: .exerciseOverview)

        XCTAssertTrue(presentation.synchronize(with: .rest, awaitsExerciseSelection: false))
        XCTAssertEqual(presentation.resolvedState(for: .rest), .focusedRest)

        XCTAssertFalse(presentation.synchronize(with: .exercise, awaitsExerciseSelection: false))
        XCTAssertEqual(presentation.resolvedState(for: .exercise), .focusedExercise)
    }

    func testFinalExerciseRestCompletionResolvesToOverviewPresentation() {
        let presentation = ExecutionWalletPresentation(initialMode: .focusedExercise)

        XCTAssertFalse(presentation.synchronize(with: .rest, awaitsExerciseSelection: false))
        XCTAssertEqual(presentation.resolvedState(for: .rest), .focusedRest)

        XCTAssertTrue(presentation.synchronize(with: .exercise, awaitsExerciseSelection: true))
        XCTAssertEqual(presentation.resolvedState(for: .exercise, awaitsExerciseSelection: true), .exerciseOverview)
        XCTAssertEqual(presentation.mode, .exerciseOverview)
    }

    func testOverviewSelectionReturnsToFocusedExerciseWithoutIntermediateVisualState() {
        let presentation = ExecutionWalletPresentation(initialMode: .exerciseOverview)
        let selectedID = WorkoutExerciseID(rawValue: "phase42-selected")
        var focusedID: WorkoutExerciseID?

        XCTAssertTrue(presentation.selectExercise(selectedID) { focusedID = $0 })

        XCTAssertEqual(focusedID, selectedID)
        XCTAssertEqual(presentation.resolvedState(for: .exercise), .focusedExercise)
        XCTAssertEqual(presentation.mode, .focusedExercise)
    }

    func testAwaitingSelectionOverridesStaleFocusedMode() {
        let presentation = ExecutionWalletPresentation(initialMode: .focusedExercise)

        XCTAssertEqual(
            presentation.resolvedState(for: .exercise, awaitsExerciseSelection: true),
            .exerciseOverview
        )
    }
}
