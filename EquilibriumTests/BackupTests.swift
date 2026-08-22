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
        let expectedWorkouts = backup.scheduledWorkouts.sorted { lhs, rhs in lhs.day == rhs.day ? (lhs.createdAt == rhs.createdAt ? lhs.id.rawValue < rhs.id.rawValue : lhs.createdAt < rhs.createdAt) : lhs.day < rhs.day }
        XCTAssertEqual(exported.scheduledWorkouts, expectedWorkouts); XCTAssertEqual(exported.cyclePlans, backup.cyclePlans)
        XCTAssertEqual(exported.settings, backup.settings); XCTAssertEqual(exported.progression, backup.progression)
    }

    func testBackupRoundTripPreservesSameDayMultiplicityAndOrder() async throws {
        let original = try EquilibriumFixtures.backup()
        let day = try LocalDay("2026-08-22")
        var first = EquilibriumFixtures.planned(day: day.iso8601, id: "backup-a")
        var second = EquilibriumFixtures.completed(day: day.iso8601, id: "backup-b")
        first.createdAt = .init(timeIntervalSince1970: 10); second.createdAt = .init(timeIntervalSince1970: 20)
        let backup = try EquilibriumBackupV1(exportedAt: original.exportedAt, sourceDeviceID: original.sourceDeviceID, exercises: original.exercises, workoutTemplates: original.workoutTemplates, scheduledWorkouts: [first, second], cyclePlans: original.cyclePlans, settings: original.settings, progression: original.progression)
        let fresh = SwiftDataRepository(container: try PersistenceController.makeContainer(inMemory: true))
        try await fresh.restoreBackup(backup)
        let restored = try await fresh.workouts(on: day)
        XCTAssertEqual(restored.map(\.id), [first.id, second.id])
    }
}
