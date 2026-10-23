import XCTest
@testable import Equilibrium

@MainActor
final class WorkoutCreationPhase3ATests: XCTestCase {
    func testExercisePickerOffersCreationUnlessAResultMatchesTheWholeQuery() {
        let hammerCurl = ExerciseDefinition(
            id: .init(rawValue: "hammer-curl"),
            name: "Hammer Curl",
            normalizedName: "hammer curl",
            aliases: ["Neutral Curl"],
            equipment: nil,
            category: nil,
            isCustom: false,
            archivedAt: nil
        )

        XCTAssertTrue(
            ExercisePickerCreationPolicy.offersCustomCreation(
                query: "preacher curl",
                loadedQuery: "preacher curl",
                results: [hammerCurl]
            )
        )
        XCTAssertFalse(
            ExercisePickerCreationPolicy.offersCustomCreation(
                query: " hammer curl ",
                loadedQuery: "hammer curl",
                results: [hammerCurl]
            )
        )
        XCTAssertFalse(
            ExercisePickerCreationPolicy.offersCustomCreation(
                query: "neutral curl",
                loadedQuery: "neutral curl",
                results: [hammerCurl]
            )
        )
        XCTAssertFalse(
            ExercisePickerCreationPolicy.offersCustomCreation(
                query: "preacher curl",
                loadedQuery: "preacher",
                results: [hammerCurl]
            )
        )
    }

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

@MainActor
final class ExerciseResolverTests: XCTestCase {
    private let canonical = ExerciseDefinition(
        id: .init(rawValue: "incline-dumbbell-press"),
        name: "Incline Dumbbell Press",
        normalizedName: "incline dumbbell press",
        aliases: ["Incline DB Chest Press"],
        equipment: "Dumbbell",
        category: "Chest",
        isCustom: false,
        archivedAt: nil
    )

    func testCanonicalNameAliasAbbreviationTokenOrderAndMinorTypoResolveTogether() {
        assertMatch("Incline Dumbbell Press", expected: .exactMatch(canonical))
        assertMatch("Incline DB Chest Press", expected: .exactMatch(canonical))
        assertPreferredMatch("Incline DB Press")
        assertPreferredMatch("DB Incline Press")
        assertPreferredMatch("Dumbbell Incline Bench Press")
        assertPreferredMatch("Incline Dumbell Press")
    }

    func testNormalizationFoldsCaseWhitespacePunctuationAndDiacritics() {
        XCTAssertEqual(ExerciseResolver.normalizedName("  CAFÉ—DB  Press "), "cafe dumbbell press")
        XCTAssertEqual(ExerciseResolver.search("db press", in: [canonical]).map(\.id), [canonical.id])
    }

    func testMeaningfulExerciseVariationsNeverBecomeAutomaticMatches() {
        for name in [
            "Incline Smith Machine Press",
            "Single-arm Incline Dumbbell Press",
            "Cable Incline Press"
        ] {
            switch ExerciseResolver.resolve(name, in: [canonical]) {
            case .exactMatch, .highConfidenceMatch:
                XCTFail("\(name) must remain a distinct exercise")
            case .possibleMatches, .noMatch:
                break
            }
        }
    }

    func testAmbiguousMatchesRequireExplicitCreationConfirmation() async throws {
        let repository = makeRepository()
        let barbell = definition("Incline Barbell Press", id: "incline-barbell")
        try await repository.saveExercise(canonical)
        try await repository.saveExercise(barbell)

        let guarded = try await repository.resolveCreationRequest(named: "Incline Press")
        guard case .confirmationRequired(let name, let matches) = guarded else {
            return XCTFail("Expected an ambiguity guard")
        }
        XCTAssertEqual(name, "Incline Press")
        XCTAssertEqual(Set(matches.map(\.id)), Set([canonical.id, barbell.id]))
        let guardedCatalog = try await repository.allExercises()
        XCTAssertEqual(guardedCatalog.count, 2)

        let confirmed = try await repository.resolveCreationRequest(named: "Incline Press", createIfAmbiguous: true)
        guard case .created(let created) = confirmed else { return XCTFail("Expected explicit custom creation") }
        XCTAssertEqual(created.name, "Incline Press")
        let confirmedCatalog = try await repository.allExercises()
        XCTAssertEqual(confirmedCatalog.count, 3)
    }

    func testHighConfidenceCreationReusesCanonicalAndPersistsLearnedAlias() async throws {
        let container = try PersistenceController.makeContainer(inMemory: true)
        let repository = SwiftDataRepository(container: container)
        try await repository.saveExercise(canonical)

        let resolution = try await repository.resolveCreationRequest(named: "DB Incline Press")
        guard case .existing(let existing) = resolution else { return XCTFail("Expected canonical reuse") }
        XCTAssertEqual(existing.id, canonical.id)
        let catalog = try await repository.allExercises()
        XCTAssertEqual(catalog.count, 1)

        let reopenedRepository = SwiftDataRepository(container: container)
        let persistedResult = try await reopenedRepository.exercise(id: canonical.id)
        let persisted = try XCTUnwrap(persistedResult)
        XCTAssertTrue(persisted.aliases.contains("DB Incline Press"))
        guard case .exactMatch(let learned) = ExerciseResolver.resolve("DB Incline Press", in: [persisted]) else {
            return XCTFail("Expected persisted alias to resolve exactly")
        }
        XCTAssertEqual(learned.id, canonical.id)
    }

    func testNewExerciseSpellsOutDumbbellAndKeepsDBAsSearchAlias() async throws {
        let repository = makeRepository()

        let resolution = try await repository.resolveCreationRequest(named: "Chest DB Squeeze")

        guard case .created(let created) = resolution else { return XCTFail("Expected a new exercise") }
        XCTAssertEqual(created.name, "Chest Dumbbell Squeeze")
        XCTAssertEqual(created.aliases, ["Chest DB Squeeze"])
        let matches = try await repository.searchExercises("chest db squeeze")
        XCTAssertEqual(matches.map(\.id), [created.id])
    }

    func testLearningAliasDoesNotRewriteCompletedWorkoutIdentity() async throws {
        let repository = makeRepository()
        try await repository.saveExercise(canonical)
        var completed = EquilibriumFixtures.completed(id: "resolver-history")
        completed.exercises[0] = WorkoutExercise(
            id: completed.exercises[0].id,
            exerciseID: canonical.id,
            nameSnapshot: canonical.name,
            prescriptions: completed.exercises[0].prescriptions,
            loggedSets: completed.exercises[0].loggedSets,
            restDuration: completed.exercises[0].restDuration,
            skippedAt: completed.exercises[0].skippedAt
        )
        try await repository.create(completed)

        _ = try await repository.resolveCreationRequest(named: "DB Incline Press")
        let historyResult = try await repository.workout(id: completed.id)
        let history = try XCTUnwrap(historyResult)
        XCTAssertEqual(history.exercises[0].exerciseID, canonical.id)
        XCTAssertEqual(history.exercises[0].nameSnapshot, "Incline Dumbbell Press")
    }

    private func assertPreferredMatch(_ name: String, file: StaticString = #filePath, line: UInt = #line) {
        guard case .highConfidenceMatch(let exercise) = ExerciseResolver.resolve(name, in: [canonical]) else {
            return XCTFail("Expected high-confidence match for \(name)", file: file, line: line)
        }
        XCTAssertEqual(exercise.id, canonical.id, file: file, line: line)
    }

    private func assertMatch(_ name: String, expected: ExerciseResolution, file: StaticString = #filePath, line: UInt = #line) {
        XCTAssertEqual(ExerciseResolver.resolve(name, in: [canonical]), expected, file: file, line: line)
    }

    private func definition(_ name: String, id: String) -> ExerciseDefinition {
        .init(id: .init(rawValue: id), name: name, normalizedName: ExerciseResolver.normalizedName(name), aliases: [], equipment: nil, category: nil, isCustom: false, archivedAt: nil)
    }

    private func makeRepository() -> SwiftDataRepository {
        SwiftDataRepository(container: try! PersistenceController.makeContainer(inMemory: true))
    }
}
