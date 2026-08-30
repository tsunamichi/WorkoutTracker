import Foundation
import SwiftData

enum WorkoutMapper {
    static func record(from workout: Workout) -> WorkoutRecord {
        let exercises = workout.exercises.enumerated().map { exerciseIndex, exercise in
            let prescriptions = exercise.prescriptions.enumerated().map { index, prescription -> PrescriptionRecord in
                switch prescription.target {
                case .repetitions(let range):
                    return PrescriptionRecord(id: prescription.id.rawValue, position: index, targetKind: "repetitions", lowerRepetitions: range.lowerBound, upperRepetitions: range.upperBound, duration: nil, suggestedPounds: prescription.suggestedWeight?.pounds, updatedAt: workout.updatedAt)
                case .duration(let seconds):
                    return PrescriptionRecord(id: prescription.id.rawValue, position: index, targetKind: "duration", lowerRepetitions: nil, upperRepetitions: nil, duration: seconds, suggestedPounds: prescription.suggestedWeight?.pounds, updatedAt: workout.updatedAt)
                }
            }
            let logged = exercise.loggedSets.enumerated().map { index, set in
                LoggedSetRecord(id: set.id.rawValue, prescriptionID: set.prescriptionID?.rawValue, position: index, pounds: set.weight?.pounds, repetitions: set.repetitions, duration: set.duration, completedAt: set.completedAt, updatedAt: workout.updatedAt)
            }
            return WorkoutExerciseRecord(id: exercise.id.rawValue, exerciseID: exercise.exerciseID.rawValue, nameSnapshot: exercise.nameSnapshot, position: exerciseIndex, restDuration: exercise.restDuration, skippedAt: exercise.skippedAt, isTimeBased: exercise.isTimeBased, isTwoSided: exercise.isTwoSided, updatedAt: workout.updatedAt, prescriptions: prescriptions, loggedSets: logged)
        }
        return WorkoutRecord(id: workout.id.rawValue, titleSnapshot: workout.titleSnapshot, statusRaw: workout.status.rawValue, startedAt: workout.startedAt, completedAt: workout.completedAt, createdAt: workout.createdAt, updatedAt: workout.updatedAt, exercises: exercises)
    }

    static func domain(from record: WorkoutRecord) throws -> Workout {
        let exercises = canonical(record.exercises ?? [], id: \WorkoutExerciseRecord.id, updatedAt: \WorkoutExerciseRecord.updatedAt).sorted { $0.position < $1.position }.map { record in
            let prescriptions = canonical(record.prescriptions ?? [], id: \PrescriptionRecord.id, updatedAt: \PrescriptionRecord.updatedAt).sorted { $0.position < $1.position }.compactMap { item -> SetPrescription? in
                let target: SetTarget
                if item.targetKind == "repetitions", let low = item.lowerRepetitions, let high = item.upperRepetitions { target = .repetitions(range: low...high) }
                else if item.targetKind == "duration", let duration = item.duration { target = .duration(seconds: duration) }
                else { return nil }
                return SetPrescription(id: SetID(rawValue: item.id), target: target, suggestedWeight: item.suggestedPounds.map(Weight.init(pounds:)))
            }
            let sets = canonical(record.loggedSets ?? [], id: \LoggedSetRecord.id, updatedAt: \LoggedSetRecord.updatedAt).sorted { $0.position < $1.position }.map { item in
                LoggedSet(id: SetID(rawValue: item.id), prescriptionID: item.prescriptionID.map(SetID.init(rawValue:)), weight: item.pounds.map(Weight.init(pounds:)), repetitions: item.repetitions, duration: item.duration, completedAt: item.completedAt)
            }
            return WorkoutExercise(id: WorkoutExerciseID(rawValue: record.id), exerciseID: ExerciseID(rawValue: record.exerciseID), nameSnapshot: record.nameSnapshot, prescriptions: prescriptions, loggedSets: sets, restDuration: record.restDuration, skippedAt: record.skippedAt, isTimeBased: record.isTimeBased, isTwoSided: record.isTwoSided)
        }
        guard let status = WorkoutStatus(rawValue: record.statusRaw) else { throw RepositoryError.invalidBackup }
        return Workout(id: WorkoutID(rawValue: record.id), titleSnapshot: record.titleSnapshot, exercises: exercises, status: status, startedAt: record.startedAt, completedAt: record.completedAt, createdAt: record.createdAt, updatedAt: record.updatedAt)
    }

    private static func canonical<T: PersistentModel>(_ values: [T], id: KeyPath<T, String>, updatedAt: KeyPath<T, Date>) -> [T] {
        Dictionary(grouping: values, by: { $0[keyPath: id] }).values.compactMap { records in
            records.max { lhs, rhs in
                let left = lhs[keyPath: updatedAt], right = rhs[keyPath: updatedAt]
                return left == right ? String(describing: lhs.persistentModelID) < String(describing: rhs.persistentModelID) : left < right
            }
        }
    }
}
