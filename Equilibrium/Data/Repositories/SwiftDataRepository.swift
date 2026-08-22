import Foundation
import SwiftData

@MainActor
public final class SwiftDataRepository: ScheduledWorkoutRepository, BackupRepository {
    private let context: ModelContext
    public init(container: ModelContainer) { context = ModelContext(container); context.autosaveEnabled = false }

    public func workout(on day: LocalDay) async throws -> ScheduledWorkout? {
        let key = day.iso8601
        var descriptor = FetchDescriptor<ScheduledWorkoutRecord>(predicate: #Predicate { $0.localDay == key })
        descriptor.fetchLimit = 1
        return try context.fetch(descriptor).first.map { try WorkoutMapper.domain(from: $0) }
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
        if existing.statusRaw == WorkoutStatus.completed.rawValue && workout.status != .completed { throw RepositoryError.immutableCompletedWorkout }
        existing.localDay = dayKey; existing.titleSnapshot = workout.titleSnapshot; existing.templateID = workout.templateID?.rawValue; existing.planID = workout.planID?.rawValue
        existing.sourceRaw = workout.source.rawValue; existing.statusRaw = workout.status.rawValue; existing.startedAt = workout.startedAt; existing.completedAt = workout.completedAt; existing.updatedAt = workout.updatedAt
        for child in existing.exercises { context.delete(child) }
        let replacement = WorkoutMapper.record(from: workout)
        existing.exercises = replacement.exercises
        do { try context.save() } catch { context.rollback(); throw error }
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

    public func exportBackup(exportedAt: Date, sourceDeviceID: String) async throws -> EquilibriumBackupV1 {
        let stored = try loadCollection()
        return try EquilibriumBackupV1(exportedAt: exportedAt, sourceDeviceID: sourceDeviceID, exercises: stored?.exercises ?? [], workoutTemplates: stored?.workoutTemplates ?? [], scheduledWorkouts: try await allWorkouts(), cyclePlans: stored?.cyclePlans ?? [], settings: stored?.settings ?? .init(weightUnit: .pounds, defaultRestDuration: 90), progression: stored?.progression ?? FixtureDefaults.progression)
    }
    public func restoreBackup(_ backup: EquilibriumBackupV1) async throws {
        guard backup.schemaVersion == 1 else { throw BackupError.unsupportedSchemaVersion(backup.schemaVersion) }
        guard try await allWorkouts().isEmpty else { throw RepositoryError.invalidBackup }
        let days = backup.scheduledWorkouts.map(\.day)
        guard Set(days).count == days.count else { throw RepositoryError.workoutDayConflict(days.first!) }
        let exerciseIDs = backup.scheduledWorkouts.flatMap(\.exercises).map(\.id)
        let prescriptionIDs = backup.scheduledWorkouts.flatMap(\.exercises).flatMap(\.prescriptions).map(\.id)
        let loggedSetIDs = backup.scheduledWorkouts.flatMap(\.exercises).flatMap(\.loggedSets).map(\.id)
        guard Set(exerciseIDs).count == exerciseIDs.count, Set(prescriptionIDs).count == prescriptionIDs.count, Set(loggedSetIDs).count == loggedSetIDs.count else { throw RepositoryError.duplicateIdentifier }
        for workout in backup.scheduledWorkouts { try DomainValidator.validate(workout) }
        for workout in backup.scheduledWorkouts { context.insert(WorkoutMapper.record(from: workout)) }
        let metadata = try BackupCodec.encode(backup)
        context.insert(BackupCollectionRecord(payload: metadata))
        do { try context.save() } catch { context.rollback(); throw error }
    }
    private func loadCollection() throws -> EquilibriumBackupV1? {
        guard let record = try context.fetch(FetchDescriptor<BackupCollectionRecord>()).first else { return nil }
        return try BackupCodec.decode(record.payload)
    }
}

enum FixtureDefaults {
    static let progression = ProgressionConfiguration(isEnabled: true, defaults: .init(repetitionRange: 8...12, weightIncrement: .init(pounds: 5), mode: .doubleProgression), groups: [], overrides: [])
}
