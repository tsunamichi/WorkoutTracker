import XCTest
@testable import Equilibrium

final class ReuseWorkoutDistinctTests: XCTestCase {
    func testRepeatedRoutinesCollapseToMostRecentRun() {
        var newest = EquilibriumFixtures.completed(id: "push-new"); newest.titleSnapshot = "Push v2"
        var older = EquilibriumFixtures.completed(id: "push-old"); older.titleSnapshot = " push V2 "
        older.exercises = older.exercises + EquilibriumFixtures.completed(id: "extra").exercises.map(Self.renamed("plank"))
        newest.exercises = older.exercises.reversed()
        var renamed = EquilibriumFixtures.completed(id: "pull"); renamed.titleSnapshot = "Pull v2"
        let result = Workout.distinctRoutines([newest, renamed, older])
        XCTAssertEqual(result.map(\.id.rawValue), ["push-new", "pull"])
    }

    func testSameNameWithDifferentExercisesStaysSeparate() {
        var a = EquilibriumFixtures.completed(id: "a"); a.titleSnapshot = "Untitled Copy"
        var b = EquilibriumFixtures.completed(id: "b"); b.titleSnapshot = "Untitled Copy"
        b.exercises = b.exercises.map(Self.renamed("other"))
        XCTAssertEqual(Workout.distinctRoutines([a, b]).map(\.id.rawValue), ["a", "b"])
    }

    private static func renamed(_ id: String) -> (WorkoutExercise) -> WorkoutExercise {
        { .init(id: $0.id, exerciseID: .init(rawValue: id), nameSnapshot: $0.nameSnapshot, prescriptions: $0.prescriptions, loggedSets: $0.loggedSets, restDuration: $0.restDuration, skippedAt: $0.skippedAt) }
    }
}
