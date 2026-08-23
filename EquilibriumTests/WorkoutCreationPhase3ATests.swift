import XCTest
@testable import Equilibrium

@MainActor
final class WorkoutCreationPhase3ATests: XCTestCase {
    func testExplicitDraftPrescriptionsOverrideHistoryAndReceiveFreshIDs() async throws {
        let repository = makeRepository(); for exercise in EquilibriumFixtures.exercises { try await repository.saveExercise(exercise) }
        try await repository.create(EquilibriumFixtures.completed(id: "competing-history"))
        let originalIDs = [SetID(rawValue: "explicit-reps"), SetID(rawValue: "explicit-duration")]
        let draft = WorkoutDraft(name: "Explicit targets", exercises: [
            .init(exerciseID: EquilibriumFixtures.squatID, name: "Back Squat", prescriptions: [.init(id: UUID(), target: .repetitions(lower: 6, upper: 10), suggestedPounds: 142.5)], restDuration: 75),
            .init(exerciseID: EquilibriumFixtures.plankID, name: "Plank", prescriptions: [.init(id: UUID(), target: .duration(seconds: 47), suggestedPounds: nil)], restDuration: 30)
        ])
        let workout = try await WorkoutBuilderModel(draft: draft, exercises: repository, workouts: repository, history: repository).makeWorkout(now: .init(timeIntervalSince1970: 500))
        XCTAssertEqual(workout.status, .ready); XCTAssertNil(workout.startedAt); XCTAssertNil(workout.completedAt); XCTAssertEqual(workout.exercises.map(\.restDuration), [75, 30]); XCTAssertTrue(workout.exercises.allSatisfy { $0.loggedSets.isEmpty })
        guard case .repetitions(let range) = workout.exercises[0].prescriptions[0].target else { return XCTFail("Expected repetitions") }; XCTAssertEqual(range, 6...10); XCTAssertEqual(workout.exercises[0].prescriptions[0].suggestedWeight?.pounds, 142.5)
        guard case .duration(let seconds) = workout.exercises[1].prescriptions[0].target else { return XCTFail("Expected duration") }; XCTAssertEqual(seconds, 47)
        XCTAssertTrue(Set(workout.exercises.flatMap(\.prescriptions).map(\.id)).isDisjoint(with: originalIDs))
    }

    func testExerciseCreateSearchDuplicateArchiveAndMetadata() async throws {
        let repository = makeRepository(); let exercise = ExerciseDefinition(id: .new(), name: "Café Press", normalizedName: "ignored", aliases: ["Coffee press"], equipment: "Dumbbell", category: "Shoulders", isCustom: true, archivedAt: nil)
        try await repository.saveExercise(exercise)
        let matches = try await repository.searchExercises("cafe")
        XCTAssertEqual(matches.first?.equipment, "Dumbbell")
        do { try await repository.saveExercise(.init(id: .new(), name: "Coffee Press", normalizedName: "", aliases: [], equipment: nil, category: nil, isCustom: true, archivedAt: nil)); XCTFail("Expected duplicate") } catch { XCTAssertEqual(error as? RepositoryError, .duplicateExerciseName) }
        try await repository.archiveExercise(id: exercise.id, at: .now)
        let activeExercises = try await repository.allExercises()
        XCTAssertTrue(activeExercises.isEmpty)
    }

    func testBuilderCreatesMultipleIndependentWorkoutsInStableOrder() async throws {
        let repository = makeRepository(); for exercise in EquilibriumFixtures.exercises { try await repository.saveExercise(exercise) }
        let model = WorkoutBuilderModel(exercises: repository, workouts: repository, history: repository); model.draft.name = "Mixed"; model.add(EquilibriumFixtures.exercises[0]); model.add(EquilibriumFixtures.exercises[1])
        let firstValue = await model.create(now: .init(timeIntervalSince1970: 10))
        let secondValue = await model.create(now: .init(timeIntervalSince1970: 20))
        let first = try XCTUnwrap(firstValue); let second = try XCTUnwrap(secondValue)
        let activeIDs = try await repository.activeWorkouts().map(\.id)
        XCTAssertNotEqual(first.id, second.id); XCTAssertEqual(activeIDs, [first.id, second.id])
    }

    func testRecentDraftRetainsStructureWithFreshDraftIdentity() {
        let recent = EquilibriumFixtures.completed(); let first = WorkoutDraft(recent: recent), second = WorkoutDraft(recent: recent)
        XCTAssertEqual(first.exercises.map(\.exerciseID), recent.exercises.map(\.exerciseID)); XCTAssertNotEqual(first.exercises.map(\.id), second.exercises.map(\.id))
    }

    private func makeRepository() -> SwiftDataRepository { SwiftDataRepository(container: try! PersistenceController.makeContainer(inMemory: true)) }
}
