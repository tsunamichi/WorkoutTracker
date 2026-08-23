import AudioToolbox
import UIKit

@MainActor public protocol HapticsClient: Sendable { func timerCompleted() }
@MainActor public protocol AudioFeedbackClient: Sendable { func timerCompleted() }

public struct SystemHapticsClient: HapticsClient {
    public init() {}
    public func timerCompleted() { UINotificationFeedbackGenerator().notificationOccurred(.success) }
}

public struct SystemAudioFeedbackClient: AudioFeedbackClient {
    public init() {}
    public func timerCompleted() { AudioServicesPlaySystemSound(1057) }
}

public struct NoopHapticsClient: HapticsClient { public init() {}; public func timerCompleted() {} }
public struct NoopAudioFeedbackClient: AudioFeedbackClient { public init() {}; public func timerCompleted() {} }
