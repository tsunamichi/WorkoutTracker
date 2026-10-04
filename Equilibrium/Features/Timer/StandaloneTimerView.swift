import SwiftUI

enum StandaloneTimerNavigationPolicy {
    static func replacingCreation(in path: [TimerRoute], withRunID id: String) -> [TimerRoute] {
        guard path.last == .create else { return path + [.run(id)] }
        var result = path; result[result.count - 1] = .run(id); return result
    }
}

enum TimerRoute: Hashable { case create, edit(String), run(String) }

struct StandaloneTimerView: View {
    private let store: any StandaloneTimerConfigurationStore
    @Binding private var path: [TimerRoute]
    private let dismissToHome: (() -> Void)?
    @State private var configurations: [StandaloneTimerConfiguration] = []
    @State private var deletionTarget: StandaloneTimerConfiguration?
    init(store: (any StandaloneTimerConfigurationStore)? = nil, path: Binding<[TimerRoute]> = .constant([]), dismissToHome: (() -> Void)? = nil) {
        self.store = store ?? UserDefaultsStandaloneTimerStore()
        _path = path
        self.dismissToHome = dismissToHome
    }
    var body: some View {
        VStack(spacing: 0) {
            if let dismissToHome {
                HomeTimerSurfaceButton(
                    title: "Workout of the day",
                    systemImage: "chevron.up",
                    iconPlacement: .top,
                    accessibilityHint: "Returns to the workout of the day"
                ) {
                    dismissToHome()
                }
            }

            List {
                Section {
                    if !configurations.isEmpty {
                        ForEach(configurations) { configuration in
                            HStack {
                                Button { path.append(.run(configuration.id)) } label: { VStack(alignment: .leading) { Text(configuration.name).lineLimit(2); Text("\(configuration.exercisesPerRound) exercises × \(configuration.rounds) rounds").eqTextStyle(.caption).foregroundStyle(EQColor.secondaryText) } }.buttonStyle(.plain).frame(maxWidth: .infinity, minHeight: EQDimension.minimumTouch, alignment: .leading)
                                Menu { Button("Edit Timer", systemImage: "pencil") { path.append(.edit(configuration.id)) }; Button("Delete Timer", systemImage: "trash", role: .destructive) { deletionTarget = configuration } } label: { Label("Timer actions", systemImage: "ellipsis.circle").labelStyle(.iconOnly) }.accessibilityLabel("Actions for \(configuration.name)")
                            }
                        }
                    }
                } header: {
                    Text(configurations.isEmpty ? "No timers yet" : "Saved Timers")
                        .eqTextStyle(.sectionTitle)
                        .foregroundStyle(EQColor.primaryText)
                        .textCase(nil)
                }
            }
            .scrollContentBackground(.hidden)

            HomeAddActionButton(
                accessibilityHint: "Opens the timer creator"
            ) {
                path.append(.create)
            } label: {
                HStack(spacing: EQSpacing.xs) {
                    Image(systemName: "plus.circle.fill")
                    Text("Create Timer")
                }
            }
        }
        .background(EQColor.canvas)
        .toolbar(.hidden, for: .navigationBar)
        .onAppear { reload() }
            .onReceive(NotificationCenter.default.publisher(for: .equilibriumRepositoryDidChange)) { _ in reload() }
            .alert("Delete timer?", isPresented: Binding(get: { deletionTarget != nil }, set: { if !$0 { deletionTarget = nil } })) {
                Button("Cancel", role: .cancel) { deletionTarget = nil }
                Button("Delete Timer", role: .destructive) { if let deletionTarget { StandaloneTimerHomeActions.delete(id: deletionTarget.id, store: store, configurations: &configurations) }; deletionTarget = nil }
            } message: { Text("This timer will be permanently deleted.") }
    }
    private func reload() { configurations = store.configurations().sorted { $0.createdAt < $1.createdAt } }
}

@MainActor enum StandaloneTimerHomeActions {
    static func delete(id: String, store: any StandaloneTimerConfigurationStore, configurations: inout [StandaloneTimerConfiguration]) {
        store.delete(id: id)
        configurations.removeAll { $0.id == id }
    }
}

struct StandaloneTimerFormView: View {
    let store: any StandaloneTimerConfigurationStore
    let configuration: StandaloneTimerConfiguration?
    let didSave: (StandaloneTimerConfiguration) -> Void
    @State private var name: String; @State private var move: Int; @State private var exerciseRest: Int; @State private var exercises: Int; @State private var rounds: Int; @State private var roundRest: Int
    init(store: any StandaloneTimerConfigurationStore, configuration: StandaloneTimerConfiguration? = nil, didSave: @escaping (StandaloneTimerConfiguration) -> Void) {
        self.store = store; self.configuration = configuration; self.didSave = didSave
        _name = State(initialValue: configuration?.name ?? ""); _move = State(initialValue: Int(configuration?.moveDuration ?? 30)); _exerciseRest = State(initialValue: Int(configuration?.exerciseRestDuration ?? 30)); _exercises = State(initialValue: configuration?.exercisesPerRound ?? 3); _rounds = State(initialValue: configuration?.rounds ?? 1); _roundRest = State(initialValue: Int(configuration?.roundRestDuration ?? 30))
    }
    @Environment(\.dismiss) private var dismiss
    @FocusState private var nameFocused: Bool
    private var title: String { configuration == nil ? "Create Timer" : "Edit Timer" }
    private var canSave: Bool { !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            header
            ScrollView {
                VStack(alignment: .leading, spacing: EQLayout.exerciseBlockGap) {
                    TextField("Timer name", text: $name)
                        .eqTextStyle(.listItemTitle)
                        .textFieldStyle(.plain)
                        .focused($nameFocused)
                        .submitLabel(.done)
                        .frame(minHeight: EQLayout.minimumTouch)
                        .padding(.horizontal, EQSpacing.md)
                        .background(EQColor.cardFill, in: RoundedRectangle(cornerRadius: EQRadius.card, style: .continuous))
                    section("EXERCISE") {
                        stepperRow("Move for", format(move), value: $move, range: 5...120, step: 5)
                        stepperRow("Rest after each exercise", format(exerciseRest), value: $exerciseRest, range: 5...120, step: 5)
                    }
                    section("ROUND") {
                        stepperRow("Exercises in a round", "\(exercises)", value: $exercises, range: 1...20)
                        stepperRow("Rounds", "\(rounds)", value: $rounds, range: 1...10)
                        stepperRow("Rest between rounds", format(roundRest), value: $roundRest, range: 5...180, step: 5)
                    }
                }
                .padding(.horizontal, EQLayout.screenGutter)
                .padding(.top, EQSpacing.md + EQLayout.WorkoutExecution.overviewContentTopInset)
                .padding(.bottom, EQSpacing.lg)
            }
            .scrollIndicators(.hidden)
            .scrollDismissesKeyboard(.interactively)
            saveButton
                .padding(.horizontal, EQLayout.screenGutter)
                .padding(.bottom, EQSpacing.md)
        }
        .foregroundStyle(EQColor.primaryText)
        .background(EQColor.canvas)
        .toolbar(.hidden, for: .navigationBar)
    }
    private var header: some View {
        Button { dismiss() } label: {
            HStack(alignment: .firstTextBaseline, spacing: EQSpacing.xs) {
                Image(systemName: "chevron.left")
                Text(title).eqTextStyle(.navigationTitle).lineLimit(1)
            }
            .frame(minHeight: EQLayout.minimumTouch)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .foregroundStyle(EQColor.primaryText)
        .accessibilityLabel("Back, \(title)")
        .frame(maxWidth: .infinity, minHeight: EQLayout.minimumTouch + EQSpacing.sm, alignment: .leading)
        .padding(.horizontal, EQLayout.screenGutter)
    }
    private func section<Content: View>(_ label: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: EQSpacing.sm) {
            Text(label).eqTextStyle(.sectionLabel).foregroundStyle(EQColor.secondaryText)
            VStack(alignment: .leading, spacing: EQSpacing.sm) { content() }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(EQSpacing.md)
                .background(EQColor.cardFill, in: RoundedRectangle(cornerRadius: EQRadius.card, style: .continuous))
        }
    }
    private func stepperRow(_ label: String, _ display: String, value: Binding<Int>, range: ClosedRange<Int>, step: Int = 1) -> some View {
        HStack(spacing: EQSpacing.sm) {
            VStack(alignment: .leading, spacing: EQSpacing.xxs) {
                Text(label).eqTextStyle(.secondaryBody).foregroundStyle(EQColor.secondaryText)
                Text(display).eqTextStyle(.listItemTitle).monospacedDigit()
            }
            Spacer(minLength: 0)
            HStack(spacing: EQSpacing.xs) {
                stepButton("minus", enabled: value.wrappedValue > range.lowerBound) { value.wrappedValue = max(range.lowerBound, value.wrappedValue - step) }
                    .accessibilityLabel("Decrease \(label)")
                stepButton("plus", enabled: value.wrappedValue < range.upperBound) { value.wrappedValue = min(range.upperBound, value.wrappedValue + step) }
                    .accessibilityLabel("Increase \(label)")
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityValue(display)
    }
    private func stepButton(_ systemImage: String, enabled: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: systemImage)
                .frame(width: EQLayout.minimumTouch, height: EQLayout.minimumTouch)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .eqTextStyle(.listItemTitle)
        .foregroundStyle(enabled ? EQColor.primaryText : EQColor.secondaryText.opacity(0.4))
        .background(EQColor.cardFill, in: RoundedRectangle(cornerRadius: EQRadius.button, style: .continuous))
        .disabled(!enabled)
    }
    private var saveButton: some View {
        Button { save() } label: {
            Text(configuration == nil ? "Create Timer" : "Save Changes")
                .frame(maxWidth: .infinity, minHeight: EQLayout.minimumTouch + EQSpacing.xs)
                .contentShape(Rectangle())
        }
        .eqPrimaryCTA(
            tint: canSave ? EQColor.ctaSurface : EQColor.ctaDisabledSurface,
            foreground: canSave ? EQColor.ctaLabel : EQColor.ctaDisabledLabel
        )
        .disabled(!canSave)
    }
    private func save() {
        let value = StandaloneTimerConfiguration(id: configuration?.id ?? UUID().uuidString.lowercased(), name: name.trimmingCharacters(in: .whitespacesAndNewlines), moveDuration: Double(move), exerciseRestDuration: Double(exerciseRest), exercisesPerRound: exercises, rounds: rounds, roundRestDuration: Double(roundRest), createdAt: configuration?.createdAt ?? .now, updatedAt: .now)
        guard value.isValid else { return }; store.save(value)
        didSave(value)
    }
    private func format(_ seconds: Int) -> String { seconds < 60 ? "\(seconds)s" : seconds % 60 == 0 ? "\(seconds / 60)m" : "\(seconds / 60)m \(seconds % 60)s" }
}

struct StandaloneTimerRunView: View {
    @State private var runner: StandaloneIntervalTimer
    @State private var ticks: Task<Void, Never>?
    @State private var confirmsExit = false
    @Environment(\.dismiss) private var dismiss
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    init(configuration: StandaloneTimerConfiguration) { _runner = State(initialValue: StandaloneIntervalTimer(configuration: configuration, haptics: SystemHapticsClient(), audio: SystemAudioFeedbackClient())) }
    var body: some View {
        VStack(spacing: EQSpacing.xl) {
            Spacer()
            Text(runner.phase == .move ? "MOVE" : runner.phase == .exerciseRest ? "REST" : runner.phase == .roundRest ? "ROUND REST" : "COMPLETE").eqTextStyle(.sectionTitle).foregroundStyle(runner.phase == .move ? EQColor.accent : EQColor.rest)
            Text(display).eqTextStyle(.largeMetric).monospacedDigit().contentTransition(reduceMotion ? .opacity : .numericText()).accessibilityLabel("\(Int(ceil(runner.remaining))) seconds remaining")
            HStack { metric("Exercise", "\(runner.exercise)/\(runner.configuration.exercisesPerRound)"); metric("Round", "\(runner.round)/\(runner.configuration.rounds)") }
            HStack {
                Button(primaryLabel) { primary() }.buttonStyle(.borderedProminent)
                Button("Skip") { runner.skip(); runTicks() }.buttonStyle(.bordered).disabled(runner.state == .ready || runner.state == .completed)
                Menu("Options", systemImage: "ellipsis") { Button("Reset") { runner.reset(); runTicks() }; Button("Restart") { runner.restart(); runTicks() } }
            }.frame(minHeight: EQDimension.minimumTouch)
            if runner.state == .completed { Text("Timer complete").eqTextStyle(.screenTitle) }
            Spacer()
            Text("Standalone timers never create workout or history records.").eqTextStyle(.caption).foregroundStyle(EQColor.secondaryText)
        }
        .padding(EQSpacing.xl)
        .navigationTitle(runner.configuration.name)
        .navigationBarBackButtonHidden(StandaloneTimerExitPolicy.requiresConfirmation(for: runner.state))
        .toolbar {
            if StandaloneTimerExitPolicy.requiresConfirmation(for: runner.state) {
                ToolbarItem(placement: .topBarLeading) {
                    Button { requestExit() } label: { Label("Timer", systemImage: "chevron.left") }
                        .accessibilityHint("Asks before ending the active timer")
                }
            }
        }
        .alert("End timer?", isPresented: $confirmsExit) {
            Button("Keep Timer", role: .cancel) {}
            Button("End Timer", role: .destructive) { endAndDismiss() }
        } message: { Text("The timer will end if you leave this page.") }
        .onDisappear { ticks?.cancel() }
        .onChange(of: scenePhase) { _, phase in if phase == .active { runner.refresh(); runTicks() } }
    }
    private var display: String { let seconds = max(0, Int(ceil(runner.remaining))); return String(format: "%d:%02d", seconds / 60, seconds % 60) }
    private var primaryLabel: String { switch runner.state { case .ready: "Play"; case .running: "Pause"; case .paused: "Resume"; case .completed: "Restart" } }
    private func primary() { switch runner.state { case .ready: runner.play(); case .running: runner.pause(); case .paused: runner.resume(); case .completed: runner.restart() }; runTicks() }
    private func requestExit() {
        if StandaloneTimerExitPolicy.requiresConfirmation(for: runner.state) { confirmsExit = true }
        else { dismiss() }
    }
    private func endAndDismiss() { ticks?.cancel(); ticks = nil; runner.reset(); dismiss() }
    private func runTicks() { ticks?.cancel(); guard runner.state == .running else { return }; ticks = Task { while !Task.isCancelled && runner.state == .running { try? await Task.sleep(for: .milliseconds(200)); runner.refresh() } } }
    private func metric(_ title: String, _ value: String) -> some View { VStack { Text(value).eqTextStyle(.sectionTitle); Text(title).eqTextStyle(.caption).foregroundStyle(EQColor.secondaryText) }.frame(maxWidth: .infinity).eqCard() }
}
