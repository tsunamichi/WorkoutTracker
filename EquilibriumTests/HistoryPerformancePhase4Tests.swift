import SwiftData
import XCTest
@testable import Equilibrium

@MainActor
final class HistoryPerformancePhase4Tests: XCTestCase {
    private let exerciseA = ExerciseID(rawValue: "exercise-a")
    private let exerciseB = ExerciseID(rawValue: "exercise-b")

    func testHistoryContainsOnlyCompletedAndUsesDeterministicReverseCompletionOrder() {
        let same = Date(timeIntervalSince1970: 500)
        let older = workout(id: "older", exerciseID: exerciseA, completedAt: .init(timeIntervalSince1970: 100))
        let tieA = workout(id: "tie-a", exerciseID: exerciseA, completedAt: same)
        let tieB = workout(id: "tie-b", exerciseID: exerciseA, completedAt: same)
        var ready = workout(id: "ready", exerciseID: exerciseA, completedAt: .init(timeIntervalSince1970: 900))
        ready.status = .ready; ready.startedAt = nil; ready.completedAt = nil
        XCTAssertEqual(WorkoutHistoryQuery.completed([older, ready, tieA, tieB]).map(\.id.rawValue), ["tie-b", "tie-a", "older"])
        XCTAssertTrue(WorkoutHistoryQuery.completed([]).isEmpty)
    }

    func testSameDayWorkoutsRemainDistinctAndDetailPreservesCanonicalSets() {
        let first = workout(id: "same-a", exerciseID: exerciseA, completedAt: .init(timeIntervalSince1970: 100), values: [.repetitions(100, 8), .repetitions(nil, 12)])
        let second = workout(id: "same-b", exerciseID: exerciseA, completedAt: .init(timeIntervalSince1970: 200), values: [.repetitions(110, 6)])
        let history = WorkoutHistoryQuery.completed([first, second])
        XCTAssertEqual(history.count, 2)
        XCTAssertEqual(ExercisePerformanceQuery.validCompletedSets(in: history[1].exercises[0]).map(\.repetitions), [8, 12])
    }

    func testExerciseHistoryUsesStableIdentityNotNameAndRenameDoesNotDetachHistory() {
        var older = workout(id: "old", exerciseID: exerciseA, name: "Original Name", completedAt: .init(timeIntervalSince1970: 100))
        let other = workout(id: "other", exerciseID: exerciseB, name: "Original Name", completedAt: .init(timeIntervalSince1970: 150))
        var newer = workout(id: "new", exerciseID: exerciseA, name: "Renamed Exercise", completedAt: .init(timeIntervalSince1970: 200))
        older.titleSnapshot = "Historical Template"; newer.titleSnapshot = "Changed Template"
        let performance = ExercisePerformanceQuery.performance(exerciseID: exerciseA, workouts: [other, newer, older])
        XCTAssertEqual(performance.occurrences.map(\.workoutID.rawValue), ["old", "new"])
        XCTAssertEqual(performance.occurrences.map(\.exerciseNameSnapshot), ["Original Name", "Renamed Exercise"])
        XCTAssertEqual(performance.occurrences.map(\.workoutTitleSnapshot), ["Historical Template", "Changed Template"])
        XCTAssertTrue(ExercisePerformanceQuery.performance(exerciseID: exerciseB, workouts: [other, newer, older]).occurrences.allSatisfy { $0.exerciseID == exerciseB })
    }

    func testInvalidAndIncompleteLogsDoNotContributeAndMissingWeightDoes() {
        var value = workout(id: "validity", exerciseID: exerciseA, completedAt: .init(timeIntervalSince1970: 100), values: [.repetitions(nil, 12)])
        let prescription = value.exercises[0].prescriptions[0]
        value.exercises[0].loggedSets.append(.init(id: .init(rawValue: "unfinished"), prescriptionID: prescription.id, weight: .init(pounds: 500), repetitions: 1, duration: nil, completedAt: nil))
        value.exercises[0].loggedSets.append(.init(id: .init(rawValue: "orphan"), prescriptionID: .init(rawValue: "missing"), weight: .init(pounds: 900), repetitions: 1, duration: nil, completedAt: .init(timeIntervalSince1970: 5)))
        let result = ExercisePerformanceQuery.performance(exerciseID: exerciseA, workouts: [value])
        XCTAssertEqual(result.occurrences[0].sets.count, 1)
        XCTAssertNil(result.occurrences[0].sets[0].weight)
        XCTAssertEqual(result.trend[0].value, .repetitions(12))
    }

    func testRepetitionPRUsesWeightThenRepetitionsWithDeterministicTieAndPresentationOnlyConversion() throws {
        let value = workout(id: "pr", exerciseID: exerciseA, completedAt: .init(timeIntervalSince1970: 100), values: [.repetitions(200, 5), .repetitions(195, 20), .repetitions(200, 7), .repetitions(200, 7)])
        let result = ExercisePerformanceQuery.performance(exerciseID: exerciseA, workouts: [value])
        guard case .repetitions(let set) = try XCTUnwrap(result.personalRecord) else { return XCTFail("Expected repetition PR") }
        XCTAssertEqual(set.weight?.pounds, 200)
        XCTAssertEqual(set.repetitions, 7)
        XCTAssertEqual(set.id.rawValue, "pr-log-2")
        XCTAssertEqual(WeightText.format(try XCTUnwrap(set.weight).value(in: .kilograms)), "90.7")
        guard case .repetitions(let poundsSet) = try XCTUnwrap(ExercisePerformanceQuery.performance(exerciseID: exerciseA, workouts: [value]).personalRecord) else { return XCTFail() }
        XCTAssertEqual(poundsSet.id, set.id)
    }

    func testUnweightedPRComparesRepetitionsWithoutTreatingAbsenceAsZero() throws {
        let value = workout(id: "bodyweight", exerciseID: exerciseA, completedAt: .init(timeIntervalSince1970: 100), values: [.repetitions(nil, 10), .repetitions(nil, 15)])
        guard case .repetitions(let set) = try XCTUnwrap(ExercisePerformanceQuery.performance(exerciseID: exerciseA, workouts: [value]).personalRecord) else { return XCTFail() }
        XCTAssertNil(set.weight); XCTAssertEqual(set.repetitions, 15)
    }

    func testDurationPRAndTrendAreIndependentFromWeight() throws {
        let first = workout(id: "duration-a", exerciseID: exerciseA, completedAt: .init(timeIntervalSince1970: 100), values: [.duration(45)])
        let second = workout(id: "duration-b", exerciseID: exerciseA, completedAt: .init(timeIntervalSince1970: 200), values: [.duration(75)])
        let result = ExercisePerformanceQuery.performance(exerciseID: exerciseA, workouts: [second, first])
        guard case .duration(let set) = try XCTUnwrap(result.personalRecord) else { return XCTFail() }
        XCTAssertEqual(set.duration, 75)
        XCTAssertEqual(result.trend.map(\.value), [.duration(45), .duration(75)])
    }

    func testTrendIsCanonicalChronologicalAndHandlesEmptyAndSinglePoint() {
        let old = workout(id: "old", exerciseID: exerciseA, completedAt: .init(timeIntervalSince1970: 100), values: [.repetitions(100, 10), .repetitions(110, 6)])
        let new = workout(id: "new", exerciseID: exerciseA, completedAt: .init(timeIntervalSince1970: 200), values: [.repetitions(120, 5)])
        XCTAssertTrue(ExercisePerformanceQuery.performance(exerciseID: exerciseA, workouts: []).trend.isEmpty)
        XCTAssertEqual(ExercisePerformanceQuery.performance(exerciseID: exerciseA, workouts: [old]).trend.count, 1)
        XCTAssertEqual(ExercisePerformanceQuery.performance(exerciseID: exerciseA, workouts: [new, old]).trend.map(\.workoutID.rawValue), ["old", "new"])
    }

    func testLatestDurationFamilyExcludesOlderWeightedDataFromPRAndTrendButKeepsHistory() throws {
        let weighted = workout(id: "weighted-old", exerciseID: exerciseA, completedAt: .init(timeIntervalSince1970: 100), values: [.repetitions(135, 8)])
        let durationA = workout(id: "duration-a", exerciseID: exerciseA, completedAt: .init(timeIntervalSince1970: 200), values: [.duration(45)])
        let durationB = workout(id: "duration-b", exerciseID: exerciseA, completedAt: .init(timeIntervalSince1970: 300), values: [.duration(60)])
        let result = ExercisePerformanceQuery.performance(exerciseID: exerciseA, workouts: [durationB, weighted, durationA])
        XCTAssertEqual(result.activeMetricFamily, .duration)
        guard case .duration(let record) = try XCTUnwrap(result.personalRecord) else { return XCTFail() }
        XCTAssertEqual(record.duration, 60)
        XCTAssertEqual(result.trend.map(\.value), [.duration(45), .duration(60)])
        XCTAssertEqual(result.occurrences.count, 3)
        XCTAssertTrue(result.occurrences[0].sets.contains { $0.weight?.pounds == 135 })
    }

    func testLatestUnweightedFamilyExcludesOlderWeightedDataFromPRAndTrendButKeepsHistory() throws {
        let weighted = workout(id: "weighted-old", exerciseID: exerciseA, completedAt: .init(timeIntervalSince1970: 100), values: [.repetitions(45, 5)])
        let unweightedA = workout(id: "unweighted-a", exerciseID: exerciseA, completedAt: .init(timeIntervalSince1970: 200), values: [.repetitions(nil, 10), .repetitions(nil, 14)])
        let unweightedB = workout(id: "unweighted-b", exerciseID: exerciseA, completedAt: .init(timeIntervalSince1970: 300), values: [.repetitions(nil, 16)])
        let result = ExercisePerformanceQuery.performance(exerciseID: exerciseA, workouts: [unweightedB, weighted, unweightedA])
        XCTAssertEqual(result.activeMetricFamily, .unweightedRepetitions)
        guard case .repetitions(let record) = try XCTUnwrap(result.personalRecord) else { return XCTFail() }
        XCTAssertNil(record.weight); XCTAssertEqual(record.repetitions, 16)
        XCTAssertEqual(result.trend.map(\.value), [.repetitions(14), .repetitions(16)])
        XCTAssertEqual(result.occurrences.count, 3)
    }

    func testLatestWeightedFamilyExcludesOlderDurationFromPRAndTrend() throws {
        let duration = workout(id: "duration-old", exerciseID: exerciseA, completedAt: .init(timeIntervalSince1970: 100), values: [.duration(120)])
        let weighted = workout(id: "weighted-new", exerciseID: exerciseA, completedAt: .init(timeIntervalSince1970: 200), values: [.repetitions(155, 8)])
        let result = ExercisePerformanceQuery.performance(exerciseID: exerciseA, workouts: [weighted, duration])
        XCTAssertEqual(result.activeMetricFamily, .weightedRepetitions)
        guard case .repetitions(let record) = try XCTUnwrap(result.personalRecord) else { return XCTFail() }
        XCTAssertEqual(record.weight?.pounds, 155)
        XCTAssertEqual(result.trend.map(\.value), [.weight(pounds: 155, repetitions: 8)])
        XCTAssertEqual(result.occurrences.count, 2)
    }

    func testCatalogArchiveAndTemplateMutationCannotRewriteSnapshots() async throws {
        let repository = try makeRepository()
        let definition = ExerciseDefinition(id: exerciseA, name: "Current Catalog Name", normalizedName: "", aliases: [], equipment: nil, category: nil, isCustom: true, archivedAt: nil)
        try await repository.saveExercise(definition)
        let historical = workout(id: "snapshot", exerciseID: exerciseA, name: "Historical Name", completedAt: .init(timeIntervalSince1970: 100))
        try await repository.create(historical)
        try await repository.archiveExercise(id: exerciseA, at: .init(timeIntervalSince1970: 200))
        let loadedValue = try await repository.completedWorkout(id: historical.id)
        let loaded = try XCTUnwrap(loadedValue)
        XCTAssertEqual(loaded.titleSnapshot, "Workout snapshot")
        XCTAssertEqual(loaded.exercises[0].nameSnapshot, "Historical Name")
        let performance = try await repository.exercisePerformance(exerciseID: exerciseA)
        XCTAssertEqual(performance.displayName, "Historical Name")
    }

    func testRepositoryRecreationProducesIdenticalHistoryPerformanceAndPR() async throws {
        let url = TestSupport.temporaryStoreURL()
        var container: ModelContainer? = try PersistenceController.makeContainer(storageURL: url)
        var repository: SwiftDataRepository? = SwiftDataRepository(container: container!)
        let historical = workout(id: "relaunch", exerciseID: exerciseA, completedAt: .init(timeIntervalSince1970: 100), values: [.repetitions(155, 8)])
        try await repository!.create(historical)
        let beforeHistory = try await repository!.completedWorkouts()
        let beforePerformance = try await repository!.exercisePerformance(exerciseID: exerciseA)
        repository = nil; container = nil
        let reopened = SwiftDataRepository(container: try PersistenceController.makeContainer(storageURL: url))
        let afterHistory = try await reopened.completedWorkouts()
        let afterPerformance = try await reopened.exercisePerformance(exerciseID: exerciseA)
        XCTAssertEqual(afterHistory, beforeHistory)
        XCTAssertEqual(afterPerformance, beforePerformance)
    }

    private enum Value { case repetitions(Double?, Int); case duration(TimeInterval) }

    private func workout(id: String, exerciseID: ExerciseID, name: String = "Same Name", completedAt: Date, values: [Value] = [.repetitions(100, 8)]) -> Workout {
        let pairs: [(SetPrescription, LoggedSet)] = values.enumerated().map { index, value in
            let prescriptionID = SetID(rawValue: "\(id)-set-\(index)")
            let prescription: SetPrescription
            let log: LoggedSet
            switch value {
            case .repetitions(let pounds, let repetitions):
                prescription = .init(id: prescriptionID, target: .repetitions(range: 1...max(1, repetitions)), suggestedWeight: pounds.map(Weight.init(pounds:)))
                log = .init(id: .init(rawValue: "\(id)-log-\(index)"), prescriptionID: prescriptionID, weight: pounds.map(Weight.init(pounds:)), repetitions: repetitions, duration: nil, completedAt: completedAt.addingTimeInterval(Double(index)))
            case .duration(let duration):
                prescription = .init(id: prescriptionID, target: .duration(seconds: duration), suggestedWeight: nil)
                log = .init(id: .init(rawValue: "\(id)-log-\(index)"), prescriptionID: prescriptionID, weight: nil, repetitions: nil, duration: duration, completedAt: completedAt.addingTimeInterval(Double(index)))
            }
            return (prescription, log)
        }
        let exercise = WorkoutExercise(id: .init(rawValue: "\(id)-exercise"), exerciseID: exerciseID, nameSnapshot: name, prescriptions: pairs.map(\.0), loggedSets: pairs.map(\.1), restDuration: nil, skippedAt: nil)
        return Workout(id: .init(rawValue: id), titleSnapshot: "Workout snapshot", exercises: [exercise], status: .completed, startedAt: completedAt.addingTimeInterval(-100), completedAt: completedAt, createdAt: completedAt.addingTimeInterval(-200), updatedAt: completedAt)
    }

    private func makeRepository() throws -> SwiftDataRepository { SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true)) }
}
