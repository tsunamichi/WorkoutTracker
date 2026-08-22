import XCTest
import SwiftData
@testable import Equilibrium

@MainActor
final class WorkoutExecutionRepositoryTests: XCTestCase {
    private func repository() throws -> SwiftDataRepository { SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true)) }

    func testPlannedStartsWithTimestampAndInProgressResumesWithoutChangingIt() async throws {
        let repository = try repository()
        let planned = EquilibriumFixtures.planned(id: "start-resume")
        try await repository.schedule(planned)
        let start = Date(timeIntervalSince1970: 2_000)
        let started = try await repository.startWorkout(id: planned.id, at: start)
        XCTAssertEqual(started.status, .inProgress)
        XCTAssertEqual(started.startedAt, start)
        let resumed = try await repository.startWorkout(id: planned.id, at: start.addingTimeInterval(100))
        XCTAssertEqual(resumed.startedAt, start)
    }

    func testRepetitionLoggingSupportsOptionalWeightAndUpdatesSameCanonicalSet() async throws {
        let repository = try repository()
        let fixture = EquilibriumFixtures.planned(id: "rep-log")
        try await repository.schedule(fixture)
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
        try await repository.schedule(fixture)
        _ = try await repository.startWorkout(id: fixture.id, at: .init(timeIntervalSince1970: 10))
        let exercise = fixture.exercises[1], prescription = exercise.prescriptions[0]
        let updated = try await repository.logSet(workoutID: fixture.id, exerciseID: exercise.id, prescriptionID: prescription.id, input: .duration(seconds: 52), completed: true, at: .init(timeIntervalSince1970: 20))
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
        let fixture = EquilibriumFixtures.planned(id: "complete")
        try await repository.schedule(fixture)
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
        let fixture = EquilibriumFixtures.planned(id: "command-relaunch")
        try await repository!.schedule(fixture)
        _ = try await repository!.startWorkout(id: fixture.id, at: .init(timeIntervalSince1970: 10))
        _ = try await repository!.logSet(workoutID: fixture.id, exerciseID: fixture.exercises[0].id, prescriptionID: fixture.exercises[0].prescriptions[0].id, input: .repetitions(weight: .init(pounds: 95), repetitions: 11), completed: true, at: .init(timeIntervalSince1970: 20))
        repository = nil; container = nil
        let reopened = try PersistenceController.makeContainer(storageURL: url)
        let reopenedValue = try await SwiftDataRepository(container: reopened).workout(id: fixture.id)
        let loaded = try XCTUnwrap(reopenedValue)
        XCTAssertEqual(loaded.status, .inProgress)
        XCTAssertEqual(loaded.exercises[0].loggedSets[0].repetitions, 11)
    }

    func testScheduledChildAndLoggedSetIDsAreGloballyUnique() async throws {
        let repository = try repository()
        let first = EquilibriumFixtures.planned(day: "2026-01-01", id: "unique-a")
        let second = EquilibriumFixtures.planned(day: "2026-01-02", id: "unique-b")
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
}

@MainActor
final class WorkoutExecutionNavigationStateTests: XCTestCase {
    func testDestinationActivationStartsPlannedAndPublishesCanonicalScheduleValue() async throws {
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        let fixture = EquilibriumFixtures.planned(day: "2026-08-22", id: "activation")
        try await repository.schedule(fixture)
        var published: ScheduledWorkout?
        let model = WorkoutExecutionModel(workoutID: fixture.id, repository: repository, now: { .init(timeIntervalSince1970: 50) }, didPersist: { published = $0 })
        XCTAssertNil(model.workout)
        let beforeActivation = try await repository.workout(id: fixture.id)
        XCTAssertEqual(beforeActivation?.status, .planned)
        await model.activate()
        XCTAssertEqual(model.workout?.status, .inProgress)
        XCTAssertEqual(published?.id, fixture.id)
        XCTAssertEqual(published?.status, .inProgress)
    }

    func testInProgressResumesAndCompletedActivatesReadOnly() async throws {
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        let inProgress = EquilibriumFixtures.inProgress(day: "2026-08-22", id: "resume-model")
        try await repository.schedule(inProgress)
        let resume = WorkoutExecutionModel(workoutID: inProgress.id, repository: repository)
        await resume.activate()
        XCTAssertEqual(resume.workout?.startedAt, inProgress.startedAt)
        XCTAssertFalse(resume.isReadOnly)

        let completed = EquilibriumFixtures.completed(day: "2026-08-23", id: "readonly-model")
        try await repository.schedule(completed)
        let readOnly = WorkoutExecutionModel(workoutID: completed.id, repository: repository)
        await readOnly.activate()
        XCTAssertTrue(readOnly.isReadOnly)
    }

    func testBackEquivalentLeavesCanonicalProgressAndScheduleAcceptsMutation() async throws {
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        let fixture = EquilibriumFixtures.planned(day: "2026-08-22", id: "back")
        try await repository.schedule(fixture)
        let schedule = ScheduleModel(repository: repository, calendar: ScheduleCalendar(calendar: Calendar(identifier: .gregorian)), now: try XCTUnwrap(fixture.day.date(in: Calendar(identifier: .gregorian))))
        await schedule.load()
        let model = WorkoutExecutionModel(workoutID: fixture.id, repository: repository, didPersist: { schedule.applyPersistedWorkout($0) })
        await model.activate()
        await model.log(exerciseID: fixture.exercises[0].id, prescriptionID: fixture.exercises[0].prescriptions[0].id, input: .repetitions(weight: nil, repetitions: 9))
        XCTAssertEqual(schedule.selectedWorkout?.status, .inProgress)
        XCTAssertEqual(schedule.selectedWorkout?.exercises[0].loggedSets[0].repetitions, 9)
        let persisted = try await repository.workout(id: fixture.id)
        XCTAssertEqual(persisted?.exercises[0].loggedSets[0].repetitions, 9)
    }
}
