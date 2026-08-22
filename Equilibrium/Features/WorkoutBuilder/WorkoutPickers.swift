import SwiftUI

struct ExercisePickerView: View {
    let repository: any ExerciseRepository
    let selection: (ExerciseDefinition) -> Void
    @State private var results: [ExerciseDefinition] = []
    @State private var query = ""
    @State private var customPresented = false
    @State private var errorMessage: String?
    @Environment(\.dismiss) private var dismiss
    var body: some View {
        NavigationStack {
            List {
                ForEach(results) { exercise in
                    Button { selection(exercise); dismiss() } label: {
                        VStack(alignment: .leading, spacing: EQSpacing.xxs) {
                            Text(exercise.name).font(EQTypography.cardTitle).foregroundStyle(EQColor.primaryText)
                            let metadata = [exercise.equipment, exercise.category].compactMap { $0 }.joined(separator: " · ")
                            if !metadata.isEmpty { Text(metadata).font(EQTypography.caption).foregroundStyle(EQColor.secondaryText) }
                        }.frame(maxWidth: .infinity, minHeight: EQDimension.minimumTouch, alignment: .leading)
                    }.accessibilityLabel([exercise.name, exercise.equipment, exercise.category].compactMap { $0 }.joined(separator: ", "))
                }
            }
            .overlay { if results.isEmpty { ContentUnavailableView.search(text: query) } }
            .searchable(text: $query, prompt: "Name, alias, equipment, or category")
            .onChange(of: query) { _, _ in Task { await load() } }.task { await load() }
            .scrollContentBackground(.hidden).background(EQColor.canvas).navigationTitle("Exercises")
            .toolbar { ToolbarItem(placement: .primaryAction) { Button { customPresented = true } label: { Label("New exercise", systemImage: "plus") } }; ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } } }
            .sheet(isPresented: $customPresented) { CustomExerciseView(repository: repository) { value in Task { await load() }; selection(value); dismiss() } }
            .alert("Exercise unavailable", isPresented: .init(get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } })) { Button("OK") {} } message: { Text(errorMessage ?? "") }
        }.preferredColorScheme(.dark)
    }
    private func load() async { do { results = try await repository.searchExercises(query) } catch { errorMessage = "Exercises could not be loaded." } }
}

private struct CustomExerciseView: View {
    let repository: any ExerciseRepository; let created: (ExerciseDefinition) -> Void
    @State private var name = ""; @State private var equipment = ""; @State private var category = ""; @State private var errorMessage: String?
    @Environment(\.dismiss) private var dismiss
    var body: some View {
        NavigationStack { Form { TextField("Exercise name", text: $name); TextField("Equipment (optional)", text: $equipment); TextField("Category (optional)", text: $category); if let errorMessage { Text(errorMessage).foregroundStyle(EQColor.warning) } }
            .scrollContentBackground(.hidden).background(EQColor.canvas).navigationTitle("Custom Exercise")
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }; ToolbarItem(placement: .confirmationAction) { Button("Create") { Task { await save() } }.disabled(name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty) } }
        }.preferredColorScheme(.dark)
    }
    private func save() async {
        let clean = name.trimmingCharacters(in: .whitespacesAndNewlines)
        let value = ExerciseDefinition(id: .new(), name: clean, normalizedName: SwiftDataRepository.normalizeExerciseName(clean), aliases: [], equipment: equipment.nilIfBlank, category: category.nilIfBlank, isCustom: true, archivedAt: nil)
        do { try await repository.saveExercise(value); created(value); dismiss() }
        catch RepositoryError.duplicateExerciseName { errorMessage = "An exercise with this name or alias already exists." }
        catch { errorMessage = "The exercise could not be created." }
    }
}

struct WorkoutTemplatePicker: View {
    let repository: any WorkoutTemplateRepository; let selection: (WorkoutTemplate) -> Void
    @State private var values: [WorkoutTemplate] = []; @State private var failed = false
    var body: some View { List(values) { value in Button { selection(value) } label: { VStack(alignment: .leading) { Text(value.name); Text("\(value.exercises.count) exercises").font(EQTypography.caption).foregroundStyle(EQColor.secondaryText) }.frame(minHeight: EQDimension.minimumTouch) } }.overlay { if values.isEmpty { ContentUnavailableView("No reusable workouts", systemImage: "rectangle.stack", description: Text(failed ? "Workouts could not be loaded." : "Save a workout from the Builder first.")) } }.scrollContentBackground(.hidden).background(EQColor.canvas).navigationTitle("Existing Workout").task { do { values = try await repository.allTemplates() } catch { failed = true } } }
}

struct RecentWorkoutPicker: View {
    let repository: any ScheduledWorkoutRepository; let day: LocalDay; let selection: ([ScheduledWorkout]) -> Void
    @State private var values: [ScheduledWorkout] = []; @State private var selectedIDs: [ScheduledWorkoutID] = []; @State private var failed = false; @State private var saving = false
    var body: some View {
        List(values) { value in
            Button { if selectedIDs.contains(value.id) { selectedIDs.removeAll { $0 == value.id } } else { selectedIDs.append(value.id) } } label: {
                HStack { VStack(alignment: .leading) { Text(value.titleSnapshot); Text(value.day.iso8601).font(EQTypography.caption).foregroundStyle(EQColor.secondaryText) }; Spacer(); Image(systemName: selectedIDs.contains(value.id) ? "checkmark.circle.fill" : "circle").foregroundStyle(EQColor.accent) }.frame(minHeight: EQDimension.minimumTouch)
            }
        }
        .overlay { if values.isEmpty { ContentUnavailableView("No recent workouts", systemImage: "clock.arrow.circlepath", description: Text(failed ? "Recent workouts could not be loaded." : "Completed workouts appear here.")) } }
        .scrollContentBackground(.hidden).background(EQColor.canvas).navigationTitle("Use recent workout")
        .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Add \(selectedIDs.count) workouts") { Task { await addSelected() } }.disabled(selectedIDs.isEmpty || saving) } }
        .task { do { values = try await repository.recentCompletedWorkouts(limit: 20) } catch { failed = true } }
    }
    private func addSelected(now: Date = .now) async {
        saving = true; defer { saving = false }
        let chosen = selectedIDs.compactMap { id in values.first { $0.id == id } }
        let fresh = chosen.enumerated().map { index, historical in historical.freshCopy(on: day, createdAt: now.addingTimeInterval(Double(index) / 1_000)) }
        do { try await repository.materializeAtomically(fresh); selection(fresh) } catch { failed = true }
    }
}

extension ScheduledWorkout {
    func freshCopy(on day: LocalDay, createdAt: Date) -> ScheduledWorkout {
        .init(id: .new(), day: day, titleSnapshot: titleSnapshot, templateID: templateID, planID: nil, source: .manual, exercises: exercises.map { exercise in
            .init(id: .new(), exerciseID: exercise.exerciseID, nameSnapshot: exercise.nameSnapshot, prescriptions: exercise.prescriptions.map { .init(id: .new(), target: $0.target, suggestedWeight: $0.suggestedWeight) }, loggedSets: [], restDuration: exercise.restDuration, skippedAt: nil)
        }, status: .planned, startedAt: nil, completedAt: nil, createdAt: createdAt, updatedAt: createdAt)
    }
}

private extension String { var nilIfBlank: String? { let value = trimmingCharacters(in: .whitespacesAndNewlines); return value.isEmpty ? nil : value } }

#if DEBUG
@MainActor private var pickerPreviewRepository: SwiftDataRepository {
    let container = try! PersistenceController.makeContainer(inMemory: true)
    for exercise in EquilibriumFixtures.exercises { container.mainContext.insert(DefinitionMapper.record(from: exercise)) }
    container.mainContext.insert(DefinitionMapper.record(from: EquilibriumFixtures.template)); container.mainContext.insert(WorkoutMapper.record(from: EquilibriumFixtures.completed()))
    try! container.mainContext.save(); return SwiftDataRepository(container: container)
}
#Preview("Exercise Picker") { ExercisePickerView(repository: pickerPreviewRepository) { _ in } }
#Preview("Existing Workout") { NavigationStack { WorkoutTemplatePicker(repository: pickerPreviewRepository) { _ in } }.preferredColorScheme(.dark) }
#Preview("Recent Workout") { NavigationStack { RecentWorkoutPicker(repository: pickerPreviewRepository, day: try! LocalDay("2026-08-22")) { _ in } }.preferredColorScheme(.dark) }
#endif
