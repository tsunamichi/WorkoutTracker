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
                WorkoutImportInputView(initialText: initialText, message: fallbackMessage) { result in Task { await open(result) } }
            } else { ProgressView("Reading clipboard") }
        }
        .task { await readClipboard() }
    }
    private func readClipboard() async {
        let value = UIPasteboard.general.string ?? ""
        initialText = value
        let result = WorkoutTextParser().parse(value)
        guard !result.hasBlockingIssues, result.workouts.count == 1, result.workouts.allSatisfy({ !$0.name.isEmpty }) else {
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
    let message: String?
    let parsed: (WorkoutParseResult) -> Void
    @State private var title: String
    @State private var text: String
    @State private var issues: [ParseIssue] = []
    @FocusState private var focusedField: Field?
    private enum Field { case title, body }

    init(initialText: String = "", message: String? = nil, parsed: @escaping (WorkoutParseResult) -> Void) {
        self.message = message
        self.parsed = parsed
        let split = WorkoutTextParser().splitTitle(initialText)
        _title = State(initialValue: split.title)
        _text = State(initialValue: split.body)
    }

    private var canParse: Bool { !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Paste workout")
                .eqTextStyle(.navigationTitle)
                .frame(maxWidth: .infinity, minHeight: EQLayout.minimumTouch + EQSpacing.sm, alignment: .leading)
                .padding(.horizontal, EQLayout.screenGutter)
                .padding(.top, EQSpacing.md)
                .accessibilityAddTraits(.isHeader)
            ScrollView {
                VStack(alignment: .leading, spacing: EQLayout.exerciseBlockGap) {
                    if let message {
                        Text(message).eqTextStyle(.secondaryBody).foregroundStyle(EQColor.warning)
                    }
                    section("TITLE") {
                        card {
                            TextField("Workout title", text: $title)
                                .eqTextStyle(.listItemTitle)
                                .focused($focusedField, equals: .title)
                                .submitLabel(.next)
                                .onSubmit { focusedField = .body }
                                .frame(minHeight: EQLayout.minimumTouch)
                                .accessibilityLabel("Workout title")
                        }
                    }
                    section("EXERCISES") {
                        card {
                            TextEditor(text: $text)
                                .eqTextStyle(.listItemTitle)
                                .scrollContentBackground(.hidden)
                                // TextEditor insets its text by ~5pt; align it with the title field.
                                .padding(.horizontal, -5)
                                .frame(minHeight: editorMinimumHeight)
                                .focused($focusedField, equals: .body)
                                .accessibilityLabel("Exercises")
                                .accessibilityHint("One exercise per line with sets and repetitions or duration.")
                        }
                    }
                    if !issues.isEmpty {
                        section("NEEDS CORRECTION") {
                            card {
                                VStack(alignment: .leading, spacing: EQSpacing.sm) { ForEach(issues) { ParseIssueRow(issue: $0) } }
                                    .padding(.vertical, EQSpacing.xs)
                            }
                        }
                    }
                    Button { parse() } label: {
                        Text("Parse and Review")
                            .frame(maxWidth: .infinity, minHeight: EQLayout.minimumTouch + EQSpacing.xs)
                            .contentShape(Rectangle())
                    }
                    .eqPrimaryCTA(
                        tint: canParse ? EQColor.ctaSurface : EQColor.ctaDisabledSurface,
                        foreground: canParse ? EQColor.ctaLabel : EQColor.ctaDisabledLabel
                    )
                    .disabled(!canParse)
                }
                .padding(.horizontal, EQLayout.screenGutter)
                .padding(.top, EQSpacing.md)
                .padding(.bottom, EQSpacing.lg)
            }
            .scrollIndicators(.hidden)
            .scrollDismissesKeyboard(.interactively)
        }
        .foregroundStyle(EQColor.primaryText)
        .background(EQColor.canvas.ignoresSafeArea())
        .toolbar(.hidden, for: .navigationBar)
        .onAppear { if message != nil, canParse { parse(submit: false) } }
        .toolbar { ToolbarItemGroup(placement: .keyboard) { Spacer(); Button("Done") { focusedField = nil } } }
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

    private func parse(submit: Bool = true) {
        var result = WorkoutTextParser().parse(text)
        let name = title.trimmingCharacters(in: .whitespacesAndNewlines)
        if !name.isEmpty {
            if result.workouts.count == 1 { result.workouts[0].name = name }
            else { for index in result.workouts.indices where result.workouts[index].name.isEmpty { result.workouts[index].name = name } }
        }
        if result.workouts.contains(where: { $0.name.isEmpty }) {
            result.issues.insert(.init(message: "Add a workout title."), at: 0)
        }
        if result.hasBlockingIssues || result.workouts.contains(where: { $0.name.isEmpty }) {
            issues = result.issues
            if submit { focusedField = name.isEmpty ? .title : .body }
        } else if submit { issues = []; parsed(result) }
    }
}

struct ParseIssueRow: View {
    let issue: ParseIssue
    var body: some View {
        Label {
            VStack(alignment: .leading, spacing: EQSpacing.xxs) {
                Text(issue.lineNumber.map { "Line \($0): \(issue.message)" } ?? issue.message)
                if let content = issue.content { Text(content).eqTextStyle(.caption).foregroundStyle(EQColor.secondaryText) }
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
