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
        }
        .foregroundStyle(EQColor.primaryText)
        .navigationBarBackButtonHidden()
        .toolbar { workoutToolbar }
        .task { await model.activate() }
        .onChange(of: scenePhase) { _, phase in if phase == .active { model.refreshRest() } }
        .onChange(of: model.didAutoComplete) { _, completed in
            if completed { completionFeedback += 1; dismiss() }
        }
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
                    Button("Reset workout", systemImage: "arrow.counterclockwise", role: .destructive) { confirmsReset = true }
                    Button("Delete workout", systemImage: "trash", role: .destructive) { confirmsDelete = true }
                }
                .accessibilityLabel("Workout options")
                .accessibilityHint("Contains available workout actions")
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
            HStack {
                Text(model.restState == nil ? "ACTIVE EXERCISE" : "REST")
                    .font(EQTypography.caption.weight(.bold))
                Spacer()
                if model.restState == nil, let exercise = model.currentExercise, !model.isReadOnly {
                    Button("Settings") { settingsExercise = exercise }
                        .font(EQTypography.caption.weight(.semibold))
                        .accessibilityLabel("Exercise Settings")
                }
            }
            Group {
                if let work = model.workTimerState {
                    WorkTimerView(state: work, timerState: model.timer.state, pauseResume: model.toggleWorkTimerPause, skip: model.skipWorkTimer)
                } else if let rest = model.restState {
                    RestModeView(state: rest, skip: model.skipRest)
                } else if let exercise = model.currentExercise, let prescription = model.currentPrescription {
                    FocusedSetView(
                        exercise: exercise,
                        prescription: prescription,
                        progression: model.suggestion(for: exercise),
                        selectedIndex: model.selectedSetIndex,
                        isReadOnly: model.isReadOnly,
                        weightUnit: model.weightUnit,
                        select: model.selectSet,
                        log: { input in await model.log(exerciseID: exercise.id, prescriptionID: prescription.id, input: input) },
                        startTimed: { input in model.startWorkTimer(exerciseID: exercise.id, prescriptionID: prescription.id, input: input) }
                    )
                    .id("\(exercise.id.rawValue)-\(prescription.id.rawValue)-\(model.progressionIdentity(for: exercise))")
                    if !model.isReadOnly {
                        HStack {
                            if !exercise.loggedSets.contains(where: { $0.prescriptionID == prescription.id && $0.completedAt != nil }) {
                                Button("Remove set", role: .destructive) { Task { await model.removeCurrentSet(exerciseID: exercise.id, prescriptionID: prescription.id) } }
                            }
                        }.frame(minHeight: EQDimension.minimumTouch)
                    }
                } else if let exercise = model.currentExercise, !model.isReadOnly {
                    FirstSetView(exercise: exercise, progression: model.suggestion(for: exercise), weightUnit: model.weightUnit) { input in
                        if exercise.isTimeBased { await model.startFirstWorkTimer(exerciseID: exercise.id, input: input) }
                        else { await model.logFirstSet(exerciseID: exercise.id, input: input) }
                    }
                } else {
                    Text(model.isReadOnly ? "Workout complete." : "Every required set is logged.").font(EQTypography.sectionTitle)
                }
            }
            if model.restState == nil, model.workTimerState == nil, let exercise = model.currentExercise, !model.isReadOnly {
                HStack {
                    Spacer()
                    Button("Add set", systemImage: "plus") { Task { await model.addSet(exerciseID: exercise.id) } }
                        .frame(minHeight: EQDimension.minimumTouch)
                        .accessibilityHint("Appends a new working set to \(exercise.nameSnapshot)")
                }
            }
            if let exercise = model.performanceExercise, let historyRepository {
                NavigationLink {
                    ExercisePerformanceView(exerciseID: exercise.exerciseID, fallbackName: exercise.nameSnapshot, repository: historyRepository, weightUnit: model.weightUnit)
                } label: { Label("Previous performance", systemImage: "chart.xyaxis.line").frame(minHeight: EQDimension.minimumTouch) }
                .accessibilityHint("Shows completed working sets, trend, and personal record")
            }
        }
        .eqCard(elevated: true)
        .padding(.horizontal, EQSpacing.md)
        .animation(reduceMotion ? nil : .easeInOut(duration: EQMotion.standard), value: model.restState != nil)
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
    let exercise: WorkoutExercise; let progression: ProgressionSuggestion?; let weightUnit: WeightUnit; let log: (SetLogInput) async -> Void
    @State private var weight: String
    @State private var repetitions: String
    @FocusState private var fieldFocused: Bool

    init(exercise: WorkoutExercise, progression: ProgressionSuggestion?, weightUnit: WeightUnit, log: @escaping (SetLogInput) async -> Void) {
        self.exercise = exercise
        self.progression = progression
        self.weightUnit = weightUnit
        self.log = log
        _weight = State(initialValue: WeightText.value(progression?.suggestedWeight, unit: weightUnit))
        _repetitions = State(initialValue: progression?.targetRepetitions.map { String($0.lowerBound) } ?? "")
    }
    var body: some View {
        VStack(alignment: .leading, spacing: EQSpacing.lg) {
            Text(exercise.nameSnapshot).font(EQTypography.exerciseTitle)
            Text("No previous working sets").font(EQTypography.caption).foregroundStyle(EQColor.secondaryText)
            HStack(spacing: EQSpacing.lg) {
                HeroValueField(value: $weight, label: (weightUnit == .pounds ? "lb" : "kg") + (progression?.rationale == .increaseWeight ? " ↑" : ""), accessibilityLabel: "Weight", keyboard: .decimalPad).focused($fieldFocused)
                HeroValueField(value: $repetitions, label: exercise.isTimeBased ? "seconds" : "reps" + (progression?.rationale == .addRepetitions ? " ↑" : ""), accessibilityLabel: exercise.isTimeBased ? "Seconds" : "Repetitions", keyboard: .numberPad).focused($fieldFocused)
            }
            Button(exercise.isTimeBased ? "Start Timer" : "Log first set") { guard let value = Int(repetitions), value > 0 else { return }; Task { await log(exercise.isTimeBased ? .duration(weight: WeightText.weight(from: weight, unit: weightUnit), seconds: TimeInterval(value)) : .repetitions(weight: WeightText.weight(from: weight, unit: weightUnit), repetitions: value)) } }
                .frame(maxWidth: .infinity, minHeight: EQDimension.minimumTouch).buttonStyle(.borderedProminent).buttonBorderShape(.roundedRectangle(radius: EQRadius.control))
        }.toolbar { ToolbarItemGroup(placement: .keyboard) { Spacer(); Button("Done") { fieldFocused = false } } }
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
    let progression: ProgressionSuggestion?
    let selectedIndex: Int
    let isReadOnly: Bool
    let weightUnit: WeightUnit
    let select: (Int) -> Void
    let log: (SetLogInput) async -> Void
    let startTimed: (SetLogInput) -> Void
    @State private var weightText: String
    @State private var valueText: String
    @FocusState private var focusedField: Field?
    private enum Field { case weight, value }

    init(exercise: WorkoutExercise, prescription: SetPrescription, progression: ProgressionSuggestion?, selectedIndex: Int, isReadOnly: Bool, weightUnit: WeightUnit, select: @escaping (Int) -> Void, log: @escaping (SetLogInput) async -> Void, startTimed: @escaping (SetLogInput) -> Void) {
        self.exercise = exercise; self.prescription = prescription; self.progression = progression; self.selectedIndex = selectedIndex; self.isReadOnly = isReadOnly; self.weightUnit = weightUnit; self.select = select; self.log = log; self.startTimed = startTimed
        let logged = exercise.loggedSets.first { $0.prescriptionID == prescription.id }
        let hasLoggedPredecessor = exercise.prescriptions.prefix(selectedIndex).contains { preceding in exercise.loggedSets.contains { $0.prescriptionID == preceding.id && $0.completedAt != nil } }
        let startingWeight = logged?.weight ?? (hasLoggedPredecessor ? prescription.suggestedWeight : progression?.suggestedWeight ?? prescription.suggestedWeight)
        _weightText = State(initialValue: WeightText.value(startingWeight, unit: weightUnit))
        switch prescription.target {
        case .repetitions(let range): _valueText = State(initialValue: logged?.repetitions.map(String.init) ?? (hasLoggedPredecessor ? String(range.lowerBound) : progression?.targetRepetitions.map { String($0.lowerBound) } ?? String(range.lowerBound)))
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
                HeroValueField(value: $weightText, label: weightLabel, accessibilityLabel: "\(exercise.nameSnapshot), set \(selectedIndex + 1), weight", keyboard: .decimalPad)
                    .focused($focusedField, equals: .weight)
                HeroValueField(value: $valueText, label: progressedValueLabel, accessibilityLabel: "\(exercise.nameSnapshot), set \(selectedIndex + 1), \(valueLabel)", keyboard: .numberPad)
                    .focused($focusedField, equals: .value)
            }
            setSelector
            if !isReadOnly {
                Button { commit() } label: {
                    Label(isLogged ? "Update set" : (exercise.isTimeBased ? "Start Timer" : "Log set"), systemImage: exercise.isTimeBased && !isLogged ? "timer" : "checkmark").frame(maxWidth: .infinity, minHeight: EQDimension.minimumTouch)
                }
                .buttonStyle(.borderedProminent).buttonBorderShape(.roundedRectangle(radius: EQRadius.control))
                .accessibilityHint("Saves this set immediately")
            }
        }
        .accessibilityElement(children: .contain)
        .toolbar { ToolbarItemGroup(placement: .keyboard) { Spacer(); Button("Done") { focusedField = nil } } }
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
    private var weightLabel: String { (weightUnit == .pounds ? "lb" : "kg") + (progression?.rationale == .increaseWeight ? " ↑" : "") }
    private var progressedValueLabel: String { valueLabel + (progression?.rationale == .addRepetitions ? " ↑" : "") }
    private func commit() {
        focusedField = nil
        guard let value = Int(valueText), value > 0 else { return }
        let input: SetLogInput
        switch prescription.target {
        case .repetitions: input = .repetitions(weight: WeightText.weight(from: weightText, unit: weightUnit), repetitions: value)
        case .duration: input = .duration(weight: WeightText.weight(from: weightText, unit: weightUnit), seconds: TimeInterval(value))
        }
        if exercise.isTimeBased && !isLogged { startTimed(input) }
        else { Task { await log(input) } }
    }
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

private struct WorkTimerView: View {
    let state: WorkoutWorkTimerState
    let timerState: CountdownTimerState
    let pauseResume: () -> Void
    let skip: () -> Void
    var body: some View {
        VStack(alignment: .leading, spacing: EQSpacing.lg) {
            Text(state.exerciseName).font(EQTypography.exerciseTitle)
            Text(phaseLabel).font(EQTypography.caption.weight(.bold)).foregroundStyle(state.phase == .switchSides ? EQColor.rest : EQColor.accent)
            Text(durationText).font(EQTypography.metric).monospacedDigit().contentTransition(.numericText())
                .accessibilityLabel("\(phaseLabel), \(durationText) remaining")
            Text("Set \(state.setNumber) of \(state.totalSets)").font(EQTypography.caption).foregroundStyle(EQColor.secondaryText)
            ProgressView(value: state.totalDuration - state.remaining, total: state.totalDuration).tint(state.phase == .switchSides ? EQColor.rest : EQColor.accent)
            HStack {
                Button(timerState == .paused ? "Resume" : "Pause", action: pauseResume)
                    .buttonStyle(.borderedProminent).disabled(state.phase == .ready)
                Button("Skip", action: skip).buttonStyle(.bordered)
            }.frame(minHeight: EQDimension.minimumTouch)
        }
    }
    private var phaseLabel: String {
        switch state.phase { case .ready: "GET READY"; case .firstSide: "WORK"; case .switchSides: "SWITCH SIDES"; case .secondSide: "WORK · SECOND SIDE" }
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
