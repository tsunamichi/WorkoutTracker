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
            Section("Global defaults") { ProgressionParameterEditor(parameters: $model.configuration.defaults, unit: model.unit); Button("Save defaults") { Task { await model.save() } } }
            Section("Groups") {
                Text("The first matching group in this list wins. Exercise overrides supersede groups.").font(EQTypography.caption).foregroundStyle(EQColor.secondaryText)
                ForEach($model.configuration.groups) { $group in NavigationLink(group.name) { ProgressionGroupEditor(group: $group, exercises: model.exercises, unit: model.unit) { Task { await model.save() } } } }
                .onDelete { model.configuration.groups.remove(atOffsets: $0); Task { await model.save() } }
                Button("Add group") { model.configuration.groups.append(.init(id: .new(), name: "New group", parameters: model.configuration.defaults, exerciseIDs: [])); Task { await model.save() } }
            }
            Section("Exercise overrides") {
                Text("Overrides always supersede group and global rules.").font(EQTypography.caption).foregroundStyle(EQColor.secondaryText)
                ForEach($model.configuration.overrides) { $override in
                    let name = model.exercises.first(where: { $0.id == override.exerciseID })?.name ?? override.exerciseID.rawValue
                    NavigationLink(name) { ProgressionOverrideEditor(value: $override, name: name, unit: model.unit) { Task { await model.save() } } }
                }.onDelete { model.configuration.overrides.remove(atOffsets: $0); Task { await model.save() } }
                Menu("Add override") { ForEach(model.exercises.filter { exercise in !model.configuration.overrides.contains(where: { $0.exerciseID == exercise.id }) }) { exercise in Button(exercise.name) { model.configuration.overrides.append(.init(exerciseID: exercise.id, parameters: model.configuration.defaults)); Task { await model.save() } } } }
            }
            if let error = model.error { Section { Text(error).foregroundStyle(EQColor.warning) } }
        }.scrollContentBackground(.hidden).background(EQColor.canvas).navigationTitle("Progression").task { await model.load() }
    }
}

private struct ProgressionParameterEditor: View {
    @Binding var parameters: ProgressionParameters
    let unit: WeightUnit
    var body: some View {
        Picker("Mode", selection: $parameters.mode) { ForEach(ProgressionMode.allCases, id: \.self) { Text(label($0)).tag($0) } }
        Stepper("Minimum reps: \(parameters.repetitionRange.lowerBound)", value: lower, in: 1...50)
        Stepper("Maximum reps: \(parameters.repetitionRange.upperBound)", value: upper, in: 1...50)
        HStack { Text("Weight increment"); Spacer(); TextField("0", value: increment, format: .number).keyboardType(.decimalPad).multilineTextAlignment(.trailing); Text(unit == .pounds ? "lb" : "kg") }
    }
    private var lower: Binding<Int> { .init(get: { parameters.repetitionRange.lowerBound }, set: { parameters.repetitionRange = $0...max($0, parameters.repetitionRange.upperBound) }) }
    private var upper: Binding<Int> { .init(get: { parameters.repetitionRange.upperBound }, set: { parameters.repetitionRange = min($0, parameters.repetitionRange.lowerBound)...$0 }) }
    private var increment: Binding<Double> { .init(get: { parameters.weightIncrement.value(in: unit) }, set: { parameters.weightIncrement = Weight(max(0, $0), unit: unit) }) }
    private func label(_ mode: ProgressionMode) -> String { switch mode { case .doubleProgression: "Double progression"; case .weightOnly: "Weight only"; case .repetitionsOnly: "Repetitions only"; case .disabled: "Disabled" } }
}

private struct ProgressionGroupEditor: View {
    @Binding var group: ProgressionGroup; let exercises: [ExerciseDefinition]; let unit: WeightUnit; let save: () -> Void
    var body: some View { Form { Section("Name") { TextField("Group name", text: $group.name) }; Section("Rule") { ProgressionParameterEditor(parameters: $group.parameters, unit: unit) }; Section("Exercises") { ForEach(exercises) { exercise in Toggle(exercise.name, isOn: membership(exercise.id)) } }; Button("Save group", action: save) }.navigationTitle("Progression group") }
    private func membership(_ id: ExerciseID) -> Binding<Bool> { .init(get: { group.exerciseIDs.contains(id) }, set: { if $0 { group.exerciseIDs.insert(id) } else { group.exerciseIDs.remove(id) } }) }
}

private struct ProgressionOverrideEditor: View {
    @Binding var value: ExerciseProgressionOverride; let name: String; let unit: WeightUnit; let save: () -> Void
    var body: some View { Form { Section { Text("This rule supersedes all groups and global defaults.").font(EQTypography.caption) }; ProgressionParameterEditor(parameters: $value.parameters, unit: unit); Button("Save override", action: save) }.navigationTitle(name) }
}
