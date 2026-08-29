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
}
