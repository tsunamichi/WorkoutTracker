import Foundation

enum PlanImportFixtures {
    static let simple = "Push\n\nBack Squat 3x8\nPlank 3x30 sec"
    static let mixed = "Strength and Stability\n\nBack Squat — 3 × 8 @ 100 lb, rest 90 sec\nPlank: 3x30 sec"
    static let multiple = "Day 1 — Push\nBack Squat 3x8\n\nDay 2 — Core\nPlank 3x45 sec"
    static let unmatched = "Push\n\nMystery Press 3x10"
    static let ambiguous = "Pull\n\nRow 3x10"
    static let malformed = "Push\n\nBack Squat 0x8\nThis is not a prescription"
    static let longPlan = (1...12).map { "Day \($0) — Workout \($0)\nBack Squat 3x8\nPlank 3x30 sec" }.joined(separator: "\n\n")
}
