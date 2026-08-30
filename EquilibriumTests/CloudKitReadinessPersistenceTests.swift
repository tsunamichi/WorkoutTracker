import SwiftData
import XCTest
@testable import Equilibrium

@MainActor
final class CloudKitReadinessPersistenceTests: XCTestCase {
    private struct SimulatedCloudFailure: Error {}

    func testCloudUnavailableStartupFallsBackWithoutReplacingLocalStore() throws {
        let local = try PersistenceController.makeContainer(inMemory: true)
        local.mainContext.insert(ExerciseDefinitionRecord(id: "survives", name: "Survives", normalizedName: "survives", aliases: [], equipment: nil, category: nil, isCustom: true, archivedAt: nil))
        try local.mainContext.save()

        let result = try PersistenceController.resilientStartup(
            cloud: { throw SimulatedCloudFailure() },
            local: { local }
        )

        XCTAssertEqual(result.mode, .localFallback)
        XCTAssertEqual(try result.container.mainContext.fetch(FetchDescriptor<ExerciseDefinitionRecord>()).map(\.id), ["survives"])
    }

    func testPersistentStoreRemoteChangePublishesRepositoryRefresh() async throws {
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        let refreshed = expectation(description: "repository refresh")
        refreshed.assertForOverFulfill = false
        let token = NotificationCenter.default.addObserver(forName: .equilibriumRepositoryDidChange, object: nil, queue: .main) { _ in refreshed.fulfill() }
        defer { NotificationCenter.default.removeObserver(token); _ = repository }

        NotificationCenter.default.post(name: .NSPersistentStoreRemoteChange, object: nil)
        await fulfillment(of: [refreshed], timeout: 1)
    }

    func testDuplicateLogicalWorkoutAndExerciseIDsChooseNewestMetadataWithoutDeletingEitherRecord() async throws {
        let container = try PersistenceController.makeContainer(inMemory: true)
        let older = WorkoutMapper.record(from: EquilibriumFixtures.ready(id: "duplicate"))
        var newerValue = EquilibriumFixtures.ready(id: "duplicate")
        newerValue.titleSnapshot = "Newest"; newerValue.updatedAt = older.updatedAt.addingTimeInterval(10)
        let newer = WorkoutMapper.record(from: newerValue)
        let oldDefinition = ExerciseDefinitionRecord(id: "same-exercise", name: "Old", normalizedName: "old", aliases: [], equipment: nil, category: nil, isCustom: true, archivedAt: nil, updatedAt: .init(timeIntervalSince1970: 1))
        let newDefinition = ExerciseDefinitionRecord(id: "same-exercise", name: "New", normalizedName: "new", aliases: [], equipment: nil, category: nil, isCustom: true, archivedAt: nil, updatedAt: .init(timeIntervalSince1970: 2))
        container.mainContext.insert(older); container.mainContext.insert(newer); container.mainContext.insert(oldDefinition); container.mainContext.insert(newDefinition)
        try container.mainContext.save()

        let repository = SwiftDataRepository(container: container)
        let selectedWorkout = try await repository.workout(id: .init(rawValue: "duplicate"))
        let selectedExercise = try await repository.exercise(id: .init(rawValue: "same-exercise"))
        XCTAssertEqual(selectedWorkout?.titleSnapshot, "Newest")
        XCTAssertEqual(selectedExercise?.name, "New")
        XCTAssertEqual(try container.mainContext.fetchCount(FetchDescriptor<WorkoutRecord>()), 2)
        XCTAssertEqual(try container.mainContext.fetchCount(FetchDescriptor<ExerciseDefinitionRecord>()), 2)
    }

    func testPartialParentAndOrphanChildReadsAreNonDestructive() async throws {
        let container = try PersistenceController.makeContainer(inMemory: true)
        let parent = WorkoutRecord(id: "partial", titleSnapshot: "Partial", statusRaw: WorkoutStatus.completed.rawValue, startedAt: .init(timeIntervalSince1970: 1), completedAt: .init(timeIntervalSince1970: 2), createdAt: .init(timeIntervalSince1970: 1), updatedAt: .init(timeIntervalSince1970: 2), exercises: nil)
        let orphan = WorkoutExerciseRecord(id: "orphan", exerciseID: "definition", nameSnapshot: "Waiting", position: 0, restDuration: nil, skippedAt: nil, updatedAt: .init(timeIntervalSince1970: 2), prescriptions: nil, loggedSets: nil)
        container.mainContext.insert(parent); container.mainContext.insert(orphan); try container.mainContext.save()
        let repository = SwiftDataRepository(container: container)

        let loaded = try await repository.workout(id: .init(rawValue: "partial"))
        XCTAssertEqual(loaded?.status, .completed); XCTAssertEqual(loaded?.exercises, [])
        XCTAssertEqual(try container.mainContext.fetchCount(FetchDescriptor<WorkoutRecord>()), 1)
        XCTAssertEqual(try container.mainContext.fetchCount(FetchDescriptor<WorkoutExerciseRecord>()), 1)
    }

    func testLoggedSetCanTemporarilyExistWithoutMatchingPrescription() async throws {
        let container = try PersistenceController.makeContainer(inMemory: true)
        let log = LoggedSetRecord(id: "waiting-log", prescriptionID: "waiting-prescription", position: 0, pounds: 10, repetitions: 5, duration: nil, completedAt: .init(timeIntervalSince1970: 3), updatedAt: .init(timeIntervalSince1970: 3))
        let exercise = WorkoutExerciseRecord(id: "partial-exercise", exerciseID: "definition", nameSnapshot: "Partial", position: 0, restDuration: nil, skippedAt: nil, updatedAt: .init(timeIntervalSince1970: 3), prescriptions: nil, loggedSets: [log])
        let workout = WorkoutRecord(id: "partial-log", titleSnapshot: "Partial Log", statusRaw: WorkoutStatus.inProgress.rawValue, startedAt: .init(timeIntervalSince1970: 1), completedAt: nil, createdAt: .init(timeIntervalSince1970: 1), updatedAt: .init(timeIntervalSince1970: 3), exercises: [exercise])
        container.mainContext.insert(workout); try container.mainContext.save()

        let loaded = try await SwiftDataRepository(container: container).workout(id: .init(rawValue: "partial-log"))
        XCTAssertEqual(loaded?.exercises.first?.loggedSets.first?.id.rawValue, "waiting-log")
        XCTAssertTrue(loaded?.exercises.first?.prescriptions.isEmpty == true)
        XCTAssertEqual(try container.mainContext.fetchCount(FetchDescriptor<LoggedSetRecord>()), 1)
    }

    func testDuplicateChildLogicalIDsSelectNewestWithoutDuplicatingDomainHistory() async throws {
        let container = try PersistenceController.makeContainer(inMemory: true)
        let oldPrescription = PrescriptionRecord(id: "same-prescription", position: 0, targetKind: "repetitions", lowerRepetitions: 5, upperRepetitions: 5, duration: nil, suggestedPounds: nil, updatedAt: .init(timeIntervalSince1970: 1))
        let newPrescription = PrescriptionRecord(id: "same-prescription", position: 0, targetKind: "repetitions", lowerRepetitions: 8, upperRepetitions: 8, duration: nil, suggestedPounds: nil, updatedAt: .init(timeIntervalSince1970: 2))
        let oldLog = LoggedSetRecord(id: "same-log", prescriptionID: "same-prescription", position: 0, pounds: 100, repetitions: 5, duration: nil, completedAt: .init(timeIntervalSince1970: 3), updatedAt: .init(timeIntervalSince1970: 3))
        let newLog = LoggedSetRecord(id: "same-log", prescriptionID: "same-prescription", position: 0, pounds: 125, repetitions: 8, duration: nil, completedAt: .init(timeIntervalSince1970: 4), updatedAt: .init(timeIntervalSince1970: 4))
        let occurrence = WorkoutExerciseRecord(id: "occurrence", exerciseID: "definition", nameSnapshot: "Duplicate Children", position: 0, restDuration: nil, skippedAt: nil, updatedAt: .init(timeIntervalSince1970: 4), prescriptions: [oldPrescription, newPrescription], loggedSets: [oldLog, newLog])
        let workout = WorkoutRecord(id: "duplicate-children", titleSnapshot: "Duplicates", statusRaw: WorkoutStatus.completed.rawValue, startedAt: .init(timeIntervalSince1970: 1), completedAt: .init(timeIntervalSince1970: 5), createdAt: .init(timeIntervalSince1970: 1), updatedAt: .init(timeIntervalSince1970: 5), exercises: [occurrence])
        container.mainContext.insert(workout); try container.mainContext.save()

        let loaded = try await SwiftDataRepository(container: container).workout(id: .init(rawValue: "duplicate-children"))
        XCTAssertEqual(loaded?.exercises.first?.prescriptions.count, 1)
        XCTAssertEqual(loaded?.exercises.first?.loggedSets.count, 1)
        XCTAssertEqual(loaded?.exercises.first?.loggedSets.first?.repetitions, 8)
        XCTAssertEqual(try container.mainContext.fetchCount(FetchDescriptor<PrescriptionRecord>()), 2)
        XCTAssertEqual(try container.mainContext.fetchCount(FetchDescriptor<LoggedSetRecord>()), 2)
    }

    func testDuplicateOccurrenceProgressionAndTimerIDsResolveDeterministically() async throws {
        let container = try PersistenceController.makeContainer(inMemory: true)
        let oldOccurrence = WorkoutExerciseRecord(id: "same-occurrence", exerciseID: "definition", nameSnapshot: "Old", position: 0, restDuration: nil, skippedAt: nil, updatedAt: .init(timeIntervalSince1970: 1), prescriptions: [], loggedSets: [])
        let newOccurrence = WorkoutExerciseRecord(id: "same-occurrence", exerciseID: "definition", nameSnapshot: "New", position: 0, restDuration: 60, skippedAt: nil, updatedAt: .init(timeIntervalSince1970: 2), prescriptions: [], loggedSets: [])
        let workout = WorkoutRecord(id: "duplicate-occurrence", titleSnapshot: "Duplicate", statusRaw: WorkoutStatus.completed.rawValue, startedAt: .init(timeIntervalSince1970: 1), completedAt: .init(timeIntervalSince1970: 3), createdAt: .init(timeIntervalSince1970: 1), updatedAt: .init(timeIntervalSince1970: 3), exercises: [oldOccurrence, newOccurrence])
        container.mainContext.insert(workout)
        container.mainContext.insert(ProgressionAssignmentRecord(exerciseID: "definition", profileRaw: AutoProgressionProfile.upper.rawValue, updatedAt: .init(timeIntervalSince1970: 1)))
        container.mainContext.insert(ProgressionAssignmentRecord(exerciseID: "definition", profileRaw: AutoProgressionProfile.lower.rawValue, updatedAt: .init(timeIntervalSince1970: 2)))
        container.mainContext.insert(StandaloneTimerConfigurationRecord(id: "same-timer", name: "Old", moveDuration: 30, exerciseRestDuration: 30, exercisesPerRound: 3, rounds: 1, roundRestDuration: 30, createdAt: .init(timeIntervalSince1970: 1), updatedAt: .init(timeIntervalSince1970: 1)))
        container.mainContext.insert(StandaloneTimerConfigurationRecord(id: "same-timer", name: "New", moveDuration: 45, exerciseRestDuration: 30, exercisesPerRound: 3, rounds: 1, roundRestDuration: 30, createdAt: .init(timeIntervalSince1970: 1), updatedAt: .init(timeIntervalSince1970: 2)))
        try container.mainContext.save()

        let repository = SwiftDataRepository(container: container)
        let selectedWorkout = try await repository.workout(id: .init(rawValue: "duplicate-occurrence"))
        let selectedProgression = try await repository.progressionConfiguration()
        XCTAssertEqual(selectedWorkout?.exercises.map(\.nameSnapshot), ["New"])
        XCTAssertEqual(selectedProgression.assignments[.init(rawValue: "definition")], .lower)
        XCTAssertEqual(try repository.timerConfigurations().map(\.name), ["New"])
        XCTAssertEqual(try container.mainContext.fetchCount(FetchDescriptor<WorkoutExerciseRecord>()), 2)
    }

    func testIndependentSettingsAndProgressionMutationsSurviveStalePeerState() async throws {
        let container = try PersistenceController.makeContainer(inMemory: true)
        let repository = SwiftDataRepository(container: container)
        try await repository.saveDefaultRestDuration(75)
        let staleSettings = try await repository.settings()
        try await repository.saveWeightUnit(.kilograms)
        XCTAssertEqual(staleSettings.defaultRestDuration, 75)
        let settings = try await repository.settings()
        XCTAssertEqual(settings, .init(weightUnit: .kilograms, defaultRestDuration: 75))

        try await repository.saveProgressionProfile(.upper, for: .init(rawValue: "exercise-a"))
        try await repository.saveProgressionProfile(.accessories, for: .init(rawValue: "exercise-b"))
        let assignments = try await repository.progressionConfiguration().assignments
        XCTAssertEqual(assignments[.init(rawValue: "exercise-a")], .upper)
        XCTAssertEqual(assignments[.init(rawValue: "exercise-b")], .accessories)
    }

    func testDeletionPolicyKeepsCompletedHistoryAndArchivesExercises() async throws {
        let container = try PersistenceController.makeContainer(inMemory: true)
        let repository = SwiftDataRepository(container: container)
        let incomplete = EquilibriumFixtures.ready(id: "delete-ready")
        let completed = EquilibriumFixtures.completed(id: "keep-history")
        try await repository.create(incomplete); try await repository.create(completed)
        try await repository.deleteWorkout(id: incomplete.id)
        do { try await repository.deleteWorkout(id: completed.id); XCTFail("Completed history must not be deletable") }
        catch { XCTAssertEqual(error as? RepositoryError, .immutableCompletedWorkout) }

        let definition = ExerciseDefinition(id: .init(rawValue: "archive-only"), name: "Archive Only", normalizedName: "archive only", aliases: [], equipment: nil, category: nil, isCustom: true, archivedAt: nil)
        try await repository.saveExercise(definition); try await repository.archiveExercise(id: definition.id, at: .init(timeIntervalSince1970: 10))
        let activeExercises = try await repository.allExercises()
        let persistedDefinitions = try container.mainContext.fetch(FetchDescriptor<ExerciseDefinitionRecord>())
        let survivingHistory = try await repository.workout(id: completed.id)
        XCTAssertNil(activeExercises.first { $0.id == definition.id })
        XCTAssertEqual(persistedDefinitions.first { $0.id == definition.id.rawValue }?.archivedAt, .init(timeIntervalSince1970: 10))
        XCTAssertNotNil(survivingHistory)
    }

    func testDuplicateSettingsResolvePerKeyAndIndependentSavesDoNotOverwriteOtherKeys() async throws {
        let container = try PersistenceController.makeContainer(inMemory: true)
        container.mainContext.insert(SettingValueRecord(key: "weight-unit", value: WeightUnit.pounds.rawValue, updatedAt: .init(timeIntervalSince1970: 1)))
        container.mainContext.insert(SettingValueRecord(key: "weight-unit", value: WeightUnit.kilograms.rawValue, updatedAt: .init(timeIntervalSince1970: 2)))
        container.mainContext.insert(SettingValueRecord(key: "default-rest-duration", value: "75", updatedAt: .init(timeIntervalSince1970: 3)))
        container.mainContext.insert(ProgressionAssignmentRecord(exerciseID: "exercise", profileRaw: AutoProgressionProfile.lower.rawValue, updatedAt: .init(timeIntervalSince1970: 4)))
        try container.mainContext.save()
        let repository = SwiftDataRepository(container: container)
        let initialSettings = try await repository.settings()
        XCTAssertEqual(initialSettings, .init(weightUnit: .kilograms, defaultRestDuration: 75))

        var progression = try await repository.progressionConfiguration(); progression.assign(.upper, to: .init(rawValue: "other")); try await repository.saveProgressionConfiguration(progression)
        let afterProgressionSettings = try await repository.settings()
        XCTAssertEqual(afterProgressionSettings.defaultRestDuration, 75)
        var settings = try await repository.settings(); settings.weightUnit = .pounds; try await repository.saveSettings(settings)
        let afterSettingsProgression = try await repository.progressionConfiguration()
        XCTAssertEqual(afterSettingsProgression.assignments[.init(rawValue: "exercise")], .lower)
    }

    func testFineGrainedSetEditsPreserveUnrelatedPersistentRecords() async throws {
        let container = try PersistenceController.makeContainer(inMemory: true)
        let repository = SwiftDataRepository(container: container)
        let fixture = EquilibriumFixtures.inProgress(id: "fine-grained")
        try await repository.create(fixture)
        let exerciseID = fixture.exercises[0].id, firstID = fixture.exercises[0].prescriptions[0].id
        let beforePrescriptions = try container.mainContext.fetch(FetchDescriptor<PrescriptionRecord>())
        let sibling = try XCTUnwrap(beforePrescriptions.first { $0.id != firstID.rawValue })
        let siblingPersistentID = sibling.persistentModelID
        _ = try await repository.logSet(workoutID: fixture.id, exerciseID: exerciseID, prescriptionID: firstID, input: .repetitions(weight: .init(pounds: 150), repetitions: 9), completed: true, at: .init(timeIntervalSince1970: 50))
        XCTAssertEqual(try container.mainContext.fetch(FetchDescriptor<PrescriptionRecord>()).first { $0.id == sibling.id }?.persistentModelID, siblingPersistentID)

        let removable = try await repository.appendSet(workoutID: fixture.id, exerciseID: exerciseID, seed: nil, at: .init(timeIntervalSince1970: 60))
        let removeID = try XCTUnwrap(removable.exercises[0].prescriptions.last?.id)
        let siblingCount = removable.exercises[0].prescriptions.count - 1
        let result = try await repository.removeSet(workoutID: fixture.id, exerciseID: exerciseID, prescriptionID: removeID, at: .init(timeIntervalSince1970: 70))
        XCTAssertEqual(result.exercises[0].prescriptions.count, siblingCount)
        XCTAssertFalse(result.exercises[0].prescriptions.contains { $0.id == removeID })
    }

    func testArchivedExerciseAndTimersRoundTripThroughBackup() async throws {
        let source = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        let definition = ExerciseDefinition(id: .init(rawValue: "archived-definition"), name: "Archived", normalizedName: "archived", aliases: [], equipment: nil, category: nil, isCustom: true, archivedAt: nil)
        try await source.saveExercise(definition)
        var history = EquilibriumFixtures.completed(id: "archived-history")
        let original = history.exercises[0]
        history.exercises[0] = WorkoutExercise(id: original.id, exerciseID: definition.id, nameSnapshot: definition.name, prescriptions: original.prescriptions, loggedSets: original.loggedSets, restDuration: original.restDuration, skippedAt: original.skippedAt, isTimeBased: original.isTimeBased, isTwoSided: original.isTwoSided)
        try await source.create(history); try await source.archiveExercise(id: definition.id, at: .init(timeIntervalSince1970: 100))
        let timer = StandaloneTimerConfiguration(id: "backup-timer", name: "Intervals", createdAt: .init(timeIntervalSince1970: 10), updatedAt: .init(timeIntervalSince1970: 20))
        try source.saveTimerConfiguration(timer)

        let backup = try await source.exportBackup(exportedAt: .init(timeIntervalSince1970: 200), sourceDeviceID: "source")
        XCTAssertEqual(backup.exercises.first { $0.id == definition.id }?.archivedAt, .init(timeIntervalSince1970: 100))
        XCTAssertEqual(backup.timers.map(\.id), [timer.id])
        let destination = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true)); try await destination.restoreBackup(backup)
        let restoredHistory = try await destination.workout(id: history.id)
        let activeDefinitions = try await destination.allExercises()
        XCTAssertEqual(restoredHistory?.exercises.first?.exerciseID, definition.id)
        XCTAssertEqual(activeDefinitions.contains { $0.id == definition.id }, false)
        XCTAssertEqual(try destination.timerConfigurations().map(\.id), [timer.id])
    }

    func testLegacyUserDefaultsTimersConvertOnceIntoCanonicalSwiftData() throws {
        let suite = "timer-conversion-\(UUID().uuidString)"
        let defaults = try XCTUnwrap(UserDefaults(suiteName: suite)); defaults.removePersistentDomain(forName: suite)
        let legacy = StandaloneTimerConfiguration(id: "legacy-timer", name: "Legacy", createdAt: .init(timeIntervalSince1970: 10))
        defaults.set(try JSONEncoder().encode([legacy]), forKey: "legacy")
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        let first = SwiftDataStandaloneTimerStore(repository: repository, defaults: defaults, legacyKey: "legacy", migrationKey: "migrated")
        XCTAssertEqual(first.configurations().map(\.id), [legacy.id])
        defaults.set(try JSONEncoder().encode([legacy, .init(id: "late", name: "Late")]), forKey: "legacy")
        let reopened = SwiftDataStandaloneTimerStore(repository: repository, defaults: defaults, legacyKey: "legacy", migrationKey: "migrated")
        XCTAssertEqual(reopened.configurations().map(\.id), [legacy.id])
    }
}
