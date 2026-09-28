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
    public static func defaultSeed(existingExercises: [ExerciseDefinition] = []) -> (definitions: [ExerciseDefinition], workouts: [Workout]) {
        let catalog = existingExercises.sorted { $0.id.rawValue < $1.id.rawValue }
        var definitionsByName: [String: ExerciseDefinition] = [:]
        for definition in catalog {
            for name in [definition.name] + definition.aliases {
                let key = SwiftDataRepository.normalizeExerciseName(name)
                if definitionsByName[key] == nil { definitionsByName[key] = definition }
            }
        }

        var newDefinitions: [ExerciseDefinition] = []
        let workoutSpecs: [(id: String, title: String, exercises: [DefaultSeedExercise])] = [
            (
                id: "default-lower-quad-p2",
                title: "Lower Quad — P2",
                exercises: [
                    .init(name: "Spanish Squat ISO", sets: 2, repetitions: nil, durationSeconds: 45, pounds: nil),
                    .init(name: "Hip Airplane", sets: 2, repetitions: 11, durationSeconds: nil, pounds: nil),
                    .init(name: "Hamstring Scoops", sets: 1, repetitions: 10, durationSeconds: nil, pounds: nil),
                    .init(name: "Reverse Nordic", sets: 4, repetitions: 10, durationSeconds: nil, pounds: nil),
                    .init(name: "Single-leg Leg Press", sets: 3, repetitions: 10, durationSeconds: nil, pounds: nil),
                    .init(name: "Single-leg Leg Extension", sets: 3, repetitions: 10, durationSeconds: nil, pounds: nil),
                    .init(name: "Tibialis Raise", sets: 3, repetitions: 15, durationSeconds: nil, pounds: nil),
                    .init(name: "Single-leg RDL", sets: 4, repetitions: 11, durationSeconds: nil, pounds: nil),
                    .init(name: "Standing Calf Raise", sets: 3, repetitions: 15, durationSeconds: nil, pounds: nil)
                ]
            ),
            (
                id: "default-upper-push-p2",
                title: "Upper Push — P2",
                exercises: [
                    .init(name: "Cable External Rotation", sets: 2, repetitions: 14, durationSeconds: nil, pounds: nil),
                    .init(name: "Banded Face Pull", sets: 2, repetitions: 14, durationSeconds: nil, pounds: nil),
                    .init(name: "Serratus Wall Slide", sets: 2, repetitions: 15, durationSeconds: nil, pounds: nil),
                    .init(name: "Push-Up Plus", sets: 2, repetitions: 12, durationSeconds: nil, pounds: nil),
                    .init(name: "Bench Press", sets: 4, repetitions: 5, durationSeconds: nil, pounds: 160),
                    .init(name: "Incline Dumbbell Press", sets: 3, repetitions: 13, durationSeconds: nil, pounds: 40),
                    .init(name: "Machine Shoulder Press", sets: 3, repetitions: 6, durationSeconds: nil, pounds: 80),
                    .init(name: "Low-to-High Cable Fly", sets: 3, repetitions: 13, durationSeconds: nil, pounds: 20),
                    .init(name: "Cable Lateral Raise", sets: 3, repetitions: 10, durationSeconds: nil, pounds: 15),
                    .init(name: "Rope Pushdown", sets: 3, repetitions: 15, durationSeconds: nil, pounds: 42.5),
                    .init(name: "Chest Dips", sets: 2, repetitions: 10, durationSeconds: nil, pounds: 7.5)
                ]
            ),
            (
                id: "default-upper-pull-p2",
                title: "Upper Pull — P2",
                exercises: [
                    .init(name: "Band Pull Apart", sets: 2, repetitions: 15, durationSeconds: nil, pounds: nil),
                    .init(name: "Scapular Pull-Up", sets: 2, repetitions: 10, durationSeconds: nil, pounds: nil),
                    .init(name: "Lat Pulldown", sets: 4, repetitions: 8, durationSeconds: nil, pounds: nil),
                    .init(name: "Chest-Supported Row", sets: 3, repetitions: 10, durationSeconds: nil, pounds: nil),
                    .init(name: "Single-arm Cable Row", sets: 3, repetitions: 10, durationSeconds: nil, pounds: nil),
                    .init(name: "Reverse Pec Deck", sets: 3, repetitions: 12, durationSeconds: nil, pounds: nil),
                    .init(name: "Face Pull", sets: 3, repetitions: 12, durationSeconds: nil, pounds: nil),
                    .init(name: "Incline Dumbbell Curl", sets: 3, repetitions: 10, durationSeconds: nil, pounds: nil),
                    .init(name: "Hammer Curl", sets: 3, repetitions: 12, durationSeconds: nil, pounds: nil),
                    .init(name: "Farmer Carry", sets: 3, repetitions: nil, durationSeconds: 30, pounds: nil)
                ]
            )
        ]

        let workouts = workoutSpecs.enumerated().map { workoutIndex, workoutSpec in
            let exercises = workoutSpec.exercises.map { exerciseSpec -> WorkoutExercise in
                let exerciseSlug = Self.seedSlug(exerciseSpec.name)
                let normalizedName = SwiftDataRepository.normalizeExerciseName(exerciseSpec.name)
                let definition: ExerciseDefinition
                if let existing = definitionsByName[normalizedName] {
                    definition = existing
                } else {
                    definition = ExerciseDefinition(
                        id: .init(rawValue: "default-exercise-\(exerciseSlug)"),
                        name: exerciseSpec.name,
                        normalizedName: normalizedName,
                        aliases: [],
                        equipment: nil,
                        category: nil,
                        isCustom: false,
                        archivedAt: nil
                    )
                    definitionsByName[normalizedName] = definition
                    newDefinitions.append(definition)
                }
                let occurrenceID = "\(workoutSpec.id)-\(exerciseSlug)"
                let target: SetTarget
                switch (exerciseSpec.repetitions, exerciseSpec.durationSeconds) {
                case let (.some(repetitions), .none):
                    target = .repetitions(range: repetitions...repetitions)
                case let (.none, .some(duration)):
                    target = .duration(seconds: TimeInterval(duration))
                default:
                    preconditionFailure("Default seed exercises must have exactly one target type.")
                }
                let prescriptions = (1...exerciseSpec.sets).map { setNumber in
                    return SetPrescription(
                        id: .init(rawValue: "\(occurrenceID)-set-\(setNumber)"),
                        target: target,
                        suggestedWeight: exerciseSpec.pounds.map(Weight.init(pounds:))
                    )
                }
                return WorkoutExercise(
                    id: .init(rawValue: "\(occurrenceID)-occurrence"),
                    exerciseID: definition.id,
                    nameSnapshot: exerciseSpec.name,
                    prescriptions: prescriptions,
                    loggedSets: [],
                    restDuration: nil,
                    skippedAt: nil,
                    isTimeBased: exerciseSpec.durationSeconds != nil
                )
            }
            return Workout(
                id: .init(rawValue: workoutSpec.id),
                titleSnapshot: workoutSpec.title,
                exercises: exercises,
                status: .ready,
                startedAt: nil,
                completedAt: nil,
                createdAt: timestamp.addingTimeInterval(TimeInterval(workoutIndex)),
                updatedAt: timestamp.addingTimeInterval(TimeInterval(workoutIndex))
            )
        }
        return (newDefinitions, workouts)
    }

    public static func ready(id: String = "workout-ready") -> Workout {
        workout(id: id, title: "Lower Strength", exercises: [repExercise(prefix: id)], status: .ready)
    }
    public static func mixed(id: String = "workout-mixed") -> Workout {
        workout(id: id, title: "Mixed Session", exercises: [repExercise(prefix: id), durationExercise(prefix: id)], status: .ready)
    }
    public static func motionAudit(id: String = "workout-motion-audit") -> Workout {
        var repetitions = repExercise(prefix: "\(id)-repetitions")
        repetitions.nameSnapshot = "Cable Row"
        repetitions.prescriptions = Array(repetitions.prescriptions.prefix(2))
        repetitions.restDuration = 5

        var duration = durationExercise(prefix: "\(id)-duration")
        duration.nameSnapshot = "Roman Chair Hold"
        duration.prescriptions = (1...2).map {
            SetPrescription(
                id: .init(rawValue: "\(id)-duration-\($0)"),
                target: .duration(seconds: 3),
                suggestedWeight: nil
            )
        }
        duration.restDuration = 5

        return workout(
            id: id,
            title: "Motion Audit",
            exercises: [repetitions, duration],
            status: .ready
        )
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

    private static func seedSlug(_ name: String) -> String {
        SwiftDataRepository.normalizeExerciseName(name).replacingOccurrences(of: " ", with: "-")
    }

    private struct DefaultSeedExercise {
        let name: String
        let sets: Int
        let repetitions: Int?
        let durationSeconds: Int?
        let pounds: Double?
    }
}
