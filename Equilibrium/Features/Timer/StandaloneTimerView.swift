import SwiftUI

struct StandaloneTimerView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var duration: Double = 90
    @State private var timer = CountdownTimer()
    @State private var tick: Task<Void, Never>?
    @State private var completionFeedback = 0
    private let haptics: any HapticsClient = SystemHapticsClient()
    private let audio: any AudioFeedbackClient = SystemAudioFeedbackClient()
    var body: some View {
        NavigationStack {
            VStack(spacing: EQSpacing.lg) {
                Text(display).font(EQTypography.metric).monospacedDigit().accessibilityLabel(accessibilityValue)
                if timer.state == .idle {
                    Slider(value: $duration, in: 15...3600, step: 5).accessibilityLabel("Timer duration").accessibilityValue(accessibilityValue)
                }
                Text(timer.state.rawValue.capitalized).font(EQTypography.caption).foregroundStyle(EQColor.secondaryText)
                HStack {
                    Button(primaryLabel) { primaryAction() }.buttonStyle(.borderedProminent).frame(minWidth: 100, minHeight: EQDimension.minimumTouch)
                    Button("Reset") { timer.reset() }.buttonStyle(.bordered).frame(minHeight: EQDimension.minimumTouch).disabled(timer.configuredDuration == 0)
                    Button("Cancel") { timer.cancel() }.buttonStyle(.bordered).frame(minHeight: EQDimension.minimumTouch)
                }
                Text("A standalone timer is transient and is never added to workout history.").font(EQTypography.caption).foregroundStyle(EQColor.secondaryText).multilineTextAlignment(.center)
            }.padding(EQSpacing.xl).navigationTitle("Timer").toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { timer.cancel(); dismiss() } } }
        }.presentationDetents([.medium, .large]).onDisappear { tick?.cancel() }.onChange(of: timer.state) { _, _ in runTicksIfNeeded() }.sensoryFeedback(.success, trigger: completionFeedback)
    }
    private var shown: TimeInterval { timer.state == .idle ? duration : timer.remainingDuration }
    private var display: String { let seconds = max(0, Int(ceil(shown))); return String(format: "%d:%02d", seconds / 60, seconds % 60) }
    private var accessibilityValue: String { let seconds = max(0, Int(ceil(shown))); return "\(seconds / 60) minutes, \(seconds % 60) seconds remaining" }
    private var primaryLabel: String { switch timer.state { case .running: "Pause"; case .paused: "Resume"; case .idle, .completed: "Start" } }
    private func primaryAction() { switch timer.state { case .running: timer.pause(); case .paused: timer.resume(); case .idle, .completed: timer.start(duration: duration) } }
    private func runTicksIfNeeded() {
        tick?.cancel(); guard timer.state == .running else { return }
        tick = Task { while !Task.isCancelled && timer.state == .running { try? await Task.sleep(for: .milliseconds(200)); if timer.refresh() { completionFeedback += 1; haptics.timerCompleted(); audio.timerCompleted() } } }
    }
}
