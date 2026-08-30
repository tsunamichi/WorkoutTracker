import CryptoKit
import Foundation

struct LegacyImportMaterialization: Sendable {
    let sourceDigest: String
    let exercises: [ExerciseDefinition]
    let workouts: [Workout]
    let settings: AppSettings?
    let progression: ProgressionConfiguration?
    let timers: [StandaloneTimerConfiguration]
    let skippedMalformedCount: Int
}

enum RNLegacyTransformer {
    static func transform(data: Data) throws -> LegacyImportMaterialization {
        let payload = try RNLegacyPayloadDecoder.decode(data)
        let digest = SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
        return try transform(payload, digest: digest)
    }

    static func transform(_ payload: RNLegacyPayload, digest: String) throws -> LegacyImportMaterialization {
        let sourceExercises = reconcile(payload.exercises, id: \.id) { lhs, rhs in
            (lhs.createdAt ?? "", lhs.name, lhs.canonicalName ?? "") < (rhs.createdAt ?? "", rhs.name, rhs.canonicalName ?? "")
        }
        var definitions = Dictionary(uniqueKeysWithValues: sourceExercises.map { source -> (String, ExerciseDefinition) in
            let name = source.name.trimmingCharacters(in: .whitespacesAndNewlines)
            let normalized = source.canonicalName?.trimmingCharacters(in: .whitespacesAndNewlines).nonempty ?? SwiftDataRepository.normalizeExerciseName(name)
            return (source.id, ExerciseDefinition(id: exerciseID(source.id), name: name.nonempty ?? "Imported Exercise", normalizedName: normalized, aliases: Array(Set(source.aliases ?? [])).sorted(), equipment: source.equipment, category: source.category, isCustom: source.isCustom ?? false, archivedAt: date(source.archivedAt)))
        })

        let templates = Dictionary(uniqueKeysWithValues: reconcile(payload.workoutTemplates, id: \.id) { $0.name < $1.name }.map { ($0.id, $0) })
        let scheduled = reconcile(payload.scheduledWorkouts, id: \.id) { rank($0) < rank($1) }
        var workouts: [Workout] = []; var malformed = 0
        var representedTemplateDates = Set<String>()
        for source in scheduled {
            guard source.status == "completed" || source.status == "in_progress" else { continue }
            let progress = payload.detailedProgress[source.id] ?? source.templateId.flatMap { payload.detailedProgress["\($0)-\(source.date)"] }
            let snapshot = source.exercisesSnapshot ?? source.templateId.flatMap { templates[$0]?.items } ?? []
            guard !snapshot.isEmpty || progress != nil else { malformed += 1; continue }
            for item in snapshot where definitions[item.exerciseId] == nil {
                definitions[item.exerciseId] = syntheticDefinition(id: item.exerciseId, name: item.nameSnapshot)
            }
            guard let workout = scheduledWorkout(source, snapshot: snapshot, progress: progress, definitions: definitions) else { malformed += 1; continue }
            try DomainValidator.validate(workout); workouts.append(workout)
            if let templateID = source.templateId { representedTemplateDates.insert("\(templateID)|\(source.date)") }
        }

        let sessions = reconcile(payload.sessions, id: \.id) { ($0.endTime ?? $0.startTime ?? $0.date) < ($1.endTime ?? $1.startTime ?? $1.date) }
        for source in sessions {
            if let templateID = source.workoutTemplateId, representedTemplateDates.contains("\(templateID)|\(source.date)") { continue }
            for set in source.sets where definitions[set.exerciseId] == nil { definitions[set.exerciseId] = syntheticDefinition(id: set.exerciseId, name: nil) }
            guard let workout = sessionWorkout(source, title: source.workoutTemplateId.flatMap { templates[$0]?.name }, definitions: definitions) else { malformed += 1; continue }
            try DomainValidator.validate(workout); workouts.append(workout)
        }

        workouts = reconcile(workouts, id: { $0.id.rawValue }) { ($0.updatedAt, $0.titleSnapshot) < ($1.updatedAt, $1.titleSnapshot) }
        let settings = payload.settings.map { source -> AppSettings in
            let rest = source.restTimerDefaultSeconds.flatMap(validRest) ?? 90
            return .init(weightUnit: source.useKg == true ? .kilograms : .pounds, defaultRestDuration: rest)
        }
        let assignments = progressionAssignments(payload: payload, exercises: sourceExercises)
        let progression: ProgressionConfiguration? = payload.settings != nil || !assignments.isEmpty
            ? .init(isEnabled: payload.settings?.progressionSuggestionsEnabled ?? true, defaults: FixtureDefaults.progression.defaults, groups: [], overrides: [], assignments: assignments) : nil
        let timers = reconcile(payload.timers.filter { $0.isTemplate != false }, id: \.id) { ($0.createdAt ?? "", $0.name) < ($1.createdAt ?? "", $1.name) }.compactMap(timer)
        return .init(sourceDigest: digest, exercises: definitions.values.sorted { $0.id.rawValue < $1.id.rawValue }, workouts: workouts.sorted { $0.createdAt < $1.createdAt }, settings: settings, progression: progression, timers: timers, skippedMalformedCount: malformed)
    }

    private static func scheduledWorkout(_ source: RNScheduledWorkoutDTO, snapshot: [RNTemplateExerciseDTO], progress: RNWorkoutProgressDTO?, definitions: [String: ExerciseDefinition]) -> Workout? {
        let isCompleted = source.status == "completed"
        let completedAt = isCompleted ? (date(source.completedAt) ?? date(source.date)) : nil
        let startedAt = date(source.startedAt) ?? (isCompleted ? date(source.date) : date(progress?.lastUpdated))
        guard let start = startedAt, !isCompleted || completedAt != nil else { return nil }
        let ordered = snapshot.sorted { ($0.order ?? 0, $0.id) < ($1.order ?? 0, $1.id) }
        let exercises = ordered.enumerated().map { position, item in
            let occurrenceProgress = progress?.exercises[item.id] ?? progress?.exercises[item.exerciseId]
            return workoutExercise(sourceID: source.id, position: position, item: item, progress: occurrenceProgress, completedAt: completedAt, logDate: date(progress?.lastUpdated) ?? start, completedWorkout: isCompleted, definition: definitions[item.exerciseId])
        }
        let updated = completedAt ?? date(progress?.lastUpdated) ?? start
        return Workout(id: workoutID("scheduled", source.id), titleSnapshot: source.titleSnapshot?.nonempty ?? "Imported Workout", exercises: exercises, status: isCompleted ? .completed : .inProgress, startedAt: start, completedAt: completedAt, createdAt: start, updatedAt: updated)
    }

    private static func workoutExercise(sourceID: String, position: Int, item: RNTemplateExerciseDTO, progress: RNExerciseProgressDTO?, completedAt: Date?, logDate: Date, completedWorkout: Bool, definition: ExerciseDefinition?) -> WorkoutExercise {
        let timeBased = item.isTimeBased == true || definition?.name.lowercased().contains("hold") == true && definition?.category == "Core"
        let allSourceSets = progress?.sets ?? []
        let sourceSets = completedWorkout ? allSourceSets.filter(\.completed) : allSourceSets
        let targetCount = completedWorkout ? sourceSets.filter(\.completed).count : max(item.sets ?? 0, sourceSets.count)
        let range = repetitionRange(item.reps)
        var prescriptions: [SetPrescription] = []; var logs: [LoggedSet] = []
        for index in 0..<targetCount {
            let sourceSet = sourceSets.indices.contains(index) ? sourceSets[index] : nil
            let value = sourceSet?.reps.flatMap { $0 > 0 ? $0 : nil }
            let target: SetTarget = timeBased ? .duration(seconds: TimeInterval(value ?? max(1, range.lowerBound))) : .repetitions(range: value.map { $0...$0 } ?? range)
            let prescriptionID = SetID(rawValue: "rn-prescription:\(sourceID):\(position):\(item.id):\(index)")
            prescriptions.append(.init(id: prescriptionID, target: target, suggestedWeight: positiveWeight(sourceSet?.weight ?? item.weight)))
            if sourceSet?.completed == true, let value {
                logs.append(.init(id: .init(rawValue: "rn-log:\(sourceID):\(position):\(item.id):\(index)"), prescriptionID: prescriptionID, weight: positiveWeight(sourceSet?.weight), repetitions: timeBased ? nil : value, duration: timeBased ? TimeInterval(value) : nil, completedAt: completedAt ?? logDate))
            }
        }
        let skippedAt = progress?.skipped == true || (completedWorkout && prescriptions.isEmpty) ? completedAt : nil
        return WorkoutExercise(id: .init(rawValue: "rn-occurrence:\(sourceID):\(item.id):\(position)"), exerciseID: exerciseID(item.exerciseId), nameSnapshot: item.nameSnapshot?.nonempty ?? definition?.name ?? "Imported Exercise", prescriptions: prescriptions, loggedSets: logs, restDuration: validRest(item.restSeconds), skippedAt: skippedAt, isTimeBased: timeBased, isTwoSided: item.isPerSide ?? false)
    }

    private static func sessionWorkout(_ source: RNSessionDTO, title: String?, definitions: [String: ExerciseDefinition]) -> Workout? {
        let completedSets = source.sets.filter { $0.isCompleted != false && ($0.reps ?? 0) > 0 }
        guard !completedSets.isEmpty, let completedAt = date(source.endTime) ?? date(source.date) else { return nil }
        let start = date(source.startTime) ?? completedAt
        var order: [String] = []; for set in completedSets where !order.contains(set.exerciseId) { order.append(set.exerciseId) }
        let exercises = order.enumerated().map { exercisePosition, exerciseIDValue -> WorkoutExercise in
            let sets = completedSets.filter { $0.exerciseId == exerciseIDValue }.sorted { ($0.setIndex ?? 0, $0.id ?? "") < ($1.setIndex ?? 0, $1.id ?? "") }
            let prescriptions = sets.enumerated().map { index, set in SetPrescription(id: .init(rawValue: "rn-session-prescription:\(source.id):\(exerciseIDValue):\(set.id ?? "missing"):\(index)"), target: .repetitions(range: set.reps!...set.reps!), suggestedWeight: positiveWeight(set.weight)) }
            let logs = sets.enumerated().map { index, set in LoggedSet(id: .init(rawValue: "rn-session-log:\(source.id):\(exerciseIDValue):\(set.id ?? "missing"):\(index)"), prescriptionID: prescriptions[index].id, weight: positiveWeight(set.weight), repetitions: set.reps, duration: nil, completedAt: completedAt) }
            return WorkoutExercise(id: .init(rawValue: "rn-session-occurrence:\(source.id):\(exerciseIDValue):\(exercisePosition)"), exerciseID: exerciseID(exerciseIDValue), nameSnapshot: definitions[exerciseIDValue]?.name ?? "Imported Exercise", prescriptions: prescriptions, loggedSets: logs, restDuration: nil, skippedAt: nil, isTimeBased: false)
        }
        return .init(id: workoutID("session", source.id), titleSnapshot: title?.nonempty ?? "Imported Workout", exercises: exercises, status: .completed, startedAt: start, completedAt: completedAt, createdAt: start, updatedAt: completedAt)
    }

    private static func progressionAssignments(payload: RNLegacyPayload, exercises: [RNExerciseDTO]) -> [ExerciseID: AutoProgressionProfile] {
        let groups = Dictionary(uniqueKeysWithValues: payload.progressionGroups.map { ($0.id, $0) })
        let rules = Dictionary(uniqueKeysWithValues: reconcile(payload.progressionRules, id: \.exerciseId) { ($0.groupId ?? "", $0.progressionMode ?? "") < ($1.groupId ?? "", $1.progressionMode ?? "") }.map { ($0.exerciseId, $0) })
        var result: [ExerciseID: AutoProgressionProfile] = [:]
        for exercise in exercises {
            let direct: AutoProgressionProfile? = switch exercise.defaultProgressionType {
            case "main_upper": .upper; case "main_lower": .lower; case "accessory": .accessories; case "none": AutoProgressionProfile.none; default: nil
            }
            if let direct { result[exerciseID(exercise.id)] = direct; continue }
            let rule = rules[exercise.id], group = rule?.groupId.flatMap { groups[$0] } ?? payload.progressionGroups.first { $0.exerciseIds.contains(exercise.id) }
            let min = rule?.repRangeMin ?? group?.repRangeMin ?? payload.progressionDefaults?.repRangeMin
            let max = rule?.repRangeMax ?? group?.repRangeMax ?? payload.progressionDefaults?.repRangeMax
            let increment = rule?.weightIncrement ?? group?.weightIncrement ?? payload.progressionDefaults?.weightIncrement
            let profile: AutoProgressionProfile = if min == 5 && max == 8 && increment == 2.5 { .upper } else if min == 5 && max == 8 && increment == 5 { .lower } else if min == 10 && max == 20 && increment == 2.5 { .accessories } else { .none }
            result[exerciseID(exercise.id)] = profile
        }
        return result
    }

    private static func timer(_ source: RNTimerDTO) -> StandaloneTimerConfiguration? {
        let created = date(source.createdAt) ?? Date(timeIntervalSince1970: 0)
        let value = StandaloneTimerConfiguration(id: "rn-timer:\(source.id)", name: source.name, moveDuration: source.work, exerciseRestDuration: source.workRest, exercisesPerRound: source.sets, rounds: source.rounds, roundRestDuration: source.roundRest, createdAt: created, updatedAt: created)
        return value.isValid ? value : nil
    }
    private static func rank(_ value: RNScheduledWorkoutDTO) -> (String, String, String) { (value.completedAt ?? value.startedAt ?? value.date, value.status, value.titleSnapshot ?? "") }
    private static func repetitionRange(_ value: RNFlexibleReps?) -> ClosedRange<Int> {
        switch value { case .number(let number): return max(1, number)...max(1, number); case .text(let text): let values = text.split(whereSeparator: { !$0.isNumber }).compactMap { Int($0) }; return max(1, values.first ?? 1)...max(1, values.dropFirst().first ?? values.first ?? 1); case nil: return 1...1 }
    }
    private static func positiveWeight(_ value: Double?) -> Weight? { value.flatMap { $0.isFinite && $0 > 0 ? Weight(pounds: $0) : nil } }
    private static func validRest(_ value: Double?) -> Double? { value.flatMap { $0.isFinite && $0 >= 15 && $0 <= 300 && $0.rounded() == $0 && Int($0) % 5 == 0 ? $0 : nil } }
    private static func exerciseID(_ source: String) -> ExerciseID { .init(rawValue: "rn-exercise:\(source)") }
    private static func workoutID(_ kind: String, _ source: String) -> WorkoutID { .init(rawValue: "rn-\(kind):\(source)") }
    private static func syntheticDefinition(id: String, name: String?) -> ExerciseDefinition { let value = name?.nonempty ?? "Imported Exercise"; return .init(id: exerciseID(id), name: value, normalizedName: SwiftDataRepository.normalizeExerciseName(value), aliases: [], equipment: nil, category: nil, isCustom: true, archivedAt: nil) }
    private static func date(_ value: String?) -> Date? {
        guard let value else { return nil }
        if let date = ISO8601DateFormatter.fractional.date(from: value) ?? ISO8601DateFormatter().date(from: value) { return date }
        return DateFormatter.legacyDay.date(from: value)
    }
    private static func reconcile<T, ID: Hashable>(_ values: [T], id: (T) -> ID, older: (T, T) -> Bool) -> [T] { Dictionary(grouping: values, by: id).values.compactMap { $0.max(by: older) } }
}

private extension String { var nonempty: String? { isEmpty ? nil : self } }
private extension ISO8601DateFormatter { static let fractional: ISO8601DateFormatter = { let value = ISO8601DateFormatter(); value.formatOptions = [.withInternetDateTime, .withFractionalSeconds]; return value }() }
private extension DateFormatter { static let legacyDay: DateFormatter = { let value = DateFormatter(); value.locale = Locale(identifier: "en_US_POSIX"); value.timeZone = TimeZone(secondsFromGMT: 0); value.dateFormat = "yyyy-MM-dd"; return value }() }
