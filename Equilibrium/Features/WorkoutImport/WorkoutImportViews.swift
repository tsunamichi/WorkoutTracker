import Observation
import SwiftUI
import UIKit

struct ClipboardWorkoutImportView: View {
    let exercises: any ExerciseRepository
    let workouts: any WorkoutRepository
    let history: any ExerciseHistoryRepository
    let ready: ([Workout]) -> Void
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
        guard !result.workouts.isEmpty else { fallback = true; return }
        do { ready(try await WorkoutPasteMaterializer(exercises: exercises, workouts: workouts, history: history).materialize(result.workouts)) }
        catch { fallbackMessage = "The workouts could not be added. Try again."; fallback = true }
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
                Text("Paste one or more structured workouts. Each named workout will be added separately. Use one exercise per line with sets and repetitions or duration.")
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
