import Foundation

public protocol ExerciseRepository: Sendable {
    func allExercises() async throws -> [ExerciseDefinition]
    func searchExercises(_ query: String) async throws -> [ExerciseDefinition]
    func exercise(id: ExerciseID) async throws -> ExerciseDefinition?
    func saveExercise(_ exercise: ExerciseDefinition) async throws
    func archiveExercise(id: ExerciseID, at date: Date) async throws
}
public protocol WorkoutTemplateRepository: Sendable {
    func allTemplates() async throws -> [WorkoutTemplate]
    func template(id: WorkoutTemplateID) async throws -> WorkoutTemplate?
    func saveTemplate(_ template: WorkoutTemplate) async throws
    func archiveTemplate(id: WorkoutTemplateID, at date: Date) async throws
}
public protocol ScheduledWorkoutRepository: Sendable {
    func workouts(on day: LocalDay) async throws -> [ScheduledWorkout]
    func workouts(from startDay: LocalDay, through endDay: LocalDay) async throws -> [ScheduledWorkout]
    func workout(id: ScheduledWorkoutID) async throws -> ScheduledWorkout?
    func allWorkouts() async throws -> [ScheduledWorkout]
    func schedule(_ workout: ScheduledWorkout) async throws
    func update(_ workout: ScheduledWorkout) async throws
    func materializeAtomically(_ workouts: [ScheduledWorkout]) async throws
    func startWorkout(id: ScheduledWorkoutID, at date: Date) async throws -> ScheduledWorkout
    func logSet(workoutID: ScheduledWorkoutID, exerciseID: ScheduledExerciseID, prescriptionID: SetID, input: SetLogInput, completed: Bool, at date: Date) async throws -> ScheduledWorkout
    func appendSet(workoutID: ScheduledWorkoutID, exerciseID: ScheduledExerciseID, seed: SetLogInput?, at date: Date) async throws -> ScheduledWorkout
    func removeSet(workoutID: ScheduledWorkoutID, exerciseID: ScheduledExerciseID, prescriptionID: SetID, at date: Date) async throws -> ScheduledWorkout
    func completeWorkout(id: ScheduledWorkoutID, at date: Date) async throws -> ScheduledWorkout
    func recentCompletedWorkouts(limit: Int) async throws -> [ScheduledWorkout]
}
public struct LatestExerciseLog: Equatable, Sendable {
    public let exerciseID: ExerciseID
    public let workoutID: ScheduledWorkoutID
    public let occurredAt: Date
    public let sets: [LoggedSet]
}

public protocol ExerciseHistoryRepository: Sendable {
    func latestExerciseLog(exerciseID: ExerciseID) async throws -> LatestExerciseLog?
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
public enum RepositoryError: Error, Equatable { case notFound, immutableCompletedWorkout, workoutNotCurrentDay, workoutNotInProgress, prescriptionNotFound, cannotRemoveCompletedSet, invalidSetInput, incompleteWorkout, duplicateIdentifier, duplicateExerciseName, invalidBackup }

public extension ScheduledWorkoutRepository {
    func recentCompletedWorkouts(limit: Int) async throws -> [ScheduledWorkout] {
        Array(try await allWorkouts().filter { $0.status == .completed }.sorted {
            let lhs = $0.completedAt ?? $0.updatedAt, rhs = $1.completedAt ?? $1.updatedAt
            return lhs == rhs ? $0.id.rawValue < $1.id.rawValue : lhs > rhs
        }.prefix(limit))
    }
}

public protocol CurrentDayProviding: Sendable { func currentDay() throws -> LocalDay }

public struct SystemCurrentDayProvider: CurrentDayProviding {
    private let calendar: Calendar
    public init(calendar: Calendar = .autoupdatingCurrent) { self.calendar = calendar }
    public func currentDay() throws -> LocalDay { try LocalDay(date: .now, calendar: calendar) }
}
