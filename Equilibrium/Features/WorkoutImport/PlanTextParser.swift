import Foundation

struct ParsedSetPrescription: Hashable, Sendable {
    enum Target: Hashable, Sendable {
        case repetitions(ClosedRange<Int>)
        case duration(seconds: Int)
    }
    var target: Target
    var suggestedPounds: Double?
}

struct ParsedExercise: Identifiable, Hashable, Sendable {
    let id: UUID
    var name: String
    var prescriptions: [ParsedSetPrescription]
    var restDuration: TimeInterval?
    let lineNumber: Int
}

struct ParsedWorkout: Identifiable, Hashable, Sendable {
    let id: UUID
    var name: String
    var exercises: [ParsedExercise]
}

struct ParseIssue: Identifiable, Hashable, Sendable {
    enum Severity: String, Hashable, Sendable { case warning, error }
    let id: UUID
    let lineNumber: Int?
    let content: String?
    let message: String
    let severity: Severity
    init(lineNumber: Int? = nil, content: String? = nil, message: String, severity: Severity = .error) {
        id = UUID(); self.lineNumber = lineNumber; self.content = content; self.message = message; self.severity = severity
    }
}

struct PlanParseResult: Hashable, Sendable {
    var workouts: [ParsedWorkout]
    var issues: [ParseIssue]
    var hasBlockingIssues: Bool { workouts.isEmpty || issues.contains { $0.severity == .error } }
}

struct PlanTextParser: Sendable {
    func parse(_ rawText: String) -> PlanParseResult {
        let source = rawText.replacingOccurrences(of: "\r\n", with: "\n")
        guard !source.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            return .init(workouts: [], issues: [.init(message: "Paste at least one workout and exercise.")])
        }
        let lines = source.components(separatedBy: "\n")
        var workouts: [ParsedWorkout] = []
        var current: ParsedWorkout?
        var issues: [ParseIssue] = []

        func nextMeaningfulLine(after index: Int) -> String? {
            guard index + 1 < lines.count else { return nil }
            return lines[(index + 1)...].first { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }?.trimmingCharacters(in: .whitespacesAndNewlines)
        }
        func finishCurrent() {
            guard let value = current else { return }
            if value.exercises.isEmpty {
                issues.append(.init(message: "Workout “\(value.name.isEmpty ? "Untitled Workout" : value.name)” has no valid exercises."))
            } else { workouts.append(value) }
            current = nil
        }

        for (index, rawLine) in lines.enumerated() {
            let lineNumber = index + 1
            let line = rawLine.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !line.isEmpty else { continue }
            if isUnsupported(line) {
                issues.append(.init(lineNumber: lineNumber, content: line, message: "Unsupported grouping or workout semantics. Import exercises as individual prescriptions.", severity: .warning))
                continue
            }
            if let heading = headingName(line) {
                finishCurrent(); current = .init(id: UUID(), name: heading, exercises: []); continue
            }
            if let exercise = parseExercise(line, lineNumber: lineNumber) {
                if current == nil { current = .init(id: UUID(), name: "", exercises: []) }
                current?.exercises.append(exercise); continue
            }
            let followsBlank = index == 0 || lines[index - 1].trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            if followsBlank, let next = nextMeaningfulLine(after: index), parseExercise(next, lineNumber: lineNumber + 1) != nil, !looksMalformed(line) {
                finishCurrent(); current = .init(id: UUID(), name: cleanHeading(line), exercises: []); continue
            }
            let message = looksMalformed(line) ? "Malformed or invalid set prescription." : "Line is not a supported workout heading or exercise prescription."
            issues.append(.init(lineNumber: lineNumber, content: line, message: message))
        }
        finishCurrent()
        if workouts.isEmpty, issues.isEmpty { issues.append(.init(message: "No valid exercises were found.")) }
        return .init(workouts: workouts, issues: issues)
    }

    private func parseExercise(_ source: String, lineNumber: Int) -> ParsedExercise? {
        var line = source.replacingOccurrences(of: #"^\s*[-•*]\s*"#, with: "", options: .regularExpression)
        let rest = capture(#"(?i)\brest\s*[:=]?\s*(\d+)\s*(?:s|sec|secs|seconds?)\b"#, in: line).flatMap { Double($0[1]) }
        line = line.replacingOccurrences(of: #"(?i)\s*[,;]?\s*rest\s*[:=]?\s*\d+\s*(?:s|sec|secs|seconds?)\b"#, with: "", options: .regularExpression)
        var pounds: Double?
        if let weight = capture(#"(?i)@\s*(\d+(?:\.\d+)?)\s*(lb|lbs|kg|kgs)\b"#, in: line), let value = Double(weight[1]) {
            pounds = Weight(value, unit: weight[2].lowercased().hasPrefix("kg") ? .kilograms : .pounds).pounds
            line = line.replacingOccurrences(of: #"(?i)\s*@\s*\d+(?:\.\d+)?\s*(?:lb|lbs|kg|kgs)\b"#, with: "", options: .regularExpression)
        }
        let patterns = [
            #"^(.+?)\s*(?:—|-|:)?\s*(\d+)\s*[x×]\s*(\d+)\s*(?:-|–|\.\.)\s*(\d+)\s*(?:reps?)?$"#,
            #"^(.+?)\s*(?:—|-|:)?\s*(\d+)\s*[x×]\s*(\d+)\s*(sec|secs|seconds?|min|mins|minutes?)\.?$"#,
            #"^(.+?)\s*(?:—|-|:)?\s*(\d+)\s*[x×]\s*(\d+)\s*(?:reps?)?$"#,
            #"^(.+?)\s*(?:—|-|:)?\s*(\d+)\s+sets?\s+of\s+(\d+)\s*(?:reps?)?$"#,
            #"^(\d+)\s*[x×]\s*(\d+)\s*(?:-|–|\.\.)\s*(\d+)\s+(.+)$"#,
            #"^(\d+)\s*[x×]\s*(\d+)\s+(.+)$"#
        ]
        for (patternIndex, pattern) in patterns.enumerated() {
            guard let match = capture(pattern, in: line, caseInsensitive: true) else { continue }
            let name: String; let sets: Int; let target: ParsedSetPrescription.Target
            switch patternIndex {
            case 0:
                name = match[1]; sets = Int(match[2]) ?? 0
                let low = Int(match[3]) ?? 0, high = Int(match[4]) ?? 0; target = .repetitions(min(low, high)...max(low, high))
            case 1:
                name = match[1]; sets = Int(match[2]) ?? 0; let amount = Int(match[3]) ?? 0
                target = .duration(seconds: match[4].lowercased().hasPrefix("min") ? amount * 60 : amount)
            case 2, 3:
                name = match[1]; sets = Int(match[2]) ?? 0; let reps = Int(match[3]) ?? 0; target = .repetitions(reps...reps)
            case 4:
                sets = Int(match[1]) ?? 0; let low = Int(match[2]) ?? 0, high = Int(match[3]) ?? 0; name = match[4]; target = .repetitions(min(low, high)...max(low, high))
            default:
                sets = Int(match[1]) ?? 0; let reps = Int(match[2]) ?? 0; name = match[3]; target = .repetitions(reps...reps)
            }
            let cleanName = name.trimmingCharacters(in: CharacterSet.whitespacesAndNewlines.union(CharacterSet(charactersIn: "—-:")))
            guard sets > 0, sets <= 99, valid(target), !cleanName.isEmpty else { return nil }
            let prescription = ParsedSetPrescription(target: target, suggestedPounds: pounds)
            return .init(id: UUID(), name: cleanName, prescriptions: Array(repeating: prescription, count: sets), restDuration: rest, lineNumber: lineNumber)
        }
        return nil
    }

    private func valid(_ target: ParsedSetPrescription.Target) -> Bool {
        switch target { case .repetitions(let range): return range.lowerBound > 0 && range.upperBound <= 999; case .duration(let seconds): return seconds > 0 && seconds <= 86_400 }
    }
    private func isUnsupported(_ line: String) -> Bool { line.range(of: #"(?i)\b(superset|circuit|rounds?|hiit|warm[ -]?up|accessor(?:y|ies)|per side)\b"#, options: .regularExpression) != nil }
    private func looksMalformed(_ line: String) -> Bool { line.range(of: #"(?i)\d\s*[x×]|\bsets?\b|@\s*\d|\brest\b"#, options: .regularExpression) != nil }
    private func headingName(_ line: String) -> String? {
        if line.range(of: #"(?i)^day\s*\d+\b"#, options: .regularExpression) != nil {
            let cleaned = line.replacingOccurrences(of: #"(?i)^day\s*\d+\s*(?:—|-|:)?\s*"#, with: "", options: .regularExpression)
            return cleaned.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? cleanHeading(line) : cleanHeading(cleaned)
        }
        if line.range(of: #"(?i)^(push|pull|legs?|upper|lower|full\s*body|chest|back|shoulders?|arms?|core)$"#, options: .regularExpression) != nil { return cleanHeading(line) }
        return nil
    }
    private func cleanHeading(_ line: String) -> String { line.trimmingCharacters(in: CharacterSet.whitespacesAndNewlines.union(CharacterSet(charactersIn: "—-:"))) }
    private func capture(_ pattern: String, in value: String, caseInsensitive: Bool = false) -> [String]? {
        let options: NSRegularExpression.Options = caseInsensitive ? [.caseInsensitive] : []
        guard let regex = try? NSRegularExpression(pattern: pattern, options: options), let match = regex.firstMatch(in: value, range: NSRange(value.startIndex..., in: value)) else { return nil }
        return (0..<match.numberOfRanges).map { rangeIndex in
            let range = match.range(at: rangeIndex); guard range.location != NSNotFound, let swiftRange = Range(range, in: value) else { return "" }; return String(value[swiftRange])
        }
    }
}
