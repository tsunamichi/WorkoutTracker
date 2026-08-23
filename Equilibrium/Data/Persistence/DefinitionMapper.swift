import Foundation

enum DefinitionMapper {
    static func record(from exercise: ExerciseDefinition) -> ExerciseDefinitionRecord {
        ExerciseDefinitionRecord(id: exercise.id.rawValue, name: exercise.name, normalizedName: exercise.normalizedName, aliases: exercise.aliases, equipment: exercise.equipment, category: exercise.category, isCustom: exercise.isCustom, archivedAt: exercise.archivedAt)
    }
    static func domain(from record: ExerciseDefinitionRecord) -> ExerciseDefinition {
        ExerciseDefinition(id: .init(rawValue: record.id), name: record.name, normalizedName: record.normalizedName, aliases: record.aliases, equipment: record.equipment, category: record.category, isCustom: record.isCustom, archivedAt: record.archivedAt)
    }
}
