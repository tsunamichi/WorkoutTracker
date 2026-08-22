import XCTest
import SwiftData
@testable import Equilibrium

@MainActor
final class WorkoutCreationPhase3ATests: XCTestCase {
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
        let model = WorkoutBuilderModel(day: day, draft: .init(template: loaded), templates: repository, workouts: repository)
        let scheduledValue = await model.schedule(); let snapshot = try XCTUnwrap(scheduledValue)
        template.name = "Edited"; template.exercises.removeLast(); template.updatedAt = .now
        try await repository.saveTemplate(template)
        let storedSnapshot = try await repository.workout(id: snapshot.id); XCTAssertEqual(storedSnapshot?.exercises.count, 2)
        try await repository.archiveTemplate(id: template.id, at: .now)
        let activeTemplates = try await repository.allTemplates(); XCTAssertTrue(activeTemplates.isEmpty)
    }

    func testBuilderMutationFreshIDsSchedulingConflictAndCompletedProtection() async throws {
        let repository = makeRepository(); let day = try LocalDay("2026-08-23")
        let model = WorkoutBuilderModel(day: day, templates: repository, workouts: repository)
        XCTAssertFalse(model.canCommit)
        model.draft.name = "Mixed"; model.add(EquilibriumFixtures.exercises[0]); model.add(EquilibriumFixtures.exercises[1])
        model.moveExercise(id: model.draft.exercises[1].id, direction: -1)
        XCTAssertEqual(model.draft.exercises.first?.exerciseID, EquilibriumFixtures.plankID)
        model.draft.exercises[0].prescriptions[0].target = .duration(seconds: 40)
        model.addSet(to: model.draft.exercises[1].id); model.removeSet(model.draft.exercises[1].prescriptions[0].id, from: model.draft.exercises[1].id)
        let scheduledResult = await model.schedule(); let scheduled = try XCTUnwrap(scheduledResult)
        XCTAssertEqual(scheduled.day, day); XCTAssertEqual(Set(scheduled.exercises.map(\.id)).count, 2)
        XCTAssertEqual(Set(scheduled.exercises.flatMap(\.prescriptions).map(\.id)).count, scheduled.exercises.flatMap(\.prescriptions).count)
        let conflict = await model.schedule(); XCTAssertNil(conflict)
        var completed = EquilibriumFixtures.completed(day: "2026-08-24", id: "protected")
        try await repository.schedule(completed)
        completed = model.makeScheduled(); completed.day = try LocalDay("2026-08-24")
        do { try await repository.replaceScheduledWorkout(completed); XCTFail("Expected protection") } catch { XCTAssertEqual(error as? RepositoryError, .immutableCompletedWorkout) }
    }

    func testRecentDraftUsesPrescriptionsWithoutExecutionIdentity() async throws {
        let recent = EquilibriumFixtures.completed()
        let first = WorkoutDraft(recent: recent), second = WorkoutDraft(recent: recent)
        XCTAssertEqual(first.exercises.map(\.exerciseID), recent.exercises.map(\.exerciseID))
        XCTAssertNotEqual(first.exercises.map(\.id), second.exercises.map(\.id))
        XCTAssertEqual(first.exercises[0].prescriptions.count, recent.exercises[0].prescriptions.count)
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
