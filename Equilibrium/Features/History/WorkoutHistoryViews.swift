import Charts
import Observation
import SwiftUI

@MainActor @Observable
final class WorkoutHistoryModel {
    private let repository: any WorkoutRepository
    private(set) var workouts: [Workout] = []
    private(set) var errorMessage: String?
    init(repository: any WorkoutRepository) { self.repository = repository }
    func load() async {
        do { workouts = try await repository.completedWorkouts(); errorMessage = nil }
        catch { errorMessage = "Workout history could not be loaded." }
    }
}

struct WorkoutHistoryView: View {
    @State private var model: WorkoutHistoryModel
    let historyRepository: any ExerciseHistoryRepository
    @AppStorage(EQPreferenceKey.weightUnit) private var unitRaw = WeightUnit.pounds.rawValue
    init(repository: any WorkoutRepository, historyRepository: any ExerciseHistoryRepository) {
        _model = State(initialValue: WorkoutHistoryModel(repository: repository)); self.historyRepository = historyRepository
    }
    var body: some View {
        Group {
            if model.workouts.isEmpty, model.errorMessage == nil {
                ContentUnavailableView("No completed workouts", systemImage: "clock.arrow.circlepath", description: Text("Completed workouts will appear here."))
            } else {
                List(model.workouts) { workout in
                    NavigationLink {
                        CompletedWorkoutDetailView(workout: workout, historyRepository: historyRepository, weightUnit: unit)
                    } label: { WorkoutHistoryRow(workout: workout) }
                }.listStyle(.plain).scrollContentBackground(.hidden)
            }
        }
        .overlay { if let message = model.errorMessage { ContentUnavailableView("History unavailable", systemImage: "exclamationmark.triangle", description: Text(message)) } }
        .background(EQColor.canvas).navigationTitle("Workout History").task { await model.load() }
    }
    private var unit: WeightUnit { WeightUnit(rawValue: unitRaw) ?? .pounds }
}

private struct WorkoutHistoryRow: View {
    let workout: Workout
    var body: some View {
        VStack(alignment: .leading, spacing: EQSpacing.xs) {
            Text(workout.titleSnapshot).font(EQTypography.cardTitle)
            Text(HistoryDateText.full(WorkoutHistoryQuery.completionDate(workout))).font(EQTypography.caption).foregroundStyle(EQColor.secondaryText)
            Text(summary).font(EQTypography.caption).foregroundStyle(EQColor.secondaryText)
        }.padding(.vertical, EQSpacing.xs).accessibilityElement(children: .combine)
    }
    private var summary: String {
        let sets = workout.exercises.reduce(0) { $0 + ExercisePerformanceQuery.validCompletedSets(in: $1).count }
        return "\(workout.exercises.count) \(workout.exercises.count == 1 ? "exercise" : "exercises") · \(sets) \(sets == 1 ? "set" : "sets")"
    }
}

struct CompletedWorkoutDetailView: View {
    let workout: Workout
    let historyRepository: any ExerciseHistoryRepository
    let weightUnit: WeightUnit
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: EQSpacing.lg) {
                VStack(alignment: .leading, spacing: EQSpacing.xs) {
                    Text(workout.titleSnapshot).font(EQTypography.title)
                    Text(HistoryDateText.full(WorkoutHistoryQuery.completionDate(workout))).foregroundStyle(EQColor.secondaryText)
                    Label("Completed · Read-only", systemImage: "lock.fill").font(EQTypography.caption).foregroundStyle(EQColor.success)
                }
                ForEach(Array(workout.exercises.enumerated()), id: \.element.id) { index, exercise in
                    VStack(alignment: .leading, spacing: EQSpacing.sm) {
                        HStack(alignment: .firstTextBaseline) {
                            Text("\(index + 1). \(exercise.nameSnapshot)").font(EQTypography.exerciseTitle)
                            Spacer()
                            NavigationLink {
                                ExercisePerformanceView(exerciseID: exercise.exerciseID, fallbackName: exercise.nameSnapshot, repository: historyRepository, weightUnit: weightUnit)
                            } label: { Label("Performance", systemImage: "chart.xyaxis.line") }.font(EQTypography.caption)
                        }
                        let sets = ExercisePerformanceQuery.validCompletedSets(in: exercise)
                        if sets.isEmpty { Text("No completed working sets").foregroundStyle(EQColor.secondaryText) }
                        ForEach(Array(sets.enumerated()), id: \.element.id) { setIndex, set in
                            Text("Set \(setIndex + 1) · \(setSummary(set))").font(EQTypography.body).accessibilityLabel("Set \(setIndex + 1), \(setSummary(set))")
                        }
                    }.eqCard()
                }
            }.padding(EQSpacing.md)
        }.background(EQColor.canvas).navigationTitle("Completed Workout").navigationBarTitleDisplayMode(.inline)
    }
    private func setSummary(_ set: LoggedSet) -> String {
        if let duration = set.duration { return DurationText.format(duration) }
        let reps = set.repetitions.map { "\($0) reps" } ?? "Repetitions unavailable"
        guard let weight = set.weight else { return reps + " · bodyweight" }
        return "\(WeightText.value(weight, unit: weightUnit)) \(weightUnit == .pounds ? "lb" : "kg") · \(reps)"
    }
}

@MainActor @Observable
final class ExercisePerformanceModel {
    private let exerciseID: ExerciseID
    private let repository: any ExerciseHistoryRepository
    private(set) var performance: ExercisePerformance?
    private(set) var errorMessage: String?
    init(exerciseID: ExerciseID, repository: any ExerciseHistoryRepository) { self.exerciseID = exerciseID; self.repository = repository }
    func load() async {
        do { performance = try await repository.exercisePerformance(exerciseID: exerciseID); errorMessage = nil }
        catch { errorMessage = "Exercise performance could not be loaded." }
    }
}

struct ExercisePerformanceView: View {
    @State private var model: ExercisePerformanceModel
    let fallbackName: String
    let weightUnit: WeightUnit
    init(exerciseID: ExerciseID, fallbackName: String, repository: any ExerciseHistoryRepository, weightUnit: WeightUnit) {
        _model = State(initialValue: .init(exerciseID: exerciseID, repository: repository)); self.fallbackName = fallbackName; self.weightUnit = weightUnit
    }
    var body: some View {
        ScrollView {
            if let performance = model.performance {
                if performance.occurrences.isEmpty {
                    ContentUnavailableView("No previous performance", systemImage: "chart.xyaxis.line", description: Text("Completed working sets will appear here."))
                } else {
                    VStack(alignment: .leading, spacing: EQSpacing.lg) {
                        prCard(performance)
                        PerformanceTrendView(family: performance.activeMetricFamily, points: performance.trend, weightUnit: weightUnit)
                        occurrences(performance)
                    }.padding(EQSpacing.md)
                }
            } else if model.errorMessage == nil { ProgressView("Loading performance").padding(.top, EQSpacing.xl) }
        }
        .overlay { if let message = model.errorMessage { ContentUnavailableView("Performance unavailable", systemImage: "exclamationmark.triangle", description: Text(message)) } }
        .background(EQColor.canvas).navigationTitle(model.performance?.displayName ?? fallbackName).navigationBarTitleDisplayMode(.inline).task { await model.load() }
    }
    private func prCard(_ performance: ExercisePerformance) -> some View {
        VStack(alignment: .leading, spacing: EQSpacing.xs) {
            Text("PERSONAL RECORD").font(EQTypography.caption.weight(.bold))
            Text(prText(performance.personalRecord)).font(EQTypography.sectionTitle)
            Text("Derived from completed workout logs").font(EQTypography.caption).foregroundStyle(EQColor.secondaryText)
        }.frame(maxWidth: .infinity, alignment: .leading).eqCard(elevated: true)
    }
    private func occurrences(_ performance: ExercisePerformance) -> some View {
        VStack(alignment: .leading, spacing: EQSpacing.sm) {
            Text("WORKING SET HISTORY").font(EQTypography.caption.weight(.bold))
            ForEach(performance.occurrences.reversed()) { occurrence in
                VStack(alignment: .leading, spacing: EQSpacing.xs) {
                    Text(occurrence.workoutTitleSnapshot).font(EQTypography.cardTitle)
                    Text("\(HistoryDateText.full(occurrence.occurredAt)) · \(occurrence.exerciseNameSnapshot)").font(EQTypography.caption).foregroundStyle(EQColor.secondaryText)
                    ForEach(Array(occurrence.sets.enumerated()), id: \.element.id) { index, set in Text("Set \(index + 1): \(performanceSetText(set))").font(EQTypography.caption) }
                }.eqCard()
            }
        }
    }
    private func prText(_ record: ExercisePersonalRecord?) -> String {
        guard let record else { return "No PR yet" }
        switch record {
        case .duration(let set): return DurationText.format(set.duration ?? 0)
        case .repetitions(let set): return performanceSetText(set)
        }
    }
    private func performanceSetText(_ set: LoggedSet) -> String {
        if let duration = set.duration { return DurationText.format(duration) }
        let reps = "\(set.repetitions ?? 0) reps"
        guard let weight = set.weight else { return reps + " · bodyweight" }
        return "\(WeightText.value(weight, unit: weightUnit)) \(weightUnit == .pounds ? "lb" : "kg") × \(set.repetitions ?? 0)"
    }
}

private enum DurationText {
    static func format(_ interval: TimeInterval) -> String {
        let seconds = max(0, Int(interval.rounded()))
        return seconds >= 60 ? String(format: "%d:%02d", seconds / 60, seconds % 60) : "\(seconds) sec"
    }
}

private struct PerformanceTrendView: View {
    let family: ExercisePerformanceMetricFamily?
    let points: [ExerciseTrendPoint]
    let weightUnit: WeightUnit
    private var selected: [(ExerciseTrendPoint, Double)] {
        guard let family else { return [] }
        switch family {
        case .weightedRepetitions: return points.compactMap { point in if case .weight(let pounds, _) = point.value { return (point, Weight(pounds: pounds).value(in: weightUnit)) }; return nil }
        case .unweightedRepetitions: return points.compactMap { point in if case .repetitions(let reps) = point.value { return (point, Double(reps)) }; return nil }
        case .duration: return points.compactMap { point in if case .duration(let seconds) = point.value { return (point, seconds) }; return nil }
        }
    }
    var body: some View {
        VStack(alignment: .leading, spacing: EQSpacing.sm) {
            Text("TREND").font(EQTypography.caption.weight(.bold))
            if selected.isEmpty { Text("No trend data").foregroundStyle(EQColor.secondaryText) }
            else if selected.count == 1 { Text("One completed occurrence · \(valueText(selected[0]))").font(EQTypography.body) }
            else {
                Chart(selected, id: \.0.id) { item in
                    LineMark(x: .value("Date", item.0.occurredAt), y: .value(metricLabel, item.1)).foregroundStyle(EQColor.accent)
                    PointMark(x: .value("Date", item.0.occurredAt), y: .value(metricLabel, item.1)).foregroundStyle(EQColor.accent)
                }.frame(height: 180).accessibilityHidden(true)
            }
            ForEach(selected, id: \.0.id) { item in Text("\(HistoryDateText.short(item.0.occurredAt)): \(valueText(item))").font(EQTypography.caption).foregroundStyle(EQColor.secondaryText) }
        }.eqCard()
    }
    private var metricLabel: String {
        guard let value = selected.last?.0.value else { return "Performance" }
        switch value { case .weight: return weightUnit == .pounds ? "Weight (lb)" : "Weight (kg)"; case .repetitions: return "Repetitions"; case .duration: return "Duration (seconds)" }
    }
    private func valueText(_ item: (ExerciseTrendPoint, Double)) -> String {
        switch item.0.value {
        case .weight(_, let reps): return "\(WeightText.format(item.1)) \(weightUnit == .pounds ? "lb" : "kg") × \(reps)"
        case .repetitions: return "\(Int(item.1)) reps"
        case .duration: return DurationText.format(item.1)
        }
    }
}

private enum HistoryDateText {
    static func full(_ date: Date) -> String { date.formatted(.dateTime.weekday(.wide).month(.wide).day().year()) }
    static func short(_ date: Date) -> String { date.formatted(.dateTime.year().month(.twoDigits).day(.twoDigits)) }
}
