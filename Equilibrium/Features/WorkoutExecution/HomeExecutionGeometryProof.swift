import SwiftUI

/// The complete geometry for one Home ↔ execution presentation frame.
///
/// This is deliberately independent of `ExecutionWallet`, so a single
/// interpolated progress value resolves the wallet viewport, the
/// foreground-only translation, and their visible intersection together.
struct HomeExecutionPresentationGeometry: Equatable {
    struct Input: Equatable {
        let homeWalletFrame: CGRect
        let executionWalletFrame: CGRect
        let foregroundTop: CGFloat
        let foregroundSize: CGSize
        let foregroundClearance: CGFloat

        init(
            homeWalletFrame: CGRect,
            executionWalletFrame: CGRect,
            foregroundTop: CGFloat,
            foregroundSize: CGSize,
            foregroundClearance: CGFloat
        ) {
            self.homeWalletFrame = homeWalletFrame
            self.executionWalletFrame = executionWalletFrame
            self.foregroundTop = foregroundTop
            self.foregroundSize = foregroundSize
            self.foregroundClearance = foregroundClearance
        }
    }

    let progress: CGFloat
    let walletFrame: CGRect
    let foregroundBaseFrame: CGRect
    let foregroundArrival: CGFloat
    let foregroundTranslation: CGFloat
    let foregroundFrame: CGRect
    let visibleForegroundIntersection: CGRect?

    static func resolve(input: Input, progress: CGFloat) -> Self {
        let resolvedProgress = min(max(progress, 0), 1)
        let walletFrame = interpolate(
            from: input.homeWalletFrame,
            to: input.executionWalletFrame,
            progress: resolvedProgress
        )

        // Arrival derives from the same progress as the wallet; there is no
        // environment hop or separately interpolated child value.
        let foregroundArrival = ExecutionForegroundEntry.arrival(
            walletTransitionProgress: resolvedProgress,
            entryProgress: resolvedProgress
        )
        let translation = (1 - foregroundArrival) * ExecutionForegroundEntry.slideDistance(
            walletHeight: walletFrame.height,
            cardTop: input.foregroundTop,
            gap: input.foregroundClearance
        )
        let foregroundBaseFrame = CGRect(
            x: walletFrame.minX,
            y: walletFrame.minY + input.foregroundTop,
            width: input.foregroundSize.width,
            height: input.foregroundSize.height
        )
        let foregroundFrame = foregroundBaseFrame.offsetBy(dx: 0, dy: translation)
        let intersection = walletFrame.intersection(foregroundFrame)

        return Self(
            progress: resolvedProgress,
            walletFrame: walletFrame,
            foregroundBaseFrame: foregroundBaseFrame,
            foregroundArrival: foregroundArrival,
            foregroundTranslation: translation,
            foregroundFrame: foregroundFrame,
            visibleForegroundIntersection: intersection.isNull || intersection.isEmpty ? nil : intersection
        )
    }

    private static func interpolate(from source: CGRect, to destination: CGRect, progress: CGFloat) -> CGRect {
        CGRect(
            x: source.minX + ((destination.minX - source.minX) * progress),
            y: source.minY + ((destination.minY - source.minY) * progress),
            width: source.width + ((destination.width - source.width) * progress),
            height: source.height + ((destination.height - source.height) * progress)
        )
    }
}

/// The production Home ↔ execution renderer. Its only animatable value is the
/// presentation progress; the wallet viewport, foreground-only translation,
/// and final rounded clip resolve in one rendering evaluation.
struct UnifiedHomeExecutionRenderer<Surface: View, Foreground: View>: View, Animatable {
    var progress: CGFloat
    let input: HomeExecutionPresentationGeometry.Input
    let canvasSize: CGSize
    let borderColor: Color
    let surface: (CGSize) -> Surface
    let foreground: (HomeExecutionPresentationGeometry) -> Foreground

    var animatableData: CGFloat {
        get { progress }
        set { progress = newValue }
    }

    var body: some View {
        let geometry = HomeExecutionPresentationGeometry.resolve(input: input, progress: progress)

        ZStack(alignment: .topLeading) {
            surface(canvasSize)
                .frame(width: canvasSize.width, height: canvasSize.height, alignment: .topLeading)

            foreground(geometry)
                .frame(width: canvasSize.width, height: canvasSize.height, alignment: .topLeading)
                // Intentionally applies to the foreground region only. The list
                // canvas remains in wallet-local coordinates throughout resize.
                .offset(y: geometry.foregroundTranslation)
        }
        .frame(width: canvasSize.width, height: canvasSize.height, alignment: .topLeading)
        .frame(width: geometry.walletFrame.width, height: geometry.walletFrame.height, alignment: .topLeading)
        // The normal wallet and the expanded Settings surface share this exact
        // outer shape. It supplies the device-concentric lower corners once,
        // while the bottom-anchored foreground shell remains square at its base.
        .modifier(ExecutionWalletShapeModifier(
            drawsBorder: true,
            borderColor: borderColor
        ))
        .position(x: geometry.walletFrame.midX, y: geometry.walletFrame.midY)
    }
}
