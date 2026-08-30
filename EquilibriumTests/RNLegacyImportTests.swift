import SwiftData
import XCTest
@testable import Equilibrium

@MainActor
final class RNLegacyImportTests: XCTestCase {
    private func fixtureData() throws -> Data {
        let root = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent()
        return try Data(contentsOf: root.appendingPathComponent("fixtures/react-native-migration/retained-v2-backup.json"))
    }

    func testRepresentativeFrozenBackupImportsIntoCanonicalNativeFeatures() async throws {
        let container = try PersistenceController.makeContainer(inMemory: true)
        let repository = SwiftDataRepository(container: container)
        let result = try RNLegacyImporter(repository: repository).importFileData(fixtureData(), importedAt: .init(timeIntervalSince1970: 2_000_000_000))
        XCTAssertEqual(result, .init(exercisesImported: 4, workoutsImported: 3, timersImported: 1, skippedMalformed: 0))

        let active = try await repository.activeWorkouts()
        XCTAssertEqual(active.map(\.id.rawValue), ["rn-scheduled:active-1"])
        XCTAssertEqual(active.first?.status, .inProgress)
        XCTAssertEqual(active.first?.exercises.first?.loggedSets.first?.repetitions, 10)
        XCTAssertNil(active.first?.exercises.first?.loggedSets.first?.weight)
        XCTAssertEqual(active.first?.exercises.first?.restDuration, 75)

        let history = try await repository.completedWorkouts()
        XCTAssertEqual(history.count, 2)
        let scheduled = try XCTUnwrap(history.first { $0.id.rawValue == "rn-scheduled:completed-1" })
        XCTAssertEqual(scheduled.titleSnapshot, "Lower Strength")
        XCTAssertEqual(scheduled.completedAt, ISO8601DateFormatter().date(from: "2025-11-10T16:00:00Z"))
        XCTAssertEqual(scheduled.exercises.map(\.nameSnapshot), ["Barbell Back Squat", "Front Plank"])
        XCTAssertEqual(scheduled.exercises[0].loggedSets.map { $0.weight?.pounds }, [205, 205])
        XCTAssertTrue(scheduled.exercises[1].isTimeBased); XCTAssertTrue(scheduled.exercises[1].isTwoSided)
        XCTAssertEqual(scheduled.exercises[1].loggedSets.first?.duration, 45); XCTAssertNil(scheduled.exercises[1].loggedSets.first?.weight)

        let squatID = ExerciseID(rawValue: "rn-exercise:squat")
        let performance = try await repository.exercisePerformance(exerciseID: squatID)
        XCTAssertEqual(performance.displayName, "Barbell Back Squat")
        XCTAssertEqual(performance.occurrences.count, 1); XCTAssertEqual(performance.trend.count, 1)
        guard case .repetitions(let pr)? = performance.personalRecord else { return XCTFail("Expected native repetition PR") }
        XCTAssertEqual(pr.weight?.pounds, 205); XCTAssertEqual(pr.repetitions, 8)
        let latest = try await repository.latestExerciseLog(exerciseID: squatID)
        XCTAssertEqual(latest?.sets.count, 2)

        let settings = try await repository.settings()
        XCTAssertEqual(settings, .init(weightUnit: .kilograms, defaultRestDuration: 75))
        let progression = try await repository.progressionConfiguration()
        XCTAssertEqual(progression.assignments[squatID], .lower)
        XCTAssertEqual(progression.assignments[.init(rawValue: "rn-exercise:plank")], .accessories)
        XCTAssertNotNil(ProgressionEngine.suggestion(exerciseID: squatID, configuration: progression, workouts: history))
        XCTAssertEqual(try repository.timerConfigurations().map(\.name), ["Conditioning"])

        let archivedID = "rn-exercise:custom-row"
        let allRecords = try container.mainContext.fetch(FetchDescriptor<ExerciseDefinitionRecord>())
        XCTAssertNotNil(allRecords.first { $0.id == archivedID }?.archivedAt)
        let activeDefinitions = try await repository.allExercises()
        XCTAssertFalse(activeDefinitions.contains { $0.id.rawValue == archivedID })
    }

    func testImportIsIdempotentAndReceiptSurvivesRelaunch() throws {
        let url = TestSupport.temporaryStoreURL(); let data = try fixtureData()
        do {
            let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(storageURL: url))
            _ = try RNLegacyImporter(repository: repository).importFileData(data)
            XCTAssertThrowsError(try RNLegacyImporter(repository: repository).importFileData(data)) { XCTAssertEqual($0 as? RNLegacyImportError, .alreadyImported) }
        }
        let reopened = SwiftDataRepository(container: try PersistenceController.makeContainer(storageURL: url))
        XCTAssertThrowsError(try RNLegacyImporter(repository: reopened).importFileData(data)) { XCTAssertEqual($0 as? RNLegacyImportError, .alreadyImported) }
        XCTAssertEqual(try reopened.context.fetchCount(FetchDescriptor<WorkoutRecord>()), 3)
    }

    func testFailedDecodeWritesNoReceiptAndCanRetry() throws {
        let container = try PersistenceController.makeContainer(inMemory: true); let repository = SwiftDataRepository(container: container); let importer = RNLegacyImporter(repository: repository)
        XCTAssertThrowsError(try importer.importFileData(Data("not-json".utf8)))
        XCTAssertEqual(try container.mainContext.fetchCount(FetchDescriptor<LegacyImportReceiptRecord>()), 0)
        XCTAssertNoThrow(try importer.importFileData(fixtureData()))
        XCTAssertEqual(try container.mainContext.fetchCount(FetchDescriptor<LegacyImportReceiptRecord>()), 1)
    }

    func testValidationFailureRollsBackAndRetryRemainsAvailable() throws {
        let container = try PersistenceController.makeContainer(inMemory: true); let repository = SwiftDataRepository(container: container)
        let invalid = Workout(id: .init(rawValue: "invalid"), titleSnapshot: "", exercises: [], status: .ready, startedAt: nil, completedAt: nil, createdAt: .now, updatedAt: .now)
        let materialization = LegacyImportMaterialization(sourceDigest: "failed-attempt", exercises: [], workouts: [invalid], settings: nil, progression: nil, timers: [], skippedMalformedCount: 0)
        XCTAssertThrowsError(try repository.importLegacyRN(materialization))
        XCTAssertEqual(try container.mainContext.fetchCount(FetchDescriptor<LegacyImportReceiptRecord>()), 0)
        XCTAssertEqual(try container.mainContext.fetchCount(FetchDescriptor<WorkoutRecord>()), 0)
        XCTAssertNoThrow(try RNLegacyImporter(repository: repository).importFileData(fixtureData()))
    }

    func testImportCoexistsWithNativeDataAndDoesNotDuplicateCanonicalHistory() async throws {
        let container = try PersistenceController.makeContainer(inMemory: true); let repository = SwiftDataRepository(container: container)
        let native = EquilibriumFixtures.completed(id: "native-history"); try await repository.create(native)
        _ = try RNLegacyImporter(repository: repository).importFileData(fixtureData())
        let completed = try await repository.completedWorkouts(), retainedNative = try await repository.workout(id: native.id)
        XCTAssertEqual(completed.count, 3)
        XCTAssertNotNil(retainedNative)
    }

    func testSupabaseExportWrapperDecodesLocallyWithoutBackendAccess() throws {
        let raw = try JSONSerialization.jsonObject(with: fixtureData()) as! [String: Any]
        let wrapped = try JSONSerialization.data(withJSONObject: ["data": raw, "updated_at": "2026-01-01T00:00:00Z"])
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        XCTAssertEqual(try RNLegacyImporter(repository: repository).importFileData(wrapped).workoutsImported, 3)
    }

    func testDuplicateSourceWorkoutIdentifierSelectsNewestDeterministically() async throws {
        var root = try JSONSerialization.jsonObject(with: fixtureData()) as! [String: Any]
        var workouts = root["@workout_tracker_scheduled_workouts"] as! [[String: Any]]
        var duplicate = workouts[0]; duplicate["titleSnapshot"] = "Newest Duplicate"; duplicate["completedAt"] = "2025-12-10T16:00:00.000Z"
        workouts.append(duplicate); root["@workout_tracker_scheduled_workouts"] = workouts
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        _ = try RNLegacyImporter(repository: repository).importFileData(try JSONSerialization.data(withJSONObject: root))
        let selected = try await repository.workout(id: .init(rawValue: "rn-scheduled:completed-1"))
        XCTAssertEqual(selected?.titleSnapshot, "Newest Duplicate")
        XCTAssertEqual(try repository.context.fetchCount(FetchDescriptor<WorkoutRecord>(predicate: #Predicate { $0.id == "rn-scheduled:completed-1" })), 1)
    }

    func testEmptyUserProducesReceiptWithoutFabricatingContent() throws {
        let data = try JSONSerialization.data(withJSONObject: ["@workout_tracker_exercises": [], "@workout_tracker_sessions": []])
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        let result = try RNLegacyImporter(repository: repository).importFileData(data)
        XCTAssertEqual(result, .init(exercisesImported: 0, workoutsImported: 0, timersImported: 0, skippedMalformed: 0))
        XCTAssertEqual(try repository.context.fetchCount(FetchDescriptor<LegacyImportReceiptRecord>()), 1)
    }

    func testPoundsSettingsRemainPounds() async throws {
        let data = try JSONSerialization.data(withJSONObject: ["@workout_tracker_settings":["useKg":false,"restTimerDefaultSeconds":90,"progressionSuggestionsEnabled":false]])
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        _ = try RNLegacyImporter(repository: repository).importFileData(data)
        let settings = try await repository.settings(), progression = try await repository.progressionConfiguration()
        XCTAssertEqual(settings.weightUnit, .pounds); XCTAssertFalse(progression.isEnabled)
    }

    func testLargeHistorySanity() async throws {
        let count = 1_000
        let exercise: [String: Any] = ["id":"scale-exercise", "name":"Scale Squat", "category":"Legs", "isCustom":false, "defaultProgressionType":"main_lower"]
        var workouts: [[String: Any]] = []; var progress: [String: Any] = [:]
        for index in 0..<count {
            let id = "scale-\(index)", day = String(format: "%02d", index % 28 + 1), date = "2025-01-\(day)"
            workouts.append(["id":id,"date":date,"templateId":"scale-template","titleSnapshot":"Scale Workout","status":"completed","startedAt":"2025-01-\(day)T10:00:00.000Z","completedAt":"2025-01-\(day)T11:00:00.000Z","exercisesSnapshot":[["id":"scale-item","exerciseId":"scale-exercise","nameSnapshot":"Scale Squat","order":0,"sets":3,"reps":"5-8","isTimeBased":false]]])
            progress[id] = ["workoutKey":id,"lastUpdated":"2025-01-\(day)T11:00:00.000Z","exercises":["scale-item":["exerciseId":"scale-exercise","sets":[["setNumber":1,"weight":225,"reps":8,"completed":true],["setNumber":2,"weight":225,"reps":8,"completed":true],["setNumber":3,"weight":225,"reps":8,"completed":true]]]]]
        }
        let data = try JSONSerialization.data(withJSONObject: ["@workout_tracker_exercises":[exercise],"@workout_tracker_scheduled_workouts":workouts,"@workout_tracker_detailed_progress":progress])
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true)); let start = CFAbsoluteTimeGetCurrent()
        let result = try RNLegacyImporter(repository: repository).importFileData(data); let elapsed = CFAbsoluteTimeGetCurrent() - start
        XCTAssertEqual(result.workoutsImported, count); XCTAssertLessThan(elapsed, 15)
        XCTAssertEqual(try repository.context.fetchCount(FetchDescriptor<WorkoutRecord>()), count)
        let performance = try await repository.exercisePerformance(exerciseID: .init(rawValue: "rn-exercise:scale-exercise"))
        XCTAssertEqual(performance.occurrences.count, count); XCTAssertNotNil(performance.previousOccurrence); XCTAssertEqual(performance.trend.count, count)
        print("RN import scale: \(count) workouts, \(data.count) bytes, \(String(format: "%.3f", elapsed)) seconds")
    }
}
