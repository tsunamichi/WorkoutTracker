import XCTest
@testable import Equilibrium

@MainActor
final class BackupTests: XCTestCase {
    func testDeterministicBackupCodecRoundTrip() throws {
        let backup = try EquilibriumFixtures.backup()
        XCTAssertEqual(try BackupCodec.encode(backup), try BackupCodec.encode(backup))
        let decoded = try BackupCodec.decode(BackupCodec.encode(backup))
        XCTAssertEqual(decoded.schemaVersion, 2)
        XCTAssertEqual(decoded.workouts, backup.workouts)
    }

    func testBackupRestoreIntoFreshContainerIsEquivalent() async throws {
        let backup = try EquilibriumFixtures.backup()
        let fresh = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        try await fresh.restoreBackup(backup)
        let exported = try await fresh.exportBackup(exportedAt: backup.exportedAt, sourceDeviceID: backup.sourceDeviceID)
        XCTAssertEqual(exported.exercises, backup.exercises)
        let expectedWorkouts = backup.workouts.sorted { lhs, rhs in lhs.createdAt == rhs.createdAt ? lhs.id.rawValue < rhs.id.rawValue : lhs.createdAt < rhs.createdAt }
        XCTAssertEqual(exported.workouts, expectedWorkouts)
        XCTAssertEqual(exported.settings, backup.settings); XCTAssertEqual(exported.progression, backup.progression)
    }

    func testBackupRoundTripPreservesIndependentWorkoutOrder() async throws {
        let original = try EquilibriumFixtures.backup()
        var first = EquilibriumFixtures.ready(id: "backup-a")
        var second = EquilibriumFixtures.completed(id: "backup-b")
        first.createdAt = .init(timeIntervalSince1970: 10); second.createdAt = .init(timeIntervalSince1970: 20)
        let backup = try EquilibriumBackupV2(exportedAt: original.exportedAt, sourceDeviceID: original.sourceDeviceID, exercises: original.exercises, workouts: [first, second], settings: original.settings, progression: original.progression)
        let fresh = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        try await fresh.restoreBackup(backup)
        let restored = try await fresh.allWorkouts()
        XCTAssertEqual(restored.map(\.id), [first.id, second.id])
    }
}
