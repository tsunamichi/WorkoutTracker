import Foundation

enum WorkoutImportFixtures {
    static let simple = "Push\n\nBack Squat 3x8\nPlank 3x30 sec"
    static let mixed = "Strength and Stability\n\nBack Squat — 3 × 8 @ 100 lb, rest 90 sec\nPlank: 3x30 sec"
    static let multiple = "Day 1 — Push\nBack Squat 3x8\n\nDay 2 — Core\nPlank 3x45 sec"
    static let unmatched = "Push\n\nMystery Press 3x10"
    static let ambiguous = "Pull\n\nRow 3x10"
    static let malformed = "Push\n\nBack Squat 0x8\nThis is not a prescription"
    static let longInput = (1...12).map { "Day \($0) — Workout \($0)\nBack Squat 3x8\nPlank 3x30 sec" }.joined(separator: "\n\n")
    static let posteriorChain = """
    Posterior Chain Emphasis

    - Row — 120 sec
    - Wall Tibialis Raise — 2×15
    - Bent-Knee Floating Heel Wall ISO — 2×30 sec
    - Banded Glute Bridge March — 1×12
    - Walking RDL + Reach — 1x12
    - Prone Hamstring Curl Overcoming ISO — 3×5 sec
    - Seated Knee Extension Overcoming ISO — 3×5 sec
    - Trap Bar Jumps — 4×3
    - Back Squat — 3×8
    - Dumbbell Shoulder-Elevated Single-Leg Hip Thrust — 3x10
    - Glute Ham Raise — 3×4
    - Inverted Ring Row — 3×10–12
    - Dumbbell Hammer Curl — 3×15
    """
}
