import Foundation
import Observation

public struct StandaloneTimerConfiguration: Identifiable, Codable, Hashable, Sendable {
    public let id: String
    public var name: String
    public var moveDuration: TimeInterval
    public var exerciseRestDuration: TimeInterval
    public var exercisesPerRound: Int
    public var rounds: Int
    public var roundRestDuration: TimeInterval
    public var createdAt: Date
    public init(id: String = UUID().uuidString.lowercased(), name: String, moveDuration: TimeInterval = 30, exerciseRestDuration: TimeInterval = 30, exercisesPerRound: Int = 3, rounds: Int = 1, roundRestDuration: TimeInterval = 30, createdAt: Date = .now) {
        self.id = id; self.name = name; self.moveDuration = moveDuration; self.exerciseRestDuration = exerciseRestDuration; self.exercisesPerRound = exercisesPerRound; self.rounds = rounds; self.roundRestDuration = roundRestDuration; self.createdAt = createdAt
    }
    public var isValid: Bool {
        !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && Self.valid(moveDuration, range: 5...120) && Self.valid(exerciseRestDuration, range: 5...120) && (1...20).contains(exercisesPerRound) && (1...10).contains(rounds) && Self.valid(roundRestDuration, range: 5...180)
    }
    private static func valid(_ value: TimeInterval, range: ClosedRange<Int>) -> Bool { value.isFinite && value.rounded() == value && Int(value) % 5 == 0 && range.contains(Int(value)) }
}

public enum StandaloneTimerPhase: String, Equatable, Sendable { case move, exerciseRest, roundRest, completed }
public enum StandaloneTimerRunState: Equatable, Sendable { case ready, running, paused, completed }

@MainActor @Observable
public final class StandaloneIntervalTimer {
    public let configuration: StandaloneTimerConfiguration
    public let countdown: CountdownTimer
    public private(set) var phase: StandaloneTimerPhase = .move
    public private(set) var exercise = 1
    public private(set) var round = 1
    public private(set) var state: StandaloneTimerRunState = .ready
    public private(set) var completionFeedbackCount = 0
    private let haptics: any HapticsClient
    private let audio: any AudioFeedbackClient

    public init(configuration: StandaloneTimerConfiguration, countdown: CountdownTimer? = nil, haptics: (any HapticsClient)? = nil, audio: (any AudioFeedbackClient)? = nil) {
        self.configuration = configuration; self.countdown = countdown ?? CountdownTimer(); self.haptics = haptics ?? NoopHapticsClient(); self.audio = audio ?? NoopAudioFeedbackClient()
    }
    public var remaining: TimeInterval { countdown.remainingDuration }
    public func play() { guard state == .ready else { return }; state = .running; startCurrentPhase() }
    public func pause() { guard state == .running else { return }; countdown.pause(); state = .paused }
    public func resume() { guard state == .paused else { return }; countdown.resume(); state = .running }
    public func skip() { guard state == .running || state == .paused else { return }; advance(overrun: 0, continueRunning: state == .running) }
    public func reset() { countdown.cancel(); phase = .move; exercise = 1; round = 1; state = .ready }
    public func restart() { reset(); play() }
    @discardableResult public func refresh() -> Bool {
        guard state == .running, countdown.refresh() else { return false }
        advance(overrun: countdown.completionOverrun, continueRunning: true); return state == .completed
    }
    private func startCurrentPhase(alreadyElapsed: TimeInterval = 0) {
        var overflow = alreadyElapsed
        while phase != .completed {
            countdown.start(duration: durationForPhase, alreadyElapsed: overflow)
            guard countdown.state == .completed else { return }
            overflow = countdown.completionOverrun
            advancePosition()
        }
        finishOnce()
    }
    private var durationForPhase: TimeInterval {
        switch phase { case .move: configuration.moveDuration; case .exerciseRest: configuration.exerciseRestDuration; case .roundRest: configuration.roundRestDuration; case .completed: 0 }
    }
    private func advance(overrun: TimeInterval, continueRunning: Bool) {
        advancePosition()
        guard phase != .completed else { finishOnce(); return }
        if continueRunning { state = .running; startCurrentPhase(alreadyElapsed: overrun) }
        else { countdown.start(duration: durationForPhase); countdown.pause(); state = .paused }
    }
    private func advancePosition() {
        switch phase {
        case .move:
            if exercise < configuration.exercisesPerRound { phase = .exerciseRest }
            else if round < configuration.rounds { phase = .roundRest }
            else { phase = .completed }
        case .exerciseRest: exercise += 1; phase = .move
        case .roundRest: round += 1; exercise = 1; phase = .move
        case .completed: break
        }
    }
    private func finishOnce() {
        guard state != .completed else { return }; state = .completed; phase = .completed; completionFeedbackCount += 1; haptics.timerCompleted(); audio.timerCompleted()
    }
}

@MainActor public protocol StandaloneTimerConfigurationStore {
    func configurations() -> [StandaloneTimerConfiguration]
    func save(_ configuration: StandaloneTimerConfiguration)
    func delete(id: String)
}

@MainActor public final class UserDefaultsStandaloneTimerStore: StandaloneTimerConfigurationStore {
    private let defaults: UserDefaults; private let key: String
    public init(defaults: UserDefaults = .standard, key: String = "standalone-timer-configurations-v1") { self.defaults = defaults; self.key = key }
    public func configurations() -> [StandaloneTimerConfiguration] { (try? JSONDecoder().decode([StandaloneTimerConfiguration].self, from: defaults.data(forKey: key) ?? Data())) ?? [] }
    public func save(_ configuration: StandaloneTimerConfiguration) { var values = configurations(); values.removeAll { $0.id == configuration.id }; values.append(configuration); defaults.set(try? JSONEncoder().encode(values), forKey: key) }
    public func delete(id: String) { defaults.set(try? JSONEncoder().encode(configurations().filter { $0.id != id }), forKey: key) }
}
