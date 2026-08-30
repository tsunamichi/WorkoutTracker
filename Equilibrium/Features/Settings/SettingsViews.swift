import SwiftUI
import UniformTypeIdentifiers

struct SettingsShellView: View {
    let settingsRepository: any SettingsRepository
    let progressionRepository: any ProgressionRepository
    let exerciseRepository: any ExerciseRepository
    let legacyImporter: RNLegacyImporter?
    var body: some View {
        List {
            Section {
                NavigationLink("Units") { UnitsSettingView(repository: settingsRepository) }
                NavigationLink("Timer") { TimerSettingView(repository: settingsRepository) }
                NavigationLink("Progression") { ProgressionSettingView(repository: progressionRepository, settings: settingsRepository, exercises: exerciseRepository) }
            }
            Section("iCloud Sync") {
                Label("Private iCloud sync", systemImage: "icloud")
                Text("Equilibrium saves locally first and syncs through your Apple account when iCloud is available. Sync is eventual; backups remain a separate recovery tool.")
                    .font(EQTypography.caption).foregroundStyle(EQColor.secondaryText)
            }
            if let legacyImporter { Section("Migration") { NavigationLink("Import React Native backup") { RNLegacyImportView(importer: legacyImporter) } } }
        }.scrollContentBackground(.hidden).background(EQColor.canvas).navigationTitle("Settings").preferredColorScheme(.dark)
    }
}

private struct RNLegacyImportView: View {
    let importer: RNLegacyImporter
    @State private var presentsImporter = false
    @State private var resultMessage: String?
    @State private var isError = false
    var body: some View {
        Form {
            Section {
                Text("Choose a JSON backup exported from the frozen React Native Equilibrium app. Import is local and never deletes the source file.")
                    .font(EQTypography.body)
                Button("Choose backup file") { presentsImporter = true }
            }
            if let resultMessage { Section { Text(resultMessage).foregroundStyle(isError ? EQColor.warning : EQColor.success) } }
        }
        .navigationTitle("Import Legacy Data")
        .fileImporter(isPresented: $presentsImporter, allowedContentTypes: [.json]) { selection in
            do {
                let url = try selection.get(); let scoped = url.startAccessingSecurityScopedResource(); defer { if scoped { url.stopAccessingSecurityScopedResource() } }
                let result = try importer.importFileData(Data(contentsOf: url))
                resultMessage = "Imported \(result.workoutsImported) workouts, \(result.exercisesImported) exercises, and \(result.timersImported) timers. Skipped malformed workouts: \(result.skippedMalformed)."
                isError = false
            } catch {
                resultMessage = error.localizedDescription; isError = true
            }
        }
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
            .onChange(of: unit) { _, value in Task { try? await repository.saveWeightUnit(value) } }
            .onReceive(NotificationCenter.default.publisher(for: .equilibriumRepositoryDidChange)) { _ in Task { if let settings = try? await repository.settings() { unit = settings.weightUnit } } }
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
                Button("Save") { Task { try? await repository.saveDefaultRestDuration(seconds) } }
            }
            Section { Text("Exercise-specific rest duration wins. Changing this setting does not rewrite workouts or restart an active countdown.").font(EQTypography.caption).foregroundStyle(EQColor.secondaryText) }
        }.scrollContentBackground(.hidden).background(EQColor.canvas).navigationTitle("Timer")
            .task { if let value = try? await repository.settings().defaultRestDuration { seconds = value } }
            .onReceive(NotificationCenter.default.publisher(for: .equilibriumRepositoryDidChange)) { _ in Task { if let value = try? await repository.settings().defaultRestDuration { seconds = value } } }
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
    func saveEnabled() async { do { try await repository.saveProgressionEnabled(configuration.isEnabled); error = nil } catch { self.error = "Unable to save progression." } }
    func save(_ profile: AutoProgressionProfile, for exerciseID: ExerciseID) async { do { try await repository.saveProgressionProfile(profile, for: exerciseID); error = nil } catch { self.error = "Unable to save progression." } }
}

private struct ProgressionSettingView: View {
    @StateObject private var model: ProgressionSettingsModel
    init(repository: any ProgressionRepository, settings: any SettingsRepository, exercises: any ExerciseRepository) { _model = StateObject(wrappedValue: ProgressionSettingsModel(repository: repository, settings: settings, exercises: exercises)) }
    var body: some View {
        Form {
            Section { Toggle("Enable progression", isOn: $model.configuration.isEnabled).onChange(of: model.configuration.isEnabled) { _, _ in Task { await model.saveEnabled() } } }
            Section("Automatic progression") {
                Text("Assignments use the stable exercise identity and apply anywhere that exercise appears.").font(EQTypography.caption).foregroundStyle(EQColor.secondaryText)
                ForEach(model.exercises) { exercise in
                    Picker(exercise.name, selection: profile(exercise.id)) { ForEach(AutoProgressionProfile.allCases, id: \.self) { Text($0.title).tag($0) } }
                }
            }
            if let error = model.error { Section { Text(error).foregroundStyle(EQColor.warning) } }
        }.scrollContentBackground(.hidden).background(EQColor.canvas).navigationTitle("Progression").task { await model.load() }
            .onReceive(NotificationCenter.default.publisher(for: .equilibriumRepositoryDidChange)) { _ in Task { await model.load() } }
    }
    private func profile(_ exerciseID: ExerciseID) -> Binding<AutoProgressionProfile> { .init(get: { model.configuration.assignments[exerciseID] ?? .none }, set: { let profile = $0; model.configuration.assign(profile, to: exerciseID); Task { await model.save(profile, for: exerciseID) } }) }
}
