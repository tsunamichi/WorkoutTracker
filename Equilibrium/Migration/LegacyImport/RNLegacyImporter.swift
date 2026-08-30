import Foundation

public struct LegacyImportResult: Equatable, Sendable {
    public let exercisesImported: Int
    public let workoutsImported: Int
    public let timersImported: Int
    public let skippedMalformed: Int
}

@MainActor
final class RNLegacyImporter {
    private let repository: SwiftDataRepository
    init(repository: SwiftDataRepository) { self.repository = repository }

    func importFileData(_ data: Data, importedAt: Date = .now) throws -> LegacyImportResult {
        let materialization = try RNLegacyTransformer.transform(data: data)
        return try repository.importLegacyRN(materialization, importedAt: importedAt)
    }
}
