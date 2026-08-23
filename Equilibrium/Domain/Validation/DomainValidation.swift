import Foundation

public enum DomainValidationError: Error, Equatable, CustomStringConvertible {
    case invalidID(String), invalidName, invalidSetTarget, duplicateID(String), invalidWorkoutStatus
    case orphanedLoggedSet(String), invalidCompletedSet(String), incompleteCompletedWorkout
    public var description: String {
        switch self {
        case .invalidID(let value): "Invalid identifier: \(value)"
        case .invalidName: "Invalid name"
        case .invalidSetTarget: "Invalid set target"
        case .duplicateID(let value): "Duplicate identifier: \(value)"
        case .invalidWorkoutStatus: "Invalid workout status timestamps"
        case .orphanedLoggedSet(let value): "Orphaned logged set: \(value)"
        case .invalidCompletedSet(let value): "Invalid completed set: \(value)"
        case .incompleteCompletedWorkout: "Completed workout has incomplete exercises"
        }
    }
}

public enum DomainValidator {
    public static func validate(_ workout: Workout) throws {
        guard workout.id.isValid else { throw DomainValidationError.invalidID("workout") }
        guard !workout.titleSnapshot.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { throw DomainValidationError.invalidName }
        switch workout.status {
        case .ready: guard workout.startedAt == nil && workout.completedAt == nil else { throw DomainValidationError.invalidWorkoutStatus }
        case .inProgress: guard workout.startedAt != nil && workout.completedAt == nil else { throw DomainValidationError.invalidWorkoutStatus }
        case .completed:
            guard let started = workout.startedAt, let completed = workout.completedAt, completed >= started else { throw DomainValidationError.invalidWorkoutStatus }
        }
        try requireUnique(workout.exercises.map(\.id.rawValue))
        for exercise in workout.exercises {
            guard exercise.id.isValid, exercise.exerciseID.isValid else { throw DomainValidationError.invalidID("workoutExercise") }
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

    private static func requireUnique(_ values: [String]) throws {
        guard Set(values).count == values.count else { throw DomainValidationError.duplicateID("child") }
    }
}
