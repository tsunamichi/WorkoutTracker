import SwiftData
import XCTest
@testable import Equilibrium

@MainActor
final class DefaultWorkoutSeedTests: XCTestCase {
    func testFreshDatabaseSeedsTheThreeSpecifiedWorkoutsExactly() async throws {
        let container = try PersistenceController.makeContainer(inMemory: true)
        let environment = try AppEnvironment(container: container)
        let workouts = try await environment.workoutRepository.allWorkouts()

        XCTAssertEqual(workouts.map(\.titleSnapshot), [
            "Lower Quad — P2",
            "Upper Push — P2",
            "Upper Pull — P2"
        ])
        XCTAssertEqual(workouts.map(\.exercises.count), [9, 11, 10])

        for (workout, expectedExercises) in zip(workouts, Self.expectedWorkouts) {
            XCTAssertEqual(workout.status, .ready)
            XCTAssertEqual(workout.exercises.map(\.nameSnapshot), expectedExercises.map(\.name))
            for (exercise, expected) in zip(workout.exercises, expectedExercises) {
                XCTAssertEqual(exercise.prescriptions.count, expected.sets, exercise.nameSnapshot)
                XCTAssertEqual(exercise.isTimeBased, expected.durationSeconds != nil, exercise.nameSnapshot)
                XCTAssertEqual(exercise.skippedAt, nil)
                XCTAssertEqual(exercise.loggedSets, [])

                for prescription in exercise.prescriptions {
                    switch (prescription.target, expected.repetitions, expected.durationSeconds) {
                    case let (.repetitions(range), .some(repetitions), nil):
                        XCTAssertEqual(range, repetitions...repetitions, exercise.nameSnapshot)
                    case let (.duration(seconds), nil, .some(duration)):
                        XCTAssertEqual(seconds, TimeInterval(duration), accuracy: 0.001, exercise.nameSnapshot)
                    default:
                        XCTFail("Unexpected target for \(exercise.nameSnapshot)")
                    }
                    XCTAssertEqual(prescription.suggestedWeight?.pounds, expected.pounds, exercise.nameSnapshot)
                }
            }
        }

        let repository = try XCTUnwrap(environment.exerciseRepository as? SwiftDataRepository)
        let definitions = try await repository.allExercises()
        XCTAssertEqual(definitions.count, 30)
    }

    func testRepeatedDefaultSeedingDoesNotDuplicateWorkoutsOrExerciseDefinitions() async throws {
        let container = try PersistenceController.makeContainer(inMemory: true)
        _ = try AppEnvironment(container: container)
        try AppEnvironment.seedDefaultWorkoutsIfNeeded(in: container)
        _ = try AppEnvironment(container: container)

        let repository = SwiftDataRepository(container: container)
        let workouts = try await repository.allWorkouts()
        let definitions = try await repository.allExercises()
        XCTAssertEqual(workouts.count, 3)
        XCTAssertEqual(Set(workouts.map(\.id)).count, 3)
        XCTAssertEqual(definitions.count, 30)
        XCTAssertEqual(Set(definitions.map(\.normalizedName)).count, 30)
    }

    func testDefaultSeedReusesExistingCatalogExerciseByNameOrAlias() throws {
        let existingSpanishSquat = ExerciseDefinition(
            id: .init(rawValue: "catalog-spanish-squat"),
            name: "Spanish Squat ISO",
            normalizedName: "spanish squat iso",
            aliases: [],
            equipment: nil,
            category: nil,
            isCustom: true,
            archivedAt: nil
        )
        let existingFacePull = ExerciseDefinition(
            id: .init(rawValue: "catalog-face-pull"),
            name: "Cable Face Pull",
            normalizedName: "cable face pull",
            aliases: ["Face Pull"],
            equipment: nil,
            category: nil,
            isCustom: true,
            archivedAt: nil
        )

        let seed = EquilibriumFixtures.defaultSeed(existingExercises: [existingSpanishSquat, existingFacePull])
        XCTAssertEqual(seed.definitions.count, 28)
        XCTAssertEqual(seed.workouts[0].exercises[0].exerciseID, existingSpanishSquat.id)
        XCTAssertEqual(seed.workouts[2].exercises[6].exerciseID, existingFacePull.id)
        XCTAssertFalse(seed.definitions.contains { $0.id == existingSpanishSquat.id || $0.id == existingFacePull.id })
    }

    private struct ExpectedExercise {
        let name: String
        let sets: Int
        let repetitions: Int?
        let durationSeconds: Int?
        let pounds: Double?
    }

    private static let expectedWorkouts: [[ExpectedExercise]] = [
        [
            .init(name: "Spanish Squat ISO", sets: 2, repetitions: nil, durationSeconds: 45, pounds: nil),
            .init(name: "Hip Airplane", sets: 2, repetitions: 11, durationSeconds: nil, pounds: nil),
            .init(name: "Hamstring Scoops", sets: 1, repetitions: 10, durationSeconds: nil, pounds: nil),
            .init(name: "Reverse Nordic", sets: 4, repetitions: 10, durationSeconds: nil, pounds: nil),
            .init(name: "Single-leg Leg Press", sets: 3, repetitions: 10, durationSeconds: nil, pounds: nil),
            .init(name: "Single-leg Leg Extension", sets: 3, repetitions: 10, durationSeconds: nil, pounds: nil),
            .init(name: "Tibialis Raise", sets: 3, repetitions: 15, durationSeconds: nil, pounds: nil),
            .init(name: "Single-leg RDL", sets: 4, repetitions: 11, durationSeconds: nil, pounds: nil),
            .init(name: "Standing Calf Raise", sets: 3, repetitions: 15, durationSeconds: nil, pounds: nil)
        ],
        [
            .init(name: "Cable External Rotation", sets: 2, repetitions: 14, durationSeconds: nil, pounds: nil),
            .init(name: "Banded Face Pull", sets: 2, repetitions: 14, durationSeconds: nil, pounds: nil),
            .init(name: "Serratus Wall Slide", sets: 2, repetitions: 15, durationSeconds: nil, pounds: nil),
            .init(name: "Push-Up Plus", sets: 2, repetitions: 12, durationSeconds: nil, pounds: nil),
            .init(name: "Bench Press", sets: 4, repetitions: 5, durationSeconds: nil, pounds: 160),
            .init(name: "Incline Dumbbell Press", sets: 3, repetitions: 13, durationSeconds: nil, pounds: 40),
            .init(name: "Machine Shoulder Press", sets: 3, repetitions: 6, durationSeconds: nil, pounds: 80),
            .init(name: "Low-to-High Cable Fly", sets: 3, repetitions: 13, durationSeconds: nil, pounds: 20),
            .init(name: "Cable Lateral Raise", sets: 3, repetitions: 10, durationSeconds: nil, pounds: 15),
            .init(name: "Rope Pushdown", sets: 3, repetitions: 15, durationSeconds: nil, pounds: 42.5),
            .init(name: "Chest Dips", sets: 2, repetitions: 10, durationSeconds: nil, pounds: 7.5)
        ],
        [
            .init(name: "Band Pull Apart", sets: 2, repetitions: 15, durationSeconds: nil, pounds: nil),
            .init(name: "Scapular Pull-Up", sets: 2, repetitions: 10, durationSeconds: nil, pounds: nil),
            .init(name: "Lat Pulldown", sets: 4, repetitions: 8, durationSeconds: nil, pounds: nil),
            .init(name: "Chest-Supported Row", sets: 3, repetitions: 10, durationSeconds: nil, pounds: nil),
            .init(name: "Single-arm Cable Row", sets: 3, repetitions: 10, durationSeconds: nil, pounds: nil),
            .init(name: "Reverse Pec Deck", sets: 3, repetitions: 12, durationSeconds: nil, pounds: nil),
            .init(name: "Face Pull", sets: 3, repetitions: 12, durationSeconds: nil, pounds: nil),
            .init(name: "Incline Dumbbell Curl", sets: 3, repetitions: 10, durationSeconds: nil, pounds: nil),
            .init(name: "Hammer Curl", sets: 3, repetitions: 12, durationSeconds: nil, pounds: nil),
            .init(name: "Farmer Carry", sets: 3, repetitions: nil, durationSeconds: 30, pounds: nil)
        ]
    ]
}
