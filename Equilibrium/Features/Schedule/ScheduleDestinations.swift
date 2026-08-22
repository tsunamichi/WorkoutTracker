import SwiftUI

struct AddWorkoutSheet: View {
    let day: LocalDay
    @Environment(\.dismiss) private var dismiss
    private let options = [("Existing Workout", "rectangle.stack"), ("Recent Workout", "clock.arrow.circlepath"), ("Blank Workout", "plus.square"), ("Import Plan", "doc.on.clipboard")]
    var body: some View {
        NavigationStack {
            List(options, id: \.0) { option in
                Button { } label: { Label(option.0, systemImage: option.1).frame(minHeight: 44) }
                    .accessibilityHint("Available in a later phase")
            }
            .scrollContentBackground(.hidden).background(EQColor.canvas)
            .navigationTitle("Add Workout")
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
            .safeAreaInset(edge: .bottom) { Text("For \(day.iso8601) · Workflows arrive in Phase 3").font(.caption).foregroundStyle(EQColor.secondaryText).padding() }
        }.presentationDetents([.medium, .large]).preferredColorScheme(.dark)
    }
}

struct SettingsShellView: View {
    var body: some View {
        List {
            Section { NavigationLink("Units") { UnitsSettingView() }; NavigationLink("Timer") { PlaceholderSetting(title: "Timer") }; NavigationLink("Progression") { PlaceholderSetting(title: "Progression") } }
            Section { NavigationLink("Account / Cloud Backup") { PlaceholderSetting(title: "Account / Cloud Backup") } }
        }.scrollContentBackground(.hidden).background(EQColor.canvas).navigationTitle("Settings").preferredColorScheme(.dark)
    }
}

private struct UnitsSettingView: View {
    @AppStorage(EQPreferenceKey.weightUnit) private var unitRaw = WeightUnit.pounds.rawValue
    var body: some View {
        Form {
            Picker("Weight unit", selection: $unitRaw) {
                Text("Pounds (lb)").tag(WeightUnit.pounds.rawValue)
                Text("Kilograms (kg)").tag(WeightUnit.kilograms.rawValue)
            }
            .pickerStyle(.inline)
            Section { Text("Workout entries use this unit. Canonical weight remains stored in pounds.").font(EQTypography.caption).foregroundStyle(EQColor.secondaryText) }
        }
        .scrollContentBackground(.hidden).background(EQColor.canvas).navigationTitle("Units").preferredColorScheme(.dark)
    }
}

private struct PlaceholderSetting: View {
    let title: String
    var body: some View { ContentUnavailableView(title, systemImage: "hammer", description: Text("This setting arrives in a later phase.")) }
}

struct HistoryShellView: View {
    let workouts: [ScheduledWorkout]
    var body: some View {
        List(workouts.filter { $0.status == .completed }.sorted { $0.day > $1.day }) { workout in
            VStack(alignment: .leading) { Text(workout.titleSnapshot); Text(workout.day.iso8601).font(.caption).foregroundStyle(.secondary) }
        }
        .overlay { if !workouts.contains(where: { $0.status == .completed }) { ContentUnavailableView("No completed workouts", systemImage: "clock.arrow.circlepath") } }
        .scrollContentBackground(.hidden).background(EQColor.canvas).navigationTitle("Workout History").preferredColorScheme(.dark)
    }
}
