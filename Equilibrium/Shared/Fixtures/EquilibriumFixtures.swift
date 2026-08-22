import Foundation

public enum EquilibriumFixtures {
    public static let timestamp = Date(timeIntervalSince1970: 1_735_689_600)
    public static let squatID = ExerciseID(rawValue: "exercise-squat")
    public static let plankID = ExerciseID(rawValue: "exercise-plank")
    public static let templateID = WorkoutTemplateID(rawValue: "template-strength")
    public static let settings = AppSettings(weightUnit: .pounds, defaultRestDuration: 90)
    public static let progression = ProgressionConfiguration(isEnabled: true, defaults: .init(repetitionRange: 8...12, weightIncrement: .init(pounds: 5), mode: .doubleProgression), groups: [], overrides: [])
    public static let exercises = [
        ExerciseDefinition(id: squatID, name: "Back Squat", normalizedName: "back squat", aliases: ["Squat"], equipment: "Barbell", category: "Legs", isCustom: false, archivedAt: nil),
        ExerciseDefinition(id: plankID, name: "Plank", normalizedName: "plank", aliases: [], equipment: "Bodyweight", category: "Core stability", isCustom: false, archivedAt: nil)
    ]
    public static let template = WorkoutTemplate(id: templateID, name: "Strength", exercises: [
        WorkoutExerciseDefinition(id: .init(rawValue: "template-exercise-squat"), exerciseID: squatID, exerciseNameSnapshot: "Back Squat", prescriptions: repPrescriptions(prefix: "template-squat"), restDuration: 120, progressionRuleID: nil)
    ], createdAt: timestamp, updatedAt: timestamp, archivedAt: nil)

    public static func empty() -> [ScheduledWorkout] { [] }
    public static func planned(day: String = "2025-01-15", id: String = "workout-planned") -> ScheduledWorkout {
        workout(id: id, day: day, title: "Lower Strength", exercises: [scheduledRepExercise(prefix: id)], status: .planned)
    }
    public static func mixed(day: String = "2025-01-16", id: String = "workout-mixed") -> ScheduledWorkout {
        workout(id: id, day: day, title: "Mixed Session", exercises: [scheduledRepExercise(prefix: id), scheduledDurationExercise(prefix: id)], status: .planned)
    }
    public static func inProgress(day: String = "2025-01-17", id: String = "workout-progress") -> ScheduledWorkout {
        var exercise = scheduledRepExercise(prefix: id)
        let prescription = exercise.prescriptions[0]
        exercise.loggedSets = [LoggedSet(id: .init(rawValue: "logged-progress-1"), prescriptionID: prescription.id, weight: .init(pounds: 135), repetitions: 8, duration: nil, completedAt: timestamp)]
        return workout(id: id, day: day, title: "In Progress", exercises: [exercise], status: .inProgress, startedAt: timestamp)
    }
    public static func midWorkout(day: String = "2025-01-17", id: String = "workout-mid") -> ScheduledWorkout {
        var first = scheduledRepExercise(prefix: "\(id)-first")
        first.loggedSets = first.prescriptions.enumerated().map { index, prescription in
            LoggedSet(id: .init(rawValue: "\(id)-logged-first-\(index)"), prescriptionID: prescription.id, weight: .init(pounds: 135), repetitions: 10, duration: nil, completedAt: timestamp.addingTimeInterval(Double(index)))
        }
        var current = scheduledRepExercise(prefix: "\(id)-current")
        current.nameSnapshot = "Romanian Deadlift"
        current.loggedSets = [LoggedSet(id: .init(rawValue: "\(id)-logged-current"), prescriptionID: current.prescriptions[0].id, weight: .init(pounds: 115), repetitions: 8, duration: nil, completedAt: timestamp)]
        var upcoming = scheduledRepExercise(prefix: "\(id)-upcoming")
        upcoming.nameSnapshot = "Single-Leg Rear-Foot-Elevated Split Squat With Controlled Tempo"
        return workout(id: id, day: day, title: "Lower Body Strength", exercises: [first, current, upcoming, scheduledDurationExercise(prefix: id)], status: .inProgress, startedAt: timestamp)
    }
    public static func completed(day: String = "2025-01-18", id: String = "workout-completed") -> ScheduledWorkout {
        var exercise = scheduledRepExercise(prefix: id)
        exercise.loggedSets = exercise.prescriptions.enumerated().map { index, prescription in
            LoggedSet(id: .init(rawValue: "logged-completed-\(index)"), prescriptionID: prescription.id, weight: .init(pounds: 145), repetitions: 10, duration: nil, completedAt: timestamp.addingTimeInterval(Double(index + 1)))
        }
        return workout(id: id, day: day, title: "Completed Strength", exercises: [exercise], status: .completed, startedAt: timestamp, completedAt: timestamp.addingTimeInterval(600))
    }
    public static let plan = CyclePlan(id: .init(rawValue: "plan-foundation"), name: "Foundation", startDay: try! LocalDay("2025-01-13"), numberOfWeeks: 2, days: [.init(weekday: .monday, workoutTemplateID: templateID), .init(weekday: .wednesday, workoutTemplateID: templateID), .init(weekday: .friday, workoutTemplateID: templateID)], status: .draft, pausedUntil: nil, endedOn: nil, createdAt: timestamp, updatedAt: timestamp)

    public static func backup(workouts: [ScheduledWorkout] = [planned(), mixed(), inProgress(), completed()]) throws -> EquilibriumBackupV1 {
        try EquilibriumBackupV1(exportedAt: timestamp, sourceDeviceID: "fixture-installation", exercises: exercises, workoutTemplates: [template], scheduledWorkouts: workouts, cyclePlans: [plan], settings: settings, progression: progression)
    }
    private static func workout(id: String, day: String, title: String, exercises: [ScheduledExercise], status: WorkoutStatus, startedAt: Date? = nil, completedAt: Date? = nil) -> ScheduledWorkout {
        ScheduledWorkout(id: .init(rawValue: id), day: try! LocalDay(day), titleSnapshot: title, templateID: templateID, planID: nil, source: .manual, exercises: exercises, status: status, startedAt: startedAt, completedAt: completedAt, createdAt: timestamp, updatedAt: timestamp)
    }
    private static func scheduledRepExercise(prefix: String) -> ScheduledExercise {
        ScheduledExercise(id: .init(rawValue: "\(prefix)-exercise-squat"), exerciseID: squatID, nameSnapshot: "Back Squat", prescriptions: repPrescriptions(prefix: "\(prefix)-squat"), loggedSets: [], restDuration: 120, skippedAt: nil)
    }
    private static func scheduledDurationExercise(prefix: String) -> ScheduledExercise {
        let prescription = SetPrescription(id: .init(rawValue: "\(prefix)-plank-1"), target: .duration(seconds: 45), suggestedWeight: nil)
        return ScheduledExercise(id: .init(rawValue: "\(prefix)-exercise-plank"), exerciseID: plankID, nameSnapshot: "Plank", prescriptions: [prescription], loggedSets: [], restDuration: 60, skippedAt: nil)
    }
    private static func repPrescriptions(prefix: String) -> [SetPrescription] {
        (1...3).map { SetPrescription(id: .init(rawValue: "\(prefix)-\($0)"), target: .repetitions(range: 8...12), suggestedWeight: .init(pounds: 135)) }
    }
}
