import Foundation

public enum EquilibriumFixtures {
    public static let timestamp = Date(timeIntervalSince1970: 1_735_689_600)
    public static let squatID = ExerciseID(rawValue: "exercise-squat")
    public static let plankID = ExerciseID(rawValue: "exercise-plank")
    public static let settings = AppSettings(weightUnit: .pounds, defaultRestDuration: 90)
    public static let progression = ProgressionConfiguration(isEnabled: true, defaults: .init(repetitionRange: 8...12, weightIncrement: .init(pounds: 5), mode: .doubleProgression), groups: [], overrides: [])
    public static let exercises = [
        ExerciseDefinition(id: squatID, name: "Back Squat", normalizedName: "back squat", aliases: ["Squat"], equipment: "Barbell", category: "Legs", isCustom: false, archivedAt: nil),
        ExerciseDefinition(id: plankID, name: "Plank", normalizedName: "plank", aliases: [], equipment: "Bodyweight", category: "Core stability", isCustom: false, archivedAt: nil)
    ]
    public static func empty() -> [Workout] { [] }
    public static func ready(id: String = "workout-ready") -> Workout {
        workout(id: id, title: "Lower Strength", exercises: [repExercise(prefix: id)], status: .ready)
    }
    public static func mixed(id: String = "workout-mixed") -> Workout {
        workout(id: id, title: "Mixed Session", exercises: [repExercise(prefix: id), durationExercise(prefix: id)], status: .ready)
    }
    public static func inProgress(id: String = "workout-progress") -> Workout {
        var exercise = repExercise(prefix: id)
        let prescription = exercise.prescriptions[0]
        exercise.loggedSets = [LoggedSet(id: .init(rawValue: "logged-progress-1"), prescriptionID: prescription.id, weight: .init(pounds: 135), repetitions: 8, duration: nil, completedAt: timestamp)]
        return workout(id: id, title: "In Progress", exercises: [exercise], status: .inProgress, startedAt: timestamp)
    }
    public static func midWorkout(id: String = "workout-mid") -> Workout {
        var first = repExercise(prefix: "\(id)-first")
        first.loggedSets = first.prescriptions.enumerated().map { index, prescription in
            LoggedSet(id: .init(rawValue: "\(id)-logged-first-\(index)"), prescriptionID: prescription.id, weight: .init(pounds: 135), repetitions: 10, duration: nil, completedAt: timestamp.addingTimeInterval(Double(index)))
        }
        var current = repExercise(prefix: "\(id)-current")
        current.nameSnapshot = "Romanian Deadlift"
        current.loggedSets = [LoggedSet(id: .init(rawValue: "\(id)-logged-current"), prescriptionID: current.prescriptions[0].id, weight: .init(pounds: 115), repetitions: 8, duration: nil, completedAt: timestamp)]
        var upcoming = repExercise(prefix: "\(id)-upcoming")
        upcoming.nameSnapshot = "Single-Leg Rear-Foot-Elevated Split Squat With Controlled Tempo"
        return workout(id: id, title: "Lower Body Strength", exercises: [first, current, upcoming, durationExercise(prefix: id)], status: .inProgress, startedAt: timestamp)
    }
    public static func completed(id: String = "workout-completed") -> Workout {
        var exercise = repExercise(prefix: id)
        exercise.loggedSets = exercise.prescriptions.enumerated().map { index, prescription in
            LoggedSet(id: .init(rawValue: "logged-completed-\(index)"), prescriptionID: prescription.id, weight: .init(pounds: 145), repetitions: 10, duration: nil, completedAt: timestamp.addingTimeInterval(Double(index + 1)))
        }
        return workout(id: id, title: "Completed Strength", exercises: [exercise], status: .completed, startedAt: timestamp, completedAt: timestamp.addingTimeInterval(600))
    }
    public static func backup(workouts: [Workout] = [ready(), mixed(), inProgress(), completed()]) throws -> EquilibriumBackupV2 {
        try EquilibriumBackupV2(exportedAt: timestamp, sourceDeviceID: "fixture-installation", exercises: exercises, workouts: workouts, settings: settings, progression: progression)
    }
    private static func workout(id: String, title: String, exercises: [WorkoutExercise], status: WorkoutStatus, startedAt: Date? = nil, completedAt: Date? = nil) -> Workout {
        Workout(id: .init(rawValue: id), titleSnapshot: title, exercises: exercises, status: status, startedAt: startedAt, completedAt: completedAt, createdAt: timestamp, updatedAt: timestamp)
    }
    private static func repExercise(prefix: String) -> WorkoutExercise {
        WorkoutExercise(id: .init(rawValue: "\(prefix)-exercise-squat"), exerciseID: squatID, nameSnapshot: "Back Squat", prescriptions: repPrescriptions(prefix: "\(prefix)-squat"), loggedSets: [], restDuration: 120, skippedAt: nil)
    }
    private static func durationExercise(prefix: String) -> WorkoutExercise {
        let prescription = SetPrescription(id: .init(rawValue: "\(prefix)-plank-1"), target: .duration(seconds: 45), suggestedWeight: nil)
        return WorkoutExercise(id: .init(rawValue: "\(prefix)-exercise-plank"), exerciseID: plankID, nameSnapshot: "Plank", prescriptions: [prescription], loggedSets: [], restDuration: 60, skippedAt: nil)
    }
    private static func repPrescriptions(prefix: String) -> [SetPrescription] {
        (1...3).map { SetPrescription(id: .init(rawValue: "\(prefix)-\($0)"), target: .repetitions(range: 8...12), suggestedWeight: .init(pounds: 135)) }
    }
}
