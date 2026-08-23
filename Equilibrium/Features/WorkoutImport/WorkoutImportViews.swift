import Observation
import SwiftUI
import UIKit

struct ClipboardWorkoutImportView: View {
    let repository: any ExerciseRepository
    let ready: (WorkoutDraft) -> Void
    @State private var fallback = false
    @State private var initialText = ""
    @State private var fallbackMessage: String?
    var body: some View {
        Group {
            if fallback {
                WorkoutImportInputView(initialText: initialText) { result in Task { await open(result) } }
                    .safeAreaInset(edge: .top) { if let fallbackMessage { Text(fallbackMessage).font(EQTypography.caption).foregroundStyle(EQColor.warning).padding(.horizontal, EQSpacing.lg) } }
            } else { ProgressView("Reading clipboard") }
        }
        .task { await readClipboard() }
    }
    private func readClipboard() async {
        let value = UIPasteboard.general.string ?? ""
        initialText = value
        let result = WorkoutTextParser().parse(value)
        guard !result.hasBlockingIssues, result.workouts.count == 1 else {
            fallbackMessage = value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? "The clipboard is empty. Enter workout text below." : "The clipboard workout needs correction."
            fallback = true; return
        }
        await open(result)
    }
    private func open(_ result: WorkoutParseResult) async {
        guard let workout = result.workouts.first else { fallback = true; return }
        do { ready(WorkoutImportDraftConverter.lightweightDraft(from: workout, catalog: try await repository.allExercises())) }
        catch { fallbackMessage = "Exercises could not be loaded."; fallback = true }
    }
}

struct WorkoutImportInputView: View {
    private let editorMinimumHeight: CGFloat = 220
    let parsed: (WorkoutParseResult) -> Void
    @State private var text = ""
    @State private var issues: [ParseIssue] = []
    @FocusState private var editorFocused: Bool

    init(initialText: String = "", parsed: @escaping (WorkoutParseResult) -> Void) {
        self.parsed = parsed
        _text = State(initialValue: initialText)
    }

    var body: some View {
        Form {
            Section {
                Text("Paste one or more structured workouts. Use one exercise per line with sets and repetitions or duration.")
                    .font(EQTypography.body).foregroundStyle(EQColor.secondaryText)
                TextEditor(text: $text)
                    .frame(minHeight: editorMinimumHeight)
                    .focused($editorFocused)
                    .accessibilityLabel("Workout text")
                    .accessibilityHint("Paste workout names and exercise prescriptions, one per line.")
                Button("Parse and Review") { parse() }
                    .frame(maxWidth: .infinity, minHeight: EQDimension.minimumTouch)
                    .disabled(text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
            if !issues.isEmpty {
                Section("Needs correction") { ForEach(issues) { ParseIssueRow(issue: $0) } }
            }
            Section("Example") {
                Text("Push\n\nBench Press 3x8\nIncline Dumbbell Press 3x10\nPlank 3x30 sec")
                    .font(.body.monospaced()).foregroundStyle(EQColor.secondaryText).textSelection(.enabled)
            }
        }
        .scrollContentBackground(.hidden).background(EQColor.canvas).scrollDismissesKeyboard(.interactively)
        .navigationTitle("Paste workout")
        .toolbar { ToolbarItemGroup(placement: .keyboard) { Spacer(); Button("Done") { editorFocused = false } } }
    }
    private func parse() {
        let result = WorkoutTextParser().parse(text)
        if result.hasBlockingIssues { issues = result.issues; editorFocused = true } else { issues = []; parsed(result) }
    }
}

@MainActor @Observable
final class WorkoutImportReviewModel {
    var workouts: [ResolvedParsedWorkout] = []
    var issues: [ParseIssue]
    var selectedIndex = 0
    var errorMessage: String?
    private let parsed: [ParsedWorkout]
    private let repository: any ExerciseRepository
    private let matcher = WorkoutExerciseMatcher()

    init(result: WorkoutParseResult, repository: any ExerciseRepository) {
        parsed = result.workouts; issues = result.issues; self.repository = repository
    }
    func load() async {
        do {
            let catalog = try await repository.allExercises()
            workouts = parsed.map { workout in
                .init(id: workout.id, name: workout.name, exercises: workout.exercises.map { .init(parsed: $0, match: matcher.match(name: $0.name, catalog: catalog)) })
            }
        } catch { errorMessage = "Exercises could not be loaded." }
    }
    var selected: ResolvedParsedWorkout? { workouts.indices.contains(selectedIndex) ? workouts[selectedIndex] : nil }
    var selectedUnresolvedCount: Int { selected?.exercises.filter { if case .matched = $0.match { false } else { true } }.count ?? 0 }
    func replace(exerciseID: UUID, with definition: ExerciseDefinition) {
        guard workouts.indices.contains(selectedIndex), let index = workouts[selectedIndex].exercises.firstIndex(where: { $0.parsed.id == exerciseID }) else { return }
        workouts[selectedIndex].exercises[index].match = .matched(definition)
    }
    func rename(exerciseID: UUID, to name: String) async {
        guard workouts.indices.contains(selectedIndex), let index = workouts[selectedIndex].exercises.firstIndex(where: { $0.parsed.id == exerciseID }) else { return }
        workouts[selectedIndex].exercises[index].parsed.name = name
        do { workouts[selectedIndex].exercises[index].match = matcher.match(name: name, catalog: try await repository.allExercises()) }
        catch { errorMessage = "Exercises could not be loaded." }
    }
}

struct WorkoutImportReviewView: View {
    @State var model: WorkoutImportReviewModel
    let exercises: any ExerciseRepository
    let continueToBuilder: (WorkoutDraft) -> Void
    @State private var replacementID: UUID?

    var body: some View {
        @Bindable var model = model
        List {
            if model.workouts.count > 1 {
                Section("Imported workouts") {
                    ForEach(Array(model.workouts.enumerated()), id: \.element.id) { index, workout in
                        Button { model.selectedIndex = index } label: {
                            HStack {
                                Text(workout.name.isEmpty ? "Untitled Workout" : workout.name)
                                Spacer()
                                let count = workout.exercises.filter { if case .matched = $0.match { false } else { true } }.count
                                Label(count == 0 ? "Matched" : "\(count) need review", systemImage: count == 0 ? "checkmark.circle" : "exclamationmark.triangle")
                                    .font(EQTypography.caption).foregroundStyle(count == 0 ? EQColor.success : EQColor.warning)
                            }.frame(minHeight: EQDimension.minimumTouch)
                        }
                    }
                    Text("Each workout opens independently in Workout Builder.")
                        .font(EQTypography.caption).foregroundStyle(EQColor.secondaryText)
                }
            }
            if model.workouts.indices.contains(model.selectedIndex) {
                Section("Workout") { TextField("Workout name", text: $model.workouts[model.selectedIndex].name) }
                Section("Exercise matches") {
                    ForEach($model.workouts[model.selectedIndex].exercises, id: \.parsed.id) { $value in
                        WorkoutMatchRow(value: $value, choose: { replacementID = value.parsed.id }, renamed: { name in Task { await model.rename(exerciseID: value.parsed.id, to: name) } })
                    }
                }
            }
            if !model.issues.isEmpty { Section("Parser warnings") { ForEach(model.issues) { ParseIssueRow(issue: $0) } } }
            if let error = model.errorMessage { Section { Label(error, systemImage: "exclamationmark.triangle").foregroundStyle(EQColor.warning) } }
        }
        .overlay { if model.workouts.isEmpty && model.errorMessage == nil { ProgressView("Matching exercises") } }
        .scrollContentBackground(.hidden).background(EQColor.canvas).navigationTitle("Review Import")
        .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Continue") { if let workout = model.selected, let draft = WorkoutImportDraftConverter.draft(from: workout) { continueToBuilder(draft) } }.disabled(model.selected == nil || model.selectedUnresolvedCount > 0) } }
        .sheet(isPresented: .init(get: { replacementID != nil }, set: { if !$0 { replacementID = nil } })) {
            Text("Exercise mapping is no longer part of the Home creation flow.")
        }
        .task { if model.workouts.isEmpty { await model.load() } }
    }
}

private struct WorkoutMatchRow: View {
    @Binding var value: ResolvedParsedExercise
    let choose: () -> Void
    let renamed: (String) -> Void
    @State private var editingName = false
    var body: some View {
        VStack(alignment: .leading, spacing: EQSpacing.xs) {
            if editingName {
                TextField("Parsed exercise name", text: $value.parsed.name, onCommit: { editingName = false; renamed(value.parsed.name) })
                    .accessibilityLabel("Parsed exercise name")
            } else { Text(value.parsed.name).font(EQTypography.exerciseTitle) }
            switch value.match {
            case .matched(let exercise): Label("Matched: \(exercise.name)", systemImage: "checkmark.circle.fill").foregroundStyle(EQColor.success)
            case .unmatched: Label("Needs review: no safe match", systemImage: "exclamationmark.triangle.fill").foregroundStyle(EQColor.warning)
            case .ambiguous(let matches): Label("Needs review: \(matches.count) possible matches", systemImage: "questionmark.circle.fill").foregroundStyle(EQColor.warning)
            }
            Text(prescriptionSummary).font(EQTypography.caption).foregroundStyle(EQColor.secondaryText)
            HStack { Button("Choose Exercise", action: choose); Spacer(); Button(editingName ? "Done" : "Edit Name") { if editingName { renamed(value.parsed.name) }; editingName.toggle() } }
                .frame(minHeight: EQDimension.minimumTouch)
        }.padding(.vertical, EQSpacing.xs).accessibilityElement(children: .contain)
    }
    private var prescriptionSummary: String {
        guard let first = value.parsed.prescriptions.first else { return "No sets" }
        let target: String
        switch first.target { case .repetitions(let range): target = range.lowerBound == range.upperBound ? "\(range.lowerBound) reps" : "\(range.lowerBound)–\(range.upperBound) reps"; case .duration(let seconds): target = "\(seconds) seconds" }
        return "\(value.parsed.prescriptions.count) sets · \(target)"
    }
}

struct ParseIssueRow: View {
    let issue: ParseIssue
    var body: some View {
        Label {
            VStack(alignment: .leading, spacing: EQSpacing.xxs) {
                Text(issue.lineNumber.map { "Line \($0): \(issue.message)" } ?? issue.message)
                if let content = issue.content { Text(content).font(EQTypography.caption).foregroundStyle(EQColor.secondaryText) }
            }
        } icon: { Image(systemName: issue.severity == .error ? "xmark.circle.fill" : "exclamationmark.triangle.fill") }
        .foregroundStyle(EQColor.warning).accessibilityElement(children: .combine)
    }
}

#if DEBUG
#Preview("Import Simple") { NavigationStack { WorkoutImportInputView(initialText: WorkoutImportFixtures.simple) { _ in } }.preferredColorScheme(.dark) }
#Preview("Import Malformed") { NavigationStack { WorkoutImportInputView(initialText: WorkoutImportFixtures.malformed) { _ in } }.preferredColorScheme(.dark) }
#Preview("Import Long Large Type") { NavigationStack { WorkoutImportInputView(initialText: WorkoutImportFixtures.longInput) { _ in } }.dynamicTypeSize(.accessibility3).preferredColorScheme(.dark) }
#endif
