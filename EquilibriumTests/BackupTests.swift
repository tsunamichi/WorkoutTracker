import XCTest
@testable import Equilibrium

@MainActor
final class BackupTests: XCTestCase {
    func testDeterministicBackupCodecAndGoldenDecode() throws {
        let backup = try EquilibriumFixtures.backup()
        XCTAssertEqual(try BackupCodec.encode(backup), try BackupCodec.encode(backup))
        let decoded = try BackupCodec.decode(BackupCodec.encode(backup))
        XCTAssertEqual(decoded.schemaVersion, 1)
        XCTAssertEqual(decoded.scheduledWorkouts, backup.scheduledWorkouts)
        let url = try XCTUnwrap(Bundle(for: Self.self).url(forResource: "equilibrium-backup-v1.golden", withExtension: "json"))
        let golden = try BackupCodec.decode(Data(contentsOf: url))
        XCTAssertEqual(golden.schemaVersion, 1); XCTAssertFalse(golden.scheduledWorkouts.isEmpty)
    }

    func testBackupRestoreIntoFreshContainerIsEquivalent() async throws {
        let backup = try EquilibriumFixtures.backup()
        let fresh = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        try await fresh.restoreBackup(backup)
        let exported = try await fresh.exportBackup(exportedAt: backup.exportedAt, sourceDeviceID: backup.sourceDeviceID)
        XCTAssertEqual(exported.exercises, backup.exercises); XCTAssertEqual(exported.workoutTemplates, backup.workoutTemplates)
        XCTAssertEqual(exported.scheduledWorkouts, backup.scheduledWorkouts); XCTAssertEqual(exported.cyclePlans, backup.cyclePlans)
        XCTAssertEqual(exported.settings, backup.settings); XCTAssertEqual(exported.progression, backup.progression)
    }
}
