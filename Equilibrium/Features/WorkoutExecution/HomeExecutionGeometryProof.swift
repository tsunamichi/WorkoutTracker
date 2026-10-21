import SwiftUI

/// The complete geometry for one Home ↔ execution presentation frame.
///
/// This is deliberately independent of `ExecutionWallet`.  Stage 1 uses it to
/// prove that a single interpolated progress value can resolve the wallet
/// viewport, the foreground-only exit translation, and their visible
/// intersection together.  Production navigation does not consume it yet.
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

        // The proof intentionally derives arrival from the *same* progress as
        // the wallet. This is the relationship Stage 2 will adopt; there is no
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

#if DEBUG
/// A self-contained rendering proof for the Stage 1 geometry model. It uses
/// one AnimatableModifier value for all geometry. The list canvas stays in the
/// wallet-local coordinate system; only the foreground region is translated.
struct HomeExecutionGeometryProofScene: View {
    @State private var progress: CGFloat

    init() {
        let arguments = ProcessInfo.processInfo.arguments
        if let index = arguments.firstIndex(of: "-debugHomeExecutionGeometryProofProgress"),
           arguments.indices.contains(index + 1),
           let suppliedProgress = Double(arguments[index + 1]) {
            _progress = State(initialValue: min(max(CGFloat(suppliedProgress), 0), 1))
        } else {
            _progress = State(initialValue: 0)
        }
    }

    var body: some View {
        GeometryReader { proxy in
            let canvasSize = CGSize(width: max(0, proxy.size.width - 32), height: max(0, proxy.size.height - 156))
            let input = HomeExecutionPresentationGeometry.Input(
                homeWalletFrame: CGRect(x: 16, y: canvasSize.height - 154, width: canvasSize.width, height: 138),
                executionWalletFrame: CGRect(x: 16, y: 128, width: canvasSize.width, height: canvasSize.height - 128),
                foregroundTop: max(120, canvasSize.height - 322),
                foregroundSize: CGSize(width: canvasSize.width, height: 238),
                foregroundClearance: 12
            )

            ZStack(alignment: .top) {
                Color.clear
                    .modifier(HomeExecutionGeometryProofRenderer(progress: progress, input: input, canvasSize: canvasSize))
                    .frame(height: canvasSize.height)

                VStack(spacing: 8) {
                    Text("Home ↔ Execution Geometry Proof")
                        .font(.headline)
                    Text("One animatable progress resolves wallet, foreground exit, and clip.")
                        .font(.caption)
                        .multilineTextAlignment(.center)
                        .foregroundStyle(.secondary)
                }
                .padding(.top, 12)

                HStack {
                    Button("Home") { withAnimation(.easeInOut(duration: 2)) { progress = 0 } }
                    Spacer()
                    Text(String(format: "p %.3f", Double(progress)))
                        .monospacedDigit()
                    Spacer()
                    Button("Execution") { withAnimation(.easeInOut(duration: 2)) { progress = 1 } }
                }
                .buttonStyle(.borderedProminent)
                .padding(.horizontal, 16)
                .padding(.top, canvasSize.height + 16)
            }
        }
        .background(Color(uiColor: .systemBackground))
        .onAppear {
            guard ProcessInfo.processInfo.arguments.contains("-debugHomeExecutionGeometryProofAutoplay") else { return }
            DispatchQueue.main.async {
                withAnimation(.easeInOut(duration: 2)) { progress = 1 }
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + 2.6) {
                withAnimation(.easeInOut(duration: 2)) { progress = 0 }
            }
        }
    }
}

private struct HomeExecutionGeometryProofRenderer: AnimatableModifier {
    var progress: CGFloat
    let input: HomeExecutionPresentationGeometry.Input
    let canvasSize: CGSize

    var animatableData: CGFloat {
        get { progress }
        set { progress = newValue }
    }

    func body(content: Content) -> some View {
        let geometry = HomeExecutionPresentationGeometry.resolve(input: input, progress: progress)

        ZStack(alignment: .topLeading) {
            HomeExecutionGeometryProofWalletSurface(canvasSize: canvasSize)

            HomeExecutionGeometryProofForeground()
                .frame(width: input.foregroundSize.width, height: input.foregroundSize.height)
                .offset(y: input.foregroundTop + geometry.foregroundTranslation)
        }
        // The stable canvas prevents the list and foreground typography from
        // reflowing while the viewport changes size. The final viewport and its
        // clip are applied only after both regions have been composed.
        .frame(width: canvasSize.width, height: canvasSize.height, alignment: .topLeading)
        .frame(width: geometry.walletFrame.width, height: geometry.walletFrame.height, alignment: .topLeading)
        .clipShape(RoundedRectangle(cornerRadius: 30, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 30, style: .continuous)
                .stroke(.pink, lineWidth: 2)
        }
        .overlay(alignment: .topLeading) {
            VStack(alignment: .leading, spacing: 2) {
                Text(String(format: "p %.3f", Double(geometry.progress)))
                Text(String(format: "exit y %.1f", Double(geometry.foregroundTranslation)))
                Text(geometry.visibleForegroundIntersection == nil ? "foreground clipped" : "foreground visible")
            }
            .font(.caption2.monospacedDigit())
            .padding(6)
            .background(.black.opacity(0.65), in: RoundedRectangle(cornerRadius: 6))
            .foregroundStyle(.white)
            .padding(8)
        }
        .position(x: geometry.walletFrame.midX, y: geometry.walletFrame.midY)
    }
}

private struct HomeExecutionGeometryProofWalletSurface: View {
    let canvasSize: CGSize

    var body: some View {
        ZStack(alignment: .topLeading) {
            RoundedRectangle(cornerRadius: 30, style: .continuous)
                .fill(Color.green.opacity(0.18))
            VStack(alignment: .leading, spacing: 12) {
                Text("Exercises")
                    .font(.headline)
                ForEach(0..<4, id: \.self) { index in
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .fill(Color.green.opacity(0.22))
                        .frame(height: 46)
                        .overlay(alignment: .leading) {
                            Text("Exercise \(index + 1)")
                                .font(.subheadline)
                                .padding(.leading, 12)
                        }
                }
            }
            .padding(16)
            .frame(width: canvasSize.width, alignment: .leading)
        }
    }
}

private struct HomeExecutionGeometryProofForeground: View {
    var body: some View {
        RoundedRectangle(cornerRadius: 28, style: .continuous)
            .fill(Color(red: 0.91, green: 0.97, blue: 0.84))
            .overlay(alignment: .topLeading) {
                VStack(alignment: .leading, spacing: 12) {
                    Text("IN PROGRESS")
                        .font(.caption.weight(.bold))
                    Text("Spanish Squat ISO")
                        .font(.title2.weight(.medium))
                    Spacer()
                    HStack {
                        Text("30 secs")
                        Spacer()
                        Text("1/1")
                    }
                }
                .foregroundStyle(Color.purple)
                .padding(20)
            }
            .overlay {
                RoundedRectangle(cornerRadius: 28, style: .continuous)
                    .stroke(.pink, lineWidth: 2)
            }
    }
}
#endif
