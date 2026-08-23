import Foundation
@testable import Equilibrium

enum TestSupport {
    static func temporaryStoreURL() -> URL {
        FileManager.default.temporaryDirectory.appending(path: "equilibrium-\(UUID().uuidString).store")
    }
}
