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

    func testMatchingExactAliasDiacriticCompactUnmatchedAndAmbiguous() throws {
        let canonical = ExerciseDefinition(id: .new(), name: "Café Press", normalizedName: "cafe press", aliases: ["Coffee Press"], equipment: nil, category: nil, isCustom: false, archivedAt: nil)
        let pullup = ExerciseDefinition(id: .new(), name: "Pull-up", normalizedName: "pull up", aliases: [], equipment: nil, category: nil, isCustom: false, archivedAt: nil)
        let matcher = WorkoutExerciseMatcher()
        for name in ["CAFÉ PRESS", "Coffee Press", "pullup"] {
            guard case .matched = matcher.match(name: name, catalog: [canonical, pullup]) else { return XCTFail("Expected match for \(name)") }
        }
        guard case .unmatched = matcher.match(name: "Press", catalog: [canonical]) else { return XCTFail("No fuzzy match allowed") }
        let duplicateAlias = ExerciseDefinition(id: .new(), name: "Other", normalizedName: "other", aliases: ["Coffee Press"], equipment: nil, category: nil, isCustom: true, archivedAt: nil)
        guard case .ambiguous(let values) = matcher.match(name: "Coffee Press", catalog: [canonical, duplicateAlias]) else { return XCTFail("Expected ambiguity") }
        XCTAssertEqual(values.count, 2)
    }

    func testCustomExerciseCanExplicitlyResolveUnmatched() throws {
        let parsed = try XCTUnwrap(parser.parse(WorkoutImportFixtures.unmatched).workouts.first?.exercises.first)
        let custom = ExerciseDefinition(id: .new(), name: "Mystery Press", normalizedName: "mystery press", aliases: [], equipment: nil, category: nil, isCustom: true, archivedAt: nil)
        let resolved = ResolvedParsedWorkout(id: UUID(), name: "Push", exercises: [.init(parsed: parsed, match: .matched(custom))])
        XCTAssertEqual(WorkoutImportDraftConverter.draft(from: resolved)?.exercises.first?.exerciseID, custom.id)
    }

    func testDraftConversionPreservesOrderTargetsAndGeneratesFreshIdentity() throws {
        let result = parser.parse(WorkoutImportFixtures.simple)
        let definitions = EquilibriumFixtures.exercises
        let matcher = WorkoutExerciseMatcher()
        let resolved = ResolvedParsedWorkout(id: UUID(), name: result.workouts[0].name, exercises: result.workouts[0].exercises.map { .init(parsed: $0, match: matcher.match(name: $0.name, catalog: definitions)) })
        let first = try XCTUnwrap(WorkoutImportDraftConverter.draft(from: resolved)), second = try XCTUnwrap(WorkoutImportDraftConverter.draft(from: resolved))
        XCTAssertEqual(first.exercises.map(\.exerciseID), [EquilibriumFixtures.squatID, EquilibriumFixtures.plankID])
        XCTAssertNotEqual(first.exercises.map(\.id), second.exercises.map(\.id)); XCTAssertNotEqual(first.exercises.flatMap(\.prescriptions).map(\.id), second.exercises.flatMap(\.prescriptions).map(\.id))
        guard case .repetitions(lower: 8, upper: 8) = first.exercises[0].prescriptions[0].target else { return XCTFail("Expected reps") }
        guard case .duration(seconds: 30) = first.exercises[1].prescriptions[0].target else { return XCTFail("Expected duration") }
    }

    func testUnresolvedMatchBlocksDraftConversionAndImportRouteExists() throws {
        let parsed = try XCTUnwrap(parser.parse(WorkoutImportFixtures.unmatched).workouts.first?.exercises.first)
        let unresolved = ResolvedParsedWorkout(id: UUID(), name: "Push", exercises: [.init(parsed: parsed, match: .unmatched)])
        XCTAssertNil(WorkoutImportDraftConverter.draft(from: unresolved)); XCTAssertEqual(CreationRoute.pasteWorkout, .pasteWorkout)
    }

    @MainActor func testImportedDraftUsesBuilderTemplateScheduleAndExecutionArchitecture() async throws {
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        for exercise in EquilibriumFixtures.exercises { try await repository.saveExercise(exercise) }
        let result = parser.parse(WorkoutImportFixtures.simple), matcher = WorkoutExerciseMatcher()
        let resolved = ResolvedParsedWorkout(id: UUID(), name: result.workouts[0].name, exercises: result.workouts[0].exercises.map { .init(parsed: $0, match: matcher.match(name: $0.name, catalog: EquilibriumFixtures.exercises)) })
        let draft = try XCTUnwrap(WorkoutImportDraftConverter.draft(from: resolved))
        let model = WorkoutBuilderModel(draft: draft, exercises: repository, workouts: repository, history: repository)
        let createdValue = await model.create(); let workout = try XCTUnwrap(createdValue)
        let execution = WorkoutExecutionModel(workoutID: workout.id, repository: repository)
        await execution.activate(); XCTAssertEqual(execution.workout?.id, workout.id); XCTAssertEqual(execution.workout?.status, .inProgress)
    }
}
