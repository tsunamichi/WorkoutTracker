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
        let first = EquilibriumFixtures.planned(day: "2026-08-22", id: "unique-a")
        let second = EquilibriumFixtures.planned(day: "2026-08-22", id: "unique-b")
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

    func testOnlyInjectedCurrentDayCanExecute() async throws {
        let today = try LocalDay("2026-08-22")
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true), currentDayProvider: FixedCurrentDayProvider(day: today))
        let current = EquilibriumFixtures.planned(day: today.iso8601, id: "eligible")
        let past = EquilibriumFixtures.planned(day: "2026-08-21", id: "past")
        let future = EquilibriumFixtures.planned(day: "2026-08-23", id: "future")
        try await repository.materializeAtomically([current, past, future])
        let started = try await repository.startWorkout(id: current.id, at: .now); XCTAssertEqual(started.status, .inProgress)
        for workout in [past, future] {
            do { _ = try await repository.startWorkout(id: workout.id, at: .now); XCTFail("Expected current-day protection") }
            catch { XCTAssertEqual(error as? RepositoryError, .workoutNotCurrentDay) }
        }
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
        XCTAssertTrue(resume.showsExecutionOptions)
        XCTAssertFalse(resume.canComplete)

        let completed = EquilibriumFixtures.completed(day: "2026-08-23", id: "readonly-model")
        try await repository.schedule(completed)
        let readOnly = WorkoutExecutionModel(workoutID: completed.id, repository: repository)
        await readOnly.activate()
        XCTAssertTrue(readOnly.isReadOnly)
        XCTAssertFalse(readOnly.showsExecutionOptions)
    }

    func testOptionsRemainEligibleUntilCanonicalCompletionBecomesActionable() async throws {
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        let fixture = EquilibriumFixtures.planned(day: "2026-08-22", id: "options-eligibility")
        try await repository.schedule(fixture)
        let model = WorkoutExecutionModel(workoutID: fixture.id, repository: repository)
        await model.activate()

        XCTAssertTrue(model.showsExecutionOptions)
        XCTAssertFalse(model.canComplete)

        for exercise in fixture.exercises {
            for prescription in exercise.prescriptions {
                let input: SetLogInput
                switch prescription.target {
                case .repetitions: input = .repetitions(weight: nil, repetitions: 8)
                case .duration(let seconds): input = .duration(seconds: seconds)
                }
                await model.log(exerciseID: exercise.id, prescriptionID: prescription.id, input: input)
                XCTAssertTrue(model.showsExecutionOptions)
            }
        }

        XCTAssertTrue(model.canComplete)
        await model.complete()
        XCTAssertFalse(model.showsExecutionOptions)
    }

    func testBackEquivalentLeavesCanonicalProgressAndScheduleAcceptsMutation() async throws {
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        let fixture = EquilibriumFixtures.planned(day: "2026-08-22", id: "back")
        try await repository.schedule(fixture)
        let schedule = HomeModel(repository: repository, calendar: ScheduleCalendar(calendar: Calendar(identifier: .gregorian)), now: { try! fixture.day.date(in: Calendar(identifier: .gregorian))! })
        await schedule.load()
        let model = WorkoutExecutionModel(workoutID: fixture.id, repository: repository, didPersist: { schedule.applyPersistedWorkout($0) })
        await model.activate()
        await model.log(exerciseID: fixture.exercises[0].id, prescriptionID: fixture.exercises[0].prescriptions[0].id, input: .repetitions(weight: nil, repetitions: 9))
        XCTAssertEqual(schedule.workouts.first?.status, .inProgress)
        XCTAssertEqual(schedule.workouts.first?.exercises[0].loggedSets[0].repetitions, 9)
        let persisted = try await repository.workout(id: fixture.id)
        XCTAssertEqual(persisted?.exercises[0].loggedSets[0].repetitions, 9)
    }

    func testOrderedExerciseStatesAndFocusAreTransient() async throws {
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        let fixture = EquilibriumFixtures.midWorkout(id: "panels")
        try await repository.schedule(fixture)
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
        let active = EquilibriumFixtures.midWorkout(day: "2026-08-22", id: "review-active")
        try await repository.schedule(active)
        let model = WorkoutExecutionModel(workoutID: active.id, repository: repository)
        await model.activate(); model.focus(active.exercises[0].id)
        XCTAssertEqual(model.currentExercise?.id, active.exercises[0].id)
        XCTAssertEqual(model.selectedSetIndex, active.exercises[0].prescriptions.count - 1)

        let complete = EquilibriumFixtures.completed(day: "2026-08-23", id: "review-readonly")
        try await repository.schedule(complete)
        let readOnly = WorkoutExecutionModel(workoutID: complete.id, repository: repository)
        await readOnly.activate(); readOnly.focus(complete.exercises[0].id)
        XCTAssertNil(readOnly.focusedExerciseID)
        XCTAssertEqual(readOnly.states[complete.exercises[0].id], .completed)
    }

    func testCurrentSetDerivesAdvancesAndRevisitsLoggedSet() async throws {
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        let fixture = EquilibriumFixtures.planned(id: "set-position")
        try await repository.schedule(fixture)
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
        try await repository.schedule(fixture)
        let model = WorkoutExecutionModel(workoutID: fixture.id, repository: repository)
        await model.activate()
        guard case .repetitions = model.currentPrescription?.target else { return XCTFail("Expected repetitions") }
        model.focus(fixture.exercises[1].id)
        guard case .duration = model.currentPrescription?.target else { return XCTFail("Expected duration") }
    }

    func testRestStartsCountsDownSkipsAndDoesNotOwnPersistence() async throws {
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        let fixture = EquilibriumFixtures.mixed(id: "rest")
        try await repository.schedule(fixture)
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

    func testRestDeadlineCompletionReturnsToActiveCurrent() async throws {
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        let fixture = EquilibriumFixtures.mixed(id: "rest-finish")
        try await repository.schedule(fixture)
        var instant = Date(timeIntervalSince1970: 2_000)
        let model = WorkoutExecutionModel(workoutID: fixture.id, repository: repository, now: { instant })
        await model.activate()
        await model.log(exerciseID: fixture.exercises[0].id, prescriptionID: fixture.exercises[0].prescriptions[0].id, input: .repetitions(weight: nil, repetitions: 8))
        instant = instant.addingTimeInterval(121); model.refreshRest()
        XCTAssertNil(model.restState)
        XCTAssertEqual(model.selectedSetIndex, 1)
    }

    func testDefaultRestStartsForNewlyCompletedSetAndNotForAnEdit() async throws {
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        var fixture = EquilibriumFixtures.planned(id: "default-rest")
        fixture.exercises[0].restDuration = nil
        try await repository.schedule(fixture)
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
        let exercise = ScheduledExercise(id: .new(), exerciseID: .new(), nameSnapshot: "New Exercise", prescriptions: [], loggedSets: [], restDuration: nil, skippedAt: nil)
        let next = EquilibriumFixtures.planned(id: "first-set-source").exercises[0]
        let fixture = ScheduledWorkout(id: .init(rawValue: "first-set-rest"), day: try LocalDay("2026-08-22"), titleSnapshot: "New workout", templateID: nil, planID: nil, source: .manual, exercises: [exercise, next], status: .planned, startedAt: nil, completedAt: nil, createdAt: .now, updatedAt: .now)
        try await repository.schedule(fixture)
        let model = WorkoutExecutionModel(workoutID: fixture.id, repository: repository, defaultRestDuration: 90)
        await model.activate()
        await model.logFirstSet(exerciseID: exercise.id, input: .repetitions(weight: nil, repetitions: 8))
        XCTAssertEqual(model.restState?.remaining, 90)
        let persisted = try await repository.workout(id: fixture.id)
        XCTAssertEqual(persisted?.exercises[0].loggedSets.first?.repetitions, 8)
    }
}
