import Foundation

public enum WorkoutShareText {
    public static func build(workout: Workout, unit: WeightUnit) -> String {
        var lines = [workout.titleSnapshot.trimmingCharacters(in: .whitespacesAndNewlines), "⸻"]
        for exercise in workout.exercises {
            lines.append("- \(exercise.nameSnapshot) — \(exerciseSummary(exercise, unit: unit))")
        }
        return lines.joined(separator: "\n").trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private static func exerciseSummary(_ exercise: WorkoutExercise, unit: WeightUnit) -> String {
        let completed = ExercisePerformanceQuery.validCompletedSets(in: exercise)
        if !completed.isEmpty { return completed.map { setSummary($0, unit: unit) }.joined(separator: ", ") }
        guard let first = exercise.prescriptions.first else { return "No sets logged" }
        switch first.target {
        case .duration(let seconds): return "\(exercise.prescriptions.count)×\(Int(seconds.rounded())) sec"
        case .repetitions(let range):
            let reps = range.lowerBound == range.upperBound ? "\(range.lowerBound)" : "\(range.lowerBound)-\(range.upperBound)"
            let weight = first.suggestedWeight.map { " @ \(WeightText.value($0, unit: unit)) \(unit == .pounds ? "lb" : "kg")" } ?? ""
            return "\(exercise.prescriptions.count)×\(reps)\(weight)"
        }
    }

    private static func setSummary(_ set: LoggedSet, unit: WeightUnit) -> String {
        if let duration = set.duration { return "\(Int(duration.rounded())) sec" }
        let reps = "\(set.repetitions ?? 0) reps"
        guard let weight = set.weight else { return reps }
        return "\(WeightText.value(weight, unit: unit)) \(unit == .pounds ? "lb" : "kg") × \(set.repetitions ?? 0)"
    }
}
