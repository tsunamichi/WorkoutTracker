import Foundation
import SwiftData

@MainActor
public final class SwiftDataRepository: ExerciseRepository, WorkoutTemplateRepository, ScheduledWorkoutRepository, BackupRepository {
    private let context: ModelContext
    public init(container: ModelContainer) { context = ModelContext(container); context.autosaveEnabled = false }

    public func allExercises() async throws -> [ExerciseDefinition] {
        try context.fetch(FetchDescriptor<ExerciseDefinitionRecord>(sortBy: [SortDescriptor(\.name)])).map(DefinitionMapper.domain).filter { $0.archivedAt == nil }
    }
    public func searchExercises(_ query: String) async throws -> [ExerciseDefinition] {
        let needle = Self.normalizeExerciseName(query)
        guard !needle.isEmpty else { return try await allExercises() }
        return try await allExercises().filter { exercise in
            exercise.normalizedName.contains(needle) || exercise.aliases.contains { Self.normalizeExerciseName($0).contains(needle) } || exercise.equipment.map { Self.normalizeExerciseName($0).contains(needle) } == true || exercise.category.map { Self.normalizeExerciseName($0).contains(needle) } == true
        }
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
    public func allTemplates() async throws -> [WorkoutTemplate] {
        try context.fetch(FetchDescriptor<WorkoutTemplateRecord>(sortBy: [SortDescriptor(\.updatedAt, order: .reverse)])).map(DefinitionMapper.domain).filter { $0.archivedAt == nil }
    }
    public func template(id: WorkoutTemplateID) async throws -> WorkoutTemplate? {
        let key = id.rawValue; var descriptor = FetchDescriptor<WorkoutTemplateRecord>(predicate: #Predicate { $0.id == key }); descriptor.fetchLimit = 1
        return try context.fetch(descriptor).first.map(DefinitionMapper.domain)
    }
    public func saveTemplate(_ template: WorkoutTemplate) async throws {
        guard !template.name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty, !template.exercises.isEmpty else { throw RepositoryError.invalidBackup }
        let childIDs = template.exercises.map(\.id.rawValue) + template.exercises.flatMap(\.prescriptions).map(\.id.rawValue)
        guard Set(childIDs).count == childIDs.count else { throw RepositoryError.duplicateIdentifier }
        let key = template.id.rawValue; var descriptor = FetchDescriptor<WorkoutTemplateRecord>(predicate: #Predicate { $0.id == key }); descriptor.fetchLimit = 1
        if let existing = try context.fetch(descriptor).first {
            let replacement = DefinitionMapper.record(from: template)
            existing.name = template.name; existing.createdAt = template.createdAt; existing.updatedAt = template.updatedAt; existing.archivedAt = template.archivedAt
            for child in existing.exercises { context.delete(child) }; existing.exercises = replacement.exercises
        } else { context.insert(DefinitionMapper.record(from: template)) }
        try saveOrRollback()
    }
    public func archiveTemplate(id: WorkoutTemplateID, at date: Date) async throws {
        let key = id.rawValue; var descriptor = FetchDescriptor<WorkoutTemplateRecord>(predicate: #Predicate { $0.id == key }); descriptor.fetchLimit = 1
        guard let record = try context.fetch(descriptor).first else { throw RepositoryError.notFound }; record.archivedAt = date; record.updatedAt = date; try saveOrRollback()
    }
    public nonisolated static func normalizeExerciseName(_ value: String) -> String {
        value.folding(options: [.caseInsensitive, .diacriticInsensitive], locale: .current).lowercased().split(whereSeparator: { !$0.isLetter && !$0.isNumber }).joined(separator: " ")
    }

    public func workout(on day: LocalDay) async throws -> ScheduledWorkout? {
        let key = day.iso8601
        let records = try context.fetch(FetchDescriptor<ScheduledWorkoutRecord>(predicate: #Predicate { $0.localDay == key }))
        guard records.count <= 1 else {
            assertionFailure("More than one scheduled workout exists for \(key)")
            throw RepositoryError.workoutDayConflict(day)
        }
        return try records.first.map { try WorkoutMapper.domain(from: $0) }
    }
    public func workouts(from startDay: LocalDay, through endDay: LocalDay) async throws -> [ScheduledWorkout] {
        let lower = startDay.iso8601, upper = endDay.iso8601
        let descriptor = FetchDescriptor<ScheduledWorkoutRecord>(
            predicate: #Predicate { $0.localDay >= lower && $0.localDay <= upper },
            sortBy: [SortDescriptor(\.localDay)]
        )
        let workouts = try context.fetch(descriptor).map { try WorkoutMapper.domain(from: $0) }
        let duplicate = Dictionary(grouping: workouts, by: \.day).first { $0.value.count > 1 }
        if let duplicate {
            assertionFailure("More than one scheduled workout exists for \(duplicate.key)")
            throw RepositoryError.workoutDayConflict(duplicate.key)
        }
        return workouts
    }
    public func workout(id: ScheduledWorkoutID) async throws -> ScheduledWorkout? {
        let key = id.rawValue
        var descriptor = FetchDescriptor<ScheduledWorkoutRecord>(predicate: #Predicate { $0.id == key })
        descriptor.fetchLimit = 1
        return try context.fetch(descriptor).first.map { try WorkoutMapper.domain(from: $0) }
    }
    public func allWorkouts() async throws -> [ScheduledWorkout] {
        try context.fetch(FetchDescriptor<ScheduledWorkoutRecord>()).map { try WorkoutMapper.domain(from: $0) }.sorted { $0.day < $1.day }
    }
    public func schedule(_ workout: ScheduledWorkout) async throws {
        try DomainValidator.validate(workout)
        guard try await self.workout(on: workout.day) == nil else { throw RepositoryError.workoutDayConflict(workout.day) }
        guard try await self.workout(id: workout.id) == nil else { throw RepositoryError.duplicateIdentifier }
        context.insert(WorkoutMapper.record(from: workout))
        do { try context.save() } catch { context.rollback(); throw error }
    }
    public func update(_ workout: ScheduledWorkout) async throws {
        try DomainValidator.validate(workout)
        let key = workout.id.rawValue
        var descriptor = FetchDescriptor<ScheduledWorkoutRecord>(predicate: #Predicate { $0.id == key }); descriptor.fetchLimit = 1
        guard let existing = try context.fetch(descriptor).first else { throw RepositoryError.notFound }
        let dayKey = workout.day.iso8601
        let conflicts = try context.fetch(FetchDescriptor<ScheduledWorkoutRecord>(predicate: #Predicate { $0.localDay == dayKey && $0.id != key }))
        guard conflicts.isEmpty else { throw RepositoryError.workoutDayConflict(workout.day) }
        if existing.statusRaw == WorkoutStatus.completed.rawValue { throw RepositoryError.immutableCompletedWorkout }
        existing.localDay = dayKey; existing.titleSnapshot = workout.titleSnapshot; existing.templateID = workout.templateID?.rawValue; existing.planID = workout.planID?.rawValue
        existing.sourceRaw = workout.source.rawValue; existing.statusRaw = workout.status.rawValue; existing.startedAt = workout.startedAt; existing.completedAt = workout.completedAt; existing.updatedAt = workout.updatedAt
        for child in existing.exercises { context.delete(child) }
        let replacement = WorkoutMapper.record(from: workout)
        existing.exercises = replacement.exercises
        do { try context.save() } catch { context.rollback(); throw error }
    }

    public func startWorkout(id: ScheduledWorkoutID, at date: Date = .now) async throws -> ScheduledWorkout {
        guard var workout = try await workout(id: id) else { throw RepositoryError.notFound }
        if workout.status == .completed { throw RepositoryError.immutableCompletedWorkout }
        if workout.status == .inProgress { return workout }
        workout.status = .inProgress
        workout.startedAt = date
        workout.updatedAt = date
        try await update(workout)
        return workout
    }

    public func logSet(workoutID: ScheduledWorkoutID, exerciseID: ScheduledExerciseID, prescriptionID: SetID, input: SetLogInput, completed: Bool, at date: Date = .now) async throws -> ScheduledWorkout {
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
        case (.duration, .duration(let seconds)) where seconds.isFinite && seconds > 0:
            values = (nil, nil, seconds)
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
        workout.updatedAt = date
        try await update(workout)
        return workout
    }

    public func completeWorkout(id: ScheduledWorkoutID, at date: Date = .now) async throws -> ScheduledWorkout {
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
    public func materializeAtomically(_ workouts: [ScheduledWorkout]) async throws {
        let days = workouts.map(\.day)
        guard Set(days).count == days.count else { throw RepositoryError.workoutDayConflict(days.first!) }
        for workout in workouts {
            try DomainValidator.validate(workout)
            if try await self.workout(on: workout.day) != nil { throw RepositoryError.workoutDayConflict(workout.day) }
        }
        for workout in workouts { context.insert(WorkoutMapper.record(from: workout)) }
        do { try context.save() } catch { context.rollback(); throw error }
    }
    public func replaceScheduledWorkout(_ workout: ScheduledWorkout) async throws {
        try DomainValidator.validate(workout)
        let day = workout.day.iso8601
        let matches = try context.fetch(FetchDescriptor<ScheduledWorkoutRecord>(predicate: #Predicate { $0.localDay == day }))
        guard matches.count <= 1 else { throw RepositoryError.workoutDayConflict(workout.day) }
        if let existing = matches.first {
            guard existing.statusRaw != WorkoutStatus.completed.rawValue else { throw RepositoryError.immutableCompletedWorkout }
            context.delete(existing)
        }
        context.insert(WorkoutMapper.record(from: workout)); try saveOrRollback()
    }

    public func exportBackup(exportedAt: Date, sourceDeviceID: String) async throws -> EquilibriumBackupV1 {
        let stored = try loadCollection()
        return try EquilibriumBackupV1(exportedAt: exportedAt, sourceDeviceID: sourceDeviceID, exercises: try await allExercises(), workoutTemplates: try await allTemplates(), scheduledWorkouts: try await allWorkouts(), cyclePlans: stored?.cyclePlans ?? [], settings: stored?.settings ?? .init(weightUnit: .pounds, defaultRestDuration: 90), progression: stored?.progression ?? FixtureDefaults.progression)
    }
    public func restoreBackup(_ backup: EquilibriumBackupV1) async throws {
        guard backup.schemaVersion == 1 else { throw BackupError.unsupportedSchemaVersion(backup.schemaVersion) }
        guard try await allWorkouts().isEmpty, try await allExercises().isEmpty, try await allTemplates().isEmpty else { throw RepositoryError.invalidBackup }
        let days = backup.scheduledWorkouts.map(\.day)
        guard Set(days).count == days.count else { throw RepositoryError.workoutDayConflict(days.first!) }
        let exerciseIDs = backup.scheduledWorkouts.flatMap(\.exercises).map(\.id)
        let prescriptionIDs = backup.scheduledWorkouts.flatMap(\.exercises).flatMap(\.prescriptions).map(\.id)
        let loggedSetIDs = backup.scheduledWorkouts.flatMap(\.exercises).flatMap(\.loggedSets).map(\.id)
        guard Set(exerciseIDs).count == exerciseIDs.count, Set(prescriptionIDs).count == prescriptionIDs.count, Set(loggedSetIDs).count == loggedSetIDs.count else { throw RepositoryError.duplicateIdentifier }
        for workout in backup.scheduledWorkouts { try DomainValidator.validate(workout) }
        for exercise in backup.exercises { context.insert(DefinitionMapper.record(from: exercise)) }
        for template in backup.workoutTemplates { context.insert(DefinitionMapper.record(from: template)) }
        for workout in backup.scheduledWorkouts { context.insert(WorkoutMapper.record(from: workout)) }
        let metadata = try BackupCodec.encode(backup)
        context.insert(BackupCollectionRecord(payload: metadata))
        do { try context.save() } catch { context.rollback(); throw error }
    }
    private func loadCollection() throws -> EquilibriumBackupV1? {
        guard let record = try context.fetch(FetchDescriptor<BackupCollectionRecord>()).first else { return nil }
        return try BackupCodec.decode(record.payload)
    }
    private func saveOrRollback() throws { do { try context.save() } catch { context.rollback(); throw error } }
}

enum FixtureDefaults {
    static let progression = ProgressionConfiguration(isEnabled: true, defaults: .init(repetitionRange: 8...12, weightIncrement: .init(pounds: 5), mode: .doubleProgression), groups: [], overrides: [])
}
