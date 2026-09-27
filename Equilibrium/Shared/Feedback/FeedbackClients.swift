import AudioToolbox
import UIKit

public enum HapticFeedback: Equatable, Sendable {
    case selection
    case lightImpact
    case restTransition
    case restSkipped
    case setLogged
    case exerciseCompleted
    case timerCompleted
    case workoutCompleted
}

@MainActor public protocol HapticsClient: Sendable { func perform(_ feedback: HapticFeedback) }
@MainActor public protocol AudioFeedbackClient: Sendable { func timerCompleted() }

public struct SystemHapticsClient: HapticsClient {
    public init() {}
    public func perform(_ feedback: HapticFeedback) {
        switch feedback {
        case .selection, .setLogged:
            UISelectionFeedbackGenerator().selectionChanged()
        case .lightImpact, .restSkipped:
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
        case .restTransition:
            UIImpactFeedbackGenerator(style: .soft).impactOccurred()
        case .exerciseCompleted:
            UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        case .timerCompleted, .workoutCompleted:
            UINotificationFeedbackGenerator().notificationOccurred(.success)
        }
    }
}

public struct SystemAudioFeedbackClient: AudioFeedbackClient {
    public init() {}
    public func timerCompleted() { AudioServicesPlaySystemSound(1057) }
}

public struct NoopHapticsClient: HapticsClient { public init() {}; public func perform(_: HapticFeedback) {} }
public struct NoopAudioFeedbackClient: AudioFeedbackClient { public init() {}; public func timerCompleted() {} }
