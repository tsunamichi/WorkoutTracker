import SwiftUI

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
            }.pickerStyle(.inline)
            Section { Text("Workout entries use this unit. Canonical weight remains stored in pounds.").font(EQTypography.caption).foregroundStyle(EQColor.secondaryText) }
        }.scrollContentBackground(.hidden).background(EQColor.canvas).navigationTitle("Units").preferredColorScheme(.dark)
    }
}

private struct PlaceholderSetting: View {
    let title: String
    var body: some View { ContentUnavailableView(title, systemImage: "hammer", description: Text("This setting arrives in a later phase.")) }
}
