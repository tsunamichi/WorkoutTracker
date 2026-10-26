import Foundation

struct ParsedSetPrescription: Hashable, Sendable {
    enum Target: Hashable, Sendable { case repetitions(ClosedRange<Int>), duration(seconds: Int) }
    var target: Target
    var suggestedPounds: Double?
}

struct ParsedExercise: Identifiable, Hashable, Sendable {
    let id: UUID
    var name: String
    var prescriptions: [ParsedSetPrescription]
    var restDuration: TimeInterval?
    var isTimeBased: Bool
    var isTwoSided: Bool
    var reusableNotes: String?
    var workoutNotes: String?
    var youtubeVideoID: String?
    var groupIdentifier: String?
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

struct WorkoutParseResult: Hashable, Sendable {
    var workouts: [ParsedWorkout]
    var issues: [ParseIssue]
    var hasBlockingIssues: Bool { workouts.isEmpty || issues.contains { $0.severity == .error } }
}

/// Deterministic, loss-averse plain-text importer. It recognises an exercise
/// name followed by a prescription (on the same line or the next), then attaches
/// subsequent bullets and YouTube links to that exercise.
struct WorkoutTextParser: Sendable {
    func parse(_ rawText: String) -> WorkoutParseResult {
        let lines = rawText.replacingOccurrences(of: "\r\n", with: "\n").components(separatedBy: "\n")
        guard lines.contains(where: { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }) else {
            return .init(workouts: [], issues: [.init(message: "Paste at least one workout and exercise.")])
        }

        var workouts: [ParsedWorkout] = []
        var workout = ParsedWorkout(id: UUID(), name: "", exercises: [])
        var issues: [ParseIssue] = []
        var pendingName: (name: String, line: Int)?
        var currentGroup: String?
        var lastExerciseIndex: Int?

        func finishWorkout() {
            guard !workout.exercises.isEmpty else { return }
            workouts.append(workout)
        }

        func appendNote(_ value: String, reusable: Bool) {
            guard let index = lastExerciseIndex else { return }
            let existing = reusable ? workout.exercises[index].reusableNotes : workout.exercises[index].workoutNotes
            let joined = [existing, value].compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }.joined(separator: "\n")
            if reusable { workout.exercises[index].reusableNotes = joined.isEmpty ? nil : joined }
            else { workout.exercises[index].workoutNotes = joined.isEmpty ? nil : joined }
        }

        func appendExercise(name: String, prescription: PrescriptionParse, line: Int) {
            let cleanName = cleanName(name)
            guard !cleanName.isEmpty else { return }
            let values = Array(repeating: ParsedSetPrescription(target: prescription.target, suggestedPounds: prescription.suggestedPounds), count: prescription.sets)
            workout.exercises.append(.init(
                id: UUID(), name: cleanName, prescriptions: values, restDuration: prescription.restDuration,
                isTimeBased: prescription.isDuration || prescription.isUnilateral,
                isTwoSided: prescription.isUnilateral,
                reusableNotes: nil, workoutNotes: nil, youtubeVideoID: nil,
                groupIdentifier: currentGroup, lineNumber: line
            ))
            lastExerciseIndex = workout.exercises.indices.last
        }

        for (offset, rawLine) in lines.enumerated() {
            let lineNumber = offset + 1
            let line = rawLine.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !line.isEmpty else { continue }

            if line.range(of: #"(?i)\b(superset|circuit|rounds?|hiit)\b"#, options: .regularExpression) != nil {
                issues.append(.init(lineNumber: lineNumber, content: line, message: "Unsupported grouping or workout semantics. Import exercises as individual prescriptions.", severity: .warning))
                continue
            }

            if let day = headingName(line) {
                finishWorkout()
                workout = .init(id: UUID(), name: day, exercises: [])
                pendingName = nil
                currentGroup = nil
                lastExerciseIndex = nil
                continue
            }
            if let group = groupIdentifier(in: line) {
                pendingName = groupExerciseName(in: line).map { (name: $0, line: lineNumber) }
                currentGroup = group
                continue
            }
            if line.range(of: #"(?i)^#{1,6}\s*warmup\b|^warmup\b"#, options: .regularExpression) != nil {
                pendingName = nil
                currentGroup = "Warmup"
                continue
            }
            let exerciseLine = isBullet(line) ? stripBullet(line) : line
            if let inline = inlineExercise(in: exerciseLine) {
                appendExercise(name: inline.name, prescription: inline.prescription, line: lineNumber)
                pendingName = nil
                continue
            }
            if let prescription = prescription(in: line), let pending = pendingName {
                appendExercise(name: pending.name, prescription: prescription, line: pending.line)
                self.attachURLIfPresent(in: line, to: &workout, index: lastExerciseIndex)
                self.attachTrailingInstruction(in: line, to: &workout, index: lastExerciseIndex)
                pendingName = nil
                continue
            }
            if isBullet(line) {
                let text = stripBullet(line)
                if let videoID = youtubeVideoID(in: text), let index = lastExerciseIndex {
                    workout.exercises[index].youtubeVideoID = videoID
                } else if text.range(of: #"(?i)\bdemo(?:s)?\s*(?:\(\d+\))?\b"#, options: .regularExpression) != nil,
                          text.range(of: #"https?://"#, options: .regularExpression) == nil {
                    issues.append(.init(lineNumber: lineNumber, content: text, message: "A demo was referenced but no supported YouTube URL was provided.", severity: .warning))
                } else {
                    appendNote(text, reusable: !isWorkoutSpecificInstruction(text))
                }
                continue
            }
            if let videoID = youtubeVideoID(in: line), let index = lastExerciseIndex {
                workout.exercises[index].youtubeVideoID = videoID
                continue
            }
            if line.range(of: #"(?i)\bdemo(?:s)?\s*(?:\(\d+\))?\b"#, options: .regularExpression) != nil {
                issues.append(.init(lineNumber: lineNumber, content: line, message: "A demo was referenced but no supported YouTube URL was provided.", severity: .warning))
                continue
            }
            if let distanceName = distanceOnlyExercise(in: line) {
                // The current persisted SetTarget model has no distance case.
                // Keep the source text visible for correction rather than inventing reps.
                issues.append(.init(lineNumber: lineNumber, content: line, message: "Distance target “\(distanceName.target)” needs review; it was not converted to repetitions.", severity: .warning))
                pendingName = (distanceName.name, lineNumber)
                continue
            }
            if line.caseInsensitiveCompare("Down & Back") == .orderedSame, pendingName != nil {
                issues.append(.init(lineNumber: lineNumber, content: line, message: "Distance-style prescription needs review; no repetitions were invented.", severity: .warning))
                continue
            }
            if workout.name.isEmpty, workout.exercises.isEmpty, pendingName == nil, currentGroup == nil {
                workout.name = cleanName(line)
                continue
            }
            // Treat ordinary text as an exercise name only when it is not clearly
            // instructional prose. This is what permits name/prescription blocks.
            if (workout.name.isEmpty || currentGroup != nil || !line.localizedCaseInsensitiveContains("block")), !looksInstructional(line) {
                pendingName = (cleanName(line), lineNumber)
            } else {
                issues.append(.init(lineNumber: lineNumber, content: line, message: "Couldn’t find sets and reps. Use a format like “3×10” or “3×30 sec”."))
            }
        }

        finishWorkout()
        if workouts.isEmpty {
            issues.append(.init(message: "No valid exercises were found."))
            return .init(workouts: [], issues: issues)
        }
        return .init(workouts: workouts, issues: issues)
    }

    /// Splits a leading title line from exercise text for the existing import UI.
    func splitTitle(_ text: String) -> (title: String, body: String) {
        let lines = text.replacingOccurrences(of: "\r\n", with: "\n").components(separatedBy: "\n")
        guard let first = lines.firstIndex(where: { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }) else { return ("", text) }
        let title = lines[first].trimmingCharacters(in: .whitespacesAndNewlines)
        guard inlineExercise(in: title) == nil, prescription(in: title) == nil, !isBullet(title) else { return ("", text) }
        return (cleanName(title), lines.dropFirst(first + 1).drop(while: { $0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }).joined(separator: "\n"))
    }

    private struct PrescriptionParse {
        let sets: Int
        let target: ParsedSetPrescription.Target
        let suggestedPounds: Double?
        let restDuration: TimeInterval?
        let isUnilateral: Bool
        var isDuration: Bool { if case .duration = target { true } else { false } }
    }

    private func inlineExercise(in line: String) -> (name: String, prescription: PrescriptionParse)? {
        if let match = firstCapture(#"(?i)(\d+\s*[x×]\s*\d+(?:(?:\s*(?:-|–|\.\.)\s*)\d+)?(?:.*)$)"#, in: line),
           let range = Range(match.range, in: line) {
            let name = String(line[..<range.lowerBound]).trimmingCharacters(in: CharacterSet.whitespacesAndNewlines.union(CharacterSet(charactersIn: "—–-:")))
            if !name.isEmpty, let parsed = prescription(in: String(line[range])) { return (name, parsed) }
        }
        if let match = capture(#"(?i)^(.+?)(?:\s+(?:—|–|-)|\s*:)\s*(\d+)\s*(sec|secs|seconds?|s|min|mins|minutes?|reps?)?\.?$"#, in: line),
           let amount = Int(match[2]), amount > 0 {
            let unit = match[3].lowercased()
            let target: ParsedSetPrescription.Target = unit.isEmpty || unit.hasPrefix("rep")
                ? .repetitions(amount...amount)
                : .duration(seconds: unit.hasPrefix("m") ? amount * 60 : amount)
            return (cleanName(match[1]), .init(sets: 1, target: target, suggestedPounds: nil, restDuration: nil, isUnilateral: false))
        }
        return nil
    }

    private func prescription(in source: String) -> PrescriptionParse? {
        // A bare @ value is ambiguous (weight unit is required); do not silently
        // accept it as an exercise instruction.
        if source.range(of: #"(?i)@\s*\d+(?:\.\d+)?\b(?!\s*(?:lb|lbs|kg|kgs)\b)"#, options: .regularExpression) != nil {
            return nil
        }
        let isUnilateral = source.range(of: #"(?i)(?:/\s*(?:ea\b|each\b|leg\b|side\b)(?:\s+(?:leg|side|direction))?|\b(?:each|per)\s+(?:leg|side|direction)\b|\b(?:ea|each)\s+direction\b)"#, options: .regularExpression) != nil
        let withoutUnilateralSuffix = source.replacingOccurrences(
            of: #"(?i)\s*(?:/\s*(?:ea\b|each\b|leg\b|side\b)(?:\s+(?:leg|side|direction))?|\b(?:each|per)\s+(?:leg|side|direction)\b|\b(?:ea|each)\s+direction\b)"#,
            with: "",
            options: .regularExpression
        )
        let withoutWeight = withoutUnilateralSuffix.replacingOccurrences(of: #"(?i)@\s*\d+(?:\.\d+)?\s*(?:lb|lbs|kg|kgs)\b"#, with: "", options: .regularExpression)
        let match: [String]
        if let counted = capture(#"(?i)^\s*(\d+)\s+sets?\s+of\s+(\d+)\s*(.*?)\s*$"#, in: withoutWeight) {
            match = [counted[0], counted[1], counted[2], "", counted[3]]
        } else if let multiplied = capture(#"(?i)^\s*(\d+)\s*[x×]\s*(\d+)(?:\s*(?:-|–|\.\.)\s*(\d+))?\s*(.*?)\s*$"#, in: withoutWeight) {
            match = multiplied
        } else { return nil }
        guard let sets = Int(match[1]), let low = Int(match[2]), sets > 0, sets <= 99, low > 0 else { return nil }
        let high = Int(match[3]).map { max(low, $0) } ?? low
        let suffix = match[4].lowercased()
        let isDuration = suffix.range(of: #"^(?:s\b|sec|secs|second|min|mins|minute|['’]s\b)"#, options: .regularExpression) != nil
        let target: ParsedSetPrescription.Target = isDuration
            ? .duration(seconds: suffix.hasPrefix("min") ? low * 60 : low)
            : .repetitions(low...high)
        let pounds = capture(#"(?i)@\s*(\d+(?:\.\d+)?)\s*(lb|lbs|kg|kgs)\b"#, in: source).flatMap { value -> Double? in
            guard let amount = Double(value[1]) else { return nil }
            return Weight(amount, unit: value[2].lowercased().hasPrefix("kg") ? .kilograms : .pounds).pounds
        }
        let rest = capture(#"(?i)\brest\s*[:=]?\s*(\d+)\s*(?:s|sec|secs|seconds?)\b"#, in: source).flatMap { Double($0[1]) }
        return .init(sets: sets, target: target, suggestedPounds: pounds, restDuration: rest, isUnilateral: isUnilateral)
    }

    private func attachURLIfPresent(in line: String, to workout: inout ParsedWorkout, index: Int?) {
        guard let index, let id = youtubeVideoID(in: line) else { return }
        workout.exercises[index].youtubeVideoID = id
    }

    private func attachTrailingInstruction(in line: String, to workout: inout ParsedWorkout, index: Int?) {
        guard let index,
              let match = firstCapture(#"(?i)^\s*\d+\s*[x×]\s*\d+.*?\s+[—–-]\s+(.+)$"#, in: line),
              let range = Range(match.range, in: line) else { return }
        let value = String(line[range]).trimmingCharacters(in: .whitespacesAndNewlines)
        guard !value.isEmpty else { return }
        workout.exercises[index].reusableNotes = value
    }

    private func groupIdentifier(in line: String) -> String? {
        let stripped = line.trimmingCharacters(in: CharacterSet(charactersIn: "*# "))
        guard let match = capture(#"(?i)^([A-Z]\d*)\s*[—–-]\s*.+$"#, in: stripped) else { return nil }
        return match[1].uppercased()
    }

    private func groupExerciseName(in line: String) -> String? {
        let stripped = line.trimmingCharacters(in: CharacterSet(charactersIn: "*# "))
        guard let match = capture(#"(?i)^[A-Z]\d*\s*[—–-]\s*(.+)$"#, in: stripped) else { return nil }
        let name = cleanName(match[1])
        return name.isEmpty ? nil : name
    }

    private func distanceOnlyExercise(in line: String) -> (name: String, target: String)? {
        guard let match = capture(#"(?i)^(\d+(?:\.\d+)?)\s*(m|meters?|km|mi)\s+(.+)$"#, in: line) else { return nil }
        return (match[3].trimmingCharacters(in: .whitespacesAndNewlines), "\(match[1]) \(match[2])")
    }

    private func youtubeVideoID(in text: String) -> String? {
        if let direct = YouTubeVideoReference.videoID(from: text) { return direct }
        guard let match = firstCapture(#"https?://[^\s)>]+"#, in: text),
              let range = Range(match.range, in: text) else { return nil }
        return YouTubeVideoReference.videoID(from: String(text[range]))
    }

    private func isBullet(_ line: String) -> Bool { line.range(of: #"^\s*[-•*]\s+"#, options: .regularExpression) != nil }
    private func stripBullet(_ line: String) -> String { line.replacingOccurrences(of: #"^\s*[-•*]\s+"#, with: "", options: .regularExpression) }
    private func isWorkoutSpecificInstruction(_ text: String) -> Bool { text.range(of: #"(?i)\b(first|next|this)\s+block\b|\bincrease\s+weight\b"#, options: .regularExpression) != nil }
    private func looksInstructional(_ text: String) -> Bool { text.hasPrefix("-") || text.hasPrefix("•") || text.range(of: #"(?i)^(focus|maintain|increase|explosive|light weight|change)\b"#, options: .regularExpression) != nil }
    private func headingName(_ line: String) -> String? {
        guard line.range(of: #"(?i)^day\s*\d+\b"#, options: .regularExpression) != nil else { return nil }
        let title = line.replacingOccurrences(of: #"(?i)^day\s*\d+\s*(?:—|–|-|:)?\s*"#, with: "", options: .regularExpression)
        return cleanName(title)
    }
    private func cleanName(_ line: String) -> String { line.trimmingCharacters(in: CharacterSet.whitespacesAndNewlines.union(CharacterSet(charactersIn: "—–-:"))) }
    private func capture(_ pattern: String, in value: String) -> [String]? {
        guard let match = firstCapture(pattern, in: value) else { return nil }
        return match.groups
    }
    private func firstCapture(_ pattern: String, in value: String) -> (range: NSRange, groups: [String])? {
        guard let regex = try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive]),
              let match = regex.firstMatch(in: value, range: NSRange(value.startIndex..., in: value)) else { return nil }
        let groups = (0..<match.numberOfRanges).map { index -> String in
            let range = match.range(at: index)
            guard range.location != NSNotFound, let swift = Range(range, in: value) else { return "" }
            return String(value[swift])
        }
        return (match.range, groups)
    }
}
