import SwiftUI

enum TimerVisualMode: Equatable {
    case hidden
    case workCountdown
    case work
    case rest
    case exiting
}

enum TimerCountdownObject: Int, Equatable {
    case triangle
    case square
    case circle
}

struct TimerVisualCubicBezier: Equatable {
    let x1: CGFloat
    let y1: CGFloat
    let x2: CGFloat
    let y2: CGFloat

    func value(at progress: CGFloat) -> CGFloat {
        let target = min(max(progress, 0), 1)
        guard target > 0 else { return 0 }
        guard target < 1 else { return 1 }

        // Timing-curve control points describe x as well as y. Invert x with a
        // bounded binary search so timer-derived progress follows the exact curve.
        var lower: CGFloat = 0
        var upper: CGFloat = 1
        for _ in 0..<16 {
            let candidate = (lower + upper) / 2
            if component(at: candidate, firstControl: x1, secondControl: x2) < target {
                lower = candidate
            } else {
                upper = candidate
            }
        }
        return component(
            at: (lower + upper) / 2,
            firstControl: y1,
            secondControl: y2
        )
    }

    private func component(
        at parameter: CGFloat,
        firstControl: CGFloat,
        secondControl: CGFloat
    ) -> CGFloat {
        let inverse = 1 - parameter
        return (3 * inverse * inverse * parameter * firstControl)
            + (3 * inverse * parameter * parameter * secondControl)
            + (parameter * parameter * parameter)
    }
}

/// Central tuning surface for the execution timer objects.
enum TimerVisualMotion {
    static let shapeWidthRatio: CGFloat = 0.60
    static let squareWidthRatio: CGFloat = 0.55
    static var workCircleDiameterRatio: CGFloat { shapeWidthRatio }
    /// Leaves the circle's top edge safely below the foreground card at completion.
    static let workEndingYRatio: CGFloat = 0.60

    static let countdownDuration = WorkoutWorkTimerTiming.countdownDuration
    static let countdownObjectCount = WorkoutWorkTimerTiming.countdownShapeCount
    static let countdownFlightDuration = WorkoutWorkTimerTiming.countdownShapeFlightDuration
    static let countdownCircleEntranceDuration = WorkoutWorkTimerTiming.countdownCircleEntranceDuration
    static let countdownSequenceDuration = (2 * countdownFlightDuration)
        + countdownCircleEntranceDuration
    static let countdownHiddenYRatio: CGFloat = 0.54
    /// The centered screen target also defines the responsive launch height.
    static let countdownLaunchHeightScreenRatio: CGFloat = 0.50
    static let countdownAscentFraction: CGFloat = 0.50
    static let countdownAscentCurve = TimerVisualCubicBezier(x1: 0.42, y1: 0, x2: 0.16, y2: 1)
    static let workCircleEntranceCurve = TimerVisualCubicBezier(x1: 0.42, y1: 0, x2: 0.16, y2: 1)
    static let countdownDescentCurve = TimerVisualCubicBezier(x1: 0.42, y1: 0, x2: 1, y2: 0.16)
    static let countdownRotationAmount: Double = 6

    static let restInhaleDuration: TimeInterval = 3.4
    static let restCircleHoldDuration: TimeInterval = 0.2
    static let restExhaleDuration: TimeInterval = 4.3
    static let restStarburstPauseDuration: TimeInterval = 0.15
    static let restMorphDuration = restInhaleDuration
        + restCircleHoldDuration
        + restExhaleDuration
        + restStarburstPauseDuration
    static let restInhaleCurve = TimerVisualCubicBezier(x1: 0.45, y1: 0, x2: 0.35, y2: 1)
    static let restExhaleCurve = TimerVisualCubicBezier(x1: 0.35, y1: 0, x2: 0.15, y2: 1)
    static let restStarburstScale: CGFloat = 0.90
    static let restEntranceDuration: TimeInterval = 0.5
    static let restReducedMotionEntranceDuration: TimeInterval = 0.35
    static let restEntranceHiddenYRatio: CGFloat = 0.54
    static let restEntranceOvershootDistanceRatio: CGFloat = 0.08
    static let restEntranceOvershootProgress: CGFloat = 0.78
    static let restExitDuration = TimerVisualTransitionTiming.restExitDuration
    static let restExitInitialVelocity: CGFloat = 0.15
    static let restExitGravity: CGFloat = 5.2

    static func shapeDiameter(
        availableWidth: CGFloat,
        object: TimerCountdownObject? = nil
    ) -> CGFloat {
        let ratio = object == .square ? squareWidthRatio : shapeWidthRatio
        return max(0, availableWidth) * ratio
    }

    /// One asymmetric breath, expressed as the StardustShape morph value:
    /// `1` is the released starburst and `0` is the gathered circle.
    static func restMorph(elapsed: TimeInterval) -> CGFloat {
        guard elapsed.isFinite else { return 1 }
        let cycleTime = max(0, elapsed).truncatingRemainder(dividingBy: restMorphDuration)
        let inhaleEnd = restInhaleDuration
        let circleHoldEnd = inhaleEnd + restCircleHoldDuration
        let exhaleEnd = circleHoldEnd + restExhaleDuration

        if cycleTime < inhaleEnd {
            let progress = CGFloat(cycleTime / restInhaleDuration)
            return 1 - restInhaleCurve.value(at: progress)
        }
        if cycleTime < circleHoldEnd { return 0 }
        if cycleTime < exhaleEnd {
            let progress = CGFloat((cycleTime - circleHoldEnd) / restExhaleDuration)
            return restExhaleCurve.value(at: progress)
        }
        return 1
    }

    static func restScale(morph: CGFloat) -> CGFloat {
        let amount = min(max(morph, 0), 1)
        return 1 + ((restStarburstScale - 1) * amount)
    }

    static func countdownNumber(timerProgress: Double) -> Int {
        let progress = min(max(timerProgress, 0), 1)
        guard progress < 1 else { return 0 }
        let elapsed = progress * countdownDuration
        let sequenceElapsed = max(
            0,
            elapsed - WorkoutWorkTimerTiming.preparationLeadInDuration
        ) + 0.000_000_001
        if sequenceElapsed < countdownFlightDuration { return 3 }
        if sequenceElapsed < 2 * countdownFlightDuration { return 2 }
        return 1
    }

    static func countdownStartTime(for object: TimerCountdownObject) -> TimeInterval {
        switch object {
        case .triangle: 0
        case .square: countdownFlightDuration
        case .circle: 2 * countdownFlightDuration
        }
    }

    static func countdownDuration(for object: TimerCountdownObject) -> TimeInterval {
        object == .circle ? countdownCircleEntranceDuration : countdownFlightDuration
    }

    static func screenCenterOffset(sceneCenterY: CGFloat, walletTop: CGFloat) -> CGFloat {
        sceneCenterY - walletTop
    }

    static func workCircleCenterOffset(
        progress: CGFloat,
        diameter: CGFloat,
        sceneCenterY: CGFloat,
        walletTop: CGFloat
    ) -> CGFloat {
        interpolate(
            from: screenCenterOffset(sceneCenterY: sceneCenterY, walletTop: walletTop),
            to: workEndingYRatio * diameter,
            progress: progress
        )
    }

    static func countdownVisualProgress(
        timerProgress: Double,
        walletCollapseProgress: CGFloat,
        reduceMotion: Bool
    ) -> Double? {
        guard walletCollapseProgress >= 0.999 else { return nil }
        let revealDelay = WorkoutWorkTimerTiming.preparationLeadInDuration
        let delayedFraction = min(revealDelay / countdownDuration, 0.9)
        return min(max((timerProgress - delayedFraction) / (1 - delayedFraction), 0), 1)
    }

    static func countdownCenterOffset(
        object: TimerCountdownObject,
        progress: CGFloat,
        diameter: CGFloat,
        sceneCenterY: CGFloat,
        walletTop: CGFloat,
        reduceMotion: Bool
    ) -> CGFloat {
        let p = clamp(progress)
        let hiddenCenter = countdownHiddenYRatio * diameter
        let centered = screenCenterOffset(sceneCenterY: sceneCenterY, walletTop: walletTop)
        if reduceMotion {
            if object == .circle {
                return interpolate(
                    from: hiddenCenter,
                    to: centered,
                    progress: smoothStep(p)
                )
            }
            return interpolate(from: hiddenCenter, to: centered, progress: sin(.pi * p))
        }

        if object == .circle {
            return interpolate(
                from: hiddenCenter,
                to: centered,
                progress: workCircleEntranceCurve.value(at: p)
            )
        }
        if p <= countdownAscentFraction {
            let ascentProgress = p / countdownAscentFraction
            return interpolate(
                from: hiddenCenter,
                to: centered,
                progress: countdownAscentCurve.value(at: ascentProgress)
            )
        }
        let descentProgress = (p - countdownAscentFraction) / (1 - countdownAscentFraction)
        return interpolate(
            from: centered,
            to: hiddenCenter,
            progress: countdownDescentCurve.value(at: descentProgress)
        )
    }

    static func countdownRotation(
        object: TimerCountdownObject,
        progress: CGFloat,
        reduceMotion: Bool
    ) -> Double {
        guard !reduceMotion, object != .circle else { return 0 }
        let direction = object == .triangle ? 1.0 : -1.0
        return direction * (-countdownRotationAmount / 2 + countdownRotationAmount * Double(clamp(progress)))
    }

    static func restExitCenterOffset(
        progress: CGFloat,
        diameter: CGFloat,
        startOffset: CGFloat
    ) -> CGFloat {
        let seconds = clamp(progress) * CGFloat(restExitDuration)
        let displacement = restExitInitialVelocity * seconds
            + 0.5 * restExitGravity * seconds * seconds
        return startOffset + (displacement * diameter)
    }

    static func restEntranceCenterOffset(
        progress: CGFloat,
        diameter: CGFloat,
        sceneCenterY: CGFloat,
        walletTop: CGFloat,
        reduceMotion: Bool
    ) -> CGFloat {
        let p = clamp(progress)
        let hiddenCenter = restEntranceHiddenYRatio * diameter
        let target = screenCenterOffset(sceneCenterY: sceneCenterY, walletTop: walletTop)
        if reduceMotion {
            return interpolate(from: hiddenCenter, to: target, progress: smoothStep(p))
        }

        let apexProgress = restEntranceOvershootProgress
        let overshootTarget = target - (restEntranceOvershootDistanceRatio * diameter)
        if p <= apexProgress {
            return interpolate(
                from: hiddenCenter,
                to: overshootTarget,
                progress: countdownAscentCurve.value(at: p / apexProgress)
            )
        }

        let settlingProgress = (p - apexProgress) / (1 - apexProgress)
        return interpolate(
            from: overshootTarget,
            to: target,
            progress: smoothStep(settlingProgress)
        )
    }

    private static func interpolate(from: CGFloat, to: CGFloat, progress: CGFloat) -> CGFloat {
        from + ((to - from) * clamp(progress))
    }

    private static func smoothStep(_ value: CGFloat) -> CGFloat {
        let p = clamp(value)
        return p * p * (3 - (2 * p))
    }

    private static func clamp(_ value: CGFloat) -> CGFloat {
        min(max(value, 0), 1)
    }
}

struct TimerCountdownVisualState: Equatable {
    let object: TimerCountdownObject
    let progress: CGFloat

    static func derive(timerProgress: Double) -> Self {
        activeStates(timerProgress: timerProgress).last
            ?? .init(object: .triangle, progress: 0)
    }

    static func activeStates(timerProgress: Double) -> [Self] {
        let timerProgress = min(max(timerProgress, 0), 1)
        let elapsed = timerProgress * TimerVisualMotion.countdownSequenceDuration
        return [TimerCountdownObject.triangle, .square, .circle].compactMap { object in
            let start = TimerVisualMotion.countdownStartTime(for: object)
            let duration = TimerVisualMotion.countdownDuration(for: object)
            let localElapsed = elapsed - start
            guard localElapsed >= 0 else { return nil }
            guard localElapsed < duration || (object == .circle && timerProgress == 1) else {
                return nil
            }
            return .init(
                object: object,
                progress: CGFloat(min(max(localElapsed / duration, 0), 1))
            )
        }
    }
}

struct TimerVisualLifecycle: Equatable {
    private(set) var mode: TimerVisualMode = .hidden
    private(set) var restEnteredAt: Date?
    private(set) var exitStartedAt: Date?
    private(set) var exitInitialMorph: CGFloat = 0
    private(set) var exitDestination: TimerVisualMode = .hidden

    /// Returns true when a cancellable rest-exit completion should be scheduled.
    mutating func transition(
        to requestedMode: TimerVisualMode,
        at date: Date,
        currentRestMorph: CGFloat
    ) -> Bool {
        guard requestedMode != mode else { return false }
        if mode == .rest, requestedMode != .rest {
            mode = .exiting
            exitStartedAt = date
            exitInitialMorph = currentRestMorph
            exitDestination = requestedMode
            return true
        }
        mode = requestedMode
        restEnteredAt = requestedMode == .rest ? date : nil
        exitStartedAt = nil
        exitInitialMorph = 0
        exitDestination = .hidden
        return false
    }

    mutating func completeExit() {
        guard mode == .exiting else { return }
        mode = exitDestination
        restEnteredAt = nil
        exitStartedAt = nil
        exitInitialMorph = 0
        exitDestination = .hidden
    }

    /// Timer state wins immediately for normal transitions. Only the intentional
    /// Rest gravity exit may temporarily outlive its requested timer mode.
    func renderedMode(for requestedMode: TimerVisualMode) -> TimerVisualMode {
        if mode == .exiting { return .exiting }
        if mode == .rest, requestedMode != .rest { return .rest }
        return requestedMode
    }
}

enum ExecutionTimerVisualStyle {
    static func color(for presentation: ExecutionTimerRegionPresentation) -> Color {
        presentation.isRest ? EQColor.Execution.restTimerText : EQColor.Execution.primaryAction
    }
}

struct StardustShape: Shape {
    static let lobeCount = 6
    static let innerRadiusRatio: CGFloat = 0.77
    static let cornerRadius: CGFloat = 20
    static let sampleCount = lobeCount * 2
    static let rotation: CGFloat = -.pi / 2

    var morph: CGFloat

    var animatableData: CGFloat {
        get { morph }
        set { morph = newValue }
    }

    func path(in rect: CGRect) -> Path {
        let amount = min(max(morph, 0), 1)
        let center = CGPoint(x: rect.midX, y: rect.midY)
        let baseRadius = min(rect.width, rect.height) / 2
        let points = (0..<Self.sampleCount).map { index -> CGPoint in
            let angle = Self.rotation
                + (CGFloat(index) / CGFloat(Self.sampleCount)) * 2 * .pi
            let radius = baseRadius * (index.isMultiple(of: 2)
                ? 1
                : Self.interpolatedInnerRadius(morph: amount))
            return CGPoint(
                x: center.x + cos(angle) * radius,
                y: center.y + sin(angle) * radius
            )
        }

        // Twelve stable anchors keep the path structure identical throughout the
        // morph. Circle handles begin at the ideal cubic arc length and converge
        // on the reference's 20-point rounded-star treatment.
        let circleHandle = baseRadius
            * (4 / 3)
            * tan(.pi / (2 * CGFloat(Self.sampleCount)))
        let starHandle = min(Self.cornerRadius, baseRadius * 0.22)
        let handleLength = circleHandle + ((starHandle - circleHandle) * amount)

        var path = Path()
        guard let first = points.first else { return path }
        path.move(to: first)
        for index in points.indices {
            let previous = points[(index - 1 + Self.sampleCount) % Self.sampleCount]
            let current = points[index]
            let next = points[(index + 1) % Self.sampleCount]
            let following = points[(index + 2) % Self.sampleCount]
            path.addCurve(
                to: next,
                control1: current + Self.normalized(next - previous) * handleLength,
                control2: next - Self.normalized(following - current) * handleLength
            )
        }
        path.closeSubpath()
        return path
    }

    static func normalizedRadius(at angle: CGFloat, morph: CGFloat) -> CGFloat {
        let amount = min(max(morph, 0), 1)
        let wave = (cos((angle - rotation) * CGFloat(lobeCount)) + 1) / 2
        let starRadius = innerRadiusRatio + ((1 - innerRadiusRatio) * wave)
        return 1 + ((starRadius - 1) * amount)
    }

    private static func interpolatedInnerRadius(morph: CGFloat) -> CGFloat {
        1 + ((innerRadiusRatio - 1) * morph)
    }

    private static func normalized(_ point: CGPoint) -> CGPoint {
        let length = hypot(point.x, point.y)
        guard length > 0 else { return .zero }
        return CGPoint(x: point.x / length, y: point.y / length)
    }
}

private extension CGPoint {
    static func + (lhs: CGPoint, rhs: CGPoint) -> CGPoint {
        CGPoint(x: lhs.x + rhs.x, y: lhs.y + rhs.y)
    }

    static func - (lhs: CGPoint, rhs: CGPoint) -> CGPoint {
        CGPoint(x: lhs.x - rhs.x, y: lhs.y - rhs.y)
    }

    static func * (lhs: CGPoint, rhs: CGFloat) -> CGPoint {
        CGPoint(x: lhs.x * rhs, y: lhs.y * rhs)
    }
}

private struct TimerTriangle: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.move(to: CGPoint(x: rect.midX, y: rect.minY))
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY))
        path.addLine(to: CGPoint(x: rect.minX, y: rect.maxY))
        path.closeSubpath()
        return path
    }
}

struct WorkoutTimerVisualLayer: View {
    let activePresentation: ExecutionTimerRegionPresentation
    let timer: CountdownTimer
    let walletTop: CGFloat
    let sceneCenterY: CGFloat
    let walletCollapseProgress: CGFloat
    let reduceMotion: Bool

    private var requestedMode: TimerVisualMode {
        switch activePresentation {
        case .hidden:
            return .hidden
        case .work(let state, _):
            return state.phase == .ready ? .workCountdown : .work
        case .rest:
            return .rest
        }
    }

    var body: some View {
        TimerVisualLayer(
            requestedMode: requestedMode,
            timer: timer,
            workColor: EQColor.Execution.primaryAction,
            restColor: EQColor.Execution.restTimerText,
            walletTop: walletTop,
            sceneCenterY: sceneCenterY,
            walletCollapseProgress: walletCollapseProgress,
            reduceMotion: reduceMotion
        )
    }
}

struct TimerVisualLayer: View {
    let requestedMode: TimerVisualMode
    let timer: CountdownTimer
    let workColor: Color
    let restColor: Color
    let walletTop: CGFloat
    let sceneCenterY: CGFloat
    let walletCollapseProgress: CGFloat
    let reduceMotion: Bool

    @State private var lifecycle = TimerVisualLifecycle()
    @State private var exitCompletionTask: Task<Void, Never>?

    /// Requested timer modes render immediately so Ready → Work cannot evaluate one
    /// frame with a reset Work timer while still drawing countdown geometry. Rest exit
    /// remains lifecycle-owned because it intentionally outlives the timer state.
    private var renderedMode: TimerVisualMode {
        lifecycle.renderedMode(for: requestedMode)
    }

    var body: some View {
        GeometryReader { proxy in
            TimelineView(.animation(minimumInterval: 1.0 / 60.0, paused: timelineIsPaused)) { context in
                visual(at: context.date, size: proxy.size)
            }
        }
        .clipped()
        .allowsHitTesting(false)
        .accessibilityHidden(true)
        .onChange(of: requestedMode, initial: true) { _, mode in
            synchronize(to: mode)
        }
        .onDisappear {
            exitCompletionTask?.cancel()
            exitCompletionTask = nil
        }
    }

    private var timelineIsPaused: Bool {
        switch renderedMode {
        case .hidden:
            return true
        case .workCountdown, .work:
            return timer.state != .running
        case .rest, .exiting:
            return false
        }
    }

    @ViewBuilder private func visual(at date: Date, size: CGSize) -> some View {
        let diameter = TimerVisualMotion.shapeDiameter(availableWidth: size.width)
        let squareDiameter = TimerVisualMotion.shapeDiameter(
            availableWidth: size.width,
            object: .square
        )
        let mode = renderedMode
        let countdownProgress = mode == .workCountdown
            ? TimerVisualMotion.countdownVisualProgress(
                timerProgress: timer.normalizedProgress,
                walletCollapseProgress: walletCollapseProgress,
                reduceMotion: reduceMotion
            )
            : nil
        let countdowns = countdownProgress.map {
            TimerCountdownVisualState.activeStates(timerProgress: $0)
        } ?? []
        let triangle = countdowns.first { $0.object == .triangle }
        let square = countdowns.first { $0.object == .square }
        let countdownCircle = countdowns.first { $0.object == .circle }
        let color = mode == .rest || mode == .exiting ? restColor : workColor

        ZStack(alignment: .topLeading) {
            if let triangle {
                TimerTriangle()
                    .fill(color)
                    .frame(width: diameter, height: diameter)
                    .rotationEffect(.degrees(TimerVisualMotion.countdownRotation(
                        object: .triangle,
                        progress: triangle.progress,
                        reduceMotion: reduceMotion
                    )))
                    .position(
                        x: size.width / 2,
                        y: walletTop + TimerVisualMotion.countdownCenterOffset(
                            object: .triangle,
                            progress: triangle.progress,
                            diameter: diameter,
                            sceneCenterY: sceneCenterY,
                            walletTop: walletTop,
                            reduceMotion: reduceMotion
                        )
                    )
            }

            if let square {
                Rectangle()
                    .fill(color)
                    .frame(width: squareDiameter, height: squareDiameter)
                    .rotationEffect(.degrees(TimerVisualMotion.countdownRotation(
                        object: .square,
                        progress: square.progress,
                        reduceMotion: reduceMotion
                    )))
                    .position(
                        x: size.width / 2,
                        y: walletTop + TimerVisualMotion.countdownCenterOffset(
                            object: .square,
                            progress: square.progress,
                            diameter: squareDiameter,
                            sceneCenterY: sceneCenterY,
                            walletTop: walletTop,
                            reduceMotion: reduceMotion
                        )
                    )
            }

            if mode == .work || countdownCircle != nil {
                Circle()
                    .fill(color)
                    .frame(width: diameter, height: diameter)
                    .position(
                        x: size.width / 2,
                        y: walletTop + workCircleCenterOffset(
                            countdown: countdownCircle,
                            diameter: diameter,
                            sceneCenterY: sceneCenterY
                        )
                    )
            }

            if mode == .rest {
                let entranceProgress = restEntranceProgress(at: date)
                let morph = restMorph(at: date)
                StardustShape(morph: morph)
                    .fill(color)
                    .frame(width: diameter, height: diameter)
                    .scaleEffect(TimerVisualMotion.restScale(morph: morph))
                    .position(
                        x: size.width / 2,
                        y: walletTop + TimerVisualMotion.restEntranceCenterOffset(
                            progress: entranceProgress,
                            diameter: diameter,
                            sceneCenterY: sceneCenterY,
                            walletTop: walletTop,
                            reduceMotion: reduceMotion
                        )
                    )
            }

            if mode == .exiting {
                let progress = restExitProgress(at: date)
                let morph = lifecycle.exitInitialMorph * (1 - progress)
                StardustShape(morph: morph)
                    .fill(color)
                    .frame(width: diameter, height: diameter)
                    .scaleEffect(TimerVisualMotion.restScale(morph: morph))
                    .position(
                        x: size.width / 2,
                        y: walletTop + TimerVisualMotion.restExitCenterOffset(
                            progress: progress,
                            diameter: diameter,
                            startOffset: TimerVisualMotion.screenCenterOffset(
                                sceneCenterY: sceneCenterY,
                                walletTop: walletTop
                            )
                        )
                    )
            }
        }
        .frame(width: size.width, height: size.height, alignment: .topLeading)
        .mask(alignment: .top) {
            Rectangle()
                .frame(height: min(max(walletTop, 0), size.height))
                .frame(maxHeight: .infinity, alignment: .top)
        }
    }

    private func workCircleCenterOffset(
        countdown: TimerCountdownVisualState?,
        diameter: CGFloat,
        sceneCenterY: CGFloat
    ) -> CGFloat {
        if let countdown {
            return TimerVisualMotion.countdownCenterOffset(
                object: .circle,
                progress: countdown.progress,
                diameter: diameter,
                sceneCenterY: sceneCenterY,
                walletTop: walletTop,
                reduceMotion: reduceMotion
            )
        }
        return TimerVisualMotion.workCircleCenterOffset(
            progress: CGFloat(timer.normalizedProgress),
            diameter: diameter,
            sceneCenterY: sceneCenterY,
            walletTop: walletTop
        )
    }

    private func restMorph(at date: Date) -> CGFloat {
        guard !reduceMotion else { return 0.35 }
        guard let enteredAt = lifecycle.restEnteredAt else { return 1 }
        let elapsed = date.timeIntervalSince(enteredAt) - TimerVisualMotion.restEntranceDuration
        guard elapsed > 0 else { return 1 }
        return TimerVisualMotion.restMorph(elapsed: elapsed)
    }

    private func restEntranceProgress(at date: Date) -> CGFloat {
        // The requested Rest mode can render one frame before onChange records its
        // entry date. Keep that frame hidden behind the wallet instead of flashing
        // at the destination and then jumping downward.
        guard let enteredAt = lifecycle.restEnteredAt else { return 0 }
        let duration = reduceMotion
            ? TimerVisualMotion.restReducedMotionEntranceDuration
            : TimerVisualMotion.restEntranceDuration
        return CGFloat(min(max(date.timeIntervalSince(enteredAt) / duration, 0), 1))
    }

    private func restExitProgress(at date: Date) -> CGFloat {
        guard let start = lifecycle.exitStartedAt else { return 1 }
        return CGFloat(min(max(date.timeIntervalSince(start) / TimerVisualMotion.restExitDuration, 0), 1))
    }

    private func synchronize(to mode: TimerVisualMode) {
        let now = Date()
        let beginsExit = lifecycle.transition(
            to: mode,
            at: now,
            currentRestMorph: restMorph(at: now)
        )

        exitCompletionTask?.cancel()
        exitCompletionTask = nil
        guard beginsExit else { return }
        exitCompletionTask = Task { @MainActor in
            try? await Task.sleep(for: .seconds(TimerVisualMotion.restExitDuration))
            guard !Task.isCancelled else { return }
            lifecycle.completeExit()
            exitCompletionTask = nil
        }
    }
}
