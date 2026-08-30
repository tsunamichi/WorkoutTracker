import XCTest
@testable import Equilibrium

final class WorkoutImportPhase3BTests: XCTestCase {
    private let parser = WorkoutTextParser()

    func testBasicGrammarWhitespaceBulletsAndBlankLines() throws {
        let result = parser.parse("  Push  \n\n• Bench Press 3x8\nIncline Press 3 x 10\nCable Fly 3×12\nPlank 3x30 sec\n")
        XCTAssertFalse(result.hasBlockingIssues); XCTAssertEqual(result.workouts.count, 1)
        XCTAssertEqual(result.workouts[0].name, "Push")
        XCTAssertEqual(result.workouts[0].exercises.map(\.name), ["Bench Press", "Incline Press", "Cable Fly", "Plank"])
        XCTAssertEqual(result.workouts[0].exercises.map(\.prescriptions.count), [3, 3, 3, 3])
        guard case .duration(seconds: 30) = result.workouts[0].exercises[3].prescriptions[0].target else { return XCTFail("Expected duration") }
    }

    func testSeparatorsRangesSetsOfWeightAndRest() throws {
        let result = parser.parse("Strength\n\nBench Press — 3 x 8-12 @ 100 lb, rest 90 sec\nPlank: 2 sets of 30 reps")
        XCTAssertFalse(result.hasBlockingIssues)
        let bench = result.workouts[0].exercises[0]
        guard case .repetitions(let range) = bench.prescriptions[0].target else { return XCTFail("Expected repetitions") }
        XCTAssertEqual(range, 8...12); XCTAssertEqual(bench.prescriptions[0].suggestedPounds, 100); XCTAssertEqual(bench.restDuration, 90)
    }

    func testKilogramsConvertToCanonicalPoundsAndBareWeightIsRejected() throws {
        let kg = parser.parse("Push\n\nBench Press 3x8 @ 10 kg")
        XCTAssertEqual(kg.workouts[0].exercises[0].prescriptions[0].suggestedPounds ?? 0, Weight(10, unit: .kilograms).pounds, accuracy: 0.0001)
        let bare = parser.parse("Push\n\nBench Press 3x8 @ 10")
        XCTAssertTrue(bare.hasBlockingIssues)
    }

    func testMultipleNamedWorkoutsStayIndependentAndOrdered() throws {
        let result = parser.parse(WorkoutImportFixtures.multiple)
        XCTAssertFalse(result.hasBlockingIssues); XCTAssertEqual(result.workouts.map(\.name), ["Push", "Core"])
        XCTAssertEqual(result.workouts[0].exercises.map(\.name), ["Back Squat"])
        XCTAssertEqual(result.workouts[1].exercises.map(\.name), ["Plank"])
    }

    func testEmptyMalformedUnknownMissingNameAndInvalidCounts() throws {
        XCTAssertTrue(parser.parse("").hasBlockingIssues)
        for input in ["Push\n\nBench Press 3x", "Push\n\nUnknown prose", "Push\n\n3x8", "Push\n\nBench Press 0x8", "Push\n\nBench Press 3x0"] {
            let result = parser.parse(input); XCTAssertTrue(result.hasBlockingIssues, input); XCTAssertFalse(result.issues.isEmpty, input)
        }
    }

    func testUnsupportedSemanticsBecomeVisibleWarnings() throws {
        let result = parser.parse("Push\n\nSuperset\nBack Squat 3x8")
        XCTAssertFalse(result.hasBlockingIssues); XCTAssertEqual(result.issues.first?.severity, .warning); XCTAssertEqual(result.workouts[0].exercises.count, 1)
    }

    func testLightweightConversionMatchesKnownVocabularyAndLeavesUnknownTransient() throws {
        let canonical = ExerciseDefinition(id: .new(), name: "Café Press", normalizedName: "cafe press", aliases: ["Coffee Press"], equipment: nil, category: nil, isCustom: false, archivedAt: nil)
        let pullup = ExerciseDefinition(id: .new(), name: "Pull-up", normalizedName: "pull up", aliases: [], equipment: nil, category: nil, isCustom: false, archivedAt: nil)
        for name in ["CAFÉ PRESS", "Coffee Press", "pullup"] {
            let parsed = parser.parse("Test\n\n\(name) 1x8")
            XCTAssertNotNil(WorkoutImportDraftConverter.lightweightDraft(from: parsed.workouts[0], catalog: [canonical, pullup]).exercises[0].exerciseID)
        }
        let unknown = parser.parse("Test\n\nMystery Press 1x8")
        XCTAssertNil(WorkoutImportDraftConverter.lightweightDraft(from: unknown.workouts[0], catalog: [canonical]).exercises[0].exerciseID)
    }

    @MainActor func testPasteMaterializesOneWorkoutWithFreshCanonicalIdentity() async throws {
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        for exercise in EquilibriumFixtures.exercises { try await repository.saveExercise(exercise) }
        let result = parser.parse(WorkoutImportFixtures.simple)
        let values = try await WorkoutPasteMaterializer(exercises: repository, workouts: repository, history: repository).materialize(result.workouts, now: .init(timeIntervalSince1970: 100))
        XCTAssertEqual(values.count, 1); XCTAssertEqual(values[0].status, .ready); XCTAssertNil(values[0].startedAt); XCTAssertNil(values[0].completedAt)
        XCTAssertTrue(values[0].exercises.flatMap(\.loggedSets).isEmpty)
        let activeIDs = try await repository.activeWorkouts().map(\.id)
        XCTAssertEqual(activeIDs, values.map(\.id))
    }

    @MainActor func testPasteMaterializesTwoWorkoutsInParsedOrder() async throws {
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        let result = parser.parse(WorkoutImportFixtures.multiple)
        let values = try await WorkoutPasteMaterializer(exercises: repository, workouts: repository, history: repository).materialize(result.workouts, now: .init(timeIntervalSince1970: 100))
        XCTAssertEqual(values.map(\.titleSnapshot), ["Push", "Core"])
        let activeIDs = try await repository.activeWorkouts().map(\.id)
        XCTAssertEqual(activeIDs, values.map(\.id))
    }

    @MainActor func testPasteMaterializesThreeWorkoutsWithFreshChildIdentities() async throws {
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        let input = "DAY 1 — Upper\n\nPress 2x8\n\nDAY 2 — Lower\n\nSquat 2x8\n\nDAY 3 — Pull\n\nRow 2x8"
        let result = parser.parse(input); XCTAssertFalse(result.hasBlockingIssues)
        let values = try await WorkoutPasteMaterializer(exercises: repository, workouts: repository, history: repository).materialize(result.workouts, now: .init(timeIntervalSince1970: 100))
        XCTAssertEqual(values.map(\.titleSnapshot), ["Upper", "Lower", "Pull"])
        XCTAssertEqual(Set(values.map(\.id)).count, 3)
        XCTAssertEqual(Set(values.flatMap(\.exercises).map(\.id)).count, 3)
        let activeIDs = try await repository.activeWorkouts().map(\.id)
        XCTAssertEqual(activeIDs, values.map(\.id))
    }

    @MainActor func testAtomicMaterializationRollsBackWholeBatchWhenValidationFails() async throws {
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        let valid = EquilibriumFixtures.ready(id: "valid-paste")
        var invalid = EquilibriumFixtures.ready(id: "invalid-paste"); invalid.titleSnapshot = ""
        do { try await repository.materializeAtomically([valid, invalid]); XCTFail("Expected validation failure") } catch {}
        let persisted = try await repository.allWorkouts()
        XCTAssertTrue(persisted.isEmpty)
    }
}
