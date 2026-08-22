import Foundation

public enum SetLogInput: Equatable, Sendable {
    case repetitions(weight: Weight?, repetitions: Int)
    case duration(seconds: TimeInterval)
}

public enum ExerciseState: String, Equatable, Sendable {
    case upcoming, current, completed
}

public struct WorkoutProgress: Equatable, Sendable {
    public let completedSetCount: Int
    public let requiredSetCount: Int

    public var fraction: Double {
        requiredSetCount == 0 ? 0 : Double(completedSetCount) / Double(requiredSetCount)
    }
}

public enum WorkoutExecutionQuery {
    public static func completedPrescriptionIDs(in exercise: ScheduledExercise) -> Set<SetID> {
        Set(exercise.loggedSets.lazy.filter { $0.completedAt != nil }.compactMap(\.prescriptionID))
    }

    public static func isComplete(_ exercise: ScheduledExercise) -> Bool {
        if exercise.skippedAt != nil { return true }
        guard !exercise.prescriptions.isEmpty else { return false }
        return Set(exercise.prescriptions.map(\.id)).isSubset(of: completedPrescriptionIDs(in: exercise))
    }

    public static func states(in workout: ScheduledWorkout, focusedExerciseID: ScheduledExerciseID? = nil) -> [ScheduledExerciseID: ExerciseState] {
        let firstIncompleteID = workout.exercises.first(where: { !isComplete($0) })?.id
        let focus = focusedExerciseID.flatMap { id in
            workout.exercises.contains(where: { $0.id == id }) ? id : nil
        } ?? firstIncompleteID

        return Dictionary(uniqueKeysWithValues: workout.exercises.map { exercise in
            let state: ExerciseState
            if exercise.id == focus { state = .current }
            else if isComplete(exercise) { state = .completed }
            else { state = .upcoming }
            return (exercise.id, state)
        })
    }

    public static func progress(in workout: ScheduledWorkout) -> WorkoutProgress {
        let included = workout.exercises.filter { $0.skippedAt == nil }
        let required = included.reduce(0) { $0 + max(1, $1.prescriptions.count) }
        let completed = included.reduce(0) { $0 + completedPrescriptionIDs(in: $1).intersection(Set($1.prescriptions.map(\.id))).count }
        return WorkoutProgress(completedSetCount: completed, requiredSetCount: required)
    }

    public static func canComplete(_ workout: ScheduledWorkout) -> Bool {
        !workout.exercises.isEmpty && workout.exercises.allSatisfy(isComplete)
    }
}

public enum WeightText {
    public static func value(_ weight: Weight?, unit: WeightUnit) -> String {
        guard let weight else { return "" }
        return format(weight.value(in: unit))
    }

    public static func weight(from text: String, unit: WeightUnit) -> Weight? {
        let normalized = text.trimmingCharacters(in: .whitespacesAndNewlines).replacingOccurrences(of: ",", with: ".")
        guard !normalized.isEmpty, let value = Double(normalized), value >= 0, value.isFinite else { return nil }
        return Weight(value, unit: unit)
    }

    public static func format(_ value: Double) -> String {
        value.rounded() == value ? String(Int(value)) : String(format: "%.1f", value)
    }
}
