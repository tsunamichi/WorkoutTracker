import XCTest
import SwiftData
@testable import Equilibrium

@MainActor
final class ProductModelCorrection2Tests: XCTestCase {
    func testFreshProductionEnvironmentHasNoSeedCatalogAndExerciseNeedsOnlyName() async throws {
        let environment = AppEnvironment(container: try PersistenceController.makeContainer(inMemory: true))
        let initiallyEmpty = try await environment.exerciseRepository.allExercises()
        XCTAssertTrue(initiallyEmpty.isEmpty)
        let exercise = ExerciseDefinition(id: .new(), name: "Single-Leg Hamstring Curl", normalizedName: "", aliases: [], equipment: nil, category: nil, isCustom: true, archivedAt: nil)
        try await environment.exerciseRepository.saveExercise(exercise)
        let search = try await environment.exerciseRepository.searchExercises("hamstring")
        XCTAssertEqual(search.map(\.id), [exercise.id])
        do {
            try await environment.exerciseRepository.saveExercise(.init(id: .new(), name: " single leg hamstring-curl ", normalizedName: "", aliases: [], equipment: nil, category: nil, isCustom: true, archivedAt: nil))
            XCTFail("Expected normalized duplicate protection")
        } catch { XCTAssertEqual(error as? RepositoryError, .duplicateExerciseName) }
    }

    func testLatestHistoryUsesNewestCompletedWorkoutAndPreservesActualSetOrder() async throws {
        let repository = makeRepository()
        let older = completed(id: "older", completedAt: Date(timeIntervalSince1970: 100), values: [(135, 10), (140, 9)])
        var abandoned = completed(id: "abandoned", completedAt: Date(timeIntervalSince1970: 300), values: [(999, 1)])
        abandoned.status = .inProgress; abandoned.completedAt = nil
        let newer = completed(id: "newer", completedAt: Date(timeIntervalSince1970: 200), values: [(160, 8), (160, 8), (160, 7)])
        try await repository.materializeAtomically([older, abandoned, newer])
        let result = try await repository.latestExerciseLog(exerciseID: EquilibriumFixtures.squatID)
        let latest = try XCTUnwrap(result)
        XCTAssertEqual(latest.workoutID, newer.id)
        XCTAssertEqual(latest.sets.map(\.repetitions), [8, 8, 7])
        XCTAssertEqual(latest.sets.map { $0.weight?.pounds }, [160, 160, 160])
    }

    func testLightweightBuilderSeedsKnownHistoryAndLeavesNewExerciseEmpty() async throws {
        let repository = makeRepository()
        try await repository.saveExercise(EquilibriumFixtures.exercises[0])
        let historical = completed(id: "history", completedAt: Date(timeIntervalSince1970: 200), values: [(155, 8), (160, 7)])
        try await repository.create(historical)
        let draft = WorkoutDraft(name: "Lower", exercises: [
            .init(exerciseID: EquilibriumFixtures.squatID, name: "Back Squat"),
            .init(exerciseID: nil, name: "Single-Leg Hamstring Curl")
        ])
        let model = WorkoutBuilderModel(draft: draft, exercises: repository, workouts: repository, history: repository)
        XCTAssertTrue(model.canCommit)
        let workout = try await model.makeWorkout(now: Date(timeIntervalSince1970: 400))
        XCTAssertEqual(workout.exercises[0].prescriptions.count, 2)
        XCTAssertEqual(workout.exercises[0].prescriptions.map { $0.suggestedWeight?.pounds }, [155, 160])
        XCTAssertTrue(workout.exercises[1].prescriptions.isEmpty)
        XCTAssertTrue(workout.exercises.allSatisfy { $0.loggedSets.isEmpty })
        XCTAssertTrue(Set(workout.exercises.map(\.id)).isDisjoint(with: Set(historical.exercises.map(\.id))))
        XCTAssertTrue(Set(workout.exercises.flatMap(\.prescriptions).map(\.id)).isDisjoint(with: Set(historical.exercises.flatMap(\.prescriptions).map(\.id))))
    }

    func testZeroHistoryCannotCompleteAndFirstSetAddEditUseFreshCanonicalIdentity() async throws {
        let repository = makeRepository()
        let exercise = WorkoutExercise(id: .new(), exerciseID: .new(), nameSnapshot: "New Exercise", prescriptions: [], loggedSets: [], restDuration: nil, skippedAt: nil)
        let workout = Workout(id: .new(), titleSnapshot: "New", exercises: [exercise], status: .ready, startedAt: nil, completedAt: nil, createdAt: .now, updatedAt: .now)
        XCTAssertFalse(WorkoutExecutionQuery.isComplete(exercise)); XCTAssertFalse(WorkoutExecutionQuery.canComplete(workout))
        try await repository.create(workout); _ = try await repository.startWorkout(id: workout.id, at: Date(timeIntervalSince1970: 10))
        let appended = try await repository.appendSet(workoutID: workout.id, exerciseID: exercise.id, seed: .repetitions(weight: .init(pounds: 100), repetitions: 8), at: Date(timeIntervalSince1970: 20))
        let firstID = try XCTUnwrap(appended.exercises[0].prescriptions.first?.id)
        let logged = try await repository.logSet(workoutID: workout.id, exerciseID: exercise.id, prescriptionID: firstID, input: .repetitions(weight: .init(pounds: 100), repetitions: 8), completed: true, at: Date(timeIntervalSince1970: 30))
        let logID = try XCTUnwrap(logged.exercises[0].loggedSets.first?.id)
        let added = try await repository.appendSet(workoutID: workout.id, exerciseID: exercise.id, seed: nil, at: Date(timeIntervalSince1970: 40))
        XCTAssertNotEqual(added.exercises[0].prescriptions.last?.id, firstID)
        let edited = try await repository.logSet(workoutID: workout.id, exerciseID: exercise.id, prescriptionID: firstID, input: .repetitions(weight: .init(pounds: 105), repetitions: 9), completed: true, at: Date(timeIntervalSince1970: 50))
        XCTAssertEqual(edited.exercises[0].loggedSets.first?.id, logID)
        XCTAssertFalse(WorkoutExecutionQuery.canComplete(edited))
    }

    func testPasteUnknownStaysTransientUntilBuilderCommit() throws {
        let parsed = WorkoutTextParser().parse("Lower\n\nBack Squat 3x8\nNovel Curl 2x10")
        let draft = WorkoutImportDraftConverter.lightweightDraft(from: try XCTUnwrap(parsed.workouts.first), catalog: [EquilibriumFixtures.exercises[0]])
        XCTAssertEqual(draft.exercises.map(\.exerciseID), [EquilibriumFixtures.squatID, nil])
        XCTAssertEqual(draft.exercises.map(\.name), ["Back Squat", "Novel Curl"])
        XCTAssertTrue(draft.exercises.allSatisfy { $0.prescriptions.isEmpty })
    }

    func testRecentCopyUsesSelectedStructureButLatestPerExercisePerformance() async throws {
        let repository = makeRepository()
        let selected = completed(id: "selected-old", completedAt: Date(timeIntervalSince1970: 100), values: [(100, 10)])
        let latest = completed(id: "latest-other", completedAt: Date(timeIntervalSince1970: 200), values: [(175, 6), (175, 6)])
        try await repository.materializeAtomically([selected, latest])
        let copy = try await selected.freshCopy(createdAt: Date(timeIntervalSince1970: 300), history: repository)
        XCTAssertEqual(copy.titleSnapshot, selected.titleSnapshot)
        XCTAssertEqual(copy.exercises.map(\.exerciseID), selected.exercises.map(\.exerciseID))
        XCTAssertEqual(copy.exercises[0].prescriptions.count, 2)
        XCTAssertEqual(copy.exercises[0].prescriptions.map { $0.suggestedWeight?.pounds }, [175, 175])
        XCTAssertTrue(copy.exercises[0].loggedSets.isEmpty)
        XCTAssertNotEqual(copy.id, selected.id)
    }

    private func makeRepository() -> SwiftDataRepository {
        SwiftDataRepository(container: try! PersistenceController.makeContainer(inMemory: true))
    }

    private func completed(id: String, completedAt: Date, values: [(Double, Int)]) -> Workout {
        let prescriptions = values.enumerated().map { SetPrescription(id: .init(rawValue: "\(id)-p-\($0.offset)"), target: .repetitions(range: $0.element.1...$0.element.1), suggestedWeight: .init(pounds: $0.element.0)) }
        let logs = zip(prescriptions, values).enumerated().map { index, pair in LoggedSet(id: .init(rawValue: "\(id)-l-\(index)"), prescriptionID: pair.0.id, weight: .init(pounds: pair.1.0), repetitions: pair.1.1, duration: nil, completedAt: completedAt.addingTimeInterval(Double(index))) }
        let exercise = WorkoutExercise(id: .init(rawValue: "\(id)-e"), exerciseID: EquilibriumFixtures.squatID, nameSnapshot: "Back Squat", prescriptions: prescriptions, loggedSets: logs, restDuration: nil, skippedAt: nil)
        return .init(id: .init(rawValue: id), titleSnapshot: "Workout \(id)", exercises: [exercise], status: .completed, startedAt: completedAt.addingTimeInterval(-60), completedAt: completedAt, createdAt: completedAt.addingTimeInterval(-120), updatedAt: completedAt)
    }
}
