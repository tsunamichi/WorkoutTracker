import SwiftUI
import UIKit

/// Native wheel-picker configuration expressed in the timer domain's canonical
/// seconds. Keeping the range and increment here lets every duration surface
/// share the same selection rules without coupling the picker to persistence.
struct DurationPickerConfiguration: Equatable {
    let range: ClosedRange<TimeInterval>
    let step: TimeInterval
    let showsHours: Bool

    init(
        range: ClosedRange<TimeInterval>,
        step: TimeInterval,
        showsHours: Bool? = nil
    ) {
        self.range = range
        self.step = step
        self.showsHours = showsHours ?? (range.upperBound >= 3_600)
    }

    static let restDuration = Self(range: 15...300, step: 5)

    func snapped(_ value: TimeInterval) -> TimeInterval {
        let stepped = (value / step).rounded() * step
        return min(max(stepped, range.lowerBound), range.upperBound)
    }

    func components(for value: TimeInterval) -> DurationPickerComponents {
        let total = Int(snapped(value).rounded())
        return .init(
            hours: total / 3_600,
            minutes: (total % 3_600) / 60,
            seconds: total % 60
        )
    }

    func duration(hours: Int, minutes: Int, seconds: Int) -> TimeInterval? {
        guard hours >= 0, (0..<60).contains(minutes), (0..<60).contains(seconds) else {
            return nil
        }
        let value = TimeInterval((hours * 3_600) + (minutes * 60) + seconds)
        guard range.contains(value), value.truncatingRemainder(dividingBy: step) == 0 else {
            return nil
        }
        return value
    }

    func hourValues(forMinutes minutes: Int, seconds: Int) -> [Int] {
        guard showsHours else { return [0] }
        return Array(0...(Int(range.upperBound) / 3_600)).filter {
            duration(hours: $0, minutes: minutes, seconds: seconds) != nil
        }
    }

    func minuteValues(hours: Int, seconds: Int) -> [Int] {
        let maximum = showsHours ? 59 : Int(range.upperBound) / 60
        return Array(0...maximum).filter {
            duration(hours: hours, minutes: $0, seconds: seconds) != nil
        }
    }

    func secondValues(hours: Int, minutes: Int) -> [Int] {
        stride(from: 0, through: 59, by: Int(step)).filter {
            duration(hours: hours, minutes: minutes, seconds: $0) != nil
        }
    }
}

struct DurationPickerComponents: Equatable {
    let hours: Int
    let minutes: Int
    let seconds: Int
}

/// A compact, native iOS wheel picker for a canonical duration in seconds.
/// It intentionally uses SwiftUI's wheel Picker rather than a custom drag
/// gesture, preserving native momentum, VoiceOver, and selection behavior.
struct DurationPicker: View {
    @Binding private var seconds: TimeInterval
    private let configuration: DurationPickerConfiguration
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    init(seconds: Binding<TimeInterval>, configuration: DurationPickerConfiguration) {
        _seconds = seconds
        self.configuration = configuration
    }

    var body: some View {
        let selection = configuration.components(for: seconds)
        let hourValues = configuration.hourValues(
            forMinutes: selection.minutes,
            seconds: selection.seconds
        )
        let minuteValues = configuration.minuteValues(
            hours: selection.hours,
            seconds: selection.seconds
        )
        let secondValues = configuration.secondValues(
            hours: selection.hours,
            minutes: selection.minutes
        )

        HStack(spacing: EQSpacing.sm) {
            if configuration.showsHours {
                wheel(
                    values: hourValues,
                    selection: Binding(
                        get: { selection.hours },
                        set: { update(hours: $0, minutes: selection.minutes, seconds: selection.seconds) }
                    ),
                    unit: "hr",
                    accessibilityLabel: "Hours"
                )
            }

            wheel(
                values: minuteValues,
                selection: Binding(
                    get: { selection.minutes },
                    set: { update(hours: selection.hours, minutes: $0, seconds: selection.seconds) }
                ),
                unit: "min",
                accessibilityLabel: "Minutes"
            )

            wheel(
                values: secondValues,
                selection: Binding(
                    get: { selection.seconds },
                    set: { update(hours: selection.hours, minutes: selection.minutes, seconds: $0) }
                ),
                unit: "sec",
                accessibilityLabel: "Seconds",
                usesTwoDigits: true
            )
        }
        .frame(maxWidth: .infinity)
        // Five display rows retain native wheel context while leaving room for
        // the page action in the wallet-bound Settings presentation.
        .frame(
            height: dynamicTypeSize.isAccessibilitySize
                ? EQGeneratedTypography.displayValue.lineHeight * 5.5
                : EQGeneratedTypography.displayValue.lineHeight * 5
        )
        .clipped()
        .foregroundStyle(EQColor.Execution.foregroundText)
        .tint(EQColor.Execution.foregroundText)
        .accessibilityElement(children: .contain)
    }

    private func wheel(
        values: [Int],
        selection: Binding<Int>,
        unit: String,
        accessibilityLabel: String,
        usesTwoDigits: Bool = false
    ) -> some View {
        HStack(spacing: EQSpacing.xxs) {
            NativeDurationWheel(
                values: values,
                selection: selection,
                usesTwoDigits: usesTwoDigits,
                accessibilityLabel: accessibilityLabel
            )
            .frame(minWidth: 96, maxWidth: 120)

            Text(unit)
                .eqTextStyle(.secondaryBody)
                .foregroundStyle(EQColor.Execution.foregroundText)
                .accessibilityHidden(true)
        }
        .frame(maxWidth: .infinity)
    }

    private func update(hours: Int, minutes: Int, seconds: Int) {
        guard let duration = configuration.duration(
            hours: hours,
            minutes: minutes,
            seconds: seconds
        ) else {
            return
        }
        self.seconds = duration
    }
}

private struct NativeDurationWheel: UIViewRepresentable {
    let values: [Int]
    @Binding var selection: Int
    let usesTwoDigits: Bool
    let accessibilityLabel: String

    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }

    func makeUIView(context: Context) -> WheelContainer {
        let container = WheelContainer()
        container.picker.delegate = context.coordinator
        container.picker.dataSource = context.coordinator
        container.picker.accessibilityLabel = accessibilityLabel
        return container
    }

    func updateUIView(_ container: WheelContainer, context: Context) {
        context.coordinator.parent = self
        container.picker.accessibilityLabel = accessibilityLabel
        let selectedRow = values.firstIndex(of: selection) ?? 0
        if container.picker.selectedRow(inComponent: 0) != selectedRow {
            // A programmatic duration change can arrive inside the Settings
            // transition transaction (for example, “Use workout default”).
            // Let the native wheel carry that motion instead of snapping, while
            // a Reduce Motion transaction continues to update immediately.
            let animatesSelection = context.transaction.animation != nil
                && !context.transaction.disablesAnimations
            if animatesSelection {
                CATransaction.begin()
                CATransaction.setAnimationDuration(0.18)
                CATransaction.setAnimationTimingFunction(
                    CAMediaTimingFunction(name: .easeOut)
                )
                container.picker.selectRow(selectedRow, inComponent: 0, animated: true)
                CATransaction.commit()
            } else {
                container.picker.selectRow(selectedRow, inComponent: 0, animated: false)
            }
        }
        if context.transaction.animation == nil || context.transaction.disablesAnimations {
            container.picker.reloadAllComponents()
        }
    }

    final class Coordinator: NSObject, UIPickerViewDataSource, UIPickerViewDelegate {
        var parent: NativeDurationWheel

        init(_ parent: NativeDurationWheel) {
            self.parent = parent
        }

        func numberOfComponents(in _: UIPickerView) -> Int { 1 }

        func pickerView(_: UIPickerView, numberOfRowsInComponent _: Int) -> Int {
            parent.values.count
        }

        func pickerView(_ pickerView: UIPickerView, rowHeightForComponent _: Int) -> CGFloat {
            EQGeneratedTypography.displayValue.lineHeight
        }

        func pickerView(_ pickerView: UIPickerView, viewForRow row: Int, forComponent _: Int, reusing view: UIView?) -> UIView {
            let label = (view as? UILabel) ?? UILabel()
            let value = parent.values[row]
            let isSelected = row == pickerView.selectedRow(inComponent: 0)
            label.text = parent.usesTwoDigits ? String(format: "%02d", value) : String(value)
            label.textAlignment = .center
            // Match the in-progress card values exactly: the display-value
            // token uses SF Pro Display at 72 pt, regular weight.
            label.font = .systemFont(
                ofSize: EQGeneratedTypography.displayValue.size,
                weight: .regular
            )
            label.textColor = UIColor(EQColor.Execution.foregroundText).withAlphaComponent(isSelected ? 1 : 0.42)
            label.adjustsFontForContentSizeCategory = true
            label.accessibilityElementsHidden = true
            return label
        }

        func pickerView(_ pickerView: UIPickerView, didSelectRow row: Int, inComponent _: Int) {
            guard parent.values.indices.contains(row) else { return }
            parent.selection = parent.values[row]
            pickerView.reloadAllComponents()
        }
    }
}

private final class WheelContainer: UIView {
    let picker = TransparentSelectionPickerView()

    override init(frame: CGRect) {
        super.init(frame: frame)
        backgroundColor = .clear
        picker.backgroundColor = .clear
        addSubview(picker)
    }

    required init?(coder: NSCoder) {
        nil
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        picker.frame = bounds
    }
}

/// UIKit installs its selected-row material during `UIPickerView`'s own layout
/// pass. Clearing it here leaves the native wheel interaction intact while the
/// Equilibrium picker uses selected-value typography alone.
private final class TransparentSelectionPickerView: UIPickerView {
    override func layoutSubviews() {
        super.layoutSubviews()

        let centerY = bounds.midY
        for subview in subviews {
            let frame = subview.frame
            guard frame.minY <= centerY,
                  frame.maxY >= centerY,
                  frame.width >= bounds.width * 0.75,
                  frame.height <= EQGeneratedTypography.displayValue.lineHeight + 12
            else {
                continue
            }

            subview.backgroundColor = .clear
            subview.layer.backgroundColor = UIColor.clear.cgColor
        }
    }
}
