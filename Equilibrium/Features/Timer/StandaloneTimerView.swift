import SwiftUI

struct StandaloneTimerView: View {
    private let store: any StandaloneTimerConfigurationStore
    @State private var configurations: [StandaloneTimerConfiguration] = []
    init(store: (any StandaloneTimerConfigurationStore)? = nil) { self.store = store ?? UserDefaultsStandaloneTimerStore() }
    var body: some View {
        List {
            Section { NavigationLink("Create Timer", destination: StandaloneTimerFormView(store: store)) }
            Section("Saved Timers") {
                ForEach(configurations) { configuration in NavigationLink { StandaloneTimerRunView(configuration: configuration) } label: { VStack(alignment: .leading) { Text(configuration.name); Text("\(configuration.exercisesPerRound) exercises × \(configuration.rounds) rounds").font(EQTypography.caption).foregroundStyle(EQColor.secondaryText) } } }
                .onDelete { offsets in for index in offsets { store.delete(id: configurations[index].id) }; reload() }
            }
        }.scrollContentBackground(.hidden).background(EQColor.canvas).navigationTitle("Timer").onAppear { reload() }
    }
    private func reload() { configurations = store.configurations().sorted { $0.createdAt < $1.createdAt } }
}

private struct StandaloneTimerFormView: View {
    let store: any StandaloneTimerConfigurationStore
    @State private var name = ""; @State private var move = 30; @State private var exerciseRest = 30; @State private var exercises = 3; @State private var rounds = 1; @State private var roundRest = 30
    @State private var created: StandaloneTimerConfiguration?
    var body: some View {
        Form {
            Section { TextField("Timer name", text: $name) }
            Section("Exercise") { Stepper("Move for: \(format(move))", value: $move, in: 5...120, step: 5); Stepper("Rest after each exercise: \(format(exerciseRest))", value: $exerciseRest, in: 5...120, step: 5) }
            Section("Round") { Stepper("Exercises in a round: \(exercises)", value: $exercises, in: 1...20); Stepper("Rounds: \(rounds)", value: $rounds, in: 1...10); Stepper("Rest between rounds: \(format(roundRest))", value: $roundRest, in: 5...180, step: 5) }
            Button("Create Timer") { let value = StandaloneTimerConfiguration(name: name.trimmingCharacters(in: .whitespacesAndNewlines), moveDuration: Double(move), exerciseRestDuration: Double(exerciseRest), exercisesPerRound: exercises, rounds: rounds, roundRestDuration: Double(roundRest)); guard value.isValid else { return }; store.save(value); created = value }.disabled(name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
        }.navigationTitle("Create Timer").navigationDestination(item: $created) { StandaloneTimerRunView(configuration: $0) }
    }
    private func format(_ seconds: Int) -> String { seconds < 60 ? "\(seconds)s" : seconds % 60 == 0 ? "\(seconds / 60)m" : "\(seconds / 60)m \(seconds % 60)s" }
}

private struct StandaloneTimerRunView: View {
    @State private var runner: StandaloneIntervalTimer
    @State private var ticks: Task<Void, Never>?
    @State private var confirmsExit = false
    @Environment(\.dismiss) private var dismiss
    @Environment(\.scenePhase) private var scenePhase
    init(configuration: StandaloneTimerConfiguration) { _runner = State(initialValue: StandaloneIntervalTimer(configuration: configuration, haptics: SystemHapticsClient(), audio: SystemAudioFeedbackClient())) }
    var body: some View {
        VStack(spacing: EQSpacing.xl) {
            Spacer()
            Text(runner.phase == .move ? "MOVE" : runner.phase == .exerciseRest ? "REST" : runner.phase == .roundRest ? "ROUND REST" : "COMPLETE").font(EQTypography.sectionTitle).foregroundStyle(runner.phase == .move ? EQColor.accent : EQColor.rest)
            Text(display).font(EQTypography.metric).monospacedDigit().contentTransition(.numericText()).accessibilityLabel("\(Int(ceil(runner.remaining))) seconds remaining")
            HStack { metric("Exercise", "\(runner.exercise)/\(runner.configuration.exercisesPerRound)"); metric("Round", "\(runner.round)/\(runner.configuration.rounds)") }
            HStack {
                Button(primaryLabel) { primary() }.buttonStyle(.borderedProminent)
                Button("Skip") { runner.skip(); runTicks() }.buttonStyle(.bordered).disabled(runner.state == .ready || runner.state == .completed)
                Menu("Options", systemImage: "ellipsis") { Button("Reset") { runner.reset(); runTicks() }; Button("Restart") { runner.restart(); runTicks() } }
            }.frame(minHeight: EQDimension.minimumTouch)
            if runner.state == .completed { Text("Timer complete").font(EQTypography.title) }
            Spacer()
            Text("Standalone timers never create workout or history records.").font(EQTypography.caption).foregroundStyle(EQColor.secondaryText)
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
    private func metric(_ title: String, _ value: String) -> some View { VStack { Text(value).font(EQTypography.sectionTitle); Text(title).font(EQTypography.caption).foregroundStyle(EQColor.secondaryText) }.frame(maxWidth: .infinity).eqCard() }
}
