import SwiftUI

struct AddWorkoutSheet: View {
    let initialRoute: CreationRoute
    let exercises: any ExerciseRepository
    let workouts: any WorkoutRepository
    let history: any ExerciseHistoryRepository
    let created: ([Workout]) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var path: [CreationRoute] = []
    init(initialRoute: CreationRoute, exercises: any ExerciseRepository, workouts: any WorkoutRepository, history: any ExerciseHistoryRepository, created: @escaping ([Workout]) -> Void) {
        self.initialRoute = initialRoute; self.exercises = exercises; self.workouts = workouts; self.history = history; self.created = created
    }
    var body: some View {
        NavigationStack(path: $path) {
            creationDestination(initialRoute)
                .navigationDestination(for: CreationRoute.self) { creationDestination($0) }
        }.presentationDetents([.large]).preferredColorScheme(.dark)
    }

    @ViewBuilder private func creationDestination(_ route: CreationRoute) -> some View {
        switch route {
        case .builder(let draft):
            WorkoutBuilderView(model: .init(draft: draft, exercises: exercises, workouts: workouts, history: history), exercises: exercises, history: history) { value in created([value]); dismiss() }
        case .recent:
            RecentWorkoutPicker(repository: workouts, history: history) { values in created(values); dismiss() }
        case .pasteWorkout:
            ClipboardWorkoutImportView(repository: exercises) { path.append(.builder($0)) }
        }
    }
}

enum CreationRoute: Hashable, Identifiable {
    case builder(WorkoutDraft), recent, pasteWorkout
    var id: String { switch self { case .builder: "builder"; case .recent: "recent"; case .pasteWorkout: "paste" } }
}

struct WorkoutBuilderView: View {
    @State var model: WorkoutBuilderModel
    let exercises: any ExerciseRepository
    let history: any ExerciseHistoryRepository
    let created: (Workout) -> Void
    @State private var pickerPresented = false
    @State private var discardPresented = false
    @Environment(\.dismiss) private var dismiss
    @AppStorage(EQPreferenceKey.weightUnit) private var unitRaw = WeightUnit.pounds.rawValue
    var body: some View {
        @Bindable var model = model
        Form {
            Section("Workout") { TextField("Workout name", text: $model.draft.name).accessibilityLabel("Workout name") }
            Section("Exercises") {
                ForEach($model.draft.exercises) { $exercise in
                    HStack { Text(exercise.name).font(EQTypography.exerciseTitle); Spacer(); Menu("Move") { Button("Move up") { model.moveExercise(id: exercise.id, direction: -1) }; Button("Move down") { model.moveExercise(id: exercise.id, direction: 1) } } }
                }.onDelete(perform: model.remove).onMove(perform: model.move)
                Button { pickerPresented = true } label: { Label("Add exercise", systemImage: "plus") }.frame(minHeight: EQDimension.minimumTouch)
            }
            if let error = model.errorMessage { Section { Label(error, systemImage: "exclamationmark.triangle").foregroundStyle(EQColor.warning) } }
        }
        .scrollContentBackground(.hidden).background(EQColor.canvas).scrollDismissesKeyboard(.interactively)
        .navigationTitle("Workout Builder").navigationBarBackButtonHidden(model.draft.isMeaningful)
        .toolbar {
            if model.draft.isMeaningful { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { discardPresented = true } } }
            ToolbarItem(placement: .confirmationAction) { Button("Create workout") { Task { if let value = await model.create() { created(value) } } }.disabled(!model.canCommit || model.isSaving) }
        }
        .sheet(isPresented: $pickerPresented) { ExercisePickerView(repository: exercises, history: history) { model.add($0); pickerPresented = false } }
        .confirmationDialog("Discard this workout?", isPresented: $discardPresented) { Button("Discard Changes", role: .destructive) { dismiss() }; Button("Keep Editing", role: .cancel) {} } message: { Text("Your unsaved builder changes will be lost.") }
    }
}

#if DEBUG
@MainActor private func builderPreview(draft: WorkoutDraft = .init(), size: DynamicTypeSize = .large) -> some View {
    let repository = SwiftDataRepository(container: try! PersistenceController.makeContainer(inMemory: true))
    return NavigationStack { WorkoutBuilderView(model: .init(draft: draft, exercises: repository, workouts: repository, history: repository), exercises: repository, history: repository) { _ in } }.dynamicTypeSize(size).preferredColorScheme(.dark)
}
private extension WorkoutDraft {
    static var previewMixed: Self {
        var draft = WorkoutDraft(); draft.name = "Strength and Stability"
        draft.exercises = [.init(exerciseID: EquilibriumFixtures.squatID, name: "Back Squat", prescriptions: [.repetitions(), .repetitions()], restDuration: 90), .init(exerciseID: EquilibriumFixtures.plankID, name: "Plank", prescriptions: [.duration()], restDuration: 30)]
        return draft
    }
}
#Preview("Empty Builder") { builderPreview() }
#Preview("Mixed Builder") { builderPreview(draft: .previewMixed) }
#Preview("Builder Large Type") { builderPreview(draft: .previewMixed, size: .accessibility3) }
#endif
