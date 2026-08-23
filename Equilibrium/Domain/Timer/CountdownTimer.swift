import Foundation
import Observation

public enum CountdownTimerState: String, Equatable, Sendable { case idle, running, paused, completed }

@MainActor @Observable
public final class CountdownTimer {
    public private(set) var configuredDuration: TimeInterval = 0
    public private(set) var remainingDuration: TimeInterval = 0
    public private(set) var state: CountdownTimerState = .idle
    public private(set) var completionCount = 0
    public private(set) var completionOverrun: TimeInterval = 0
    @ObservationIgnored private let now: () -> TimeInterval
    @ObservationIgnored private var deadline: TimeInterval?

    public init(now: @escaping () -> TimeInterval = { ProcessInfo.processInfo.systemUptime }) { self.now = now }
    public var elapsedDuration: TimeInterval { max(0, configuredDuration - remainingDuration) }

    public func start(duration: TimeInterval, alreadyElapsed: TimeInterval = 0) {
        guard duration.isFinite, duration > 0 else { cancel(); return }
        configuredDuration = duration; completionOverrun = 0
        let remaining = max(0, duration - max(0, alreadyElapsed)); remainingDuration = remaining
        if remaining == 0 { deadline = nil; state = .completed; completionCount += 1; completionOverrun = max(0, alreadyElapsed - duration) }
        else { deadline = now() + remaining; state = .running }
    }
    public func pause() { guard state == .running else { return }; refresh(); guard state == .running else { return }; deadline = nil; state = .paused }
    public func resume() { guard state == .paused, remainingDuration > 0 else { return }; deadline = now() + remainingDuration; state = .running }
    public func reset() { deadline = nil; completionOverrun = 0; remainingDuration = configuredDuration; state = configuredDuration > 0 ? .paused : .idle }
    public func cancel() { deadline = nil; completionOverrun = 0; configuredDuration = 0; remainingDuration = 0; state = .idle }
    @discardableResult public func refresh() -> Bool {
        guard state == .running, let deadline else { return false }
        let instant = now(); remainingDuration = max(0, deadline - instant)
        guard remainingDuration <= 0 else { return false }
        completionOverrun = max(0, instant - deadline); self.deadline = nil; state = .completed; completionCount += 1; return true
    }
}
