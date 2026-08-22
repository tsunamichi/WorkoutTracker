import Foundation

public enum BackupCodec {
    public static func encode(_ backup: EquilibriumBackupV1) throws -> Data {
        guard backup.schemaVersion == 1 else { throw BackupError.unsupportedSchemaVersion(backup.schemaVersion) }
        let encoder = JSONEncoder(); encoder.outputFormatting = [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes]
        encoder.dateEncodingStrategy = .millisecondsSince1970
        return try encoder.encode(backup)
    }
    public static func decode(_ data: Data) throws -> EquilibriumBackupV1 {
        let decoder = JSONDecoder(); decoder.dateDecodingStrategy = .millisecondsSince1970
        let backup = try decoder.decode(EquilibriumBackupV1.self, from: data)
        guard backup.schemaVersion == 1 else { throw BackupError.unsupportedSchemaVersion(backup.schemaVersion) }
        return backup
    }
}
