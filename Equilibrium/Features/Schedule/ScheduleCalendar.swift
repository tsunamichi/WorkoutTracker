import Foundation

struct ScheduleCalendar: Sendable {
    var calendar: Calendar

    init(calendar: Calendar = .autoupdatingCurrent) {
        var value = calendar
        value.locale = .autoupdatingCurrent
        value.firstWeekday = 2
        value.minimumDaysInFirstWeek = 4
        self.calendar = value
    }

    func today(now: Date = .now) throws -> LocalDay { try LocalDay(date: now, calendar: calendar) }

    func week(containing day: LocalDay) throws -> [LocalDay] {
        guard let date = day.date(in: calendar), let interval = calendar.dateInterval(of: .weekOfYear, for: date) else {
            throw LocalDayError.invalidDate
        }
        return try (0..<7).map { offset in
            guard let date = calendar.date(byAdding: .day, value: offset, to: interval.start) else { throw LocalDayError.invalidDate }
            return try LocalDay(date: date, calendar: calendar)
        }
    }

    func moving(_ day: LocalDay, byWeeks amount: Int) throws -> LocalDay {
        guard let date = day.date(in: calendar), let moved = calendar.date(byAdding: .weekOfYear, value: amount, to: date) else { throw LocalDayError.invalidDate }
        return try LocalDay(date: moved, calendar: calendar)
    }

    func fullDate(_ day: LocalDay) -> String {
        guard let date = day.date(in: calendar) else { return day.iso8601 }
        return date.formatted(.dateTime.weekday(.wide).month(.wide).day().year())
    }
}
