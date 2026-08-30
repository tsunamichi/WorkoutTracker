import Foundation
import SwiftData

@MainActor
public final class SwiftDataRepository: ExerciseRepository, WorkoutRepository, ExerciseHistoryRepository, SettingsRepository, ProgressionRepository, BackupRepository {
    private let context: ModelContext
    public init(container: ModelContainer) {
        context = ModelContext(container); context.autosaveEnabled = false
    }

    public func allExercises() async throws -> [ExerciseDefinition] {
        try context.fetch(FetchDescriptor<ExerciseDefinitionRecord>(sortBy: [SortDescriptor(\.name)])).map(DefinitionMapper.domain).filter { $0.archivedAt == nil }
    }
    public func searchExercises(_ query: String) async throws -> [ExerciseDefinition] {
        let needle = Self.normalizeExerciseName(query)
        guard !needle.isEmpty else { return try await allExercises() }
        return try await allExercises().filter { exercise in
            exercise.normalizedName.contains(needle) || exercise.aliases.contains { Self.normalizeExerciseName($0).contains(needle) }
        }
    }
    public func latestExerciseLog(exerciseID: ExerciseID) async throws -> LatestExerciseLog? {
        guard let occurrence = try await exercisePerformance(exerciseID: exerciseID).latestOccurrence else { return nil }
        return .init(exerciseID: exerciseID, workoutID: occurrence.workoutID, occurredAt: occurrence.occurredAt, sets: occurrence.sets)
    }
    public func exercisePerformance(exerciseID: ExerciseID) async throws -> ExercisePerformance {
        ExercisePerformanceQuery.performance(exerciseID: exerciseID, workouts: try await allWorkouts())
    }
    public func exercise(id: ExerciseID) async throws -> ExerciseDefinition? {
        let key = id.rawValue; var descriptor = FetchDescriptor<ExerciseDefinitionRecord>(predicate: #Predicate { $0.id == key }); descriptor.fetchLimit = 1
        return try context.fetch(descriptor).first.map(DefinitionMapper.domain)
    }
    public func saveExercise(_ exercise: ExerciseDefinition) async throws {
        let normalized = Self.normalizeExerciseName(exercise.name)
        guard !normalized.isEmpty else { throw RepositoryError.invalidBackup }
        let records = try context.fetch(FetchDescriptor<ExerciseDefinitionRecord>())
        if records.contains(where: { $0.id != exercise.id.rawValue && ($0.normalizedName == normalized || $0.aliases.contains(where: { Self.normalizeExerciseName($0) == normalized })) }) { throw RepositoryError.duplicateExerciseName }
        if let existing = records.first(where: { $0.id == exercise.id.rawValue }) {
            existing.name = exercise.name; existing.normalizedName = normalized; existing.aliases = exercise.aliases; existing.equipment = exercise.equipment; existing.category = exercise.category; existing.isCustom = exercise.isCustom; existing.archivedAt = exercise.archivedAt
        } else { var value = exercise; value.normalizedName = normalized; context.insert(DefinitionMapper.record(from: value)) }
        try saveOrRollback()
    }
    public func archiveExercise(id: ExerciseID, at date: Date) async throws {
        let key = id.rawValue; var descriptor = FetchDescriptor<ExerciseDefinitionRecord>(predicate: #Predicate { $0.id == key }); descriptor.fetchLimit = 1
        guard let record = try context.fetch(descriptor).first else { throw RepositoryError.notFound }; record.archivedAt = date; try saveOrRollback()
    }
    public nonisolated static func normalizeExerciseName(_ value: String) -> String {
        value.folding(options: [.caseInsensitive, .diacriticInsensitive], locale: .current).lowercased().split(whereSeparator: { !$0.isLetter && !$0.isNumber }).joined(separator: " ")
    }

    public func activeWorkouts() async throws -> [Workout] {
        let completed = WorkoutStatus.completed.rawValue
        return try context.fetch(FetchDescriptor<WorkoutRecord>(predicate: #Predicate { $0.statusRaw != completed }, sortBy: [SortDescriptor(\.createdAt), SortDescriptor(\.id)])).map { try WorkoutMapper.domain(from: $0) }
    }
    public func workout(id: WorkoutID) async throws -> Workout? {
        let key = id.rawValue
        var descriptor = FetchDescriptor<WorkoutRecord>(predicate: #Predicate { $0.id == key })
        descriptor.fetchLimit = 1
        return try context.fetch(descriptor).first.map { try WorkoutMapper.domain(from: $0) }
    }
    public func allWorkouts() async throws -> [Workout] {
        try context.fetch(FetchDescriptor<WorkoutRecord>(sortBy: [SortDescriptor(\.createdAt), SortDescriptor(\.id)])).map { try WorkoutMapper.domain(from: $0) }
    }
    public func create(_ workout: Workout) async throws {
        try DomainValidator.validate(workout)
        guard try await self.workout(id: workout.id) == nil else { throw RepositoryError.duplicateIdentifier }
        context.insert(WorkoutMapper.record(from: workout))
        do { try context.save() } catch { context.rollback(); throw error }
    }
    public func update(_ workout: Workout) async throws {
        try DomainValidator.validate(workout)
        let key = workout.id.rawValue
        var descriptor = FetchDescriptor<WorkoutRecord>(predicate: #Predicate { $0.id == key }); descriptor.fetchLimit = 1
        guard let existing = try context.fetch(descriptor).first else { throw RepositoryError.notFound }
        if existing.statusRaw == WorkoutStatus.completed.rawValue { throw RepositoryError.immutableCompletedWorkout }
        existing.titleSnapshot = workout.titleSnapshot; existing.statusRaw = workout.status.rawValue; existing.startedAt = workout.startedAt; existing.completedAt = workout.completedAt; existing.updatedAt = workout.updatedAt
        for child in existing.exercises { context.delete(child) }
        let replacement = WorkoutMapper.record(from: workout)
        existing.exercises = replacement.exercises
        do { try context.save() } catch { context.rollback(); throw error }
    }

    public func startWorkout(id: WorkoutID, at date: Date = .now) async throws -> Workout {
        guard var workout = try await workout(id: id) else { throw RepositoryError.notFound }
        if workout.status == .completed { throw RepositoryError.immutableCompletedWorkout }
        if workout.status == .inProgress { return workout }
        workout.status = .inProgress
        workout.startedAt = date
        workout.updatedAt = date
        try await update(workout)
        return workout
    }

    public func logSet(workoutID: WorkoutID, exerciseID: WorkoutExerciseID, prescriptionID: SetID, input: SetLogInput, completed: Bool, at date: Date = .now) async throws -> Workout {
        guard var workout = try await workout(id: workoutID) else { throw RepositoryError.notFound }
        guard workout.status == .inProgress else {
            if workout.status == .completed { throw RepositoryError.immutableCompletedWorkout }
            throw RepositoryError.workoutNotInProgress
        }
        guard let exerciseIndex = workout.exercises.firstIndex(where: { $0.id == exerciseID }),
              let prescription = workout.exercises[exerciseIndex].prescriptions.first(where: { $0.id == prescriptionID }) else {
            throw RepositoryError.prescriptionNotFound
        }

        let values: (Weight?, Int?, TimeInterval?)
        switch (prescription.target, input) {
        case (.repetitions, .repetitions(let weight, let repetitions)) where repetitions > 0 && (weight?.pounds ?? 0) >= 0:
            values = (weight, repetitions, nil)
        case (.duration, .duration(let weight, let seconds)) where seconds.isFinite && seconds > 0 && (weight?.pounds ?? 0) >= 0:
            values = (weight, nil, seconds)
        default: throw RepositoryError.invalidSetInput
        }

        let existingIndex = workout.exercises[exerciseIndex].loggedSets.firstIndex { $0.prescriptionID == prescriptionID }
        let logged = LoggedSet(
            id: existingIndex.map { workout.exercises[exerciseIndex].loggedSets[$0].id } ?? SetID(rawValue: "logged-\(UUID().uuidString.lowercased())"),
            prescriptionID: prescriptionID,
            weight: values.0,
            repetitions: values.1,
            duration: values.2,
            completedAt: completed ? date : nil
        )
        if let existingIndex { workout.exercises[exerciseIndex].loggedSets[existingIndex] = logged }
        else { workout.exercises[exerciseIndex].loggedSets.append(logged) }
        if let currentIndex = workout.exercises[exerciseIndex].prescriptions.firstIndex(where: { $0.id == prescriptionID }) {
            for nextIndex in workout.exercises[exerciseIndex].prescriptions.indices.dropFirst(currentIndex + 1) {
                let next = workout.exercises[exerciseIndex].prescriptions[nextIndex]
                let hasExistingLog = workout.exercises[exerciseIndex].loggedSets.contains { $0.prescriptionID == next.id }
                if hasExistingLog { break }
                switch input {
                case .repetitions(let weight, let repetitions):
                    workout.exercises[exerciseIndex].prescriptions[nextIndex].target = .repetitions(range: repetitions...repetitions)
                    workout.exercises[exerciseIndex].prescriptions[nextIndex].suggestedWeight = weight
                case .duration(let weight, let seconds):
                    workout.exercises[exerciseIndex].prescriptions[nextIndex].target = .duration(seconds: seconds)
                    workout.exercises[exerciseIndex].prescriptions[nextIndex].suggestedWeight = weight
                }
            }
        }
        workout.updatedAt = date
        try await update(workout)
        return workout
    }

    public func appendSet(workoutID: WorkoutID, exerciseID: WorkoutExerciseID, seed: SetLogInput? = nil, at date: Date = .now) async throws -> Workout {
        guard var workout = try await workout(id: workoutID) else { throw RepositoryError.notFound }
        guard workout.status == .inProgress else { throw workout.status == .completed ? RepositoryError.immutableCompletedWorkout : RepositoryError.workoutNotInProgress }
        guard let index = workout.exercises.firstIndex(where: { $0.id == exerciseID }) else { throw RepositoryError.notFound }
        let prescription: SetPrescription
        switch seed {
        case .duration(let weight, let seconds): prescription = .init(id: .new(), target: .duration(seconds: max(1, seconds)), suggestedWeight: weight)
        case .repetitions(let weight, let repetitions): prescription = .init(id: .new(), target: .repetitions(range: max(1, repetitions)...max(1, repetitions)), suggestedWeight: weight)
        case nil:
            if let previous = workout.exercises[index].prescriptions.last {
                let previousLog = workout.exercises[index].loggedSets.last { $0.prescriptionID == previous.id }
                if let duration = previousLog?.duration {
                    prescription = .init(id: .new(), target: .duration(seconds: duration), suggestedWeight: previousLog?.weight)
                } else if let repetitions = previousLog?.repetitions {
                    prescription = .init(id: .new(), target: .repetitions(range: repetitions...repetitions), suggestedWeight: previousLog?.weight)
                } else {
                    prescription = .init(id: .new(), target: previous.target, suggestedWeight: previous.suggestedWeight)
                }
            } else { prescription = .init(id: .new(), target: .repetitions(range: 1...1), suggestedWeight: nil) }
        }
        workout.exercises[index].prescriptions.append(prescription)
        workout.updatedAt = date
        try await update(workout)
        return workout
    }

    public func removeSet(workoutID: WorkoutID, exerciseID: WorkoutExerciseID, prescriptionID: SetID, at date: Date = .now) async throws -> Workout {
        guard var workout = try await workout(id: workoutID) else { throw RepositoryError.notFound }
        guard workout.status == .inProgress else { throw workout.status == .completed ? RepositoryError.immutableCompletedWorkout : RepositoryError.workoutNotInProgress }
        guard let index = workout.exercises.firstIndex(where: { $0.id == exerciseID }), workout.exercises[index].prescriptions.contains(where: { $0.id == prescriptionID }) else { throw RepositoryError.prescriptionNotFound }
        guard !workout.exercises[index].loggedSets.contains(where: { $0.prescriptionID == prescriptionID && $0.completedAt != nil }) else { throw RepositoryError.cannotRemoveCompletedSet }
        workout.exercises[index].prescriptions.removeAll { $0.id == prescriptionID }
        workout.exercises[index].loggedSets.removeAll { $0.prescriptionID == prescriptionID }
        workout.updatedAt = date
        try await update(workout)
        return workout
    }

    public func completeWorkout(id: WorkoutID, at date: Date = .now) async throws -> Workout {
        guard var workout = try await workout(id: id) else { throw RepositoryError.notFound }
        if workout.status == .completed { return workout }
        guard workout.status == .inProgress else { throw RepositoryError.workoutNotInProgress }
        guard WorkoutExecutionQuery.canComplete(workout) else { throw RepositoryError.incompleteWorkout }
        workout.status = .completed
        workout.completedAt = date
        workout.updatedAt = date
        try await update(workout)
        return workout
    }
    public func resetWorkout(id: WorkoutID, at date: Date = .now) async throws -> Workout {
        guard var workout = try await workout(id: id) else { throw RepositoryError.notFound }
        guard workout.status == .inProgress else { throw workout.status == .completed ? RepositoryError.immutableCompletedWorkout : RepositoryError.workoutNotInProgress }
        for index in workout.exercises.indices {
            workout.exercises[index].loggedSets = []
            workout.exercises[index].skippedAt = nil
        }
        workout.updatedAt = date
        try await update(workout)
        return workout
    }
    public func deleteWorkout(id: WorkoutID) async throws {
        guard let workout = try await workout(id: id) else { throw RepositoryError.notFound }
        guard workout.status != .completed else { throw RepositoryError.immutableCompletedWorkout }
        let key = id.rawValue
        var descriptor = FetchDescriptor<WorkoutRecord>(predicate: #Predicate { $0.id == key }); descriptor.fetchLimit = 1
        guard let record = try context.fetch(descriptor).first else { throw RepositoryError.notFound }
        context.delete(record)
        try saveOrRollback()
    }
    public func setRestDuration(workoutID: WorkoutID, exerciseID: WorkoutExerciseID, seconds: TimeInterval, at date: Date = .now) async throws -> Workout {
        guard seconds.isFinite, seconds >= 15, seconds <= 300, seconds.rounded() == seconds,
              Int(seconds) % 5 == 0 else { throw RepositoryError.invalidRestDuration }
        guard var workout = try await workout(id: workoutID) else { throw RepositoryError.notFound }
        guard workout.status == .inProgress else { throw workout.status == .completed ? RepositoryError.immutableCompletedWorkout : RepositoryError.workoutNotInProgress }
        guard let index = workout.exercises.firstIndex(where: { $0.id == exerciseID }) else { throw RepositoryError.notFound }
        workout.exercises[index].restDuration = seconds
        workout.updatedAt = date
        try await update(workout)
        return workout
    }
    public func editCompletedSet(workoutID: WorkoutID, exerciseID: WorkoutExerciseID, prescriptionID: SetID, input: SetLogInput, at date: Date = .now) async throws -> Workout {
        guard var workout = try await workout(id: workoutID), workout.status == .completed else { throw RepositoryError.workoutNotInProgress }
        guard let exerciseIndex = workout.exercises.firstIndex(where: { $0.id == exerciseID }),
              let prescription = workout.exercises[exerciseIndex].prescriptions.first(where: { $0.id == prescriptionID }),
              let logIndex = workout.exercises[exerciseIndex].loggedSets.firstIndex(where: { $0.prescriptionID == prescriptionID && $0.completedAt != nil }) else { throw RepositoryError.prescriptionNotFound }
        let old = workout.exercises[exerciseIndex].loggedSets[logIndex]
        switch (prescription.target, input) {
        case (.repetitions, .repetitions(let weight, let repetitions)) where repetitions > 0 && (weight?.pounds ?? 0) >= 0:
            workout.exercises[exerciseIndex].loggedSets[logIndex] = .init(id: old.id, prescriptionID: prescriptionID, weight: weight, repetitions: repetitions, duration: nil, completedAt: old.completedAt)
        case (.duration, .duration(let weight, let seconds)) where seconds.isFinite && seconds > 0 && (weight?.pounds ?? 0) >= 0:
            workout.exercises[exerciseIndex].loggedSets[logIndex] = .init(id: old.id, prescriptionID: prescriptionID, weight: weight, repetitions: nil, duration: seconds, completedAt: old.completedAt)
        default: throw RepositoryError.invalidSetInput
        }
        workout.updatedAt = date
        try replaceStoredWorkout(workout)
        return workout
    }
    public func materializeAtomically(_ workouts: [Workout]) async throws {
        for workout in workouts {
            try DomainValidator.validate(workout)
            if try await self.workout(id: workout.id) != nil { throw RepositoryError.duplicateIdentifier }
        }
        for workout in workouts { context.insert(WorkoutMapper.record(from: workout)) }
        do { try context.save() } catch { context.rollback(); throw error }
    }
    public func settings() async throws -> AppSettings { try loadConfiguration().settings }
    public func saveSettings(_ settings: AppSettings) async throws {
        guard Self.isValidRestDuration(settings.defaultRestDuration) else { throw RepositoryError.invalidSettings }
        let current = try loadConfiguration()
        try saveConfiguration(settings: settings, progression: current.progression)
    }
    public func progressionConfiguration() async throws -> ProgressionConfiguration { try loadConfiguration().progression }
    public func saveProgressionConfiguration(_ configuration: ProgressionConfiguration) async throws {
        guard ProgressionValidator.isValid(configuration) else { throw RepositoryError.invalidProgressionConfiguration }
        let current = try loadConfiguration()
        try saveConfiguration(settings: current.settings, progression: configuration)
    }
    public func exportBackup(exportedAt: Date, sourceDeviceID: String) async throws -> EquilibriumBackupV2 {
        let stored = try loadConfiguration()
        return try EquilibriumBackupV2(exportedAt: exportedAt, sourceDeviceID: sourceDeviceID, exercises: try await allExercises(), workouts: try await allWorkouts(), settings: stored.settings, progression: stored.progression)
    }
    public func restoreBackup(_ backup: EquilibriumBackupV2) async throws {
        guard backup.schemaVersion == 2 else { throw BackupError.unsupportedSchemaVersion(backup.schemaVersion) }
        guard Self.isValidRestDuration(backup.settings.defaultRestDuration), ProgressionValidator.isValid(backup.progression) else { throw RepositoryError.invalidBackup }
        guard try await allWorkouts().isEmpty, try await allExercises().isEmpty else { throw RepositoryError.invalidBackup }
        let exerciseIDs = backup.workouts.flatMap(\.exercises).map(\.id)
        let prescriptionIDs = backup.workouts.flatMap(\.exercises).flatMap(\.prescriptions).map(\.id)
        let loggedSetIDs = backup.workouts.flatMap(\.exercises).flatMap(\.loggedSets).map(\.id)
        guard Set(exerciseIDs).count == exerciseIDs.count, Set(prescriptionIDs).count == prescriptionIDs.count, Set(loggedSetIDs).count == loggedSetIDs.count else { throw RepositoryError.duplicateIdentifier }
        for workout in backup.workouts { try DomainValidator.validate(workout) }
        for exercise in backup.exercises { context.insert(DefinitionMapper.record(from: exercise)) }
        for workout in backup.workouts { context.insert(WorkoutMapper.record(from: workout)) }
        let metadata = try BackupCodec.encode(backup)
        context.insert(BackupCollectionRecord(payload: metadata))
        context.insert(AppConfigurationRecord(settingsPayload: try Self.encoder.encode(backup.settings), progressionPayload: try Self.encoder.encode(backup.progression)))
        do { try context.save() } catch { context.rollback(); throw error }
    }
    private func loadCollection() throws -> EquilibriumBackupV2? {
        guard let record = try context.fetch(FetchDescriptor<BackupCollectionRecord>()).first else { return nil }
        return try BackupCodec.decode(record.payload)
    }
    private static let encoder = JSONEncoder()
    private static let decoder = JSONDecoder()
    private static func isValidRestDuration(_ value: TimeInterval) -> Bool { value.isFinite && value >= 15 && value <= 300 && value.rounded() == value && Int(value) % 5 == 0 }
    private func loadConfiguration() throws -> (settings: AppSettings, progression: ProgressionConfiguration) {
        if let record = try context.fetch(FetchDescriptor<AppConfigurationRecord>()).first {
            return (try Self.decoder.decode(AppSettings.self, from: record.settingsPayload), try Self.decoder.decode(ProgressionConfiguration.self, from: record.progressionPayload))
        }
        if let backup = try loadCollection() { return (backup.settings, backup.progression) }
        return (.init(weightUnit: .pounds, defaultRestDuration: 90), FixtureDefaults.progression)
    }
    private func saveConfiguration(settings: AppSettings, progression: ProgressionConfiguration) throws {
        let settingsPayload = try Self.encoder.encode(settings), progressionPayload = try Self.encoder.encode(progression)
        if let record = try context.fetch(FetchDescriptor<AppConfigurationRecord>()).first {
            record.settingsPayload = settingsPayload; record.progressionPayload = progressionPayload
        } else { context.insert(AppConfigurationRecord(settingsPayload: settingsPayload, progressionPayload: progressionPayload)) }
        try saveOrRollback()
    }
    private func saveOrRollback() throws { do { try context.save() } catch { context.rollback(); throw error } }
    private func replaceStoredWorkout(_ workout: Workout) throws {
        let key = workout.id.rawValue
        var descriptor = FetchDescriptor<WorkoutRecord>(predicate: #Predicate { $0.id == key }); descriptor.fetchLimit = 1
        guard let existing = try context.fetch(descriptor).first else { throw RepositoryError.notFound }
        existing.titleSnapshot = workout.titleSnapshot; existing.statusRaw = workout.status.rawValue; existing.startedAt = workout.startedAt; existing.completedAt = workout.completedAt; existing.updatedAt = workout.updatedAt
        for child in existing.exercises { context.delete(child) }
        existing.exercises = WorkoutMapper.record(from: workout).exercises
        try saveOrRollback()
    }
}

enum FixtureDefaults {
    static let progression = ProgressionConfiguration(isEnabled: true, defaults: .init(repetitionRange: 8...12, weightIncrement: .init(pounds: 5), mode: .doubleProgression), groups: [], overrides: [])
}
