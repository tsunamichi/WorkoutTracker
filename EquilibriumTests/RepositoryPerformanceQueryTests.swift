import XCTest
@testable import Equilibrium

@MainActor
final class RepositoryPerformanceQueryTests: XCTestCase {
    private let export = Data("""
    {"workouts":[
      {"id":"a-1","date":"2026-02-16","workoutName":"Upper","exercises":[{"name":"Bench Press","sets":[{"weight":"135","reps":"8"}]},{"name":"Row","sets":[{"weight":"95","reps":"10"}]}]},
      {"id":"a-2","date":"2026-02-18","workoutName":"Upper","exercises":[{"name":"Bench Press","sets":[{"weight":"140","reps":"6"}]}]},
      {"id":"a-3","date":"2026-02-20","workoutName":"Lower","exercises":[{"name":"Squat","sets":[{"weight":"185","reps":"5"}]}]}
    ]}
    """.utf8)

    private func seededRepository(storageURL: URL? = nil) throws -> SwiftDataRepository {
        let container = try storageURL.map { try PersistenceController.makeContainer(storageURL: $0) } ?? PersistenceController.makeContainer(inMemory: true)
        let repository = SwiftDataRepository(container: container)
        _ = try RNLegacyImporter(repository: repository).importFileData(export)
        return repository
    }

    func testTargetedExerciseHistoryMatchesFullScan() async throws {
        let repository = try seededRepository()
        let all = try await repository.allWorkouts()
        let definitions = try await repository.allExercises()
        for definition in definitions {
            let targeted = try await repository.exercisePerformance(exerciseID: definition.id)
            XCTAssertEqual(targeted, ExercisePerformanceQuery.performance(exerciseID: definition.id, workouts: all))
        }
        let batched = try await repository.latestExerciseLogs(exerciseIDs: Set(definitions.map(\.id)))
        for definition in definitions {
            let individual = try await repository.latestExerciseLog(exerciseID: definition.id)
            XCTAssertEqual(batched[definition.id], individual)
        }
        let missing = try await repository.exercisePerformance(exerciseID: .init(rawValue: "missing"))
        XCTAssertNil(missing.latestOccurrence)
    }

    func testRecentCompletedWorkoutsMatchesFullScanPrefix() async throws {
        let repository = try seededRepository()
        let full = try await repository.completedWorkouts()
        for limit in [0, 1, 2, 3, 14, .max] {
            let recent = try await repository.recentCompletedWorkouts(limit: limit)
            XCTAssertEqual(recent.map(\.id), Array(full.prefix(limit)).map(\.id), "limit \(limit)")
        }
    }

    func testRecentExercisesReturnsOnlyTheMostRecentlyUsedDefinitions() async throws {
        let repository = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        let definitions = [
            definition(id: "press", name: "Press"),
            definition(id: "row", name: "Row"),
            definition(id: "squat", name: "Squat")
        ]
        for definition in definitions { try await repository.saveExercise(definition) }
        try await repository.create(completedWorkout(id: "old", exercise: definitions[0], completedAt: .init(timeIntervalSince1970: 10)))
        try await repository.create(completedWorkout(id: "middle", exercise: definitions[1], completedAt: .init(timeIntervalSince1970: 20)))
        try await repository.create(completedWorkout(id: "new", exercise: definitions[2], completedAt: .init(timeIntervalSince1970: 30)))

        let recent = try await repository.recentExercises(limit: 2)

        XCTAssertEqual(recent.map(\.id), [definitions[2].id, definitions[1].id])
    }

    func testStartupConsolidatesDBDuplicateAndPreservesBothHistories() async throws {
        let container = try PersistenceController.makeContainer(inMemory: true)
        let context = container.mainContext
        let canonical = definition(id: "incline-dumbbell", name: "Incline Dumbbell Press", isCustom: false)
        let duplicate = definition(id: "incline-db", name: "Incline DB Press", isCustom: true)
        let standaloneDB = definition(id: "chest-db-squeeze", name: "Chest DB Squeeze", isCustom: true)
        context.insert(DefinitionMapper.record(from: canonical))
        context.insert(DefinitionMapper.record(from: duplicate))
        context.insert(DefinitionMapper.record(from: standaloneDB))
        context.insert(WorkoutMapper.record(from: completedWorkout(id: "canonical-log", exercise: canonical, completedAt: .init(timeIntervalSince1970: 10))))
        context.insert(WorkoutMapper.record(from: completedWorkout(id: "duplicate-log", exercise: duplicate, completedAt: .init(timeIntervalSince1970: 20))))
        context.insert(ProgressionAssignmentRecord(exerciseID: duplicate.id.rawValue, profileRaw: AutoProgressionProfile.upper.rawValue, updatedAt: .init(timeIntervalSince1970: 20)))
        context.insert(SettingValueRecord(key: "exercise-rest-duration:\(duplicate.id.rawValue)", value: "75", updatedAt: .init(timeIntervalSince1970: 20)))
        try context.save()

        let environment = try AppEnvironment(container: container)
        let repository = try XCTUnwrap(environment.exerciseRepository as? SwiftDataRepository)
        let exercises = try await repository.allExercises()

        let merged = try XCTUnwrap(exercises.first { $0.id == canonical.id })
        let renamed = try XCTUnwrap(exercises.first { $0.id == standaloneDB.id })
        XCTAssertEqual(exercises.count, 2)
        XCTAssertEqual(merged.id, canonical.id)
        XCTAssertEqual(merged.name, "Incline Dumbbell Press")
        XCTAssertTrue(merged.aliases.contains("Incline DB Press"))
        XCTAssertEqual(renamed.name, "Chest Dumbbell Squeeze")
        XCTAssertTrue(renamed.aliases.contains("Chest DB Squeeze"))
        let workoutExerciseIDs = try await repository.allWorkouts().flatMap(\.exercises).map(\.exerciseID)
        let performance = try await repository.exercisePerformance(exerciseID: canonical.id)
        let progression = try await repository.progressionConfiguration()
        let restDuration = try await repository.exerciseRestDuration(for: canonical.id)
        XCTAssertEqual(workoutExerciseIDs, [canonical.id, canonical.id])
        XCTAssertEqual(performance.occurrences.count, 2)
        XCTAssertEqual(progression.assignments[canonical.id], .upper)
        XCTAssertEqual(restDuration, 75)
    }

    func testWorkoutHistoryGroupsConsecutiveWorkoutsByMonth() async throws {
        let repository = try seededRepository()
        var calendar = Calendar(identifier: .gregorian); calendar.timeZone = TimeZone(identifier: "UTC")!
        let workouts = try await repository.completedWorkouts()
        let months = WorkoutHistoryMonth.group(workouts, calendar: calendar)
        XCTAssertEqual(months.count, 1)
        XCTAssertEqual(months.first?.workouts.map(\.id), workouts.map(\.id))
        let first = workouts[0]
        var older = first; older.completedAt = calendar.date(byAdding: .month, value: -1, to: first.completedAt!)
        let split = WorkoutHistoryMonth.group([first, older], calendar: calendar)
        XCTAssertEqual(split.map { $0.workouts.count }, [1, 1])
        XCTAssertEqual(split[0].title(now: split[0].id, calendar: calendar), split[0].id.formatted(.dateTime.month(.wide)))
    }

    func testHomeWorkoutsMatchesFullScan() async throws {
        let repository = try seededRepository()
        let ready = Workout(id: .init(rawValue: "ready"), titleSnapshot: "Ready", exercises: [], status: .ready, startedAt: nil, completedAt: nil, createdAt: .now, updatedAt: .now)
        try await repository.create(ready)
        let completedDates = try await repository.completedWorkouts().map { $0.completedAt! }.sorted()
        let cutoff = completedDates[1]
        let snapshot = try await repository.homeWorkouts(completedSince: cutoff)
        let all = try await repository.allWorkouts()
        let expected = all.filter { $0.status != .completed || $0.completedAt! >= cutoff }
        XCTAssertEqual(Set(snapshot.workouts.map(\.id)), Set(expected.map(\.id)))
        XCTAssertEqual(snapshot.workouts.count, 3)
        XCTAssertTrue(snapshot.hasCompletedWorkouts)
    }

    func testOwnSavesAreReportedAsLocalChanges() async throws {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("origin-\(UUID()).store")
        let repository = try seededRepository(storageURL: url)
        let received = expectation(forNotification: .equilibriumRepositoryDidChange, object: nil) { notification in
            RepositoryChangeOrigin.of(notification) == .local
        }
        try await repository.saveDefaultRestDuration(60)
        await fulfillment(of: [received], timeout: 5)
    }

    private func definition(id: String, name: String, isCustom: Bool = false) -> ExerciseDefinition {
        .init(
            id: .init(rawValue: id),
            name: name,
            normalizedName: ExerciseResolver.normalizedName(name),
            aliases: [],
            equipment: nil,
            category: nil,
            isCustom: isCustom,
            archivedAt: nil
        )
    }

    private func completedWorkout(id: String, exercise: ExerciseDefinition, completedAt: Date) -> Workout {
        let prescriptionID = SetID(rawValue: "\(id)-prescription")
        let occurrence = WorkoutExercise(
            id: .init(rawValue: "\(id)-occurrence"),
            exerciseID: exercise.id,
            nameSnapshot: exercise.name,
            prescriptions: [.init(id: prescriptionID, target: .repetitions(range: 8...8), suggestedWeight: .init(pounds: 40))],
            loggedSets: [.init(id: .init(rawValue: "\(id)-log"), prescriptionID: prescriptionID, weight: .init(pounds: 40), repetitions: 8, duration: nil, completedAt: completedAt)],
            restDuration: nil,
            skippedAt: nil
        )
        return .init(
            id: .init(rawValue: id),
            titleSnapshot: id,
            exercises: [occurrence],
            status: .completed,
            startedAt: completedAt.addingTimeInterval(-60),
            completedAt: completedAt,
            createdAt: completedAt.addingTimeInterval(-60),
            updatedAt: completedAt
        )
    }
}
