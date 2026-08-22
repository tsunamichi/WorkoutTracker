import Foundation

enum DefinitionMapper {
    static func record(from exercise: ExerciseDefinition) -> ExerciseDefinitionRecord {
        ExerciseDefinitionRecord(id: exercise.id.rawValue, name: exercise.name, normalizedName: exercise.normalizedName, aliases: exercise.aliases, equipment: exercise.equipment, category: exercise.category, isCustom: exercise.isCustom, archivedAt: exercise.archivedAt)
    }
    static func domain(from record: ExerciseDefinitionRecord) -> ExerciseDefinition {
        ExerciseDefinition(id: .init(rawValue: record.id), name: record.name, normalizedName: record.normalizedName, aliases: record.aliases, equipment: record.equipment, category: record.category, isCustom: record.isCustom, archivedAt: record.archivedAt)
    }
    static func record(from template: WorkoutTemplate) -> WorkoutTemplateRecord {
        WorkoutTemplateRecord(id: template.id.rawValue, name: template.name, createdAt: template.createdAt, updatedAt: template.updatedAt, archivedAt: template.archivedAt, exercises: template.exercises.enumerated().map { position, exercise in
            TemplateExerciseRecord(id: exercise.id.rawValue, exerciseID: exercise.exerciseID.rawValue, nameSnapshot: exercise.exerciseNameSnapshot, position: position, restDuration: exercise.restDuration, progressionRuleID: exercise.progressionRuleID?.rawValue, prescriptions: exercise.prescriptions.enumerated().map { index, prescription in prescriptionRecord(prescription, position: index) })
        })
    }
    static func domain(from record: WorkoutTemplateRecord) throws -> WorkoutTemplate {
        WorkoutTemplate(id: .init(rawValue: record.id), name: record.name, exercises: try record.exercises.sorted { $0.position < $1.position }.map { exercise in
            WorkoutExerciseDefinition(id: .init(rawValue: exercise.id), exerciseID: .init(rawValue: exercise.exerciseID), exerciseNameSnapshot: exercise.nameSnapshot, prescriptions: try exercise.prescriptions.sorted { $0.position < $1.position }.map(prescriptionDomain), restDuration: exercise.restDuration, progressionRuleID: exercise.progressionRuleID.map(ProgressionRuleID.init(rawValue:)))
        }, createdAt: record.createdAt, updatedAt: record.updatedAt, archivedAt: record.archivedAt)
    }
    private static func prescriptionRecord(_ value: SetPrescription, position: Int) -> TemplatePrescriptionRecord {
        switch value.target {
        case .repetitions(let range): return .init(id: value.id.rawValue, position: position, targetKind: "repetitions", lowerRepetitions: range.lowerBound, upperRepetitions: range.upperBound, duration: nil, suggestedPounds: value.suggestedWeight?.pounds)
        case .duration(let seconds): return .init(id: value.id.rawValue, position: position, targetKind: "duration", lowerRepetitions: nil, upperRepetitions: nil, duration: seconds, suggestedPounds: value.suggestedWeight?.pounds)
        }
    }
    private static func prescriptionDomain(_ value: TemplatePrescriptionRecord) throws -> SetPrescription {
        let target: SetTarget
        if value.targetKind == "repetitions", let lower = value.lowerRepetitions, let upper = value.upperRepetitions { target = .repetitions(range: lower...upper) }
        else if value.targetKind == "duration", let duration = value.duration { target = .duration(seconds: duration) }
        else { throw RepositoryError.invalidBackup }
        return .init(id: .init(rawValue: value.id), target: target, suggestedWeight: value.suggestedPounds.map(Weight.init(pounds:)))
    }
}
