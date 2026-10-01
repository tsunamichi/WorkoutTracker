import XCTest
@testable import Equilibrium

@MainActor
final class WorkoutHistoryImportTests: XCTestCase {
    private let export = Data("""
    {"startDate":"2026-01-01","endDate":"2026-10-01","isEmpty":false,"workouts":[
      {"id":"sw-cp-1771257952786-2026-02-16","date":"2026-02-16","workoutName":"Upper A","exercises":[
        {"name":"Bench Press","sets":[{"weight":"135","reps":"8"},{"weight":"—","reps":"—"},{"weight":"0","reps":"10"}]},
        {"name":"bench  press","sets":[{"weight":"95","reps":"12"}]}]},
      {"id":"sw-cp-1-2026-02-18","date":"2026-02-18","workoutName":"Empty","exercises":[{"name":"Row","sets":[{"weight":"—","reps":"—"}]}]}
    ]}
    """.utf8)

    func testHistoryExportImportsCompletedWorkoutsAndBlocksReimport() async throws {
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        let importer = RNLegacyImporter(repository: repository)
        let result = try importer.importFileData(export)
        XCTAssertEqual(result, .init(exercisesImported: 1, workoutsImported: 1, timersImported: 0, skippedMalformed: 1))

        let completed = try await repository.completedWorkouts()
        let workout = try XCTUnwrap(completed.first)
        XCTAssertEqual(workout.titleSnapshot, "Upper A")
        XCTAssertEqual(workout.completedAt, Date(timeIntervalSince1970: 1_771_257_952.786))
        XCTAssertEqual(Set(workout.exercises.map(\.exerciseID)).count, 1)
        let sets = workout.exercises[0].loggedSets
        XCTAssertEqual(sets.map(\.repetitions), [8, 10])
        XCTAssertEqual(sets.map(\.weight?.pounds), [135, nil])
        XCTAssertThrowsError(try importer.importFileData(export))
    }
}
