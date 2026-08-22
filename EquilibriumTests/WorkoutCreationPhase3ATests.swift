import XCTest
import SwiftData
@testable import Equilibrium

@MainActor
final class WorkoutCreationPhase3ATests: XCTestCase {
    func testExplicitTemplatePrescriptionsSurviveSchedulingAndOverrideHistory() async throws {
        let repository = makeRepository()
        for exercise in EquilibriumFixtures.exercises { try await repository.saveExercise(exercise) }

        let repID = SetID(rawValue: "template-explicit-reps")
        let durationID = SetID(rawValue: "template-explicit-duration")
        let template = WorkoutTemplate(
            id: .init(rawValue: "template-explicit"),
            name: "Explicit targets",
            exercises: [
                .init(id: .new(), exerciseID: EquilibriumFixtures.squatID, exerciseNameSnapshot: "Back Squat", prescriptions: [.init(id: repID, target: .repetitions(range: 6...10), suggestedWeight: .init(pounds: 142.5))], restDuration: 75, progressionRuleID: nil),
                .init(id: .new(), exerciseID: EquilibriumFixtures.plankID, exerciseNameSnapshot: "Plank", prescriptions: [.init(id: durationID, target: .duration(seconds: 47), suggestedWeight: .init(pounds: 25))], restDuration: 30, progressionRuleID: nil)
            ],
            createdAt: .now,
            updatedAt: .now,
            archivedAt: nil
        )

        // Competing completed history must not replace explicit draft targets.
        try await repository.schedule(EquilibriumFixtures.completed(id: "competing-history"))
        let draft = WorkoutDraft(template: template)
        let model = WorkoutBuilderModel(day: try LocalDay("2026-08-22"), draft: draft, exercises: repository, workouts: repository, history: repository)
        let scheduled = try await model.makeScheduled(now: Date(timeIntervalSince1970: 500))

        XCTAssertEqual(scheduled.templateID, nil)
        XCTAssertEqual(scheduled.source, .manual)
        XCTAssertEqual(scheduled.exercises.map(\.restDuration), [75, 30])
        XCTAssertTrue(scheduled.exercises.allSatisfy { $0.loggedSets.isEmpty })

        let repetitions = try XCTUnwrap(scheduled.exercises[0].prescriptions.first)
        guard case .repetitions(let range) = repetitions.target else { return XCTFail("Expected repetition target") }
        XCTAssertEqual(range, 6...10)
        XCTAssertEqual(repetitions.suggestedWeight?.pounds, 142.5)

        let duration = try XCTUnwrap(scheduled.exercises[1].prescriptions.first)
        guard case .duration(let seconds) = duration.target else { return XCTFail("Expected duration target") }
        XCTAssertEqual(seconds, 47)
        XCTAssertEqual(duration.suggestedWeight?.pounds, 25)

        let scheduledIDs = Set(scheduled.exercises.flatMap(\.prescriptions).map(\.id))
        XCTAssertEqual(scheduledIDs.count, 2)
        XCTAssertTrue(scheduledIDs.isDisjoint(with: [repID, durationID]))
    }

    func testExerciseCreateSearchDuplicateArchiveAndMetadata() async throws {
        let repository = makeRepository()
        let exercise = ExerciseDefinition(id: .new(), name: "Café Press", normalizedName: "ignored", aliases: ["Coffee press"], equipment: "Dumbbell", category: "Shoulders", isCustom: true, archivedAt: nil)
        try await repository.saveExercise(exercise)
        let search = try await repository.searchExercises("cafe"); let fetched = try await repository.exercise(id: exercise.id)
        XCTAssertEqual(search.first?.equipment, "Dumbbell"); XCTAssertEqual(fetched?.normalizedName, "cafe press")
        do { try await repository.saveExercise(.init(id: .new(), name: "Coffee Press", normalizedName: "", aliases: [], equipment: nil, category: nil, isCustom: true, archivedAt: nil)); XCTFail("Expected alias duplicate") }
        catch { XCTAssertEqual(error as? RepositoryError, .duplicateExerciseName) }
        try await repository.archiveExercise(id: exercise.id, at: .now)
        let active = try await repository.allExercises(); let archived = try await repository.exercise(id: exercise.id)
        XCTAssertTrue(active.isEmpty); XCTAssertNotNil(archived?.archivedAt)
    }

    func testTemplateMixedPrescriptionOrderingUpdateArchiveAndSnapshotIsolation() async throws {
        let repository = makeRepository()
        var template = EquilibriumFixtures.template
        template.exercises.append(.init(id: .new(), exerciseID: EquilibriumFixtures.plankID, exerciseNameSnapshot: "Plank", prescriptions: [.init(id: .new(), target: .duration(seconds: 45), suggestedWeight: nil)], restDuration: 30, progressionRuleID: nil))
        try await repository.saveTemplate(template)
        let fetchedTemplate = try await repository.template(id: template.id); let loaded = try XCTUnwrap(fetchedTemplate)
        XCTAssertEqual(loaded.exercises.map(\.exerciseNameSnapshot), ["Back Squat", "Plank"])
        if case .duration(let seconds) = loaded.exercises[1].prescriptions[0].target { XCTAssertEqual(seconds, 45) } else { XCTFail("Expected duration") }
        let day = try LocalDay("2026-08-22")
        for exercise in EquilibriumFixtures.exercises { try await repository.saveExercise(exercise) }
        let model = WorkoutBuilderModel(day: day, draft: .init(template: loaded), exercises: repository, workouts: repository, history: repository)
        let scheduledValue = await model.schedule(); let snapshot = try XCTUnwrap(scheduledValue)
        XCTAssertEqual(snapshot.exercises.map(\.restDuration), [120, 30])
        template.name = "Edited"; template.exercises.removeLast(); template.updatedAt = .now
        try await repository.saveTemplate(template)
        let storedSnapshot = try await repository.workout(id: snapshot.id); XCTAssertEqual(storedSnapshot?.exercises.count, 2)
        try await repository.archiveTemplate(id: template.id, at: .now)
        let activeTemplates = try await repository.allTemplates(); XCTAssertTrue(activeTemplates.isEmpty)
    }

    func testBuilderMutationFreshIDsAndMultipleSameDayScheduling() async throws {
        let repository = makeRepository(); let day = try LocalDay("2026-08-23")
        for exercise in EquilibriumFixtures.exercises { try await repository.saveExercise(exercise) }
        let model = WorkoutBuilderModel(day: day, exercises: repository, workouts: repository, history: repository)
        XCTAssertFalse(model.canCommit)
        model.draft.name = "Mixed"; model.add(EquilibriumFixtures.exercises[0]); model.add(EquilibriumFixtures.exercises[1])
        model.moveExercise(id: model.draft.exercises[1].id, direction: -1)
        XCTAssertEqual(model.draft.exercises.first?.exerciseID, EquilibriumFixtures.plankID)
        let scheduledResult = await model.schedule(); let scheduled = try XCTUnwrap(scheduledResult)
        XCTAssertEqual(scheduled.day, day); XCTAssertEqual(Set(scheduled.exercises.map(\.id)).count, 2)
        XCTAssertEqual(Set(scheduled.exercises.flatMap(\.prescriptions).map(\.id)).count, scheduled.exercises.flatMap(\.prescriptions).count)
        let another = await model.schedule(); XCTAssertNotNil(another)
        let sameDay = try await repository.workouts(on: day); XCTAssertEqual(sameDay.count, 2)
    }

    func testRecentDraftRetainsOnlyStructureWithFreshDraftIdentity() async throws {
        let recent = EquilibriumFixtures.completed()
        let first = WorkoutDraft(recent: recent), second = WorkoutDraft(recent: recent)
        XCTAssertEqual(first.exercises.map(\.exerciseID), recent.exercises.map(\.exerciseID))
        XCTAssertNotEqual(first.exercises.map(\.id), second.exercises.map(\.id))
        XCTAssertEqual(first.exercises[0].name, recent.exercises[0].nameSnapshot)
    }

    func testExerciseTemplateDiskPersistenceAndBackupRepositoryQueries() async throws {
        let url = TestSupport.temporaryStoreURL()
        var container: ModelContainer? = try PersistenceController.makeContainer(storageURL: url)
        var repository: SwiftDataRepository? = SwiftDataRepository(container: container!)
        try await repository!.saveExercise(EquilibriumFixtures.exercises[0]); try await repository!.saveTemplate(EquilibriumFixtures.template)
        repository = nil; container = nil
        let reopened = SwiftDataRepository(container: try PersistenceController.makeContainer(storageURL: url))
        let exercises = try await reopened.allExercises(); let templates = try await reopened.allTemplates()
        XCTAssertEqual(exercises.map(\.id), [EquilibriumFixtures.squatID]); XCTAssertEqual(templates.map(\.id), [EquilibriumFixtures.templateID])
        let backup = try await reopened.exportBackup(exportedAt: .now, sourceDeviceID: "test")
        XCTAssertEqual(backup.exercises.count, 1); XCTAssertEqual(backup.workoutTemplates.count, 1)
    }

    private func makeRepository() -> SwiftDataRepository { SwiftDataRepository(container: try! PersistenceController.makeContainer(inMemory: true)) }
}
