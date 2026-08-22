import Foundation

public protocol ExerciseRepository: Sendable {
    func allExercises() async throws -> [ExerciseDefinition]
    func saveExercise(_ exercise: ExerciseDefinition) async throws
}
public protocol WorkoutTemplateRepository: Sendable {
    func allTemplates() async throws -> [WorkoutTemplate]
    func template(id: WorkoutTemplateID) async throws -> WorkoutTemplate?
    func saveTemplate(_ template: WorkoutTemplate) async throws
}
public protocol ScheduledWorkoutRepository: Sendable {
    func workout(on day: LocalDay) async throws -> ScheduledWorkout?
    func workouts(from startDay: LocalDay, through endDay: LocalDay) async throws -> [ScheduledWorkout]
    func workout(id: ScheduledWorkoutID) async throws -> ScheduledWorkout?
    func allWorkouts() async throws -> [ScheduledWorkout]
    func schedule(_ workout: ScheduledWorkout) async throws
    func update(_ workout: ScheduledWorkout) async throws
    func materializeAtomically(_ workouts: [ScheduledWorkout]) async throws
}
public protocol CyclePlanRepository: Sendable {
    func allPlans() async throws -> [CyclePlan]
    func savePlan(_ plan: CyclePlan, availableTemplates: Set<WorkoutTemplateID>) async throws
}
public protocol SettingsRepository: Sendable {
    func settings() async throws -> AppSettings
    func saveSettings(_ settings: AppSettings) async throws
}
public protocol BackupRepository: Sendable {
    func exportBackup(exportedAt: Date, sourceDeviceID: String) async throws -> EquilibriumBackupV1
    func restoreBackup(_ backup: EquilibriumBackupV1) async throws
}
public enum RepositoryError: Error, Equatable { case workoutDayConflict(LocalDay), notFound, immutableCompletedWorkout, duplicateIdentifier, invalidBackup }
