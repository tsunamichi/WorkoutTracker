import SwiftUI

enum ContextualActionMenuDirection: Equatable {
    case upward
    case downward
}

enum ContextualActionMenuAlignment: Equatable {
    case leading
    case trailing
}

enum ContextualActionMenuActionRole: Equatable {
    case standard
    case destructive

    fileprivate var buttonRole: ButtonRole? {
        self == .destructive ? .destructive : nil
    }
}

struct ContextualActionMenuAction: Identifiable {
    let id: String
    let title: String
    var groupID: String?
    var accessibilityHint: String?
    var isEnabled: Bool
    var role: ContextualActionMenuActionRole
    let action: () -> Void

    init(
        id: String,
        title: String,
        groupID: String? = nil,
        accessibilityHint: String? = nil,
        isEnabled: Bool = true,
        role: ContextualActionMenuActionRole = .standard,
        action: @escaping () -> Void
    ) {
        self.id = id
        self.title = title
        self.groupID = groupID
        self.accessibilityHint = accessibilityHint
        self.isEnabled = isEnabled
        self.role = role
        self.action = action
    }
}

struct ContextualActionMenuMotion {
    var backdropDuration: TimeInterval = 0.20
    var actionDuration: TimeInterval = 0.30
    var closingDuration: TimeInterval = 0.18
    var stagger: TimeInterval = 0.05
    var translation: CGFloat = EQSpacing.md

    func actionAnimation(isPresented: Bool, delay: TimeInterval) -> Animation {
        if isPresented {
            .spring(duration: actionDuration, bounce: 0.04).delay(delay)
        } else {
            .easeOut(duration: closingDuration).delay(delay)
        }
    }
}

enum ContextualActionMenuAppearance {
    /// Two full 40% semantic passes produce 64% dimming. A final 76.389% pass
    /// raises the composed result to an exact 75% while retaining the exported token.
    static let backdropPassOpacities: [Double] = [1, 1, 55 / 72]
    static let coveredContentOpacity = 0.25
}

struct ContextualActionMenuConfiguration {
    var direction: ContextualActionMenuDirection = .upward
    var alignment: ContextualActionMenuAlignment = .trailing
    var actionSpacing: CGFloat = EQSpacing.xs
    var actionGroupSpacing: CGFloat = EQSpacing.lg
    var triggerSpacing: CGFloat = EQSpacing.md
    var edgePadding: CGFloat = EQLayout.screenGutter
    var minimumActionHeight: CGFloat = EQLayout.minimumTouch
    var triggerHoleRadius: CGFloat = EQRadius.button
    var motion = ContextualActionMenuMotion()
}

enum ContextualActionMenuAnimationOrder {
    static func revealRank(
        for index: Int,
        count: Int,
        direction: ContextualActionMenuDirection
    ) -> Int {
        guard count > 0 else { return 0 }
        return switch direction {
        case .upward: max(0, count - 1 - index)
        case .downward: max(0, index)
        }
    }

    static func dismissalRank(
        for index: Int,
        count: Int,
        direction: ContextualActionMenuDirection
    ) -> Int {
        max(0, count - 1 - revealRank(for: index, count: count, direction: direction))
    }
}

enum ContextualActionMenuLayout {
    static func groupBreakCount(_ groupIDs: [String?]) -> Int {
        guard groupIDs.count > 1 else { return 0 }
        return groupIDs.indices.dropFirst().reduce(into: 0) { count, index in
            if groupIDs[index - 1] != groupIDs[index] {
                count += 1
            }
        }
    }

    static func resolvedDirection(
        preferred: ContextualActionMenuDirection,
        triggerFrame: CGRect,
        containerHeight: CGFloat,
        safeAreaTop: CGFloat,
        safeAreaBottom: CGFloat,
        edgePadding: CGFloat,
        triggerSpacing: CGFloat,
        requiredHeight: CGFloat
    ) -> ContextualActionMenuDirection {
        let upperBoundary = max(0, safeAreaTop + edgePadding)
        let lowerBoundary = max(upperBoundary, containerHeight - safeAreaBottom - edgePadding)
        let spaceAbove = max(0, triggerFrame.minY - triggerSpacing - upperBoundary)
        let spaceBelow = max(0, lowerBoundary - triggerFrame.maxY - triggerSpacing)

        switch preferred {
        case .upward where spaceAbove < requiredHeight && spaceBelow > spaceAbove:
            return .downward
        case .downward where spaceBelow < requiredHeight && spaceAbove > spaceBelow:
            return .upward
        default:
            return preferred
        }
    }

    static func viewport(
        direction: ContextualActionMenuDirection,
        alignment: ContextualActionMenuAlignment,
        triggerFrame: CGRect,
        containerSize: CGSize,
        safeAreaInsets: EdgeInsets,
        edgePadding: CGFloat,
        triggerSpacing: CGFloat
    ) -> CGRect {
        let minimumX = max(0, safeAreaInsets.leading + edgePadding)
        let maximumX = max(minimumX, containerSize.width - safeAreaInsets.trailing - edgePadding)
        let minimumY = max(0, safeAreaInsets.top + edgePadding)
        let maximumY = max(minimumY, containerSize.height - safeAreaInsets.bottom - edgePadding)

        let horizontalRange: ClosedRange<CGFloat>
        switch alignment {
        case .leading:
            let leading = min(max(triggerFrame.minX, minimumX), maximumX)
            horizontalRange = leading...maximumX
        case .trailing:
            let trailing = min(max(triggerFrame.maxX, minimumX), maximumX)
            horizontalRange = minimumX...trailing
        }

        let verticalRange: ClosedRange<CGFloat>
        switch direction {
        case .upward:
            verticalRange = minimumY...max(minimumY, triggerFrame.minY - triggerSpacing)
        case .downward:
            let top = min(maximumY, triggerFrame.maxY + triggerSpacing)
            verticalRange = top...maximumY
        }

        return CGRect(
            x: horizontalRange.lowerBound,
            y: verticalRange.lowerBound,
            width: max(0, horizontalRange.upperBound - horizontalRange.lowerBound),
            height: max(0, verticalRange.upperBound - verticalRange.lowerBound)
        )
    }
}

private enum ContextualActionMenuAnchor {
    static let defaultID = "contextual-action-menu-default-trigger"
}

private struct ContextualActionMenuTriggerAnchorKey: PreferenceKey {
    static var defaultValue: [String: Anchor<CGRect>] = [:]

    static func reduce(value: inout [String: Anchor<CGRect>], nextValue: () -> [String: Anchor<CGRect>]) {
        value.merge(nextValue(), uniquingKeysWith: { _, newest in newest })
    }
}

struct ContextualActionMenuTrigger<Label: View>: View {
    let isPresented: Bool
    var anchorID: String = ContextualActionMenuAnchor.defaultID
    let accessibilityLabel: String
    var accessibilityHint: String?
    let toggle: () -> Void
    @ViewBuilder let label: () -> Label

    var body: some View {
        Button(action: toggle) {
            label()
        }
        .buttonStyle(.plain)
        .anchorPreference(key: ContextualActionMenuTriggerAnchorKey.self, value: .bounds) {
            [anchorID: $0]
        }
        .accessibilityLabel(accessibilityLabel)
        .accessibilityValue(isPresented ? "Expanded" : "Collapsed")
        .accessibilityHint(accessibilityHint ?? (isPresented ? "Closes the action menu" : "Opens the action menu"))
    }
}

struct ContextualActionMenu<Content: View>: View {
    @Binding var isPresented: Bool
    let actions: [ContextualActionMenuAction]
    var configuration = ContextualActionMenuConfiguration()
    var triggerID: String = ContextualActionMenuAnchor.defaultID
    @ViewBuilder let content: () -> Content

    var body: some View {
        content()
            .overlayPreferenceValue(ContextualActionMenuTriggerAnchorKey.self) { anchors in
                GeometryReader { proxy in
                    if let anchor = anchors[triggerID] {
                        ContextualActionMenuOverlay(
                            isPresented: $isPresented,
                            actions: actions,
                            configuration: configuration,
                            triggerFrame: proxy[anchor],
                            containerSize: proxy.size,
                            safeAreaInsets: proxy.safeAreaInsets
                        )
                    }
                }
            }
    }
}

private struct ContextualActionMenuOverlay: View {
    @Binding var isPresented: Bool
    let actions: [ContextualActionMenuAction]
    let configuration: ContextualActionMenuConfiguration
    let triggerFrame: CGRect
    let containerSize: CGSize
    let safeAreaInsets: EdgeInsets
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @AccessibilityFocusState private var focusedActionID: String?
    @State private var actionsAreRevealed = false

    private var requiredHeight: CGFloat {
        (CGFloat(actions.count) * configuration.minimumActionHeight)
            + (CGFloat(max(0, actions.count - 1)) * configuration.actionSpacing)
            + (CGFloat(actionGroupBreakCount) * configuration.actionGroupSpacing)
    }

    private var actionGroupBreakCount: Int {
        ContextualActionMenuLayout.groupBreakCount(actions.map(\.groupID))
    }

    private var direction: ContextualActionMenuDirection {
        ContextualActionMenuLayout.resolvedDirection(
            preferred: configuration.direction,
            triggerFrame: triggerFrame,
            containerHeight: containerSize.height,
            safeAreaTop: safeAreaInsets.top,
            safeAreaBottom: safeAreaInsets.bottom,
            edgePadding: configuration.edgePadding,
            triggerSpacing: configuration.triggerSpacing,
            requiredHeight: requiredHeight
        )
    }

    private var menuViewport: CGRect {
        ContextualActionMenuLayout.viewport(
            direction: direction,
            alignment: configuration.alignment,
            triggerFrame: triggerFrame,
            containerSize: containerSize,
            safeAreaInsets: safeAreaInsets,
            edgePadding: configuration.edgePadding,
            triggerSpacing: configuration.triggerSpacing
        )
    }

    var body: some View {
        ZStack {
            backdrop
            actionViewport
        }
        .frame(width: containerSize.width, height: containerSize.height)
        .allowsHitTesting(isPresented)
        .accessibilityHidden(!isPresented)
        .accessibilityElement(children: .contain)
        .accessibilityAddTraits(.isModal)
        .accessibilityAction(.escape, dismiss)
        .onChange(of: isPresented, initial: true) { _, presented in
            guard presented else {
                actionsAreRevealed = false
                focusedActionID = nil
                return
            }
            actionsAreRevealed = false
            Task { @MainActor in
                await Task.yield()
                guard isPresented else { return }
                actionsAreRevealed = true
                focusedActionID = actions.first(where: \.isEnabled)?.id
            }
        }
    }

    private var backdrop: some View {
        ZStack {
            // Two semantic overlay passes retain the exported overlay colour while
            // giving action menus stronger separation than passive page dimming.
            ForEach(
                Array(ContextualActionMenuAppearance.backdropPassOpacities.enumerated()),
                id: \.offset
            ) { _, passOpacity in
                ContextualActionMenuBackdropShape(
                    hole: triggerFrame.offsetBy(
                        dx: -fullScreenBounds.minX,
                        dy: -fullScreenBounds.minY
                    ),
                    cornerRadius: configuration.triggerHoleRadius
                )
                .fill(EQColor.overlay, style: FillStyle(eoFill: true))
                .opacity(isPresented ? passOpacity : 0)
                .frame(width: fullScreenBounds.width, height: fullScreenBounds.height)
                .position(x: fullScreenBounds.midX, y: fullScreenBounds.midY)
            }

            dismissRegions
        }
        .animation(
            .easeOut(duration: reduceMotion ? EQMotion.reducedContentTransitionDuration : configuration.motion.backdropDuration),
            value: isPresented
        )
        .accessibilityHidden(true)
    }

    private var fullScreenBounds: CGRect {
        CGRect(
            x: -safeAreaInsets.leading,
            y: -safeAreaInsets.top,
            width: containerSize.width + safeAreaInsets.leading + safeAreaInsets.trailing,
            height: containerSize.height + safeAreaInsets.top + safeAreaInsets.bottom
        )
    }

    @ViewBuilder private var actionViewport: some View {
        if requiredHeight > menuViewport.height {
            ScrollView(.vertical) {
                actionStack
                    .frame(maxWidth: .infinity, alignment: horizontalAlignment)
            }
            .defaultScrollAnchor(direction == .upward ? .bottom : .top)
            .scrollIndicators(.hidden)
            .scrollBounceBehavior(.basedOnSize)
            .frame(width: menuViewport.width, height: menuViewport.height)
            .position(x: menuViewport.midX, y: menuViewport.midY)
        } else {
            actionStack
                .frame(
                    width: menuViewport.width,
                    height: requiredHeight,
                    alignment: horizontalAlignment
                )
                .position(
                    x: menuViewport.midX,
                    y: direction == .upward
                        ? menuViewport.maxY - (requiredHeight / 2)
                        : menuViewport.minY + (requiredHeight / 2)
                )
        }
    }

    private var actionStack: some View {
        VStack(alignment: stackAlignment, spacing: configuration.actionSpacing) {
            ForEach(Array(actions.enumerated()), id: \.element.id) { index, action in
                actionButton(action, index: index)
                    .padding(.top, beginsNewGroup(at: index) ? configuration.actionGroupSpacing : 0)
            }
        }
    }

    private func beginsNewGroup(at index: Int) -> Bool {
        index > 0 && actions[index - 1].groupID != actions[index].groupID
    }

    private func actionButton(_ action: ContextualActionMenuAction, index: Int) -> some View {
        let rank = actionsAreRevealed
            ? ContextualActionMenuAnimationOrder.revealRank(for: index, count: actions.count, direction: direction)
            : ContextualActionMenuAnimationOrder.dismissalRank(for: index, count: actions.count, direction: direction)
        let animation = reduceMotion
            ? EQMotion.reducedContentTransition
            : configuration.motion.actionAnimation(
                isPresented: actionsAreRevealed,
                delay: TimeInterval(rank) * configuration.motion.stagger
            )

        return Button(role: action.role.buttonRole) {
            guard isPresented, action.isEnabled else { return }
            SystemHapticsClient().perform(.selection)
            isPresented = false
            action.action()
        } label: {
            Text(action.title)
                .eqTextStyle(EQTypography.headingCard)
                .multilineTextAlignment(textAlignment)
                .fixedSize(horizontal: false, vertical: true)
                .frame(minHeight: configuration.minimumActionHeight)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(!action.isEnabled)
        .foregroundStyle(action.isEnabled ? EQColor.contentPrimary : EQColor.contentSecondary)
        .opacity(actionsAreRevealed ? 1 : 0)
        .offset(y: reduceMotion || actionsAreRevealed ? 0 : hiddenTranslation)
        .animation(animation, value: actionsAreRevealed)
        .accessibilityHint(action.accessibilityHint ?? "")
        .accessibilityFocused($focusedActionID, equals: action.id)
    }

    private var hiddenTranslation: CGFloat {
        direction == .upward ? configuration.motion.translation : -configuration.motion.translation
    }

    private var horizontalAlignment: Alignment {
        configuration.alignment == .trailing ? .trailing : .leading
    }

    private var stackAlignment: HorizontalAlignment {
        configuration.alignment == .trailing ? .trailing : .leading
    }

    private var textAlignment: TextAlignment {
        configuration.alignment == .trailing ? .trailing : .leading
    }

    private var dismissRegions: some View {
        let frame = triggerFrame.intersection(CGRect(origin: .zero, size: containerSize))
        return ZStack {
            dismissRegion(CGRect(x: 0, y: 0, width: containerSize.width, height: max(0, frame.minY)))
            dismissRegion(CGRect(x: 0, y: frame.maxY, width: containerSize.width, height: max(0, containerSize.height - frame.maxY)))
            dismissRegion(CGRect(x: 0, y: frame.minY, width: max(0, frame.minX), height: max(0, frame.height)))
            dismissRegion(CGRect(x: frame.maxX, y: frame.minY, width: max(0, containerSize.width - frame.maxX), height: max(0, frame.height)))
        }
    }

    @ViewBuilder private func dismissRegion(_ frame: CGRect) -> some View {
        if frame.width > 0, frame.height > 0 {
            Color.clear
                .contentShape(Rectangle())
                .frame(width: frame.width, height: frame.height)
                .position(x: frame.midX, y: frame.midY)
                .onTapGesture(perform: dismiss)
        }
    }

    private func dismiss() {
        guard isPresented else { return }
        isPresented = false
    }
}

private struct ContextualActionMenuBackdropShape: Shape {
    let hole: CGRect
    let cornerRadius: CGFloat

    func path(in rect: CGRect) -> Path {
        var path = Path(rect)
        path.addRoundedRect(
            in: hole.intersection(rect),
            cornerSize: CGSize(width: cornerRadius, height: cornerRadius)
        )
        return path
    }
}

#if DEBUG
private struct ContextualActionMenuPreview: View {
    @State private var isPresented = true
    let direction: ContextualActionMenuDirection

    var body: some View {
        ContextualActionMenu(
            isPresented: $isPresented,
            actions: [
                .init(id: "first", title: "First action") {},
                .init(id: "second", title: "Second action") {},
                .init(id: "delete", title: "Delete", role: .destructive) {}
            ],
            configuration: .init(direction: direction)
        ) {
            VStack {
                if direction == .downward {
                    trigger
                    Spacer()
                } else {
                    Spacer()
                    trigger
                }
            }
            .padding(EQSpacing.lg)
            .background(EQColor.background)
        }
    }

    private var trigger: some View {
        HStack {
            Spacer()
            ContextualActionMenuTrigger(
                isPresented: isPresented,
                accessibilityLabel: "Actions",
                toggle: { isPresented.toggle() }
            ) {
                Image(systemName: "plus")
                    .frame(width: 56, height: 56)
                    .foregroundStyle(EQColor.contentOnAccent)
                    .background(EQColor.accent, in: RoundedRectangle(cornerRadius: EQRadius.button))
            }
        }
    }
}

#Preview("Upward contextual menu") {
    ContextualActionMenuPreview(direction: .upward)
}

#Preview("Downward contextual menu") {
    ContextualActionMenuPreview(direction: .downward)
}
#endif
