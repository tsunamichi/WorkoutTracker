//
//  WorkoutTimerAttributes.swift
//  WorkoutTracker
//
//  Activity Attributes for Workout Timer Live Activity
//

import Foundation
import ActivityKit

struct WorkoutTimerAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    // Dynamic properties
    var exerciseName: String
    var phase: String // "EXERCISE" | "REST" | "ROUND" | "COOLDOWN"
    var endDate: Date
    var isPaused: Bool
    var pausedRemainingSeconds: Int?
  }
  
  // Fixed properties for the duration of the Live Activity
  var id: String
}

