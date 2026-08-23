import SwiftUI

struct WorkoutExecutionView: View {
    @State private var model: WorkoutExecutionModel
    @Environment(\.dismiss) private var dismiss
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.scenePhase) private var scenePhase
    @State private var completionFeedback = 0
    @State private var confirmsReset = false
    @State private var confirmsDelete = false
    @State private var editsRestDuration = false
    @State private var settingsExercise: WorkoutExercise?
    private let historyRepository: (any ExerciseHistoryRepository)?

    init(id: WorkoutID, repository: any WorkoutRepository, historyRepository: (any ExerciseHistoryRepository)? = nil, progressionRepository: (any ProgressionRepository)? = nil, exerciseRepository: (any ExerciseRepository)? = nil, weightUnit: WeightUnit = .pounds, defaultRestDuration: TimeInterval = 90, didPersist: @escaping (Workout) -> Void = { _ in }) {
        self.historyRepository = historyRepository ?? (repository as? SwiftDataRepository)
        _model = State(initialValue: WorkoutExecutionModel(workoutID: id, repository: repository, historyRepository: historyRepository ?? (repository as? SwiftDataRepository), progressionRepository: progressionRepository ?? (repository as? SwiftDataRepository), exerciseRepository: exerciseRepository ?? (repository as? SwiftDataRepository), weightUnit: weightUnit, defaultRestDuration: defaultRestDuration, haptics: SystemHapticsClient(), audio: SystemAudioFeedbackClient(), didPersist: didPersist))
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
        .alert("Reset workout?", isPresented: $confirmsReset) {
            Button("Cancel", role: .cancel) {}
            Button("Reset", role: .destructive) { Task { _ = await model.resetWorkout() } }
        } message: { Text("Clear all logged progress for this workout? This cannot be undone.") }
        .alert("Delete workout?", isPresented: $confirmsDelete) {
            Button("Cancel", role: .cancel) {}
            Button("Delete", role: .destructive) { Task { if await model.deleteWorkout() { dismiss() } } }
        } message: { Text("Remove this workout? Your personal exercise definitions are not affected.") }
        .sheet(isPresented: $editsRestDuration) {
            RestDurationEditor(initialSeconds: model.configuredRestDuration) { seconds in await model.setRestDuration(seconds) }
        }
        .sheet(item: $settingsExercise) { exercise in ExerciseSettingsView(exercise: exercise, model: model) }
    }

    @ToolbarContentBuilder private var workoutToolbar: some ToolbarContent {
        ToolbarItem(placement: .topBarLeading) {
            Button { dismiss() } label: { Label("Home", systemImage: "chevron.left") }
                .accessibilityHint("Returns to Home")
        }
        ToolbarItem(placement: .topBarTrailing) {
            if model.showsExecutionOptions {
                Menu("Options", systemImage: "ellipsis") {
                    if model.canEditRestDuration {
                        Button("Rest duration", systemImage: "timer") { editsRestDuration = true }
                    }
                    if let shareText = model.shareText {
                        ShareLink(item: shareText, subject: Text(model.workout?.titleSnapshot ?? "Workout")) {
                            Label("Share workout", systemImage: "square.and.arrow.up")
                        }
                    }
                    Button("Mark as complete", systemImage: "checkmark.circle") { completeWorkout() }
                        .disabled(!model.canComplete)
                    Button("Reset workout", systemImage: "arrow.counterclockwise", role: .destructive) { confirmsReset = true }
                    Button("Delete workout", systemImage: "trash", role: .destructive) { confirmsDelete = true }
                }
                .accessibilityLabel("Workout options")
                .accessibilityHint(model.canComplete ? "Contains available workout actions" : "Workout completion becomes available after every required set is logged")
            }
        }
    }

    private func content(_ workout: Workout) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: EQSpacing.md) {
                Text(workout.titleSnapshot).font(EQTypography.title).padding(.horizontal, EQSpacing.lg)
                if model.isReadOnly {
                    Text("Completed · Read-only").font(EQTypography.caption).foregroundStyle(EQColor.success).padding(.horizontal, EQSpacing.lg)
                }
                exercisesCard(workout)
                activeExerciseCard
                if let error = model.errorMessage {
                    Label(error, systemImage: "exclamationmark.triangle").font(EQTypography.caption).foregroundStyle(EQColor.warning).padding(.horizontal, EQSpacing.lg)
                }
            }
            .padding(.bottom, EQSpacing.md)
        }
        .scrollDismissesKeyboard(.interactively)
        .scrollIndicators(.hidden)
    }

    private func exercisesCard(_ workout: Workout) -> some View {
        VStack(alignment: .leading, spacing: EQSpacing.sm) {
            HStack {
                Text("EXERCISES").font(EQTypography.caption.weight(.bold))
                Spacer()
                Text("\(model.progress.completedSetCount) of \(model.progress.requiredSetCount) sets")
                    .font(EQTypography.caption).foregroundStyle(EQColor.secondaryText)
            }
            ForEach(workout.exercises) { exercise in
                let state = model.states[exercise.id] ?? .upcoming
                Button {
                    if workout.status == .inProgress { model.focus(exercise.id) }
                } label: {
                    ExerciseListRow(exercise: exercise, detail: exerciseDetail(exercise, state: state), state: state)
                }
                .buttonStyle(.plain)
                .disabled(workout.status == .completed)
                .accessibilityHint(workout.status == .inProgress ? "Makes this the active exercise without changing workout order" : "Completed workout is read-only")
                .contextMenu { if workout.status == .inProgress { Button("Exercise Settings", systemImage: "gearshape") { settingsExercise = exercise } } }
            }
            if workout.status == .completed { ReadOnlySetReview(exercises: workout.exercises, weightUnit: model.weightUnit) }
        }
        .eqCard()
        .padding(.horizontal, EQSpacing.md)
    }

    private var activeExerciseCard: some View {
        VStack(alignment: .leading, spacing: EQSpacing.md) {
            Text(model.restState == nil ? "ACTIVE EXERCISE" : "REST")
                .font(EQTypography.caption.weight(.bold))
            Group {
                if let rest = model.restState {
                    RestModeView(state: rest, skip: model.skipRest)
                } else if let exercise = model.currentExercise, let prescription = model.currentPrescription {
                    if let suggestion = model.suggestion(for: exercise) { ProgressionSuggestionView(suggestion: suggestion, unit: model.weightUnit) }
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
                    if !model.isReadOnly {
                        HStack {
                            Button("Add set") { Task { await model.addSet(exerciseID: exercise.id) } }
                            Spacer()
                            if !exercise.loggedSets.contains(where: { $0.prescriptionID == prescription.id && $0.completedAt != nil }) {
                                Button("Remove set", role: .destructive) { Task { await model.removeCurrentSet(exerciseID: exercise.id, prescriptionID: prescription.id) } }
                            }
                        }.frame(minHeight: EQDimension.minimumTouch)
                    }
                } else if let exercise = model.currentExercise, !model.isReadOnly {
                    FirstSetView(exercise: exercise, weightUnit: model.weightUnit) { input in await model.logFirstSet(exerciseID: exercise.id, input: input) }
                } else {
                    Text(model.isReadOnly ? "Workout complete." : "Every required set is logged.").font(EQTypography.sectionTitle)
                }
            }
            if let exercise = model.performanceExercise, let historyRepository {
                NavigationLink {
                    ExercisePerformanceView(exerciseID: exercise.exerciseID, fallbackName: exercise.nameSnapshot, repository: historyRepository, weightUnit: model.weightUnit)
                } label: { Label("Previous performance", systemImage: "chart.xyaxis.line").frame(minHeight: EQDimension.minimumTouch) }
                .accessibilityHint("Shows completed working sets, trend, and personal record")
            }
            if model.canComplete {
                Button { completeWorkout() } label: { Label("Complete workout", systemImage: "checkmark.circle.fill").frame(maxWidth: .infinity, minHeight: EQDimension.minimumTouch) }
                    .buttonStyle(.borderedProminent).buttonBorderShape(.roundedRectangle(radius: EQRadius.control))
            }
        }
        .eqCard(elevated: true)
        .padding(.horizontal, EQSpacing.md)
        .animation(reduceMotion ? nil : .easeInOut(duration: EQMotion.standard), value: model.restState != nil)
    }

    private func completeWorkout() {
        Task { await model.complete(); if model.showsCompletion { completionFeedback += 1 } }
    }

    private func prescriptionSummary(_ exercise: WorkoutExercise) -> String {
        guard let first = exercise.prescriptions.first else { return "No prescribed sets" }
        switch first.target {
        case .repetitions(let range): return "\(exercise.prescriptions.count) sets · \(range.lowerBound)–\(range.upperBound) reps"
        case .duration(let seconds): return "\(exercise.prescriptions.count) sets · \(Int(seconds)) seconds"
        }
    }

    private func exerciseDetail(_ exercise: WorkoutExercise, state: ExerciseState) -> String {
        switch state {
        case .completed: return "\(WorkoutExecutionQuery.completedPrescriptionIDs(in: exercise).count) sets logged"
        case .current: return "Current · \(prescriptionSummary(exercise))"
        case .upcoming: return prescriptionSummary(exercise)
        }
    }

    private var completionOverlay: some View {
        ZStack {
            EQColor.canvas.opacity(0.96).ignoresSafeArea()
            VStack(spacing: EQSpacing.lg) {
                Image(systemName: "checkmark.circle.fill").font(.largeTitle).foregroundStyle(EQColor.success)
                Text("Workout complete").font(EQTypography.title)
                Text("Your sets are saved.").font(EQTypography.body).foregroundStyle(EQColor.secondaryText)
                Button("Return to Home") { dismiss() }
                    .buttonStyle(.borderedProminent).buttonBorderShape(.roundedRectangle(radius: EQRadius.control)).controlSize(.large)
            }.padding(EQSpacing.xl)
        }
        .transition(reduceMotion ? .opacity : .scale.combined(with: .opacity))
        .animation(reduceMotion ? nil : .easeOut(duration: EQMotion.completion), value: model.showsCompletion)
        .accessibilityAddTraits(.isModal)
    }
}

private struct RestDurationEditor: View {
    @Environment(\.dismiss) private var dismiss
    @State private var seconds: Double
    let save: (TimeInterval) async -> Bool
    init(initialSeconds: TimeInterval, save: @escaping (TimeInterval) async -> Bool) {
        _seconds = State(initialValue: min(300, max(15, (initialSeconds / 5).rounded() * 5))); self.save = save
    }
    var body: some View {
        NavigationStack {
            Form {
                Section("Rest time") {
                    Text(durationText).font(EQTypography.metric).monospacedDigit()
                    Slider(value: $seconds, in: 15...300, step: 5).accessibilityValue(durationText)
                }
                Section { Text("Applies to subsequent rests for the active exercise. An active countdown is unchanged.").font(EQTypography.caption).foregroundStyle(EQColor.secondaryText) }
            }
            .scrollContentBackground(.hidden).background(EQColor.canvas).navigationTitle("Rest duration").navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) { Button("Save") { Task { if await save(seconds) { dismiss() } } } }
            }
        }.presentationDetents([.medium])
    }
    private var durationText: String { String(format: "%d:%02d", Int(seconds) / 60, Int(seconds) % 60) }
}

private struct FirstSetView: View {
    let exercise: WorkoutExercise; let weightUnit: WeightUnit; let log: (SetLogInput) async -> Void
    @State private var weight = ""; @State private var repetitions = ""
    var body: some View {
        VStack(alignment: .leading, spacing: EQSpacing.lg) {
            Text(exercise.nameSnapshot).font(EQTypography.exerciseTitle)
            Text("No previous working sets").font(EQTypography.caption).foregroundStyle(EQColor.secondaryText)
            HStack(spacing: EQSpacing.lg) {
                HeroValueField(value: $weight, label: weightUnit == .pounds ? "lb" : "kg", accessibilityLabel: "Weight", keyboard: .decimalPad)
                HeroValueField(value: $repetitions, label: "reps", accessibilityLabel: "Repetitions", keyboard: .numberPad)
            }
            Button("Log first set") { guard let reps = Int(repetitions), reps > 0 else { return }; Task { await log(.repetitions(weight: WeightText.weight(from: weight, unit: weightUnit), repetitions: reps)) } }
                .frame(maxWidth: .infinity, minHeight: EQDimension.minimumTouch).buttonStyle(.borderedProminent).buttonBorderShape(.roundedRectangle(radius: EQRadius.control))
        }
    }
}

private struct ExerciseListRow: View {
    let exercise: WorkoutExercise
    let detail: String
    let state: ExerciseState
    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: EQSpacing.xxs) {
                Text(exercise.nameSnapshot).font(EQTypography.cardTitle)
                Text(detail).font(EQTypography.caption).foregroundStyle(EQColor.secondaryText)
            }
            Spacer()
            Image(systemName: state == .completed ? "checkmark.circle.fill" : state == .current ? "scope" : "circle")
                .foregroundStyle(state == .completed ? EQColor.success : state == .current ? EQColor.accent : EQColor.secondaryText)
        }.frame(minHeight: EQDimension.minimumTouch).contentShape(Rectangle())
    }
}

private struct FocusedSetView: View {
    let exercise: WorkoutExercise
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

    init(exercise: WorkoutExercise, prescription: SetPrescription, selectedIndex: Int, isReadOnly: Bool, weightUnit: WeightUnit, select: @escaping (Int) -> Void, log: @escaping (SetLogInput) async -> Void) {
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

private struct ProgressionSuggestionView: View {
    let suggestion: ProgressionSuggestion; let unit: WeightUnit
    var body: some View {
        VStack(alignment: .leading, spacing: EQSpacing.xxs) {
            Text("SUGGESTED").font(EQTypography.caption.weight(.bold)).foregroundStyle(EQColor.accent)
            Text(summary).font(EQTypography.sectionTitle)
            Text(rationale).font(EQTypography.caption).foregroundStyle(EQColor.secondaryText)
        }.accessibilityElement(children: .combine).accessibilityHint("Suggestion only. Workout values are not changed automatically.")
    }
    private var summary: String {
        let weight = suggestion.suggestedWeight.map { "\(WeightText.value($0, unit: unit)) \(unit == .pounds ? "lb" : "kg") · " } ?? ""
        let reps = suggestion.targetRepetitions.map { "\($0.lowerBound)–\($0.upperBound) reps" } ?? ""
        return weight + reps
    }
    private var rationale: String { switch suggestion.rationale { case .increaseWeight: "Increase weight"; case .addRepetitions: "Add repetitions"; case .repeatLast: "Repeat last performance" } }
}

private struct ExerciseSettingsView: View {
    let exercise: WorkoutExercise; let model: WorkoutExecutionModel
    @Environment(\.dismiss) private var dismiss
    @State private var timeBased: Bool; @State private var twoSided: Bool; @State private var profile: AutoProgressionProfile = .none
    @State private var choices: [ExerciseDefinition] = []; @State private var confirmsRemove = false
    init(exercise: WorkoutExercise, model: WorkoutExecutionModel) { self.exercise = exercise; self.model = model; _timeBased = State(initialValue: exercise.isTimeBased); _twoSided = State(initialValue: exercise.isTwoSided) }
    var body: some View {
        NavigationStack { Form {
            Section("Exercise Settings") { Toggle("Time-based exercise", isOn: $timeBased); Toggle("Two-sides exercise", isOn: $twoSided) }
            Section("Auto Progression") { Picker("Auto Progression", selection: $profile) { ForEach(AutoProgressionProfile.allCases, id: \.self) { Text($0.title).tag($0) } } }
            Section { Menu("Swap exercise") { ForEach(choices.filter { $0.id != exercise.exerciseID }) { definition in Button(definition.name) { Task { if await model.swapExercise(occurrenceID: exercise.id, with: definition) { dismiss() } } } } }; Button("Remove exercise", role: .destructive) { confirmsRemove = true } }
        }.navigationTitle(exercise.nameSnapshot).toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }; ToolbarItem(placement: .confirmationAction) { Button("Save") { Task { if await model.updateExerciseSettings(exerciseID: exercise.id, timeBased: timeBased, twoSided: twoSided, progression: profile) { dismiss() } } } } } }
        .task { choices = await model.availableExercises(); profile = await model.progressionProfile(for: exercise) }
        .alert("Remove exercise?", isPresented: $confirmsRemove) { Button("Cancel", role: .cancel) {}; Button("Remove", role: .destructive) { Task { if await model.removeExercise(exercise.id) { dismiss() } } } } message: { Text("Remove this exercise from this workout?") }
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
    let exercises: [WorkoutExercise]
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
@MainActor private func executionPreview(_ workout: Workout, size: DynamicTypeSize = .large) -> some View {
    let container = try! PersistenceController.makeContainer(inMemory: true)
    container.mainContext.insert(WorkoutMapper.record(from: workout)); try! container.mainContext.save()
    return NavigationStack { WorkoutExecutionView(id: workout.id, repository: SwiftDataRepository(container: container)) }
        .modelContainer(container).preferredColorScheme(.dark).dynamicTypeSize(size)
}
#Preview("Ready workout") { executionPreview(EquilibriumFixtures.ready()) }
#Preview("Mid-workout") { executionPreview(EquilibriumFixtures.midWorkout()) }
#Preview("Duration") { executionPreview(EquilibriumFixtures.mixed()) }
#Preview("Completed read-only") { executionPreview(EquilibriumFixtures.completed()) }
#Preview("Accessibility XXL") { executionPreview(EquilibriumFixtures.midWorkout(id: "preview-xxl"), size: .accessibility3) }
#endif
