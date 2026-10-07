import SwiftUI

enum SharedExercisePickerMode: Equatable {
    case add(existingExerciseIDs: Set<ExerciseID>)
    case swap(existingExerciseIDs: Set<ExerciseID>, replacing: ExerciseID)

    var title: String {
        switch self {
        case .add: "Add Exercise"
        case .swap: "Swap Exercise"
        }
    }

    var isAdd: Bool {
        if case .add = self { return true }
        return false
    }

    func disabledReason(for exercise: ExerciseDefinition) -> String? {
        let existing: Set<ExerciseID>
        switch self {
        case .add(let ids), .swap(let ids, _): existing = ids
        }
        return existing.contains(exercise.id) ? "Already in workout" : nil
    }
}

enum ExercisePickerStyle {
    case standard
    case execution
}

struct ExercisePickerView: View {
    let repository: any ExerciseRepository
    let history: (any ExerciseHistoryRepository)?
    let mode: SharedExercisePickerMode
    let style: ExercisePickerStyle
    let selection: (ExerciseDefinition) -> Void
    @State private var catalog: [ExerciseDefinition] = []
    @State private var query = ""
    @State private var contexts: [ExerciseID: LatestExerciseLog] = [:]
    @State private var errorMessage: String?
    @State private var createsCustomExercise = false
    @FocusState private var searchIsFocused: Bool
    @Environment(\.dismiss) private var dismiss

    init(
        repository: any ExerciseRepository,
        history: (any ExerciseHistoryRepository)? = nil,
        mode: SharedExercisePickerMode = .add(existingExerciseIDs: []),
        style: ExercisePickerStyle = .standard,
        selection: @escaping (ExerciseDefinition) -> Void
    ) {
        self.repository = repository
        self.history = history
        self.mode = mode
        self.style = style
        self.selection = selection
    }

    var body: some View {
        NavigationStack {
            pickerContent
            .navigationDestination(isPresented: $createsCustomExercise) {
                CustomExerciseCreationView(repository: repository, initialName: cleanQuery, style: style) { exercise in
                    choose(exercise)
                }
                .toolbar(.visible, for: .navigationBar)
            }
            .alert("Exercise unavailable", isPresented: .init(get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } })) { Button("OK") {} } message: { Text(errorMessage ?? "") }
        }
        .presentationDetents(presentationDetents)
        .presentationDragIndicator(style == .execution && !mode.isAdd ? .hidden : .visible)
        .presentationBackground(pickerBackground)
        .presentationCornerRadius(EQRadius.sheet)
        .preferredColorScheme(.dark)
    }

    @ViewBuilder
    private var pickerContent: some View {
        if style == .execution {
            VStack(alignment: .leading, spacing: 0) {
                executionHeader
                executionSearchField
                executionExerciseList
            }
            .background(EQColor.Execution.foregroundSurface)
            .foregroundStyle(EQColor.Execution.foregroundText)
            .toolbar(.hidden, for: .navigationBar)
        } else {
            exerciseList
                .searchable(text: $query, placement: .navigationBarDrawer(displayMode: .always), prompt: "Search exercises and aliases")
                .background(EQColor.canvas)
                .navigationTitle(mode.title)
                .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } } }
        }
    }

    private var executionHeader: some View {
        HStack(alignment: .top, spacing: EQLayout.controlGap) {
            Text(mode.title)
                .eqTextStyle(.screenTitle)
                .frame(minHeight: EQLayout.minimumTouch)
                .accessibilityAddTraits(.isHeader)
            Spacer()
            if !mode.isAdd {
                Button { dismiss() } label: {
                    Image(systemName: "chevron.down")
                        .eqTextStyle(.icon)
                        .frame(width: EQLayout.iconSize, height: EQLayout.iconSize)
                        .frame(width: EQLayout.minimumTouch, height: EQLayout.minimumTouch, alignment: .trailing)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Close \(mode.title)")
            }
        }
        .padding(.horizontal, EQLayout.WorkoutExecution.walletInset)
        .padding(.top, EQSpacing.xl)
        .padding(.bottom, EQSpacing.lg)
    }

    private var executionSearchField: some View {
        HStack(spacing: EQSpacing.sm) {
            Image(systemName: "magnifyingglass")
                .symbolRenderingMode(.monochrome)
                .foregroundStyle(searchIconColor)
            TextField(
                "",
                text: $query,
                prompt: Text("Search exercises and aliases")
                    .foregroundStyle(EQColor.Execution.foregroundSecondaryText)
            )
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .foregroundStyle(EQColor.Execution.foregroundText)
                .focused($searchIsFocused)
        }
        .padding(.horizontal, EQSpacing.md)
        .frame(minHeight: EQLayout.minimumTouch + EQSpacing.xs)
        .background {
            RoundedRectangle(cornerRadius: EQRadius.control)
                .fill(Color.black.opacity(0.04))
        }
        .overlay {
            RoundedRectangle(cornerRadius: EQRadius.control)
                .stroke(searchBorderColor, lineWidth: 1.5)
        }
        .padding(.horizontal, EQLayout.WorkoutExecution.walletInset)
        .padding(.bottom, EQSpacing.md)
        .animation(.easeInOut(duration: 0.2), value: searchFieldIsActive)
    }

    private var exerciseList: some View {
        List {
            if offersCustomCreation {
                Button { createsCustomExercise = true } label: {
                    Label("Create \"\(cleanQuery)\"", systemImage: "plus.circle")
                        .frame(maxWidth: .infinity, minHeight: EQDimension.minimumTouch, alignment: .leading)
                }
                .listRowBackground(rowBackground)
                .listRowInsets(rowInsets)
                .listRowSeparator(.hidden)
            }
            if results.isEmpty, !offersCustomCreation {
                ContentUnavailableView.search(text: query)
                    .listRowBackground(Color.clear)
                    .listRowInsets(rowInsets)
                    .listRowSeparator(.hidden)
            }
            ForEach(results) { exercise in
                let disabledReason = mode.disabledReason(for: exercise)
                Button { choose(exercise) } label: {
                    HStack(spacing: EQLayout.controlGap) {
                        VStack(alignment: .leading, spacing: EQSpacing.xxs) {
                            Text(exercise.name).eqTextStyle(.listItemTitle).foregroundStyle(primaryText)
                            if let disabledReason {
                                Text(disabledReason).eqTextStyle(.caption).foregroundStyle(secondaryText)
                            } else if let context = contexts[exercise.id], let set = context.sets.last {
                                Text(contextText(set, date: context.occurredAt)).eqTextStyle(.caption).foregroundStyle(secondaryText)
                            }
                        }
                        Spacer(minLength: 0)
                    }
                    .frame(maxWidth: .infinity, minHeight: EQDimension.minimumTouch, alignment: .leading)
                }
                .disabled(disabledReason != nil)
                .accessibilityLabel(exercise.name)
                .accessibilityValue(disabledReason ?? "Available")
                .listRowBackground(rowBackground)
                .listRowInsets(rowInsets)
                .listRowSeparator(.hidden)
            }
        }
        .task { await load() }
        .scrollContentBackground(.hidden)
        .background(pickerBackground)
        .tint(primaryText)
    }

    private var executionExerciseList: some View {
        ScrollView {
            LazyVStack(spacing: 0) {
                if offersCustomCreation {
                    Button { createsCustomExercise = true } label: {
                        Label("Create \"\(cleanQuery)\"", systemImage: "plus.circle")
                            .frame(maxWidth: .infinity, minHeight: EQDimension.minimumTouch, alignment: .leading)
                    }
                    .buttonStyle(.plain)
                    .padding(.horizontal, EQSpacing.lg)
                }
                if results.isEmpty, !offersCustomCreation {
                    ContentUnavailableView.search(text: query)
                        .padding(.horizontal, EQSpacing.lg)
                }
                ForEach(results) { exercise in
                    executionExerciseRow(exercise)
                }
            }
        }
        .task { await load() }
        .background(EQColor.Execution.foregroundSurface)
        .tint(EQColor.Execution.foregroundText)
    }

    private func executionExerciseRow(_ exercise: ExerciseDefinition) -> some View {
        let disabledReason = mode.disabledReason(for: exercise)
        return Button { choose(exercise) } label: {
            HStack(spacing: EQLayout.controlGap) {
                VStack(alignment: .leading, spacing: EQSpacing.xxs) {
                    Text(exercise.name)
                        .eqTextStyle(.listItemTitle)
                        .foregroundStyle(EQColor.Execution.foregroundText)
                    if let disabledReason {
                        Text(disabledReason)
                            .eqTextStyle(.caption)
                            .foregroundStyle(EQColor.Execution.foregroundSecondaryText)
                    } else if let context = contexts[exercise.id], let set = context.sets.last {
                        Text(contextText(set, date: context.occurredAt))
                            .eqTextStyle(.caption)
                            .foregroundStyle(EQColor.Execution.foregroundSecondaryText)
                    }
                }
                Spacer(minLength: 0)
            }
            .frame(maxWidth: .infinity, minHeight: EQDimension.minimumTouch, alignment: .leading)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(disabledReason != nil)
        .accessibilityLabel(exercise.name)
        .accessibilityValue(disabledReason ?? "Available")
        .padding(.horizontal, EQSpacing.lg)
    }

    private var results: [ExerciseDefinition] {
        let matches = ExerciseResolver.search(query, in: catalog)
        guard cleanQuery.isEmpty else { return matches }
        return matches.filter { mode.disabledReason(for: $0) == nil }
    }
    private var cleanQuery: String { query.trimmingCharacters(in: .whitespacesAndNewlines) }
    private var searchFieldIsActive: Bool { searchIsFocused || !cleanQuery.isEmpty }
    private var searchIconColor: Color {
        searchFieldIsActive
            ? EQColor.Execution.foregroundText.opacity(1)
            : EQColor.Execution.foregroundSecondaryText
    }
    private var searchBorderColor: Color {
        searchFieldIsActive
            ? EQColor.Execution.foregroundText.opacity(1)
            : Color.black.opacity(0.08)
    }
    private var offersCustomCreation: Bool { !cleanQuery.isEmpty && results.isEmpty }
    private var presentationDetents: Set<PresentationDetent> {
        style == .execution && mode.isAdd ? [.fraction(0.95)] : [.large]
    }
    private var pickerBackground: Color { style == .execution ? EQColor.Execution.foregroundSurface : EQColor.canvas }
    private var rowBackground: Color { style == .execution ? .clear : EQColor.elevatedSurface }
    private var rowInsets: EdgeInsets {
        EdgeInsets(top: 0, leading: EQSpacing.lg, bottom: 0, trailing: EQSpacing.lg)
    }
    private var primaryText: Color { style == .execution ? EQColor.Execution.foregroundText : EQColor.primaryText }
    private var secondaryText: Color { style == .execution ? EQColor.Execution.foregroundSecondaryText : EQColor.secondaryText }

    private func load() async {
        do {
            catalog = try await repository.allExercises()
            guard let history else { return }
            var loaded: [ExerciseID: LatestExerciseLog] = [:]
            for result in catalog { if let value = try await history.latestExerciseLog(exerciseID: result.id) { loaded[result.id] = value } }
            contexts = loaded
        } catch { errorMessage = "Exercises could not be loaded." }
    }

    private func choose(_ exercise: ExerciseDefinition) { selection(exercise); dismiss() }

    private func contextText(_ set: LoggedSet, date: Date) -> String {
        let formatter = DateFormatter(); formatter.dateFormat = "MMM d"
        if let reps = set.repetitions { return "\(WeightText.value(set.weight, unit: .pounds)) lb × \(reps) · \(formatter.string(from: date))" }
        return "\(Int(set.duration ?? 0)) sec · \(formatter.string(from: date))"
    }
}

private struct CustomExerciseCreationView: View {
    private struct SimilarMatch: Identifiable {
        let id = UUID()
        let enteredName: String
        let matches: [ExerciseDefinition]
    }

    let repository: any ExerciseRepository
    let selection: (ExerciseDefinition) -> Void
    let style: ExercisePickerStyle
    @State private var name: String
    @State private var similarMatch: SimilarMatch?
    @State private var isSaving = false
    @State private var errorMessage: String?
    @Environment(\.dismiss) private var dismiss

    init(
        repository: any ExerciseRepository,
        initialName: String = "",
        style: ExercisePickerStyle = .standard,
        selection: @escaping (ExerciseDefinition) -> Void
    ) {
        self.repository = repository
        self.selection = selection
        self.style = style
        _name = State(initialValue: initialName)
    }

    var body: some View {
        Form {
            Section {
                TextField("Exercise name", text: $name)
                    .textInputAutocapitalization(.words)
                    .submitLabel(.done)
                    .onSubmit { Task { await submit() } }
            } footer: {
                Text("Names are checked against canonical exercises and aliases before a custom exercise is created.")
            }
            .listRowBackground(formBackground)
        }
        .scrollContentBackground(.hidden)
        .background(formBackground)
        .foregroundStyle(formText)
        .tint(formText)
        .navigationTitle("Custom Exercise")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
            ToolbarItem(placement: .confirmationAction) {
                Button("Create") { Task { await submit() } }
                    .disabled(cleanName.isEmpty || isSaving)
            }
        }
        .alert(item: $similarMatch) { match in
            Alert(
                title: Text("Similar exercise found"),
                message: Text(similarMessage(match.matches)),
                primaryButton: .default(Text("Use existing exercise")) {
                    Task { await useExisting(match) }
                },
                secondaryButton: .default(Text("Create a different exercise")) {
                    Task { await submit(createIfAmbiguous: true) }
                }
            )
        }
        .alert("Exercise unavailable", isPresented: .init(get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } })) {
            Button("OK") {}
        } message: {
            Text(errorMessage ?? "")
        }
    }

    private var cleanName: String { name.trimmingCharacters(in: .whitespacesAndNewlines) }
    private var formBackground: Color { style == .execution ? EQColor.Execution.foregroundSurface : EQColor.canvas }
    private var formText: Color { style == .execution ? EQColor.Execution.foregroundText : EQColor.primaryText }

    private func submit(createIfAmbiguous: Bool = false) async {
        guard !cleanName.isEmpty, !isSaving else { return }
        isSaving = true; defer { isSaving = false }
        do {
            switch try await repository.resolveCreationRequest(named: cleanName, createIfAmbiguous: createIfAmbiguous) {
            case .existing(let exercise), .created(let exercise): selection(exercise)
            case .confirmationRequired(let enteredName, let matches):
                similarMatch = .init(enteredName: enteredName, matches: matches)
            }
        } catch { errorMessage = "The exercise could not be created." }
    }

    private func useExisting(_ match: SimilarMatch) async {
        guard let exercise = match.matches.first else { return }
        do { selection(try await repository.learnAlias(match.enteredName, for: exercise)) }
        catch { errorMessage = "The exercise could not be updated." }
    }

    private func similarMessage(_ matches: [ExerciseDefinition]) -> String {
        let names = matches.prefix(3).map(\.name).joined(separator: ", ")
        return matches.count == 1 ? "Use \(names), or confirm that this is a different exercise." : "Possible matches: \(names). Use the closest match, or confirm that this is a different exercise."
    }
}

struct RecentWorkoutPicker: View {
    let repository: any WorkoutRepository; let selection: ([Workout]) -> Void
    let history: any ExerciseHistoryRepository
    init(repository: any WorkoutRepository, history: any ExerciseHistoryRepository, selection: @escaping ([Workout]) -> Void) { self.repository = repository; self.history = history; self.selection = selection }
    @State private var allValues: [Workout] = []; @State private var showsAll = false; @State private var selectedIDs: [WorkoutID] = []; @State private var failed = false; @State private var saving = false
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .center) {
                Text("Reuse workout")
                    .eqTextStyle(.screenTitle)
                    .foregroundStyle(EQColor.primaryText)
                Spacer(minLength: EQSpacing.sm)
                addButton
            }
                .padding(.horizontal, EQLayout.screenGutter)
                .padding(.top, EQLayout.Settings.sheetTopSpacing)
                .padding(.bottom, EQLayout.Settings.sheetTitleToContentSpacing)
            if values.isEmpty {
                ContentUnavailableView("No recent workouts", systemImage: "clock.arrow.circlepath", description: Text(failed ? "Recent workouts could not be loaded." : allValues.isEmpty ? "Completed workouts appear here." : "No workouts in the past 2 weeks."))
                    .foregroundStyle(EQColor.secondaryText)
                    .frame(maxHeight: .infinity)
            } else {
                // List cancels row taps when a drag turns into a scroll; a plain ScrollView can fire them.
                List(values) { value in
                    row(value)
                        .listRowInsets(.init(top: EQSpacing.xxs, leading: EQLayout.screenGutter, bottom: EQSpacing.xxs, trailing: EQLayout.screenGutter))
                        .listRowSeparator(.hidden)
                        .listRowBackground(Color.clear)
                }
                .listStyle(.plain)
                .scrollContentBackground(.hidden)
                .scrollIndicators(.hidden)
                .contentMargins(.bottom, EQSpacing.lg, for: .scrollContent)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .safeAreaInset(edge: .bottom, spacing: 0) { seeAllButton }
        .background(EQColor.elevatedSurface)
        .toolbar(.hidden, for: .navigationBar)
        .presentationDragIndicator(.visible)
        .presentationCornerRadius(EQRadius.sheet)
        .presentationBackground(EQColor.elevatedSurface)
        .task { do { allValues = try await repository.recentCompletedWorkouts(limit: .max) } catch { failed = true } }
    }
    private var values: [Workout] {
        if showsAll { return allValues }
        let cutoff = Calendar.current.date(byAdding: .day, value: -14, to: .now) ?? .distantPast
        return Workout.distinctRoutines(allValues.filter { ($0.completedAt ?? $0.startedAt ?? .distantPast) >= cutoff })
    }
    private func toggleShowsAll() {
        withAnimation(EQMotion.responsive) {
            showsAll.toggle()
            let visible = Set(values.map(\.id))
            selectedIDs.removeAll { !visible.contains($0) }
        }
    }
    private func row(_ value: Workout) -> some View {
        let selected = selectedIDs.contains(value.id)
        return Button { toggle(value.id) } label: {
            HStack(spacing: EQLayout.controlGap) {
                VStack(alignment: .leading, spacing: EQSpacing.xxs) {
                    Text(value.titleSnapshot).eqTextStyle(.listItemTitle).foregroundStyle(EQColor.primaryText).lineLimit(1)
                    detailText(value).eqTextStyle(.caption).foregroundStyle(EQColor.secondaryText).lineLimit(1)
                }
                Spacer(minLength: 0)
                Image(systemName: selected ? "checkmark.circle.fill" : "circle")
                    .eqTextStyle(.icon)
                    .foregroundStyle(selected ? EQColor.accent : EQColor.separator)
                    .frame(width: EQLayout.iconSize, height: EQLayout.iconSize)
            }
            .padding(EQSpacing.md)
            .frame(maxWidth: .infinity, minHeight: EQDimension.minimumTouch, alignment: .leading)
            .background(EQColor.cardFill, in: RoundedRectangle(cornerRadius: EQRadius.card, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: EQRadius.card, style: .continuous)
                    .strokeBorder(EQColor.accent, lineWidth: 1)
                    .opacity(selected ? 1 : 0)
            }
            .contentShape(RoundedRectangle(cornerRadius: EQRadius.card, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(value.titleSnapshot)
        .accessibilityValue(detail(value))
        .accessibilityAddTraits(selected ? .isSelected : [])
    }
    private var addButton: some View {
        let enabled = !selectedIDs.isEmpty && !saving
        return Button { Task { await addSelected() } } label: {
            Text(selectedIDs.count > 1 ? "Add \(selectedIDs.count)" : "Add")
                .lineLimit(1)
                .fixedSize()
                .padding(.horizontal, EQSpacing.md)
                .frame(height: 36)
        }
        .eqPrimaryCTA(
            tint: enabled ? EQColor.ctaSurface : EQColor.ctaDisabledSurface,
            foreground: enabled ? EQColor.ctaLabel : EQColor.ctaDisabledLabel
        )
        .frame(minHeight: EQDimension.minimumTouch)
        .contentShape(Rectangle())
        .disabled(!enabled)
        .animation(.easeOut(duration: 0.08), value: selectedIDs.count)
    }
    @ViewBuilder private var seeAllButton: some View {
        if !allValues.isEmpty {
            VStack(spacing: 0) {
                Text(showsAll ? "Showing every completed workout" : "Showing workouts from the past 2 weeks")
                    .eqTextStyle(.legal)
                    .foregroundStyle(EQColor.secondaryText)
                    .multilineTextAlignment(.center)
                Button(showsAll ? "Show less" : "See all") { toggleShowsAll() }
                    .eqTextStyle(.body)
                    .foregroundStyle(EQColor.accent)
                    .buttonStyle(.plain)
                    .frame(maxWidth: .infinity, minHeight: EQDimension.minimumTouch)
                    .contentShape(Rectangle())
            }
            .frame(maxWidth: .infinity)
            .padding(.horizontal, EQLayout.screenGutter)
            .padding(.top, EQSpacing.sm)
            .padding(.bottom, EQSpacing.xs)
            .background(EQColor.elevatedSurface)
        }
    }
    private func toggle(_ id: WorkoutID) {
        withAnimation(.easeOut(duration: 0.08)) {
            if selectedIDs.contains(id) { selectedIDs.removeAll { $0 == id } } else { selectedIDs.append(id) }
        }
        SystemHapticsClient().perform(.selection)
    }
    private func detailText(_ value: Workout) -> Text {
        let count = value.exercises.count
        let exercises = "\(count) \(count == 1 ? "exercise" : "exercises")"
        guard let date = value.completedAt ?? value.startedAt else { return Text(exercises) }
        return Text("\(EQDateText.text(date, style: .caption, includeYear: false)) · \(exercises)")
    }
    private func detail(_ value: Workout) -> String {
        let count = value.exercises.count
        let exercises = "\(count) \(count == 1 ? "exercise" : "exercises")"
        guard let date = value.completedAt ?? value.startedAt else { return exercises }
        return "\(EQDateText.string(date, includeYear: false)) · \(exercises)"
    }
    private func addSelected(now: Date = .now) async {
        saving = true; defer { saving = false }
        let chosen = selectedIDs.compactMap { id in allValues.first { $0.id == id } }
        do {
            var fresh: [Workout] = []
            for (index, historical) in chosen.enumerated() { fresh.append(try await historical.freshCopy(createdAt: now.addingTimeInterval(Double(index) / 1_000), history: history)) }
            try await repository.materializeAtomically(fresh); selection(fresh)
        } catch { failed = true }
    }
}

extension Workout {
    /// Collapses repeated runs of the same routine (same name and exercises) to its most recent run.
    /// Expects input sorted newest first.
    static func distinctRoutines(_ workouts: [Workout]) -> [Workout] {
        var seen = Set<String>()
        return workouts.filter { workout in
            let name = workout.titleSnapshot.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            return seen.insert(name).inserted
        }
    }

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
#Preview("Recent Workout") { NavigationStack { RecentWorkoutPicker(repository: pickerPreviewRepository, history: pickerPreviewRepository) { _ in } } }
#endif
