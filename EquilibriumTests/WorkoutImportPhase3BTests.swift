import XCTest
@testable import Equilibrium

final class WorkoutImportPhase3BTests: XCTestCase {
    private let parser = WorkoutTextParser()

    func testBlockImportPreservesUnilateralRepTargetsNotesAndVideoMetadata() throws {
        let result = parser.parse("""
        **A — Hand Eye Coordination**
        SL Ball/Wall Toss (on foam pad)
        3 x 45s
        - Change angles between high & low

        **B — Deep Tier Skater Bounds**
        3 x 12/ea direction
        - Focus on height > deceleration
        - Land soft, load hips & knee
        - Demos (1)

        **C1 — Barbell Box Squat > Jump**
        3 x 5/ea leg
        - Increase weight
        - 2s pause @ seated position
        - Explosive through the ground, to standing position
        - Light weight, maximum intent
        - https://youtu.be/dQw4w9WgXcQ
        """)

        XCTAssertFalse(result.hasBlockingIssues)
        let exercises = try XCTUnwrap(result.workouts.first?.exercises)
        XCTAssertEqual(exercises.map(\.name), ["SL Ball/Wall Toss (on foam pad)", "Deep Tier Skater Bounds", "Barbell Box Squat > Jump"])
        XCTAssertEqual(exercises[0].prescriptions[0].target, .duration(seconds: 45))
        XCTAssertTrue(exercises[0].isTimeBased)
        XCTAssertFalse(exercises[0].isTwoSided)
        XCTAssertEqual(exercises[1].prescriptions[0].target, .repetitions(12...12))
        XCTAssertTrue(exercises[1].isTimeBased)
        XCTAssertTrue(exercises[1].isTwoSided)
        XCTAssertEqual(exercises[2].prescriptions[0].target, .repetitions(5...5))
        XCTAssertTrue(exercises[2].isTimeBased)
        XCTAssertTrue(exercises[2].isTwoSided)
        XCTAssertEqual(exercises[2].youtubeVideoID, "dQw4w9WgXcQ")
        XCTAssertEqual(exercises[2].workoutNotes, "Increase weight")
        XCTAssertTrue(exercises[2].reusableNotes?.contains("2s pause") == true)
        XCTAssertTrue(result.issues.contains { $0.severity == .warning && $0.message.contains("demo") })
    }

    func testUnilateralNotationKeepsRepetitionsAndDraftSettings() throws {
        for (notation, expected) in [("3 x 5/ea leg", 5), ("3 x 5/side", 5), ("3 x 5 each leg", 5), ("1 x 12/ea", 12)] {
            let result = parser.parse("Import\n\nSplit Squat\n\(notation)")
            let parsed = try XCTUnwrap(result.workouts.first?.exercises.first, notation)
            XCTAssertEqual(parsed.prescriptions[0].target, .repetitions(expected...expected), notation)
            XCTAssertTrue(parsed.isTimeBased, notation)
            XCTAssertTrue(parsed.isTwoSided, notation)
            let draft = WorkoutImportDraftConverter.lightweightDraft(from: try XCTUnwrap(result.workouts.first), catalog: []).exercises[0]
            XCTAssertTrue(draft.isTimeBased, notation)
            XCTAssertTrue(draft.isTwoSided, notation)
        }
    }

    @MainActor func testMaterializationFillsOnlyMissingCanonicalDetails() async throws {
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        let id = ExerciseID.new()
        let existing = ExerciseDefinition(id: id, name: "Split Squat", normalizedName: "split squat", aliases: [], equipment: nil, category: nil, isCustom: false, archivedAt: nil, notes: "Keep existing notes", youtubeVideoID: "dQw4w9WgXcQ")
        try await repository.saveExercise(existing)
        let parsed = parser.parse("""
        Import

        Split Squat
        3 x 5/ea leg
        - New imported note
        - https://youtu.be/9bZkp7q19f0
        """)
        let workout = try await WorkoutPasteMaterializer(exercises: repository, workouts: repository, history: repository).materialize(parsed.workouts).first
        XCTAssertTrue(try XCTUnwrap(workout).exercises[0].isTwoSided)
        let loaded = try await repository.exercise(id: id)
        let persisted = try XCTUnwrap(loaded)
        XCTAssertEqual(persisted.notes, "Keep existing notes")
        XCTAssertEqual(persisted.youtubeVideoID, "dQw4w9WgXcQ")
    }

    func testAnyFirstLineIsTheWorkoutTitleEvenWhenNextLineIsInvalid() {
        let result = parser.parse("1:# Full Expression\nPower block\n- Seated Box Jump — 4×3")
        XCTAssertEqual(result.workouts.map(\.name), ["1:# Full Expression"])
        XCTAssertEqual(result.workouts.first?.exercises.count, 1)
        XCTAssertEqual(result.issues.map(\.lineNumber), [2])
    }

    func testBareCountIsSingleSetAndSecondsSuffixIsDuration() {
        let result = parser.parse("Power\n- Walking RDL + Reach - 10\n- Plank — 3×30s\n- Hang: 45 sec")
        let exercises = result.workouts.first?.exercises ?? []
        XCTAssertTrue(result.issues.isEmpty)
        XCTAssertEqual(exercises.map(\.name), ["Walking RDL + Reach", "Plank", "Hang"])
        XCTAssertEqual(exercises.map(\.prescriptions.count), [1, 3, 1])
        guard exercises.count == 3 else { return }
        XCTAssertEqual(exercises[0].prescriptions[0].target, .repetitions(10...10))
        XCTAssertEqual(exercises[1].prescriptions[0].target, .duration(seconds: 30))
        XCTAssertEqual(exercises[2].prescriptions[0].target, .duration(seconds: 45))
    }

    func testSplitTitleSeparatesLeadingHeadingOnly() {
        let split = parser.splitTitle("\n1:# Full Expression\n\n- Box Jump — 3×5")
        XCTAssertEqual(split.title, "1:# Full Expression")
        XCTAssertEqual(split.body, "- Box Jump — 3×5")
        XCTAssertEqual(parser.splitTitle("- Box Jump — 3×5").title, "")
    }

    @MainActor func testPasteKeepsParsedSetsRepsDurationsWeightAndRest() async throws {
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        let result = parser.parse("1:3 Full Expression\n\n- Row — 1x120 sec\n- Wall Tibialis Raise — 2×15\n- Bench — 3×8-10 @ 100 lb, rest 90 sec")
        let workout = try await WorkoutPasteMaterializer(exercises: repository, workouts: repository, history: repository).materialize(result.workouts)[0]
        XCTAssertEqual(workout.titleSnapshot, "1:3 Full Expression")
        XCTAssertEqual(workout.exercises.map(\.prescriptions.count), [1, 2, 3])
        XCTAssertEqual(workout.exercises[0].prescriptions[0].target, .duration(seconds: 120))
        XCTAssertEqual(workout.exercises[1].prescriptions[0].target, .repetitions(range: 15...15))
        XCTAssertEqual(workout.exercises[2].prescriptions[0].target, .repetitions(range: 8...10))
        XCTAssertEqual(workout.exercises[2].prescriptions[0].suggestedWeight?.pounds, 100)
        XCTAssertEqual(workout.exercises[2].restDuration, 90)
    }

    func testBasicGrammarWhitespaceBulletsAndBlankLines() throws {
        let result = parser.parse("  Push  \n\n• Bench Press 3x8\nIncline Press 3 x 10\nCable Fly 3×12\nPlank 3x30 sec\n")
        XCTAssertFalse(result.hasBlockingIssues); XCTAssertEqual(result.workouts.count, 1)
        XCTAssertEqual(result.workouts[0].name, "Push")
        XCTAssertEqual(result.workouts[0].exercises.map(\.name), ["Bench Press", "Incline Press", "Cable Fly", "Plank"])
        XCTAssertEqual(result.workouts[0].exercises.map(\.prescriptions.count), [3, 3, 3, 3])
        guard case .duration(seconds: 30) = result.workouts[0].exercises[3].prescriptions[0].target else { return XCTFail("Expected duration") }
    }

    func testPosteriorChainWorkoutParsesEveryExerciseAndTarget() throws {
        let result = parser.parse(WorkoutImportFixtures.posteriorChain)

        XCTAssertFalse(result.hasBlockingIssues)
        XCTAssertTrue(result.issues.isEmpty)
        let workout = try XCTUnwrap(result.workouts.first)
        XCTAssertEqual(workout.name, "Posterior Chain Emphasis")
        XCTAssertEqual(workout.exercises.count, 13)
        XCTAssertEqual(workout.exercises.map(\.prescriptions.count), [1, 2, 2, 1, 1, 3, 3, 4, 3, 3, 3, 3, 3])
        XCTAssertEqual(workout.exercises[0].prescriptions[0].target, .duration(seconds: 120))
        XCTAssertEqual(workout.exercises[5].prescriptions[0].target, .duration(seconds: 5))
        XCTAssertEqual(workout.exercises[11].prescriptions[0].target, .repetitions(10...12))
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
        XCTAssertEqual(values[0].exercises.map(\.prescriptions.count), result.workouts[0].exercises.map(\.prescriptions.count))
        let activeIDs = try await repository.activeWorkouts().map(\.id)
        XCTAssertEqual(activeIDs, values.map(\.id))
    }

    @MainActor func testPasteMaterializesExplicitPosteriorChainVariantsWithoutInteractiveConfirmation() async throws {
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        let seed = EquilibriumFixtures.defaultSeed()
        for definition in seed.definitions { try await repository.saveExercise(definition) }
        let result = parser.parse(WorkoutImportFixtures.posteriorChain)

        let workouts = try await WorkoutPasteMaterializer(
            exercises: repository,
            workouts: repository,
            history: repository
        ).materialize(result.workouts, now: .init(timeIntervalSince1970: 100))

        let workout = try XCTUnwrap(workouts.first)
        XCTAssertEqual(workout.titleSnapshot, "Posterior Chain Emphasis")
        XCTAssertEqual(workout.exercises.count, 13)
        XCTAssertEqual(workout.exercises[1].nameSnapshot, "Wall Tibialis Raise")
        XCTAssertEqual(workout.exercises[4].nameSnapshot, "Walking RDL + Reach")
        XCTAssertEqual(workout.exercises[12].nameSnapshot, "Dumbbell Hammer Curl")
        let activeWorkoutIDs = try await repository.activeWorkouts().map(\.id)
        XCTAssertEqual(activeWorkoutIDs, workouts.map(\.id))
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
