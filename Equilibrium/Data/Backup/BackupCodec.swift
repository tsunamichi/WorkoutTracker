import Foundation

public enum BackupCodec {
    public static func encode(_ backup: EquilibriumBackupV2) throws -> Data {
        guard backup.schemaVersion == 2 else { throw BackupError.unsupportedSchemaVersion(backup.schemaVersion) }
        let encoder = JSONEncoder(); encoder.outputFormatting = [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes]
        encoder.dateEncodingStrategy = .millisecondsSince1970
        return try encoder.encode(backup)
    }
    public static func decode(_ data: Data) throws -> EquilibriumBackupV2 {
        let decoder = JSONDecoder(); decoder.dateDecodingStrategy = .millisecondsSince1970
        let backup = try decoder.decode(EquilibriumBackupV2.self, from: data)
        guard backup.schemaVersion == 2 else { throw BackupError.unsupportedSchemaVersion(backup.schemaVersion) }
        return backup
    }
}
