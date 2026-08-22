import SwiftUI

struct WorkoutExecutionView: View {
    @State private var model: WorkoutExecutionModel
    @Environment(\.dismiss) private var dismiss
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var completionFeedback = 0

    init(id: ScheduledWorkoutID, repository: any ScheduledWorkoutRepository, weightUnit: WeightUnit = .pounds, didPersist: @escaping (ScheduledWorkout) -> Void = { _ in }) {
        _model = State(initialValue: WorkoutExecutionModel(workoutID: id, repository: repository, weightUnit: weightUnit, didPersist: didPersist))
    }

    var body: some View {
        ZStack {
            EQColor.canvas.ignoresSafeArea()
            if let workout = model.workout { content(workout) }
            else if let error = model.errorMessage { ContentUnavailableView("Workout unavailable", systemImage: "exclamationmark.triangle", description: Text(error)) }
            else { ProgressView("Loading workout") }
            if model.showsCompletion { completionOverlay }
        }
        .foregroundStyle(EQColor.primaryText)
        .navigationTitle(model.workout?.status == .completed ? "Workout" : "Train")
        .navigationBarTitleDisplayMode(.inline)
        .task { await model.activate() }
        .sensoryFeedback(.success, trigger: completionFeedback)
    }

    private func content(_ workout: ScheduledWorkout) -> some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: EQSpacing.md) {
                header(workout)
                ForEach(workout.exercises) { exercise in
                    let state = model.states[exercise.id] ?? .upcoming
                    ExerciseExecutionCard(
                        exercise: exercise,
                        state: state,
                        isReadOnly: model.isReadOnly,
                        weightUnit: model.weightUnit,
                        log: { prescriptionID, input in await model.log(exerciseID: exercise.id, prescriptionID: prescriptionID, input: input) },
                        focus: { model.focus(exercise.id) }
                    )
                }
                if let error = model.errorMessage { Label(error, systemImage: "exclamationmark.triangle").font(EQTypography.caption).foregroundStyle(EQColor.warning) }
                if !model.isReadOnly {
                    Button { Task { await model.complete(); if model.showsCompletion { completionFeedback += 1 } } } label: {
                        Label("Complete workout", systemImage: "checkmark.circle.fill").frame(maxWidth: .infinity, minHeight: EQDimension.minimumTouch)
                    }
                    .buttonStyle(.borderedProminent)
                    .buttonBorderShape(.roundedRectangle(radius: EQRadius.control))
                    .disabled(!model.canComplete)
                    .accessibilityHint(model.canComplete ? "Marks the workout complete" : "Complete all required sets first")
                }
            }
            .padding(.horizontal, EQSpacing.md)
            .padding(.bottom, EQSpacing.xl)
        }
        .scrollDismissesKeyboard(.interactively)
    }

    private func header(_ workout: ScheduledWorkout) -> some View {
        VStack(alignment: .leading, spacing: EQSpacing.sm) {
            Text(workout.titleSnapshot).font(EQTypography.title)
            HStack {
                Text(model.isReadOnly ? "Completed" : "\(model.progress.completedSetCount) of \(model.progress.requiredSetCount) sets")
                Spacer()
                Text(model.progress.fraction, format: .percent.precision(.fractionLength(0))).monospacedDigit()
            }.font(EQTypography.caption).foregroundStyle(model.isReadOnly ? EQColor.success : EQColor.secondaryText)
            ProgressView(value: model.progress.fraction).tint(model.isReadOnly ? EQColor.success : EQColor.accent)
            if model.isReadOnly { Text("This workout is read-only.").font(EQTypography.body).foregroundStyle(EQColor.secondaryText) }
        }
        .padding(.vertical, EQSpacing.sm)
        .accessibilityElement(children: .combine)
    }

    private var completionOverlay: some View {
        ZStack {
            EQColor.canvas.opacity(0.96).ignoresSafeArea()
            VStack(spacing: EQSpacing.lg) {
                Image(systemName: "checkmark.circle.fill").font(.largeTitle).foregroundStyle(EQColor.success)
                Text("Workout complete").font(EQTypography.title)
                Text("Your sets are saved.").font(EQTypography.body).foregroundStyle(EQColor.secondaryText)
                Button("Return to Schedule") { dismiss() }
                    .buttonStyle(.borderedProminent).buttonBorderShape(.roundedRectangle(radius: EQRadius.control)).controlSize(.large)
            }.padding(EQSpacing.xl)
        }
        .transition(reduceMotion ? .opacity : .scale.combined(with: .opacity))
        .animation(reduceMotion ? nil : .easeOut(duration: EQMotion.completion), value: model.showsCompletion)
        .accessibilityAddTraits(.isModal)
    }
}

private struct ExerciseExecutionCard: View {
    let exercise: ScheduledExercise
    let state: ExerciseState
    let isReadOnly: Bool
    let weightUnit: WeightUnit
    let log: (SetID, SetLogInput) async -> Void
    let focus: () -> Void

    private var completedCount: Int { WorkoutExecutionQuery.completedPrescriptionIDs(in: exercise).count }

    var body: some View {
        VStack(alignment: .leading, spacing: EQSpacing.md) {
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: EQSpacing.xxs) {
                    Text(stateLabel).font(EQTypography.caption).foregroundStyle(stateColor)
                    Text(exercise.nameSnapshot).font(EQTypography.exerciseTitle)
                    Text("\(completedCount) of \(exercise.prescriptions.count) sets complete").font(EQTypography.caption).foregroundStyle(EQColor.secondaryText)
                }
                Spacer()
                Image(systemName: state == .completed ? "checkmark.circle.fill" : state == .current ? "scope" : "circle")
                    .foregroundStyle(stateColor)
            }
            if state == .current || isReadOnly {
                ForEach(Array(exercise.prescriptions.enumerated()), id: \.element.id) { index, prescription in
                    SetEntryRow(index: index, prescription: prescription, logged: exercise.loggedSets.first { $0.prescriptionID == prescription.id }, isReadOnly: isReadOnly, weightUnit: weightUnit, log: log)
                }
                Button("Exercise history") { }.disabled(true).font(EQTypography.caption).accessibilityHint("Exercise history arrives in a later phase")
            } else if state == .completed && !isReadOnly {
                Button("Review or edit sets", action: focus).frame(minHeight: EQDimension.minimumTouch)
            } else {
                Text(prescriptionSummary).font(EQTypography.body).foregroundStyle(EQColor.secondaryText)
                if !isReadOnly { Button("Focus exercise", action: focus).frame(minHeight: EQDimension.minimumTouch) }
            }
        }
        .eqCard(elevated: state == .current)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("\(exercise.nameSnapshot), \(stateLabel), \(completedCount) of \(exercise.prescriptions.count) sets complete")
    }

    private var stateLabel: String { state == .current ? "Current" : state == .completed ? "Completed" : "Up next" }
    private var stateColor: Color { state == .completed ? EQColor.success : state == .current ? EQColor.accent : EQColor.secondaryText }
    private var prescriptionSummary: String {
        guard let first = exercise.prescriptions.first else { return "No prescribed sets" }
        switch first.target {
        case .repetitions(let range): return "\(exercise.prescriptions.count) sets · \(range.lowerBound)–\(range.upperBound) reps"
        case .duration(let seconds): return "\(exercise.prescriptions.count) sets · \(Int(seconds)) seconds"
        }
    }
}

private struct SetEntryRow: View {
    let index: Int
    let prescription: SetPrescription
    let logged: LoggedSet?
    let isReadOnly: Bool
    let weightUnit: WeightUnit
    let log: (SetID, SetLogInput) async -> Void
    @State private var weightText: String
    @State private var valueText: String
    @FocusState private var focused: Field?
    private enum Field { case weight, value }

    init(index: Int, prescription: SetPrescription, logged: LoggedSet?, isReadOnly: Bool, weightUnit: WeightUnit, log: @escaping (SetID, SetLogInput) async -> Void) {
        self.index = index; self.prescription = prescription; self.logged = logged; self.isReadOnly = isReadOnly; self.weightUnit = weightUnit; self.log = log
        _weightText = State(initialValue: WeightText.value(logged?.weight ?? prescription.suggestedWeight, unit: weightUnit))
        let value: String
        switch prescription.target {
        case .repetitions(let range): value = logged?.repetitions.map(String.init) ?? String(range.lowerBound)
        case .duration(let seconds): value = logged?.duration.map { String(Int($0)) } ?? String(Int(seconds))
        }
        _valueText = State(initialValue: value)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: EQSpacing.xs) {
            HStack { Text("Set \(index + 1)").font(EQTypography.cardTitle); Spacer(); if logged?.completedAt != nil { Label("Done", systemImage: "checkmark").font(EQTypography.caption).foregroundStyle(EQColor.success) } }
            if isReadOnly { Text(readOnlySummary).font(EQTypography.body).foregroundStyle(EQColor.secondaryText) }
            else {
                HStack(spacing: EQSpacing.xs) {
                    if case .repetitions = prescription.target {
                        field("Weight (\(unitLabel))", text: $weightText, keyboard: .decimalPad).focused($focused, equals: .weight)
                    }
                    field(valueLabel, text: $valueText, keyboard: .numberPad).focused($focused, equals: .value)
                    Button { commit() } label: { Image(systemName: logged?.completedAt == nil ? "checkmark" : "arrow.triangle.2.circlepath") .frame(width: EQDimension.minimumTouch, height: EQDimension.minimumTouch) }
                        .buttonStyle(.borderedProminent).buttonBorderShape(.roundedRectangle(radius: EQRadius.control))
                        .accessibilityLabel("Set \(index + 1), \(logged?.completedAt == nil ? "complete" : "update")")
                }
            }
        }
        .padding(.vertical, EQSpacing.xs)
        .overlay(alignment: .bottom) { Divider().overlay(EQColor.separator) }
    }

    private func field(_ label: String, text: Binding<String>, keyboard: UIKeyboardType) -> some View {
        TextField(label, text: text).keyboardType(keyboard).textFieldStyle(.roundedBorder).frame(minHeight: EQDimension.inputHeight).accessibilityLabel("Set \(index + 1), \(label)")
    }
    private var unitLabel: String { weightUnit == .pounds ? "lb" : "kg" }
    private var valueLabel: String { if case .duration = prescription.target { return "Seconds" }; return "Reps" }
    private var readOnlySummary: String {
        switch prescription.target {
        case .repetitions:
            let reps = logged?.repetitions.map(String.init) ?? "Not logged"
            let weight = logged?.weight.map { " · \(WeightText.value($0, unit: weightUnit)) \(unitLabel)" } ?? ""
            return "\(reps) reps\(weight)"
        case .duration: return logged?.duration.map { "\(Int($0)) seconds" } ?? "Not logged"
        }
    }
    private func commit() {
        focused = nil
        guard let value = Int(valueText), value > 0 else { return }
        let input: SetLogInput
        switch prescription.target {
        case .repetitions: input = .repetitions(weight: WeightText.weight(from: weightText, unit: weightUnit), repetitions: value)
        case .duration: input = .duration(seconds: TimeInterval(value))
        }
        Task { await log(prescription.id, input) }
    }
}

#if DEBUG
@MainActor private func executionPreview(_ workout: ScheduledWorkout, size: DynamicTypeSize = .large) -> some View {
    let container = try! PersistenceController.makeContainer(inMemory: true)
    container.mainContext.insert(WorkoutMapper.record(from: workout))
    try! container.mainContext.save()
    return NavigationStack { WorkoutExecutionView(id: workout.id, repository: SwiftDataRepository(container: container)) }
        .modelContainer(container).preferredColorScheme(.dark).dynamicTypeSize(size)
}

#Preview("Fresh planned") { executionPreview(EquilibriumFixtures.planned()) }
#Preview("Mid-workout") { executionPreview(EquilibriumFixtures.midWorkout()) }
#Preview("Duration") { executionPreview(EquilibriumFixtures.mixed()) }
#Preview("Completed read-only") { executionPreview(EquilibriumFixtures.completed()) }
#Preview("Long names") { executionPreview(EquilibriumFixtures.midWorkout(id: "preview-long")) }
#Preview("Accessibility XXL") { executionPreview(EquilibriumFixtures.midWorkout(id: "preview-xxl"), size: .accessibility3) }
#endif
