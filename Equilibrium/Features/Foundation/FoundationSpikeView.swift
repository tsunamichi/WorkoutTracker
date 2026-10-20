import SwiftUI

struct FoundationSpikeView: View {
    @Namespace private var transitionNamespace
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    private let fixture = EquilibriumFixtures.mixed()

    var body: some View {
        NavigationStack {
            ZStack {
                EQColor.background.ignoresSafeArea()
                VStack(alignment: .leading, spacing: EQSpacing.lg) {
                    Text("Equilibrium").eqTextStyle(.screenTitle).foregroundStyle(EQColor.contentPrimary)
                    Text("Native foundation spike").eqTextStyle(.body).foregroundStyle(EQColor.contentSecondary)
                    NavigationLink(value: fixture.id) { WorkoutFixtureCard(workout: fixture) }
                        .buttonStyle(.plain)
                        .matchedTransitionSource(id: fixture.id.rawValue, in: transitionNamespace)
                    Spacer()
                }.padding(EQSpacing.lg)
            }
            .navigationDestination(for: WorkoutID.self) { _ in
                FoundationDetailView(workout: fixture)
                    .modifier(ZoomTransitionModifier(id: fixture.id.rawValue, namespace: transitionNamespace, reduceMotion: reduceMotion))
            }
        }.tint(EQColor.accent)
    }
}

private struct ZoomTransitionModifier: ViewModifier {
    let id: String; let namespace: Namespace.ID; let reduceMotion: Bool
    @ViewBuilder func body(content: Content) -> some View {
        if reduceMotion { content } else { content.navigationTransition(.zoom(sourceID: id, in: namespace)) }
    }
}

private struct WorkoutFixtureCard: View {
    let workout: Workout
    var body: some View {
        VStack(alignment: .leading, spacing: EQSpacing.sm) {
            Text(workout.titleSnapshot).eqTextStyle(.listItemTitle).foregroundStyle(EQColor.contentPrimary)
            Text("\(workout.exercises.count) exercises · fixture data").eqTextStyle(.caption).foregroundStyle(EQColor.contentSecondary)
            Divider().overlay(EQColor.surfaceHighlightLight)
            Text("Open transition proof").eqTextStyle(.body).foregroundStyle(EQColor.accent)
        }.padding(EQSpacing.md).frame(maxWidth: .infinity, alignment: .leading).background(EQColor.surface, in: RoundedRectangle(cornerRadius: EQRadius.card, style: .continuous))
    }
}

private struct FoundationDetailView: View {
    let workout: Workout
    var body: some View {
        ZStack {
            EQColor.background.ignoresSafeArea()
            VStack(alignment: .leading, spacing: EQSpacing.md) {
                Text(workout.titleSnapshot).eqTextStyle(.screenTitle)
                Text("Development-only navigation and persistence foundation. This is not Workout Execution.").foregroundStyle(EQColor.contentSecondary)
                ForEach(workout.exercises) { exercise in Text(exercise.nameSnapshot).padding().frame(maxWidth: .infinity, alignment: .leading).background(EQColor.surfaceEmphasis, in: RoundedRectangle(cornerRadius: EQRadius.control)) }
                Spacer()
            }.padding(EQSpacing.lg)
        }.foregroundStyle(EQColor.contentPrimary).navigationTitle("Foundation Detail").navigationBarTitleDisplayMode(.inline)
    }
}
