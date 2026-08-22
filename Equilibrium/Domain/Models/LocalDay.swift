import Foundation

public struct LocalDay: Hashable, Codable, Sendable, Comparable, CustomStringConvertible {
    public let year: Int
    public let month: Int
    public let day: Int

    public init(year: Int, month: Int, day: Int) throws {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(secondsFromGMT: 0)!
        let components = DateComponents(calendar: calendar, timeZone: calendar.timeZone, year: year, month: month, day: day)
        guard let date = calendar.date(from: components) else { throw LocalDayError.invalidDate }
        let checked = calendar.dateComponents([.year, .month, .day], from: date)
        guard checked.year == year, checked.month == month, checked.day == day else { throw LocalDayError.invalidDate }
        self.year = year; self.month = month; self.day = day
    }

    public init(_ value: String) throws {
        guard value.range(of: #"^\d{4}-\d{2}-\d{2}$"#, options: .regularExpression) != nil else { throw LocalDayError.invalidFormat }
        let parts = value.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { throw LocalDayError.invalidFormat }
        try self.init(year: parts[0], month: parts[1], day: parts[2])
    }

    public init(date: Date, calendar: Calendar) throws {
        let parts = calendar.dateComponents([.year, .month, .day], from: date)
        guard let year = parts.year, let month = parts.month, let day = parts.day else { throw LocalDayError.invalidDate }
        try self.init(year: year, month: month, day: day)
    }

    public var iso8601: String { String(format: "%04d-%02d-%02d", year, month, day) }
    public var description: String { iso8601 }
    public func date(in calendar: Calendar, hour: Int = 12) -> Date? { calendar.date(from: DateComponents(year: year, month: month, day: day, hour: hour)) }
    public static func < (lhs: Self, rhs: Self) -> Bool { (lhs.year, lhs.month, lhs.day) < (rhs.year, rhs.month, rhs.day) }
    public init(from decoder: Decoder) throws { try self.init(try decoder.singleValueContainer().decode(String.self)) }
    public func encode(to encoder: Encoder) throws { var c = encoder.singleValueContainer(); try c.encode(iso8601) }
}

public enum LocalDayError: Error, Equatable { case invalidFormat, invalidDate }
