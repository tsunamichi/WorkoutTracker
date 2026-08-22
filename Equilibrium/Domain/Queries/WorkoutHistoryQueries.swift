import Foundation

public enum WorkoutHistoryQuery {
    public static func completionDate(_ workout: ScheduledWorkout) -> Date {
        workout.completedAt ?? workout.updatedAt
    }

    public static func completed(_ workouts: [ScheduledWorkout]) -> [ScheduledWorkout] {
        workouts.filter { $0.status == .completed }.sorted {
            let lhs = completionDate($0), rhs = completionDate($1)
            if lhs != rhs { return lhs > rhs }
            if $0.day != $1.day { return $0.day > $1.day }
            return $0.id.rawValue > $1.id.rawValue
        }
    }
}

public struct ExerciseHistoryOccurrence: Identifiable, Equatable, Sendable {
    public let id: ScheduledExerciseID
    public let exerciseID: ExerciseID
    public let exerciseNameSnapshot: String
    public let workoutID: ScheduledWorkoutID
    public let workoutTitleSnapshot: String
    public let day: LocalDay
    public let occurredAt: Date
    public let sets: [LoggedSet]
}

public enum ExercisePersonalRecord: Equatable, Sendable {
    case repetitions(set: LoggedSet)
    case duration(set: LoggedSet)
}

public enum ExerciseTrendValue: Equatable, Sendable {
    case weight(pounds: Double, repetitions: Int)
    case repetitions(Int)
    case duration(TimeInterval)
}

public enum ExercisePerformanceMetricFamily: Equatable, Sendable {
    case weightedRepetitions
    case unweightedRepetitions
    case duration
}

public struct ExerciseTrendPoint: Identifiable, Equatable, Sendable {
    public let id: ScheduledExerciseID
    public let workoutID: ScheduledWorkoutID
    public let day: LocalDay
    public let occurredAt: Date
    public let value: ExerciseTrendValue
}

public struct ExercisePerformance: Equatable, Sendable {
    public let exerciseID: ExerciseID
    public let displayName: String?
    public let activeMetricFamily: ExercisePerformanceMetricFamily?
    public let occurrences: [ExerciseHistoryOccurrence]
    public let personalRecord: ExercisePersonalRecord?
    public let trend: [ExerciseTrendPoint]

    public var latestOccurrence: ExerciseHistoryOccurrence? { occurrences.last }
    public var previousOccurrence: ExerciseHistoryOccurrence? { occurrences.dropLast().last }
}

public enum ExercisePerformanceQuery {
    public static func performance(exerciseID: ExerciseID, workouts: [ScheduledWorkout]) -> ExercisePerformance {
        let completed = WorkoutHistoryQuery.completed(workouts)
        var occurrences: [ExerciseHistoryOccurrence] = []

        for workout in completed {
            for exercise in workout.exercises where exercise.exerciseID == exerciseID {
                let sets = validCompletedSets(in: exercise)
                guard !sets.isEmpty else { continue }
                occurrences.append(.init(
                    id: exercise.id,
                    exerciseID: exerciseID,
                    exerciseNameSnapshot: exercise.nameSnapshot,
                    workoutID: workout.id,
                    workoutTitleSnapshot: workout.titleSnapshot,
                    day: workout.day,
                    occurredAt: WorkoutHistoryQuery.completionDate(workout),
                    sets: sets
                ))
            }
        }

        occurrences.sort {
            if $0.occurredAt != $1.occurredAt { return $0.occurredAt < $1.occurredAt }
            if $0.workoutID != $1.workoutID { return $0.workoutID.rawValue < $1.workoutID.rawValue }
            return $0.id.rawValue < $1.id.rawValue
        }
        let family = occurrences.last.flatMap(metricFamily)
        return ExercisePerformance(
            exerciseID: exerciseID,
            displayName: occurrences.last?.exerciseNameSnapshot,
            activeMetricFamily: family,
            occurrences: occurrences,
            personalRecord: family.flatMap { personalRecord(from: occurrences.flatMap(\.sets), family: $0) },
            trend: family.map { selected in occurrences.compactMap { trendPoint($0, family: selected) } } ?? []
        )
    }

    public static func validCompletedSets(in exercise: ScheduledExercise) -> [LoggedSet] {
        let prescriptions = Dictionary(uniqueKeysWithValues: exercise.prescriptions.map { ($0.id, $0) })
        let indexed = exercise.loggedSets.enumerated().compactMap { index, log -> (Int, LoggedSet)? in
            guard log.completedAt != nil, let prescriptionID = log.prescriptionID,
                  let prescription = prescriptions[prescriptionID], isValid(log, for: prescription) else { return nil }
            return (index, log)
        }
        return indexed.sorted { lhs, rhs in
            let lhsID = lhs.1.prescriptionID!, rhsID = rhs.1.prescriptionID!
            let lhsPosition = exercise.prescriptions.firstIndex { $0.id == lhsID } ?? lhs.0
            let rhsPosition = exercise.prescriptions.firstIndex { $0.id == rhsID } ?? rhs.0
            return lhsPosition == rhsPosition ? lhs.1.id.rawValue < rhs.1.id.rawValue : lhsPosition < rhsPosition
        }.map(\.1)
    }

    private static func isValid(_ log: LoggedSet, for prescription: SetPrescription) -> Bool {
        switch prescription.target {
        case .repetitions:
            guard let repetitions = log.repetitions, repetitions > 0, log.duration == nil else { return false }
            return log.weight.map { $0.pounds.isFinite && $0.pounds >= 0 } ?? true
        case .duration:
            guard let duration = log.duration, duration.isFinite, duration > 0 else { return false }
            return log.repetitions == nil && log.weight == nil
        }
    }

    private static func metricFamily(_ occurrence: ExerciseHistoryOccurrence) -> ExercisePerformanceMetricFamily? {
        if occurrence.sets.contains(where: { $0.repetitions != nil && $0.weight != nil }) { return .weightedRepetitions }
        if occurrence.sets.contains(where: { $0.repetitions != nil && $0.weight == nil }) { return .unweightedRepetitions }
        if occurrence.sets.contains(where: { $0.duration != nil }) { return .duration }
        return nil
    }

    private static func personalRecord(from sets: [LoggedSet], family: ExercisePerformanceMetricFamily) -> ExercisePersonalRecord? {
        switch family {
        case .weightedRepetitions:
            guard let best = sets.filter({ $0.repetitions != nil && $0.duration == nil && $0.weight != nil }).sorted(by: repetitionSetPrecedes).first else { return nil }
            return .repetitions(set: best)
        case .unweightedRepetitions:
            guard let best = sets.filter({ $0.repetitions != nil && $0.duration == nil && $0.weight == nil }).sorted(by: repetitionSetPrecedes).first else { return nil }
            return .repetitions(set: best)
        case .duration:
            guard let best = sets.filter({ $0.duration != nil }).sorted(by: durationSetPrecedes).first else { return nil }
            return .duration(set: best)
        }
    }

    private static func repetitionSetPrecedes(_ lhs: LoggedSet, _ rhs: LoggedSet) -> Bool {
        switch (lhs.weight?.pounds, rhs.weight?.pounds) {
        case let (l?, r?) where l != r: return l > r
        case (_?, nil): return true
        case (nil, _?): return false
        default:
            if lhs.repetitions != rhs.repetitions { return (lhs.repetitions ?? 0) > (rhs.repetitions ?? 0) }
            let ld = lhs.completedAt ?? .distantPast, rd = rhs.completedAt ?? .distantPast
            return ld == rd ? lhs.id.rawValue < rhs.id.rawValue : ld < rd
        }
    }

    private static func durationSetPrecedes(_ lhs: LoggedSet, _ rhs: LoggedSet) -> Bool {
        if lhs.duration != rhs.duration { return (lhs.duration ?? 0) > (rhs.duration ?? 0) }
        let ld = lhs.completedAt ?? .distantPast, rd = rhs.completedAt ?? .distantPast
        return ld == rd ? lhs.id.rawValue < rhs.id.rawValue : ld < rd
    }

    private static func trendPoint(_ occurrence: ExerciseHistoryOccurrence, family: ExercisePerformanceMetricFamily) -> ExerciseTrendPoint? {
        let value: ExerciseTrendValue
        switch family {
        case .weightedRepetitions:
            guard let best = occurrence.sets.filter({ $0.repetitions != nil && $0.duration == nil && $0.weight != nil }).sorted(by: repetitionSetPrecedes).first,
                  let pounds = best.weight?.pounds, let repetitions = best.repetitions else { return nil }
            value = .weight(pounds: pounds, repetitions: repetitions)
        case .unweightedRepetitions:
            guard let repetitions = occurrence.sets.filter({ $0.weight == nil && $0.duration == nil }).compactMap(\.repetitions).max() else { return nil }
            value = .repetitions(repetitions)
        case .duration:
            guard let duration = occurrence.sets.compactMap(\.duration).max() else { return nil }
            value = .duration(duration)
        }
        return .init(id: occurrence.id, workoutID: occurrence.workoutID, day: occurrence.day, occurredAt: occurrence.occurredAt, value: value)
    }
}
