import SwiftUI
import UniformTypeIdentifiers

struct SettingsShellView: View {
    let settingsRepository: any SettingsRepository
    let progressionRepository: any ProgressionRepository
    let exerciseRepository: any ExerciseRepository
    let legacyImporter: RNLegacyImporter?
    let dismiss: () -> Void
    @State private var presentedSheet: SettingsSheetDestination?

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            header
            ScrollView {
                VStack(alignment: .leading, spacing: EQLayout.exerciseBlockGap) {
                    card {
                        settingsSheetButton("Units", destination: .units)
                        settingsSheetButton("Timer", destination: .timer)
                    }
                    card {
                        NavigationLink {
                            ProgressionSettingView(repository: progressionRepository, settings: settingsRepository, exercises: exerciseRepository)
                        } label: { rowLabel("Progression", systemImage: "chevron.right") }
                        .buttonStyle(.plain)
                    }
                    section("THEME") {
                        card { ThemePicker() }
                    }
                    section("ICLOUD SYNC") {
                        card {
                            VStack(alignment: .leading, spacing: EQSpacing.xxs) {
                                Text("Private iCloud sync").eqTextStyle(.listItemTitle)
                                Text("Equilibrium saves locally first and syncs through your Apple account when iCloud is available. Sync is eventual; backups remain a separate recovery tool.")
                                    .eqTextStyle(.secondaryBody)
                                    .foregroundStyle(EQColor.secondaryText)
                                    .fixedSize(horizontal: false, vertical: true)
                            }
                            .padding(.vertical, EQSpacing.xs)
                            .accessibilityElement(children: .combine)
                        }
                    }
                    if let legacyImporter {
                        section("MIGRATION") {
                            card {
                                NavigationLink { RNLegacyImportView(importer: legacyImporter) } label: { rowLabel("Import React Native backup", systemImage: "chevron.right") }
                                    .buttonStyle(.plain)
                            }
                        }
                    }
                }
                .padding(.horizontal, EQLayout.screenGutter)
                .padding(.top, EQSpacing.md + EQLayout.WorkoutExecution.overviewContentTopInset)
                .padding(.bottom, EQSpacing.lg)
            }
            .scrollIndicators(.hidden)
        }
        .foregroundStyle(EQColor.primaryText)
        .background(EQColor.canvas)
        .toolbar(.hidden, for: .navigationBar)
        .sheet(item: $presentedSheet) { destination in
            switch destination {
            case .units:
                UnitsSettingView(repository: settingsRepository)
            case .timer:
                TimerSettingView(repository: settingsRepository)
            }
        }
    }

    private var header: some View {
        Button(action: dismiss) {
            HStack(alignment: .firstTextBaseline, spacing: EQSpacing.xs) {
                Image(systemName: "chevron.left")
                Text("Settings").eqTextStyle(.navigationTitle)
            }
            .frame(minHeight: EQLayout.minimumTouch)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .foregroundStyle(EQColor.primaryText)
        .accessibilityLabel("Back to Home")
        .frame(maxWidth: .infinity, minHeight: EQLayout.minimumTouch + EQSpacing.sm, alignment: .leading)
        .padding(.horizontal, EQLayout.screenGutter)
    }

    private func section<Content: View>(_ label: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: EQSpacing.sm) {
            Text(label).eqTextStyle(.sectionLabel).foregroundStyle(EQColor.secondaryText)
            content()
        }
    }

    private func card<Content: View>(@ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 0) { content() }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, EQSpacing.md)
            .padding(.vertical, EQSpacing.xs)
            .background(EQColor.cardFill, in: RoundedRectangle(cornerRadius: EQRadius.card, style: .continuous))
    }

    private func rowLabel(_ title: String, systemImage: String) -> some View {
        HStack {
            Text(title).eqTextStyle(.listItemTitle)
            Spacer()
            Image(systemName: systemImage)
                .eqTextStyle(.caption)
                .foregroundStyle(EQColor.secondaryText)
        }
        .frame(minHeight: EQLayout.minimumTouch)
        .contentShape(Rectangle())
    }

    private func settingsSheetButton(_ title: String, destination: SettingsSheetDestination) -> some View {
        Button {
            presentedSheet = destination
        } label: {
            rowLabel(title, systemImage: "chevron.up")
        }
        .buttonStyle(.plain)
    }
}

private struct ThemePicker: View {
    private let store = EQThemeStore.shared

    var body: some View {
        ForEach(EQTheme.all) { theme in
            Button {
                withAnimation(.easeInOut(duration: 0.25)) { store.select(theme.id) }
            } label: {
                HStack(spacing: EQSpacing.sm) {
                    ThemeSwatch(colors: theme.swatches)
                    Text(theme.name).eqTextStyle(.listItemTitle)
                    Spacer()
                    if store.theme.id == theme.id {
                        Image(systemName: "checkmark")
                            .eqTextStyle(.caption)
                            .foregroundStyle(EQColor.accent)
                    }
                }
                .frame(minHeight: EQLayout.minimumTouch)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("\(theme.name) theme")
            .accessibilityAddTraits(store.theme.id == theme.id ? .isSelected : [])
        }
    }
}

private struct ThemeSwatch: View {
    let colors: [Color]

    var body: some View {
        HStack(spacing: -6) {
            ForEach(colors.indices, id: \.self) { index in
                Circle()
                    .fill(colors[index])
                    .frame(width: 20, height: 20)
                    .overlay(Circle().strokeBorder(EQColor.separator, lineWidth: 1))
            }
        }
        .accessibilityHidden(true)
    }
}

enum SettingsSheetDestination: String, Identifiable {
    case units
    case timer

    var id: String { rawValue }
}

private struct RNLegacyImportView: View {
    let importer: RNLegacyImporter
    @State private var presentsImporter = false
    @State private var resultMessage: String?
    @State private var isError = false
    var body: some View {
        Form {
            Section {
                Text("Choose a JSON backup or workout history export from the React Native Equilibrium app. Import is local and never deletes the source file.")
                    .eqTextStyle(.body)
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
        SettingsBottomSheet(title: "Units") {
            Form {
                Picker("Weight unit", selection: $unit) { Text("Pounds (lb)").tag(WeightUnit.pounds); Text("Kilograms (kg)").tag(WeightUnit.kilograms) }.pickerStyle(.inline)
                Section { Text("Workout entries and progression increments use this unit for presentation. Canonical weight remains pounds.").eqTextStyle(.caption).foregroundStyle(EQColor.secondaryText) }
            }
            .scrollContentBackground(.hidden)
        }
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
        SettingsBottomSheet(title: "Timer") {
            Form {
                Section("Default rest duration") {
                    Text(text).eqTextStyle(.largeMetric).monospacedDigit().accessibilityLabel("Default rest duration, \(text)")
                    Slider(value: $seconds, in: 15...300, step: 5).accessibilityValue(text)
                    Button("Save") { Task { try? await repository.saveDefaultRestDuration(seconds) } }
                }
                Section { Text("Exercise-specific rest duration wins. Changing this setting does not rewrite workouts or restart an active countdown.").eqTextStyle(.caption).foregroundStyle(EQColor.secondaryText) }
            }
            .scrollContentBackground(.hidden)
        }
            .task { if let value = try? await repository.settings().defaultRestDuration { seconds = value } }
            .onReceive(NotificationCenter.default.publisher(for: .equilibriumRepositoryDidChange)) { _ in Task { if let value = try? await repository.settings().defaultRestDuration { seconds = value } } }
    }
}

private struct SettingsBottomSheet<Content: View>: View {
    let title: String
    @ViewBuilder let content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(title)
                .eqTextStyle(.screenTitle)
                .padding(.horizontal, EQLayout.screenGutter)
                .padding(.top, EQLayout.Settings.sheetTopSpacing)
                .padding(.bottom, EQLayout.Settings.sheetTitleToContentSpacing)
            content()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(EQColor.elevatedSurface)
        .presentationDetents([.medium])
        .presentationDragIndicator(.visible)
        .presentationCornerRadius(EQRadius.sheet)
        .presentationBackground(EQColor.elevatedSurface)
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
                Text("Assignments use the stable exercise identity and apply anywhere that exercise appears.").eqTextStyle(.caption).foregroundStyle(EQColor.secondaryText)
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
