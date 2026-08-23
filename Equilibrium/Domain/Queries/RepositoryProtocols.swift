import Foundation

public protocol ExerciseRepository: Sendable {
    func allExercises() async throws -> [ExerciseDefinition]
    func searchExercises(_ query: String) async throws -> [ExerciseDefinition]
    func exercise(id: ExerciseID) async throws -> ExerciseDefinition?
    func saveExercise(_ exercise: ExerciseDefinition) async throws
    func archiveExercise(id: ExerciseID, at date: Date) async throws
}
public protocol WorkoutRepository: Sendable {
    func activeWorkouts() async throws -> [Workout]
    func workout(id: WorkoutID) async throws -> Workout?
    func allWorkouts() async throws -> [Workout]
    func create(_ workout: Workout) async throws
    func update(_ workout: Workout) async throws
    func materializeAtomically(_ workouts: [Workout]) async throws
    func startWorkout(id: WorkoutID, at date: Date) async throws -> Workout
    func logSet(workoutID: WorkoutID, exerciseID: WorkoutExerciseID, prescriptionID: SetID, input: SetLogInput, completed: Bool, at date: Date) async throws -> Workout
    func appendSet(workoutID: WorkoutID, exerciseID: WorkoutExerciseID, seed: SetLogInput?, at date: Date) async throws -> Workout
    func removeSet(workoutID: WorkoutID, exerciseID: WorkoutExerciseID, prescriptionID: SetID, at date: Date) async throws -> Workout
    func completeWorkout(id: WorkoutID, at date: Date) async throws -> Workout
    func resetWorkout(id: WorkoutID, at date: Date) async throws -> Workout
    func deleteWorkout(id: WorkoutID) async throws
    func setRestDuration(workoutID: WorkoutID, exerciseID: WorkoutExerciseID, seconds: TimeInterval, at date: Date) async throws -> Workout
    func recentCompletedWorkouts(limit: Int) async throws -> [Workout]
    func completedWorkouts() async throws -> [Workout]
    func completedWorkout(id: WorkoutID) async throws -> Workout?
}
public struct LatestExerciseLog: Equatable, Sendable {
    public let exerciseID: ExerciseID
    public let workoutID: WorkoutID
    public let occurredAt: Date
    public let sets: [LoggedSet]
}

public protocol ExerciseHistoryRepository: Sendable {
    func latestExerciseLog(exerciseID: ExerciseID) async throws -> LatestExerciseLog?
    func exercisePerformance(exerciseID: ExerciseID) async throws -> ExercisePerformance
}
public protocol SettingsRepository: Sendable {
    func settings() async throws -> AppSettings
    func saveSettings(_ settings: AppSettings) async throws
}
public protocol ProgressionRepository: Sendable {
    func progressionConfiguration() async throws -> ProgressionConfiguration
    func saveProgressionConfiguration(_ configuration: ProgressionConfiguration) async throws
}
public protocol BackupRepository: Sendable {
    func exportBackup(exportedAt: Date, sourceDeviceID: String) async throws -> EquilibriumBackupV2
    func restoreBackup(_ backup: EquilibriumBackupV2) async throws
}
public enum RepositoryError: Error, Equatable { case notFound, immutableCompletedWorkout, workoutNotInProgress, prescriptionNotFound, cannotRemoveCompletedSet, invalidSetInput, invalidRestDuration, invalidSettings, invalidProgressionConfiguration, incompleteWorkout, duplicateIdentifier, duplicateExerciseName, invalidBackup }

public extension WorkoutRepository {
    func completedWorkouts() async throws -> [Workout] {
        WorkoutHistoryQuery.completed(try await allWorkouts())
    }

    func completedWorkout(id: WorkoutID) async throws -> Workout? {
        guard let workout = try await workout(id: id), workout.status == .completed else { return nil }
        return workout
    }

    func recentCompletedWorkouts(limit: Int) async throws -> [Workout] {
        Array(WorkoutHistoryQuery.completed(try await allWorkouts()).prefix(limit))
    }
}
