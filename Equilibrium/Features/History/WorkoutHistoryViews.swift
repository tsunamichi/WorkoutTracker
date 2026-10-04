import Charts
import Observation
import SwiftUI

struct WorkoutHistoryMonth: Identifiable, Equatable {
    let id: Date
    let workouts: [Workout]

    static func group(_ workouts: [Workout], calendar: Calendar = .current) -> [WorkoutHistoryMonth] {
        var months: [WorkoutHistoryMonth] = []
        for workout in workouts {
            let date = WorkoutHistoryQuery.completionDate(workout)
            let start = calendar.dateInterval(of: .month, for: date)?.start ?? date
            if let last = months.last, last.id == start {
                months[months.count - 1] = .init(id: start, workouts: last.workouts + [workout])
            } else {
                months.append(.init(id: start, workouts: [workout]))
            }
        }
        return months
    }

    func title(now: Date = .now, calendar: Calendar = .current) -> String {
        calendar.isDate(id, equalTo: now, toGranularity: .year)
            ? id.formatted(.dateTime.month(.wide))
            : id.formatted(.dateTime.month(.wide).year())
    }
}

@MainActor @Observable
final class WorkoutHistoryModel {
    /// History reveals completed workouts two weeks at a time, matching the Reuse workout sheet.
    static let pageWeeks = 2
    private let repository: any WorkoutRepository
    private let now: () -> Date
    private let calendar: Calendar
    private(set) var months: [WorkoutHistoryMonth] = []
    private(set) var hasLoaded = false
    private(set) var errorMessage: String?
    private(set) var visibleWeeks = pageWeeks
    private(set) var hasOlderWorkouts = false
    private(set) var hasAnyWorkouts = false
    private var allWorkouts: [Workout] = []
    private var isStale = false
    private var workoutsByID: [WorkoutID: Workout] = [:]
    init(repository: any WorkoutRepository, now: @escaping () -> Date = { .now }, calendar: Calendar = .current) {
        self.repository = repository
        self.now = now
        self.calendar = calendar
    }
    /// Navigation pops re-run `.task`; repository changes arrive via notification, so the initial fetch only runs once.
    func loadIfNeeded() async {
        guard !hasLoaded || isStale else { return }
        await load()
    }
    /// Defers the full reload until the history is visible so set logging never pays for it.
    func invalidate() { isStale = true }
    func workout(id: WorkoutID) -> Workout? { workoutsByID[id] }
    func load() async {
        do {
            allWorkouts = try await repository.recentCompletedWorkouts(limit: .max)
            workoutsByID = Dictionary(allWorkouts.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
            applyWindow()
            isStale = false
            errorMessage = nil
        } catch { errorMessage = "Workout history could not be loaded." }
        hasLoaded = true
    }
    func loadMore() {
        visibleWeeks += Self.pageWeeks
        applyWindow()
    }
    private func applyWindow() {
        let today = calendar.startOfDay(for: now())
        let cutoff = calendar.date(byAdding: .day, value: -7 * visibleWeeks, to: today) ?? .distantPast
        let visible = allWorkouts.filter { WorkoutHistoryQuery.completionDate($0) >= cutoff }
        months = WorkoutHistoryMonth.group(visible, calendar: calendar)
        hasAnyWorkouts = !allWorkouts.isEmpty
        hasOlderWorkouts = visible.count < allWorkouts.count
    }
}

struct WorkoutHistoryView: View {
    @State private var model: WorkoutHistoryModel
    let workoutRepository: any WorkoutRepository
    let historyRepository: any ExerciseHistoryRepository
    let unit: WeightUnit
    let isActive: Bool
    let dismiss: () -> Void
    init(repository: any WorkoutRepository, historyRepository: any ExerciseHistoryRepository, weightUnit: WeightUnit = .pounds, isActive: Bool = true, dismiss: @escaping () -> Void) {
        _model = State(initialValue: WorkoutHistoryModel(repository: repository)); self.workoutRepository = repository; self.historyRepository = historyRepository; unit = weightUnit; self.isActive = isActive; self.dismiss = dismiss
    }
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            header
            if model.hasLoaded, !model.hasAnyWorkouts, model.errorMessage == nil {
                ContentUnavailableView("No completed workouts", systemImage: "clock.arrow.circlepath", description: Text("Completed workouts will appear here."))
            } else {
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: EQLayout.exerciseBlockGap) {
                        ForEach(model.months) { month in
                            VStack(alignment: .leading, spacing: EQSpacing.sm) {
                                Text(month.title().uppercased()).eqTextStyle(.sectionLabel).foregroundStyle(EQColor.secondaryText)
                                VStack(alignment: .leading, spacing: 0) {
                                    ForEach(month.workouts) { workout in
                                        NavigationLink(value: workout.id) { WorkoutHistoryRow(workout: workout) }
                                            .buttonStyle(.plain)
                                    }
                                }
                                .padding(.horizontal, EQSpacing.md)
                                .padding(.vertical, EQSpacing.xs)
                                .background(EQColor.cardFill, in: RoundedRectangle(cornerRadius: EQRadius.card, style: .continuous))
                            }
                        }
                        if model.hasAnyWorkouts {
                            VStack(spacing: 0) {
                                Text(model.hasOlderWorkouts
                                    ? "Showing workouts from the past \(model.visibleWeeks) weeks"
                                    : "Showing every completed workout")
                                    .eqTextStyle(.legal)
                                    .foregroundStyle(EQColor.secondaryText)
                                    .multilineTextAlignment(.center)
                                if model.hasOlderWorkouts {
                                    Button("Load \(WorkoutHistoryModel.pageWeeks) more weeks") {
                                        withAnimation(EQMotion.contentTransition) { model.loadMore() }
                                    }
                                    .eqTextStyle(.body)
                                    .foregroundStyle(EQColor.accent)
                                    .buttonStyle(.plain)
                                    .frame(maxWidth: .infinity, minHeight: EQDimension.minimumTouch)
                                    .contentShape(Rectangle())
                                }
                            }
                            .frame(maxWidth: .infinity)
                        }
                    }
                    .padding(.horizontal, EQLayout.screenGutter)
                    .padding(.top, EQSpacing.md + EQLayout.WorkoutExecution.overviewContentTopInset)
                    .padding(.bottom, EQSpacing.lg)
                }
                .scrollIndicators(.hidden)
            }
        }
        .foregroundStyle(EQColor.primaryText)
        .navigationDestination(for: WorkoutID.self) { id in
            if let workout = model.workout(id: id) {
                CompletedWorkoutDetailView(workout: workout, repository: workoutRepository, historyRepository: historyRepository, weightUnit: unit)
            }
        }
        .overlay { if let message = model.errorMessage { ContentUnavailableView("History unavailable", systemImage: "exclamationmark.triangle", description: Text(message)) } }
        .background(EQColor.canvas).toolbar(.hidden, for: .navigationBar).task(id: isActive) { await model.loadIfNeeded() }
        .onReceive(NotificationCenter.default.publisher(for: .equilibriumRepositoryDidChange)) { _ in
            if isActive { Task { await model.load() } } else { model.invalidate() }
        }
    }
    private var header: some View {
        Button(action: dismiss) {
            HStack(alignment: .firstTextBaseline, spacing: EQSpacing.xs) {
                Image(systemName: "chevron.left")
                Text("Workout History").eqTextStyle(.navigationTitle)
            }
            .frame(minHeight: EQLayout.minimumTouch)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .foregroundStyle(EQColor.primaryText)
        .accessibilityLabel("Back to Home")
        .frame(maxWidth: .infinity, minHeight: EQLayout.minimumTouch + EQSpacing.sm, alignment: .leading)
        .padding(.horizontal, EQLayout.screenGutter)
    }
}

private struct WorkoutHistoryRow: View {
    let workout: Workout
    var body: some View {
        let date = WorkoutHistoryQuery.completionDate(workout)
        HStack {
            VStack(alignment: .leading, spacing: EQSpacing.xxs) {
                Text(workout.titleSnapshot).eqTextStyle(.listItemTitle).lineLimit(1)
                EQDateText.dayText(date, style: .secondaryBody).foregroundStyle(EQColor.secondaryText)
            }
            Spacer(minLength: EQSpacing.xs)
            Image(systemName: "chevron.right").eqTextStyle(.caption).foregroundStyle(EQColor.secondaryText)
        }
        .padding(.vertical, EQSpacing.xs)
        .frame(minHeight: EQLayout.minimumTouch)
        .contentShape(Rectangle())
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(workout.titleSnapshot), \(EQDateText.dayString(date))")
        .accessibilityAddTraits(.isButton)
    }
}

struct CompletedWorkoutDetailView: View {
    @State private var workout: Workout
    let repository: any WorkoutRepository
    let historyRepository: any ExerciseHistoryRepository
    let weightUnit: WeightUnit
    @State private var editTarget: CompletedSetEditTarget?
    @Environment(\.dismiss) private var dismiss
    init(workout: Workout, repository: any WorkoutRepository, historyRepository: any ExerciseHistoryRepository, weightUnit: WeightUnit) {
        _workout = State(initialValue: workout); self.repository = repository; self.historyRepository = historyRepository; self.weightUnit = weightUnit
    }
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            header
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    VStack(alignment: .leading, spacing: EQLayout.exerciseBlockGap) {
                        ForEach(workout.exercises) { exercise in exerciseRow(exercise) }
                    }
                    .padding(.top, EQLayout.WorkoutExecution.overviewContentTopInset)
                }
                .padding(.horizontal, EQLayout.screenGutter)
                .padding(.top, EQSpacing.md)
                .padding(.bottom, EQSpacing.lg)
                .foregroundStyle(EQColor.primaryText)
            }
            .scrollIndicators(.hidden)
        }
        .background(EQColor.canvas).toolbar(.hidden, for: .navigationBar)
        .onReceive(NotificationCenter.default.publisher(for: .equilibriumRepositoryDidChange)) { _ in
            Task { if let refreshed = try? await repository.workout(id: workout.id) { workout = refreshed } }
        }
        .sheet(item: $editTarget) { target in
            CompletedSetEditor(target: target, weightUnit: weightUnit) { input in
                do { workout = try await repository.editCompletedSet(workoutID: workout.id, exerciseID: target.exerciseID, prescriptionID: target.prescriptionID, input: input, at: .now); return true }
                catch { return false }
            }
        }
    }
    private func exerciseRow(_ exercise: WorkoutExercise) -> some View {
        let sets = ExercisePerformanceQuery.validCompletedSets(in: exercise)
        return VStack(alignment: .leading, spacing: EQLayout.WorkoutExecution.titleToSetsSpacing) {
            HStack {
                Text(exercise.nameSnapshot).eqTextStyle(.listItemTitle)
                Spacer()
                NavigationLink {
                    ExercisePerformanceView(exerciseID: exercise.exerciseID, fallbackName: exercise.nameSnapshot, repository: historyRepository, weightUnit: weightUnit)
                } label: {
                    Image(systemName: "chart.xyaxis.line")
                        .eqTextStyle(.caption)
                        .foregroundStyle(EQColor.secondaryText)
                        .frame(width: EQLayout.minimumTouch, height: EQLayout.iconSize, alignment: .trailing)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("\(exercise.nameSnapshot) performance")
            }
            if sets.isEmpty {
                Text("No completed sets").eqTextStyle(.secondaryBody).foregroundStyle(EQColor.secondaryText)
            } else {
                VStack(alignment: .leading, spacing: EQLayout.WorkoutExecution.loggedSetSpacing) {
                    ForEach(Array(sets.enumerated()), id: \.element.id) { setIndex, set in
                        Button {
                            if let prescriptionID = set.prescriptionID { editTarget = .init(exerciseID: exercise.id, prescriptionID: prescriptionID, setNumber: setIndex + 1, set: set) }
                        } label: {
                            HStack(alignment: .firstTextBaseline, spacing: EQSpacing.xs) {
                                Text("\(setIndex + 1)").frame(width: EQLayout.WorkoutExecution.loggedSetIndexWidth, alignment: .leading)
                                Text(setSummary(set))
                                Spacer(minLength: 0)
                            }
                            .eqTextStyle(.secondaryBody)
                            .foregroundStyle(EQColor.secondaryText)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Set \(setIndex + 1), \(setSummary(set))")
                        .accessibilityHint("Edits this set")
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
    private var header: some View {
        Button { dismiss() } label: {
            HStack(alignment: .firstTextBaseline, spacing: EQSpacing.xs) {
                Image(systemName: "chevron.left")
                VStack(alignment: .leading, spacing: EQSpacing.xxs) {
                    Text(workout.titleSnapshot).eqTextStyle(.navigationTitle).lineLimit(1)
                    EQDateText.text(WorkoutHistoryQuery.completionDate(workout), style: .secondaryBody, includeYear: false)
                        .foregroundStyle(EQColor.secondaryText)
                }
            }
            .frame(minHeight: EQLayout.minimumTouch)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .foregroundStyle(EQColor.primaryText)
        .accessibilityLabel("Back to Workout History, \(workout.titleSnapshot), \(EQDateText.string(WorkoutHistoryQuery.completionDate(workout), includeYear: false))")
        .frame(maxWidth: .infinity, minHeight: EQLayout.minimumTouch + EQSpacing.sm, alignment: .leading)
        .padding(.horizontal, EQLayout.screenGutter)
    }
    private func setSummary(_ set: LoggedSet) -> String {
        let weight = set.weight.map { " · \(WeightText.value($0, unit: weightUnit)) \(weightUnit == .pounds ? "lb" : "kg")" } ?? ""
        if let duration = set.duration {
            let seconds = Int(duration.rounded())
            return "\(seconds) \(seconds == 1 ? "second" : "seconds")\(weight)"
        }
        let repetitions = set.repetitions ?? 0
        return "\(repetitions) \(repetitions == 1 ? "rep" : "reps")\(weight)"
    }
}

private struct CompletedSetEditTarget: Identifiable {
    var id: SetID { prescriptionID }
    let exerciseID: WorkoutExerciseID; let prescriptionID: SetID; let setNumber: Int; let set: LoggedSet
}

private struct CompletedSetEditor: View {
    let target: CompletedSetEditTarget; let weightUnit: WeightUnit; let save: (SetLogInput) async -> Bool
    @Environment(\.dismiss) private var dismiss
    @State private var weight: String; @State private var value: String
    @FocusState private var fieldFocused: Bool
    init(target: CompletedSetEditTarget, weightUnit: WeightUnit, save: @escaping (SetLogInput) async -> Bool) {
        self.target = target; self.weightUnit = weightUnit; self.save = save
        _weight = State(initialValue: WeightText.value(target.set.weight, unit: weightUnit))
        _value = State(initialValue: target.set.duration.map { String(Int($0.rounded())) } ?? target.set.repetitions.map(String.init) ?? "")
    }
    var body: some View {
        NavigationStack {
            Form {
                Section("Values") {
                    LabeledContent("Weight (\(weightUnit == .pounds ? "lb" : "kg"))") {
                        TextField("0", text: $weight).keyboardType(.decimalPad).multilineTextAlignment(.trailing)
                            .focused($fieldFocused)
                            .accessibilityLabel("Weight in \(weightUnit == .pounds ? "pounds" : "kilograms")")
                    }
                    LabeledContent(target.set.duration == nil ? "Reps" : "Seconds") {
                        TextField("0", text: $value).keyboardType(.numberPad).multilineTextAlignment(.trailing)
                            .focused($fieldFocused)
                            .accessibilityLabel(target.set.duration == nil ? "Reps" : "Seconds")
                    }
                }
            }
            .navigationTitle("Edit Set \(target.setNumber)")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) { Button("Save") { commit() } }
                ToolbarItemGroup(placement: .keyboard) { Spacer(); Button("Done") { fieldFocused = false } }
            }
        }.presentationDetents([.medium])
    }
    private func commit() {
        guard let number = Int(value), number > 0 else { return }
        let load = WeightText.weight(from: weight, unit: weightUnit)
        let input: SetLogInput = target.set.duration == nil ? .repetitions(weight: load, repetitions: number) : .duration(weight: load, seconds: TimeInterval(number))
        Task { if await save(input) { dismiss() } }
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
    @Environment(\.dismiss) private var dismiss
    init(exerciseID: ExerciseID, fallbackName: String, repository: any ExerciseHistoryRepository, weightUnit: WeightUnit) {
        _model = State(initialValue: .init(exerciseID: exerciseID, repository: repository)); self.fallbackName = fallbackName; self.weightUnit = weightUnit
    }
    private var title: String { model.performance?.displayName ?? fallbackName }
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            header
            ScrollView {
                if let performance = model.performance {
                    if performance.occurrences.isEmpty {
                        ContentUnavailableView("No previous performance", systemImage: "chart.xyaxis.line", description: Text("Completed working sets will appear here."))
                    } else {
                        VStack(alignment: .leading, spacing: EQLayout.exerciseBlockGap) {
                            prCard(performance)
                            PerformanceTrendView(family: performance.activeMetricFamily, points: performance.trend, weightUnit: weightUnit)
                            occurrences(performance)
                        }
                        .padding(.horizontal, EQLayout.screenGutter)
                        .padding(.top, EQSpacing.md + EQLayout.WorkoutExecution.overviewContentTopInset)
                        .padding(.bottom, EQSpacing.lg)
                    }
                } else if model.errorMessage == nil { ProgressView("Loading performance").padding(.top, EQSpacing.xl) }
            }
            .scrollIndicators(.hidden)
        }
        .overlay { if let message = model.errorMessage { ContentUnavailableView("Performance unavailable", systemImage: "exclamationmark.triangle", description: Text(message)) } }
        .foregroundStyle(EQColor.primaryText)
        .background(EQColor.canvas)
        .toolbar(.hidden, for: .navigationBar)
        .task { await model.load() }
        .onReceive(NotificationCenter.default.publisher(for: .equilibriumRepositoryDidChange)) { _ in Task { await model.load() } }
    }
    private var header: some View {
        Button { dismiss() } label: {
            HStack(alignment: .firstTextBaseline, spacing: EQSpacing.xs) {
                Image(systemName: "chevron.left")
                VStack(alignment: .leading, spacing: EQSpacing.xxs) {
                    Text(title).eqTextStyle(.navigationTitle).lineLimit(1)
                    Text("Performance").eqTextStyle(.secondaryBody).foregroundStyle(EQColor.secondaryText)
                }
            }
            .frame(minHeight: EQLayout.minimumTouch)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .foregroundStyle(EQColor.primaryText)
        .accessibilityLabel("Back, \(title) performance")
        .frame(maxWidth: .infinity, minHeight: EQLayout.minimumTouch + EQSpacing.sm, alignment: .leading)
        .padding(.horizontal, EQLayout.screenGutter)
    }
    private func prCard(_ performance: ExercisePerformance) -> some View {
        VStack(alignment: .leading, spacing: EQLayout.WorkoutExecution.titleToSetsSpacing) {
            Text("PERSONAL RECORD").eqTextStyle(.sectionLabel).foregroundStyle(EQColor.secondaryText)
            Text(prText(performance.personalRecord)).eqTextStyle(.screenTitle)
        }
        .performanceCard()
    }
    private func occurrences(_ performance: ExercisePerformance) -> some View {
        VStack(alignment: .leading, spacing: EQSpacing.sm) {
            Text("WORKING SET HISTORY").eqTextStyle(.sectionLabel).foregroundStyle(EQColor.secondaryText)
            ForEach(performance.occurrences.reversed()) { occurrence in
                VStack(alignment: .leading, spacing: EQLayout.WorkoutExecution.titleToSetsSpacing) {
                    VStack(alignment: .leading, spacing: EQSpacing.xxs) {
                        Text(occurrence.workoutTitleSnapshot).eqTextStyle(.listItemTitle)
                        EQDateText.text(occurrence.occurredAt, style: .secondaryBody, includeYear: false).foregroundStyle(EQColor.secondaryText)
                    }
                    VStack(alignment: .leading, spacing: EQLayout.WorkoutExecution.loggedSetSpacing) {
                        ForEach(Array(occurrence.sets.enumerated()), id: \.element.id) { index, set in
                            HStack(alignment: .firstTextBaseline, spacing: EQSpacing.xs) {
                                Text("\(index + 1)").frame(width: EQLayout.WorkoutExecution.loggedSetIndexWidth, alignment: .leading)
                                Text(performanceSetText(set))
                            }
                            .eqTextStyle(.secondaryBody)
                            .foregroundStyle(EQColor.secondaryText)
                            .accessibilityElement(children: .combine)
                        }
                    }
                }
                .performanceCard()
            }
        }
    }
    private func prText(_ record: ExercisePersonalRecord?) -> String {
        guard let record else { return "No PR yet" }
        switch record {
        case .duration(let set): return performanceSetText(set)
        case .repetitions(let set): return performanceSetText(set)
        }
    }
    private func performanceSetText(_ set: LoggedSet) -> String {
        if let duration = set.duration {
            let load = set.weight.map { " · \(WeightText.value($0, unit: weightUnit)) \(weightUnit == .pounds ? "lb" : "kg")" } ?? ""
            return DurationText.format(duration) + load
        }
        let reps = "\(set.repetitions ?? 0) reps"
        guard let weight = set.weight else { return reps + " · bodyweight" }
        return "\(WeightText.value(weight, unit: weightUnit)) \(weightUnit == .pounds ? "lb" : "kg") × \(set.repetitions ?? 0)"
    }
}

private extension View {
    func performanceCard() -> some View {
        frame(maxWidth: .infinity, alignment: .leading)
            .padding(EQSpacing.md)
            .background(EQColor.cardFill, in: RoundedRectangle(cornerRadius: EQRadius.card, style: .continuous))
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
            Text("TREND").eqTextStyle(.sectionLabel).foregroundStyle(EQColor.secondaryText)
            if selected.isEmpty { Text("No trend data").eqTextStyle(.secondaryBody).foregroundStyle(EQColor.secondaryText) }
            else if selected.count == 1 { Text("One completed occurrence · \(valueText(selected[0]))").eqTextStyle(.secondaryBody) }
            else {
                Chart(selected, id: \.0.id) { item in
                    LineMark(x: .value("Date", item.0.occurredAt), y: .value(metricLabel, item.1)).foregroundStyle(EQColor.chartLine)
                    PointMark(x: .value("Date", item.0.occurredAt), y: .value(metricLabel, item.1)).foregroundStyle(EQColor.chartPoint)
                }.frame(height: EQLayout.Performance.chartHeight).accessibilityHidden(true)
            }
            VStack(alignment: .leading, spacing: EQLayout.WorkoutExecution.loggedSetSpacing) {
                ForEach(selected, id: \.0.id) { item in
                    HStack(alignment: .firstTextBaseline) {
                        EQDateText.text(item.0.occurredAt, style: .secondaryBody, includeYear: false)
                        Spacer(minLength: EQSpacing.xs)
                        Text(valueText(item))
                    }
                    .eqTextStyle(.secondaryBody)
                    .foregroundStyle(EQColor.secondaryText)
                }
            }
        }.performanceCard()
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

