import XCTest
import SwiftData
import SwiftUI
@testable import Equilibrium

@MainActor
final class WorkoutExecutionRepositoryTests: XCTestCase {
    private func repository() throws -> SwiftDataRepository { SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true)) }

    func testPlannedStartsWithTimestampAndInProgressResumesWithoutChangingIt() async throws {
        let repository = try repository()
        let ready = EquilibriumFixtures.ready(id: "start-resume")
        try await repository.create(ready)
        let start = Date(timeIntervalSince1970: 2_000)
        let started = try await repository.startWorkout(id: ready.id, at: start)
        XCTAssertEqual(started.status, .inProgress)
        XCTAssertEqual(started.startedAt, start)
        let resumed = try await repository.startWorkout(id: ready.id, at: start.addingTimeInterval(100))
        XCTAssertEqual(resumed.startedAt, start)
    }

    func testRepetitionLoggingSupportsOptionalWeightAndUpdatesSameCanonicalSet() async throws {
        let repository = try repository()
        let fixture = EquilibriumFixtures.ready(id: "rep-log")
        try await repository.create(fixture)
        _ = try await repository.startWorkout(id: fixture.id, at: .init(timeIntervalSince1970: 10))
        let exercise = fixture.exercises[0], prescription = exercise.prescriptions[0]
        let first = try await repository.logSet(workoutID: fixture.id, exerciseID: exercise.id, prescriptionID: prescription.id, input: .repetitions(weight: nil, repetitions: 8), completed: true, at: .init(timeIntervalSince1970: 20))
        XCTAssertNil(first.exercises[0].loggedSets[0].weight)
        XCTAssertEqual(first.exercises[0].loggedSets[0].repetitions, 8)
        let originalID = first.exercises[0].loggedSets[0].id
        let edited = try await repository.logSet(workoutID: fixture.id, exerciseID: exercise.id, prescriptionID: prescription.id, input: .repetitions(weight: .init(pounds: 135), repetitions: 10), completed: true, at: .init(timeIntervalSince1970: 30))
        XCTAssertEqual(edited.exercises[0].loggedSets[0].id, originalID)
        XCTAssertEqual(edited.exercises[0].loggedSets[0].weight?.pounds, 135)
    }

    func testDurationLoggingAndPrescriptionValidation() async throws {
        let repository = try repository()
        let fixture = EquilibriumFixtures.mixed(id: "duration-log")
        try await repository.create(fixture)
        _ = try await repository.startWorkout(id: fixture.id, at: .init(timeIntervalSince1970: 10))
        let exercise = fixture.exercises[1], prescription = exercise.prescriptions[0]
        let updated = try await repository.logSet(workoutID: fixture.id, exerciseID: exercise.id, prescriptionID: prescription.id, input: .duration(weight: nil, seconds: 52), completed: true, at: .init(timeIntervalSince1970: 20))
        XCTAssertEqual(updated.exercises[1].loggedSets[0].duration, 52)
        do {
            _ = try await repository.logSet(workoutID: fixture.id, exerciseID: exercise.id, prescriptionID: prescription.id, input: .repetitions(weight: nil, repetitions: 10), completed: true, at: .now)
            XCTFail("Expected target mismatch")
        } catch { XCTAssertEqual(error as? RepositoryError, .invalidSetInput) }
    }

    func testExerciseStateAndProgressAreDerivedWithTransientFocus() {
        let workout = EquilibriumFixtures.midWorkout(id: "derived")
        let states = WorkoutExecutionQuery.states(in: workout)
        XCTAssertEqual(states[workout.exercises[0].id], .completed)
        XCTAssertEqual(states[workout.exercises[1].id], .current)
        XCTAssertEqual(states[workout.exercises[2].id], .upcoming)
        let progress = WorkoutExecutionQuery.progress(in: workout)
        XCTAssertEqual(progress.completedSetCount, 4)
        XCTAssertEqual(progress.requiredSetCount, 10)
        XCTAssertEqual(WorkoutExecutionQuery.states(in: workout, focusedExerciseID: workout.exercises[0].id)[workout.exercises[0].id], .current)
    }

    func testSkippedExercisePolicyIsDeterministicEvenWithoutPhase2SkipUI() {
        var workout = EquilibriumFixtures.mixed(id: "skip-policy")
        workout.exercises[1].skippedAt = EquilibriumFixtures.timestamp
        XCTAssertTrue(WorkoutExecutionQuery.isComplete(workout.exercises[1]))
        XCTAssertEqual(WorkoutExecutionQuery.progress(in: workout).requiredSetCount, 3)
    }

    func testCompletionValidatesAtomicallyAndCompletedWorkoutIsImmutable() async throws {
        let repository = try repository()
        let fixture = EquilibriumFixtures.ready(id: "complete")
        try await repository.create(fixture)
        _ = try await repository.startWorkout(id: fixture.id, at: .init(timeIntervalSince1970: 10))
        do { _ = try await repository.completeWorkout(id: fixture.id, at: .init(timeIntervalSince1970: 20)); XCTFail("Expected incomplete") }
        catch { XCTAssertEqual(error as? RepositoryError, .incompleteWorkout) }
        for prescription in fixture.exercises[0].prescriptions {
            _ = try await repository.logSet(workoutID: fixture.id, exerciseID: fixture.exercises[0].id, prescriptionID: prescription.id, input: .repetitions(weight: nil, repetitions: 8), completed: true, at: .init(timeIntervalSince1970: 20))
        }
        let completedAt = Date(timeIntervalSince1970: 30)
        let completed = try await repository.completeWorkout(id: fixture.id, at: completedAt)
        XCTAssertEqual(completed.status, .completed)
        XCTAssertEqual(completed.startedAt, .init(timeIntervalSince1970: 10))
        XCTAssertEqual(completed.completedAt, completedAt)
        do { try await repository.update(completed); XCTFail("Expected immutability") }
        catch { XCTAssertEqual(error as? RepositoryError, .immutableCompletedWorkout) }
        do { _ = try await repository.logSet(workoutID: fixture.id, exerciseID: fixture.exercises[0].id, prescriptionID: fixture.exercises[0].prescriptions[0].id, input: .repetitions(weight: nil, repetitions: 9), completed: true, at: .now); XCTFail("Expected immutability") }
        catch { XCTAssertEqual(error as? RepositoryError, .immutableCompletedWorkout) }
    }

    func testCommandPersistenceSurvivesRepositoryAndContainerRecreation() async throws {
        let url = TestSupport.temporaryStoreURL()
        var container: ModelContainer? = try PersistenceController.makeContainer(storageURL: url)
        var repository: SwiftDataRepository? = SwiftDataRepository(container: container!)
        let fixture = EquilibriumFixtures.ready(id: "command-relaunch")
        try await repository!.create(fixture)
        _ = try await repository!.startWorkout(id: fixture.id, at: .init(timeIntervalSince1970: 10))
        _ = try await repository!.logSet(workoutID: fixture.id, exerciseID: fixture.exercises[0].id, prescriptionID: fixture.exercises[0].prescriptions[0].id, input: .repetitions(weight: .init(pounds: 95), repetitions: 11), completed: true, at: .init(timeIntervalSince1970: 20))
        repository = nil; container = nil
        let reopened = try PersistenceController.makeContainer(storageURL: url)
        let reopenedValue = try await SwiftDataRepository(container: reopened).workout(id: fixture.id)
        let loaded = try XCTUnwrap(reopenedValue)
        XCTAssertEqual(loaded.status, .inProgress)
        XCTAssertEqual(loaded.exercises[0].loggedSets[0].repetitions, 11)
    }

    func testWorkoutChildAndLoggedSetIDsAreGloballyUnique() async throws {
        let repository = try repository()
        let first = EquilibriumFixtures.ready(id: "unique-a")
        let second = EquilibriumFixtures.ready(id: "unique-b")
        try await repository.materializeAtomically([first, second])
        _ = try await repository.startWorkout(id: first.id, at: .now)
        _ = try await repository.startWorkout(id: second.id, at: .now)
        let a = try await repository.logSet(workoutID: first.id, exerciseID: first.exercises[0].id, prescriptionID: first.exercises[0].prescriptions[0].id, input: .repetitions(weight: nil, repetitions: 8), completed: true, at: .now)
        let b = try await repository.logSet(workoutID: second.id, exerciseID: second.exercises[0].id, prescriptionID: second.exercises[0].prescriptions[0].id, input: .repetitions(weight: nil, repetitions: 8), completed: true, at: .now)
        XCTAssertNotEqual(a.exercises[0].id, b.exercises[0].id)
        XCTAssertNotEqual(a.exercises[0].prescriptions[0].id, b.exercises[0].prescriptions[0].id)
        XCTAssertNotEqual(a.exercises[0].loggedSets[0].id, b.exercises[0].loggedSets[0].id)
    }

    func testWeightUnitRoundTripAndTextValues() throws {
        let pounds = Weight(100, unit: .kilograms)
        XCTAssertEqual(pounds.value(in: .kilograms), 100, accuracy: 0.000_001)
        let text = WeightText.value(pounds, unit: .kilograms)
        XCTAssertEqual(text, "100")
        XCTAssertEqual(try XCTUnwrap(WeightText.weight(from: text, unit: .kilograms)).value(in: .kilograms), 100, accuracy: 0.000_001)
        XCTAssertNil(WeightText.weight(from: "", unit: .pounds))
    }

    func testWorkoutCanExecuteLongAfterCreation() async throws {
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        var workout = EquilibriumFixtures.ready(id: "old-eligible")
        workout.createdAt = .init(timeIntervalSince1970: 1)
        try await repository.create(workout)
        let started = try await repository.startWorkout(id: workout.id, at: .init(timeIntervalSince1970: 9_999_999))
        XCTAssertEqual(started.status, .inProgress)
    }
}

@MainActor
final class ExerciseSettingsPhase5Tests: XCTestCase {
    private func repository() throws -> SwiftDataRepository {
        SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
    }

    func testOpeningAndDismissingSettingsPreservesWorkoutExerciseSetAndExpandedWallet() async throws {
        let repository = try repository()
        let fixture = EquilibriumFixtures.midWorkout(id: "phase5-presentation")
        try await repository.create(fixture)
        let model = WorkoutExecutionModel(workoutID: fixture.id, repository: repository)
        await model.activate()
        let exercise = fixture.exercises[1]
        model.focus(exercise.id)
        model.selectSet(at: 1)
        let selectedSetID = try XCTUnwrap(model.currentPrescription?.id)
        let wallet = ExecutionWalletPresentation(initialMode: .focusedExercise)
        let settings = ExerciseSettingsPresentation()

        settings.present(exerciseID: exercise.id)
        XCTAssertEqual(settings.exerciseID, exercise.id)
        XCTAssertEqual(model.workout?.id, fixture.id)
        XCTAssertEqual(model.focusedExerciseID, exercise.id)
        XCTAssertEqual(model.currentPrescription?.id, selectedSetID)
        XCTAssertEqual(wallet.mode, .focusedExercise)

        settings.dismiss()
        XCTAssertNil(settings.exerciseID)
        XCTAssertEqual(model.workout?.id, fixture.id)
        XCTAssertEqual(model.focusedExerciseID, exercise.id)
        XCTAssertEqual(model.currentPrescription?.id, selectedSetID)
        XCTAssertEqual(wallet.mode, .focusedExercise)
    }

    func testRestInheritanceOverrideAllSetsAndActiveCountdownSnapshot() async throws {
        let repository = try repository()
        let fixture = EquilibriumFixtures.mixed(id: "phase5-rest")
        try await repository.create(fixture)
        try await repository.saveDefaultRestDuration(120)
        let model = WorkoutExecutionModel(
            workoutID: fixture.id,
            repository: repository,
            defaultRestDuration: 90
        )
        await model.activate()
        let exercise = fixture.exercises[0]
        let inheritingExercise = fixture.exercises[1]

        XCTAssertEqual(model.effectiveRestDuration(for: exercise.id), 120)
        XCTAssertEqual(model.effectiveRestDuration(for: inheritingExercise.id), 120)

        let savedOverride = await model.setExerciseRestDuration(exerciseID: exercise.id, seconds: 90)
        XCTAssertTrue(savedOverride)
        XCTAssertEqual(model.effectiveRestDuration(for: exercise.id), 90)
        let persistedOverride = try await repository.exerciseRestDuration(for: exercise.exerciseID)
        let persistedWorkout = try await repository.workout(id: fixture.id)
        XCTAssertEqual(persistedOverride, 90)
        XCTAssertEqual(persistedWorkout?.exercises[0].restDuration, fixture.exercises[0].restDuration)

        let changedGlobal = await model.setGlobalRestDuration(150)
        XCTAssertTrue(changedGlobal)
        XCTAssertEqual(model.effectiveRestDuration(for: exercise.id), 90)
        XCTAssertEqual(model.effectiveRestDuration(for: inheritingExercise.id), 150)

        await model.log(
            exerciseID: exercise.id,
            prescriptionID: exercise.prescriptions[0].id,
            input: .repetitions(weight: nil, repetitions: 8)
        )
        XCTAssertEqual(model.restState?.totalDuration, 90)

        let changedOverride = await model.setExerciseRestDuration(exerciseID: exercise.id, seconds: 120)
        XCTAssertTrue(changedOverride)
        XCTAssertEqual(model.restState?.totalDuration, 90)

        model.skipRest()
        await model.log(
            exerciseID: exercise.id,
            prescriptionID: exercise.prescriptions[1].id,
            input: .repetitions(weight: nil, repetitions: 8)
        )
        XCTAssertEqual(model.restState?.totalDuration, 120)

        let resetOverride = await model.setExerciseRestDuration(exerciseID: exercise.id, seconds: nil)
        XCTAssertTrue(resetOverride)
        XCTAssertEqual(model.restState?.totalDuration, 120)
        XCTAssertEqual(model.effectiveRestDuration(for: exercise.id), 150)
        let removedOverride = try await repository.exerciseRestDuration(for: exercise.exerciseID)
        XCTAssertNil(removedOverride)
        model.skipRest()
    }

    func testExerciseRestOverridePersistsAcrossWorkoutOccurrencesByStableExerciseID() async throws {
        let repository = try repository()
        let first = EquilibriumFixtures.mixed(id: "phase5-rest-first")
        var second = EquilibriumFixtures.mixed(id: "phase5-rest-second")
        let secondOccurrence = second.exercises[0]
        second.exercises[0] = WorkoutExercise(
            id: secondOccurrence.id,
            exerciseID: first.exercises[0].exerciseID,
            nameSnapshot: secondOccurrence.nameSnapshot,
            prescriptions: secondOccurrence.prescriptions,
            loggedSets: secondOccurrence.loggedSets,
            restDuration: secondOccurrence.restDuration,
            skippedAt: secondOccurrence.skippedAt,
            isTimeBased: secondOccurrence.isTimeBased,
            isTwoSided: secondOccurrence.isTwoSided
        )
        try await repository.materializeAtomically([first, second])
        try await repository.saveDefaultRestDuration(120)

        let firstModel = WorkoutExecutionModel(workoutID: first.id, repository: repository)
        await firstModel.activate()
        let saved = await firstModel.setExerciseRestDuration(exerciseID: first.exercises[0].id, seconds: 90)
        XCTAssertTrue(saved)

        let secondModel = WorkoutExecutionModel(workoutID: second.id, repository: repository)
        await secondModel.activate()
        XCTAssertEqual(secondModel.effectiveRestDuration(for: second.exercises[0].id), 90)
        XCTAssertEqual(secondModel.effectiveRestDuration(for: second.exercises[1].id), 120)

        try await repository.saveDefaultRestDuration(150)
        await secondModel.refreshRestPreferences()
        XCTAssertEqual(secondModel.effectiveRestDuration(for: second.exercises[0].id), 90)
        XCTAssertEqual(secondModel.effectiveRestDuration(for: second.exercises[1].id), 150)
    }

    func testSkipPreservesOccurrenceAndReturnsExpandedWalletToOverviewWithoutAutoFocus() async throws {
        let repository = try repository()
        let fixture = EquilibriumFixtures.midWorkout(id: "phase5-skip")
        try await repository.create(fixture)
        let model = WorkoutExecutionModel(workoutID: fixture.id, repository: repository)
        await model.activate()
        let focusedID = fixture.exercises[1].id
        model.focus(focusedID)
        let originalCount = try XCTUnwrap(model.workout).exercises.count
        let wallet = ExecutionWalletPresentation(initialMode: .focusedExercise)

        let didSkip = await model.skipExercise(focusedID)
        XCTAssertTrue(didSkip)
        let persistedValue = try await repository.workout(id: fixture.id)
        let persisted = try XCTUnwrap(persistedValue)
        XCTAssertEqual(persisted.exercises.count, originalCount)
        XCTAssertNotNil(persisted.exercises.first(where: { $0.id == focusedID })?.skippedAt)
        XCTAssertNil(model.focusedExerciseID)
        XCTAssertTrue(model.awaitsExerciseSelection)

        XCTAssertTrue(wallet.synchronize(
            with: model.foregroundState,
            awaitsExerciseSelection: model.awaitsExerciseSelection
        ))
        XCTAssertEqual(wallet.mode, .exerciseOverview)
        XCTAssertNil(model.focusedExerciseID, "Skipping must not automatically focus the next exercise")
    }

    func testSkippedOccurrenceIsExcludedFromExposureProgressionAndPersonalRecords() throws {
        var included = EquilibriumFixtures.completed(id: "phase5-included")
        included.completedAt = Date(timeIntervalSince1970: 100)
        included.updatedAt = included.completedAt!
        var skipped = EquilibriumFixtures.completed(id: "phase5-skipped")
        skipped.completedAt = Date(timeIntervalSince1970: 200)
        skipped.updatedAt = skipped.completedAt!
        skipped.exercises[0].skippedAt = skipped.completedAt
        for index in skipped.exercises[0].loggedSets.indices {
            skipped.exercises[0].loggedSets[index].weight = .init(pounds: 500)
            skipped.exercises[0].loggedSets[index].repetitions = 20
        }

        let performance = ExercisePerformanceQuery.performance(
            exerciseID: included.exercises[0].exerciseID,
            workouts: [included, skipped]
        )
        XCTAssertEqual(performance.occurrences.map(\.workoutID), [included.id])
        guard case .repetitions(let record)? = performance.personalRecord else {
            return XCTFail("Expected repetition PR")
        }
        XCTAssertEqual(record.weight?.pounds, 145)

        let configuration = ProgressionConfiguration(
            isEnabled: true,
            defaults: FixtureDefaults.progression.defaults,
            groups: [],
            overrides: [],
            assignments: [included.exercises[0].exerciseID: .upper]
        )
        let suggestion = ProgressionEngine.suggestion(
            exerciseID: included.exercises[0].exerciseID,
            configuration: configuration,
            workouts: [included, skipped]
        )
        XCTAssertEqual(suggestion?.suggestedWeight?.pounds, 147.5)
        XCTAssertTrue(ExercisePerformanceQuery.validCompletedSets(in: skipped.exercises[0]).isEmpty)
    }

    func testSkipAndRemoveRemainDistinctCanonicalMutations() async throws {
        let repository = try repository()
        let fixture = EquilibriumFixtures.mixed(id: "phase5-distinct")
        try await repository.create(fixture)
        _ = try await repository.startWorkout(id: fixture.id, at: .init(timeIntervalSince1970: 10))

        let skipped = try await repository.skipExercise(
            workoutID: fixture.id,
            exerciseID: fixture.exercises[0].id,
            at: .init(timeIntervalSince1970: 20)
        )
        XCTAssertEqual(skipped.exercises.count, 2)
        XCTAssertNotNil(skipped.exercises[0].skippedAt)

        let removed = try await repository.removeExercise(
            workoutID: fixture.id,
            exerciseID: fixture.exercises[1].id,
            at: .init(timeIntervalSince1970: 30)
        )
        XCTAssertEqual(removed.exercises.map(\.id), [fixture.exercises[0].id])
        XCTAssertNotNil(removed.exercises[0].skippedAt)
    }

    func testCompletedWorkoutCannotBeStructurallyChangedByExerciseSettings() async throws {
        let repository = try repository()
        let completed = EquilibriumFixtures.completed(id: "phase5-history-immutable")
        try await repository.create(completed)
        let exerciseID = completed.exercises[0].id

        let mutations: [() async throws -> Workout] = [
            { try await repository.skipExercise(workoutID: completed.id, exerciseID: exerciseID, at: .now) },
            { try await repository.restoreExercise(workoutID: completed.id, exerciseID: exerciseID, at: .now) },
            { try await repository.removeExercise(workoutID: completed.id, exerciseID: exerciseID, at: .now) }
        ]
        for mutation in mutations {
            do {
                _ = try await mutation()
                XCTFail("Expected completed history to be immutable")
            } catch {
                XCTAssertEqual(error as? RepositoryError, .immutableCompletedWorkout)
            }
        }

        let persisted = try await repository.workout(id: completed.id)
        XCTAssertEqual(persisted, completed)

        try await repository.saveExerciseRestDuration(75, for: completed.exercises[0].exerciseID)
        let unchanged = try await repository.workout(id: completed.id)
        XCTAssertEqual(unchanged, completed)
    }
}

@MainActor
final class SkippedExercisePhase5CorrectionTests: XCTestCase {
    private func repository() throws -> SwiftDataRepository {
        SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
    }

    func testSkippedExerciseHasDistinctRowStateAndDoesNotCountAsCompletedProgress() async throws {
        let repository = try repository()
        var fixture = EquilibriumFixtures.midWorkout(id: "phase5-skipped-presentation")
        fixture.exercises[1].skippedAt = EquilibriumFixtures.timestamp
        try await repository.create(fixture)
        let model = WorkoutExecutionModel(workoutID: fixture.id, repository: repository)
        await model.activate()

        XCTAssertEqual(model.states[fixture.exercises[0].id], .completed)
        XCTAssertEqual(model.states[fixture.exercises[1].id], .skipped)
        XCTAssertEqual(model.completedExercises.map(\.id), [fixture.exercises[0].id])
        XCTAssertEqual(model.progress.completedSetCount, 3)
        XCTAssertEqual(model.progress.requiredSetCount, 7)

        let skippedRow = ExerciseListRowPresentation.resolve(state: .skipped)
        let completedRow = ExerciseListRowPresentation.resolve(state: .completed)
        XCTAssertTrue(skippedRow.strikethrough)
        XCTAssertEqual(skippedRow.emphasis, .reduced)
        XCTAssertFalse(skippedRow.showsLoggedSets)
        XCTAssertFalse(completedRow.strikethrough)
        XCTAssertEqual(completedRow.emphasis, .standard)
        XCTAssertTrue(completedRow.showsLoggedSets)
        XCTAssertFalse(ExerciseListRowPresentation.resolve(state: .current).showsLoggedSets)
        XCTAssertFalse(ExerciseListRowPresentation.resolve(state: .upcoming).showsLoggedSets)
    }

    func testSkippedExerciseSelectionExposesOnlyRestore() {
        var skipped = EquilibriumFixtures.ready(id: "phase5-skipped-actions").exercises[0]
        skipped.skippedAt = EquilibriumFixtures.timestamp
        XCTAssertEqual(ExerciseOverviewInteraction.actions(for: skipped), [.restoreExercise])

        skipped.skippedAt = nil
        XCTAssertEqual(
            ExerciseOverviewInteraction.actions(for: skipped),
            [.openExecution, .exerciseSettings]
        )
    }

    func testSkippedExerciseRejectsLogsSetMutationAndWorkTimerWithoutStartingRest() async throws {
        let repository = try repository()
        let fixture = EquilibriumFixtures.mixed(id: "phase5-skipped-guards")
        try await repository.create(fixture)
        _ = try await repository.startWorkout(id: fixture.id, at: .init(timeIntervalSince1970: 10))
        _ = try await repository.skipExercise(
            workoutID: fixture.id,
            exerciseID: fixture.exercises[1].id,
            at: .init(timeIntervalSince1970: 20)
        )

        do {
            _ = try await repository.logSet(
                workoutID: fixture.id,
                exerciseID: fixture.exercises[1].id,
                prescriptionID: fixture.exercises[1].prescriptions[0].id,
                input: .duration(weight: nil, seconds: 45),
                completed: true,
                at: .init(timeIntervalSince1970: 30)
            )
            XCTFail("Expected skipped exercise log rejection")
        } catch { XCTAssertEqual(error as? RepositoryError, .exerciseSkipped) }

        do {
            _ = try await repository.appendSet(
                workoutID: fixture.id,
                exerciseID: fixture.exercises[1].id,
                seed: .duration(weight: nil, seconds: 45),
                at: .init(timeIntervalSince1970: 31)
            )
            XCTFail("Expected skipped exercise set mutation rejection")
        } catch { XCTAssertEqual(error as? RepositoryError, .exerciseSkipped) }

        let model = WorkoutExecutionModel(workoutID: fixture.id, repository: repository)
        await model.activate()
        model.focus(fixture.exercises[1].id)
        XCTAssertNotEqual(model.focusedExerciseID, fixture.exercises[1].id)
        model.startWorkTimer(
            exerciseID: fixture.exercises[1].id,
            prescriptionID: fixture.exercises[1].prescriptions[0].id,
            input: .duration(weight: nil, seconds: 45)
        )
        XCTAssertNil(model.workTimerState)
        XCTAssertNil(model.restState)
        let persisted = try await repository.workout(id: fixture.id)
        XCTAssertTrue(persisted?.exercises[1].loggedSets.isEmpty == true)
    }

    func testRestoreUntouchedExerciseReturnsToUntouchedCanonicalStateWithoutExplicitFocus() async throws {
        let repository = try repository()
        let fixture = EquilibriumFixtures.mixed(id: "phase5-restore-untouched")
        try await repository.create(fixture)
        let model = WorkoutExecutionModel(workoutID: fixture.id, repository: repository)
        await model.activate()

        let skipped = await model.skipExercise(fixture.exercises[0].id)
        let restoredSuccessfully = await model.restoreExercise(fixture.exercises[0].id)
        XCTAssertTrue(skipped)
        XCTAssertTrue(restoredSuccessfully)

        let restored = try XCTUnwrap(model.exercise(id: fixture.exercises[0].id))
        XCTAssertNil(restored.skippedAt)
        XCTAssertTrue(restored.loggedSets.isEmpty)
        XCTAssertEqual(model.states[restored.id], .current)
        XCTAssertNil(model.focusedExerciseID)
    }

    func testRestorePartiallyCompletedExercisePreservesLogsAndPartialProgress() async throws {
        let repository = try repository()
        let fixture = EquilibriumFixtures.midWorkout(id: "phase5-restore-partial")
        try await repository.create(fixture)
        let model = WorkoutExecutionModel(workoutID: fixture.id, repository: repository)
        await model.activate()
        let partial = fixture.exercises[1]
        let originalLogs = partial.loggedSets

        let skipped = await model.skipExercise(partial.id)
        let restoredSuccessfully = await model.restoreExercise(partial.id)
        XCTAssertTrue(skipped)
        XCTAssertTrue(restoredSuccessfully)

        let restored = try XCTUnwrap(model.exercise(id: partial.id))
        XCTAssertEqual(restored.loggedSets, originalLogs)
        XCTAssertFalse(WorkoutExecutionQuery.isComplete(restored))
        XCTAssertEqual(model.states[partial.id], .current)
        XCTAssertEqual(WorkoutExecutionQuery.completedPrescriptionIDs(in: restored).count, 1)
        XCTAssertNil(model.focusedExerciseID)
    }

    func testRestoredExerciseBecomesEligibleForExecutionAgain() async throws {
        let repository = try repository()
        let fixture = EquilibriumFixtures.mixed(id: "phase5-restore-executable")
        try await repository.create(fixture)
        _ = try await repository.startWorkout(id: fixture.id, at: .init(timeIntervalSince1970: 10))
        _ = try await repository.skipExercise(
            workoutID: fixture.id,
            exerciseID: fixture.exercises[0].id,
            at: .init(timeIntervalSince1970: 20)
        )
        let restored = try await repository.restoreExercise(
            workoutID: fixture.id,
            exerciseID: fixture.exercises[0].id,
            at: .init(timeIntervalSince1970: 30)
        )
        XCTAssertNil(restored.exercises[0].skippedAt)

        let logged = try await repository.logSet(
            workoutID: fixture.id,
            exerciseID: fixture.exercises[0].id,
            prescriptionID: fixture.exercises[0].prescriptions[0].id,
            input: .repetitions(weight: nil, repetitions: 8),
            completed: true,
            at: .init(timeIntervalSince1970: 40)
        )
        XCTAssertEqual(logged.exercises[0].loggedSets.count, 1)
    }
}

@MainActor
final class WorkoutExecutionNavigationStateTests: XCTestCase {
    func testWalletPresentationDefaultsToFocusedAndCanReturnFromOverview() {
        let presentation = ExecutionWalletPresentation()
        XCTAssertEqual(presentation.mode, .focusedExercise)
        XCTAssertFalse(presentation.showFocusedExercise())

        XCTAssertTrue(presentation.showExerciseOverview())
        XCTAssertEqual(presentation.mode, .exerciseOverview)
        XCTAssertFalse(presentation.showExerciseOverview())

        XCTAssertTrue(presentation.showFocusedExercise())
        XCTAssertEqual(presentation.mode, .focusedExercise)
    }

    func testActionFooterVisibilityDistinguishesRestFromBrowseOverview() {
        let presentation = ExecutionWalletPresentation()

        XCTAssertTrue(presentation.showsActionFooter(for: .exercise))
        XCTAssertFalse(presentation.showsActionFooter(for: .exercise, isReadOnly: true))

        XCTAssertTrue(presentation.showExerciseOverview())
        XCTAssertFalse(presentation.showsActionFooter(for: .exercise))
        XCTAssertTrue(presentation.showsActionFooter(for: .rest))
        XCTAssertEqual(presentation.resolvedMode(for: .rest), .exerciseOverview)
        XCTAssertTrue(presentation.showsActionFooter(for: .work))
    }

    func testWalletFocusedOverviewRoundTripPreservesCanonicalForegroundIdentity() async throws {
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        let fixture = EquilibriumFixtures.midWorkout(id: "wallet-round-trip")
        try await repository.create(fixture)
        let model = WorkoutExecutionModel(workoutID: fixture.id, repository: repository)
        let presentation = ExecutionWalletPresentation()
        await model.activate()
        let canonicalWorkout = model.workout
        let foregroundID = try XCTUnwrap(model.currentExercise?.id)
        model.selectSet(at: 2)
        let selectedPrescriptionID = try XCTUnwrap(model.currentPrescription?.id)

        XCTAssertTrue(presentation.showExerciseOverview())
        XCTAssertEqual(model.currentExercise?.id, foregroundID)
        XCTAssertTrue(presentation.showFocusedExercise())
        XCTAssertTrue(presentation.showExerciseOverview())
        XCTAssertTrue(presentation.showFocusedExercise())

        XCTAssertEqual(presentation.mode, .focusedExercise)
        XCTAssertEqual(model.currentExercise?.id, foregroundID)
        XCTAssertEqual(model.currentPrescription?.id, selectedPrescriptionID)
        XCTAssertEqual(model.workout, canonicalWorkout)
    }

    func testHomeSourceSeedsExecutionWithoutChangingWorkoutOrTransitionIdentity() async throws {
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        let fixture = EquilibriumFixtures.ready(id: "home-seeded-execution")
        try await repository.create(fixture)
        let home = HomeModel(repository: repository, now: { fixture.createdAt })
        await home.load()

        home.beginExecution(for: fixture.id)
        let model = WorkoutExecutionModel(
            workoutID: fixture.id,
            initialWorkout: fixture,
            repository: repository,
            didPersist: home.applyPersistedWorkout
        )

        XCTAssertEqual(model.workout?.id, fixture.id)
        XCTAssertEqual(home.expandedWorkoutID, fixture.id)
        XCTAssertEqual(home.workouts.map(\.id), [fixture.id])
        XCTAssertEqual(HomeWorkoutTransitionIdentity.surface(for: fixture.id), "home-workout-\(fixture.id.rawValue)")
        XCTAssertEqual(HomeWorkoutTransitionIdentity.title(for: fixture.id), "home-workout-title-\(fixture.id.rawValue)")

        await model.activate()

        XCTAssertEqual(model.workout?.id, fixture.id)
        XCTAssertEqual(home.workouts.map(\.id), [fixture.id])
        XCTAssertEqual(home.expandedWorkoutID, fixture.id)
    }

    func testWorkAndRestDeriveTheSharedExecutionTimerRegion() async throws {
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        let fixture = EquilibriumFixtures.mixed(id: "timer-region")
        try await repository.create(fixture)
        let model = WorkoutExecutionModel(workoutID: fixture.id, repository: repository)
        await model.activate()

        let timedExercise = fixture.exercises[1]
        let timedPrescription = try XCTUnwrap(timedExercise.prescriptions.first)
        model.focus(timedExercise.id)
        model.startWorkTimer(
            exerciseID: timedExercise.id,
            prescriptionID: timedPrescription.id,
            input: .duration(weight: nil, seconds: 45)
        )
        let canonicalWorkState = try XCTUnwrap(model.workTimerState)
        let workPresentation = ExecutionSurfacePresentation.derive(
            workoutStatus: try XCTUnwrap(model.workout?.status),
            workTimerState: model.workTimerState,
            restState: model.restState,
            timerState: model.timer.state
        )
        guard case .work(let presentedWork, let timerState) = workPresentation.timerRegion else {
            return XCTFail("Expected Work in the execution timer region")
        }
        XCTAssertEqual(presentedWork, canonicalWorkState)
        XCTAssertEqual(timerState, model.timer.state)
        XCTAssertFalse(workPresentation.timerRegion.isRest)
        XCTAssertTrue(workPresentation.showsForegroundExercise)

        let wallet = ExecutionWalletPresentation()
        wallet.showExerciseOverview()
        wallet.showFocusedExercise()
        XCTAssertEqual(model.workTimerState, canonicalWorkState)
        XCTAssertEqual(model.timer.state, .running)

        let hiddenPresentation = ExecutionSurfacePresentation.derive(
            workoutStatus: .inProgress,
            workTimerState: nil,
            restState: nil,
            timerState: model.timer.state
        )
        XCTAssertEqual(hiddenPresentation.timerRegion, .hidden)
        XCTAssertFalse(hiddenPresentation.timerRegion.isVisible)
        XCTAssertFalse(hiddenPresentation.timerRegion.isRest)
        XCTAssertEqual(model.workTimerState, canonicalWorkState)
        XCTAssertEqual(model.timer.state, .running)

        let sharedTimer = model.timer
        model.skipWorkTimer()
        XCTAssertNotNil(model.workTimerState, "The work presentation remains visible until the rest state is ready")
        XCTAssertEqual(model.foregroundState, .work)
        for _ in 0..<100 where model.restState == nil { await Task.yield() }
        let canonicalRestState = try XCTUnwrap(model.restState)
        let restPresentation = ExecutionSurfacePresentation.derive(
            workoutStatus: try XCTUnwrap(model.workout?.status),
            workTimerState: model.workTimerState,
            restState: model.restState,
            timerState: model.timer.state
        )
        guard case .rest(let presentedRest) = restPresentation.timerRegion else {
            return XCTFail("Expected Rest in the execution timer region")
        }
        XCTAssertEqual(presentedRest, canonicalRestState)
        XCTAssertTrue(restPresentation.timerRegion.isRest)
        XCTAssertTrue(restPresentation.showsForegroundExercise)
        XCTAssertTrue(model.timer === sharedTimer)
        XCTAssertNil(model.workTimerState)
        model.skipRest()
    }

    func testCompletedWorkoutDerivesOverviewOnlyWithoutSyntheticForeground() async throws {
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        let completed = EquilibriumFixtures.completed(id: "completed-overview")
        try await repository.create(completed)
        let model = WorkoutExecutionModel(workoutID: completed.id, repository: repository)
        await model.activate()

        let presentation = ExecutionSurfacePresentation.derive(
            workoutStatus: try XCTUnwrap(model.workout?.status),
            workTimerState: model.workTimerState,
            restState: model.restState,
            timerState: model.timer.state
        )

        XCTAssertEqual(presentation.content, .completedOverview)
        XCTAssertFalse(presentation.showsForegroundExercise)
        XCTAssertEqual(presentation.timerRegion, .hidden)
        XCTAssertNil(model.currentExercise)
        XCTAssertNil(model.focusedExerciseID)
        XCTAssertEqual(model.completedExercises.map(\.id), completed.exercises.map(\.id))
        XCTAssertEqual(model.progress.fraction, 1, accuracy: 0.0001)
        XCTAssertFalse(completed.exercises.contains { $0.nameSnapshot == "Workout complete" })
    }

    func testReopeningCompletedTodayAndParentExitKeepCompletedOverviewCanonical() async throws {
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        let completed = EquilibriumFixtures.completed(id: "completed-today-reopen")
        try await repository.create(completed)
        let now = try XCTUnwrap(completed.completedAt)
        let home = HomeModel(repository: repository, now: { now })
        await home.load()
        XCTAssertEqual(home.workouts.map(\.id), [completed.id])

        home.beginExecution(for: completed.id)
        let model = WorkoutExecutionModel(workoutID: completed.id, repository: repository)
        await model.activate()
        let presentation = ExecutionSurfacePresentation.derive(
            workoutStatus: try XCTUnwrap(model.workout?.status),
            workTimerState: model.workTimerState,
            restState: model.restState,
            timerState: model.timer.state
        )
        XCTAssertEqual(presentation.content, .completedOverview)
        XCTAssertNil(model.currentExercise)
        XCTAssertEqual(home.expandedWorkoutID, completed.id)

        home.endExecution()
        XCTAssertNil(home.expandedWorkoutID)
        XCTAssertEqual(model.workout, completed)
        XCTAssertNil(model.currentExercise)
    }

    func testSemanticHapticsEmitOncePerPresentationAction() async throws {
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        let fixture = EquilibriumFixtures.mixed(id: "semantic-haptics")
        try await repository.create(fixture)
        let haptics = RecordingHapticsClient()
        let model = WorkoutExecutionModel(workoutID: fixture.id, repository: repository, haptics: haptics)
        await model.activate()

        await model.log(
            exerciseID: fixture.exercises[0].id,
            prescriptionID: fixture.exercises[0].prescriptions[0].id,
            input: .repetitions(weight: nil, repetitions: 8)
        )
        XCTAssertEqual(haptics.events, [.restTransition])

        model.skipRest()
        model.skipRest()
        XCTAssertEqual(haptics.events, [.restTransition, .restSkipped])
        XCTAssertEqual(model.foregroundState, .exercise)
        let persisted = try await repository.workout(id: fixture.id)
        XCTAssertEqual(model.workout, persisted)
    }

    func testTimedExecutionEmitsReadyPauseResumeAndSkipHaptics() async throws {
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        let fixture = EquilibriumFixtures.mixed(id: "timed-execution-haptics")
        try await repository.create(fixture)
        let haptics = RecordingHapticsClient()
        var instant = Date(timeIntervalSince1970: 5_000)
        let model = WorkoutExecutionModel(
            workoutID: fixture.id,
            repository: repository,
            now: { instant },
            haptics: haptics
        )
        await model.activate()

        let exercise = fixture.exercises[1]
        let prescription = try XCTUnwrap(exercise.prescriptions.first)
        model.focus(exercise.id)
        model.startWorkTimer(
            exerciseID: exercise.id,
            prescriptionID: prescription.id,
            input: .duration(weight: nil, seconds: 45)
        )

        instant = instant.addingTimeInterval(WorkoutWorkTimerTiming.countdownDuration)
        model.refreshRest()
        XCTAssertEqual(haptics.events, [.timerStarted])

        model.toggleWorkTimerPause()
        model.toggleWorkTimerPause()
        model.skipWorkTimer()
        XCTAssertEqual(
            Array(haptics.events.prefix(4)),
            [.timerStarted, .selection, .selection, .timerSkipped]
        )
    }

    func testSkipAndRestoreEmitDistinctExecutionHaptics() async throws {
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        let fixture = EquilibriumFixtures.mixed(id: "skip-restore-haptics")
        try await repository.create(fixture)
        let haptics = RecordingHapticsClient()
        let model = WorkoutExecutionModel(
            workoutID: fixture.id,
            repository: repository,
            haptics: haptics
        )
        await model.activate()

        let skipped = await model.skipExercise(fixture.exercises[0].id)
        let restored = await model.restoreExercise(fixture.exercises[0].id)
        XCTAssertTrue(skipped)
        XCTAssertTrue(restored)
        XCTAssertEqual(haptics.events, [.exerciseSkipped, .exerciseRestored])
    }

    func testWorkoutCompletionUsesSingleStrongAcknowledgement() async throws {
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        let fixture = EquilibriumFixtures.ready(id: "completion-haptics")
        try await repository.create(fixture)
        let haptics = RecordingHapticsClient()
        let model = WorkoutExecutionModel(workoutID: fixture.id, repository: repository, haptics: haptics)
        await model.activate()

        for (index, prescription) in fixture.exercises[0].prescriptions.enumerated() {
            await model.log(exerciseID: fixture.exercises[0].id, prescriptionID: prescription.id, input: .repetitions(weight: nil, repetitions: 8))
            if index < fixture.exercises[0].prescriptions.count - 1 { model.skipRest() }
        }

        XCTAssertTrue(model.didAutoComplete)
        XCTAssertEqual(haptics.events.filter { $0 == .workoutCompleted }.count, 1)
        XCTAssertFalse(haptics.events.contains(.exerciseCompleted))
    }

    func testCanonicalRestMinimizesWalletAndPreservesExecutionState() async throws {
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        let fixture = EquilibriumFixtures.mixed(id: "rest-foreground")
        try await repository.create(fixture)
        let model = WorkoutExecutionModel(workoutID: fixture.id, repository: repository)
        let presentation = ExecutionWalletPresentation()
        await model.activate()
        let canonicalExerciseID = model.currentExercise?.id

        await model.log(
            exerciseID: fixture.exercises[0].id,
            prescriptionID: fixture.exercises[0].prescriptions[0].id,
            input: .repetitions(weight: nil, repetitions: 8)
        )
        let canonicalAfterLogging = model.workout

        XCTAssertEqual(model.foregroundState, .rest)
        XCTAssertEqual(model.restState?.remaining, model.timer.remainingDuration)
        XCTAssertEqual(model.restState?.exerciseID, fixture.exercises[0].id)
        XCTAssertEqual(model.currentExercise?.id, canonicalExerciseID)
        XCTAssertEqual(presentation.resolvedMode(for: model.foregroundState), .exerciseOverview)
        XCTAssertTrue(presentation.showsActionFooter(for: model.foregroundState))

        XCTAssertFalse(presentation.synchronize(with: model.foregroundState))
        XCTAssertFalse(presentation.synchronize(with: model.foregroundState))
        XCTAssertEqual(presentation.mode, .focusedExercise)
        XCTAssertEqual(model.workout, canonicalAfterLogging)

        model.skipRest()
        XCTAssertEqual(model.foregroundState, .exercise)
        XCTAssertEqual(model.timer.state, .idle)
        XCTAssertNil(model.restState)
        XCTAssertEqual(model.currentExercise?.id, canonicalExerciseID)
        XCTAssertEqual(model.workout, canonicalAfterLogging)
        XCTAssertEqual(presentation.resolvedMode(for: model.foregroundState), .focusedExercise)
        XCTAssertTrue(presentation.showsActionFooter(for: model.foregroundState))
    }

    func testWalletModeDoesNotMutateCanonicalExecutionOrOuterHomeState() async throws {
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        let fixture = EquilibriumFixtures.midWorkout(id: "wallet-presentation")
        try await repository.create(fixture)
        let home = HomeModel(repository: repository)
        await home.load()
        home.beginExecution(for: fixture.id)

        let execution = WorkoutExecutionModel(workoutID: fixture.id, repository: repository)
        await execution.activate()
        let canonicalExerciseID = execution.currentExercise?.id
        let canonicalWorkout = execution.workout
        let presentation = ExecutionWalletPresentation()

        presentation.showExerciseOverview()
        XCTAssertEqual(presentation.mode, .exerciseOverview)
        XCTAssertEqual(execution.currentExercise?.id, canonicalExerciseID)
        XCTAssertEqual(execution.workout, canonicalWorkout)
        XCTAssertEqual(home.expandedWorkoutID, fixture.id)

        presentation.showFocusedExercise()
        XCTAssertEqual(presentation.mode, .focusedExercise)
        XCTAssertEqual(execution.currentExercise?.id, canonicalExerciseID)
        XCTAssertEqual(home.expandedWorkoutID, fixture.id)

        presentation.showExerciseOverview()
        home.endExecution()
        XCTAssertNil(home.expandedWorkoutID)
        XCTAssertEqual(presentation.mode, .exerciseOverview)
        XCTAssertEqual(execution.currentExercise?.id, canonicalExerciseID)
        XCTAssertEqual(execution.workout, canonicalWorkout)
    }

    func testExerciseSettingsPresentationPreservesCanonicalExerciseWalletAndHomeState() async throws {
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        let fixture = EquilibriumFixtures.midWorkout(id: "settings-presentation")
        try await repository.create(fixture)
        let home = HomeModel(repository: repository)
        await home.load()
        home.beginExecution(for: fixture.id)

        let execution = WorkoutExecutionModel(workoutID: fixture.id, repository: repository)
        await execution.activate()
        let canonicalWorkout = try XCTUnwrap(execution.workout)
        let canonicalExerciseID = try XCTUnwrap(execution.currentExercise?.id)
        let wallet = ExecutionWalletPresentation()
        wallet.showExerciseOverview()
        let settings = ExerciseSettingsPresentation()

        settings.present(exerciseID: canonicalExerciseID)

        XCTAssertTrue(settings.isPresented)
        XCTAssertEqual(settings.exerciseID, canonicalExerciseID)
        XCTAssertEqual(execution.workout, canonicalWorkout)
        XCTAssertEqual(execution.currentExercise?.id, canonicalExerciseID)
        XCTAssertEqual(wallet.mode, .exerciseOverview)
        XCTAssertEqual(home.expandedWorkoutID, fixture.id)

        settings.dismiss()

        XCTAssertFalse(settings.isPresented)
        XCTAssertNil(settings.exerciseID)
        XCTAssertEqual(execution.workout, canonicalWorkout)
        XCTAssertEqual(execution.currentExercise?.id, canonicalExerciseID)
        XCTAssertEqual(wallet.mode, .exerciseOverview)
        XCTAssertEqual(home.expandedWorkoutID, fixture.id)
    }

    func testExerciseSettingsPresentationDoesNotCancelActiveRest() async throws {
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        let fixture = EquilibriumFixtures.mixed(id: "settings-rest")
        try await repository.create(fixture)
        let execution = WorkoutExecutionModel(workoutID: fixture.id, repository: repository)
        await execution.activate()
        await execution.log(
            exerciseID: fixture.exercises[0].id,
            prescriptionID: fixture.exercises[0].prescriptions[0].id,
            input: .repetitions(weight: nil, repetitions: 8)
        )
        let canonicalWorkout = try XCTUnwrap(execution.workout)
        let restBeforePresentation = try XCTUnwrap(execution.restState)
        let settings = ExerciseSettingsPresentation()

        settings.present(exerciseID: fixture.exercises[0].id)
        settings.dismiss()

        XCTAssertEqual(execution.foregroundState, .rest)
        XCTAssertEqual(execution.restState, restBeforePresentation)
        XCTAssertEqual(execution.workout, canonicalWorkout)
        XCTAssertEqual(execution.timer.state, .running)
        execution.skipRest()
    }

    func testWalletSelectionUsesCanonicalFocusAndPreservesExerciseOrder() async throws {
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        let fixture = EquilibriumFixtures.midWorkout(id: "wallet-selection")
        try await repository.create(fixture)
        let model = WorkoutExecutionModel(workoutID: fixture.id, repository: repository)
        await model.activate()
        let presentation = ExecutionWalletPresentation()

        presentation.showExerciseOverview()
        let returnedToFocus = presentation.selectExercise(fixture.exercises[2].id, focus: model.focus)

        XCTAssertTrue(returnedToFocus)
        XCTAssertEqual(model.currentExercise?.id, fixture.exercises[2].id)
        XCTAssertEqual(model.currentExercise?.nameSnapshot, fixture.exercises[2].nameSnapshot)
        XCTAssertEqual(model.completedExercises.map(\.id), [fixture.exercises[0].id])
        XCTAssertEqual(model.upNextExercises.map(\.id), [fixture.exercises[1].id, fixture.exercises[3].id])
        XCTAssertEqual(fixture.exercises.map { model.states[$0.id] }, [.completed, .upcoming, .current, .upcoming])
        let persisted = try await repository.workout(id: fixture.id)
        XCTAssertEqual(persisted?.exercises.map(\.id), fixture.exercises.map(\.id))
        XCTAssertEqual(presentation.mode, .focusedExercise)
    }

    func testCanonicalRefreshPreservesFocusedExerciseAndSelectedSetByIdentity() async throws {
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        let fixture = EquilibriumFixtures.midWorkout(id: "wallet-refresh-preserves-selection")
        try await repository.create(fixture)
        let model = WorkoutExecutionModel(workoutID: fixture.id, repository: repository)
        let presentation = ExecutionWalletPresentation()
        await model.activate()

        model.focus(fixture.exercises[2].id)
        model.selectSet(at: 2)
        presentation.showExerciseOverview()
        let selectedPrescriptionID = try XCTUnwrap(model.currentPrescription?.id)
        let loaded = try await repository.workout(id: fixture.id)
        var persisted = try XCTUnwrap(loaded)
        persisted.updatedAt = persisted.updatedAt.addingTimeInterval(1)
        try await repository.update(persisted)

        await model.refreshFromPersistence()

        XCTAssertEqual(presentation.mode, .exerciseOverview)
        XCTAssertEqual(model.focusedExerciseID, fixture.exercises[2].id)
        XCTAssertEqual(model.currentExercise?.id, fixture.exercises[2].id)
        XCTAssertEqual(model.currentPrescription?.id, selectedPrescriptionID)
        XCTAssertEqual(persisted.exercises.map(\.id), model.workout?.exercises.map(\.id))
    }

    func testCanonicalRefreshPreservesSelectedSetForImplicitCurrentExercise() async throws {
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        let fixture = EquilibriumFixtures.midWorkout(id: "wallet-refresh-preserves-implicit-current")
        try await repository.create(fixture)
        let model = WorkoutExecutionModel(workoutID: fixture.id, repository: repository)
        await model.activate()

        XCTAssertNil(model.focusedExerciseID)
        model.selectSet(at: 2)
        let currentExerciseID = try XCTUnwrap(model.currentExercise?.id)
        let selectedPrescriptionID = try XCTUnwrap(model.currentPrescription?.id)

        await model.refreshFromPersistence()

        XCTAssertNil(model.focusedExerciseID)
        XCTAssertEqual(model.currentExercise?.id, currentExerciseID)
        XCTAssertEqual(model.currentPrescription?.id, selectedPrescriptionID)
    }

    func testCompletingFocusedExerciseAdvancesCanonicalListStates() async throws {
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        let fixture = EquilibriumFixtures.midWorkout(id: "wallet-exercise-completion")
        try await repository.create(fixture)
        let model = WorkoutExecutionModel(workoutID: fixture.id, repository: repository)
        let presentation = ExecutionWalletPresentation()
        await model.activate()
        let completingExercise = fixture.exercises[1]

        for prescription in completingExercise.prescriptions.dropFirst() {
            await model.log(
                exerciseID: completingExercise.id,
                prescriptionID: prescription.id,
                input: .repetitions(weight: nil, repetitions: 8)
            )
            if prescription.id != completingExercise.prescriptions.last?.id { model.skipRest() }
        }

        XCTAssertEqual(presentation.mode, .focusedExercise)
        XCTAssertNil(model.focusedExerciseID)
        XCTAssertEqual(model.currentExercise?.id, fixture.exercises[2].id)
        XCTAssertEqual(model.completedExercises.map(\.id), [fixture.exercises[0].id, completingExercise.id])
        XCTAssertEqual(model.upNextExercises.map(\.id), [fixture.exercises[3].id])
        XCTAssertEqual(fixture.exercises.map { model.states[$0.id] }, [.completed, .completed, .current, .upcoming])
    }

    func testWorkoutCompletionClearsTransientWalletSelection() async throws {
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        let fixture = EquilibriumFixtures.ready(id: "wallet-completion-clears-selection")
        try await repository.create(fixture)
        let model = WorkoutExecutionModel(workoutID: fixture.id, repository: repository)
        await model.activate()
        model.focus(fixture.exercises[0].id)

        for (index, prescription) in fixture.exercises[0].prescriptions.enumerated() {
            await model.log(
                exerciseID: fixture.exercises[0].id,
                prescriptionID: prescription.id,
                input: .repetitions(weight: nil, repetitions: 8)
            )
            if index < fixture.exercises[0].prescriptions.count - 1 { model.skipRest() }
        }

        XCTAssertEqual(model.workout?.status, .completed)
        XCTAssertTrue(model.didAutoComplete)
        XCTAssertNil(model.focusedExerciseID)
        XCTAssertNil(model.currentExercise)
        XCTAssertEqual(model.selectedSetIndex, 0)
        XCTAssertEqual(fixture.exercises.map { model.states[$0.id] }, [.completed])
    }

    func testCompactForegroundPresentationPreservesCanonicalCurrentExerciseTitleAndIdentity() async throws {
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        let fixture = EquilibriumFixtures.midWorkout(id: "wallet-compact-title")
        try await repository.create(fixture)
        let model = WorkoutExecutionModel(workoutID: fixture.id, repository: repository)
        await model.activate()
        let presentation = ExecutionWalletPresentation()
        let canonicalExercise = try XCTUnwrap(model.currentExercise)

        presentation.showExerciseOverview()

        XCTAssertEqual(presentation.mode, .exerciseOverview)
        XCTAssertEqual(model.currentExercise?.id, canonicalExercise.id)
        XCTAssertEqual(model.currentExercise?.nameSnapshot, canonicalExercise.nameSnapshot)
        XCTAssertEqual(model.currentExercise?.nameSnapshot, "Romanian Deadlift")
        XCTAssertFalse(model.currentExercise?.nameSnapshot.contains(fixture.exercises[2].nameSnapshot) == true)
    }

    func testWalletFocusedCompletionPreservesPhaseTwoHomeReconciliation() async throws {
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        let fixture = EquilibriumFixtures.ready(id: "wallet-completion")
        try await repository.create(fixture)
        let home = HomeModel(repository: repository)
        await home.load()
        home.beginExecution(for: fixture.id)
        let presentation = ExecutionWalletPresentation()
        let execution = WorkoutExecutionModel(workoutID: fixture.id, repository: repository, didPersist: home.applyPersistedWorkout)
        await execution.activate()

        for (index, prescription) in fixture.exercises[0].prescriptions.enumerated() {
            await execution.log(exerciseID: fixture.exercises[0].id, prescriptionID: prescription.id, input: .repetitions(weight: nil, repetitions: 8))
            if index == 0 {
                XCTAssertEqual(execution.foregroundState, .rest)
                execution.skipRest()
                XCTAssertEqual(execution.foregroundState, .exercise)
            }
        }

        XCTAssertEqual(presentation.mode, .focusedExercise)
        XCTAssertTrue(execution.didAutoComplete)
        XCTAssertEqual(home.expandedWorkoutID, fixture.id)
        XCTAssertEqual(home.workouts.map(\.id), [fixture.id])
        XCTAssertEqual(home.workouts.first?.status, .completed)

        home.endExecution()
        XCTAssertNil(home.expandedWorkoutID)
        XCTAssertEqual(home.workouts.first?.status, .completed)
    }

    func testHomeExpansionRemainsIndependentWhenRestStartsAndExecutionCloses() async throws {
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        let fixture = EquilibriumFixtures.mixed(id: "rest-home-independent")
        try await repository.create(fixture)
        let home = HomeModel(repository: repository)
        await home.load()
        home.beginExecution(for: fixture.id)
        let execution = WorkoutExecutionModel(workoutID: fixture.id, repository: repository, didPersist: home.applyPersistedWorkout)
        await execution.activate()

        await execution.log(
            exerciseID: fixture.exercises[0].id,
            prescriptionID: fixture.exercises[0].prescriptions[0].id,
            input: .repetitions(weight: nil, repetitions: 8)
        )

        XCTAssertEqual(execution.foregroundState, .rest)
        XCTAssertEqual(home.expandedWorkoutID, fixture.id)
        home.endExecution()
        XCTAssertNil(home.expandedWorkoutID)
        XCTAssertEqual(execution.foregroundState, .rest)
        execution.skipRest()
    }

    func testDestinationActivationStartsPlannedAndPublishesCanonicalScheduleValue() async throws {
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        let fixture = EquilibriumFixtures.ready(id: "activation")
        try await repository.create(fixture)
        var published: Workout?
        let model = WorkoutExecutionModel(workoutID: fixture.id, repository: repository, now: { .init(timeIntervalSince1970: 50) }, didPersist: { published = $0 })
        XCTAssertNil(model.workout)
        let beforeActivation = try await repository.workout(id: fixture.id)
        XCTAssertEqual(beforeActivation?.status, .ready)
        await model.activate()
        XCTAssertEqual(model.workout?.status, .inProgress)
        XCTAssertEqual(published?.id, fixture.id)
        XCTAssertEqual(published?.status, .inProgress)
    }

    func testInProgressResumesAndCompletedActivatesReadOnly() async throws {
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        let inProgress = EquilibriumFixtures.inProgress(id: "resume-model")
        try await repository.create(inProgress)
        let resume = WorkoutExecutionModel(workoutID: inProgress.id, repository: repository)
        await resume.activate()
        XCTAssertEqual(resume.workout?.startedAt, inProgress.startedAt)
        XCTAssertFalse(resume.isReadOnly)
        XCTAssertTrue(resume.showsExecutionOptions)
        XCTAssertFalse(resume.canComplete)

        let completed = EquilibriumFixtures.completed(id: "readonly-model")
        try await repository.create(completed)
        let readOnly = WorkoutExecutionModel(workoutID: completed.id, repository: repository)
        await readOnly.activate()
        XCTAssertTrue(readOnly.isReadOnly)
        XCTAssertFalse(readOnly.showsExecutionOptions)
    }

    func testFinalValidLogAutomaticallyCompletesExactlyOnceWithoutPrematureCompletion() async throws {
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        let fixture = EquilibriumFixtures.ready(id: "options-eligibility")
        try await repository.create(fixture)
        let model = WorkoutExecutionModel(workoutID: fixture.id, repository: repository)
        await model.activate()

        XCTAssertTrue(model.showsExecutionOptions)
        XCTAssertFalse(model.canComplete)

        let prescriptions = fixture.exercises.flatMap { exercise in exercise.prescriptions.map { (exercise, $0) } }
        for (index, pair) in prescriptions.enumerated() {
            let (exercise, prescription) = pair
                let input: SetLogInput
                switch prescription.target {
                case .repetitions: input = .repetitions(weight: nil, repetitions: 8)
                case .duration(let seconds): input = .duration(weight: nil, seconds: seconds)
                }
                await model.log(exerciseID: exercise.id, prescriptionID: prescription.id, input: input)
            if index < prescriptions.count - 1 {
                XCTAssertEqual(model.workout?.status, .inProgress)
                XCTAssertNil(model.workout?.completedAt)
                XCTAssertFalse(model.didAutoComplete)
            }
        }

        let completedAt = try XCTUnwrap(model.workout?.completedAt)
        XCTAssertEqual(model.workout?.status, .completed)
        XCTAssertTrue(model.didAutoComplete)
        XCTAssertFalse(model.showsExecutionOptions)
        let activeWorkouts = try await repository.activeWorkouts()
        XCTAssertTrue(activeWorkouts.isEmpty)
        let finalPrescription = try XCTUnwrap(prescriptions.last)
        await model.log(exerciseID: finalPrescription.0.id, prescriptionID: finalPrescription.1.id, input: .repetitions(weight: nil, repetitions: 9))
        let persisted = try await repository.workout(id: fixture.id)
        XCTAssertEqual(persisted?.completedAt, completedAt)
    }

    func testBackEquivalentLeavesCanonicalProgressAndHomeAcceptsMutation() async throws {
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        let fixture = EquilibriumFixtures.ready(id: "back")
        try await repository.create(fixture)
        let home = HomeModel(repository: repository)
        await home.load()
        let model = WorkoutExecutionModel(workoutID: fixture.id, repository: repository, didPersist: { home.applyPersistedWorkout($0) })
        await model.activate()
        await model.log(exerciseID: fixture.exercises[0].id, prescriptionID: fixture.exercises[0].prescriptions[0].id, input: .repetitions(weight: nil, repetitions: 9))
        XCTAssertEqual(home.workouts.first?.status, .inProgress)
        XCTAssertEqual(home.workouts.first?.exercises[0].loggedSets[0].repetitions, 9)
        let persisted = try await repository.workout(id: fixture.id)
        XCTAssertEqual(persisted?.exercises[0].loggedSets[0].repetitions, 9)
    }

    func testOrderedExerciseStatesAndFocusAreTransient() async throws {
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        let fixture = EquilibriumFixtures.midWorkout(id: "panels")
        try await repository.create(fixture)
        let model = WorkoutExecutionModel(workoutID: fixture.id, repository: repository)
        await model.activate()
        XCTAssertEqual(model.currentExercise?.id, fixture.exercises[1].id)
        XCTAssertEqual(fixture.exercises.map { model.states[$0.id] }, [.completed, .current, .upcoming, .upcoming])
        model.focus(fixture.exercises[2].id)
        XCTAssertEqual(model.currentExercise?.id, fixture.exercises[2].id)
        let persistedOrder = try await repository.workout(id: fixture.id)
        XCTAssertEqual(persistedOrder?.exercises.map(\.id), fixture.exercises.map(\.id))

        let relaunched = WorkoutExecutionModel(workoutID: fixture.id, repository: repository)
        await relaunched.activate()
        XCTAssertEqual(relaunched.currentExercise?.id, fixture.exercises[1].id)
    }

    func testCompletedPanelCanFocusCompletedExerciseOnlyWhileActive() async throws {
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        let active = EquilibriumFixtures.midWorkout(id: "review-active")
        try await repository.create(active)
        let model = WorkoutExecutionModel(workoutID: active.id, repository: repository)
        await model.activate(); model.focus(active.exercises[0].id)
        XCTAssertEqual(model.currentExercise?.id, active.exercises[0].id)
        XCTAssertEqual(model.selectedSetIndex, active.exercises[0].prescriptions.count - 1)

        let complete = EquilibriumFixtures.completed(id: "review-readonly")
        try await repository.create(complete)
        let readOnly = WorkoutExecutionModel(workoutID: complete.id, repository: repository)
        await readOnly.activate(); readOnly.focus(complete.exercises[0].id)
        XCTAssertNil(readOnly.focusedExerciseID)
        XCTAssertEqual(readOnly.states[complete.exercises[0].id], .completed)
    }

    func testCurrentSetDerivesAdvancesAndRevisitsLoggedSet() async throws {
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        let fixture = EquilibriumFixtures.ready(id: "set-position")
        try await repository.create(fixture)
        let model = WorkoutExecutionModel(workoutID: fixture.id, repository: repository)
        await model.activate()
        XCTAssertEqual(model.selectedSetIndex, 0)
        await model.log(exerciseID: fixture.exercises[0].id, prescriptionID: fixture.exercises[0].prescriptions[0].id, input: .repetitions(weight: nil, repetitions: 8))
        XCTAssertEqual(model.selectedSetIndex, 1)
        model.selectSet(at: 0)
        XCTAssertEqual(model.currentPrescription?.id, fixture.exercises[0].prescriptions[0].id)
        await model.log(exerciseID: fixture.exercises[0].id, prescriptionID: fixture.exercises[0].prescriptions[0].id, input: .repetitions(weight: .init(pounds: 140), repetitions: 9))
        let loaded = try await repository.workout(id: fixture.id)
        let persisted = try XCTUnwrap(loaded)
        XCTAssertEqual(persisted.exercises[0].loggedSets.count, 1)
        XCTAssertEqual(persisted.exercises[0].loggedSets[0].repetitions, 9)
    }

    func testAddingSetPreservesActiveSet() async throws {
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        let fixture = EquilibriumFixtures.ready(id: "add-set-preserves-active")
        try await repository.create(fixture)
        let model = WorkoutExecutionModel(workoutID: fixture.id, repository: repository)
        await model.activate()
        model.selectSet(at: 1)
        let activeSetID = try XCTUnwrap(model.currentPrescription?.id)
        let originalSetCount = try XCTUnwrap(model.currentExercise?.prescriptions.count)

        await model.addSet(exerciseID: fixture.exercises[0].id)

        XCTAssertEqual(model.selectedSetIndex, 1)
        XCTAssertEqual(model.currentPrescription?.id, activeSetID)
        XCTAssertEqual(model.currentExercise?.prescriptions.count, originalSetCount + 1)
        let loaded = try await repository.workout(id: fixture.id)
        let persisted = try XCTUnwrap(loaded)
        XCTAssertEqual(persisted.exercises[0].prescriptions.count, originalSetCount + 1)
    }

    func testEditingSetCountPreservesTheActiveSetAndRemovesOnlyUncompletedSets() async throws {
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        let fixture = EquilibriumFixtures.ready(id: "edit-set-count")
        try await repository.create(fixture)
        let model = WorkoutExecutionModel(workoutID: fixture.id, repository: repository)
        await model.activate()
        model.selectSet(at: 1)
        let activeSetID = try XCTUnwrap(model.currentPrescription?.id)

        let increased = await model.updateSetCount(exerciseID: fixture.exercises[0].id, count: 5)
        XCTAssertTrue(increased)
        XCTAssertEqual(model.currentExercise?.prescriptions.count, 5)
        XCTAssertEqual(model.currentPrescription?.id, activeSetID)

        let decreased = await model.updateSetCount(exerciseID: fixture.exercises[0].id, count: 2)
        XCTAssertTrue(decreased)
        XCTAssertEqual(model.currentExercise?.prescriptions.count, 2)
        XCTAssertEqual(model.currentPrescription?.id, activeSetID)

        await model.log(
            exerciseID: fixture.exercises[0].id,
            prescriptionID: activeSetID,
            input: .repetitions(weight: nil, repetitions: 8)
        )
        model.skipRest()
        let retainedCompletedSet = await model.updateSetCount(exerciseID: fixture.exercises[0].id, count: 1)
        XCTAssertTrue(retainedCompletedSet)
        let loaded = try await repository.workout(id: fixture.id)
        let persisted = try XCTUnwrap(loaded)
        XCTAssertEqual(persisted.exercises[0].prescriptions.map(\.id), [activeSetID])
        XCTAssertEqual(persisted.exercises[0].loggedSets.first?.prescriptionID, activeSetID)
        let rejectedZeroSets = await model.updateSetCount(exerciseID: fixture.exercises[0].id, count: 0)
        XCTAssertFalse(rejectedZeroSets)
    }

    func testRepetitionAndDurationFocusedPrescriptionTypes() async throws {
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        let fixture = EquilibriumFixtures.mixed(id: "focused-types")
        try await repository.create(fixture)
        let model = WorkoutExecutionModel(workoutID: fixture.id, repository: repository)
        await model.activate()
        guard case .repetitions = model.currentPrescription?.target else { return XCTFail("Expected repetitions") }
        model.focus(fixture.exercises[1].id)
        guard case .duration = model.currentPrescription?.target else { return XCTFail("Expected duration") }
    }

    func testFocusedSetSubmissionUsesThePrescriptionTarget() {
        XCTAssertEqual(
            FocusedSetSubmission.resolve(target: .repetitions(range: 11...11), isLogged: false),
            .log
        )
        XCTAssertEqual(
            FocusedSetSubmission.resolve(target: .duration(seconds: 45), isLogged: false),
            .startTimer
        )
        XCTAssertEqual(
            FocusedSetSubmission.resolve(target: .duration(seconds: 45), isLogged: true),
            .log
        )
    }

    func testRestStartsCountsDownSkipsAndDoesNotOwnPersistence() async throws {
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        let fixture = EquilibriumFixtures.mixed(id: "rest")
        try await repository.create(fixture)
        try await repository.saveExerciseRestDuration(120, for: fixture.exercises[0].exerciseID)
        var instant = Date(timeIntervalSince1970: 1_000)
        let model = WorkoutExecutionModel(workoutID: fixture.id, repository: repository, now: { instant })
        await model.activate()
        let exercise = fixture.exercises[0], prescription = exercise.prescriptions[0]
        await model.log(exerciseID: exercise.id, prescriptionID: prescription.id, input: .repetitions(weight: nil, repetitions: 8))
        XCTAssertEqual(model.restState?.remaining, 120)
        instant = instant.addingTimeInterval(45); model.refreshRest()
        XCTAssertEqual(model.restState?.remaining, 75)
        let persistedDuringRest = try await repository.workout(id: fixture.id)
        XCTAssertEqual(persistedDuringRest?.exercises[0].loggedSets.count, 1)
        model.skipRest()
        XCTAssertNil(model.restState)
        let persistedAfterSkip = try await repository.workout(id: fixture.id)
        XCTAssertEqual(persistedAfterSkip?.exercises[0].loggedSets.count, 1)
    }

    func testRestSessionUsesAbsoluteDeadlineAndRestoresReducedTimeAfterModelRecreation() async throws {
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        let fixture = EquilibriumFixtures.mixed(id: "rest-session-recreate")
        try await repository.create(fixture)
        try await repository.saveExerciseRestDuration(120, for: fixture.exercises[0].exerciseID)
        var instant = Date(timeIntervalSince1970: 10_000)
        let sessions = WorkoutRestSessionStore()

        do {
            let first = WorkoutExecutionModel(workoutID: fixture.id, repository: repository, now: { instant }, restSessionStore: sessions)
            await first.activate()
            await first.log(
                exerciseID: fixture.exercises[0].id,
                prescriptionID: fixture.exercises[0].prescriptions[0].id,
                input: .repetitions(weight: nil, repetitions: 8)
            )
            XCTAssertEqual(sessions.activeSession?.workoutID, fixture.id)
            XCTAssertEqual(sessions.activeSession?.exerciseID, fixture.exercises[0].id)
            XCTAssertEqual(sessions.activeSession?.totalDuration, 120)
            XCTAssertEqual(sessions.activeSession?.deadline, instant.addingTimeInterval(120))
        }

        instant = instant.addingTimeInterval(20)
        let reopened = WorkoutExecutionModel(workoutID: fixture.id, repository: repository, now: { instant }, restSessionStore: sessions)
        await reopened.activate()

        XCTAssertEqual(try XCTUnwrap(reopened.restState?.remaining), 100, accuracy: 0.001)
        XCTAssertEqual(reopened.restState?.exerciseID, fixture.exercises[0].id)
        XCTAssertEqual(reopened.foregroundState, .rest)
        XCTAssertEqual(reopened.timer.state, .running)
        XCTAssertEqual(sessions.activeSession?.deadline, Date(timeIntervalSince1970: 10_120))
        reopened.skipRest()
    }

    func testRecreatingAfterRetainedDeadlineResolvesNaturalExpirationWithoutRestarting() async throws {
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        let fixture = EquilibriumFixtures.mixed(id: "rest-session-expired")
        try await repository.create(fixture)
        var instant = Date(timeIntervalSince1970: 20_000)
        let sessions = WorkoutRestSessionStore()

        do {
            let first = WorkoutExecutionModel(workoutID: fixture.id, repository: repository, now: { instant }, restSessionStore: sessions)
            await first.activate()
            await first.log(exerciseID: fixture.exercises[0].id, prescriptionID: fixture.exercises[0].prescriptions[0].id, input: .repetitions(weight: nil, repetitions: 8))
        }

        instant = instant.addingTimeInterval(121)
        let reopened = WorkoutExecutionModel(workoutID: fixture.id, repository: repository, now: { instant }, restSessionStore: sessions)
        await reopened.activate()

        XCTAssertNil(reopened.restState)
        XCTAssertEqual(reopened.foregroundState, .exercise)
        XCTAssertEqual(reopened.timer.state, .completed)
        XCTAssertNil(sessions.activeSession)

        let reopenedAgain = WorkoutExecutionModel(workoutID: fixture.id, repository: repository, now: { instant }, restSessionStore: sessions)
        await reopenedAgain.activate()
        XCTAssertNil(reopenedAgain.restState)
        XCTAssertEqual(reopenedAgain.timer.state, .idle)
    }

    func testSkipRestClearsRetainedSessionAndPreventsRestoration() async throws {
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        let fixture = EquilibriumFixtures.mixed(id: "rest-session-skip")
        try await repository.create(fixture)
        var instant = Date(timeIntervalSince1970: 30_000)
        let sessions = WorkoutRestSessionStore()
        let first = WorkoutExecutionModel(workoutID: fixture.id, repository: repository, now: { instant }, restSessionStore: sessions)
        await first.activate()
        await first.log(exerciseID: fixture.exercises[0].id, prescriptionID: fixture.exercises[0].prescriptions[0].id, input: .repetitions(weight: nil, repetitions: 8))

        first.skipRest()
        XCTAssertNil(sessions.activeSession)
        instant = instant.addingTimeInterval(10)

        let reopened = WorkoutExecutionModel(workoutID: fixture.id, repository: repository, now: { instant }, restSessionStore: sessions)
        await reopened.activate()
        XCTAssertNil(reopened.restState)
        XCTAssertEqual(reopened.foregroundState, .exercise)
    }

    func testNaturallyCompletedRestClearsSessionAndDoesNotRestore() async throws {
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        let fixture = EquilibriumFixtures.mixed(id: "rest-session-completed")
        try await repository.create(fixture)
        var instant = Date(timeIntervalSince1970: 40_000)
        let sessions = WorkoutRestSessionStore()
        let first = WorkoutExecutionModel(workoutID: fixture.id, repository: repository, now: { instant }, restSessionStore: sessions)
        await first.activate()
        await first.log(exerciseID: fixture.exercises[0].id, prescriptionID: fixture.exercises[0].prescriptions[0].id, input: .repetitions(weight: nil, repetitions: 8))

        instant = instant.addingTimeInterval(121)
        first.refreshRest()
        XCTAssertNil(first.restState)
        XCTAssertNil(sessions.activeSession)

        let reopened = WorkoutExecutionModel(workoutID: fixture.id, repository: repository, now: { instant }, restSessionStore: sessions)
        await reopened.activate()
        XCTAssertNil(reopened.restState)
    }

    func testRetainedRestSessionIsIsolatedByWorkoutID() async throws {
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        let workoutA = EquilibriumFixtures.mixed(id: "rest-session-a")
        let workoutB = EquilibriumFixtures.mixed(id: "rest-session-b")
        try await repository.materializeAtomically([workoutA, workoutB])
        try await repository.saveExerciseRestDuration(120, for: workoutA.exercises[0].exerciseID)
        var instant = Date(timeIntervalSince1970: 50_000)
        let sessions = WorkoutRestSessionStore()
        let first = WorkoutExecutionModel(workoutID: workoutA.id, repository: repository, now: { instant }, restSessionStore: sessions)
        await first.activate()
        await first.log(exerciseID: workoutA.exercises[0].id, prescriptionID: workoutA.exercises[0].prescriptions[0].id, input: .repetitions(weight: nil, repetitions: 8))

        instant = instant.addingTimeInterval(20)
        let differentWorkout = WorkoutExecutionModel(workoutID: workoutB.id, repository: repository, now: { instant }, restSessionStore: sessions)
        await differentWorkout.activate()
        XCTAssertNil(differentWorkout.restState)
        XCTAssertEqual(sessions.activeSession?.workoutID, workoutA.id)

        let reopenedA = WorkoutExecutionModel(workoutID: workoutA.id, repository: repository, now: { instant }, restSessionStore: sessions)
        await reopenedA.activate()
        XCTAssertEqual(try XCTUnwrap(reopenedA.restState?.remaining), 100, accuracy: 0.001)
        reopenedA.skipRest()
    }

    func testWorkoutCompletionClearsRetainedRestSession() async throws {
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        let fixture = EquilibriumFixtures.ready(id: "rest-session-workout-completion")
        try await repository.create(fixture)
        var instant = Date(timeIntervalSince1970: 60_000)
        let sessions = WorkoutRestSessionStore()
        let model = WorkoutExecutionModel(workoutID: fixture.id, repository: repository, now: { instant }, restSessionStore: sessions)
        await model.activate()

        for (index, prescription) in fixture.exercises[0].prescriptions.enumerated() {
            await model.log(exerciseID: fixture.exercises[0].id, prescriptionID: prescription.id, input: .repetitions(weight: nil, repetitions: 8))
            if index < fixture.exercises[0].prescriptions.count - 1 {
                XCTAssertNotNil(sessions.activeSession)
                model.skipRest()
                instant = instant.addingTimeInterval(1)
            }
        }

        XCTAssertEqual(model.workout?.status, .completed)
        XCTAssertNil(sessions.activeSession)
    }

    func testWorkoutDeletionClearsRetainedRestSession() async throws {
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        let fixture = EquilibriumFixtures.mixed(id: "rest-session-workout-deletion")
        try await repository.create(fixture)
        let sessions = WorkoutRestSessionStore()
        let model = WorkoutExecutionModel(workoutID: fixture.id, repository: repository, restSessionStore: sessions)
        await model.activate()
        await model.log(exerciseID: fixture.exercises[0].id, prescriptionID: fixture.exercises[0].prescriptions[0].id, input: .repetitions(weight: nil, repetitions: 8))
        XCTAssertNotNil(sessions.activeSession)

        let deleted = await model.deleteWorkout()
        let persisted = try await repository.workout(id: fixture.id)
        XCTAssertTrue(deleted)
        XCTAssertNil(sessions.activeSession)
        XCTAssertNil(persisted)
    }

    func testRestDeadlineCompletionReturnsToActiveCurrent() async throws {
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        let fixture = EquilibriumFixtures.mixed(id: "rest-finish")
        try await repository.create(fixture)
        var instant = Date(timeIntervalSince1970: 2_000)
        let model = WorkoutExecutionModel(workoutID: fixture.id, repository: repository, now: { instant })
        let presentation = ExecutionWalletPresentation()
        await model.activate()
        await model.log(exerciseID: fixture.exercises[0].id, prescriptionID: fixture.exercises[0].prescriptions[0].id, input: .repetitions(weight: nil, repetitions: 8))
        presentation.synchronize(with: model.foregroundState)
        XCTAssertEqual(model.foregroundState, .rest)
        instant = instant.addingTimeInterval(121); model.refreshRest()
        XCTAssertNil(model.restState)
        XCTAssertEqual(model.foregroundState, .exercise)
        XCTAssertEqual(presentation.resolvedMode(for: model.foregroundState), .focusedExercise)
        XCTAssertTrue(presentation.showsActionFooter(for: model.foregroundState))
        XCTAssertEqual(model.selectedSetIndex, 1)
    }

    func testFinalExerciseSetRestKeepsCanonicalNextExerciseCurrent() async throws {
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        let fixture = EquilibriumFixtures.mixed(id: "rest-next-exercise")
        try await repository.create(fixture)
        let model = WorkoutExecutionModel(workoutID: fixture.id, repository: repository)
        await model.activate()

        for (index, prescription) in fixture.exercises[0].prescriptions.enumerated() {
            await model.log(exerciseID: fixture.exercises[0].id, prescriptionID: prescription.id, input: .repetitions(weight: nil, repetitions: 8))
            if index < fixture.exercises[0].prescriptions.count - 1 { model.skipRest() }
        }

        XCTAssertEqual(model.foregroundState, .rest)
        XCTAssertEqual(model.restState?.exerciseID, fixture.exercises[0].id)
        XCTAssertEqual(model.currentExercise?.id, fixture.exercises[1].id)
        XCTAssertEqual(model.selectedSetIndex, 0)
        model.skipRest()
        XCTAssertEqual(model.foregroundState, .exercise)
        XCTAssertEqual(model.currentExercise?.id, fixture.exercises[1].id)
    }

    func testDefaultRestStartsForNewlyCompletedSetAndNotForAnEdit() async throws {
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        var fixture = EquilibriumFixtures.ready(id: "default-rest")
        fixture.exercises[0].restDuration = nil
        try await repository.create(fixture)
        let model = WorkoutExecutionModel(workoutID: fixture.id, repository: repository, defaultRestDuration: 90)
        await model.activate()
        let exercise = fixture.exercises[0], prescription = exercise.prescriptions[0]
        await model.log(exerciseID: exercise.id, prescriptionID: prescription.id, input: .repetitions(weight: nil, repetitions: 8))
        XCTAssertEqual(model.restState?.remaining, 90)
        model.skipRest()
        await model.log(exerciseID: exercise.id, prescriptionID: prescription.id, input: .repetitions(weight: nil, repetitions: 9))
        XCTAssertNil(model.restState)
    }

    func testFirstSetLoggingPersistsBeforeDefaultRestStarts() async throws {
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        let exercise = WorkoutExercise(id: .new(), exerciseID: .new(), nameSnapshot: "New Exercise", prescriptions: [], loggedSets: [], restDuration: nil, skippedAt: nil)
        let next = EquilibriumFixtures.ready(id: "first-set-source").exercises[0]
        let fixture = Workout(id: .init(rawValue: "first-set-rest"), titleSnapshot: "New workout", exercises: [exercise, next], status: .ready, startedAt: nil, completedAt: nil, createdAt: .now, updatedAt: .now)
        try await repository.create(fixture)
        let model = WorkoutExecutionModel(workoutID: fixture.id, repository: repository, defaultRestDuration: 90)
        await model.activate()
        await model.logFirstSet(exerciseID: exercise.id, input: .repetitions(weight: nil, repetitions: 8))
        XCTAssertEqual(model.restState?.remaining, 90)
        let persisted = try await repository.workout(id: fixture.id)
        XCTAssertEqual(persisted?.exercises[0].loggedSets.first?.repetitions, 8)
    }
}

@MainActor
private final class RecordingHapticsClient: HapticsClient {
    private(set) var events: [HapticFeedback] = []
    func perform(_ feedback: HapticFeedback) { events.append(feedback) }
}

@MainActor
final class ExecutionPrimaryActionRegressionTests: XCTestCase {
    func testDesignSystemApprovedSemanticPalette() {
        let grove = EQTheme.grove
        assertColor(grove.canvas, hex: 0xFAFAFA)
        assertColor(grove.home.cardSurface, hex: 0xE0FB60)
        assertColor(grove.execution.foregroundSurface, hex: 0x133011)
        assertColor(grove.execution.restCanvas, hex: 0xFAFAFA)
        assertColor(EQTheme.orchid.execution.restForegroundSurface, hex: 0x6A476B)
        assertColor(grove.primaryText, hex: 0x1F1F1F)
        assertColor(grove.secondaryText, hex: 0x717171)
    }

    func testDesignSystemHomeTypographyUsesSemanticTextStyles() {
        XCTAssertEqual(EQTextStyle.screenTitle.size, 24)
        XCTAssertEqual(EQTextStyle.screenTitle.weight, .medium)
        XCTAssertEqual(EQTextStyle.cardHero.size, 28)
        XCTAssertEqual(EQTextStyle.cardHero.weight, .medium)
        XCTAssertEqual(EQTextStyle.caption.size, 15)
        XCTAssertEqual(EQTextStyle.caption.weight, .regular)
        XCTAssertEqual(EQTextStyle.sectionLabel.size, 12)
        XCTAssertEqual(EQTextStyle.sectionLabel.weight, .regular)
        XCTAssertEqual(EQTextStyle.listItemTitle.size, 16)
        XCTAssertEqual(EQTextStyle.listItemTitle.weight, .regular)
        XCTAssertEqual(EQTextStyle.carouselIndex.size, 300)
        XCTAssertEqual(EQTextStyle.carouselIndex.weight, .black)
        XCTAssertEqual(EQTextStyle.carouselIndex.design, .default)
        XCTAssertEqual(EQLayout.Home.carouselIndexOverflowFraction, 0.20)
        XCTAssertEqual(EQLayout.Home.carouselIndexVerticalOffset, 20)
        XCTAssertEqual(EQLayout.Home.heroTitleDateSpacing, 2)
    }

    func testDesignSystemLayoutAndRadiusRolesPreserveApprovedExecutionGeometry() {
        XCTAssertEqual(EQLayout.screenGutter, 24)
        XCTAssertEqual(EQLayout.cardInset, 24)
        XCTAssertEqual(EQLayout.sectionGap, 24)
        XCTAssertEqual(EQLayout.exerciseBlockGap, 24)
        XCTAssertEqual(EQLayout.controlGap, 12)
        XCTAssertEqual(EQRadius.card, 16)
        XCTAssertEqual(EQRadius.largeSurface, 32)
        XCTAssertEqual(EQRadius.button, 14)
        XCTAssertEqual(EQRadius.sheet, 32)
        XCTAssertEqual(EQLayout.ProgressIndicator.compactSize, 16)
        XCTAssertEqual(EQLayout.ProgressIndicator.lineWidth, 3)
        XCTAssertEqual(EQLayout.WorkoutExecution.walletInset, 24)
        XCTAssertEqual(EQLayout.WorkoutExecution.overviewHeaderBottomInset, 8)
        XCTAssertEqual(EQLayout.WorkoutExecution.overviewContentTopInset, 16)
        XCTAssertEqual(EQLayout.WorkoutExecution.primaryActionHeight, 56)
    }

    func testPrimaryCTAIdentityIsStableAcrossLoggingAndTimerStates() {
        let workoutID = WorkoutID(rawValue: "stable-primary-action")
        let loggingIdentity = ExecutionPrimaryActionIdentity(workoutID: workoutID)
        let timerIdentity = ExecutionPrimaryActionIdentity(workoutID: workoutID)
        let restIdentity = ExecutionPrimaryActionIdentity(workoutID: workoutID)

        XCTAssertEqual(loggingIdentity, timerIdentity)
        XCTAssertEqual(timerIdentity, restIdentity)
        XCTAssertEqual(
            loggingIdentity.accessibilityIdentifier,
            "execution-primary-action-\(workoutID.rawValue)"
        )
        XCTAssertNotEqual(
            loggingIdentity,
            ExecutionPrimaryActionIdentity(workoutID: WorkoutID(rawValue: "different-workout"))
        )
    }

    func testPrimaryCTAUsesOnePresentationAcrossExerciseWorkAndRest() {
        XCTAssertEqual(
            ExecutionPrimaryActionPhase.resolve(foregroundState: .exercise, hasExerciseAction: true),
            .exercise
        )
        XCTAssertEqual(
            ExecutionPrimaryActionPhase.resolve(foregroundState: .work, hasExerciseAction: false),
            .work
        )
        XCTAssertEqual(
            ExecutionPrimaryActionPhase.resolve(foregroundState: .rest, hasExerciseAction: false),
            .rest
        )
        XCTAssertEqual(
            ExecutionPrimaryActionPhase.resolve(foregroundState: .exercise, hasExerciseAction: false),
            .hidden
        )
        XCTAssertTrue(ExecutionPrimaryActionPhase.work.showsPauseControl)
        XCTAssertFalse(ExecutionPrimaryActionPhase.rest.showsPauseControl)
        XCTAssertEqual(ExecutionPrimaryActionPhase.work.primaryActionVariant, .filled)
        XCTAssertEqual(ExecutionPrimaryActionPhase.rest.primaryActionVariant, .outlined)
        XCTAssertEqual(
            ExecutionPrimaryActionPhase.work.timerControlWidth,
            EQLayout.WorkoutExecution.primaryActionTimerWidth
        )
        XCTAssertNil(ExecutionPrimaryActionPhase.exercise.timerControlWidth)
    }

    func testReduceMotionRemovesSpatialOffsetsWithoutChangingEndStates() {
        XCTAssertEqual(
            ExecutionMotionPolicy.offset(distance: 240, progress: 0, reduceMotion: true),
            0
        )
        XCTAssertEqual(
            ExecutionMotionPolicy.offset(distance: 240, progress: 0, reduceMotion: false),
            240
        )
        XCTAssertEqual(
            ExecutionMotionPolicy.offset(distance: 240, progress: 0.5, reduceMotion: false),
            120
        )
        XCTAssertEqual(
            ExecutionMotionPolicy.offset(distance: 240, progress: 1, reduceMotion: false),
            0
        )
    }

    func testCompletedDisclosureDefaultsCollapsedAndUsesExerciseCountOnly() {
        var presentation = ExecutionCompletedSectionPresentation()

        XCTAssertFalse(presentation.isExpanded)
        XCTAssertEqual(
            ExecutionCompletedSectionPresentation.title(completedCount: 4),
            "COMPLETED [4]"
        )
        XCTAssertFalse(ExecutionCompletedSectionPresentation.title(completedCount: 4).contains("/"))

        presentation.toggle()
        XCTAssertTrue(presentation.isExpanded)
        presentation.toggle()
        XCTAssertFalse(presentation.isExpanded)

        XCTAssertFalse(
            ExecutionCompletedSectionPresentation().isExpanded,
            "Re-entering execution creates a collapsed Completed section"
        )
    }

    func testCompletedDisclosureMotionUsesTrailingSpringCadence() {
        XCTAssertEqual(ExecutionCompletedSectionMotion.insertionOffset, 18)
        XCTAssertEqual(ExecutionCompletedSectionMotion.expansionStagger, 0.055)
        XCTAssertEqual(ExecutionCompletedSectionMotion.collapseStagger, 0.035)
        XCTAssertEqual(ExecutionCompletedSectionMotion.expansionResponse, 0.40)
        XCTAssertEqual(ExecutionCompletedSectionMotion.expansionDampingFraction, 0.78)
        XCTAssertEqual(ExecutionCompletedSectionMotion.collapseResponse, 0.30)
        XCTAssertEqual(ExecutionCompletedSectionMotion.collapseDampingFraction, 0.84)
        XCTAssertEqual(
            ExecutionCompletedSectionMotion.stepDelay(reduceMotion: false, expanding: true),
            0.055
        )
        XCTAssertEqual(
            ExecutionCompletedSectionMotion.stepDelay(reduceMotion: false, expanding: false),
            0.035
        )
        XCTAssertEqual(
            ExecutionCompletedSectionMotion.stepDelay(reduceMotion: true, expanding: true),
            0
        )
    }

    func testTimerFooterReservesViewportAroundDesignSystemActionHeight() {
        let walletHeight = EQLayout.WorkoutExecution.restCardHeight + EQLayout.minimumTouch
        let focusedTop = EQLayout.minimumTouch + EQSpacing.md - EQSpacing.xxs
        let foregroundCardHeight = walletHeight - focusedTop
        let headerHeight = EQLayout.minimumTouch + EQSpacing.xxs

        let footerHeight = ExecutionPrimaryActionLayout.footerHeight(
            isVisible: true,
            controlHeight: EQLayout.WorkoutExecution.primaryActionHeight,
            topInset: EQLayout.WorkoutExecution.primaryActionTopInset,
            bottomInset: EQLayout.WorkoutExecution.primaryActionBottomInset,
            trailingControlHeight: EQLayout.minimumTouch
        )
        let viewportHeight = ExecutionPrimaryActionLayout.scrollViewportHeight(
            cardHeight: foregroundCardHeight,
            headerHeight: headerHeight,
            footerHeight: footerHeight
        )

        XCTAssertEqual(EQLayout.WorkoutExecution.primaryActionHeight, 56)
        XCTAssertEqual(EQLayout.WorkoutExecution.primaryActionTimerWidth, 152)
        XCTAssertEqual(EQLayout.WorkoutExecution.walletBorderWidth, 2)
        XCTAssertEqual(EQLayout.WorkoutExecution.workCardExternalTopGap, 2)
        XCTAssertEqual(EQLayout.WorkoutExecution.primaryActionTopInset, 24)
        XCTAssertEqual(EQLayout.WorkoutExecution.primaryActionHorizontalPadding, EQSpacing.lg)
        XCTAssertGreaterThanOrEqual(EQLayout.minimumTouch, 44)
        XCTAssertEqual(EQLayout.WorkoutExecution.primaryActionBottomInset, 24)
        XCTAssertEqual(EQLayout.exerciseBlockGap, 24)
        XCTAssertEqual(EQLayout.WorkoutExecution.completedSectionTopSpacing, 48)
        XCTAssertEqual(EQLayout.WorkoutExecution.titleToSetsSpacing, 8)
        XCTAssertEqual(EQLayout.WorkoutExecution.loggedSetSpacing, 4)
        XCTAssertEqual(
            footerHeight,
            EQLayout.WorkoutExecution.primaryActionTopInset
                + EQLayout.WorkoutExecution.primaryActionHeight
                + EQLayout.WorkoutExecution.primaryActionBottomInset
        )
        XCTAssertGreaterThan(viewportHeight, 0)
        XCTAssertEqual(headerHeight + viewportHeight + footerHeight, foregroundCardHeight, accuracy: 0.001)
    }

    func testTimerContentViewportStaysFixedAsCountdownDigitsChangeWidth() {
        let cardHeight: CGFloat = 168
        let headerHeight: CGFloat = 48
        let remainingValues: [TimeInterval] = [5, 4, 3, 60, 59, 600]
        let timerTexts = remainingValues.map(ExecutionTimerFormatting.durationText(for:))
        XCTAssertEqual(timerTexts, ["00:05", "00:04", "00:03", "01:00", "00:59", "10:00"])
        XCTAssertTrue(timerTexts.allSatisfy { $0.count == 5 })
        XCTAssertTrue(timerTexts.allSatisfy { Array($0)[2] == ":" })

        let footerHeight = ExecutionPrimaryActionLayout.footerHeight(
            isVisible: true,
            controlHeight: EQLayout.WorkoutExecution.primaryActionHeight,
            bottomInset: EQSpacing.sm
        )

        for _ in timerTexts {
            let viewportHeight = ExecutionPrimaryActionLayout.scrollViewportHeight(
                cardHeight: cardHeight,
                headerHeight: headerHeight,
                footerHeight: footerHeight
            )
            XCTAssertEqual(headerHeight + viewportHeight, cardHeight - footerHeight, accuracy: 0.001)
        }
    }

    func testTimerFormattingKeepsColumnsStableForRollingCountdownTransitions() {
        let transitions: [(from: TimeInterval, to: TimeInterval, changedColumns: Set<Int>)] = [
            (30, 29, [3, 4]),
            (27, 26, [4]),
            (21, 20, [4]),
            (20, 19, [3, 4]),
            (60, 59, [1, 3, 4]),
            (10, 9, [3, 4]),
            (3, 2, [4]),
            (2, 1, [4]),
            (1, 0, [4])
        ]

        for transition in transitions {
            let oldCharacters = Array(ExecutionTimerFormatting.durationText(for: transition.from))
            let newCharacters = Array(ExecutionTimerFormatting.durationText(for: transition.to))
            XCTAssertEqual(oldCharacters.count, newCharacters.count)
            XCTAssertEqual(oldCharacters[2], ":")
            XCTAssertEqual(newCharacters[2], ":")

            let changedColumns = Set(oldCharacters.indices.filter {
                oldCharacters[$0] != newCharacters[$0]
            })
            XCTAssertEqual(changedColumns, transition.changedColumns)
        }
    }

    func testForegroundContentAndFooterAnchorsStayFixedAcrossPresentationHeights() {
        let headerHeight: CGFloat = 64
        let naturalFooterHeight = ExecutionPrimaryActionLayout.footerHeight(
            isVisible: true,
            controlHeight: EQLayout.WorkoutExecution.primaryActionHeight,
            topInset: EQLayout.WorkoutExecution.primaryActionTopInset,
            bottomInset: EQLayout.WorkoutExecution.primaryActionBottomInset,
            trailingControlHeight: EQLayout.minimumTouch
        )
        let presentations: [(cardHeight: CGFloat, footerHeight: CGFloat)] = [
            (640, naturalFooterHeight),
            (180, naturalFooterHeight),
            (180, 0)
        ]

        for presentation in presentations {
            let anchors = ExecutionPrimaryActionLayout.foregroundAnchors(
                cardHeight: presentation.cardHeight,
                headerHeight: headerHeight,
                footerHeight: presentation.footerHeight
            )
            XCTAssertEqual(anchors.contentTop, headerHeight, accuracy: 0.001)
            XCTAssertEqual(anchors.contentBottom, anchors.footerTop, accuracy: 0.001)
            XCTAssertEqual(anchors.footerBottom, presentation.cardHeight, accuracy: 0.001)
            XCTAssertEqual(anchors.footerBottom - anchors.footerTop, presentation.footerHeight, accuracy: 0.001)
        }

        XCTAssertEqual(
            ExecutionPrimaryActionLayout.titleOnlyViewportHeight(
                titleHeight: 30,
                availableHeight: 68,
                minimumTitleHeight: 44,
                topInset: EQSpacing.xxs
            ),
            48,
            accuracy: 0.001
        )
        XCTAssertEqual(
            ExecutionPrimaryActionLayout.titleOnlyViewportHeight(
                titleHeight: 58,
                availableHeight: 68,
                minimumTitleHeight: 44,
                topInset: EQSpacing.xxs
            ),
            62,
            accuracy: 0.001
        )
    }

    func testWalletSurfaceGeometryIsContinuousInBothFocusDirections() {
        let walletHeight: CGFloat = 640
        let focusedTop: CGFloat = 56
        let compactHeight: CGFloat = 180
        let overview = ExecutionWalletSurfaceLayout.resolve(
            walletHeight: walletHeight,
            focusedTop: focusedTop,
            compactHeight: compactHeight,
            focusProgress: 0
        )
        let focused = ExecutionWalletSurfaceLayout.resolve(
            walletHeight: walletHeight,
            focusedTop: focusedTop,
            compactHeight: compactHeight,
            focusProgress: 1
        )

        XCTAssertEqual(overview.top, walletHeight - compactHeight, accuracy: 0.001)
        XCTAssertEqual(overview.height, compactHeight, accuracy: 0.001)
        XCTAssertEqual(focused.top, focusedTop, accuracy: 0.001)
        XCTAssertEqual(focused.height, walletHeight - focusedTop, accuracy: 0.001)

        let samples = stride(from: 0.0, through: 1.0, by: 0.1).map { progress in
            ExecutionWalletSurfaceLayout.resolve(
                walletHeight: walletHeight,
                focusedTop: focusedTop,
                compactHeight: compactHeight,
                focusProgress: progress
            )
        }
        for (start, end) in zip(samples, samples.dropFirst()) {
            XCTAssertLessThanOrEqual(end.top, start.top)
            XCTAssertGreaterThanOrEqual(end.height, start.height)
            XCTAssertLessThan(abs(end.top - start.top), 100)
            XCTAssertLessThan(abs(end.height - start.height), 100)
        }

        let reverseSamples = stride(from: 1.0, through: 0.0, by: -0.1).map { progress in
            ExecutionWalletSurfaceLayout.resolve(
                walletHeight: walletHeight,
                focusedTop: focusedTop,
                compactHeight: compactHeight,
                focusProgress: progress
            )
        }
        for (start, end) in zip(reverseSamples, reverseSamples.dropFirst()) {
            XCTAssertGreaterThanOrEqual(end.top, start.top)
            XCTAssertLessThanOrEqual(end.height, start.height)
        }
    }

    func testRestCompactCardUsesFocusedAnchorToExposeOnlyExerciseHeader() {
        let walletHeight = EQLayout.WorkoutExecution.restCardHeight + EQLayout.minimumTouch + EQSpacing.md
        let focusedTop = EQLayout.minimumTouch + EQSpacing.md - EQSpacing.xs
        let compactHeight = walletHeight - focusedTop

        let rest = ExecutionWalletSurfaceLayout.resolve(
            walletHeight: walletHeight,
            focusedTop: focusedTop,
            compactHeight: compactHeight,
            focusProgress: 0
        )

        XCTAssertEqual(rest.top, focusedTop, accuracy: 0.001)
        XCTAssertEqual(rest.height, walletHeight - focusedTop, accuracy: 0.001)
        XCTAssertGreaterThan(
            rest.height,
            EQLayout.minimumTouch
                + EQSpacing.xxs
                + EQLayout.WorkoutExecution.primaryActionTopInset
                + EQLayout.WorkoutExecution.primaryActionHeight
                + EQLayout.WorkoutExecution.primaryActionBottomInset
        )
    }

    func testExpandedRestCapsTimerAtQuarterOfAvailableHeight() {
        XCTAssertEqual(EQLayout.WorkoutExecution.headerWalletSpacing, 40)

        let containerHeight: CGFloat = 800
        let compactWalletHeight: CGFloat = 240

        let collapsed = ExecutionTimerWalletLayout.walletHeight(
            containerHeight: containerHeight,
            compactWalletHeight: compactWalletHeight,
            timerVisibilityProgress: 1,
            restExpansionProgress: 0
        )
        let expanded = ExecutionTimerWalletLayout.walletHeight(
            containerHeight: containerHeight,
            compactWalletHeight: compactWalletHeight,
            timerVisibilityProgress: 1,
            restExpansionProgress: 1
        )

        XCTAssertEqual(collapsed, compactWalletHeight, accuracy: 0.001)
        XCTAssertEqual(expanded, containerHeight * 0.75, accuracy: 0.001)
        XCTAssertLessThanOrEqual(
            containerHeight - expanded,
            containerHeight * ExecutionTimerWalletLayout.maximumExpandedTimerFraction
        )

        let focusedTop = EQLayout.minimumTouch + EQSpacing.md - EQSpacing.xs
        let restCardHeight = compactWalletHeight - focusedTop
        let collapsedCard = ExecutionWalletSurfaceLayout.resolve(
            walletHeight: collapsed,
            focusedTop: focusedTop,
            compactHeight: restCardHeight,
            focusProgress: 0
        )
        let expandedListCard = ExecutionWalletSurfaceLayout.resolve(
            walletHeight: expanded,
            focusedTop: focusedTop,
            compactHeight: restCardHeight,
            focusProgress: 0
        )

        XCTAssertEqual(collapsedCard.height, restCardHeight, accuracy: 0.001)
        XCTAssertEqual(expandedListCard.height, restCardHeight, accuracy: 0.001)
        XCTAssertGreaterThan(expandedListCard.top, collapsedCard.top)
    }

    func testKeyboardShrinksWalletAboveKeyboardKeepingItsTop() {
        let keyboard = CGRect(x: 0, y: 500, width: 393, height: 352)

        let overlap = ExecutionKeyboardLayout.overlap(keyboardFrame: keyboard)

        XCTAssertEqual(overlap, 352, accuracy: 0.001)
        XCTAssertEqual(ExecutionKeyboardLayout.walletHeight(base: 700, overlap: overlap, minimum: 200), 348, accuracy: 0.001)
        XCTAssertEqual(ExecutionKeyboardLayout.walletHeight(base: 700, overlap: 0, minimum: 200), 700, accuracy: 0.001)
        XCTAssertEqual(ExecutionKeyboardLayout.walletHeight(base: 400, overlap: 352, minimum: 200), 200, accuracy: 0.001)
        XCTAssertEqual(
            ExecutionKeyboardLayout.overlap(keyboardFrame: .null),
            0,
            accuracy: 0.001
        )
    }

    func testTimerLayoutTransitionsContinuouslyAsItsHeightChanges() {
        XCTAssertEqual(
            ExecutionTimerResponsiveLayout.compactProgress(for: 220),
            1,
            accuracy: 0.001
        )
        XCTAssertEqual(
            ExecutionTimerResponsiveLayout.compactProgress(for: 270),
            0.5,
            accuracy: 0.001
        )
        XCTAssertEqual(
            ExecutionTimerResponsiveLayout.compactProgress(for: 320),
            0,
            accuracy: 0.001
        )
        XCTAssertEqual(
            ExecutionTimerResponsiveLayout.compactProgress(for: 180),
            1,
            accuracy: 0.001
        )
        XCTAssertEqual(
            ExecutionTimerResponsiveLayout.compactProgress(for: 420),
            0,
            accuracy: 0.001
        )
    }

    private func assertColor(
        _ color: Color,
        hex: UInt32,
        file: StaticString = #filePath,
        line: UInt = #line
    ) {
        var red: CGFloat = 0
        var green: CGFloat = 0
        var blue: CGFloat = 0
        var alpha: CGFloat = 0
        XCTAssertTrue(
            UIColor(color).getRed(&red, green: &green, blue: &blue, alpha: &alpha),
            file: file,
            line: line
        )
        XCTAssertEqual(red, CGFloat((hex >> 16) & 0xFF) / 255, accuracy: 0.001, file: file, line: line)
        XCTAssertEqual(green, CGFloat((hex >> 8) & 0xFF) / 255, accuracy: 0.001, file: file, line: line)
        XCTAssertEqual(blue, CGFloat(hex & 0xFF) / 255, accuracy: 0.001, file: file, line: line)
        XCTAssertEqual(alpha, 1, accuracy: 0.001, file: file, line: line)
    }
}

final class ExecutionForegroundEntryTests: XCTestCase {
    func testMinimizedCardStaysHiddenUntilWalletIsFullSize() {
        for progress: CGFloat in [0, 0.5, 0.9, 0.96, 0.998] {
            XCTAssertFalse(ExecutionForegroundEntry.walletIsFullSize(progress))
            XCTAssertEqual(
                ExecutionForegroundEntry.arrival(walletTransitionProgress: progress, entryProgress: 0),
                0,
                "card must not arrive while the wallet is still expanding (progress \(progress))"
            )
        }
        XCTAssertTrue(ExecutionForegroundEntry.walletIsFullSize(1))
    }

    func testCardArrivalFollowsItsOwnEntryAnimationOnceWalletIsFullSize() {
        XCTAssertEqual(ExecutionForegroundEntry.arrival(walletTransitionProgress: 1, entryProgress: 0), 0)
        XCTAssertEqual(ExecutionForegroundEntry.arrival(walletTransitionProgress: 1, entryProgress: 0.5), 0.5)
        XCTAssertEqual(ExecutionForegroundEntry.arrival(walletTransitionProgress: 1, entryProgress: 1), 1)
    }

    func testEntryWaitsThirtyMilliseconds() {
        XCTAssertEqual(ExecutionForegroundEntry.delay, 0.03, accuracy: 0.0001)
    }

    func testCardRidesWalletOutOnExit() {
        XCTAssertEqual(ExecutionForegroundEntry.arrival(walletTransitionProgress: 1, entryProgress: 1), 1)
        XCTAssertLessThan(ExecutionForegroundEntry.arrival(walletTransitionProgress: 0.85, entryProgress: 1), 1)
        XCTAssertEqual(ExecutionForegroundEntry.arrival(walletTransitionProgress: 0.5, entryProgress: 1), 0)
    }

    func testExpandedCardSlidesFullyOutOfWallet() {
        let expanded = ExecutionForegroundEntry.slideDistance(walletHeight: 700, cardTop: 40, gap: 12)
        XCTAssertEqual(expanded, 672, "expanded card must clear the wallet bottom, not just the compact height")
        let compact = ExecutionForegroundEntry.slideDistance(walletHeight: 700, cardTop: 580, gap: 12)
        XCTAssertEqual(compact, 132)
    }
}

final class ExecutionTimingCardHeightTests: XCTestCase {
    func testTimingCardFitsHeaderTitleAndFooter() {
        let footer = EQLayout.WorkoutExecution.primaryActionTopInset
            + EQLayout.WorkoutExecution.primaryActionHeight
            + EQLayout.WorkoutExecution.primaryActionBottomInset
        let header = EQLayout.minimumTouch + EQSpacing.xxs
        let oneLine = ExecutionTimerWalletLayout.minimumTimingCardHeight(titleHeight: 0)
        XCTAssertGreaterThanOrEqual(oneLine, header + EQSpacing.xxs + 28 + footer)
        XCTAssertEqual(
            ExecutionTimerWalletLayout.minimumTimingCardHeight(titleHeight: 60),
            header + EQSpacing.xxs + 60 + footer,
            "two-line titles must grow the card"
        )
    }
}

final class BarbellLoadTests: XCTestCase {
    func testPerSideSubtractsBarAndSplitsRemainder() {
        XCTAssertEqual(BarbellLoad.legend("160", unit: .pounds), "57.5 lb per side")
        XCTAssertEqual(BarbellLoad.legend("135", unit: .pounds), "45 lb per side")
        XCTAssertEqual(BarbellLoad.legend("60,5", unit: .kilograms), "20.25 kg per side")
    }

    func testNoLegendAtOrBelowBarWeight() {
        XCTAssertNil(BarbellLoad.legend("45", unit: .pounds))
        XCTAssertNil(BarbellLoad.legend("40", unit: .pounds))
        XCTAssertNil(BarbellLoad.legend("20", unit: .kilograms))
        XCTAssertNil(BarbellLoad.legend("", unit: .pounds))
    }
}
