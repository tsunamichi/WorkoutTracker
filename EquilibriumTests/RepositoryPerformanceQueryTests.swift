import XCTest
@testable import Equilibrium

@MainActor
final class RepositoryPerformanceQueryTests: XCTestCase {
    private let export = Data("""
    {"workouts":[
      {"id":"a-1","date":"2026-02-16","workoutName":"Upper","exercises":[{"name":"Bench Press","sets":[{"weight":"135","reps":"8"}]},{"name":"Row","sets":[{"weight":"95","reps":"10"}]}]},
      {"id":"a-2","date":"2026-02-18","workoutName":"Upper","exercises":[{"name":"Bench Press","sets":[{"weight":"140","reps":"6"}]}]},
      {"id":"a-3","date":"2026-02-20","workoutName":"Lower","exercises":[{"name":"Squat","sets":[{"weight":"185","reps":"5"}]}]}
    ]}
    """.utf8)

    private func seededRepository(storageURL: URL? = nil) throws -> SwiftDataRepository {
        let container = try storageURL.map { try PersistenceController.makeContainer(storageURL: $0) } ?? PersistenceController.makeContainer(inMemory: true)
        let repository = SwiftDataRepository(container: container)
        _ = try RNLegacyImporter(repository: repository).importFileData(export)
        return repository
    }

    func testTargetedExerciseHistoryMatchesFullScan() async throws {
        let repository = try seededRepository()
        let all = try await repository.allWorkouts()
        for definition in try await repository.allExercises() {
            let targeted = try await repository.exercisePerformance(exerciseID: definition.id)
            XCTAssertEqual(targeted, ExercisePerformanceQuery.performance(exerciseID: definition.id, workouts: all))
        }
        let missing = try await repository.exercisePerformance(exerciseID: .init(rawValue: "missing"))
        XCTAssertNil(missing.latestOccurrence)
    }

    func testRecentCompletedWorkoutsMatchesFullScanPrefix() async throws {
        let repository = try seededRepository()
        let full = try await repository.completedWorkouts()
        for limit in [0, 1, 2, 3, 14, .max] {
            let recent = try await repository.recentCompletedWorkouts(limit: limit)
            XCTAssertEqual(recent.map(\.id), Array(full.prefix(limit)).map(\.id), "limit \(limit)")
        }
    }

    func testWorkoutHistoryGroupsConsecutiveWorkoutsByMonth() async throws {
        let repository = try seededRepository()
        var calendar = Calendar(identifier: .gregorian); calendar.timeZone = TimeZone(identifier: "UTC")!
        let workouts = try await repository.completedWorkouts()
        let months = WorkoutHistoryMonth.group(workouts, calendar: calendar)
        XCTAssertEqual(months.count, 1)
        XCTAssertEqual(months.first?.workouts.map(\.id), workouts.map(\.id))
        let first = workouts[0]
        var older = first; older.completedAt = calendar.date(byAdding: .month, value: -1, to: first.completedAt!)
        let split = WorkoutHistoryMonth.group([first, older], calendar: calendar)
        XCTAssertEqual(split.map { $0.workouts.count }, [1, 1])
        XCTAssertEqual(split[0].title(now: split[0].id, calendar: calendar), split[0].id.formatted(.dateTime.month(.wide)))
    }

    func testHomeWorkoutsMatchesFullScan() async throws {
        let repository = try seededRepository()
        let ready = Workout(id: .init(rawValue: "ready"), titleSnapshot: "Ready", exercises: [], status: .ready, startedAt: nil, completedAt: nil, createdAt: .now, updatedAt: .now)
        try await repository.create(ready)
        let completedDates = try await repository.completedWorkouts().map { $0.completedAt! }.sorted()
        let cutoff = completedDates[1]
        let snapshot = try await repository.homeWorkouts(completedSince: cutoff)
        let all = try await repository.allWorkouts()
        let expected = all.filter { $0.status != .completed || $0.completedAt! >= cutoff }
        XCTAssertEqual(Set(snapshot.workouts.map(\.id)), Set(expected.map(\.id)))
        XCTAssertEqual(snapshot.workouts.count, 3)
        XCTAssertTrue(snapshot.hasCompletedWorkouts)
    }

    func testOwnSavesAreReportedAsLocalChanges() async throws {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("origin-\(UUID()).store")
        let repository = try seededRepository(storageURL: url)
        let received = expectation(forNotification: .equilibriumRepositoryDidChange, object: nil) { notification in
            RepositoryChangeOrigin.of(notification) == .local
        }
        try await repository.saveDefaultRestDuration(60)
        await fulfillment(of: [received], timeout: 5)
    }
}
