import SwiftUI
#if DEBUG
import OSLog

private enum ContextualActionMenuDiagnostics {
    static let logger = Logger(
        subsystem: "com.tsunamichi.equilibrium",
        category: "ContextualActionMenu"
    )

    static func record(_ message: String) {
        logger.notice("\(message, privacy: .public)")
    }
}

private func contextualMenuDiagnostic(_ message: String) {
    ContextualActionMenuDiagnostics.record(message)
}
#else
private func contextualMenuDiagnostic(_: String) {}
#endif

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
    var backdropDuration: TimeInterval = 0.16
    var openingDuration: TimeInterval = 0.20
    var closingDuration: TimeInterval = 0.14
    var translation: CGFloat = EQSpacing.xs

    func actionAnimation(isPresented: Bool) -> Animation {
        if isPresented {
            .easeOut(duration: openingDuration)
        } else {
            .easeIn(duration: closingDuration)
        }
    }

    func backdropAnimation(isPresented: Bool) -> Animation {
        isPresented
            ? .easeOut(duration: backdropDuration)
            : .easeIn(duration: backdropDuration)
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
    /// Keeps a presented trigger visually aligned with trailing menu labels when
    /// the originating control belongs to a different visual column.
    var alignsPresentedTriggerWithTrailingActions = false
    var motion = ContextualActionMenuMotion()
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

struct ContextualActionMenu<Content: View, PresentedTrigger: View>: View {
    @Binding var isPresented: Bool
    let actions: [ContextualActionMenuAction]
    var configuration = ContextualActionMenuConfiguration()
    var triggerID: String = ContextualActionMenuAnchor.defaultID
    @ViewBuilder let presentedTrigger: (Bool) -> PresentedTrigger
    @ViewBuilder let content: () -> Content
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var presentedTriggerIsVisible = false
    @State private var presentedTriggerVisibilityGeneration = 0

    init(
        isPresented: Binding<Bool>,
        actions: [ContextualActionMenuAction],
        configuration: ContextualActionMenuConfiguration = ContextualActionMenuConfiguration(),
        triggerID: String = ContextualActionMenuAnchor.defaultID,
        @ViewBuilder presentedTrigger: @escaping (Bool) -> PresentedTrigger,
        @ViewBuilder content: @escaping () -> Content
    ) {
        _isPresented = isPresented
        self.actions = actions
        self.configuration = configuration
        self.triggerID = triggerID
        self.presentedTrigger = presentedTrigger
        self.content = content
    }

    var body: some View {
        content()
            .overlayPreferenceValue(ContextualActionMenuTriggerAnchorKey.self) { anchors in
                GeometryReader { proxy in
                    if let anchor = anchors[triggerID] {
                        let presentedTriggerSize = configuration.alignsPresentedTriggerWithTrailingActions
                            ? CGSize(
                                width: configuration.minimumActionHeight,
                                height: configuration.minimumActionHeight
                            )
                            : proxy[anchor].size
                        ZStack {
                            ContextualActionMenuOverlay(
                                isPresented: $isPresented,
                                actions: actions,
                                configuration: configuration,
                                triggerFrame: proxy[anchor],
                                containerSize: proxy.size,
                                safeAreaInsets: proxy.safeAreaInsets
                            )

                            if presentedTriggerIsVisible {
                                Button {
                                    contextualMenuDiagnostic("close button received tap; dismissing menu")
                                    isPresented = false
                                } label: {
                                    presentedTrigger(isPresented)
                                        .frame(
                                            width: presentedTriggerSize.width,
                                            height: presentedTriggerSize.height
                                        )
                                        .contentShape(Rectangle())
                                }
                                .buttonStyle(.plain)
                                .position(
                                    x: configuration.alignsPresentedTriggerWithTrailingActions
                                        ? proxy[anchor].maxX - (presentedTriggerSize.width / 2)
                                        : proxy[anchor].midX,
                                    y: proxy[anchor].midY
                                )
                            }
                        }
                    }
                }
            }
            .onChange(of: isPresented, initial: true) { _, isPresented in
                contextualMenuDiagnostic("presentation changed: \(isPresented ? "shown" : "hidden")")
                updatePresentedTriggerVisibility(for: isPresented)
            }
    }

    private func updatePresentedTriggerVisibility(for isPresented: Bool) {
        presentedTriggerVisibilityGeneration += 1
        let generation = presentedTriggerVisibilityGeneration
        guard !reduceMotion, !isPresented else {
            presentedTriggerIsVisible = isPresented
            return
        }
        Task { @MainActor in
            try? await Task.sleep(nanoseconds: UInt64(configuration.motion.closingDuration * 1_000_000_000))
            guard generation == presentedTriggerVisibilityGeneration, !isPresented else { return }
            presentedTriggerIsVisible = false
        }
    }
}

extension ContextualActionMenu where PresentedTrigger == EmptyView {
    init(
        isPresented: Binding<Bool>,
        actions: [ContextualActionMenuAction],
        configuration: ContextualActionMenuConfiguration = ContextualActionMenuConfiguration(),
        triggerID: String = ContextualActionMenuAnchor.defaultID,
        @ViewBuilder content: @escaping () -> Content
    ) {
        self.init(
            isPresented: isPresented,
            actions: actions,
            configuration: configuration,
            triggerID: triggerID,
            presentedTrigger: { _ in EmptyView() },
            content: content
        )
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
                contextualMenuDiagnostic("overlay hidden")
                actionsAreRevealed = false
                focusedActionID = nil
                return
            }
            contextualMenuDiagnostic(
                "overlay shown: trigger=\(triggerFrame.debugDescription) "
                    + "viewport=\(menuViewport.debugDescription)"
            )
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
                EQColor.overlay
                .opacity(isPresented ? passOpacity : 0)
                .frame(width: fullScreenBounds.width, height: fullScreenBounds.height)
                .position(x: fullScreenBounds.midX, y: fullScreenBounds.midY)
            }

            dismissRegions
        }
        .animation(
            reduceMotion
                ? EQMotion.reducedContentTransition
                : configuration.motion.backdropAnimation(isPresented: isPresented),
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
                actionButton(action)
                    .padding(.top, beginsNewGroup(at: index) ? configuration.actionGroupSpacing : 0)
            }
        }
    }

    private func beginsNewGroup(at index: Int) -> Bool {
        index > 0 && actions[index - 1].groupID != actions[index].groupID
    }

    private func actionButton(_ action: ContextualActionMenuAction) -> some View {
        let animation = reduceMotion
            ? EQMotion.reducedContentTransition
            : configuration.motion.actionAnimation(isPresented: actionsAreRevealed)

        return Button(role: action.role.buttonRole) {
            guard isPresented, action.isEnabled else { return }
            contextualMenuDiagnostic("button received tap: \(action.id)")
            SystemHapticsClient().perform(.selection)
            isPresented = false
            contextualMenuDiagnostic("button dismissed menu: \(action.id)")
            action.action()
            contextualMenuDiagnostic("button action closure returned: \(action.id)")
        } label: {
            Text(action.title)
                .eqTextStyle(EQTypography.headingCard)
                .multilineTextAlignment(textAlignment)
                .fixedSize(horizontal: false, vertical: true)
                .frame(
                    maxWidth: .infinity,
                    minHeight: configuration.minimumActionHeight,
                    alignment: horizontalAlignment
                )
        }
        .buttonStyle(.plain)
        .frame(maxWidth: .infinity, alignment: horizontalAlignment)
        .contentShape(Rectangle())
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
        contextualMenuDiagnostic("backdrop received tap; dismissing menu")
        isPresented = false
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
