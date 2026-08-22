import Foundation

public enum DomainValidationError: Error, Equatable, CustomStringConvertible {
    case invalidID(String), invalidName, invalidSetTarget, duplicateID(String), invalidWorkoutStatus
    case orphanedLoggedSet(String), invalidCompletedSet(String), incompleteCompletedWorkout, invalidPlanDuration
    case duplicateWeekday, invalidPlanLifecycle, missingTemplate(String), duplicateWorkoutDay(LocalDay)
    public var description: String { String(describing: self) }
}

public enum DomainValidator {
    public static func validate(_ workout: ScheduledWorkout) throws {
        guard workout.id.isValid else { throw DomainValidationError.invalidID("scheduledWorkout") }
        guard !workout.titleSnapshot.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { throw DomainValidationError.invalidName }
        switch workout.status {
        case .planned: guard workout.startedAt == nil && workout.completedAt == nil else { throw DomainValidationError.invalidWorkoutStatus }
        case .inProgress: guard workout.startedAt != nil && workout.completedAt == nil else { throw DomainValidationError.invalidWorkoutStatus }
        case .completed:
            guard let started = workout.startedAt, let completed = workout.completedAt, completed >= started else { throw DomainValidationError.invalidWorkoutStatus }
        }
        try requireUnique(workout.exercises.map(\.id.rawValue))
        for exercise in workout.exercises {
            guard exercise.id.isValid, exercise.exerciseID.isValid else { throw DomainValidationError.invalidID("scheduledExercise") }
            try requireUnique(exercise.prescriptions.map(\.id.rawValue))
            try requireUnique(exercise.loggedSets.map(\.id.rawValue))
            let targets = Dictionary(uniqueKeysWithValues: exercise.prescriptions.map { ($0.id, $0.target) })
            for prescription in exercise.prescriptions { try validate(prescription.target) }
            for logged in exercise.loggedSets {
                guard let prescriptionID = logged.prescriptionID, let target = targets[prescriptionID] else {
                    throw DomainValidationError.orphanedLoggedSet(logged.id.rawValue)
                }
                if logged.completedAt != nil { try validateCompleted(logged, target: target) }
            }
            if workout.status == .completed && exercise.skippedAt == nil {
                guard !exercise.prescriptions.isEmpty else { throw DomainValidationError.incompleteCompletedWorkout }
                let completedIDs = Set(exercise.loggedSets.filter { $0.completedAt != nil }.compactMap(\.prescriptionID))
                guard Set(exercise.prescriptions.map(\.id)).isSubset(of: completedIDs) else { throw DomainValidationError.incompleteCompletedWorkout }
            }
        }
    }

    public static func validate(_ target: SetTarget) throws {
        switch target {
        case .repetitions(let range): guard range.lowerBound > 0 && range.upperBound >= range.lowerBound else { throw DomainValidationError.invalidSetTarget }
        case .duration(let seconds): guard seconds.isFinite && seconds > 0 else { throw DomainValidationError.invalidSetTarget }
        }
    }

    public static func validateCompleted(_ set: LoggedSet, target: SetTarget) throws {
        if let pounds = set.weight?.pounds, (!pounds.isFinite || pounds < 0) { throw DomainValidationError.invalidCompletedSet(set.id.rawValue) }
        switch target {
        case .repetitions: guard let repetitions = set.repetitions, repetitions > 0, set.duration == nil else { throw DomainValidationError.invalidCompletedSet(set.id.rawValue) }
        case .duration: guard let duration = set.duration, duration.isFinite, duration > 0, set.repetitions == nil else { throw DomainValidationError.invalidCompletedSet(set.id.rawValue) }
        }
    }

    public static func validate(_ plan: CyclePlan, availableTemplates: Set<WorkoutTemplateID>? = nil) throws {
        guard plan.id.isValid else { throw DomainValidationError.invalidID("plan") }
        guard plan.numberOfWeeks > 0 else { throw DomainValidationError.invalidPlanDuration }
        guard Set(plan.days.map(\.weekday)).count == plan.days.count else { throw DomainValidationError.duplicateWeekday }
        if let availableTemplates {
            for day in plan.days where !availableTemplates.contains(day.workoutTemplateID) { throw DomainValidationError.missingTemplate(day.workoutTemplateID.rawValue) }
        }
        switch plan.status {
        case .draft, .active: guard plan.pausedUntil == nil && plan.endedOn == nil else { throw DomainValidationError.invalidPlanLifecycle }
        case .paused: guard plan.pausedUntil != nil && plan.endedOn == nil else { throw DomainValidationError.invalidPlanLifecycle }
        case .ended, .completed: guard plan.endedOn != nil && plan.pausedUntil == nil else { throw DomainValidationError.invalidPlanLifecycle }
        }
    }

    private static func requireUnique(_ values: [String]) throws {
        guard Set(values).count == values.count else { throw DomainValidationError.duplicateID("child") }
    }
}
