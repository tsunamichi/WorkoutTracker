import SwiftUI
import UIKit

/// Themed replacement for the system number pad. The system keyboard can only be
/// light or dark, so metric inputs install this as their `inputView` instead.
enum EQNumberPadKey: Hashable {
    case digit(Int)
    case decimal
    case delete
}

enum EQNumberPadLayout {
    static let keyHeight: CGFloat = 52
    static let spacing: CGFloat = 8
    static let inset: CGFloat = 8

    static var keysHeight: CGFloat {
        (keyHeight * 4) + (spacing * 3) + (inset * 2)
    }

    static func rows(allowsDecimal: Bool) -> [[EQNumberPadKey?]] {
        [
            [.digit(1), .digit(2), .digit(3)],
            [.digit(4), .digit(5), .digit(6)],
            [.digit(7), .digit(8), .digit(9)],
            [allowsDecimal ? .decimal : nil, .digit(0), .delete],
        ]
    }
}

enum EQNumberPadEditing {
    /// Whether a decimal point can be typed given the current text and the text it would replace.
    static func acceptsDecimal(text: String, replacing selected: String) -> Bool {
        !text.contains(".") || selected.contains(".")
    }
}

struct EQNumberPad: View {
    let allowsDecimal: Bool
    let press: (EQNumberPadKey) -> Void

    var body: some View {
        VStack(spacing: EQNumberPadLayout.spacing) {
            ForEach(Array(EQNumberPadLayout.rows(allowsDecimal: allowsDecimal).enumerated()), id: \.offset) { _, row in
                HStack(spacing: EQNumberPadLayout.spacing) {
                    ForEach(Array(row.enumerated()), id: \.offset) { _, key in
                        if let key {
                            Button { press(key) } label: { label(for: key) }
                                .buttonStyle(EQNumberPadKeyStyle(isFilled: key != .delete))
                                .accessibilityLabel(accessibilityLabel(for: key))
                        } else {
                            Color.clear.frame(maxWidth: .infinity, maxHeight: .infinity)
                        }
                    }
                }
                .frame(height: EQNumberPadLayout.keyHeight)
            }
        }
        .padding(EQNumberPadLayout.inset)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .background(EQColor.Execution.canvas.ignoresSafeArea())
    }

    @ViewBuilder private func label(for key: EQNumberPadKey) -> some View {
        switch key {
        case .digit(let value): Text("\(value)").font(.system(size: 28)).monospacedDigit()
        case .decimal: Text(".").font(.system(size: 28))
        case .delete: Image(systemName: "delete.left").font(.system(size: 22))
        }
    }

    private func accessibilityLabel(for key: EQNumberPadKey) -> String {
        switch key {
        case .digit(let value): "\(value)"
        case .decimal: "Decimal point"
        case .delete: "Delete"
        }
    }
}

private struct EQNumberPadKeyStyle: ButtonStyle {
    let isFilled: Bool

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .foregroundStyle(EQColor.Execution.primaryText)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background {
                RoundedRectangle(cornerRadius: EQRadius.control, style: .continuous)
                    .fill(EQColor.Execution.primaryText.opacity(
                        configuration.isPressed ? 0.24 : (isFilled ? 0.1 : 0)
                    ))
            }
            .contentShape(Rectangle())
    }
}

/// UIKit host so the pad can act as a text field's `inputView` with key clicks.
final class EQNumberPadInputView: UIView, UIInputViewAudioFeedback {
    private weak var field: UITextField?
    private let height: CGFloat
    private let feedback = UIImpactFeedbackGenerator(style: .light)

    var enableInputClicksWhenVisible: Bool { true }

    init(field: UITextField, allowsDecimal: Bool) {
        self.field = field
        // Without these, UIKit reserves room for the predictive/shortcut bar above the pad.
        field.autocorrectionType = .no
        field.spellCheckingType = .no
        field.inputAssistantItem.leadingBarButtonGroups = []
        field.inputAssistantItem.trailingBarButtonGroups = []
        height = EQNumberPadLayout.keysHeight + (field.window?.safeAreaInsets.bottom ?? 0)
        super.init(frame: CGRect(x: 0, y: 0, width: field.window?.bounds.width ?? 0, height: height))
        autoresizingMask = [.flexibleWidth, .flexibleHeight]
        backgroundColor = UIColor(EQColor.Execution.canvas)
        let host = UIHostingController(rootView: EQNumberPad(allowsDecimal: allowsDecimal) { [weak self] key in
            self?.press(key)
        })
        host.view.backgroundColor = .clear
        host.view.translatesAutoresizingMaskIntoConstraints = false
        addSubview(host.view)
        NSLayoutConstraint.activate([
            host.view.leadingAnchor.constraint(equalTo: leadingAnchor),
            host.view.trailingAnchor.constraint(equalTo: trailingAnchor),
            host.view.topAnchor.constraint(equalTo: topAnchor),
            host.view.heightAnchor.constraint(equalToConstant: EQNumberPadLayout.keysHeight),
        ])
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func didMoveToWindow() {
        super.didMoveToWindow()
        hideSystemBackdrop()
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        hideSystemBackdrop()
    }

    /// The keyboard container can add its glass backdrop behind custom input views, extending
    /// above the pad as a dark strip. The pad paints its own background, so hide it.
    private func hideSystemBackdrop() {
        func isBackdrop(_ view: UIView) -> Bool { String(describing: type(of: view)).contains("Backdrop") }
        for sibling in superview?.subviews ?? [] where sibling !== self {
            if isBackdrop(sibling) || sibling.subviews.contains(where: isBackdrop) {
                sibling.isHidden = true
            }
        }
    }

    override var intrinsicContentSize: CGSize {
        CGSize(width: UIView.noIntrinsicMetric, height: height)
    }

    private func press(_ key: EQNumberPadKey) {
        guard let field else { return }
        UIDevice.current.playInputClick()
        feedback.impactOccurred()
        switch key {
        case .digit(let value):
            field.insertText("\(value)")
        case .decimal:
            let selected = field.selectedTextRange.flatMap { field.text(in: $0) } ?? ""
            guard EQNumberPadEditing.acceptsDecimal(text: field.text ?? "", replacing: selected) else { return }
            field.insertText(".")
        case .delete:
            field.deleteBackward()
        }
    }
}

/// Attaches `EQNumberPadInputView` to the UITextField backing a SwiftUI `TextField`
/// before it becomes first responder, so the keyboard presents (and animates) once.
struct EQNumberPadInstaller: UIViewRepresentable {
    let allowsDecimal: Bool

    func makeUIView(context: Context) -> ProbeView {
        let view = ProbeView()
        view.isUserInteractionEnabled = false
        view.backgroundColor = .clear
        view.allowsDecimal = allowsDecimal
        return view
    }

    func updateUIView(_ uiView: ProbeView, context: Context) {
        uiView.allowsDecimal = allowsDecimal
        uiView.setNeedsLayout()
    }

    final class ProbeView: UIView {
        var allowsDecimal = false
        private var pendingRetries = 0

        override func didMoveToWindow() {
            super.didMoveToWindow()
            pendingRetries = 0
            setNeedsLayout()
        }

        override func layoutSubviews() {
            super.layoutSubviews()
            install()
        }

        private func install() {
            guard window != nil else { return }
            guard let field = nearestField() else {
                // SwiftUI can attach the text field after this view; look again next run loop.
                guard pendingRetries < 5 else { return }
                pendingRetries += 1
                DispatchQueue.main.async { [weak self] in self?.install() }
                return
            }
            guard !(field.inputView is EQNumberPadInputView) else { return }
            field.inputView = EQNumberPadInputView(field: field, allowsDecimal: allowsDecimal)
            if field.isFirstResponder { field.reloadInputViews() }
        }

        private func nearestField() -> UITextField? { Self.nearestField(to: self) }

        /// The text field sharing the closest ancestor with the view, preferring the one under its center.
        static func nearestField(to probe: UIView) -> UITextField? {
            let center = probe.convert(CGPoint(x: probe.bounds.midX, y: probe.bounds.midY), to: nil)
            var ancestor = probe.superview
            while let container = ancestor {
                var fields: [UITextField] = []
                collectFields(in: container, excluding: probe, into: &fields)
                if !fields.isEmpty {
                    return fields.min { lhs, rhs in
                        distance(from: center, to: lhs) < distance(from: center, to: rhs)
                    }
                }
                ancestor = container.superview
            }
            return nil
        }

        private static func collectFields(in root: UIView, excluding probe: UIView, into fields: inout [UITextField]) {
            for subview in root.subviews where subview !== probe {
                if let field = subview as? UITextField {
                    fields.append(field)
                } else {
                    collectFields(in: subview, excluding: probe, into: &fields)
                }
            }
        }

        private static func distance(from point: CGPoint, to field: UITextField) -> CGFloat {
            let frame = field.convert(field.bounds, to: nil)
            let dx = max(frame.minX - point.x, 0, point.x - frame.maxX)
            let dy = max(frame.minY - point.y, 0, point.y - frame.maxY)
            return hypot(dx, dy)
        }
    }
}

/// Captures touches over a metric row: a tap focuses its text field, and a press-and-hold
/// reports holding until the finger lifts, without opening the keyboard.
struct EQHoldSurface: UIViewRepresentable {
    @Binding var isHolding: Bool

    func makeCoordinator() -> Coordinator { Coordinator(isHolding: $isHolding) }

    func makeUIView(context: Context) -> UIView {
        let view = UIView()
        view.backgroundColor = .clear
        let tap = UITapGestureRecognizer(target: context.coordinator, action: #selector(Coordinator.tapped(_:)))
        let hold = UILongPressGestureRecognizer(target: context.coordinator, action: #selector(Coordinator.held(_:)))
        hold.minimumPressDuration = 0.35
        tap.require(toFail: hold)
        view.addGestureRecognizer(tap)
        view.addGestureRecognizer(hold)
        return view
    }

    func updateUIView(_ uiView: UIView, context: Context) {
        context.coordinator.isHolding = $isHolding
    }

    final class Coordinator: NSObject {
        var isHolding: Binding<Bool>
        private let feedback = UIImpactFeedbackGenerator(style: .light)
        init(isHolding: Binding<Bool>) { self.isHolding = isHolding }

        @objc func tapped(_ recognizer: UITapGestureRecognizer) {
            guard let view = recognizer.view else { return }
            EQNumberPadInstaller.ProbeView.nearestField(to: view)?.becomeFirstResponder()
        }

        @objc func held(_ recognizer: UILongPressGestureRecognizer) {
            switch recognizer.state {
            case .began:
                feedback.impactOccurred()
                isHolding.wrappedValue = true
            case .ended, .cancelled, .failed:
                isHolding.wrappedValue = false
            default: break
            }
        }
    }
}
