import SwiftUI

struct ExercisePickerView: View {
    let repository: any ExerciseRepository
    let history: any ExerciseHistoryRepository
    let selection: (ExerciseDefinition) -> Void
    @State private var results: [ExerciseDefinition] = []
    @State private var query = ""
    @State private var contexts: [ExerciseID: LatestExerciseLog] = [:]
    @State private var errorMessage: String?
    @Environment(\.dismiss) private var dismiss
    var body: some View {
        NavigationStack {
            List {
                ForEach(results) { exercise in
                    Button { selection(exercise); dismiss() } label: {
                        VStack(alignment: .leading, spacing: EQSpacing.xxs) {
                            Text(exercise.name).font(EQTypography.cardTitle).foregroundStyle(EQColor.primaryText)
                            if let context = contexts[exercise.id], let set = context.sets.last {
                                Text(contextText(set, date: context.occurredAt)).font(EQTypography.caption).foregroundStyle(EQColor.secondaryText)
                            }
                        }.frame(maxWidth: .infinity, minHeight: EQDimension.minimumTouch, alignment: .leading)
                    }.accessibilityLabel(exercise.name)
                }
                if canCreate { Button { Task { await createInline() } } label: { Label("Create \"\(cleanQuery)\"", systemImage: "plus.circle") }.frame(minHeight: EQDimension.minimumTouch) }
            }
            .overlay { if results.isEmpty { ContentUnavailableView.search(text: query) } }
            .searchable(text: $query, prompt: "Search your exercises")
            .onChange(of: query) { _, _ in Task { await load() } }.task { await load() }
            .scrollContentBackground(.hidden).background(EQColor.canvas).navigationTitle("Your Exercises")
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } } }
            .alert("Exercise unavailable", isPresented: .init(get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } })) { Button("OK") {} } message: { Text(errorMessage ?? "") }
        }.preferredColorScheme(.dark)
    }
    private var cleanQuery: String { query.trimmingCharacters(in: .whitespacesAndNewlines) }
    private var canCreate: Bool { !cleanQuery.isEmpty && !results.contains { $0.normalizedName == SwiftDataRepository.normalizeExerciseName(cleanQuery) } }
    private func load() async {
        do {
            results = try await repository.searchExercises(query)
            var loaded: [ExerciseID: LatestExerciseLog] = [:]
            for result in results { if let value = try await history.latestExerciseLog(exerciseID: result.id) { loaded[result.id] = value } }
            contexts = loaded
        } catch { errorMessage = "Exercises could not be loaded." }
    }
    private func createInline() async {
        let normalized = SwiftDataRepository.normalizeExerciseName(cleanQuery)
        do {
            if let existing = try await repository.searchExercises(cleanQuery).first(where: { $0.normalizedName == normalized }) { selection(existing); dismiss(); return }
            let value = ExerciseDefinition(id: .new(), name: cleanQuery, normalizedName: normalized, aliases: [], equipment: nil, category: nil, isCustom: true, archivedAt: nil)
            try await repository.saveExercise(value); selection(value); dismiss()
        } catch RepositoryError.duplicateExerciseName {
            if let existing = try? await repository.searchExercises(cleanQuery).first(where: { $0.normalizedName == normalized }) { selection(existing); dismiss() }
        } catch { errorMessage = "The exercise could not be created." }
    }
    private func contextText(_ set: LoggedSet, date: Date) -> String {
        let formatter = DateFormatter(); formatter.dateFormat = "MMM d"
        if let reps = set.repetitions { return "\(WeightText.value(set.weight, unit: .pounds)) lb × \(reps) · \(formatter.string(from: date))" }
        return "\(Int(set.duration ?? 0)) sec · \(formatter.string(from: date))"
    }
}

struct RecentWorkoutPicker: View {
    let repository: any WorkoutRepository; let selection: ([Workout]) -> Void
    let history: any ExerciseHistoryRepository
    init(repository: any WorkoutRepository, history: any ExerciseHistoryRepository, selection: @escaping ([Workout]) -> Void) { self.repository = repository; self.history = history; self.selection = selection }
    @State private var values: [Workout] = []; @State private var selectedIDs: [WorkoutID] = []; @State private var failed = false; @State private var saving = false
    var body: some View {
        List(values) { value in
            Button { if selectedIDs.contains(value.id) { selectedIDs.removeAll { $0 == value.id } } else { selectedIDs.append(value.id) } } label: {
                HStack { Text(value.titleSnapshot); Spacer(); Image(systemName: selectedIDs.contains(value.id) ? "checkmark.circle.fill" : "circle").foregroundStyle(EQColor.accent) }.frame(minHeight: EQDimension.minimumTouch)
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
        do {
            var fresh: [Workout] = []
            for (index, historical) in chosen.enumerated() { fresh.append(try await historical.freshCopy(createdAt: now.addingTimeInterval(Double(index) / 1_000), history: history)) }
            try await repository.materializeAtomically(fresh); selection(fresh)
        } catch { failed = true }
    }
}

extension Workout {
    func freshCopy(createdAt: Date, history: any ExerciseHistoryRepository) async throws -> Workout {
        var copied: [WorkoutExercise] = []
        for exercise in exercises {
            let latest = try await history.latestExerciseLog(exerciseID: exercise.exerciseID)
            copied.append(.init(id: .new(), exerciseID: exercise.exerciseID, nameSnapshot: exercise.nameSnapshot, prescriptions: latest?.sets.map { set in
                if let duration = set.duration { return .init(id: .new(), target: .duration(seconds: duration), suggestedWeight: nil) }
                let reps = max(1, set.repetitions ?? 1); return .init(id: .new(), target: .repetitions(range: reps...reps), suggestedWeight: set.weight)
            } ?? [], loggedSets: [], restDuration: nil, skippedAt: nil))
        }
        return .init(id: .new(), titleSnapshot: titleSnapshot, exercises: copied, status: .ready, startedAt: nil, completedAt: nil, createdAt: createdAt, updatedAt: createdAt)
    }
}

private extension String { var nilIfBlank: String? { let value = trimmingCharacters(in: .whitespacesAndNewlines); return value.isEmpty ? nil : value } }

#if DEBUG
@MainActor private var pickerPreviewRepository: SwiftDataRepository {
    let container = try! PersistenceController.makeContainer(inMemory: true)
    for exercise in EquilibriumFixtures.exercises { container.mainContext.insert(DefinitionMapper.record(from: exercise)) }
    container.mainContext.insert(WorkoutMapper.record(from: EquilibriumFixtures.completed()))
    try! container.mainContext.save(); return SwiftDataRepository(container: container)
}
#Preview("Exercise Picker") { ExercisePickerView(repository: pickerPreviewRepository, history: pickerPreviewRepository) { _ in } }
#Preview("Recent Workout") { NavigationStack { RecentWorkoutPicker(repository: pickerPreviewRepository, history: pickerPreviewRepository) { _ in } }.preferredColorScheme(.dark) }
#endif
