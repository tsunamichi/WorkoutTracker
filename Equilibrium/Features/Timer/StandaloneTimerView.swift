import SwiftUI

enum StandaloneTimerNavigationPolicy {
    static func replacingCreation(in path: [TimerRoute], withRunID id: String) -> [TimerRoute] {
        guard path.last == .create else { return path + [.run(id)] }
        var result = path; result[result.count - 1] = .run(id); return result
    }
}

enum TimerRoute: Hashable { case create, edit(String), run(String) }

enum StandaloneTimerSystemBackgroundStyle: Equatable {
    case homeCanvas
    case work
    case rest

    var color: Color {
        switch self {
        case .homeCanvas: EQColor.Home.canvas
        case .work: EQColor.Execution.foregroundSurface
        case .rest: EQColor.Execution.restCanvas
        }
    }
}

struct StandaloneTimerSystemBackgroundPreferenceKey: PreferenceKey {
    static let defaultValue: StandaloneTimerSystemBackgroundStyle = .homeCanvas

    static func reduce(
        value: inout StandaloneTimerSystemBackgroundStyle,
        nextValue: () -> StandaloneTimerSystemBackgroundStyle
    ) {
        value = nextValue()
    }
}

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

enum StandaloneTimerRunPresentation {
    static func visualMode(
        phase: StandaloneTimerPhase,
        state: StandaloneTimerRunState
    ) -> TimerVisualMode {
        guard state != .completed else { return .hidden }
        switch phase {
        case .preparingMove:
            return state == .ready ? .hidden : .workCountdown
        case .move: return .work
        case .exerciseRest, .roundRest: return .rest
        case .restExit: return .hidden
        case .completed: return .hidden
        }
    }

    static func usesRestPalette(phase: StandaloneTimerPhase) -> Bool {
        phase == .exerciseRest || phase == .roundRest || phase == .restExit
    }

    static func systemBackgroundStyle(
        phase: StandaloneTimerPhase
    ) -> StandaloneTimerSystemBackgroundStyle {
        usesRestPalette(phase: phase) ? .rest : .work
    }

    static func primaryLabel(for state: StandaloneTimerRunState) -> String {
        state == .running ? "Pause" : "Play"
    }

    static func displayedRemaining(
        state: StandaloneTimerRunState,
        remaining: TimeInterval,
        initialDuration: TimeInterval
    ) -> TimeInterval {
        state == .ready ? initialDuration : remaining
    }
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
        GeometryReader { sceneProxy in
            let sceneFrame = sceneProxy.frame(in: .global)
            let fullSceneHeight = sceneProxy.size.height
                + sceneProxy.safeAreaInsets.top
                + sceneProxy.safeAreaInsets.bottom
            let fullSceneTargetY = sceneFrame.minY
                - sceneProxy.safeAreaInsets.top
                + (fullSceneHeight * TimerVisualMotion.countdownLaunchHeightScreenRatio)

            ZStack {
                pageColor
                    .ignoresSafeArea()

                VStack(spacing: 0) {
                    runHeader
                    Spacer()
                        .frame(height: EQLayout.WorkoutExecution.headerWalletSpacing)

                    GeometryReader { proxy in
                        let cardHeight = min(
                            EQLayout.WorkoutExecution.standaloneTimerCardHeight,
                            proxy.size.height * 0.32
                        )
                        let cardTop = max(
                            0,
                            proxy.size.height - cardHeight - EQLayout.WorkoutExecution.walletEdgeInset
                        )
                        let globalFrame = proxy.frame(in: .global)
                        let shapeCenterY = max(0, fullSceneTargetY - globalFrame.minY)

                        ZStack(alignment: .top) {
                            TimerVisualLayer(
                                requestedMode: visualMode,
                                timer: runner.countdown,
                                workColor: EQColor.Execution.primaryAction,
                                restColor: EQColor.Execution.restTimerText,
                                walletTop: cardTop,
                                sceneCenterY: shapeCenterY,
                                walletCollapseProgress: 1,
                                reduceMotion: reduceMotion
                            )

                            EQRollingTimerText(value: display, reduceMotion: reduceMotion)
                                .eqTextStyle(.largeMetric)
                                .foregroundStyle(timerColor)
                                .lineLimit(1)
                                .fixedSize()
                                .position(
                                    x: proxy.size.width / 2,
                                    y: min(max(EQSpacing.xxxl, cardTop * 0.20), cardTop - EQSpacing.xxxl)
                                )
                                .accessibilityLabel(timerAccessibilityLabel)

                            VStack(spacing: 0) {
                                Spacer(minLength: 0)
                                collapsedCard
                                    .frame(height: cardHeight)
                                    .padding(.horizontal, EQLayout.WorkoutExecution.walletEdgeInset)
                                    .padding(.bottom, EQLayout.WorkoutExecution.walletEdgeInset)
                            }
                        }
                    }
                }
            }
            .animation(reduceMotion ? nil : EQMotion.objectTransformation, value: isRestPhase)
        }
        .background(pageColor.ignoresSafeArea())
        .preference(
            key: StandaloneTimerSystemBackgroundPreferenceKey.self,
            value: StandaloneTimerRunPresentation.systemBackgroundStyle(phase: runner.phase)
        )
        .navigationBarBackButtonHidden(true)
        .toolbar(.hidden, for: .navigationBar)
        .alert("End timer?", isPresented: $confirmsExit) {
            Button("Keep Timer", role: .cancel) {}
            Button("End Timer", role: .destructive) { endAndDismiss() }
        } message: { Text("The timer will end if you leave this page.") }
        .onDisappear { ticks?.cancel() }
        .onChange(of: scenePhase) { _, phase in if phase == .active { runner.refresh(); runTicks() } }
    }

    private var runHeader: some View {
        HStack(spacing: EQLayout.controlGap) {
            Button(action: requestExit) {
                HStack(spacing: EQSpacing.xs) {
                    Image(systemName: "chevron.left")
                    Text(runner.configuration.name)
                        .eqTextStyle(.navigationTitle)
                        .lineLimit(1)
                }
                .frame(minHeight: EQLayout.minimumTouch)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Back, \(runner.configuration.name)")
            .accessibilityHint(StandaloneTimerExitPolicy.requiresConfirmation(for: runner.state)
                ? "Asks before ending the active timer"
                : "Returns to saved timers")

            Spacer(minLength: EQLayout.controlGap)
        }
        .foregroundStyle(timerColor)
        .padding(.horizontal, EQLayout.screenGutter)
        .frame(maxWidth: .infinity, minHeight: EQLayout.minimumTouch + EQSpacing.sm)
    }

    private var visualMode: TimerVisualMode {
        StandaloneTimerRunPresentation.visualMode(phase: runner.phase, state: runner.state)
    }

    private var isRestPhase: Bool {
        StandaloneTimerRunPresentation.usesRestPalette(phase: runner.phase)
    }

    private var pageColor: Color {
        isRestPhase ? EQColor.Execution.restCanvas : EQColor.Execution.foregroundSurface
    }

    private var cardSurfaceColor: Color {
        isRestPhase ? EQColor.Execution.restForegroundSurface : EQColor.Execution.foregroundSurface
    }

    private var cardTextColor: Color {
        isRestPhase ? EQColor.Execution.restCardText : EQColor.Execution.foregroundText
    }

    private var timerColor: Color {
        isRestPhase ? EQColor.Execution.restTimerText : EQColor.Execution.primaryAction
    }

    private var displayedRemaining: TimeInterval {
        StandaloneTimerRunPresentation.displayedRemaining(
            state: runner.state,
            remaining: runner.remaining,
            initialDuration: runner.configuration.moveDuration
        )
    }

    private var display: String {
        if runner.phase == .restExit {
            return ExecutionTimerFormatting.durationText(for: 0)
        }
        if runner.phase == .preparingMove, runner.state != .ready {
            return String(TimerVisualMotion.countdownNumber(
                timerProgress: runner.countdown.normalizedProgress
            ))
        }
        return ExecutionTimerFormatting.durationText(for: displayedRemaining)
    }

    private var timerAccessibilityLabel: String {
        if runner.phase == .restExit {
            return "Rest complete"
        }
        if runner.phase == .preparingMove, runner.state != .ready {
            return "Work begins in \(display)"
        }
        return "\(Int(ceil(displayedRemaining))) seconds remaining"
    }

    private var collapsedCard: some View {
        let shape = RoundedRectangle(cornerRadius: EQRadius.walletSurface, style: .continuous)
        return VStack(spacing: EQSpacing.lg) {
            HStack(spacing: 0) {
                metric("Exercise", "\(runner.exercise)/\(runner.configuration.exercisesPerRound)")
                metric("Round", "\(runner.round)/\(runner.configuration.rounds)")
            }

            HStack(spacing: EQLayout.controlGap) {
                timerButton(
                    StandaloneTimerRunPresentation.primaryLabel(for: runner.state),
                    variant: .filled,
                    isEnabled: runner.state != .completed,
                    action: primary
                )
                timerButton(
                    "Skip",
                    variant: .outlined,
                    isEnabled: runner.state == .running || runner.state == .paused
                ) {
                    runner.skip()
                    runTicks()
                }
                timerButton("Restart", variant: .outlined, isEnabled: true) {
                    runner.restart()
                    runTicks()
                }
            }
        }
        .padding(EQLayout.WorkoutExecution.walletInset)
        .foregroundStyle(cardTextColor)
        .background(cardSurfaceColor, in: shape)
        .overlay {
            shape.strokeBorder(timerColor, lineWidth: EQLayout.WorkoutExecution.walletBorderWidth)
        }
        .overlay(alignment: .top) {
            if !isRestPhase {
                Rectangle()
                    .fill(pageColor)
                    .frame(height: EQLayout.WorkoutExecution.workCardExternalTopGap)
                    .offset(y: -EQLayout.WorkoutExecution.workCardExternalTopGap)
                    .allowsHitTesting(false)
            }
        }
    }

    private func timerButton(
        _ title: String,
        variant: EQPrimaryCTAVariant,
        isEnabled: Bool,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            Text(title)
                .lineLimit(1)
                .minimumScaleFactor(0.75)
                .frame(maxWidth: .infinity)
                .frame(height: EQLayout.WorkoutExecution.primaryActionHeight)
        }
        .eqPrimaryCTA(
            tint: timerColor,
            foreground: cardSurfaceColor,
            variant: variant
        )
        .disabled(!isEnabled)
        .opacity(isEnabled ? 1 : 0.38)
    }

    private func primary() {
        switch runner.state {
        case .ready: runner.play()
        case .running: runner.pause()
        case .paused: runner.resume()
        case .completed: break
        }
        runTicks()
    }

    private func requestExit() {
        if StandaloneTimerExitPolicy.requiresConfirmation(for: runner.state) { confirmsExit = true }
        else { dismiss() }
    }
    private func endAndDismiss() { ticks?.cancel(); ticks = nil; runner.reset(); dismiss() }
    private func runTicks() { ticks?.cancel(); guard runner.state == .running else { return }; ticks = Task { while !Task.isCancelled && runner.state == .running { try? await Task.sleep(for: .milliseconds(200)); runner.refresh() } } }
    private func metric(_ title: String, _ value: String) -> some View {
        VStack(spacing: EQSpacing.xxs) {
            Text(value)
                .eqTextStyle(.sectionTitle)
                .monospacedDigit()
            Text(title)
                .eqTextStyle(.caption)
                .foregroundStyle(cardTextColor.opacity(0.68))
        }
        .frame(maxWidth: .infinity)
    }
}
