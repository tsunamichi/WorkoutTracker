import Foundation
import SwiftData

@MainActor
public final class SwiftDataRepository: ExerciseRepository, WorkoutRepository, ExerciseHistoryRepository, SettingsRepository, ProgressionRepository, BackupRepository {
    let context: ModelContext
    public init(container: ModelContainer) { context = ModelContext(container); context.autosaveEnabled = false }

    // MARK: Exercise definitions

    public func allExercises() async throws -> [ExerciseDefinition] { try canonicalExerciseRecords(includeArchived: false).map(DefinitionMapper.domain) }
    private func allPersistedExercises() throws -> [ExerciseDefinition] { try canonicalExerciseRecords(includeArchived: true).map(DefinitionMapper.domain) }
    private func canonicalExerciseRecords(includeArchived: Bool) throws -> [ExerciseDefinitionRecord] {
        let records = try context.fetch(FetchDescriptor<ExerciseDefinitionRecord>())
        return canonical(records, key: \ExerciseDefinitionRecord.id, updatedAt: \ExerciseDefinitionRecord.updatedAt)
            .filter { includeArchived || $0.archivedAt == nil }
            .sorted { $0.name == $1.name ? $0.id < $1.id : $0.name < $1.name }
    }
    public func searchExercises(_ query: String) async throws -> [ExerciseDefinition] {
        let needle = Self.normalizeExerciseName(query)
        guard !needle.isEmpty else { return try await allExercises() }
        return try await allExercises().filter { $0.normalizedName.contains(needle) || $0.aliases.contains { Self.normalizeExerciseName($0).contains(needle) } }
    }
    public func latestExerciseLog(exerciseID: ExerciseID) async throws -> LatestExerciseLog? {
        guard let occurrence = try await exercisePerformance(exerciseID: exerciseID).latestOccurrence else { return nil }
        return .init(exerciseID: exerciseID, workoutID: occurrence.workoutID, occurredAt: occurrence.occurredAt, sets: occurrence.sets)
    }
    public func exercisePerformance(exerciseID: ExerciseID) async throws -> ExercisePerformance {
        ExercisePerformanceQuery.performance(exerciseID: exerciseID, workouts: try await allWorkouts())
    }
    public func exercise(id: ExerciseID) async throws -> ExerciseDefinition? {
        winner(try exerciseRecords(id.rawValue), updatedAt: \ExerciseDefinitionRecord.updatedAt).map(DefinitionMapper.domain)
    }
    public func saveExercise(_ exercise: ExerciseDefinition) async throws {
        let normalized = Self.normalizeExerciseName(exercise.name)
        guard !normalized.isEmpty else { throw RepositoryError.invalidBackup }
        let records = try canonicalExerciseRecords(includeArchived: true)
        if records.contains(where: { $0.id != exercise.id.rawValue && ($0.normalizedName == normalized || $0.aliases.contains(where: { Self.normalizeExerciseName($0) == normalized })) }) { throw RepositoryError.duplicateExerciseName }
        if let existing = winner(try exerciseRecords(exercise.id.rawValue), updatedAt: \ExerciseDefinitionRecord.updatedAt) {
            existing.name = exercise.name; existing.normalizedName = normalized; existing.aliases = exercise.aliases
            existing.equipment = exercise.equipment; existing.category = exercise.category; existing.isCustom = exercise.isCustom; existing.archivedAt = exercise.archivedAt; existing.updatedAt = .now
        } else { var value = exercise; value.normalizedName = normalized; context.insert(DefinitionMapper.record(from: value)) }
        try saveOrRollback()
    }
    public func archiveExercise(id: ExerciseID, at date: Date) async throws {
        guard let record = winner(try exerciseRecords(id.rawValue), updatedAt: \ExerciseDefinitionRecord.updatedAt) else { throw RepositoryError.notFound }
        record.archivedAt = date; record.updatedAt = date; try saveOrRollback()
    }
    private func exerciseRecords(_ id: String) throws -> [ExerciseDefinitionRecord] {
        try context.fetch(FetchDescriptor<ExerciseDefinitionRecord>(predicate: #Predicate { $0.id == id }))
    }
    public nonisolated static func normalizeExerciseName(_ value: String) -> String {
        value.folding(options: [.caseInsensitive, .diacriticInsensitive], locale: .current).lowercased().split(whereSeparator: { !$0.isLetter && !$0.isNumber }).joined(separator: " ")
    }

    // MARK: Workouts

    public func activeWorkouts() async throws -> [Workout] { try canonicalWorkouts().filter { $0.status != .completed } }
    public func workout(id: WorkoutID) async throws -> Workout? {
        guard let record = winner(try workoutRecords(id.rawValue), updatedAt: \WorkoutRecord.updatedAt) else { return nil }
        return try WorkoutMapper.domain(from: record)
    }
    public func allWorkouts() async throws -> [Workout] { try canonicalWorkouts() }
    private func canonicalWorkouts() throws -> [Workout] {
        let records = try context.fetch(FetchDescriptor<WorkoutRecord>())
        return try canonical(records, key: \WorkoutRecord.id, updatedAt: \WorkoutRecord.updatedAt)
            .map(WorkoutMapper.domain)
            .sorted { $0.createdAt == $1.createdAt ? $0.id.rawValue < $1.id.rawValue : $0.createdAt < $1.createdAt }
    }
    private func workoutRecords(_ id: String) throws -> [WorkoutRecord] {
        try context.fetch(FetchDescriptor<WorkoutRecord>(predicate: #Predicate { $0.id == id }))
    }
    public func create(_ workout: Workout) async throws {
        try DomainValidator.validate(workout)
        guard try await self.workout(id: workout.id) == nil else { throw RepositoryError.duplicateIdentifier }
        context.insert(WorkoutMapper.record(from: workout)); try saveOrRollback()
    }
    public func update(_ workout: Workout) async throws {
        try DomainValidator.validate(workout)
        guard let existing = winner(try workoutRecords(workout.id.rawValue), updatedAt: \WorkoutRecord.updatedAt) else { throw RepositoryError.notFound }
        if existing.statusRaw == WorkoutStatus.completed.rawValue { throw RepositoryError.immutableCompletedWorkout }
        apply(workout, to: existing); try saveOrRollback()
    }
    public func materializeAtomically(_ workouts: [Workout]) async throws {
        let ids = workouts.map(\.id)
        guard Set(ids).count == ids.count else { throw RepositoryError.duplicateIdentifier }
        for workout in workouts { try DomainValidator.validate(workout); if try await self.workout(id: workout.id) != nil { throw RepositoryError.duplicateIdentifier } }
        for workout in workouts { context.insert(WorkoutMapper.record(from: workout)) }
        try saveOrRollback()
    }
    public func startWorkout(id: WorkoutID, at date: Date = .now) async throws -> Workout {
        guard let record = winner(try workoutRecords(id.rawValue), updatedAt: \WorkoutRecord.updatedAt) else { throw RepositoryError.notFound }
        if record.statusRaw == WorkoutStatus.completed.rawValue { throw RepositoryError.immutableCompletedWorkout }
        if record.statusRaw != WorkoutStatus.inProgress.rawValue { record.statusRaw = WorkoutStatus.inProgress.rawValue; record.startedAt = date; record.updatedAt = date; try saveOrRollback() }
        return try WorkoutMapper.domain(from: record)
    }
    public func logSet(workoutID: WorkoutID, exerciseID: WorkoutExerciseID, prescriptionID: SetID, input: SetLogInput, completed: Bool, at date: Date = .now) async throws -> Workout {
        let (workout, exercise) = try mutableExercise(workoutID, exerciseID)
        guard workout.statusRaw == WorkoutStatus.inProgress.rawValue else { throw workout.statusRaw == WorkoutStatus.completed.rawValue ? RepositoryError.immutableCompletedWorkout : RepositoryError.workoutNotInProgress }
        guard let prescription = childWinner(exercise.prescriptions ?? [], id: prescriptionID.rawValue, idPath: \PrescriptionRecord.id, updatedAt: \PrescriptionRecord.updatedAt) else { throw RepositoryError.prescriptionNotFound }
        let values = try validatedValues(targetKind: prescription.targetKind, input: input)
        if let logged = (exercise.loggedSets ?? []).filter({ $0.prescriptionID == prescriptionID.rawValue }).max(by: { $0.updatedAt < $1.updatedAt }) {
            logged.pounds = values.0; logged.repetitions = values.1; logged.duration = values.2; logged.completedAt = completed ? date : nil; logged.updatedAt = date
        } else {
            let nextPosition = ((exercise.loggedSets ?? []).map(\.position).max() ?? -1) + 1
            let logged = LoggedSetRecord(id: "logged-\(UUID().uuidString.lowercased())", prescriptionID: prescriptionID.rawValue, position: nextPosition, pounds: values.0, repetitions: values.1, duration: values.2, completedAt: completed ? date : nil, updatedAt: date)
            exercise.loggedSets = (exercise.loggedSets ?? []) + [logged]
        }
        let ordered = (exercise.prescriptions ?? []).sorted { $0.position < $1.position }
        if let current = ordered.firstIndex(where: { $0.id == prescriptionID.rawValue }) {
            for next in ordered.dropFirst(current + 1) {
                if (exercise.loggedSets ?? []).contains(where: { $0.prescriptionID == next.id }) { break }
                apply(input, to: next); next.updatedAt = date
            }
        }
        exercise.updatedAt = date; workout.updatedAt = date; try saveOrRollback(); return try WorkoutMapper.domain(from: workout)
    }
    public func appendSet(workoutID: WorkoutID, exerciseID: WorkoutExerciseID, seed: SetLogInput? = nil, at date: Date = .now) async throws -> Workout {
        let (workout, exercise) = try mutableExercise(workoutID, exerciseID)
        guard workout.statusRaw == WorkoutStatus.inProgress.rawValue else { throw workout.statusRaw == WorkoutStatus.completed.rawValue ? RepositoryError.immutableCompletedWorkout : RepositoryError.workoutNotInProgress }
        let existing = (exercise.prescriptions ?? []).sorted { $0.position < $1.position }
        let record: PrescriptionRecord
        if let seed { record = prescriptionRecord(id: SetID.new().rawValue, position: existing.count, input: seed, at: date) }
        else if let previous = existing.last {
            record = PrescriptionRecord(id: SetID.new().rawValue, position: existing.count, targetKind: previous.targetKind, lowerRepetitions: previous.lowerRepetitions, upperRepetitions: previous.upperRepetitions, duration: previous.duration, suggestedPounds: previous.suggestedPounds, updatedAt: date)
            if let log = (exercise.loggedSets ?? []).filter({ $0.prescriptionID == previous.id }).max(by: { $0.updatedAt < $1.updatedAt }) {
                if let duration = log.duration { record.targetKind = "duration"; record.duration = duration; record.lowerRepetitions = nil; record.upperRepetitions = nil }
                else if let repetitions = log.repetitions { record.targetKind = "repetitions"; record.lowerRepetitions = repetitions; record.upperRepetitions = repetitions; record.duration = nil }
                record.suggestedPounds = log.pounds
            }
        } else { record = PrescriptionRecord(id: SetID.new().rawValue, position: 0, targetKind: "repetitions", lowerRepetitions: 1, upperRepetitions: 1, duration: nil, suggestedPounds: nil, updatedAt: date) }
        exercise.prescriptions = existing + [record]; exercise.updatedAt = date; workout.updatedAt = date
        try saveOrRollback(); return try WorkoutMapper.domain(from: workout)
    }
    public func removeSet(workoutID: WorkoutID, exerciseID: WorkoutExerciseID, prescriptionID: SetID, at date: Date = .now) async throws -> Workout {
        let (workout, exercise) = try mutableExercise(workoutID, exerciseID)
        guard workout.statusRaw == WorkoutStatus.inProgress.rawValue else { throw workout.statusRaw == WorkoutStatus.completed.rawValue ? RepositoryError.immutableCompletedWorkout : RepositoryError.workoutNotInProgress }
        guard let target = childWinner(exercise.prescriptions ?? [], id: prescriptionID.rawValue, idPath: \PrescriptionRecord.id, updatedAt: \PrescriptionRecord.updatedAt) else { throw RepositoryError.prescriptionNotFound }
        guard !(exercise.loggedSets ?? []).contains(where: { $0.prescriptionID == prescriptionID.rawValue && $0.completedAt != nil }) else { throw RepositoryError.cannotRemoveCompletedSet }
        for log in (exercise.loggedSets ?? []).filter({ $0.prescriptionID == prescriptionID.rawValue }) { context.delete(log) }
        context.delete(target)
        for (position, record) in (exercise.prescriptions ?? []).filter({ $0 !== target }).sorted(by: { $0.position < $1.position }).enumerated() { record.position = position }
        exercise.updatedAt = date; workout.updatedAt = date; try saveOrRollback(); return try WorkoutMapper.domain(from: workout)
    }
    public func completeWorkout(id: WorkoutID, at date: Date = .now) async throws -> Workout {
        guard let current = try await workout(id: id) else { throw RepositoryError.notFound }
        if current.status == .completed { return current }
        guard current.status == .inProgress else { throw RepositoryError.workoutNotInProgress }
        guard WorkoutExecutionQuery.canComplete(current) else { throw RepositoryError.incompleteWorkout }
        guard let record = winner(try workoutRecords(id.rawValue), updatedAt: \WorkoutRecord.updatedAt) else { throw RepositoryError.notFound }
        record.statusRaw = WorkoutStatus.completed.rawValue; record.completedAt = date; record.updatedAt = date; try saveOrRollback(); return try WorkoutMapper.domain(from: record)
    }
    public func resetWorkout(id: WorkoutID, at date: Date = .now) async throws -> Workout {
        guard let record = winner(try workoutRecords(id.rawValue), updatedAt: \WorkoutRecord.updatedAt) else { throw RepositoryError.notFound }
        guard record.statusRaw == WorkoutStatus.inProgress.rawValue else { throw record.statusRaw == WorkoutStatus.completed.rawValue ? RepositoryError.immutableCompletedWorkout : RepositoryError.workoutNotInProgress }
        for exercise in record.exercises ?? [] { for log in exercise.loggedSets ?? [] { context.delete(log) }; exercise.loggedSets = []; exercise.skippedAt = nil; exercise.updatedAt = date }
        record.updatedAt = date; try saveOrRollback(); return try WorkoutMapper.domain(from: record)
    }
    public func deleteWorkout(id: WorkoutID) async throws {
        guard let record = winner(try workoutRecords(id.rawValue), updatedAt: \WorkoutRecord.updatedAt) else { throw RepositoryError.notFound }
        guard record.statusRaw != WorkoutStatus.completed.rawValue else { throw RepositoryError.immutableCompletedWorkout }
        context.delete(record); try saveOrRollback()
    }
    public func setRestDuration(workoutID: WorkoutID, exerciseID: WorkoutExerciseID, seconds: TimeInterval, at date: Date = .now) async throws -> Workout {
        guard Self.isValidRestDuration(seconds) else { throw RepositoryError.invalidRestDuration }
        let (workout, exercise) = try mutableExercise(workoutID, exerciseID)
        guard workout.statusRaw == WorkoutStatus.inProgress.rawValue else { throw workout.statusRaw == WorkoutStatus.completed.rawValue ? RepositoryError.immutableCompletedWorkout : RepositoryError.workoutNotInProgress }
        exercise.restDuration = seconds; exercise.updatedAt = date; workout.updatedAt = date; try saveOrRollback(); return try WorkoutMapper.domain(from: workout)
    }
    public func editCompletedSet(workoutID: WorkoutID, exerciseID: WorkoutExerciseID, prescriptionID: SetID, input: SetLogInput, at date: Date = .now) async throws -> Workout {
        let (workout, exercise) = try mutableExercise(workoutID, exerciseID)
        guard workout.statusRaw == WorkoutStatus.completed.rawValue else { throw RepositoryError.workoutNotInProgress }
        guard let prescription = childWinner(exercise.prescriptions ?? [], id: prescriptionID.rawValue, idPath: \PrescriptionRecord.id, updatedAt: \PrescriptionRecord.updatedAt),
              let logged = (exercise.loggedSets ?? []).filter({ $0.prescriptionID == prescriptionID.rawValue && $0.completedAt != nil }).max(by: { $0.updatedAt < $1.updatedAt }) else { throw RepositoryError.prescriptionNotFound }
        let values = try validatedValues(targetKind: prescription.targetKind, input: input)
        logged.pounds = values.0; logged.repetitions = values.1; logged.duration = values.2; logged.updatedAt = date
        exercise.updatedAt = date; workout.updatedAt = date; try saveOrRollback(); return try WorkoutMapper.domain(from: workout)
    }

    // MARK: Settings and progression

    public func settings() async throws -> AppSettings {
        let legacy = try legacyConfiguration()?.settings
        let unit = try setting(key: SettingKey.weightUnit).flatMap { WeightUnit(rawValue: $0.value) } ?? legacy?.weightUnit ?? .pounds
        let rest = try setting(key: SettingKey.defaultRestDuration).flatMap { Double($0.value) } ?? legacy?.defaultRestDuration ?? 90
        return .init(weightUnit: unit, defaultRestDuration: rest)
    }
    public func saveSettings(_ settings: AppSettings) async throws {
        guard Self.isValidRestDuration(settings.defaultRestDuration) else { throw RepositoryError.invalidSettings }
        let now = Date.now
        try setSetting(key: SettingKey.weightUnit, value: settings.weightUnit.rawValue, at: now)
        try setSetting(key: SettingKey.defaultRestDuration, value: String(settings.defaultRestDuration), at: now)
        try saveOrRollback()
        NotificationCenter.default.post(name: .equilibriumSettingsDidChange, object: nil)
    }
    public func progressionConfiguration() async throws -> ProgressionConfiguration {
        let legacy = try legacyConfiguration()?.progression
        let enabled = try setting(key: SettingKey.progressionEnabled).map { $0.value == "true" } ?? legacy?.isEnabled ?? true
        let records = try context.fetch(FetchDescriptor<ProgressionAssignmentRecord>())
        let assignments = Dictionary(uniqueKeysWithValues: canonical(records, key: \ProgressionAssignmentRecord.exerciseID, updatedAt: \ProgressionAssignmentRecord.updatedAt).compactMap { record in
            AutoProgressionProfile(rawValue: record.profileRaw).map { (ExerciseID(rawValue: record.exerciseID), $0) }
        })
        return .init(isEnabled: enabled, defaults: FixtureDefaults.progression.defaults, groups: [], overrides: [], assignments: assignments.isEmpty ? (legacy?.assignments ?? [:]) : assignments)
    }
    public func saveProgressionConfiguration(_ configuration: ProgressionConfiguration) async throws {
        guard ProgressionValidator.isValid(configuration) else { throw RepositoryError.invalidProgressionConfiguration }
        let now = Date.now
        try setSetting(key: SettingKey.progressionEnabled, value: configuration.isEnabled ? "true" : "false", at: now)
        let existing = try context.fetch(FetchDescriptor<ProgressionAssignmentRecord>())
        for (exerciseID, profile) in configuration.assignments {
            if let record = winner(existing.filter { $0.exerciseID == exerciseID.rawValue }, updatedAt: \ProgressionAssignmentRecord.updatedAt) { record.profileRaw = profile.rawValue; record.updatedAt = now }
            else { context.insert(ProgressionAssignmentRecord(exerciseID: exerciseID.rawValue, profileRaw: profile.rawValue, updatedAt: now)) }
        }
        for record in existing where configuration.assignments[ExerciseID(rawValue: record.exerciseID)] == nil { context.delete(record) }
        try saveOrRollback()
    }

    // MARK: Backup

    public func exportBackup(exportedAt: Date, sourceDeviceID: String) async throws -> EquilibriumBackupV2 {
        try EquilibriumBackupV2(exportedAt: exportedAt, sourceDeviceID: sourceDeviceID, exercises: allPersistedExercises(), workouts: try await allWorkouts(), settings: try await settings(), progression: try await progressionConfiguration(), timers: try timerConfigurations())
    }
    public func restoreBackup(_ backup: EquilibriumBackupV2) async throws {
        guard backup.schemaVersion == 2 else { throw BackupError.unsupportedSchemaVersion(backup.schemaVersion) }
        guard Self.isValidRestDuration(backup.settings.defaultRestDuration), ProgressionValidator.isValid(backup.progression) else { throw RepositoryError.invalidBackup }
        guard try await allWorkouts().isEmpty, try allPersistedExercises().isEmpty else { throw RepositoryError.invalidBackup }
        let exerciseIDs = backup.workouts.flatMap(\.exercises).map(\.id), prescriptionIDs = backup.workouts.flatMap(\.exercises).flatMap(\.prescriptions).map(\.id), loggedSetIDs = backup.workouts.flatMap(\.exercises).flatMap(\.loggedSets).map(\.id)
        guard Set(exerciseIDs).count == exerciseIDs.count, Set(prescriptionIDs).count == prescriptionIDs.count, Set(loggedSetIDs).count == loggedSetIDs.count else { throw RepositoryError.duplicateIdentifier }
        for workout in backup.workouts { try DomainValidator.validate(workout) }
        for exercise in backup.exercises { context.insert(DefinitionMapper.record(from: exercise)) }
        for workout in backup.workouts { context.insert(WorkoutMapper.record(from: workout)) }
        context.insert(BackupCollectionRecord(payload: try BackupCodec.encode(backup), updatedAt: backup.exportedAt))
        try setSetting(key: SettingKey.weightUnit, value: backup.settings.weightUnit.rawValue, at: backup.exportedAt)
        try setSetting(key: SettingKey.defaultRestDuration, value: String(backup.settings.defaultRestDuration), at: backup.exportedAt)
        try setSetting(key: SettingKey.progressionEnabled, value: backup.progression.isEnabled ? "true" : "false", at: backup.exportedAt)
        for (id, profile) in backup.progression.assignments { context.insert(ProgressionAssignmentRecord(exerciseID: id.rawValue, profileRaw: profile.rawValue, updatedAt: backup.exportedAt)) }
        for timer in backup.timers { context.insert(timerRecord(timer)) }
        try saveOrRollback()
    }

    func importLegacyRN(_ value: LegacyImportMaterialization, importedAt: Date = .now) throws -> LegacyImportResult {
        let sourceDigest = value.sourceDigest
        let receiptDescriptor = FetchDescriptor<LegacyImportReceiptRecord>(predicate: #Predicate { $0.sourceDigest == sourceDigest })
        if try !context.fetch(receiptDescriptor).isEmpty { throw RNLegacyImportError.alreadyImported }
        for workout in value.workouts { try DomainValidator.validate(workout) }
        if let settings = value.settings, !Self.isValidRestDuration(settings.defaultRestDuration) { throw RepositoryError.invalidSettings }
        if let progression = value.progression, !ProgressionValidator.isValid(progression) { throw RepositoryError.invalidProgressionConfiguration }

        let existingExerciseIDs = Set(try context.fetch(FetchDescriptor<ExerciseDefinitionRecord>()).map(\.id))
        let existingWorkoutIDs = Set(try context.fetch(FetchDescriptor<WorkoutRecord>()).map(\.id))
        let existingTimerIDs = Set(try context.fetch(FetchDescriptor<StandaloneTimerConfigurationRecord>()).map(\.id))
        let exercises = value.exercises.filter { !existingExerciseIDs.contains($0.id.rawValue) }
        let workouts = value.workouts.filter { !existingWorkoutIDs.contains($0.id.rawValue) }
        let timers = value.timers.filter { !existingTimerIDs.contains($0.id) }
        for exercise in exercises { context.insert(DefinitionMapper.record(from: exercise)) }
        for workout in workouts { context.insert(WorkoutMapper.record(from: workout)) }
        for timer in timers { context.insert(timerRecord(timer)) }
        if let settings = value.settings {
            context.insert(SettingValueRecord(key: SettingKey.weightUnit, value: settings.weightUnit.rawValue, updatedAt: importedAt))
            context.insert(SettingValueRecord(key: SettingKey.defaultRestDuration, value: String(settings.defaultRestDuration), updatedAt: importedAt))
        }
        if let progression = value.progression {
            context.insert(SettingValueRecord(key: SettingKey.progressionEnabled, value: progression.isEnabled ? "true" : "false", updatedAt: importedAt))
            for (id, profile) in progression.assignments { context.insert(ProgressionAssignmentRecord(exerciseID: id.rawValue, profileRaw: profile.rawValue, updatedAt: importedAt)) }
        }
        let receipt = LegacyImportReceiptRecord(sourceKind: "react-native-async-storage-v2", sourceDigest: value.sourceDigest, importedAt: importedAt, workoutCount: workouts.count, exerciseCount: exercises.count, timerCount: timers.count)
        context.insert(receipt)
        do {
            try context.save()
            if value.settings != nil { NotificationCenter.default.post(name: .equilibriumSettingsDidChange, object: nil) }
            return .init(exercisesImported: exercises.count, workoutsImported: workouts.count, timersImported: timers.count, skippedMalformed: value.skippedMalformedCount)
        } catch { context.rollback(); throw error }
    }

    // MARK: Timers

    func timerConfigurations() throws -> [StandaloneTimerConfiguration] {
        let records = try context.fetch(FetchDescriptor<StandaloneTimerConfigurationRecord>())
        return canonical(records, key: \StandaloneTimerConfigurationRecord.id, updatedAt: \StandaloneTimerConfigurationRecord.updatedAt)
            .sorted { $0.createdAt == $1.createdAt ? $0.id < $1.id : $0.createdAt < $1.createdAt }.map(timerDomain)
    }
    func saveTimerConfiguration(_ value: StandaloneTimerConfiguration) throws {
        guard value.isValid else { return }
        let records = try context.fetch(FetchDescriptor<StandaloneTimerConfigurationRecord>(predicate: #Predicate { $0.id == value.id }))
        if let record = winner(records, updatedAt: \StandaloneTimerConfigurationRecord.updatedAt) {
            record.name = value.name; record.moveDuration = value.moveDuration; record.exerciseRestDuration = value.exerciseRestDuration
            record.exercisesPerRound = value.exercisesPerRound; record.rounds = value.rounds; record.roundRestDuration = value.roundRestDuration; record.updatedAt = value.updatedAt
        } else { context.insert(timerRecord(value)) }
        try saveOrRollback()
    }
    func deleteTimerConfiguration(id: String) throws {
        let records = try context.fetch(FetchDescriptor<StandaloneTimerConfigurationRecord>(predicate: #Predicate { $0.id == id }))
        for record in records { context.delete(record) }; try saveOrRollback()
    }

    // MARK: Fine-grained graph reconciliation

    private func apply(_ value: Workout, to record: WorkoutRecord) {
        record.titleSnapshot = value.titleSnapshot; record.statusRaw = value.status.rawValue; record.startedAt = value.startedAt; record.completedAt = value.completedAt; record.createdAt = value.createdAt; record.updatedAt = value.updatedAt
        var existing = record.exercises ?? []
        let wanted = Set(value.exercises.map { $0.id.rawValue })
        for child in existing where !wanted.contains(child.id) { context.delete(child) }
        existing.removeAll { !wanted.contains($0.id) }
        for (position, exercise) in value.exercises.enumerated() {
            let target: WorkoutExerciseRecord
            if let found = childWinner(existing, id: exercise.id.rawValue, idPath: \WorkoutExerciseRecord.id, updatedAt: \WorkoutExerciseRecord.updatedAt) { target = found }
            else { target = WorkoutExerciseRecord(id: exercise.id.rawValue, exerciseID: exercise.exerciseID.rawValue, nameSnapshot: exercise.nameSnapshot, position: position, restDuration: exercise.restDuration, skippedAt: exercise.skippedAt, isTimeBased: exercise.isTimeBased, isTwoSided: exercise.isTwoSided, updatedAt: value.updatedAt, prescriptions: [], loggedSets: []); existing.append(target) }
            target.exerciseID = exercise.exerciseID.rawValue; target.nameSnapshot = exercise.nameSnapshot; target.position = position; target.restDuration = exercise.restDuration; target.skippedAt = exercise.skippedAt; target.isTimeBased = exercise.isTimeBased; target.isTwoSided = exercise.isTwoSided; target.updatedAt = value.updatedAt
            reconcilePrescriptions(exercise.prescriptions, in: target, at: value.updatedAt); reconcileLogs(exercise.loggedSets, in: target, at: value.updatedAt)
        }
        record.exercises = existing
    }
    private func reconcilePrescriptions(_ values: [SetPrescription], in exercise: WorkoutExerciseRecord, at date: Date) {
        var records = exercise.prescriptions ?? []; let wanted = Set(values.map { $0.id.rawValue })
        for record in records where !wanted.contains(record.id) { context.delete(record) }; records.removeAll { !wanted.contains($0.id) }
        for (position, value) in values.enumerated() {
            let record = childWinner(records, id: value.id.rawValue, idPath: \PrescriptionRecord.id, updatedAt: \PrescriptionRecord.updatedAt) ?? { let item = PrescriptionRecord(id: value.id.rawValue, position: position, targetKind: "repetitions", lowerRepetitions: 1, upperRepetitions: 1, duration: nil, suggestedPounds: nil, updatedAt: date); records.append(item); return item }()
            apply(value, position: position, to: record); record.updatedAt = date
        }
        exercise.prescriptions = records
    }
    private func reconcileLogs(_ values: [LoggedSet], in exercise: WorkoutExerciseRecord, at date: Date) {
        var records = exercise.loggedSets ?? []; let wanted = Set(values.map { $0.id.rawValue })
        for record in records where !wanted.contains(record.id) { context.delete(record) }; records.removeAll { !wanted.contains($0.id) }
        for (position, value) in values.enumerated() {
            let record = childWinner(records, id: value.id.rawValue, idPath: \LoggedSetRecord.id, updatedAt: \LoggedSetRecord.updatedAt) ?? { let item = LoggedSetRecord(id: value.id.rawValue, prescriptionID: value.prescriptionID?.rawValue, position: position, pounds: value.weight?.pounds, repetitions: value.repetitions, duration: value.duration, completedAt: value.completedAt, updatedAt: date); records.append(item); return item }()
            record.prescriptionID = value.prescriptionID?.rawValue; record.position = position; record.pounds = value.weight?.pounds; record.repetitions = value.repetitions; record.duration = value.duration; record.completedAt = value.completedAt; record.updatedAt = date
        }
        exercise.loggedSets = records
    }

    // MARK: Helpers

    private enum SettingKey { static let weightUnit = "weight-unit"; static let defaultRestDuration = "default-rest-duration"; static let progressionEnabled = "progression-enabled" }
    private static let decoder = JSONDecoder()
    private func legacyConfiguration() throws -> (settings: AppSettings, progression: ProgressionConfiguration)? {
        guard let record = try context.fetch(FetchDescriptor<AppConfigurationRecord>()).sorted(by: { $0.key < $1.key }).first else { return nil }
        return (try Self.decoder.decode(AppSettings.self, from: record.settingsPayload), try Self.decoder.decode(ProgressionConfiguration.self, from: record.progressionPayload))
    }
    private func setting(key: String) throws -> SettingValueRecord? { winner(try context.fetch(FetchDescriptor<SettingValueRecord>(predicate: #Predicate { $0.key == key })), updatedAt: \SettingValueRecord.updatedAt) }
    private func setSetting(key: String, value: String, at date: Date) throws {
        if let record = try setting(key: key) { record.value = value; record.updatedAt = date }
        else { context.insert(SettingValueRecord(key: key, value: value, updatedAt: date)) }
    }
    private func mutableExercise(_ workoutID: WorkoutID, _ exerciseID: WorkoutExerciseID) throws -> (WorkoutRecord, WorkoutExerciseRecord) {
        guard let workout = winner(try workoutRecords(workoutID.rawValue), updatedAt: \WorkoutRecord.updatedAt) else { throw RepositoryError.notFound }
        guard let exercise = childWinner(workout.exercises ?? [], id: exerciseID.rawValue, idPath: \WorkoutExerciseRecord.id, updatedAt: \WorkoutExerciseRecord.updatedAt) else { throw RepositoryError.notFound }
        return (workout, exercise)
    }
    private func validatedValues(targetKind: String, input: SetLogInput) throws -> (Double?, Int?, Double?) {
        switch (targetKind, input) {
        case ("repetitions", .repetitions(let weight, let repetitions)) where repetitions > 0 && (weight?.pounds ?? 0) >= 0: return (weight?.pounds, repetitions, nil)
        case ("duration", .duration(let weight, let seconds)) where seconds.isFinite && seconds > 0 && (weight?.pounds ?? 0) >= 0: return (weight?.pounds, nil, seconds)
        default: throw RepositoryError.invalidSetInput
        }
    }
    private func apply(_ input: SetLogInput, to record: PrescriptionRecord) {
        switch input {
        case .repetitions(let weight, let repetitions): record.targetKind = "repetitions"; record.lowerRepetitions = repetitions; record.upperRepetitions = repetitions; record.duration = nil; record.suggestedPounds = weight?.pounds
        case .duration(let weight, let seconds): record.targetKind = "duration"; record.lowerRepetitions = nil; record.upperRepetitions = nil; record.duration = seconds; record.suggestedPounds = weight?.pounds
        }
    }
    private func apply(_ value: SetPrescription, position: Int, to record: PrescriptionRecord) {
        record.position = position; record.suggestedPounds = value.suggestedWeight?.pounds
        switch value.target { case .repetitions(let range): record.targetKind = "repetitions"; record.lowerRepetitions = range.lowerBound; record.upperRepetitions = range.upperBound; record.duration = nil
        case .duration(let seconds): record.targetKind = "duration"; record.lowerRepetitions = nil; record.upperRepetitions = nil; record.duration = seconds }
    }
    private func prescriptionRecord(id: String, position: Int, input: SetLogInput, at date: Date) -> PrescriptionRecord {
        let record = PrescriptionRecord(id: id, position: position, targetKind: "repetitions", lowerRepetitions: 1, upperRepetitions: 1, duration: nil, suggestedPounds: nil, updatedAt: date); apply(input, to: record); return record
    }
    private func timerRecord(_ value: StandaloneTimerConfiguration) -> StandaloneTimerConfigurationRecord { .init(id: value.id, name: value.name, moveDuration: value.moveDuration, exerciseRestDuration: value.exerciseRestDuration, exercisesPerRound: value.exercisesPerRound, rounds: value.rounds, roundRestDuration: value.roundRestDuration, createdAt: value.createdAt, updatedAt: value.updatedAt) }
    private func timerDomain(_ value: StandaloneTimerConfigurationRecord) -> StandaloneTimerConfiguration { .init(id: value.id, name: value.name, moveDuration: value.moveDuration, exerciseRestDuration: value.exerciseRestDuration, exercisesPerRound: value.exercisesPerRound, rounds: value.rounds, roundRestDuration: value.roundRestDuration, createdAt: value.createdAt, updatedAt: value.updatedAt) }
    private func canonical<T: PersistentModel, K: Hashable>(_ values: [T], key: KeyPath<T, K>, updatedAt: KeyPath<T, Date>) -> [T] { Dictionary(grouping: values, by: { $0[keyPath: key] }).values.compactMap { winner($0, updatedAt: updatedAt) } }
    private func winner<T: PersistentModel>(_ values: [T], updatedAt: KeyPath<T, Date>) -> T? {
        values.max { lhs, rhs in
            let left = lhs[keyPath: updatedAt], right = rhs[keyPath: updatedAt]
            return left == right ? String(describing: lhs.persistentModelID) < String(describing: rhs.persistentModelID) : left < right
        }
    }
    private func childWinner<T: PersistentModel>(_ values: [T], id: String, idPath: KeyPath<T, String>, updatedAt: KeyPath<T, Date>) -> T? {
        winner(values.filter { $0[keyPath: idPath] == id }, updatedAt: updatedAt)
    }
    private static func isValidRestDuration(_ value: TimeInterval) -> Bool { value.isFinite && value >= 15 && value <= 300 && value.rounded() == value && Int(value) % 5 == 0 }
    private func saveOrRollback() throws { do { try context.save() } catch { context.rollback(); throw error } }
}

extension Notification.Name {
    static let equilibriumSettingsDidChange = Notification.Name("equilibrium.settings-did-change")
}

enum FixtureDefaults {
    static let progression = ProgressionConfiguration(isEnabled: true, defaults: .init(repetitionRange: 8...12, weightIncrement: .init(pounds: 5), mode: .doubleProgression), groups: [], overrides: [])
}
