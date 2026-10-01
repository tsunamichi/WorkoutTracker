import AudioToolbox
import UIKit

public enum HapticFeedback: Equatable, Sendable {
    case selection
    case lightImpact
    case restTransition
    case restSkipped
    case timerStarted
    case timerSkipped
    case setLogged
    case exerciseSkipped
    case exerciseRestored
    case exerciseCompleted
    case timerCompleted
    case workoutCompleted
}

@MainActor public protocol HapticsClient: Sendable { func perform(_ feedback: HapticFeedback) }
@MainActor public protocol AudioFeedbackClient: Sendable { func timerCompleted() }

public struct SystemHapticsClient: HapticsClient {
    /// Shared generators: creating a generator per event makes the first haptic
    /// block the main thread while the haptic engine spins up.
    private enum Generators {
        static let selection = UISelectionFeedbackGenerator()
        static let light = UIImpactFeedbackGenerator(style: .light)
        static let soft = UIImpactFeedbackGenerator(style: .soft)
        static let medium = UIImpactFeedbackGenerator(style: .medium)
        static let notification = UINotificationFeedbackGenerator()
    }

    public init() {}

    /// Spins up the haptic engine ahead of the first interaction.
    public static func prepare() {
        Generators.light.prepare()
        Generators.selection.prepare()
        Generators.soft.prepare()
        Generators.medium.prepare()
        Generators.notification.prepare()
    }

    public func perform(_ feedback: HapticFeedback) {
        switch feedback {
        case .selection, .setLogged, .exerciseRestored:
            Generators.selection.selectionChanged()
        case .lightImpact, .restSkipped, .timerSkipped, .exerciseSkipped:
            Generators.light.impactOccurred()
        case .restTransition, .timerStarted:
            Generators.soft.impactOccurred()
        case .exerciseCompleted:
            Generators.medium.impactOccurred()
        case .timerCompleted, .workoutCompleted:
            Generators.notification.notificationOccurred(.success)
        }
    }
}

public struct SystemAudioFeedbackClient: AudioFeedbackClient {
    public init() {}
    public func timerCompleted() { AudioServicesPlaySystemSound(1057) }
}

public struct NoopHapticsClient: HapticsClient { public init() {}; public func perform(_: HapticFeedback) {} }
public struct NoopAudioFeedbackClient: AudioFeedbackClient { public init() {}; public func timerCompleted() {} }
