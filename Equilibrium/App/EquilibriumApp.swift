import SwiftUI
import SwiftData

@main
struct EquilibriumApp: App {
    private let environment: AppEnvironment
    init() {
        do { environment = try AppEnvironment.live() }
        catch { fatalError("Unable to initialize Equilibrium persistence: \(error)") }
    }
    var body: some Scene {
        WindowGroup { FoundationSpikeView().environment(environment).preferredColorScheme(.dark) }
            .modelContainer(environment.container)
    }
}
