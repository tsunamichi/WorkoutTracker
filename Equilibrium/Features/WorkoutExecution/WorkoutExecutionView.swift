import SwiftUI

struct WorkoutExecutionView: View {
    @State private var model: WorkoutExecutionModel
    @Environment(\.dismiss) private var dismiss
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.scenePhase) private var scenePhase
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
        .navigationBarBackButtonHidden()
        .toolbar { workoutToolbar }
        .task { await model.activate() }
        .onChange(of: scenePhase) { _, phase in if phase == .active { model.refreshRest() } }
        .sensoryFeedback(.success, trigger: completionFeedback)
    }

    @ToolbarContentBuilder private var workoutToolbar: some ToolbarContent {
        ToolbarItem(placement: .topBarLeading) {
            Button { dismiss() } label: { Label("Schedule", systemImage: "chevron.left") }
                .accessibilityHint("Returns to Schedule")
        }
        ToolbarItem(placement: .topBarTrailing) {
            if !model.isReadOnly {
                Menu("Options", systemImage: "ellipsis") {
                    if model.canComplete {
                        Button("Mark as complete", systemImage: "checkmark.circle") { completeWorkout() }
                    }
                }
                .accessibilityLabel("Workout options")
            }
        }
    }

    private func content(_ workout: ScheduledWorkout) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: EQSpacing.md) {
                Text(workout.titleSnapshot).font(EQTypography.title).padding(.horizontal, EQSpacing.lg)
                if model.isReadOnly {
                    Text("Completed · Read-only").font(EQTypography.caption).foregroundStyle(EQColor.success).padding(.horizontal, EQSpacing.lg)
                }
                executionStack(workout)
                if let error = model.errorMessage {
                    Label(error, systemImage: "exclamationmark.triangle").font(EQTypography.caption).foregroundStyle(EQColor.warning).padding(.horizontal, EQSpacing.lg)
                }
            }
            .padding(.bottom, EQSpacing.md)
        }
        .scrollDismissesKeyboard(.interactively)
        .scrollIndicators(.hidden)
    }

    private func executionStack(_ workout: ScheduledWorkout) -> some View {
        VStack(spacing: -EQSpacing.xs) {
            ExecutionPanelCard(title: "COMPLETED", count: model.completedExercises.count, panel: .completed, expanded: model.expandedPanel == .completed) {
                model.expand(.completed)
            } content: {
                completedContent(workout)
            }
            ExecutionPanelCard(title: "UP NEXT", count: model.upNextExercises.count, panel: .upNext, expanded: model.expandedPanel == .upNext) {
                model.expand(.upNext)
            } content: {
                upNextContent
            }
            ExecutionPanelCard(title: "CURRENT", count: nil, panel: .current, expanded: model.expandedPanel == .current) {
                model.expand(.current)
            } content: {
                currentContent
            }
        }
        .padding(.horizontal, EQSpacing.md)
        .animation(reduceMotion ? nil : .easeInOut(duration: EQMotion.standard), value: model.expandedPanel)
        .animation(reduceMotion ? nil : .easeInOut(duration: EQMotion.standard), value: model.restState != nil)
    }

    @ViewBuilder private func completedContent(_ workout: ScheduledWorkout) -> some View {
        if model.completedExercises.isEmpty {
            Text("Logged exercises will collect here.").font(EQTypography.body).foregroundStyle(EQColor.secondaryText)
        } else {
            ForEach(model.completedExercises) { exercise in
                Button {
                    if workout.status == .inProgress { model.focus(exercise.id) }
                } label: {
                    ExerciseListRow(exercise: exercise, detail: "\(WorkoutExecutionQuery.completedPrescriptionIDs(in: exercise).count) sets logged", completed: true)
                }
                .buttonStyle(.plain).disabled(workout.status == .completed)
                .accessibilityHint(workout.status == .inProgress ? "Focuses this completed exercise for review or editing" : "Completed workout is read-only")
            }
            if workout.status == .completed { ReadOnlySetReview(exercises: model.completedExercises, weightUnit: model.weightUnit) }
        }
    }

    @ViewBuilder private var upNextContent: some View {
        if model.upNextExercises.isEmpty {
            Text("No exercises remaining.").font(EQTypography.body).foregroundStyle(EQColor.secondaryText)
        } else {
            ForEach(model.upNextExercises) { exercise in
                Button { model.focus(exercise.id) } label: {
                    ExerciseListRow(exercise: exercise, detail: prescriptionSummary(exercise), completed: false)
                }
                .buttonStyle(.plain)
                .accessibilityHint("Makes this the current exercise without changing workout order")
            }
        }
    }

    @ViewBuilder private var currentContent: some View {
        if let rest = model.restState {
            RestModeView(state: rest, skip: model.skipRest)
        } else if let exercise = model.currentExercise, let prescription = model.currentPrescription {
            FocusedSetView(
                exercise: exercise,
                prescription: prescription,
                selectedIndex: model.selectedSetIndex,
                isReadOnly: model.isReadOnly,
                weightUnit: model.weightUnit,
                select: model.selectSet,
                log: { input in await model.log(exerciseID: exercise.id, prescriptionID: prescription.id, input: input) }
            )
            .id("\(exercise.id.rawValue)-\(prescription.id.rawValue)")
            if model.canComplete {
                Button { completeWorkout() } label: {
                    Label("Complete workout", systemImage: "checkmark.circle.fill").frame(maxWidth: .infinity, minHeight: EQDimension.minimumTouch)
                }
                .buttonStyle(.borderedProminent).buttonBorderShape(.roundedRectangle(radius: EQRadius.control))
            }
        } else {
            Text(model.isReadOnly ? "Workout complete." : "Every required set is logged.")
                .font(EQTypography.sectionTitle)
            if model.canComplete {
                Button { completeWorkout() } label: { Text("Complete workout").frame(maxWidth: .infinity, minHeight: EQDimension.minimumTouch) }
                    .buttonStyle(.borderedProminent).buttonBorderShape(.roundedRectangle(radius: EQRadius.control))
            }
        }
    }

    private func completeWorkout() {
        Task { await model.complete(); if model.showsCompletion { completionFeedback += 1 } }
    }

    private func prescriptionSummary(_ exercise: ScheduledExercise) -> String {
        guard let first = exercise.prescriptions.first else { return "No prescribed sets" }
        switch first.target {
        case .repetitions(let range): return "\(exercise.prescriptions.count) sets · \(range.lowerBound)–\(range.upperBound) reps"
        case .duration(let seconds): return "\(exercise.prescriptions.count) sets · \(Int(seconds)) seconds"
        }
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

private struct ExecutionPanelCard<Content: View>: View {
    let title: String
    let count: Int?
    let panel: ExecutionPanel
    let expanded: Bool
    let toggle: () -> Void
    @ViewBuilder let content: Content

    init(title: String, count: Int?, panel: ExecutionPanel, expanded: Bool, toggle: @escaping () -> Void, @ViewBuilder content: () -> Content) {
        self.title = title; self.count = count; self.panel = panel; self.expanded = expanded; self.toggle = toggle; self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: EQSpacing.md) {
            Button(action: toggle) {
                HStack {
                    Text(title).font(EQTypography.caption.weight(.bold))
                    if let count { Text("\(count)").font(EQTypography.caption).foregroundStyle(EQColor.secondaryText) }
                    Spacer()
                    Image(systemName: expanded ? "chevron.down" : "chevron.right")
                }.frame(minHeight: EQDimension.minimumTouch)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("\(title.capitalized) panel")
            .accessibilityValue(expanded ? "Expanded" : "Collapsed")
            if expanded { content.transition(.opacity.combined(with: .move(edge: .bottom))) }
        }
        .padding(EQSpacing.md)
        .frame(maxWidth: .infinity, maxHeight: expanded && panel == .current ? .infinity : nil, alignment: .topLeading)
        .background(expanded ? EQColor.elevatedSurface : EQColor.surface, in: RoundedRectangle(cornerRadius: EQRadius.card, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: EQRadius.card, style: .continuous).stroke(EQColor.separator))
        .zIndex(expanded ? 1 : 0)
    }
}

private struct ExerciseListRow: View {
    let exercise: ScheduledExercise
    let detail: String
    let completed: Bool
    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: EQSpacing.xxs) {
                Text(exercise.nameSnapshot).font(EQTypography.cardTitle)
                Text(detail).font(EQTypography.caption).foregroundStyle(EQColor.secondaryText)
            }
            Spacer()
            Image(systemName: completed ? "checkmark.circle.fill" : "arrow.down.right")
                .foregroundStyle(completed ? EQColor.success : EQColor.accent)
        }.frame(minHeight: EQDimension.minimumTouch).contentShape(Rectangle())
    }
}

private struct FocusedSetView: View {
    let exercise: ScheduledExercise
    let prescription: SetPrescription
    let selectedIndex: Int
    let isReadOnly: Bool
    let weightUnit: WeightUnit
    let select: (Int) -> Void
    let log: (SetLogInput) async -> Void
    @State private var weightText: String
    @State private var valueText: String
    @FocusState private var focusedField: Field?
    private enum Field { case weight, value }

    init(exercise: ScheduledExercise, prescription: SetPrescription, selectedIndex: Int, isReadOnly: Bool, weightUnit: WeightUnit, select: @escaping (Int) -> Void, log: @escaping (SetLogInput) async -> Void) {
        self.exercise = exercise; self.prescription = prescription; self.selectedIndex = selectedIndex; self.isReadOnly = isReadOnly; self.weightUnit = weightUnit; self.select = select; self.log = log
        let logged = exercise.loggedSets.first { $0.prescriptionID == prescription.id }
        _weightText = State(initialValue: WeightText.value(logged?.weight ?? prescription.suggestedWeight, unit: weightUnit))
        switch prescription.target {
        case .repetitions(let range): _valueText = State(initialValue: logged?.repetitions.map(String.init) ?? String(range.lowerBound))
        case .duration(let seconds): _valueText = State(initialValue: logged?.duration.map { String(Int($0)) } ?? String(Int(seconds)))
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: EQSpacing.lg) {
            VStack(alignment: .leading, spacing: EQSpacing.xxs) {
                Text(exercise.nameSnapshot).font(EQTypography.exerciseTitle)
                Text("Set \(selectedIndex + 1) of \(exercise.prescriptions.count)").font(EQTypography.caption).foregroundStyle(EQColor.secondaryText)
            }
            HStack(alignment: .bottom, spacing: EQSpacing.lg) {
                if case .repetitions = prescription.target {
                    HeroValueField(value: $weightText, label: weightUnit == .pounds ? "lb" : "kg", accessibilityLabel: "\(exercise.nameSnapshot), set \(selectedIndex + 1), weight", keyboard: .decimalPad)
                        .focused($focusedField, equals: .weight)
                }
                HeroValueField(value: $valueText, label: valueLabel, accessibilityLabel: "\(exercise.nameSnapshot), set \(selectedIndex + 1), \(valueLabel)", keyboard: .numberPad)
                    .focused($focusedField, equals: .value)
            }
            setSelector
            if !isReadOnly {
                Button { commit() } label: {
                    Label(isLogged ? "Update set" : "Log set", systemImage: "checkmark").frame(maxWidth: .infinity, minHeight: EQDimension.minimumTouch)
                }
                .buttonStyle(.borderedProminent).buttonBorderShape(.roundedRectangle(radius: EQRadius.control))
                .accessibilityHint("Saves this set immediately")
            }
        }
        .accessibilityElement(children: .contain)
    }

    private var setSelector: some View {
        ScrollView(.horizontal) {
            HStack(spacing: EQSpacing.xs) {
                ForEach(exercise.prescriptions.indices, id: \.self) { index in
                    let done = exercise.loggedSets.contains { $0.prescriptionID == exercise.prescriptions[index].id && $0.completedAt != nil }
                    Button { select(index) } label: {
                        Text("\(index + 1)").frame(width: EQDimension.minimumTouch, height: EQDimension.minimumTouch)
                            .background(index == selectedIndex ? EQColor.accent : EQColor.surface, in: Circle())
                            .foregroundStyle(index == selectedIndex ? EQColor.canvas : done ? EQColor.success : EQColor.primaryText)
                    }
                    .accessibilityLabel("Set \(index + 1), \(done ? "completed" : "not completed")")
                    .accessibilityAddTraits(index == selectedIndex ? .isSelected : [])
                }
            }
        }.scrollIndicators(.hidden)
    }

    private var isLogged: Bool { exercise.loggedSets.contains { $0.prescriptionID == prescription.id && $0.completedAt != nil } }
    private var valueLabel: String { if case .duration = prescription.target { return "seconds" }; return "reps" }
    private func commit() {
        focusedField = nil
        guard let value = Int(valueText), value > 0 else { return }
        let input: SetLogInput
        switch prescription.target {
        case .repetitions: input = .repetitions(weight: WeightText.weight(from: weightText, unit: weightUnit), repetitions: value)
        case .duration: input = .duration(seconds: TimeInterval(value))
        }
        Task { await log(input) }
    }
}

private struct HeroValueField: View {
    @Binding var value: String
    let label: String
    let accessibilityLabel: String
    let keyboard: UIKeyboardType
    var body: some View {
        VStack(alignment: .leading, spacing: EQSpacing.xxs) {
            TextField("0", text: $value).keyboardType(keyboard).font(EQTypography.metric).monospacedDigit()
                .textFieldStyle(.plain).accessibilityLabel(accessibilityLabel)
            Text(label.uppercased()).font(EQTypography.caption).foregroundStyle(EQColor.secondaryText)
        }.frame(maxWidth: .infinity)
    }
}

private struct RestModeView: View {
    let state: WorkoutRestState
    let skip: () -> Void
    var body: some View {
        VStack(alignment: .leading, spacing: EQSpacing.lg) {
            Text(state.exerciseName).font(EQTypography.exerciseTitle)
            Text("REST").font(EQTypography.caption.weight(.bold)).foregroundStyle(EQColor.rest)
            Text(durationText).font(EQTypography.metric).monospacedDigit().contentTransition(.numericText())
                .accessibilityLabel("Rest time remaining, \(durationText)")
            ProgressView(value: state.totalDuration - state.remaining, total: state.totalDuration).tint(EQColor.rest)
            Button("Skip rest", action: skip).frame(maxWidth: .infinity, minHeight: EQDimension.minimumTouch)
                .buttonStyle(.borderedProminent).tint(EQColor.rest).buttonBorderShape(.roundedRectangle(radius: EQRadius.control))
        }
    }
    private var durationText: String {
        let seconds = max(0, Int(ceil(state.remaining)))
        return String(format: "%d:%02d", seconds / 60, seconds % 60)
    }
}

private struct ReadOnlySetReview: View {
    let exercises: [ScheduledExercise]
    let weightUnit: WeightUnit
    var body: some View {
        ForEach(exercises) { exercise in
            ForEach(Array(exercise.prescriptions.enumerated()), id: \.element.id) { index, prescription in
                let log = exercise.loggedSets.first { $0.prescriptionID == prescription.id }
                Text("Set \(index + 1): \(summary(prescription, log))").font(EQTypography.caption).foregroundStyle(EQColor.secondaryText)
            }
        }
    }
    private func summary(_ prescription: SetPrescription, _ log: LoggedSet?) -> String {
        switch prescription.target {
        case .repetitions:
            let reps = log?.repetitions.map(String.init) ?? "Not logged"
            let weight = log?.weight.map { " · \(WeightText.value($0, unit: weightUnit)) \(weightUnit == .pounds ? "lb" : "kg")" } ?? ""
            return "\(reps) reps\(weight)"
        case .duration: return log?.duration.map { "\(Int($0)) seconds" } ?? "Not logged"
        }
    }
}

#if DEBUG
@MainActor private func executionPreview(_ workout: ScheduledWorkout, size: DynamicTypeSize = .large) -> some View {
    let container = try! PersistenceController.makeContainer(inMemory: true)
    container.mainContext.insert(WorkoutMapper.record(from: workout)); try! container.mainContext.save()
    return NavigationStack { WorkoutExecutionView(id: workout.id, repository: SwiftDataRepository(container: container)) }
        .modelContainer(container).preferredColorScheme(.dark).dynamicTypeSize(size)
}
#Preview("Fresh planned") { executionPreview(EquilibriumFixtures.planned()) }
#Preview("Mid-workout") { executionPreview(EquilibriumFixtures.midWorkout()) }
#Preview("Duration") { executionPreview(EquilibriumFixtures.mixed()) }
#Preview("Completed read-only") { executionPreview(EquilibriumFixtures.completed()) }
#Preview("Accessibility XXL") { executionPreview(EquilibriumFixtures.midWorkout(id: "preview-xxl"), size: .accessibility3) }
#endif
