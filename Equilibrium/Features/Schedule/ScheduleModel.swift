import Foundation
import Observation

@MainActor @Observable
final class ScheduleModel {
    private let repository: any ScheduledWorkoutRepository
    private(set) var selectedDay: LocalDay
    private(set) var week: [LocalDay] = []
    private(set) var workoutsByDay: [LocalDay: ScheduledWorkout] = [:]
    private(set) var errorMessage: String?
    var isAddWorkoutPresented = false
    var isTimerPresented = false
    let calendar: ScheduleCalendar

    init(repository: any ScheduledWorkoutRepository, calendar: ScheduleCalendar = .init(), now: Date = .now) {
        self.repository = repository
        self.calendar = calendar
        selectedDay = (try? calendar.today(now: now)) ?? (try! LocalDay("2001-01-01"))
        week = (try? calendar.week(containing: selectedDay)) ?? [selectedDay]
    }

    var today: LocalDay { (try? calendar.today()) ?? selectedDay }
    var selectedWorkout: ScheduledWorkout? { workoutsByDay[selectedDay] }
    var isTodaySelected: Bool { selectedDay == today }

    func load() async {
        do {
            week = try calendar.week(containing: selectedDay)
            guard let first = week.first, let last = week.last else { return }
            let workouts = try await repository.workouts(from: first, through: last)
            workoutsByDay = Dictionary(uniqueKeysWithValues: workouts.map { ($0.day, $0) })
            errorMessage = nil
        } catch {
            errorMessage = "Schedule could not be loaded."
        }
    }

    func select(_ day: LocalDay) { selectedDay = day }

    func moveDay(_ amount: Int) async {
        do {
            selectedDay = try calendar.moving(selectedDay, byDays: amount)
            await load()
        } catch { errorMessage = "That day could not be opened." }
    }

    func moveWeek(_ amount: Int) async {
        do {
            selectedDay = try calendar.moving(selectedDay, byWeeks: amount)
            await load()
        } catch { errorMessage = "That week could not be opened." }
    }

    func selectToday() async {
        do { selectedDay = try calendar.today(); await load() }
        catch { errorMessage = "Today could not be selected." }
    }

    func applyPersistedWorkout(_ workout: ScheduledWorkout) {
        workoutsByDay[workout.day] = workout
    }
}

enum ScheduleCardAction: Equatable { case start, resume, view }

struct ScheduleCardPresentation: Equatable {
    let stateLabel: String
    let actionLabel: String
    let action: ScheduleCardAction

    init(status: WorkoutStatus) {
        switch status {
        case .planned: stateLabel = "Planned"; actionLabel = "Start workout"; action = .start
        case .inProgress: stateLabel = "In progress"; actionLabel = "Resume workout"; action = .resume
        case .completed: stateLabel = "Completed"; actionLabel = "View workout"; action = .view
        }
    }
}
