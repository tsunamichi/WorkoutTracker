import SwiftData
import XCTest
@testable import Equilibrium

@MainActor
final class CloudKitReadinessPersistenceTests: XCTestCase {
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
