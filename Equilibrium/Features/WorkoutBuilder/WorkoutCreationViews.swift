import SwiftUI

struct AddWorkoutSheet: View {
    let day: LocalDay
    let exercises: any ExerciseRepository
    let templates: any WorkoutTemplateRepository
    let workouts: any ScheduledWorkoutRepository
    let scheduled: ([ScheduledWorkout]) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var path: [CreationRoute] = []
    var body: some View {
        NavigationStack(path: $path) {
            List {
                Button { path.append(.builder(.init())) } label: { Label("Create from scratch", systemImage: "plus.square").frame(minHeight: EQDimension.minimumTouch) }
                Button { path.append(.pasteWorkout) } label: { Label("Paste workout", systemImage: "doc.on.clipboard").frame(minHeight: EQDimension.minimumTouch) }
                    .accessibilityHint("Paste and review a structured workout")
                Button { path.append(.recent) } label: { Label("Use recent workout", systemImage: "clock.arrow.circlepath").frame(minHeight: EQDimension.minimumTouch) }
            }
            .scrollContentBackground(.hidden).background(EQColor.canvas).navigationTitle("Add Workout")
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } } }
            .navigationDestination(for: CreationRoute.self) { route in
                switch route {
                case .builder(let draft): WorkoutBuilderView(model: .init(day: day, draft: draft, templates: templates, workouts: workouts), exercises: exercises) { value in scheduled([value]); dismiss() }
                case .recent: RecentWorkoutPicker(repository: workouts, day: day) { values in scheduled(values); dismiss() }
                case .pasteWorkout: PlanImportInputView { path.append(.importReview($0)) }
                case .importReview(let result): PlanImportReviewView(model: .init(result: result, repository: exercises), exercises: exercises) { path.append(.builder($0)) }
                }
            }
        }.presentationDetents([.large]).preferredColorScheme(.dark)
    }
}

enum CreationRoute: Hashable {
    case builder(WorkoutDraft), recent, pasteWorkout, importReview(PlanParseResult)
}

struct WorkoutBuilderView: View {
    @State var model: WorkoutBuilderModel
    let exercises: any ExerciseRepository
    let scheduled: (ScheduledWorkout) -> Void
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
                    ExerciseDraftRow(exercise: $exercise, unit: WeightUnit(rawValue: unitRaw) ?? .pounds, removeSet: { model.removeSet($0, from: exercise.id) }, addSet: { model.addSet(to: exercise.id) }, moveUp: { model.moveExercise(id: exercise.id, direction: -1) }, moveDown: { model.moveExercise(id: exercise.id, direction: 1) })
                }.onDelete(perform: model.remove).onMove(perform: model.move)
                Button { pickerPresented = true } label: { Label("Add exercise", systemImage: "plus") }.frame(minHeight: EQDimension.minimumTouch)
            }
            if let error = model.errorMessage { Section { Label(error, systemImage: "exclamationmark.triangle").foregroundStyle(EQColor.warning) } }
        }
        .scrollContentBackground(.hidden).background(EQColor.canvas).scrollDismissesKeyboard(.interactively)
        .navigationTitle("Workout Builder").navigationBarBackButtonHidden(model.draft.isMeaningful)
        .toolbar {
            if model.draft.isMeaningful { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { discardPresented = true } } }
            ToolbarItemGroup(placement: .confirmationAction) {
                Button("Save") { Task { _ = await model.saveTemplate() } }.disabled(!model.canCommit || model.isSaving)
                Button("Add Workout") { Task { if let value = await model.schedule() { scheduled(value) } } }.disabled(!model.canCommit)
            }
        }
        .sheet(isPresented: $pickerPresented) { ExercisePickerView(repository: exercises) { model.add($0); pickerPresented = false } }
        .confirmationDialog("Discard this workout?", isPresented: $discardPresented) { Button("Discard Changes", role: .destructive) { dismiss() }; Button("Keep Editing", role: .cancel) {} } message: { Text("Your unsaved builder changes will be lost.") }
    }
}

private struct ExerciseDraftRow: View {
    @Binding var exercise: DraftExercise
    let unit: WeightUnit
    let removeSet: (UUID) -> Void; let addSet: () -> Void; let moveUp: () -> Void; let moveDown: () -> Void
    var body: some View {
        VStack(alignment: .leading, spacing: EQSpacing.sm) {
            Text(exercise.name).font(EQTypography.exerciseTitle)
            ForEach($exercise.prescriptions) { $set in SetDraftRow(set: $set, number: exercise.prescriptions.firstIndex(where: { $0.id == set.id })!.advanced(by: 1), unit: unit, remove: { removeSet(set.id) }) }
            HStack { Button("Add set", action: addSet); Spacer(); Menu("Move") { Button("Move up", action: moveUp); Button("Move down", action: moveDown) } }
            HStack { Text("Rest"); Spacer(); TextField("Optional seconds", value: $exercise.restDuration, format: .number).keyboardType(.numberPad).multilineTextAlignment(.trailing) }
        }.padding(.vertical, EQSpacing.xs).accessibilityElement(children: .contain)
    }
}

private struct SetDraftRow: View {
    @Binding var set: DraftSet; let number: Int; let unit: WeightUnit; let remove: () -> Void
    var body: some View {
        VStack(alignment: .leading, spacing: EQSpacing.xs) {
            HStack { Text("Set \(number)").font(EQTypography.cardTitle); Spacer(); Picker("Target", selection: targetKind) { Text("Reps").tag(0); Text("Duration").tag(1) }.pickerStyle(.segmented); Button(role: .destructive, action: remove) { Image(systemName: "minus.circle") }.accessibilityLabel("Remove set \(number)") }
            switch set.target {
            case .repetitions:
                HStack { TextField("Minimum reps", value: lower, format: .number).keyboardType(.numberPad); Text("to"); TextField("Maximum reps", value: upper, format: .number).keyboardType(.numberPad) }
                TextField("Suggested weight (\(unit == .pounds ? "lb" : "kg"))", value: displayedWeight, format: .number).keyboardType(.decimalPad)
            case .duration: TextField("Duration in seconds", value: duration, format: .number).keyboardType(.numberPad)
            }
        }.padding(EQSpacing.sm).background(EQColor.elevatedSurface, in: RoundedRectangle(cornerRadius: EQRadius.control))
    }
    private var targetKind: Binding<Int> { .init(get: { if case .repetitions = set.target { 0 } else { 1 } }, set: { set.target = $0 == 0 ? .repetitions(lower: 8, upper: 12) : .duration(seconds: 30) }) }
    private var lower: Binding<Int> { .init(get: { if case .repetitions(let value, _) = set.target { value } else { 8 } }, set: { if case .repetitions(_, let high) = set.target { set.target = .repetitions(lower: max(1, $0), upper: high) } }) }
    private var upper: Binding<Int> { .init(get: { if case .repetitions(_, let value) = set.target { value } else { 12 } }, set: { if case .repetitions(let low, _) = set.target { set.target = .repetitions(lower: low, upper: max(1, $0)) } }) }
    private var duration: Binding<Int> { .init(get: { if case .duration(let value) = set.target { value } else { 30 } }, set: { set.target = .duration(seconds: max(1, $0)) }) }
    private var displayedWeight: Binding<Double?> { .init(get: { set.suggestedPounds.map { Weight(pounds: $0).value(in: unit) } }, set: { set.suggestedPounds = $0.map { Weight($0, unit: unit).pounds } }) }
}

#if DEBUG
@MainActor private func builderPreview(draft: WorkoutDraft = .init(), size: DynamicTypeSize = .large) -> some View {
    let repository = SwiftDataRepository(container: try! PersistenceController.makeContainer(inMemory: true))
    return NavigationStack { WorkoutBuilderView(model: .init(day: try! LocalDay("2026-08-22"), draft: draft, templates: repository, workouts: repository), exercises: repository) { _ in } }.dynamicTypeSize(size).preferredColorScheme(.dark)
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
