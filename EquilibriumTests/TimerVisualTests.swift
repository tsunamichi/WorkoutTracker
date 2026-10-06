import XCTest
@testable import Equilibrium

final class TimerVisualTests: XCTestCase {
    func testShapeSizesTrackRequestedWidthRatios() {
        XCTAssertEqual(TimerVisualMotion.shapeDiameter(availableWidth: 320), 192, accuracy: 0.001)
        XCTAssertEqual(TimerVisualMotion.shapeDiameter(availableWidth: 430), 258, accuracy: 0.001)
        XCTAssertEqual(
            TimerVisualMotion.shapeDiameter(availableWidth: 320, object: .square),
            176,
            accuracy: 0.001
        )
        XCTAssertEqual(
            TimerVisualMotion.shapeDiameter(availableWidth: 430, object: .square),
            236.5,
            accuracy: 0.001
        )
    }

    func testLargeCountdownNumberTracksTheActiveShapeAfterWalletLeadIn() {
        let total = TimerVisualMotion.countdownDuration
        let leadIn = WorkoutWorkTimerTiming.preparationLeadInDuration
        let flight = TimerVisualMotion.countdownFlightDuration

        XCTAssertEqual(TimerVisualMotion.countdownNumber(timerProgress: 0), 3)
        XCTAssertEqual(TimerVisualMotion.countdownNumber(timerProgress: leadIn / total), 3)
        XCTAssertEqual(
            TimerVisualMotion.countdownNumber(timerProgress: (leadIn + flight) / total),
            2
        )
        XCTAssertEqual(
            TimerVisualMotion.countdownNumber(timerProgress: (leadIn + (2 * flight)) / total),
            1
        )
        XCTAssertEqual(TimerVisualMotion.countdownNumber(timerProgress: 1), 0)
    }

    func testTimerDigitRollUsesControlledNonSpringDuration() {
        XCTAssertEqual(EQMotion.timerDigitRollDuration, 0.42, accuracy: 0.001)
    }

    func testCountdownWaitsForWalletCollapseBeforeStartingTriangle() {
        XCTAssertNil(TimerVisualMotion.countdownVisualProgress(
            timerProgress: 0.2,
            walletCollapseProgress: 0.99,
            reduceMotion: false
        ))
        let revealProgress = EQMotion.objectTransformationDuration
            / TimerVisualMotion.countdownDuration
        XCTAssertEqual(
            TimerVisualMotion.countdownVisualProgress(
                timerProgress: revealProgress,
                walletCollapseProgress: 1,
                reduceMotion: false
            ) ?? -1,
            0,
            accuracy: 0.001
        )
    }

    func testCountdownProgressSelectsTriangleSquareThenCircle() {
        XCTAssertEqual(TimerCountdownVisualState.derive(timerProgress: 0).object, .triangle)
        XCTAssertEqual(TimerCountdownVisualState.derive(timerProgress: 0.39).object, .triangle)
        XCTAssertEqual(TimerCountdownVisualState.derive(timerProgress: 0.4).object, .square)
        XCTAssertEqual(TimerCountdownVisualState.derive(timerProgress: 0.8).object, .circle)
        let completed = TimerCountdownVisualState.derive(timerProgress: 1)
        XCTAssertEqual(completed.object, .circle)
        XCTAssertEqual(completed.progress, 1, accuracy: 0.001)
    }

    func testFlightsDoNotOverlapAtCountdownBoundaries() {
        let shortlyAfterSecondLaunch = TimerCountdownVisualState.activeStates(
            timerProgress: 1.05 / TimerVisualMotion.countdownSequenceDuration
        )
        XCTAssertEqual(shortlyAfterSecondLaunch.map(\.object), [.square])
        XCTAssertLessThan(shortlyAfterSecondLaunch[0].progress, 0.1)
    }

    func testCircleAndRestEntrancesTakeHalfASecond() {
        XCTAssertEqual(TimerVisualMotion.countdownCircleEntranceDuration, 0.5, accuracy: 0.001)
        XCTAssertEqual(
            TimerVisualMotion.countdownDuration(for: .circle),
            0.5,
            accuracy: 0.001
        )
        XCTAssertEqual(TimerVisualMotion.restEntranceDuration, 0.5, accuracy: 0.001)
        XCTAssertEqual(
            WorkoutWorkTimerTiming.countdownDuration,
            WorkoutWorkTimerTiming.preparationLeadInDuration + 2.5,
            accuracy: 0.001
        )
    }

    func testOneSecondFlightUsesSpecifiedAscentAndDescentCurves() {
        let diameter: CGFloat = 240
        let sceneCenterY: CGFloat = 400
        let walletTop: CGFloat = 650
        let start = TimerVisualMotion.countdownCenterOffset(
            object: .triangle,
            progress: 0,
            diameter: diameter,
            sceneCenterY: sceneCenterY,
            walletTop: walletTop,
            reduceMotion: false
        )
        let apex = TimerVisualMotion.countdownCenterOffset(
            object: .triangle,
            progress: 0.5,
            diameter: diameter,
            sceneCenterY: sceneCenterY,
            walletTop: walletTop,
            reduceMotion: false
        )
        let end = TimerVisualMotion.countdownCenterOffset(
            object: .triangle,
            progress: 1,
            diameter: diameter,
            sceneCenterY: sceneCenterY,
            walletTop: walletTop,
            reduceMotion: false
        )
        XCTAssertEqual(TimerVisualMotion.countdownFlightDuration, 1, accuracy: 0.001)
        XCTAssertEqual(TimerVisualMotion.countdownAscentCurve, .init(x1: 0.42, y1: 0, x2: 0.16, y2: 1))
        XCTAssertEqual(TimerVisualMotion.workCircleEntranceCurve, .init(x1: 0.42, y1: 0, x2: 0.16, y2: 1))
        XCTAssertEqual(TimerVisualMotion.countdownDescentCurve, .init(x1: 0.42, y1: 0, x2: 1, y2: 0.16))
        XCTAssertEqual(walletTop + apex, sceneCenterY, accuracy: 0.001)
        XCTAssertEqual(end, start, accuracy: 0.001)
        XCTAssertGreaterThanOrEqual(end - diameter / 2, 0)
    }

    func testCountdownRotationIsDeterministicAndDisabledForReduceMotion() {
        XCTAssertEqual(
            TimerVisualMotion.countdownRotation(object: .triangle, progress: 0, reduceMotion: false),
            -TimerVisualMotion.countdownRotationAmount / 2,
            accuracy: 0.001
        )
        XCTAssertEqual(
            TimerVisualMotion.countdownRotation(object: .triangle, progress: 1, reduceMotion: false),
            TimerVisualMotion.countdownRotationAmount / 2,
            accuracy: 0.001
        )
        XCTAssertEqual(
            TimerVisualMotion.countdownRotation(object: .square, progress: 1, reduceMotion: true),
            0,
            accuracy: 0.001
        )
    }

    func testCountdownCircleEndsAtExactWorkCircleStart() {
        let diameter: CGFloat = 258
        let sceneCenterY: CGFloat = 400
        let walletTop: CGFloat = 650
        let countdownEnd = TimerVisualMotion.countdownCenterOffset(
            object: .circle,
            progress: 1,
            diameter: diameter,
            sceneCenterY: sceneCenterY,
            walletTop: walletTop,
            reduceMotion: false
        )
        let workStart = TimerVisualMotion.workCircleCenterOffset(
            progress: 0,
            diameter: diameter,
            sceneCenterY: sceneCenterY,
            walletTop: walletTop
        )
        let workEnd = TimerVisualMotion.workCircleCenterOffset(
            progress: 1,
            diameter: diameter,
            sceneCenterY: sceneCenterY,
            walletTop: walletTop
        )
        XCTAssertEqual(countdownEnd, workStart, accuracy: 0.001)
        XCTAssertEqual(walletTop + workStart, sceneCenterY, accuracy: 0.001)
        XCTAssertGreaterThan(workEnd, workStart)
        XCTAssertGreaterThanOrEqual(workEnd - (diameter / 2), 0)
    }

    func testCountdownTimingCurvesClampAndReachTheirEndpoints() {
        XCTAssertEqual(TimerVisualMotion.countdownAscentCurve.value(at: -1), 0, accuracy: 0.001)
        XCTAssertEqual(TimerVisualMotion.countdownAscentCurve.value(at: 1), 1, accuracy: 0.001)
        XCTAssertEqual(TimerVisualMotion.countdownDescentCurve.value(at: 0), 0, accuracy: 0.001)
        XCTAssertEqual(TimerVisualMotion.countdownDescentCurve.value(at: 2), 1, accuracy: 0.001)
    }

    func testRestShapeSitsFullyAboveWallet() {
        let sceneCenterY: CGFloat = 400
        let walletTop: CGFloat = 650
        let diameter: CGFloat = 240
        let maximumRadius = diameter / 2
        XCTAssertLessThanOrEqual(sceneCenterY + maximumRadius, walletTop)
    }

    func testRestShapeLaunchesFromBehindWalletAndSettlesAtItsRestPosition() {
        let diameter: CGFloat = 240
        let sceneCenterY: CGFloat = 400
        let walletTop: CGFloat = 650
        let start = TimerVisualMotion.restEntranceCenterOffset(
            progress: 0,
            diameter: diameter,
            sceneCenterY: sceneCenterY,
            walletTop: walletTop,
            reduceMotion: false
        )
        let end = TimerVisualMotion.restEntranceCenterOffset(
            progress: 1,
            diameter: diameter,
            sceneCenterY: sceneCenterY,
            walletTop: walletTop,
            reduceMotion: false
        )

        XCTAssertGreaterThanOrEqual(start - diameter / 2, 0)
        XCTAssertEqual(walletTop + end, sceneCenterY, accuracy: 0.001)
    }

    func testRestShapeOvershootsBeforeSettlingAtItsRestPosition() {
        let diameter: CGFloat = 240
        let sceneCenterY: CGFloat = 400
        let walletTop: CGFloat = 650
        let target = TimerVisualMotion.screenCenterOffset(
            sceneCenterY: sceneCenterY,
            walletTop: walletTop
        )
        let apex = TimerVisualMotion.restEntranceCenterOffset(
            progress: TimerVisualMotion.restEntranceOvershootProgress,
            diameter: diameter,
            sceneCenterY: sceneCenterY,
            walletTop: walletTop,
            reduceMotion: false
        )
        let reducedMotionPosition = TimerVisualMotion.restEntranceCenterOffset(
            progress: TimerVisualMotion.restEntranceOvershootProgress,
            diameter: diameter,
            sceneCenterY: sceneCenterY,
            walletTop: walletTop,
            reduceMotion: true
        )

        XCTAssertEqual(
            target - apex,
            TimerVisualMotion.restEntranceOvershootDistanceRatio * diameter,
            accuracy: 0.001
        )
        XCTAssertGreaterThan(reducedMotionPosition, target)
    }

    func testStardustMorphKeepsOneSymmetricSixLobePath() {
        let tipAngle = StardustShape.rotation
        let circleRadius = StardustShape.normalizedRadius(at: tipAngle, morph: 0)
        let tipRadius = StardustShape.normalizedRadius(at: tipAngle, morph: 1)
        let valleyRadius = StardustShape.normalizedRadius(
            at: tipAngle + (.pi / CGFloat(StardustShape.lobeCount)),
            morph: 1
        )
        let nextTipRadius = StardustShape.normalizedRadius(
            at: tipAngle + ((2 * .pi) / CGFloat(StardustShape.lobeCount)),
            morph: 1
        )

        XCTAssertEqual(circleRadius, 1, accuracy: 0.001)
        XCTAssertEqual(tipRadius, nextTipRadius, accuracy: 0.001)
        XCTAssertEqual(valleyRadius, 0.77, accuracy: 0.001)
        XCTAssertEqual(StardustShape.cornerRadius, 20, accuracy: 0.001)
        XCTAssertEqual(StardustShape.sampleCount, StardustShape.lobeCount * 2)
    }

    func testRestBreathUsesAsymmetricInhaleHoldExhaleAndPause() {
        XCTAssertEqual(TimerVisualMotion.restInhaleDuration, 3.4, accuracy: 0.001)
        XCTAssertEqual(TimerVisualMotion.restCircleHoldDuration, 0.2, accuracy: 0.001)
        XCTAssertEqual(TimerVisualMotion.restExhaleDuration, 4.3, accuracy: 0.001)
        XCTAssertEqual(TimerVisualMotion.restStarburstPauseDuration, 0.15, accuracy: 0.001)
        XCTAssertEqual(TimerVisualMotion.restMorphDuration, 8.05, accuracy: 0.001)
        XCTAssertEqual(TimerVisualMotion.restStarburstScale, 0.90, accuracy: 0.001)
        XCTAssertEqual(
            TimerVisualMotion.restInhaleCurve,
            TimerVisualCubicBezier(x1: 0.45, y1: 0, x2: 0.35, y2: 1)
        )
        XCTAssertEqual(
            TimerVisualMotion.restExhaleCurve,
            TimerVisualCubicBezier(x1: 0.35, y1: 0, x2: 0.15, y2: 1)
        )

        XCTAssertEqual(TimerVisualMotion.restMorph(elapsed: 0), 1, accuracy: 0.001)
        XCTAssertEqual(
            TimerVisualMotion.restMorph(elapsed: TimerVisualMotion.restInhaleDuration),
            0,
            accuracy: 0.001
        )
        XCTAssertEqual(TimerVisualMotion.restMorph(elapsed: 3.5), 0, accuracy: 0.001)
        XCTAssertEqual(TimerVisualMotion.restMorph(elapsed: 3.6), 0, accuracy: 0.001)
        XCTAssertEqual(TimerVisualMotion.restMorph(elapsed: 7.9), 1, accuracy: 0.001)
        XCTAssertEqual(TimerVisualMotion.restMorph(elapsed: 8.0), 1, accuracy: 0.001)
        XCTAssertEqual(
            TimerVisualMotion.restMorph(elapsed: TimerVisualMotion.restMorphDuration),
            1,
            accuracy: 0.001
        )
        XCTAssertGreaterThan(
            TimerVisualMotion.restExhaleCurve.value(at: 0.25),
            TimerVisualMotion.restInhaleCurve.value(at: 0.25)
        )
        XCTAssertEqual(TimerVisualMotion.restScale(morph: 0), 1, accuracy: 0.001)
        XCTAssertEqual(TimerVisualMotion.restScale(morph: 1), 0.90, accuracy: 0.001)
        XCTAssertEqual(TimerVisualMotion.restScale(morph: 0.5), 0.95, accuracy: 0.001)
    }

    func testRestLifecycleUsesExplicitGravityExit() {
        let now = Date(timeIntervalSinceReferenceDate: 100)
        var lifecycle = TimerVisualLifecycle()
        XCTAssertFalse(lifecycle.transition(to: .rest, at: now, currentRestMorph: 0))
        XCTAssertEqual(lifecycle.mode, .rest)
        XCTAssertEqual(lifecycle.restEnteredAt, now)
        XCTAssertTrue(lifecycle.transition(
            to: .hidden,
            at: now,
            currentRestMorph: 0.72
        ))
        XCTAssertEqual(lifecycle.mode, .exiting)
        XCTAssertEqual(lifecycle.exitInitialMorph, 0.72, accuracy: 0.001)
        lifecycle.completeExit()
        XCTAssertEqual(lifecycle.mode, .hidden)
    }

    func testRestLifecycleCanExitIntoTheNextWorkInterval() {
        let now = Date(timeIntervalSinceReferenceDate: 100)
        var lifecycle = TimerVisualLifecycle()
        _ = lifecycle.transition(to: .rest, at: now, currentRestMorph: 0)

        XCTAssertTrue(lifecycle.transition(
            to: .work,
            at: now.addingTimeInterval(2),
            currentRestMorph: 0.64
        ))
        XCTAssertEqual(lifecycle.mode, .exiting)
        XCTAssertEqual(lifecycle.exitDestination, .work)
        XCTAssertEqual(lifecycle.renderedMode(for: .work), .exiting)

        lifecycle.completeExit()
        XCTAssertEqual(lifecycle.mode, .work)
        XCTAssertEqual(lifecycle.renderedMode(for: .work), .work)
    }

    func testTimerModeWinsImmediatelyAtCountdownToWorkHandoff() {
        var lifecycle = TimerVisualLifecycle()
        _ = lifecycle.transition(
            to: .workCountdown,
            at: Date(timeIntervalSinceReferenceDate: 100),
            currentRestMorph: 0
        )

        XCTAssertEqual(lifecycle.mode, .workCountdown)
        XCTAssertEqual(lifecycle.renderedMode(for: .work), .work)
    }

    @MainActor func testDeadlineProgressIsContinuousAndFreezesWhilePaused() {
        var now: TimeInterval = 10
        let timer = CountdownTimer(now: { now })
        timer.start(duration: 20)
        now = 15
        XCTAssertEqual(timer.currentRemainingDuration, 15, accuracy: 0.001)
        XCTAssertEqual(timer.normalizedProgress, 0.25, accuracy: 0.001)

        timer.pause()
        now = 100
        XCTAssertEqual(timer.currentRemainingDuration, 15, accuracy: 0.001)
        XCTAssertEqual(timer.normalizedProgress, 0.25, accuracy: 0.001)
    }
}
