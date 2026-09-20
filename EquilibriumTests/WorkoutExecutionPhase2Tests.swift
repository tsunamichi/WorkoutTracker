import XCTest
import SwiftData
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
final class WorkoutExecutionNavigationStateTests: XCTestCase {
    func testWalletPresentationDefaultsToFocusedAndCanReturnFromOverview() {
        let presentation = ExecutionWalletPresentation()
        XCTAssertEqual(presentation.mode, .focusedExercise)

        presentation.showExerciseOverview()
        XCTAssertEqual(presentation.mode, .exerciseOverview)

        presentation.showFocusedExercise()
        XCTAssertEqual(presentation.mode, .focusedExercise)
    }

    func testCanonicalRestDerivesForegroundAndForcesFocusedWalletWithoutMutatingExecution() async throws {
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        let fixture = EquilibriumFixtures.mixed(id: "rest-foreground")
        try await repository.create(fixture)
        let model = WorkoutExecutionModel(workoutID: fixture.id, repository: repository)
        let presentation = ExecutionWalletPresentation()
        await model.activate()
        let canonicalExerciseID = model.currentExercise?.id

        presentation.showExerciseOverview()
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
        XCTAssertEqual(presentation.resolvedMode(for: model.foregroundState), .focusedExercise)

        presentation.synchronize(with: model.foregroundState)
        XCTAssertEqual(presentation.mode, .focusedExercise)
        XCTAssertEqual(model.workout, canonicalAfterLogging)

        model.skipRest()
        XCTAssertEqual(model.foregroundState, .exercise)
        XCTAssertEqual(model.timer.state, .idle)
        XCTAssertNil(model.restState)
        XCTAssertEqual(model.currentExercise?.id, canonicalExerciseID)
        XCTAssertEqual(model.workout, canonicalAfterLogging)
        XCTAssertEqual(presentation.resolvedMode(for: model.foregroundState), .focusedExercise)
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
        model.focus(fixture.exercises[2].id)
        presentation.showFocusedExercise()

        XCTAssertEqual(model.currentExercise?.id, fixture.exercises[2].id)
        XCTAssertEqual(model.completedExercises.map(\.id), [fixture.exercises[0].id])
        XCTAssertEqual(model.upNextExercises.map(\.id), [fixture.exercises[1].id, fixture.exercises[3].id])
        let persisted = try await repository.workout(id: fixture.id)
        XCTAssertEqual(persisted?.exercises.map(\.id), fixture.exercises.map(\.id))
        XCTAssertEqual(presentation.mode, .focusedExercise)
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

    func testRestStartsCountsDownSkipsAndDoesNotOwnPersistence() async throws {
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        let fixture = EquilibriumFixtures.mixed(id: "rest")
        try await repository.create(fixture)
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
