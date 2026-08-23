import XCTest
import SwiftData
@testable import Equilibrium

final class ProgressionTimerTests: XCTestCase {
    private let exerciseID = ExerciseID(rawValue: "stable-exercise")
    private func parameters(_ mode: ProgressionMode = .doubleProgression, range: ClosedRange<Int> = 8...12, increment: Double = 5) -> ProgressionParameters {
        .init(repetitionRange: range, weightIncrement: .init(pounds: increment), mode: mode)
    }
    private func logs(_ reps: [Int], weight: Double? = 100) -> [LoggedSet] {
        reps.enumerated().map { .init(id: .init(rawValue: "log-\($0.offset)"), prescriptionID: .init(rawValue: "set-\($0.offset)"), weight: weight.map(Weight.init(pounds:)), repetitions: $0.element, duration: nil, completedAt: .init(timeIntervalSince1970: Double($0.offset + 1))) }
    }

    func testCanonicalAssignmentAndDisabledRules() {
        var configuration = ProgressionConfiguration(isEnabled: true, defaults: parameters(), groups: [], overrides: [])
        XCTAssertNil(ProgressionRuleResolver.resolve(exerciseID: exerciseID, configuration: configuration))
        configuration.assign(.upper, to: exerciseID)
        XCTAssertEqual(ProgressionRuleResolver.resolve(exerciseID: exerciseID, configuration: configuration)?.parameters, AutoProgressionProfile.upper.parameters)
        configuration.isEnabled = false
        XCTAssertNil(ProgressionRuleResolver.resolve(exerciseID: exerciseID, configuration: configuration))
        configuration.isEnabled = true; configuration.assign(.none, to: exerciseID)
        XCTAssertNil(ProgressionRuleResolver.resolve(exerciseID: exerciseID, configuration: configuration))
    }

    func testDoubleProgressionUsesWeakestSetAndIncreasesOnlyWhenAllReachMaximum() {
        let add = ProgressionEngine.calculate(exerciseID: exerciseID, parameters: parameters(), sets: logs([12, 9, 11]))
        XCTAssertEqual(add?.suggestedWeight?.pounds, 100); XCTAssertEqual(add?.targetRepetitions, 10...12); XCTAssertEqual(add?.rationale, .addRepetitions)
        let increase = ProgressionEngine.calculate(exerciseID: exerciseID, parameters: parameters(), sets: logs([12, 13, 12]))
        XCTAssertEqual(increase?.suggestedWeight?.pounds, 105); XCTAssertEqual(increase?.targetRepetitions, 8...12); XCTAssertEqual(increase?.rationale, .increaseWeight)
    }

    func testWeightOnlyAndRepetitionsOnlyMatchFrozenSemantics() {
        let weight = ProgressionEngine.calculate(exerciseID: exerciseID, parameters: parameters(.weightOnly), sets: logs([8, 9]))
        XCTAssertEqual(weight?.suggestedWeight?.pounds, 105); XCTAssertEqual(weight?.targetRepetitions, 8...12)
        let reps = ProgressionEngine.calculate(exerciseID: exerciseID, parameters: parameters(.repetitionsOnly), sets: logs([10, 8, 11]))
        XCTAssertEqual(reps?.suggestedWeight?.pounds, 100); XCTAssertEqual(reps?.targetRepetitions, 9...12); XCTAssertEqual(reps?.rationale, .addRepetitions)
        let capped = ProgressionEngine.calculate(exerciseID: exerciseID, parameters: parameters(.repetitionsOnly), sets: logs([12, 12]))
        XCTAssertEqual(capped?.targetRepetitions, 12...12); XCTAssertEqual(capped?.rationale, .repeatLast)
    }

    func testMissingWeightNeverBecomesZero() {
        let bodyweight = ProgressionEngine.calculate(exerciseID: exerciseID, parameters: parameters(), sets: logs([8, 9], weight: nil))
        XCTAssertNil(bodyweight?.suggestedWeight); XCTAssertEqual(bodyweight?.targetRepetitions, 9...12)
        let weightOnly = ProgressionEngine.calculate(exerciseID: exerciseID, parameters: parameters(.weightOnly), sets: logs([8], weight: nil))
        XCTAssertNil(weightOnly?.suggestedWeight); XCTAssertEqual(weightOnly?.rationale, .repeatLast)
    }

    func testSuggestionUsesNewestCompletedStableIdentityAndIgnoresIncompleteWorkoutsAndDuration() {
        func workout(_ id: String, status: WorkoutStatus, reps: Int, completed: Date?) -> Workout {
            let prescription = SetPrescription(id: .init(rawValue: "p-\(id)"), target: .repetitions(range: 8...12), suggestedWeight: nil)
            let exercise = WorkoutExercise(id: .init(rawValue: "we-\(id)"), exerciseID: exerciseID, nameSnapshot: id == "old" ? "Old Name" : "Renamed", prescriptions: [prescription], loggedSets: [.init(id: .init(rawValue: "l-\(id)"), prescriptionID: prescription.id, weight: .init(pounds: 100), repetitions: reps, duration: nil, completedAt: completed)], restDuration: nil, skippedAt: nil)
            return .init(id: .init(rawValue: id), titleSnapshot: id, exercises: [exercise], status: status, startedAt: status == .ready ? nil : .init(timeIntervalSince1970: 1), completedAt: completed, createdAt: .init(timeIntervalSince1970: 1), updatedAt: completed ?? .init(timeIntervalSince1970: 1))
        }
        let configuration = ProgressionConfiguration(isEnabled: true, defaults: parameters(), groups: [], overrides: [], assignments: [exerciseID: .upper])
        let suggestion = ProgressionEngine.suggestion(exerciseID: exerciseID, configuration: configuration, workouts: [workout("ready", status: .ready, reps: 12, completed: nil), workout("progress", status: .inProgress, reps: 12, completed: nil), workout("old", status: .completed, reps: 8, completed: .init(timeIntervalSince1970: 10)), workout("new", status: .completed, reps: 11, completed: .init(timeIntervalSince1970: 20))])
        XCTAssertEqual(suggestion?.targetRepetitions, 5...8)
        var duration = workout("duration", status: .completed, reps: 10, completed: .init(timeIntervalSince1970: 30))
        duration.exercises[0].prescriptions[0].target = .duration(seconds: 30)
        XCTAssertNil(ProgressionEngine.suggestion(exerciseID: exerciseID, configuration: configuration, workouts: [duration]))
    }

    @MainActor func testConfigurationPersistsAndBackupRoundTrips() async throws {
        let container = try PersistenceController.makeContainer(inMemory: true)
        let repository = SwiftDataRepository(container: container)
        let group = ProgressionGroup(id: .init(rawValue: "group"), name: "Pulls", parameters: parameters(.weightOnly), exerciseIDs: [exerciseID])
        let configuration = ProgressionConfiguration(isEnabled: true, defaults: parameters(), groups: [group], overrides: [.init(exerciseID: .init(rawValue: "other"), parameters: parameters(.disabled))])
        try await repository.saveProgressionConfiguration(configuration)
        var settings = try await repository.settings(); settings.defaultRestDuration = 75; settings.weightUnit = .kilograms; try await repository.saveSettings(settings)
        let loadedConfiguration = try await repository.progressionConfiguration()
        XCTAssertEqual(loadedConfiguration, configuration)
        let backup = try await repository.exportBackup(exportedAt: .now, sourceDeviceID: "test")
        XCTAssertEqual(backup.progression, configuration); XCTAssertEqual(backup.settings, settings)
        let restoredContainer = try PersistenceController.makeContainer(inMemory: true)
        let restored = SwiftDataRepository(container: restoredContainer); try await restored.restoreBackup(backup)
        let restoredConfiguration = try await restored.progressionConfiguration(), restoredSettings = try await restored.settings()
        XCTAssertEqual(restoredConfiguration, configuration); XCTAssertEqual(restoredSettings, settings)
    }

    @MainActor func testInvalidConfigurationIsRejected() async throws {
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        let duplicate = ExerciseProgressionOverride(exerciseID: exerciseID, parameters: parameters())
        let invalid = ProgressionConfiguration(isEnabled: true, defaults: .init(repetitionRange: 1...1, weightIncrement: .init(pounds: -.infinity), mode: .doubleProgression), groups: [], overrides: [duplicate, duplicate])
        do { try await repository.saveProgressionConfiguration(invalid); XCTFail("Expected validation failure") } catch { XCTAssertEqual(error as? RepositoryError, .invalidProgressionConfiguration) }
    }

    @MainActor func testConfigurationSurvivesContainerRecreationAndUnitRoundTrip() async throws {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let url = directory.appendingPathComponent("configuration.store")
        let configuration = ProgressionConfiguration(isEnabled: true, defaults: parameters(increment: Weight(2.5, unit: .kilograms).pounds), groups: [], overrides: [])
        do {
            let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(storageURL: url))
            try await repository.saveProgressionConfiguration(configuration)
        }
        let recreated = SwiftDataRepository(container: try PersistenceController.makeContainer(storageURL: url))
        let loaded = try await recreated.progressionConfiguration()
        XCTAssertEqual(loaded, configuration)
        XCTAssertEqual(loaded.defaults.weightIncrement.value(in: .kilograms), 2.5, accuracy: 0.000_001)
        let result = ProgressionEngine.calculate(exerciseID: exerciseID, parameters: loaded.defaults, sets: logs([12, 12]))
        XCTAssertEqual(try XCTUnwrap(result?.suggestedWeight?.pounds), 100 + configuration.defaults.weightIncrement.pounds, accuracy: 0.000_001)
    }

    @MainActor func testTimerStateMachineDeadlinePauseResumeResetCancelAndCompletionOnce() {
        var now: TimeInterval = 100
        let timer = CountdownTimer(now: { now })
        timer.start(duration: 90); XCTAssertEqual(timer.state, .running); XCTAssertEqual(timer.remainingDuration, 90)
        now += 70; timer.refresh(); XCTAssertEqual(timer.remainingDuration, 20, accuracy: 0.001)
        timer.pause(); now += 100; timer.refresh(); XCTAssertEqual(timer.remainingDuration, 20, accuracy: 0.001)
        timer.resume(); now += 20; XCTAssertTrue(timer.refresh()); XCTAssertEqual(timer.state, .completed); XCTAssertEqual(timer.completionCount, 1)
        XCTAssertFalse(timer.refresh()); XCTAssertEqual(timer.completionCount, 1)
        timer.reset(); XCTAssertEqual(timer.state, .paused); XCTAssertEqual(timer.remainingDuration, 90)
        timer.resume(); now += 5; timer.refresh(); XCTAssertEqual(timer.remainingDuration, 85, accuracy: 0.001)
        timer.cancel(); XCTAssertEqual(timer.state, .idle); XCTAssertEqual(timer.configuredDuration, 0)
        timer.start(duration: 10); XCTAssertEqual(timer.remainingDuration, 10)
    }

    @MainActor func testTimerLargeBackgroundJumpHasNoTickDrift() {
        var now: TimeInterval = 0
        let timer = CountdownTimer(now: { now }); timer.start(duration: 90)
        now = 95; XCTAssertTrue(timer.refresh()); XCTAssertEqual(timer.remainingDuration, 0); XCTAssertEqual(timer.state, .completed)
    }
}
