import SwiftUI

struct FoundationSpikeView: View {
    @Namespace private var transitionNamespace
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    private let fixture = EquilibriumFixtures.mixed()

    var body: some View {
        NavigationStack {
            ZStack {
                EQColor.canvas.ignoresSafeArea()
                VStack(alignment: .leading, spacing: EQSpacing.lg) {
                    Text("Equilibrium").font(EQTypography.title).foregroundStyle(EQColor.primaryText)
                    Text("Native foundation spike").font(EQTypography.body).foregroundStyle(EQColor.secondaryText)
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
            Text(workout.titleSnapshot).font(EQTypography.cardTitle).foregroundStyle(EQColor.primaryText)
            Text("\(workout.exercises.count) exercises · fixture data").font(EQTypography.caption).foregroundStyle(EQColor.secondaryText)
            Divider().overlay(EQColor.separator)
            Text("Open transition proof").font(EQTypography.body).foregroundStyle(EQColor.accent)
        }.padding(EQSpacing.md).frame(maxWidth: .infinity, alignment: .leading).background(EQColor.surface, in: RoundedRectangle(cornerRadius: EQRadius.card, style: .continuous))
    }
}

private struct FoundationDetailView: View {
    let workout: Workout
    var body: some View {
        ZStack {
            EQColor.canvas.ignoresSafeArea()
            VStack(alignment: .leading, spacing: EQSpacing.md) {
                Text(workout.titleSnapshot).font(EQTypography.title)
                Text("Development-only navigation and persistence foundation. This is not Workout Execution.").foregroundStyle(EQColor.secondaryText)
                ForEach(workout.exercises) { exercise in Text(exercise.nameSnapshot).padding().frame(maxWidth: .infinity, alignment: .leading).background(EQColor.elevatedSurface, in: RoundedRectangle(cornerRadius: EQRadius.control)) }
                Spacer()
            }.padding(EQSpacing.lg)
        }.foregroundStyle(EQColor.primaryText).navigationTitle("Foundation Detail").navigationBarTitleDisplayMode(.inline)
    }
}
