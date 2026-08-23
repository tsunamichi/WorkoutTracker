import SwiftUI

struct SettingsShellView: View {
    let settingsRepository: any SettingsRepository
    let progressionRepository: any ProgressionRepository
    let exerciseRepository: any ExerciseRepository
    var body: some View {
        List {
            Section {
                NavigationLink("Units") { UnitsSettingView(repository: settingsRepository) }
                NavigationLink("Timer") { TimerSettingView(repository: settingsRepository) }
                NavigationLink("Progression") { ProgressionSettingView(repository: progressionRepository, settings: settingsRepository, exercises: exerciseRepository) }
            }
            Section { NavigationLink("Account / Cloud Backup") { ContentUnavailableView("Account / Cloud Backup", systemImage: "hammer", description: Text("This setting arrives in a later phase.")) } }
        }.scrollContentBackground(.hidden).background(EQColor.canvas).navigationTitle("Settings").preferredColorScheme(.dark)
    }
}

private struct UnitsSettingView: View {
    let repository: any SettingsRepository
    @State private var unit = WeightUnit.pounds
    var body: some View {
        Form {
            Picker("Weight unit", selection: $unit) { Text("Pounds (lb)").tag(WeightUnit.pounds); Text("Kilograms (kg)").tag(WeightUnit.kilograms) }.pickerStyle(.inline)
            Section { Text("Workout entries and progression increments use this unit for presentation. Canonical weight remains pounds.").font(EQTypography.caption).foregroundStyle(EQColor.secondaryText) }
        }.scrollContentBackground(.hidden).background(EQColor.canvas).navigationTitle("Units")
            .task { if let settings = try? await repository.settings() { unit = settings.weightUnit } }
            .onChange(of: unit) { _, value in Task { if var settings = try? await repository.settings() { settings.weightUnit = value; try? await repository.saveSettings(settings) } } }
    }
}

private struct TimerSettingView: View {
    let repository: any SettingsRepository
    @State private var seconds: Double = 90
    private var text: String { String(format: "%d:%02d", Int(seconds) / 60, Int(seconds) % 60) }
    var body: some View {
        Form {
            Section("Default rest duration") {
                Text(text).font(EQTypography.metric).monospacedDigit().accessibilityLabel("Default rest duration, \(text)")
                Slider(value: $seconds, in: 15...300, step: 5).accessibilityValue(text)
                Button("Save") { Task { if var settings = try? await repository.settings() { settings.defaultRestDuration = seconds; try? await repository.saveSettings(settings) } } }
            }
            Section { Text("Exercise-specific rest duration wins. Changing this setting does not rewrite workouts or restart an active countdown.").font(EQTypography.caption).foregroundStyle(EQColor.secondaryText) }
        }.scrollContentBackground(.hidden).background(EQColor.canvas).navigationTitle("Timer")
            .task { if let value = try? await repository.settings().defaultRestDuration { seconds = value } }
    }
}

@MainActor private final class ProgressionSettingsModel: ObservableObject {
    @Published var configuration = FixtureDefaults.progression
    @Published var exercises: [ExerciseDefinition] = []
    @Published var unit = WeightUnit.pounds
    @Published var error: String?
    let repository: any ProgressionRepository; let settingsRepository: any SettingsRepository; let exerciseRepository: any ExerciseRepository
    init(repository: any ProgressionRepository, settings: any SettingsRepository, exercises: any ExerciseRepository) { self.repository = repository; settingsRepository = settings; exerciseRepository = exercises }
    func load() async { do { configuration = try await repository.progressionConfiguration(); unit = try await settingsRepository.settings().weightUnit; exercises = try await exerciseRepository.allExercises() } catch { self.error = "Unable to load progression settings." } }
    func save() async { do { try await repository.saveProgressionConfiguration(configuration); error = nil } catch { self.error = "Check repetition ranges, increments, names, and exercise assignments." } }
}

private struct ProgressionSettingView: View {
    @StateObject private var model: ProgressionSettingsModel
    init(repository: any ProgressionRepository, settings: any SettingsRepository, exercises: any ExerciseRepository) { _model = StateObject(wrappedValue: ProgressionSettingsModel(repository: repository, settings: settings, exercises: exercises)) }
    var body: some View {
        Form {
            Section { Toggle("Enable progression", isOn: $model.configuration.isEnabled).onChange(of: model.configuration.isEnabled) { _, _ in Task { await model.save() } } }
            Section("Automatic progression") {
                Text("Assignments use the stable exercise identity and apply anywhere that exercise appears.").font(EQTypography.caption).foregroundStyle(EQColor.secondaryText)
                ForEach(model.exercises) { exercise in
                    Picker(exercise.name, selection: profile(exercise.id)) { ForEach(AutoProgressionProfile.allCases, id: \.self) { Text($0.title).tag($0) } }
                }
            }
            if let error = model.error { Section { Text(error).foregroundStyle(EQColor.warning) } }
        }.scrollContentBackground(.hidden).background(EQColor.canvas).navigationTitle("Progression").task { await model.load() }
    }
    private func profile(_ exerciseID: ExerciseID) -> Binding<AutoProgressionProfile> { .init(get: { model.configuration.assignments[exerciseID] ?? .none }, set: { model.configuration.assign($0, to: exerciseID); Task { await model.save() } }) }
}
