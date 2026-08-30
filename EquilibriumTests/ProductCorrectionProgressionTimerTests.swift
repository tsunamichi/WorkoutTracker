import XCTest
import SwiftData
@testable import Equilibrium

@MainActor final class ProductCorrectionProgressionTimerTests: XCTestCase {
    func testCanonicalProfilesAndStableIdentityAssignment() {
        XCTAssertEqual(AutoProgressionProfile.upper.parameters?.repetitionRange, 5...8); XCTAssertEqual(AutoProgressionProfile.upper.parameters?.weightIncrement.pounds, 2.5)
        XCTAssertEqual(AutoProgressionProfile.lower.parameters?.repetitionRange, 5...8); XCTAssertEqual(AutoProgressionProfile.lower.parameters?.weightIncrement.pounds, 5)
        XCTAssertEqual(AutoProgressionProfile.accessories.parameters?.repetitionRange, 10...20); XCTAssertEqual(AutoProgressionProfile.accessories.parameters?.weightIncrement.pounds, 2.5)
        XCTAssertNil(AutoProgressionProfile.none.parameters)
        let stable = ExerciseID(rawValue: "stable-id"), sameName = ExerciseID(rawValue: "different-id")
        var configuration = FixtureDefaults.progression; configuration.assign(.upper, to: stable); configuration.assign(.none, to: sameName)
        XCTAssertEqual(ProgressionRuleResolver.resolve(exerciseID: stable, configuration: configuration)?.parameters, AutoProgressionProfile.upper.parameters)
        XCTAssertNil(ProgressionRuleResolver.resolve(exerciseID: sameName, configuration: configuration))
    }

    func testTimerCreationValidationAndDeterministicTransitions() {
        let value = StandaloneTimerConfiguration(name: "Intervals")
        XCTAssertTrue(value.isValid); XCTAssertEqual(value.moveDuration, 30); XCTAssertEqual(value.exerciseRestDuration, 30); XCTAssertEqual(value.exercisesPerRound, 3); XCTAssertEqual(value.rounds, 1); XCTAssertEqual(value.roundRestDuration, 30)
        XCTAssertFalse(StandaloneTimerConfiguration(name: "", moveDuration: 5, exerciseRestDuration: 5, exercisesPerRound: 1, rounds: 1, roundRestDuration: 5).isValid)
        var now: TimeInterval = 0
        let configuration = StandaloneTimerConfiguration(name: "Test", moveDuration: 5, exerciseRestDuration: 5, exercisesPerRound: 2, rounds: 2, roundRestDuration: 5)
        let runner = StandaloneIntervalTimer(configuration: configuration, countdown: CountdownTimer(now: { now }))
        runner.play(); XCTAssertEqual(runner.phase, .move); XCTAssertEqual(runner.exercise, 1); XCTAssertEqual(runner.round, 1)
        now += 5; runner.refresh(); XCTAssertEqual(runner.phase, .exerciseRest)
        now += 5; runner.refresh(); XCTAssertEqual(runner.phase, .move); XCTAssertEqual(runner.exercise, 2)
        now += 5; runner.refresh(); XCTAssertEqual(runner.phase, .roundRest)
        now += 5; runner.refresh(); XCTAssertEqual(runner.round, 2); XCTAssertEqual(runner.exercise, 1); XCTAssertEqual(runner.phase, .move)
        now += 20; XCTAssertTrue(runner.refresh()); XCTAssertEqual(runner.state, .completed); XCTAssertEqual(runner.completionFeedbackCount, 1)
        XCTAssertFalse(runner.refresh()); XCTAssertEqual(runner.completionFeedbackCount, 1)
    }

    func testPauseResumeSkipResetAndBackgroundReconciliation() {
        var now: TimeInterval = 0
        let runner = StandaloneIntervalTimer(configuration: .init(name: "Test", moveDuration: 5, exerciseRestDuration: 5, exercisesPerRound: 2, rounds: 1, roundRestDuration: 5), countdown: CountdownTimer(now: { now }))
        runner.play(); now = 2; runner.refresh(); runner.pause(); now = 50; runner.refresh(); XCTAssertEqual(runner.remaining, 3)
        runner.resume(); runner.skip(); XCTAssertEqual(runner.phase, .exerciseRest)
        runner.skip(); XCTAssertEqual(runner.exercise, 2); XCTAssertEqual(runner.phase, .move)
        runner.reset(); XCTAssertEqual(runner.state, .ready); XCTAssertEqual(runner.exercise, 1); XCTAssertEqual(runner.round, 1)
        runner.play(); now += 20; XCTAssertTrue(runner.refresh()); XCTAssertEqual(runner.state, .completed)
        runner.restart(); XCTAssertEqual(runner.state, .running); XCTAssertEqual(runner.phase, .move)
    }

    func testTimerExitConfirmationPolicy() {
        XCTAssertFalse(StandaloneTimerExitPolicy.requiresConfirmation(for: .ready))
        XCTAssertTrue(StandaloneTimerExitPolicy.requiresConfirmation(for: .running))
        XCTAssertTrue(StandaloneTimerExitPolicy.requiresConfirmation(for: .paused))
        XCTAssertFalse(StandaloneTimerExitPolicy.requiresConfirmation(for: .completed))
    }

    func testTimerConfigurationPersistenceIsSeparateFromWorkoutHistory() async throws {
        let suite = "timer-tests-\(UUID().uuidString)"; let defaults = try XCTUnwrap(UserDefaults(suiteName: suite)); defaults.removePersistentDomain(forName: suite)
        let store = UserDefaultsStandaloneTimerStore(defaults: defaults, key: "timers"); let value = StandaloneTimerConfiguration(name: "Saved")
        store.save(value); XCTAssertEqual(store.configurations(), [value])
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true)); let before = try await repository.allWorkouts(); XCTAssertTrue(before.isEmpty)
        let runner = StandaloneIntervalTimer(configuration: value); runner.play(); runner.skip(); runner.reset()
        let after = try await repository.allWorkouts(); XCTAssertTrue(after.isEmpty)
    }

    func testEditingSavedTimerPreservesIdentityAndDoesNotDuplicate() throws {
        let suite = "timer-edit-tests-\(UUID().uuidString)"; let defaults = try XCTUnwrap(UserDefaults(suiteName: suite)); defaults.removePersistentDomain(forName: suite)
        let store = UserDefaultsStandaloneTimerStore(defaults: defaults, key: "timers")
        let original = StandaloneTimerConfiguration(id: "stable-timer", name: "Original", moveDuration: 20, exerciseRestDuration: 25, exercisesPerRound: 3, rounds: 2, roundRestDuration: 30, createdAt: .init(timeIntervalSince1970: 10))
        store.save(original)
        let edited = StandaloneTimerConfiguration(id: original.id, name: "Edited", moveDuration: 40, exerciseRestDuration: 35, exercisesPerRound: 4, rounds: 5, roundRestDuration: 60, createdAt: original.createdAt)
        store.save(edited)
        XCTAssertEqual(store.configurations(), [edited])
        XCTAssertEqual(store.configurations().first?.createdAt, original.createdAt)
    }

    func testOccurrenceSettingsSwapAndRemovePersistWithCorrectIdentity() async throws {
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true)); let fixture = EquilibriumFixtures.ready(id: "settings")
        try await repository.create(fixture); let model = WorkoutExecutionModel(workoutID: fixture.id, repository: repository, progressionRepository: repository, exerciseRepository: repository); await model.activate()
        let occurrence = try XCTUnwrap(model.workout?.exercises[0])
        let didUpdate = await model.updateExerciseSettings(exerciseID: occurrence.id, timeBased: true, twoSided: true, progression: .lower); XCTAssertTrue(didUpdate)
        let loaded = try await repository.workout(id: fixture.id); let configured = try XCTUnwrap(loaded?.exercises[0]); XCTAssertTrue(configured.isTimeBased); XCTAssertTrue(configured.isTwoSided); let progression = try await repository.progressionConfiguration(); XCTAssertEqual(progression.assignments[occurrence.exerciseID], .lower)
        let replacement = ExerciseDefinition(id: .init(rawValue: "replacement"), name: "Replacement", normalizedName: "replacement", aliases: [], equipment: nil, category: nil, isCustom: true, archivedAt: nil)
        try await repository.saveExercise(replacement); let didSwap = await model.swapExercise(occurrenceID: occurrence.id, with: replacement); XCTAssertTrue(didSwap)
        let swapped = try XCTUnwrap(model.workout?.exercises[0]); XCTAssertEqual(swapped.id, occurrence.id); XCTAssertEqual(swapped.exerciseID, replacement.id); XCTAssertTrue(swapped.loggedSets.isEmpty)
        let didRemove = await model.removeExercise(occurrence.id); XCTAssertTrue(didRemove); XCTAssertTrue(model.workout?.exercises.isEmpty == true)
    }

    func testTimeBasedToggleLogsWeightedDurationAndSurvivesRelaunchIntoPerformance() async throws {
        let url = TestSupport.temporaryStoreURL()
        var container: ModelContainer? = try PersistenceController.makeContainer(storageURL: url)
        var repository: SwiftDataRepository? = SwiftDataRepository(container: container!)
        let fixture = EquilibriumFixtures.ready(id: "timed-toggle")
        try await repository!.create(fixture)
        let model = WorkoutExecutionModel(workoutID: fixture.id, repository: repository!, historyRepository: repository!)
        await model.activate()
        let occurrence = try XCTUnwrap(model.workout?.exercises[0])
        let didToggle = await model.updateExerciseSettings(exerciseID: occurrence.id, timeBased: true, twoSided: false, progression: .none)
        XCTAssertTrue(didToggle)
        let timed = try XCTUnwrap(model.workout?.exercises[0])
        for prescription in timed.prescriptions {
            await model.log(exerciseID: timed.id, prescriptionID: prescription.id, input: .duration(weight: .init(pounds: 25), seconds: 42))
        }
        XCTAssertEqual(model.workout?.status, .completed)
        XCTAssertTrue(model.workout?.exercises[0].loggedSets.allSatisfy { $0.duration == 42 && $0.repetitions == nil && $0.weight?.pounds == 25 } == true)
        repository = nil; container = nil
        let reopened = SwiftDataRepository(container: try PersistenceController.makeContainer(storageURL: url))
        let reopenedWorkout = try await reopened.workout(id: fixture.id)
        let persisted = try XCTUnwrap(reopenedWorkout)
        XCTAssertEqual(persisted.status, .completed)
        XCTAssertEqual(persisted.exercises[0].loggedSets.map(\.duration), [42, 42, 42])
        let performance = try await reopened.exercisePerformance(exerciseID: occurrence.exerciseID)
        XCTAssertEqual(performance.activeMetricFamily, .duration)
        XCTAssertEqual(performance.latestOccurrence?.sets.map(\.duration), [42, 42, 42])
    }

    func testSwapUsesReplacementLatestHistoryWithFreshIdentityAndNoOutgoingValues() async throws {
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        let replacementID = ExerciseID(rawValue: "replacement-history")
        let replacement = ExerciseDefinition(id: replacementID, name: "Replacement", normalizedName: "replacement", aliases: [], equipment: nil, category: nil, isCustom: true, archivedAt: nil)
        try await repository.saveExercise(replacement)
        let historicalPrescription = SetPrescription(id: .init(rawValue: "b-prescription"), target: .repetitions(range: 4...4), suggestedWeight: .init(pounds: 225))
        let historicalLog = LoggedSet(id: .init(rawValue: "b-log"), prescriptionID: historicalPrescription.id, weight: .init(pounds: 225), repetitions: 4, duration: nil, completedAt: .init(timeIntervalSince1970: 20))
        let historicalExercise = WorkoutExercise(id: .init(rawValue: "b-occurrence"), exerciseID: replacementID, nameSnapshot: replacement.name, prescriptions: [historicalPrescription], loggedSets: [historicalLog], restDuration: 60, skippedAt: nil)
        let history = Workout(id: .init(rawValue: "b-history"), titleSnapshot: "History", exercises: [historicalExercise], status: .completed, startedAt: .init(timeIntervalSince1970: 10), completedAt: .init(timeIntervalSince1970: 30), createdAt: .init(timeIntervalSince1970: 1), updatedAt: .init(timeIntervalSince1970: 30))
        var active = EquilibriumFixtures.inProgress(id: "swap-active")
        active.exercises[0].loggedSets[0].weight = .init(pounds: 95); active.exercises[0].loggedSets[0].repetitions = 10
        try await repository.materializeAtomically([history, active])
        let model = WorkoutExecutionModel(workoutID: active.id, repository: repository, historyRepository: repository, progressionRepository: repository)
        await model.activate()
        let outgoing = try XCTUnwrap(model.workout?.exercises[0])
        let didSwap = await model.swapExercise(occurrenceID: outgoing.id, with: replacement)
        XCTAssertTrue(didSwap)
        let swapped = try XCTUnwrap(model.workout?.exercises[0])
        XCTAssertEqual(swapped.id, outgoing.id)
        XCTAssertEqual(swapped.exerciseID, replacementID)
        XCTAssertTrue(swapped.loggedSets.isEmpty)
        XCTAssertEqual(swapped.prescriptions.first?.suggestedWeight?.pounds, 225)
        guard case .repetitions(let range) = try XCTUnwrap(swapped.prescriptions.first).target else { return XCTFail("Expected replacement repetitions") }
        XCTAssertEqual(range, 4...4)
        XCTAssertNotEqual(swapped.prescriptions.first?.id, historicalPrescription.id)
    }

    func testAutomaticProgressionPrefillIsDeterministicAcrossReopen() async throws {
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        var history = EquilibriumFixtures.completed(id: "progression-history")
        for index in history.exercises[0].loggedSets.indices { history.exercises[0].loggedSets[index].weight = .init(pounds: 100); history.exercises[0].loggedSets[index].repetitions = 8 }
        let active = EquilibriumFixtures.ready(id: "progression-active")
        try await repository.materializeAtomically([history, active])
        var configuration = try await repository.progressionConfiguration(); configuration.assign(.upper, to: active.exercises[0].exerciseID); try await repository.saveProgressionConfiguration(configuration)
        let first = WorkoutExecutionModel(workoutID: active.id, repository: repository, historyRepository: repository, progressionRepository: repository)
        await first.activate()
        let firstSuggestion = first.suggestion(for: try XCTUnwrap(first.workout?.exercises[0]))
        XCTAssertEqual(firstSuggestion?.suggestedWeight?.pounds, 102.5)
        XCTAssertEqual(firstSuggestion?.targetRepetitions?.lowerBound, 5)
        XCTAssertEqual(firstSuggestion?.rationale, .increaseWeight)
        let reopened = WorkoutExecutionModel(workoutID: active.id, repository: repository, historyRepository: repository, progressionRepository: repository)
        await reopened.activate()
        XCTAssertEqual(reopened.suggestion(for: try XCTUnwrap(reopened.workout?.exercises[0])), firstSuggestion)
        let persistedActive = try await repository.workout(id: active.id)
        XCTAssertEqual(persistedActive?.exercises[0].prescriptions[0].suggestedWeight?.pounds, 135)
    }

    func testCompletedSetEditPreservesCompletionAndRecomputesCanonicalPerformance() async throws {
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        let completed = EquilibriumFixtures.completed(id: "editable-history")
        try await repository.create(completed)
        let originalCompletedAt = try XCTUnwrap(completed.completedAt)
        let exercise = completed.exercises[0], prescription = exercise.prescriptions[0], logID = try XCTUnwrap(exercise.loggedSets.first?.id)
        let edited = try await repository.editCompletedSet(workoutID: completed.id, exerciseID: exercise.id, prescriptionID: prescription.id, input: .repetitions(weight: .init(pounds: 220.46226218), repetitions: 6), at: .init(timeIntervalSince1970: 2_000))
        XCTAssertEqual(edited.status, .completed)
        XCTAssertEqual(edited.completedAt, originalCompletedAt)
        XCTAssertEqual(edited.exercises[0].loggedSets[0].id, logID)
        XCTAssertEqual(try XCTUnwrap(edited.exercises[0].loggedSets[0].weight?.pounds), 220.46226218, accuracy: 0.000_001)
        let performance = try await repository.exercisePerformance(exerciseID: exercise.exerciseID)
        XCTAssertEqual(performance.occurrences.count, 1)
        XCTAssertTrue(performance.occurrences[0].sets.contains { $0.id == logID && abs(($0.weight?.value(in: .kilograms) ?? 0) - 100) < 0.000_001 })
        let persistedCompleted = try await repository.workout(id: completed.id)
        XCTAssertEqual(persistedCompleted?.completedAt, originalCompletedAt)
    }

    func testTimedWorkCompletesCanonicallyBeforeDistinctRestBegins() async throws {
        var monotonic: TimeInterval = 0
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        let fixture = EquilibriumFixtures.mixed(id: "work-rest")
        try await repository.create(fixture)
        let countdown = CountdownTimer(now: { monotonic })
        let model = WorkoutExecutionModel(workoutID: fixture.id, repository: repository, now: { .init(timeIntervalSince1970: monotonic) }, timer: countdown)
        await model.activate()
        let exercise = fixture.exercises[1], prescription = exercise.prescriptions[0]
        model.focus(exercise.id)
        model.startWorkTimer(exerciseID: exercise.id, prescriptionID: prescription.id, input: .duration(weight: .init(pounds: 40), seconds: 45))
        XCTAssertEqual(model.workTimerState?.phase, .ready)
        XCTAssertEqual(model.workTimerState?.totalDuration, 5)
        XCTAssertNil(model.restState)
        monotonic = 5; model.refreshRest()
        XCTAssertEqual(model.workTimerState?.phase, .firstSide)
        XCTAssertEqual(model.workTimerState?.totalDuration, 45)
        XCTAssertNil(model.restState)
        monotonic = 50; model.refreshRest()
        try await Task.sleep(for: .milliseconds(20))
        XCTAssertNil(model.workTimerState)
        XCTAssertEqual(model.restState?.totalDuration, 60)
        let persisted = try await repository.workout(id: fixture.id)
        XCTAssertEqual(persisted?.exercises[1].loggedSets.first?.duration, 45)
        XCTAssertEqual(persisted?.exercises[1].loggedSets.first?.weight?.pounds, 40)
    }

    func testTwoSidedTimedSetRunsReadyFirstSwitchSecondThenLogsOnce() async throws {
        var monotonic: TimeInterval = 0
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        var fixture = EquilibriumFixtures.mixed(id: "two-sided-work")
        fixture.exercises[1].isTwoSided = true
        try await repository.create(fixture)
        let model = WorkoutExecutionModel(workoutID: fixture.id, repository: repository, timer: CountdownTimer(now: { monotonic }))
        await model.activate()
        let exercise = fixture.exercises[1], prescription = exercise.prescriptions[0]
        model.focus(exercise.id)
        model.startWorkTimer(exerciseID: exercise.id, prescriptionID: prescription.id, input: .duration(weight: nil, seconds: 45))
        monotonic = 5; model.refreshRest(); XCTAssertEqual(model.workTimerState?.phase, .firstSide)
        monotonic = 50; model.refreshRest(); XCTAssertEqual(model.workTimerState?.phase, .switchSides); XCTAssertEqual(model.timer.configuredDuration, 10)
        monotonic = 60; model.refreshRest(); XCTAssertEqual(model.workTimerState?.phase, .secondSide); XCTAssertEqual(model.timer.configuredDuration, 45)
        monotonic = 105; model.refreshRest()
        try await Task.sleep(for: .milliseconds(20))
        let persisted = try await repository.workout(id: fixture.id)
        XCTAssertEqual(persisted?.exercises[1].loggedSets.count, 1)
        XCTAssertEqual(model.restState?.totalDuration, 60)
    }

    func testTimedWorkReconcilesElapsedBackgroundDeadlineWithoutDoubleTimer() async throws {
        var monotonic: TimeInterval = 0
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        let fixture = EquilibriumFixtures.mixed(id: "background-work")
        try await repository.create(fixture)
        let model = WorkoutExecutionModel(workoutID: fixture.id, repository: repository, timer: CountdownTimer(now: { monotonic }))
        await model.activate()
        let exercise = fixture.exercises[1], prescription = exercise.prescriptions[0]
        model.focus(exercise.id)
        model.startWorkTimer(exerciseID: exercise.id, prescriptionID: prescription.id, input: .duration(weight: nil, seconds: 45))
        monotonic = 60; model.refreshRest()
        try await Task.sleep(for: .milliseconds(20))
        XCTAssertNil(model.workTimerState)
        XCTAssertNotNil(model.restState)
        let persisted = try await repository.workout(id: fixture.id)
        XCTAssertEqual(persisted?.exercises[1].loggedSets.count, 1)
    }

    func testLoggedValuesPropagateOnlyToImmediatelyFollowingUnloggedPrescriptionAndPersist() async throws {
        let url = TestSupport.temporaryStoreURL()
        var container: ModelContainer? = try PersistenceController.makeContainer(storageURL: url)
        var repository: SwiftDataRepository? = SwiftDataRepository(container: container!)
        let fixture = EquilibriumFixtures.ready(id: "propagation")
        try await repository!.create(fixture); _ = try await repository!.startWorkout(id: fixture.id, at: .init(timeIntervalSince1970: 10))
        let exercise = fixture.exercises[0], first = exercise.prescriptions[0], second = exercise.prescriptions[1], third = exercise.prescriptions[2]
        let firstUpdate = try await repository!.logSet(workoutID: fixture.id, exerciseID: exercise.id, prescriptionID: first.id, input: .repetitions(weight: .init(pounds: 105), repetitions: 10), completed: true, at: .init(timeIntervalSince1970: 20))
        XCTAssertEqual(firstUpdate.exercises[0].prescriptions[1].id, second.id)
        XCTAssertEqual(firstUpdate.exercises[0].prescriptions[1].suggestedWeight?.pounds, 105)
        XCTAssertEqual(firstUpdate.exercises[0].prescriptions[2].suggestedWeight?.pounds, 105)
        guard case .repetitions(let secondRange) = firstUpdate.exercises[0].prescriptions[1].target else { return XCTFail() }
        XCTAssertEqual(secondRange, 10...10)
        _ = try await repository!.logSet(workoutID: fixture.id, exerciseID: exercise.id, prescriptionID: second.id, input: .repetitions(weight: .init(pounds: 120), repetitions: 6), completed: true, at: .init(timeIntervalSince1970: 30))
        let editedFirst = try await repository!.logSet(workoutID: fixture.id, exerciseID: exercise.id, prescriptionID: first.id, input: .repetitions(weight: .init(pounds: 130), repetitions: 12), completed: true, at: .init(timeIntervalSince1970: 40))
        XCTAssertEqual(editedFirst.exercises[0].prescriptions[1].suggestedWeight?.pounds, 105)
        XCTAssertEqual(editedFirst.exercises[0].prescriptions[2].id, third.id)
        XCTAssertEqual(editedFirst.exercises[0].prescriptions[2].suggestedWeight?.pounds, 120)
        container = nil; repository = nil
        let reopened = SwiftDataRepository(container: try PersistenceController.makeContainer(storageURL: url))
        let reopenedWorkout = try await reopened.workout(id: fixture.id)
        let persisted = try XCTUnwrap(reopenedWorkout)
        XCTAssertEqual(persisted.exercises[0].prescriptions[1].suggestedWeight?.pounds, 105)
        XCTAssertEqual(persisted.exercises[0].prescriptions[2].suggestedWeight?.pounds, 120)
    }

    func testDurationValuesPropagateToExistingNextSetWithoutChangingIdentity() async throws {
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        let fixture = EquilibriumFixtures.mixed(id: "duration-propagation")
        try await repository.create(fixture); _ = try await repository.startWorkout(id: fixture.id, at: .init(timeIntervalSince1970: 10))
        let exercise = fixture.exercises[1]
        let withSecond = try await repository.appendSet(workoutID: fixture.id, exerciseID: exercise.id, seed: .duration(weight: nil, seconds: 20), at: .init(timeIntervalSince1970: 14))
        let secondID = try XCTUnwrap(withSecond.exercises[1].prescriptions.last?.id)
        let withThird = try await repository.appendSet(workoutID: fixture.id, exerciseID: exercise.id, seed: .duration(weight: nil, seconds: 25), at: .init(timeIntervalSince1970: 15))
        let thirdID = try XCTUnwrap(withThird.exercises[1].prescriptions.last?.id)
        let updated = try await repository.logSet(workoutID: fixture.id, exerciseID: exercise.id, prescriptionID: exercise.prescriptions[0].id, input: .duration(weight: .init(pounds: 40), seconds: 45), completed: true, at: .init(timeIntervalSince1970: 20))
        let propagated = Array(updated.exercises[1].prescriptions.dropFirst())
        XCTAssertEqual(propagated.map(\.id), [secondID, thirdID])
        XCTAssertEqual(propagated.map { $0.suggestedWeight?.pounds }, [40, 40])
        for next in propagated { guard case .duration(let seconds) = next.target else { return XCTFail() }; XCTAssertEqual(seconds, 45) }
    }

    func testLoggingFirstSetPropagatesThroughAllConsecutiveUnloggedSetsAndModelRefreshesImmediately() async throws {
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        let fixture = EquilibriumFixtures.ready(id: "model-forward-propagation")
        let originalIDs = fixture.exercises[0].prescriptions.map(\.id)
        try await repository.create(fixture)
        let model = WorkoutExecutionModel(workoutID: fixture.id, repository: repository)
        await model.activate()
        await model.log(exerciseID: fixture.exercises[0].id, prescriptionID: originalIDs[0], input: .repetitions(weight: .init(pounds: 105), repetitions: 10))
        let refreshed = try XCTUnwrap(model.workout?.exercises[0])
        XCTAssertEqual(refreshed.prescriptions.map(\.id), originalIDs)
        XCTAssertEqual(refreshed.prescriptions.dropFirst().map { $0.suggestedWeight?.pounds }, [105, 105])
        for prescription in refreshed.prescriptions.dropFirst() {
            guard case .repetitions(let range) = prescription.target else { return XCTFail() }
            XCTAssertEqual(range, 10...10)
        }
        XCTAssertEqual(model.currentPrescription?.id, originalIDs[1])
        XCTAssertEqual(model.currentPrescription?.suggestedWeight?.pounds, 105)
    }

    func testTimerCreationRouteIsAtomicallyReplacedByRunAndBackStackIsTimersHome() {
        let result = StandaloneTimerNavigationPolicy.replacingCreation(in: [.timer, .timerCreate], withRunID: "created")
        XCTAssertEqual(result, [.timer, .timerRun("created")])
        XCTAssertEqual(Array(result.dropLast()), [.timer])
    }

    func testDeletingSavedTimerPersistsAcrossStoreRecreationAndDoesNotTouchOtherData() async throws {
        let suite = "timer-delete-tests-\(UUID().uuidString)"; let defaults = try XCTUnwrap(UserDefaults(suiteName: suite)); defaults.removePersistentDomain(forName: suite)
        let first = StandaloneTimerConfiguration(id: "delete-me", name: "Delete Me")
        let second = StandaloneTimerConfiguration(id: "keep-me", name: "Keep Me")
        var store: UserDefaultsStandaloneTimerStore? = UserDefaultsStandaloneTimerStore(defaults: defaults, key: "timers")
        store!.save(first); store!.save(second)
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        let history = EquilibriumFixtures.completed(id: "timer-delete-history"); try await repository.create(history)
        var homeConfigurations = [first, second]
        let homeRoute: [HomeRoute] = [.timer]
        StandaloneTimerHomeActions.delete(id: first.id, store: store!, configurations: &homeConfigurations)
        XCTAssertEqual(homeConfigurations, [second])
        XCTAssertEqual(store!.configurations(), [second])
        XCTAssertEqual(homeRoute, [.timer])
        XCTAssertFalse(homeRoute.contains { route in if case .timerCreate = route { true } else if case .timerEdit = route { true } else if case .timerRun = route { true } else { false } })
        store = nil
        let reopened = UserDefaultsStandaloneTimerStore(defaults: defaults, key: "timers")
        XCTAssertEqual(reopened.configurations(), [second])
        let workouts = try await repository.allWorkouts()
        let performance = try await repository.exercisePerformance(exerciseID: history.exercises[0].exerciseID)
        XCTAssertEqual(workouts.map(\.id), [history.id])
        XCTAssertEqual(performance.occurrences.count, 1)
    }

    func testCancellingTimerDeletionChangesNeitherCollectionStoreNorRoute() throws {
        let suite = "timer-delete-cancel-tests-\(UUID().uuidString)"; let defaults = try XCTUnwrap(UserDefaults(suiteName: suite)); defaults.removePersistentDomain(forName: suite)
        let store = UserDefaultsStandaloneTimerStore(defaults: defaults, key: "timers")
        let first = StandaloneTimerConfiguration(id: "timer-a", name: "Timer A"), second = StandaloneTimerConfiguration(id: "timer-b", name: "Timer B")
        store.save(first); store.save(second)
        let homeConfigurations = store.configurations()
        let route: [HomeRoute] = [.timer]
        // Cancel dismisses the confirmation without invoking the Home-owned delete action.
        XCTAssertEqual(store.configurations(), homeConfigurations)
        XCTAssertEqual(route, [.timer])
        XCTAssertEqual(Set(store.configurations().map(\.id)), Set([first.id, second.id]))
    }
}
