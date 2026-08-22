import Foundation
@testable import Equilibrium

enum TestSupport {
    static func temporaryStoreURL() -> URL {
        FileManager.default.temporaryDirectory.appending(path: "equilibrium-\(UUID().uuidString).store")
    }
}

struct FixedCurrentDayProvider: CurrentDayProviding {
    let day: LocalDay
    func currentDay() throws -> LocalDay { day }
}
